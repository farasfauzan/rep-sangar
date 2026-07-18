<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InventoryStock;
use App\Models\PoItem;
use App\Models\PurchaseRequisition;
use App\Models\Project;
use App\Models\RabBudget;
use App\Models\RabImportDraft;
use App\Services\Rab\RabImportService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Database\QueryException;
use PhpOffice\PhpSpreadsheet\IOFactory;

class RabImportController extends Controller
{
    protected RabImportService $importService;

    public function __construct(RabImportService $importService)
    {
        $this->importService = $importService;
    }

    /**
     * Upload Excel file and return sheet names
     */
    public function upload(Request $request): JsonResponse
    {
        $this->prepareImportRuntime();
        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls|max:20480',
        ]);

        $file = $request->file('file');
        $filename = Str::uuid() . '.' . $file->getClientOriginalExtension();
        $path = $file->storeAs('rab-imports', $filename, 'local');

        $fullPath = Storage::disk('local')->path($path);
        $sheetNames = $this->importService->getSheetNames($fullPath);

        return response()->json([
            'file_id' => $filename,
            'file_fingerprint' => hash_file('sha256', $fullPath),
            'original_name' => $file->getClientOriginalName(),
            'sheets' => $sheetNames,
        ]);
    }

    /**
     * Preview data from a specific sheet
     */
    public function preview(Request $request): JsonResponse
    {
        $this->prepareImportRuntime();
        $request->validate([
            'file_id' => 'required|string',
            'sheet' => 'required|string',
            'limit' => 'nullable|integer|min:1|max:10000',
        ]);

        $path = Storage::disk('local')->path('rab-imports/' . $request->file_id);
        
        if (!file_exists($path)) {
            return response()->json(['error' => 'File not found'], 404);
        }

        try {
            $preview = $this->importService->previewSheet(
                $path,
                $request->sheet,
                (int) $request->input('limit', 5000)
            );
            return response()->json($preview);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 400);
        }
    }

    /**
     * Validate import data (check total_price = qty * price)
     */
    public function validateImport(Request $request): JsonResponse
    {
        $this->prepareImportRuntime();
        $request->validate([
            'file_id' => 'required|string',
            'sheet' => 'required|string',
        ]);

        $path = Storage::disk('local')->path('rab-imports/' . $request->file_id);
        
        if (!file_exists($path)) {
            return response()->json(['error' => 'File not found'], 404);
        }

        try {
            $preview = $this->importService->previewSheet($path, $request->sheet, 100);
            
            $errors = [];
            foreach ($preview['rows'] as $row) {
                $calculated = round($row['qty'] * $row['price'], 2);
                $actual = $row['total'];
                
                if ($actual > 0 && abs($actual - $calculated) > 1) {
                    $errors[] = [
                        'row' => $row['row_number'],
                        'description' => $row['description'],
                        'error' => "Total mismatch: file has {$actual}, calculated {$calculated} (qty={$row['qty']} × price={$row['price']})"
                    ];
                }
            }

            return response()->json([
                'valid' => empty($errors),
                'checked_rows' => count($preview['rows']),
                'errors' => $errors,
                'project_info' => $preview['project_info'],
            ]);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 400);
        }
    }

    /**
     * Import RAB data to project
     */
    public function import(Request $request): JsonResponse
    {
        $this->prepareImportRuntime();
        $request->validate([
            'file_id' => 'required|string',
            'sheet' => 'required|string',
            'project_id' => 'required|exists:projects,id',
        ]);

        $path = Storage::disk('local')->path('rab-imports/' . $request->file_id);
        
        if (!file_exists($path)) {
            return response()->json(['error' => 'File not found'], 404);
        }

        try {
            $result = $this->importService->importSheet($path, $request->sheet, $request->project_id);
            
            // Clean up temp file
            Storage::disk('local')->delete('rab-imports/' . $request->file_id);
            
            return response()->json($result);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 400);
        }
    }

    /**
     * Auto-detect and import (for files with single sheet)
     */
    public function autoImport(Request $request): JsonResponse
    {
        $this->prepareImportRuntime();
        $request->validate([
            'file_id' => 'required|string',
            'project_id' => 'required|exists:projects,id',
        ]);

        $path = Storage::disk('local')->path('rab-imports/' . $request->file_id);
        
        if (!file_exists($path)) {
            return response()->json(['error' => 'File not found'], 404);
        }

        try {
            $result = $this->importService->autoImport($path, $request->project_id);
            
            // Clean up temp file
            Storage::disk('local')->delete('rab-imports/' . $request->file_id);
            
            return response()->json($result);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 400);
        }
    }

    /**
     * Import rows that were reviewed and categorised by the user in the Excel
     * preview. This deliberately does not run AI/keyword classification.
     */
    public function manualImport(Request $request): JsonResponse
    {
        $this->prepareImportRuntime();
        $validator = Validator::make($request->all(), [
            'project_id' => 'required|exists:projects,id',
            'rows' => 'required|array|min:1|max:10000',
            'rows.*.row_number' => 'nullable|integer|min:1|max:1000000',
            'rows.*.code_item' => 'nullable|string|max:255',
            'rows.*.description' => 'required|string|max:1000',
            'rows.*.unit' => 'nullable|string|max:100',
            'rows.*.volume' => 'required|numeric|min:0',
            'rows.*.unit_price' => 'required|numeric|min:0',
            'rows.*.total_price' => 'nullable|numeric|min:0',
            'rows.*.category' => 'required|string|in:Subkon,Material,Pekerja,Alat',
            'rows.*.group' => 'nullable|string|max:255',
            'replace_existing' => 'nullable|boolean',
            'file_id' => 'nullable|string|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Periksa kembali kategori dan nilai pada baris yang dipilih.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $projectId = (int) $request->project_id;
        $rows = collect($request->input('rows'))
            ->values()
            ->map(function (array $row, int $index) {
                $volume = (float) $row['volume'];
                $unitPrice = (float) $row['unit_price'];
                $total = array_key_exists('total_price', $row) && $row['total_price'] !== null
                    ? (float) $row['total_price']
                    : $volume * $unitPrice;
                $group = trim((string) ($row['group'] ?? ''));

                return [
                    'code_item' => trim((string) ($row['code_item'] ?? ''))
                        ?: $this->fallbackRabCode((string) $row['category'], (int) ($row['row_number'] ?? ($index + 1))),
                    'description' => trim((string) $row['description']),
                    'unit' => trim((string) ($row['unit'] ?? '')) ?: null,
                    'volume' => $volume,
                    'unit_price' => $unitPrice,
                    'total_price' => $total > 0 ? $total : $volume * $unitPrice,
                    // Store the folder path in the existing category field so
                    // reports and filters continue to work without a schema
                    // change: "Subkon / Material".
                    'category' => $group !== '' ? $row['category'].' / '.$group : $row['category'],
                ];
            })->values()->all();

        try {
            $result = DB::transaction(function () use ($projectId, $rows, $request) {
                $currentVersion = (int) (RabBudget::where('project_id', $projectId)->max('version') ?? 0);
                $newVersion = $currentVersion + 1;
                $oldItems = $currentVersion > 0
                    ? RabBudget::where('project_id', $projectId)->where('version', $currentVersion)->get()
                    : collect();

                if (! $request->boolean('replace_existing', true)) {
                    $newVersion = max(1, $currentVersion);
                }

                $now = now();
                $insertRows = array_map(function (array $row) use ($projectId, $newVersion, $now) {
                    return array_merge($row, [
                        'project_id' => $projectId,
                        'version' => $newVersion,
                        'status' => RabBudget::STATUS_DRAFT,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                }, $rows);

                RabBudget::insert($insertRows);
                $newItems = RabBudget::where('project_id', $projectId)
                    ->where('version', $newVersion)
                    ->orderBy('id')
                    ->get();

                // Keep downstream references attached when a reviewed import
                // contains the same code and folder as the previous version.
                $newByKey = $newItems->keyBy(fn ($item) => strtolower(trim((string) $item->code_item)).'::'.strtolower(trim((string) $item->category)));
                foreach ($oldItems as $old) {
                    $key = strtolower(trim((string) $old->code_item)).'::'.strtolower(trim((string) $old->category));
                    if ($newByKey->has($key)) {
                        $newId = $newByKey->get($key)->id;
                        InventoryStock::where('project_id', $projectId)->where('rab_budget_id', $old->id)->update(['rab_budget_id' => $newId]);
                        PoItem::where('rab_budget_id', $old->id)->update(['rab_budget_id' => $newId]);
                        PurchaseRequisition::where('project_id', $projectId)->where('rab_budget_id', $old->id)->update(['rab_budget_id' => $newId]);
                    }
                }

                if ($currentVersion > 0 && $request->boolean('replace_existing', true)) {
                    RabBudget::withTrashed()->where('project_id', $projectId)->where('version', '<=', $currentVersion)->update(['status' => RabBudget::STATUS_ARCHIVED]);
                    RabBudget::where('project_id', $projectId)->where('version', '<=', $currentVersion)->delete();
                }

                // Importing a budget must not create physical stock. Material
                // enters inventory later through an approved PO receipt.

                return ['imported' => count($rows), 'version' => $newVersion];
            });

            if ($request->filled('file_id')) {
                Storage::disk('local')->delete('rab-imports/'.$request->string('file_id'));
            }

            return response()->json(['success' => true, 'message' => "Berhasil mengimport {$result['imported']} item dengan kategori manual.", 'data' => array_merge($result, ['project_id' => $projectId])]);
        } catch (\Throwable $e) {
            return response()->json(['success' => false, 'message' => 'Gagal import manual: '.$e->getMessage()], 500);
        }
    }

    /**
     * Save one reviewed Excel row immediately. A deterministic source key
     * makes the operation idempotent across users who upload the same file.
     * The first user to save a row owns it, preventing silent overwrites when
     * two people happen to classify the same row at the same time.
     */
    public function manualImportItem(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'project_id' => 'required|exists:projects,id',
            'file_fingerprint' => ['required', 'string', 'regex:/^[a-f0-9]{64}$/i'],
            'sheet' => 'required|string|max:255',
            'row_number' => 'required|integer|min:1|max:1000000',
            'code_item' => 'nullable|string|max:255',
            'description' => 'required|string|max:1000',
            'unit' => 'nullable|string|max:100',
            'volume' => 'required|numeric|min:0',
            'unit_price' => 'required|numeric|min:0',
            'total_price' => 'nullable|numeric|min:0',
            'category' => 'required|string|in:Subkon,Material,Pekerja,Alat',
            'group' => 'nullable|string|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Periksa kategori dan nilai item sebelum dimasukkan.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $projectId = (int) $request->project_id;
        $fingerprint = strtolower((string) $request->file_fingerprint);
        $sheet = trim((string) $request->sheet);
        $rowNumber = (int) $request->row_number;
        $userId = (int) $request->user()->id;
        $sourceKey = hash('sha256', $projectId.'|'.$fingerprint.'|'.mb_strtolower($sheet).'|'.$rowNumber);
        $group = trim((string) $request->input('group', ''));
        $category = (string) $request->category;
        $volume = (float) $request->volume;
        $unitPrice = (float) $request->unit_price;
        $totalPrice = $request->input('total_price');
        $totalPrice = $totalPrice !== null ? (float) $totalPrice : $volume * $unitPrice;
        if ($totalPrice <= 0) $totalPrice = $volume * $unitPrice;

        $payload = [
            'project_id' => $projectId,
            'code_item' => trim((string) $request->input('code_item', ''))
                ?: $this->fallbackRabCode($category, $rowNumber),
            'description' => trim((string) $request->description),
            'unit' => trim((string) $request->input('unit', '')) ?: null,
            'volume' => $volume,
            'unit_price' => $unitPrice,
            'total_price' => $totalPrice,
            'category' => $group !== '' ? $category.' / '.$group : $category,
            'source_import_key' => $sourceKey,
            'source_file_fingerprint' => $fingerprint,
            'source_sheet' => $sheet,
            'source_row' => $rowNumber,
            'imported_by' => $userId,
        ];

        try {
            $result = DB::transaction(function () use ($projectId, $sourceKey, $userId, $payload) {
                $item = RabBudget::withTrashed()
                    ->where('project_id', $projectId)
                    ->where('source_import_key', $sourceKey)
                    ->lockForUpdate()
                    ->first();

                if ($item && ! $item->trashed() && $item->imported_by && (int) $item->imported_by !== $userId) {
                    $item->load('importedBy:id,name');
                    return ['conflict' => true, 'item' => $item];
                }

                if ($item && ! $item->trashed() && $item->status !== RabBudget::STATUS_DRAFT) {
                    $item->load('importedBy:id,name');
                    return ['conflict' => true, 'item' => $item, 'locked' => true];
                }

                $created = ! $item;
                if (! $item) {
                    $item = new RabBudget();
                } elseif ($item->trashed()) {
                    $item->restore();
                }

                $payload['version'] = max(1, (int) (RabBudget::where('project_id', $projectId)->max('version') ?? 1));
                $payload['status'] = RabBudget::STATUS_DRAFT;
                $item->forceFill($payload)->save();

                RabImportDraft::where('project_id', $projectId)
                    ->where('file_fingerprint', $payload['source_file_fingerprint'])
                    ->where('sheet', $payload['source_sheet'])
                    ->where('row_number', $payload['source_row'])
                    ->update([
                        'category' => $payload['category'],
                        'item_group' => str_contains($payload['category'], ' / ')
                            ? trim((string) Str::after($payload['category'], ' / '))
                            : null,
                        'status' => 'SAVED',
                        'saved_budget_id' => $item->id,
                        'updated_at' => now(),
                    ]);

                $item->load('importedBy:id,name');
                return ['conflict' => false, 'created' => $created, 'item' => $item];
            });
        } catch (QueryException $e) {
            // A simultaneous insert can reach the unique source-key index
            // before the second request sees the first row. Report it as an
            // ownership conflict instead of exposing a database exception.
            $item = RabBudget::where('project_id', $projectId)
                ->where('source_import_key', $sourceKey)
                ->with('importedBy:id,name')
                ->first();
            if ($item) {
                $result = ['conflict' => true, 'item' => $item];
            } else {
                return response()->json(['success' => false, 'message' => 'Item gagal dimasukkan: '.$e->getMessage()], 500);
            }
        }

        if ($result['conflict']) {
            $owner = $result['item']->importedBy?->name ?: 'pengguna lain';
            $message = ! empty($result['locked'])
                ? 'Item ini sudah masuk proses persetujuan dan tidak dapat diubah.'
                : "Baris ini sudah dimasukkan oleh {$owner}. Pilih baris lain agar pekerjaan tidak tumpang tindih.";

            return response()->json([
                'success' => false,
                'message' => $message,
                'data' => $this->manualImportItemData($result['item']),
            ], 409);
        }

        return response()->json([
            'success' => true,
            'message' => 'Item berhasil dimasukkan.',
            'data' => array_merge($this->manualImportItemData($result['item']), ['created' => $result['created']]),
        ]);
    }

    private function fallbackRabCode(string $category, int $sequence): string
    {
        $baseCategory = mb_strtolower(trim(explode(' / ', $category, 2)[0]));
        $prefix = match ($baseCategory) {
            'material' => 'MAT',
            'subkon' => 'SUB',
            'pekerja', 'upah' => 'PKJ',
            'alat' => 'ALT',
            default => 'ITM',
        };

        return sprintf('RAB-%s-%04d', $prefix, max(1, $sequence));
    }

    /**
     * Return rows from the same workbook/sheet that have already been saved,
     * so multiple reviewers can see each other's progress.
     */
    public function manualImportStatus(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'project_id' => 'required|exists:projects,id',
            'file_fingerprint' => ['required', 'string', 'regex:/^[a-f0-9]{64}$/i'],
            'sheet' => 'required|string|max:255',
        ]);

        $items = RabBudget::where('project_id', (int) $validated['project_id'])
            ->where('source_file_fingerprint', strtolower($validated['file_fingerprint']))
            ->where('source_sheet', trim($validated['sheet']))
            ->whereNotNull('source_row')
            ->with('importedBy:id,name')
            ->orderBy('source_row')
            ->get()
            ->map(fn (RabBudget $item) => $this->manualImportItemData($item))
            ->values();

        return response()->json(['success' => true, 'data' => $items]);
    }

    /** Persist the reviewed preview rows so the import can be resumed later. */
    public function storeDraftRows(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'project_id' => 'required|exists:projects,id',
            'file_id' => 'nullable|string|max:255',
            'file_fingerprint' => ['required', 'string', 'regex:/^[a-f0-9]{64}$/i'],
            'original_name' => 'nullable|string|max:255',
            'sheet' => 'required|string|max:255',
            'rows' => 'required|array|min:1|max:10000',
            'rows.*.row_number' => 'required|integer|min:1|max:1000000',
            'rows.*.code_item' => 'nullable|string|max:255',
            'rows.*.description' => 'required|string|max:1000',
            'rows.*.unit' => 'nullable|string|max:100',
            'rows.*.volume' => 'required|numeric|min:0',
            'rows.*.unit_price' => 'required|numeric|min:0',
            'rows.*.total_price' => 'nullable|numeric|min:0',
            'rows.*.category' => 'nullable|string|in:Subkon,Material,Pekerja,Alat',
            'rows.*.group' => 'nullable|string|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'message' => 'Data draft tidak valid.', 'errors' => $validator->errors()], 422);
        }

        $projectId = (int) $request->project_id;
        $fingerprint = strtolower((string) $request->file_fingerprint);
        $sheet = trim((string) $request->sheet);
        $now = now();
        $draftRows = collect($request->input('rows'))->map(function (array $row) use ($projectId, $fingerprint, $sheet, $request, $now) {
            $volume = (float) $row['volume'];
            $unitPrice = (float) $row['unit_price'];
            $total = array_key_exists('total_price', $row) && $row['total_price'] !== null
                ? (float) $row['total_price']
                : $volume * $unitPrice;

            return [
                'project_id' => $projectId,
                'file_id' => $request->input('file_id'),
                'file_fingerprint' => $fingerprint,
                'original_name' => $request->input('original_name'),
                'sheet' => $sheet,
                'row_number' => (int) $row['row_number'],
                'code_item' => trim((string) ($row['code_item'] ?? '')) ?: null,
                'description' => trim((string) $row['description']),
                'unit' => trim((string) ($row['unit'] ?? '')) ?: null,
                'volume' => $volume,
                'unit_price' => $unitPrice,
                'total_price' => $total > 0 ? $total : $volume * $unitPrice,
                'category' => $row['category'] ?: null,
                'item_group' => trim((string) ($row['group'] ?? '')) ?: null,
                'status' => 'DRAFT',
                'created_at' => $now,
                'updated_at' => $now,
            ];
        })->values()->all();

        foreach (array_chunk($draftRows, 100) as $chunk) {
            RabImportDraft::upsert(
                $chunk,
                ['project_id', 'file_fingerprint', 'sheet', 'row_number'],
                ['file_id', 'original_name', 'code_item', 'description', 'unit', 'volume', 'unit_price', 'total_price', 'updated_at']
            );
        }

        return response()->json([
            'success' => true,
            'message' => count($draftRows).' baris disimpan sebagai draft.',
            'data' => ['drafted' => count($draftRows), 'file_fingerprint' => $fingerprint, 'sheet' => $sheet],
        ]);
    }

    /** Save only a row's pending category/folder selection to its draft. */
    public function updateDraftRow(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'project_id' => 'required|exists:projects,id',
            'file_fingerprint' => ['required', 'string', 'regex:/^[a-f0-9]{64}$/i'],
            'sheet' => 'required|string|max:255',
            'row_number' => 'required|integer|min:1|max:1000000',
            'category' => 'nullable|string|in:Subkon,Material,Pekerja,Alat',
            'group' => 'nullable|string|max:255',
        ]);

        $draft = RabImportDraft::where('project_id', (int) $validated['project_id'])
            ->where('file_fingerprint', strtolower($validated['file_fingerprint']))
            ->where('sheet', trim($validated['sheet']))
            ->where('row_number', (int) $validated['row_number'])
            ->first();

        if (! $draft) {
            return response()->json(['success' => false, 'message' => 'Baris draft belum tersimpan. Preview ulang sheet tersebut.'], 404);
        }

        if ($draft->status !== 'SAVED') {
            $draft->update([
                'category' => $validated['category'] ?: null,
                'item_group' => trim((string) ($validated['group'] ?? '')) ?: null,
                'updated_at' => now(),
            ]);
        }

        return response()->json(['success' => true]);
    }

    /** List resumable import drafts for the selected project. */
    public function drafts(Request $request): JsonResponse
    {
        $projectId = (int) $request->validate(['project_id' => 'required|exists:projects,id'])['project_id'];
        $rows = RabImportDraft::where('project_id', $projectId)->orderByDesc('updated_at')->get();

        $data = $rows->groupBy('file_fingerprint')->map(function ($group, $fingerprint) {
            $first = $group->first();
            $sheets = $group->groupBy('sheet')->map(fn ($sheetRows, $sheet) => [
                'name' => $sheet,
                'total' => $sheetRows->count(),
                'saved' => $sheetRows->where('status', 'SAVED')->count(),
            ])->values();
            $saved = $group->where('status', 'SAVED')->count();

            $latest = $group->sortByDesc('updated_at')->first();
            return [
                'file_fingerprint' => $fingerprint,
                'file_id' => $first->file_id,
                'original_name' => $first->original_name,
                'updated_at' => $latest?->updated_at?->toIso8601String(),
                'total_rows' => $group->count(),
                'saved_rows' => $saved,
                'pending_rows' => $group->count() - $saved,
                'sheets' => $sheets,
            ];
        })->values();

        return response()->json(['success' => true, 'data' => $data]);
    }

    /** Load all rows from one draft without touching the original Excel file. */
    public function draftRows(Request $request, string $fingerprint): JsonResponse
    {
        $projectId = (int) $request->validate(['project_id' => 'required|exists:projects,id'])['project_id'];
        abort_unless((bool) preg_match('/^[a-f0-9]{64}$/i', $fingerprint), 422, 'Fingerprint draft tidak valid.');

        $draftRows = RabImportDraft::where('project_id', $projectId)
            ->where('file_fingerprint', strtolower($fingerprint))
            ->with(['savedBudget.importedBy:id,name'])
            ->orderBy('sheet')
            ->orderBy('row_number')
            ->get();

        if ($draftRows->isEmpty()) {
            return response()->json(['success' => false, 'message' => 'Draft tidak ditemukan.'], 404);
        }

        $first = $draftRows->first();
        return response()->json([
            'success' => true,
            'data' => [
                'file_fingerprint' => $first->file_fingerprint,
                'file_id' => $first->file_id,
                'original_name' => $first->original_name,
                'sheets' => $draftRows->pluck('sheet')->unique()->values(),
                'rows' => $draftRows->map(fn (RabImportDraft $row) => $this->draftRowData($row))->values(),
            ],
        ]);
    }

    /**
     * List all projects for dropdown
     */
    public function projects(): JsonResponse
    {
        $projects = Project::select('id', 'project_name', 'project_code')->get();
        return response()->json($projects);
    }

    private function prepareImportRuntime(): void
    {
        @set_time_limit(0);
        // The default local PHP limit is 128M. Keep a bounded ceiling for
        // import requests while allowing PhpSpreadsheet to handle workbook
        // metadata and formulas without failing immediately.
        @ini_set('memory_limit', '512M');
    }

    private function manualImportItemData(RabBudget $item): array
    {
        [$category, $group] = array_pad(explode(' / ', (string) $item->category, 2), 2, '');

        return [
            'id' => $item->id,
            'source_row' => (int) $item->source_row,
            'source_sheet' => $item->source_sheet,
            'category' => $category,
            'group' => $group,
            'saved_by' => $item->importedBy?->name,
            'updated_at' => $item->updated_at?->toIso8601String(),
        ];
    }

    private function draftRowData(RabImportDraft $row): array
    {
        $savedBudget = $row->savedBudget;

        return [
            'id' => 'draft-'.$row->id,
            'source_sheet' => $row->sheet,
            'row_number' => (int) $row->row_number,
            'code_item' => $row->code_item ?: '',
            'description' => $row->description,
            'unit' => $row->unit ?: '',
            'volume' => (float) $row->volume,
            'unit_price' => (float) $row->unit_price,
            'total_price' => (float) $row->total_price,
            'category' => $savedBudget ? (explode(' / ', (string) $savedBudget->category, 2)[0] ?? '') : ($row->category ?: ''),
            'group' => $savedBudget ? (explode(' / ', (string) $savedBudget->category, 2)[1] ?? '') : ($row->item_group ?: ''),
            'selected' => true,
            'save_state' => $savedBudget || $row->status === 'SAVED' ? 'saved' : 'idle',
            'saved_id' => $savedBudget?->id ?: $row->saved_budget_id,
            'saved_by' => $savedBudget?->importedBy?->name ?: '',
        ];
    }
}
