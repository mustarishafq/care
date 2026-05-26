<?php

namespace App\Support;

class Permissions
{
    public const ADMIN_ROLES = ['super_admin', 'admin', 'management'];

    /** @var array<string, string> */
    public const BUILTIN_ROLE_LABELS = [
        'super_admin' => 'Super Admin',
        'admin' => 'Admin',
        'customer_service' => 'Customer Service',
        'fulfillment' => 'Fulfillment',
        'logistics' => 'Logistics',
        'management' => 'Management',
        'viewer' => 'Viewer',
    ];

    /** @var array<string, list<string>> */
    public const BUILTIN_ROLE_PERMISSIONS = [
        'customer_service' => [
            'complaints.view', 'complaints.create', 'complaints.edit',
            'complaints.assign', 'complaints.change_status', 'complaints.add_notes',
            'products.view',
        ],
        'fulfillment' => [
            'complaints.view', 'complaints.edit', 'complaints.change_status',
            'complaints.add_notes', 'products.view',
        ],
        'logistics' => [
            'complaints.view', 'complaints.change_status', 'complaints.add_notes',
            'products.view',
        ],
        'viewer' => ['complaints.view', 'reports.view', 'products.view'],
    ];

    /**
     * @return list<string>
     */
    public static function allKeys(): array
    {
        return [
            'complaints.view', 'complaints.create', 'complaints.edit', 'complaints.delete',
            'complaints.assign', 'complaints.change_status', 'complaints.add_notes',
            'reports.view', 'reports.export',
            'users.view', 'users.invite', 'users.manage',
            'products.view', 'products.manage',
            'settings.view', 'settings.manage',
            'oms.view', 'oms.manage',
        ];
    }
}
