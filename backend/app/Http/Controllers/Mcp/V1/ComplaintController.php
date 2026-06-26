<?php

namespace App\Http\Controllers\Mcp\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Mcp\V1\IndexComplaintsRequest;
use App\Http\Requests\Mcp\V1\ShowComplaintRequest;
use App\Http\Resources\ComplaintResource;
use App\Services\Mcp\ComplaintService;
use App\Support\McpResponse;
use Illuminate\Http\JsonResponse;

class ComplaintController extends Controller
{
    public function __construct(
        private ComplaintService $complaints,
    ) {}

    public function index(IndexComplaintsRequest $request): JsonResponse
    {
        $paginator = $this->complaints->paginate($request);

        return McpResponse::paginated(
            $paginator,
            ComplaintResource::collection($paginator->items())
        );
    }

    public function show(ShowComplaintRequest $request, string $id): JsonResponse
    {
        $resource = $this->complaints->findForUser($request, $id);

        return McpResponse::success($resource->resolve());
    }
}
