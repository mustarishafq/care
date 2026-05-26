<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\AppliesEntityQueries;
use App\Http\Controllers\Concerns\AuthorizesPermissions;
use App\Http\Controllers\Controller;
use App\Http\Resources\RoleResource;
use App\Models\Role;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class RoleController extends Controller
{
    use AppliesEntityQueries, AuthorizesPermissions;

    public function index(Request $request): AnonymousResourceCollection
    {
        $this->ensurePermission($request->user(), 'users.manage');

        $query = Role::query();
        $this->applyFilters($query, $request->except(['sort', 'limit']));
        $this->applySort($query, $request->query('sort', '-created_date'));

        if ($limit = $request->integer('limit')) {
            $query->limit($limit);
        }

        return RoleResource::collection($query->get());
    }

    public function store(Request $request): RoleResource
    {
        $this->ensurePermission($request->user(), 'users.manage');

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'permissions' => ['nullable', 'array'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        return new RoleResource(Role::create($data));
    }

    public function update(Request $request, string $id): RoleResource
    {
        $this->ensurePermission($request->user(), 'users.manage');

        $role = Role::findOrFail($id);
        $role->update($request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'permissions' => ['nullable', 'array'],
            'is_active' => ['nullable', 'boolean'],
        ]));

        return new RoleResource($role->fresh());
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $this->ensurePermission($request->user(), 'users.manage');

        Role::findOrFail($id)->delete();

        return response()->json(['message' => 'Deleted successfully.']);
    }
}
