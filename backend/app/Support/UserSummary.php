<?php

namespace App\Support;

use App\Models\User;

class UserSummary
{
    /**
     * Compact user payload for nested API responses.
     *
     * @return array{id: string, email: string|null, full_name: string|null, avatar_url: string|null}|null
     */
    public static function from(?User $user): ?array
    {
        if (! $user) {
            return null;
        }

        return [
            'id' => (string) $user->id,
            'email' => $user->email,
            'full_name' => $user->full_name ?? $user->name,
            'avatar_url' => StoragePath::resolveAvatarUrl($user->avatar_url),
        ];
    }

    public static function avatarUrl(?User $user): ?string
    {
        return StoragePath::resolveAvatarUrl($user?->avatar_url);
    }
}
