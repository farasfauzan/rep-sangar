<?php

namespace Database\Factories;

use App\Models\Opname;
use App\Models\Spk;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Opname>
 */
class OpnameFactory extends Factory
{
    protected $model = Opname::class;

    protected static int $counter = 0;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'spk_id' => Spk::factory(),
            'opname_number' => 'OPN-' . str_pad(++self::$counter, 5, '0', STR_PAD_LEFT),
            'date' => fake()->dateTimeBetween('-3 months', 'now'),
            'progress_percentage' => fake()->randomFloat(2, 5, 100),
            'amount' => fake()->randomFloat(2, 1000000, 500000000),
            'status' => fake()->randomElement(['PENDING', 'APPROVED']),
            'approved_by' => null,
        ];
    }

    /**
     * Indicate that the opname is approved.
     */
    public function approved(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'APPROVED',
            'approved_by' => User::factory(),
        ]);
    }

    /**
     * Indicate that the opname is pending.
     */
    public function pending(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'PENDING',
        ]);
    }
}
