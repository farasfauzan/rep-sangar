<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;

class MimoAiService
{
    protected string $apiKey;
    protected string $baseUrl;
    protected string $model;

    private array $validCategories = [
        'Pekerjaan Persiapan',
        'Pekerjaan Tanah',
        'Pekerjaan Pondasi',
        'Pekerjaan Beton',
        'Pekerjaan Batu',
        'Pekerjaan Besi',
        'Pekerjaan Kayu',
        'Pekerjaan Atap',
        'Pekerjaan Plafon',
        'Pekerjaan Lantai',
        'Pekerjaan Dinding',
        'Pekerjaan Cat',
        'Pekerjaan Sanitari',
        'Pekerjaan Mekanikal',
        'Pekerjaan Elektrikal',
        'Pekerjaan Bongkar',
        'Pekerjaan Landscape',
        'Pekerjaan Mebelair',
    ];

    public function __construct()
    {
        $this->apiKey  = config('services.mimo.api_key', '');
        $this->baseUrl = config('services.mimo.base_url', 'https://api.xiaomimimo.com/v1');
        $this->model   = config('services.mimo.model', 'mimo-vl-7b');
    }

    public function isConfigured(): bool
    {
        return $this->apiKey !== '' && $this->apiKey !== 'your-openrouter-api-key-here';
    }

    /**
     * Check if AI has been marked temporarily unavailable (e.g. 401/auth error).
     * Once a hard auth failure occurs, skip API calls for 1 hour to avoid
     * spamming the endpoint on every row during a large import.
     */
    protected function isAiAvailable(): bool
    {
        if (!$this->isConfigured()) {
            return false;
        }
        return !Cache::has('mimo_ai_unavailable');
    }

    protected function markAiUnavailable(int $minutes = 60): void
    {
        Cache::put('mimo_ai_unavailable', true, now()->addMinutes($minutes));
    }

    /**
     * Classify a single item description. Returns category string or null.
     * Uses cache to avoid repeated API calls for same/similar descriptions.
     */
    public function classify(string $description): ?string
    {
        if (trim($description) === '') {
            return null;
        }

        $cacheKey = 'mimo_cat_' . md5(strtolower(trim($description)));
        if (Cache::has($cacheKey)) {
            return Cache::get($cacheKey);
        }

        // Jika AI tidak tersedia (tidak dikonfigurasi atau circuit-breaker aktif),
        // langsung pakai fallback keyword
        if (!$this->isAiAvailable()) {
            $cat = $this->fallbackClassify($description);
            Cache::put($cacheKey, $cat, now()->addHours(24));
            return $cat;
        }

        $result = $this->classifyBatch([$description]);
        return $result[0] ?? $this->fallbackClassify($description);
    }

    /**
     * Classify multiple descriptions in one API call (batch).
     * Returns array keyed by input index => category string or null.
     */
    public function classifyBatch(array $descriptions): array
    {
        if (!$this->isAiAvailable()) {
            // Fallback keyword-based saat AI tidak tersedia atau sedang cooldown (mis. 401)
            return array_map(fn($d) => $this->fallbackClassify($d), $descriptions);
        }

        // Check cache first, collect uncached
        $cached = [];
        $uncached = [];
        $uncachedIdx = [];

        foreach ($descriptions as $i => $desc) {
            $cacheKey = 'mimo_cat_' . md5(strtolower(trim($desc)));
            if (Cache::has($cacheKey)) {
                $cached[$i] = Cache::get($cacheKey);
            } else {
                $uncached[] = $desc;
                $uncachedIdx[] = $i;
            }
        }

        if (empty($uncached)) {
            return $cached;
        }

        // Build numbered list for prompt
        $list = '';
        foreach ($uncached as $j => $desc) {
            $list .= ($j + 1) . '. ' . trim($desc) . "\n";
        }

        $categories = implode(', ', $this->validCategories);

        $prompt = "Klasifikasikan setiap item pekerjaan konstruksi berikut ke dalam SATU kategori saja.\n\n"
            . "Kategori yang tersedia: {$categories}\n\n"
            . "Item:\n{$list}\n"
            . "Jawab HANYA dalam format JSON array, misal: [\"Pekerjaan Beton\",\"Pekerjaan Besi\"]\n"
            . "Jumlah elemen array HARUS sama dengan jumlah item. Jika tidak yakin, gunakan null.";

        try {
            $response = Http::withToken($this->apiKey)
                ->timeout(60)
                ->post($this->baseUrl . '/chat/completions', [
                    'model'    => $this->model,
                    'messages' => [
                        ['role' => 'system', 'content' => 'Kamu adalah ahli klasifikasi pekerjaan konstruksi Indonesia. Jawab hanya JSON array.'],
                        ['role' => 'user',   'content' => $prompt],
                    ],
                    'temperature' => 0.1,
                    'max_tokens'  => 8000,
                ]);

            if (!$response->successful()) {
                Log::warning('MiMo API error', ['status' => $response->status(), 'body' => $response->body()]);
                // Circuit-breaker: hard auth failure (401/403) → skip API selama 1 jam
                if (in_array($response->status(), [401, 403], true)) {
                    $this->markAiUnavailable(60);
                }
                return $this->fallbackResults($uncached, $uncachedIdx, $cached);
            }

            $content = $response->json('choices.0.message.content', '');

            Log::info('MiMo AI response OK', [
                'input_count' => count($uncached),
                'raw_response' => substr($content, 0, 500),
            ]);

            // Strip reasoning tags (<think>...</think>) from reasoning models
            $content = preg_replace('/<think>.*?<\/think>/s', '', $content);
            $content = trim($content);

            // Strip code block markers (multiline safe)
            $content = preg_replace('/^```(?:json)?\s*/m', '', $content);
            $content = preg_replace('/\s*```$/m', '', $content);
            $content = trim($content);

            // Try to extract JSON array if wrapped in extra text
            if (preg_match('/\[[\s\S]*\]/', $content, $matches)) {
                $content = $matches[0];
            }

            $categories_result = json_decode($content, true);

            if (!is_array($categories_result)) {
                Log::warning('MiMo response not valid JSON', ['content' => $content]);
                return $this->fallbackResults($uncached, $uncachedIdx, $cached);
            }

            // Map results back and cache
            $results = $cached;
            foreach ($uncachedIdx as $j => $origIdx) {
                $cat = $categories_result[$j] ?? null;
                // Validate category
                if ($cat !== null && !in_array($cat, $this->validCategories)) {
                    $cat = null; // AI hallucinated non-existent category
                }
                $results[$origIdx] = $cat;

                // Cache for 24h
                $cacheKey = 'mimo_cat_' . md5(strtolower(trim($uncached[$j])));
                Cache::put($cacheKey, $cat, now()->addHours(24));
            }

            ksort($results);
            return $results;

        } catch (\Throwable $e) {
            Log::error('MiMo AI classify error', ['error' => $e->getMessage()]);
            return $this->fallbackResults($uncached, $uncachedIdx, $cached);
        }
    }

    /**
     * Helper: build fallback results from keyword classifier.
     */
    private function fallbackResults(array $uncached, array $uncachedIdx, array $cached): array
    {
        $results = $cached;
        foreach ($uncachedIdx as $j => $origIdx) {
            $cat = $this->fallbackClassify($uncached[$j]);
            $results[$origIdx] = $cat;
            $cacheKey = 'mimo_cat_' . md5(strtolower(trim($uncached[$j])));
            Cache::put($cacheKey, $cat, now()->addHours(24));
        }
        ksort($results);
        return $results;
    }

    /**
     * Keyword-based fallback classifier (tanpa API).
     * Dipakai saat AI tidak dikonfigurasi atau error.
     */
    public function fallbackClassify(string $description): ?string
    {
        $desc = strtolower(trim($description));

        $rules = [
            'Pekerjaan Persiapan' => ['mobilisasi', 'barak', 'pagar', 'plang', 'papan nama', 'direksi keet', 'persiapan', 'pembersihan', 'survey', 'pengukuran', 'emarking', 'angkut', 'truk', 'transport', 'jasa angkut', 'dump truck'],
            'Pekerjaan Tanah'     => ['galian', 'timbunan', 'urug', 'tanah', 'leveling', 'cut and fill', 'landfill', 'padatkan'],
            'Pekerjaan Pondasi'   => ['pondasi', 'pile cap', 'tiang pancang', 'bored pile', 'footing', 'straat', 'pilec', 'spun pile'],
            'Pekerjaan Beton'     => ['beton', 'concrete', 'cor', 'pengecoran', 'ready mix', 'mutu k', 'agregat', 'semen', 'mortar', 'grouting'],
            'Pekerjaan Batu'      => ['batu', 'kali', 'dinding batu', 'bronjong', 'gabion'],
            'Pekerjaan Besi'      => ['besi', 'tulangan', 'wire mesh', 'baja', 'wf', 'h-beam', 'i-beam', 'angle', 'kanal'],
            'Pekerjaan Kayu'      => ['kayu', 'papan', 'renovasi kayu', 'kuda-kuda', 'rangka atap kayu', 'usuk', 'reng'],
            'Pekerjaan Atap'      => ['atap', 'genteng', 'spandek', 'bocor', 'talang', 'nok', 'lisplank'],
            'Pekerjaan Plafon'    => ['plafon', 'ceiling', 'gypsum', 'hollow', 'drop ceiling'],
            'Pekerjaan Lantai'    => ['lantai', 'keramik', 'granit', 'marmer', 'tegel', 'vinyl', 'flooring', 'paving', 'ubin'],
            'Pekerjaan Dinding'   => ['dinding', 'bata', 'hebel', 'batako', 'partisi', 'dinding ringan', 'dinding partisi'],
            'Pekerjaan Cat'       => ['cat', 'pengecatan', 'wallpaper', 'plamir', 'cat tembok', 'meni'],
            'Pekerjaan Sanitari'  => ['sanitari', 'kloset', 'toilet', 'wastafel', 'urinoir', 'pipa', 'kran', 'sumur', 'septic tank', 'grease trap'],
            'Pekerjaan Mekanikal' => ['mekanikal', 'ac', 'exhaust', 'fan', 'ducting', 'chiller', 'pump', 'pompa', 'blower', 'kompresor'],
            'Pekerjaan Elektrikal'=> ['elektrikal', 'listrik', 'kabel', 'lampu', 'panel', 'mdp', 'sdcp', 'stop kontak', 'saklar', 'mcb', 'mcbo', 'grounding', 'jitcom', 'cctv', 'titik'],
            'Pekerjaan Bongkar'   => ['bongkar', 'demolition', 'roboh', 'dismantle', 'pembongkaran'],
            'Pekerjaan Landscape' => ['landscape', 'taman', 'rumput', 'tanaman', 'pohon', 'siraman', 'sprinkle', 'pagar tanaman'],
            'Pekerjaan Mebelair'  => ['meja', 'kursi', 'lemari', 'mebel', 'furniture', 'pintu', 'jendela', 'kusen', 'rak', 'kabinet', 'wardrobe'],
        ];

        foreach ($rules as $category => $keywords) {
            foreach ($keywords as $kw) {
                if (str_contains($desc, $kw)) {
                    return $category;
                }
            }
        }

        return null; // Tidak cocok keyword manapun
    }
}