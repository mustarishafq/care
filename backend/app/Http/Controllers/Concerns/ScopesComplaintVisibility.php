<?php

namespace App\Http\Controllers\Concerns;

use App\Models\Complaint;
use App\Models\User;
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
        if ($user->isAdmin()) {
            return $query;
        }

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
        if ($user->isAdmin()) {
            return;
        }

        if ($complaint->assignedUsers()->where('users.id', $user->id)->exists()) {
            return;
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
