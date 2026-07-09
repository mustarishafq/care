<?php

namespace App\Services\Marketplace;

use App\Models\MarketplaceProductReview;
use App\Models\MarketplaceShopConnection;
use App\Models\ShopeeConnection;
use App\Models\TikTokShopConnection;
use App\Services\Shopee\ShopeeService;
use App\Services\TikTokShop\TikTokShopService;
use App\Support\MarketplacePlatform;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use RuntimeException;

class MarketplaceReviewSyncService
{
    public function __construct(
        private readonly TikTokShopService $shopService,
        private readonly ShopeeService $shopeeService,
        private readonly MarketplaceComplaintBridgeService $complaintBridge,
    ) {}

    /**
     * @return array{synced: int, created_complaints: int, next_page_token: string|null}
     */
    public function syncTikTokShopReviews(
        TikTokShopConnection $connection,
        int $pageSize = 20,
        ?string $pageToken = null,
        ?string $productId = null,
        ?int $minRating = null,
        ?int $maxRating = null,
    ): array {
        $body = array_filter([
            'product_id' => $productId,
            'min_rating' => $minRating,
            'max_rating' => $maxRating,
        ], fn ($value) => $value !== null && $value !== '');

        $result = $this->shopService->searchReviews(
            $connection,
            $body,
            $pageSize,
            $pageToken,
        );

        $reviews = $this->extractReviewItems($result);
        $synced = 0;
        $createdComplaints = 0;

        foreach ($reviews as $item) {
            $review = $this->upsertTikTokReview($connection, $item);
            $synced++;

            if ($this->complaintBridge->maybeCreateComplaintForReview($review)) {
                $createdComplaints++;
            }
        }

        return [
            'synced' => $synced,
            'created_complaints' => $createdComplaints,
            'next_page_token' => $result['next_page_token'] ?? null,
        ];
    }

    /**
     * @return Collection<int, MarketplaceProductReview>
     */
    public function listAllReviews(
        ?string $platform = null,
        ?int $connectionId = null,
        ?int $minRating = null,
        ?int $maxRating = null,
        int $limit = 200,
    ): Collection {
        return MarketplaceProductReview::query()
            ->with('shopConnection')
            ->when($platform, fn ($query) => $query->where('platform', $platform))
            ->when($connectionId, fn ($query) => $query->where('marketplace_shop_connection_id', $connectionId))
            ->when($minRating, fn ($query) => $query->where('rating', '>=', $minRating))
            ->when($maxRating, fn ($query) => $query->where('rating', '<=', $maxRating))
            ->orderByDesc('review_created_at')
            ->orderByDesc('id')
            ->limit($limit)
            ->get();
    }

    /**
     * @return array{synced: int, created_complaints: int, next_page_token: string|null}
     */
    public function syncConnection(
        MarketplaceShopConnection $connection,
        int $pageSize = 20,
        ?string $pageToken = null,
        ?string $productId = null,
        ?int $minRating = null,
        ?int $maxRating = null,
    ): array {
        if ($connection->platform === MarketplacePlatform::TIKTOK_SHOP) {
            /** @var TikTokShopConnection $tiktokConnection */
            $tiktokConnection = TikTokShopConnection::withoutGlobalScopes()->findOrFail($connection->id);

            return $this->syncTikTokShopReviews(
                $tiktokConnection,
                $pageSize,
                $pageToken,
                $productId,
                $minRating,
                $maxRating,
            );
        }

        if ($connection->platform === MarketplacePlatform::SHOPEE) {
            /** @var ShopeeConnection $shopeeConnection */
            $shopeeConnection = ShopeeConnection::withoutGlobalScopes()->findOrFail($connection->id);

            return $this->syncShopeeReviews(
                $shopeeConnection,
                $pageSize,
                $pageToken,
                $productId,
                $minRating,
                $maxRating,
            );
        }

        throw new RuntimeException("Review sync is not implemented for platform [{$connection->platform}] yet.");
    }

    /**
     * @return Collection<int, MarketplaceProductReview>
     */
    public function listStoredReviews(
        MarketplaceShopConnection $connection,
        ?int $minRating = null,
        ?int $maxRating = null,
        int $limit = 100,
    ): Collection {
        return MarketplaceProductReview::query()
            ->where('marketplace_shop_connection_id', $connection->id)
            ->when($minRating, fn ($query) => $query->where('rating', '>=', $minRating))
            ->when($maxRating, fn ($query) => $query->where('rating', '<=', $maxRating))
            ->orderByDesc('review_created_at')
            ->orderByDesc('id')
            ->limit($limit)
            ->get();
    }

    public function replyToReview(MarketplaceProductReview $review, string $content): MarketplaceProductReview
    {
        if ($review->platform === MarketplacePlatform::TIKTOK_SHOP) {
            /** @var TikTokShopConnection $connection */
            $connection = TikTokShopConnection::query()->findOrFail($review->marketplace_shop_connection_id);

            $this->shopService->replyToReview($connection, $review->external_review_id, $content);
        } elseif ($review->platform === MarketplacePlatform::SHOPEE) {
            /** @var ShopeeConnection $connection */
            $connection = ShopeeConnection::query()->findOrFail($review->marketplace_shop_connection_id);

            $this->shopeeService->replyToComment(
                $connection,
                (int) $review->external_review_id,
                $content,
            );
        } else {
            throw new RuntimeException("Replies are not supported for platform [{$review->platform}] yet.");
        }

        $review->update([
            'seller_reply' => $content,
            'seller_replied_at' => now(),
        ]);

        return $review->fresh();
    }

    /**
     * @return array{synced: int, created_complaints: int, next_page_token: string|null}
     */
    public function syncShopeeReviews(
        ShopeeConnection $connection,
        int $pageSize = 20,
        ?string $pageToken = null,
        ?string $productId = null,
        ?int $minRating = null,
        ?int $maxRating = null,
    ): array {
        $query = array_filter([
            'cursor' => $pageToken ?? '',
            'page_size' => min(max($pageSize, 1), 50),
            'item_id' => $productId ? (int) $productId : null,
        ], fn ($value) => $value !== null && $value !== '');

        $result = $this->shopeeService->getComments($connection, $query);
        $reviews = $this->extractShopeeReviewItems($result);
        $synced = 0;
        $createdComplaints = 0;

        foreach ($reviews as $item) {
            $rating = $this->normalizeRating($item['rating_star'] ?? $item['rating'] ?? null);

            if ($minRating !== null && ($rating === null || $rating < $minRating)) {
                continue;
            }

            if ($maxRating !== null && ($rating === null || $rating > $maxRating)) {
                continue;
            }

            $review = $this->upsertShopeeReview($connection, $item);
            $synced++;

            if ($this->complaintBridge->maybeCreateComplaintForReview($review)) {
                $createdComplaints++;
            }
        }

        return [
            'synced' => $synced,
            'created_complaints' => $createdComplaints,
            'next_page_token' => isset($result['next_cursor']) && $result['next_cursor'] !== ''
                ? (string) $result['next_cursor']
                : null,
        ];
    }

    /**
     * @param  array<string, mixed>  $item
     */
    private function upsertShopeeReview(ShopeeConnection $connection, array $item): MarketplaceProductReview
    {
        $externalId = (string) ($item['comment_id'] ?? $item['cmtid'] ?? $item['id'] ?? '');

        if ($externalId === '') {
            throw new RuntimeException('Shopee review payload is missing comment_id.');
        }

        $rating = $this->normalizeRating($item['rating_star'] ?? $item['rating'] ?? null);
        $createdAt = $this->normalizeTimestamp($item['create_time'] ?? $item['ctime'] ?? null);
        $reply = is_array($item['comment_reply'] ?? null) ? $item['comment_reply'] : [];

        return MarketplaceProductReview::updateOrCreate(
            [
                'platform' => MarketplacePlatform::SHOPEE,
                'marketplace_shop_connection_id' => $connection->id,
                'external_review_id' => $externalId,
            ],
            [
                'external_product_id' => (string) ($item['item_id'] ?? $item['order_sn'] ?? ''),
                'product_name' => $item['item_name'] ?? $item['product_name'] ?? null,
                'rating' => $rating,
                'review_text' => $item['comment'] ?? $item['buyer_comment'] ?? $item['text'] ?? null,
                'reviewer_name' => $item['buyer_username'] ?? $item['buyer_name'] ?? null,
                'review_created_at' => $createdAt,
                'seller_reply' => $reply['comment'] ?? $item['seller_reply'] ?? null,
                'seller_replied_at' => $this->normalizeTimestamp($reply['create_time'] ?? null),
                'raw_metadata' => $item,
                'synced_at' => now(),
            ],
        );
    }

    /**
     * @param  array<string, mixed>  $item
     */
    private function upsertTikTokReview(TikTokShopConnection $connection, array $item): MarketplaceProductReview
    {
        $reviewData = is_array($item['review'] ?? null) ? $item['review'] : $item;
        $externalId = (string) ($reviewData['review_id'] ?? $reviewData['id'] ?? $item['review_id'] ?? '');

        if ($externalId === '') {
            throw new RuntimeException('TikTok review payload is missing review_id.');
        }

        $rating = $this->normalizeRating($reviewData['rating'] ?? $reviewData['review_rating'] ?? null);
        $createdAt = $this->normalizeTimestamp($reviewData['create_time'] ?? $reviewData['created_at'] ?? null);

        return MarketplaceProductReview::updateOrCreate(
            [
                'platform' => MarketplacePlatform::TIKTOK_SHOP,
                'marketplace_shop_connection_id' => $connection->id,
                'external_review_id' => $externalId,
            ],
            [
                'external_product_id' => (string) ($reviewData['product_id'] ?? $item['product_id'] ?? ''),
                'product_name' => $reviewData['product_name'] ?? $item['product_name'] ?? null,
                'rating' => $rating,
                'review_text' => $reviewData['review_text'] ?? $reviewData['text'] ?? $reviewData['content'] ?? null,
                'reviewer_name' => $reviewData['display_name'] ?? $reviewData['buyer_name'] ?? $reviewData['user_name'] ?? null,
                'review_created_at' => $createdAt,
                'seller_reply' => $reviewData['seller_reply'] ?? $reviewData['reply_text'] ?? null,
                'seller_replied_at' => $this->normalizeTimestamp($reviewData['seller_reply_time'] ?? null),
                'raw_metadata' => $item,
                'synced_at' => now(),
            ],
        );
    }

    /**
     * @param  array<string, mixed>  $result
     * @return list<array<string, mixed>>
     */
    private function extractReviewItems(array $result): array
    {
        foreach (['reviews', 'review_list', 'review_items', 'items'] as $key) {
            if (isset($result[$key]) && is_array($result[$key])) {
                return $result[$key];
            }
        }

        return [];
    }

    /**
     * @param  array<string, mixed>  $result
     * @return list<array<string, mixed>>
     */
    private function extractShopeeReviewItems(array $result): array
    {
        foreach (['item_comment_list', 'comments', 'comment_list', 'items'] as $key) {
            if (isset($result[$key]) && is_array($result[$key])) {
                return $result[$key];
            }
        }

        return [];
    }

    private function normalizeRating(mixed $rating): ?int
    {
        if (is_numeric($rating)) {
            return max(1, min(5, (int) $rating));
        }

        if (is_string($rating)) {
            $map = [
                'ONE' => 1, 'TWO' => 2, 'THREE' => 3, 'FOUR' => 4, 'FIVE' => 5,
            ];
            $upper = strtoupper(trim($rating));
            if (isset($map[$upper])) {
                return $map[$upper];
            }
            if (is_numeric($rating)) {
                return max(1, min(5, (int) $rating));
            }
        }

        return null;
    }

    private function normalizeTimestamp(mixed $value): ?Carbon
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (is_numeric($value)) {
            $seconds = (int) $value;
            if ($seconds > 9999999999) {
                return Carbon::createFromTimestampMs($seconds);
            }

            return Carbon::createFromTimestamp($seconds);
        }

        return Carbon::parse((string) $value);
    }
}
