<?php

namespace App\Services;

use App\Models\ComplaintStatus;
use App\Models\SystemConfig;

class SlaSettingsService
{
    public const CONFIG_KEY = 'sla_settings';

    /** @var list<string> */
    public const DEFAULT_PAUSED_STATUS_NAMES = ['Waiting for Customer', 'Waiting for Vendor'];

    /** @var list<string> */
    public const DEFAULT_RESOLVED_STATUS_NAMES = ['Delivered', 'Closed', 'Rejected', 'Drop'];

    /** @return array<string, mixed> */
    public function getSettings(): array
    {
        $config = SystemConfig::where('key', self::CONFIG_KEY)->first();
        $raw = $config?->json_value ?? [];

        return array_merge([
            'first_response' => 2,
            'low' => 72,
            'medium' => 48,
            'high' => 24,
            'urgent' => 6,
            'stale_alert_hours' => 24,
            'paused_status_ids' => [],
            'resolved_status_ids' => [],
        ], is_array($raw) ? $raw : []);
    }

    /** @return list<int> */
    public function getPausedStatusIds(): array
    {
        $configured = $this->getSettings()['paused_status_ids'] ?? [];

        if (is_array($configured) && $configured !== []) {
            return array_values(array_filter(array_map(
                fn ($id) => is_numeric($id) ? (int) $id : null,
                $configured
            )));
        }

        return ComplaintStatus::query()
            ->whereIn('name', self::DEFAULT_PAUSED_STATUS_NAMES)
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();
    }

    public function isPausedStatusId(?int $statusId): bool
    {
        if (! $statusId) {
            return false;
        }

        return in_array($statusId, $this->getPausedStatusIds(), true);
    }

    /** @return list<int> */
    public function getResolvedStatusIds(): array
    {
        $configured = $this->getSettings()['resolved_status_ids'] ?? [];

        if (is_array($configured) && $configured !== []) {
            return array_values(array_filter(array_map(
                fn ($id) => is_numeric($id) ? (int) $id : null,
                $configured
            )));
        }

        return ComplaintStatus::query()
            ->whereIn('name', self::DEFAULT_RESOLVED_STATUS_NAMES)
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();
    }

    public function isResolvedStatusId(?int $statusId): bool
    {
        if (! $statusId) {
            return false;
        }

        return in_array($statusId, $this->getResolvedStatusIds(), true);
    }
}
