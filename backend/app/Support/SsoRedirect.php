<?php

namespace App\Support;

class SsoRedirect
{
    public static function sanitize(?string $redirectTo, string $default = '/dashboard'): string
    {
        $redirectTo = trim((string) $redirectTo);

        if ($redirectTo === '') {
            return $default;
        }

        if (str_starts_with($redirectTo, '/') && ! str_starts_with($redirectTo, '//')) {
            return $redirectTo;
        }

        $frontendBase = rtrim((string) config('app.frontend_url', config('app.url')), '/');
        $appBase = rtrim((string) config('app.url'), '/');
        $allowedOrigins = array_values(array_unique(array_filter([$frontendBase, $appBase])));

        $parsed = parse_url($redirectTo);
        if (! $parsed || empty($parsed['scheme']) || empty($parsed['host'])) {
            return $default;
        }

        $origin = $parsed['scheme'].'://'.$parsed['host'].(isset($parsed['port']) ? ':'.$parsed['port'] : '');

        if (! in_array($origin, $allowedOrigins, true)) {
            return $default;
        }

        $path = $parsed['path'] ?? '/';
        $query = isset($parsed['query']) ? '?'.$parsed['query'] : '';
        $fragment = isset($parsed['fragment']) ? '#'.$parsed['fragment'] : '';

        return $path.$query.$fragment;
    }
}
