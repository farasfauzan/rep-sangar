<?php

namespace Tests\Feature\Api;

use App\Models\Project;

class ProjectControllerTest extends TestCase
{
    // ─── INDEX ────────────────────────────────────────────────────────────

    public function test_index_returns_paginated_projects(): void
    {
        $this->actingAsRole('LAPANGAN');
        Project::factory()->count(3)->create();

        $this->getJson('/api/projects')
            ->assertOk()
            ->assertJsonStructure([
                'success',
                'data' => [
                    'data' => [
                        '*' => ['id', 'project_name', 'location', 'start_date', 'status'],
                    ],
                    'current_page',
                    'per_page',
                    'total',
                ],
            ])
            ->assertJson(['success' => true]);
    }

    // ─── SHOW ─────────────────────────────────────────────────────────────

    public function test_show_returns_project_with_rab_budgets(): void
    {
        $this->actingAsRole('ENGINEER');
        $project = Project::factory()->create();

        $this->getJson("/api/projects/{$project->id}")
            ->assertOk()
            ->assertJsonPath('data.id', $project->id)
            ->assertJsonPath('success', true);
    }

    public function test_show_returns_404_for_nonexistent_project(): void
    {
        $this->actingAsRole('ADMIN');

        $this->getJson('/api/projects/99999')
            ->assertNotFound();
    }

    // ─── STORE ────────────────────────────────────────────────────────────

    public function test_admin_can_create_project(): void
    {
        $this->actingAsRole('ADMIN');

        $this->postJson('/api/projects', [
            'project_name' => 'Proyek Baru',
            'location'     => 'Bandung',
            'start_date'   => '2026-08-01',
        ])
            ->assertCreated()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.project_name', 'Proyek Baru');

        $this->assertDatabaseHas('projects', [
            'project_name' => 'Proyek Baru',
            'location'     => 'Bandung',
        ]);
    }

    public function test_mgr_komersial_can_create_project(): void
    {
        $this->actingAsRole('MGR_KOMERSIAL');

        $this->postJson('/api/projects', [
            'project_name' => 'Proyek Komersial',
            'location'     => 'Surabaya',
            'start_date'   => '2026-09-01',
        ])
            ->assertCreated();
    }

    public function test_store_validates_required_fields(): void
    {
        $this->actingAsRole('ADMIN');

        $this->postJson('/api/projects', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['project_name', 'location', 'start_date']);
    }

    public function test_lapangan_cannot_create_project(): void
    {
        $this->actingAsRole('LAPANGAN');

        $this->postJson('/api/projects', [
            'project_name' => 'Tidak Boleh',
            'location'     => 'Jakarta',
            'start_date'   => '2026-08-01',
        ])
            ->assertForbidden();
    }

    // ─── UPDATE ───────────────────────────────────────────────────────────

    public function test_admin_can_update_project(): void
    {
        $this->actingAsRole('ADMIN');
        $project = Project::factory()->create(['status' => 'planning']);

        $this->putJson("/api/projects/{$project->id}", [
            'project_name' => 'Nama Diubah',
            'status'       => 'active',
        ])
            ->assertOk()
            ->assertJsonPath('data.project_name', 'Nama Diubah')
            ->assertJsonPath('data.status', 'active');

        $this->assertDatabaseHas('projects', [
            'id'     => $project->id,
            'status' => 'active',
        ]);
    }

    public function test_update_rejects_invalid_status(): void
    {
        $this->actingAsRole('ADMIN');
        $project = Project::factory()->create();

        $this->putJson("/api/projects/{$project->id}", [
            'status' => 'bogus_status',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['status']);
    }

    // ─── DESTROY ──────────────────────────────────────────────────────────

    public function test_admin_can_delete_project(): void
    {
        $this->actingAsRole('ADMIN');
        $project = Project::factory()->create();

        $this->deleteJson("/api/projects/{$project->id}")
            ->assertOk();

        $this->assertDatabaseMissing('projects', ['id' => $project->id]);
    }

    public function test_engineer_cannot_delete_project(): void
    {
        $this->actingAsRole('ENGINEER');
        $project = Project::factory()->create();

        $this->deleteJson("/api/projects/{$project->id}")
            ->assertForbidden();
    }
}
