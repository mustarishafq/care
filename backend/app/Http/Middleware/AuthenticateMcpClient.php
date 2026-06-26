<?php

namespace App\Http\Middleware;

use App\Http\Middleware\Concerns\AuthenticatesMcpApiKey;
use App\Services\WebhookSettingsService;
use App\Support\McpResponse;
use Closure;
use Illuminate\Http\Request;
use Laravel\Sanctum\PersonalAccessToken;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateMcpClient
{
    use AuthenticatesMcpApiKey;

    public function __construct(
        private WebhookSettingsService $webhookSettings,
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        if ($this->authenticateApiKeyHeader($request)) {
            return $next($request);
        }

        if ($this->authenticateWebhookSecretHeader($request)) {
            return $next($request);
        }

        if ($this->authenticateBearer($request)) {
            return $next($request);
        }

        return McpResponse::error('Invalid or missing credentials.', 401);
    }

    private function authenticateApiKeyHeader(Request $request): bool
    {
        $apiKey = $request->header('X-API-Key');

        if ($apiKey === null || $apiKey === '') {
            return false;
        }

        if ($this->isValidApiKey($apiKey)) {
            $request->attributes->set('mcp_auth_method', 'X-API-Key');

            return true;
        }

        if ($this->webhookSettings->validateIncomingSecret($apiKey)) {
            $request->attributes->set('mcp_auth_method', 'X-Webhook-Secret');

            return true;
        }

        return false;
    }

    private function authenticateWebhookSecretHeader(Request $request): bool
    {
        $secret = $request->header('X-Webhook-Secret');

        if ($secret === null || $secret === '') {
            return false;
        }

        if (! $this->webhookSettings->validateIncomingSecret($secret)) {
            return false;
        }

        $request->attributes->set('mcp_auth_method', 'X-Webhook-Secret');

        return true;
    }

    private function authenticateBearer(Request $request): bool
    {
        $authorization = (string) $request->header('Authorization', '');

        if (! str_starts_with($authorization, 'Bearer ')) {
            return false;
        }

        $token = substr($authorization, 7);

        if ($this->isValidApiKey($token)) {
            $request->attributes->set('mcp_auth_method', 'X-API-Key');

            return true;
        }

        if ($this->webhookSettings->validateIncomingSecret($token)) {
            $request->attributes->set('mcp_auth_method', 'X-Webhook-Secret');

            return true;
        }

        $accessToken = PersonalAccessToken::findToken($token);

        if ($accessToken?->tokenable) {
            $user = $accessToken->tokenable;

            if (! $user->canLogin()) {
                return false;
            }

            $request->setUserResolver(fn () => $user);
            $request->attributes->set('mcp_auth_method', 'Bearer');

            return true;
        }

        return false;
    }
}
