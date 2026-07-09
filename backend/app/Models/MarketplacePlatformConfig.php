<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MarketplacePlatformConfig extends Model
{
    protected $fillable = [
        'platform',
        'app_key',
        'app_secret',
        'service_id',
        'region',
        'settings',
        'is_active',
        'updated_by_user_id',
    ];

    protected function casts(): array
    {
        return [
            'app_key' => 'encrypted',
            'app_secret' => 'encrypted',
            'settings' => 'array',
            'is_active' => 'boolean',
        ];
    }

    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by_user_id');
    }
}
