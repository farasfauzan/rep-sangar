<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ApprovalLog;
use App\Models\PurchaseOrder;
use App\Models\PoItem;
use App\Models\RabBudget;
use App\Support\WorkflowState;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PurchaseOrderController extends Controller
{
    public function index()
    {
        return response()->json(PurchaseOrder::with(['project', 'items.rabBudget'])->get());
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'project_id' => 'required|exists:projects,id',
            'po_number' => 'required|string|unique:purchase_orders,po_number',
            'date' => 'required|date',
            'supplier_name' => 'required|string',
            'payment_terms' => 'nullable|string',
            'items' => 'required|array',
            'items.*.rab_budget_id' => 'required|exists:rab_budgets,id',
            'items.*.item_name' => 'required|string',
            'items.*.qty' => 'required|numeric|min:0',
            'items.*.unit_price' => 'required|numeric|min:0',
        ]);

        $budgetIds = collect($validated['items'])->pluck('rab_budget_id')->unique();
        $matchingBudgetCount = RabBudget::query()
            ->where('project_id', $validated['project_id'])
            ->whereIn('id', $budgetIds)
            ->count();

        if ($matchingBudgetCount !== $budgetIds->count()) {
            return response()->json([
                'message' => 'Setiap item PO harus berasal dari RAB pada proyek yang sama.',
            ], 422);
        }

        $approvedBudgetCount = RabBudget::query()
            ->where('project_id', $validated['project_id'])
            ->whereIn('id', $budgetIds)
            ->where('status', RabBudget::STATUS_APPROVED)
            ->count();

        if ($approvedBudgetCount !== $budgetIds->count()) {
            return response()->json([
                'message' => 'PO hanya dapat dibuat dari item RAB yang sudah disetujui.',
            ], 422);
        }

        try {
            $po = DB::transaction(function () use ($validated, $request) {
                $po = PurchaseOrder::create([
                'project_id' => $validated['project_id'],
                'po_number' => $validated['po_number'],
                'date' => $validated['date'],
                'supplier_name' => $validated['supplier_name'],
                'payment_terms' => $validated['payment_terms'],
                'status' => 'DRAFT',
                'created_by' => $request->user()->id ?? 1,
                ]);

                $subtotal = 0;
                foreach ($validated['items'] as $item) {
                    $totalPrice = $item['qty'] * $item['unit_price'];
                    $subtotal += $totalPrice;

                    PoItem::create([
                        'purchase_order_id' => $po->id,
                        'rab_budget_id' => $item['rab_budget_id'],
                        'item_name' => $item['item_name'],
                        'qty' => $item['qty'],
                        'unit_price' => $item['unit_price'],
                        'total_price' => $totalPrice,
                    ]);
                }

                $tax = $subtotal * 0.11;
                $po->update([
                    'subtotal' => $subtotal,
                    'tax_amount' => $tax,
                    'total_amount' => $subtotal + $tax,
                ]);

                return $po;
            });

            return response()->json([
                'message' => 'Draft Purchase Order (PO) berhasil dibuat.',
                'data' => $po->load('items')
            ], 201);
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Gagal membuat PO.', 'error' => $e->getMessage()], 500);
        }
    }

    public function submit(Request $request, $id)
    {
        $po = DB::transaction(function () use ($request, $id) {
            $po = PurchaseOrder::lockForUpdate()->findOrFail($id);
            WorkflowState::require(
                $po->status,
                ['DRAFT'],
                'Hanya PO berstatus DRAFT yang dapat dikirim untuk approval.'
            );
            $po->update(['status' => 'PENDING_APPROVAL']);
            $this->log($request, $po, 'SUBMIT');
            return $po;
        });

        return response()->json(['message' => 'PO dikirim untuk approval.', 'data' => $po]);
    }

    public function approve(Request $request, $id)
    {
        $po = DB::transaction(function () use ($request, $id) {
            $po = PurchaseOrder::lockForUpdate()->findOrFail($id);
            WorkflowState::require(
                $po->status,
                ['PENDING_APPROVAL'],
                'PO harus berstatus PENDING_APPROVAL sebelum disetujui.'
            );
            $po->update([
                'status' => 'APPROVED',
                'approved_by' => $request->user()->id ?? 1,
            ]);
            $this->log($request, $po, 'APPROVE');
            return $po;
        });

        return response()->json(['message' => 'PO disetujui.', 'data' => $po]);
    }

    public function reject(Request $request, $id)
    {
        $po = DB::transaction(function () use ($request, $id) {
            $po = PurchaseOrder::lockForUpdate()->findOrFail($id);
            WorkflowState::require(
                $po->status,
                ['PENDING_APPROVAL'],
                'PO harus berstatus PENDING_APPROVAL sebelum ditolak.'
            );
            $po->update(['status' => 'REJECTED']);
            $this->log($request, $po, 'REJECT', $request->input('notes'));
            return $po;
        });

        return response()->json(['message' => 'PO ditolak.', 'data' => $po]);
    }

    private function log(Request $request, PurchaseOrder $po, string $action, ?string $notes = null): void
    {
        ApprovalLog::create([
            'record_type' => PurchaseOrder::class,
            'record_id' => $po->id,
            'user_id' => $request->user()->id ?? 1,
            'action' => $action,
            'notes' => $notes,
        ]);
    }
}