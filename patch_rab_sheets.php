<?php
/**
 * Patch: Fix RAB import to read detail sheets (not recap sheet 1)
 * 
 * Problem: Sheet 1 is REKAPITULASI (No, Uraian, SubHarga, TotalHarga) - no Volume/Satuan
 * Solution: Read sheets that contain "VOLUME" and "HARGA SATUAN" headers
 * 
 * Run: php patch_rab_sheets.php
 */

$controllerPath = __DIR__ . '/app/Http/Controllers/Api/RabBudgetController.php';
$content = file_get_contents($controllerPath);

// Replace the entire previewExcel method
$oldPreview = <<<'ENDOFMETHOD'
    public function previewExcel(Request $request)
    {
        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls',
        ]);

        try {
            $file = $request->file('file');
            $spreadsheet = \PhpOffice\PhpSpreadsheet\IOFactory::load($file->getRealPath());
            $sheet = $spreadsheet->getActiveSheet();
            $rows = $sheet->toArray();
            
            // Find header row (search for row containing key column names)
            $headerRowIndex = 0;
            $headerRow = [];
            $headers = ['ur', 'uraian', 'pekerjaan', 'item', 'kode', 'nama', 'deskripsi', 'description'];
            
            for ($i = 0; $i < min(15, count($rows)); $i++) {
                $row = array_map('strtolower', array_map('trim', array_filter($rows[$i] ?? [], fn($v) => $v !== null && $v !== '')));
                foreach ($row as $cell) {
                    foreach ($headers as $h) {
                        if (str_contains($cell, $h)) {
                            $headerRowIndex = $i;
                            $headerRow = $rows[$i];
                            break 3;
                        }
                    }
                }
            }
            
            if (empty($headerRow)) {
                // Fallback: assume row 7 is header (common in RAB files)
                $headerRowIndex = 6;
                $headerRow = $rows[6] ?? [];
            }
            
            // Auto-detect column mapping from header
            $cols = ['code_item' => null, 'description' => null, 'unit' => null, 'volume' => null, 'unit_price' => null, 'total_price' => null];
            foreach ($headerRow as $idx => $h) {
                $h = strtolower(trim((string) $h));
                if (in_array($h, ['kode', 'kode barang', 'code', 'no'])) {
                    $cols['code_item'] = $idx;
                } elseif (str_contains($h, 'uraian') || str_contains($h, 'pekerjaan') || str_contains($h, 'deskripsi') || str_contains($h, 'description') || str_contains($h, 'nama barang')) {
                    $cols['description'] = $idx;
                } elseif (in_array($h, ['sat.', 'sat', 'satuan', 'unit'])) {
                    $cols['unit'] = $idx;
                } elseif (in_array($h, ['volume', 'vol', 'qty', 'jumlah', 'kuantitas'])) {
                    $cols['volume'] = $idx;
                } elseif (str_contains($h, 'harga satuan') || str_contains($h, 'harga sat')) {
                    $cols['unit_price'] = $idx;
                } elseif (str_contains($h, 'jumlah harga') || str_contains($h, 'total') || $h === 'harga') {
                    $cols['total_price'] = $idx;
                }
            }

            // Fallback mapping for common RAB Excel format (columns B,C,D,E,F,G from row 7)
            if ($cols['description'] === null) {
                $cols = ['code_item' => 0, 'description' => 1, 'unit' => 2, 'volume' => 3, 'unit_price' => 4, 'total_price' => 5];
            }
            
            $preview = [];
            for ($i = $headerRowIndex + 1; $i < min($headerRowIndex + 31, count($rows)); $i++) {
                $row = $rows[$i];
                $row = array_map(fn($v) => trim((string) $v), $row);
                $preview[] = [
                    'row' => $i + 1,
                    'code_item' => $row[$cols['code_item']] ?? '',
                    'description' => $row[$cols['description']] ?? '',
                    'unit' => $row[$cols['unit']] ?? '',
                    'volume' => $row[$cols['volume']] ?? '',
                    'unit_price' => $row[$cols['unit_price']] ?? '',
                    'total_price' => $row[$cols['total_price']] ?? '',
                ];
            }

            return response()->json([
                'headers' => array_values($headerRow),
                'preview' => $preview,
                'header_row' => $headerRowIndex + 1,
                'column_mapping' => $cols,
                'total_rows' => count($rows),
            ]);
        } catch (\Exception $e) {
            \Log::error('RAB Preview Error: ' . $e->getMessage());
            return response()->json(['error' => 'Gagal membaca file: ' . $e->getMessage()], 500);
        }
    }
ENDOFMETHOD;

$newPreview = <<<'ENDOFMETHOD'
    public function previewExcel(Request $request)
    {
        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls',
        ]);

        try {
            $file = $request->file('file');
            $zip = new \ZipArchive();
            if ($zip->open($file->getRealPath()) !== true) {
                return response()->json(['error' => 'Gagal membuka file Excel'], 500);
            }

            // Read shared strings
            $sharedStrings = [];
            $ss = $zip->getFromName('xl/sharedStrings.xml');
            if ($ss) {
                $xml = simplexml_load_string($ss);
                if ($xml) {
                    foreach ($xml->si as $si) {
                        $text = isset($si->t) ? (string)$si->t : '';
                        if (!$text && isset($si->r)) {
                            foreach ($si->r as $r) $text .= (string)$r->t;
                        }
                        $sharedStrings[] = $text;
                    }
                }
            }

            // Find all sheets
            $sheets = [];
            for ($i = 0; $i < $zip->numFiles; $i++) {
                $name = $zip->getNameIndex($i);
                if (preg_match('#^xl/worksheets/sheet(\d+)\.xml$#', $name, $m)) {
                    $sheets[(int)$m[1]] = $name;
                }
            }
            ksort($sheets);

            // Find detail sheets (those with VOLUME/HARGA SATUAN headers)
            $preview = [];
            $totalRows = 0;
            $headers = [];
            $found = false;

            foreach ($sheets as $sheetNum => $sheetPath) {
                $xml = simplexml_load_string($zip->getFromName($sheetPath));
                if (!$xml || !isset($xml->sheetData->row)) continue;

                $sheetRows = [];
                foreach ($xml->sheetData->row as $rowNode) {
                    $cells = [];
                    foreach ($rowNode->c as $cell) {
                        $ref = (string)$cell['r'];
                        $col = preg_replace('/\d+/', '', $ref);
                        $colIdx = 0;
                        for ($c = strlen($col) - 1, $p = 0; $c >= 0; $c--, $p++) {
                            $colIdx += (ord($col[$c]) - 64) * pow(26, $p);
                        }
                        $type = (string)$cell['t'];
                        $val = '';
                        if ($type === 's' && isset($cell->v)) {
                            $val = $sharedStrings[(int)$cell->v] ?? '';
                        } elseif (isset($cell->v)) {
                            $val = (string)$cell->v;
                        }
                        $cells[$colIdx - 1] = $val;
                    }
                    ksort($cells);
                    $sheetRows[] = array_values($cells);
                }

                if (empty($sheetRows)) continue;

                // Find header row with "volume" or "harga satuan"
                $headerIdx = -1;
                foreach ($sheetRows as $ri => $row) {
                    $lower = array_map(fn($v) => strtolower(trim((string)$v)), $row);
                    $joined = implode(' ', $lower);
                    if (str_contains($joined, 'volume') && (str_contains($joined, 'harga satuan') || str_contains($joined, 'harga sat') || str_contains($joined, 'jumlah'))) {
                        $headerIdx = $ri;
                        break;
                    }
                }

                if ($headerIdx < 0) continue; // Not a detail sheet

                $found = true;
                $headerRow = $sheetRows[$headerIdx];
                $headers = array_map(fn($v) => trim((string)$v), $headerRow);

                // Collect data rows
                $totalRows += count($sheetRows) - $headerIdx - 1;
                for ($ri = $headerIdx + 1; $ri < count($sheetRows); $ri++) {
                    $row = $sheetRows[$ri];
                    $preview[] = $row;
                }

                if (count($preview) >= 30) break; // Enough for preview
            }

            $zip->close();

            if (!$found) {
                return response()->json(['error' => 'Tidak ditemukan sheet detail RAB (dengan kolom Volume/Harga Satuan)'], 400);
            }

            // Limit preview to 30 rows
            $preview = array_slice($preview, 0, 30);

            // Format preview rows
            $formattedPreview = [];
            $rowNum = 1;
            foreach ($preview as $row) {
                $formattedPreview[] = [
                    'row' => $rowNum++,
                    'code_item' => $row[0] ?? '',
                    'description' => $row[1] ?? '',
                    'unit' => $row[3] ?? '',
                    'volume' => $row[4] ?? '',
                    'unit_price' => $row[5] ?? '',
                    'total_price' => $row[6] ?? '',
                ];
            }

            return response()->json([
                'headers' => $headers,
                'preview' => $formattedPreview,
                'header_row' => 1,
                'total_rows' => $totalRows,
            ]);
        } catch (\Exception $e) {
            \Log::error('RAB Preview Error: ' . $e->getMessage());
            return response()->json(['error' => 'Gagal membaca file: ' . $e->getMessage()], 500);
        }
    }
ENDOFMETHOD;

if (strpos($content, 'Read shared strings') !== false) {
    echo "Controller already patched with ZipArchive approach. Checking for further fixes...\n";
    // Already patched, skip
} else {
    $content = str_replace($oldPreview, $newPreview, $content);
    file_put_contents($controllerPath, $content);
    echo "Patched previewExcel to use ZipArchive with detail sheets.\n";
}

// Now patch autoImport
$oldAutoImport = <<<'ENDOFMETHOD'
    public function autoImport(Request $request)
    {
        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls',
            'project_id' => 'required|exists:projects,id',
        ]);

        $projectId = $request->project_id;
        $file = $request->file('file');

        try {
            $spreadsheet = \PhpOffice\PhpSpreadsheet\IOFactory::load($file->getRealPath());
            $sheet = $spreadsheet->getActiveSheet();
            $allRows = $sheet->toArray();

            // Find header row (search for row containing 'kode' or 'uraian')
            $headerRowIndex = 0;
            $headerRow = [];
            for ($i = 0; $i < min(15, count($allRows)); $i++) {
                $row = array_map('strtolower', array_map('trim', array_filter($allRows[$i] ?? [], fn($v) => $v !== null && $v !== '')));
                foreach ($row as $cell) {
                    if (in_array($cell, ['kode', 'kode barang', 'code', 'no'])) {
                        $headerRowIndex = $i;
                        $headerRow = $allRows[$i];
                        break 2;
                    }
                }
            }
ENDOFMETHOD;

$newAutoImport = <<<'ENDOFMETHOD'
    public function autoImport(Request $request)
    {
        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls',
            'project_id' => 'required|exists:projects,id',
        ]);

        $projectId = $request->project_id;
        $file = $request->file('file');

        try {
            // Use ZipArchive to read ALL detail sheets (skip recap sheet 1)
            $zip = new \ZipArchive();
            if ($zip->open($file->getRealPath()) !== true) {
                return response()->json(['error' => 'Gagal membuka file Excel'], 500);
            }

            // Read shared strings
            $sharedStrings = [];
            $ss = $zip->getFromName('xl/sharedStrings.xml');
            if ($ss) {
                $xml = simplexml_load_string($ss);
                if ($xml) {
                    foreach ($xml->si as $si) {
                        $text = isset($si->t) ? (string)$si->t : '';
                        if (!$text && isset($si->r)) {
                            foreach ($si->r as $r) $text .= (string)$r->t;
                        }
                        $sharedStrings[] = $text;
                    }
                }
            }

            // Find all sheets
            $sheets = [];
            for ($i = 0; $i < $zip->numFiles; $i++) {
                $name = $zip->getNameIndex($i);
                if (preg_match('#^xl/worksheets/sheet(\d+)\.xml$#', $name, $m)) {
                    $sheets[(int)$m[1]] = $name;
                }
            }
            ksort($sheets);

            // Collect rows from ALL detail sheets
            $allDataRows = [];
            $currentCategory = '';

            foreach ($sheets as $sheetNum => $sheetPath) {
                $xml = simplexml_load_string($zip->getFromName($sheetPath));
                if (!$xml || !isset($xml->sheetData->row)) continue;

                $sheetRows = [];
                foreach ($xml->sheetData->row as $rowNode) {
                    $cells = [];
                    foreach ($rowNode->c as $cell) {
                        $ref = (string)$cell['r'];
                        $col = preg_replace('/\d+/', '', $ref);
                        $colIdx = 0;
                        for ($c = strlen($col) - 1, $p = 0; $c >= 0; $c--, $p++) {
                            $colIdx += (ord($col[$c]) - 64) * pow(26, $p);
                        }
                        $type = (string)$cell['t'];
                        $val = '';
                        if ($type === 's' && isset($cell->v)) {
                            $val = $sharedStrings[(int)$cell->v] ?? '';
                        } elseif (isset($cell->v)) {
                            $val = (string)$cell->v;
                        }
                        $cells[$colIdx - 1] = $val;
                    }
                    ksort($cells);
                    $sheetRows[] = array_values($cells);
                }

                if (empty($sheetRows)) continue;

                // Find header row with "volume" or "harga satuan"
                $headerIdx = -1;
                foreach ($sheetRows as $ri => $row) {
                    $lower = array_map(fn($v) => strtolower(trim((string)$v)), $row);
                    $joined = implode(' ', $lower);
                    if (str_contains($joined, 'volume') && (str_contains($joined, 'harga satuan') || str_contains($joined, 'harga sat') || str_contains($joined, 'jumlah'))) {
                        $headerIdx = $ri;
                        break;
                    }
                }

                if ($headerIdx < 0) continue; // Not a detail sheet

                // Collect data rows from this sheet
                for ($ri = $headerIdx + 1; $ri < count($sheetRows); $ri++) {
                    $row = $sheetRows[$ri];
                    $desc = trim((string)($row[1] ?? ''));
                    $vol = trim((string)($row[4] ?? ''));
                    $unitPrice = trim((string)($row[5] ?? ''));
                    $totalPrice = trim((string)($row[6] ?? ''));

                    // Category rows: has description but no volume/price (section headers)
                    if ($desc !== '' && $vol === '' && $unitPrice === '' && $totalPrice === '') {
                        $currentCategory = $desc;
                        continue;
                    }

                    // Data rows: must have description AND at least volume or unit_price
                    if ($desc === '') continue;
                    if ($vol === '' && $unitPrice === '' && $totalPrice === '') continue;

                    $allDataRows[] = [
                        'code_item' => trim((string)($row[0] ?? '')),
                        'description' => $desc,
                        'unit' => trim((string)($row[3] ?? '')),
                        'volume' => $vol,
                        'unit_price' => $unitPrice,
                        'total_price' => $totalPrice,
                        'category' => $currentCategory,
                    ];
                }
            }

            $zip->close();

            if (empty($allDataRows)) {
                return response()->json(['error' => 'Tidak ditemukan data RAB valid di file'], 400);
            }

            $headerRowIndex = 1; // Used for compatibility
            $headerRow = ['No', 'Uraian', '', 'Sat.', 'Volume', 'Harga Satuan', 'Jumlah Harga'];
ENDOFMETHOD;

$content = file_get_contents($controllerPath);

if (strpos($content, 'Use ZipArchive to read ALL detail sheets') !== false) {
    echo "autoImport already patched.\n";
} else {
    // Find and replace the beginning of autoImport
    // We need to replace from the function start up to the data processing section
    
    // Replace the file reading + header detection part
    $autoImportStart = strpos($content, 'public function autoImport(Request $request)');
    if ($autoImportStart === false) {
        echo "ERROR: Cannot find autoImport method\n";
        exit(1);
    }
    
    // Find the end of the header detection (search for "Auto-detect column mapping from header row")
    $mappingMarker = 'Auto-detect column mapping from header row';
    $mappingPos = strpos($content, $mappingMarker);
    
    // Find the old data processing (skip empty rows)
    $skipMarker = "// Skip empty rows\n";
    $skipPos = strpos($content, $skipMarker);
    
    // Build the full replacement
    $beforeAutoImport = substr($content, 0, $autoImportStart);
    
    // Find the old autoImport function end by looking for the next method or closing bracket
    // Actually, let's just replace the entire autoImport method
    $remaining = substr($content, $autoImportStart);
    
    // Find where autoImport ends - look for the next method declaration or the class closing
    // Simple approach: replace everything from autoImport start to the autoDetect mapping line
    
    // Let me use a different approach: directly construct the new file content
    // Find the exact boundaries
    $oldAutoImportBlock = substr($content, $autoImportStart, $mappingPos - $autoImportStart);
    
    $content = $beforeAutoImport . $newAutoImport . substr($content, $mappingPos);
    file_put_contents($controllerPath, $content);
    echo "Patched autoImport to use ZipArchive with detail sheets.\n";
}

echo "\nDone. Delete old bad data and re-import:\n";
echo "  cd erp-konstruksi && php artisan tinker --execute=\"\\App\\Models\\RabBudget::where('project_id', 1)->delete(); echo 'Deleted';\"\n";