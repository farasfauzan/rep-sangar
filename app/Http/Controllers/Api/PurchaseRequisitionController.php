<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PurchaseRequisition;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class PurchaseRequisitionController extends Controller
{
    public function index(Request $request)
    {
        $query = PurchaseRequisition::with(['project', 'rabBudget', 'requester', 'approver']);

        if ($pid = $request->get('project_id')) {
            $query->where('project_id', $pid);
        }
        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }

        return response()->json([
            'success' => true,
            'data' => $query->latest()->paginate($request->get('per_page', 50)),
        ]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'project_id'    => 'required|exists:projects,id',
            'rab_budget_id' => 'nullable|exists:rab_budgets,id',
            'item_name'     => 'required|string|max:255',
            'unit'          => 'nullable|string|max:50',
            'qty_requested' => 'required|numeric|min:0.01',
            'notes'         => 'nullable|string',
        ]);

        $pr = PurchaseRequisition::create([
            ...$request->only(['project_id', 'rab_budget_id', 'item_name', 'unit', 'qty_requested', 'notes']),
            'requested_by' => Auth::id(),
            'pr_number'    => 'PR-' . date('Ymd') . '-' . str_pad(PurchaseRequisition::withTrashed()->max('id') + 1, 4, '0', STR_PAD_LEFT),
            'status'       => 'PENDING',
        ]);

        return response()->json(['success' => true, 'data' => $pr], 201);
    }

    public function show($id)
    {
        $pr = PurchaseRequisition::with(['project', 'rabBudget', 'requester', 'approver'])->findOrFail($id);
        return response()->json(['success' => true, 'data' => $pr]);
    }

    public function approve(Request $request, $id)
    {
        $pr = PurchaseRequisition::lockForUpdate()->findOrFail($id);

        if ($pr->status !== 'PENDING') {
            return response()->json([
                'success' => false,
                'message' => "Purchase Requisition tidak dapat di-approve. Status saat ini: {$pr->status}.",
            ], 422);
        }

        $pr->approve(Auth::user(), $request->get('qty_approved'));
        return response()->json(['success' => true, 'data' => $pr]);
    }

    public function reject(Request $request, $id)
    {
        $pr = PurchaseRequisition::lockForUpdate()->findOrFail($id);

        if ($pr->status !== 'PENDING') {
            return response()->json([
                'success' => false,
                'message' => "Purchase Requisition tidak dapat di-reject. Status saat ini: {$pr->status}.",
            ], 422);
        }

        $pr->reject(Auth::user(), $request->get('reason'));
        return response()->json(['success' => true, 'data' => $pr]);
    }
}