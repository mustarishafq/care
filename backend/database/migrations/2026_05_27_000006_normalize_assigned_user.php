<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('complaints', 'assigned_user') && ! Schema::hasColumn('complaints', 'assigned_user_id')) {
            Schema::table('complaints', function (Blueprint $table) {
                $table->foreignId('assigned_user_id')->nullable()->after('assigned_department_id')->constrained('users')->nullOnDelete();
            });

            DB::table('complaints')
                ->whereNotNull('assigned_user')
                ->where('assigned_user', '!=', '')
                ->orderBy('id')
                ->each(function ($complaint) {
                    $userId = DB::table('users')->where('email', trim($complaint->assigned_user))->value('id');
                    if ($userId) {
                        DB::table('complaints')->where('id', $complaint->id)->update([
                            'assigned_user_id' => $userId,
                        ]);
                    }
                });

            Schema::table('complaints', function (Blueprint $table) {
                $table->dropColumn(['assigned_user', 'assigned_user_name']);
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('complaints', 'assigned_user_id')) {
            Schema::table('complaints', function (Blueprint $table) {
                $table->string('assigned_user')->nullable()->after('assigned_department_id');
                $table->string('assigned_user_name')->nullable()->after('assigned_user');
            });

            DB::table('complaints')
                ->whereNotNull('assigned_user_id')
                ->orderBy('id')
                ->each(function ($complaint) {
                    $user = DB::table('users')->where('id', $complaint->assigned_user_id)->first();
                    if ($user) {
                        DB::table('complaints')->where('id', $complaint->id)->update([
                            'assigned_user' => $user->email,
                            'assigned_user_name' => $user->full_name ?? $user->name,
                        ]);
                    }
                });

            Schema::table('complaints', function (Blueprint $table) {
                $table->dropConstrainedForeignId('assigned_user_id');
            });
        }
    }
};
