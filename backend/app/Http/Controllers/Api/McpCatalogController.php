<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\McpCatalogService;
use App\Services\WebhookSettingsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class McpCatalogController extends Controller
{
    public function __construct(
        private McpCatalogService $catalog,
        private WebhookSettingsService $webhookSettings,
    ) {}

    public function __invoke(Request $request): JsonResponse
    {
        if (! $this->hasValidServiceSecret($request)) {
            return response()->json(['message' => 'Unauthorized.'], 401);
        }

        return response()->json($this->catalog->endpoints());
    }

    private function hasValidServiceSecret(Request $request): bool
    {
        $headerSecret = $request->header('X-Webhook-Secret');
        if ($this->webhookSettings->validateIncomingSecret($headerSecret)) {
            return true;
        }

        $authorization = (string) $request->header('Authorization', '');
        if (str_starts_with($authorization, 'Bearer ')) {
            return $this->webhookSettings->validateIncomingSecret(substr($authorization, 7));
        }

        return false;
    }
}
