<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('complaint_user', function (Blueprint $table) {
            $table->id();
            $table->foreignId('complaint_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['complaint_id', 'user_id']);
        });

        if (Schema::hasColumn('complaints', 'assigned_user_id')) {
            $rows = DB::table('complaints')
                ->whereNotNull('assigned_user_id')
                ->select('id', 'assigned_user_id')
                ->get();

            $now = now();

            foreach ($rows as $row) {
                DB::table('complaint_user')->insert([
                    'complaint_id' => $row->id,
                    'user_id' => $row->assigned_user_id,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('complaint_user');
    }
};
