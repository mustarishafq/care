<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('complaint_affected_product_batches');
        Schema::dropIfExists('complaint_affected_products');

        Schema::create('complaint_affected_products', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('complaint_id');
            $table->unsignedBigInteger('product_id')->nullable();
            $table->unsignedInteger('quantity_affected')->nullable();
            $table->unsignedBigInteger('unit_of_measurement_id')->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();

            $table->foreign('complaint_id', 'cap_complaint_id_foreign')
                ->references('id')->on('complaints')->cascadeOnDelete();
            $table->foreign('product_id', 'cap_product_id_foreign')
                ->references('id')->on('products')->nullOnDelete();
            $table->foreign('unit_of_measurement_id', 'cap_unit_id_foreign')
                ->references('id')->on('units_of_measurement')->nullOnDelete();
            $table->index(['complaint_id', 'sort_order'], 'cap_complaint_sort_idx');
        });

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

        $this->migrateExistingData();

        Schema::table('complaints', function (Blueprint $table) {
            if (Schema::hasColumn('complaints', 'affected_products')) {
                $table->dropColumn('affected_products');
            }

            if (Schema::hasColumn('complaints', 'unit_of_measurement_id')) {
                $table->dropConstrainedForeignId('unit_of_measurement_id');
            }

            if (Schema::hasColumn('complaints', 'product_id')) {
                $table->dropConstrainedForeignId('product_id');
            }

            if (Schema::hasColumn('complaints', 'batch_number')) {
                $table->dropColumn('batch_number');
            }

            if (Schema::hasColumn('complaints', 'quantity_affected')) {
                $table->dropColumn('quantity_affected');
            }
        });
    }

    public function down(): void
    {
        Schema::table('complaints', function (Blueprint $table) {
            $table->foreignId('product_id')->nullable()->after('order_source')->constrained('products')->nullOnDelete();
            $table->unsignedInteger('quantity_affected')->nullable()->after('product_id');
            $table->foreignId('unit_of_measurement_id')->nullable()->after('quantity_affected')->constrained('units_of_measurement')->nullOnDelete();
            $table->string('batch_number')->nullable()->after('order_source');
            $table->json('affected_products')->nullable()->after('unit_of_measurement_id');
        });

        $complaints = DB::table('complaint_affected_products')
            ->orderBy('complaint_id')
            ->orderBy('sort_order')
            ->get()
            ->groupBy('complaint_id');

        foreach ($complaints as $complaintId => $items) {
            $first = $items->first();
            $batches = DB::table('complaint_affected_product_batches')
                ->where('complaint_affected_product_id', $first->id)
                ->orderBy('sort_order')
                ->pluck('batch_number')
                ->all();

            DB::table('complaints')->where('id', $complaintId)->update([
                'product_id' => $first->product_id,
                'quantity_affected' => $first->quantity_affected,
                'unit_of_measurement_id' => $first->unit_of_measurement_id,
                'batch_number' => $batches[0] ?? null,
            ]);
        }

        Schema::dropIfExists('complaint_affected_product_batches');
        Schema::dropIfExists('complaint_affected_products');
    }

    private function migrateExistingData(): void
    {
        $complaints = DB::table('complaints')->orderBy('id')->get();

        foreach ($complaints as $complaint) {
            $items = $this->resolveItemsForComplaint($complaint);

            foreach ($items as $sortOrder => $item) {
                $affectedProductId = DB::table('complaint_affected_products')->insertGetId([
                    'complaint_id' => $complaint->id,
                    'product_id' => $item['product_id'],
                    'quantity_affected' => $item['quantity_affected'],
                    'unit_of_measurement_id' => $item['unit_of_measurement_id'],
                    'sort_order' => $sortOrder,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                foreach ($item['batch_numbers'] as $batchOrder => $batchNumber) {
                    DB::table('complaint_affected_product_batches')->insert([
                        'complaint_affected_product_id' => $affectedProductId,
                        'batch_number' => $batchNumber,
                        'sort_order' => $batchOrder,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }
            }
        }
    }

    /** @return list<array{product_id: ?int, quantity_affected: ?int, unit_of_measurement_id: ?int, batch_numbers: list<string>}> */
    private function resolveItemsForComplaint(object $complaint): array
    {
        if (! empty($complaint->affected_products)) {
            $decoded = json_decode($complaint->affected_products, true);

            if (is_array($decoded) && $decoded !== []) {
                return collect($decoded)->map(fn (array $item) => [
                    'product_id' => isset($item['product_id']) ? (int) $item['product_id'] : null,
                    'quantity_affected' => isset($item['quantity_affected']) ? (int) $item['quantity_affected'] : null,
                    'unit_of_measurement_id' => isset($item['unit_of_measurement_id']) ? (int) $item['unit_of_measurement_id'] : null,
                    'batch_numbers' => array_values(array_filter($item['batch_numbers'] ?? [])),
                ])->filter(fn (array $item) => $item['product_id'])->values()->all();
            }
        }

        if (! $complaint->product_id) {
            return [];
        }

        return [[
            'product_id' => (int) $complaint->product_id,
            'quantity_affected' => $complaint->quantity_affected !== null ? (int) $complaint->quantity_affected : null,
            'unit_of_measurement_id' => $complaint->unit_of_measurement_id !== null ? (int) $complaint->unit_of_measurement_id : null,
            'batch_numbers' => array_values(array_filter([$complaint->batch_number ?? null])),
        ]];
    }
};
