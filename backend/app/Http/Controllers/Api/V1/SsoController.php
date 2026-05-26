<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\SystemConfig;
use App\Models\User;
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

        $email = $claims['email'] ?? $claims['sub'] ?? null;
        if (! $email) {
            return response()->json(['message' => 'Token missing email claim.'], 422);
        }

        $user = User::firstOrCreate(
            ['email' => $email],
            [
                'name' => $claims['name'] ?? $email,
                'full_name' => $claims['name'] ?? $email,
                'password' => Hash::make(bin2hex(random_bytes(32))),
                'role' => $ssoSettings['default_role'] ?? 'viewer',
                'status' => User::STATUS_ACTIVE,
                'approval_status' => User::APPROVAL_APPROVED,
            ]
        );

        if (! $user->canLogin()) {
            return response()->json(['message' => 'User account is not active.'], 403);
        }

        $token = $user->createToken('sso-token')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => new UserResource($user->load('departments')),
        ]);
    }
}
