<?php

namespace Tests\Feature\Api;

use App\Models\PoItem;
use App\Models\Project;
use App\Models\PurchaseOrder;
use App\Models\RabBudget;
use App\Models\User;

class PurchaseOrderControllerTest extends TestCase
{
    public function test_index_returns_paginated_purchase_orders(): void
    {
        $this->actingAsRole('LAPANGAN');
        PurchaseOrder::factory()->count(3)->create();

        $this->getJson('/api/pos')
            ->assertOk()
            ->assertJsonStructure(['current_page', 'data', 'per_page', 'total']);
    }

    public function test_engineer_can_view_pos(): void
    {
        $this->actingAsRole('ENGINEER');
        PurchaseOrder::factory()->count(2)->create();

        $this->getJson('/api/pos')->assertOk();
    }

    public function test_purchasing_legal_can_create_po_with_items(): void
    {
        $user = $this->actingAsRole('PURCHASING_LEGAL');
        $project = Project::factory()->create();
        $rab = RabBudget::factory()->approved()->create(['project_id' => $project->id]);

        $this->postJson('/api/pos', [
            'project_id'    => $project->id,
            'po_number'     => 'PO-TEST-001',
            'date'          => '2026-07-10',
            'supplier_name' => 'PT Supplier Test',
            'payment_terms' => '30 hari',
            'items'         => [[
                'rab_budget_id' => $rab->id,
                'item_name'     => $rab->description,
                'qty'           => 5,
                'unit_price'    => 20000,
            ]],
        ])
            ->assertCreated()
            ->assertJsonPath('data.po_number', 'PO-TEST-001')
            ->assertJsonPath('data.status', 'DRAFT');

        $this->assertDatabaseHas('purchase_orders', [
            'po_number' => 'PO-TEST-001',
            'status'    => 'DRAFT',
        ]);
        $this->assertDatabaseHas('po_items', [
            'item_name' => $rab->description,
            'qty'       => 5,
        ]);
    }

    public function test_store_validates_required_fields(): void
    {
        $this->actingAsRole('PURCHASING_LEGAL');

        $this->postJson('/api/pos', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['project_id', 'po_number', 'date', 'items']);
    }

    public function test_store_rejects_duplicate_po_number(): void
    {
        $user = $this->actingAsRole('PURCHASING_LEGAL');
        $project = Project::factory()->create();
        $rab = RabBudget::factory()->approved()->create(['project_id' => $project->id]);
        PurchaseOrder::factory()->create(['po_number' => 'PO-DUPE-001']);

        $this->postJson('/api/pos', [
            'project_id'    => $project->id,
            'po_number'     => 'PO-DUPE-001',
            'date'          => '2026-07-10',
            'supplier_name' => 'PT Test',
            'items'         => [[
                'rab_budget_id' => $rab->id,
                'item_name'     => $rab->description,
                'qty'           => 1,
                'unit_price'    => 10000,
            ]],
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['po_number']);
    }

    public function test_lapangan_can_create_project_level_po(): void
    {
        $this->actingAsRole('LAPANGAN');
        $project = Project::factory()->create();
        $rab = RabBudget::factory()->approved()->create(['project_id' => $project->id]);

        $this->postJson('/api/pos', [
            'project_id' => $project->id,
            'po_number'  => 'PO-LAP-001',
            'date'       => '2026-07-10',
            'po_level'   => 'PROJECT',
            'items'      => [[
                'rab_budget_id' => $rab->id,
                'item_name'     => $rab->description,
                'qty'           => 3,
            ]],
        ])
            ->assertCreated()
            ->assertJsonPath('data.po_level', 'PROJECT');

        $this->assertDatabaseHas('purchase_orders', [
            'po_number' => 'PO-LAP-001',
            'po_level'  => 'PROJECT',
            'status'    => 'DRAFT',
        ]);
        $this->assertDatabaseHas('po_items', [
            'item_name'  => $rab->description,
            'qty'        => 3,
            'unit_price' => 0,
        ]);
    }

    public function test_lapangan_cannot_create_supplier_level_po(): void
    {
        $this->actingAsRole('LAPANGAN');

        $this->postJson('/api/pos', [
            'project_id'    => 1,
            'po_number'     => 'PO-LAP-002',
            'date'          => '2026-07-10',
            'po_level'      => 'SUPPLIER',
            'supplier_name' => 'PT Test',
            'items'         => [[
                'rab_budget_id' => 1,
                'item_name'     => 'Item',
                'qty'           => 1,
                'unit_price'    => 10000,
            ]],
        ])
            ->assertForbidden();
    }

    public function test_project_level_po_does_not_require_supplier_name(): void
    {
        $user = $this->actingAsRole('PURCHASING_LEGAL');
        $project = Project::factory()->create();
        $rab = RabBudget::factory()->approved()->create(['project_id' => $project->id]);

        $this->postJson('/api/pos', [
            'project_id' => $project->id,
            'po_number'  => 'PO-PRJ-001',
            'date'       => '2026-07-10',
            'po_level'   => 'PROJECT',
            'items'      => [[
                'rab_budget_id' => $rab->id,
                'item_name'     => $rab->description,
                'qty'           => 10,
            ]],
        ])
            ->assertCreated()
            ->assertJsonPath('data.po_level', 'PROJECT');

        $this->assertDatabaseHas('purchase_orders', [
            'po_number'     => 'PO-PRJ-001',
            'po_level'      => 'PROJECT',
            'supplier_name' => null,
        ]);
        $this->assertDatabaseHas('po_items', [
            'item_name'  => $rab->description,
            'qty'        => 10,
            'unit_price' => 0,
        ]);
    }

    public function test_supplier_level_po_requires_supplier_name_and_unit_price(): void
    {
        $user = $this->actingAsRole('PURCHASING_LEGAL');
        $project = Project::factory()->create();
        $rab = RabBudget::factory()->approved()->create(['project_id' => $project->id]);

        // Missing supplier_name
        $this->postJson('/api/pos', [
            'project_id' => $project->id,
            'po_number'  => 'PO-SUP-001',
            'date'       => '2026-07-10',
            'po_level'   => 'SUPPLIER',
            'items'      => [[
                'rab_budget_id' => $rab->id,
                'item_name'     => $rab->description,
                'qty'           => 5,
                'unit_price'    => 20000,
            ]],
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['supplier_name']);

        // Missing unit_price
        $this->postJson('/api/pos', [
            'project_id'    => $project->id,
            'po_number'     => 'PO-SUP-002',
            'date'          => '2026-07-10',
            'po_level'      => 'SUPPLIER',
            'supplier_name' => 'PT Supplier Jaya',
            'items'         => [[
                'rab_budget_id' => $rab->id,
                'item_name'     => $rab->description,
                'qty'           => 5,
            ]],
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['items.0.unit_price']);

        // Full valid supplier PO (Perbaikan: menambah payment_terms dan jadwal_kirim)
        $this->postJson('/api/pos', [
            'project_id'    => $project->id,
            'po_number'     => 'PO-SUP-003',
            'date'          => '2026-07-10',
            'po_level'      => 'SUPPLIER',
            'supplier_name' => 'PT Supplier Jaya',
            'payment_terms' => '30 hari',
            'jadwal_kirim'  => '2026-07-15',
            'tax_rate'      => 11,
            'items'         => [[
                'rab_budget_id' => $rab->id,
                'item_name'     => $rab->description,
                'qty'           => 5,
                'unit_price'    => 20000,
            ]],
        ])
            ->assertCreated()
            ->assertJsonPath('data.po_level', 'SUPPLIER');

        $this->assertDatabaseHas('purchase_orders', [
            'po_number'     => 'PO-SUP-003',
            'po_level'      => 'SUPPLIER',
            'supplier_name' => 'PT Supplier Jaya',
        ]);
        $this->assertDatabaseHas('po_items', [
            'item_name'  => $rab->description,
            'qty'        => 5,
            'unit_price' => 20000,
        ]);
    }

    public function test_project_level_po_has_zero_total(): void
    {
        $user = $this->actingAsRole('PURCHASING_LEGAL');
        $project = Project::factory()->create();
        $rab = RabBudget::factory()->approved()->create(['project_id' => $project->id]);

        $this->postJson('/api/pos', [
            'project_id' => $project->id,
            'po_number'  => 'PO-PRJ-002',
            'date'       => '2026-07-10',
            'po_level'   => 'PROJECT',
            'items'      => [[
                'rab_budget_id' => $rab->id,
                'item_name'     => $rab->description,
                'qty'           => 20,
            ]],
        ])
            ->assertCreated();

        $this->assertDatabaseHas('purchase_orders', [
            'po_number'    => 'PO-PRJ-002',
            'total_amount' => 0,
        ]);
    }

    public function test_submit_transitions_from_draft_to_pending_approval(): void
    {
        $user = $this->actingAsRole('PURCHASING_LEGAL');
        $parent = PurchaseOrder::factory()->create(['po_level' => 'PROJECT', 'status' => 'ROUTED', 'routed_to' => 'PURCHASE_ORDER']);
        $po = PurchaseOrder::factory()->create(['status' => 'DRAFT', 'po_level' => 'SUPPLIER', 'parent_po_id' => $parent->id, 'created_by' => $user->id]);

        $this->putJson("/api/pos/{$po->id}/submit")
            ->assertOk()
            ->assertJsonPath('data.status', 'PENDING_APPROVAL');
    }

    public function test_approve_transitions_from_pending_approval(): void
    {
        $this->actingAsRole('MGR_KOMERSIAL');
        $po = PurchaseOrder::factory()->create(['status' => 'PENDING_APPROVAL', 'po_level' => 'SUPPLIER']);

        $this->putJson("/api/pos/{$po->id}/approve")
            ->assertOk()
            ->assertJsonPath('data.status', 'APPROVED');

        $this->assertDatabaseHas('purchase_orders', ['id' => $po->id, 'status' => 'APPROVED']);
    }

    public function test_reject_transitions_from_pending_approval(): void
    {
        $this->actingAsRole('MGR_KOMERSIAL');
        $po = PurchaseOrder::factory()->create(['status' => 'PENDING_APPROVAL', 'po_level' => 'SUPPLIER']);

        $this->putJson("/api/pos/{$po->id}/reject", ['notes' => 'Harga mahal'])
            ->assertOk()
            ->assertJsonPath('data.status', 'REJECTED');
    }

    public function test_approve_rejects_non_pending_po(): void
    {
        $this->actingAsRole('MGR_KOMERSIAL');
        $po = PurchaseOrder::factory()->create(['status' => 'DRAFT']);

        $this->putJson("/api/pos/{$po->id}/approve")
            ->assertUnprocessable();
    }

    public function test_lapangan_cannot_approve_po(): void
    {
        $this->actingAsRole('LAPANGAN');
        $po = PurchaseOrder::factory()->create(['status' => 'PENDING_APPROVAL', 'po_level' => 'SUPPLIER']);

        $this->putJson("/api/pos/{$po->id}/approve")
            ->assertForbidden();
    }

    public function test_engineer_routing_is_determined_by_rab_category(): void
    {
        $this->actingAsRole('ENGINEER');
        $project = Project::factory()->create();

        $material = RabBudget::factory()->approved()->create([
            'project_id' => $project->id,
            'category' => 'Material / Struktur',
        ]);
        $materialPo = PurchaseOrder::factory()->create([
            'project_id' => $project->id,
            'po_level' => 'PROJECT',
            'status' => 'DRAFT',
        ]);
        PoItem::factory()->create([
            'purchase_order_id' => $materialPo->id,
            'rab_budget_id' => $material->id,
        ]);

        $this->putJson("/api/pos/{$materialPo->id}/route", ['routed_to' => 'SPK'])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Kategori Material harus diarahkan ke PO Supplier.');
        $this->putJson("/api/pos/{$materialPo->id}/route", ['routed_to' => 'PURCHASE_ORDER'])
            ->assertOk();

        $subkon = RabBudget::factory()->approved()->create([
            'project_id' => $project->id,
            'category' => 'Subkon / Arsitektur',
        ]);
        $subkonPo = PurchaseOrder::factory()->create([
            'project_id' => $project->id,
            'po_level' => 'PROJECT',
            'status' => 'DRAFT',
        ]);
        PoItem::factory()->create([
            'purchase_order_id' => $subkonPo->id,
            'rab_budget_id' => $subkon->id,
        ]);

        $this->putJson("/api/pos/{$subkonPo->id}/route", ['routed_to' => 'PURCHASE_ORDER'])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Kategori Subkon harus diarahkan ke SPK.');
        $this->putJson("/api/pos/{$subkonPo->id}/route", ['routed_to' => 'SPK'])
            ->assertOk();
    }
}