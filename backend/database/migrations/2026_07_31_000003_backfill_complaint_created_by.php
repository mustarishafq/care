<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Backfill complaints.created_by_user_id from the earliest
 * ticket_activities row with action_type = 'created' and a user_id.
 *
 * The created_by column was added nullable with no historical fill;
 * older tickets still recorded the creator on the timeline.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (
            ! Schema::hasTable('complaints')
            || ! Schema::hasColumn('complaints', 'created_by_user_id')
            || ! Schema::hasTable('ticket_activities')
        ) {
            return;
        }

        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'pgsql') {
            DB::statement("
                UPDATE complaints AS c
                SET created_by_user_id = a.user_id
                FROM (
                    SELECT DISTINCT ON (complaint_id)
                        complaint_id,
                        user_id
                    FROM ticket_activities
                    WHERE action_type = 'created'
                      AND user_id IS NOT NULL
                    ORDER BY complaint_id, created_at ASC, id ASC
                ) AS a
                WHERE c.id::text = a.complaint_id::text
                  AND c.created_by_user_id IS NULL
            ");

            return;
        }

        // MySQL / MariaDB / SQLite-compatible correlated update.
        $rows = DB::table('ticket_activities')
            ->select('complaint_id', 'user_id')
            ->where('action_type', 'created')
            ->whereNotNull('user_id')
            ->orderBy('created_at')
            ->orderBy('id')
            ->get()
            ->unique('complaint_id');

        foreach ($rows as $row) {
            DB::table('complaints')
                ->whereNull('created_by_user_id')
                ->where('id', $row->complaint_id)
                ->update(['created_by_user_id' => $row->user_id]);
        }
    }

    public function down(): void
    {
        // Irreversible data backfill — intentionally empty.
    }
};
