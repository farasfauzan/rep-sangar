<?php

namespace Database\Factories;

use App\Models\Role;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Role>
 */
class RoleFactory extends Factory
{
    protected $model = Role::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'role_name' => fake()->randomElement([
                'Admin',
                'Project Manager',
                'Site Engineer',
                'Quantity Surveyor',
                'Procurement',
                'Finance',
                'Viewer',
                'Supervisor',
                'Foreman',
                'Accounting',
            ]),
        ];
    }
}
