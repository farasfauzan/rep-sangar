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
use App\Models\StockMovement;
use App\Support\WorkflowState;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class GoodsReceiptController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = min($request->query('per_page', 15), 100);

        return response()->json(
            GoodsReceipt::with(['purchaseOrder.project', 'purchaseOrder.items', 'items.poItem'])->latest()->paginate($perPage)
        );
    }

    public function getByPo(int $poId): JsonResponse
    {
        return response()->json(
            GoodsReceipt::with('items.poItem')->where('purchase_order_id', $poId)->get()
        );
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'purchase_order_id' => 'required|exists:purchase_orders,id',
            'receipt_number' => 'required|string|unique:goods_receipts,receipt_number',
            'receipt_date' => 'required|date',
            'delivery_note_number' => 'nullable|string',
            'receiver_name' => 'required|string',
            'notes' => 'nullable|string',
            // PERBAIKAN: Diwajibkan (required). Tidak boleh ada penerimaan otomatis (gaib).
            'items' => 'required|array|min:1',
            'items.*.po_item_id' => 'required|integer|exists:po_items,id',
            'items.*.quantity_received' => 'required|numeric|min:0.01',
        ]);

        $gr = DB::transaction(function () use ($validated) {
            $po = PurchaseOrder::query()
                ->with('items.rabBudget')
                ->lockForUpdate()
                ->findOrFail($validated['purchase_order_id']);

            WorkflowState::require(
                $po->status,
                ['APPROVED', 'PARTIALLY_RECEIVED'],
                'Penerimaan barang hanya dapat dicatat untuk PO yang sudah disetujui atau diterima sebagian.'
            );

            $receiptItems = $this->resolveReceiptItems($po, $validated['items']);
            if ($receiptItems === []) {
                WorkflowState::fail('Data item penerimaan tidak valid atau kuantitas sisa sudah habis.');
            }
            
            foreach ($receiptItems as $receiptItem) {
                $rab = $receiptItem['po_item']->rabBudget;
                if (! $rab || ! $rab->isMaterial()) {
                    WorkflowState::fail('Penerimaan barang hanya untuk item RAB kategori Material. Subkon, Pekerja, dan Alat diproses melalui SPK/Opname.');
                }
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
                'user_id' => Auth::id() ?? 1,
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

        $poItems = $po->items->keyBy('id');
        $normalized = [];
        
        foreach ($requestedItems as $requestedItem) {
            $poItem = $poItems->get($requestedItem['po_item_id']);
            if (! $poItem) {
                WorkflowState::fail('Item penerimaan harus berasal dari PO yang dipilih.');
            }

            // PERBAIKAN: Menggunakan pembulatan 4 desimal untuk mencegah error komparasi Float di PHP
            $quantity = round((float) $requestedItem['quantity_received'], 4);
            $normalized[$poItem->id] = ($normalized[$poItem->id] ?? 0) + $quantity;
        }

        return collect($normalized)
            ->map(function (float $quantity, int $poItemId) use ($poItems, $receivedQuantities) {
                $poItem = $poItems->get($poItemId);
                $remaining = round((float) $poItem->qty - (float) ($receivedQuantities[$poItemId] ?? 0), 4);

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
            fn (PoItem $item) => round((float) ($receivedQuantities[$item->id] ?? 0), 4) >= round((float) $item->qty, 4)
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

        // PERBAIKAN: Suntikkan pencatatan historis StockMovement agar sesuai dengan InventoryController
        StockMovement::create([
            'inventory_stock_id' => $stock->id,
            'type' => 'in',
            'quantity' => $quantity,
            'notes' => "Penerimaan Material dari PO: {$po->po_number}",
            'created_by' => Auth::id() ?? 1,
        ]);
    }
}