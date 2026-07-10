<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\AppliesEntityQueries;
use App\Http\Controllers\Concerns\AuthorizesPermissions;
use App\Http\Controllers\Controller;
use App\Http\Resources\RoleResource;
use App\Models\Role;
use App\Support\Permissions;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

class RoleController extends Controller
{
    use AppliesEntityQueries, AuthorizesPermissions;

    public function meta(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user->hasPermission('users.manage') && ! $user->hasPermission('users.invite')) {
            $this->ensurePermission($user, 'users.manage');
        }

        return response()->json([
            'permissions' => Permissions::catalog(),
            'default_pages' => Permissions::defaultPages(),
        ]);
    }

    public function index(Request $request): AnonymousResourceCollection
    {
        $user = $request->user();
        if (! $user->hasPermission('users.manage') && ! $user->hasPermission('users.invite')) {
            $this->ensurePermission($user, 'users.manage');
        }

        $query = Role::query();
        $this->applyFilters($query, $request->except(['sort', 'limit']));
        $this->applySort($query, $request->query('sort', 'sort_order'));

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
            'permissions.*' => ['string', Rule::in(Permissions::allKeys())],
            'default_page' => ['nullable', 'string', Rule::in(Permissions::defaultPagePaths())],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $data['is_system'] = false;
        $data['is_admin'] = false;
        $data['default_page'] = $data['default_page'] ?? '/dashboard';

        return new RoleResource(Role::create($data));
    }

    public function update(Request $request, string $id): RoleResource
    {
        $this->ensurePermission($request->user(), 'users.manage');

        $role = Role::findOrFail($id);
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'permissions' => ['nullable', 'array'],
            'permissions.*' => ['string', Rule::in(Permissions::allKeys())],
            'default_page' => ['nullable', 'string', Rule::in(Permissions::defaultPagePaths())],
            'is_active' => ['nullable', 'boolean'],
        ]);

        if ($role->is_system) {
            unset($data['is_active']);
        }

        $role->update($data);

        return new RoleResource($role->fresh());
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $this->ensurePermission($request->user(), 'users.manage');

        $role = Role::findOrFail($id);

        if ($role->is_system) {
            throw new HttpResponseException(response()->json([
                'message' => 'System roles cannot be deleted.',
            ], 422));
        }

        if ($role->users()->exists()) {
            throw new HttpResponseException(response()->json([
                'message' => 'Cannot delete a role that is assigned to users.',
            ], 422));
        }

        $role->delete();

        return response()->json(['message' => 'Role deleted successfully.']);
    }
}
