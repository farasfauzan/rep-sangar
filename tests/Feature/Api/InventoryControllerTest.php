<?php

namespace Tests\Feature\Api;

use App\Models\InventoryStock;
use App\Models\Project;
use App\Models\StockMovement;

class InventoryControllerTest extends TestCase
{
    // ─── INDEX ────────────────────────────────────────────────────────────

    public function test_index_returns_paginated_inventory(): void
    {
        $this->actingAsRole('LAPANGAN');
        InventoryStock::factory()->count(3)->create();

        $this->getJson('/api/inventory')
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

    public function test_index_supports_project_filter(): void
    {
        $this->actingAsRole('ADMIN');
        $project = Project::factory()->create();
        InventoryStock::factory()->create(['project_id' => $project->id, 'item_name' => 'Semen']);
        InventoryStock::factory()->create(['item_name' => 'Pasir']);

        $response = $this->getJson("/api/inventory?project_id={$project->id}")
            ->assertOk();

        $this->assertEquals(1, $response->json('data.total'));
    }

    public function test_index_supports_search_filter(): void
    {
        $this->actingAsRole('ENGINEER');
        InventoryStock::factory()->create(['item_name' => 'Semen Portland']);
        InventoryStock::factory()->create(['item_name' => 'Pasir Beton']);

        $response = $this->getJson('/api/inventory?search=Semen')
            ->assertOk();

        $this->assertEquals(1, $response->json('data.total'));
    }

    public function test_index_supports_low_stock_filter(): void
    {
        $this->actingAsRole('ADMIN');
        InventoryStock::factory()->create(['quantity' => 5, 'min_quantity' => 10]);
        InventoryStock::factory()->create(['quantity' => 100, 'min_quantity' => 10]);

        $response = $this->getJson('/api/inventory?low_stock=1')
            ->assertOk();

        $this->assertEquals(1, $response->json('data.total'));
    }

    // ─── MOVEMENTS ────────────────────────────────────────────────────────

    public function test_movements_returns_stock_movements(): void
    {
        $this->actingAsRole('ADMIN');
        $stock = InventoryStock::factory()->create();

        StockMovement::factory()->count(3)->create([
            'inventory_stock_id' => $stock->id,
        ]);

        $this->getJson("/api/inventory/{$stock->id}/movements")
            ->assertOk()
            ->assertJsonStructure([
                'success',
                'stock_item' => ['id', 'item_name', 'quantity', 'project_name'],
                'movements',
                'data' => [
                    'data',
                    'current_page',
                    'per_page',
                    'total',
                ],
            ])
            ->assertJsonPath('stock_item.id', $stock->id)
            ->assertJsonCount(3, 'movements');
    }

    // ─── ADJUST ───────────────────────────────────────────────────────────

    public function test_lapangan_can_adjust_stock(): void
    {
        $user = $this->actingAsRole('LAPANGAN');
        $stock = InventoryStock::factory()->create(['quantity' => 50]);

        $this->postJson("/api/inventory/{$stock->id}/adjust", [
            'type'     => 'decrease',
            'quantity' => 10,
            'notes'    => 'Koreksi stok fisik',
        ])
            ->assertOk()
            ->assertJsonPath('data.quantity', 40);

        $this->assertDatabaseHas('inventory_stocks', [
            'id'       => $stock->id,
            'quantity' => 40,
        ]);
        $this->assertDatabaseHas('stock_movements', [
            'inventory_stock_id' => $stock->id,
            'type'               => 'out',
            'quantity'           => 10,
        ]);
    }

    public function test_adjust_validates_required_fields(): void
    {
        $this->actingAsRole('LAPANGAN');
        $stock = InventoryStock::factory()->create();

        $this->postJson("/api/inventory/{$stock->id}/adjust", [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['type', 'quantity', 'notes']);
    }

    public function test_adjust_positive_quantity_increases_stock(): void
    {
        $user = $this->actingAsRole('LAPANGAN');
        $stock = InventoryStock::factory()->create(['quantity' => 20]);

        $this->postJson("/api/inventory/{$stock->id}/adjust", [
            'type'     => 'increase',
            'quantity' => 30,
            'notes'    => 'Penambahan stok hasil opname',
        ])
            ->assertOk()
            ->assertJsonPath('data.quantity', 50);

        $this->assertDatabaseHas('stock_movements', [
            'inventory_stock_id' => $stock->id,
            'type'               => 'in',
            'quantity'           => 30,
        ]);
    }

    public function test_adjust_cannot_reduce_stock_below_zero(): void
    {
        $this->actingAsRole('LAPANGAN');
        $stock = InventoryStock::factory()->create(['quantity' => 5]);

        $this->postJson("/api/inventory/{$stock->id}/adjust", [
            'type'     => 'decrease',
            'quantity' => 6,
            'notes'    => 'Material dipakai di lapangan',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('quantity');

        $this->assertDatabaseHas('inventory_stocks', [
            'id'       => $stock->id,
            'quantity' => 5,
        ]);
        $this->assertDatabaseCount('stock_movements', 0);
    }

    public function test_engineer_cannot_adjust_stock(): void
    {
        $this->actingAsRole('ENGINEER');
        $stock = InventoryStock::factory()->create();

        $this->postJson("/api/inventory/{$stock->id}/adjust", [
            'type'     => 'decrease',
            'quantity' => 5,
            'notes'    => 'Test',
        ])
            ->assertForbidden();
    }
}
