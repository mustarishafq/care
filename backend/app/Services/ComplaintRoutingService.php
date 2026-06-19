<?php

namespace App\Services;

use App\Models\SystemConfig;

class ComplaintRoutingService
{
    public const CONFIG_KEY = 'complaint_routing';

    /** @return array{enabled: bool, default_department_id: ?int, default_status_id: ?int, rules: list<array{complaint_type_id: int, department_id: ?int, status_id: ?int}>} */
    public function getSettings(): array
    {
        $config = SystemConfig::where('key', self::CONFIG_KEY)->first();
        $raw = $config?->json_value ?? [];

        $rules = [];
        foreach ($raw['rules'] ?? [] as $rule) {
            if (! is_array($rule)) {
                continue;
            }

            $complaintTypeId = isset($rule['complaint_type_id']) ? (int) $rule['complaint_type_id'] : 0;
            if ($complaintTypeId <= 0) {
                continue;
            }

            $rules[] = [
                'complaint_type_id' => $complaintTypeId,
                'department_id' => $this->nullableInt($rule['department_id'] ?? null),
                'status_id' => $this->nullableInt($rule['status_id'] ?? null),
            ];
        }

        return [
            'enabled' => (bool) ($raw['enabled'] ?? false),
            'default_department_id' => $this->nullableInt($raw['default_department_id'] ?? null),
            'default_status_id' => $this->nullableInt($raw['default_status_id'] ?? null),
            'rules' => $rules,
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  array{had_explicit_department?: bool, had_explicit_status?: bool}  $options
     * @return array<string, mixed>
     */
    public function applyToCreate(array $data, array $options = []): array
    {
        $settings = $this->getSettings();

        if (! $settings['enabled']) {
            return $data;
        }

        $complaintTypeId = isset($data['complaint_type_id']) ? (int) $data['complaint_type_id'] : null;
        $rule = $this->findRule($settings['rules'], $complaintTypeId);

        if (! ($options['had_explicit_department'] ?? false)) {
            $departmentId = $rule['department_id'] ?? $settings['default_department_id'];
            if ($departmentId) {
                $data['assigned_department_id'] = $departmentId;
            }
        }

        if (! ($options['had_explicit_status'] ?? false)) {
            $statusId = $rule['status_id'] ?? $settings['default_status_id'];
            if ($statusId) {
                $data['status_id'] = $statusId;
            }
        }

        return $data;
    }

    /** @param  list<array{complaint_type_id: int, department_id: ?int, status_id: ?int}>  $rules */
    private function findRule(array $rules, ?int $complaintTypeId): ?array
    {
        if (! $complaintTypeId) {
            return null;
        }

        foreach ($rules as $rule) {
            if ($rule['complaint_type_id'] === $complaintTypeId) {
                return $rule;
            }
        }

        return null;
    }

    private function nullableInt(mixed $value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }

        $int = (int) $value;

        return $int > 0 ? $int : null;
    }
}
