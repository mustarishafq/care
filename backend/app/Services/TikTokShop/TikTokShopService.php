<?php

namespace App\Services\TikTokShop;

use App\Models\TikTokShopConnection;
use Illuminate\Support\Collection;
use RuntimeException;

class TikTokShopService
{
    public function __construct(
        private readonly TikTokShopAuthService $authService,
    ) {}

    /**
     * @return Collection<int, TikTokShopConnection>
     */
    public function listConnections(): Collection
    {
        return TikTokShopConnection::query()
            ->where('is_active', true)
            ->orderBy('shop_name')
            ->orderBy('id')
            ->get();
    }

    public function disconnect(TikTokShopConnection $connection): void
    {
        $connection->update(['is_active' => false]);
    }

    /**
     * @return array<string, mixed>
     */
    public function listProducts(
        TikTokShopConnection $connection,
        int $pageSize = 20,
        ?string $pageToken = null,
        ?string $status = null,
    ): array {
        $connection = $this->ensureFreshToken($connection);

        $body = [];
        if ($status) {
            $body['status'] = $status;
        }

        $result = $this->client()->searchProducts(
            $connection->access_token,
            $connection->shop_cipher,
            $body,
            min(max($pageSize, 1), 50),
            $pageToken,
        );

        $connection->update(['last_synced_at' => now()]);

        return $result;
    }

    /**
     * @param  array<string, mixed>  $body
     * @return array<string, mixed>
     */
    public function searchReviews(
        TikTokShopConnection $connection,
        array $body = [],
        int $pageSize = 20,
        ?string $pageToken = null,
    ): array {
        $connection = $this->ensureFreshToken($connection);

        $result = $this->client()->searchReviews(
            $connection->access_token,
            $connection->shop_cipher,
            $body,
            min(max($pageSize, 1), 50),
            $pageToken,
        );

        $connection->update(['last_synced_at' => now()]);

        return $result;
    }

    public function replyToReview(TikTokShopConnection $connection, string $reviewId, string $content): array
    {
        $connection = $this->ensureFreshToken($connection);

        return $this->client()->replyToReview(
            $connection->access_token,
            $connection->shop_cipher,
            $reviewId,
            $content,
        );
    }

    private function ensureFreshToken(TikTokShopConnection $connection): TikTokShopConnection
    {
        if (! $connection->tokenNeedsRefresh()) {
            return $connection;
        }

        try {
            return $this->authService->refreshConnectionTokens($connection);
        } catch (RuntimeException $exception) {
            $connection->markConnectionError($exception->getMessage());
            throw new RuntimeException(
                'TikTok Shop access token expired. Reconnect the shop or refresh the token.',
                previous: $exception,
            );
        }
    }

    private function client(): TikTokShopApiClient
    {
        return TikTokShopApiClient::fromConfig();
    }
}
