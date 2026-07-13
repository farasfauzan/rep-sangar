<?php

namespace Database\Factories;

use App\Models\GoodsReceipt;
use App\Models\PurchaseOrder;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<GoodsReceipt>
 */
class GoodsReceiptFactory extends Factory
{
    protected $model = GoodsReceipt::class;

    public function definition(): array
    {
        return [
            'purchase_order_id'   => PurchaseOrder::factory(),
            'receipt_number'      => 'GR-' . fake()->unique()->numerify('######'),
            'receipt_date'        => fake()->date(),
            'delivery_note_number' => 'SJ-' . fake()->numerify('####'),
            'receiver_name'       => fake()->name(),
            'notes'               => fake()->optional()->sentence(),
        ];
    }
}
