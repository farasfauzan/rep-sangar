<?php
namespace App\Jobs;

use App\Models\RabBudget;
use App\Services\MimoAiService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class ClassifyRabAiJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $projectId;
    public int $version;
    public int $offset;
    public int $limit;

    public function __construct(int $projectId, int $version, int $offset = 0, int $limit = 100)
    {
        $this->projectId = $projectId;
        $this->version = $version;
        $this->offset = $offset;
        $this->limit = $limit;
    }

    public function handle(): void
    {
        $mimo = app(MimoAiService::class);
        if (! $mimo->isConfigured()) {
            return;
        }

        $items = RabBudget::where('project_id', $this->projectId)
            ->where('version', $this->version)
            ->whereNull('ai_category')
            ->skip($this->offset)
            ->take($this->limit)
            ->get(['id', 'description']);

        if ($items->isEmpty()) {
            return;
        }

        $descriptions = $items->pluck('description')->toArray();
        try {
            $categories = $mimo->classifyBatch($descriptions);
        } catch (\Throwable $e) {
            Log::warning('ClassifyRabAiJob batch failed', [
                'project_id' => $this->projectId,
                'version' => $this->version,
                'error' => $e->getMessage(),
            ]);
            // Jangan lempar exception supaya import utama tidak gagal
            return;
        }

        $updates = [];
        foreach ($items as $i => $item) {
            $cat = $categories[$i] ?? null;
            if ($cat !== null) {
                $updates[$cat][] = $item->id;
            }
        }

        foreach ($updates as $category => $ids) {
            RabBudget::whereIn('id', $ids)->update(['ai_category' => $category]);
        }

        Log::info('ClassifyRabAiJob completed', [
            'project_id' => $this->projectId,
            'version' => $this->version,
            'offset' => $this->offset,
            'processed' => $items->count(),
        ]);
    }
}
