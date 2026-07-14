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

            if (in_array('reviews.view', $permissions, true) || in_array('oms.view', $permissions, true)) {
                $updated[] = 'orders.view';
            }

            if (in_array('reviews.manage', $permissions, true) || in_array('oms.manage', $permissions, true)) {
                $updated[] = 'orders.manage';
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

        $remove = ['orders.view', 'orders.manage'];

        foreach (DB::table('roles')->orderBy('id')->get() as $role) {
            $permissions = json_decode($role->permissions ?? '[]', true);
            if (! is_array($permissions)) {
                continue;
            }

            DB::table('roles')->where('id', $role->id)->update([
                'permissions' => json_encode(array_values(array_diff($permissions, $remove))),
                'updated_at' => now(),
            ]);
        }
    }
};
