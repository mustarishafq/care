<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Support\Collection;

class MentionParser
{
    /** @return list<User> */
    public static function findMentionedUsers(string $content, ?int $excludeUserId = null): array
    {
        $candidates = User::query()
            ->whereNotNull('full_name')
            ->where('full_name', '!=', '')
            ->when($excludeUserId, fn ($query) => $query->where('id', '!=', $excludeUserId))
            ->orderByRaw('LENGTH(full_name) DESC')
            ->get();

        return self::matchUsers($content, $candidates);
    }

    /** @param  Collection<int, User>  $candidates */
    private static function matchUsers(string $content, Collection $candidates): array
    {
        $mentioned = [];
        $length = strlen($content);
        $i = 0;

        while ($i < $length) {
            if ($content[$i] !== '@') {
                $i++;
                continue;
            }

            $afterAt = substr($content, $i + 1);
            $matched = null;

            foreach ($candidates as $user) {
                $name = $user->full_name ?? '';
                if ($name === '') {
                    continue;
                }

                if (! str_starts_with(strtolower($afterAt), strtolower($name))) {
                    continue;
                }

                $next = $afterAt[strlen($name)] ?? null;
                if ($next === null || preg_match('/[\s,.!?;:]/', $next)) {
                    $matched = $user;
                    break;
                }
            }

            if ($matched) {
                $mentioned[$matched->id] = $matched;
                $i += 1 + strlen($matched->full_name ?? '');
                continue;
            }

            $i++;
        }

        return array_values($mentioned);
    }
}
