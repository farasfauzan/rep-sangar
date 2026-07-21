<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Project;
use App\Models\RabBudget;
use PhpOffice\PhpSpreadsheet\IOFactory;
use Illuminate\Support\Facades\DB;

class ImportGikRab extends Command
{
    protected $signature = 'import:gik-rab
                            {--dry-run : Parse and validate the workbook without changing RAB data}
                            {--replace : Replace the current GIK UGM RAB version after a successful parse}';
    protected $description = 'Import full RAB GIK UGM from Excel file';

    public function handle()
    {
        $this->info('Starting GIK UGM RAB import...');

        ini_set('memory_limit', '512M');
        
        // 1. Get Project
        $project = Project::where('project_name', 'GIK UGM')->first();
        if (!$project) {
            $this->error('Project GIK UGM not found!');
            return 1;
        }
        $this->info("Project: {$project->project_name} (ID: {$project->id})");
        
        // 2. Load Excel (Optimized Memory)
        $filePath = storage_path('app/excel/C.1 RAB GIK UGM Ulang.xlsx');
        if (!file_exists($filePath)) {
            $this->error("File not found: $filePath");
            return 1;
        }
        
        $this->info("Loading Excel file...");
        $reader = IOFactory::createReaderForFile($filePath);
        $reader->setReadDataOnly(true); // Abaikan styling UI Excel untuk hemat RAM
        $spreadsheet = $reader->load($filePath);
        
        $sheet = $spreadsheet->getSheetByName('RAB GIK UGM');
        if (!$sheet) {
            $this->error('Sheet "RAB GIK UGM" not found!');
            return 1;
        }
        
        $this->info("Parsing sheet: " . $sheet->getTitle() . " (Rows: " . $sheet->getHighestRow() . ")");
        
        // 3. Parse all rows
        $items = [];
        $currentCategory = null;
        $currentSubCategory = null;
        $itemNo = 0;
        
        foreach ($sheet->getRowIterator(9) as $row) {
            $rowNumber = $row->getRowIndex();
            $cells = [];
            foreach (range('A', 'G') as $column) {
                $cells[$column] = $this->cellValue($sheet->getCell($column.$rowNumber));
            }

            $sectionCode = trim($this->stringValue($cells['A'] ?? null));
            $uraianStr = trim($this->stringValue($cells['C'] ?? null));
            $satuan = $this->stringValue($cells['D'] ?? null);
            $volume = $cells['E'] ?? null;
            $harga = $cells['F'] ?? null;
            $jumlah = $cells['G'] ?? null;

            if ($uraianStr === '') continue;
            
            if (preg_match('/^[A-Z]+\.?$/', $sectionCode) && stripos($uraianStr, 'MATA PEMBAYARAN') !== false) {
                $currentCategory = $uraianStr;
                $currentSubCategory = null;
                continue;
            }

            if ($volume === null && $harga === null && $jumlah === null && preg_match('/PEKERJAAN|STRUKTUR|ARSITEKTUR|MEP|UTAMA|PERSIAPAN|SMKKK/i', $uraianStr)) {
                $currentSubCategory = $uraianStr;
                continue;
            }
            
            if ($volume === null && $harga === null && $jumlah === null) continue;
            
            $vol = $this->numericValue($volume);
            $hrg = $this->numericValue($harga);
            $jml = $this->numericValue($jumlah);

            if ($jml === 0.0 && $vol > 0 && $hrg > 0) {
                $jml = $vol * $hrg;
            }
            
            if ($vol === 0 && $hrg === 0 && $jml === 0) continue;
            
            $items[] = [
                'item_no' => ++$itemNo,
                'code' => null,
                'description' => $uraianStr,
                'unit' => trim($satuan) ?: 'unit',
                'qty' => $vol,
                'price' => $hrg,
                'total' => $jml,
                'category' => $currentCategory ?? 'Umum',
                'sub_category' => $currentSubCategory ?? null,
            ];
        }
        
        $this->info("Parsed " . count($items) . " items");

        if ($this->option('dry-run')) {
            $this->info('Dry run selesai. Tidak ada data RAB yang diubah.');
            return self::SUCCESS;
        }

        if (! $this->option('replace')) {
            $this->warn('Tidak ada data yang ditulis. Jalankan kembali dengan --replace setelah memeriksa hasil dry run.');
            return self::SUCCESS;
        }

        // 4. Proses Database dengan Transaction & Bulk Insert
        DB::transaction(function () use ($project, $items) {
            $existingCount = RabBudget::where('project_id', $project->id)->count();
            if ($existingCount > 0) {
                $this->warn("Menghapus {$existingCount} data RAB lama...");
                RabBudget::where('project_id', $project->id)->delete();
            }
            
            $this->info("Creating categories...");
            $categories = [];
            foreach ($items as $item) {
                $catName = $item['category'] ?? 'Umum';
                if (!isset($categories[$catName])) {
                    $cat = RabBudget::firstOrCreate(
                        ['description' => $catName, 'project_id' => $project->id, 'parent_id' => null],
                        [
                            'code_item' => 'CAT-' . strtoupper(substr($catName, 0, 3)),
                            'unit' => '',
                            'volume' => 0,
                            'unit_price' => 0,
                            'total_price' => 0,
                            'category' => $catName,
                            'status' => 'APPROVED',
                        ]
                    );
                    $categories[$catName] = $cat->id;
                    $this->line("  Category: {$catName} (ID: {$cat->id})");
                }
            }
            
            $this->info("Importing " . count($items) . " RAB items via Bulk Insert...");
            
            foreach (array_chunk($items, 100) as $batchIndex => $batch) {
                $insertData = [];
                
                foreach ($batch as $item) {
                    if (empty($item['description'])) continue;
                    
                    $catName = $item['category'] ?? 'Umum';
                    $parentId = $categories[$catName] ?? null;
                    
                    $insertData[] = [
                        'project_id' => $project->id,
                        'parent_id' => $parentId,
                        'code_item' => $item['code'] ?? 'ITEM-' . $item['item_no'],
                        'description' => $item['description'],
                        'unit' => $item['unit'],
                        'volume' => $item['qty'],
                        'unit_price' => $item['price'],
                        'total_price' => $item['total'],
                        'category' => $item['category'],
                        'status' => 'DRAFT',
                        'created_at' => now(),
                        'updated_at' => now(),
                    ];
                }
                
                RabBudget::insert($insertData);
                $this->line("  Done batch " . ($batchIndex + 1));
            }
        });
        
        $this->info('Import complete! Total: ' . count($items) . ' items');
        return 0;
    }

    private function stringValue(mixed $value): string
    {
        if ($value instanceof \PhpOffice\PhpSpreadsheet\RichText\RichText) {
            return $value->getPlainText();
        }
        return trim((string) $value);
    }

    private function numericValue(mixed $value): float
    {
        if (is_numeric($value)) {
            return (float) $value;
        }

        $number = preg_replace('/[^0-9,.-]/', '', $this->stringValue($value));
        if ($number === '' || $number === '-' || $number === null) {
            return 0.0;
        }

        $lastComma = strrpos($number, ',');
        $lastDot = strrpos($number, '.');
        if ($lastComma !== false && $lastDot !== false) {
            $number = $lastComma > $lastDot
                ? str_replace(',', '.', str_replace('.', '', $number))
                : str_replace(',', '', $number);
        } elseif ($lastComma !== false) {
            $number = str_replace(',', '.', $number);
        }

        return is_numeric($number) ? (float) $number : 0.0;
    }

    private function cellValue(\PhpOffice\PhpSpreadsheet\Cell\Cell $cell): mixed
    {
        $value = $cell->getValue();
        if (! is_string($value) || ! str_starts_with($value, '=')) {
            return $value;
        }

        $cachedValue = $cell->getOldCalculatedValue();
        return $cachedValue ?? $cell->getCalculatedValue();
    }
}