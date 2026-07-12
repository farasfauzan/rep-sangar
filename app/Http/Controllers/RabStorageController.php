<?php
namespace App\Http\Controllers;

use App\Models\Project;
use App\Models\RabBudget;
use App\Models\RabImportJob;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

class RabStorageController extends Controller
{
    public function index(Request $request)
    {
        $projectId = $request->get('project_id');

        $projects = Project::select('id', 'project_name', 'location', 'status', 'created_at')
            ->orderBy('project_name')
            ->get();

        $project = $projectId
            ? Project::select('id', 'project_name', 'location', 'status')->find($projectId)
            : null;

        $importJobs = RabImportJob::with('project:id,project_name')
            ->when($projectId, fn($q) => $q->where('project_id', $projectId))
            ->orderByDesc('created_at')
            ->paginate(15)
            ->through(fn($job) => [
                'id' => $job->id,
                'project_id' => $job->project_id,
                'project_name' => $job->project?->project_name ?? 'Proyek #' . $job->project_id,
                'file_name' => $job->file_name,
                'file_type' => $job->file_type,
                'status' => $job->status,
                'total_rows' => $job->total_rows,
                'processed_rows' => $job->processed_rows,
                'errors' => $job->errors ?: [],
                'diff' => $job->diff ?: null,
                'created_at' => $job->created_at?->toISOString(),
                'updated_at' => $job->updated_at?->toISOString(),
                'download_url' => $this->downloadUrl($job),
            ]);

        $budgets = $project
            ? RabBudget::where('project_id', $projectId)
                ->where('version', RabBudget::where('project_id', $projectId)->max('version') ?? 1)
                ->orderBy('id')
                ->paginate(50)
                ->through(fn($item) => [
                    'id' => $item->id,
                    'code_item' => $item->code_item,
                    'description' => $item->description,
                    'unit' => $item->unit,
                    'volume' => $item->volume,
                    'unit_price' => $item->unit_price,
                    'total_price' => $item->total_price,
                    'category' => $item->category,
                    'ai_category' => $item->ai_category,
                    'status' => $item->status,
                    'version' => $item->version,
                    'created_at' => $item->created_at?->toISOString(),
                ])
            : null;

        $totals = $project
            ? [
                'total_items' => RabBudget::where('project_id', $projectId)
                    ->where('version', RabBudget::where('project_id', $projectId)->max('version') ?? 1)
                    ->count(),
                'total_budget' => (float) RabBudget::where('project_id', $projectId)
                    ->where('version', RabBudget::where('project_id', $projectId)->max('version') ?? 1)
                    ->sum('total_price'),
                'versions' => RabBudget::where('project_id', $projectId)
                    ->select('version')
                    ->distinct()
                    ->orderByDesc('version')
                    ->pluck('version')
                    ->toArray(),
            ]
            : null;

        return Inertia::render('RabStorage', [
            'projects' => $projects,
            'selectedProject' => $project,
            'importJobs' => $importJobs,
            'budgets' => $budgets,
            'totals' => $totals,
            'storage' => [
                'disk' => config('filesystems.default'),
                'path' => 'imports',
                'description' => 'File RAB disimpan di storage/app/private/imports',
            ],
        ]);
    }

    public function download(RabImportJob $job)
    {
        if (! $job->file_path || ! Storage::exists($job->file_path)) {
            abort(404, 'File tidak ditemukan.');
        }

        return Storage::download($job->file_path, $job->file_name);
    }

    private function downloadUrl(RabImportJob $job): ?string
    {
        if (! $job->file_path || ! Storage::exists($job->file_path)) {
            return null;
        }

        return route('rab-storage.download', $job);
    }
}
