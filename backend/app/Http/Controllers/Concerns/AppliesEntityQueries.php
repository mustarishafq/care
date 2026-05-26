<?php

namespace App\Http\Controllers\Concerns;

use Illuminate\Database\Eloquent\Builder;

trait AppliesEntityQueries
{
    protected function applyFilters(Builder $query, array $filters): Builder
    {
        foreach ($filters as $field => $value) {
            if ($value === null || $value === '') {
                continue;
            }

            if ($field === 'id') {
                $query->where($query->getModel()->getTable().'.id', $value);
            } elseif ($value === 'true' || $value === '1') {
                $query->where($field, true);
            } elseif ($value === 'false' || $value === '0') {
                $query->where($field, false);
            } elseif (is_bool($value)) {
                $query->where($field, $value);
            } else {
                $query->where($field, $value);
            }
        }

        return $query;
    }

    protected function applySort(Builder $query, ?string $sort): Builder
    {
        if (! $sort) {
            return $query->orderByDesc('created_at');
        }

        $direction = str_starts_with($sort, '-') ? 'desc' : 'asc';
        $column = ltrim($sort, '-');

        $columnMap = [
            'created_date' => 'created_at',
            'updated_date' => 'updated_at',
        ];

        $column = $columnMap[$column] ?? $column;

        return $query->orderBy($column, $direction);
    }
}
