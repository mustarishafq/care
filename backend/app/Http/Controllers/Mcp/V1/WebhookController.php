<?php

namespace App\Http\Controllers\Mcp\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Mcp\V1\TrackingUpdateRequest;
use App\Services\Mcp\TrackingUpdateService;
use App\Support\McpResponse;
use Illuminate\Http\JsonResponse;

class WebhookController extends Controller
{
    public function __construct(
        private TrackingUpdateService $trackingUpdate,
    ) {}

    public function trackingUpdate(TrackingUpdateRequest $request): JsonResponse
    {
        $resource = $this->trackingUpdate->update($request->validated());

        return McpResponse::success(
            $resource->resolve(),
            null,
            'Tracking updated successfully.'
        );
    }
}
