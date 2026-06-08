<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class UnitOfMeasurement extends Model
{
    protected $table = 'units_of_measurement';

    protected $fillable = ['name', 'is_active', 'sort_order'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    public function complaintAffectedProducts(): HasMany
    {
        return $this->hasMany(ComplaintAffectedProduct::class);
    }
}
