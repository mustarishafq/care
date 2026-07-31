<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Team extends Model
{
    protected $fillable = [
        'department_id',
        'name',
        'lead_user_id',
        'is_active',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function lead(): BelongsTo
    {
        return $this->belongsTo(User::class, 'lead_user_id');
    }

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class);
    }

    /**
     * Sync members and ensure they belong to the parent department.
     * The lead is always included in the member set when set.
     *
     * @param  list<int|string>  $memberIds
     */
    public function syncMembers(array $memberIds): void
    {
        $ids = collect($memberIds)
            ->map(fn ($id) => (int) $id)
            ->filter(fn ($id) => $id > 0)
            ->unique()
            ->values();

        if ($this->lead_user_id) {
            $ids = $ids->push((int) $this->lead_user_id)->unique()->values();
        }

        $this->users()->sync($ids->all());

        if ($ids->isNotEmpty() && $this->department_id) {
            $department = $this->department()->first();
            if ($department) {
                $department->users()->syncWithoutDetaching($ids->all());
            }
        }
    }
}
