<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Complaint extends Model
{
    protected $fillable = [
        'ticket_id',
        'customer_name',
        'customer_phone',
        'order_number',
        'order_source',
        'complaint_type_id',
        'description',
        'proof_files',
        'courier_id',
        'tracking_number',
        'replacement_tracking_number',
        'priority_id',
        'status_id',
        'assigned_department_id',
        'assigned_user_id',
        'resolution_notes',
        'sla_deadline',
        'sla_paused_at',
        'sla_paused_duration',
        'first_response_at',
        'resolved_at',
        'delivered_at',
        'closed_at',
    ];

    public function affectedProducts(): HasMany
    {
        return $this->hasMany(ComplaintAffectedProduct::class)->orderBy('sort_order');
    }

    public function complaintType(): BelongsTo
    {
        return $this->belongsTo(ComplaintType::class);
    }

    public function complaintStatus(): BelongsTo
    {
        return $this->belongsTo(ComplaintStatus::class, 'status_id');
    }

    public function courier(): BelongsTo
    {
        return $this->belongsTo(Courier::class);
    }

    public function priority(): BelongsTo
    {
        return $this->belongsTo(Priority::class);
    }

    public function assignedDepartment(): BelongsTo
    {
        return $this->belongsTo(Department::class, 'assigned_department_id');
    }

    public function assignedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_user_id');
    }

    public function assignedUsers(): BelongsToMany
    {
        return $this->belongsToMany(User::class)->withTimestamps();
    }

    public function syncPrimaryAssignee(): void
    {
        $firstUserId = $this->assignedUsers()->orderBy('complaint_user.created_at')->value('users.id');

        if ($this->assigned_user_id !== $firstUserId) {
            $this->forceFill(['assigned_user_id' => $firstUserId])->saveQuietly();
        }
    }

    public function ticketActivities(): HasMany
    {
        return $this->hasMany(TicketActivity::class);
    }

    public function internalNotes(): HasMany
    {
        return $this->hasMany(InternalNote::class);
    }

    public function notifications(): HasMany
    {
        return $this->hasMany(Notification::class);
    }

    protected function casts(): array
    {
        return [
            'proof_files' => 'array',
            'sla_deadline' => 'datetime',
            'sla_paused_at' => 'datetime',
            'first_response_at' => 'datetime',
            'resolved_at' => 'datetime',
            'delivered_at' => 'datetime',
            'closed_at' => 'datetime',
        ];
    }
}
