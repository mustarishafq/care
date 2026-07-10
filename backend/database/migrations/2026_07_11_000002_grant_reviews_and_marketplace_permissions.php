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

            $updated = $permissions;

            if (in_array('oms.view', $permissions, true) || in_array('oms.manage', $permissions, true)) {
                $updated[] = 'reviews.view';
                $updated[] = 'marketplace.view';
            }

            if (in_array('oms.manage', $permissions, true)) {
                $updated[] = 'reviews.manage';
                $updated[] = 'marketplace.manage';
            }

            $updated = array_values(array_unique($updated));

            if ($updated !== $permissions) {
                DB::table('roles')->where('id', $role->id)->update([
                    'permissions' => json_encode($updated),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('roles')) {
            return;
        }

        $remove = ['reviews.view', 'reviews.manage', 'marketplace.view', 'marketplace.manage'];

        foreach (DB::table('roles')->orderBy('id')->get() as $role) {
            $permissions = json_decode($role->permissions ?? '[]', true);
            if (! is_array($permissions)) {
                continue;
            }

            $updated = array_values(array_diff($permissions, $remove));

            DB::table('roles')->where('id', $role->id)->update([
                'permissions' => json_encode($updated),
                'updated_at' => now(),
            ]);
        }
    }
};
