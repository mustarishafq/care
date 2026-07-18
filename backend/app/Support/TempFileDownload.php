<?php

namespace App\Support;

use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Stream a temp file as an attachment without Symfony BinaryFileResponse.
 *
 * RunCloud (and some hosts) disable ignore_user_abort(), which BinaryFileResponse
 * calls unconditionally and fatals with:
 * "Call to undefined function Symfony\Component\HttpFoundation\ignore_user_abort()".
 */
class TempFileDownload
{
    public static function streamAndDelete(
        string $path,
        string $filename,
        string $contentType = 'application/octet-stream',
    ): StreamedResponse {
        return response()->streamDownload(function () use ($path) {
            if (! is_readable($path)) {
                return;
            }

            $handle = fopen($path, 'rb');
            if ($handle === false) {
                @unlink($path);

                return;
            }

            try {
                fpassthru($handle);
            } finally {
                fclose($handle);
                @unlink($path);
            }
        }, $filename, [
            'Content-Type' => $contentType,
        ]);
    }
}
