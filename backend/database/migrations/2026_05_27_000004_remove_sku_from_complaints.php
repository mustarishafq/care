<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('complaints', 'sku')) {
            Schema::table('complaints', function (Blueprint $table) {
                $table->dropColumn('sku');
            });
        }
    }

    public function down(): void
    {
        if (! Schema::hasColumn('complaints', 'sku')) {
            Schema::table('complaints', function (Blueprint $table) {
                $table->string('sku')->nullable()->after('product_id');
            });
        }
    }
};
