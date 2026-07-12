<?php

namespace App\Services\Marketplace;

use App\Models\MarketplaceProductReview;
use App\Models\MarketplaceShopConnection;
use App\Models\ShopeeConnection;
use App\Models\TikTokShopConnection;
use App\Services\Shopee\ShopeeService;
use App\Services\Shopee\ShopeeSellerReviewClient;
use App\Services\TikTokShop\TikTokSellerReviewClient;
use App\Services\TikTokShop\TikTokShopService;
use App\Support\MarketplacePlatform;
use App\Support\MarketplaceReviewImages;
use Carbon\Carbon;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;
use RuntimeException;

class MarketplaceReviewSyncService
{
    public function __construct(
        private readonly TikTokShopService $shopService,
        private readonly ShopeeService $shopeeService,
        private readonly MarketplaceComplaintBridgeService $complaintBridge,
    ) {}

    /**
     * Create or update a TikTok shop backed by a Seller Center cookie (supports multiple shops).
     *
     * @param  array{cookie: string, shop_name?: string|null, seller_id?: string|null, region?: string|null}  $input
     */
    public function upsertTikTokCookieShop(array $input, ?int $userId = null): TikTokShopConnection
    {
        $cookie = trim((string) ($input['cookie'] ?? ''));
        if ($cookie === '') {
            throw new RuntimeException('Seller Center cookie is required.');
        }

        $credentials = app(MarketplacePlatformConfigService::class)
            ->getCredentials(MarketplacePlatform::TIKTOK_SHOP);
        $region = strtoupper(trim((string) ($input['region'] ?? $credentials['region'] ?? 'MY'))) ?: 'MY';
        $sellerId = trim((string) ($input['seller_id'] ?? ''));
        if ($sellerId === '') {
            $sellerId = TikTokSellerReviewClient::extractSellerIdFromCookie($cookie);
        }

        $fp = TikTokSellerReviewClient::cookieValue($cookie, 's_v_web_id');
        $shopName = trim((string) ($input['shop_name'] ?? ''));
        if ($shopName === '') {
            $shopName = 'TikTok Shop '.$sellerId;
        }

        $connection = TikTokShopConnection::withoutGlobalScopes()
            ->where('platform', MarketplacePlatform::TIKTOK_SHOP)
            ->where('shop_id', $sellerId)
            ->where('region', $region)
            ->first();

        $metadata = array_merge(
            is_array($connection?->metadata) ? $connection->metadata : [],
            [
                'auth_mode' => 'seller_cookie',
                'seller_cookie' => TikTokSellerReviewClient::encryptCookie($cookie),
                'seller_fp' => $fp !== '' ? $fp : null,
                'cookie_updated_at' => now()->toIso8601String(),
            ],
        );

        $payload = [
            'platform' => MarketplacePlatform::TIKTOK_SHOP,
            'shop_id' => $sellerId,
            'shop_cipher' => 'seller_cookie',
            'shop_name' => $shopName,
            'region' => $region,
            'access_token' => 'seller_cookie',
            'refresh_token' => null,
            'access_token_expires_at' => null,
            'refresh_token_expires_at' => null,
            'is_active' => true,
            'connection_error' => null,
            'token_refresh_failed_at' => null,
            'metadata' => $metadata,
        ];

        if ($userId) {
            $payload['connected_by_user_id'] = $userId;
        }

        if ($connection) {
            // Keep existing display name unless a new one was provided.
            if (trim((string) ($input['shop_name'] ?? '')) === '' && $connection->shop_name) {
                $payload['shop_name'] = $connection->shop_name;
            }
            $connection->fill($payload);
            $connection->save();

            return $connection->fresh();
        }

        return TikTokShopConnection::withoutGlobalScopes()->create($payload);
    }

    /**
     * Create or update a Shopee shop backed by a Seller Center cookie (supports multiple shops).
     *
     * @param  array{cookie: string, shop_name?: string|null, shop_id?: string|null, region?: string|null}  $input
     */
    public function upsertShopeeCookieShop(array $input, ?int $userId = null): ShopeeConnection
    {
        $cookie = trim((string) ($input['cookie'] ?? ''));
        if ($cookie === '') {
            throw new RuntimeException('Seller Center cookie is required.');
        }

        $credentials = app(MarketplacePlatformConfigService::class)
            ->getCredentials(MarketplacePlatform::SHOPEE);
        $region = strtoupper(trim((string) ($input['region'] ?? $credentials['region'] ?? 'MY'))) ?: 'MY';

        $client = new ShopeeSellerReviewClient($cookie, $region);
        $profile = $client->resolveShopProfile();

        $shopId = trim((string) ($input['shop_id'] ?? ''));
        if ($shopId === '') {
            $shopId = $profile['shop_id'];
        }

        $region = strtoupper((string) ($profile['region'] ?: $region)) ?: 'MY';
        $shopName = trim((string) ($input['shop_name'] ?? ''));
        if ($shopName === '') {
            $shopName = $profile['shop_name'] ?: ('Shopee Shop '.$shopId);
        }

        $connection = ShopeeConnection::withoutGlobalScopes()
            ->where('platform', MarketplacePlatform::SHOPEE)
            ->where('shop_id', $shopId)
            ->where('region', $region)
            ->first();

        $metadata = array_merge(
            is_array($connection?->metadata) ? $connection->metadata : [],
            [
                'auth_mode' => 'seller_cookie',
                'seller_cookie' => ShopeeSellerReviewClient::encryptCookie($cookie),
                'cookie_updated_at' => now()->toIso8601String(),
            ],
        );

        $payload = [
            'platform' => MarketplacePlatform::SHOPEE,
            'shop_id' => $shopId,
            'shop_cipher' => 'seller_cookie',
            'shop_name' => $shopName,
            'region' => $region,
            'access_token' => 'seller_cookie',
            'refresh_token' => null,
            'access_token_expires_at' => null,
            'refresh_token_expires_at' => null,
            'is_active' => true,
            'connection_error' => null,
            'token_refresh_failed_at' => null,
            'metadata' => $metadata,
        ];

        if ($userId) {
            $payload['connected_by_user_id'] = $userId;
        }

        if ($connection) {
            if (trim((string) ($input['shop_name'] ?? '')) === '' && $connection->shop_name) {
                $payload['shop_name'] = $connection->shop_name;
            }
            $connection->fill($payload);
            $connection->save();

            return $connection->fresh();
        }

        return ShopeeConnection::withoutGlobalScopes()->create($payload);
    }

    /**
     * @deprecated Use upsertTikTokCookieShop() — kept for legacy single-cookie callers.
     */
    public function ensureTikTokCookieConnection(?int $userId = null): TikTokShopConnection
    {
        $credentials = app(MarketplacePlatformConfigService::class)
            ->getCredentials(MarketplacePlatform::TIKTOK_SHOP);
        $settings = $credentials['settings'];
        $cookie = TikTokSellerReviewClient::decryptCookie($settings['seller_cookie'] ?? null);

        if ($cookie === '') {
            $existing = TikTokShopConnection::query()
                ->where('is_active', true)
                ->get()
                ->first(function (TikTokShopConnection $connection) {
                    $metadata = is_array($connection->metadata) ? $connection->metadata : [];

                    return ($metadata['auth_mode'] ?? null) === 'seller_cookie'
                        && TikTokSellerReviewClient::decryptCookie($metadata['seller_cookie'] ?? null) !== '';
                });

            if ($existing) {
                return $existing;
            }

            throw new RuntimeException(
                'No TikTok shop cookie configured. Add a shop under Marketplace → TikTok Shop.',
            );
        }

        return $this->upsertTikTokCookieShop([
            'cookie' => $cookie,
            'seller_id' => $settings['seller_id'] ?? null,
            'region' => $credentials['region'] ?? 'MY',
            'shop_name' => 'TikTok Shop ('.strtoupper((string) ($credentials['region'] ?: 'MY')).')',
        ], $userId);
    }

    public function syncTikTokShopReviews(
        TikTokShopConnection $connection,
        int $pageSize = 50,
        ?string $pageToken = null,
        ?string $productId = null,
        ?int $minRating = null,
        ?int $maxRating = null,
        bool $fetchAll = true,
        ?Carbon $startAt = null,
        ?Carbon $endAt = null,
    ): array {
        $lookbackDays = (int) app(MarketplacePlatformConfigService::class)
            ->getSetting(MarketplacePlatform::TIKTOK_SHOP, 'review_lookback_days', 30);

        $rangeStart = ($startAt ?? now()->subDays(max(1, $lookbackDays)))->copy()->startOfDay();
        $rangeEnd = ($endAt ?? now())->copy()->endOfDay();
        $pageSize = min(max($pageSize, 1), 50);

        // Large single-range pagination eventually fails with TikTok "internal error".
        // Day windows keep each request shallow and cover the full reported total.
        $windows = $fetchAll
            ? $this->shopeeSyncWindows($rangeStart, $rangeEnd)
            : [[$rangeStart->timestamp, $rangeEnd->timestamp]];

        $synced = 0;
        $created = 0;
        $updated = 0;
        $createdComplaints = 0;
        $pagesFetched = 0;
        $seen = [];
        $reportedTotal = 0;

        foreach ($windows as [$windowStart, $windowEnd]) {
            $page = 1;
            $windowFetched = 0;
            $windowTotal = null;
            $emptyStreak = 0;

            while ($page <= 200) {
                $result = $this->shopService->searchReviews(
                    $connection,
                    $pageSize,
                    (string) $page,
                    $lookbackDays,
                    $windowStart,
                    $windowEnd,
                );

                $pagesFetched++;
                $pageList = $result['list'] ?? [];
                $windowFetched += count($pageList);
                if (isset($result['total'])) {
                    $windowTotal = (int) $result['total'];
                    if ($page === 1) {
                        $reportedTotal += $windowTotal;
                    }
                }

                Log::debug('tiktok_shop.reviews.seller_cookie.raw_response', [
                    'connection_id' => $connection->id,
                    'shop_id' => $connection->shop_id,
                    'window_start' => $windowStart,
                    'window_end' => $windowEnd,
                    'page' => $result['page'] ?? $page,
                    'total' => $result['total'] ?? null,
                    'list_count' => count($pageList),
                ]);

                if (count($pageList) === 0) {
                    $emptyStreak++;
                    if ($emptyStreak >= 2) {
                        break;
                    }
                    $page++;
                    continue;
                }
                $emptyStreak = 0;

                foreach ($this->extractReviewItems($result) as $item) {
                    $productInfo = is_array($item['product_info'] ?? null) ? $item['product_info'] : [];
                    $itemProductId = (string) ($productInfo['product_id'] ?? $item['product_id'] ?? '');

                    if ($productId !== null && $productId !== '' && $itemProductId !== $productId) {
                        continue;
                    }

                    $rating = $this->normalizeRating($item['star_level'] ?? $item['rating'] ?? null);

                    if ($minRating !== null && ($rating === null || $rating < $minRating)) {
                        continue;
                    }

                    if ($maxRating !== null && ($rating === null || $rating > $maxRating)) {
                        continue;
                    }

                    $reviewData = is_array($item['review'] ?? null) ? $item['review'] : $item;
                    $externalId = (string) (
                        $reviewData['main_review_id']
                        ?? $reviewData['review_id']
                        ?? $reviewData['id']
                        ?? $item['main_review_id']
                        ?? $item['review_id']
                        ?? ''
                    );

                    if ($externalId === '') {
                        continue;
                    }

                    if (isset($seen[$externalId])) {
                        continue;
                    }
                    $seen[$externalId] = true;

                    $existed = MarketplaceProductReview::query()
                        ->where('platform', MarketplacePlatform::TIKTOK_SHOP)
                        ->where('marketplace_shop_connection_id', $connection->id)
                        ->where('external_review_id', $externalId)
                        ->exists();

                    $review = $this->upsertTikTokReview($connection, $item);
                    $synced++;

                    if ($existed) {
                        $updated++;
                    } else {
                        $created++;
                    }

                    if ($this->complaintBridge->maybeCreateComplaintForReview($review)) {
                        $createdComplaints++;
                    }

                    $this->notifyLowRatingIfNeeded($review);
                }

                $nextPage = $result['next_page'] ?? null;
                if ($nextPage === null
                    && count($pageList) > 0
                    && $windowTotal !== null
                    && $windowFetched < $windowTotal
                    && ($page * $pageSize) < $windowTotal
                ) {
                    $nextPage = $page + 1;
                }

                if ($nextPage === null) {
                    break;
                }

                $page = (int) $nextPage;
            }
        }

        return [
            'synced' => $synced,
            'created' => $created,
            'updated' => $updated,
            'created_complaints' => $createdComplaints,
            'pages_fetched' => $pagesFetched,
            'reported_total' => $reportedTotal,
            'unique_reviews' => count($seen),
            'next_page_token' => null,
        ];
    }

    /**
     * @return LengthAwarePaginator<int, MarketplaceProductReview>
     */
    public function listAllReviews(
        ?string $platform = null,
        ?int $connectionId = null,
        ?int $minRating = null,
        ?int $maxRating = null,
        int $perPage = 20,
        ?string $replyStatus = null,
        int $page = 1,
        ?Carbon $startAt = null,
        ?Carbon $endAt = null,
        ?string $productName = null,
    ): LengthAwarePaginator {
        return $this->filteredReviewsQuery(
            $platform,
            $connectionId,
            $minRating,
            $maxRating,
            $replyStatus,
            $startAt,
            $endAt,
            $productName,
        )
            ->with('shopConnection')
            ->orderByDesc('review_created_at')
            ->orderByDesc('id')
            ->paginate(
                perPage: min(max($perPage, 1), 100),
                page: max(1, $page),
            );
    }

    /**
     * Aggregate counts for the same filters as the review list (all matching rows, not just the page).
     *
     * @return array{total: int, unreplied: int, replied: int, low: int}
     */
    public function reviewStats(
        ?string $platform = null,
        ?int $connectionId = null,
        ?int $minRating = null,
        ?int $maxRating = null,
        ?string $replyStatus = null,
        ?Carbon $startAt = null,
        ?Carbon $endAt = null,
        ?string $productName = null,
    ): array {
        $row = $this->filteredReviewsQuery(
            $platform,
            $connectionId,
            $minRating,
            $maxRating,
            $replyStatus,
            $startAt,
            $endAt,
            $productName,
        )
            ->selectRaw('COUNT(*) as total')
            ->selectRaw("SUM(CASE WHEN seller_reply IS NOT NULL AND seller_reply != '' THEN 1 ELSE 0 END) as replied")
            ->selectRaw("SUM(CASE WHEN seller_reply IS NULL OR seller_reply = '' THEN 1 ELSE 0 END) as unreplied")
            ->selectRaw('SUM(CASE WHEN rating IS NOT NULL AND rating <= 3 THEN 1 ELSE 0 END) as low')
            ->first();

        return [
            'total' => (int) ($row->total ?? 0),
            'replied' => (int) ($row->replied ?? 0),
            'unreplied' => (int) ($row->unreplied ?? 0),
            'low' => (int) ($row->low ?? 0),
        ];
    }

    /**
     * @return Builder<MarketplaceProductReview>
     */
    private function filteredReviewsQuery(
        ?string $platform = null,
        ?int $connectionId = null,
        ?int $minRating = null,
        ?int $maxRating = null,
        ?string $replyStatus = null,
        ?Carbon $startAt = null,
        ?Carbon $endAt = null,
        ?string $productName = null,
    ): Builder {
        return MarketplaceProductReview::query()
            ->when($platform, fn ($query) => $query->where('platform', $platform))
            ->when($connectionId, fn ($query) => $query->where('marketplace_shop_connection_id', $connectionId))
            ->when($productName, function ($query) use ($productName) {
                $escaped = addcslashes($productName, '%_\\');
                $query->where('product_name', 'like', '%'.$escaped.'%');
            })
            ->when($minRating, fn ($query) => $query->where('rating', '>=', $minRating))
            ->when($maxRating, fn ($query) => $query->where('rating', '<=', $maxRating))
            ->when($startAt, fn ($query) => $query->where('review_created_at', '>=', $startAt->copy()->startOfDay()))
            ->when($endAt, fn ($query) => $query->where('review_created_at', '<=', $endAt->copy()->endOfDay()))
            ->when($replyStatus === 'replied', function ($query) {
                $query->whereNotNull('seller_reply')->where('seller_reply', '!=', '');
            })
            ->when($replyStatus === 'unreplied', function ($query) {
                $query->where(function ($inner) {
                    $inner->whereNull('seller_reply')->orWhere('seller_reply', '');
                });
            });
    }

    /**
     * @return array{synced: int, created_complaints: int, next_page_token: string|null}
     */
    public function syncConnection(
        MarketplaceShopConnection $connection,
        int $pageSize = 50,
        ?string $pageToken = null,
        ?string $productId = null,
        ?int $minRating = null,
        ?int $maxRating = null,
        bool $fetchAll = true,
        ?Carbon $startAt = null,
        ?Carbon $endAt = null,
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
                $fetchAll,
                $startAt,
                $endAt,
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
                $fetchAll,
                $startAt,
                $endAt,
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

            if (ShopeeSellerReviewClient::isCookieAuth($connection)) {
                ShopeeSellerReviewClient::fromConnection($connection)
                    ->replyToReview((int) $review->external_review_id, $content);
            } else {
                $this->shopeeService->replyToComment(
                    $connection,
                    (int) $review->external_review_id,
                    $content,
                );
            }
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
     * @return array{synced: int, created_complaints: int, next_page_token: string|null, pages_fetched?: int}
     */
    public function syncShopeeReviews(
        ShopeeConnection $connection,
        int $pageSize = 20,
        ?string $pageToken = null,
        ?string $productId = null,
        ?int $minRating = null,
        ?int $maxRating = null,
        bool $fetchAll = true,
        ?Carbon $startAt = null,
        ?Carbon $endAt = null,
    ): array {
        if (ShopeeSellerReviewClient::isCookieAuth($connection)) {
            return $this->syncShopeeCookieReviews(
                $connection,
                $pageSize,
                $pageToken,
                $productId,
                $minRating,
                $maxRating,
                $fetchAll,
                $startAt,
                $endAt,
            );
        }

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

            $this->notifyLowRatingIfNeeded($review);
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
     * @return array{synced: int, created_complaints: int, next_page_token: string|null, pages_fetched: int}
     */
    private function syncShopeeCookieReviews(
        ShopeeConnection $connection,
        int $pageSize = 20,
        ?string $pageToken = null,
        ?string $productId = null,
        ?int $minRating = null,
        ?int $maxRating = null,
        bool $fetchAll = true,
        ?Carbon $startAt = null,
        ?Carbon $endAt = null,
    ): array {
        $lookbackDays = (int) app(MarketplacePlatformConfigService::class)
            ->getSetting(MarketplacePlatform::SHOPEE, 'review_lookback_days', 30);

        $startAt = ($startAt ?? now()->subDays(max(1, $lookbackDays)))->copy()->startOfDay();
        $endAt = ($endAt ?? now())->copy()->endOfDay();

        $stars = null;
        if ($minRating !== null || $maxRating !== null) {
            $min = $minRating ?? 1;
            $max = $maxRating ?? 5;
            $stars = [];
            for ($star = $min; $star <= $max; $star++) {
                $stars[] = $star;
            }
        }

        // Seller Center cursor pagination requires signed browser headers; day windows + page_size=50
        // reliably cover the range without those headers.
        $size = min(max($pageSize, 1), 50);
        $client = ShopeeSellerReviewClient::fromConnection($connection);
        $synced = 0;
        $createdComplaints = 0;
        $pagesFetched = 0;
        $seen = [];

        $windows = $fetchAll
            ? $this->shopeeSyncWindows($startAt, $endAt)
            : [[$startAt->timestamp, $endAt->timestamp]];

        foreach ($windows as [$windowStart, $windowEnd]) {
            $chunks = [[$windowStart, $windowEnd]];
            $guard = 0;

            while ($chunks !== [] && $guard < 64) {
                $guard++;
                [$chunkStart, $chunkEnd] = array_shift($chunks);

                $result = $client->listReviews(1, $size, $chunkStart, $chunkEnd, $stars, 0);
                $pagesFetched++;

                foreach ($result['list'] as $item) {
                    $externalId = (string) ($item['comment_id'] ?? '');
                    if ($externalId !== '' && isset($seen[$externalId])) {
                        continue;
                    }
                    if ($externalId !== '') {
                        $seen[$externalId] = true;
                    }

                    if ($productId) {
                        $itemProductId = (string) ($item['item_id'] ?? $item['product_id'] ?? '');
                        if ($itemProductId !== '' && $itemProductId !== (string) $productId) {
                            continue;
                        }
                    }

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

                    $this->notifyLowRatingIfNeeded($review);
                }

                // If this window still has more than one page, split the time range and retry.
                if ($fetchAll && $result['total'] > $size && ($chunkEnd - $chunkStart) > 3600) {
                    $mid = intdiv($chunkStart + $chunkEnd, 2);
                    $chunks[] = [$chunkStart, $mid];
                    $chunks[] = [$mid + 1, $chunkEnd];
                }
            }
        }

        $connection->update(['last_synced_at' => now()]);

        return [
            'synced' => $synced,
            'created_complaints' => $createdComplaints,
            'next_page_token' => null,
            'pages_fetched' => $pagesFetched,
        ];
    }

    /**
     * @return list<array{0: int, 1: int}>
     */
    private function shopeeSyncWindows(Carbon $startAt, Carbon $endAt): array
    {
        $windows = [];
        $cursor = $startAt->copy()->startOfDay();
        $endDay = $endAt->copy()->endOfDay();

        while ($cursor->lte($endDay)) {
            $dayStart = $cursor->copy()->startOfDay();
            $dayEnd = $cursor->copy()->endOfDay();
            if ($dayEnd->gt($endAt)) {
                $dayEnd = $endAt->copy();
            }
            if ($dayStart->lt($startAt)) {
                $dayStart = $startAt->copy();
            }
            $windows[] = [$dayStart->timestamp, $dayEnd->timestamp];
            $cursor->addDay();
        }

        return $windows !== [] ? $windows : [[$startAt->timestamp, $endAt->timestamp]];
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

        $region = (string) ($connection->region ?: 'MY');
        $rating = $this->normalizeRating($item['rating_star'] ?? $item['rating'] ?? null);
        $createdAt = $this->normalizeTimestamp($item['create_time'] ?? $item['ctime'] ?? $item['submit_time'] ?? null);

        $reply = is_array($item['reply'] ?? null)
            ? $item['reply']
            : (is_array($item['comment_reply'] ?? null) ? $item['comment_reply'] : []);

        $replyText = $reply['comment'] ?? $reply['reply'] ?? $item['seller_reply'] ?? null;
        if (is_string($replyText)) {
            $replyText = trim($replyText);
            if ($replyText === '') {
                $replyText = null;
            }
        } else {
            $replyText = null;
        }

        $replyTime = $reply['ctime'] ?? $reply['create_time'] ?? null;

        $existing = MarketplaceProductReview::query()
            ->where('platform', MarketplacePlatform::SHOPEE)
            ->where('marketplace_shop_connection_id', $connection->id)
            ->where('external_review_id', $externalId)
            ->first();

        if ($replyText === null && $existing && filled($existing->seller_reply)) {
            $replyText = $existing->seller_reply;
            $replyTime = $existing->seller_replied_at ?? $replyTime;
        }

        return MarketplaceProductReview::updateOrCreate(
            [
                'platform' => MarketplacePlatform::SHOPEE,
                'marketplace_shop_connection_id' => $connection->id,
                'external_review_id' => $externalId,
            ],
            [
                'external_product_id' => (string) ($item['item_id'] ?? $item['product_id'] ?? $item['order_sn'] ?? ''),
                'product_name' => $item['product_name'] ?? $item['item_name'] ?? null,
                'product_image_url' => MarketplaceReviewImages::productImageUrl($item, $region),
                'rating' => $rating,
                'review_text' => $item['comment'] ?? $item['buyer_comment'] ?? $item['text'] ?? null,
                'review_images' => MarketplaceReviewImages::reviewImages($item, $region),
                'reviewer_name' => $item['user_name'] ?? $item['buyer_username'] ?? $item['buyer_name'] ?? null,
                'review_created_at' => $createdAt,
                'seller_reply' => $replyText,
                'seller_replied_at' => $replyTime instanceof Carbon
                    ? $replyTime
                    : $this->normalizeTimestamp($replyTime),
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
        $productInfo = is_array($reviewData['product_info'] ?? null)
            ? $reviewData['product_info']
            : (is_array($item['product_info'] ?? null) ? $item['product_info'] : []);

        $externalId = (string) (
            $reviewData['main_review_id']
            ?? $reviewData['review_id']
            ?? $reviewData['id']
            ?? $item['main_review_id']
            ?? $item['review_id']
            ?? ''
        );

        if ($externalId === '') {
            throw new RuntimeException('TikTok review payload is missing review_id.');
        }

        $replyText = $reviewData['reply_text'] ?? $reviewData['seller_reply'] ?? null;
        if (is_string($replyText)) {
            $replyText = trim($replyText);
            if ($replyText === '') {
                $replyText = null;
            }
        } else {
            $replyText = null;
        }

        $replyTime = $reviewData['reply_time'] ?? $reviewData['seller_reply_time'] ?? null;
        if (is_numeric($replyTime) && (int) $replyTime === 0) {
            $replyTime = null;
        }

        $rating = $this->normalizeRating(
            $reviewData['star_level'] ?? $reviewData['rating'] ?? $reviewData['review_rating'] ?? null,
        );
        $createdAt = $this->normalizeTimestamp(
            $reviewData['review_time'] ?? $reviewData['create_time'] ?? $reviewData['created_at'] ?? null,
        );

        $existing = MarketplaceProductReview::query()
            ->where('platform', MarketplacePlatform::TIKTOK_SHOP)
            ->where('marketplace_shop_connection_id', $connection->id)
            ->where('external_review_id', $externalId)
            ->first();

        // Never wipe a stored reply if this page payload omitted / emptied reply_text.
        if ($replyText === null && $existing && filled($existing->seller_reply)) {
            $replyText = $existing->seller_reply;
            $replyTime = $existing->seller_replied_at ?? $replyTime;
        }

        return MarketplaceProductReview::updateOrCreate(
            [
                'platform' => MarketplacePlatform::TIKTOK_SHOP,
                'marketplace_shop_connection_id' => $connection->id,
                'external_review_id' => $externalId,
            ],
            [
                'external_product_id' => (string) ($productInfo['product_id'] ?? $reviewData['product_id'] ?? $item['product_id'] ?? ''),
                'product_name' => $productInfo['product_name'] ?? $reviewData['product_name'] ?? $item['product_name'] ?? null,
                'product_image_url' => MarketplaceReviewImages::productImageUrl($item)
                    ?? MarketplaceReviewImages::productImageUrl($reviewData),
                'rating' => $rating,
                'review_text' => $reviewData['review_text'] ?? $reviewData['text'] ?? $reviewData['content'] ?? null,
                'review_images' => MarketplaceReviewImages::reviewImages($reviewData) !== []
                    ? MarketplaceReviewImages::reviewImages($reviewData)
                    : MarketplaceReviewImages::reviewImages($item),
                'reviewer_name' => $reviewData['user_name'] ?? $reviewData['display_name'] ?? $reviewData['buyer_name'] ?? null,
                'review_created_at' => $createdAt,
                'seller_reply' => $replyText,
                'seller_replied_at' => $replyTime instanceof Carbon
                    ? $replyTime
                    : $this->normalizeTimestamp($replyTime),
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
        foreach (['list', 'reviews', 'review_list', 'review_items', 'items'] as $key) {
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

    private function notifyLowRatingIfNeeded(MarketplaceProductReview $review): void
    {
        app(LowRatingReviewAlertService::class)->notifyForReview($review);
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

        $timezone = (string) config('app.timezone', 'Asia/Kuala_Lumpur');

        if (is_numeric($value)) {
            $seconds = (int) $value;
            if ($seconds === 0) {
                return null;
            }

            $carbon = $seconds > 9999999999
                ? Carbon::createFromTimestampMs($seconds, $timezone)
                : Carbon::createFromTimestamp($seconds, $timezone);

            // Ignore epoch / sentinel values from marketplace APIs.
            if ($carbon->year < 2000) {
                return null;
            }

            return $carbon;
        }

        return Carbon::parse((string) $value, $timezone);
    }
}
