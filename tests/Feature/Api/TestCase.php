<?php

namespace Tests\Feature\Api;

use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    use RefreshDatabase;

    /**
     * Cached role IDs keyed by role_name to avoid duplicate DB lookups.
     *
     * @var array<string, int>
     */
    private static array $roleCache = [];

    /**
     * Boot a fresh role set once per test class.  Roles are cheap to create
     * and shared across every test in the class via the cache.
     */
    protected function setUp(): void
    {
        parent::setUp();
        self::$roleCache = [];
    }

    /**
     * Get-or-create a Role by its name.  Results are cached per test so we
     * only hit the DB once per unique role name.
     */
    protected function role(string $name): Role
    {
        if (! isset(self::$roleCache[$name])) {
            $r = Role::firstOrCreate(['role_name' => $name]);
            self::$roleCache[$name] = $r->id;
        }

        return Role::find(self::$roleCache[$name]);
    }

    /**
     * Create a User with the given role name.
     */
    protected function createUser(string $roleName = 'ADMIN', array $overrides = []): User
    {
        $roleId = $this->role($roleName)->id;

        return User::factory()->create(array_merge([
            'role_id' => $roleId,
            'email_verified_at' => now(),
        ], $overrides));
    }

    /**
     * Shorthand: create user + actingAs in one call.
     */
    protected function actingAsRole(string $roleName = 'ADMIN'): User
    {
        $user = $this->createUser($roleName);
        $this->actingAs($user);

        return $user;
    }
}
