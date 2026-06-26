<?php

namespace App\Services;

use App\Http\Resources\ComplaintResource;
use App\Models\Complaint;
use App\Models\TicketActivity;
use App\Support\ComplaintInput;
use Illuminate\Database\Eloquent\Builder;

class ComplaintTrackingUpdateService
{
    public function __construct(
        private OutgoingWebhookService $outgoingWebhook,
    ) {}

    /**
     * @param  array{ticket_id?: string, order_number?: string, tracking_number?: string, replacement_tracking_number?: string, status?: string}  $data
     */
    public function update(array $data): ComplaintResource
    {
        $complaint = isset($data['ticket_id'])
            ? Complaint::where('ticket_id', $data['ticket_id'])->first()
            : Complaint::where('order_number', $data['order_number'] ?? '')->first();

        if (! $complaint) {
            abort(404, 'Complaint not found.');
        }

        $updates = array_filter([
            'tracking_number' => $data['tracking_number'] ?? null,
            'replacement_tracking_number' => $data['replacement_tracking_number'] ?? null,
            'status' => $data['status'] ?? null,
        ], fn ($v) => $v !== null);

        if ($updates !== []) {
            $normalized = ComplaintInput::normalizeForUpdate($updates);
            $complaint->update(ComplaintInput::applyStatusTimestamps($complaint, $normalized));

            TicketActivity::create([
                'complaint_id' => $complaint->id,
                'action_type' => 'tracking_added',
                'description' => 'Tracking updated via webhook',
                'new_value' => json_encode($updates),
            ]);

            $this->outgoingWebhook->dispatchComplaint('complaint.tracking_updated', $complaint->fresh());
        }

        return new ComplaintResource($complaint->fresh()->load([
            'complaintStatus',
            'affectedProducts.product',
            'affectedProducts.unitOfMeasurement',
        ]));
    }

    /** @return list<string> */
    public static function complaintRelations(): array
    {
        return [
            'assignedDepartment',
            'assignedUser',
            'assignedUsers',
            'complaintStatus',
            'complaintType',
            'courier',
            'priority',
            'affectedProducts.product',
            'affectedProducts.unitOfMeasurement',
        ];
    }

    /** @param  Builder<Complaint>  $query */
    public static function applySort(Builder $query, ?string $sortBy, ?string $sortOrder): Builder
    {
        $direction = strtolower((string) $sortOrder) === 'asc' ? 'asc' : 'desc';
        $column = $sortBy ?: 'created_date';

        $columnMap = [
            'created_date' => 'created_at',
            'updated_date' => 'updated_at',
        ];

        $column = $columnMap[$column] ?? $column;

        return $query->orderBy($column, $direction);
    }

    /** @param  Builder<Complaint>  $query */
    public static function applyFilters(Builder $query, array $filters): Builder
    {
        foreach ($filters as $field => $value) {
            if ($value === null || $value === '') {
                continue;
            }

            if ($field === 'id') {
                $query->where($query->getModel()->getTable().'.id', $value);
            } elseif ($value === 'true' || $value === '1') {
                $query->where($field, true);
            } elseif ($value === 'false' || $value === '0') {
                $query->where($field, false);
            } elseif (is_bool($value)) {
                $query->where($field, $value);
            } else {
                $query->where($field, $value);
            }
        }

        return $query;
    }
}
