<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TeamResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'name' => $this->name,
            'department_id' => $this->department_id ? (string) $this->department_id : null,
            'department' => $this->whenLoaded('department', fn () => $this->department?->name),
            'lead_user_id' => $this->lead_user_id ? (string) $this->lead_user_id : null,
            'lead' => $this->whenLoaded('lead', fn () => $this->lead ? [
                'id' => (string) $this->lead->id,
                'full_name' => $this->lead->full_name ?? $this->lead->name,
                'email' => $this->lead->email,
            ] : null),
            'members' => $this->whenLoaded('users', fn () => $this->users->map(fn ($user) => [
                'id' => (string) $user->id,
                'full_name' => $user->full_name ?? $user->name,
                'email' => $user->email,
            ])->values()->all()),
            'member_ids' => $this->whenLoaded(
                'users',
                fn () => $this->users->pluck('id')->map(fn ($id) => (string) $id)->values()->all(),
            ),
            'is_active' => $this->is_active,
            'sort_order' => $this->sort_order,
        ];
    }
}
