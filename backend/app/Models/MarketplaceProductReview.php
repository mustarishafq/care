<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MarketplaceProductReview extends Model
{
    protected $fillable = [
        'platform',
        'marketplace_shop_connection_id',
        'external_review_id',
        'external_product_id',
        'product_name',
        'product_image_url',
        'rating',
        'review_text',
        'review_images',
        'reviewer_name',
        'review_created_at',
        'seller_reply',
        'seller_replied_at',
        'complaint_id',
        'raw_metadata',
        'synced_at',
    ];

    protected function casts(): array
    {
        return [
            'review_created_at' => 'datetime',
            'seller_replied_at' => 'datetime',
            'synced_at' => 'datetime',
            'raw_metadata' => 'array',
            'review_images' => 'array',
        ];
    }

    public function shopConnection(): BelongsTo
    {
        return $this->belongsTo(MarketplaceShopConnection::class, 'marketplace_shop_connection_id');
    }

    public function complaint(): BelongsTo
    {
        return $this->belongsTo(Complaint::class);
    }
}
