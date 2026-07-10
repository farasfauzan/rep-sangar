<?php

namespace App\Jobs;

use App\Models\RabBudget;
use App\Models\RabImportJob;
use App\Traits\HandlesRabParsing;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class ValidateRabImportJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels, HandlesRabParsing;

    protected $jobId;

    public function __construct(int $jobId)
    {
        $this->jobId = $jobId;
    }

    public function handle(): void
    {
        $job = RabImportJob::find($this->jobId);
        if (! $job) return;

        $job->update(['status' => RabImportJob::STATUS_PROCESSING]);

        try {
            // 1. Initial parse to identify all valid sheets and columns
            $rawResult = $this->parseRaw($job->file_path, $job->file_type, 100);
            $sheets = $rawResult['sheets'];

            $validSheets = $this->findValidSheets($sheets);
            if (empty($validSheets)) {
                $job->update([
                    'status' => RabImportJob::STATUS_FAILED,
                    'errors' => ['Header tidak ditemukan dalam file Excel (kolom wajib: Uraian Pekerjaan, Volume, Harga Satuan).'],
                ]);
                return;
            }

            // 2. Perform streaming pass validation and collection across all valid sheets
            $errors = [];
            $newItems = [];
            $rowCount = 0;

            foreach ($validSheets as $sheetInfo) {
                if ($colError = $this->columnMapError($sheetInfo['colMap'])) {
                    $errors[] = "Sheet '{$sheetInfo['sheetName']}': {$colError}";
                    continue;
                }

                $currentCategory = $sheetInfo['sheetName']; // default category = sheet name

                foreach ($this->streamRows($job->file_path, $job->file_type, $sheetInfo['sheetName']) as $idx => $row) {
                    if ($idx <= $sheetInfo['headerIndex']) continue;

                    // Detect section header: description present, all numeric columns empty/null
                    $descCol = $sheetInfo['colMap']['uraian'] ?? -1;
                    $volCol = $sheetInfo['colMap']['volume'] ?? -1;
                    $priceCol = $sheetInfo['colMap']['harga_satuan'] ?? -1;
                    $desc = trim((string)($row[$descCol] ?? ''));
                    $vol = $row[$volCol] ?? null;
                    $price = $row[$priceCol] ?? null;
                    $amount = $row[$sheetInfo['colMap']['jumlah'] ?? -1] ?? null;

                    if ($desc !== '' && $vol === null && $price === null && $amount === null) {
                        // This is a section header row — use as category for subsequent rows
                        $currentCategory = $desc;
                        continue;
                    }

                    $normalized = $this->normalizeRabRow($row, $sheetInfo['colMap'], $idx + 1);
                    
                    if (is_array($normalized) && isset($normalized['error'])) {
                        $errors[] = "Sheet '{$sheetInfo['sheetName']}' {$normalized['error']}";
                        if (count($errors) >= 100) {
                            $errors[] = 'Ditemukan lebih dari 100 kesalahan. Membatasi tampilan error.';
                            break 2;
                        }
                        continue;
                    }

                    if (! $normalized) continue;

                    // If row has no category from column, use tracked section header
                    if (!isset($normalized['category']) || $normalized['category'] === null || $normalized['category'] === '') {
                        $normalized['category'] = $currentCategory;
                    }

                    $newItems[] = $normalized;
                    $rowCount++;
                }
            }

            if ($errors !== []) {
                $job->update([
                    'status' => RabImportJob::STATUS_FAILED,
                    'errors' => $errors,
                ]);
                return;
            }

            // 3. Compute differences against the current active version of RAB
            $currentMaxVersion = RabBudget::where('project_id', $job->project_id)->max('version') ?? 0;
            
            $activeRabs = RabBudget::where('project_id', $job->project_id)
                ->where('version', $currentMaxVersion)
                ->get()
                ->keyBy(function ($item) {
                    return $this->getUniqueKey($item->code_item, $item->description);
                });

            $added = [];
            $updated = [];
            $deleted = [];
            $seenKeys = [];

            foreach ($newItems as $newItem) {
                $key = $this->getUniqueKey($newItem['code_item'], $newItem['description']);
                $seenKeys[$key] = true;

                if ($activeRabs->has($key)) {
                    $activeItem = $activeRabs->get($key);
                    
                    // Check for changes
                    $hasChanges = false;
                    $changes = [];

                    foreach (['volume', 'unit_price', 'unit', 'category'] as $field) {
                        $oldVal = $activeItem->$field;
                        $newVal = $newItem[$field];

                        if ($field === 'volume' || $field === 'unit_price') {
                            if (abs((float)$oldVal - (float)$newVal) > 0.0001) {
                                $hasChanges = true;
                                $changes[$field] = ['old' => (float)$oldVal, 'new' => (float)$newVal];
                            }
                        } else {
                            if ($oldVal !== $newVal) {
                                $hasChanges = true;
                                $changes[$field] = ['old' => $oldVal, 'new' => $newVal];
                            }
                        }
                    }

                    if ($hasChanges) {
                        $updated[] = [
                            'code_item' => $newItem['code_item'],
                            'description' => $newItem['description'],
                            'changes' => $changes
                        ];
                    }
                } else {
                    $added[] = [
                        'code_item' => $newItem['code_item'],
                        'description' => $newItem['description'],
                        'volume' => $newItem['volume'],
                        'unit' => $newItem['unit'],
                        'unit_price' => $newItem['unit_price'],
                        'total_price' => $newItem['total_price'],
                    ];
                }
            }

            // Any active item not seen in the new file is marked as deleted
            foreach ($activeRabs as $key => $activeItem) {
                if (! isset($seenKeys[$key])) {
                    $deleted[] = [
                        'code_item' => $activeItem->code_item,
                        'description' => $activeItem->description,
                        'volume' => $activeItem->volume,
                        'unit' => $activeItem->unit,
                        'total_price' => $activeItem->total_price,
                    ];
                }
            }

            $diff = [
                'added_count' => count($added),
                'updated_count' => count($updated),
                'deleted_count' => count($deleted),
                'added' => array_slice($added, 0, 50), // limits diff detail payload size
                'updated' => array_slice($updated, 0, 50),
                'deleted' => array_slice($deleted, 0, 50),
            ];

            $job->update([
                'status' => RabImportJob::STATUS_VALIDATED,
                'total_rows' => $rowCount,
                'errors' => [],
                'diff' => $diff,
            ]);

        } catch (\Throwable $e) {
            Log::error("Validation Job error: " . $e->getMessage() . "\n" . $e->getTraceAsString());
            $job->update([
                'status' => RabImportJob::STATUS_FAILED,
                'errors' => ['Gagal memproses validasi file: ' . $e->getMessage()],
            ]);
        }
    }

    private function getUniqueKey(?string $code, string $description): string
    {
        $codeClean = strtolower(trim((string)$code));
        $descClean = strtolower(trim($description));
        return $codeClean !== '' ? $codeClean : md5($descClean);
    }
}
