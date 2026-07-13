<?php

namespace Database\Factories;

use App\Models\ChartOfAccount;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ChartOfAccount>
 */
class ChartOfAccountFactory extends Factory
{
    protected $model = ChartOfAccount::class;

    public function definition(): array
    {
        return [
            'code'      => fake()->unique()->numerify('####'),
            'name'      => fake()->words(3, true),
            'type'      => fake()->randomElement(ChartOfAccount::TYPES),
            'parent_id' => null,
            'is_active' => true,
        ];
    }
}
