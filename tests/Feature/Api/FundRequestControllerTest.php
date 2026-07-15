<?php

namespace Tests\Feature\Api;

use App\Models\FundRequest;
use App\Models\Project;

class FundRequestControllerTest extends TestCase
{
    // ─── INDEX ────────────────────────────────────────────────────────────

    public function test_index_returns_paginated_fund_requests(): void
    {
        $this->actingAsRole('LAPANGAN');
        FundRequest::factory()->count(3)->create();

        $this->getJson('/api/fund-requests')
            ->assertOk()
            ->assertJsonStructure([
                'current_page',
                'data',
                'per_page',
                'total',
            ]);
    }

    // ─── STORE ────────────────────────────────────────────────────────────

    public function test_any_role_can_create_fund_request(): void
    {
        $user = $this->actingAsRole('ENGINEER');
        $project = Project::factory()->create();

        $this->postJson('/api/fund-requests', [
            'project_id'     => $project->id,
            'request_number' => 'FR-TEST-001',
            'amount'         => 100000,
            'description'    => 'Biaya operasional',
        ])
            ->assertCreated()
            ->assertJsonPath('data.request_number', 'FR-TEST-001')
            ->assertJsonPath('data.status', 'PENDING_VERIFICATION');

        $this->assertDatabaseHas('fund_requests', [
            'request_number' => 'FR-TEST-001',
            'status'         => 'PENDING_VERIFICATION',
        ]);
    }

    public function test_store_validates_required_fields(): void
    {
        $this->actingAsRole('ADMIN');

        $this->postJson('/api/fund-requests', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['project_id', 'request_number', 'amount']);
    }

    public function test_store_rejects_duplicate_request_number(): void
    {
        $user = $this->actingAsRole('ADMIN');
        FundRequest::factory()->create(['request_number' => 'FR-DUPE-001']);

        $this->postJson('/api/fund-requests', [
            'project_id'     => 1,
            'request_number' => 'FR-DUPE-001',
            'amount'         => 50000,
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['request_number']);
    }

    // ─── APPROVE ──────────────────────────────────────────────────────────

    public function test_manager_can_approve_verified_fund_request(): void
    {
        $this->actingAsRole('MGR_KOMERSIAL');
        $fr = FundRequest::factory()->create(['status' => 'PENDING_APPROVAL']);

        $this->putJson("/api/fund-requests/{$fr->id}/approve")
            ->assertOk()
            ->assertJsonPath('data.status', 'APPROVED');

        $this->assertDatabaseHas('fund_requests', ['id' => $fr->id, 'status' => 'APPROVED']);
    }

    public function test_approve_rejects_non_pending_status(): void
    {
        $this->actingAsRole('MGR_KOMERSIAL');
        $fr = FundRequest::factory()->create(['status' => 'APPROVED']);

        $this->putJson("/api/fund-requests/{$fr->id}/approve")
            ->assertUnprocessable();
    }

    public function test_engineer_cannot_approve_fund_request(): void
    {
        $this->actingAsRole('ENGINEER');
        $fr = FundRequest::factory()->create(['status' => 'PENDING_APPROVAL']);

        $this->putJson("/api/fund-requests/{$fr->id}/approve")
            ->assertForbidden();
    }

    // ─── REJECT ───────────────────────────────────────────────────────────

    public function test_keu_kantor_can_reject_fund_request(): void
    {
        $this->actingAsRole('MGR_KOMERSIAL');
        $fr = FundRequest::factory()->create(['status' => 'PENDING_APPROVAL']);

        $this->putJson("/api/fund-requests/{$fr->id}/reject-manager")
            ->assertOk()
            ->assertJsonPath('data.status', 'REJECTED');
    }

    public function test_reject_rejects_non_pending_status(): void
    {
        $this->actingAsRole('MGR_KOMERSIAL');
        $fr = FundRequest::factory()->create(['status' => 'REJECTED']);

        $this->putJson("/api/fund-requests/{$fr->id}/reject-manager")
            ->assertUnprocessable();
    }

    // ─── PAY ──────────────────────────────────────────────────────────────

    public function test_keu_kantor_can_pay_approved_fund_request(): void
    {
        $this->actingAsRole('KEU_KANTOR');
        $fr = FundRequest::factory()->approved()->create();

        $this->postJson("/api/fund-requests/{$fr->id}/payments", [
            'payment_method' => 'TRANSFER',
            'proof_of_payment' => 'Bukti Transfer',
        ])
            ->assertOk()
            ->assertJsonPath('data.status', 'PAID');

        $this->assertDatabaseHas('fund_requests', ['id' => $fr->id, 'status' => 'PAID']);
        $this->assertDatabaseHas('transactions', ['fund_request_id' => $fr->id]);
    }

    public function test_pay_rejects_non_approved_fund_request(): void
    {
        $this->actingAsRole('KEU_KANTOR');
        $fr = FundRequest::factory()->create(['status' => 'PENDING_APPROVAL']);

        $this->postJson("/api/fund-requests/{$fr->id}/payments", [
            'payment_method' => 'TRANSFER',
        ])
            ->assertUnprocessable();
    }

    public function test_pay_requires_payment_method(): void
    {
        $this->actingAsRole('KEU_KANTOR');
        $fr = FundRequest::factory()->approved()->create();

        $this->postJson("/api/fund-requests/{$fr->id}/payments", [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['payment_method']);
    }

    public function test_lapangan_cannot_pay_fund_request(): void
    {
        $this->actingAsRole('LAPANGAN');
        $fr = FundRequest::factory()->approved()->create();

        $this->postJson("/api/fund-requests/{$fr->id}/payments", [
            'payment_method' => 'TRANSFER',
        ])
            ->assertForbidden();
    }
}
