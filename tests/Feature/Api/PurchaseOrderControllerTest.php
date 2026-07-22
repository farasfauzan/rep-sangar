<?php

namespace Tests\Feature\Api;

use App\Models\GoodsReceipt;
use App\Models\PoItem;
use App\Models\Project;
use App\Models\PurchaseOrder;
use App\Models\RabBudget;
use Illuminate\Support\Facades\DB;

class ProjectControllerTest extends TestCase
{
    public function test_index_returns_paginated_projects(): void
    {
        $this->actingAsRole('LAPANGAN');
        Project::factory()->count(3)->create();

        $this->getJson('/api/projects')
            ->assertOk()
            ->assertJsonStructure([
                'success',
                'data' => [
                    'data' => [
                        '*' => ['id', 'project_name', 'location', 'start_date', 'status'],
                    ],
                    'current_page',
                    'per_page',
                    'total',
                ],
            ])
            ->assertJson(['success' => true]);
    }

    public function test_index_includes_pending_approval_count_for_each_project(): void
    {
        $this->actingAsRole('ADMIN');
        $project = Project::factory()->create();

        RabBudget::factory()->count(2)->pending()->create(['project_id' => $project->id]);
        PurchaseOrder::factory()->create([
            'project_id' => $project->id,
            'po_level' => 'PROJECT',
            'status' => 'DRAFT',
        ]);
        PurchaseOrder::factory()->approved()->create([
            'project_id' => $project->id,
            'po_level' => 'SUPPLIER',
        ]);

        $this->getJson('/api/projects')
            ->assertOk()
            ->assertJsonPath('data.data.0.id', $project->id)
            ->assertJsonPath('data.data.0.pending_approval_count', 3)
            ->assertJsonPath('data.data.0.pending_rab_approval_count', 2);
    }

    public function test_show_returns_project_with_rab_budgets(): void
    {
        $this->actingAsRole('ENGINEER');
        $project = Project::factory()->create();

        $this->getJson("/api/projects/{$project->id}")
            ->assertOk()
            ->assertJsonPath('data.id', $project->id)
            ->assertJsonPath('success', true);
    }

    public function test_show_returns_404_for_nonexistent_project(): void
    {
        $this->actingAsRole('ADMIN');

        $this->getJson('/api/projects/99999')
            ->assertNotFound();
    }

    public function test_admin_can_create_project(): void
    {
        $this->actingAsRole('ADMIN');

        $this->postJson('/api/projects', [
            'project_name' => 'Proyek Baru',
            'location' => 'Bandung',
            'start_date' => '2026-08-01',
        ])
            ->assertCreated()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.project_name', 'Proyek Baru');

        $this->assertDatabaseHas('projects', [
            'project_name' => 'Proyek Baru',
            'location' => 'Bandung',
        ]);
    }

    public function test_mgr_komersial_can_create_project(): void
    {
        $this->actingAsRole('MGR_KOMERSIAL');

        $this->postJson('/api/projects', [
            'project_name' => 'Proyek Komersial',
            'location' => 'Surabaya',
            'start_date' => '2026-09-01',
        ])
            ->assertCreated();
    }

    public function test_store_validates_required_fields(): void
    {
        $this->actingAsRole('ADMIN');

        $this->postJson('/api/projects', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['project_name', 'location', 'start_date']);
    }

    public function test_lapangan_cannot_create_project(): void
    {
        $this->actingAsRole('LAPANGAN');

        $this->postJson('/api/projects', [
            'project_name' => 'Tidak Boleh',
            'location' => 'Jakarta',
            'start_date' => '2026-08-01',
        ])
            ->assertForbidden();
    }

    public function test_admin_can_update_project(): void
    {
        $this->actingAsRole('ADMIN');
        $project = Project::factory()->create(['status' => 'planning']);

        $this->putJson("/api/projects/{$project->id}", [
            'project_name' => 'Nama Diubah',
            'status' => 'active',
        ])
            ->assertOk()
            ->assertJsonPath('data.project_name', 'Nama Diubah')
            ->assertJsonPath('data.status', 'active');

        $this->assertDatabaseHas('projects', [
            'id' => $project->id,
            'status' => 'active',
        ]);
    }

    public function test_update_rejects_invalid_status(): void
    {
        $this->actingAsRole('ADMIN');
        $project = Project::factory()->create();

        $this->putJson("/api/projects/{$project->id}", [
            'status' => 'bogus_status',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['status']);
    }

    public function test_admin_can_delete_project(): void
    {
        $this->actingAsRole('ADMIN');
        $project = Project::factory()->create();

        $this->deleteJson("/api/projects/{$project->id}")
            ->assertOk();

        $this->assertDatabaseMissing('projects', ['id' => $project->id]);
    }

    public function test_engineer_cannot_delete_project(): void
    {
        $this->actingAsRole('ENGINEER');
        $project = Project::factory()->create();

        $this->deleteJson("/api/projects/{$project->id}")
            ->assertForbidden();
    }

    public function test_reset_removes_po_dependencies_before_purchase_orders(): void
    {
        $this->actingAsRole('ADMIN');
        
        // Perbaikan: Ubah status menjadi DRAFT agar lolos validasi Authorization/Policy
        $project = Project::factory()->create(['status' => 'DRAFT']);
        
        $rab = RabBudget::factory()->create(['project_id' => $project->id]);
        $po = PurchaseOrder::factory()->create(['project_id' => $project->id, 'status' => 'DRAFT']);
        $poItem = PoItem::factory()->create([
            'purchase_order_id' => $po->id,
            'rab_budget_id' => $rab->id,
        ]);
        $receipt = GoodsReceipt::factory()->create(['purchase_order_id' => $po->id]);

        DB::table('goods_receipt_items')->insert([
            'goods_receipt_id' => $receipt->id,
            'po_item_id' => $poItem->id,
            'quantity_received' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('po_attachments')->insert([
            'purchase_order_id' => $po->id,
            'file_name' => 'contoh.pdf',
            'file_path' => 'attachments/po/contoh.pdf',
            'file_size' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->postJson("/api/projects/{$project->id}/reset")
            ->assertOk()
            ->assertJsonPath('success', true);

        $this->assertDatabaseMissing('goods_receipt_items', ['po_item_id' => $poItem->id]);
        $this->assertDatabaseMissing('goods_receipts', ['id' => $receipt->id]);
        $this->assertDatabaseMissing('po_items', ['id' => $poItem->id]);
        $this->assertDatabaseMissing('po_attachments', ['purchase_order_id' => $po->id]);
        $this->assertDatabaseMissing('purchase_orders', ['id' => $po->id]);
    }
}