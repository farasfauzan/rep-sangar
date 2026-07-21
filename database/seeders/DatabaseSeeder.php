<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed only the baseline access configuration.
     *
     * Operational records (projects, RAB, PO, SPK, and so on) must be created
     * through the application, rather than being reintroduced on a database reset.
     */
    public function run(): void
    {
        $roles = [
            'ADMIN',
            'LAPANGAN',
            'ENGINEER',
            'PURCHASING_LEGAL',
            'VERIFIKATOR_KEU',
            'MGR_KOMERSIAL',
            'KEU_KANTOR',
            'PAJAK',
            'ACCOUNTING',
        ];

        foreach ($roles as $roleName) {
            Role::firstOrCreate(['role_name' => $roleName]);
        }

        $adminRole = Role::where('role_name', 'ADMIN')->firstOrFail();

        User::firstOrCreate(
            ['email' => 'admin@erp.com'],
            [
                'name' => 'Admin',
                'password' => Hash::make('password'),
                'role_id' => $adminRole->id,
                'email_verified_at' => now(),
            ],
        );

        // Create additional user accounts for each role
        $roleUsers = [
            ['name' => 'Lapangan', 'email' => 'lapangan@erp.com', 'role' => 'LAPANGAN'],
            ['name' => 'Engineer', 'email' => 'engineer@erp.com', 'role' => 'ENGINEER'],
            ['name' => 'Purchasing Legal', 'email' => 'purchasing_legal@erp.com', 'role' => 'PURCHASING_LEGAL'],
            ['name' => 'Verifikator Keuangan', 'email' => 'verifikator_keu@erp.com', 'role' => 'VERIFIKATOR_KEU'],
            ['name' => 'Manager Komersial', 'email' => 'mgr_komersial@erp.com', 'role' => 'MGR_KOMERSIAL'],
            ['name' => 'Keuangan Kantor', 'email' => 'keu_kantor@erp.com', 'role' => 'KEU_KANTOR'],
            ['name' => 'Pajak', 'email' => 'pajak@erp.com', 'role' => 'PAJAK'],
            ['name' => 'Accounting', 'email' => 'accounting@erp.com', 'role' => 'ACCOUNTING'],
        ];

        foreach ($roleUsers as $userData) {
            $role = Role::where('role_name', $userData['role'])->firstOrFail();
            User::firstOrCreate(
                ['email' => $userData['email']],
                [
                    'name' => $userData['name'],
                    'password' => Hash::make('password'),
                    'role_id' => $role->id,
                    'email_verified_at' => now(),
                ],
            );
        }
    }
}
