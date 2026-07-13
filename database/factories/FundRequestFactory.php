<?php

namespace Database\Factories;

use App\Models\FundRequest;
use App\Models\Project;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<FundRequest>
 */
class FundRequestFactory extends Factory
{
    protected $model = FundRequest::class;

    public function definition(): array
    {
        return [
            'project_id'     => Project::factory(),
            'request_number' => 'FR-' . fake()->unique()->numerify('######'),
            'amount'         => fake()->numberBetween(50000, 5000000),
            'description'    => fake()->sentence(),
            'status'         => 'PENDING_APPROVAL',
            'requested_by'   => User::factory(),
        ];
    }

    public function approved(): static
    {
        return $this->state(fn () => [
            'status'      => 'APPROVED',
            'approved_at' => now(),
        ]);
    }

    public function paid(): static
    {
        return $this->state(fn () => [
            'status' => 'PAID',
            'paid_at' => now(),
        ]);
    }
}
