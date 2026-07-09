<?php

namespace App\Console\Commands;

use App\Services\Marketplace\MarketplaceTokenRefreshService;
use Illuminate\Console\Command;

class RefreshMarketplaceTokens extends Command
{
    protected $signature = 'marketplace:refresh-tokens';

    protected $description = 'Refresh expiring marketplace shop access tokens';

    public function handle(MarketplaceTokenRefreshService $service): int
    {
        $result = $service->refreshExpiringConnections();

        if ($result['refreshed'] > 0) {
            $this->info("Refreshed {$result['refreshed']} connection(s).");
        }

        if ($result['failed'] > 0) {
            $this->warn("Failed to refresh {$result['failed']} connection(s).");
        }

        return self::SUCCESS;
    }
}
