<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (! DB::table('complaint_statuses')->where('name', 'Completed')->exists()) {
            $closedOrder = DB::table('complaint_statuses')->where('name', 'Closed')->value('sort_order');

            if ($closedOrder !== null) {
                DB::table('complaint_statuses')
                    ->where('sort_order', '>=', (int) $closedOrder)
                    ->increment('sort_order');

                $sortOrder = (int) $closedOrder;
            } else {
                $sortOrder = ((int) DB::table('complaint_statuses')->max('sort_order')) + 1;
            }

            DB::table('complaint_statuses')->insert([
                'name' => 'Completed',
                'color' => '#22c55e',
                'is_active' => true,
                'sort_order' => $sortOrder,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        if (! DB::table('system_configs')->where('key', 'order_sources')->exists()) {
            DB::table('system_configs')->insert([
                'key' => 'order_sources',
                'label' => 'Order Sources',
                'json_value' => json_encode([
                    'sources' => ['SiteGiant', 'FounderHQ', 'Shopee', 'TikTok'],
                ]),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        DB::table('system_configs')->where('key', 'order_sources')->delete();

        if (DB::table('complaint_statuses')->where('name', 'Completed')->exists()) {
            $completedOrder = (int) DB::table('complaint_statuses')->where('name', 'Completed')->value('sort_order');
            DB::table('complaint_statuses')->where('name', 'Completed')->delete();
            DB::table('complaint_statuses')
                ->where('sort_order', '>', $completedOrder)
                ->decrement('sort_order');
        }
    }
};
