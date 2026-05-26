<?php

namespace App\Http\Controllers\Api\V1\Concerns;

use App\Http\Controllers\Concerns\AppliesEntityQueries;
use App\Http\Controllers\Concerns\AuthorizesPermissions;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Resources\Json\JsonResource;

trait ManagesLookupEntity
{
    use AppliesEntityQueries, AuthorizesPermissions;

    /** @return class-string<Model> */
    abstract protected function lookupModel(): string;

    /** @return class-string<JsonResource> */
    abstract protected function lookupResource(): string;

    abstract protected function lookupTable(): string;

    /** @return array<string, list<string>> */
    abstract protected function storeRules(): array;

    /** @return array<string, list<string>> */
    abstract protected function updateRules(Model $model): array;

    public function index(Request $request): AnonymousResourceCollection
    {
        $user = $request->user();
        if (! $user->hasPermission('settings.view')) {
            $this->ensurePermission($user, 'complaints.view');
        }

        $query = $this->lookupModel()::query()->where('is_active', true);
        $this->applyFilters($query, $request->except(['sort', 'limit']));
        $this->applySort($query, $request->query('sort', 'sort_order'));

        if ($limit = $request->integer('limit')) {
            $query->limit($limit);
        }

        $resource = $this->lookupResource();

        return $resource::collection($query->get());
    }

    public function store(Request $request): JsonResource
    {
        $this->ensurePermission($request->user(), 'settings.manage');

        $resource = $this->lookupResource();

        return new $resource($this->lookupModel()::create($request->validate($this->storeRules())));
    }

    public function update(Request $request, string $id): JsonResource
    {
        $this->ensurePermission($request->user(), 'settings.manage');

        $model = $this->lookupModel()::findOrFail($id);
        $model->update($request->validate($this->updateRules($model)));
        $resource = $this->lookupResource();

        return new $resource($model->fresh());
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $this->ensurePermission($request->user(), 'settings.manage');

        $this->lookupModel()::findOrFail($id)->update(['is_active' => false]);

        return response()->json(['message' => 'Deactivated successfully.']);
    }
}
