<?php

namespace App\Console\Commands;

use App\Jobs\SyncMarketplaceShopOrdersJob;
use App\Services\Marketplace\MarketplaceOrderSyncService;
use App\Services\SchedulerLogService;
use Carbon\Carbon;
use Illuminate\Console\Command;

class SyncMarketplaceOrders extends Command
{
    protected $signature = 'marketplace:sync-orders
                            {--days=2 : How many days back to sync (from start of that day through now)}
                            {--no-contacts : Skip buyer name/address unmask during sync}
                            {--sync : Run inline instead of queueing jobs (debug only)}';

    protected $description = 'Queue marketplace order sync jobs per cookie shop (contacts on during sync; full backfill via reveal-order-phones)';

    public function handle(MarketplaceOrderSyncService $service, SchedulerLogService $schedulerLogs): int
    {
        $days = max(1, min(30, (int) $this->option('days')));
        $startAt = Carbon::now()->subDays($days - 1)->startOfDay();
        $endAt = Carbon::now()->endOfDay();
        $fetchContacts = ! $this->option('no-contacts');
        $runInline = (bool) $this->option('sync');
        $command = 'marketplace:sync-orders';

        $connections = $service->eligibleConnectionsForScheduledSync();

        if ($connections->isEmpty()) {
            $msg = 'No active TikTok cookie shops found to sync.';
            $this->warn($msg);
            $schedulerLogs->warning($command, $msg, 'SyncMarketplaceOrders');

            return self::SUCCESS;
        }

        $window = "{$startAt->toDateString()} → {$endAt->toDateString()}";
        $this->info("Orders window {$window} for {$connections->count()} shop(s).");

        if ($runInline) {
            $result = $service->syncActiveShops($startAt, $endAt, 50, $fetchContacts, false);
            $summary = "Inline sync: {$result['synced_shops']} shops ok, {$result['failed_shops']} failed; {$result['orders_synced']} orders.";
            $this->info($summary);
            $schedulerLogs->write(
                $command,
                $result['failed_shops'] > 0 ? 'warning' : 'success',
                $summary,
                'SyncMarketplaceOrders',
                'Inline order sync finished',
                $result,
            );

            return self::SUCCESS;
        }

        foreach ($connections as $index => $connection) {
            SyncMarketplaceShopOrdersJob::dispatch(
                $connection->id,
                $startAt->toDateString(),
                $endAt->toDateString(),
                50,
                $fetchContacts,
            )->delay(now()->addSeconds($index * 5));

            $this->line("Queued order sync · {$connection->shop_name} (#{$connection->id})");
        }

        $schedulerLogs->info(
            $command,
            "Queued {$connections->count()} order sync job(s) for {$window}.",
            'SyncMarketplaceOrders',
            [
                'shop_count' => $connections->count(),
                'start_date' => $startAt->toDateString(),
                'end_date' => $endAt->toDateString(),
                'fetch_contacts' => $fetchContacts,
            ],
            null,
            'Order sync jobs queued',
        );

        $this->info('Contact reveal is separate — marketplace:reveal-order-phones (name/address/phone, also scheduled).');

        return self::SUCCESS;
    }
}
