<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (! DB::table('complaint_statuses')->where('name', 'Waiting for Vendor')->exists()) {
            DB::table('complaint_statuses')
                ->where('sort_order', '>=', 3)
                ->increment('sort_order');

            DB::table('complaint_statuses')->insert([
                'name' => 'Waiting for Vendor',
                'is_active' => true,
                'sort_order' => 3,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        if (! DB::table('complaint_statuses')->where('name', 'Drop')->exists()) {
            $maxOrder = (int) DB::table('complaint_statuses')->max('sort_order');

            DB::table('complaint_statuses')->insert([
                'name' => 'Drop',
                'is_active' => true,
                'sort_order' => $maxOrder + 1,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        if (DB::table('complaint_statuses')->where('name', 'Waiting for Vendor')->exists()) {
            DB::table('complaint_statuses')->where('name', 'Waiting for Vendor')->delete();
            DB::table('complaint_statuses')
                ->where('sort_order', '>', 3)
                ->decrement('sort_order');
        }

        DB::table('complaint_statuses')->where('name', 'Drop')->delete();
    }
};
