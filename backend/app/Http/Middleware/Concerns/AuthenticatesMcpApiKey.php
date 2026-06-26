<?php

namespace App\Http\Middleware\Concerns;

trait AuthenticatesMcpApiKey
{
    protected function isValidApiKey(string $key): bool
    {
        $key = trim($key);

        if ($key === '') {
            return false;
        }

        $configured = array_filter(array_merge(
            config('mcp.api_key') ? [config('mcp.api_key')] : [],
            config('mcp.api_keys', [])
        ));

        if ($configured === []) {
            return false;
        }

        foreach ($configured as $candidate) {
            if (hash_equals((string) $candidate, $key)) {
                return true;
            }
        }

        return false;
    }
}
