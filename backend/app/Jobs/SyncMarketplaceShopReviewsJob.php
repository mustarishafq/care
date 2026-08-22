<?php

namespace App\Jobs;

use App\Models\MarketplaceShopConnection;
use App\Services\Marketplace\MarketplaceCookieAlertService;
use App\Services\Marketplace\MarketplaceReviewSyncService;
use App\Services\SchedulerLogService;
use Carbon\Carbon;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Throwable;

class SyncMarketplaceShopReviewsJob implements ShouldQueue
{
    use Queueable;

    public const COMMAND = 'marketplace:reviews-sync';

    public int $tries = 2;

    public int $timeout = 600;

    public function __construct(
        public readonly int $shopConnectionId,
        public readonly string $startDate,
        public readonly string $endDate,
        public readonly int $pageSize = 50,
        public readonly ?int $minRating = null,
        public readonly ?int $maxRating = null,
    ) {}

    /**
     * @return list<object>
     */
    public function middleware(): array
    {
        return [
            (new WithoutOverlapping('marketplace-review-sync-'.$this->shopConnectionId))
                ->expireAfter($this->timeout + 60)
                ->releaseAfter(20),
        ];
    }

    public function handle(
        MarketplaceReviewSyncService $reviewSync,
        MarketplaceCookieAlertService $cookieAlerts,
        SchedulerLogService $schedulerLogs,
    ): void {
        $connection = MarketplaceShopConnection::query()->find($this->shopConnectionId);
        if (! $connection || ! $connection->is_active) {
            return;
        }

        $source = class_basename(static::class);
        $startAt = Carbon::createFromFormat('Y-m-d', $this->startDate)->startOfDay();
        $endAt = Carbon::createFromFormat('Y-m-d', $this->endDate)->endOfDay();

        $schedulerLogs->forShop(
            self::COMMAND,
            'info',
            "Starting review sync ({$this->startDate} → {$this->endDate}).",
            $connection,
            $source,
            [
                'start_date' => $this->startDate,
                'end_date' => $this->endDate,
                'min_rating' => $this->minRating,
                'max_rating' => $this->maxRating,
            ],
            'Review sync started',
        );

        try {
            $result = $reviewSync->syncConnection(
                $connection,
                $this->pageSize,
                null,
                null,
                $this->minRating,
                $this->maxRating,
                true,
                $startAt,
                $endAt,
                notifyLowRatings: false,
            );

            if ($connection->connection_error) {
                $connection->clearConnectionError();
            }

            $schedulerLogs->forShop(
                self::COMMAND,
                'success',
                sprintf(
                    'Synced %d review(s) (%d new, %d updated).',
                    (int) ($result['synced'] ?? 0),
                    (int) ($result['created'] ?? 0),
                    (int) ($result['updated'] ?? 0),
                ),
                $connection,
                $source,
                [
                    'synced' => $result['synced'] ?? 0,
                    'created' => $result['created'] ?? 0,
                    'updated' => $result['updated'] ?? 0,
                    'created_complaints' => $result['created_complaints'] ?? 0,
                    'pages_fetched' => $result['pages_fetched'] ?? 0,
                ],
                'Review sync completed',
            );
        } catch (Throwable $exception) {
            $cookieAlerts->recordFailure(
                $connection,
                $exception,
                'reviews',
                self::COMMAND,
                $source,
            );
            throw $exception;
        }
    }

    public function failed(?Throwable $exception): void
    {
        app(SchedulerLogService::class)->error(
            self::COMMAND,
            'Review sync job failed permanently: '.($exception?->getMessage() ?: 'unknown error'),
            class_basename(static::class),
            [
                'shop_connection_id' => $this->shopConnectionId,
                'start_date' => $this->startDate,
                'end_date' => $this->endDate,
            ],
            $this->shopConnectionId,
            'Review sync job failed',
        );
    }
}
