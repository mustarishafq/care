<?php

namespace App\Services\Marketplace;

use App\Jobs\NotifyMarketplaceReviewSyncJob;
use App\Jobs\SyncMarketplaceShopReviewsJob;
use App\Models\MarketplaceShopConnection;
use App\Models\Notification;
use App\Models\User;
use App\Support\NotificationPayload;
use App\Services\SchedulerLogService;
use Carbon\Carbon;
use Illuminate\Support\Facades\Bus;
use RuntimeException;
use Throwable;

class MarketplaceReviewSyncQueueService
{
    public const EVENT_TYPE = 'review_sync';

    public const COMMAND = 'marketplace:reviews-sync';

    public const CHUNK_DAYS = 7;

    public const MAX_RANGE_DAYS = 1096;

    public function __construct(
        private readonly SchedulerLogService $schedulerLogs,
    ) {}

    /**
     * Queue a date range as weekly jobs so a year-long sync does not block the browser.
     *
     * @return array{queued: true, jobs: int, start_date: string, end_date: string, shop_connection_id: int}
     */
    public function queueConnection(
        MarketplaceShopConnection $connection,
        ?Carbon $startAt,
        ?Carbon $endAt,
        int $pageSize = 50,
        ?int $minRating = null,
        ?int $maxRating = null,
        ?int $requestedByUserId = null,
    ): array {
        $startAt = ($startAt ?? now()->subDays(7))->copy()->startOfDay();
        $endAt = ($endAt ?? now())->copy()->endOfDay();

        if ($startAt->gt($endAt)) {
            throw new RuntimeException('Start date must be before end date.');
        }

        if ($startAt->diffInDays($endAt) > self::MAX_RANGE_DAYS) {
            throw new RuntimeException('Date range cannot exceed 3 years. Split into smaller ranges.');
        }

        $windows = $this->chunkWindows($startAt, $endAt);
        $jobs = [];

        foreach ($windows as [$windowStart, $windowEnd]) {
            $jobs[] = new SyncMarketplaceShopReviewsJob(
                $connection->id,
                $windowStart,
                $windowEnd,
                $pageSize,
                $minRating,
                $maxRating,
            );
        }

        $shopConnectionId = $connection->id;
        $shopName = $connection->shop_name ?: ($connection->shop_id ?: 'Unknown shop');
        $startDate = $startAt->toDateString();
        $endDate = $endAt->toDateString();
        $jobCount = count($jobs);

        $jobs[] = new NotifyMarketplaceReviewSyncJob(
            $requestedByUserId,
            $shopConnectionId,
            $shopName,
            $startDate,
            $endDate,
            $jobCount,
            false,
            null,
        );

        $chain = Bus::chain($jobs)->catch(function (Throwable $exception) use (
            $requestedByUserId,
            $shopConnectionId,
            $shopName,
            $startDate,
            $endDate,
            $jobCount,
        ) {
            app(self::class)->notifyRequester(
                $requestedByUserId,
                $shopConnectionId,
                $shopName,
                $startDate,
                $endDate,
                $jobCount,
                true,
                $exception->getMessage(),
            );
        });

        if (config('queue.default') === 'sync') {
            $chain = $chain->onConnection('database');
        }

        $chain->dispatch();

        $this->schedulerLogs->forShop(
            self::COMMAND,
            'info',
            sprintf(
                'Queued %d review sync job(s) for %s → %s.',
                $jobCount,
                $startDate,
                $endDate,
            ),
            $connection,
            class_basename(static::class),
            [
                'jobs' => $jobCount,
                'start_date' => $startDate,
                'end_date' => $endDate,
                'min_rating' => $minRating,
                'max_rating' => $maxRating,
                'requested_by_user_id' => $requestedByUserId,
            ],
            'Review sync queued',
        );

        return [
            'queued' => true,
            'jobs' => $jobCount,
            'start_date' => $startDate,
            'end_date' => $endDate,
            'shop_connection_id' => $connection->id,
        ];
    }

    public function notifyRequester(
        ?int $userId,
        int $shopConnectionId,
        string $shopName,
        string $startDate,
        string $endDate,
        int $jobCount,
        bool $failed = false,
        ?string $errorMessage = null,
    ): void {
        $level = $failed ? 'error' : 'success';
        $title = $failed ? 'Review sync stopped' : 'Review sync finished';
        $range = "{$startDate} → {$endDate}";
        $message = $failed
            ? "{$shopName}: sync stopped for {$range}. ".trim((string) $errorMessage)
            : "{$shopName}: finished importing reviews for {$range} ({$jobCount} batch".($jobCount === 1 ? '' : 'es').'). Refresh the Reviews page.';

        $this->schedulerLogs->write(
            self::COMMAND,
            $level,
            $message,
            class_basename(static::class),
            $title,
            [
                'shop_connection_id' => $shopConnectionId,
                'start_date' => $startDate,
                'end_date' => $endDate,
                'jobs' => $jobCount,
                'failed' => $failed,
            ],
            $shopConnectionId,
        );

        if (! $userId) {
            return;
        }

        $user = User::query()->find($userId);
        if (! $user) {
            return;
        }

        $base = rtrim((string) config('app.frontend_url', config('app.url')), '/');

        Notification::create(NotificationPayload::normalize([
            'recipient_user_id' => $user->id,
            'title' => $title,
            'message' => $message,
            'type' => self::EVENT_TYPE,
            'severity' => $failed ? 'error' : 'success',
            'category' => 'system',
            'action_url' => "{$base}/marketplace-reviews",
            'is_read' => false,
        ]));
    }

    /**
     * @return list<array{0: string, 1: string}>
     */
    private function chunkWindows(Carbon $startAt, Carbon $endAt): array
    {
        $windows = [];
        $cursor = $startAt->copy()->startOfDay();
        $last = $endAt->copy()->endOfDay();

        while ($cursor->lte($last)) {
            $chunkEnd = $cursor->copy()->addDays(self::CHUNK_DAYS - 1)->endOfDay();
            if ($chunkEnd->gt($last)) {
                $chunkEnd = $last->copy();
            }
            $windows[] = [$cursor->toDateString(), $chunkEnd->toDateString()];
            $cursor = $chunkEnd->copy()->addDay()->startOfDay();
        }

        return $windows !== []
            ? $windows
            : [[$startAt->toDateString(), $endAt->toDateString()]];
    }
}
