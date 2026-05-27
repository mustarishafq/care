<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\ForgotPasswordRequest;
use App\Http\Requests\Api\V1\LoginRequest;
use App\Http\Requests\Api\V1\RegisterRequest;
use App\Http\Requests\Api\V1\ResetPasswordRequest;
use App\Http\Resources\UserResource;
use App\Services\AuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function __construct(private AuthService $authService) {}

    public function register(RegisterRequest $request): JsonResponse
    {
        $user = $this->authService->register($request->validated());

        return response()->json([
            'message' => 'Registration successful. Your account is pending admin approval.',
            'user' => new UserResource($user->load(['departments', 'role'])),
        ], 201);
    }

    public function login(LoginRequest $request): JsonResponse
    {
        $result = $this->authService->login(
            $request->validated('email'),
            $request->validated('password'),
        );

        return response()->json([
            'token' => $result['token'],
            'user' => new UserResource($result['user']->load(['departments', 'role'])),
        ]);
    }

    public function me(Request $request): UserResource
    {
        return new UserResource($request->user()->load(['departments', 'role']));
    }

    public function updateMe(Request $request): UserResource
    {
        $data = $request->validate([
            'full_name' => ['sometimes', 'string', 'max:255'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:50'],
            'password' => ['sometimes', 'string', 'min:8', 'confirmed'],
            'must_change_password' => ['sometimes', 'boolean'],
        ]);

        $user = $request->user();

        if (isset($data['full_name'])) {
            $user->full_name = $data['full_name'];
            $user->name = $data['full_name'];
        }

        if (array_key_exists('phone', $data)) {
            $user->phone = $data['phone'];
        }

        if (isset($data['password'])) {
            if (! $user->must_change_password) {
                $request->validate([
                    'current_password' => ['required', 'string'],
                ]);

                if (! Hash::check($request->input('current_password'), $user->password)) {
                    throw ValidationException::withMessages([
                        'current_password' => ['The current password is incorrect.'],
                    ]);
                }
            }

            $user->password = $data['password'];
            $user->must_change_password = false;
        }

        if (isset($data['must_change_password'])) {
            $user->must_change_password = $data['must_change_password'];
        }

        $user->save();

        return new UserResource($user->fresh()->load('departments'));
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()?->delete();

        return response()->json(['message' => 'Logged out successfully.']);
    }

    public function forgotPassword(ForgotPasswordRequest $request): JsonResponse
    {
        $message = $this->authService->sendPasswordResetLink($request->validated('email'));

        return response()->json(['message' => $message]);
    }

    public function resetPassword(ResetPasswordRequest $request): JsonResponse
    {
        $message = $this->authService->resetPassword($request->validated());

        return response()->json(['message' => $message]);
    }
}
