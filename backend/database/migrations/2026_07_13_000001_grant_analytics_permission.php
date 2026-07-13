<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('roles')) {
            return;
        }

        foreach (DB::table('roles')->orderBy('id')->get() as $role) {
            $permissions = json_decode($role->permissions ?? '[]', true);
            if (! is_array($permissions)) {
                $permissions = [];
            }

            // Roles that could already see Analytics via reports.view keep access.
            if (! in_array('reports.view', $permissions, true)) {
                continue;
            }

            if (in_array('analytics.view', $permissions, true)) {
                continue;
            }

            $permissions[] = 'analytics.view';

            DB::table('roles')->where('id', $role->id)->update([
                'permissions' => json_encode(array_values($permissions)),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('roles')) {
            return;
        }

        foreach (DB::table('roles')->orderBy('id')->get() as $role) {
            $permissions = json_decode($role->permissions ?? '[]', true);
            if (! is_array($permissions)) {
                continue;
            }

            $updated = array_values(array_diff($permissions, ['analytics.view']));

            DB::table('roles')->where('id', $role->id)->update([
                'permissions' => json_encode($updated),
                'updated_at' => now(),
            ]);
        }
    }
};
