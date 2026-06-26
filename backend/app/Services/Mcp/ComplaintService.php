<?php

namespace App\Services\Mcp;

use App\Http\Controllers\Concerns\ScopesComplaintVisibility;
use App\Http\Resources\ComplaintResource;
use App\Models\Complaint;
use App\Services\ComplaintTrackingUpdateService;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\Request;

class ComplaintService
{
    use ScopesComplaintVisibility;

    /** @return LengthAwarePaginator<int, Complaint> */
    public function paginate(Request $request): LengthAwarePaginator
    {
        $query = Complaint::query()->with(ComplaintTrackingUpdateService::complaintRelations());

        if ($user = $request->user()) {
            $this->applyComplaintVisibilityScope($query, $user);
        }

        if ($search = $request->query('search')) {
            $term = '%'.addcslashes($search, '%_\\').'%';
            $query->where(function ($q) use ($term) {
                $q->where('ticket_id', 'like', $term)
                    ->orWhere('customer_name', 'like', $term)
                    ->orWhere('customer_phone', 'like', $term)
                    ->orWhere('order_number', 'like', $term)
                    ->orWhereHas('affectedProducts.product', function ($productQuery) use ($term) {
                        $productQuery->where('name', 'like', $term)
                            ->orWhere('sku', 'like', $term);
                    });
            });
        }

        ComplaintTrackingUpdateService::applyFilters(
            $query,
            $request->only(['order_number', 'status_id'])
        );

        ComplaintTrackingUpdateService::applySort(
            $query,
            $request->query('sort_by', 'created_date'),
            $request->query('sort_order', 'desc')
        );

        $perPage = min(max((int) $request->query('per_page', 50), 1), 200);

        return $query->paginate($perPage, ['*'], 'page', (int) $request->query('page', 1));
    }

    public function findForUser(Request $request, string $id): ComplaintResource
    {
        $complaint = Complaint::with(ComplaintTrackingUpdateService::complaintRelations())->findOrFail($id);

        if ($user = $request->user()) {
            $this->ensureCanViewComplaint($user, $complaint);
        }

        return new ComplaintResource($complaint);
    }
}
