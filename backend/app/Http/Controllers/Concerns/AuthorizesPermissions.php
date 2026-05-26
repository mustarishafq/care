<?php

namespace App\Http\Controllers\Concerns;

use App\Models\User;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\JsonResponse;

trait AuthorizesPermissions
{
    protected function ensurePermission(User $user, string $permission): void
    {
        if (! $user->hasPermission($permission)) {
            throw new HttpResponseException(response()->json([
                'message' => 'You do not have permission to perform this action.',
            ], 403));
        }
    }

    /**
     * @param  array<string, mixed>  $data
     */
    protected function ensureComplaintUpdatePermissions(User $user, array $data): void
    {
        if ($user->isAdmin()) {
            return;
        }

        $statusSideEffectFields = [
            'first_response_at', 'resolved_at', 'closed_at', 'sla_paused_at', 'sla_paused_duration',
        ];

        if ((isset($data['status']) || isset($data['status_id'])) && ! $user->hasPermission('complaints.change_status')) {
            throw new HttpResponseException(response()->json([
                'message' => 'You do not have permission to change complaint status.',
            ], 403));
        }

        $assignFields = ['assigned_department_id', 'assigned_user', 'assigned_user_name'];
        $hasAssignChange = ! empty(array_intersect(array_keys($data), $assignFields));
        if ($hasAssignChange && ! $user->hasPermission('complaints.assign')) {
            throw new HttpResponseException(response()->json([
                'message' => 'You do not have permission to assign complaints.',
            ], 403));
        }

        $editFields = array_diff(
            array_keys($data),
            array_merge(['status', 'status_id'], $assignFields, $statusSideEffectFields)
        );

        if (! empty($editFields) && ! $user->hasPermission('complaints.edit')) {
            throw new HttpResponseException(response()->json([
                'message' => 'You do not have permission to edit complaints.',
            ], 403));
        }
    }
}
