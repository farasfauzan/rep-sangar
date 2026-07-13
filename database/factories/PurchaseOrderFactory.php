<?php

namespace Database\Factories;

use App\Models\PurchaseOrder;
use App\Models\Project;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PurchaseOrder>
 */
class PurchaseOrderFactory extends Factory
{
    protected $model = PurchaseOrder::class;

    public function definition(): array
    {
        return [
            'project_id'    => Project::factory(),
            'po_number'     => 'PO-' . fake()->unique()->numerify('######'),
            'date'          => fake()->date(),
            'supplier_name' => fake()->company(),
            'subtotal'      => 0,
            'tax_amount'    => 0,
            'total_amount'  => 0,
            'payment_terms' => '30 hari',
            'status'        => 'DRAFT',
            'created_by'    => User::factory(),
        ];
    }

    public function approved(): static
    {
        return $this->state(fn () => ['status' => 'APPROVED']);
    }

    public function pendingApproval(): static
    {
        return $this->state(fn () => ['status' => 'PENDING_APPROVAL']);
    }

    public function received(): static
    {
        return $this->state(fn () => ['status' => 'RECEIVED']);
    }
}
