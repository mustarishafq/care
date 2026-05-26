<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\AppliesEntityQueries;
use App\Http\Controllers\Concerns\AuthorizesPermissions;
use App\Http\Controllers\Controller;
use App\Http\Resources\ComplaintResource;
use App\Models\Complaint;
use App\Services\TicketIdGenerator;
use App\Support\ComplaintInput;
use App\Support\StoragePath;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ComplaintController extends Controller
{
    use AppliesEntityQueries, AuthorizesPermissions;

    public function __construct(private TicketIdGenerator $ticketIdGenerator) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Complaint::query()->with($this->complaintRelations());
        $this->applyFilters($query, $request->except(['sort', 'limit']));
        $this->applySort($query, $request->query('sort', '-created_date'));

        if ($limit = $request->integer('limit')) {
            $query->limit($limit);
        }

        return ComplaintResource::collection($query->get());
    }

    public function store(Request $request): ComplaintResource
    {
        $this->ensurePermission($request->user(), 'complaints.create');

        $data = $request->validate([
            'customer_name' => ['required', 'string', 'max:255'],
            'customer_phone' => ['nullable', 'string', 'max:50'],
            'order_number' => ['required', 'string', 'max:255'],
            'product_id' => ['required_without:product_name', 'integer', 'exists:products,id'],
            'product_name' => ['required_without:product_id', 'string', 'max:255'],
            'quantity_affected' => ['nullable', 'integer', 'min:1'],
            'complaint_type_id' => ['required', 'integer', 'exists:complaint_types,id'],
            'description' => ['required', 'string'],
            'proof_files' => ['nullable', 'array'],
            'courier_id' => ['nullable', 'integer', 'exists:couriers,id'],
            'tracking_number' => ['nullable', 'string', 'max:255'],
            'replacement_tracking_number' => ['nullable', 'string', 'max:255'],
            'priority_id' => ['nullable', 'integer', 'exists:priorities,id'],
            'status_id' => ['nullable', 'integer', 'exists:complaint_statuses,id'],
            'status' => ['nullable', 'string', 'max:255'],
            'assigned_department_id' => ['nullable', 'integer', 'exists:departments,id'],
            'assigned_user' => ['nullable', 'string', 'max:255'],
            'assigned_user_name' => ['nullable', 'string', 'max:255'],
            'resolution_notes' => ['nullable', 'string'],
            'sla_deadline' => ['nullable', 'date'],
        ]);

        $data = ComplaintInput::normalizeForCreate($data);
        $data['ticket_id'] = $this->ticketIdGenerator->generate();

        if (isset($data['proof_files'])) {
            $data['proof_files'] = StoragePath::normalizeMany($data['proof_files']);
        }

        $complaint = Complaint::create($data);

        return new ComplaintResource($complaint->load($this->complaintRelations()));
    }

    public function show(string $id): ComplaintResource
    {
        return new ComplaintResource(Complaint::with($this->complaintRelations())->findOrFail($id));
    }

    public function update(Request $request, string $id): ComplaintResource
    {
        $complaint = Complaint::findOrFail($id);

        $data = $request->validate([
            'customer_name' => ['sometimes', 'string', 'max:255'],
            'customer_phone' => ['nullable', 'string', 'max:50'],
            'order_number' => ['sometimes', 'string', 'max:255'],
            'product_id' => ['sometimes', 'integer', 'exists:products,id'],
            'product_name' => ['sometimes', 'string', 'max:255'],
            'quantity_affected' => ['nullable', 'integer', 'min:1'],
            'complaint_type_id' => ['sometimes', 'integer', 'exists:complaint_types,id'],
            'description' => ['sometimes', 'string'],
            'proof_files' => ['nullable', 'array'],
            'courier_id' => ['nullable', 'integer', 'exists:couriers,id'],
            'tracking_number' => ['nullable', 'string', 'max:255'],
            'replacement_tracking_number' => ['nullable', 'string', 'max:255'],
            'priority_id' => ['nullable', 'integer', 'exists:priorities,id'],
            'status_id' => ['nullable', 'integer', 'exists:complaint_statuses,id'],
            'status' => ['nullable', 'string', 'max:255'],
            'assigned_department_id' => ['nullable', 'integer', 'exists:departments,id'],
            'assigned_user' => ['nullable', 'string', 'max:255'],
            'assigned_user_name' => ['nullable', 'string', 'max:255'],
            'resolution_notes' => ['nullable', 'string'],
            'sla_deadline' => ['nullable', 'date'],
            'sla_paused_at' => ['nullable', 'date'],
            'sla_paused_duration' => ['nullable', 'integer', 'min:0'],
            'first_response_at' => ['nullable', 'date'],
            'resolved_at' => ['nullable', 'date'],
            'closed_at' => ['nullable', 'date'],
        ]);

        if (isset($data['proof_files'])) {
            $data['proof_files'] = StoragePath::normalizeMany($data['proof_files']);
        }

        $data = ComplaintInput::normalizeForUpdate($data);

        $this->ensureComplaintUpdatePermissions($request->user(), $data);

        $complaint->update($data);

        return new ComplaintResource($complaint->fresh()->load($this->complaintRelations()));
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $this->ensurePermission($request->user(), 'complaints.delete');

        Complaint::findOrFail($id)->delete();

        return response()->json(['message' => 'Deleted successfully.']);
    }

    /** @return list<string> */
    private function complaintRelations(): array
    {
        return ['assignedDepartment', 'complaintStatus', 'complaintType', 'courier', 'priority', 'product'];
    }
}
