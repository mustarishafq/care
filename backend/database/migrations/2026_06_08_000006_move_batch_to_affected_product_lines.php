<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('complaint_affected_products', function (Blueprint $table) {
            $table->string('batch_number')->nullable()->after('product_id');
        });

        $this->migrateBatchesToLines();

        Schema::dropIfExists('complaint_affected_product_batches');
    }

    public function down(): void
    {
        Schema::create('complaint_affected_product_batches', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('complaint_affected_product_id');
            $table->string('batch_number');
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();

            $table->foreign('complaint_affected_product_id', 'capb_cap_id_foreign')
                ->references('id')->on('complaint_affected_products')->cascadeOnDelete();
            $table->index(['complaint_affected_product_id', 'sort_order'], 'capb_cap_sort_idx');
        });

        $lines = DB::table('complaint_affected_products')->orderBy('complaint_id')->orderBy('sort_order')->get();

        foreach ($lines->groupBy('complaint_id') as $complaintLines) {
            $grouped = $complaintLines->groupBy(fn ($line) => implode('|', [
                $line->product_id,
                $line->quantity_affected,
                $line->unit_of_measurement_id,
            ]));

            $sortOrder = 0;
            foreach ($grouped as $group) {
                $first = $group->first();
                $affectedProductId = DB::table('complaint_affected_products')->insertGetId([
                    'complaint_id' => $first->complaint_id,
                    'product_id' => $first->product_id,
                    'quantity_affected' => $first->quantity_affected,
                    'unit_of_measurement_id' => $first->unit_of_measurement_id,
                    'sort_order' => $sortOrder++,
                    'created_at' => $first->created_at,
                    'updated_at' => $first->updated_at,
                ]);

                foreach ($group->values() as $batchOrder => $line) {
                    if (! $line->batch_number) {
                        continue;
                    }

                    DB::table('complaint_affected_product_batches')->insert([
                        'complaint_affected_product_id' => $affectedProductId,
                        'batch_number' => $line->batch_number,
                        'sort_order' => $batchOrder,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }
            }
        }

        DB::table('complaint_affected_products')->whereNotNull('batch_number')->delete();
        DB::table('complaint_affected_products')->update(['batch_number' => null]);

        Schema::table('complaint_affected_products', function (Blueprint $table) {
            $table->dropColumn('batch_number');
        });
    }

    private function migrateBatchesToLines(): void
    {
        if (! Schema::hasTable('complaint_affected_product_batches')) {
            return;
        }

        $affectedProducts = DB::table('complaint_affected_products')->orderBy('id')->get();

        foreach ($affectedProducts as $affectedProduct) {
            $batches = DB::table('complaint_affected_product_batches')
                ->where('complaint_affected_product_id', $affectedProduct->id)
                ->orderBy('sort_order')
                ->pluck('batch_number')
                ->all();

            if ($batches === []) {
                continue;
            }

            DB::table('complaint_affected_products')
                ->where('id', $affectedProduct->id)
                ->update(['batch_number' => $batches[0]]);

            $complaintSort = (int) DB::table('complaint_affected_products')
                ->where('complaint_id', $affectedProduct->complaint_id)
                ->max('sort_order');

            foreach (array_slice($batches, 1) as $batchNumber) {
                $complaintSort++;
                DB::table('complaint_affected_products')->insert([
                    'complaint_id' => $affectedProduct->complaint_id,
                    'product_id' => $affectedProduct->product_id,
                    'batch_number' => $batchNumber,
                    'quantity_affected' => null,
                    'unit_of_measurement_id' => null,
                    'sort_order' => $complaintSort,
                    'created_at' => $affectedProduct->created_at,
                    'updated_at' => $affectedProduct->updated_at,
                ]);
            }
        }
    }
};
