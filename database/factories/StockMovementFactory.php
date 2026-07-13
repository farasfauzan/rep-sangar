<?php

namespace Database\Factories;

use App\Models\StockMovement;
use App\Models\InventoryStock;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<StockMovement>
 */
class StockMovementFactory extends Factory
{
    protected $model = StockMovement::class;

    public function definition(): array
    {
        return [
            'inventory_stock_id' => InventoryStock::factory(),
            'type'               => fake()->randomElement(['adjustment', 'receipt', 'transfer']),
            'quantity'           => fake()->numberBetween(-100, 100),
            'reference_type'     => null,
            'reference_id'       => null,
            'notes'              => fake()->optional()->sentence(),
            'created_by'         => User::factory(),
        ];
    }
}
