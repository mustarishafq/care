<?php

namespace App\Models;

use App\Support\Permissions;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

#[Fillable([
    'name',
    'full_name',
    'email',
    'nexus_sso_id',
    'phone',
    'password',
    'role_id',
    'status',
    'approval_status',
    'must_change_password',
])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    public const APPROVAL_PENDING = 'pending';

    public const APPROVAL_APPROVED = 'approved';

    public const APPROVAL_REJECTED = 'rejected';

    public const STATUS_ACTIVE = 'active';

    public const STATUS_INACTIVE = 'inactive';

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'must_change_password' => 'boolean',
        ];
    }

    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class);
    }

    public function departments(): BelongsToMany
    {
        return $this->belongsToMany(Department::class);
    }

    public function isAdmin(): bool
    {
        return (bool) $this->role?->is_admin;
    }

    public function getRoleLabel(): string
    {
        return $this->role?->name ?? 'Viewer';
    }

    public function getDefaultPage(): string
    {
        $page = $this->role?->default_page;

        if (is_string($page) && $page !== '' && in_array($page, Permissions::defaultPagePaths(), true)) {
            return $page;
        }

        return '/dashboard';
    }

    /**
     * @return list<string>|'*'
     */
    public function getPermissions(): array|string
    {
        if ($this->isAdmin()) {
            return '*';
        }

        if (! $this->role || $this->role->is_active === false) {
            return [];
        }

        return $this->role->permissions ?? [];
    }

    public function hasPermission(string $permission): bool
    {
        $permissions = $this->getPermissions();

        if ($permissions === '*') {
            return true;
        }

        if (in_array($permission, $permissions, true)) {
            return true;
        }

        if (str_ends_with($permission, '.view')) {
            $section = explode('.', $permission)[0];

            return in_array("{$section}.manage", $permissions, true);
        }

        return false;
    }

    public function canLogin(): bool
    {
        return $this->approval_status === self::APPROVAL_APPROVED
            && $this->status === self::STATUS_ACTIVE;
    }
}
