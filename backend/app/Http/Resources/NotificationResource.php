<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\HasLegacyDates;
use App\Support\NotificationPayload;
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
            'sso_id' => $this->recipient?->nexus_sso_id,
            'title' => $this->title,
            'message' => $this->message,
            'type' => $this->type,
            'severity' => $this->severity ?? NotificationPayload::defaultsForEventType($this->type ?? 'general')['severity'],
            'category' => $this->category ?? NotificationPayload::defaultsForEventType($this->type ?? 'general')['category'],
            'action_url' => $this->action_url ?? NotificationPayload::actionUrlForComplaint($this->complaint_id),
            'complaint_id' => $this->complaint_id ? (string) $this->complaint_id : null,
            'is_read' => $this->is_read,
        ], $this->resource);
    }
}
