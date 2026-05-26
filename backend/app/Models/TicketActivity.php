<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TicketActivity extends Model
{
    protected $fillable = [
        'complaint_id',
        'action_type',
        'description',
        'old_value',
        'new_value',
        'user_email',
        'user_name',
    ];
}
