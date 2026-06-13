<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->string('severity')->default('info')->after('type');
            $table->string('category')->default('task')->after('severity');
            $table->string('action_url')->nullable()->after('category');
        });
    }

    public function down(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->dropColumn(['severity', 'category', 'action_url']);
        });
    }
};
