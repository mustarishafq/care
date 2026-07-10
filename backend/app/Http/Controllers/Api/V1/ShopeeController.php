<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\AuthorizesPermissions;
use App\Http\Controllers\Controller;
use App\Http\Resources\ShopeeConnectionResource;
use App\Models\ShopeeConnection;
use App\Services\Marketplace\MarketplacePlatformConfigService;
use App\Services\Marketplace\MarketplaceTokenRefreshService;
use App\Services\Shopee\ShopeeAuthService;
use App\Services\Shopee\ShopeeService;
use App\Support\MarketplacePlatform;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use RuntimeException;

class ShopeeController extends Controller
{
    use AuthorizesPermissions;

    public function __construct(
        private ShopeeAuthService $authService,
        private ShopeeService $shopService,
        private MarketplacePlatformConfigService $platformConfig,
        private MarketplaceTokenRefreshService $tokenRefresh,
    ) {}

    public function status(Request $request): JsonResponse
    {
        $this->ensurePermission($request->user(), 'marketplace.view');

        $credentials = $this->platformConfig->getCredentials(MarketplacePlatform::SHOPEE);

        return response()->json([
            'configured' => $this->authService->isConfigured(),
            'region' => $credentials['region'],
            'callback_url' => MarketplacePlatform::oauthCallbackUrl(MarketplacePlatform::SHOPEE),
            'webhook_url' => MarketplacePlatform::webhookUrl(MarketplacePlatform::SHOPEE),
            'settings' => $credentials['settings'],
            'connections_needing_attention' => $this->tokenRefresh
                ->connectionsNeedingAttention()
                ->where('platform', MarketplacePlatform::SHOPEE)
                ->count(),
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $this->ensurePermission($request->user(), 'marketplace.view');

        $connections = $this->shopService->listConnections();

        return response()->json([
            'data' => ShopeeConnectionResource::collection($connections),
        ]);
    }

    public function authUrl(Request $request): JsonResponse
    {
        $this->ensurePermission($request->user(), 'marketplace.manage');

        try {
            $auth = $this->authService->createAuthorizationUrl($request->user());
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }

        return response()->json($auth);
    }

    public function oauthCallback(Request $request): RedirectResponse
    {
        $frontendUrl = rtrim((string) config('app.frontend_url', env('FRONTEND_URL', 'http://localhost:5173')), '/');
        $redirectBase = $frontendUrl.'/marketplace/shopee';

        $error = $request->query('error')
            ?? $request->query('error_description')
            ?? $request->query('message');

        if ($error) {
            return redirect($redirectBase.'?error='.urlencode((string) $error));
        }

        $validated = $request->validate([
            'code' => ['required', 'string'],
            'shop_id' => ['required', 'integer'],
            'state' => ['required', 'string'],
        ]);

        try {
            $result = $this->authService->handleOAuthCallback(
                $validated['code'],
                (int) $validated['shop_id'],
                $validated['state'],
            );
            $count = count($result['connections']);

            return redirect($redirectBase.'?connected='.$count);
        } catch (RuntimeException $exception) {
            return redirect($redirectBase.'?error='.urlencode($exception->getMessage()));
        }
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $this->ensurePermission($request->user(), 'marketplace.manage');

        $connection = ShopeeConnection::query()->findOrFail($id);
        $this->shopService->disconnect($connection);

        return response()->json([
            'message' => 'Shopee shop disconnected.',
        ]);
    }

    public function refresh(Request $request, int $id): JsonResponse
    {
        $this->ensurePermission($request->user(), 'marketplace.manage');

        $connection = ShopeeConnection::query()->findOrFail($id);

        try {
            $connection = $this->authService->refreshConnectionTokens($connection);
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }

        return response()->json([
            'message' => 'Access token refreshed.',
            'data' => new ShopeeConnectionResource($connection),
        ]);
    }

    public function products(Request $request, int $id): JsonResponse
    {
        $this->ensurePermission($request->user(), 'marketplace.view');

        $connection = ShopeeConnection::query()
            ->where('is_active', true)
            ->findOrFail($id);

        $validated = $request->validate([
            'page_size' => ['sometimes', 'integer', 'min:1', 'max:50'],
            'offset' => ['sometimes', 'integer', 'min:0'],
            'status' => ['sometimes', 'nullable', 'string', 'max:50'],
        ]);

        try {
            $result = $this->shopService->listProducts(
                $connection,
                $validated['page_size'] ?? 20,
                $validated['offset'] ?? 0,
                $validated['status'] ?? null,
            );
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }

        return response()->json([
            'shop' => new ShopeeConnectionResource($connection->fresh()),
            'products' => $result['products'],
            'total_count' => $result['total_count'],
            'next_offset' => $result['next_offset'],
            'has_next_page' => $result['has_next_page'],
        ]);
    }
}
