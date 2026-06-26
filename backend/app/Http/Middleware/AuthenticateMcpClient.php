<?php

namespace App\Http\Middleware;

use App\Http\Middleware\Concerns\AuthenticatesMcpApiKey;
use App\Support\McpResponse;
use Closure;
use Illuminate\Http\Request;
use Laravel\Sanctum\PersonalAccessToken;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateMcpClient
{
    use AuthenticatesMcpApiKey;

    public function handle(Request $request, Closure $next): Response
    {
        $apiKey = $request->header('X-API-Key');

        if ($apiKey !== null && $this->isValidApiKey($apiKey)) {
            $request->attributes->set('mcp_auth_method', 'X-API-Key');

            return $next($request);
        }

        $authorization = (string) $request->header('Authorization', '');

        if (str_starts_with($authorization, 'Bearer ')) {
            $token = substr($authorization, 7);

            if ($this->isValidApiKey($token)) {
                $request->attributes->set('mcp_auth_method', 'X-API-Key');

                return $next($request);
            }

            $accessToken = PersonalAccessToken::findToken($token);

            if ($accessToken?->tokenable) {
                $user = $accessToken->tokenable;

                if (! $user->canLogin()) {
                    return McpResponse::error('Invalid or missing credentials.', 401);
                }

                $request->setUserResolver(fn () => $user);
                $request->attributes->set('mcp_auth_method', 'Bearer');

                return $next($request);
            }
        }

        return McpResponse::error('Invalid or missing credentials.', 401);
    }
}
