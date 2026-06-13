<?php

namespace App\Support;

use App\Models\Complaint;
use Illuminate\Support\Facades\DB;

class ComplaintInput
{
    public static function normalizeForCreate(array $data): array
    {
        $data = self::resolveStatus($data);
        unset($data['status'], $data['product_name']);

        if (empty($data['status_id'])) {
            $data['status_id'] = self::lookupId('complaint_statuses', 'New Complaint');
        }

        return $data;
    }

    public static function normalizeForUpdate(array $data): array
    {
        if (array_key_exists('status', $data) || array_key_exists('status_id', $data)) {
            $data = self::resolveStatus($data);
            unset($data['status']);
        }

        return $data;
    }

    /**
     * Extract and normalize affected product lines from request data.
     *
     * @return list<array{product_id: int, batch_number: ?string, quantity_affected: ?int, unit_of_measurement_id: ?int}>
     */
    public static function pullAffectedProducts(array &$data): array
    {
        if (! empty($data['affected_products']) && is_array($data['affected_products'])) {
            $items = $data['affected_products'];
        } elseif (! empty($data['product_id']) || ! empty($data['product_name'])) {
            $productId = $data['product_id'] ?? null;
            if (! $productId && ! empty($data['product_name'])) {
                $productId = self::ensureProductId($data['product_name']);
            }

            $items = [[
                'product_id' => $productId,
                'batch_number' => $data['batch_number'] ?? null,
                'quantity_affected' => $data['quantity_affected'] ?? null,
                'unit_of_measurement_id' => $data['unit_of_measurement_id'] ?? null,
            ]];
        } else {
            $items = [];
        }

        unset(
            $data['affected_products'],
            $data['product_id'],
            $data['product_name'],
            $data['quantity_affected'],
            $data['unit_of_measurement_id'],
            $data['batch_number'],
        );

        return self::normalizeAffectedProductItems($items);
    }

    public static function applyStatusTimestamps(Complaint $complaint, array $data): array
    {
        if (! array_key_exists('status_id', $data)) {
            return $data;
        }

        $now = now();
        $deliveredId = self::lookupId('complaint_statuses', 'Delivered');
        $closedId = self::lookupId('complaint_statuses', 'Closed');

        if ($deliveredId && (int) $data['status_id'] === $deliveredId) {
            $data['delivered_at'] = $now;
            $data['resolved_at'] = $complaint->resolved_at ?? $now;
        }

        if ($closedId && (int) $data['status_id'] === $closedId) {
            $data['closed_at'] = $now;
            $data['resolved_at'] = $complaint->resolved_at ?? $now;
        }

        return $data;
    }

    /** @param list<array<string, mixed>> $items */
    private static function normalizeAffectedProductItems(array $items): array
    {
        $normalized = [];

        foreach ($items as $item) {
            if (! is_array($item)) {
                continue;
            }

            $productId = $item['product_id'] ?? null;
            if (! empty($item['product_name']) && ! $productId) {
                $productId = self::ensureProductId($item['product_name']);
            }

            if (! $productId) {
                continue;
            }

            $unitId = $item['unit_of_measurement_id'] ?? null;
            if (! empty($item['unit_of_measurement']) && ! $unitId) {
                $unitId = self::lookupId('units_of_measurement', $item['unit_of_measurement']);
            }

            $quantity = isset($item['quantity_affected']) ? (int) $item['quantity_affected'] : null;
            $lines = self::expandItemLines($item, (int) $productId, $unitId, $quantity);

            foreach ($lines as $line) {
                $normalized[] = $line;
            }
        }

        return $normalized;
    }

    /**
     * @return list<array{product_id: int, batch_number: ?string, quantity_affected: ?int, unit_of_measurement_id: ?int}>
     */
    private static function expandItemLines(array $item, int $productId, ?int $unitId, ?int $quantity): array
    {
        if (! empty($item['batch_entries']) && is_array($item['batch_entries'])) {
            $lines = [];

            foreach ($item['batch_entries'] as $entry) {
                if (! is_array($entry)) {
                    continue;
                }

                $batchNumber = trim((string) ($entry['batch_number'] ?? ''));
                $batchNumber = $batchNumber !== '' ? $batchNumber : null;

                $entryUnitId = $entry['unit_of_measurement_id'] ?? $unitId;
                if (! empty($entry['unit_of_measurement']) && ! $entryUnitId) {
                    $entryUnitId = self::lookupId('units_of_measurement', $entry['unit_of_measurement']);
                }

                $lines[] = [
                    'product_id' => $productId,
                    'batch_number' => $batchNumber,
                    'quantity_affected' => isset($entry['quantity_affected']) ? (int) $entry['quantity_affected'] : null,
                    'unit_of_measurement_id' => $entryUnitId ? (int) $entryUnitId : null,
                ];
            }

            return $lines;
        }

        $batchNumber = trim((string) ($item['batch_number'] ?? ''));
        $batchNumber = $batchNumber !== '' ? $batchNumber : null;

        if (! empty($item['batch_numbers']) && is_array($item['batch_numbers'])) {
            $batchNumbers = array_values(array_filter(
                array_map('trim', $item['batch_numbers']),
                fn ($batch) => $batch !== ''
            ));

            if ($batchNumbers === []) {
                return [[
                    'product_id' => $productId,
                    'batch_number' => $batchNumber,
                    'quantity_affected' => $quantity,
                    'unit_of_measurement_id' => $unitId ? (int) $unitId : null,
                ]];
            }

            return array_map(fn (string $batch, int $index) => [
                'product_id' => $productId,
                'batch_number' => $batch,
                'quantity_affected' => $index === 0 ? $quantity : null,
                'unit_of_measurement_id' => $index === 0 && $unitId ? (int) $unitId : null,
            ], $batchNumbers, array_keys($batchNumbers));
        }

        return [[
            'product_id' => $productId,
            'batch_number' => $batchNumber,
            'quantity_affected' => $quantity,
            'unit_of_measurement_id' => $unitId ? (int) $unitId : null,
        ]];
    }

    private static function resolveStatus(array $data): array
    {
        if (! empty($data['status_id'])) {
            return $data;
        }

        if (! empty($data['status'])) {
            $data['status_id'] = self::lookupId('complaint_statuses', $data['status']);
        }

        return $data;
    }

    private static function ensureProductId(string $name): ?int
    {
        $trimmed = trim($name);
        if ($trimmed === '') {
            return null;
        }

        $existing = DB::table('products')->where('name', $trimmed)->value('id');
        if ($existing) {
            return (int) $existing;
        }

        return (int) DB::table('products')->insertGetId([
            'name' => $trimmed,
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private static function lookupId(string $table, ?string $name): ?int
    {
        if (! $name || trim($name) === '') {
            return null;
        }

        $id = DB::table($table)->where('name', trim($name))->value('id');

        return $id ? (int) $id : null;
    }
}
