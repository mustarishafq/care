<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MarketplaceOrder extends Model
{
    protected $fillable = [
        'platform',
        'marketplace_shop_connection_id',
        'external_order_id',
        'buyer_nickname',
        'buyer_name',
        'buyer_phone',
        'buyer_address',
        'buyer_address_raw',
        'items',
        'item_count',
        'product_summary',
        'order_status',
        'order_status_label',
        'grand_total',
        'currency',
        'pay_method',
        'order_created_at',
        'paid_at',
        'contact_synced_at',
        'synced_at',
        'raw_metadata',
    ];

    protected function casts(): array
    {
        return [
            'items' => 'array',
            'buyer_address_raw' => 'array',
            'raw_metadata' => 'array',
            'grand_total' => 'decimal:2',
            'order_created_at' => 'datetime',
            'paid_at' => 'datetime',
            'contact_synced_at' => 'datetime',
            'synced_at' => 'datetime',
        ];
    }

    public function shopConnection(): BelongsTo
    {
        return $this->belongsTo(MarketplaceShopConnection::class, 'marketplace_shop_connection_id');
    }
}
