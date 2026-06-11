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
        $affectedProducts = $this->resolveAffectedProducts();
        $primary = $affectedProducts[0] ?? null;

        return $this->withLegacyDates([
            'id' => (string) $this->id,
            'ticket_id' => $this->ticket_id,
            'customer_name' => $this->customer_name,
            'customer_phone' => $this->customer_phone,
            'order_number' => $this->order_number,
            'order_source' => $this->order_source,
            'purchase_date' => $this->purchase_date?->format('Y-m-d'),
            'batch_number' => $primary['batch_number'] ?? null,
            'product_id' => $primary['product_id'] ?? null,
            'product_name' => $primary['product_name'] ?? null,
            'sku' => $primary['sku'] ?? null,
            'quantity_affected' => $primary['quantity_affected'] ?? null,
            'unit_of_measurement_id' => $primary['unit_of_measurement_id'] ?? null,
            'unit_of_measurement' => $primary['unit_of_measurement'] ?? null,
            'affected_products' => $affectedProducts,
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
            'assigned_user_id' => $this->assigned_user_id ? (string) $this->assigned_user_id : null,
            'assigned_user' => $this->assignedUser?->email,
            'assigned_user_name' => $this->assignedUser?->full_name ?? $this->assignedUser?->name,
            'assigned_agents' => $this->whenLoaded('assignedUsers', fn () => $this->assignedUsers->map(fn ($user) => [
                'id' => (string) $user->id,
                'email' => $user->email,
                'full_name' => $user->full_name ?? $user->name,
            ])->values()->all()),
            'resolution_notes' => $this->resolution_notes,
            'sla_deadline' => $this->sla_deadline?->toIso8601String(),
            'sla_paused_at' => $this->sla_paused_at?->toIso8601String(),
            'sla_paused_duration' => $this->sla_paused_duration,
            'first_response_at' => $this->first_response_at?->toIso8601String(),
            'resolved_at' => $this->resolved_at?->toIso8601String(),
            'delivered_at' => $this->delivered_at?->toIso8601String(),
            'closed_at' => $this->closed_at?->toIso8601String(),
        ], $this->resource);
    }

    /** @return list<array<string, mixed>> */
    private function resolveAffectedProducts(): array
    {
        if (! $this->relationLoaded('affectedProducts')) {
            return [];
        }

        return $this->affectedProducts->map(fn ($item) => [
            'product_id' => $item->product_id ? (string) $item->product_id : null,
            'product_name' => $item->product?->name,
            'sku' => $item->product?->sku,
            'batch_number' => $item->batch_number,
            'quantity_affected' => $item->quantity_affected,
            'unit_of_measurement_id' => $item->unit_of_measurement_id ? (string) $item->unit_of_measurement_id : null,
            'unit_of_measurement' => $item->unitOfMeasurement?->name,
        ])->values()->all();
    }
}
