<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\V1\Concerns\ManagesLookupEntity;
use App\Http\Controllers\Concerns\AppliesEntityQueries;
use App\Http\Controllers\Concerns\AuthorizesPermissions;
use App\Http\Controllers\Controller;
use App\Http\Resources\ComplaintStatusResource;
use App\Models\ComplaintStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ComplaintStatusController extends Controller
{
    use AppliesEntityQueries, AuthorizesPermissions, ManagesLookupEntity {
        ManagesLookupEntity::index as protected lookupIndex;
    }

    public function index(Request $request): AnonymousResourceCollection
    {
        if ($request->user()) {
            return $this->lookupIndex($request);
        }

        $query = ComplaintStatus::query()->where('is_active', true);
        $this->applyFilters($query, $request->except(['sort', 'limit']));
        $this->applySort($query, $request->query('sort', 'sort_order'));

        if ($limit = $request->integer('limit')) {
            $query->limit($limit);
        }

        return ComplaintStatusResource::collection($query->get());
    }

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
            'color' => ['nullable', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'is_active' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ];
    }

    protected function updateRules(Model $model): array
    {
        return [
            'name' => ['sometimes', 'string', 'max:255', 'unique:complaint_statuses,name,'.$model->id],
            'color' => ['nullable', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'is_active' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ];
    }
}
