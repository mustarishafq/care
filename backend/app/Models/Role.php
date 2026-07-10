<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Role extends Model
{
    protected $fillable = [
        'slug',
        'name',
        'description',
        'permissions',
        'default_page',
        'is_active',
        'is_system',
        'is_admin',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'permissions' => 'array',
            'is_active' => 'boolean',
            'is_system' => 'boolean',
            'is_admin' => 'boolean',
        ];
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public static function idForSlug(string $slug): ?int
    {
        $id = static::query()->where('slug', $slug)->value('id');

        return $id ? (int) $id : null;
    }

    public static function defaultId(): ?int
    {
        return static::idForSlug('viewer');
    }
}
