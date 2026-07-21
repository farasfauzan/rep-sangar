<?php

namespace App\Services;

class MimoAiService
{
    /**
     * Valid work category names (kategori pekerjaan).
     */
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

    /**
     * Resource type constants.
     */
    public const TYPE_MATERIAL = 'material';
    public const TYPE_UPAH     = 'upah';
    public const TYPE_JASA     = 'jasa';
    public const TYPE_ALAT     = 'alat';
    public const TYPE_LAINNYA  = 'lainnya';

    public function isConfigured(): bool
    {
        // Local classifier — always ready, no external API needed.
        return true;
    }

    /**
     * Classify a single description into a work category.
     */
    public function classify(string $description): ?string
    {
        if (trim($description) === '') {
            return null;
        }

        return $this->fallbackClassify($description);
    }

    /**
     * Classify multiple descriptions in batch.
     */
    public function classifyBatch(array $descriptions): array
    {
        return array_map(fn($d) => $this->fallbackClassify((string) $d), $descriptions);
    }

    /**
     * Detect resource type: material, upah (labor), jasa (subkon), alat (equipment).
     * Can optionally receive unit (satuan) for better accuracy.
     */
    public function detectResourceType(string $description, ?string $unit = null): string
    {
        $desc = strtolower(trim($description));
        $unit = strtolower(trim((string) $unit));

        // ── Unit-based detection (highest priority, very reliable) ──────────
        $laborUnits = ['oh', 'orang', 'org', 'orang/hari', 'oh/hari', 'hr', 'hk', 'hari kerja'];
        $equipUnits = ['jam alat', 'jam', 'unit/hari', 'trip', 'ritase', 'rit'];
        $serviceUnits = ['ls', 'lump sum', 'lumpsum', 'paket', 'pkt', 'set lengkap'];
        $materialUnits = [
            'kg', 'ton', 'm3', 'm2', 'm1', 'm\'', 'ltr', 'liter', 'sak', 'zak',
            'btg', 'batang', 'lembar', 'lbr', 'bh', 'buah', 'pcs', 'dus', 'rol',
            'galon', 'kaleng', 'drum', 'kubik', 'meter', 'lonjor', 'keping',
        ];

        if ($unit !== '') {
            foreach ($laborUnits as $u) {
                if ($unit === $u || str_contains($unit, $u)) {
                    return self::TYPE_UPAH;
                }
            }
            foreach ($equipUnits as $u) {
                if ($unit === $u || str_contains($unit, $u)) {
                    return self::TYPE_ALAT;
                }
            }
            foreach ($serviceUnits as $u) {
                if ($unit === $u || str_contains($unit, $u)) {
                    return self::TYPE_JASA;
                }
            }
            foreach ($materialUnits as $u) {
                if ($unit === $u || str_contains($unit, $u)) {
                    return self::TYPE_MATERIAL;
                }
            }
        }

        // ── Description-based detection ────────────────────────────────────
        $laborKeywords = [
            'upah', 'mandor', 'tukang', 'pekerja', 'helper', 'kepala tukang',
            'tenaga kerja', 'buruh', 'operator', 'sopir', 'supir', 'satpam',
            'penjaga', 'kebersihan', 'cleaning service', 'security',
        ];
        $equipKeywords = [
            'sewa', 'rental', 'excavator', 'bulldozer', 'crane', 'dump truck',
            'mixer truck', 'vibrator', 'stamper', 'genset', 'pompa beton',
            'concrete pump', 'scaffolding', 'bekisting sistem', 'alat berat',
            'theodolit', 'waterpass', 'jack hammer', 'compressor',
            'truck', 'truk', 'forklift', 'backhoe', 'wheel loader',
        ];
        $serviceKeywords = [
            'borongan', 'subkon', 'sub kontraktor', 'jasa', 'kontrak',
            'paket pekerjaan', 'lump sum', 'turnkey',
            'pemasangan', 'instalasi', 'pengerjaan', 'pekerjaan',
        ];

        // Score-based: labor and equipment keywords are checked with priority
        $laborScore = 0;
        foreach ($laborKeywords as $kw) {
            if (str_contains($desc, $kw)) {
                $laborScore += strlen($kw);
            }
        }

        $equipScore = 0;
        foreach ($equipKeywords as $kw) {
            if (str_contains($desc, $kw)) {
                $equipScore += strlen($kw);
            }
        }

        $serviceScore = 0;
        foreach ($serviceKeywords as $kw) {
            if (str_contains($desc, $kw)) {
                $serviceScore += strlen($kw);
            }
        }

        $maxScore = max($laborScore, $equipScore, $serviceScore);

        if ($maxScore > 0) {
            if ($laborScore === $maxScore) return self::TYPE_UPAH;
            if ($equipScore === $maxScore) return self::TYPE_ALAT;
            return self::TYPE_JASA;
        }

        // Default: assume material if nothing else matches
        return self::TYPE_MATERIAL;
    }

    /**
     * Score-based keyword classifier for work category.
     *
     * Improvements over the old first-match approach:
     * 1. Scores ALL categories and picks the highest — no more "cat besi" → Cat bug
     * 2. Longer keyword matches score higher (compound phrases beat single words)
     * 3. 200+ keywords covering real Indonesian construction RAB terminology
     */
    public function fallbackClassify(string $description): ?string
    {
        $desc = strtolower(trim($description));
        if ($desc === '') {
            return null;
        }

        $categories = [
            'Pekerjaan Persiapan' => [
                'pembersihan', 'clearing', 'pemotongan pohon', 'pemagaran', 'hoarding',
                'mobilisasi', 'demobilisasi', 'papan nama', 'barak', 'gudang',
                'direksi keet', 'persiapan', 'survey', 'pengukuran', 'emarking',
                'plang proyek', 'keamanan proyek', 'pagar proyek', 'p3k',
                'scaffolding', 'steger', 'andang', 'pengadaan',
            ],
            'Pekerjaan Tanah' => [
                'galian', 'urugan', 'tanah', 'cut and fill', 'timbunan', 'pemadatan',
                'tanah urug', 'sirtu', 'screeding', 'grading', 'excavation',
                'gali tanah', 'urug tanah', 'tanah merah', 'tanah biasa', 'pasir urug',
                'pembuangan tanah', 'boring', 'bor pile', 'leveling', 'landfill',
                'subgrade', 'subbase', 'base course',
                'excavator', 'backhoe', 'bulldozer', 'wheel loader',
            ],
            'Pekerjaan Pondasi' => [
                'pondasi', 'footplate', 'foot plat', 'bored pile', 'tiang pancang',
                'sumuran', 'straus', 'pile cap', 'sloof', 'balok sloof',
                'anak tiang', 'piles', 'spun pile', 'mini pile', 'cerucuk',
                'strauss pile', 'cakar ayam', 'pilecap',
            ],
            'Pekerjaan Beton' => [
                'beton', 'cor', 'readymix', 'ready mix', 'mutu beton', 'bekisting',
                'begisting', 'balok', 'kolom', 'plat lantai', 'ring balk',
                'ringbalok', 'kolom praktis', 'tangga beton', 'dak beton',
                'struktur beton', 'adukan beton', 'screed', 'pengecoran',
                'mutu k-', 'mutu k ', 'concrete', 'agregat', 'semen', 'mortar',
                'grouting', 'precast', 'u-ditch', 'box culvert',
            ],
            'Pekerjaan Batu' => [
                'batu bata', 'pasangan batu', 'bata ringan', 'bata merah', 'batako',
                'hebel', 'bata expose', 'batu alam', 'batu kali', 'batu pondasi',
                'plesteran', 'acian', 'bronjong', 'gabion', 'batu belah',
                'batu gunung', 'andesit',
            ],
            'Pekerjaan Besi' => [
                'besi beton', 'besi ulir', 'besi polos', 'besi siku',
                'besi', 'steel', 'baja', 'reinforcement', 'tulangan', 'sengkang',
                'begel', 'wiremesh', 'wire mesh', 'dowel', 'anchor bolt',
                'hollow', 'kanal', 'cnp', 'wf', 'h-beam', 'i-beam',
                'plat besi', 'plat baja', 'rangka baja', 'struktur baja',
                'baja ringan', 'railing', 'handrail', 'pipa besi',
                'angle bar', 'flat bar', 'round bar',
            ],
            'Pekerjaan Kayu' => [
                'kayu', 'wood', 'papan kayu', 'multipleks', 'triplek', 'plywood',
                'kasau', 'reng kayu', 'balok kayu', 'kosen', 'kusen',
                'daun pintu', 'daun jendela', 'lambersering', 'parquet', 'parket',
                'lantai kayu', 'decking', 'usuk', 'kuda-kuda', 'rangka atap kayu',
            ],
            'Pekerjaan Atap' => [
                'atap', 'genteng', 'seng', 'spandek', 'trimdek', 'roofing',
                'atap seng', 'atap beton', 'atap metal', 'atap zincalume',
                'atap upvc', 'atap polycarbonate', 'talang', 'nok', 'lisplank',
                'karpus', 'atap sirap', 'atap rumbia', 'bubungan',
            ],
            'Pekerjaan Plafon' => [
                'plafon', 'ceiling', 'gypsum', 'gipsum', 'rangka plafon',
                'pvc plafon', 'akustik', 'acoustic', 'fiber ceiling',
                'kalsiboard', 'grc board', 'rangka hollow plafon', 'drop ceiling',
            ],
            'Pekerjaan Lantai' => [
                'keramik', 'granit', 'marmer', 'ubin', 'lantai', 'flooring',
                'homogeneous', 'vinyl', 'epoxy lantai', 'penutup lantai',
                'nat keramik', 'skirting', 'plint', 'mozaik', 'teraso',
                'paving', 'kanstin', 'conblock', 'tegel',
            ],
            'Pekerjaan Dinding' => [
                'dinding', 'tembok', 'wall', 'partisi dinding', 'cladding',
                'dinding kaca', 'curtain wall', 'facades', 'panel dinding',
                'acp', 'aluminium composite', 'kaca', 'glass block',
            ],
            'Pekerjaan Cat' => [
                'cat tembok', 'cat minyak', 'cat besi', 'cat kayu', 'cat dinding',
                'pengecatan', 'mengecat', 'dempul', 'plamir', 'plamur',
                'wallpaper', 'wallcovering', 'anti bocor', 'waterproofing',
                'melamic', 'vernis', 'politur', 'coating', 'finishing cat',
            ],
            'Pekerjaan Sanitari' => [
                'sanitari', 'sanitary', 'closet', 'toilet', 'kloset', 'urinoir',
                'wastafel', 'shower', 'bak mandi', 'kran', 'faucet',
                'saluran air', 'pipa air', 'plumbing', 'drainase',
                'floor drain', 'grease trap', 'septictank', 'septic tank',
                'sumur resapan', 'toren', 'tangki air', 'pompa air',
            ],
            'Pekerjaan Mekanikal' => [
                'mekanikal', 'air conditioning', 'hvac', 'ahu', 'fcu',
                'kompresor', 'chiller', 'cooling tower', 'ventilasi',
                'exhaust fan', 'ducting', 'instalasi gas', 'fire hydrant',
                'sprinkler', 'pompa kebakaran', 'fm 200', 'alat pemadam',
                'lift', 'elevator', 'escalator', 'blower',
                'ac split', 'ac cassette', 'ac central', 'ac standing',
            ],
            'Pekerjaan Elektrikal' => [
                'elektrikal', 'listrik', 'kabel', 'instalasi listrik', 'mcb',
                'panel listrik', 'lampu', 'lighting', 'led', 'saklar',
                'stop kontak', 'kotak saklar', 'sekring', 'kapasitor',
                'transformator', 'trafo', 'ats', 'kapasitor bank',
                'grounding', 'penangkal petir', 'lightning protection',
                'cctv', 'fire alarm', 'bell', 'intercom', 'sound system',
                'data', 'network', 'fiber optic', 'structured cabling',
                'titik lampu', 'titik stop kontak',
            ],
            'Pekerjaan Bongkar' => [
                'bongkar', 'demolition', 'pembongkaran', 'peruntuhan',
                'dismantle', 'robohkan',
            ],
            'Pekerjaan Landscape' => [
                'landscape', 'taman', 'tanaman', 'rumput', 'pohon',
                'perkerasan', 'jalan taman', 'pot tanaman', 'irrigasi taman',
                'gazebo', 'pergola', 'carport', 'pagar taman', 'gerbang',
                'saluran taman', 'pagar besi taman',
            ],
            'Pekerjaan Mebelair' => [
                'mebelair', 'meubel', 'furniture', 'lemari', 'meja', 'kursi',
                'rak', 'kitchen set', 'backdrop', 'counter', 'display',
                'kabinet', 'wardrobe', 'credenza', 'nakas', 'buffet',
            ],
        ];

        // ── Score every category: longer keyword match = higher relevance ──
        $scores = [];
        foreach ($categories as $catName => $keywords) {
            $score = 0;
            foreach ($keywords as $kw) {
                if (str_contains($desc, $kw)) {
                    $score += strlen($kw);
                }
            }
            if ($score > 0) {
                $scores[$catName] = $score;
            }
        }

        if (empty($scores)) {
            return null;
        }

        // Highest total score wins
        arsort($scores);

        return array_key_first($scores);
    }
}