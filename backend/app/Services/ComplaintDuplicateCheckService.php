<?php

namespace App\Services;

use App\Models\Complaint;
use App\Models\SystemConfig;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;

class ComplaintDuplicateCheckService
{
    public const CONFIG_KEY = 'complaint_duplicate_check';

    public const ALLOWED_FIELDS = ['order_number', 'tracking_number', 'customer_phone'];

    public const MODES = ['warn', 'require_override', 'hard_block'];

    public const MATCH_LOGICS = ['or', 'and'];

    public const DEFAULT_FIELDS = ['tracking_number'];

    public const DEFAULT_MODE = 'warn';

    public const DEFAULT_MATCH_LOGIC = 'or';

    public const RESULT_LIMIT = 10;

    /** @return array{enabled: bool, fields: list<string>, mode: string, match_logic: string} */
    public function getSettings(): array
    {
        $config = SystemConfig::where('key', self::CONFIG_KEY)->first();
        $raw = is_array($config?->json_value) ? $config->json_value : [];

        return $this->normalizeSettings($raw);
    }

    /** @return array{enabled: bool, fields: list<string>, mode: string, match_logic: string} */
    public function getPublicSettings(): array
    {
        return $this->getSettings();
    }

    /**
     * @param  array<string, mixed>  $raw
     * @return array{enabled: bool, fields: list<string>, mode: string, match_logic: string}
     */
    public function normalizeSettings(array $raw): array
    {
        $fields = $raw['fields'] ?? self::DEFAULT_FIELDS;
        if (! is_array($fields)) {
            $fields = self::DEFAULT_FIELDS;
        }

        $fields = array_values(array_intersect(self::ALLOWED_FIELDS, array_map('strval', $fields)));
        if ($fields === []) {
            $fields = self::DEFAULT_FIELDS;
        }

        $mode = (string) ($raw['mode'] ?? self::DEFAULT_MODE);
        if (! in_array($mode, self::MODES, true)) {
            $mode = self::DEFAULT_MODE;
        }

        $matchLogic = (string) ($raw['match_logic'] ?? self::DEFAULT_MATCH_LOGIC);
        if (! in_array($matchLogic, self::MATCH_LOGICS, true)) {
            $matchLogic = self::DEFAULT_MATCH_LOGIC;
        }

        return [
            'enabled' => (bool) ($raw['enabled'] ?? false),
            'fields' => $fields,
            'mode' => $mode,
            'match_logic' => $matchLogic,
        ];
    }

    /**
     * @param  array<string, mixed>  $input
     * @return Collection<int, array<string, mixed>>
     */
    public function findDuplicates(array $input, ?int $excludeId = null, ?Builder $baseQuery = null): Collection
    {
        $settings = $this->getSettings();

        if (! $settings['enabled']) {
            return collect();
        }

        $criteria = $this->extractMatchCriteria($input, $settings['fields']);

        if ($criteria === []) {
            return collect();
        }

        // AND requires every configured field to be present and matched.
        if ($settings['match_logic'] === 'and') {
            foreach ($settings['fields'] as $field) {
                if (! array_key_exists($field, $criteria)) {
                    return collect();
                }
            }
        }

        $query = $baseQuery ? clone $baseQuery : Complaint::query();
        $query->with('complaintStatus');

        if ($excludeId) {
            $query->where('id', '!=', $excludeId);
        }

        $useAnd = $settings['match_logic'] === 'and';

        $query->where(function (Builder $outer) use ($criteria, $useAnd) {
            foreach ($criteria as $field => $value) {
                $binding = [mb_strtolower($value)];
                if ($useAnd) {
                    $outer->whereRaw('LOWER(TRIM('.$field.')) = ?', $binding);
                } else {
                    $outer->orWhereRaw('LOWER(TRIM('.$field.')) = ?', $binding);
                }
            }
        });

        return $query
            ->orderByDesc('created_at')
            ->limit(self::RESULT_LIMIT)
            ->get()
            ->map(fn (Complaint $complaint) => $this->serializeDuplicate($complaint))
            ->values();
    }

    /**
     * Enforce hard_block / require_override on create or update.
     * Warn mode is UI-only and does not block.
     *
     * @param  array<string, mixed>  $input
     * @param  Collection<int, array<string, mixed>>  $duplicates
     */
    public function duplicateConflictResponse(Collection $duplicates, string $mode): JsonResponse
    {
        $message = $mode === 'hard_block'
            ? 'A possible duplicate complaint already exists.'
            : 'A possible duplicate complaint already exists. Confirm override to continue.';

        return response()->json([
            'message' => $message,
            'code' => 'duplicate_complaints',
            'mode' => $mode,
            'duplicates' => $duplicates->values()->all(),
        ], 422);
    }

    /**
     * Return a 422 response when save must be blocked, or null when allowed.
     *
     * @param  array<string, mixed>  $input
     */
    public function conflictResponseIfBlocked(
        array $input,
        bool $duplicateOverride = false,
        ?int $excludeId = null,
        ?Builder $baseQuery = null,
    ): ?JsonResponse {
        $settings = $this->getSettings();

        if (! $settings['enabled'] || $settings['mode'] === 'warn') {
            return null;
        }

        $duplicates = $this->findDuplicates($input, $excludeId, $baseQuery);

        if ($duplicates->isEmpty()) {
            return null;
        }

        if ($settings['mode'] === 'require_override' && $duplicateOverride) {
            return null;
        }

        return $this->duplicateConflictResponse($duplicates, $settings['mode']);
    }

    /**
     * @param  array<string, mixed>  $input
     * @param  list<string>  $fields
     * @return array<string, string>
     */
    public function extractMatchCriteria(array $input, array $fields): array
    {
        $criteria = [];

        foreach ($fields as $field) {
            if (! in_array($field, self::ALLOWED_FIELDS, true)) {
                continue;
            }

            if (! array_key_exists($field, $input) || $input[$field] === null) {
                continue;
            }

            $value = trim((string) $input[$field]);
            if ($value === '') {
                continue;
            }

            $criteria[$field] = $value;
        }

        return $criteria;
    }

    /**
     * Merge existing complaint values with incoming update payload for match fields.
     *
     * @param  array<string, mixed>  $incoming
     * @return array<string, mixed>
     */
    public function matchInputForUpdate(Complaint $complaint, array $incoming): array
    {
        $input = [];

        foreach (self::ALLOWED_FIELDS as $field) {
            $input[$field] = array_key_exists($field, $incoming)
                ? $incoming[$field]
                : $complaint->{$field};
        }

        return $input;
    }

    /** @return array<string, mixed> */
    private function serializeDuplicate(Complaint $complaint): array
    {
        return [
            'id' => $complaint->id,
            'ticket_id' => $complaint->ticket_id,
            'customer_name' => $complaint->customer_name,
            'customer_phone' => $complaint->customer_phone,
            'order_number' => $complaint->order_number,
            'tracking_number' => $complaint->tracking_number,
            'status' => $complaint->complaintStatus?->name,
            'created_at' => optional($complaint->created_at)?->toIso8601String(),
        ];
    }
}
