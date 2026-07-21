<?php

namespace Tests\Utilities;

use App\Services\MimoAiService;
use Illuminate\Console\Command;

class TestAiClassifier extends Command
{
    protected $signature = 'ai:test {description? : Deskripsi item pekerjaan} {--batch : Tes batch} {--unit= : Satuan item (opsional)}';

    protected $description = 'Tes klasifikasi RAB: kategori pekerjaan + tipe sumber daya (material/upah/jasa/alat)';

    public function handle(MimoAiService $ai): int
    {
        $this->info('=== Tes RAB Classifier (Score-Based) ===');
        $this->line('Mode: <fg=green>Local Keyword Scoring (200+ keywords, 18 kategori)</> ');
        $this->newLine();

        $sampleItems = [
            ['desc' => 'Besi beton ulir diameter 12mm',              'unit' => 'kg'],
            ['desc' => 'Pengecoran lantai 1 mutu K-300',             'unit' => 'm3'],
            ['desc' => 'Pemasangan keramik lantai 60x60',            'unit' => 'm2'],
            ['desc' => 'Pekerjaan galian tanah pondasi',             'unit' => 'm3'],
            ['desc' => 'Cat tembok interior warna putih',            'unit' => 'ltr'],
            ['desc' => 'Pemasangan AC split 1 PK',                   'unit' => 'unit'],
            ['desc' => 'Titik lampu penerangan ruang utama',         'unit' => 'titik'],
            ['desc' => 'Pemasangan kloset duduk merk TOTO',          'unit' => 'bh'],
            ['desc' => 'Pembersihan lahan dan mobilisasi alat',      'unit' => 'ls'],
            ['desc' => 'Cat besi anti karat',                        'unit' => 'kg'],
            ['desc' => 'Upah tukang besi harian',                    'unit' => 'oh'],
            ['desc' => 'Sewa excavator CAT 320',                     'unit' => 'jam'],
            ['desc' => 'Pekerjaan borongan atap spandek',            'unit' => 'ls'],
            ['desc' => 'Pengadaan scaffolding standar',              'unit' => 'set'],
            ['desc' => 'Batu bata merah press',                      'unit' => 'bh'],
        ];

        $description = $this->argument('description');

        if ($description) {
            $unit = $this->option('unit');
            $this->line("Input: <fg=cyan>{$description}</>");
            if ($unit) {
                $this->line("Satuan: <fg=cyan>{$unit}</>");
            }
            $result = $ai->classify($description);
            $type = $ai->detectResourceType($description, $unit);
            $this->line('Kategori: ' . ($result ?? '<fg=red>null (tidak terklasifikasi)</>'));
            $this->line('Tipe: <fg=yellow>' . $type . '</>');
            return self::SUCCESS;
        }

        $items = $this->option('batch') ? $sampleItems : array_slice($sampleItems, 0, 10);

        $this->line('Menguji ' . count($items) . ' item sample...');
        $this->newLine();

        $this->table(
            ['No', 'Deskripsi', 'Satuan', 'Kategori', 'Tipe'],
            collect($items)->map(fn($item, $i) => [
                $i + 1,
                $item['desc'],
                $item['unit'],
                $ai->classify($item['desc']) ?? '<fg=red>null</>',
                $ai->detectResourceType($item['desc'], $item['unit']),
            ])->toArray()
        );

        $results = array_map(fn($item) => $ai->classify($item['desc']), $items);
        $classified = count(array_filter($results, fn($r) => $r !== null));
        $this->newLine();
        $this->info("Berhasil diklasifikasi: {$classified}/" . count($items));

        return self::SUCCESS;
    }
}