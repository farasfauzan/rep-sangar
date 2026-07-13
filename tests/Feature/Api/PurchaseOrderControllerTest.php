<?php

namespace Tests\Feature\Api;

use App\Models\PoItem;
use App\Models\Project;
use App\Models\PurchaseOrder;
use App\Models\RabBudget;
use App\Models\User;

class PurchaseOrderControllerTest extends TestCase
{
    // ─── INDEX ────────────────────────────────────────────────────────────

    public function test_index_returns_paginated_purchase_orders(): void
    {
        $this->actingAsRole('LAPANGAN');
        PurchaseOrder::factory()->count(3)->create();

        $this->getJson('/api/pos')
            ->assertOk()
            ->assertJsonStructure([
                'current_page',
                'data',
                'per_page',
                'total',
            ]);
    }

    public function test_engineer_can_view_pos(): void
    {
        $this->actingAsRole('ENGINEER');
        PurchaseOrder::factory()->count(2)->create();

        $this->getJson('/api/pos')->assertOk();
    }

    // ─── STORE ────────────────────────────────────────────────────────────

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
            ->assertJsonValidationErrors(['project_id', 'po_number', 'date', 'supplier_name', 'items']);
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
                'item_name'     => 'Item',
                'qty'           => 1,
                'unit_price'    => 10000,
            ]],
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['po_number']);
    }

    public function test_lapangan_cannot_create_po(): void
    {
        $this->actingAsRole('LAPANGAN');

        $this->postJson('/api/pos', [
            'project_id'    => 1,
            'po_number'     => 'PO-X',
            'date'          => '2026-07-10',
            'supplier_name' => 'PT Test',
            'items'         => [],
        ])
            ->assertForbidden();
    }

    // ─── SUBMIT / APPROVE / REJECT STATUS TRANSITIONS ─────────────────────

    public function test_submit_transitions_from_draft_to_pending_approval(): void
    {
        $user = $this->actingAsRole('PURCHASING_LEGAL');
        $po = PurchaseOrder::factory()->create(['status' => 'DRAFT', 'created_by' => $user->id]);

        $this->putJson("/api/pos/{$po->id}/submit")
            ->assertOk()
            ->assertJsonPath('data.status', 'PENDING_APPROVAL');
    }

    public function test_approve_transitions_from_pending_approval(): void
    {
        $this->actingAsRole('MGR_KOMERSIAL');
        $po = PurchaseOrder::factory()->create(['status' => 'PENDING_APPROVAL']);

        $this->putJson("/api/pos/{$po->id}/approve")
            ->assertOk()
            ->assertJsonPath('data.status', 'APPROVED');

        $this->assertDatabaseHas('purchase_orders', ['id' => $po->id, 'status' => 'APPROVED']);
    }

    public function test_reject_transitions_from_pending_approval(): void
    {
        $this->actingAsRole('MGR_KOMERSIAL');
        $po = PurchaseOrder::factory()->create(['status' => 'PENDING_APPROVAL']);

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
        $po = PurchaseOrder::factory()->create(['status' => 'PENDING_APPROVAL']);

        $this->putJson("/api/pos/{$po->id}/approve")
            ->assertForbidden();
    }
}
