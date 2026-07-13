<?php

namespace Database\Factories;

use App\Models\RabBudget;
use App\Models\Project;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<RabBudget>
 */
class RabBudgetFactory extends Factory
{
    protected $model = RabBudget::class;

    public function definition(): array
    {
        $volume    = fake()->numberBetween(1, 100);
        $unitPrice = fake()->numberBetween(5000, 200000);

        return [
            'project_id'  => Project::factory(),
            'code_item'   => 'MAT-' . fake()->unique()->numerify('###'),
            'description' => fake()->words(3, true),
            'unit'        => fake()->randomElement(['Zak', 'Pcs', 'm3', 'Kg', 'Lbr']),
            'volume'      => $volume,
            'unit_price'  => $unitPrice,
            'total_price' => $volume * $unitPrice,
            'category'    => fake()->randomElement(['Material', 'Upah', 'Alat']),
            'status'      => RabBudget::STATUS_DRAFT,
        ];
    }

    public function approved(): static
    {
        return $this->state(fn () => ['status' => RabBudget::STATUS_APPROVED]);
    }

    public function pending(): static
    {
        return $this->state(fn () => ['status' => RabBudget::STATUS_PENDING]);
    }
}
