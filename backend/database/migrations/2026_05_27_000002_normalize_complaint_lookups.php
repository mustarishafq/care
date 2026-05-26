<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** @var array<string, int> */
    private array $defaultSlaHours = [
        'Low' => 72,
        'Medium' => 48,
        'High' => 24,
        'Urgent' => 6,
    ];

    public function up(): void
    {
        $this->createLookupTables();
        $this->seedLookups();
        $this->migrateComplaintColumns();
        $this->cleanupSystemConfigs();
    }

    public function down(): void
    {
        if (Schema::hasColumn('complaints', 'complaint_type_id')) {
            Schema::table('complaints', function (Blueprint $table) {
                $table->string('complaint_type')->nullable()->after('quantity_affected');
                $table->string('courier_name')->nullable()->after('proof_files');
                $table->string('priority')->default('Medium')->after('replacement_tracking_number');
            });

            DB::table('complaints')->orderBy('id')->each(function ($complaint) {
                $updates = [];
                if ($complaint->complaint_type_id) {
                    $updates['complaint_type'] = DB::table('complaint_types')->where('id', $complaint->complaint_type_id)->value('name');
                }
                if ($complaint->courier_id) {
                    $updates['courier_name'] = DB::table('couriers')->where('id', $complaint->courier_id)->value('name');
                }
                if ($complaint->priority_id) {
                    $updates['priority'] = DB::table('priorities')->where('id', $complaint->priority_id)->value('name');
                }
                if ($updates) {
                    DB::table('complaints')->where('id', $complaint->id)->update($updates);
                }
            });

            Schema::table('complaints', function (Blueprint $table) {
                $table->dropConstrainedForeignId('complaint_type_id');
                $table->dropConstrainedForeignId('courier_id');
                $table->dropConstrainedForeignId('priority_id');
            });
        }

        Schema::dropIfExists('priorities');
        Schema::dropIfExists('couriers');
        Schema::dropIfExists('complaint_types');
    }

    private function createLookupTables(): void
    {
        if (! Schema::hasTable('complaint_types')) {
            Schema::create('complaint_types', function (Blueprint $table) {
                $table->id();
                $table->string('name')->unique();
                $table->boolean('is_active')->default(true);
                $table->unsignedSmallInteger('sort_order')->default(0);
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('couriers')) {
            Schema::create('couriers', function (Blueprint $table) {
                $table->id();
                $table->string('name')->unique();
                $table->boolean('is_active')->default(true);
                $table->unsignedSmallInteger('sort_order')->default(0);
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('priorities')) {
            Schema::create('priorities', function (Blueprint $table) {
                $table->id();
                $table->string('name')->unique();
                $table->unsignedSmallInteger('sla_hours')->default(48);
                $table->boolean('is_active')->default(true);
                $table->unsignedSmallInteger('sort_order')->default(0);
                $table->timestamps();
            });
        }
    }

    private function seedLookups(): void
    {
        $this->seedNames('complaint_types', $this->collectNames('complaint_types', [
            'Damaged Product', 'Broken Item', 'Missing Item', 'Wrong Item', 'Leakage', 'Packaging Damage', 'Other',
        ], 'complaint_type'));

        $this->seedNames('couriers', $this->collectNames('couriers', [
            'JNE', 'J&T', 'SiCepat', 'AnterAja', 'Pos Indonesia',
        ], 'courier_name'));

        $priorityNames = $this->collectNames('priority_levels', [
            'Low', 'Medium', 'High', 'Urgent',
        ], 'priority');

        foreach ($priorityNames as $index => $name) {
            if (! is_string($name) || trim($name) === '') {
                continue;
            }

            $trimmed = trim($name);
            DB::table('priorities')->updateOrInsert(
                ['name' => $trimmed],
                [
                    'sla_hours' => $this->defaultSlaHours[$trimmed] ?? 48,
                    'is_active' => true,
                    'sort_order' => $index,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );
        }
    }

    /**
     * @param  list<string>  $defaults
     * @return list<string>
     */
    private function collectNames(string $configKey, array $defaults, ?string $complaintColumn = null): array
    {
        $names = $defaults;

        $config = DB::table('system_configs')->where('key', $configKey)->first();
        if ($config && $config->value) {
            $stored = json_decode($config->value, true);
            if (is_array($stored)) {
                $names = array_values(array_unique(array_merge($names, $stored)));
            }
        }

        if ($complaintColumn && Schema::hasColumn('complaints', $complaintColumn)) {
            $fromComplaints = DB::table('complaints')
                ->whereNotNull($complaintColumn)
                ->where($complaintColumn, '!=', '')
                ->distinct()
                ->pluck($complaintColumn)
                ->all();
            $names = array_values(array_unique(array_merge($names, $fromComplaints)));
        }

        return $names;
    }

    /**
     * @param  list<string>  $names
     */
    private function seedNames(string $table, array $names): void
    {
        foreach ($names as $index => $name) {
            if (! is_string($name) || trim($name) === '') {
                continue;
            }

            DB::table($table)->updateOrInsert(
                ['name' => trim($name)],
                [
                    'is_active' => true,
                    'sort_order' => $index,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );
        }
    }

    private function migrateComplaintColumns(): void
    {
        if (Schema::hasColumn('complaints', 'complaint_type') && ! Schema::hasColumn('complaints', 'complaint_type_id')) {
            Schema::table('complaints', function (Blueprint $table) {
                $table->foreignId('complaint_type_id')->nullable()->after('quantity_affected')->constrained('complaint_types')->nullOnDelete();
                $table->foreignId('courier_id')->nullable()->after('proof_files')->constrained('couriers')->nullOnDelete();
                $table->foreignId('priority_id')->nullable()->after('replacement_tracking_number')->constrained('priorities')->nullOnDelete();
            });

            DB::table('complaints')->orderBy('id')->each(function ($complaint) {
                $updates = [
                    'complaint_type_id' => $this->lookupId('complaint_types', $complaint->complaint_type),
                    'courier_id' => $this->lookupId('couriers', $complaint->courier_name),
                    'priority_id' => $this->lookupId('priorities', $complaint->priority) ?: $this->lookupId('priorities', 'Medium'),
                ];
                DB::table('complaints')->where('id', $complaint->id)->update($updates);
            });

            Schema::table('complaints', function (Blueprint $table) {
                $table->dropColumn(['complaint_type', 'courier_name', 'priority']);
            });
        }
    }

    private function lookupId(string $table, ?string $name): ?int
    {
        if (! $name || trim($name) === '') {
            return null;
        }

        $id = DB::table($table)->where('name', trim($name))->value('id');

        return $id ? (int) $id : null;
    }

    private function cleanupSystemConfigs(): void
    {
        DB::table('system_configs')->whereIn('key', ['complaint_types', 'couriers', 'priority_levels'])->delete();
    }
};
