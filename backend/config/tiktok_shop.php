<?php

return [

    'app_key' => env('TIKTOK_SHOP_APP_KEY'),

    'app_secret' => env('TIKTOK_SHOP_APP_SECRET'),

    'service_id' => env('TIKTOK_SHOP_SERVICE_ID'),

    'region' => env('TIKTOK_SHOP_REGION', 'MY'),

    'api_base_url' => env('TIKTOK_SHOP_API_BASE_URL', 'https://open-api.tiktokglobalshop.com'),

    'auth_base_url' => env('TIKTOK_SHOP_AUTH_BASE_URL', 'https://auth.tiktok-shops.com'),

    'authorize_url' => env('TIKTOK_SHOP_AUTHORIZE_URL', 'https://services.tiktokshop.com/open/authorize'),

    'api_version' => env('TIKTOK_SHOP_API_VERSION', '202309'),

    'oauth_state_ttl_minutes' => (int) env('TIKTOK_SHOP_OAUTH_STATE_TTL', 15),

];
