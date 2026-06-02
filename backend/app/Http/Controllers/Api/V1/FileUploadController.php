<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\AuthorizesPermissions;
use App\Http\Controllers\Controller;
use App\Support\StoragePath;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

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

    public function show(string $path): BinaryFileResponse
    {
        $relative = StoragePath::normalize($path);

        if (! Str::startsWith($relative, 'uploads/') || Str::contains($relative, '..')) {
            abort(404);
        }

        if (! Storage::disk('public')->exists($relative)) {
            abort(404);
        }

        return response()->file(Storage::disk('public')->path($relative));
    }
}
