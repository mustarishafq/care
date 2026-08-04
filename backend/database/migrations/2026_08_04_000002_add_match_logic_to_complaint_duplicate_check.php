<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $config = DB::table('system_configs')->where('key', 'complaint_duplicate_check')->first();

        if (! $config) {
            return;
        }

        $raw = json_decode($config->json_value ?? '[]', true);
        if (! is_array($raw)) {
            $raw = [];
        }

        if (! array_key_exists('match_logic', $raw)) {
            $raw['match_logic'] = 'or';
            DB::table('system_configs')->where('key', 'complaint_duplicate_check')->update([
                'json_value' => json_encode($raw),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        $config = DB::table('system_configs')->where('key', 'complaint_duplicate_check')->first();

        if (! $config) {
            return;
        }

        $raw = json_decode($config->json_value ?? '[]', true);
        if (! is_array($raw) || ! array_key_exists('match_logic', $raw)) {
            return;
        }

        unset($raw['match_logic']);
        DB::table('system_configs')->where('key', 'complaint_duplicate_check')->update([
            'json_value' => json_encode($raw),
            'updated_at' => now(),
        ]);
    }
};
