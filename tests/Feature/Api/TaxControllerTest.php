<?php

namespace Tests\Feature\Api;

use App\Models\Tax;

class TaxControllerTest extends TestCase
{
    // ─── INDEX ────────────────────────────────────────────────────────────

    public function test_index_returns_paginated_taxes(): void
    {
        $this->actingAsRole('LAPANGAN');
        Tax::factory()->count(3)->create();

        $this->getJson('/api/taxes')
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

    public function test_index_supports_search_filter(): void
    {
        $this->actingAsRole('ADMIN');
        Tax::factory()->create(['name' => 'PPN 11%']);
        Tax::factory()->create(['name' => 'PPh 23']);

        $this->getJson('/api/taxes?search=PPN')
            ->assertOk()
            ->assertJsonPath('success', true);
    }

    // ─── SHOW ─────────────────────────────────────────────────────────────

    public function test_show_returns_tax(): void
    {
        $this->actingAsRole('ACCOUNTING');
        $tax = Tax::factory()->create(['name' => 'PPN', 'rate' => 0.11]);

        $this->getJson("/api/taxes/{$tax->id}")
            ->assertOk()
            ->assertJsonPath('data.name', 'PPN')
            ->assertJsonPath('data.rate', '0.1100');
    }

    public function test_show_returns_404_for_missing_tax(): void
    {
        $this->actingAsRole('ADMIN');

        $this->getJson('/api/taxes/99999')
            ->assertNotFound();
    }

    // ─── STORE ────────────────────────────────────────────────────────────

    public function test_pajak_can_create_tax(): void
    {
        $this->actingAsRole('PAJAK');

        $this->postJson('/api/taxes', [
            'name'        => 'PPN 12%',
            'rate'        => 0.12,
            'type'        => 'ppn',
            'is_active'   => true,
            'description' => 'Pajak Pertambahan Nilai 12%',
        ])
            ->assertCreated()
            ->assertJsonPath('data.name', 'PPN 12%')
            ->assertJsonPath('success', true);

        $this->assertDatabaseHas('taxes', ['name' => 'PPN 12%', 'rate' => 0.12]);
    }

    public function test_store_validates_required_fields(): void
    {
        $this->actingAsRole('PAJAK');

        $this->postJson('/api/taxes', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name', 'rate', 'type']);
    }

    public function test_store_validates_rate_between_0_and_1(): void
    {
        $this->actingAsRole('PAJAK');

        $this->postJson('/api/taxes', [
            'name' => 'Bad Tax',
            'rate' => 1.5,
            'type' => 'ppn',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['rate']);
    }

    public function test_store_validates_type_enum(): void
    {
        $this->actingAsRole('PAJAK');

        $this->postJson('/api/taxes', [
            'name' => 'Bad Tax',
            'rate' => 0.10,
            'type' => 'invalid_type',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['type']);
    }

    public function test_engineer_cannot_create_tax(): void
    {
        $this->actingAsRole('ENGINEER');

        $this->postJson('/api/taxes', [
            'name' => 'Test Tax',
            'rate' => 0.10,
            'type' => 'ppn',
        ])
            ->assertForbidden();
    }

    // ─── CALCULATE ────────────────────────────────────────────────────────

    public function test_calculate_returns_tax_breakdown(): void
    {
        $this->actingAsRole('ADMIN');
        $tax = Tax::factory()->create(['name' => 'PPN', 'rate' => 0.11, 'type' => 'ppn']);

        $this->postJson('/api/taxes/calculate', [
            'amount' => 1000000,
            'tax_id' => $tax->id,
        ])
            ->assertOk()
            ->assertJsonPath('data.subtotal', 1000000)
            ->assertJsonPath('data.tax_amount', 110000.0)
            ->assertJsonPath('data.total', 1110000.0)
            ->assertJsonPath('data.tax.name', 'PPN');
    }

    public function test_calculate_validates_required_fields(): void
    {
        $this->actingAsRole('ADMIN');

        $this->postJson('/api/taxes/calculate', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['amount', 'tax_id']);
    }

    public function test_calculate_validates_tax_id_exists(): void
    {
        $this->actingAsRole('ADMIN');

        $this->postJson('/api/taxes/calculate', [
            'amount' => 100000,
            'tax_id' => 99999,
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['tax_id']);
    }
}
