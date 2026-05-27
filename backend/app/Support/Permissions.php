<?php

namespace App\Support;

class Permissions
{
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
