<?php

namespace App\Console\Commands;

use App\Services\AutoCloseDeliveredComplaintsService;
use Illuminate\Console\Command;

class AutoCloseDeliveredComplaints extends Command
{
    protected $signature = 'complaints:auto-close-delivered {--force : Run immediately regardless of schedule settings}';

    protected $description = 'Close complaints in the configured trigger status after the waiting period';

    public function handle(AutoCloseDeliveredComplaintsService $service): int
    {
        $count = $service->run($this->option('force'));

        if ($count > 0) {
            $this->info("Auto-closed {$count} complaint(s).");
        }

        return self::SUCCESS;
    }
}
