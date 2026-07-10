<?php

namespace App\Jobs;

use App\Models\InventoryStock;
use App\Models\PoItem;
use App\Models\PurchaseRequisition;
use App\Models\RabBudget;
use App\Models\RabImportJob;
use App\Traits\HandlesRabParsing;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use App\Services\MimoAiService;

class ExecuteRabImportJob implements ShouldQueue
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
        if (! $job || $job->status !== RabImportJob::STATUS_IMPORTING) return;

        try {
            // 1. Identify all valid sheets and columns again
            $rawResult = $this->parseRaw($job->file_path, $job->file_type, 100);
            $sheets = $rawResult['sheets'];

            $validSheets = $this->findValidSheets($sheets);
            if (empty($validSheets)) {
                $job->update(['status' => RabImportJob::STATUS_FAILED, 'errors' => ['Header tidak ditemukan saat eksekusi import.']]);
                return;
            }

            // 2. Determine versions
            $projectId = $job->project_id;
            $currentMaxVersion = RabBudget::where('project_id', $projectId)->max('version') ?? 0;
            $newVersion = $currentMaxVersion + 1;

            $batchSize = 250;
            $batch = [];
            $totalImported = 0;

            DB::beginTransaction();

            foreach ($validSheets as $sheetInfo) {
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
                    if ($idx <= $sheetInfo['headerIndex']) continue;

                    // Extract columns
                    $descCol = $sheetInfo['colMap']['uraian'] ?? -1;
                    $volCol = $sheetInfo['colMap']['volume'] ?? -1;
                    $priceCol = $sheetInfo['colMap']['harga_satuan'] ?? -1;
                    $kodeCol = $sheetInfo['colMap']['kode'] ?? -1;
                    $desc = trim((string)($row[$descCol] ?? ''));
                    $vol = $row[$volCol] ?? null;
                    $price = $row[$priceCol] ?? null;
                    $amount = $row[$sheetInfo['colMap']['jumlah'] ?? -1] ?? null;
                    $kode = trim((string)($row[$kodeCol] ?? ''));

                    // Detect section header: description present, all numeric columns empty/null
                    if ($desc !== '' && $vol === null && $price === null && $amount === null) {
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
                            $currentSectionCode = str_pad($mainSectionCount ?: 1, 2, '0', STR_PAD_LEFT) . str_pad($subSectionCount, 2, '0', STR_PAD_LEFT);
                            $currentCategory = $desc;
                        }
                        continue;
                    }

                    $normalized = $this->normalizeRabRow($row, $sheetInfo['colMap'], $idx + 1, $currentSectionCode);
                    if (! $normalized || (isset($normalized['error']))) continue;

                    // Generate hierarchical or resource code if empty
                    if (!isset($normalized['code_item']) || $normalized['code_item'] === null || $normalized['code_item'] === '') {
                        if ($currentResourceCategory !== null) {
                            $prefix = [
                                'Material' => 'M',
                                'Upah' => 'T',
                                'Alat' => 'A',
                                'Subkon' => 'S',
                            ][$currentResourceCategory] ?? 'M';
                            $normalized['code_item'] = $prefix . $resourceCounters[$currentResourceCategory]++;
                            $normalized['category'] = $currentResourceCategory;
                        } else {
                            $normalized['code_item'] = $currentSectionCode . str_pad($itemCount++, 2, '0', STR_PAD_LEFT);
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
                        RabBudget::insert($batch);
                        $totalImported += count($batch);
                        $job->update(['processed_rows' => $totalImported]);
                        $batch = [];
                    }
                }
            }

            if ($batch !== []) {
                RabBudget::insert($batch);
                $totalImported += count($batch);
                $job->update(['processed_rows' => $totalImported]);
            }

            // 3. AI classification for all new items
            $mimo = app(MimoAiService::class);
            if ($mimo->isConfigured()) {
                $newItems = RabBudget::where('project_id', $projectId)
                    ->where('version', $newVersion)
                    ->whereNull('ai_category')
                    ->get(['id', 'description']);

                $descriptions = $newItems->pluck('description')->toArray();
                $categories = $mimo->classifyBatch($descriptions);

                foreach ($newItems as $i => $item) {
                    if (($categories[$i] ?? null) !== null) {
                        RabBudget::where('id', $item->id)->update(['ai_category' => $categories[$i]]);
                    }
                }
                Log::info("AI classification done", [
                    'classified' => count(array_filter($categories)),
                    'total' => count($descriptions),
                ]);
            }

            // 4. Remap references from old version to new version
            $oldActiveRabs = RabBudget::where('project_id', $projectId)
                ->where('version', $currentMaxVersion)
                ->get();

            $newActiveRabs = RabBudget::where('project_id', $projectId)
                ->where('version', $newVersion)
                ->get();

            $newRabsByKey = $newActiveRabs->keyBy(function ($item) {
                return $this->getUniqueKey($item->code_item, $item->description);
            });

            $remappedCount = 0;
            foreach ($oldActiveRabs as $oldItem) {
                $key = $this->getUniqueKey($oldItem->code_item, $oldItem->description);
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

            // 5. Archive & soft-delete older version items
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

            // 6. Create inventory stocks for newly added RAB items
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
                        InventoryStock::insert($stockBatch);
                        $stockBatch = [];
                    }
                }
            }

            if ($stockBatch !== []) {
                InventoryStock::insert($stockBatch);
            }

            DB::commit();

            $job->update([
                'status' => RabImportJob::STATUS_COMPLETED,
            ]);

        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error("Execute Import Job error: " . $e->getMessage() . "\n" . $e->getTraceAsString());
            $job->update([
                'status' => RabImportJob::STATUS_FAILED,
                'errors' => ['Gagal memproses import data: ' . $e->getMessage()],
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
