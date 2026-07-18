<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $rows = DB::table('rab_budgets')
            ->where('code_item', 'like', 'MANUAL-%')
            ->orderBy('project_id')
            ->orderBy('version')
            ->orderBy('id')
            ->get(['id', 'project_id', 'version', 'code_item', 'category']);

        $usedByVersion = [];

        foreach ($rows as $row) {
            $bucket = $row->project_id.'|'.$row->version;
            if (! isset($usedByVersion[$bucket])) {
                $usedByVersion[$bucket] = DB::table('rab_budgets')
                    ->where('project_id', $row->project_id)
                    ->where('version', $row->version)
                    ->where('code_item', 'not like', 'MANUAL-%')
                    ->pluck('code_item')
                    ->mapWithKeys(fn ($code): array => [mb_strtoupper((string) $code) => true])
                    ->all();
            }

            $baseCategory = mb_strtolower(trim(explode(' / ', (string) $row->category, 2)[0]));
            $prefix = match ($baseCategory) {
                'material' => 'MAT',
                'subkon' => 'SUB',
                'pekerja', 'upah' => 'PKJ',
                'alat' => 'ALT',
                default => 'ITM',
            };
            preg_match('/(\d+)$/', (string) $row->code_item, $matches);
            $sequence = max(1, (int) ($matches[1] ?? $row->id));
            $code = sprintf('RAB-%s-%04d', $prefix, $sequence);

            while (isset($usedByVersion[$bucket][mb_strtoupper($code)])) {
                $code = sprintf('RAB-%s-%04d', $prefix, ++$sequence);
            }

            DB::table('rab_budgets')->where('id', $row->id)->update(['code_item' => $code]);
            $usedByVersion[$bucket][mb_strtoupper($code)] = true;
        }
    }

    public function down(): void
    {
        // The old MANUAL-* value did not contain enough source information
        // to restore it safely without risking newer, valid RAB codes.
    }
};
