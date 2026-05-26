<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** @var list<string> */
    private array $defaultStatuses = [
        'New Complaint',
        'Under Review',
        'Waiting for Customer',
        'Approved Replacement',
        'Rejected',
        'Reprocessing by Fulfillment',
        'Ready to Ship',
        'Shipped',
        'Delivered',
        'Closed',
    ];

    public function up(): void
    {
        $this->createComplaintStatusesTable();
        $this->seedComplaintStatuses();
        $this->migrateStatusColumn();
        $this->migrateProductColumn();
    }

    public function down(): void
    {
        if (Schema::hasColumn('complaints', 'status_id')) {
            Schema::table('complaints', function (Blueprint $table) {
                $table->string('status')->default('New Complaint')->after('priority_id');
            });

            DB::table('complaints')->orderBy('id')->each(function ($complaint) {
                if ($complaint->status_id) {
                    $name = DB::table('complaint_statuses')->where('id', $complaint->status_id)->value('name');
                    if ($name) {
                        DB::table('complaints')->where('id', $complaint->id)->update(['status' => $name]);
                    }
                }
            });

            Schema::table('complaints', function (Blueprint $table) {
                $table->dropConstrainedForeignId('status_id');
            });
        }

        if (Schema::hasColumn('complaints', 'product_id')) {
            Schema::table('complaints', function (Blueprint $table) {
                $table->string('product_name')->after('order_number');
            });

            DB::table('complaints')->orderBy('id')->each(function ($complaint) {
                if ($complaint->product_id) {
                    $name = DB::table('products')->where('id', $complaint->product_id)->value('name');
                    if ($name) {
                        DB::table('complaints')->where('id', $complaint->id)->update(['product_name' => $name]);
                    }
                }
            });

            Schema::table('complaints', function (Blueprint $table) {
                $table->dropConstrainedForeignId('product_id');
            });
        }

        Schema::dropIfExists('complaint_statuses');
    }

    private function createComplaintStatusesTable(): void
    {
        if (! Schema::hasTable('complaint_statuses')) {
            Schema::create('complaint_statuses', function (Blueprint $table) {
                $table->id();
                $table->string('name')->unique();
                $table->boolean('is_active')->default(true);
                $table->unsignedSmallInteger('sort_order')->default(0);
                $table->timestamps();
            });
        }
    }

    private function seedComplaintStatuses(): void
    {
        $names = $this->defaultStatuses;

        if (Schema::hasColumn('complaints', 'status')) {
            $fromComplaints = DB::table('complaints')
                ->whereNotNull('status')
                ->where('status', '!=', '')
                ->distinct()
                ->pluck('status')
                ->all();
            $names = array_values(array_unique(array_merge($names, $fromComplaints)));
        }

        foreach ($names as $index => $name) {
            if (! is_string($name) || trim($name) === '') {
                continue;
            }

            $trimmed = trim($name);
            $sortOrder = array_search($trimmed, $this->defaultStatuses, true);
            DB::table('complaint_statuses')->updateOrInsert(
                ['name' => $trimmed],
                [
                    'is_active' => true,
                    'sort_order' => $sortOrder !== false ? $sortOrder : 100 + $index,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );
        }
    }

    private function migrateStatusColumn(): void
    {
        if (! Schema::hasColumn('complaints', 'status') || Schema::hasColumn('complaints', 'status_id')) {
            return;
        }

        Schema::table('complaints', function (Blueprint $table) {
            $table->foreignId('status_id')->nullable()->after('priority_id')->constrained('complaint_statuses')->nullOnDelete();
        });

        DB::table('complaints')->orderBy('id')->each(function ($complaint) {
            $statusId = $this->lookupId('complaint_statuses', $complaint->status)
                ?: $this->lookupId('complaint_statuses', 'New Complaint');
            DB::table('complaints')->where('id', $complaint->id)->update(['status_id' => $statusId]);
        });

        Schema::table('complaints', function (Blueprint $table) {
            $table->dropIndex(['status']);
            $table->dropColumn('status');
            $table->index('status_id');
        });
    }

    private function migrateProductColumn(): void
    {
        if (! Schema::hasColumn('complaints', 'product_name') || Schema::hasColumn('complaints', 'product_id')) {
            return;
        }

        Schema::table('complaints', function (Blueprint $table) {
            $table->foreignId('product_id')->nullable()->after('order_number')->constrained('products')->nullOnDelete();
        });

        DB::table('complaints')->orderBy('id')->each(function ($complaint) {
            DB::table('complaints')->where('id', $complaint->id)->update([
                'product_id' => $this->ensureProductId($complaint->product_name),
            ]);
        });

        Schema::table('complaints', function (Blueprint $table) {
            $table->dropColumn('product_name');
        });
    }

    private function lookupId(string $table, ?string $name): ?int
    {
        if (! $name || trim($name) === '') {
            return null;
        }

        $id = DB::table($table)->where('name', trim($name))->value('id');

        return $id ? (int) $id : null;
    }

    private function ensureProductId(?string $name): ?int
    {
        if (! $name || trim($name) === '') {
            return null;
        }

        $trimmed = trim($name);
        $existing = DB::table('products')->where('name', $trimmed)->value('id');
        if ($existing) {
            return (int) $existing;
        }

        return (int) DB::table('products')->insertGetId([
            'name' => $trimmed,
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
};
