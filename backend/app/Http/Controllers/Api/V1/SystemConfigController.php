<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\AppliesEntityQueries;
use App\Http\Controllers\Concerns\AuthorizesPermissions;
use App\Http\Controllers\Controller;
use App\Http\Resources\SystemConfigResource;
use App\Models\SystemConfig;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class SystemConfigController extends Controller
{
    use AppliesEntityQueries, AuthorizesPermissions;

    public function index(Request $request): AnonymousResourceCollection
    {
        $this->ensurePermission($request->user(), 'settings.view');

        $query = SystemConfig::query();
        $this->applyFilters($query, $request->except(['sort', 'limit']));
        $this->applySort($query, $request->query('sort', 'key'));

        return SystemConfigResource::collection($query->get());
    }

    public function store(Request $request): SystemConfigResource
    {
        $this->ensurePermission($request->user(), 'settings.manage');

        $data = $request->validate([
            'key' => ['required', 'string', 'max:255', 'unique:system_configs,key'],
            'label' => ['nullable', 'string', 'max:255'],
            'value' => ['nullable', 'array'],
            'json_value' => ['nullable', 'array'],
        ]);

        return new SystemConfigResource(SystemConfig::create($data));
    }

    public function update(Request $request, string $id): SystemConfigResource
    {
        $this->ensurePermission($request->user(), 'settings.manage');

        $config = SystemConfig::findOrFail($id);
        $config->update($request->validate([
            'label' => ['nullable', 'string', 'max:255'],
            'value' => ['nullable', 'array'],
            'json_value' => ['nullable', 'array'],
        ]));

        return new SystemConfigResource($config->fresh());
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $this->ensurePermission($request->user(), 'settings.manage');

        SystemConfig::findOrFail($id)->delete();

        return response()->json(['message' => 'Deleted successfully.']);
    }
}
