<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\AppliesEntityQueries;
use App\Http\Controllers\Concerns\AuthorizesPermissions;
use App\Http\Controllers\Controller;
use App\Http\Resources\TeamResource;
use App\Models\Team;
use App\Models\User;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

class TeamController extends Controller
{
    use AppliesEntityQueries, AuthorizesPermissions;

    public function index(Request $request): AnonymousResourceCollection
    {
        $user = $request->user();
        $this->ensureCanViewTeams($user);

        $query = Team::query()
            ->with(['department', 'lead', 'users'])
            ->where('is_active', true);

        // Non-global managers only see teams they lead (or are members of when viewing).
        if (! $this->canManageAllTeams($user)) {
            $query->where(function ($q) use ($user) {
                $q->where('lead_user_id', $user->id)
                    ->orWhereHas('users', fn ($sub) => $sub->where('users.id', $user->id));
            });
        }

        $this->applyFilters($query, $request->except(['sort', 'limit']));
        $this->applySort($query, $request->query('sort', 'sort_order'));

        if ($limit = $request->integer('limit')) {
            $query->limit($limit);
        }

        return TeamResource::collection($query->get());
    }

    public function store(Request $request): TeamResource
    {
        $user = $request->user();
        $this->ensureCanManageAllTeams($user);

        $data = $request->validate([
            'name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('teams', 'name')->where(fn ($q) => $q->where('department_id', $request->input('department_id'))),
            ],
            'department_id' => ['required', 'integer', 'exists:departments,id'],
            'lead_user_id' => ['nullable', 'integer', 'exists:users,id'],
            'member_ids' => ['nullable', 'array'],
            'member_ids.*' => ['integer', 'exists:users,id'],
            'is_active' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $memberIds = $data['member_ids'] ?? [];
        unset($data['member_ids']);

        $team = Team::create($data);
        $team->syncMembers($memberIds);

        return new TeamResource($team->fresh()->load(['department', 'lead', 'users']));
    }

    public function update(Request $request, string $id): TeamResource
    {
        $user = $request->user();
        $team = Team::findOrFail($id);
        $this->ensureCanManageTeam($user, $team);

        $canManageAll = $this->canManageAllTeams($user);

        $rules = [
            'name' => [
                'sometimes',
                'string',
                'max:255',
                Rule::unique('teams', 'name')
                    ->where(fn ($q) => $q->where(
                        'department_id',
                        $canManageAll && $request->has('department_id')
                            ? $request->input('department_id')
                            : $team->department_id
                    ))
                    ->ignore($team->id),
            ],
            'lead_user_id' => ['nullable', 'integer', 'exists:users,id'],
            'member_ids' => ['nullable', 'array'],
            'member_ids.*' => ['integer', 'exists:users,id'],
            'is_active' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ];

        if ($canManageAll) {
            $rules['department_id'] = ['sometimes', 'integer', 'exists:departments,id'];
        }

        $data = $request->validate($rules);

        $memberIds = array_key_exists('member_ids', $data) ? $data['member_ids'] : null;
        unset($data['member_ids']);

        $team->update($data);

        if ($memberIds !== null) {
            $team->syncMembers($memberIds);
        } elseif (array_key_exists('lead_user_id', $data) && $team->lead_user_id) {
            $team->syncMembers($team->users()->pluck('users.id')->all());
        }

        return new TeamResource($team->fresh()->load(['department', 'lead', 'users']));
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        $team = Team::findOrFail($id);
        $this->ensureCanManageTeam($user, $team);

        $team->update(['is_active' => false]);

        return response()->json(['message' => 'Team deactivated successfully.']);
    }

    private function ensureCanViewTeams(User $user): void
    {
        if ($this->canManageAllTeams($user)
            || $user->hasPermission('teams.view')
            || $user->hasPermission('settings.view')
            || $user->hasPermission('users.view')
            || $user->isTeamLead()
            || $user->teams()->exists()) {
            return;
        }

        $this->ensurePermission($user, 'complaints.view');
    }

    private function canManageAllTeams(User $user): bool
    {
        return $user->hasPermission('teams.manage') || $user->hasPermission('settings.manage');
    }

    private function ensureCanManageAllTeams(User $user): void
    {
        if ($this->canManageAllTeams($user)) {
            return;
        }

        throw new HttpResponseException(response()->json([
            'message' => 'You do not have permission to create teams.',
        ], 403));
    }

    private function ensureCanManageTeam(User $user, Team $team): void
    {
        if ($this->canManageAllTeams($user)) {
            return;
        }

        if ($team->is_active && (int) $team->lead_user_id === (int) $user->id) {
            return;
        }

        throw new HttpResponseException(response()->json([
            'message' => 'You do not have permission to manage this team.',
        ], 403));
    }
}
