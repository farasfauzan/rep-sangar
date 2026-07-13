<?php

namespace Tests\Feature\Api;

use App\Models\Supplier;
use Database\Factories\SupplierFactory;

class SupplierControllerTest extends TestCase
{
    // ─── INDEX ────────────────────────────────────────────────────────────

    public function test_index_returns_paginated_suppliers(): void
    {
        $this->actingAsRole('LAPANGAN');
        Supplier::factory()->count(3)->create();

        $this->getJson('/api/suppliers')
            ->assertOk()
            ->assertJsonStructure([
                'success',
                'data' => [
                    'data',
                    'current_page',
                    'per_page',
                    'total',
                ],
            ])
            ->assertJson(['success' => true]);
    }

    // ─── SHOW ─────────────────────────────────────────────────────────────

    public function test_show_returns_supplier(): void
    {
        $this->actingAsRole('ENGINEER');
        $supplier = Supplier::factory()->create();

        $this->getJson("/api/suppliers/{$supplier->id}")
            ->assertOk()
            ->assertJsonPath('data.name', $supplier->name)
            ->assertJsonPath('success', true);
    }

    public function test_show_returns_404_for_missing_supplier(): void
    {
        $this->actingAsRole('ADMIN');

        $this->getJson('/api/suppliers/99999')
            ->assertNotFound();
    }

    // ─── STORE ────────────────────────────────────────────────────────────

    public function test_purchasing_legal_can_create_supplier(): void
    {
        $this->actingAsRole('PURCHASING_LEGAL');

        $this->postJson('/api/suppliers', [
            'name'    => 'PT Supplier Baru',
            'code'    => 'SUP-NEW-001',
            'npwp'    => '12.345.678.9-012.345',
            'address' => 'Jakarta',
            'phone'   => '021-1234567',
            'email'   => 'supplier@test.com',
        ])
            ->assertCreated()
            ->assertJsonPath('data.name', 'PT Supplier Baru')
            ->assertJsonPath('success', true);

        $this->assertDatabaseHas('suppliers', [
            'name' => 'PT Supplier Baru',
            'code' => 'SUP-NEW-001',
        ]);
    }

    public function test_store_validates_required_fields(): void
    {
        $this->actingAsRole('PURCHASING_LEGAL');

        $this->postJson('/api/suppliers', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name', 'code']);
    }

    public function test_store_rejects_duplicate_code(): void
    {
        $this->actingAsRole('PURCHASING_LEGAL');
        Supplier::factory()->create(['code' => 'SUP-DUPE-001']);

        $this->postJson('/api/suppliers', [
            'name' => 'PT Test',
            'code' => 'SUP-DUPE-001',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['code']);
    }

    public function test_lapangan_cannot_create_supplier(): void
    {
        $this->actingAsRole('LAPANGAN');

        $this->postJson('/api/suppliers', [
            'name' => 'PT Tidak Boleh',
            'code' => 'SUP-X',
        ])
            ->assertForbidden();
    }

    // ─── UPDATE ───────────────────────────────────────────────────────────

    public function test_purchasing_legal_can_update_supplier(): void
    {
        $this->actingAsRole('PURCHASING_LEGAL');
        $supplier = Supplier::factory()->create();

        $this->putJson("/api/suppliers/{$supplier->id}", [
            'name' => 'Nama Diubah',
        ])
            ->assertOk()
            ->assertJsonPath('data.name', 'Nama Diubah');

        $this->assertDatabaseHas('suppliers', [
            'id'   => $supplier->id,
            'name' => 'Nama Diubah',
        ]);
    }

    // ─── DESTROY ──────────────────────────────────────────────────────────

    public function test_purchasing_legal_can_delete_supplier(): void
    {
        $this->actingAsRole('PURCHASING_LEGAL');
        $supplier = Supplier::factory()->create();

        $this->deleteJson("/api/suppliers/{$supplier->id}")
            ->assertOk()
            ->assertJsonPath('success', true);

        $this->assertSoftDeleted('suppliers', ['id' => $supplier->id]);
    }

    public function test_engineer_cannot_delete_supplier(): void
    {
        $this->actingAsRole('ENGINEER');
        $supplier = Supplier::factory()->create();

        $this->deleteJson("/api/suppliers/{$supplier->id}")
            ->assertForbidden();
    }
}
