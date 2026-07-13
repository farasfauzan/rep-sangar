<?php

namespace Database\Factories;

use App\Models\Invoice;
use App\Models\PurchaseOrder;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Invoice>
 */
class InvoiceFactory extends Factory
{
    protected $model = Invoice::class;

    public function definition(): array
    {
        return [
            'invoiceable_type' => PurchaseOrder::class,
            'invoiceable_id'   => PurchaseOrder::factory(),
            'invoice_number'   => 'INV-' . fake()->unique()->numerify('######'),
            'invoice_date'     => fake()->date(),
            'due_date'         => fake()->dateTimeBetween('+30 days', '+60 days')->format('Y-m-d'),
            'amount'           => fake()->numberBetween(50000, 10000000),
            'status'           => 'PENDING_ENGINEER',
        ];
    }

    public function pendingEngineer(): static
    {
        return $this->state(fn () => ['status' => 'PENDING_ENGINEER']);
    }

    public function engineerVerified(): static
    {
        return $this->state(fn () => ['status' => 'ENGINEER_VERIFIED']);
    }

    public function pendingApproval(): static
    {
        return $this->state(fn () => ['status' => 'PENDING_APPROVAL']);
    }

    public function unpaid(): static
    {
        return $this->state(fn () => ['status' => 'UNPAID']);
    }

    public function paid(): static
    {
        return $this->state(fn () => ['status' => 'PAID']);
    }
}
