<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\AuthorizesPermissions;
use App\Http\Controllers\Controller;
use App\Http\Resources\MarketplaceProductReviewResource;
use App\Http\Resources\TikTokShopConnectionResource;
use App\Models\MarketplaceProductReview;
use App\Models\MarketplaceShopConnection;
use App\Models\TikTokShopConnection;
use App\Services\Marketplace\MarketplaceReviewSyncService;
use App\Support\MarketplacePlatform;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

class MarketplaceReviewController extends Controller
{
    use AuthorizesPermissions;

    public function __construct(
        private readonly MarketplaceReviewSyncService $reviewSync,
    ) {}

    public function shops(Request $request): JsonResponse
    {
        $this->ensurePermission($request->user(), 'oms.view');

        $validated = $request->validate([
            'platform' => ['sometimes', 'nullable', 'string', 'max:32'],
        ]);

        $shops = MarketplaceShopConnection::query()
            ->where('is_active', true)
            ->when($validated['platform'] ?? null, fn ($query, $platform) => $query->where('platform', $platform))
            ->orderBy('platform')
            ->orderBy('shop_name')
            ->get();

        return response()->json([
            'data' => TikTokShopConnectionResource::collection($shops),
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $this->ensurePermission($request->user(), 'oms.view');

        $validated = $request->validate([
            'platform' => ['sometimes', 'nullable', 'string', 'max:32'],
            'shop_connection_id' => ['sometimes', 'nullable', 'integer'],
            'min_rating' => ['sometimes', 'integer', 'min:1', 'max:5'],
            'max_rating' => ['sometimes', 'integer', 'min:1', 'max:5'],
            'limit' => ['sometimes', 'integer', 'min:1', 'max:500'],
        ]);

        if (! empty($validated['platform']) && ! MarketplacePlatform::isValid($validated['platform'])) {
            return response()->json(['message' => 'Unsupported platform.'], 422);
        }

        $reviews = $this->reviewSync->listAllReviews(
            $validated['platform'] ?? null,
            $validated['shop_connection_id'] ?? null,
            $validated['min_rating'] ?? null,
            $validated['max_rating'] ?? null,
            $validated['limit'] ?? 200,
        );

        return response()->json([
            'data' => MarketplaceProductReviewResource::collection($reviews),
        ]);
    }

    public function sync(Request $request): JsonResponse
    {
        $this->ensurePermission($request->user(), 'oms.manage');

        $validated = $request->validate([
            'shop_connection_id' => ['required', 'integer', 'exists:marketplace_shop_connections,id'],
            'page_size' => ['sometimes', 'integer', 'min:1', 'max:50'],
            'page_token' => ['sometimes', 'nullable', 'string', 'max:255'],
            'product_id' => ['sometimes', 'nullable', 'string', 'max:64'],
            'min_rating' => ['sometimes', 'integer', 'min:1', 'max:5'],
            'max_rating' => ['sometimes', 'integer', 'min:1', 'max:5'],
        ]);

        $connection = MarketplaceShopConnection::query()
            ->where('is_active', true)
            ->findOrFail($validated['shop_connection_id']);

        try {
            $result = $this->reviewSync->syncConnection(
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

        return response()->json([
            'message' => "Synced {$result['synced']} review(s).",
            'sync' => $result,
        ]);
    }

    public function reply(Request $request, int $id): JsonResponse
    {
        $this->ensurePermission($request->user(), 'oms.manage');

        $review = MarketplaceProductReview::query()->findOrFail($id);

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
            'data' => new MarketplaceProductReviewResource($review->load('shopConnection')),
        ]);
    }
}
