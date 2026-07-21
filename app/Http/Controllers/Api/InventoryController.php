<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InventoryStock;
use App\Models\RabBudget;
use App\Models\StockMovement;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class InventoryController extends Controller
{
    public function index(Request $request)
    {
        $query = InventoryStock::with(['project', 'rabBudget']);

        if ($projectId = $request->get('project_id')) {
            $query->where('project_id', $projectId);
        }
        if ($search = $request->get('search')) {
            $query->where('item_name', 'like', "%{$search}%");
        }

        // Low stock filter
        if ($request->boolean('low_stock')) {
            $query->whereColumn('quantity', '<=', 'min_quantity');
        }

        return response()->json([
            'success' => true,
            'data' => $query->orderBy('item_name')->paginate($request->get('per_page', 50)),
        ]);
    }

    public function receive(Request $request)
    {
        $request->validate([
            'project_id'      => 'required|exists:projects,id',
            'rab_budget_id'   => 'nullable|exists:rab_budgets,id',
            'item_name'       => 'required|string|max:255',
            'unit'            => 'nullable|string|max:50',
            'quantity'        => 'required|numeric|min:0.001',
            'location'        => 'nullable|string|max:255',
        ]);

        if ($request->rab_budget_id) {
            $rab = RabBudget::findOrFail($request->rab_budget_id);
            if ((int) $rab->project_id !== (int) $request->project_id) {
                return response()->json(['message' => 'Item RAB harus berasal dari proyek yang sama.'], 422);
            }
            if (! $rab->isMaterial()) {
                return response()->json([
                    'message' => 'Hanya RAB kategori Material yang dapat dicatat sebagai stok.',
                ], 422);
            }
        }

        $identity = ['project_id' => $request->project_id];
        if ($request->rab_budget_id) {
            $identity['rab_budget_id'] = $request->rab_budget_id;
        } else {
            $identity['item_name'] = $request->item_name;
            $identity['location'] = $request->location ?? 'Main';
        }

        $stock = InventoryStock::firstOrCreate($identity, [
            'item_name' => $request->item_name,
            'unit' => $request->unit ?? 'Pcs',
            'quantity' => 0,
            'min_quantity' => 0,
            'location' => $request->location ?? 'Main',
        ]);

        $stock->increment('quantity', $request->quantity);

        return response()->json([
            'success' => true,
            'data' => $stock,
            'message' => "Stok {$request->item_name} bertambah {$request->quantity} {$stock->unit}",
        ]);
    }

    /**
     * List stock movements for an inventory item.
     */
    public function movements(Request $request, InventoryStock $stock)
    {
        $stock->load('project:id,project_name');
        $movements = StockMovement::where('inventory_stock_id', $stock->id)
            ->with('creator')
            ->orderByDesc('created_at')
            ->paginate($request->get('per_page', 50));

        return response()->json([
            'success' => true,
            'stock_item' => [
                'id' => $stock->id,
                'item_name' => $stock->item_name,
                'quantity' => $stock->quantity,
                'min_quantity' => $stock->min_quantity,
                'unit' => $stock->unit,
                'location' => $stock->location,
                'project_name' => $stock->project?->project_name,
            ],
            'movements' => $movements->items(),
            'data' => $movements,
        ]);
    }

    /**
     * Manual stock adjustment with reason.
     */
    public function adjust(Request $request, InventoryStock $stock)
    {
        $validated = $request->validate([
            'type'     => 'required|in:increase,decrease',
            'quantity' => 'required|numeric|gt:0',
            'notes'    => 'required|string',
        ]);

        $quantity = (float) $validated['quantity'];
        $movementType = $validated['type'] === 'increase' ? 'in' : 'out';

        DB::transaction(function () use ($movementType, $quantity, $stock, $validated) {
            if ($movementType === 'in') {
                InventoryStock::whereKey($stock->id)->increment('quantity', $quantity);
            } else {
                $updated = InventoryStock::whereKey($stock->id)
                    ->where('quantity', '>=', $quantity)
                    ->decrement('quantity', $quantity);

                if ($updated === 0) {
                    throw ValidationException::withMessages([
                        'quantity' => 'Jumlah stok keluar melebihi stok yang tersedia.',
                    ]);
                }
            }

            StockMovement::create([
                'inventory_stock_id' => $stock->id,
                'type'               => $movementType,
                'quantity'           => $quantity,
                'notes'              => $validated['notes'],
                'created_by'         => Auth::id(),
            ]);
        });

        $stock->refresh();

        $action = $movementType === 'in' ? 'bertambah' : 'berkurang';

        return response()->json([
            'success' => true,
            'data'    => $stock,
            'message' => "Stok {$stock->item_name} {$action} sebanyak {$quantity} {$stock->unit}",
        ]);
    }
}
