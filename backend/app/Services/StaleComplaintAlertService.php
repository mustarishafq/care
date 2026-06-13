<?php

namespace App\Services;

use App\Models\Complaint;
use App\Models\ComplaintStatus;
use App\Models\Notification;
use App\Models\SystemConfig;
use App\Support\NotificationPayload;

class StaleComplaintAlertService
{
    /** @var list<string> */
    private const STALE_STATUSES = ['New Complaint', 'Under Review'];

    public function run(): int
    {
        $config = SystemConfig::where('key', 'sla_settings')->first();
        $thresholdHours = max(1, (int) (($config?->json_value ?? [])['stale_alert_hours'] ?? 24));

        $statusIds = ComplaintStatus::query()
            ->whereIn('name', self::STALE_STATUSES)
            ->pluck('id')
            ->all();

        if ($statusIds === []) {
            return 0;
        }

        $cutoff = now()->subHours($thresholdHours);

        $complaints = Complaint::query()
            ->with(['assignedUsers', 'complaintStatus'])
            ->whereIn('status_id', $statusIds)
            ->where('created_at', '<=', $cutoff)
            ->whereHas('assignedUsers')
            ->get();

        $count = 0;

        foreach ($complaints as $complaint) {
            $ageHours = (int) $complaint->created_at->diffInHours(now());
            $statusName = $complaint->complaintStatus?->name ?? 'Unknown';

            foreach ($complaint->assignedUsers as $user) {
                $alreadySent = Notification::query()
                    ->where('complaint_id', $complaint->id)
                    ->where('recipient_user_id', $user->id)
                    ->where('type', 'sla_warning')
                    ->exists();

                if ($alreadySent) {
                    continue;
                }

                Notification::create(NotificationPayload::normalize([
                    'recipient_user_id' => $user->id,
                    'title' => "Stale Ticket: {$complaint->ticket_id}",
                    'message' => "Ticket {$complaint->ticket_id} ({$statusName}) has been open for {$ageHours} hours without progress. Customer: {$complaint->customer_name}",
                    'type' => 'sla_warning',
                    'severity' => 'warning',
                    'category' => 'system',
                    'complaint_id' => $complaint->id,
                    'is_read' => false,
                ]));

                $count++;
            }
        }

        return $count;
    }
}
