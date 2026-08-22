<?php

namespace Tests\Unit;

use App\Services\Marketplace\MarketplaceCookieAlertService;
use App\Services\SchedulerLogService;
use PHPUnit\Framework\TestCase;
use RuntimeException;

class MarketplaceCookieAlertClassificationTest extends TestCase
{
    private function service(): MarketplaceCookieAlertService
    {
        return new MarketplaceCookieAlertService(
            $this->createMock(SchedulerLogService::class),
        );
    }

    public function test_detects_expired_and_invalid_cookie_messages(): void
    {
        $service = $this->service();

        $this->assertTrue($service->isCookieOrAuthFailure(
            new RuntimeException('TikTok Seller Center cookie expired or is invalid. Paste a fresh cookie for this shop and try again.'),
        ));
        $this->assertTrue($service->isCookieOrAuthFailure(
            new RuntimeException('Shopee Seller Center cookie expired or is invalid.'),
        ));
        $this->assertTrue($service->isCookieOrAuthFailure(
            new RuntimeException('No Seller Center cookie saved for this TikTok shop.'),
        ));
        $this->assertTrue($service->isCookieOrAuthFailure(
            new RuntimeException('TikTok SELLER_TOKEN expired. Reviews may still work, but orders need a fresh cookie.'),
        ));
    }

    public function test_ignores_unrelated_sync_errors(): void
    {
        $service = $this->service();

        $this->assertFalse($service->isCookieOrAuthFailure(
            new RuntimeException('Rate limited, try again later.'),
        ));
        $this->assertFalse($service->isCookieOrAuthFailure(
            new RuntimeException(''),
        ));
    }
}
