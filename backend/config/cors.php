<?php

$origins = env('CORS_ALLOWED_ORIGINS');

if ($origins === null || $origins === '') {
    $origins = env('FRONTEND_URL', 'http://localhost:5173');
}

return [

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    'allowed_origins' => array_values(array_filter(array_map('trim', explode(',', (string) $origins)))),

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => false,

];
