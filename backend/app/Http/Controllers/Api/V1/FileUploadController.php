<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\AuthorizesPermissions;
use App\Http\Controllers\Controller;
use App\Support\StoragePath;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class FileUploadController extends Controller
{
    use AuthorizesPermissions;

    public function upload(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user->hasPermission('complaints.create') && ! $user->hasPermission('complaints.edit')) {
            $this->ensurePermission($user, 'complaints.create');
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
