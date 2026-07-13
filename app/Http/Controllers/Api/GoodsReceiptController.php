<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ApprovalLog;
use App\Models\GoodsReceipt;
use App\Models\GoodsReceiptItem;
use App\Models\InventoryStock;
use App\Models\PoItem;
use App\Models\PurchaseOrder;
use App\Models\RabBudget;
use App\Support\WorkflowState;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class GoodsReceiptController extends Controller
{
    public function index(Request $request)
    {
        $perPage = min($request->query('per_page', 15), 100);

        return response()->json(
            GoodsReceipt::with(['purchaseOrder.project', 'purchaseOrder.items', 'items.poItem'])->latest()->paginate($perPage)
        );
    }

    public function getByPo($poId)
    {
        return response()->json(
            GoodsReceipt::with('items.poItem')->where('purchase_order_id', $poId)->get()
        );
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'purchase_order_id' => 'required|exists:purchase_orders,id',
            'receipt_number' => 'required|string|unique:goods_receipts,receipt_number',
            'receipt_date' => 'required|date',
            'delivery_note_number' => 'nullable|string',
            'receiver_name' => 'required|string',
            'notes' => 'nullable|string',
            'items' => 'nullable|array|min:1',
            'items.*.po_item_id' => 'required_with:items|integer|exists:po_items,id',
            'items.*.quantity_received' => 'required_with:items|numeric|min:0.01',
        ]);

        $gr = DB::transaction(function () use ($validated, $request) {
            $po = PurchaseOrder::query()
                ->with('items.rabBudget')
                ->lockForUpdate()
                ->findOrFail($validated['purchase_order_id']);

            WorkflowState::require(
                $po->status,
                ['APPROVED', 'PARTIALLY_RECEIVED'],
                'Penerimaan barang hanya dapat dicatat untuk PO yang sudah disetujui atau diterima sebagian.'
            );

            $receiptItems = $this->resolveReceiptItems($po, $validated['items'] ?? []);
            if ($receiptItems === []) {
                WorkflowState::fail('Tidak ada sisa kuantitas PO yang dapat diterima.');
            }

            $receipt = GoodsReceipt::create(collect($validated)->except('items')->all());
            foreach ($receiptItems as $receiptItem) {
                GoodsReceiptItem::create([
                    'goods_receipt_id' => $receipt->id,
                    'po_item_id' => $receiptItem['po_item']->id,
                    'quantity_received' => $receiptItem['quantity_received'],
                ]);
                $this->increaseInventory($po, $receiptItem['po_item'], $receiptItem['quantity_received']);
            }

            $po->update(['status' => $this->poReceiptStatus($po)]);

            ApprovalLog::create([
                'record_type' => PurchaseOrder::class,
                'record_id' => $po->id,
                'user_id' => $request->user()?->id,
                'action' => 'RECEIVE',
                'notes' => "Penerimaan barang {$receipt->receipt_number}",
            ]);

            return $receipt;
        });

        return response()->json([
            'message' => $gr->purchaseOrder->status === 'RECEIVED'
                ? 'Penerimaan barang lengkap dan stok telah diperbarui.'
                : 'Penerimaan barang sebagian berhasil dicatat dan stok telah diperbarui.',
            'data' => $gr->load(['purchaseOrder', 'items.poItem']),
        ], 201);
    }

    /**
     * @param  array<int, array{po_item_id: int, quantity_received: numeric-string|float|int}>  $requestedItems
     * @return array<int, array{po_item: PoItem, quantity_received: float}>
     */
    private function resolveReceiptItems(PurchaseOrder $po, array $requestedItems): array
    {
        $receivedQuantities = GoodsReceiptItem::query()
            ->whereIn('po_item_id', $po->items->pluck('id'))
            ->selectRaw('po_item_id, SUM(quantity_received) AS quantity_received')
            ->groupBy('po_item_id')
            ->pluck('quantity_received', 'po_item_id');

        if ($requestedItems === []) {
            return $po->items
                ->map(function (PoItem $item) use ($receivedQuantities) {
                    $remaining = (float) $item->qty - (float) ($receivedQuantities[$item->id] ?? 0);

                    return $remaining > 0 ? [
                        'po_item' => $item,
                        'quantity_received' => $remaining,
                    ] : null;
                })
                ->filter()
                ->values()
                ->all();
        }

        $poItems = $po->items->keyBy('id');
        $normalized = [];
        foreach ($requestedItems as $requestedItem) {
            $poItem = $poItems->get($requestedItem['po_item_id']);
            if (! $poItem) {
                WorkflowState::fail('Item penerimaan harus berasal dari PO yang dipilih.');
            }

            $quantity = (float) $requestedItem['quantity_received'];
            $normalized[$poItem->id] = ($normalized[$poItem->id] ?? 0) + $quantity;
        }

        return collect($normalized)
            ->map(function (float $quantity, int $poItemId) use ($poItems, $receivedQuantities) {
                $poItem = $poItems->get($poItemId);
                $remaining = (float) $poItem->qty - (float) ($receivedQuantities[$poItemId] ?? 0);

                if ($quantity > $remaining) {
                    WorkflowState::fail("Jumlah penerimaan {$poItem->item_name} melebihi sisa PO.");
                }

                return ['po_item' => $poItem, 'quantity_received' => $quantity];
            })
            ->values()
            ->all();
    }

    private function poReceiptStatus(PurchaseOrder $po): string
    {
        $receivedQuantities = GoodsReceiptItem::query()
            ->whereIn('po_item_id', $po->items->pluck('id'))
            ->selectRaw('po_item_id, SUM(quantity_received) AS quantity_received')
            ->groupBy('po_item_id')
            ->pluck('quantity_received', 'po_item_id');

        return $po->items->every(
            fn (PoItem $item) => (float) ($receivedQuantities[$item->id] ?? 0) >= (float) $item->qty
        ) ? 'RECEIVED' : 'PARTIALLY_RECEIVED';
    }

    private function increaseInventory(PurchaseOrder $po, PoItem $poItem, float $quantity): void
    {
        $rabBudget = $poItem->rab_budget_id ? RabBudget::withTrashed()->find($poItem->rab_budget_id) : null;

        $stock = InventoryStock::query()
            ->where('project_id', $po->project_id)
            ->when($poItem->rab_budget_id, function ($q) use ($poItem) {
                return $q->where('rab_budget_id', $poItem->rab_budget_id);
            }, function ($q) use ($poItem) {
                return $q->whereNull('rab_budget_id')->where('item_name', $poItem->item_name);
            })
            ->lockForUpdate()
            ->first();

        if (! $stock) {
            $stock = InventoryStock::create([
                'project_id' => $po->project_id,
                'rab_budget_id' => $poItem->rab_budget_id,
                'item_name' => $poItem->item_name,
                'unit' => $rabBudget?->unit ?? 'Pcs',
                'quantity' => 0,
                'min_quantity' => 0,
                'location' => '-',
            ]);
        }

        $stock->increment('quantity', $quantity);
    }
}
