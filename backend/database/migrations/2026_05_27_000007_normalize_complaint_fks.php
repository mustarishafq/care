<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** @var list<string> */
    private array $tables = ['ticket_activities', 'internal_notes', 'notifications'];

    public function up(): void
    {
        foreach ($this->tables as $tableName) {
            $this->migrateComplaintId($tableName);
        }
    }

    public function down(): void
    {
        foreach (array_reverse($this->tables) as $tableName) {
            $this->restoreComplaintIdString($tableName);
        }
    }

    private function migrateComplaintId(string $tableName): void
    {
        if (! Schema::hasTable($tableName) || ! Schema::hasColumn($tableName, 'complaint_id')) {
            return;
        }

        $columnType = Schema::getColumnType($tableName, 'complaint_id');
        if ($columnType !== 'string' && $columnType !== 'varchar') {
            return;
        }

        Schema::table($tableName, function (Blueprint $table) {
            $table->renameColumn('complaint_id', 'legacy_complaint_id');
        });

        Schema::table($tableName, function (Blueprint $table) use ($tableName) {
            $foreign = $table->foreignId('complaint_id')->nullable()->constrained('complaints')->cascadeOnDelete();
            if ($tableName === 'notifications') {
                $foreign->after('type');
            }
        });

        DB::table($tableName)
            ->whereNotNull('legacy_complaint_id')
            ->where('legacy_complaint_id', '!=', '')
            ->orderBy('id')
            ->each(function ($row) use ($tableName) {
                if (! ctype_digit((string) $row->legacy_complaint_id)) {
                    return;
                }

                $complaintId = (int) $row->legacy_complaint_id;
                if (! DB::table('complaints')->where('id', $complaintId)->exists()) {
                    return;
                }

                DB::table($tableName)->where('id', $row->id)->update([
                    'complaint_id' => $complaintId,
                ]);
            });

        Schema::table($tableName, function (Blueprint $table) {
            $table->dropColumn('legacy_complaint_id');
        });
    }

    private function restoreComplaintIdString(string $tableName): void
    {
        if (! Schema::hasTable($tableName) || ! Schema::hasColumn($tableName, 'complaint_id')) {
            return;
        }

        Schema::table($tableName, function (Blueprint $table) {
            $table->dropConstrainedForeignId('complaint_id');
        });

        Schema::table($tableName, function (Blueprint $table) {
            $table->string('complaint_id')->nullable();
        });

        DB::table($tableName)
            ->whereNotNull('complaint_id')
            ->orderBy('id')
            ->each(function ($row) use ($tableName) {
                DB::table($tableName)->where('id', $row->id)->update([
                    'complaint_id' => (string) $row->complaint_id,
                ]);
            });
    }
};
