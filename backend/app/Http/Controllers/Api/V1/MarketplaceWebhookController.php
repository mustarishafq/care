<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Marketplace\MarketplacePlatformConfigService;
use App\Support\MarketplacePlatform;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class MarketplaceWebhookController extends Controller
{
    public function __construct(
        private readonly MarketplacePlatformConfigService $platformConfig,
    ) {}

    public function tiktokShop(Request $request): JsonResponse
    {
        $secret = $this->platformConfig->getSetting(
            MarketplacePlatform::TIKTOK_SHOP,
            'webhook_secret',
        );

        if ($secret) {
            $provided = $request->header('X-Webhook-Secret')
                ?? $request->header('Authorization')
                ?? $request->query('secret');

            if (! is_string($provided) || ! hash_equals((string) $secret, $provided)) {
                return response()->json(['message' => 'Invalid webhook secret.'], 401);
            }
        }

        Log::info('TikTok Shop webhook received', [
            'headers' => $request->headers->all(),
            'payload' => $request->all(),
        ]);

        return response()->json([
            'message' => 'Webhook received.',
        ]);
    }

    public function shopee(Request $request): JsonResponse
    {
        $secret = $this->platformConfig->getSetting(
            MarketplacePlatform::SHOPEE,
            'webhook_secret',
        );

        if ($secret) {
            $provided = $request->header('X-Webhook-Secret')
                ?? $request->header('Authorization')
                ?? $request->query('secret');

            if (! is_string($provided) || ! hash_equals((string) $secret, $provided)) {
                return response()->json(['message' => 'Invalid webhook secret.'], 401);
            }
        }

        Log::info('Shopee webhook received', [
            'headers' => $request->headers->all(),
            'payload' => $request->all(),
        ]);

        return response()->json([
            'message' => 'Webhook received.',
        ]);
    }
}
