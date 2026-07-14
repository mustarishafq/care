<?php

namespace App\Services\Marketplace;

use App\Models\MarketplaceShopConnection;
use App\Services\SchedulerLogService;
use App\Support\MarketplacePlatform;
use Illuminate\Support\Str;
use Throwable;

class MarketplaceCookieAlertService
{
    public function __construct(
        private readonly SchedulerLogService $schedulerLogs,
    ) {}

    public function isCookieOrAuthFailure(Throwable $exception): bool
    {
        $message = strtolower($exception->getMessage());

        if ($message === '') {
            return false;
        }

        $needles = [
            'cookie expired',
            'cookie is missing',
            'cookie is invalid',
            'fresh cookie',
            'seller_token',
            'seller center cookie',
            'not configured',
            'paste a fresh cookie',
            'missing seller_token',
            'unauthorized',
            'unauthenticated',
            'login',
            'session',
        ];

        foreach ($needles as $needle) {
            if (str_contains($message, $needle)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Record a shop sync failure onto Scheduler Logs (admin page) instead of inbox notifications.
     *
     * @return int 1 when a scheduler log row was written
     */
    public function recordFailure(
        MarketplaceShopConnection $connection,
        Throwable $exception,
        string $context = 'sync',
        ?string $command = null,
        ?string $source = null,
    ): int {
        $context = Str::slug($context) ?: 'sync';
        $isCookie = $this->isCookieOrAuthFailure($exception);

        if ($isCookie) {
            $connection->markConnectionError($exception->getMessage());
        }

        $command = $command ?: match ($context) {
            'orders' => 'marketplace:sync-orders',
            'phones' => 'marketplace:reveal-order-phones',
            'reviews' => 'marketplace:low-rating-alerts',
            default => 'marketplace:sync',
        };

        $platform = MarketplacePlatform::label((string) $connection->platform);
        $shop = $connection->shop_name ?: ($connection->shop_id ?: 'Unknown shop');
        $kind = $isCookie ? 'Cookie/auth failure' : 'Sync failure';
        $title = "{$kind} · {$platform}";
        $message = "{$shop}: ".Str::limit(trim($exception->getMessage()), 500);

        $this->schedulerLogs->forShop(
            $command,
            'error',
            $message,
            $connection,
            $source,
            [
                'context' => $context,
                'cookie_or_auth_failure' => $isCookie,
                'exception_class' => $exception::class,
            ],
            $title,
        );

        return 1;
    }

    /** @deprecated Use recordFailure() */
    public function notifyFailure(
        MarketplaceShopConnection $connection,
        Throwable $exception,
        string $context = 'sync',
    ): int {
        return $this->recordFailure($connection, $exception, $context);
    }
}
