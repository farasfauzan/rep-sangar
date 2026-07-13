<?php

namespace Database\Factories;

use App\Models\Spk;
use App\Models\Project;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Spk>
 */
class SpkFactory extends Factory
{
    protected $model = Spk::class;

    public function definition(): array
    {
        return [
            'project_id'    => Project::factory(),
            'spk_number'    => 'SPK-' . fake()->unique()->numerify('######'),
            'subcon_name'   => fake()->company(),
            'subtotal'      => 100000,
            'tax_amount'    => 11000,
            'total_amount'  => 111000,
            'payment_terms' => 'Berdasarkan opname',
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
}
