<?php

namespace App\Services;

use App\Http\Resources\ComplaintResource;
use App\Http\Resources\NotificationResource;
use App\Models\Complaint;
use App\Models\Notification;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class OutgoingWebhookService
{
    /** @var list<string> */
    public const EVENTS = [
        'complaint.created',
        'complaint.updated',
        'complaint.status_changed',
        'complaint.tracking_updated',
        'notification.created',
    ];

    public function __construct(
        private WebhookSettingsService $settings,
    ) {}

    public function dispatchComplaint(string $event, Complaint $complaint): void
    {
        $complaint->loadMissing([
            'complaintStatus',
            'complaintType',
            'courier',
            'priority',
            'assignedDepartment',
            'assignedUser',
            'affectedProducts.product',
            'affectedProducts.unitOfMeasurement',
        ]);

        $this->dispatch($event, [
            'complaint' => (new ComplaintResource($complaint))->resolve(),
        ]);
    }

    public function dispatchNotification(Notification $notification): void
    {
        $notification->loadMissing(['recipient', 'complaint.complaintStatus']);

        $payload = [
            'notification' => (new NotificationResource($notification))->resolve(),
        ];

        if ($notification->complaint) {
            $notification->complaint->loadMissing([
                'complaintStatus',
                'complaintType',
                'courier',
                'priority',
            ]);

            $payload['complaint'] = (new ComplaintResource($notification->complaint))->resolve();
        }

        $this->dispatch('notification.created', $payload);
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    public function dispatch(string $event, array $payload): void
    {
        $webhooks = $this->matchingWebhooks($event);

        if ($webhooks === []) {
            return;
        }

        $body = array_merge([
            'event' => $event,
            'timestamp' => now()->toIso8601String(),
        ], $payload);

        dispatch(function () use ($event, $body, $webhooks) {
            foreach ($webhooks as $webhook) {
                $this->send($event, $body, $webhook);
            }
        })->afterResponse();
    }

    /**
     * @param  array<string, mixed>  $payload
     * @param  array{id: string, name?: string, enabled?: bool, url: string, secret: string, events?: list<string>}  $webhook
     * @return array{id: string, name: string, success: bool, status?: int, body?: string, error?: string}
     */
    public function send(string $event, array $payload, array $webhook): array
    {
        $result = [
            'id' => $webhook['id'],
            'name' => $webhook['name'] ?? 'Webhook',
            'success' => false,
        ];

        if ($webhook['url'] === '' || $webhook['secret'] === '') {
            return array_merge($result, ['error' => 'Outgoing webhook is not configured.']);
        }

        try {
            $response = Http::timeout(10)
                ->acceptJson()
                ->withHeaders([
                    'Content-Type' => 'application/json',
                    'X-Webhook-Secret' => $webhook['secret'],
                ])
                ->post($webhook['url'], $payload);

            if (! $response->successful()) {
                Log::warning('Outgoing webhook delivery failed.', [
                    'event' => $event,
                    'webhook_id' => $webhook['id'],
                    'url' => $webhook['url'],
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                return array_merge($result, [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);
            }

            return array_merge($result, [
                'success' => true,
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
        } catch (\Throwable $e) {
            Log::error('Outgoing webhook delivery error.', [
                'event' => $event,
                'webhook_id' => $webhook['id'],
                'url' => $webhook['url'],
                'message' => $e->getMessage(),
            ]);

            return array_merge($result, ['error' => $e->getMessage()]);
        }
    }

    /** @return list<array{id: string, name: string, enabled: bool, url: string, secret: string, events: list<string>}> */
    private function matchingWebhooks(string $event): array
    {
        return array_values(array_filter(
            $this->settings->getOutgoingWebhooks(),
            fn (array $webhook) => $webhook['enabled']
                && $webhook['url'] !== ''
                && $webhook['secret'] !== ''
                && $this->settings->webhookAcceptsEvent($webhook, $event),
        ));
    }
}
