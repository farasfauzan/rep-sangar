<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InventoryStock;
use App\Models\RabBudget;
use App\Models\RabImportJob;
use App\Models\PoItem;
use App\Models\PurchaseRequisition;
use App\Jobs\ValidateRabImportJob;
use App\Jobs\ExecuteRabImportJob;
use App\Services\WorkflowNotificationService;
use App\Traits\HandlesRabParsing;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class RabBudgetController extends Controller
{
    use HandlesRabParsing;

    public function __construct(private readonly WorkflowNotificationService $notifications)
    {
    }

    /**
     * Preview Excel (first 30 rows)
     */
    public function preview(Request $request)
    {
        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls,csv,txt|max:51200',
        ]);

        $file = $request->file('file');
        $type = strtolower($file->getClientOriginalExtension());
        if ($type === 'txt') $type = 'csv';

        $rows = [];
        $errors = [];

        try {
            $result = $this->parseRaw($file->getRealPath(), $type, 30);
            $sheets = $result['sheets'];
            $errors = $result['errors'];

            $best = $this->findBestSheet($sheets);

            if ($best === null) {
                return response()->json([
                    'success' => false,
                    'message' => 'Header tidak ditemukan dalam 30 baris pertama.',
                ], 422);
            }

            if ($message = $this->columnMapError($best['colMap'])) {
                return response()->json(['success' => false, 'message' => $message], 422);
            }

            foreach ($best['rows'] as $idx => $row) {
                if ($idx <= $best['headerIndex']) continue;

                $normalized = $this->normalizeRabRow($row, $best['colMap'], $idx + 1);
                if (is_array($normalized) && isset($normalized['error'])) {
                    $errors[] = $normalized['error'];
                    continue;
                }
                if (! $normalized) continue;

                $rows[] = [
                    'no' => $normalized['code_item'],
                    'uraian' => $normalized['description'],
                    'volume' => $normalized['volume'],
                    'satuan' => $normalized['unit'],
                    'harga_satuan' => $normalized['unit_price'],
                    'jumlah' => $normalized['total_price'],
                ];
            }
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Gagal membaca file: ' . $e->getMessage(),
            ], 500);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'headers' => ['No', 'Uraian Pekerjaan', 'Volume', 'Satuan', 'Harga Satuan (Rp)', 'Jumlah (Rp)'],
                'rows' => $rows,
                'total_rows' => count($rows),
                'sheet_used' => $best['sheetName'],
                'errors' => array_slice($errors, 0, 20),
                'invalid_rows' => count($errors),
                'column_mapping' => $best['colMap'],
            ],
        ]);
    }

    /**
     * Legacy Auto-import (synchronous) - kept for compatibility and feature tests
     */
    public function autoImport(Request $request)
    {
        // Parsing Excel 1000+ row bisa makan waktu; hilangkan batas 30s
        @set_time_limit(0);
        @ini_set('memory_limit', '512M');

        $request->validate([
            'project_id' => 'required|exists:projects,id',
            'file' => 'required|file|mimes:xlsx,xls,csv,txt|max:51200',
            'confirm_replace' => 'nullable|boolean',
        ]);

        $file = $request->file('file');
        $projectId = $request->project_id;
        $type = strtolower($file->getClientOriginalExtension());
        if ($type === 'txt') $type = 'csv';

        try {
            $rawResult = $this->parseRaw($file->getRealPath(), $type, 100);
            $sheets = $rawResult['sheets'];

            $best = $this->findBestSheet($sheets);
            if ($best === null) {
                return response()->json([
                    'success' => false,
                    'message' => 'Header tidak ditemukan dalam file Excel.',
                ], 422);
            }

            if ($message = $this->columnMapError($best['colMap'])) {
                return response()->json(['success' => false, 'message' => $message], 422);
            }

            // Sync validation
            $errors = [];
            $newItems = [];
            $rowCount = 0;
            foreach ($this->streamRows($file->getRealPath(), $type, $best['sheetName']) as $idx => $row) {
                if ($idx <= $best['headerIndex']) continue;

                $normalized = $this->normalizeRabRow($row, $best['colMap'], $idx + 1);
                if (is_array($normalized) && isset($normalized['error'])) {
                    $errors[] = $normalized['error'];
                    if (count($errors) >= 100) break;
                    continue;
                }
                if (! $normalized) continue;
                $newItems[] = $normalized;
                $rowCount++;
            }

            if ($errors !== []) {
                return response()->json([
                    'success' => false,
                    'message' => 'Import dibatalkan. Perbaiki data pada baris yang ditandai.',
                    'errors' => $errors,
                    'invalid_rows' => count($errors),
                ], 422);
            }

            // Check replacement confirmation
            $currentCount = RabBudget::where('project_id', $projectId)->count();
            if ($currentCount > 0 && ! $request->boolean('confirm_replace')) {
                return response()->json([
                    'success' => false,
                    'message' => "Proyek ini sudah memiliki {$currentCount} item RAB. Konfirmasi penggantian diperlukan.",
                    'requires_confirmation' => true,
                    'current_item_count' => $currentCount,
                ], 422);
            }

            // Execute synchronously
            $batchSize = 200;

            $result = DB::transaction(function () use ($newItems, $projectId, $batchSize) {
                // Hitung versi di dalam transaksi dengan lockForUpdate
                // untuk mencegah race condition dual import yang menghasilkan versi sama.
                $currentMaxVersion = RabBudget::where('project_id', $projectId)
                    ->lockForUpdate()
                    ->max('version') ?? 0;
                $newVersion = $currentMaxVersion + 1;

                $batch = [];
                $imported = 0;

                foreach ($newItems as $normalized) {
                    $batch[] = [
                        'project_id' => $projectId,
                        'version' => $newVersion,
                        'code_item' => $normalized['code_item'],
                        'description' => $normalized['description'],
                        'volume' => $normalized['volume'],
                        'unit' => $normalized['unit'],
                        'unit_price' => $normalized['unit_price'],
                        'total_price' => $normalized['total_price'],
                        'category' => $normalized['category'],
                        'status' => RabBudget::STATUS_DRAFT,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ];

                    if (count($batch) >= $batchSize) {
                        RabBudget::insert($batch);
                        $imported += count($batch);
                        $batch = [];
                    }
                }

                if ($batch !== []) {
                    RabBudget::insert($batch);
                    $imported += count($batch);
                }

                // Remap references
                $oldActiveRabs = RabBudget::where('project_id', $projectId)
                    ->where('version', $currentMaxVersion)
                    ->get();

                $newActiveRabs = RabBudget::where('project_id', $projectId)
                    ->where('version', $newVersion)
                    ->get();

                $newRabsByKey = $newActiveRabs->keyBy(function ($item) {
                    $codeClean = strtolower(trim((string)$item->code_item));
                    $descClean = strtolower(trim($item->description));
                    return $codeClean !== '' ? $codeClean : md5($descClean);
                });

                foreach ($oldActiveRabs as $oldItem) {
                    $codeClean = strtolower(trim((string)$oldItem->code_item));
                    $descClean = strtolower(trim($oldItem->description));
                    $key = $codeClean !== '' ? $codeClean : md5($descClean);
                    if ($newRabsByKey->has($key)) {
                        $newItem = $newRabsByKey->get($key);
                        InventoryStock::where('project_id', $projectId)
                            ->where('rab_budget_id', $oldItem->id)
                            ->update(['rab_budget_id' => $newItem->id]);

                        PoItem::where('rab_budget_id', $oldItem->id)
                            ->update(['rab_budget_id' => $newItem->id]);

                        PurchaseRequisition::where('project_id', $projectId)
                            ->where('rab_budget_id', $oldItem->id)
                            ->update(['rab_budget_id' => $newItem->id]);
                    }
                }

                // Archive/soft-delete
                if ($currentMaxVersion > 0) {
                    RabBudget::where('project_id', $projectId)
                        ->where('version', '<=', $currentMaxVersion)
                        ->update(['status' => 'ARCHIVED']);

                    RabBudget::where('project_id', $projectId)
                        ->where('version', '<=', $currentMaxVersion)
                        ->delete();
                }

                // A RAB is a budget plan, not a physical receipt. Inventory
                // is created/increased only when Material is received against
                // an approved supplier PO.

                return [
                    'imported' => $imported,
                    'archived' => count($oldActiveRabs),
                ];
            });

            return response()->json([
                'success' => true,
                'message' => "Berhasil mengimport {$result['imported']} item RAB.",
                'data' => [
                    'imported' => $result['imported'],
                    'archived' => $result['archived'],
                    'project_id' => $projectId,
                ],
            ]);
        } catch (\Throwable $e) {
            Log::error('Sync RAB Import Error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Gagal import: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Async Auto-import (background job)
     */
    public function importAsync(Request $request)
    {
        @set_time_limit(0);
        @ini_set('memory_limit', '512M');

        $validator = \Illuminate\Support\Facades\Validator::make($request->all(), [
            'project_id' => 'required|exists:projects,id',
            'file' => 'required|file|mimes:xlsx,xls,csv,txt|max:51200',
            'sheet_name' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validasi input gagal.',
                'errors' => $validator->errors()
            ], 422);
        }

        $file = $request->file('file');
        $projectId = $request->project_id;
        $type = strtolower($file->getClientOriginalExtension());
        if ($type === 'txt') $type = 'csv';

        try {
            $fileName = time() . '_' . str_replace(' ', '_', $file->getClientOriginalName());
            $filePath = $file->storeAs('imports', $fileName);
            $absolutePath = \Illuminate\Support\Facades\Storage::path($filePath);

            $job = RabImportJob::create([
                'project_id' => $projectId,
                'file_path' => $absolutePath,
                'file_name' => $file->getClientOriginalName(),
                'file_type' => $type,
                'sheet_name' => $request->sheet_name,
                'status' => RabImportJob::STATUS_PENDING,
            ]);

            ValidateRabImportJob::dispatch($job->id);

            return response()->json([
                'success' => true,
                'message' => 'File diupload. Sedang memvalidasi data...',
                'data' => $job,
            ]);
        } catch (\Throwable $e) {
            Log::error('Async RAB Import Error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Gagal upload file: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get background import status
     */
    public function getImportStatus($id)
    {
        $job = RabImportJob::findOrFail($id);
        return response()->json([
            'success' => true,
            'data' => $job,
        ]);
    }

    /**
     * Re-validate import with specific sheet
     */
    public function revalidateImport(Request $request, $id)
    {
        $job = RabImportJob::findOrFail($id);

        $validator = \Illuminate\Support\Facades\Validator::make($request->all(), [
            'sheet_name' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        $job->update([
            'sheet_name' => $request->sheet_name,
            'status' => RabImportJob::STATUS_PENDING,
            'errors' => [],
            'diff' => null,
            'total_rows' => 0,
        ]);

        ValidateRabImportJob::dispatch($job->id);

        return response()->json([
            'success' => true,
            'message' => 'Re-validasi dengan sheet "' . $request->sheet_name . '"...',
            'data' => $job,
        ]);
    }

    /**
     * Confirm and execute import in background
     */
    public function confirmImport($id)
    {
        $job = RabImportJob::findOrFail($id);
        if ($job->status !== RabImportJob::STATUS_VALIDATED) {
            return response()->json([
                'success' => false,
                'message' => 'Hanya file yang telah tervalidasi yang dapat diimport.',
            ], 400);
        }

        $job->update([
            'status' => RabImportJob::STATUS_IMPORTING,
            'processed_rows' => 0,
        ]);

        ExecuteRabImportJob::dispatch($job->id);

        return response()->json([
            'success' => true,
            'message' => 'Eksekusi import dimulai di background...',
            'data' => $job,
        ]);
    }



    public function index(Request $request)
    {
        $query = RabBudget::with('project');
        $projectId = $request->route('projectId') ?? $request->get('project_id');

        if ($projectId) {
            $query->where('project_id', $projectId);
            $latestVersion = RabBudget::where('project_id', $projectId)->max('version') ?? 1;
            $query->where('version', $latestVersion);
        }

        if ($request->get('per_page') == -1 || $request->get('all') == 1) {
            return response()->json([
                'success' => true,
                'data' => $query->orderBy('id')->get(),
            ]);
        }

        return response()->json([
            'success' => true,
            'data' => $query->orderBy('id')->paginate($request->get('per_page', 50)),
        ]);
    }

    /**
     * Export RAB items to Excel using fast-excel.
     */
    public function export(Request $request)
    {
        $query = RabBudget::with('project');
        $projectId = $request->route('projectId') ?? $request->get('project_id');

        if ($projectId) {
            $query->where('project_id', $projectId);
            $latestVersion = RabBudget::where('project_id', $projectId)->max('version') ?? 1;
            $query->where('version', $latestVersion);
        }

        $data = $query->orderBy('id')->get()->map(function ($item) {
            return [
                'Kode' => $item->code_item,
                'Uraian' => $item->description,
                'Satuan' => $item->unit,
                'Volume' => $item->volume,
                'Harga Satuan' => $item->unit_price,
                'Jumlah' => $item->total_price,
                'Kategori' => $item->category,
                'Status' => $item->status,
            ];
        });

        $filename = 'RAB-' . ($projectId ?? 'all') . '.xlsx';

        return (new \Rap2hpoutre\FastExcel\FastExcel($data))
            ->download($filename);
    }

    public function show($id)
    {
        $rab = RabBudget::with('project')->findOrFail($id);
        return response()->json(['success' => true, 'data' => $rab]);
    }

    public function update(Request $request, $id)
    {
        $rab = RabBudget::findOrFail($id);

        if ($rab->is_locked) {
            return response()->json([
                'success' => false,
                'message' => 'RAB item terkunci (APPROVED). Tidak bisa diedit.',
            ], 403);
        }

        $validated = $request->validate([
            'code_item' => 'sometimes|string|max:255',
            'description' => 'sometimes|string|max:255',
            'unit' => 'nullable|string|max:50',
            'volume' => 'nullable|numeric|min:0',
            'unit_price' => 'nullable|numeric|min:0',
            'total_price' => 'nullable|numeric|min:0',
            'category' => 'nullable|string|max:255',
            'kode' => 'sometimes|string|max:255',
            'uraian' => 'sometimes|string|max:255',
            'satuan' => 'nullable|string|max:50',
            'harga_satuan' => 'nullable|numeric|min:0',
            'jumlah' => 'nullable|numeric|min:0',
        ]);

        $data = $validated;
        foreach (['kode' => 'code_item', 'uraian' => 'description', 'satuan' => 'unit', 'harga_satuan' => 'unit_price', 'jumlah' => 'total_price'] as $old => $new) {
            if ($request->has($old)) {
                $data[$new] = $request->input($old);
            }
        }
        $rab->update($data);
        return response()->json(['success' => true, 'data' => $rab]);
    }

    public function destroy($id)
    {
        $rab = RabBudget::findOrFail($id);

        if ($rab->is_locked) {
            return response()->json([
                'success' => false,
                'message' => 'RAB item terkunci (APPROVED). Tidak bisa dihapus.',
            ], 403);
        }

        $rab->delete();
        return response()->json(['success' => true, 'message' => 'RAB item deleted']);
    }

    public function submitForApproval(Request $request)
    {
        $request->validate([
            'project_id' => 'required_without:item_ids|exists:projects,id',
            'item_ids' => 'required_without:project_id|array|min:1',
            'item_ids.*' => 'integer|exists:rab_budgets,id',
        ]);
        $count = $request->has('item_ids')
            ? RabBudget::submitSelected($request->item_ids)
            : RabBudget::submitForApproval($request->project_id);
        if ($count > 0) {
            $this->notifications->toRole(
                'ENGINEER',
                'RAB menunggu approval teknis',
                "{$count} item RAB diajukan untuk pemeriksaan dan persetujuan Engineer.",
                '/approval'
            );
        }
        return response()->json([
            'success' => true,
            'message' => "{$count} item RAB diajukan untuk approval.",
            'data' => ['updated' => $count],
        ]);
    }

    public function approve(Request $request)
    {
        $request->validate([
            'project_id' => 'required_without:item_ids|exists:projects,id',
            'item_ids' => 'required_without:project_id|array|min:1',
            'item_ids.*' => 'integer|exists:rab_budgets,id',
        ]);

        if ($request->has('item_ids')) {
            $count = RabBudget::approveSelected($request->item_ids, Auth::user());
            $msg = "{$count} item RAB terpilih disetujui.";
        } else {
            $count = RabBudget::approveAll($request->project_id, Auth::user());
            $msg = "{$count} item RAB disetujui.";
        }

        return response()->json([
            'success' => true,
            'message' => $msg,
            'data' => ['approved' => $count],
        ]);
    }

    public function reject(Request $request)
    {
        $request->validate([
            'project_id' => 'required_without:item_ids|exists:projects,id',
            'item_ids' => 'required_without:project_id|array|min:1',
            'item_ids.*' => 'integer|exists:rab_budgets,id',
        ]);

        if ($request->has('item_ids')) {
            $count = RabBudget::rejectSelected($request->item_ids, Auth::user());
            $msg = "{$count} item RAB terpilih ditolak.";
        } else {
            $count = RabBudget::rejectAll($request->project_id, Auth::user());
            $msg = "{$count} item RAB ditolak.";
        }

        return response()->json([
            'success' => true,
            'message' => $msg,
            'data' => ['rejected' => $count],
        ]);
    }

    public function rollUp(Request $request)
    {
        $request->validate(['project_id' => 'required|exists:projects,id']);
        $projectId = $request->project_id;
        return response()->json([
            'success' => true,
            'data' => [
                'rollup' => RabBudget::rollUp($projectId),
                'total_budget' => RabBudget::totalBudget($projectId),
            ],
        ]);
    }

    public function summary(Request $request)
    {
        $projectId = $request->get('project_id');
        $query = RabBudget::query();

        if ($projectId) {
            $query->where('project_id', $projectId);
            $latestVersion = RabBudget::where('project_id', $projectId)->max('version') ?? 1;
            $query->where('version', $latestVersion);
        }

        $totalBudget = $query->sum('total_price');
        $totalItems = $query->count();
        
        $latestVersion = $projectId ? (RabBudget::where('project_id', $projectId)->max('version') ?? 1) : null;

        $byCategory = RabBudget::select(
                DB::raw("COALESCE(category, 'Umum') as category_name"),
                DB::raw('count(*) as count'),
                DB::raw('sum(total_price) as total')
            )
            ->when($projectId, fn($q) => $q->where('project_id', $projectId)->where('version', $latestVersion))
            ->groupBy('category')
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'total_budget' => $totalBudget,
                'total_items' => $totalItems,
                'by_category' => $byCategory,
            ],
        ]);
    }
}
