<?php

namespace App\Console\Commands;

use App\Services\StaleComplaintAlertService;
use Illuminate\Console\Command;

class SendStaleComplaintAlerts extends Command
{
    protected $signature = 'complaints:stale-alerts';

    protected $description = 'Notify assigned agents about stale New Complaint / Under Review tickets';

    public function handle(StaleComplaintAlertService $service): int
    {
        $count = $service->run();

        if ($count > 0) {
            $this->info("Sent {$count} stale ticket notification(s).");
        }

        return self::SUCCESS;
    }
}
