<?php

namespace App\Jobs;

use App\Models\MarketplaceShopConnection;
use App\Services\Marketplace\MarketplaceCookieAlertService;
use App\Services\Marketplace\MarketplaceOrderSyncService;
use App\Services\SchedulerLogService;
use Carbon\Carbon;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

class RevealMarketplaceShopOrderPhonesJob implements ShouldQueue
{
    use Queueable;

    public const COMMAND = 'marketplace:reveal-order-phones';

    public int $tries = 2;

    public int $timeout = 300;

    public function __construct(
        public readonly int $shopConnectionId,
        public readonly ?string $startDate = null,
        public readonly ?string $endDate = null,
        public readonly int $limit = 30,
        public readonly int $pass = 1,
        public readonly int $maxPasses = 40,
    ) {
    }

    public function handle(
        MarketplaceOrderSyncService $orderSync,
        MarketplaceCookieAlertService $cookieAlerts,
        SchedulerLogService $schedulerLogs,
    ): void {
        $connection = MarketplaceShopConnection::query()->find($this->shopConnectionId);
        if (! $connection || ! $connection->is_active) {
            return;
        }

        if (! $orderSync->supportsScheduledSync($connection)) {
            return;
        }

        $source = class_basename(static::class);
        $startAt = $this->startDate
            ? Carbon::createFromFormat('Y-m-d', $this->startDate)->startOfDay()
            : null;
        $endAt = $this->endDate
            ? Carbon::createFromFormat('Y-m-d', $this->endDate)->endOfDay()
            : null;
        $limit = min(max($this->limit, 1), 30);

        try {
            $result = $orderSync->revealMissingPhones(
                $connection,
                $limit,
                $startAt,
                $endAt,
            );

            if ($connection->connection_error) {
                $connection->clearConnectionError();
            }

            $remaining = (int) ($result['remaining'] ?? 0);
            $revealed = (int) ($result['revealed'] ?? 0);
            $attempted = (int) ($result['attempted'] ?? 0);

            $schedulerLogs->forShop(
                self::COMMAND,
                $revealed > 0 ? 'success' : 'info',
                sprintf(
                    'Pass %d: attempted %d, revealed %d, remaining %d (blocked %d, failed %d).',
                    $this->pass,
                    $attempted,
                    $revealed,
                    $remaining,
                    (int) ($result['blocked'] ?? 0),
                    (int) ($result['failed'] ?? 0),
                ),
                $connection,
                $source,
                [
                    'pass' => $this->pass,
                    'attempted' => $attempted,
                    'revealed' => $revealed,
                    'remaining' => $remaining,
                    'blocked' => $result['blocked'] ?? 0,
                    'failed' => $result['failed'] ?? 0,
                ],
                'Phone reveal pass',
            );

            if ($remaining > 0 && $revealed > 0 && $this->pass < $this->maxPasses) {
                self::dispatch(
                    $this->shopConnectionId,
                    $this->startDate,
                    $this->endDate,
                    $limit,
                    $this->pass + 1,
                    $this->maxPasses,
                )->delay(now()->addSeconds(20));
            }
        } catch (Throwable $exception) {
            $cookieAlerts->recordFailure(
                $connection,
                $exception,
                'phones',
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
            'Phone reveal job failed permanently: '.($exception?->getMessage() ?: 'unknown error'),
            class_basename(static::class),
            [
                'shop_connection_id' => $this->shopConnectionId,
                'pass' => $this->pass,
            ],
            $this->shopConnectionId,
            'Phone reveal job failed',
        );
    }
}
