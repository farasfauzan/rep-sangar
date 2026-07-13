<?php

namespace Database\Factories;

use App\Models\Tax;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Tax>
 */
class TaxFactory extends Factory
{
    protected $model = Tax::class;

    public function definition(): array
    {
        return [
            'name'        => fake()->word() . ' Tax',
            'rate'        => fake()->randomElement([0.01, 0.02, 0.10, 0.11, 0.15, 0.20, 0.25]),
            'type'        => fake()->randomElement(['ppn', 'pph', 'other']),
            'is_active'   => true,
            'description' => fake()->optional()->sentence(),
        ];
    }

    public function inactive(): static
    {
        return $this->state(fn () => ['is_active' => false]);
    }
}
