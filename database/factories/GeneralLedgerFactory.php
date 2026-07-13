<?php

namespace Database\Factories;

use App\Models\ChartOfAccount;
use App\Models\GeneralLedger;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<GeneralLedger>
 */
class GeneralLedgerFactory extends Factory
{
    protected $model = GeneralLedger::class;

    public function definition(): array
    {
        return [
            'journal_number'   => 'JRN-' . fake()->date('Ymd') . '-' . fake()->unique()->numerify('####'),
            'transaction_date' => fake()->date(),
            'account_code'     => ChartOfAccount::factory(),
            'debit'            => 0,
            'credit'           => 0,
            'description'      => fake()->optional()->sentence(),
            'reference_type'   => null,
            'reference_id'     => null,
            'project_id'       => null,
            'created_by'       => User::factory(),
        ];
    }
}
