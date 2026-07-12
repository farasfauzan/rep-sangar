<?php

namespace App\Console\Commands;

use App\Services\MimoAiService;
use Illuminate\Console\Command;

class TestAiClassifier extends Command
{
    protected $signature = 'ai:test {description? : Deskripsi item pekerjaan} {--batch : Tes batch}';

    protected $description = 'Tes klasifikasi AI (MiMo) atau fallback keyword-based';

    public function handle(MimoAiService $ai): int
    {
        $this->info('=== Tes AI Classifier ===');
        $this->line('Status konfigurasi API: ' . ($ai->isConfigured() ? '<fg=green>TERKONFIGURASI</>' : '<fg=red>TIDAK TERKONFIGURASI</>'));
        $this->line('Base URL: ' . config('services.mimo.base_url'));
        $this->line('Model: ' . config('services.mimo.model'));
        $this->newLine();

        $sampleItems = [
            'Besi beton ulir diameter 12mm',
            'Pengecoran lantai 1 mutu K-300',
            'Pemasangan keramik lantai 60x60',
            'Pekerjaan galian tanah pondasi',
            'Cat tembok interior warna putih',
            'Pemasangan AC split 1 PK',
            'Titik lampu penerangan ruang utama',
            'Pemasangan kloset duduk merk TOTO',
            'Pembersihan lahan dan mobilisasi alat',
        ];

        $description = $this->argument('description');

        if ($description) {
            $this->line("Input: <fg=cyan>{$description}</>");
            $result = $ai->classify($description);
            $this->line('Hasil AI: ' . ($result ?? '<fg=red>null (tidak terklasifikasi)</>'));
            $fallback = $ai->fallbackClassify($description);
            $this->line('Hasil Fallback: ' . ($fallback ?? '<fg=red>null</>'));
            return self::SUCCESS;
        }

        $items = $this->option('batch') ? $sampleItems : array_slice($sampleItems, 0, 5);

        $this->line('Menguji ' . count($items) . ' item sample...');
        $this->newLine();

        $results = $ai->classifyBatch($items);

        $this->table(
            ['No', 'Deskripsi', 'Hasil Klasifikasi'],
            collect($items)->map(fn($item, $i) => [
                $i + 1,
                $item,
                $results[$i] ?? '<fg=red>null</>',
            ])->toArray()
        );

        $classified = count(array_filter($results, fn($r) => $r !== null));
        $this->newLine();
        $this->info("Berhasil diklasifikasi: {$classified}/" . count($items));

        return self::SUCCESS;
    }
}