<?php

namespace App\Traits;

use App\Models\RabBudget;
use Illuminate\Support\Facades\Log;

trait HandlesRabParsing
{
    protected $codeCounters = [];
    /**
     * Unified row streamer based on file type.
     */
    protected function streamRows(string $path, string $type, ?string $sheetName = null): \Generator
    {
        $type = strtolower($type);
        if ($type === 'xlsx') {
            foreach ($this->streamWorksheetRows($path, $sheetName ?? 'Sheet1') as $idx => $row) {
                yield $idx => $row;
            }
        } elseif ($type === 'csv') {
            foreach ($this->streamCsvRows($path) as $idx => $row) {
                yield $idx => $row;
            }
        } elseif ($type === 'xls') {
            foreach ($this->streamXlsRows($path) as $idx => $row) {
                yield $idx => $row;
            }
        } else {
            throw new \InvalidArgumentException("Format file tidak didukung: {$type}");
        }
    }

    /**
     * Parse the first N rows of a file for preview/sheet identification.
     */
    protected function parseRaw(string $path, string $type, ?int $maxRows = null): array
    {
        $type = strtolower($type);
        $sheets = [];
        $errors = [];

        if ($type === 'xlsx') {
            $zip = new \ZipArchive();
            if ($zip->open($path) !== true) {
                throw new \RuntimeException('Tidak dapat membuka file XLSX.');
            }

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
            $zip->close();

            foreach ($sheetFiles as $sheetNum => $sheetPath) {
                $sheetName = "Sheet$sheetNum";
                $sheetRows = [];
                foreach ($this->streamWorksheetRows($path, $sheetName) as $row) {
                    if ($maxRows !== null && count($sheetRows) >= $maxRows) break;
                    $sheetRows[] = $row;
                }
                $sheets[$sheetName] = $sheetRows;
            }
        } elseif ($type === 'csv') {
            $sheetRows = [];
            foreach ($this->streamCsvRows($path) as $row) {
                if ($maxRows !== null && count($sheetRows) >= $maxRows) break;
                $sheetRows[] = $row;
            }
            $sheets['CSV_Data'] = $sheetRows;
        } elseif ($type === 'xls') {
            $sheetRows = [];
            foreach ($this->streamXlsRows($path) as $row) {
                if ($maxRows !== null && count($sheetRows) >= $maxRows) break;
                $sheetRows[] = $row;
            }
            $sheets['XLS_Data'] = $sheetRows;
        } else {
            throw new \InvalidArgumentException("Format file tidak didukung: {$type}");
        }

        return ['sheets' => $sheets, 'errors' => $errors];
    }

    /**
     * CSV Reader (memory efficient)
     */
    protected function streamCsvRows(string $path): \Generator
    {
        if (($handle = fopen($path, 'r')) !== false) {
            // Detect delimiter
            $firstLine = fgets($handle);
            rewind($handle);
            $delimiter = ',';
            if (strpos($firstLine, ';') !== false && strpos($firstLine, ',') === false) {
                $delimiter = ';';
            } elseif (strpos($firstLine, "\t") !== false) {
                $delimiter = "\t";
            }

            while (($data = fgetcsv($handle, 0, $delimiter)) !== false) {
                yield array_map(fn($val) => $val !== null ? trim((string)$val) : '', $data);
            }
            fclose($handle);
        }
    }

    /**
     * XLS Reader (via PhpSpreadsheet)
     */
    protected function streamXlsRows(string $path): \Generator
    {
        $reader = \PhpOffice\PhpSpreadsheet\IOFactory::createReader('Xls');
        $reader->setReadDataOnly(true);
        $spreadsheet = $reader->load($path);
        $sheet = $spreadsheet->getActiveSheet();
        foreach ($sheet->getRowIterator() as $row) {
            $cellIterator = $row->getCellIterator();
            $cellIterator->setIterateOnlyExistingCells(false);
            $rowData = [];
            foreach ($cellIterator as $cell) {
                $rowData[] = (string) $cell->getValue();
            }
            yield $rowData;
        }
    }

    /**
     * XLSX Reader (raw XML zip streaming)
     */
    protected function streamWorksheetRows(string $path, string $sheetName): \Generator
    {
        if (! preg_match('/^Sheet(\d+)$/', $sheetName, $matches)) {
            $sheetNum = 1;
        } else {
            $sheetNum = $matches[1];
        }

        $zip = new \ZipArchive();
        if ($zip->open($path) !== true) {
            throw new \RuntimeException('Tidak dapat membuka file XLSX.');
        }
        $sharedStrings = $this->sharedStrings($zip);
        $zip->close();

        $reader = new \XMLReader();
        $worksheetPath = "zip://{$path}#xl/worksheets/sheet{$sheetNum}.xml";
        if (! $reader->open($worksheetPath, null, LIBXML_NONET | LIBXML_COMPACT)) {
            // Fallback to sheet1 if sheetName is custom but not found
            $worksheetPath = "zip://{$path}#xl/worksheets/sheet1.xml";
            if (! $reader->open($worksheetPath, null, LIBXML_NONET | LIBXML_COMPACT)) {
                throw new \RuntimeException("Tidak dapat membaca worksheet {$sheetName}.");
            }
        }

        try {
            while ($reader->read()) {
                if ($reader->nodeType !== \XMLReader::ELEMENT || $reader->name !== 'row') {
                    continue;
                }

                $rowXml = $reader->readOuterXml();
                if ($rowXml === '') continue;
                yield $this->rowFromXml($rowXml, $sharedStrings);
            }
        } finally {
            $reader->close();
        }
    }

    protected function sharedStrings(\ZipArchive $zip): array
    {
        $sharedStrings = [];
        $sharedStringsXml = $zip->getFromName('xl/sharedStrings.xml');
        if ($sharedStringsXml === false) {
            return $sharedStrings;
        }

        $xml = simplexml_load_string($sharedStringsXml);
        if (! $xml) return $sharedStrings;

        foreach ($xml->si as $sharedString) {
            $text = isset($sharedString->t) ? (string) $sharedString->t : '';
            foreach ($sharedString->r as $run) {
                $text .= (string) $run->t;
            }
            $sharedStrings[] = $text;
        }

        return $sharedStrings;
    }

    protected function rowFromXml(string $rowXml, array $sharedStrings): array
    {
        $rowNode = simplexml_load_string($rowXml);
        if (! $rowNode) return [];

        $rowData = [];
        foreach ($rowNode->c as $cell) {
            $reference = (string) $cell['r'];
            $columnIndex = $this->columnLetterToIndex(preg_replace('/\d+/', '', $reference));
            $type = (string) $cell['t'];
            $value = null;

            if ($type === 's') {
                $value = $sharedStrings[(int) $cell->v] ?? '';
            } elseif (isset($cell->v)) {
                $value = (string) $cell->v;
            } elseif (isset($cell->is->t)) {
                $value = (string) $cell->is->t;
            }

            while (count($rowData) <= $columnIndex) {
                $rowData[] = '';
            }
            $rowData[$columnIndex] = $value;
        }

        return $rowData;
    }

    protected function columnLetterToIndex(string $letter): int
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
     * Generate next sequential code based on category.
     */
    protected function getNextAutoCode(?string $category): string
    {
        $cat = trim((string)$category);
        if ($cat === '') {
            $cat = 'ITEM';
        }
        
        $prefix = strtoupper(substr(preg_replace('/[^A-Za-z0-9]/', '', $cat), 0, 3));
        if ($prefix === '') {
            $prefix = 'ITEM';
        }

        if (!isset($this->codeCounters[$prefix])) {
            $this->codeCounters[$prefix] = 1;
        }

        $num = $this->codeCounters[$prefix]++;
        return $prefix . '-' . str_pad($num, 4, '0', STR_PAD_LEFT);
    }

    /**
     * Strictly validate number format and values.
     */
    protected function validateNumber($value, string $fieldName, int $rowNumber, string $description): ?float
    {
        if ($value === null || $value === '') {
            return 0.0; // Default to 0.0 for empty/null cells
        }

        $s = trim((string)$value);
        if ($s === '' || $s === '-' || $s === '0' || $s === '0,00' || $s === '0.00') {
            return 0.0;
        }

        $s = str_replace(['Rp', 'rp', 'RP', 'Rp.', 'Rp. ', ' '], '', $s);

        // Remove parentheses notation like "(3)" → treat as section indicator → skip
        if (preg_match('/^\(.*\)$/', $s)) {
            return null;
        }

        // Check directly numeric
        if (is_numeric($s)) {
            return (float)$s;
        }

        // Indonesian format: 1.000.000,50
        if (preg_match('/^\d{1,3}(\.\d{3})+(,\d+)?$/', $s)) {
            $s = str_replace('.', '', $s);
            $s = str_replace(',', '.', $s);
            return (float)$s;
        }

        // English format: 1,000,000.50
        if (preg_match('/^\d{1,3}(,\d{3})+(\.\d+)?$/', $s)) {
            $s = str_replace(',', '', $s);
            return (float)$s;
        }

        // Replace comma with dot
        $sReplaced = str_replace(',', '.', $s);
        if (is_numeric($sReplaced)) {
            return (float)$sReplaced;
        }

        return null; // Invalid text format
    }

    /**
     * Normalize row and return data or validation error array.
     */
    protected function normalizeRabRow(array $row, array $columnMap, int $rowNumber): ?array
    {
        $description = trim((string) ($row[$columnMap['uraian']] ?? ''));
        
        $rawVolume = $row[$columnMap['volume']] ?? null;
        $rawUnitPrice = $row[$columnMap['harga_satuan']] ?? null;
        $rawTotalPrice = $row[$columnMap['jumlah'] ?? -1] ?? null;

        // Skip completely empty rows
        if ($description === '' && $rawVolume === null && $rawUnitPrice === null && $rawTotalPrice === null) {
            return null;
        }

        // Header or section row indicators — skip silently (merged cells cause empty descriptions)
        if ($description === '' || strtolower($description) === 'jumlah' || strtolower($description) === 'total' || strtolower($description) === 'subtotal') {
            return null; // Skip rows without valid description — merged cells, totals, section headers
        }

        // Section headings (description is filled, but volume and price are completely empty)
        if ($rawVolume === null && $rawUnitPrice === null && $rawTotalPrice === null) {
            return null; // Skip section headings
        }

        // Skip total/summary rows by description pattern
        $descLower = strtolower($description);
        if (str_contains($descLower, 'total') || str_contains($descLower, 'subtotal') || str_contains($descLower, 'sub total') || str_contains($descLower, 'grand total') || str_contains($descLower, 'jumlah keseluruhan') || str_contains($descLower, 'total nilai') || str_contains($descLower, 'total penawaran') || str_contains($descLower, 'total harga')) {
            return null;
        }

        // Strict numeric validation
        $volume = $this->validateNumber($rawVolume, 'Volume', $rowNumber, $description);
        if ($volume === null) {
            if ($rawUnitPrice === null && $rawTotalPrice === null) {
                return null;
            }
            return ['error' => "Baris {$rowNumber} ({$description}): Volume '{$rawVolume}' tidak valid. Harus berupa angka."];
        }

        $unitPrice = $this->validateNumber($rawUnitPrice, 'Harga Satuan', $rowNumber, $description);
        if ($unitPrice === null) {
            return ['error' => "Baris {$rowNumber} ({$description}): Harga Satuan '{$rawUnitPrice}' tidak valid. Harus berupa angka."];
        }

        $totalPrice = $this->validateNumber($rawTotalPrice, 'Jumlah', $rowNumber, $description);
        if ($totalPrice === null) {
            return ['error' => "Baris {$rowNumber} ({$description}): Total Harga (Jumlah) '{$rawTotalPrice}' tidak valid. Harus berupa angka."];
        }

        // Skip if everything numeric is zero/null (likely metadata or section footer)
        if ($volume === 0.0 && $unitPrice === 0.0 && $totalPrice === 0.0) {
            return null;
        }

        // Validation constraints
        if ($volume <= 0) {
            return ['error' => "Baris {$rowNumber} ({$description}): Volume harus lebih dari 0."];
        }
        if ($unitPrice < 0) {
            return ['error' => "Baris {$rowNumber} ({$description}): Harga Satuan harus bernilai 0 atau lebih."];
        }

        if ($totalPrice === 0.0) {
            $totalPrice = $volume * $unitPrice;
        }
        if ($totalPrice < 0) {
            return ['error' => "Baris {$rowNumber} ({$description}): Jumlah tidak boleh negatif."];
        }

        $category = trim((string) ($row[$columnMap['kategori'] ?? -1] ?? '')) ?: null;
        $code = trim((string) ($row[$columnMap['kode'] ?? -1] ?? ''));
        if ($code === '') {
            $code = $this->getNextAutoCode($category);
        }

        return [
            'code_item' => $code,
            'description' => $description,
            'unit' => trim((string) ($row[$columnMap['satuan'] ?? -1] ?? '')),
            'volume' => $volume,
            'unit_price' => $unitPrice,
            'total_price' => $totalPrice,
            'category' => $category,
        ];
    }

    /**
     * Map header columns.
     */
    protected function mapColumns(array $headerRow): array
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
                    if ($h === $a) {
                        $bestLen = strlen($a) * 100;
                        $bestKey = $key;
                        break;
                    }
                    if (str_starts_with($h, $a) && strlen($a) > $bestLen) {
                        $bestLen = strlen($a);
                        $bestKey = $key;
                    } elseif (preg_match('/\b' . preg_quote($a, '/') . '\b/', $h) && strlen($a) > $bestLen) {
                        $bestLen = strlen($a);
                        $bestKey = $key;
                    }
                }
            }

            if ($bestKey !== null) {
                $map[$bestKey] = $colIdx;
            }
        }

        // Adaptive Fallback: If 'volume' is missing but 'jumlah' is mapped alongside 'harga_satuan',
        // the 'jumlah' column actually represents the item quantity/volume.
        if (! isset($map['volume']) && isset($map['jumlah']) && isset($map['harga_satuan'])) {
            $map['volume'] = $map['jumlah'];
            unset($map['jumlah']);
        }

        return $map;
    }

    /**
     * Identify best sheet for import.
     */
    protected function findBestSheet(array $sheets): ?array
    {
        $headerKeywords = ['uraian', 'deskripsi', 'pekerjaan', 'description', 'item', 'nama barang', 'uraian barang', 'harga satuan'];
        $requiredCols = ['uraian', 'volume', 'harga_satuan'];
        $best = null;
        $bestScore = 0;

        foreach ($sheets as $sheetName => $rows) {
            $headerRowIndex = null;

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
            $numericRows = 0;
            foreach ($rows as $idx => $row) {
                if ($idx <= $headerRowIndex) continue;
                $uraian = trim((string)($row[$colMap['uraian']] ?? ''));
                if ($uraian !== '' && strtolower($uraian) !== 'jumlah' && strtolower($uraian) !== 'total') {
                    $dataRows++;
                    $vol = $this->validateNumber($row[$colMap['volume'] ?? -1] ?? null, 'Volume', $idx, $uraian);
                    $harga = $this->validateNumber($row[$colMap['harga_satuan'] ?? -1] ?? null, 'Harga Satuan', $idx, $uraian);
                    if ($vol !== null && $harga !== null) {
                        $numericRows++;
                    }
                }
            }

            if ($dataRows === 0) continue;

            $qualityScore = $requiredCount * 1000 + $numericRows;
            if ($qualityScore > $bestScore || ($qualityScore === $bestScore && ($best === null || $dataRows > $best['dataRows']))) {
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
     * Identify all sheets that have a valid RAB structure.
     */
    protected function findValidSheets(array $sheets): array
    {
        $headerKeywords = ['uraian', 'deskripsi', 'pekerjaan', 'description', 'item', 'nama barang', 'uraian barang', 'harga satuan'];
        $requiredCols = ['uraian', 'volume', 'harga_satuan'];
        $validSheets = [];

        foreach ($sheets as $sheetName => $rows) {
            $headerRowIndex = null;

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

            if (!isset($colMap['volume']) || !isset($colMap['harga_satuan'])) {
                for ($next = $headerRowIndex + 1; $next < min($headerRowIndex + 3, count($rows)); $next++) {
                    $colMap2 = $this->mapColumns($rows[$next]);
                    if (isset($colMap2['volume']) && !isset($colMap['volume'])) $colMap['volume'] = $colMap2['volume'];
                    if (isset($colMap2['harga_satuan']) && !isset($colMap['harga_satuan'])) $colMap['harga_satuan'] = $colMap2['harga_satuan'];
                    if (isset($colMap2['jumlah']) && !isset($colMap['jumlah'])) $colMap['jumlah'] = $colMap2['jumlah'];
                    if (isset($colMap['volume']) && isset($colMap['harga_satuan'])) break;
                }
            }

            if ($this->columnMapError($colMap) !== null) {
                continue;
            }

            $dataRows = 0;
            $numericRows = 0;
            foreach ($rows as $idx => $row) {
                if ($idx <= $headerRowIndex) continue;
                $uraian = trim((string)($row[$colMap['uraian']] ?? ''));
                if ($uraian !== '' && strtolower($uraian) !== 'jumlah' && strtolower($uraian) !== 'total') {
                    $dataRows++;
                    $vol = $this->validateNumber($row[$colMap['volume'] ?? -1] ?? null, 'Volume', $idx, $uraian);
                    $harga = $this->validateNumber($row[$colMap['harga_satuan'] ?? -1] ?? null, 'Harga Satuan', $idx, $uraian);
                    if ($vol !== null && $harga !== null) {
                        $numericRows++;
                    }
                }
            }

            if ($dataRows > 0 && $numericRows > 0) {
                $validSheets[] = [
                    'sheetName' => $sheetName,
                    'headerIndex' => $headerRowIndex,
                    'colMap' => $colMap,
                ];
            }
        }

        return $validSheets;
    }

    protected function columnMapError(array $columnMap): ?string
    {
        if (! isset($columnMap['uraian'])) {
            return 'Kolom Uraian/Deskripsi wajib ada.';
        }
        if (! isset($columnMap['volume']) || ! isset($columnMap['harga_satuan'])) {
            return 'Kolom Volume dan Harga Satuan wajib ada agar nilai RAB dapat divalidasi.';
        }
        return null;
    }
}
