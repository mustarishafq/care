<?php

namespace App\Models;

use App\Support\MarketplacePlatform;
use Illuminate\Database\Eloquent\Builder;

class ShopeeConnection extends MarketplaceShopConnection
{
    protected static function booted(): void
    {
        static::addGlobalScope('platform', function (Builder $query) {
            $query->where('platform', MarketplacePlatform::SHOPEE);
        });

        static::creating(function (self $connection) {
            $connection->platform ??= MarketplacePlatform::SHOPEE;
        });
    }
}
