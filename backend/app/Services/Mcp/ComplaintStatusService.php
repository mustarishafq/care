<?php

namespace App\Services\Mcp;

use App\Models\ComplaintStatus;
use App\Services\ComplaintTrackingUpdateService;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\Request;

class ComplaintStatusService
{
    /** @return LengthAwarePaginator<int, ComplaintStatus> */
    public function paginate(Request $request): LengthAwarePaginator
    {
        $query = ComplaintStatus::query()->where('is_active', true);

        ComplaintTrackingUpdateService::applyFilters($query, $request->except(['sort_by', 'sort_order', 'page', 'per_page']));

        $sortBy = $request->query('sort_by', 'sort_order');
        $sortOrder = $request->query('sort_order', 'asc');
        ComplaintTrackingUpdateService::applySort($query, $sortBy, $sortOrder);

        $perPage = min(max((int) $request->query('per_page', 50), 1), 200);

        return $query->paginate($perPage, ['*'], 'page', (int) $request->query('page', 1));
    }
}
