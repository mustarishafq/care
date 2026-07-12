<?php

namespace App\Services\Marketplace;

use App\Models\MarketplaceProductReview;
use App\Models\MarketplaceShopConnection;
use App\Models\Notification;
use App\Models\User;
use App\Support\MarketplacePlatform;
use App\Support\NotificationPayload;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

class LowRatingReviewAlertService
{
    public const EVENT_TYPE = 'low_rating_review';

    public const DEFAULT_MAX_RATING = 3;

    /** @var Collection<int, User>|null */
    private ?Collection $recipientCache = null;

    /**
     * Sync yesterday–today reviews, then notify users with reviews access for ratings ≤ max.
     *
     * @return array{notifications: int, reviews: int, synced_shops: int, failed_shops: int}
     */
    public function run(int $maxRating = self::DEFAULT_MAX_RATING, bool $sync = true): array
    {
        $maxRating = max(1, min(5, $maxRating));
        $startAt = now()->subDay()->startOfDay();
        $endAt = now()->endOfDay();

        $syncedShops = 0;
        $failedShops = 0;

        if ($sync) {
            [$syncedShops, $failedShops] = $this->syncActiveShops($startAt, $endAt);
        }

        $reviews = MarketplaceProductReview::query()
            ->with('shopConnection')
            ->whereNotNull('rating')
            ->where('rating', '<=', $maxRating)
            ->where('review_created_at', '>=', $startAt)
            ->where('review_created_at', '<=', $endAt)
            ->orderByDesc('review_created_at')
            ->orderByDesc('id')
            ->get();

        $notifications = 0;

        foreach ($reviews as $review) {
            $notifications += $this->notifyForReview($review, $maxRating);
        }

        return [
            'notifications' => $notifications,
            'reviews' => $reviews->count(),
            'synced_shops' => $syncedShops,
            'failed_shops' => $failedShops,
        ];
    }

    /**
     * Notify eligible users about a single low-rating review (deduped per user/review).
     */
    public function notifyForReview(
        MarketplaceProductReview $review,
        int $maxRating = self::DEFAULT_MAX_RATING,
    ): int {
        $maxRating = max(1, min(5, $maxRating));

        if ($review->rating === null || (int) $review->rating > $maxRating) {
            return 0;
        }

        $review->loadMissing('shopConnection');
        $recipients = $this->recipientUsers();

        if ($recipients->isEmpty()) {
            return 0;
        }

        $actionUrl = $this->actionUrlForReview($review);
        $count = 0;

        foreach ($recipients as $user) {
            $alreadySent = Notification::query()
                ->where('recipient_user_id', $user->id)
                ->where('type', self::EVENT_TYPE)
                ->where('action_url', $actionUrl)
                ->exists();

            if ($alreadySent) {
                continue;
            }

            Notification::create(NotificationPayload::normalize([
                'recipient_user_id' => $user->id,
                'title' => $this->titleForReview($review),
                'message' => $this->messageForReview($review),
                'type' => self::EVENT_TYPE,
                'severity' => 'warning',
                'category' => 'system',
                'action_url' => $actionUrl,
                'complaint_id' => $review->complaint_id,
                'is_read' => false,
            ]));

            $count++;
        }

        return $count;
    }

    /**
     * @return array{0: int, 1: int}
     */
    private function syncActiveShops(Carbon $startAt, Carbon $endAt): array
    {
        $connections = MarketplaceShopConnection::query()
            ->where('is_active', true)
            ->whereIn('platform', MarketplacePlatform::all())
            ->orderBy('id')
            ->get();

        $synced = 0;
        $failed = 0;
        $reviewSync = app(MarketplaceReviewSyncService::class);

        foreach ($connections as $connection) {
            try {
                $reviewSync->syncConnection(
                    $connection,
                    50,
                    null,
                    null,
                    null,
                    null,
                    true,
                    $startAt,
                    $endAt,
                );
                $synced++;
            } catch (Throwable $exception) {
                $failed++;
                Log::warning('Low-rating review sync failed for shop connection.', [
                    'marketplace_shop_connection_id' => $connection->id,
                    'platform' => $connection->platform,
                    'shop_name' => $connection->shop_name,
                    'message' => $exception->getMessage(),
                ]);
            }
        }

        return [$synced, $failed];
    }

    /**
     * @return Collection<int, User>
     */
    private function recipientUsers(): Collection
    {
        return $this->recipientCache ??= User::query()
            ->with('role')
            ->where('status', User::STATUS_ACTIVE)
            ->where('approval_status', User::APPROVAL_APPROVED)
            ->get()
            ->filter(fn (User $user) => $user->hasPermission('reviews.view'))
            ->values();
    }

    private function actionUrlForReview(MarketplaceProductReview $review): string
    {
        $base = rtrim((string) config('app.frontend_url', config('app.url')), '/');

        return "{$base}/marketplace-reviews?review={$review->id}";
    }

    private function titleForReview(MarketplaceProductReview $review): string
    {
        $platform = MarketplacePlatform::label((string) $review->platform);

        return "Low rating ({$review->rating}/5) · {$platform}";
    }

    private function messageForReview(MarketplaceProductReview $review): string
    {
        $shop = $review->shopConnection?->shop_name ?: 'Unknown shop';
        $product = $review->product_name ?: 'Unknown product';
        $reviewer = $review->reviewer_name ?: 'Anonymous';
        $preview = $review->review_text
            ? Str::limit(trim((string) $review->review_text), 120)
            : 'No review text.';

        return "{$shop} · {$product} · {$reviewer}: {$preview}";
    }
}
