<?php

namespace App\Services;

use App\Models\Complaint;
use App\Models\SystemConfig;
use App\Models\TicketActivity;
use Illuminate\Support\Facades\DB;

class AutoCloseDeliveredComplaintsService
{
    public const CONFIG_KEY = 'auto_close_delivered';

    public function __construct(
        private ComplaintNotificationService $complaintNotifications,
    ) {}

    /** @return array{enabled: bool, delay_amount: int, delay_unit: string} */
    public function getSettings(): array
    {
        $config = SystemConfig::where('key', self::CONFIG_KEY)->first();
        $settings = $config?->json_value ?? [];

        $unit = $settings['delay_unit'] ?? 'days';

        return [
            'enabled' => (bool) ($settings['enabled'] ?? false),
            'delay_amount' => max(1, (int) ($settings['delay_amount'] ?? 1)),
            'delay_unit' => in_array($unit, ['hours', 'days'], true) ? $unit : 'days',
        ];
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

        $deliveredId = DB::table('complaint_statuses')->where('name', 'Delivered')->value('id');
        $closedId = DB::table('complaint_statuses')->where('name', 'Closed')->value('id');

        if (! $deliveredId || ! $closedId) {
            return 0;
        }

        $cutoff = now()->subHours($this->delayInHours());

        $complaints = Complaint::query()
            ->with('assignedUsers')
            ->where('status_id', $deliveredId)
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
            DB::transaction(function () use ($complaint, $closedId, $now, &$count) {
                $complaint->update([
                    'status_id' => $closedId,
                    'resolved_at' => $complaint->resolved_at ?? $now,
                    'closed_at' => $now,
                ]);

                TicketActivity::create([
                    'complaint_id' => $complaint->id,
                    'action_type' => 'status_changed',
                    'description' => 'Status changed from "Delivered" to "Closed" (automated)',
                    'old_value' => 'Delivered',
                    'new_value' => 'Closed',
                    'user_id' => null,
                ]);

                $this->complaintNotifications->notifyAssignedAgents(
                    $complaint->fresh(['assignedUsers', 'complaintStatus']),
                    [
                        'title' => 'Ticket status updated',
                        'message' => "System automatically closed ticket {$complaint->ticket_id} from \"Delivered\" to \"Closed\".",
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
