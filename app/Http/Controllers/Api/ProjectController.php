<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use Illuminate\Http\Request;

class ProjectController extends Controller
{
    public function index(Request $request)
    {
        $perPage = min($request->query('per_page', 15), 100);
        $projects = Project::select('id', 'project_name', 'location', 'start_date', 'status')
            ->orderBy('id', 'desc')
            ->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $projects,
        ]);
    }

    public function show($id)
    {
        $project = Project::with(['rabBudgets' => function ($q) {
            $q->select('id', 'project_id', 'code_item', 'description', 'total_price', 'category', 'status', 'version')
                ->where('status', '!=', 'ARCHIVED')
                ->latest('version');
        }])->findOrFail($id);

        return response()->json([
            'success' => true,
            'data' => $project,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'project_name' => 'required|string|max:255',
            'location' => 'required|string|max:255',
            'start_date' => 'required|date',
        ]);

        $project = Project::create($validated);

        return response()->json([
            'success' => true,
            'message' => 'Proyek baru berhasil dibuat.',
            'data' => $project,
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $project = Project::findOrFail($id);

        $validated = $request->validate([
            'project_name' => 'sometimes|required|string|max:255',
            'location' => 'sometimes|nullable|string|max:255',
            'start_date' => 'sometimes|nullable|date',
            'status' => 'sometimes|in:planning,active,completed,on_hold,cancelled',
        ]);

        $project->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Proyek berhasil diperbarui.',
            'data' => $project->fresh(),
        ]);
    }
}
