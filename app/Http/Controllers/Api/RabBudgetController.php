<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\RabBudget;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class RabBudgetController extends Controller
{
    /**
     * Preview Excel (first 30 rows) - uses raw XML to avoid memory issues
     */
    public function preview(Request $request)
    {
        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls|max:51200',
        ]);

        $file = $request->file('file');
        $rows = [];
        $errors = [];

        try {
            $result = $this->parseXlsxRaw($file->getRealPath(), 30);
            $sheets = $result['sheets'];
            $errors = $result['errors'];

            $best = $this->findBestSheet($sheets);

            if ($best === null) {
                return response()->json([
                    'success' => false,
                    'message' => 'Header tidak ditemukan dalam 30 baris pertama.',
                    'debug_sheets' => array_map(fn($rows) => count($rows), $sheets),
                ], 422);
            }

            $allRows = $best['rows'];
            $headerRowIndex = $best['headerIndex'];
            $colMap = $best['colMap'];

            foreach ($allRows as $idx => $row) {
                if ($idx <= $headerRowIndex) continue;

                $uraian = trim((string)($row[$colMap['uraian']] ?? ''));
                if ($uraian === '' || strtolower($uraian) === 'jumlah' || strtolower($uraian) === 'total') continue;

                $volume = $this->parseNumber($row[$colMap['volume'] ?? -1] ?? null);
                $satuan = trim((string)($row[$colMap['satuan'] ?? -1] ?? ''));
                $harga = $this->parseNumber($row[$colMap['harga_satuan'] ?? -1] ?? null);
                $jumlah = $this->parseNumber($row[$colMap['jumlah'] ?? -1] ?? null);

                if ($volume && $harga && !$jumlah) {
                    $jumlah = $volume * $harga;
                }

                $rows[] = [
                    'no' => trim((string)($row[$colMap['no']] ?? '')),
                    'uraian' => $uraian,
                    'volume' => $volume,
                    'satuan' => $satuan,
                    'harga_satuan' => $harga,
                    'jumlah' => $jumlah,
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
                'errors' => $errors,
                'column_mapping' => $colMap,
            ],
        ]);
    }

    /**
     * Auto-import: parse + insert in batches using raw XML
     */
    public function autoImport(Request $request)
    {
        $request->validate([
            'project_id' => 'required|exists:projects,id',
            'file' => 'required|file|mimes:xlsx,xls|max:51200',
        ]);

        $file = $request->file('file');
        $projectId = $request->project_id;
        $imported = 0;
        $errors = [];
        $batchSize = 200;
        $batch = [];

        try {
            $result = $this->parseXlsxRaw($file->getRealPath(), null);
            $sheets = $result['sheets'];
            $errors = $result['errors'];

            $best = $this->findBestSheet($sheets);

            if ($best === null) {
                return response()->json([
                    'success' => false,
                    'message' => 'Header tidak ditemukan dalam file Excel.',
                ], 422);
            }

            $allRows = $best['rows'];
            $headerRowIndex = $best['headerIndex'];
            $colMap = $best['colMap'];

            DB::beginTransaction();

            RabBudget::where('project_id', $projectId)->delete();

            foreach ($allRows as $idx => $row) {
                if ($idx <= $headerRowIndex) continue;

                $uraian = trim((string)($row[$colMap['uraian']] ?? ''));
                if ($uraian === '' || strtolower($uraian) === 'jumlah' || strtolower($uraian) === 'total') continue;

                $volume = $this->parseNumber($row[$colMap['volume'] ?? -1] ?? null);
                $satuan = trim((string)($row[$colMap['satuan'] ?? -1] ?? ''));
                $harga = $this->parseNumber($row[$colMap['harga_satuan'] ?? -1] ?? null);
                $jumlah = $this->parseNumber($row[$colMap['jumlah'] ?? -1] ?? null);

                if ($volume && $harga && !$jumlah) {
                    $jumlah = $volume * $harga;
                }

                $batch[] = [
                    'project_id' => $projectId,
                    'code_item' => trim((string)($row[$colMap['kode'] ?? -1] ?? '')),
                    'description' => $uraian,
                    'volume' => $volume ?: 0,
                    'unit' => $satuan,
                    'unit_price' => $harga ?: 0,
                    'total_price' => $jumlah ?: 0,
                    'created_at' => now(),
                    'updated_at' => now(),
                ];

                if (count($batch) >= $batchSize) {
                    RabBudget::insert($batch);
                    $imported += count($batch);
                    $batch = [];
                }
            }

            if (!empty($batch)) {
                RabBudget::insert($batch);
                $imported += count($batch);
            }

            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('RAB Import Error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Gagal import: ' . $e->getMessage(),
            ], 500);
        }

        return response()->json([
            'success' => true,
            'message' => "Berhasil import {$imported} item RAB.",
            'data' => [
                'imported' => $imported,
                'errors' => $errors,
                'project_id' => $projectId,
            ],
        ]);
    }

    /**
     * Raw XML parse of xlsx - returns data from all sheets.
     */
    private function parseXlsxRaw(string $path, ?int $maxRows): array
    {
        $sheets = [];
        $errors = [];
        $sharedStrings = [];

        $zip = new \ZipArchive();
        if ($zip->open($path) !== true) {
            throw new \RuntimeException('Cannot open xlsx file');
        }

        // 1. Read shared strings
        $ssXml = $zip->getFromName('xl/sharedStrings.xml');
        if ($ssXml !== false) {
            $xml = simplexml_load_string($ssXml);
            if ($xml) {
                foreach ($xml->si as $si) {
                    $text = '';
                    if (isset($si->t)) {
                        $text = (string)$si->t;
                    } else {
                        foreach ($si->r as $r) {
                            $text .= (string)$r->t;
                        }
                    }
                    $sharedStrings[] = $text;
                }
            }
        }

        // 2. Discover all sheet files directly from zip (most robust)
        $sheetFiles = [];
        for ($i = 0; $i < $zip->numFiles; $i++) {
            $name = $zip->getNameIndex($i);
            if (preg_match('#^xl/worksheets/sheet(\d+)\.xml$#', $name, $m)) {
                $sheetFiles[(int)$m[1]] = $name;
            }
        }
        ksort($sheetFiles);

        if (empty($sheetFiles)) {
            $sheetFiles[1] = 'xl/worksheets/sheet1.xml';
        }

        // 3. Parse each sheet independently
        foreach ($sheetFiles as $sheetNum => $sheetPath) {
            $sheetName = "Sheet$sheetNum";
            $sheetXml = $zip->getFromName($sheetPath);
            if ($sheetXml === false) continue;

            $xml = simplexml_load_string($sheetXml);
            if (!$xml) continue;

            $sheetRows = [];
            foreach ($xml->sheetData->row as $rowNode) {
                if ($maxRows !== null && count($sheetRows) >= $maxRows) break;

                $rowData = [];
                foreach ($rowNode->c as $cell) {
                    $ref = (string)$cell['r'];
                    $colIndex = $this->columnLetterToIndex(preg_replace('/\d+/', '', $ref));
                    $type = (string)$cell['t'];
                    $value = null;
                    if ($type === 's') {
                        $si = (int)$cell->v;
                        $value = $sharedStrings[$si] ?? '';
                    } elseif (isset($cell->v)) {
                        $value = (string)$cell->v;
                    } elseif (isset($cell->is->t)) {
                        $value = (string)$cell->is->t;
                    }
                    while (count($rowData) <= $colIndex) {
                        $rowData[] = '';
                    }
                    $rowData[$colIndex] = $value;
                }
                $sheetRows[] = $rowData;
            }

            $sheets[$sheetName] = $sheetRows;
        }

        $zip->close();
        return ['sheets' => $sheets, 'errors' => $errors];
    }

    /**
     * Find the best sheet and header from multi-sheet xlsx data.
     * Prefers sheets that have ALL required columns (uraian, volume, harga_satuan).
     */
    private function findBestSheet(array $sheets): ?array
    {
        $headerKeywords = ['uraian', 'deskripsi', 'pekerjaan', 'description', 'item', 'nama barang', 'uraian barang', 'harga satuan'];
        $requiredCols = ['uraian', 'volume', 'harga_satuan'];
        $best = null;
        $bestScore = 0;

        foreach ($sheets as $sheetName => $rows) {
            $headerRowIndex = null;

            // Find header row
            foreach ($rows as $idx => $row) {
                $lower = array_map(fn($v) => strtolower(trim((string)$v)), $row);
                $matchCount = 0;
                foreach ($lower as $cell) {
                    foreach ($headerKeywords as $keyword) {
                        if (str_contains($cell, $keyword)) { $matchCount++; break; }
                    }
                }
                if ($matchCount >= 2) {
                    $headerRowIndex = $idx;
                    break;
                }
            }

            // Fallback: try single keyword
            if ($headerRowIndex === null) {
                foreach ($rows as $idx => $row) {
                    $lower = array_map(fn($v) => strtolower(trim((string)$v)), $row);
                    foreach ($lower as $cell) {
                        if (str_contains($cell, 'uraian') || str_contains($cell, 'harga satuan')) {
                            $headerRowIndex = $idx;
                            break 2;
                        }
                    }
                }
            }

            if ($headerRowIndex === null) continue;

            $colMap = $this->mapColumns($rows[$headerRowIndex]);
            if (!isset($colMap['uraian'])) continue;

            // Merge multi-row headers
            if (!isset($colMap['volume']) || !isset($colMap['harga_satuan'])) {
                for ($next = $headerRowIndex + 1; $next < min($headerRowIndex + 3, count($rows)); $next++) {
                    $colMap2 = $this->mapColumns($rows[$next]);
                    if (isset($colMap2['volume']) && !isset($colMap['volume'])) $colMap['volume'] = $colMap2['volume'];
                    if (isset($colMap2['harga_satuan']) && !isset($colMap['harga_satuan'])) $colMap['harga_satuan'] = $colMap2['harga_satuan'];
                    if (isset($colMap2['jumlah']) && !isset($colMap['jumlah'])) $colMap['jumlah'] = $colMap2['jumlah'];
                    if (isset($colMap['volume']) && isset($colMap['harga_satuan'])) break;
                }
            }

            $requiredCount = 0;
            foreach ($requiredCols as $col) {
                if (isset($colMap[$col])) $requiredCount++;
            }

            if ($requiredCount === 0) continue;

            $dataRows = 0;
            $numericRows = 0;  // rows with numeric volume+harga_satuan
            foreach ($rows as $idx => $row) {
                if ($idx <= $headerRowIndex) continue;
                $uraian = trim((string)($row[$colMap['uraian']] ?? ''));
                if ($uraian !== '' && strtolower($uraian) !== 'jumlah' && strtolower($uraian) !== 'total') {
                    $dataRows++;
                    // Check if volume and harga_satuan have numeric values
                    $vol = $this->parseNumber($row[$colMap['volume'] ?? -1] ?? null);
                    $harga = $this->parseNumber($row[$colMap['harga_satuan'] ?? -1] ?? null);
                    if ($vol !== null && $harga !== null) {
                        $numericRows++;
                    }
                }
            }

            if ($dataRows === 0) continue;

            // Quality score: required columns + numeric data quality
            // Prefer sheets with more numeric data (real RAB items vs reference sheets)
            $qualityScore = $requiredCount * 1000 + $numericRows;

            if ($qualityScore > $bestScore ||
                ($qualityScore === $bestScore && ($best === null || $dataRows > $best['dataRows']))) {
                $best = [
                    'sheetName' => $sheetName,
                    'rows' => $rows,
                    'headerIndex' => $headerRowIndex,
                    'colMap' => $colMap,
                    'dataRows' => $dataRows,
                    'requiredCount' => $requiredCount,
                    'numericRows' => $numericRows,
                ];
                $bestScore = $qualityScore;
            }
        }

        return $best;
    }

    /**
     * Convert column letter to 0-based index
     */
    private function columnLetterToIndex(string $letter): int
    {
        $letter = strtoupper($letter);
        $index = 0;
        $len = strlen($letter);
        for ($i = 0; $i < $len; $i++) {
            $index = $index * 26 + (ord($letter[$i]) - ord('A') + 1);
        }
        return $index - 1;
    }

    /**
     * Map header row to known column names.
     * Uses longest-match-first to avoid false positives.
     * Strips parenthetical suffixes like "(Rp)".
     */
    private function mapColumns(array $headerRow): array
    {
        $map = [];

        $knownCols = [
            'no' => ['nomor urut', 'no urut', 'nomor', 'no.'],
            'kode' => ['kode pekerjaan', 'kode rekening', 'kode barang', 'kode item', 'kode akun', 'kode'],
            'uraian' => ['uraian pekerjaan', 'uraian barang', 'nama pekerjaan', 'jenis barang/jasa', 'nama barang', 'deskripsi', 'description', 'rincian', 'keterangan', 'pekerjaan', 'uraian'],
            'volume' => ['volume', 'vol', 'qty', 'quantity', 'kuantitas'],
            'satuan' => ['satuan unit', 'satuan', 'uom'],
            'harga_satuan' => ['harga satuan', 'harga_satuan', 'unit price', 'harga per satuan', 'hs', 'harga'],
            'jumlah' => ['jumlah harga satuan', 'total harga', 'total biaya', 'subtotal', 'sub total', 'amount', 'nilai', 'jumlah', 'total'],
            'kategori' => ['kode kategori', 'kelompok', 'category', 'kategori', 'group', 'jenis'],
        ];

        foreach ($headerRow as $colIdx => $header) {
            if ($header === null) continue;
            $h = strtolower(trim((string)$header));
            $h = trim(preg_replace('/\s*\(.*?\)\s*/', '', $h));
            if ($h === '') continue;

            $bestLen = 0;
            $bestKey = null;

            foreach ($knownCols as $key => $aliases) {
                foreach ($aliases as $alias) {
                    $a = strtolower($alias);
                    // Exact match = highest priority
                    if ($h === $a) {
                        $bestLen = strlen($a) * 100;
                        $bestKey = $key;
                        break;
                    }
                    // Starts with alias
                    if (str_starts_with($h, $a) && strlen($a) > $bestLen) {
                        $bestLen = strlen($a);
                        $bestKey = $key;
                    }
                    // Alias is a whole word in the cell
                    elseif (preg_match('/\b' . preg_quote($a, '/') . '\b/', $h) && strlen($a) > $bestLen) {
                        $bestLen = strlen($a);
                        $bestKey = $key;
                    }
                }
            }

            if ($bestKey !== null) {
                $map[$bestKey] = $colIdx;
            }
        }

        return $map;
    }

    /**
     * Parse number from various formats
     */
    private function parseNumber($value): ?float
    {
        if ($value === null || $value === '') return null;
        if (is_numeric($value)) return (float)$value;

        $s = trim((string)$value);
        $s = str_replace(['Rp', 'rp', 'RP', 'Rp.', 'Rp. ', ' '], '', $s);

        // Indonesian format: 1.000.000,50
        if (preg_match('/^\d{1,3}(\.\d{3})+(,\d+)?$/', $s)) {
            $s = str_replace('.', '', $s);
            $s = str_replace(',', '.', $s);
            return is_numeric($s) ? (float)$s : null;
        }

        // English format: 1,000,000.50
        if (preg_match('/^\d{1,3}(,\d{3})+(\.\d+)?$/', $s)) {
            $s = str_replace(',', '', $s);
            return is_numeric($s) ? (float)$s : null;
        }

        $s = str_replace(',', '.', $s);
        return is_numeric($s) ? (float)$s : null;
    }

    public function index(Request $request)
    {
        $query = RabBudget::with('project');
        $projectId = $request->route('projectId') ?? $request->get('project_id');

        if ($projectId) {
            $query->where('project_id', $projectId);
        }

        return response()->json([
            'success' => true,
            'data' => $query->orderBy('id')->paginate($request->get('per_page', 50)),
        ]);
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

        $data = $request->only(['code_item', 'description', 'unit', 'volume', 'unit_price', 'total_price', 'category']);
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
        $request->validate(['project_id' => 'required|exists:projects,id']);
        $count = RabBudget::submitForApproval($request->project_id);
        return response()->json([
            'success' => true,
            'message' => "{$count} item RAB diajukan untuk approval.",
            'data' => ['updated' => $count],
        ]);
    }

    public function approve(Request $request)
    {
        $request->validate(['project_id' => 'required|exists:projects,id']);
        $count = RabBudget::approveAll($request->project_id, Auth::user());
        return response()->json([
            'success' => true,
            'message' => "{$count} item RAB disetujui.",
            'data' => ['approved' => $count],
        ]);
    }

    public function reject(Request $request)
    {
        $request->validate(['project_id' => 'required|exists:projects,id']);
        $count = RabBudget::rejectAll($request->project_id, Auth::user());
        return response()->json([
            'success' => true,
            'message' => "{$count} item RAB ditolak.",
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
        }

        $totalBudget = $query->sum('total_price');
        $totalItems = $query->count();
        $byCategory = RabBudget::select(
                DB::raw("COALESCE(category, 'Umum') as category_name"),
                DB::raw('count(*) as count'),
                DB::raw('sum(total_price) as total')
            )
            ->when($projectId, fn($q) => $q->where('project_id', $projectId))
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