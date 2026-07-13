<?php

namespace Database\Factories;

use App\Models\Project;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Project>
 */
class ProjectFactory extends Factory
{
    protected $model = Project::class;

    public function definition(): array
    {
        return [
            'project_name' => fake()->company() . ' Project',
            'location'     => fake()->city(),
            'start_date'   => fake()->date(),
            'status'       => 'planning',
        ];
    }
}
