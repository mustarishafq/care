<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class LogMcpRequest
{
    public function handle(Request $request, Closure $next): Response
    {
        $request->attributes->set('mcp_started_at', microtime(true));

        if (! $request->headers->has('X-Request-Id')) {
            $request->headers->set('X-Request-Id', (string) Str::uuid());
        }

        return $next($request);
    }

    public function terminate(Request $request, Response $response): void
    {
        $startedAt = $request->attributes->get('mcp_started_at');

        if ($startedAt === null) {
            return;
        }

        $durationMs = (int) round((microtime(true) - $startedAt) * 1000);

        Log::info('mcp.request', [
            'request_id' => $request->header('X-Request-Id'),
            'endpoint' => $request->method().' '.$request->path(),
            'client' => $request->attributes->get('mcp_auth_method', 'unknown'),
            'user_id' => $request->user()?->id,
            'status' => $response->getStatusCode(),
            'duration_ms' => $durationMs,
        ]);
    }
}
