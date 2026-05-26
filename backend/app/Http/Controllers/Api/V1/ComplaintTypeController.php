<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\V1\Concerns\ManagesLookupEntity;
use App\Http\Controllers\Controller;
use App\Http\Resources\ComplaintTypeResource;
use App\Models\ComplaintType;
use Illuminate\Database\Eloquent\Model;

class ComplaintTypeController extends Controller
{
    use ManagesLookupEntity;

    protected function lookupModel(): string
    {
        return ComplaintType::class;
    }

    protected function lookupResource(): string
    {
        return ComplaintTypeResource::class;
    }

    protected function lookupTable(): string
    {
        return 'complaint_types';
    }

    protected function storeRules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255', 'unique:complaint_types,name'],
            'is_active' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ];
    }

    protected function updateRules(Model $model): array
    {
        return [
            'name' => ['sometimes', 'string', 'max:255', 'unique:complaint_types,name,'.$model->id],
            'is_active' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ];
    }
}
