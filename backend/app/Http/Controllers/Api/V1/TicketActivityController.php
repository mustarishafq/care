<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\AppliesEntityQueries;
use App\Http\Controllers\Concerns\AuthorizesPermissions;
use App\Http\Controllers\Controller;
use App\Http\Resources\TicketActivityResource;
use App\Models\TicketActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class TicketActivityController extends Controller
{
    use AppliesEntityQueries, AuthorizesPermissions;

    public function index(Request $request): AnonymousResourceCollection
    {
        $this->ensurePermission($request->user(), 'complaints.view');

        $query = TicketActivity::query();
        $this->applyFilters($query, $request->except(['sort', 'limit']));
        $this->applySort($query, $request->query('sort', '-created_date'));

        if ($limit = $request->integer('limit')) {
            $query->limit($limit);
        }

        return TicketActivityResource::collection($query->get());
    }

    public function store(Request $request): TicketActivityResource
    {
        $data = $request->validate([
            'complaint_id' => ['required', 'string'],
            'action_type' => ['required', 'string', 'max:255'],
            'description' => ['required', 'string'],
            'old_value' => ['nullable', 'string'],
            'new_value' => ['nullable', 'string'],
            'user_email' => ['nullable', 'string', 'max:255'],
            'user_name' => ['nullable', 'string', 'max:255'],
        ]);

        $this->ensureTicketActivityPermission($request->user(), $data['action_type']);

        $activity = TicketActivity::create($data);

        return new TicketActivityResource($activity);
    }

    public function update(Request $request, string $id): TicketActivityResource
    {
        $this->ensurePermission($request->user(), 'complaints.edit');

        $activity = TicketActivity::findOrFail($id);
        $activity->update($request->validate([
            'description' => ['sometimes', 'string'],
            'old_value' => ['nullable', 'string'],
            'new_value' => ['nullable', 'string'],
        ]));

        return new TicketActivityResource($activity->fresh());
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $this->ensurePermission($request->user(), 'complaints.edit');

        TicketActivity::findOrFail($id)->delete();

        return response()->json(['message' => 'Deleted successfully.']);
    }

    private function ensureTicketActivityPermission(\App\Models\User $user, string $actionType): void
    {
        $permission = match ($actionType) {
            'status_changed' => 'complaints.change_status',
            'assigned' => 'complaints.assign',
            'note_added' => 'complaints.add_notes',
            default => 'complaints.edit',
        };

        $this->ensurePermission($user, $permission);
    }
}
