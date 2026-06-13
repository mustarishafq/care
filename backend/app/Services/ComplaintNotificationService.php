<?php

namespace App\Services;

use App\Models\Complaint;
use App\Models\Notification;
use App\Models\User;
use App\Support\NotificationPayload;
use Illuminate\Support\Str;

class ComplaintNotificationService
{
    /** @return list<int> */
    public function assignedAgentIds(Complaint $complaint, ?int $excludeUserId = null): array
    {
        $complaint->loadMissing('assignedUsers');

        return $complaint->assignedUsers
            ->when($excludeUserId, fn ($users) => $users->where('id', '!=', $excludeUserId))
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->values()
            ->all();
    }

    /**
     * @param  array<string, mixed>  $payload
     * @param  list<int>|null  $onlyUserIds
     */
    public function notifyAssignedAgents(
        Complaint $complaint,
        array $payload,
        ?int $excludeUserId = null,
        ?array $onlyUserIds = null,
    ): int {
        $recipientIds = $this->assignedAgentIds($complaint, $excludeUserId);

        if ($onlyUserIds !== null) {
            $allowed = array_map('intval', $onlyUserIds);
            $recipientIds = array_values(array_intersect($recipientIds, $allowed));
        }

        $count = 0;

        foreach ($recipientIds as $userId) {
            Notification::create(NotificationPayload::normalize(array_merge($payload, [
                'recipient_user_id' => $userId,
                'complaint_id' => $complaint->id,
                'is_read' => false,
            ])));
            $count++;
        }

        return $count;
    }

    public function notifyStatusChanged(
        Complaint $complaint,
        ?User $actor,
        string $oldStatus,
        string $newStatus,
    ): int {
        if ($oldStatus === $newStatus) {
            return 0;
        }

        $actorName = $actor?->full_name ?? $actor?->name ?? 'Someone';

        return $this->notifyAssignedAgents($complaint, [
            'title' => 'Ticket status updated',
            'message' => "{$actorName} changed ticket {$complaint->ticket_id} from \"{$oldStatus}\" to \"{$newStatus}\".",
            'type' => 'status_changed',
        ], $actor?->id);
    }

    public function notifyTicketAssigned(Complaint $complaint, User $assignee, ?User $assigner): int
    {
        $assignerName = $assigner?->full_name ?? $assigner?->name ?? 'Someone';

        return $this->notifyAssignedAgents($complaint, [
            'title' => 'Ticket assigned to you',
            'message' => "{$assignerName} assigned ticket {$complaint->ticket_id} to you.",
            'type' => 'ticket_assigned',
        ], $assigner?->id, [$assignee->id]);
    }

    public function notifyMention(Complaint $complaint, User $mentioned, User $author, string $content): int
    {
        if ($author->id === $mentioned->id) {
            return 0;
        }

        $authorName = $author->full_name ?? $author->name ?? 'Someone';
        $preview = Str::limit($content, 100);

        Notification::create(NotificationPayload::normalize([
            'recipient_user_id' => $mentioned->id,
            'title' => 'You were mentioned in a note',
            'message' => "{$authorName} mentioned you on ticket {$complaint->ticket_id}. Note: \"{$preview}\"",
            'type' => 'mention',
            'complaint_id' => $complaint->id,
            'is_read' => false,
        ]));

        return 1;
    }
}
