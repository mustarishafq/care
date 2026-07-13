<?php

namespace Database\Seeders;

use App\Support\Permissions;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class RoleSeeder extends Seeder
{
    /**
     * @return list<array{
     *   slug: string,
     *   name: string,
     *   description: string,
     *   permissions: list<string>,
     *   is_admin: bool,
     *   sort_order: int,
     *   default_page: string,
     *   complaint_visibility: string
     * }>
     */
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
                'default_page' => '/dashboard',
                'complaint_visibility' => Permissions::COMPLAINT_VISIBILITY_ALL,
            ],
            [
                'slug' => 'admin',
                'name' => 'Admin',
                'description' => 'Full access to all features',
                'permissions' => [],
                'is_admin' => true,
                'sort_order' => 1,
                'default_page' => '/dashboard',
                'complaint_visibility' => Permissions::COMPLAINT_VISIBILITY_ALL,
            ],
            [
                'slug' => 'management',
                'name' => 'Management',
                'description' => 'Management access to all features',
                'permissions' => [],
                'is_admin' => true,
                'sort_order' => 2,
                'default_page' => '/dashboard',
                'complaint_visibility' => Permissions::COMPLAINT_VISIBILITY_ALL,
            ],
            [
                'slug' => 'customer_service',
                'name' => 'Customer Service',
                'description' => 'Handle complaints and customer communication',
                'permissions' => [
                    'complaints.view', 'complaints.create', 'complaints.edit',
                    'complaints.assign', 'complaints.change_status', 'complaints.add_notes',
                    'products.view', 'reviews.view', 'marketplace.view',
                ],
                'is_admin' => false,
                'sort_order' => 3,
                'default_page' => '/complaints',
                'complaint_visibility' => Permissions::COMPLAINT_VISIBILITY_DEPARTMENT,
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
                'default_page' => '/kanban',
                'complaint_visibility' => Permissions::COMPLAINT_VISIBILITY_DEPARTMENT,
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
                'default_page' => '/kanban',
                'complaint_visibility' => Permissions::COMPLAINT_VISIBILITY_DEPARTMENT,
            ],
            [
                'slug' => 'viewer',
                'name' => 'Viewer',
                'description' => 'Read-only access to complaints and reports',
                'permissions' => ['complaints.view', 'reports.view', 'analytics.view', 'products.view', 'reviews.view'],
                'is_admin' => false,
                'sort_order' => 6,
                'default_page' => '/dashboard',
                'complaint_visibility' => Permissions::COMPLAINT_VISIBILITY_DEPARTMENT,
            ],
        ];
    }

    public function run(): void
    {
        if (! Schema::hasTable('roles')) {
            return;
        }

        foreach (self::definitions() as $definition) {
            $payload = [
                'name' => $definition['name'],
                'description' => $definition['description'],
                'permissions' => json_encode($definition['permissions']),
                'is_active' => true,
                'is_system' => true,
                'is_admin' => $definition['is_admin'],
                'sort_order' => $definition['sort_order'],
                'created_at' => now(),
                'updated_at' => now(),
            ];

            if (Schema::hasColumn('roles', 'default_page')) {
                $payload['default_page'] = $definition['default_page'];
            }

            if (Schema::hasColumn('roles', 'complaint_visibility')) {
                $payload['complaint_visibility'] = $definition['complaint_visibility'];
            }

            DB::table('roles')->updateOrInsert(
                ['slug' => $definition['slug']],
                $payload
            );
        }
    }
}
