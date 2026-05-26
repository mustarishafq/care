<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\HasLegacyDates;
use App\Support\StoragePath;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ComplaintResource extends JsonResource
{
    use HasLegacyDates;

    public function toArray(Request $request): array
    {
        return $this->withLegacyDates([
            'id' => (string) $this->id,
            'ticket_id' => $this->ticket_id,
            'customer_name' => $this->customer_name,
            'customer_phone' => $this->customer_phone,
            'order_number' => $this->order_number,
            'product_id' => $this->product_id ? (string) $this->product_id : null,
            'product_name' => $this->product?->name,
            'sku' => $this->product?->sku,
            'quantity_affected' => $this->quantity_affected,
            'complaint_type_id' => $this->complaint_type_id ? (string) $this->complaint_type_id : null,
            'complaint_type' => $this->complaintType?->name,
            'description' => $this->description,
            'proof_files' => StoragePath::urlMany($this->proof_files),
            'courier_id' => $this->courier_id ? (string) $this->courier_id : null,
            'courier_name' => $this->courier?->name,
            'tracking_number' => $this->tracking_number,
            'replacement_tracking_number' => $this->replacement_tracking_number,
            'priority_id' => $this->priority_id ? (string) $this->priority_id : null,
            'priority' => $this->priority?->name,
            'priority_sla_hours' => $this->priority?->sla_hours,
            'status_id' => $this->status_id ? (string) $this->status_id : null,
            'status' => $this->complaintStatus?->name,
            'assigned_department_id' => $this->assigned_department_id ? (string) $this->assigned_department_id : null,
            'assigned_department' => $this->assignedDepartment?->name,
            'assigned_user' => $this->assigned_user,
            'assigned_user_name' => $this->assigned_user_name,
            'resolution_notes' => $this->resolution_notes,
            'sla_deadline' => $this->sla_deadline?->toIso8601String(),
            'sla_paused_at' => $this->sla_paused_at?->toIso8601String(),
            'sla_paused_duration' => $this->sla_paused_duration,
            'first_response_at' => $this->first_response_at?->toIso8601String(),
            'resolved_at' => $this->resolved_at?->toIso8601String(),
            'closed_at' => $this->closed_at?->toIso8601String(),
        ], $this->resource);
    }
}
