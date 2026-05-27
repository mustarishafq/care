<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('product_categories')) {
            Schema::create('product_categories', function (Blueprint $table) {
                $table->id();
                $table->string('name')->unique();
                $table->boolean('is_active')->default(true);
                $table->unsignedSmallInteger('sort_order')->default(0);
                $table->timestamps();
            });
        }

        $categories = DB::table('products')
            ->whereNotNull('category')
            ->where('category', '!=', '')
            ->distinct()
            ->pluck('category')
            ->all();

        foreach ($categories as $index => $name) {
            if (! is_string($name) || trim($name) === '') {
                continue;
            }

            DB::table('product_categories')->updateOrInsert(
                ['name' => trim($name)],
                [
                    'is_active' => true,
                    'sort_order' => $index,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );
        }

        if (Schema::hasColumn('products', 'category') && ! Schema::hasColumn('products', 'category_id')) {
            Schema::table('products', function (Blueprint $table) {
                $table->foreignId('category_id')->nullable()->after('sku')->constrained('product_categories')->nullOnDelete();
            });

            DB::table('products')->orderBy('id')->each(function ($product) {
                if (! $product->category || trim($product->category) === '') {
                    return;
                }

                $categoryId = DB::table('product_categories')->where('name', trim($product->category))->value('id');
                if ($categoryId) {
                    DB::table('products')->where('id', $product->id)->update([
                        'category_id' => $categoryId,
                    ]);
                }
            });

            Schema::table('products', function (Blueprint $table) {
                $table->dropColumn('category');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('products', 'category_id')) {
            Schema::table('products', function (Blueprint $table) {
                $table->string('category')->nullable()->after('sku');
            });

            DB::table('products')->orderBy('id')->each(function ($product) {
                if (! $product->category_id) {
                    return;
                }

                $name = DB::table('product_categories')->where('id', $product->category_id)->value('name');
                if ($name) {
                    DB::table('products')->where('id', $product->id)->update([
                        'category' => $name,
                    ]);
                }
            });

            Schema::table('products', function (Blueprint $table) {
                $table->dropConstrainedForeignId('category_id');
            });
        }

        Schema::dropIfExists('product_categories');
    }
};
