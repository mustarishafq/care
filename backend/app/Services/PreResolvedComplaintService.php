<?php

namespace App\Services;

use App\Models\ComplaintStatus;
use App\Models\SystemConfig;
use App\Support\StoragePath;

class PreResolvedComplaintService
{
    public const CONFIG_KEY = 'pre_resolved_complaints';

    /** @return array{enabled: bool, status_id: ?int, require_closure_proof: bool, require_resolution_notes: bool} */
    public function getSettings(): array
    {
        $config = SystemConfig::where('key', self::CONFIG_KEY)->first();
        $raw = $config?->json_value ?? [];

        return [
            'enabled' => (bool) ($raw['enabled'] ?? false),
            'status_id' => $this->nullableInt($raw['status_id'] ?? null),
            'require_closure_proof' => (bool) ($raw['require_closure_proof'] ?? true),
            'require_resolution_notes' => (bool) ($raw['require_resolution_notes'] ?? false),
        ];
    }

    /** @return array{enabled: bool, status_id: ?int, status_name: ?string, require_closure_proof: bool, require_resolution_notes: bool} */
    public function getPublicSettings(): array
    {
        $settings = $this->getSettings();
        $statusName = null;

        if ($settings['status_id']) {
            $statusName = ComplaintStatus::query()->whereKey($settings['status_id'])->value('name');
        }

        return [
            'enabled' => $settings['enabled'],
            'status_id' => $settings['status_id'],
            'status_name' => $statusName,
            'require_closure_proof' => $settings['require_closure_proof'],
            'require_resolution_notes' => $settings['require_resolution_notes'],
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public function applyToCreate(array $data): array
    {
        $settings = $this->getSettings();

        if (! $settings['enabled']) {
            abort(422, 'Pre-resolved complaints are not enabled.');
        }

        if (! $settings['status_id']) {
            abort(422, 'Pre-resolved complaint target status is not configured.');
        }

        $data['status_id'] = $settings['status_id'];

        return $data;
    }

    /** @param  array<string, mixed>  $data */
    public function ensureRequirements(array $data, ?array $settings = null): void
    {
        $settings ??= $this->getSettings();

        if ($settings['require_closure_proof']) {
            $proofFiles = StoragePath::normalizeClosureProofMany($data['closure_proof_files'] ?? []);
            $proofNotes = trim((string) ($data['closure_proof_notes'] ?? ''));

            if ($proofFiles === [] && $proofNotes === '') {
                abort(422, 'Closure proof (image or notes) is required for pre-resolved complaints.');
            }
        }

        if ($settings['require_resolution_notes']) {
            $notes = trim((string) ($data['resolution_notes'] ?? ''));

            if ($notes === '') {
                abort(422, 'Resolution notes are required for pre-resolved complaints.');
            }
        }
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
