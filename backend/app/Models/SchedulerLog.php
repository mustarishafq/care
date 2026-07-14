<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SchedulerLog extends Model
{
    public const LEVEL_INFO = 'info';

    public const LEVEL_SUCCESS = 'success';

    public const LEVEL_WARNING = 'warning';

    public const LEVEL_ERROR = 'error';

    /** @var list<string> */
    public const LEVELS = [
        self::LEVEL_INFO,
        self::LEVEL_SUCCESS,
        self::LEVEL_WARNING,
        self::LEVEL_ERROR,
    ];

    protected $fillable = [
        'command',
        'source',
        'level',
        'title',
        'message',
        'marketplace_shop_connection_id',
        'context',
    ];

    protected function casts(): array
    {
        return [
            'context' => 'array',
        ];
    }

    public function shopConnection(): BelongsTo
    {
        return $this->belongsTo(MarketplaceShopConnection::class, 'marketplace_shop_connection_id');
    }
}
