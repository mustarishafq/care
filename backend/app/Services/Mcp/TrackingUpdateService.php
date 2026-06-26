<?php

namespace App\Services\Mcp;

use App\Http\Resources\ComplaintResource;
use App\Services\ComplaintTrackingUpdateService;

class TrackingUpdateService
{
    public function __construct(
        private ComplaintTrackingUpdateService $trackingUpdate,
    ) {}

    /**
     * @param  array{ticket_id?: string, order_number?: string, tracking_number?: string, replacement_tracking_number?: string, status?: string}  $data
     */
    public function update(array $data): ComplaintResource
    {
        return $this->trackingUpdate->update($data);
    }
}
