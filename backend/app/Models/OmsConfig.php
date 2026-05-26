<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OmsConfig extends Model
{
    protected $fillable = [
        'name',
        'base_url',
        'api_key',
        'auth_type',
        'auth_header_name',
        'update_order_endpoint',
        'status_mapping',
        'is_active',
        'last_test_result',
    ];

    protected function casts(): array
    {
        return [
            'status_mapping' => 'array',
            'is_active' => 'boolean',
        ];
    }
}
