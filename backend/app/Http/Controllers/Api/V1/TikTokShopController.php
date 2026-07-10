<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\AuthorizesPermissions;
use App\Http\Controllers\Controller;
use App\Http\Resources\MarketplaceProductReviewResource;
use App\Http\Resources\TikTokShopConnectionResource;
use App\Models\MarketplaceProductReview;
use App\Models\TikTokShopConnection;
use App\Services\Marketplace\MarketplacePlatformConfigService;
use App\Services\Marketplace\MarketplaceReviewSyncService;
use App\Services\Marketplace\MarketplaceTokenRefreshService;
use App\Services\TikTokShop\TikTokShopAuthService;
use App\Services\TikTokShop\TikTokShopService;
use App\Support\MarketplacePlatform;
use App\Support\TikTokShopScopes;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use RuntimeException;

class TikTokShopController extends Controller
{
    use AuthorizesPermissions;

    public function __construct(
        private TikTokShopAuthService $authService,
        private TikTokShopService $shopService,
        private MarketplacePlatformConfigService $platformConfig,
        private MarketplaceReviewSyncService $reviewSync,
        private MarketplaceTokenRefreshService $tokenRefresh,
    ) {}

    public function status(Request $request): JsonResponse
    {
        $this->ensurePermission($request->user(), 'marketplace.view');

        $credentials = $this->platformConfig->getCredentials(MarketplacePlatform::TIKTOK_SHOP);

        $connections = $this->shopService->listConnections();
        $grantedScopes = $connections
            ->map(fn ($connection) => is_array($connection->metadata['granted_scopes'] ?? null)
                ? $connection->metadata['granted_scopes']
                : [])
            ->flatten()
            ->unique()
            ->values()
            ->all();

        return response()->json([
            'configured' => $this->authService->isConfigured(),
            'region' => $credentials['region'],
            'callback_url' => url('/api/v1/tiktok-shop/oauth/callback'),
            'webhook_url' => url('/api/v1/webhook/marketplace/tiktok-shop'),
            'required_scopes' => TikTokShopScopes::required(),
            'granted_scopes' => $grantedScopes,
            'missing_scopes' => TikTokShopScopes::missing($grantedScopes === [] ? null : $grantedScopes),
            'settings' => $credentials['settings'],
            'connections_needing_attention' => $this->tokenRefresh
                ->connectionsNeedingAttention()
                ->where('platform', MarketplacePlatform::TIKTOK_SHOP)
                ->count(),
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $this->ensurePermission($request->user(), 'marketplace.view');

        $connections = $this->shopService->listConnections();

        return response()->json([
            'data' => TikTokShopConnectionResource::collection($connections),
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
        $redirectBase = $frontendUrl.'/marketplace/tiktok-shop';

        $error = $request->query('error')
            ?? $request->query('error_description')
            ?? $request->query('message');

        if ($error) {
            return redirect($redirectBase.'?error='.urlencode((string) $error));
        }

        $validated = $request->validate([
            'code' => ['required', 'string'],
            'state' => ['required', 'string'],
        ]);

        try {
            $result = $this->authService->handleOAuthCallback($validated['code'], $validated['state']);
            $count = count($result['connections']);

            return redirect($redirectBase.'?connected='.$count);
        } catch (RuntimeException $exception) {
            return redirect($redirectBase.'?error='.urlencode($exception->getMessage()));
        }
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $this->ensurePermission($request->user(), 'marketplace.manage');

        $connection = TikTokShopConnection::query()->findOrFail($id);
        $this->shopService->disconnect($connection);

        return response()->json([
            'message' => 'TikTok Shop disconnected.',
        ]);
    }

    public function refresh(Request $request, int $id): JsonResponse
    {
        $this->ensurePermission($request->user(), 'marketplace.manage');

        $connection = TikTokShopConnection::query()->findOrFail($id);

        try {
            $connection = $this->authService->refreshConnectionTokens($connection);
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }

        return response()->json([
            'message' => 'Access token refreshed.',
            'data' => new TikTokShopConnectionResource($connection),
        ]);
    }

    public function products(Request $request, int $id): JsonResponse
    {
        $this->ensurePermission($request->user(), 'marketplace.view');

        $connection = TikTokShopConnection::query()
            ->where('is_active', true)
            ->findOrFail($id);

        $validated = $request->validate([
            'page_size' => ['sometimes', 'integer', 'min:1', 'max:50'],
            'page_token' => ['sometimes', 'nullable', 'string', 'max:255'],
            'status' => ['sometimes', 'nullable', 'string', 'max:50'],
        ]);

        try {
            $result = $this->shopService->listProducts(
                $connection,
                $validated['page_size'] ?? 20,
                $validated['page_token'] ?? null,
                $validated['status'] ?? null,
            );
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }

        return response()->json([
            'shop' => new TikTokShopConnectionResource($connection->fresh()),
            'products' => $result['products'] ?? [],
            'total_count' => $result['total_count'] ?? null,
            'next_page_token' => $result['next_page_token'] ?? null,
        ]);
    }

    public function reviews(Request $request, int $id): JsonResponse
    {
        $this->ensurePermission($request->user(), 'reviews.view');

        $connection = TikTokShopConnection::query()
            ->where('is_active', true)
            ->findOrFail($id);

        $validated = $request->validate([
            'min_rating' => ['sometimes', 'integer', 'min:1', 'max:5'],
            'max_rating' => ['sometimes', 'integer', 'min:1', 'max:5'],
            'limit' => ['sometimes', 'integer', 'min:1', 'max:200'],
        ]);

        $reviews = $this->reviewSync->listStoredReviews(
            $connection,
            $validated['min_rating'] ?? null,
            $validated['max_rating'] ?? null,
            $validated['limit'] ?? 100,
        );

        return response()->json([
            'data' => MarketplaceProductReviewResource::collection($reviews),
        ]);
    }

    public function syncReviews(Request $request, int $id): JsonResponse
    {
        $this->ensurePermission($request->user(), 'reviews.manage');

        $connection = TikTokShopConnection::query()
            ->where('is_active', true)
            ->findOrFail($id);

        $validated = $request->validate([
            'page_size' => ['sometimes', 'integer', 'min:1', 'max:50'],
            'page_token' => ['sometimes', 'nullable', 'string', 'max:255'],
            'product_id' => ['sometimes', 'nullable', 'string', 'max:64'],
            'min_rating' => ['sometimes', 'integer', 'min:1', 'max:5'],
            'max_rating' => ['sometimes', 'integer', 'min:1', 'max:5'],
        ]);

        try {
            $result = $this->reviewSync->syncTikTokShopReviews(
                $connection,
                $validated['page_size'] ?? 20,
                $validated['page_token'] ?? null,
                $validated['product_id'] ?? null,
                $validated['min_rating'] ?? null,
                $validated['max_rating'] ?? null,
            );
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }

        $reviews = $this->reviewSync->listStoredReviews($connection, limit: 100);

        return response()->json([
            'message' => "Synced {$result['synced']} review(s).",
            'sync' => $result,
            'data' => MarketplaceProductReviewResource::collection($reviews),
        ]);
    }

    public function replyToReview(Request $request, int $id, int $reviewId): JsonResponse
    {
        $this->ensurePermission($request->user(), 'reviews.manage');

        $connection = TikTokShopConnection::query()
            ->where('is_active', true)
            ->findOrFail($id);

        $review = MarketplaceProductReview::query()
            ->where('marketplace_shop_connection_id', $connection->id)
            ->findOrFail($reviewId);

        $validated = $request->validate([
            'content' => ['required', 'string', 'max:2000'],
        ]);

        try {
            $review = $this->reviewSync->replyToReview($review, $validated['content']);
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }

        return response()->json([
            'message' => 'Reply posted to review.',
            'data' => new MarketplaceProductReviewResource($review),
        ]);
    }
}
