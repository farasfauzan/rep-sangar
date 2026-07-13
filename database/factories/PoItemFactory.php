<?php

namespace Database\Factories;

use App\Models\PoItem;
use App\Models\PurchaseOrder;
use App\Models\RabBudget;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PoItem>
 */
class PoItemFactory extends Factory
{
    protected $model = PoItem::class;

    public function definition(): array
    {
        $qty        = fake()->numberBetween(1, 50);
        $unitPrice  = fake()->numberBetween(10000, 500000);

        return [
            'purchase_order_id' => PurchaseOrder::factory(),
            'rab_budget_id'     => RabBudget::factory(),
            'item_name'         => fake()->words(2, true),
            'qty'               => $qty,
            'unit_price'        => $unitPrice,
            'total_price'       => $qty * $unitPrice,
        ];
    }
}
