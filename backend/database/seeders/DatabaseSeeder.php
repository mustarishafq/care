<?php

namespace Database\Seeders;

use App\Models\ComplaintStatus;
use App\Models\ComplaintType;
use App\Models\Courier;
use App\Models\Department;
use App\Models\Priority;
use App\Models\Role;
use App\Models\SystemConfig;
use App\Models\UnitOfMeasurement;
use App\Services\AutoCloseDeliveredComplaintsService;
use App\Services\SlaSettingsService;
use Illuminate\Database\Seeder;
use App\Models\User;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call(RoleSeeder::class);

        $defaultDepartments = [
            'Customer Service',
            'Fulfillment',
            'Logistics',
            'Management',
            'Administration',
        ];

        foreach ($defaultDepartments as $index => $name) {
            Department::firstOrCreate(
                ['name' => $name],
                ['is_active' => true, 'sort_order' => $index]
            );
        }

        $defaultComplaintTypes = [
            'Damaged Product', 'Broken Item', 'Missing Item', 'Wrong Item', 'Leakage', 'Packaging Damage', 'Parcel Not Arrived', 'Other',
        ];

        foreach ($defaultComplaintTypes as $index => $name) {
            ComplaintType::firstOrCreate(
                ['name' => $name],
                ['is_active' => true, 'sort_order' => $index]
            );
        }

        $defaultCouriers = ['JNE', 'J&T', 'SiCepat', 'AnterAja', 'Pos Indonesia'];

        foreach ($defaultCouriers as $index => $name) {
            Courier::firstOrCreate(
                ['name' => $name],
                ['is_active' => true, 'sort_order' => $index]
            );
        }

        $defaultPriorities = [
            ['name' => 'Low', 'sla_hours' => 72],
            ['name' => 'Medium', 'sla_hours' => 48],
            ['name' => 'High', 'sla_hours' => 24],
            ['name' => 'Urgent', 'sla_hours' => 6],
        ];

        foreach ($defaultPriorities as $index => $priority) {
            Priority::firstOrCreate(
                ['name' => $priority['name']],
                ['sla_hours' => $priority['sla_hours'], 'is_active' => true, 'sort_order' => $index]
            );
        }

        $defaultUnits = ['Piece', 'Box', 'Carton', 'Kg', 'Gram', 'Liter', 'Pack'];

        foreach ($defaultUnits as $index => $name) {
            UnitOfMeasurement::firstOrCreate(
                ['name' => $name],
                ['is_active' => true, 'sort_order' => $index]
            );
        }

        $defaultStatuses = [
            'New Complaint',
            'Under Review',
            'Waiting for Customer',
            'Waiting for Vendor',
            'Approved Replacement',
            'Rejected',
            'Reprocessing by Fulfillment',
            'Ready to Ship',
            'Shipped',
            'Delivered',
            'Closed',
            'Drop',
        ];

        $defaultStatusColors = [
            'New Complaint' => '#3b82f6',
            'Under Review' => '#f59e0b',
            'Waiting for Customer' => '#f97316',
            'Waiting for Vendor' => '#eab308',
            'Approved Replacement' => '#10b981',
            'Rejected' => '#ef4444',
            'Reprocessing by Fulfillment' => '#a855f7',
            'Ready to Ship' => '#06b6d4',
            'Shipped' => '#6366f1',
            'Delivered' => '#14b8a6',
            'Closed' => '#6b7280',
            'Drop' => '#64748b',
        ];

        foreach ($defaultStatuses as $index => $name) {
            ComplaintStatus::firstOrCreate(
                ['name' => $name],
                [
                    'color' => $defaultStatusColors[$name] ?? '#6b7280',
                    'is_active' => true,
                    'sort_order' => $index,
                ]
            );
        }

        $administration = Department::where('name', 'Administration')->first();
        $superAdminRole = Role::where('slug', 'super_admin')->first();
        $viewerRole = Role::where('slug', 'viewer')->first();

        $admin = User::firstOrCreate(
            ['email' => 'admin@admin.com'],
            [
                'name' => 'Admin',
                'full_name' => 'System Administrator',
                'password' => 'password',
                'role_id' => $superAdminRole?->id ?? $viewerRole?->id,
                'status' => User::STATUS_ACTIVE,
                'approval_status' => User::APPROVAL_APPROVED,
            ]
        );

        if ($superAdminRole && $admin->role_id !== $superAdminRole->id) {
            $admin->update(['role_id' => $superAdminRole->id]);
        }

        if ($administration) {
            $admin->departments()->syncWithoutDetaching([$administration->id]);
        }

        $defaultConfigs = [
            [
                'key' => 'sla_settings',
                'label' => 'SLA Settings',
                'json_value' => [
                    'first_response' => 2,
                    'low' => 72,
                    'medium' => 48,
                    'high' => 24,
                    'urgent' => 6,
                    'stale_alert_hours' => 24,
                    'paused_status_ids' => ComplaintStatus::query()
                        ->whereIn('name', SlaSettingsService::DEFAULT_PAUSED_STATUS_NAMES)
                        ->pluck('id')
                        ->all(),
                    'resolved_status_ids' => ComplaintStatus::query()
                        ->whereIn('name', SlaSettingsService::DEFAULT_RESOLVED_STATUS_NAMES)
                        ->pluck('id')
                        ->all(),
                ],
            ],
            [
                'key' => 'nexus_sso',
                'label' => 'Nexus SSO Settings',
                'json_value' => [
                    'enabled' => false,
                    'secret' => '',
                    'issuer' => '',
                    'default_role_id' => $viewerRole?->id,
                ],
            ],
            [
                'key' => 'webhook_api_key',
                'label' => 'Webhook Secret',
                'json_value' => ['secret' => bin2hex(random_bytes(32))],
            ],
            [
                'key' => 'outgoing_webhook',
                'label' => 'Outgoing Webhooks',
                'json_value' => [
                    'webhooks' => [],
                ],
            ],
            [
                'key' => 'auto_close_delivered',
                'label' => 'Auto-Close Delivered Tickets',
                'json_value' => [
                    'enabled' => false,
                    'delay_amount' => 1,
                    'delay_unit' => 'days',
                    'trigger_status_id' => ComplaintStatus::query()
                        ->where('name', AutoCloseDeliveredComplaintsService::DEFAULT_TRIGGER_STATUS_NAME)
                        ->value('id'),
                    'target_status_id' => ComplaintStatus::query()
                        ->where('name', AutoCloseDeliveredComplaintsService::DEFAULT_TARGET_STATUS_NAME)
                        ->value('id'),
                ],
            ],
        ];

        foreach ($defaultConfigs as $config) {
            SystemConfig::firstOrCreate(
                ['key' => $config['key']],
                $config
            );
        }
    }
}
