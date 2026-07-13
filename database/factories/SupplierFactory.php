<?php

namespace Database\Factories;

use App\Models\Supplier;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Supplier>
 */
class SupplierFactory extends Factory
{
    protected $model = Supplier::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->company(),
            'code' => 'SUP-' . fake()->unique()->numerify('####'),
            'npwp' => fake()->numerify('##.###.###.#-###.###'),
            'address' => fake()->address(),
            'phone' => fake()->phoneNumber(),
            'email' => fake()->unique()->safeEmail(),
            'bank_name' => fake()->randomElement(['BCA', 'Mandiri', 'BNI', 'BRI', 'CIMB Niaga', 'Permata', 'Danamon']),
            'bank_account_number' => fake()->numerify('################'),
            'bank_account_name' => fake()->company(),
            'contact_person' => fake()->name(),
            'notes' => fake()->optional(0.7)->sentence(),
            'is_active' => true,
        ];
    }

    /**
     * Indicate that the supplier is inactive.
     */
    public function inactive(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_active' => false,
        ]);
    }
}
