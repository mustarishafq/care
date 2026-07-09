<?php

namespace App\Services\Shopee;

use App\Models\ShopeeConnection;
use App\Models\User;
use App\Services\Marketplace\MarketplacePlatformConfigService;
use App\Support\MarketplacePlatform;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use RuntimeException;

class ShopeeAuthService
{
    public function __construct(
        private readonly MarketplacePlatformConfigService $platformConfig,
    ) {}

    public function isConfigured(): bool
    {
        return $this->platformConfig->isConfigured(MarketplacePlatform::SHOPEE);
    }

    /**
     * @return array{url: string, state: string}
     */
    public function createAuthorizationUrl(User $user): array
    {
        if (! $this->isConfigured()) {
            throw new RuntimeException('Shopee is not configured. Add partner credentials in Shopee → Settings.');
        }

        $state = Str::random(40);
        $ttl = (int) config('shopee.oauth_state_ttl_minutes', 15);

        Cache::put($this->stateCacheKey($state), [
            'user_id' => $user->id,
        ], now()->addMinutes($ttl));

        $redirectUri = url('/api/v1/shopee/oauth/callback').'?state='.urlencode($state);

        return [
            'url' => $this->client()->buildAuthorizationUrl($redirectUri),
            'state' => $state,
        ];
    }

    /**
     * @return array{connections: list<ShopeeConnection>, user_id: int}
     */
    public function handleOAuthCallback(string $code, int $shopId, string $state): array
    {
        $stateData = Cache::pull($this->stateCacheKey($state));

        if (! is_array($stateData) || empty($stateData['user_id'])) {
            throw new RuntimeException('OAuth state is invalid or expired. Please try connecting again.');
        }

        $tokenData = $this->client()->exchangeAuthCode($code, $shopId);
        $accessToken = (string) ($tokenData['access_token'] ?? '');

        if ($accessToken === '') {
            throw new RuntimeException('Shopee did not return an access token.');
        }

        $credentials = $this->platformConfig->getCredentials(MarketplacePlatform::SHOPEE);
        $region = $credentials['region'];

        $shopName = null;
        $shopMetadata = [];

        try {
            $shopInfo = $this->client()->getShopInfo($accessToken, $shopId);
            $shopName = $shopInfo['shop_name'] ?? null;
            $shopMetadata = $shopInfo;
        } catch (\Throwable) {
            // Shop info is optional during connect.
        }

        $connection = ShopeeConnection::updateOrCreate(
            [
                'platform' => MarketplacePlatform::SHOPEE,
                'shop_id' => (string) $shopId,
                'region' => $region,
            ],
            [
                'connected_by_user_id' => $stateData['user_id'],
                'shop_cipher' => (string) $shopId,
                'shop_name' => $shopName,
                'access_token' => $accessToken,
                'refresh_token' => (string) ($tokenData['refresh_token'] ?? '') ?: null,
                'access_token_expires_at' => $this->expiresAtFromSeconds($tokenData['expire_in'] ?? null),
                'refresh_token_expires_at' => null,
                'is_active' => true,
                'connection_error' => null,
                'token_refresh_failed_at' => null,
                'metadata' => array_merge($tokenData, $shopMetadata),
            ],
        );

        return [
            'connections' => [$connection],
            'user_id' => (int) $stateData['user_id'],
        ];
    }

    public function refreshConnectionTokens(ShopeeConnection $connection): ShopeeConnection
    {
        if (! $connection->refresh_token) {
            throw new RuntimeException('This shop connection has no refresh token. Reconnect the shop.');
        }

        $tokenData = $this->client()->refreshAccessToken(
            $connection->refresh_token,
            (int) $connection->shop_id,
        );

        $connection->fill([
            'access_token' => (string) ($tokenData['access_token'] ?? $connection->access_token),
            'refresh_token' => (string) ($tokenData['refresh_token'] ?? $connection->refresh_token),
            'access_token_expires_at' => $this->expiresAtFromSeconds($tokenData['expire_in'] ?? null)
                ?? $connection->access_token_expires_at,
            'connection_error' => null,
            'token_refresh_failed_at' => null,
        ]);
        $connection->save();

        return $connection->fresh();
    }

    private function stateCacheKey(string $state): string
    {
        return 'shopee_oauth:'.$state;
    }

    private function expiresAtFromSeconds(mixed $seconds): ?\Illuminate\Support\Carbon
    {
        if (! is_numeric($seconds) || (int) $seconds <= 0) {
            return null;
        }

        return now()->addSeconds((int) $seconds);
    }

    private function client(): ShopeeApiClient
    {
        if (! $this->isConfigured()) {
            throw new RuntimeException('Shopee integration is not configured.');
        }

        return ShopeeApiClient::fromConfig();
    }
}
