<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\AppliesEntityQueries;
use App\Http\Controllers\Concerns\AuthorizesPermissions;
use App\Http\Controllers\Concerns\ScopesComplaintVisibility;
use App\Http\Controllers\Controller;
use App\Http\Resources\ComplaintResource;
use App\Models\Complaint;
use App\Services\ComplaintAffectedProductService;
use App\Services\ComplaintNotificationService;
use App\Services\ComplaintRoutingService;
use App\Services\OrderSourceService;
use App\Services\OutgoingWebhookService;
use App\Services\PreResolvedComplaintService;
use App\Services\TicketIdGenerator;
use App\Support\ComplaintInput;
use App\Support\StoragePath;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

class ComplaintController extends Controller
{
    use AppliesEntityQueries, AuthorizesPermissions, ScopesComplaintVisibility;

    public function __construct(
        private TicketIdGenerator $ticketIdGenerator,
        private ComplaintAffectedProductService $affectedProductService,
        private OutgoingWebhookService $outgoingWebhook,
        private ComplaintNotificationService $complaintNotifications,
        private ComplaintRoutingService $complaintRouting,
        private PreResolvedComplaintService $preResolvedComplaints,
        private OrderSourceService $orderSources,
    ) {}

    public function createFormOptions(Request $request): JsonResponse
    {
        $this->ensurePermission($request->user(), 'complaints.create');

        return response()->json([
            'pre_resolved' => $this->preResolvedComplaints->getPublicSettings(),
            'order_sources' => $this->orderSources->getSources(),
        ]);
    }

    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Complaint::query()->with($this->complaintRelations());

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

        $this->applyFilters($query, $request->except(['sort', 'limit', 'search']));
        $this->applySort($query, $request->query('sort', '-created_date'));

        if ($limit = $request->integer('limit')) {
            $query->limit($limit);
        }

        return ComplaintResource::collection($query->get());
    }

    public function store(Request $request): ComplaintResource
    {
        $this->ensurePermission($request->user(), 'complaints.create');

        $preResolved = $request->boolean('pre_resolved');

        $data = $request->validate([
            'customer_name' => ['required', 'string', 'max:255'],
            'customer_phone' => ['nullable', 'string', 'max:50'],
            'order_number' => ['nullable', 'string', 'max:255'],
            'order_source' => ['nullable', 'string', 'max:255'],
            'purchase_date' => ['required', 'date'],
            'batch_number' => ['nullable', 'string', 'max:255'],
            'product_id' => ['required_without_all:product_name,affected_products', 'integer', 'exists:products,id'],
            'product_name' => ['required_without_all:product_id,affected_products', 'string', 'max:255'],
            'quantity_affected' => ['nullable', 'integer', 'min:1'],
            'unit_of_measurement_id' => ['nullable', 'integer', 'exists:units_of_measurement,id'],
            'affected_products' => ['nullable', 'array', 'min:1'],
            'affected_products.*.product_id' => ['required_without:affected_products.*.product_name', 'integer', 'exists:products,id'],
            'affected_products.*.product_name' => ['required_without:affected_products.*.product_id', 'string', 'max:255'],
            'affected_products.*.batch_number' => ['nullable', 'string', 'max:255'],
            'affected_products.*.quantity_affected' => ['nullable', 'integer', 'min:1'],
            'affected_products.*.unit_of_measurement_id' => ['nullable', 'integer', 'exists:units_of_measurement,id'],
            'affected_products.*.batch_entries' => ['nullable', 'array'],
            'affected_products.*.batch_entries.*.batch_number' => ['nullable', 'string', 'max:255'],
            'affected_products.*.batch_entries.*.quantity_affected' => ['nullable', 'integer', 'min:1'],
            'affected_products.*.batch_entries.*.unit_of_measurement_id' => ['nullable', 'integer', 'exists:units_of_measurement,id'],
            'affected_products.*.batch_numbers' => ['nullable', 'array'],
            'affected_products.*.batch_numbers.*' => ['nullable', 'string', 'max:255'],
            'complaint_type_id' => ['required', 'integer', 'exists:complaint_types,id'],
            'description' => ['required', 'string'],
            'proof_files' => ['nullable', 'array'],
            'closure_proof_files' => ['nullable', 'array'],
            'closure_proof_files.*.path' => ['required_with:closure_proof_files', 'string'],
            'closure_proof_files.*.type' => ['nullable', 'string', 'in:delivery,customer_conversation,vendor_screenshot,other'],
            'closure_proof_files.*.name' => ['nullable', 'string', 'max:255'],
            'closure_proof_notes' => ['nullable', 'string'],
            'courier_id' => ['nullable', 'integer', 'exists:couriers,id'],
            'tracking_number' => ['required', 'string', 'max:255'],
            'replacement_tracking_number' => ['nullable', 'string', 'max:255'],
            'priority_id' => ['nullable', 'integer', 'exists:priorities,id'],
            'status_id' => ['nullable', 'integer', 'exists:complaint_statuses,id'],
            'status' => ['nullable', 'string', 'max:255'],
            'assigned_department_id' => ['nullable', 'integer', 'exists:departments,id'],
            'assigned_user_id' => ['nullable', 'integer', 'exists:users,id'],
            'resolution_notes' => ['nullable', 'string'],
            'sla_deadline' => ['nullable', 'date'],
            'pre_resolved' => ['sometimes', 'boolean'],
        ]);

        $affectedProducts = ComplaintInput::pullAffectedProducts($data);

        if ($affectedProducts === []) {
            abort(422, 'At least one affected product is required.');
        }

        $hadExplicitDepartment = array_key_exists('assigned_department_id', $data)
            && $data['assigned_department_id'] !== null;
        $hadExplicitStatus = array_key_exists('status_id', $data)
            || array_key_exists('status', $data);

        $data = ComplaintInput::normalizeForCreate($data);
        $data = $this->complaintRouting->applyToCreate($data, [
            'had_explicit_department' => $hadExplicitDepartment,
            'had_explicit_status' => $hadExplicitStatus || $preResolved,
        ]);

        if ($preResolved) {
            if (isset($data['closure_proof_files'])) {
                $data['closure_proof_files'] = StoragePath::normalizeClosureProofMany($data['closure_proof_files']);
            }

            $this->preResolvedComplaints->ensureRequirements($data);
            $data = $this->preResolvedComplaints->applyToCreate($data);
            $data = ComplaintInput::applyStatusTimestampsOnCreate($data);
        }

        if (empty($data['assigned_department_id'])) {
            $customerServiceId = DB::table('departments')->where('name', 'Customer Service')->value('id');
            if ($customerServiceId) {
                $data['assigned_department_id'] = (int) $customerServiceId;
            }
        }

        $data['ticket_id'] = $this->ticketIdGenerator->generate();

        if (! isset($data['assigned_user_id']) && $request->user()) {
            $data['assigned_user_id'] = $request->user()->id;
        }

        if (isset($data['proof_files'])) {
            $data['proof_files'] = StoragePath::normalizeMany($data['proof_files']);
        }

        $complaint = Complaint::create($data);
        $this->affectedProductService->sync($complaint, $affectedProducts);

        if ($complaint->assigned_user_id) {
            $complaint->assignedUsers()->syncWithoutDetaching([$complaint->assigned_user_id]);
        }

        $complaint = $complaint->load($this->complaintRelations());
        $this->outgoingWebhook->dispatchComplaint('complaint.created', $complaint);

        return new ComplaintResource($complaint);
    }

    public function show(Request $request, string $id): ComplaintResource
    {
        $complaint = Complaint::with($this->complaintRelations())->findOrFail($id);

        if ($user = $request->user()) {
            $this->ensureCanViewComplaint($user, $complaint);
        }

        return new ComplaintResource($complaint);
    }

    public function update(Request $request, string $id): ComplaintResource
    {
        $complaint = Complaint::with('complaintStatus')->findOrFail($id);
        $this->ensureCanViewComplaint($request->user(), $complaint);

        $oldStatusName = $complaint->complaintStatus?->name ?? '';

        $data = $request->validate([
            'customer_name' => ['sometimes', 'string', 'max:255'],
            'customer_phone' => ['nullable', 'string', 'max:50'],
            'order_number' => ['nullable', 'string', 'max:255'],
            'order_source' => ['nullable', 'string', 'max:255'],
            'purchase_date' => ['sometimes', 'required', 'date'],
            'batch_number' => ['nullable', 'string', 'max:255'],
            'product_id' => ['sometimes', 'integer', 'exists:products,id'],
            'product_name' => ['sometimes', 'string', 'max:255'],
            'quantity_affected' => ['nullable', 'integer', 'min:1'],
            'unit_of_measurement_id' => ['nullable', 'integer', 'exists:units_of_measurement,id'],
            'affected_products' => ['sometimes', 'array', 'min:1'],
            'affected_products.*.product_id' => ['required_without:affected_products.*.product_name', 'integer', 'exists:products,id'],
            'affected_products.*.product_name' => ['required_without:affected_products.*.product_id', 'string', 'max:255'],
            'affected_products.*.batch_number' => ['nullable', 'string', 'max:255'],
            'affected_products.*.quantity_affected' => ['nullable', 'integer', 'min:1'],
            'affected_products.*.unit_of_measurement_id' => ['nullable', 'integer', 'exists:units_of_measurement,id'],
            'affected_products.*.batch_entries' => ['nullable', 'array'],
            'affected_products.*.batch_entries.*.batch_number' => ['nullable', 'string', 'max:255'],
            'affected_products.*.batch_entries.*.quantity_affected' => ['nullable', 'integer', 'min:1'],
            'affected_products.*.batch_entries.*.unit_of_measurement_id' => ['nullable', 'integer', 'exists:units_of_measurement,id'],
            'affected_products.*.batch_numbers' => ['nullable', 'array'],
            'affected_products.*.batch_numbers.*' => ['nullable', 'string', 'max:255'],
            'complaint_type_id' => ['sometimes', 'integer', 'exists:complaint_types,id'],
            'description' => ['sometimes', 'string'],
            'proof_files' => ['nullable', 'array'],
            'closure_proof_files' => ['nullable', 'array'],
            'closure_proof_files.*.path' => ['required_with:closure_proof_files', 'string'],
            'closure_proof_files.*.type' => ['nullable', 'string', 'in:delivery,customer_conversation,vendor_screenshot,other'],
            'closure_proof_files.*.name' => ['nullable', 'string', 'max:255'],
            'closure_proof_notes' => ['nullable', 'string'],
            'courier_id' => ['nullable', 'integer', 'exists:couriers,id'],
            'tracking_number' => ['nullable', 'string', 'max:255'],
            'replacement_tracking_number' => ['nullable', 'string', 'max:255'],
            'priority_id' => ['nullable', 'integer', 'exists:priorities,id'],
            'status_id' => ['nullable', 'integer', 'exists:complaint_statuses,id'],
            'status' => ['nullable', 'string', 'max:255'],
            'assigned_department_id' => ['nullable', 'integer', 'exists:departments,id'],
            'assigned_user_id' => ['nullable', 'integer', 'exists:users,id'],
            'resolution_notes' => ['nullable', 'string'],
            'sla_deadline' => ['nullable', 'date'],
            'sla_paused_at' => ['nullable', 'date'],
            'sla_paused_duration' => ['nullable', 'integer', 'min:0'],
            'first_response_at' => ['nullable', 'date'],
            'resolved_at' => ['nullable', 'date'],
            'delivered_at' => ['nullable', 'date'],
            'closed_at' => ['nullable', 'date'],
        ]);

        if (isset($data['proof_files'])) {
            $data['proof_files'] = StoragePath::normalizeMany($data['proof_files']);
        }

        if (isset($data['closure_proof_files'])) {
            $data['closure_proof_files'] = StoragePath::normalizeClosureProofMany($data['closure_proof_files']);
        }

        $affectedProducts = null;
        if ($request->hasAny([
            'affected_products',
            'product_id',
            'product_name',
            'batch_number',
            'quantity_affected',
            'unit_of_measurement_id',
        ])) {
            $affectedProducts = ComplaintInput::pullAffectedProducts($data);

            if ($affectedProducts === []) {
                abort(422, 'At least one affected product is required.');
            }
        }

        $data = ComplaintInput::normalizeForUpdate($data);
        ComplaintInput::ensureClosureProofForClose($complaint, $data);
        $data = ComplaintInput::applyStatusTimestamps($complaint, $data);

        $this->ensureComplaintUpdatePermissions($request->user(), $data);

        if (array_key_exists('assigned_user_id', $data)) {
            $assigneeId = $data['assigned_user_id'];
            unset($data['assigned_user_id']);

            if ($assigneeId) {
                $complaint->assignedUsers()->syncWithoutDetaching([$assigneeId]);
            }
            $complaint->syncPrimaryAssignee();
        }

        $complaint->update($data);

        if ($affectedProducts !== null) {
            $this->affectedProductService->sync($complaint, $affectedProducts);
        }

        $complaint = $complaint->fresh()->load($this->complaintRelations());
        $newStatusName = $complaint->complaintStatus?->name ?? '';

        if ($oldStatusName !== $newStatusName) {
            $this->complaintNotifications->notifyStatusChanged(
                $complaint,
                $request->user(),
                $oldStatusName,
                $newStatusName,
            );
        }

        $this->outgoingWebhook->dispatchComplaint(
            $oldStatusName !== $newStatusName ? 'complaint.status_changed' : 'complaint.updated',
            $complaint,
        );

        return new ComplaintResource($complaint);
    }

    public function assignAgent(Request $request, string $id): ComplaintResource
    {
        $this->ensurePermission($request->user(), 'complaints.assign');

        $complaint = Complaint::findOrFail($id);
        $this->ensureCanViewComplaint($request->user(), $complaint);

        $data = $request->validate([
            'user_id' => ['required', 'integer', 'exists:users,id'],
        ]);

        $complaint->assignedUsers()->syncWithoutDetaching([$data['user_id']]);
        $complaint->syncPrimaryAssignee();

        $complaint = $complaint->fresh()->load($this->complaintRelations());
        $assignee = $complaint->assignedUsers->firstWhere('id', (int) $data['user_id']);

        if ($assignee) {
            $this->complaintNotifications->notifyTicketAssigned($complaint, $assignee, $request->user());
        }

        return new ComplaintResource($complaint);
    }

    public function removeAgent(Request $request, string $id, string $userId): ComplaintResource
    {
        $this->ensurePermission($request->user(), 'complaints.assign');

        $complaint = Complaint::findOrFail($id);
        $this->ensureCanViewComplaint($request->user(), $complaint);

        $complaint->assignedUsers()->detach($userId);
        $complaint->syncPrimaryAssignee();

        return new ComplaintResource($complaint->fresh()->load($this->complaintRelations()));
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $this->ensurePermission($request->user(), 'complaints.delete');

        $complaint = Complaint::findOrFail($id);
        $this->ensureCanViewComplaint($request->user(), $complaint);

        $complaint->delete();

        return response()->json(['message' => 'Deleted successfully.']);
    }

    /** @return list<string> */
    private function complaintRelations(): array
    {
        return [
            'assignedDepartment',
            'assignedUser',
            'assignedUsers',
            'complaintStatus',
            'complaintType',
            'courier',
            'priority',
            'affectedProducts.product',
            'affectedProducts.unitOfMeasurement',
        ];
    }
}
