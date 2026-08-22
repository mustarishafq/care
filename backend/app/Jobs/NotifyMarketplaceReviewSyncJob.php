<?php

namespace App\Jobs;

use App\Services\Marketplace\MarketplaceReviewSyncQueueService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class NotifyMarketplaceReviewSyncJob implements ShouldQueue
{
    use Queueable;

    public int $tries = 2;

    public int $timeout = 60;

    public function __construct(
        public readonly ?int $requestedByUserId,
        public readonly int $shopConnectionId,
        public readonly string $shopName,
        public readonly string $startDate,
        public readonly string $endDate,
        public readonly int $jobCount,
        public readonly bool $failed = false,
        public readonly ?string $errorMessage = null,
    ) {}

    public function handle(MarketplaceReviewSyncQueueService $queueService): void
    {
        $queueService->notifyRequester(
            $this->requestedByUserId,
            $this->shopConnectionId,
            $this->shopName,
            $this->startDate,
            $this->endDate,
            $this->jobCount,
            $this->failed,
            $this->errorMessage,
        );
    }
}
