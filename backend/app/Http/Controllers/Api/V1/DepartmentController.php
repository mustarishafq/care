<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\AppliesEntityQueries;
use App\Http\Controllers\Concerns\AuthorizesPermissions;
use App\Http\Controllers\Controller;
use App\Http\Resources\DepartmentResource;
use App\Models\Department;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class DepartmentController extends Controller
{
    use AppliesEntityQueries, AuthorizesPermissions;

    public function index(Request $request): AnonymousResourceCollection
    {
        $user = $request->user();
        if (! $user->hasPermission('settings.view') && ! $user->hasPermission('users.view')) {
            $this->ensurePermission($user, 'complaints.view');
        }

        $query = Department::query()->where('is_active', true);
        $this->applyFilters($query, $request->except(['sort', 'limit']));
        $this->applySort($query, $request->query('sort', 'sort_order'));

        if ($limit = $request->integer('limit')) {
            $query->limit($limit);
        }

        return DepartmentResource::collection($query->get());
    }

    public function store(Request $request): DepartmentResource
    {
        $this->ensurePermission($request->user(), 'settings.manage');

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255', 'unique:departments,name'],
            'is_active' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        return new DepartmentResource(Department::create($data));
    }

    public function update(Request $request, string $id): DepartmentResource
    {
        $this->ensurePermission($request->user(), 'settings.manage');

        $department = Department::findOrFail($id);
        $department->update($request->validate([
            'name' => ['sometimes', 'string', 'max:255', 'unique:departments,name,'.$department->id],
            'is_active' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]));

        return new DepartmentResource($department->fresh());
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $this->ensurePermission($request->user(), 'settings.manage');

        $department = Department::findOrFail($id);
        $department->update(['is_active' => false]);

        return response()->json(['message' => 'Department deactivated successfully.']);
    }
}
