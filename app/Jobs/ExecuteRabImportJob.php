<?php

namespace App\Jobs;

use App\Models\InventoryStock;
use App\Models\PoItem;
use App\Models\PurchaseRequisition;
use App\Models\RabBudget;
use App\Models\RabImportJob;
use App\Services\MimoAiService;
use App\Traits\HandlesRabParsing;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ExecuteRabImportJob implements ShouldQueue
{
    use Dispatchable, HandlesRabParsing, InteractsWithQueue, Queueable, SerializesModels;

    protected $jobId;

    public function __construct(int $jobId)
    {
        $this->jobId = $jobId;
    }

    public function handle(): void
    {
        $job = RabImportJob::find($this->jobId);
        if (! $job || $job->status !== RabImportJob::STATUS_IMPORTING) {
            return;
        }

        try {
            // 0. Ensure SQLite busy_timeout is high enough to survive lock contention
            try {
                DB::statement('PRAGMA busy_timeout=5000');
            } catch (\Throwable $_) {
                // Ignore if not SQLite
            }

            // 1. Identify all valid sheets and columns again
            $rawResult = $this->parseRaw($job->file_path, $job->file_type, 100, $job->sheet_name);
            $sheets = $rawResult['sheets'];

            $validSheets = $this->findValidSheets($sheets);
            $multiSheetImport = count($validSheets) > 1;
            if (empty($validSheets)) {
                $job->update(['status' => RabImportJob::STATUS_FAILED, 'errors' => ['Header tidak ditemukan saat eksekusi import.']]);

                return;
            }

            $projectId = $job->project_id;

            $batchSize = 100;
            $batch = [];
            $totalImported = 0;

            DB::beginTransaction();

            // 2. Determine versions inside the transaction so concurrent imports
            // cannot obtain the same next-version value.
            $currentMaxVersion = RabBudget::where('project_id', $projectId)->max('version') ?? 0;
            $newVersion = $currentMaxVersion + 1;

            foreach ($validSheets as $sheetInfo) {
                // Bug #2 fix: Reset code counters per sheet to avoid state leaking
                $this->resetCodeCounters();

                $currentCategory = $sheetInfo['sheetName']; // default category = sheet name
                $currentSectionCode = '0101';
                $currentResourceCategory = null;

                $mainSectionCount = 0;
                $subSectionCount = 1;
                $itemCount = 1;

                $resourceCounters = [
                    'Material' => 10001,
                    'Upah' => 10001,
                    'Alat' => 10001,
                    'Subkon' => 10001,
                ];

                foreach ($this->streamRows($job->file_path, $job->file_type, $sheetInfo['sheetName']) as $idx => $row) {
                    if ($idx <= $sheetInfo['headerIndex']) {
                        continue;
                    }

                    // Extract columns
                    $descCol = $sheetInfo['colMap']['uraian'] ?? -1;
                    $volCol = $sheetInfo['colMap']['volume'] ?? -1;
                    $priceCol = $sheetInfo['colMap']['harga_satuan'] ?? -1;
                    $kodeCol = $sheetInfo['colMap']['kode'] ?? -1;
                    $desc = trim((string) ($row[$descCol] ?? ''));
                    $vol = $row[$volCol] ?? null;
                    $price = $row[$priceCol] ?? null;
                    $amount = $row[$sheetInfo['colMap']['jumlah'] ?? -1] ?? null;
                    $kode = trim((string) ($row[$kodeCol] ?? ''));

                    // A hierarchical recap can carry a subtotal on its Roman-
                    // numeral section row. It is a category boundary, not an
                    // importable item, even though the amount cell is filled.
                    if ($this->isNumberedRecapSectionRow($row, $sheetInfo['colMap'], $desc)) {
                        $currentResourceCategory = null;
                        $mainSectionCount++;
                        $subSectionCount = 1;
                        $itemCount = 1;
                        $currentSectionCode = str_pad($mainSectionCount, 2, '0', STR_PAD_LEFT).'01';
                        $currentCategory = $multiSheetImport
                            ? $sheetInfo['sheetName'].' / '.$desc
                            : $desc;

                        continue;
                    }

                    // Only numbered parent rows are imported from hierarchical
                    // recaps. Resource subheadings between parent rows must not
                    // leak Material/Upah/Alat into the next parent category.
                    if ($this->isNumberedRecapItemRow($row, $sheetInfo['colMap'])) {
                        $currentResourceCategory = null;
                    }

                    // Detect section header: description present, all numeric columns empty/null
                    // Bug #4 fix: Use isEmptyCell() to handle both null and '' from XML streaming
                    if ($desc !== '' && $this->isEmptyCell($vol) && $this->isEmptyCell($price) && $this->isEmptyCell($amount)) {
                        $resCat = $this->detectResourceCategory($desc);
                        if ($resCat !== null) {
                            $currentResourceCategory = $resCat;
                        } else {
                            $currentResourceCategory = null;
                            if ($this->isLevel1Section($desc, $kode)) {
                                $mainSectionCount++;
                                $subSectionCount = 1;
                                $itemCount = 1;
                            } else {
                                $subSectionCount++;
                                $itemCount = 1;
                            }
                            $currentSectionCode = str_pad($mainSectionCount ?: 1, 2, '0', STR_PAD_LEFT).str_pad($subSectionCount, 2, '0', STR_PAD_LEFT);
                            $currentCategory = $multiSheetImport
                                ? $sheetInfo['sheetName'].' / '.$desc
                                : $desc;
                        }

                        continue;
                    }

                    $normalized = $this->normalizeRabRow($row, $sheetInfo['colMap'], $idx + 1, $currentSectionCode);
                    if (! $normalized || (isset($normalized['error']))) {
                        continue;
                    }

                    // Generate hierarchical or resource code if empty
                    if (! isset($normalized['code_item']) || $normalized['code_item'] === null || $normalized['code_item'] === '') {
                        if ($currentResourceCategory !== null) {
                            $prefix = [
                                'Material' => 'M',
                                'Upah' => 'T',
                                'Alat' => 'A',
                                'Subkon' => 'S',
                            ][$currentResourceCategory] ?? 'M';
                            $normalized['code_item'] = $prefix.$resourceCounters[$currentResourceCategory]++;
                            $normalized['category'] = $multiSheetImport
                                ? $sheetInfo['sheetName'].' / '.$currentResourceCategory
                                : $currentResourceCategory;
                        } else {
                            $normalized['code_item'] = $currentSectionCode.str_pad($itemCount++, 2, '0', STR_PAD_LEFT);
                            $normalized['category'] = $currentCategory;
                        }
                    } else {
                        // Keep existing code, but assign appropriate category
                        if ($currentResourceCategory !== null) {
                            $normalized['category'] = $currentResourceCategory;
                        } else {
                            $normalized['category'] = $currentCategory;
                        }
                    }

                    $category = $normalized['category'];

                    $batch[] = [
                        'project_id' => $projectId,
                        'version' => $newVersion,
                        'rab_import_job_id' => $job->id,
                        'code_item' => $normalized['code_item'],
                        'description' => $normalized['description'],
                        'volume' => $normalized['volume'],
                        'unit' => $normalized['unit'],
                        'unit_price' => $normalized['unit_price'],
                        'total_price' => $normalized['total_price'],
                        'category' => $category,
                        'status' => RabBudget::STATUS_DRAFT,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ];

                    if (count($batch) >= $batchSize) {
                        $this->insertWithRetry(RabBudget::class, $batch);
                        $totalImported += count($batch);
                        $job->update(['processed_rows' => $totalImported]);
                        $batch = [];
                    }
                }
                // Bug #1 fix: Do NOT break — process ALL valid sheets
            }

            if ($batch !== []) {
                $this->insertWithRetry(RabBudget::class, $batch);
                $totalImported += count($batch);
                $job->update(['processed_rows' => $totalImported]);
            }

            // 3. Remap references from old version to new version
            $oldActiveRabs = RabBudget::where('project_id', $projectId)
                ->where('version', $currentMaxVersion)
                ->get();

            $newActiveRabs = RabBudget::where('project_id', $projectId)
                ->where('version', $newVersion)
                ->get();

            // Detect duplicate remap keys in the new dataset before building the
            // key-based lookup map. Collisions would cause references to be mapped
            // to the wrong new item.
            $newRabKeys = [];
            $duplicateKeys = [];
            foreach ($newActiveRabs as $newItem) {
                $key = $this->getUniqueKey($newItem->code_item, $newItem->description, $newItem->category);
                if (isset($newRabKeys[$key])) {
                    $duplicateKeys[$key] = true;
                } else {
                    $newRabKeys[$key] = true;
                }
            }
            if ($duplicateKeys !== []) {
                throw new \RuntimeException('Duplikat kode/deskripsi RAB ditemukan, tidak dapat memetakan ulang referensi PO/PR. Duplikat: '.implode(', ', array_keys($duplicateKeys)));
            }

            $newRabsByKey = $newActiveRabs->keyBy(function ($item) {
                return $this->getUniqueKey($item->code_item, $item->description, $item->category);
            });

            $remappedCount = 0;
            foreach ($oldActiveRabs as $oldItem) {
                $key = $this->getUniqueKey($oldItem->code_item, $oldItem->description, $oldItem->category);
                if ($newRabsByKey->has($key)) {
                    $newItem = $newRabsByKey->get($key);

                    // Update Inventory Stocks
                    InventoryStock::where('project_id', $projectId)
                        ->where('rab_budget_id', $oldItem->id)
                        ->update(['rab_budget_id' => $newItem->id]);

                    // Update Purchase Order Items
                    PoItem::where('rab_budget_id', $oldItem->id)
                        ->update(['rab_budget_id' => $newItem->id]);

                    // Update Purchase Requisitions
                    PurchaseRequisition::where('project_id', $projectId)
                        ->where('rab_budget_id', $oldItem->id)
                        ->update(['rab_budget_id' => $newItem->id]);

                    $remappedCount++;
                }
            }

            // 4. Archive & soft-delete older version items
            if ($currentMaxVersion > 0) {
                // Use withTrashed to update status on rows we're about to soft-delete,
                // so the audit trail keeps ARCHIVED even after deletion.
                RabBudget::withTrashed()
                    ->where('project_id', $projectId)
                    ->where('version', '<=', $currentMaxVersion)
                    ->update(['status' => RabBudget::STATUS_ARCHIVED]);

                RabBudget::where('project_id', $projectId)
                    ->where('version', '<=', $currentMaxVersion)
                    ->delete(); // Soft delete
            }

            // 5. Create inventory stocks for newly added RAB items
            $existingStockRabs = InventoryStock::where('project_id', $projectId)
                ->pluck('rab_budget_id')
                ->filter()
                ->toArray();

            $stockBatch = [];
            foreach ($newActiveRabs as $rab) {
                if (! in_array($rab->id, $existingStockRabs)) {
                    $stockBatch[] = [
                        'project_id' => $projectId,
                        'rab_budget_id' => $rab->id,
                        'item_name' => $rab->description,
                        'unit' => $rab->unit ?: 'LS',
                        'quantity' => 0,
                        'min_quantity' => 0,
                        'location' => '-',
                        'created_at' => now(),
                        'updated_at' => now(),
                    ];

                    if (count($stockBatch) >= $batchSize) {
                        $this->insertWithRetry(InventoryStock::class, $stockBatch);
                        $stockBatch = [];
                    }
                }
            }

            if ($stockBatch !== []) {
                $this->insertWithRetry(InventoryStock::class, $stockBatch);
            }

            DB::commit();

            // 6. AI classification for all new items (async, non-blocking).
            // Dispatched AFTER commit so it does not hold the import transaction.
            $mimo = app(MimoAiService::class);
            if ($mimo->isConfigured()) {
                $newItemCount = RabBudget::where('project_id', $projectId)
                    ->where('version', $newVersion)
                    ->whereNull('ai_category')
                    ->count();

                $chunkSize = 100;
                for ($offset = 0; $offset < $newItemCount; $offset += $chunkSize) {
                    ClassifyRabAiJob::dispatch($projectId, $newVersion, $offset, $chunkSize);
                }

                Log::info('AI classification dispatched', [
                    'project_id' => $projectId,
                    'version' => $newVersion,
                    'items' => $newItemCount,
                    'chunks' => ceil($newItemCount / $chunkSize),
                ]);
            }

            $job->update([
                'status' => RabImportJob::STATUS_COMPLETED,
            ]);

        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error('Execute Import Job error: '.$e->getMessage()."\n".$e->getTraceAsString());
            $job->update([
                'status' => RabImportJob::STATUS_FAILED,
                'errors' => ['Gagal memproses import data: '.$e->getMessage()],
            ]);
        }
    }

    /**
     * Insert with retry on SQLite "database is locked" (HY000 code 5).
     */
    private function insertWithRetry(string $modelClass, array $rows, int $maxRetries = 3): void
    {
        $attempt = 0;
        while (true) {
            try {
                $modelClass::insert($rows);

                return;
            } catch (\Throwable $e) {
                $attempt++;
                if ($attempt >= $maxRetries) {
                    throw $e;
                }
                // Check if this is a "database is locked" error
                $msg = $e->getMessage();
                if (str_contains($msg, 'database is locked') || (str_contains($msg, 'HY000') && str_contains($msg, '5 '))) {
                    usleep(200000 * $attempt); // 0.2s, 0.4s, 0.6s backoff

                    continue;
                }
                throw $e;
            }
        }
    }

    private function getUniqueKey(?string $code, string $description, ?string $category = null): string
    {
        $codeClean = strtolower(trim((string) $code));
        $descClean = strtolower(trim($description));
        $catClean = strtolower(trim((string) $category));

        // Bug #5 fix: Include category in key to avoid collision between
        // items with same code/description across different RAB sections
        if ($codeClean !== '') {
            return $catClean !== '' ? $codeClean.'::'.$catClean : $codeClean;
        }

        return md5($descClean.'::'.$catClean);
    }
}
