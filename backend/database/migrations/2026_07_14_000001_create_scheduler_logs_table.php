<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('scheduler_logs', function (Blueprint $table) {
            $table->id();
            $table->string('command', 128)->index();
            $table->string('source', 128)->nullable()->index();
            $table->string('level', 16)->default('info')->index();
            $table->string('title', 255)->nullable();
            $table->text('message');
            $table->foreignId('marketplace_shop_connection_id')
                ->nullable()
                ->constrained('marketplace_shop_connections')
                ->nullOnDelete();
            $table->json('context')->nullable();
            $table->timestamps();

            $table->index(['created_at']);
            $table->index(['command', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('scheduler_logs');
    }
};
