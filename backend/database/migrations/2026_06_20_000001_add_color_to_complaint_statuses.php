<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** @var array<string, string> */
    private array $defaultColors = [
        'New Complaint' => '#3b82f6',
        'Under Review' => '#f59e0b',
        'Waiting for Customer' => '#f97316',
        'Waiting for Vendor' => '#eab308',
        'Approved Replacement' => '#10b981',
        'Rejected' => '#ef4444',
        'Reprocessing by Fulfillment' => '#a855f7',
        'Ready to Ship' => '#06b6d4',
        'Shipped' => '#6366f1',
        'Delivered' => '#14b8a6',
        'Closed' => '#6b7280',
        'Drop' => '#64748b',
    ];

    public function up(): void
    {
        Schema::table('complaint_statuses', function (Blueprint $table) {
            $table->string('color', 7)->nullable()->after('name');
        });

        foreach ($this->defaultColors as $name => $color) {
            DB::table('complaint_statuses')
                ->where('name', $name)
                ->whereNull('color')
                ->update(['color' => $color, 'updated_at' => now()]);
        }
    }

    public function down(): void
    {
        Schema::table('complaint_statuses', function (Blueprint $table) {
            $table->dropColumn('color');
        });
    }
};
