<?php

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\ComplaintController;
use App\Http\Controllers\Api\V1\ComplaintStatusController;
use App\Http\Controllers\Api\V1\ComplaintTypeController;
use App\Http\Controllers\Api\V1\CourierController;
use App\Http\Controllers\Api\V1\DepartmentController;
use App\Http\Controllers\Api\V1\FileUploadController;
use App\Http\Controllers\Api\V1\InternalNoteController;
use App\Http\Controllers\Api\V1\NotificationController;
use App\Http\Controllers\Api\V1\PriorityController;
use App\Http\Controllers\Api\V1\ProductCategoryController;
use App\Http\Controllers\Api\V1\ProductController;
use App\Http\Controllers\Api\V1\RoleController;
use App\Http\Controllers\Api\V1\SsoController;
use App\Http\Controllers\Api\V1\SystemConfigController;
use App\Http\Controllers\Api\V1\TicketActivityController;
use App\Http\Controllers\Api\V1\UnitOfMeasurementController;
use App\Http\Controllers\Api\V1\UserController;
use App\Http\Controllers\Api\V1\MarketplacePlatformController;
use App\Http\Controllers\Api\V1\MarketplaceReviewController;
use App\Http\Controllers\Api\V1\MarketplaceWebhookController;
use App\Http\Controllers\Api\V1\ShopeeController;
use App\Http\Controllers\Api\V1\TikTokShopController;
use App\Http\Controllers\Api\V1\WebhookController;
use App\Http\Middleware\EnsureUserIsApproved;
use Illuminate\Support\Facades\Route;

// Legacy OAuth callback paths (register either this or the v1 path in Partner Center)
Route::get('integrations/tiktok/callback', [TikTokShopController::class, 'oauthCallback'])->middleware('throttle:30,1');
Route::get('integrations/shopee/callback', [ShopeeController::class, 'oauthCallback'])->middleware('throttle:30,1');

Route::prefix('v1')->group(function () {
    Route::post('auth/register', [AuthController::class, 'register'])->middleware('throttle:5,1');
    Route::post('auth/login', [AuthController::class, 'login'])->middleware('throttle:10,1');
    Route::post('auth/forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:5,1');
    Route::post('auth/reset-password', [AuthController::class, 'resetPassword'])->middleware('throttle:5,1');
    Route::post('sso/nexus/verify', [SsoController::class, 'verify'])->middleware('throttle:10,1');

    Route::get('complaints', [ComplaintController::class, 'index'])->middleware('throttle:30,1');
    Route::get('complaints/create-form-options', [ComplaintController::class, 'createFormOptions'])
        ->middleware(['auth:sanctum', EnsureUserIsApproved::class, 'throttle:60,1']);
    Route::get('complaints/{id}', [ComplaintController::class, 'show'])->middleware('throttle:30,1');

    Route::post('webhook/tracking-update', [WebhookController::class, 'trackingUpdate'])->middleware('throttle:60,1');
    Route::post('webhook/marketplace/tiktok-shop', [MarketplaceWebhookController::class, 'tiktokShop'])->middleware('throttle:60,1');
    Route::post('webhook/marketplace/shopee', [MarketplaceWebhookController::class, 'shopee'])->middleware('throttle:60,1');
    Route::get('tiktok-shop/oauth/callback', [TikTokShopController::class, 'oauthCallback'])->middleware('throttle:30,1');
    Route::get('shopee/oauth/callback', [ShopeeController::class, 'oauthCallback'])->middleware('throttle:30,1');

    Route::get('complaint-statuses', [ComplaintStatusController::class, 'index'])->middleware('throttle:60,1');

    Route::middleware(['auth:sanctum', EnsureUserIsApproved::class])->group(function () {
        Route::get('webhook/settings', [WebhookController::class, 'settings']);
        Route::patch('webhook/settings', [WebhookController::class, 'updateSettings']);
        Route::post('webhook/regenerate-secret', [WebhookController::class, 'regenerateIncomingSecret']);
        Route::post('webhook/regenerate-outgoing-secret', [WebhookController::class, 'regenerateOutgoingSecret']);
        Route::post('webhook/test-outgoing', [WebhookController::class, 'testOutgoing']);
        Route::get('auth/me', [AuthController::class, 'me']);
        Route::patch('auth/me', [AuthController::class, 'updateMe']);
        Route::post('auth/logout', [AuthController::class, 'logout']);

        Route::apiResource('departments', DepartmentController::class);
        Route::apiResource('complaint-types', ComplaintTypeController::class);
        Route::apiResource('complaint-statuses', ComplaintStatusController::class)->except(['index']);
        Route::apiResource('couriers', CourierController::class);
        Route::apiResource('priorities', PriorityController::class);
        Route::apiResource('units-of-measurement', UnitOfMeasurementController::class);
        Route::apiResource('complaints', ComplaintController::class)->except(['index', 'show']);
        Route::post('complaints/{id}/agents', [ComplaintController::class, 'assignAgent']);
        Route::delete('complaints/{id}/agents/{userId}', [ComplaintController::class, 'removeAgent']);
        Route::apiResource('ticket-activities', TicketActivityController::class);
        Route::apiResource('internal-notes', InternalNoteController::class);
        Route::apiResource('notifications', NotificationController::class);
        Route::post('notifications/send-email', [NotificationController::class, 'sendEmail']);
        Route::apiResource('products', ProductController::class);
        Route::apiResource('product-categories', ProductCategoryController::class);
        Route::get('roles/meta', [RoleController::class, 'meta']);
        Route::apiResource('roles', RoleController::class);
        Route::apiResource('system-configs', SystemConfigController::class);

        Route::get('users', [UserController::class, 'index']);
        Route::post('users', [UserController::class, 'store']);
        Route::patch('users/{id}', [UserController::class, 'update']);
        Route::post('users/invite', [UserController::class, 'invite']);
        Route::post('users/{id}/approve', [UserController::class, 'approve']);
        Route::post('users/{id}/reject', [UserController::class, 'reject']);
        Route::post('users/{id}/disable', [UserController::class, 'disable']);

        Route::post('files/upload', [FileUploadController::class, 'upload']);

        Route::get('tiktok-shop/status', [TikTokShopController::class, 'status']);
        Route::get('tiktok-shop', [TikTokShopController::class, 'index']);
        Route::get('tiktok-shop/auth-url', [TikTokShopController::class, 'authUrl']);
        Route::delete('tiktok-shop/{id}', [TikTokShopController::class, 'destroy']);
        Route::post('tiktok-shop/{id}/refresh', [TikTokShopController::class, 'refresh']);
        Route::get('tiktok-shop/{id}/products', [TikTokShopController::class, 'products']);
        Route::get('tiktok-shop/{id}/reviews', [TikTokShopController::class, 'reviews']);
        Route::post('tiktok-shop/{id}/reviews/sync', [TikTokShopController::class, 'syncReviews']);
        Route::post('tiktok-shop/{id}/reviews/{reviewId}/reply', [TikTokShopController::class, 'replyToReview']);

        Route::get('shopee/status', [ShopeeController::class, 'status']);
        Route::get('shopee', [ShopeeController::class, 'index']);
        Route::get('shopee/auth-url', [ShopeeController::class, 'authUrl']);
        Route::delete('shopee/{id}', [ShopeeController::class, 'destroy']);
        Route::post('shopee/{id}/refresh', [ShopeeController::class, 'refresh']);
        Route::get('shopee/{id}/products', [ShopeeController::class, 'products']);

        Route::get('marketplace/platforms/{platform}', [MarketplacePlatformController::class, 'show']);
        Route::patch('marketplace/platforms/{platform}', [MarketplacePlatformController::class, 'update']);
        Route::get('marketplace/shops', [MarketplaceReviewController::class, 'shops']);
        Route::get('marketplace/reviews', [MarketplaceReviewController::class, 'index']);
        Route::post('marketplace/reviews/sync', [MarketplaceReviewController::class, 'sync']);
        Route::post('marketplace/reviews/{id}/reply', [MarketplaceReviewController::class, 'reply']);
    });
});
