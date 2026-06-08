<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\AuthorizesPermissions;
use App\Http\Controllers\Controller;
use App\Support\StoragePath;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class FileUploadController extends Controller
{
    use AuthorizesPermissions;

    public function upload(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user->hasPermission('complaints.create') && ! $user->hasPermission('complaints.edit')) {
            $this->ensurePermission($user, 'complaints.create');
        }

        if (
            ! $request->hasFile('file')
            && str_contains((string) $request->header('Content-Type'), 'multipart/form-data')
        ) {
            throw ValidationException::withMessages([
                'file' => ['The file is too large or could not be uploaded. Maximum size is 10 MB.'],
            ]);
        }

        $request->validate([
            'file' => ['required', 'file', 'max:10240'],
        ]);

        $file = $request->file('file');
        $filename = Str::uuid().'.'.$file->getClientOriginalExtension();
        $path = $file->storeAs('uploads', $filename, 'public');

        return response()->json([
            'path' => $path,
            'url' => StoragePath::url($path),
        ]);
    }
}
