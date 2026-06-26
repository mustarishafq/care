<?php

namespace App\Http\Controllers\Mcp\V1;

use App\Http\Controllers\Controller;
use App\Mcp\Documentation\McpV1Endpoints;
use App\Support\McpResponse;
use Illuminate\Http\JsonResponse;

class CatalogController extends Controller
{
    public function __invoke(): JsonResponse
    {
        return McpResponse::success(McpV1Endpoints::all());
    }
}
