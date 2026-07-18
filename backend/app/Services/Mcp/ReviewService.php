<?php

namespace App\Services\Mcp;

use App\Http\Resources\MarketplaceProductReviewResource;
use App\Models\MarketplaceProductReview;
use App\Services\Marketplace\MarketplaceReviewSyncService;
use Carbon\Carbon;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\Request;

class ReviewService
{
    public function __construct(
        private MarketplaceReviewSyncService $reviewSync,
    ) {}

    /** @return LengthAwarePaginator<int, MarketplaceProductReview> */
    public function paginate(Request $request): LengthAwarePaginator
    {
        [$startAt, $endAt] = $this->dateRange($request);
        $productName = $this->trimmedQuery($request, 'product_name');
        $reviewerName = $this->trimmedQuery($request, 'reviewer_name');
        $perPage = min(max((int) $request->query('per_page', 50), 1), 200);

        return $this->reviewSync->listAllReviews(
            $request->query('platform'),
            $request->query('shop_connection_id') !== null
                ? (int) $request->query('shop_connection_id')
                : null,
            $request->query('min_rating') !== null
                ? (int) $request->query('min_rating')
                : null,
            $request->query('max_rating') !== null
                ? (int) $request->query('max_rating')
                : null,
            $perPage,
            $request->query('reply_status'),
            (int) $request->query('page', 1),
            $startAt,
            $endAt,
            $productName,
            $reviewerName,
        );
    }

    /**
     * Aggregate counts for the same filters as the review list.
     *
     * @return array{total: int, unreplied: int, replied: int, low: int}
     */
    public function stats(Request $request): array
    {
        [$startAt, $endAt] = $this->dateRange($request);

        return $this->reviewSync->reviewStats(
            $request->query('platform'),
            $request->query('shop_connection_id') !== null
                ? (int) $request->query('shop_connection_id')
                : null,
            $request->query('min_rating') !== null
                ? (int) $request->query('min_rating')
                : null,
            $request->query('max_rating') !== null
                ? (int) $request->query('max_rating')
                : null,
            $request->query('reply_status'),
            $startAt,
            $endAt,
            $this->trimmedQuery($request, 'product_name'),
            $this->trimmedQuery($request, 'reviewer_name'),
        );
    }

    public function find(string $id): MarketplaceProductReviewResource
    {
        $review = MarketplaceProductReview::query()
            ->with('shopConnection')
            ->findOrFail($id);

        return new MarketplaceProductReviewResource($review);
    }

    public function reply(string $id, string $content): MarketplaceProductReviewResource
    {
        $review = MarketplaceProductReview::query()->findOrFail($id);
        $updated = $this->reviewSync->replyToReview($review, $content);

        return new MarketplaceProductReviewResource($updated->load('shopConnection'));
    }

    /** @return array{0: ?Carbon, 1: ?Carbon} */
    private function dateRange(Request $request): array
    {
        $startAt = $request->query('start_date')
            ? Carbon::createFromFormat('Y-m-d', (string) $request->query('start_date'))
            : null;
        $endAt = $request->query('end_date')
            ? Carbon::createFromFormat('Y-m-d', (string) $request->query('end_date'))
            : null;

        return [$startAt, $endAt];
    }

    private function trimmedQuery(Request $request, string $key): ?string
    {
        $value = $request->query($key);

        if ($value === null) {
            return null;
        }

        $trimmed = trim((string) $value);

        return $trimmed === '' ? null : $trimmed;
    }
}
