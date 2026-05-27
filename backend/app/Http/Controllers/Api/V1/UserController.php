<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\AuthorizesPermissions;
use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Mail\UserInvitationMail;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class UserController extends Controller
{
    use AuthorizesPermissions;

    public function index(Request $request): AnonymousResourceCollection
    {
        $user = $request->user();
        if (! $user->hasPermission('users.view')
            && ! $user->hasPermission('complaints.assign')
            && ! $user->hasPermission('complaints.add_notes')) {
            $this->ensurePermission($user, 'users.view');
        }

        return UserResource::collection(User::with(['departments', 'role'])->orderBy('full_name')->get());
    }

    public function update(Request $request, string $id): UserResource
    {
        $user = User::findOrFail($id);
        $currentUser = $request->user();

        $this->ensurePermission($currentUser, 'users.manage');

        $data = $request->validate([
            'full_name' => ['sometimes', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'role_id' => ['sometimes', 'integer', 'exists:roles,id'],
            'status' => ['sometimes', 'in:active,inactive'],
            'department_ids' => ['nullable', 'array'],
            'department_ids.*' => ['integer', 'exists:departments,id'],
            'must_change_password' => ['sometimes', 'boolean'],
        ]);

        if (isset($data['role_id']) && ! $currentUser->isAdmin()) {
            unset($data['role_id']);
        }

        if (isset($data['full_name'])) {
            $data['name'] = $data['full_name'];
        }

        $departmentIds = $data['department_ids'] ?? null;
        unset($data['department_ids']);

        $user->update($data);

        if ($departmentIds !== null) {
            $user->departments()->sync($departmentIds);
        }

        return new UserResource($user->fresh()->load(['departments', 'role']));
    }

    public function invite(Request $request): JsonResponse
    {
        $this->ensurePermission($request->user(), 'users.invite');

        $request->validate([
            'email' => ['required', 'email', 'unique:users,email'],
            'role_id' => ['nullable', 'integer', 'exists:roles,id'],
        ]);

        $roleId = $request->input('role_id') ?: Role::defaultId();
        $temporaryPassword = Str::random(12);

        $user = User::create([
            'name' => $request->email,
            'full_name' => $request->email,
            'email' => $request->email,
            'password' => Hash::make($temporaryPassword),
            'role_id' => $roleId,
            'status' => User::STATUS_ACTIVE,
            'approval_status' => User::APPROVAL_APPROVED,
            'must_change_password' => true,
        ]);

        $loginUrl = config('app.frontend_url', config('app.url')).'/login';

        Mail::to($user->email)->send(new UserInvitationMail(
            $user->email,
            $temporaryPassword,
            $loginUrl,
        ));

        return response()->json([
            'message' => 'Invitation sent successfully.',
            'user' => new UserResource($user->load(['departments', 'role'])),
        ], 201);
    }

    public function approve(Request $request, string $id): UserResource
    {
        $this->ensurePermission($request->user(), 'users.manage');

        $user = User::findOrFail($id);
        $user->update([
            'approval_status' => User::APPROVAL_APPROVED,
            'status' => User::STATUS_ACTIVE,
        ]);

        return new UserResource($user->fresh()->load(['departments', 'role']));
    }

    public function reject(Request $request, string $id): UserResource
    {
        $this->ensurePermission($request->user(), 'users.manage');

        $user = User::findOrFail($id);
        $user->update([
            'approval_status' => User::APPROVAL_REJECTED,
            'status' => User::STATUS_INACTIVE,
        ]);

        return new UserResource($user->fresh()->load(['departments', 'role']));
    }

    public function disable(Request $request, string $id): UserResource
    {
        $this->ensurePermission($request->user(), 'users.manage');

        $user = User::findOrFail($id);
        $user->update(['status' => User::STATUS_INACTIVE]);

        return new UserResource($user->fresh()->load(['departments', 'role']));
    }
}
