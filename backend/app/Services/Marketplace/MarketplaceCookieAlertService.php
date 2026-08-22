<?php

namespace App\Services\Marketplace;

use App\Models\MarketplaceShopConnection;
use App\Models\Notification;
use App\Models\User;
use App\Services\SchedulerLogService;
use App\Support\MarketplacePlatform;
use App\Support\NotificationPayload;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use Throwable;

class MarketplaceCookieAlertService
{
    public const EVENT_TYPE = 'cookie_expired';

    public const REMIND_AFTER_HOURS = 12;

    /** @var Collection<int, User>|null */
    private ?Collection $recipientCache = null;

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
            'expired or is invalid',
            'fresh cookie',
            'seller_token',
            'seller center cookie',
            'not configured',
            'paste a fresh cookie',
            'missing seller_token',
            'no seller center cookie',
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
     * Record a shop sync failure onto Scheduler Logs and, for cookie/auth failures,
     * send an inbox notification so the expired cookie is not missed.
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
            $this->notifyRecipients($connection, $exception);
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

    /**
     * Mark cookie-expired inbox alerts as read after a fresh cookie is saved or sync succeeds.
     */
    public function resolveForShop(MarketplaceShopConnection $connection): void
    {
        $actionUrl = $this->actionUrlForShop($connection);

        Notification::query()
            ->where('type', self::EVENT_TYPE)
            ->where('is_read', false)
            ->where('action_url', $actionUrl)
            ->update(['is_read' => true]);
    }

    /**
     * @return int number of notifications created
     */
    private function notifyRecipients(MarketplaceShopConnection $connection, Throwable $exception): int
    {
        $recipients = $this->recipientUsers($connection);

        if ($recipients->isEmpty()) {
            return 0;
        }

        $actionUrl = $this->actionUrlForShop($connection);
        $title = $this->titleForShop($connection);
        $message = $this->messageForShop($connection, $exception);
        $count = 0;

        foreach ($recipients as $user) {
            if ($this->shouldSkipNotify($user->id, $actionUrl)) {
                continue;
            }

            Notification::create(NotificationPayload::normalize([
                'recipient_user_id' => $user->id,
                'title' => $title,
                'message' => $message,
                'type' => self::EVENT_TYPE,
                'severity' => 'critical',
                'category' => 'system',
                'action_url' => $actionUrl,
                'is_read' => false,
            ]));

            $count++;
        }

        return $count;
    }

    private function shouldSkipNotify(int $userId, string $actionUrl): bool
    {
        $latest = Notification::query()
            ->where('recipient_user_id', $userId)
            ->where('type', self::EVENT_TYPE)
            ->where('action_url', $actionUrl)
            ->orderByDesc('id')
            ->first();

        if (! $latest) {
            return false;
        }

        if (! $latest->is_read) {
            return true;
        }

        return $latest->created_at?->gt(now()->subHours(self::REMIND_AFTER_HOURS)) ?? false;
    }

    /**
     * @return Collection<int, User>
     */
    private function recipientUsers(MarketplaceShopConnection $connection): Collection
    {
        $recipients = $this->recipientCache ??= User::query()
            ->with('role')
            ->where('status', User::STATUS_ACTIVE)
            ->where('approval_status', User::APPROVAL_APPROVED)
            ->get()
            ->filter(fn (User $user) => $user->hasPermission('marketplace.manage'))
            ->values();

        $connectedById = $connection->connected_by_user_id;
        if (! $connectedById || $recipients->contains(fn (User $user) => $user->id === (int) $connectedById)) {
            return $recipients;
        }

        $owner = User::query()
            ->with('role')
            ->where('id', $connectedById)
            ->where('status', User::STATUS_ACTIVE)
            ->where('approval_status', User::APPROVAL_APPROVED)
            ->first();

        if (! $owner) {
            return $recipients;
        }

        return $recipients->concat([$owner])->values();
    }

    private function actionUrlForShop(MarketplaceShopConnection $connection): string
    {
        $base = rtrim((string) config('app.frontend_url', config('app.url')), '/');
        $path = MarketplacePlatform::frontendShopPath((string) $connection->platform);

        return "{$base}{$path}?shop={$connection->id}";
    }

    private function titleForShop(MarketplaceShopConnection $connection): string
    {
        $platform = MarketplacePlatform::label((string) $connection->platform);

        return "Shop cookie expired · {$platform}";
    }

    private function messageForShop(MarketplaceShopConnection $connection, Throwable $exception): string
    {
        $shop = $connection->shop_name ?: ($connection->shop_id ?: 'Unknown shop');
        $detail = Str::limit(trim($exception->getMessage()), 180);

        return "{$shop}: paste a fresh Seller Center cookie to keep reviews and orders syncing. {$detail}";
    }
}
