<?php

namespace App\Console\Commands;

use App\Services\Marketplace\LowRatingReviewAlertService;
use Illuminate\Console\Command;

class SendLowRatingReviewAlerts extends Command
{
    protected $signature = 'marketplace:low-rating-alerts
                            {--max-rating=3 : Notify for ratings at or below this value (1-5)}
                            {--skip-sync : Skip syncing shops and only scan stored reviews}';

    protected $description = 'Sync today and yesterday marketplace reviews, then notify on ratings of 3 or below';

    public function handle(LowRatingReviewAlertService $service): int
    {
        $maxRating = max(1, min(5, (int) $this->option('max-rating')));
        $sync = ! $this->option('skip-sync');

        $result = $service->run($maxRating, $sync);

        if ($sync) {
            $this->info("Synced {$result['synced_shops']} shop(s); {$result['failed_shops']} failed.");
        }

        $this->info("Found {$result['reviews']} low-rating review(s) (≤ {$maxRating}).");

        if ($result['notifications'] > 0) {
            $this->info("Sent {$result['notifications']} notification(s).");
        }

        return self::SUCCESS;
    }
}
