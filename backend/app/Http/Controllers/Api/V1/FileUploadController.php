<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\AuthorizesPermissions;
use App\Http\Controllers\Controller;
use App\Support\StoragePath;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

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

    public function show(Request $request, string $name, string $ext): StreamedResponse
    {
        $relative = StoragePath::normalize("uploads/{$name}.{$ext}");

        if (! Str::startsWith($relative, 'uploads/') || Str::contains($relative, '..')) {
            abort(404);
        }

        if (! Storage::disk('public')->exists($relative)) {
            abort(404);
        }

        $absolute = storage_path('app/public/'.$relative);

        if (! is_readable($absolute)) {
            abort(404);
        }

        $headers = [
            'Content-Type' => $this->mimeForExtension($ext),
            'Content-Length' => (string) filesize($absolute),
            'Cache-Control' => 'public, max-age=2592000',
        ];

        return response()->stream(function () use ($absolute) {
            $stream = fopen($absolute, 'rb');
            if ($stream === false) {
                return;
            }
            fpassthru($stream);
            fclose($stream);
        }, 200, $headers);
    }

    private function mimeForExtension(string $ext): string
    {
        return match (strtolower($ext)) {
            'jpg', 'jpeg' => 'image/jpeg',
            'png' => 'image/png',
            'gif' => 'image/gif',
            'webp' => 'image/webp',
            'pdf' => 'application/pdf',
            'mp4' => 'video/mp4',
            'doc' => 'application/msword',
            'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            default => 'application/octet-stream',
        };
    }
}
