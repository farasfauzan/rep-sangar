<?php

namespace Tests\Feature\Api;

use App\Models\Role;
use App\Models\User;

class UserControllerTest extends TestCase
{
    // ─── INDEX ────────────────────────────────────────────────────────────

    public function test_admin_can_list_users(): void
    {
        $this->actingAsRole('ADMIN');
        User::factory()->count(3)->create();

        $this->getJson('/api/users')
            ->assertOk()
            ->assertJsonStructure([
                'success',
                'data' => [
                    'data',
                    'current_page',
                    'per_page',
                    'total',
                ],
            ])
            ->assertJson(['success' => true]);
    }

    public function test_lapangan_cannot_list_users(): void
    {
        $this->actingAsRole('LAPANGAN');

        $this->getJson('/api/users')
            ->assertForbidden();
    }

    // ─── SHOW ─────────────────────────────────────────────────────────────

    public function test_admin_can_show_user(): void
    {
        $this->actingAsRole('ADMIN');
        $user = User::factory()->create(['name' => 'Test User']);

        $this->getJson("/api/users/{$user->id}")
            ->assertOk()
            ->assertJsonPath('data.name', 'Test User')
            ->assertJsonPath('success', true);
    }

    // ─── STORE ────────────────────────────────────────────────────────────

    public function test_admin_can_create_user(): void
    {
        $this->actingAsRole('ADMIN');
        $role = $this->role('ENGINEER');

        $this->postJson('/api/users', [
            'name'                  => 'User Baru',
            'email'                 => 'baru@example.com',
            'password'              => 'password123',
            'password_confirmation' => 'password123',
            'role_id'               => $role->id,
        ])
            ->assertCreated()
            ->assertJsonPath('data.name', 'User Baru')
            ->assertJsonPath('success', true);

        $this->assertDatabaseHas('users', ['email' => 'baru@example.com']);
    }

    public function test_store_validates_required_fields(): void
    {
        $this->actingAsRole('ADMIN');

        $this->postJson('/api/users', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name', 'email', 'password']);
    }

    public function test_store_validates_password_confirmation(): void
    {
        $this->actingAsRole('ADMIN');

        $this->postJson('/api/users', [
            'name'                  => 'Test',
            'email'                 => 'test@example.com',
            'password'              => 'password123',
            'password_confirmation' => 'mismatch',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['password']);
    }

    public function test_store_rejects_duplicate_email(): void
    {
        $this->actingAsRole('ADMIN');
        User::factory()->create(['email' => 'taken@example.com']);

        $this->postJson('/api/users', [
            'name'                  => 'Dup',
            'email'                 => 'taken@example.com',
            'password'              => 'password123',
            'password_confirmation' => 'password123',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['email']);
    }

    // ─── UPDATE ───────────────────────────────────────────────────────────

    public function test_admin_can_update_user(): void
    {
        $this->actingAsRole('ADMIN');
        $user = User::factory()->create(['name' => 'Old Name']);

        $this->putJson("/api/users/{$user->id}", [
            'name' => 'New Name',
        ])
            ->assertOk()
            ->assertJsonPath('data.name', 'New Name');

        $this->assertDatabaseHas('users', ['id' => $user->id, 'name' => 'New Name']);
    }

    public function test_update_can_change_email(): void
    {
        $this->actingAsRole('ADMIN');
        $user = User::factory()->create();

        $this->putJson("/api/users/{$user->id}", [
            'email' => 'newemail@example.com',
        ])
            ->assertOk();

        $this->assertDatabaseHas('users', ['id' => $user->id, 'email' => 'newemail@example.com']);
    }

    // ─── ASSIGN ROLE ──────────────────────────────────────────────────────

    public function test_admin_can_assign_role(): void
    {
        $this->actingAsRole('ADMIN');
        $user = $this->createUser('LAPANGAN');
        $newRole = $this->role('ENGINEER');

        $this->putJson("/api/users/{$user->id}/role", [
            'role_id' => $newRole->id,
        ])
            ->assertOk()
            ->assertJsonPath('data.role_id', $newRole->id);

        $this->assertDatabaseHas('users', ['id' => $user->id, 'role_id' => $newRole->id]);
    }

    public function test_assign_role_validates_role_id(): void
    {
        $this->actingAsRole('ADMIN');
        $user = User::factory()->create();

        $this->putJson("/api/users/{$user->id}/role", [
            'role_id' => 99999,
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['role_id']);
    }

    public function test_lapangan_cannot_assign_role(): void
    {
        $this->actingAsRole('LAPANGAN');
        $user = User::factory()->create();

        $this->putJson("/api/users/{$user->id}/role", [
            'role_id' => 1,
        ])
            ->assertForbidden();
    }

    // ─── DESTROY ──────────────────────────────────────────────────────────

    public function test_admin_can_delete_user(): void
    {
        $this->actingAsRole('ADMIN');
        $user = User::factory()->create();

        $this->deleteJson("/api/users/{$user->id}")
            ->assertOk();

        $this->assertSoftDeleted('users', ['id' => $user->id]);
    }

    public function test_admin_cannot_delete_self(): void
    {
        $admin = $this->actingAsRole('ADMIN');

        $this->deleteJson("/api/users/{$admin->id}")
            ->assertUnprocessable();
    }
}
