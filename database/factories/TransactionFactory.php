<?php

namespace Database\Factories;

use App\Models\Transaction;
use App\Models\Invoice;
use App\Models\FundRequest;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Transaction>
 */
class TransactionFactory extends Factory
{
    protected $model = Transaction::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'invoice_id' => Invoice::factory(),
            'fund_request_id' => null,
            'payment_method' => fake()->randomElement(['bank_transfer', 'cash', 'check', 'e_wallet']),
            'amount' => fake()->randomFloat(2, 1000000, 100000000),
            'payment_date' => fake()->dateTimeBetween('-3 months', 'now'),
            'proof_of_payment' => fake()->optional(0.7)->filePath(),
        ];
    }

    /**
     * Create a transaction linked to a fund request instead of an invoice.
     */
    public function forFundRequest(): static
    {
        return $this->state(fn (array $attributes) => [
            'invoice_id' => null,
            'fund_request_id' => FundRequest::factory(),
        ]);
    }
}
