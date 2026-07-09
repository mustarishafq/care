<?php

namespace App\Services\TikTokShop;

use App\Models\TikTokShopConnection;
use App\Models\User;
use App\Services\Marketplace\MarketplacePlatformConfigService;
use App\Support\MarketplacePlatform;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use RuntimeException;

class TikTokShopAuthService
{
    public function __construct(
        private readonly MarketplacePlatformConfigService $platformConfig,
    ) {}

    public function isConfigured(): bool
    {
        return $this->platformConfig->isConfigured(MarketplacePlatform::TIKTOK_SHOP);
    }

    /**
     * @return array{url: string, state: string}
     */
    public function createAuthorizationUrl(User $user): array
    {
        if (! $this->isConfigured()) {
            throw new RuntimeException('TikTok Shop is not configured. Add partner credentials in TikTok Shop → Settings.');
        }

        $credentials = $this->platformConfig->getCredentials(MarketplacePlatform::TIKTOK_SHOP);

        $state = Str::random(40);
        $ttl = (int) config('tiktok_shop.oauth_state_ttl_minutes', 15);

        Cache::put($this->stateCacheKey($state), [
            'user_id' => $user->id,
        ], now()->addMinutes($ttl));

        $query = http_build_query([
            'service_id' => $credentials['service_id'],
            'state' => $state,
        ]);

        return [
            'url' => rtrim((string) config('tiktok_shop.authorize_url'), '/').'?'.$query,
            'state' => $state,
        ];
    }

    /**
     * @return array{connections: list<TikTokShopConnection>, user_id: int}
     */
    public function handleOAuthCallback(string $authCode, string $state): array
    {
        $stateData = Cache::pull($this->stateCacheKey($state));

        if (! is_array($stateData) || empty($stateData['user_id'])) {
            throw new RuntimeException('OAuth state is invalid or expired. Please try connecting again.');
        }

        $tokenData = $this->client()->exchangeAuthCode($authCode);
        $accessToken = (string) ($tokenData['access_token'] ?? '');
        $refreshToken = (string) ($tokenData['refresh_token'] ?? '');

        if ($accessToken === '') {
            throw new RuntimeException('TikTok Shop did not return an access token.');
        }

        $shopsData = $this->client()->getAuthorizedShops($accessToken);
        $shops = $shopsData['shops'] ?? [];

        if (! is_array($shops) || $shops === []) {
            throw new RuntimeException('No TikTok shops were authorized for this account.');
        }

        $credentials = $this->platformConfig->getCredentials(MarketplacePlatform::TIKTOK_SHOP);
        $defaultRegion = $credentials['region'];

        $connections = [];

        foreach ($shops as $shop) {
            if (! is_array($shop)) {
                continue;
            }

            $shopId = (string) ($shop['id'] ?? $shop['shop_id'] ?? '');
            $shopCipher = (string) ($shop['cipher'] ?? $shop['shop_cipher'] ?? '');

            if ($shopId === '' || $shopCipher === '') {
                continue;
            }

            $region = (string) ($shop['region'] ?? $shop['shop_region'] ?? $defaultRegion);

            $connections[] = TikTokShopConnection::updateOrCreate(
                ['platform' => MarketplacePlatform::TIKTOK_SHOP, 'shop_id' => $shopId, 'region' => $region],
                [
                    'connected_by_user_id' => $stateData['user_id'],
                    'shop_cipher' => $shopCipher,
                    'shop_name' => $shop['name'] ?? $shop['shop_name'] ?? null,
                    'access_token' => $accessToken,
                    'refresh_token' => $refreshToken ?: null,
                    'access_token_expires_at' => $this->expiresAtFromSeconds($tokenData['access_token_expire_in'] ?? null),
                    'refresh_token_expires_at' => $this->expiresAtFromSeconds($tokenData['refresh_token_expire_in'] ?? null),
                    'is_active' => true,
                    'connection_error' => null,
                    'token_refresh_failed_at' => null,
                    'metadata' => $shop,
                ],
            );
        }

        if ($connections === []) {
            throw new RuntimeException('Authorized shops could not be saved.');
        }

        return [
            'connections' => $connections,
            'user_id' => (int) $stateData['user_id'],
        ];
    }

    public function refreshConnectionTokens(TikTokShopConnection $connection): TikTokShopConnection
    {
        if (! $connection->refresh_token) {
            throw new RuntimeException('This shop connection has no refresh token. Reconnect the shop.');
        }

        $tokenData = $this->client()->refreshAccessToken($connection->refresh_token);

        $connection->fill([
            'access_token' => (string) ($tokenData['access_token'] ?? $connection->access_token),
            'refresh_token' => (string) ($tokenData['refresh_token'] ?? $connection->refresh_token),
            'access_token_expires_at' => $this->expiresAtFromSeconds($tokenData['access_token_expire_in'] ?? null)
                ?? $connection->access_token_expires_at,
            'refresh_token_expires_at' => $this->expiresAtFromSeconds($tokenData['refresh_token_expire_in'] ?? null)
                ?? $connection->refresh_token_expires_at,
            'connection_error' => null,
            'token_refresh_failed_at' => null,
        ]);
        $connection->save();

        return $connection->fresh();
    }

    private function stateCacheKey(string $state): string
    {
        return 'tiktok_shop_oauth:'.$state;
    }

    private function expiresAtFromSeconds(mixed $seconds): ?\Illuminate\Support\Carbon
    {
        if (! is_numeric($seconds) || (int) $seconds <= 0) {
            return null;
        }

        return now()->addSeconds((int) $seconds);
    }

    private function client(): TikTokShopApiClient
    {
        if (! $this->isConfigured()) {
            throw new RuntimeException('TikTok Shop integration is not configured.');
        }

        return TikTokShopApiClient::fromConfig();
    }
}
