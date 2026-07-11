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
     * Pull product reviews via Seller Center cookie session (no official review list API).
     *
     * @return array{list: list<array<string, mixed>>, total: int, next_page: int|null, page: int, size: int}
     */
    public function searchReviews(
        TikTokShopConnection $connection,
        int $pageSize = 20,
        ?string $pageToken = null,
        ?int $lookbackDays = null,
        ?int $reviewStartTime = null,
        ?int $reviewEndTime = null,
    ): array {
        $page = max(1, (int) ($pageToken ?: 1));
        $days = max(1, min($lookbackDays ?? 30, 365));

        $start = $reviewStartTime ?? now()->subDays($days)->startOfDay()->timestamp;
        $end = $reviewEndTime ?? now()->endOfDay()->timestamp;

        $result = TikTokSellerReviewClient::fromConnection($connection)->listReviews(
            (string) $connection->shop_id,
            $page,
            min(max($pageSize, 1), 50),
            $start,
            $end,
        );

        $connection->update(['last_synced_at' => now()]);

        return $result;
    }

    public function replyToReview(TikTokShopConnection $connection, string $reviewId, string $content): array
    {
        $authMode = $connection->metadata['auth_mode'] ?? null;

        if ($authMode === 'seller_cookie' || $connection->shop_cipher === 'seller_cookie') {
            return TikTokSellerReviewClient::fromConnection($connection)->replyToReview(
                (string) $connection->shop_id,
                $reviewId,
                $content,
            );
        }

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
