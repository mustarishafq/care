<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::table('complaint_types')->where('name', 'Parcel Not Arrived')->exists()) {
            return;
        }

        $otherOrder = DB::table('complaint_types')->where('name', 'Other')->value('sort_order');

        if ($otherOrder !== null) {
            DB::table('complaint_types')
                ->where('sort_order', '>=', $otherOrder)
                ->increment('sort_order');

            $sortOrder = (int) $otherOrder;
        } else {
            $sortOrder = (int) DB::table('complaint_types')->max('sort_order') + 1;
        }

        DB::table('complaint_types')->insert([
            'name' => 'Parcel Not Arrived',
            'is_active' => true,
            'sort_order' => $sortOrder,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        if (! DB::table('complaint_types')->where('name', 'Parcel Not Arrived')->exists()) {
            return;
        }

        $sortOrder = DB::table('complaint_types')->where('name', 'Parcel Not Arrived')->value('sort_order');

        DB::table('complaint_types')->where('name', 'Parcel Not Arrived')->delete();

        if ($sortOrder !== null) {
            DB::table('complaint_types')
                ->where('sort_order', '>', $sortOrder)
                ->decrement('sort_order');
        }
    }
};
