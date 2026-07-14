<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('complaints:auto-close-delivered')->hourly();
Schedule::command('complaints:stale-alerts')->hourly();
Schedule::command('marketplace:refresh-tokens')->everyTenMinutes();
Schedule::command('marketplace:low-rating-alerts')->dailyAt('08:00');
Schedule::command('marketplace:sync-orders')->twiceDaily(0, 12);
Schedule::command('marketplace:reveal-order-phones')->twiceDailyAt(0, 12, 30);

