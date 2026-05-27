<?php

use Database\Seeders\RoleSeeder;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('roles', function (Blueprint $table) {
            if (! Schema::hasColumn('roles', 'slug')) {
                $table->string('slug')->nullable()->unique()->after('id');
            }
            if (! Schema::hasColumn('roles', 'is_system')) {
                $table->boolean('is_system')->default(false)->after('is_active');
            }
            if (! Schema::hasColumn('roles', 'is_admin')) {
                $table->boolean('is_admin')->default(false)->after('is_system');
            }
            if (! Schema::hasColumn('roles', 'sort_order')) {
                $table->unsignedSmallInteger('sort_order')->default(0)->after('is_admin');
            }
        });

        (new RoleSeeder)->run();

        if (! Schema::hasColumn('users', 'role_id')) {
            Schema::table('users', function (Blueprint $table) {
                $table->foreignId('role_id')->nullable()->after('phone')->constrained('roles')->nullOnDelete();
            });
        }

        if (Schema::hasColumn('users', 'role')) {
            DB::table('users')->orderBy('id')->each(function ($user) {
                $roleId = $this->resolveRoleId($user->role);
                if ($roleId) {
                    DB::table('users')->where('id', $user->id)->update(['role_id' => $roleId]);
                }
            });

            Schema::table('users', function (Blueprint $table) {
                $table->dropColumn('role');
            });
        }

        $this->migrateSsoDefaultRole();
    }

    public function down(): void
    {
        if (! Schema::hasColumn('users', 'role')) {
            Schema::table('users', function (Blueprint $table) {
                $table->string('role')->default('viewer')->after('phone');
            });

            DB::table('users')->orderBy('id')->each(function ($user) {
                if (! $user->role_id) {
                    return;
                }

                $role = DB::table('roles')->where('id', $user->role_id)->first();
                if (! $role) {
                    return;
                }

                DB::table('users')->where('id', $user->id)->update([
                    'role' => $role->slug ?: (string) $role->id,
                ]);
            });
        }

        if (Schema::hasColumn('users', 'role_id')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropConstrainedForeignId('role_id');
            });
        }

        if (Schema::hasColumn('roles', 'slug')) {
            Schema::table('roles', function (Blueprint $table) {
                $table->dropColumn(['slug', 'is_system', 'is_admin', 'sort_order']);
            });
        }
    }

    private function resolveRoleId(?string $role): ?int
    {
        if (! $role || trim($role) === '') {
            return $this->roleIdForSlug('viewer');
        }

        $trimmed = trim($role);

        if (ctype_digit($trimmed)) {
            $id = DB::table('roles')->where('id', (int) $trimmed)->value('id');

            return $id ? (int) $id : null;
        }

        $bySlug = DB::table('roles')->where('slug', $trimmed)->value('id');
        if ($bySlug) {
            return (int) $bySlug;
        }

        $byName = DB::table('roles')->where('name', $trimmed)->value('id');
        if ($byName) {
            return (int) $byName;
        }

        return $this->roleIdForSlug('viewer');
    }

    private function roleIdForSlug(string $slug): ?int
    {
        $id = DB::table('roles')->where('slug', $slug)->value('id');

        return $id ? (int) $id : null;
    }

    private function migrateSsoDefaultRole(): void
    {
        $config = DB::table('system_configs')->where('key', 'nexus_sso')->first();
        if (! $config || ! $config->json_value) {
            return;
        }

        $settings = json_decode($config->json_value, true);
        if (! is_array($settings) || isset($settings['default_role_id'])) {
            return;
        }

        $slug = $settings['default_role'] ?? 'viewer';
        $roleId = $this->roleIdForSlug(is_string($slug) ? $slug : 'viewer');
        if ($roleId) {
            $settings['default_role_id'] = $roleId;
        }
        unset($settings['default_role']);

        DB::table('system_configs')->where('key', 'nexus_sso')->update([
            'json_value' => json_encode($settings),
            'updated_at' => now(),
        ]);
    }
};
