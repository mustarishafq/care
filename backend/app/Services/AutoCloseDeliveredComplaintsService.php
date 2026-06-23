<?php

namespace App\Services;

use App\Models\Complaint;
use App\Models\ComplaintStatus;
use App\Models\SystemConfig;
use App\Models\TicketActivity;
use Illuminate\Support\Facades\DB;

class AutoCloseDeliveredComplaintsService
{
    public const CONFIG_KEY = 'auto_close_delivered';

    public const DEFAULT_TRIGGER_STATUS_NAME = 'Delivered';

    public const DEFAULT_TARGET_STATUS_NAME = 'Closed';

    public function __construct(
        private ComplaintNotificationService $complaintNotifications,
    ) {}

    /** @return array{enabled: bool, delay_amount: int, delay_unit: string, trigger_status_id: ?int, target_status_id: ?int} */
    public function getSettings(): array
    {
        $config = SystemConfig::where('key', self::CONFIG_KEY)->first();
        $settings = $config?->json_value ?? [];

        $unit = $settings['delay_unit'] ?? 'days';
        $triggerId = isset($settings['trigger_status_id']) && is_numeric($settings['trigger_status_id'])
            ? (int) $settings['trigger_status_id']
            : null;
        $targetId = isset($settings['target_status_id']) && is_numeric($settings['target_status_id'])
            ? (int) $settings['target_status_id']
            : null;

        return [
            'enabled' => (bool) ($settings['enabled'] ?? false),
            'delay_amount' => max(1, (int) ($settings['delay_amount'] ?? 1)),
            'delay_unit' => in_array($unit, ['hours', 'days'], true) ? $unit : 'days',
            'trigger_status_id' => $triggerId,
            'target_status_id' => $targetId,
        ];
    }

    public function getTriggerStatusId(): ?int
    {
        $configured = $this->getSettings()['trigger_status_id'];

        if ($configured) {
            return $configured;
        }

        $id = ComplaintStatus::query()
            ->where('name', self::DEFAULT_TRIGGER_STATUS_NAME)
            ->value('id');

        return $id ? (int) $id : null;
    }

    public function getTargetStatusId(): ?int
    {
        $configured = $this->getSettings()['target_status_id'];

        if ($configured) {
            return $configured;
        }

        $id = ComplaintStatus::query()
            ->where('name', self::DEFAULT_TARGET_STATUS_NAME)
            ->value('id');

        return $id ? (int) $id : null;
    }

    public function isTriggerStatusId(?int $statusId): bool
    {
        if (! $statusId) {
            return false;
        }

        $triggerId = $this->getTriggerStatusId();

        return $triggerId && $statusId === $triggerId;
    }

    public function delayInHours(): int
    {
        $settings = $this->getSettings();

        return $settings['delay_unit'] === 'days'
            ? $settings['delay_amount'] * 24
            : $settings['delay_amount'];
    }

    public function run(bool $force = false): int
    {
        $settings = $this->getSettings();

        if (! $settings['enabled'] && ! $force) {
            return 0;
        }

        $triggerId = $this->getTriggerStatusId();
        $targetId = $this->getTargetStatusId();

        if (! $triggerId || ! $targetId) {
            return 0;
        }

        $triggerName = ComplaintStatus::query()->whereKey($triggerId)->value('name') ?? self::DEFAULT_TRIGGER_STATUS_NAME;
        $targetName = ComplaintStatus::query()->whereKey($targetId)->value('name') ?? self::DEFAULT_TARGET_STATUS_NAME;

        $cutoff = now()->subHours($this->delayInHours());

        $complaints = Complaint::query()
            ->with('assignedUsers')
            ->where('status_id', $triggerId)
            ->where(function ($query) use ($cutoff) {
                $query->where('delivered_at', '<=', $cutoff)
                    ->orWhere(function ($fallback) use ($cutoff) {
                        $fallback->whereNull('delivered_at')
                            ->where('resolved_at', '<=', $cutoff);
                    });
            })
            ->get();

        $now = now();
        $count = 0;

        foreach ($complaints as $complaint) {
            DB::transaction(function () use ($complaint, $targetId, $targetName, $triggerName, $now, &$count) {
                $complaint->update([
                    'status_id' => $targetId,
                    'resolved_at' => $complaint->resolved_at ?? $now,
                    'closed_at' => $now,
                ]);

                TicketActivity::create([
                    'complaint_id' => $complaint->id,
                    'action_type' => 'status_changed',
                    'description' => "Status changed from \"{$triggerName}\" to \"{$targetName}\" (automated)",
                    'old_value' => $triggerName,
                    'new_value' => $targetName,
                    'user_id' => null,
                ]);

                $this->complaintNotifications->notifyAssignedAgents(
                    $complaint->fresh(['assignedUsers', 'complaintStatus']),
                    [
                        'title' => 'Ticket status updated',
                        'message' => "System automatically closed ticket {$complaint->ticket_id} from \"{$triggerName}\" to \"{$targetName}\".",
                        'type' => 'status_changed',
                        'severity' => 'success',
                        'category' => 'system',
                    ],
                );

                app(OutgoingWebhookService::class)->dispatchComplaint(
                    'complaint.status_changed',
                    $complaint->fresh()->load([
                        'complaintStatus',
                        'complaintType',
                        'courier',
                        'priority',
                        'assignedDepartment',
                        'assignedUser',
                        'affectedProducts.product',
                        'affectedProducts.unitOfMeasurement',
                    ]),
                );

                $count++;
            });
        }

        return $count;
    }
}
