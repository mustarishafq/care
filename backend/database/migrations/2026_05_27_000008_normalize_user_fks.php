<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $this->migrateTicketActivities();
        $this->migrateInternalNotes();
        $this->migrateNotifications();
    }

    public function down(): void
    {
        $this->restoreNotifications();
        $this->restoreInternalNotes();
        $this->restoreTicketActivities();
    }

    private function migrateTicketActivities(): void
    {
        if (! Schema::hasColumn('ticket_activities', 'user_email')) {
            return;
        }

        Schema::table('ticket_activities', function (Blueprint $table) {
            $table->foreignId('user_id')->nullable()->after('new_value')->constrained('users')->nullOnDelete();
        });

        DB::table('ticket_activities')
            ->whereNotNull('user_email')
            ->where('user_email', '!=', '')
            ->orderBy('id')
            ->each(function ($activity) {
                $userId = DB::table('users')->where('email', trim($activity->user_email))->value('id');
                if ($userId) {
                    DB::table('ticket_activities')->where('id', $activity->id)->update([
                        'user_id' => $userId,
                    ]);
                }
            });

        Schema::table('ticket_activities', function (Blueprint $table) {
            $table->dropColumn(['user_email', 'user_name']);
        });
    }

    private function migrateInternalNotes(): void
    {
        if (! Schema::hasColumn('internal_notes', 'author_email')) {
            return;
        }

        Schema::table('internal_notes', function (Blueprint $table) {
            $table->foreignId('author_user_id')->nullable()->after('content')->constrained('users')->nullOnDelete();
        });

        DB::table('internal_notes')
            ->whereNotNull('author_email')
            ->where('author_email', '!=', '')
            ->orderBy('id')
            ->each(function ($note) {
                $userId = DB::table('users')->where('email', trim($note->author_email))->value('id');
                if ($userId) {
                    DB::table('internal_notes')->where('id', $note->id)->update([
                        'author_user_id' => $userId,
                    ]);
                }
            });

        Schema::table('internal_notes', function (Blueprint $table) {
            $table->dropColumn(['author_email', 'author_name']);
        });
    }

    private function migrateNotifications(): void
    {
        if (! Schema::hasColumn('notifications', 'recipient_email')) {
            return;
        }

        Schema::table('notifications', function (Blueprint $table) {
            $table->dropIndex(['recipient_email', 'is_read']);
        });

        Schema::table('notifications', function (Blueprint $table) {
            $table->foreignId('recipient_user_id')->nullable()->after('id')->constrained('users')->cascadeOnDelete();
        });

        DB::table('notifications')
            ->whereNotNull('recipient_email')
            ->where('recipient_email', '!=', '')
            ->orderBy('id')
            ->each(function ($notification) {
                $userId = DB::table('users')->where('email', trim($notification->recipient_email))->value('id');
                if ($userId) {
                    DB::table('notifications')->where('id', $notification->id)->update([
                        'recipient_user_id' => $userId,
                    ]);
                }
            });

        Schema::table('notifications', function (Blueprint $table) {
            $table->dropColumn('recipient_email');
            $table->index(['recipient_user_id', 'is_read']);
        });
    }

    private function restoreTicketActivities(): void
    {
        if (! Schema::hasColumn('ticket_activities', 'user_id')) {
            return;
        }

        Schema::table('ticket_activities', function (Blueprint $table) {
            $table->string('user_email')->nullable()->after('new_value');
            $table->string('user_name')->nullable()->after('user_email');
        });

        DB::table('ticket_activities')
            ->whereNotNull('user_id')
            ->orderBy('id')
            ->each(function ($activity) {
                $user = DB::table('users')->where('id', $activity->user_id)->first();
                if ($user) {
                    DB::table('ticket_activities')->where('id', $activity->id)->update([
                        'user_email' => $user->email,
                        'user_name' => $user->full_name ?? $user->name,
                    ]);
                }
            });

        Schema::table('ticket_activities', function (Blueprint $table) {
            $table->dropConstrainedForeignId('user_id');
        });
    }

    private function restoreInternalNotes(): void
    {
        if (! Schema::hasColumn('internal_notes', 'author_user_id')) {
            return;
        }

        Schema::table('internal_notes', function (Blueprint $table) {
            $table->string('author_email')->nullable()->after('content');
            $table->string('author_name')->nullable()->after('author_email');
        });

        DB::table('internal_notes')
            ->whereNotNull('author_user_id')
            ->orderBy('id')
            ->each(function ($note) {
                $user = DB::table('users')->where('id', $note->author_user_id)->first();
                if ($user) {
                    DB::table('internal_notes')->where('id', $note->id)->update([
                        'author_email' => $user->email,
                        'author_name' => $user->full_name ?? $user->name,
                    ]);
                }
            });

        Schema::table('internal_notes', function (Blueprint $table) {
            $table->dropConstrainedForeignId('author_user_id');
        });
    }

    private function restoreNotifications(): void
    {
        if (! Schema::hasColumn('notifications', 'recipient_user_id')) {
            return;
        }

        Schema::table('notifications', function (Blueprint $table) {
            $table->dropIndex(['recipient_user_id', 'is_read']);
        });

        Schema::table('notifications', function (Blueprint $table) {
            $table->string('recipient_email')->after('id');
        });

        DB::table('notifications')
            ->whereNotNull('recipient_user_id')
            ->orderBy('id')
            ->each(function ($notification) {
                $email = DB::table('users')->where('id', $notification->recipient_user_id)->value('email');
                if ($email) {
                    DB::table('notifications')->where('id', $notification->id)->update([
                        'recipient_email' => $email,
                    ]);
                }
            });

        Schema::table('notifications', function (Blueprint $table) {
            $table->dropConstrainedForeignId('recipient_user_id');
            $table->index(['recipient_email', 'is_read']);
        });
    }
};
