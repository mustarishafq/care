<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('complaints', function (Blueprint $table) {
            $table->timestamp('delivered_at')->nullable()->after('resolved_at');
        });

        $deliveredId = DB::table('complaint_statuses')->where('name', 'Delivered')->value('id');

        if ($deliveredId) {
            DB::table('complaints')
                ->where('status_id', $deliveredId)
                ->whereNull('delivered_at')
                ->update(['delivered_at' => DB::raw('COALESCE(resolved_at, updated_at)')]);
        }
    }

    public function down(): void
    {
        Schema::table('complaints', function (Blueprint $table) {
            $table->dropColumn('delivered_at');
        });
    }
};
