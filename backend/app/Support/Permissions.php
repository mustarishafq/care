<?php

namespace App\Support;

class Permissions
{
    /**
     * @return list<array{key: string, label: string, group: string}>
     */
    public static function catalog(): array
    {
        return [
            ['key' => 'complaints.view', 'label' => 'View Complaints', 'group' => 'Complaints'],
            ['key' => 'complaints.create', 'label' => 'Create Complaints', 'group' => 'Complaints'],
            ['key' => 'complaints.edit', 'label' => 'Edit Complaints', 'group' => 'Complaints'],
            ['key' => 'complaints.delete', 'label' => 'Delete Complaints', 'group' => 'Complaints'],
            ['key' => 'complaints.assign', 'label' => 'Assign Department/User', 'group' => 'Complaints'],
            ['key' => 'complaints.change_status', 'label' => 'Change Status', 'group' => 'Complaints'],
            ['key' => 'complaints.add_notes', 'label' => 'Add Internal Notes', 'group' => 'Complaints'],
            ['key' => 'reports.view', 'label' => 'View Reports', 'group' => 'Reports'],
            ['key' => 'reports.export', 'label' => 'Export Reports', 'group' => 'Reports'],
            ['key' => 'analytics.view', 'label' => 'View Analytics', 'group' => 'Analytics'],
            ['key' => 'users.view', 'label' => 'View Users', 'group' => 'Users'],
            ['key' => 'users.invite', 'label' => 'Invite Users', 'group' => 'Users'],
            ['key' => 'users.manage', 'label' => 'Manage Users & Roles', 'group' => 'Users'],
            ['key' => 'products.view', 'label' => 'View Products', 'group' => 'Products'],
            ['key' => 'products.manage', 'label' => 'Manage Products', 'group' => 'Products'],
            ['key' => 'settings.view', 'label' => 'View Settings', 'group' => 'Settings'],
            ['key' => 'settings.manage', 'label' => 'Manage Settings', 'group' => 'Settings'],
            ['key' => 'oms.view', 'label' => 'View Integrations', 'group' => 'Integrations'],
            ['key' => 'oms.manage', 'label' => 'Manage Integrations', 'group' => 'Integrations'],
            ['key' => 'reviews.view', 'label' => 'View Reviews', 'group' => 'Reviews'],
            ['key' => 'reviews.manage', 'label' => 'Manage Reviews', 'group' => 'Reviews'],
            ['key' => 'marketplace.view', 'label' => 'View Marketplace', 'group' => 'Marketplace'],
            ['key' => 'marketplace.manage', 'label' => 'Manage Marketplace', 'group' => 'Marketplace'],
        ];
    }

    /**
     * @return list<string>
     */
    public static function allKeys(): array
    {
        return array_column(self::catalog(), 'key');
    }

    /**
     * App pages that can be set as a role's default landing page.
     *
     * @return list<array{path: string, label: string}>
     */
    public static function defaultPages(): array
    {
        return [
            ['path' => '/dashboard', 'label' => 'Dashboard'],
            ['path' => '/complaints', 'label' => 'Complaints'],
            ['path' => '/marketplace-reviews', 'label' => 'Reviews'],
            ['path' => '/kanban', 'label' => 'Kanban'],
            ['path' => '/analytics', 'label' => 'Analytics'],
            ['path' => '/reports', 'label' => 'Reports'],
            ['path' => '/notifications', 'label' => 'Notifications'],
            ['path' => '/products', 'label' => 'Products'],
            ['path' => '/users', 'label' => 'Users'],
            ['path' => '/roles', 'label' => 'Roles'],
            ['path' => '/marketplace', 'label' => 'Marketplace'],
            ['path' => '/settings', 'label' => 'Settings'],
            ['path' => '/settings?tab=integrations', 'label' => 'Integrations'],
        ];
    }

    /**
     * @return list<string>
     */
    public static function defaultPagePaths(): array
    {
        return array_column(self::defaultPages(), 'path');
    }

    public const COMPLAINT_VISIBILITY_ALL = 'all';

    public const COMPLAINT_VISIBILITY_DEPARTMENT = 'department';

    public const COMPLAINT_VISIBILITY_ASSIGNED = 'assigned';

    /**
     * How far a role can see complaints.
     * Assigned agents always retain access to their tickets under department/assigned scopes.
     *
     * @return list<array{key: string, label: string, description: string}>
     */
    public static function complaintVisibilityOptions(): array
    {
        return [
            [
                'key' => self::COMPLAINT_VISIBILITY_ALL,
                'label' => 'All complaints',
                'description' => 'Can view every complaint in the system.',
            ],
            [
                'key' => self::COMPLAINT_VISIBILITY_DEPARTMENT,
                'label' => 'Department only',
                'description' => 'Can view complaints in their department(s), plus any ticket assigned to them.',
            ],
            [
                'key' => self::COMPLAINT_VISIBILITY_ASSIGNED,
                'label' => 'Assigned only',
                'description' => 'Can view only complaints assigned to them as an agent.',
            ],
        ];
    }

    /**
     * @return list<string>
     */
    public static function complaintVisibilityKeys(): array
    {
        return array_column(self::complaintVisibilityOptions(), 'key');
    }
}
