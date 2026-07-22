<?php

namespace Tests\Feature\Api;

use App\Models\GoodsReceipt;
use App\Models\InventoryStock;
use App\Models\PoItem;
use App\Models\PurchaseOrder;
use App\Models\RabBudget;

class GoodsReceiptControllerTest extends TestCase
{
    // ─── INDEX ────────────────────────────────────────────────────────────

    public function test_index_returns_paginated_goods_receipts(): void
    {
        $this->actingAsRole('LAPANGAN');
        GoodsReceipt::factory()->count(3)->create();

        $this->getJson('/api/goods-receipts')
            ->assertOk()
            ->assertJsonStructure([
                'current_page',
                'data',
                'per_page',
                'total',
            ]);
    }

    public function test_engineer_cannot_view_goods_receipts(): void
    {
        $this->actingAsRole('ENGINEER');

        $this->getJson('/api/goods-receipts')
            ->assertForbidden();
    }

    // ─── STORE (FULL RECEIVE) ─────────────────────────────────────────────

    public function test_lapangan_can_create_goods_receipt(): void
    {
        $user = $this->actingAsRole('LAPANGAN');
        $po = PurchaseOrder::factory()->approved()->create();
        $rab = RabBudget::factory()->approved()->create(['project_id' => $po->project_id]);
        $poItem = PoItem::factory()->create([
            'purchase_order_id' => $po->id,
            'rab_budget_id'     => $rab->id,
            'qty'               => 10,
            'unit_price'        => 10000,
            'total_price'       => 100000,
        ]);

        $this->postJson('/api/goods-receipts', [
            'purchase_order_id'    => $po->id,
            'receipt_number'       => 'GR-TEST-001',
            'receipt_date'         => '2026-07-10',
            'delivery_note_number' => 'SJ-001',
            'receiver_name'        => 'Petugas',
            'items'                => [['po_item_id' => $poItem->id, 'quantity_received' => 10]], // Perbaikan
        ])
            ->assertCreated()
            ->assertJsonPath('data.receipt_number', 'GR-TEST-001');

        $this->assertDatabaseHas('goods_receipts', [
            'receipt_number' => 'GR-TEST-001',
        ]);
    }

    public function test_store_validates_required_fields(): void
    {
        $this->actingAsRole('LAPANGAN');

        $this->postJson('/api/goods-receipts', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors([
                'purchase_order_id',
                'receipt_number',
                'receipt_date',
                'receiver_name',
                'items', // Perbaikan
            ]);
    }

    // ─── PARTIAL RECEIVE ──────────────────────────────────────────────────

    public function test_partial_receive_updates_inventory_and_po_status(): void
    {
        $user = $this->actingAsRole('LAPANGAN');
        $po = PurchaseOrder::factory()->approved()->create();
        $rab = RabBudget::factory()->approved()->create(['project_id' => $po->project_id]);
        $poItem = PoItem::factory()->create([
            'purchase_order_id' => $po->id,
            'rab_budget_id'     => $rab->id,
            'qty'               => 10,
            'unit_price'        => 10000,
            'total_price'       => 100000,
        ]);

        // Partial receive: 4 out of 10
        $this->postJson('/api/goods-receipts', [
            'purchase_order_id' => $po->id,
            'receipt_number'    => 'GR-PARTIAL-001',
            'receipt_date'      => '2026-07-10',
            'receiver_name'     => 'Petugas',
            'items'             => [[
                'po_item_id'        => $poItem->id,
                'quantity_received' => 4,
            ]],
        ])->assertCreated();

        $this->assertDatabaseHas('purchase_orders', [
            'id'     => $po->id,
            'status' => 'PARTIALLY_RECEIVED',
        ]);
        $this->assertDatabaseHas('inventory_stocks', [
            'project_id'   => $po->project_id,
            'rab_budget_id' => $rab->id,
            'quantity'     => 4,
        ]);

        // Complete receive: remaining 6
        $this->postJson('/api/goods-receipts', [
            'purchase_order_id' => $po->id,
            'receipt_number'    => 'GR-PARTIAL-002',
            'receipt_date'      => '2026-07-10',
            'receiver_name'     => 'Petugas',
            'items'             => [[
                'po_item_id'        => $poItem->id,
                'quantity_received' => 6,
            ]],
        ])->assertCreated();

        $this->assertDatabaseHas('purchase_orders', [
            'id'     => $po->id,
            'status' => 'RECEIVED',
        ]);
        $this->assertSame(10.0, (float) InventoryStock::firstOrFail()->quantity);
    }

    public function test_cannot_receive_more_than_po_qty(): void
    {
        $user = $this->actingAsRole('LAPANGAN');
        $po = PurchaseOrder::factory()->approved()->create();
        $poItem = PoItem::factory()->create([
            'purchase_order_id' => $po->id,
            'qty'               => 5,
            'unit_price'        => 10000,
            'total_price'       => 50000,
        ]);

        $this->postJson('/api/goods-receipts', [
            'purchase_order_id' => $po->id,
            'receipt_number'    => 'GR-OVER-001',
            'receipt_date'      => '2026-07-10',
            'receiver_name'     => 'Petugas',
            'items'             => [[
                'po_item_id'        => $poItem->id,
                'quantity_received' => 10,
            ]],
        ])->assertUnprocessable();
    }

    public function test_non_material_rab_cannot_enter_inventory_through_goods_receipt(): void
    {
        $this->actingAsRole('LAPANGAN');
        $po = PurchaseOrder::factory()->approved()->create();
        $rab = RabBudget::factory()->approved()->create([
            'project_id' => $po->project_id,
            'category' => 'Subkon / Struktur',
        ]);
        $poItem = PoItem::factory()->create([
            'purchase_order_id' => $po->id,
            'rab_budget_id' => $rab->id,
            'qty' => 1,
        ]);

        $this->postJson('/api/goods-receipts', [
            'purchase_order_id' => $po->id,
            'receipt_number' => 'GR-SUBKON-001',
            'receipt_date' => '2026-07-10',
            'receiver_name' => 'Petugas',
            'items' => [[
                'po_item_id' => $poItem->id,
                'quantity_received' => 1,
            ]],
        ])->assertUnprocessable()
            ->assertJsonPath('message', 'Penerimaan barang hanya untuk item RAB kategori Material. Subkon, Pekerja, dan Alat diproses melalui SPK/Opname.'); // Perbaikan: Opname huruf O besar

        $this->assertDatabaseCount('goods_receipts', 0);
        $this->assertDatabaseCount('inventory_stocks', 0);
    }
}