<?php

namespace Tests\Feature\Api;

use App\Models\ChartOfAccount;
use App\Models\GeneralLedger;

class GeneralLedgerControllerTest extends TestCase
{
    // ─── INDEX ────────────────────────────────────────────────────────────

    public function test_index_returns_paginated_journal_entries(): void
    {
        $this->actingAsRole('ACCOUNTING');
        $coa = ChartOfAccount::factory()->create();

        GeneralLedger::factory()->count(3)->create([
            'account_code' => $coa->code,
        ]);

        $this->getJson('/api/general-ledger')
            ->assertOk()
            ->assertJsonStructure([
                'current_page',
                'data',
                'per_page',
                'total',
            ]);
    }

    public function test_index_supports_date_range_filter(): void
    {
        $this->actingAsRole('ADMIN');
        $coa = ChartOfAccount::factory()->create();

        GeneralLedger::factory()->create([
            'account_code'     => $coa->code,
            'transaction_date' => '2026-01-15',
        ]);
        GeneralLedger::factory()->create([
            'account_code'     => $coa->code,
            'transaction_date' => '2026-06-15',
        ]);

        $response = $this->getJson('/api/general-ledger?date_from=2026-03-01&date_to=2026-12-31')
            ->assertOk();

        $this->assertEquals(1, $response->json('total'));
    }

    // ─── SHOW ─────────────────────────────────────────────────────────────

    public function test_show_returns_journal_lines_by_number(): void
    {
        $this->actingAsRole('ACCOUNTING');
        $coa1 = ChartOfAccount::factory()->create(['type' => 'asset']);
        $coa2 = ChartOfAccount::factory()->create(['type' => 'expense']);
        $journalNumber = 'JRN-20260713-0001';

        GeneralLedger::factory()->create([
            'journal_number' => $journalNumber,
            'account_code'   => $coa1->code,
            'debit'          => 0,
            'credit'         => 100000,
        ]);
        GeneralLedger::factory()->create([
            'journal_number' => $journalNumber,
            'account_code'   => $coa2->code,
            'debit'          => 100000,
            'credit'         => 0,
        ]);

        $this->getJson("/api/general-ledger/{$journalNumber}")
            ->assertOk()
            ->assertJsonPath('journal_number', $journalNumber)
            ->assertJsonPath('is_balanced', true)
            ->assertJsonCount(2, 'entries');
    }

    public function test_show_returns_404_for_missing_journal(): void
    {
        $this->actingAsRole('ADMIN');

        $this->getJson('/api/general-ledger/JRN-99999999-9999')
            ->assertNotFound();
    }

    // ─── STORE (DOUBLE-ENTRY) ─────────────────────────────────────────────

    public function test_accounting_can_create_balanced_journal_entry(): void
    {
        $user = $this->actingAsRole('ACCOUNTING');
        $coa1 = ChartOfAccount::factory()->create(['type' => 'asset']);
        $coa2 = ChartOfAccount::factory()->create(['type' => 'expense']);

        $this->postJson('/api/general-ledger', [
            'transaction_date' => '2026-07-13',
            'description'      => 'Pembelian perlengkapan kantor',
            'entries'          => [
                ['account_code' => $coa1->code, 'debit' => 0, 'credit' => 500000],
                ['account_code' => $coa2->code, 'debit' => 500000, 'credit' => 0],
            ],
        ])
            ->assertCreated()
            ->assertJsonStructure(['message', 'journal_number', 'entries']);

        $this->assertDatabaseCount('general_ledgers', 2);
    }

    public function test_store_rejects_unequal_debit_and_credit(): void
    {
        $user = $this->actingAsRole('ACCOUNTING');
        $coa = ChartOfAccount::factory()->create();

        $this->postJson('/api/general-ledger', [
            'transaction_date' => '2026-07-13',
            'entries'          => [
                ['account_code' => $coa->code, 'debit' => 500000, 'credit' => 0],
                ['account_code' => $coa->code, 'debit' => 0, 'credit' => 300000],
            ],
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['entries']);
    }

    public function test_store_validates_minimum_two_entries(): void
    {
        $user = $this->actingAsRole('ACCOUNTING');
        $coa = ChartOfAccount::factory()->create();

        $this->postJson('/api/general-ledger', [
            'transaction_date' => '2026-07-13',
            'entries'          => [
                ['account_code' => $coa->code, 'debit' => 100000, 'credit' => 0],
            ],
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['entries']);
    }

    public function test_store_validates_account_code_exists(): void
    {
        $user = $this->actingAsRole('ACCOUNTING');

        $this->postJson('/api/general-ledger', [
            'transaction_date' => '2026-07-13',
            'entries'          => [
                ['account_code' => '9999', 'debit' => 100000, 'credit' => 0],
                ['account_code' => '8888', 'debit' => 0, 'credit' => 100000],
            ],
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['entries.0.account_code', 'entries.1.account_code']);
    }

    public function test_purchasing_cannot_create_journal_entry(): void
    {
        $this->actingAsRole('PURCHASING_LEGAL');

        $this->postJson('/api/general-ledger', [
            'transaction_date' => '2026-07-13',
            'entries'          => [
                ['account_code' => '1000', 'debit' => 100, 'credit' => 0],
                ['account_code' => '2000', 'debit' => 0, 'credit' => 100],
            ],
        ])
            ->assertForbidden();
    }

    // ─── TRIAL BALANCE ────────────────────────────────────────────────────

    public function test_trial_balance_returns_account_balances(): void
    {
        $this->actingAsRole('ACCOUNTING');
        $coa1 = ChartOfAccount::factory()->create(['type' => 'asset']);
        $coa2 = ChartOfAccount::factory()->create(['type' => 'expense']);

        GeneralLedger::factory()->create([
            'account_code' => $coa1->code,
            'debit'        => 0,
            'credit'       => 500000,
        ]);
        GeneralLedger::factory()->create([
            'account_code' => $coa2->code,
            'debit'        => 500000,
            'credit'       => 0,
        ]);

        $this->getJson('/api/general-ledger/trial-balance')
            ->assertOk()
            ->assertJsonStructure([
                'trial_balance',
                'total_debit',
                'total_credit',
                'is_balanced',
            ])
            ->assertJsonPath('is_balanced', true);
    }
}
