<?php

namespace App\Http\Controllers\Mcp\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Mcp\V1\IndexComplaintStatusesRequest;
use App\Http\Resources\ComplaintStatusResource;
use App\Services\Mcp\ComplaintStatusService;
use App\Support\McpResponse;
use Illuminate\Http\JsonResponse;

class ComplaintStatusController extends Controller
{
    public function __construct(
        private ComplaintStatusService $statuses,
    ) {}

    public function index(IndexComplaintStatusesRequest $request): JsonResponse
    {
        $paginator = $this->statuses->paginate($request);

        return McpResponse::paginated(
            $paginator,
            ComplaintStatusResource::collection($paginator->items())
        );
    }
}
