<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\V1\Concerns\ManagesLookupEntity;
use App\Http\Controllers\Controller;
use App\Http\Resources\ComplaintStatusResource;
use App\Models\ComplaintStatus;
use Illuminate\Database\Eloquent\Model;

class ComplaintStatusController extends Controller
{
    use ManagesLookupEntity;

    protected function lookupModel(): string
    {
        return ComplaintStatus::class;
    }

    protected function lookupResource(): string
    {
        return ComplaintStatusResource::class;
    }

    protected function lookupTable(): string
    {
        return 'complaint_statuses';
    }

    protected function storeRules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255', 'unique:complaint_statuses,name'],
            'is_active' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ];
    }

    protected function updateRules(Model $model): array
    {
        return [
            'name' => ['sometimes', 'string', 'max:255', 'unique:complaint_statuses,name,'.$model->id],
            'is_active' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ];
    }
}
