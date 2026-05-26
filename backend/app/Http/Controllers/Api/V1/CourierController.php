<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\V1\Concerns\ManagesLookupEntity;
use App\Http\Controllers\Controller;
use App\Http\Resources\CourierResource;
use App\Models\Courier;
use Illuminate\Database\Eloquent\Model;

class CourierController extends Controller
{
    use ManagesLookupEntity;

    protected function lookupModel(): string
    {
        return Courier::class;
    }

    protected function lookupResource(): string
    {
        return CourierResource::class;
    }

    protected function lookupTable(): string
    {
        return 'couriers';
    }

    protected function storeRules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255', 'unique:couriers,name'],
            'is_active' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ];
    }

    protected function updateRules(Model $model): array
    {
        return [
            'name' => ['sometimes', 'string', 'max:255', 'unique:couriers,name,'.$model->id],
            'is_active' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ];
    }
}
