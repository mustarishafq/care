<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('marketplace_product_reviews', function (Blueprint $table) {
            if (! Schema::hasColumn('marketplace_product_reviews', 'product_image_url')) {
                $table->text('product_image_url')->nullable()->after('product_name');
            }
            if (! Schema::hasColumn('marketplace_product_reviews', 'review_images')) {
                $table->json('review_images')->nullable()->after('review_text');
            }
        });
    }

    public function down(): void
    {
        Schema::table('marketplace_product_reviews', function (Blueprint $table) {
            if (Schema::hasColumn('marketplace_product_reviews', 'review_images')) {
                $table->dropColumn('review_images');
            }
            if (Schema::hasColumn('marketplace_product_reviews', 'product_image_url')) {
                $table->dropColumn('product_image_url');
            }
        });
    }
};
