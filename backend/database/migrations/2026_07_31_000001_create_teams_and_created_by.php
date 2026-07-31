<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('teams')) {
            Schema::create('teams', function (Blueprint $table) {
                $table->id();
                $table->foreignId('department_id')->constrained('departments')->cascadeOnDelete();
                $table->string('name');
                $table->foreignId('lead_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->boolean('is_active')->default(true);
                $table->unsignedSmallInteger('sort_order')->default(0);
                $table->timestamps();

                $table->unique(['department_id', 'name']);
            });
        }

        if (! Schema::hasTable('team_user')) {
            Schema::create('team_user', function (Blueprint $table) {
                $table->foreignId('team_id')->constrained('teams')->cascadeOnDelete();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->primary(['team_id', 'user_id']);
            });
        }

        if (Schema::hasTable('complaints') && ! Schema::hasColumn('complaints', 'created_by_user_id')) {
            Schema::table('complaints', function (Blueprint $table) {
                $table->foreignId('created_by_user_id')
                    ->nullable()
                    ->after('assigned_user_id')
                    ->constrained('users')
                    ->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('complaints') && Schema::hasColumn('complaints', 'created_by_user_id')) {
            Schema::table('complaints', function (Blueprint $table) {
                $table->dropConstrainedForeignId('created_by_user_id');
            });
        }

        Schema::dropIfExists('team_user');
        Schema::dropIfExists('teams');
    }
};
