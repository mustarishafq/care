<?php

return [

    /*
    |--------------------------------------------------------------------------
    | MCP API Keys
    |--------------------------------------------------------------------------
    |
    | Server-to-server keys for EMZI Nexus Brain. Comma-separated MCP_API_KEYS
    | supports rotation; MCP_API_KEY is the primary key.
    |
    */

    'api_key' => env('MCP_API_KEY'),

    'api_keys' => array_values(array_filter(array_map(
        'trim',
        explode(',', (string) env('MCP_API_KEYS', ''))
    ))),

    'rate_limit' => (int) env('MCP_RATE_LIMIT', 60),

];
