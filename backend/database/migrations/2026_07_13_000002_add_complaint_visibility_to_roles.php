<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('roles')) {
            return;
        }

        Schema::table('roles', function (Blueprint $table) {
            if (! Schema::hasColumn('roles', 'complaint_visibility')) {
                $table->string('complaint_visibility')->default('department')->after('default_page');
            }
        });

        // Admins keep full visibility; other roles keep today's department+assigned behavior.
        if (Schema::hasColumn('roles', 'complaint_visibility')) {
            DB::table('roles')->where('is_admin', true)->update([
                'complaint_visibility' => 'all',
                'updated_at' => now(),
            ]);

            DB::table('roles')->where('is_admin', false)->update([
                'complaint_visibility' => 'department',
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('roles') || ! Schema::hasColumn('roles', 'complaint_visibility')) {
            return;
        }

        Schema::table('roles', function (Blueprint $table) {
            $table->dropColumn('complaint_visibility');
        });
    }
};
