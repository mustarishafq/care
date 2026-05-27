<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\HasLegacyDates;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TicketActivityResource extends JsonResource
{
    use HasLegacyDates;

    public function toArray(Request $request): array
    {
        return $this->withLegacyDates([
            'id' => (string) $this->id,
            'complaint_id' => $this->complaint_id ? (string) $this->complaint_id : null,
            'action_type' => $this->action_type,
            'description' => $this->description,
            'old_value' => $this->old_value,
            'new_value' => $this->new_value,
            'user_id' => $this->user_id ? (string) $this->user_id : null,
            'user_email' => $this->user?->email,
            'user_name' => $this->user?->full_name ?? $this->user?->name,
        ], $this->resource);
    }
}
