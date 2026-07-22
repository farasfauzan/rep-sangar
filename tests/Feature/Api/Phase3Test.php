<?php

namespace Tests\Feature\Api;

use App\Models\Bast;
use App\Models\Invoice;
use App\Models\Opname;
use App\Models\Spk;
use App\Models\User;

class Phase3Test extends TestCase
{
    // ─── OPNAME PROGRESS FIELDS ────────────────────────────────────────

    public function test_store_opname_with_progress_fields(): void
    {
        $this->actingAsRole('LAPANGAN');
        $spk = Spk::factory()->approved()->create();

        $this->postJson('/api/opnames', [
            'spk_id' => $spk->id,
            'opname_number' => 'OPN-P3-001',
            'date' => '2026-07-13',
            'progress_percentage' => 50,
            'progress_pct' => 50,
            'progress_items' => [
                ['description' => 'Pondasi selesai', 'done' => true],
                ['description' => 'Struktur selesai', 'done' => false],
            ],
            'amount' => 50000,
        ])
        ->assertCreated()
        ->assertJsonPath('data.progress_pct', 50);

        $this->assertDatabaseHas('opnames', [
            'opname_number' => 'OPN-P3-001',
            'progress_pct' => 50,
        ]);
    }

    public function test_store_opname_validates_progress_pct_range(): void
    {
        $this->actingAsRole('LAPANGAN');

        $this->postJson('/api/opnames', [
            'spk_id' => 1,
            'opname_number' => 'OPN-P3-002',
            'date' => '2026-07-13',
            'progress_percentage' => 50,
            'progress_pct' => 150,
            'amount' => 100000,
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('progress_pct');
    }

    // ─── BAST CRUD ─────────────────────────────────────────────────────

    public function test_bast_index_returns_paginated(): void
    {
        $this->actingAsRole('LAPANGAN');

        $this->getJson('/api/basts')
            ->assertOk()
            ->assertJsonStructure(['current_page', 'data', 'per_page', 'total']);
    }

    public function test_store_bast_for_approved_opname(): void
    {
        $this->actingAsRole('LAPANGAN');
        $opname = Opname::factory()->approved()->create();

        $this->postJson('/api/basts', [
            'opname_id' => $opname->id,
            'bast_number' => 'BAST-001',
            'bast_date' => '2026-07-13',
            'notes' => 'Serah terima pekerjaan tahap 1',
        ])
        ->assertCreated()
        ->assertJsonPath('data.bast_number', 'BAST-001');

        $this->assertDatabaseHas('basts', [
            'bast_number' => 'BAST-001',
        ]);
    }

    public function test_store_bast_rejects_non_approved_opname(): void
    {
        $this->actingAsRole('LAPANGAN');
        $opname = Opname::factory()->pending()->create();

        $this->postJson('/api/basts', [
            'opname_id' => $opname->id,
            'bast_number' => 'BAST-002',
            'bast_date' => '2026-07-13',
        ])
        ->assertStatus(422);
    }

    public function test_update_bast(): void
    {
        $this->actingAsRole('LAPANGAN');
        $bast = Bast::factory()->create();

        $this->putJson("/api/basts/{$bast->id}", [
            'notes' => 'Updated notes',
        ])
        ->assertOk()
        ->assertJsonPath('data.notes', 'Updated notes');
    }

    public function test_delete_bast(): void
    {
        $this->actingAsRole('LAPANGAN');
        $bast = Bast::factory()->create();

        $this->deleteJson("/api/basts/{$bast->id}")
            ->assertOk();

        $this->assertDatabaseMissing('basts', ['id' => $bast->id]);
    }

    // ─── INVOICE CASHFLOW APPROVE ──────────────────────────────────────

    public function test_cashflow_approve_invoice(): void
    {
        $this->actingAsRole('VERIFIKATOR_KEU');
        $invoice = Invoice::factory()->create([
            'status' => 'PENDING_CASHFLOW',
            'cashflow_status' => 'PENDING',
        ]);

        $this->putJson("/api/invoices/{$invoice->id}/cashflow-approve", [
            'cashflow_status' => 'APPROVED',
        ])
        ->assertOk()
        ->assertJsonPath('data.cashflow_status', 'APPROVED');

        $this->assertDatabaseHas('invoices', [
            'id' => $invoice->id,
            'cashflow_status' => 'APPROVED',
        ]);
    }

    public function test_cashflow_reject_invoice(): void
    {
        $this->actingAsRole('VERIFIKATOR_KEU');
        $invoice = Invoice::factory()->create([
            'status' => 'PENDING_CASHFLOW',
            'cashflow_status' => 'PENDING',
        ]);

        $this->putJson("/api/invoices/{$invoice->id}/cashflow-approve", [
            'cashflow_status' => 'REJECTED',
        ])
        ->assertOk()
        ->assertJsonPath('data.cashflow_status', 'REJECTED');
    }

    public function test_cashflow_rejects_already_processed(): void
    {
        $this->actingAsRole('VERIFIKATOR_KEU');
        $invoice = Invoice::factory()->create([
            'status' => 'PENDING_CASHFLOW',
            'cashflow_status' => 'APPROVED',
        ]);

        $this->putJson("/api/invoices/{$invoice->id}/cashflow-approve", [
            'cashflow_status' => 'APPROVED',
        ])
        ->assertStatus(422);
    }

    public function test_cashflow_validates_status_enum(): void
    {
        $this->actingAsRole('VERIFIKATOR_KEU');
        $invoice = Invoice::factory()->create([
            'status' => 'PENDING_CASHFLOW',
            'cashflow_status' => 'PENDING',
        ]);

        $this->putJson("/api/invoices/{$invoice->id}/cashflow-approve", [
            'cashflow_status' => 'INVALID',
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('cashflow_status');
    }
}