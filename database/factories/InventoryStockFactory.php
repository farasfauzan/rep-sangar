<?php

namespace Database\Factories;

use App\Models\InventoryStock;
use App\Models\Project;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<InventoryStock>
 */
class InventoryStockFactory extends Factory
{
    protected $model = InventoryStock::class;

    public function definition(): array
    {
        return [
            'project_id'   => Project::factory(),
            'rab_budget_id' => null,
            'item_name'    => fake()->words(2, true),
            'unit'         => fake()->randomElement(['Zak', 'Pcs', 'Kg', 'Lbr', 'm3']),
            'quantity'     => fake()->numberBetween(0, 1000),
            'min_quantity' => fake()->numberBetween(0, 10),
            'location'     => fake()->city(),
        ];
    }
}
