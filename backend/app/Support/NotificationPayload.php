<?php

namespace App\Support;

use App\Http\Resources\NotificationResource;
use App\Models\Notification;

class NotificationPayload
{
    /** @var list<string> */
    public const SEVERITIES = ['info', 'success', 'warning', 'error', 'critical'];

    /** @var list<string> */
    public const CATEGORIES = ['system', 'task', 'approval', 'announcement', 'other'];

    /** @param  array<string, mixed>  $data */
    public static function normalize(array $data): array
    {
        $eventType = (string) ($data['type'] ?? 'general');
        $defaults = self::defaultsForEventType($eventType);

        $severity = (string) ($data['severity'] ?? $defaults['severity']);
        $category = (string) ($data['category'] ?? $defaults['category']);

        $data['severity'] = in_array($severity, self::SEVERITIES, true) ? $severity : $defaults['severity'];
        $data['category'] = in_array($category, self::CATEGORIES, true) ? $category : $defaults['category'];
        $data['action_url'] = $data['action_url'] ?? self::actionUrlForComplaint($data['complaint_id'] ?? null);

        return $data;
    }

    public static function toWebhookPayload(Notification $notification): array
    {
        $base = (new NotificationResource($notification))->resolve();
        unset($base['type'], $base['severity'], $base['category'], $base['action_url']);

        return array_merge($base, [
            'type' => $notification->severity ?? 'info',
            'category' => $notification->category ?? 'other',
            'action_url' => $notification->action_url,
            'event_type' => $notification->type,
        ]);
    }

    /** @return array{severity: string, category: string} */
    public static function defaultsForEventType(string $eventType): array
    {
        return match ($eventType) {
            'ticket_assigned' => ['severity' => 'info', 'category' => 'task'],
            'status_changed' => ['severity' => 'info', 'category' => 'task'],
            'mention' => ['severity' => 'info', 'category' => 'task'],
            'sla_warning' => ['severity' => 'warning', 'category' => 'system'],
            'low_rating_review' => ['severity' => 'warning', 'category' => 'system'],
            'overdue' => ['severity' => 'critical', 'category' => 'system'],
            'approval' => ['severity' => 'info', 'category' => 'approval'],
            'announcement' => ['severity' => 'info', 'category' => 'announcement'],
            default => ['severity' => 'info', 'category' => 'other'],
        };
    }

    public static function actionUrlForComplaint(mixed $complaintId): ?string
    {
        if ($complaintId === null || $complaintId === '') {
            return null;
        }

        $base = rtrim((string) config('app.frontend_url', config('app.url')), '/');

        return "{$base}/complaints/{$complaintId}";
    }
}
