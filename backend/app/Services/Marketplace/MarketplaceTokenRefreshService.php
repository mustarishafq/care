<?php

namespace App\Services\Marketplace;

use App\Models\MarketplaceShopConnection;
use App\Models\ShopeeConnection;
use App\Models\TikTokShopConnection;
use App\Services\Shopee\ShopeeAuthService;
use App\Services\TikTokShop\TikTokShopAuthService;
use App\Support\MarketplacePlatform;
use Illuminate\Support\Collection;

class MarketplaceTokenRefreshService
{
    public function __construct(
        private readonly TikTokShopAuthService $tikTokAuthService,
        private readonly ShopeeAuthService $shopeeAuthService,
    ) {}

    /**
     * @return array{refreshed: int, failed: int}
     */
    public function refreshExpiringConnections(): array
    {
        $refreshed = 0;
        $failed = 0;

        $connections = MarketplaceShopConnection::query()
            ->where('is_active', true)
            ->whereNotNull('refresh_token')
            ->where(function ($query) {
                $query->whereNull('access_token_expires_at')
                    ->orWhere('access_token_expires_at', '<=', now()->addMinutes(15));
            })
            ->get();

        foreach ($connections as $connection) {
            try {
                if ($connection->platform === MarketplacePlatform::TIKTOK_SHOP) {
                    $this->tikTokAuthService->refreshConnectionTokens(
                        TikTokShopConnection::withoutGlobalScopes()->findOrFail($connection->id),
                    );
                    $connection->clearConnectionError();
                    $refreshed++;
                } elseif ($connection->platform === MarketplacePlatform::SHOPEE) {
                    $this->shopeeAuthService->refreshConnectionTokens(
                        ShopeeConnection::withoutGlobalScopes()->findOrFail($connection->id),
                    );
                    $connection->clearConnectionError();
                    $refreshed++;
                }
            } catch (\Throwable $exception) {
                $connection->markConnectionError($exception->getMessage());
                $failed++;
            }
        }

        return compact('refreshed', 'failed');
    }

    /**
     * @return Collection<int, MarketplaceShopConnection>
     */
    public function connectionsNeedingAttention(): Collection
    {
        return MarketplaceShopConnection::query()
            ->where('is_active', true)
            ->whereNotNull('token_refresh_failed_at')
            ->orderByDesc('token_refresh_failed_at')
            ->get();
    }
}
