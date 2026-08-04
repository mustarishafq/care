<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (! DB::table('system_configs')->where('key', 'complaint_duplicate_check')->exists()) {
            DB::table('system_configs')->insert([
                'key' => 'complaint_duplicate_check',
                'label' => 'Duplicate Complaints',
                'json_value' => json_encode([
                    'enabled' => false,
                    'fields' => ['tracking_number'],
                    'mode' => 'warn',
                    'match_logic' => 'or',
                ]),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        DB::table('system_configs')->where('key', 'complaint_duplicate_check')->delete();
    }
};
