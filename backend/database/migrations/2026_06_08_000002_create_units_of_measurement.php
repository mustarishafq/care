<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('units_of_measurement', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->boolean('is_active')->default(true);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });

        $defaults = ['Piece', 'Box', 'Carton', 'Kg', 'Gram', 'Liter', 'Pack'];

        foreach ($defaults as $index => $name) {
            DB::table('units_of_measurement')->insert([
                'name' => $name,
                'is_active' => true,
                'sort_order' => $index,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        Schema::table('complaints', function (Blueprint $table) {
            $table->foreignId('unit_of_measurement_id')
                ->nullable()
                ->after('quantity_affected')
                ->constrained('units_of_measurement')
                ->nullOnDelete();
        });

        if (Schema::hasColumn('complaints', 'unit_of_measurement')) {
            DB::table('complaints')
                ->whereNotNull('unit_of_measurement')
                ->orderBy('id')
                ->each(function ($complaint) {
                    $unitId = DB::table('units_of_measurement')
                        ->where('name', $complaint->unit_of_measurement)
                        ->value('id');

                    if ($unitId) {
                        DB::table('complaints')
                            ->where('id', $complaint->id)
                            ->update(['unit_of_measurement_id' => $unitId]);
                    }
                });

            Schema::table('complaints', function (Blueprint $table) {
                $table->dropColumn('unit_of_measurement');
            });
        }
    }

    public function down(): void
    {
        Schema::table('complaints', function (Blueprint $table) {
            $table->string('unit_of_measurement')->nullable()->after('quantity_affected');
        });

        DB::table('complaints')
            ->whereNotNull('unit_of_measurement_id')
            ->orderBy('id')
            ->each(function ($complaint) {
                $name = DB::table('units_of_measurement')
                    ->where('id', $complaint->unit_of_measurement_id)
                    ->value('name');

                if ($name) {
                    DB::table('complaints')
                        ->where('id', $complaint->id)
                        ->update(['unit_of_measurement' => $name]);
                }
            });

        Schema::table('complaints', function (Blueprint $table) {
            $table->dropConstrainedForeignId('unit_of_measurement_id');
        });

        Schema::dropIfExists('units_of_measurement');
    }
};
