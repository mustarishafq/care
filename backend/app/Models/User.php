<?php

namespace App\Models;

use App\Support\Permissions;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
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
    'phone',
    'password',
    'role',
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

    public function departments(): BelongsToMany
    {
        return $this->belongsToMany(Department::class);
    }

    public function isAdmin(): bool
    {
        return in_array($this->role, Permissions::ADMIN_ROLES, true);
    }

    public function getRoleLabel(): string
    {
        $role = $this->role;
        if (! $role) {
            return Permissions::BUILTIN_ROLE_LABELS['viewer'];
        }

        if (isset(Permissions::BUILTIN_ROLE_LABELS[$role])) {
            return Permissions::BUILTIN_ROLE_LABELS[$role];
        }

        $customRole = Role::query()->find($role);
        if ($customRole) {
            return $customRole->name;
        }

        $customRoleByName = Role::query()->where('name', $role)->first();
        if ($customRoleByName) {
            return $customRoleByName->name;
        }

        return $role;
    }

    /**
     * @return list<string>|'*'
     */
    public function getPermissions(): array|string
    {
        if ($this->isAdmin()) {
            return '*';
        }

        $role = $this->role;
        if (! $role) {
            return [];
        }

        if (isset(Permissions::BUILTIN_ROLE_PERMISSIONS[$role])) {
            return Permissions::BUILTIN_ROLE_PERMISSIONS[$role];
        }

        $customRole = Role::query()->find($role);
        if ($customRole && $customRole->is_active !== false) {
            return $customRole->permissions ?? [];
        }

        return [];
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

        // e.g. products.manage implies products.view
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
