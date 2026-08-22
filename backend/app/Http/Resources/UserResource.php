<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\HasLegacyDates;
use App\Support\Permissions;
use App\Support\StoragePath;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    use HasLegacyDates;

    public function toArray(Request $request): array
    {
        $permissions = $this->resource->getPermissions();

        return $this->withLegacyDates([
            'id' => (string) $this->id,
            'email' => $this->email,
            'nexus_sso_id' => $this->nexus_sso_id,
            'full_name' => $this->full_name ?? $this->name,
            'avatar_url' => StoragePath::resolveAvatarUrl($this->avatar_url),
            'phone' => $this->phone,
            'role_id' => $this->role_id ? (string) $this->role_id : null,
            'role_label' => $this->resource->getRoleLabel(),
            'status' => $this->status,
            'approval_status' => $this->approval_status,
            'departments' => DepartmentResource::collection($this->whenLoaded('departments')),
            'department_ids' => $this->whenLoaded(
                'departments',
                fn () => $this->departments->pluck('id')->map(fn ($id) => (string) $id)->values()->all(),
            ),
            'accessible_department_ids' => collect($this->resource->accessibleDepartmentIds())
                ->map(fn ($id) => (string) $id)
                ->values()
                ->all(),
            'teams' => TeamResource::collection($this->whenLoaded('teams')),
            'team_ids' => $this->whenLoaded(
                'teams',
                fn () => $this->teams->pluck('id')->map(fn ($id) => (string) $id)->values()->all(),
            ),
            'led_team_ids' => $this->whenLoaded(
                'ledTeams',
                fn () => $this->ledTeams
                    ->filter(fn ($team) => $team->is_active)
                    ->pluck('id')
                    ->map(fn ($id) => (string) $id)
                    ->values()
                    ->all(),
            ),
            'led_team_member_ids' => $this->when(
                $this->relationLoaded('ledTeams'),
                fn () => collect($this->resource->ledTeamMemberIds())
                    ->map(fn ($id) => (string) $id)
                    ->values()
                    ->all(),
            ),
            'is_team_lead' => $this->when(
                $this->relationLoaded('ledTeams'),
                fn () => $this->resource->isTeamLead(),
            ),
            'must_change_password' => $this->must_change_password,
            'is_admin' => $this->resource->isAdmin(),
            'permissions' => $permissions === '*' ? Permissions::allKeys() : $permissions,
            'default_page' => $this->resource->getDefaultPage(),
            'complaint_visibility' => $this->resource->getComplaintVisibility(),
        ], $this->resource);
    }
}
