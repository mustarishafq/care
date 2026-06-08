<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\ComplaintResource;
use App\Models\Complaint;
use App\Support\ComplaintInput;
use App\Models\SystemConfig;
use App\Models\TicketActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WebhookController extends Controller
{
    public function trackingUpdate(Request $request): JsonResponse
    {
        $apiKey = $request->header('X-API-Key');
        $storedKey = SystemConfig::where('key', 'webhook_api_key')->value('json_value');

        if (! $apiKey || ! $storedKey || ($storedKey['key'] ?? null) !== $apiKey) {
            return response()->json(['message' => 'Unauthorized.'], 401);
        }

        $data = $request->validate([
            'ticket_id' => ['required_without:order_number', 'string'],
            'order_number' => ['required_without:ticket_id', 'string'],
            'tracking_number' => ['nullable', 'string'],
            'replacement_tracking_number' => ['nullable', 'string'],
            'status' => ['nullable', 'string'],
        ]);

        $complaint = isset($data['ticket_id'])
            ? Complaint::where('ticket_id', $data['ticket_id'])->first()
            : Complaint::where('order_number', $data['order_number'])->first();

        if (! $complaint) {
            return response()->json(['message' => 'Complaint not found.'], 404);
        }

        $updates = array_filter([
            'tracking_number' => $data['tracking_number'] ?? null,
            'replacement_tracking_number' => $data['replacement_tracking_number'] ?? null,
            'status' => $data['status'] ?? null,
        ], fn ($v) => $v !== null);

        if (! empty($updates)) {
            $normalized = ComplaintInput::normalizeForUpdate($updates);
            $complaint->update(ComplaintInput::applyStatusTimestamps($complaint, $normalized));

            TicketActivity::create([
                'complaint_id' => $complaint->id,
                'action_type' => 'tracking_added',
                'description' => 'Tracking updated via webhook',
                'new_value' => json_encode($updates),
            ]);
        }

        return response()->json([
            'message' => 'Tracking updated successfully.',
            'complaint' => new ComplaintResource($complaint->fresh()->load([
                'complaintStatus',
                'affectedProducts.product',
                'affectedProducts.unitOfMeasurement',
            ])),
        ]);
    }
}
