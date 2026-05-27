<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class RoleSeeder extends Seeder
{
    /** @return list<array{slug: string, name: string, description: string, permissions: list<string>, is_admin: bool, sort_order: int}> */
    public static function definitions(): array
    {
        return [
            [
                'slug' => 'super_admin',
                'name' => 'Super Admin',
                'description' => 'Full access to all features',
                'permissions' => [],
                'is_admin' => true,
                'sort_order' => 0,
            ],
            [
                'slug' => 'admin',
                'name' => 'Admin',
                'description' => 'Full access to all features',
                'permissions' => [],
                'is_admin' => true,
                'sort_order' => 1,
            ],
            [
                'slug' => 'management',
                'name' => 'Management',
                'description' => 'Management access to all features',
                'permissions' => [],
                'is_admin' => true,
                'sort_order' => 2,
            ],
            [
                'slug' => 'customer_service',
                'name' => 'Customer Service',
                'description' => 'Handle complaints and customer communication',
                'permissions' => [
                    'complaints.view', 'complaints.create', 'complaints.edit',
                    'complaints.assign', 'complaints.change_status', 'complaints.add_notes',
                    'products.view',
                ],
                'is_admin' => false,
                'sort_order' => 3,
            ],
            [
                'slug' => 'fulfillment',
                'name' => 'Fulfillment',
                'description' => 'Process approved replacements and shipments',
                'permissions' => [
                    'complaints.view', 'complaints.edit', 'complaints.change_status',
                    'complaints.add_notes', 'products.view',
                ],
                'is_admin' => false,
                'sort_order' => 4,
            ],
            [
                'slug' => 'logistics',
                'name' => 'Logistics',
                'description' => 'Track shipments and update delivery status',
                'permissions' => [
                    'complaints.view', 'complaints.change_status', 'complaints.add_notes',
                    'products.view',
                ],
                'is_admin' => false,
                'sort_order' => 5,
            ],
            [
                'slug' => 'viewer',
                'name' => 'Viewer',
                'description' => 'Read-only access to complaints and reports',
                'permissions' => ['complaints.view', 'reports.view', 'products.view'],
                'is_admin' => false,
                'sort_order' => 6,
            ],
        ];
    }

    public function run(): void
    {
        if (! Schema::hasTable('roles')) {
            return;
        }

        foreach (self::definitions() as $definition) {
            DB::table('roles')->updateOrInsert(
                ['slug' => $definition['slug']],
                [
                    'name' => $definition['name'],
                    'description' => $definition['description'],
                    'permissions' => json_encode($definition['permissions']),
                    'is_active' => true,
                    'is_system' => true,
                    'is_admin' => $definition['is_admin'],
                    'sort_order' => $definition['sort_order'],
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );
        }
    }
}
