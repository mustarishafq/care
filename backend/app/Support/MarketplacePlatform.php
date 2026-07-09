<?php

namespace App\Support;

class MarketplacePlatform
{
    public const TIKTOK_SHOP = 'tiktok_shop';

    public const SHOPEE = 'shopee';

    /**
     * @return list<string>
     */
    public static function all(): array
    {
        return [
            self::TIKTOK_SHOP,
            self::SHOPEE,
        ];
    }

    public static function label(string $platform): string
    {
        return match ($platform) {
            self::TIKTOK_SHOP => 'TikTok Shop',
            self::SHOPEE => 'Shopee',
            default => ucfirst(str_replace('_', ' ', $platform)),
        };
    }

    public static function orderSource(string $platform): string
    {
        return match ($platform) {
            self::TIKTOK_SHOP => 'TikTok',
            self::SHOPEE => 'Shopee',
            default => self::label($platform),
        };
    }

    public static function isValid(string $platform): bool
    {
        return in_array($platform, self::all(), true);
    }

    public static function oauthCallbackUrl(string $platform): ?string
    {
        return match ($platform) {
            self::TIKTOK_SHOP => url('/api/v1/tiktok-shop/oauth/callback'),
            self::SHOPEE => url('/api/v1/shopee/oauth/callback'),
            default => null,
        };
    }

    public static function webhookUrl(string $platform): ?string
    {
        return match ($platform) {
            self::TIKTOK_SHOP => url('/api/v1/webhook/marketplace/tiktok-shop'),
            self::SHOPEE => url('/api/v1/webhook/marketplace/shopee'),
            default => null,
        };
    }
}
