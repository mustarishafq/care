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

        // Assigned agents always retain access to their tickets.
        if ($visibility === Permissions::COMPLAINT_VISIBILITY_ASSIGNED) {
            return $query->whereHas(
                'assignedUsers',
                fn (Builder $sub) => $sub->where('users.id', $user->id)
            );
        }

        // Department: tickets in the user's department(s), plus any assigned to them.
        $departmentIds = $user->departments()->pluck('departments.id');

        return $query->where(function (Builder $q) use ($user, $departmentIds) {
            $q->whereHas('assignedUsers', fn (Builder $sub) => $sub->where('users.id', $user->id));

            if ($departmentIds->isNotEmpty()) {
                $q->orWhereIn('assigned_department_id', $departmentIds);
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

        if ($visibility === Permissions::COMPLAINT_VISIBILITY_ASSIGNED) {
            throw new HttpResponseException(response()->json([
                'message' => 'You do not have permission to view this ticket.',
            ], 403));
        }

        $departmentIds = $user->departments()->pluck('departments.id');

        if ($complaint->assigned_department_id && $departmentIds->contains($complaint->assigned_department_id)) {
            return;
        }

        throw new HttpResponseException(response()->json([
            'message' => 'You do not have permission to view this ticket.',
        ], 403));
    }
}
