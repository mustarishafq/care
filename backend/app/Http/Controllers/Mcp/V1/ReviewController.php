<?php

namespace App\Http\Controllers\Mcp\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Mcp\V1\IndexReviewsRequest;
use App\Http\Requests\Mcp\V1\ReplyToReviewRequest;
use App\Http\Requests\Mcp\V1\ShowReviewRequest;
use App\Http\Resources\MarketplaceProductReviewResource;
use App\Services\Mcp\ReviewService;
use App\Support\McpResponse;
use Illuminate\Http\JsonResponse;
use RuntimeException;

class ReviewController extends Controller
{
    public function __construct(
        private ReviewService $reviews,
    ) {}

    public function index(IndexReviewsRequest $request): JsonResponse
    {
        $paginator = $this->reviews->paginate($request);
        $stats = $this->reviews->stats($request);

        return response()->json([
            'success' => true,
            'message' => null,
            'data' => MarketplaceProductReviewResource::collection($paginator->items())->resolve(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'stats' => $stats,
            ],
        ]);
    }

    public function show(ShowReviewRequest $request, string $id): JsonResponse
    {
        $resource = $this->reviews->find($id);

        return McpResponse::success($resource->resolve());
    }

    public function reply(ReplyToReviewRequest $request, string $id): JsonResponse
    {
        try {
            $resource = $this->reviews->reply($id, $request->validated('content'));
        } catch (RuntimeException $exception) {
            return McpResponse::error($exception->getMessage(), 422);
        }

        return McpResponse::success(
            $resource->resolve(),
            null,
            'Reply posted to review.',
        );
    }
}
