<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ProfilePictureSyncService
{
    private const CLAIM_KEYS = [
        'profile_picture',
        'profilePicture',
        'avatar_url',
        'picture',
        'avatar',
    ];

    private const MIME_EXTENSIONS = [
        'image/jpeg' => 'jpg',
        'image/jpg' => 'jpg',
        'image/png' => 'png',
        'image/gif' => 'gif',
        'image/webp' => 'webp',
    ];

    private const MIN_BYTES = 64;

    private const MAX_BYTES = 5_242_880; // 5 MB

    /**
     * @param  array<string, mixed>  $payload
     */
    public function extractClaim(array $payload): string
    {
        foreach (self::CLAIM_KEYS as $key) {
            $value = trim((string) ($payload[$key] ?? ''));
            if ($value !== '') {
                return $value;
            }
        }

        return '';
    }

    /**
     * Download and cache a profile picture locally. Returns a stored path
     * (`/storage/profile-pictures/...`) or the resolved remote URL as fallback.
     * Empty string means nothing usable was produced.
     */
    public function sync(string $claim, ?string $issuer = null): string
    {
        $sourceUrl = $this->resolveSourceUrl($claim, $issuer);
        if ($sourceUrl === '') {
            return '';
        }

        try {
            $response = Http::timeout(10)
                ->withHeaders(['Accept' => 'image/*,*/*'])
                ->get($sourceUrl);

            if (! $response->successful()) {
                return $sourceUrl;
            }

            $body = $response->body();
            if (strlen($body) < self::MIN_BYTES || strlen($body) > self::MAX_BYTES) {
                return $sourceUrl;
            }

            $mime = $this->detectImageMime($body, $response->header('Content-Type'));
            if ($mime === null) {
                return $sourceUrl;
            }

            $extension = self::MIME_EXTENSIONS[$mime];
            $filename = Str::random(40).'.'.$extension;
            $diskPath = 'profile-pictures/'.$filename;

            Storage::disk('public')->put($diskPath, $body);

            return '/storage/'.$diskPath;
        } catch (\Throwable $e) {
            Log::warning('Failed to sync Nexus profile picture', [
                'source' => $sourceUrl,
                'error' => $e->getMessage(),
            ]);

            return $sourceUrl;
        }
    }

    public function resolveSourceUrl(string $claim, ?string $issuer = null): string
    {
        $claim = trim($claim);
        if ($claim === '') {
            return '';
        }

        $nexusBase = rtrim((string) config('services.nexus.base_url', ''), '/');
        $issuerBase = rtrim((string) ($issuer ?: ''), '/');

        if (Str::startsWith($claim, ['http://', 'https://'])) {
            $path = parse_url($claim, PHP_URL_PATH) ?? '';
            if ($nexusBase !== '' && is_string($path) && Str::startsWith($path, '/storage/')) {
                return $nexusBase.$path;
            }

            return $claim;
        }

        $path = '/'.ltrim($claim, '/');

        if (Str::startsWith($path, '/storage/') && $nexusBase !== '') {
            return $nexusBase.$path;
        }

        if ($issuerBase !== '') {
            return $issuerBase.$path;
        }

        if ($nexusBase !== '') {
            return $nexusBase.$path;
        }

        return '';
    }

    private function detectImageMime(string $body, ?string $contentType): ?string
    {
        $finfo = new \finfo(FILEINFO_MIME_TYPE);
        $detected = $finfo->buffer($body) ?: '';

        if (isset(self::MIME_EXTENSIONS[$detected])) {
            return $detected;
        }

        $headerMime = strtolower(trim(explode(';', (string) $contentType)[0]));
        if (isset(self::MIME_EXTENSIONS[$headerMime])) {
            return $headerMime;
        }

        return null;
    }
}
