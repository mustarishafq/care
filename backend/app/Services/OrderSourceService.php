<?php

namespace App\Services;

use App\Models\SystemConfig;

class OrderSourceService
{
    public const CONFIG_KEY = 'order_sources';

    /** @return list<string> */
    public function getSources(): array
    {
        $config = SystemConfig::where('key', self::CONFIG_KEY)->first();
        $raw = $config?->json_value ?? [];
        $sources = $raw['sources'] ?? [];

        if (! is_array($sources)) {
            return [];
        }

        return array_values(array_unique(array_filter(array_map(
            fn ($source) => is_string($source) ? trim($source) : '',
            $sources,
        ))));
    }
}
