<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('full_name')->nullable()->after('name');
            $table->string('phone')->nullable()->after('email');
            $table->string('role')->default('viewer')->after('phone');
            $table->string('status')->default('active')->after('role');
            $table->string('approval_status')->default('pending')->after('status');
            $table->boolean('must_change_password')->default(false)->after('approval_status');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'full_name',
                'phone',
                'role',
                'status',
                'approval_status',
                'must_change_password',
            ]);
        });
    }
};
