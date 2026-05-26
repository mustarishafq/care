<?php

namespace App\Support;

use Illuminate\Support\Str;

class StoragePath
{
    /**
     * Convert a stored path or legacy full URL to a disk-relative path.
     * e.g. "http://localhost/storage/uploads/foo.png" → "uploads/foo.png"
     */
    public static function normalize(string $value): string
    {
        $value = trim($value);

        if (Str::startsWith($value, ['http://', 'https://'])) {
            $path = parse_url($value, PHP_URL_PATH) ?? $value;
            if (Str::contains($path, '/storage/')) {
                return ltrim(Str::after($path, '/storage/'), '/');
            }

            return ltrim($path, '/');
        }

        return ltrim($value, '/');
    }

    /** @param  array<int, string>|null  $values */
    public static function normalizeMany(?array $values): array
    {
        if (empty($values)) {
            return [];
        }

        return array_values(array_map([self::class, 'normalize'], $values));
    }

    /** Resolve a disk-relative path to a public URL (relative, domain-agnostic). */
    public static function url(string $path): string
    {
        return '/storage/'.self::normalize($path);
    }

    /** @param  array<int, string>|null  $paths */
    public static function urlMany(?array $paths): array
    {
        if (empty($paths)) {
            return [];
        }

        return array_values(array_map([self::class, 'url'], $paths));
    }
}
