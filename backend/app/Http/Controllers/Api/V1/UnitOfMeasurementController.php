<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\V1\Concerns\ManagesLookupEntity;
use App\Http\Controllers\Controller;
use App\Http\Resources\UnitOfMeasurementResource;
use App\Models\UnitOfMeasurement;
use Illuminate\Database\Eloquent\Model;

class UnitOfMeasurementController extends Controller
{
    use ManagesLookupEntity;

    protected function lookupModel(): string
    {
        return UnitOfMeasurement::class;
    }

    protected function lookupResource(): string
    {
        return UnitOfMeasurementResource::class;
    }

    protected function lookupTable(): string
    {
        return 'units_of_measurement';
    }

    protected function storeRules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255', 'unique:units_of_measurement,name'],
            'is_active' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ];
    }

    protected function updateRules(Model $model): array
    {
        return [
            'name' => ['sometimes', 'string', 'max:255', 'unique:units_of_measurement,name,'.$model->id],
            'is_active' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ];
    }
}
