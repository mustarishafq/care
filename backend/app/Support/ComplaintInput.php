<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;

class ComplaintInput
{
    public static function normalizeForCreate(array $data): array
    {
        $data = self::resolveStatus($data);
        $data = self::resolveProduct($data);
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

        if (array_key_exists('product_name', $data) || array_key_exists('product_id', $data)) {
            $data = self::resolveProduct($data);
            unset($data['product_name']);
        }

        return $data;
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

    private static function resolveProduct(array $data): array
    {
        if (! empty($data['product_name'])) {
            $data['product_id'] = self::ensureProductId($data['product_name']);
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
