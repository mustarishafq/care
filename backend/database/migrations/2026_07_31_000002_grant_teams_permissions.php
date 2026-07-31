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

            // Roles that already manage settings also manage teams globally.
            if (! in_array('settings.manage', $permissions, true)) {
                continue;
            }

            $changed = false;

            foreach (['teams.view', 'teams.manage'] as $key) {
                if (! in_array($key, $permissions, true)) {
                    $permissions[] = $key;
                    $changed = true;
                }
            }

            if (! $changed) {
                continue;
            }

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

            $updated = array_values(array_diff($permissions, ['teams.view', 'teams.manage']));

            DB::table('roles')->where('id', $role->id)->update([
                'permissions' => json_encode($updated),
                'updated_at' => now(),
            ]);
        }
    }
};
