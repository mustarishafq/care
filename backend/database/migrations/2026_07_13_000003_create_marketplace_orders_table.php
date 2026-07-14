<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('marketplace_orders', function (Blueprint $table) {
            $table->id();
            $table->string('platform', 32);
            $table->foreignId('marketplace_shop_connection_id')
                ->constrained('marketplace_shop_connections')
                ->cascadeOnDelete();
            $table->string('external_order_id', 64);
            $table->string('buyer_nickname')->nullable();
            $table->string('buyer_name')->nullable();
            $table->string('buyer_phone', 64)->nullable();
            $table->text('buyer_address')->nullable();
            $table->json('buyer_address_raw')->nullable();
            $table->json('items')->nullable();
            $table->unsignedInteger('item_count')->default(0);
            $table->string('product_summary')->nullable();
            $table->integer('order_status')->nullable();
            $table->string('order_status_label')->nullable();
            $table->decimal('grand_total', 12, 2)->nullable();
            $table->string('currency', 8)->nullable();
            $table->string('pay_method')->nullable();
            $table->timestamp('order_created_at')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->timestamp('contact_synced_at')->nullable();
            $table->timestamp('synced_at')->nullable();
            $table->json('raw_metadata')->nullable();
            $table->timestamps();

            $table->unique(
                ['platform', 'marketplace_shop_connection_id', 'external_order_id'],
                'marketplace_orders_platform_shop_order_unique',
            );
            $table->index(['platform', 'order_created_at']);
            $table->index(['buyer_name', 'buyer_phone']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('marketplace_orders');
    }
};
