<?php

namespace Tests\Feature\Api;

use App\Models\Project;
use App\Models\Spk;

class SpkControllerTest extends TestCase
{
    // ─── INDEX ────────────────────────────────────────────────────────────

    public function test_index_returns_paginated_spks(): void
    {
        $this->actingAsRole('LAPANGAN');
        Spk::factory()->count(3)->create();

        $this->getJson('/api/spks')
            ->assertOk()
            ->assertJsonStructure([
                'current_page',
                'data',
                'per_page',
                'total',
            ]);
    }

    // ─── STORE ────────────────────────────────────────────────────────────

    public function test_purchasing_legal_can_create_spk(): void
    {
        $user = $this->actingAsRole('PURCHASING_LEGAL');
        $project = Project::factory()->create();

        $this->postJson('/api/spks', [
            'project_id'    => $project->id,
            'spk_number'    => 'SPK-TEST-001',
            'subcon_name'   => 'CV Bangun Jaya',
            'subtotal'      => 200000,
            'payment_terms' => 'Berdasarkan opname',
        ])
            ->assertCreated()
            ->assertJsonPath('data.spk_number', 'SPK-TEST-001')
            ->assertJsonPath('data.status', 'DRAFT');

        $this->assertDatabaseHas('spks', [
            'spk_number' => 'SPK-TEST-001',
            'status'     => 'DRAFT',
        ]);
    }

    public function test_store_calculates_tax_and_total(): void
    {
        $user = $this->actingAsRole('ADMIN');
        $project = Project::factory()->create();

        $this->postJson('/api/spks', [
            'project_id'  => $project->id,
            'spk_number'  => 'SPK-TAX-001',
            'subcon_name' => 'PT Subcon',
            'subtotal'    => 100000,
        ])
            ->assertCreated();

        $this->assertDatabaseHas('spks', [
            'spk_number'   => 'SPK-TAX-001',
            'subtotal'     => 100000,
            'tax_amount'   => 11000,
            'total_amount' => 111000,
        ]);
    }

    public function test_store_validates_required_fields(): void
    {
        $this->actingAsRole('PURCHASING_LEGAL');

        $this->postJson('/api/spks', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['project_id', 'spk_number', 'subcon_name', 'subtotal']);
    }

    public function test_store_rejects_duplicate_spk_number(): void
    {
        $user = $this->actingAsRole('PURCHASING_LEGAL');
        $project = Project::factory()->create();
        Spk::factory()->create(['spk_number' => 'SPK-DUPE-001']);

        $this->postJson('/api/spks', [
            'project_id'  => $project->id,
            'spk_number'  => 'SPK-DUPE-001',
            'subcon_name' => 'CV Test',
            'subtotal'    => 50000,
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['spk_number']);
    }

    public function test_engineer_cannot_create_spk(): void
    {
        $this->actingAsRole('ENGINEER');

        $this->postJson('/api/spks', [
            'project_id'  => 1,
            'spk_number'  => 'SPK-X',
            'subcon_name' => 'CV Test',
            'subtotal'    => 50000,
        ])
            ->assertForbidden();
    }

    // ─── SUBMIT / APPROVE / REJECT STATUS TRANSITIONS ─────────────────────

    public function test_submit_transitions_from_draft(): void
    {
        $user = $this->actingAsRole('PURCHASING_LEGAL');
        $spk = Spk::factory()->create(['status' => 'DRAFT', 'created_by' => $user->id]);

        $this->putJson("/api/spks/{$spk->id}/submit")
            ->assertOk()
            ->assertJsonPath('data.status', 'PENDING_APPROVAL');
    }

    public function test_approve_transitions_from_pending_approval(): void
    {
        $this->actingAsRole('MGR_KOMERSIAL');
        $spk = Spk::factory()->create(['status' => 'PENDING_APPROVAL']);

        $this->putJson("/api/spks/{$spk->id}/approve")
            ->assertOk()
            ->assertJsonPath('data.status', 'APPROVED');

        $this->assertDatabaseHas('spks', ['id' => $spk->id, 'status' => 'APPROVED']);
    }

    public function test_reject_transitions_from_pending_approval(): void
    {
        $this->actingAsRole('MGR_KOMERSIAL');
        $spk = Spk::factory()->create(['status' => 'PENDING_APPROVAL']);

        $this->putJson("/api/spks/{$spk->id}/reject", ['notes' => 'Subcon tidak memenuhi syarat'])
            ->assertOk()
            ->assertJsonPath('data.status', 'REJECTED');
    }

    public function test_approve_rejects_non_pending_spk(): void
    {
        $this->actingAsRole('MGR_KOMERSIAL');
        $spk = Spk::factory()->create(['status' => 'DRAFT']);

        $this->putJson("/api/spks/{$spk->id}/approve")
            ->assertUnprocessable();
    }

    public function test_lapangan_cannot_approve_spk(): void
    {
        $this->actingAsRole('LAPANGAN');
        $spk = Spk::factory()->create(['status' => 'PENDING_APPROVAL']);

        $this->putJson("/api/spks/{$spk->id}/approve")
            ->assertForbidden();
    }
}
