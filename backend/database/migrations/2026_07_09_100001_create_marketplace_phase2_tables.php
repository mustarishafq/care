<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('marketplace_platform_configs')) {
            Schema::create('marketplace_platform_configs', function (Blueprint $table) {
            $table->id();
            $table->string('platform', 32)->unique();
            $table->text('app_key')->nullable();
            $table->text('app_secret')->nullable();
            $table->string('service_id')->nullable();
            $table->string('region', 8)->default('MY');
            $table->json('settings')->nullable();
            $table->boolean('is_active')->default(true);
            $table->foreignId('updated_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            });
        }

        if (Schema::hasTable('tiktok_shop_connections')) {
            Schema::rename('tiktok_shop_connections', 'marketplace_shop_connections');
        } elseif (! Schema::hasTable('marketplace_shop_connections')) {
            Schema::create('marketplace_shop_connections', function (Blueprint $table) {
                $table->id();
                $table->foreignId('connected_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->string('shop_id')->index();
                $table->string('shop_cipher');
                $table->string('shop_name')->nullable();
                $table->string('region', 8)->default('MY');
                $table->text('access_token');
                $table->text('refresh_token')->nullable();
                $table->dateTime('access_token_expires_at')->nullable();
                $table->dateTime('refresh_token_expires_at')->nullable();
                $table->boolean('is_active')->default(true);
                $table->timestamp('last_synced_at')->nullable();
                $table->json('metadata')->nullable();
                $table->timestamps();
            });
        }

        Schema::table('marketplace_shop_connections', function (Blueprint $table) {
            if (! Schema::hasColumn('marketplace_shop_connections', 'platform')) {
                $table->string('platform', 32)->default('tiktok_shop')->after('id');
            }
            if (! Schema::hasColumn('marketplace_shop_connections', 'connection_error')) {
                $table->text('connection_error')->nullable()->after('is_active');
            }
            if (! Schema::hasColumn('marketplace_shop_connections', 'token_refresh_failed_at')) {
                $table->timestamp('token_refresh_failed_at')->nullable()->after('connection_error');
            }
        });

        $this->dropIndexIfExists('marketplace_shop_connections', 'tiktok_shop_connections_shop_id_region_unique');
        $this->dropIndexIfExists('marketplace_shop_connections', 'marketplace_shop_connections_shop_id_region_unique');

        if (! $this->indexExists('marketplace_shop_connections', 'marketplace_shop_platform_shop_region_unique')) {
            Schema::table('marketplace_shop_connections', function (Blueprint $table) {
                $table->unique(['platform', 'shop_id', 'region'], 'marketplace_shop_platform_shop_region_unique');
            });
        }

        if (! Schema::hasTable('marketplace_product_reviews')) {
            Schema::create('marketplace_product_reviews', function (Blueprint $table) {
            $table->id();
            $table->string('platform', 32)->index();
            $table->unsignedBigInteger('marketplace_shop_connection_id');
            $table->foreign('marketplace_shop_connection_id', 'mkt_reviews_shop_conn_fk')
                ->references('id')
                ->on('marketplace_shop_connections')
                ->cascadeOnDelete();
            $table->string('external_review_id');
            $table->string('external_product_id')->nullable()->index();
            $table->string('product_name')->nullable();
            $table->unsignedTinyInteger('rating')->nullable();
            $table->text('review_text')->nullable();
            $table->string('reviewer_name')->nullable();
            $table->timestamp('review_created_at')->nullable();
            $table->text('seller_reply')->nullable();
            $table->timestamp('seller_replied_at')->nullable();
            $table->foreignId('complaint_id')->nullable()->constrained('complaints')->nullOnDelete();
            $table->json('raw_metadata')->nullable();
            $table->timestamp('synced_at')->nullable();
            $table->timestamps();

            $table->unique(
                ['platform', 'marketplace_shop_connection_id', 'external_review_id'],
                'marketplace_reviews_platform_shop_review_unique',
            );
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('marketplace_product_reviews');

        if (Schema::hasTable('marketplace_shop_connections')) {
            Schema::table('marketplace_shop_connections', function (Blueprint $table) {
                $table->dropUnique('marketplace_shop_platform_shop_region_unique');
            });

            Schema::table('marketplace_shop_connections', function (Blueprint $table) {
                if (Schema::hasColumn('marketplace_shop_connections', 'platform')) {
                    $table->dropColumn(['platform', 'connection_error', 'token_refresh_failed_at']);
                }
            });

            Schema::table('marketplace_shop_connections', function (Blueprint $table) {
                $table->unique(['shop_id', 'region']);
            });

            Schema::rename('marketplace_shop_connections', 'tiktok_shop_connections');
        }

        Schema::dropIfExists('marketplace_platform_configs');
    }

    private function indexExists(string $table, string $indexName): bool
    {
        $indexes = DB::select('SHOW INDEX FROM `'.$table.'`');

        return collect($indexes)->contains(fn ($index) => $index->Key_name === $indexName);
    }

    private function dropIndexIfExists(string $table, string $indexName): void
    {
        if (! $this->indexExists($table, $indexName)) {
            return;
        }

        Schema::table($table, function (Blueprint $blueprint) use ($indexName) {
            $blueprint->dropIndex($indexName);
        });
    }
};
