<?php

namespace App\Http\Controllers\Concerns;

use App\Models\Complaint;
use App\Models\User;
use App\Support\Permissions;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Exceptions\HttpResponseException;

trait ScopesComplaintVisibility
{
    /**
     * @param  Builder<Complaint>  $query
     * @return Builder<Complaint>
     */
    protected function applyComplaintVisibilityScope(Builder $query, User $user): Builder
    {
        $visibility = $user->getComplaintVisibility();

        if ($visibility === Permissions::COMPLAINT_VISIBILITY_ALL) {
            return $query;
        }

        $ledMemberIds = $user->ledTeamMemberIds();

        return $query->where(function (Builder $outer) use ($user, $visibility, $ledMemberIds) {
            // Assigned agents always retain access to their tickets.
            $outer->whereHas(
                'assignedUsers',
                fn (Builder $sub) => $sub->where('users.id', $user->id)
            );

            if ($visibility === Permissions::COMPLAINT_VISIBILITY_DEPARTMENT) {
                $departmentIds = $user->accessibleDepartmentIds();

                if ($departmentIds !== []) {
                    $outer->orWhereIn('assigned_department_id', $departmentIds);
                }
            }

            // Team leads see tickets assigned to or created by their team members.
            if ($ledMemberIds !== []) {
                $outer->orWhereHas(
                    'assignedUsers',
                    fn (Builder $sub) => $sub->whereIn('users.id', $ledMemberIds)
                )->orWhereIn('created_by_user_id', $ledMemberIds);
            }
        });
    }

    protected function ensureCanViewComplaint(User $user, Complaint $complaint): void
    {
        $visibility = $user->getComplaintVisibility();

        if ($visibility === Permissions::COMPLAINT_VISIBILITY_ALL) {
            return;
        }

        if ($complaint->assignedUsers()->where('users.id', $user->id)->exists()) {
            return;
        }

        if ($visibility === Permissions::COMPLAINT_VISIBILITY_DEPARTMENT) {
            $departmentIds = $user->accessibleDepartmentIds();

            if ($complaint->assigned_department_id && in_array((int) $complaint->assigned_department_id, $departmentIds, true)) {
                return;
            }
        }

        $ledMemberIds = $user->ledTeamMemberIds();

        if ($ledMemberIds !== []) {
            if ($complaint->created_by_user_id && in_array((int) $complaint->created_by_user_id, $ledMemberIds, true)) {
                return;
            }

            if ($complaint->assignedUsers()->whereIn('users.id', $ledMemberIds)->exists()) {
                return;
            }
        }

        throw new HttpResponseException(response()->json([
            'message' => 'You do not have permission to view this ticket.',
        ], 403));
    }
}
