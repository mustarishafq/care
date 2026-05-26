<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\V1\Concerns\ManagesLookupEntity;
use App\Http\Controllers\Controller;
use App\Http\Resources\PriorityResource;
use App\Models\Priority;
use Illuminate\Database\Eloquent\Model;

class PriorityController extends Controller
{
    use ManagesLookupEntity;

    protected function lookupModel(): string
    {
        return Priority::class;
    }

    protected function lookupResource(): string
    {
        return PriorityResource::class;
    }

    protected function lookupTable(): string
    {
        return 'priorities';
    }

    protected function storeRules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255', 'unique:priorities,name'],
            'sla_hours' => ['nullable', 'integer', 'min:1'],
            'is_active' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ];
    }

    protected function updateRules(Model $model): array
    {
        return [
            'name' => ['sometimes', 'string', 'max:255', 'unique:priorities,name,'.$model->id],
            'sla_hours' => ['nullable', 'integer', 'min:1'],
            'is_active' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ];
    }
}
