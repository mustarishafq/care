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
            'recipient_email' => $this->recipient_email,
            'title' => $this->title,
            'message' => $this->message,
            'type' => $this->type,
            'complaint_id' => $this->complaint_id,
            'is_read' => $this->is_read,
        ], $this->resource);
    }
}
