<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    public function index(Request $request)
    {
        $query = AuditLog::with('user');

        if ($type = $request->get('auditable_type')) {
            $query->where('auditable_type', $type);
        }
        if ($recordId = $request->get('auditable_id')) {
            $query->where('auditable_id', $recordId);
        }
        if ($userId = $request->get('user_id')) {
            $query->where('user_id', $userId);
        }
        if ($action = $request->get('action')) {
            $query->where('action', $action);
        }

        return response()->json([
            'success' => true,
            'data' => $query->latest()->paginate($request->get('per_page', 50)),
        ]);
    }
}