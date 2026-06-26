<?php

use App\Http\Middleware\EnsureUserIsApproved;
use App\Support\McpResponse;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        apiPrefix: 'api',
        then: function () {
            Route::middleware('api')
                ->prefix('api/mcp/v1')
                ->group(base_path('routes/mcp.php'));
        },
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->statefulApi();
        $middleware->alias([
            'approved' => EnsureUserIsApproved::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(function ($request) {
            return $request->is('api/*') || $request->expectsJson();
        });

        $exceptions->render(function (ValidationException $e, Request $request) {
            if (! $request->is('api/mcp/*')) {
                return null;
            }

            return McpResponse::error('The given data was invalid.', 422, $e->errors());
        });

        $exceptions->render(function (NotFoundHttpException $e, Request $request) {
            if (! $request->is('api/mcp/*')) {
                return null;
            }

            $message = $e->getMessage() !== '' ? $e->getMessage() : 'Resource not found.';

            if (str_contains($request->path(), 'complaints')) {
                $message = 'Complaint not found.';
            }

            return McpResponse::error($message, 404);
        });

        $exceptions->render(function (HttpResponseException $e, Request $request) {
            if (! $request->is('api/mcp/*')) {
                return null;
            }

            $response = $e->getResponse();
            $payload = json_decode((string) $response->getContent(), true);
            $message = is_array($payload) ? ($payload['message'] ?? 'Request failed.') : 'Request failed.';

            return McpResponse::error($message, $response->getStatusCode());
        });

        $exceptions->render(function (HttpExceptionInterface $e, Request $request) {
            if (! $request->is('api/mcp/*')) {
                return null;
            }

            return McpResponse::error($e->getMessage() ?: 'Request failed.', $e->getStatusCode());
        });

        $exceptions->render(function (AuthenticationException $e, Request $request) {
            if (! $request->is('api/mcp/*')) {
                return null;
            }

            return McpResponse::error('Invalid or missing credentials.', 401);
        });
    })->create();
