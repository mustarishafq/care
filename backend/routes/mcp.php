<?php

use App\Http\Controllers\Mcp\V1\CatalogController;
use App\Http\Controllers\Mcp\V1\ComplaintController;
use App\Http\Controllers\Mcp\V1\ComplaintStatusController;
use App\Http\Controllers\Mcp\V1\WebhookController;
use App\Http\Middleware\AuthenticateMcpClient;
use App\Http\Middleware\LogMcpRequest;
use Illuminate\Support\Facades\Route;

Route::middleware([
    LogMcpRequest::class,
    AuthenticateMcpClient::class,
    'throttle:'.config('mcp.rate_limit', 60).',1',
])->group(function () {
    Route::get('catalog', CatalogController::class);

    Route::get('complaints', [ComplaintController::class, 'index']);
    Route::get('complaints/{id}', [ComplaintController::class, 'show']);

    Route::get('complaint-statuses', [ComplaintStatusController::class, 'index']);

    Route::post('webhooks/tracking-update', [WebhookController::class, 'trackingUpdate']);
});
