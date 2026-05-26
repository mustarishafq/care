<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserIsApproved
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        if ($user->approval_status !== 'approved') {
            return response()->json([
                'message' => 'Your account is pending admin approval.',
                'approval_status' => $user->approval_status,
            ], 403);
        }

        if ($user->status !== 'active') {
            return response()->json([
                'message' => 'Your account has been disabled.',
                'status' => $user->status,
            ], 403);
        }

        return $next($request);
    }
}
