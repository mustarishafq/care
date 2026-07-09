<?php

return [

    'partner_id' => env('SHOPEE_PARTNER_ID'),

    'partner_key' => env('SHOPEE_PARTNER_KEY'),

    'region' => env('SHOPEE_REGION', 'MY'),

    'sandbox' => (bool) env('SHOPEE_SANDBOX', false),

    'host' => env('SHOPEE_API_HOST', 'https://partner.shopeemobile.com'),

    'sandbox_host' => env('SHOPEE_SANDBOX_HOST', 'https://openplatform.sandbox.test-stable.shopee.sg'),

    'oauth_state_ttl_minutes' => (int) env('SHOPEE_OAUTH_STATE_TTL', 15),

];
