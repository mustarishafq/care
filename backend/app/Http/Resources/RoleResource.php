<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\HasLegacyDates;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class RoleResource extends JsonResource
{
    use HasLegacyDates;

    public function toArray(Request $request): array
    {
        return $this->withLegacyDates([
            'id' => (string) $this->id,
            'slug' => $this->slug,
            'name' => $this->name,
            'description' => $this->description,
            'permissions' => $this->permissions ?? [],
            'is_active' => $this->is_active,
            'is_system' => $this->is_system,
            'is_admin' => $this->is_admin,
            'sort_order' => $this->sort_order,
        ], $this->resource);
    }
}
