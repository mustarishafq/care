<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Department extends Model
{
    protected $fillable = [
        'name',
        'is_active',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class);
    }

    public function teams(): HasMany
    {
        return $this->hasMany(Team::class)->orderBy('sort_order');
    }

    public function complaints(): HasMany
    {
        return $this->hasMany(Complaint::class, 'assigned_department_id');
    }

    /**
     * Active, approved users who belong to this department — via the
     * department membership pivot, or as members/leads of its teams.
     *
     * @return \Illuminate\Support\Collection<int, User>
     */
    public function notifiableUsers()
    {
        $userIds = $this->users()->pluck('users.id');

        $activeTeams = $this->teams()->where('is_active', true)->with('users:id')->get();

        if ($activeTeams->isNotEmpty()) {
            $memberIds = $activeTeams->flatMap(fn (Team $team) => $team->users->pluck('id'));
            $leadIds = $activeTeams->pluck('lead_user_id');
            $userIds = $userIds->merge($memberIds)->merge($leadIds);
        }

        $ids = $userIds
            ->map(fn ($id) => (int) $id)
            ->filter(fn ($id) => $id > 0)
            ->unique()
            ->values();

        if ($ids->isEmpty()) {
            return collect();
        }

        return User::query()
            ->whereIn('id', $ids)
            ->where('status', User::STATUS_ACTIVE)
            ->where('approval_status', User::APPROVAL_APPROVED)
            ->get();
    }
}
