<?php

namespace App\Models;

use App\Support\MarketplacePlatform;
use Illuminate\Database\Eloquent\Builder;

class TikTokShopConnection extends MarketplaceShopConnection
{
    protected static function booted(): void
    {
        static::addGlobalScope('platform', function (Builder $query) {
            $query->where('platform', MarketplacePlatform::TIKTOK_SHOP);
        });

        static::creating(function (self $connection) {
            $connection->platform ??= MarketplacePlatform::TIKTOK_SHOP;
        });
    }
}
