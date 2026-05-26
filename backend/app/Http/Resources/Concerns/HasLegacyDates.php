<?php

namespace App\Http\Resources\Concerns;

use Illuminate\Database\Eloquent\Model;

trait HasLegacyDates
{
    protected function withLegacyDates(array $data, Model $model): array
    {
        $data['created_date'] = $model->created_at?->toIso8601String();
        $data['updated_date'] = $model->updated_at?->toIso8601String();

        return $data;
    }
}
