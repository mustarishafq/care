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

        if (Str::startsWith($value, ['/storage/', 'storage/'])) {
            return ltrim(Str::after($value, 'storage/'), '/');
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

    /** Public URL for a file on the public disk (uses APP_URL, e.g. https://careapi.emzinexus.com/storage/...). */
    public static function url(string $path): string
    {
        return rtrim(config('app.url'), '/').'/storage/'.self::normalize($path);
    }

    /**
     * Resolve a stored avatar for API clients.
     * Absolute URLs pass through; relative /storage paths become APP_URL-based URLs.
     */
    public static function resolveAvatarUrl(?string $avatarUrl): ?string
    {
        if ($avatarUrl === null) {
            return null;
        }

        $avatarUrl = trim($avatarUrl);
        if ($avatarUrl === '') {
            return null;
        }

        if (Str::startsWith($avatarUrl, ['http://', 'https://'])) {
            return $avatarUrl;
        }

        return self::url($avatarUrl);
    }

    /** @param  array<int, string>|null  $paths */
    public static function urlMany(?array $paths): array
    {
        if (empty($paths)) {
            return [];
        }

        return array_values(array_map([self::class, 'url'], $paths));
    }

    /**
     * @param  array<int, array<string, mixed>|string>|null  $items
     * @return list<array{path: string, type: string, name: string}>
     */
    public static function normalizeClosureProofMany(?array $items): array
    {
        if (empty($items)) {
            return [];
        }

        $normalized = [];

        foreach ($items as $item) {
            if (is_string($item)) {
                $path = self::normalize($item);
                $normalized[] = [
                    'path' => $path,
                    'type' => 'other',
                    'name' => basename($path),
                ];
                continue;
            }

            if (! is_array($item) || empty($item['path'])) {
                continue;
            }

            $type = (string) ($item['type'] ?? 'other');
            $allowed = ['delivery', 'customer_conversation', 'vendor_screenshot', 'other'];
            if (! in_array($type, $allowed, true)) {
                $type = 'other';
            }

            $path = self::normalize((string) $item['path']);
            $normalized[] = [
                'path' => $path,
                'type' => $type,
                'name' => (string) ($item['name'] ?? basename($path)),
            ];
        }

        return array_values($normalized);
    }

    /**
     * @param  array<int, array<string, mixed>>|null  $items
     * @return list<array{path: string, url: string, type: string, name: string}>
     */
    public static function closureProofUrls(?array $items): array
    {
        if (empty($items)) {
            return [];
        }

        return array_values(array_map(fn (array $item) => [
            'path' => $item['path'],
            'url' => self::url($item['path']),
            'type' => $item['type'] ?? 'other',
            'name' => $item['name'] ?? basename($item['path']),
        ], self::normalizeClosureProofMany($items)));
    }
}
