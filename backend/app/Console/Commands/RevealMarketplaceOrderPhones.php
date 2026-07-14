<?php

namespace App\Console\Commands;

use App\Jobs\RevealMarketplaceShopOrderPhonesJob;
use App\Services\Marketplace\MarketplaceCookieAlertService;
use App\Services\Marketplace\MarketplaceOrderSyncService;
use App\Services\SchedulerLogService;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Throwable;

class RevealMarketplaceOrderPhones extends Command
{
    protected $signature = 'marketplace:reveal-order-phones
                            {--days=2 : How many days back to look for orders missing phones}
                            {--limit=30 : Max phones to reveal per job pass (1-30)}
                            {--sync : Run one pass inline per shop instead of queueing}';

    protected $description = 'Queue phone-reveal jobs for marketplace orders (separate from order sync)';

    public function handle(
        MarketplaceOrderSyncService $service,
        SchedulerLogService $schedulerLogs,
        MarketplaceCookieAlertService $cookieAlerts,
    ): int {
        $days = max(1, min(30, (int) $this->option('days')));
        $limit = min(max((int) $this->option('limit'), 1), 30);
        $startAt = Carbon::now()->subDays($days - 1)->startOfDay();
        $endAt = Carbon::now()->endOfDay();
        $runInline = (bool) $this->option('sync');
        $command = 'marketplace:reveal-order-phones';

        $connections = $service->eligibleConnectionsForScheduledSync();

        if ($connections->isEmpty()) {
            $msg = 'No active TikTok cookie shops found for phone reveal.';
            $this->warn($msg);
            $schedulerLogs->warning($command, $msg, 'RevealMarketplaceOrderPhones');

            return self::SUCCESS;
        }

        $window = "{$startAt->toDateString()} → {$endAt->toDateString()}";
        $this->info("Phone reveal window {$window} for {$connections->count()} shop(s).");

        if ($runInline) {
            foreach ($connections as $connection) {
                try {
                    $result = $service->revealMissingPhones($connection, $limit, $startAt, $endAt);
                    $line = sprintf(
                        '%s · attempted %d, revealed %d, remaining %d',
                        $connection->shop_name ?: "#{$connection->id}",
                        $result['attempted'] ?? 0,
                        $result['revealed'] ?? 0,
                        $result['remaining'] ?? 0,
                    );
                    $this->line($line);
                    $schedulerLogs->forShop(
                        $command,
                        ((int) ($result['revealed'] ?? 0)) > 0 ? 'success' : 'info',
                        $line,
                        $connection,
                        'RevealMarketplaceOrderPhones',
                        $result,
                        'Inline phone reveal',
                    );
                } catch (Throwable $exception) {
                    $this->error(($connection->shop_name ?: "#{$connection->id}").': '.$exception->getMessage());
                    $cookieAlerts->recordFailure(
                        $connection,
                        $exception,
                        'phones',
                        $command,
                        'RevealMarketplaceOrderPhones',
                    );
                }
            }

            return self::SUCCESS;
        }

        foreach ($connections as $index => $connection) {
            RevealMarketplaceShopOrderPhonesJob::dispatch(
                $connection->id,
                $startAt->toDateString(),
                $endAt->toDateString(),
                $limit,
            )->delay(now()->addSeconds($index * 10));

            $this->line("Queued phone reveal · {$connection->shop_name} (#{$connection->id})");
        }

        $schedulerLogs->info(
            $command,
            "Queued {$connections->count()} phone reveal job(s) for {$window}.",
            'RevealMarketplaceOrderPhones',
            [
                'shop_count' => $connections->count(),
                'start_date' => $startAt->toDateString(),
                'end_date' => $endAt->toDateString(),
                'limit' => $limit,
            ],
            null,
            'Phone reveal jobs queued',
        );

        return self::SUCCESS;
    }
}
