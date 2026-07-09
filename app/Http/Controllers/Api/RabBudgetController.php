<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Imports\RabImport;
use Maatwebsite\Excel\Facades\Excel;
use App\Models\RabBudget;
use App\Models\Project;
use App\Imports\RabPreviewImport;

class RabBudgetController extends Controller
{
    public function preview(Request $request)
    {
        $request->validate([
            'file' => 'required|mimes:xlsx,xls,csv|max:20480',
        ]);

        try {
            $importer = new RabPreviewImport();
            Excel::import($importer, $request->file('file'));
            
            return response()->json([
                'rows' => $importer->data
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Gagal membaca preview Excel.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function import(Request $request)
    {
        // Increase limits for large Excel files
        ini_set('memory_limit', '2G');
        set_time_limit(300);

        $request->validate([
            'project_id' => 'required|exists:projects,id',
            'file' => 'required|mimes:xlsx,xls,csv|max:20480', // Max 20MB
            'header_row' => 'required|integer|min:0',
            'mapping' => 'required|json'
        ]);

        $projectId = $request->project_id;
        $headerRow = $request->header_row;
        $mapping = json_decode($request->mapping, true);
        
        // Optional: clear existing budget for this project before re-importing
        if ($request->boolean('overwrite')) {
            RabBudget::where('project_id', $projectId)->delete();
        }

        try {
            Excel::import(new RabImport($projectId, $headerRow, $mapping), $request->file('file'));
            
            return response()->json([
                'message' => 'Data RAB berhasil diimpor.',
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Gagal mengimpor data RAB. Pastikan format kolom benar.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function autoImport(Request $request)
    {
        ini_set('memory_limit', '2G');
        set_time_limit(300);

        $request->validate([
            'project_id' => 'required|exists:projects,id',
            'file' => 'required|mimes:xlsx,xls,csv|max:20480',
        ]);

        $projectId = $request->project_id;

        if ($request->boolean('overwrite')) {
            RabBudget::where('project_id', $projectId)->delete();
        }

        try {
            // 1. Preview first 30 rows to detect header
            $importer = new RabPreviewImport();
            Excel::import($importer, $request->file('file'));
            $rows = $importer->data;

            // 2. Auto-detect header row (find row with keywords)
            $headerRowIndex = $this->detectHeaderRow($rows);
            if ($headerRowIndex === null) {
                return response()->json([
                    'message' => 'Tidak dapat mendeteksi baris header secara otomatis. Gunakan import manual.',
                ], 422);
            }

            // 3. Auto-map columns
            $headerRow = $rows[$headerRowIndex];
            $mapping = $this->autoMapColumns($headerRow);
            if (empty($mapping['description'])) {
                return response()->json([
                    'message' => 'Kolom "Uraian/Deskripsi" tidak ditemukan di header. Gunakan import manual.',
                ], 422);
            }

            // 4. Import
            Excel::import(new RabImport($projectId, $headerRowIndex, $mapping), $request->file('file'));

            return response()->json([
                'message' => 'Import otomatis berhasil! ' . count($mapping) . ' kolom terdeteksi.',
                'detected_header' => $headerRowIndex,
                'detected_mapping' => $mapping,
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Gagal import otomatis.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    private function detectHeaderRow(array $rows): ?int
    {
        $keywords = ['uraian', 'deskripsi', 'description', 'pekerjaan', 'volume', 'harga', 'satuan', 'qty', 'jumlah', 'total', 'kode', 'code', 'no.', 'no ', 'item', 'kelompok', 'kategori'];
        
        $bestScore = 0;
        $bestIndex = null;

        foreach ($rows as $index => $row) {
            $score = 0;
            foreach ($row as $cell) {
                $lower = strtolower(trim((string)$cell));
                if (empty($lower)) continue;
                foreach ($keywords as $kw) {
                    if (str_contains($lower, $kw)) {
                        $score++;
                        break;
                    }
                }
            }
            if ($score > $bestScore && $score >= 2) {
                $bestScore = $score;
                $bestIndex = $index;
            }
        }
        return $bestIndex;
    }

    private function autoMapColumns(array $headerRow): array
    {
        $mapping = [];
        $rules = [
            'code_item'   => ['kode', 'code', 'no.', 'no urut', 'item code', 'kd'],
            'description' => ['uraian', 'deskripsi', 'description', 'pekerjaan', 'keterangan', 'rincian', 'nama barang'],
            'unit'        => ['satuan', 'unit', 'uom'],
            'volume'      => ['volume', 'vol', 'qty', 'jumlah', 'quantity', 'jml'],
            'unit_price'  => ['harga satuan', 'harga', 'hs', 'unit price', 'hrg satuan', 'up'],
            'total_price' => ['total', 'harga total', 'jumlah harga', 'total harga', 'amount', 'jml harga', 'subtotal', 'total price'],
            'category'    => ['kategori', 'kelompok', 'golongan', 'category', 'kel.', 'group'],
        ];

        foreach ($headerRow as $colIdx => $cell) {
            $lower = strtolower(trim((string)$cell));
            if (empty($lower)) continue;

            foreach ($rules as $field => $keywords) {
                if (isset($mapping[$field])) continue; // already mapped
                foreach ($keywords as $kw) {
                    if (str_contains($lower, $kw)) {
                        $mapping[$field] = $colIdx;
                        break 2;
                    }
                }
            }
        }
        return $mapping;
    }

    public function index(Request $request, $projectId)
    {
        $budgets = RabBudget::where('project_id', $projectId)->paginate(50);
        return response()->json($budgets);
    }
}
