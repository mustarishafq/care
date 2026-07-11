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
use App\Services\TikTokShop\TikTokSellerReviewClient;
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
        $this->ensurePermission($request->user(), 'reviews.view');

        $validated = $request->validate([
            'platform' => ['sometimes', 'nullable', 'string', 'max:32'],
        ]);

        if (TikTokSellerReviewClient::hasConfiguredCookie()) {
            try {
                // Migrate legacy platform cookie into a shop row if needed.
                $this->reviewSync->ensureTikTokCookieConnection($request->user()?->id);
            } catch (RuntimeException) {
                // Cookie present but incomplete — keep listing other shops.
            }
        }

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
        $this->ensurePermission($request->user(), 'reviews.view');

        $validated = $request->validate([
            'platform' => ['sometimes', 'nullable', 'string', 'max:32'],
            'shop_connection_id' => ['sometimes', 'nullable', 'integer'],
            'min_rating' => ['sometimes', 'integer', 'min:1', 'max:5'],
            'max_rating' => ['sometimes', 'integer', 'min:1', 'max:5'],
            'reply_status' => ['sometimes', 'nullable', 'string', 'in:replied,unreplied'],
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'limit' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);

        if (! empty($validated['platform']) && ! MarketplacePlatform::isValid($validated['platform'])) {
            return response()->json(['message' => 'Unsupported platform.'], 422);
        }

        $filters = [
            $validated['platform'] ?? null,
            $validated['shop_connection_id'] ?? null,
            $validated['min_rating'] ?? null,
            $validated['max_rating'] ?? null,
            $validated['reply_status'] ?? null,
        ];

        $paginator = $this->reviewSync->listAllReviews(
            $filters[0],
            $filters[1],
            $filters[2],
            $filters[3],
            $validated['per_page'] ?? $validated['limit'] ?? 20,
            $filters[4],
            $validated['page'] ?? 1,
        );

        $stats = $this->reviewSync->reviewStats(
            $filters[0],
            $filters[1],
            $filters[2],
            $filters[3],
            $filters[4],
        );

        return response()->json([
            'data' => MarketplaceProductReviewResource::collection($paginator->items())->resolve(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
            ],
            'stats' => $stats,
        ]);
    }

    public function sync(Request $request): JsonResponse
    {
        $this->ensurePermission($request->user(), 'reviews.manage');

        $validated = $request->validate([
            'shop_connection_id' => ['sometimes', 'nullable', 'integer', 'exists:marketplace_shop_connections,id'],
            'platform' => ['sometimes', 'nullable', 'string', 'max:32'],
            'page_size' => ['sometimes', 'integer', 'min:1', 'max:50'],
            'page_token' => ['sometimes', 'nullable', 'string', 'max:255'],
            'product_id' => ['sometimes', 'nullable', 'string', 'max:64'],
            'min_rating' => ['sometimes', 'integer', 'min:1', 'max:5'],
            'max_rating' => ['sometimes', 'integer', 'min:1', 'max:5'],
            'fetch_all' => ['sometimes', 'boolean'],
            'start_date' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'end_date' => ['sometimes', 'nullable', 'date_format:Y-m-d', 'after_or_equal:start_date'],
        ]);

        try {
            if (! empty($validated['shop_connection_id'])) {
                $connection = MarketplaceShopConnection::query()
                    ->where('is_active', true)
                    ->findOrFail($validated['shop_connection_id']);
            } elseif (($validated['platform'] ?? null) === MarketplacePlatform::TIKTOK_SHOP) {
                return response()->json([
                    'message' => 'Select a TikTok shop to sync. Add shops with cookies under Marketplace → TikTok Shop.',
                ], 422);
            } else {
                return response()->json([
                    'message' => 'Select a shop to sync.',
                ], 422);
            }

            $startAt = ! empty($validated['start_date'])
                ? \Carbon\Carbon::createFromFormat('Y-m-d', $validated['start_date'])
                : null;
            $endAt = ! empty($validated['end_date'])
                ? \Carbon\Carbon::createFromFormat('Y-m-d', $validated['end_date'])
                : null;

            $result = $this->reviewSync->syncConnection(
                $connection,
                $validated['page_size'] ?? 50,
                $validated['page_token'] ?? null,
                $validated['product_id'] ?? null,
                $validated['min_rating'] ?? null,
                $validated['max_rating'] ?? null,
                array_key_exists('fetch_all', $validated) ? (bool) $validated['fetch_all'] : true,
                $startAt,
                $endAt,
            );
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }

        $created = (int) ($result['created'] ?? 0);
        $updated = (int) ($result['updated'] ?? 0);
        $message = "Synced {$result['synced']} review(s)";
        if ($created || $updated) {
            $message .= " ({$created} new, {$updated} updated)";
        }
        $message .= '.';

        return response()->json([
            'message' => $message,
            'sync' => $result,
            'shop_connection_id' => $connection->id,
        ]);
    }

    public function reply(Request $request, int $id): JsonResponse
    {
        $this->ensurePermission($request->user(), 'reviews.manage');

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
