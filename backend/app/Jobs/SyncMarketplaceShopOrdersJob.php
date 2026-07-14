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

class SyncMarketplaceShopOrdersJob implements ShouldQueue
{
    use Queueable;

    public const COMMAND = 'marketplace:sync-orders';

    public int $tries = 2;

    public int $timeout = 600;

    public function __construct(
        public readonly int $shopConnectionId,
        public readonly string $startDate,
        public readonly string $endDate,
        public readonly int $pageSize = 50,
        public readonly bool $fetchContacts = true,
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
        $startAt = Carbon::createFromFormat('Y-m-d', $this->startDate)->startOfDay();
        $endAt = Carbon::createFromFormat('Y-m-d', $this->endDate)->endOfDay();

        $schedulerLogs->forShop(
            self::COMMAND,
            'info',
            "Starting order sync ({$this->startDate} → {$this->endDate}).",
            $connection,
            $source,
            ['start_date' => $this->startDate, 'end_date' => $this->endDate],
            'Order sync started',
        );

        try {
            $result = $orderSync->syncConnection(
                $connection,
                $this->pageSize,
                true,
                $startAt,
                $endAt,
                $this->fetchContacts,
                false,
            );

            if ($connection->connection_error) {
                $connection->clearConnectionError();
            }

            $schedulerLogs->forShop(
                self::COMMAND,
                'success',
                sprintf(
                    'Synced %d order(s) (%d new, %d updated); contacts %d.',
                    (int) ($result['synced'] ?? 0),
                    (int) ($result['created'] ?? 0),
                    (int) ($result['updated'] ?? 0),
                    (int) ($result['contacts_synced'] ?? 0),
                ),
                $connection,
                $source,
                [
                    'synced' => $result['synced'] ?? 0,
                    'created' => $result['created'] ?? 0,
                    'updated' => $result['updated'] ?? 0,
                    'contacts_synced' => $result['contacts_synced'] ?? 0,
                    'pages_fetched' => $result['pages_fetched'] ?? 0,
                ],
                'Order sync completed',
            );
        } catch (Throwable $exception) {
            $cookieAlerts->recordFailure(
                $connection,
                $exception,
                'orders',
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
            'Order sync job failed permanently: '.($exception?->getMessage() ?: 'unknown error'),
            class_basename(static::class),
            [
                'shop_connection_id' => $this->shopConnectionId,
                'start_date' => $this->startDate,
                'end_date' => $this->endDate,
            ],
            $this->shopConnectionId,
            'Order sync job failed',
        );
    }
}
