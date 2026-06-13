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
use App\Http\Controllers\Api\V1\WebhookController;
use App\Http\Middleware\EnsureUserIsApproved;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    Route::post('auth/register', [AuthController::class, 'register'])->middleware('throttle:5,1');
    Route::post('auth/login', [AuthController::class, 'login'])->middleware('throttle:10,1');
    Route::post('auth/forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:5,1');
    Route::post('auth/reset-password', [AuthController::class, 'resetPassword'])->middleware('throttle:5,1');
    Route::post('sso/nexus/verify', [SsoController::class, 'verify'])->middleware('throttle:10,1');

    Route::get('complaints', [ComplaintController::class, 'index'])->middleware('throttle:30,1');
    Route::get('complaints/{id}', [ComplaintController::class, 'show'])->middleware('throttle:30,1');

    Route::post('webhook/tracking-update', [WebhookController::class, 'trackingUpdate'])->middleware('throttle:60,1');

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
        Route::apiResource('complaint-statuses', ComplaintStatusController::class);
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
    });
});
