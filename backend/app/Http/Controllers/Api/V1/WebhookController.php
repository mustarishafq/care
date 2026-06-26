<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\AuthorizesPermissions;
use App\Http\Controllers\Controller;
use App\Http\Resources\ComplaintResource;
use App\Http\Resources\NotificationResource;
use App\Models\Complaint;
use App\Models\Notification;
use App\Services\ComplaintTrackingUpdateService;
use App\Services\OutgoingWebhookService;
use App\Services\WebhookSettingsService;
use App\Support\NotificationPayload;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WebhookController extends Controller
{
    use AuthorizesPermissions;

    public function __construct(
        private WebhookSettingsService $webhookSettings,
        private OutgoingWebhookService $outgoingWebhook,
        private ComplaintTrackingUpdateService $trackingUpdate,
    ) {}

    public function settings(Request $request): JsonResponse
    {
        $this->ensurePermission($request->user(), 'oms.view');

        $canManage = $request->user()->hasPermission('oms.manage');
        $outgoingWebhooks = $this->webhookSettings->getOutgoingWebhooks();

        return response()->json([
            'incoming' => [
                'endpoint_url' => $this->webhookSettings->incomingEndpointUrl(),
                'secret' => $canManage ? $this->webhookSettings->ensureIncomingSecret() : null,
                'header' => 'X-Webhook-Secret',
            ],
            'outgoing_webhooks' => $this->webhookSettings->presentOutgoingWebhooks($outgoingWebhooks, $canManage),
            'available_events' => $this->webhookSettings->availableOutgoingEvents(),
        ]);
    }

    public function updateSettings(Request $request): JsonResponse
    {
        $this->ensurePermission($request->user(), 'oms.manage');

        $data = $request->validate([
            'outgoing_webhooks' => ['required', 'array'],
            'outgoing_webhooks.*.id' => ['nullable', 'string', 'max:64'],
            'outgoing_webhooks.*.name' => ['nullable', 'string', 'max:255'],
            'outgoing_webhooks.*.enabled' => ['sometimes', 'boolean'],
            'outgoing_webhooks.*.url' => ['nullable', 'string', 'max:2048'],
            'outgoing_webhooks.*.secret' => ['nullable', 'string', 'max:255'],
            'outgoing_webhooks.*.events' => ['nullable', 'array'],
            'outgoing_webhooks.*.events.*' => ['string', 'max:255'],
        ]);

        $saved = $this->webhookSettings->saveOutgoingWebhooks($data['outgoing_webhooks']);

        return response()->json([
            'message' => 'Webhook settings saved.',
            'outgoing_webhooks' => $this->webhookSettings->presentOutgoingWebhooks($saved, true),
        ]);
    }

    public function regenerateIncomingSecret(Request $request): JsonResponse
    {
        $this->ensurePermission($request->user(), 'oms.manage');

        $secret = $this->webhookSettings->regenerateIncomingSecret();

        return response()->json([
            'message' => 'Incoming webhook secret regenerated.',
            'incoming' => [
                'endpoint_url' => $this->webhookSettings->incomingEndpointUrl(),
                'secret' => $secret,
                'header' => 'X-Webhook-Secret',
            ],
        ]);
    }

    public function regenerateOutgoingSecret(Request $request): JsonResponse
    {
        $this->ensurePermission($request->user(), 'oms.manage');

        $data = $request->validate([
            'id' => ['required', 'string', 'max:64'],
        ]);

        $secret = $this->webhookSettings->regenerateOutgoingSecret($data['id']);

        if ($secret === null) {
            return response()->json(['message' => 'Outgoing webhook not found.'], 404);
        }

        $webhook = $this->webhookSettings->findOutgoingWebhook($data['id']);

        return response()->json([
            'message' => 'Outgoing webhook secret regenerated.',
            'webhook' => array_merge(
                $this->webhookSettings->presentOutgoingWebhooks([$webhook], true)[0],
            ),
        ]);
    }

    public function testOutgoing(Request $request): JsonResponse
    {
        $this->ensurePermission($request->user(), 'oms.manage');

        $data = $request->validate([
            'id' => ['nullable', 'string', 'max:64'],
            'name' => ['nullable', 'string', 'max:255'],
            'url' => ['nullable', 'string', 'max:2048'],
            'secret' => ['nullable', 'string', 'max:255'],
            'events' => ['nullable', 'array'],
            'events.*' => ['string', 'max:255'],
        ]);

        if (isset($data['id'])) {
            $saved = $this->webhookSettings->findOutgoingWebhook($data['id']);

            if (! $saved) {
                return response()->json(['message' => 'Outgoing webhook not found.'], 404);
            }

            $webhook = $saved;

            if (array_key_exists('name', $data)) {
                $webhook['name'] = trim((string) $data['name']);
            }

            if (array_key_exists('url', $data)) {
                $webhook['url'] = trim((string) $data['url']);
            }

            if (array_key_exists('secret', $data) && $data['secret'] !== null && $data['secret'] !== '') {
                $webhook['secret'] = (string) $data['secret'];
            }

            if (array_key_exists('events', $data)) {
                $webhook['events'] = $this->webhookSettings->normalizeEventsForRequest($data['events'] ?? []);
            }
        } else {
            $webhook = [
                'id' => 'test',
                'name' => trim((string) ($data['name'] ?? 'Test Webhook')),
                'enabled' => true,
                'url' => trim((string) ($data['url'] ?? '')),
                'secret' => (string) ($data['secret'] ?? ''),
                'events' => $this->webhookSettings->normalizeEventsForRequest($data['events'] ?? []),
            ];
        }

        if ($webhook['url'] === '') {
            return response()->json(['message' => 'Outgoing webhook URL is not configured.'], 422);
        }

        if ($webhook['secret'] === '') {
            return response()->json(['message' => 'Outgoing webhook secret is not configured.'], 422);
        }

        $complaint = Complaint::query()
            ->with([
                'complaintStatus',
                'complaintType',
                'courier',
                'priority',
                'assignedDepartment',
                'assignedUser',
                'affectedProducts.product',
                'affectedProducts.unitOfMeasurement',
            ])
            ->latest('id')
            ->first();

        $notification = Notification::query()
            ->with([
                'recipient',
                'complaint.complaintStatus',
                'complaint.complaintType',
                'complaint.courier',
                'complaint.priority',
            ])
            ->latest('id')
            ->first();

        $payload = $this->buildTestPayload($webhook, $complaint, $notification);
        $result = $this->outgoingWebhook->send($payload['event'], $payload, $webhook);

        if (! $result['success']) {
            return response()->json([
                'message' => 'Outgoing webhook test failed.',
                'payload' => $payload,
                'result' => $result,
            ], 502);
        }

        return response()->json([
            'message' => 'Outgoing webhook test delivered successfully.',
            'payload' => $payload,
            'result' => $result,
        ]);
    }

    public function trackingUpdate(Request $request): JsonResponse
    {
        if (! $this->webhookSettings->validateIncomingSecret($request->header('X-Webhook-Secret'))) {
            return response()->json(['message' => 'Unauthorized.'], 401);
        }

        $data = $request->validate([
            'ticket_id' => ['required_without:order_number', 'string'],
            'order_number' => ['required_without:ticket_id', 'string'],
            'tracking_number' => ['nullable', 'string'],
            'replacement_tracking_number' => ['nullable', 'string'],
            'status' => ['nullable', 'string'],
        ]);

        return response()->json([
            'message' => 'Tracking updated successfully.',
            'complaint' => $this->trackingUpdate->update($data),
        ]);
    }

    /** @return array<string, mixed> */
    private function buildTestPayload(array $webhook, ?Complaint $complaint, ?Notification $notification): array
    {
        $events = $webhook['events'] ?? [];
        $event = $this->resolveTestEvent($events);
        $wantsNotificationPayload = $events === [] || in_array('notification.created', $events, true);
        $wantsComplaintPayload = $events === [] || $this->includesComplaintEvent($events);

        $payload = [
            'event' => $event,
            'timestamp' => now()->toIso8601String(),
        ];

        if ($wantsNotificationPayload) {
            if ($notification) {
                $payload['notification'] = NotificationPayload::toWebhookPayload($notification);

                if ($notification->complaint) {
                    $payload['complaint'] = (new ComplaintResource($notification->complaint))->resolve();
                }
            } else {
                $payload['notification'] = $this->sampleNotification($complaint);

                if ($complaint) {
                    $payload['complaint'] = (new ComplaintResource($complaint))->resolve();
                }
            }
        } elseif ($wantsComplaintPayload && $complaint) {
            $payload['complaint'] = (new ComplaintResource($complaint))->resolve();
        }

        return $payload;
    }

    /** @param  list<string>  $events */
    private function resolveTestEvent(array $events): string
    {
        if ($events === []) {
            return 'webhook.test';
        }

        if (count($events) === 1) {
            return $events[0];
        }

        if (in_array('notification.created', $events, true)) {
            return 'notification.created';
        }

        foreach ($events as $event) {
            if ($event !== 'notification.created') {
                return $event;
            }
        }

        return 'webhook.test';
    }

    /** @param  list<string>  $events */
    private function includesComplaintEvent(array $events): bool
    {
        return count(array_intersect($events, [
            'complaint.created',
            'complaint.updated',
            'complaint.status_changed',
            'complaint.tracking_updated',
        ])) > 0;
    }

    /** @return array<string, mixed> */
    private function sampleNotification(?Complaint $complaint): array
    {
        $ticketId = $complaint?->ticket_id ?? 'RH-TEST-0001';
        $complaintId = $complaint ? (string) $complaint->id : null;

        return [
            'id' => '0',
            'recipient_user_id' => $complaint?->assigned_user_id ? (string) $complaint->assigned_user_id : '1',
            'recipient_email' => $complaint?->assignedUser?->email ?? 'agent@example.com',
            'sso_id' => $complaint?->assignedUser?->nexus_sso_id,
            'title' => 'Ticket assigned to you',
            'message' => "Sample notification for webhook test on ticket {$ticketId}.",
            'type' => 'info',
            'category' => 'task',
            'action_url' => NotificationPayload::actionUrlForComplaint($complaintId) ?? rtrim((string) config('app.frontend_url'), '/').'/dashboard',
            'event_type' => 'ticket_assigned',
            'complaint_id' => $complaintId,
            'is_read' => false,
            'created_date' => now()->toIso8601String(),
        ];
    }
}
