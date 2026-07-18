<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\Role;
use App\Models\User;
use App\Services\Rab\RabImportService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use Tests\TestCase;

class ManualRabImportTest extends TestCase
{
    use RefreshDatabase;

    public function test_non_rab_sheet_can_still_be_read_as_a_complete_excel_preview(): void
    {
        $workbook = new Spreadsheet();
        $sheet = $workbook->getActiveSheet();
        $sheet->setTitle('REKAP Tot');
        $sheet->setCellValue('A1', 'Rekap proyek');
        $sheet->setCellValue('C3', 'Nilai kontrak');
        $sheet->setCellValue('C4', 125000000);
        $path = storage_path('framework/testing/raw-preview-'.uniqid().'.xlsx');
        IOFactory::createWriter($workbook, 'Xlsx')->save($path);
        $workbook->disconnectWorksheets();

        try {
            $preview = app(RabImportService::class)->previewSheet($path, 'REKAP Tot', 100);

            $this->assertNull($preview['strategy']);
            $this->assertSame([], $preview['rows']);
            $this->assertSame(['A', 'B', 'C'], $preview['raw_columns']);
            $this->assertCount(4, $preview['raw_rows']);
            $this->assertSame('Rekap proyek', $preview['raw_rows'][0]['values']['A']);
            $this->assertSame(125000000, $preview['raw_rows'][3]['values']['C']);
        } finally {
            @unlink($path);
        }
    }

    public function test_reviewed_rows_are_imported_with_manual_folder_categories(): void
    {
        $role = Role::create(['role_name' => 'ADMIN']);
        $user = User::factory()->create(['role_id' => $role->id]);
        $project = Project::create([
            'project_name' => 'Proyek Import Manual',
            'location' => 'Jakarta',
            'start_date' => '2026-07-16',
        ]);

        $response = $this->actingAs($user)->postJson('/api/rab/import/manual', [
            'project_id' => $project->id,
            'replace_existing' => true,
            'rows' => [
                [
                    'code_item' => 'M-001',
                    'description' => 'Semen Portland',
                    'unit' => 'zak',
                    'volume' => 2,
                    'unit_price' => 50000,
                    'total_price' => 100000,
                    'category' => 'Material',
                    'group' => 'Struktur',
                ],
                [
                    'code_item' => 'S-001',
                    'description' => 'Borongan struktur',
                    'unit' => 'ls',
                    'volume' => 1,
                    'unit_price' => 200000,
                    'total_price' => 200000,
                    'category' => 'Subkon',
                    'group' => 'Struktur',
                ],
            ],
        ]);

        $response->assertOk()->assertJsonPath('data.imported', 2);
        $this->assertDatabaseHas('rab_budgets', ['code_item' => 'M-001', 'category' => 'Material / Struktur']);
        $this->assertDatabaseHas('rab_budgets', ['code_item' => 'S-001', 'category' => 'Subkon / Struktur']);
        $this->assertDatabaseCount('inventory_stocks', 0);
    }

    public function test_category_is_required_for_every_reviewed_row(): void
    {
        $role = Role::create(['role_name' => 'ADMIN']);
        $user = User::factory()->create(['role_id' => $role->id]);
        $project = Project::create([
            'project_name' => 'Proyek Import Manual',
            'location' => 'Jakarta',
            'start_date' => '2026-07-16',
        ]);

        $this->actingAs($user)->postJson('/api/rab/import/manual', [
            'project_id' => $project->id,
            'rows' => [[
                'description' => 'Item belum dipilah',
                'volume' => 1,
                'unit_price' => 1000,
                'total_price' => 1000,
                'category' => '',
            ]],
        ])->assertUnprocessable()->assertJsonValidationErrors('rows.0.category');
    }

    public function test_missing_excel_code_gets_readable_category_and_row_code(): void
    {
        $role = Role::create(['role_name' => 'ADMIN']);
        $user = User::factory()->create(['role_id' => $role->id]);
        $project = Project::factory()->create();

        $this->actingAs($user)->postJson('/api/rab/import/manual', [
            'project_id' => $project->id,
            'rows' => [[
                'row_number' => 23,
                'code_item' => '',
                'description' => 'Besi tulangan',
                'unit' => 'kg',
                'volume' => 10,
                'unit_price' => 15000,
                'total_price' => 150000,
                'category' => 'Material',
            ]],
        ])->assertOk();

        $this->assertDatabaseHas('rab_budgets', [
            'project_id' => $project->id,
            'code_item' => 'RAB-MAT-0023',
        ]);
    }

    public function test_one_item_can_be_saved_and_resaved_without_creating_duplicates(): void
    {
        $role = Role::create(['role_name' => 'ADMIN']);
        $user = User::factory()->create(['role_id' => $role->id]);
        $project = Project::create([
            'project_name' => 'Proyek Per Item',
            'location' => 'Jakarta',
            'start_date' => '2026-07-16',
        ]);

        $payload = [
            'project_id' => $project->id,
            'file_fingerprint' => str_repeat('a', 64),
            'sheet' => 'RAB GIK UGM',
            'row_number' => 11,
            'code_item' => '',
            'description' => 'Pengukuran dan pemasangan Bouwplank',
            'unit' => 'm1',
            'volume' => 120,
            'unit_price' => 62700,
            'total_price' => 7524000,
            'category' => 'Subkon',
            'group' => 'Persiapan',
        ];

        $this->actingAs($user)->postJson('/api/rab/import/manual-item', $payload)
            ->assertOk()
            ->assertJsonPath('data.created', true);

        $payload['category'] = 'Material';
        $payload['group'] = 'Struktur';
        $this->actingAs($user)->postJson('/api/rab/import/manual-item', $payload)
            ->assertOk()
            ->assertJsonPath('data.created', false);

        $this->assertDatabaseCount('rab_budgets', 1);
        $this->assertDatabaseHas('rab_budgets', [
            'project_id' => $project->id,
            'code_item' => 'RAB-MAT-0011',
            'category' => 'Material / Struktur',
            'source_row' => 11,
        ]);
        $this->assertDatabaseCount('inventory_stocks', 0);
    }

    public function test_first_user_claims_a_row_for_parallel_review(): void
    {
        $role = Role::create(['role_name' => 'ADMIN']);
        $firstUser = User::factory()->create(['role_id' => $role->id]);
        $secondUser = User::factory()->create(['role_id' => $role->id]);
        $project = Project::create([
            'project_name' => 'Proyek Klaim Baris',
            'location' => 'Jakarta',
            'start_date' => '2026-07-16',
        ]);

        $payload = [
            'project_id' => $project->id,
            'file_fingerprint' => str_repeat('b', 64),
            'sheet' => 'RAB GIK UGM',
            'row_number' => 12,
            'description' => 'Papan nama proyek',
            'unit' => 'unit',
            'volume' => 1,
            'unit_price' => 1750000,
            'total_price' => 1750000,
            'category' => 'Material',
            'group' => 'Persiapan',
        ];

        $this->actingAs($firstUser)->postJson('/api/rab/import/manual-item', $payload)->assertOk();

        $payload['category'] = 'Pekerja';
        $response = $this->actingAs($secondUser)->postJson('/api/rab/import/manual-item', $payload);
        $response->assertStatus(409)->assertJsonPath('success', false);

        $this->assertDatabaseHas('rab_budgets', [
            'project_id' => $project->id,
            'category' => 'Material / Persiapan',
            'source_row' => 12,
        ]);
    }

    public function test_manual_status_returns_items_saved_by_other_reviewers(): void
    {
        $role = Role::create(['role_name' => 'ADMIN']);
        $user = User::factory()->create(['role_id' => $role->id]);
        $project = Project::create([
            'project_name' => 'Proyek Status Baris',
            'location' => 'Jakarta',
            'start_date' => '2026-07-16',
        ]);

        $this->actingAs($user)->postJson('/api/rab/import/manual-item', [
            'project_id' => $project->id,
            'file_fingerprint' => str_repeat('c', 64),
            'sheet' => 'RAB GIK UGM',
            'row_number' => 13,
            'description' => 'Pembuatan gudang',
            'unit' => 'm2',
            'volume' => 80,
            'unit_price' => 1587657,
            'total_price' => 127012560,
            'category' => 'Subkon',
            'group' => 'Persiapan',
        ])->assertOk();

        $this->actingAs($user)->postJson('/api/rab/import/manual-status', [
            'project_id' => $project->id,
            'file_fingerprint' => str_repeat('c', 64),
            'sheet' => 'RAB GIK UGM',
        ])->assertOk()->assertJsonPath('data.0.source_row', 13)->assertJsonPath('data.0.category', 'Subkon');
    }

    public function test_unfinished_preview_rows_can_be_resumed_as_a_draft(): void
    {
        $role = Role::create(['role_name' => 'ADMIN']);
        $user = User::factory()->create(['role_id' => $role->id]);
        $project = Project::create([
            'project_name' => 'Proyek Draft Import',
            'location' => 'Jakarta',
            'start_date' => '2026-07-16',
        ]);
        $fingerprint = str_repeat('d', 64);

        $this->actingAs($user)->postJson('/api/rab/import/draft-rows', [
            'project_id' => $project->id,
            'file_id' => 'draft-file.xlsx',
            'file_fingerprint' => $fingerprint,
            'original_name' => 'RAB Proyek.xlsx',
            'sheet' => 'RAB GIK UGM',
            'rows' => [[
                'row_number' => 11,
                'code_item' => '',
                'description' => 'Pengukuran dan pemasangan Bouwplank',
                'unit' => 'm1',
                'volume' => 120,
                'unit_price' => 62700,
                'total_price' => 7524000,
                'category' => null,
                'group' => null,
            ]],
        ])->assertOk()->assertJsonPath('data.drafted', 1);

        $this->actingAs($user)->patchJson('/api/rab/import/draft-row', [
            'project_id' => $project->id,
            'file_fingerprint' => $fingerprint,
            'sheet' => 'RAB GIK UGM',
            'row_number' => 11,
            'category' => 'Material',
            'group' => 'Struktur',
        ])->assertOk();

        $this->actingAs($user)->getJson('/api/rab/import/drafts?project_id='.$project->id)
            ->assertOk()->assertJsonPath('data.0.pending_rows', 1);

        $this->actingAs($user)->getJson('/api/rab/import/drafts/'.$fingerprint.'?project_id='.$project->id)
            ->assertOk()
            ->assertJsonPath('data.original_name', 'RAB Proyek.xlsx')
            ->assertJsonPath('data.rows.0.row_number', 11)
            ->assertJsonPath('data.rows.0.save_state', 'idle')
            ->assertJsonPath('data.rows.0.category', 'Material')
            ->assertJsonPath('data.rows.0.group', 'Struktur');
    }
}
