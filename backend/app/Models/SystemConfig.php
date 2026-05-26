<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SystemConfig extends Model
{
    protected $fillable = [
        'key',
        'label',
        'value',
        'json_value',
    ];

    protected function casts(): array
    {
        return [
            'value' => 'array',
            'json_value' => 'array',
        ];
    }
}
