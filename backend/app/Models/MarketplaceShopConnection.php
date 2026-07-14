<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MarketplaceShopConnection extends Model
{
    protected $table = 'marketplace_shop_connections';

    protected $fillable = [
        'platform',
        'connected_by_user_id',
        'shop_id',
        'shop_cipher',
        'shop_name',
        'region',
        'access_token',
        'refresh_token',
        'access_token_expires_at',
        'refresh_token_expires_at',
        'is_active',
        'connection_error',
        'token_refresh_failed_at',
        'last_synced_at',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'access_token' => 'encrypted',
            'refresh_token' => 'encrypted',
            'access_token_expires_at' => 'datetime',
            'refresh_token_expires_at' => 'datetime',
            'is_active' => 'boolean',
            'token_refresh_failed_at' => 'datetime',
            'last_synced_at' => 'datetime',
            'metadata' => 'array',
        ];
    }

    public function connectedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'connected_by_user_id');
    }

    public function reviews(): HasMany
    {
        return $this->hasMany(MarketplaceProductReview::class);
    }

    public function tokenNeedsRefresh(): bool
    {
        if (! $this->access_token_expires_at) {
            return false;
        }

        return $this->access_token_expires_at->lte(now()->addMinutes(10));
    }

    public function markConnectionError(string $message): void
    {
        $this->update([
            'connection_error' => $message,
            'token_refresh_failed_at' => now(),
        ]);
    }

    public function clearConnectionError(): void
    {
        $this->update([
            'connection_error' => null,
            'token_refresh_failed_at' => null,
        ]);
    }

    public function usesSellerCookie(): bool
    {
        $metadata = is_array($this->metadata) ? $this->metadata : [];

        return ($metadata['auth_mode'] ?? null) === 'seller_cookie'
            || $this->access_token === 'seller_cookie'
            || $this->shop_cipher === 'seller_cookie';
    }
}
