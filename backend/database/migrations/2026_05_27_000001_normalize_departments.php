<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('departments')) {
            Schema::create('departments', function (Blueprint $table) {
                $table->id();
                $table->string('name')->unique();
                $table->boolean('is_active')->default(true);
                $table->unsignedSmallInteger('sort_order')->default(0);
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('department_user')) {
            Schema::create('department_user', function (Blueprint $table) {
                $table->foreignId('department_id')->constrained()->cascadeOnDelete();
                $table->foreignId('user_id')->constrained()->cascadeOnDelete();
                $table->primary(['department_id', 'user_id']);
            });
        }

        $this->seedDepartments();
        $this->migrateUserDepartments();

        if (Schema::hasColumn('complaints', 'assigned_department') && ! Schema::hasColumn('complaints', 'assigned_department_id')) {
            Schema::table('complaints', function (Blueprint $table) {
                $table->foreignId('assigned_department_id')->nullable()->after('status')->constrained('departments')->nullOnDelete();
            });

            DB::table('complaints')
                ->whereNotNull('assigned_department')
                ->where('assigned_department', '!=', '')
                ->orderBy('id')
                ->each(function ($complaint) {
                    $departmentId = $this->departmentIdForName($complaint->assigned_department);
                    if ($departmentId) {
                        DB::table('complaints')->where('id', $complaint->id)->update([
                            'assigned_department_id' => $departmentId,
                        ]);
                    }
                });

            Schema::table('complaints', function (Blueprint $table) {
                $table->dropColumn('assigned_department');
            });
        }

        if (Schema::hasColumn('internal_notes', 'department') && ! Schema::hasColumn('internal_notes', 'department_id')) {
            Schema::table('internal_notes', function (Blueprint $table) {
                $table->foreignId('department_id')->nullable()->after('author_name')->constrained('departments')->nullOnDelete();
            });

            DB::table('internal_notes')
                ->whereNotNull('department')
                ->where('department', '!=', '')
                ->orderBy('id')
                ->each(function ($note) {
                    $departmentId = $this->departmentIdForName($note->department);
                    if ($departmentId) {
                        DB::table('internal_notes')->where('id', $note->id)->update([
                            'department_id' => $departmentId,
                        ]);
                    }
                });

            Schema::table('internal_notes', function (Blueprint $table) {
                $table->dropColumn('department');
            });
        }

        if (Schema::hasColumn('users', 'departments')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropColumn('departments');
            });
        }

        DB::table('system_configs')->where('key', 'departments')->delete();
    }

    public function down(): void
    {
        if (! Schema::hasColumn('users', 'departments')) {
            Schema::table('users', function (Blueprint $table) {
                $table->json('departments')->nullable()->after('approval_status');
            });
        }

        if (Schema::hasColumn('complaints', 'assigned_department_id')) {
            Schema::table('complaints', function (Blueprint $table) {
                $table->string('assigned_department')->nullable()->after('status');
            });

            DB::table('complaints')
                ->whereNotNull('assigned_department_id')
                ->orderBy('id')
                ->each(function ($complaint) {
                    $name = DB::table('departments')->where('id', $complaint->assigned_department_id)->value('name');
                    if ($name) {
                        DB::table('complaints')->where('id', $complaint->id)->update([
                            'assigned_department' => $name,
                        ]);
                    }
                });

            Schema::table('complaints', function (Blueprint $table) {
                $table->dropConstrainedForeignId('assigned_department_id');
            });
        }

        if (Schema::hasColumn('internal_notes', 'department_id')) {
            Schema::table('internal_notes', function (Blueprint $table) {
                $table->string('department')->nullable()->after('author_name');
            });

            DB::table('internal_notes')
                ->whereNotNull('department_id')
                ->orderBy('id')
                ->each(function ($note) {
                    $name = DB::table('departments')->where('id', $note->department_id)->value('name');
                    if ($name) {
                        DB::table('internal_notes')->where('id', $note->id)->update([
                            'department' => $name,
                        ]);
                    }
                });

            Schema::table('internal_notes', function (Blueprint $table) {
                $table->dropConstrainedForeignId('department_id');
            });
        }

        Schema::dropIfExists('department_user');
        Schema::dropIfExists('departments');
    }

    private function seedDepartments(): void
    {
        $names = [
            'Customer Service',
            'Fulfillment',
            'Logistics',
            'Management',
            'Administration',
        ];

        $config = DB::table('system_configs')->where('key', 'departments')->first();
        if ($config && $config->value) {
            $stored = json_decode($config->value, true);
            if (is_array($stored)) {
                $names = array_values(array_unique(array_merge($names, $stored)));
            }
        }

        if (Schema::hasColumn('users', 'departments')) {
            foreach (DB::table('users')->whereNotNull('departments')->get() as $user) {
                $depts = json_decode($user->departments, true);
                if (is_array($depts)) {
                    $names = array_values(array_unique(array_merge($names, $depts)));
                }
            }
        }

        if (Schema::hasColumn('complaints', 'assigned_department')) {
            $complaintDepts = DB::table('complaints')
                ->whereNotNull('assigned_department')
                ->where('assigned_department', '!=', '')
                ->distinct()
                ->pluck('assigned_department')
                ->all();
            $names = array_values(array_unique(array_merge($names, $complaintDepts)));
        }

        if (Schema::hasColumn('internal_notes', 'department')) {
            $noteDepts = DB::table('internal_notes')
                ->whereNotNull('department')
                ->where('department', '!=', '')
                ->distinct()
                ->pluck('department')
                ->all();
            $names = array_values(array_unique(array_merge($names, $noteDepts)));
        }

        foreach ($names as $index => $name) {
            if (! is_string($name) || trim($name) === '') {
                continue;
            }

            DB::table('departments')->updateOrInsert(
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

    private function migrateUserDepartments(): void
    {
        if (! Schema::hasColumn('users', 'departments')) {
            return;
        }

        DB::table('users')
            ->whereNotNull('departments')
            ->orderBy('id')
            ->each(function ($user) {
                $depts = json_decode($user->departments, true);
                if (! is_array($depts)) {
                    return;
                }

                foreach ($depts as $name) {
                    if (! is_string($name) || trim($name) === '') {
                        continue;
                    }

                    $departmentId = $this->departmentIdForName($name);
                    if (! $departmentId) {
                        continue;
                    }

                    DB::table('department_user')->updateOrInsert(
                        [
                            'department_id' => $departmentId,
                            'user_id' => $user->id,
                        ],
                        []
                    );
                }
            });
    }

    private function departmentIdForName(string $name): ?int
    {
        $id = DB::table('departments')->where('name', trim($name))->value('id');

        return $id ? (int) $id : null;
    }
};
