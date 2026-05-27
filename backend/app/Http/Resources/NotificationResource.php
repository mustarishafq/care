<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\HasLegacyDates;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class NotificationResource extends JsonResource
{
    use HasLegacyDates;

    public function toArray(Request $request): array
    {
        return $this->withLegacyDates([
            'id' => (string) $this->id,
            'recipient_user_id' => $this->recipient_user_id ? (string) $this->recipient_user_id : null,
            'recipient_email' => $this->recipient?->email,
            'title' => $this->title,
            'message' => $this->message,
            'type' => $this->type,
            'complaint_id' => $this->complaint_id ? (string) $this->complaint_id : null,
            'is_read' => $this->is_read,
        ], $this->resource);
    }
}
