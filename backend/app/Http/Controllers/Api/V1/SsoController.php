<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\Role;
use App\Models\SystemConfig;
use App\Models\User;
use App\Support\SsoRedirect;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class SsoController extends Controller
{
    public function verify(Request $request): JsonResponse
    {
        $data = $request->validate([
            'token' => ['required', 'string'],
        ]);

        $config = SystemConfig::where('key', 'nexus_sso')->first();
        $ssoSettings = $config?->json_value ?? [];

        if (empty($ssoSettings['enabled']) || empty($ssoSettings['secret'])) {
            return response()->json(['message' => 'SSO is not configured.'], 422);
        }

        $parts = explode('.', $data['token']);
        if (count($parts) !== 3) {
            return response()->json(['message' => 'Invalid token format.'], 422);
        }

        [$header, $payload, $signature] = $parts;
        $expectedSignature = rtrim(strtr(base64_encode(
            hash_hmac('sha256', "$header.$payload", $ssoSettings['secret'], true)
        ), '+/', '-_'), '=');

        if (! hash_equals($expectedSignature, $signature)) {
            return response()->json(['message' => 'Invalid token signature.'], 401);
        }

        $claims = json_decode(base64_decode(strtr($payload, '-_', '+/')), true);

        if (! $claims || ($claims['exp'] ?? 0) < time()) {
            return response()->json(['message' => 'Token has expired.'], 401);
        }

        if (! empty($ssoSettings['issuer']) && ($claims['iss'] ?? '') !== $ssoSettings['issuer']) {
            return response()->json(['message' => 'Invalid token issuer.'], 401);
        }

        $ssoId = $this->extractNexusUserId($claims);
        $email = $this->extractEmail($claims);

        if (! $ssoId) {
            return response()->json(['message' => 'Token missing sub claim (Nexus user ID).'], 422);
        }

        if (! $email) {
            return response()->json(['message' => 'Token missing email claim.'], 422);
        }

        $defaultRoleId = $ssoSettings['default_role_id'] ?? null;
        if (! $defaultRoleId && ! empty($ssoSettings['default_role'])) {
            $defaultRoleId = Role::idForSlug($ssoSettings['default_role']);
        }
        if (! $defaultRoleId) {
            $defaultRoleId = Role::defaultId();
        }

        $displayName = trim((string) ($claims['name'] ?? ''));
        if ($displayName === '') {
            $displayName = $email;
        }

        $user = User::where('nexus_sso_id', $ssoId)->first();

        if (! $user) {
            $user = User::where('email', $email)->first();
        }

        if ($user) {
            $user->update([
                'nexus_sso_id' => $ssoId,
                'name' => $displayName,
                'full_name' => $displayName,
                'email' => $email,
            ]);
        } else {
            $user = User::create([
                'email' => $email,
                'nexus_sso_id' => $ssoId,
                'name' => $displayName,
                'full_name' => $displayName,
                'password' => Hash::make(bin2hex(random_bytes(32))),
                'role_id' => $defaultRoleId,
                'status' => User::STATUS_ACTIVE,
                'approval_status' => User::APPROVAL_APPROVED,
            ]);
        }

        if (! $user->canLogin()) {
            return response()->json(['message' => 'User account is not active.'], 403);
        }

        $token = $user->createToken('sso-token')->plainTextToken;

        $user->load(['departments', 'role']);
        $explicitRedirect = trim((string) ($claims['redirect_to'] ?? ''));
        $redirectTo = $explicitRedirect !== ''
            ? SsoRedirect::sanitize($explicitRedirect, $user->getDefaultPage())
            : $user->getDefaultPage();

        return response()->json([
            'token' => $token,
            'user' => new UserResource($user),
            'redirect_to' => $redirectTo,
        ]);
    }

    /** @param  array<string, mixed>  $claims */
    private function extractNexusUserId(array $claims): ?string
    {
        $sub = trim((string) ($claims['sub'] ?? ''));

        return $sub !== '' ? $sub : null;
    }

    /** @param  array<string, mixed>  $claims */
    private function extractEmail(array $claims): ?string
    {
        $email = trim((string) ($claims['email'] ?? ''));

        if ($email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return $email;
        }

        return null;
    }
}
