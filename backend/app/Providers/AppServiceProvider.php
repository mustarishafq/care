<?php

namespace App\Providers;

use App\Models\Notification;
use App\Services\OutgoingWebhookService;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Notification::created(function (Notification $notification) {
            app(OutgoingWebhookService::class)->dispatchNotification($notification);
        });
    }
}
