<?php

namespace App\Services\Marketplace;

use App\Models\MarketplaceProductReview;
use App\Models\MarketplaceShopConnection;
use App\Models\Notification;
use App\Models\User;
use App\Support\MarketplacePlatform;
use App\Support\NotificationPayload;
use App\Services\SchedulerLogService;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use Throwable;

class LowRatingReviewAlertService
{
    public const EVENT_TYPE = 'low_rating_review';

    public const DEFAULT_MAX_RATING = 3;

    public const COMMAND = 'marketplace:low-rating-alerts';

    /** @var Collection<int, User>|null */
    private ?Collection $recipientCache = null;

    public function __construct(
        private readonly MarketplaceCookieAlertService $cookieAlerts,
        private readonly SchedulerLogService $schedulerLogs,
    ) {}

    /**
     * Sync yesterday–today reviews, then notify users with reviews access for ratings ≤ max.
     *
     * @return array{notifications: int, reviews: int, synced_shops: int, failed_shops: int, failure_logs: int}
     */
    public function run(int $maxRating = self::DEFAULT_MAX_RATING, bool $sync = true): array
    {
        $maxRating = max(1, min(5, $maxRating));
        $startAt = now()->subDay()->startOfDay();
        $endAt = now()->endOfDay();

        $syncedShops = 0;
        $failedShops = 0;
        $failureLogs = 0;

        $this->schedulerLogs->info(
            self::COMMAND,
            sprintf(
                'Starting low-rating alerts (max ≤ %d)%s.',
                $maxRating,
                $sync ? ' with shop sync' : ' without shop sync',
            ),
            'LowRatingReviewAlertService',
            [
                'max_rating' => $maxRating,
                'sync' => $sync,
                'start_date' => $startAt->toDateString(),
                'end_date' => $endAt->toDateString(),
            ],
            null,
            'Low-rating alerts started',
        );

        if ($sync) {
            [$syncedShops, $failedShops, $failureLogs] = $this->syncActiveShops($startAt, $endAt);
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

        $this->schedulerLogs->write(
            self::COMMAND,
            $failedShops > 0 ? 'warning' : 'success',
            sprintf(
                'Finished: synced %d shop(s), %d failed, %d low-rating review(s), %d notification(s).',
                $syncedShops,
                $failedShops,
                $reviews->count(),
                $notifications,
            ),
            'LowRatingReviewAlertService',
            'Low-rating alerts finished',
            [
                'synced_shops' => $syncedShops,
                'failed_shops' => $failedShops,
                'failure_logs' => $failureLogs,
                'reviews' => $reviews->count(),
                'notifications' => $notifications,
            ],
        );

        return [
            'notifications' => $notifications,
            'reviews' => $reviews->count(),
            'synced_shops' => $syncedShops,
            'failed_shops' => $failedShops,
            'failure_logs' => $failureLogs,
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
     * @return array{0: int, 1: int, 2: int} synced, failed, failure logs
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
        $failureLogs = 0;
        $reviewSync = app(MarketplaceReviewSyncService::class);

        foreach ($connections as $connection) {
            try {
                $result = $reviewSync->syncConnection(
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
                if ($connection->connection_error) {
                    $connection->clearConnectionError();
                }
                $synced++;
                $this->schedulerLogs->forShop(
                    self::COMMAND,
                    'success',
                    sprintf(
                        'Review sync ok (%d synced, %d new, %d updated).',
                        (int) ($result['synced'] ?? 0),
                        (int) ($result['created'] ?? 0),
                        (int) ($result['updated'] ?? 0),
                    ),
                    $connection,
                    'LowRatingReviewAlertService',
                    [
                        'synced' => $result['synced'] ?? 0,
                        'created' => $result['created'] ?? 0,
                        'updated' => $result['updated'] ?? 0,
                    ],
                    'Review shop sync',
                );
            } catch (Throwable $exception) {
                $failed++;
                $failureLogs += $this->cookieAlerts->recordFailure(
                    $connection,
                    $exception,
                    'reviews',
                    self::COMMAND,
                    'LowRatingReviewAlertService',
                );
            }
        }

        return [$synced, $failed, $failureLogs];
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
