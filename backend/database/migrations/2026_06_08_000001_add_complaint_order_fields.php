<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('complaints', function (Blueprint $table) {
            $table->string('order_number')->nullable()->change();
            $table->string('order_source')->nullable()->after('order_number');
            $table->string('batch_number')->nullable()->after('order_source');
            $table->string('unit_of_measurement')->nullable()->after('quantity_affected');
        });
    }

    public function down(): void
    {
        Schema::table('complaints', function (Blueprint $table) {
            $table->dropColumn(['order_source', 'batch_number', 'unit_of_measurement']);
            $table->string('order_number')->nullable(false)->change();
        });
    }
};
