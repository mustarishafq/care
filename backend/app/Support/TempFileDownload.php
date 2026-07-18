<?php

namespace App\Support;

use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Stream a temp file as an attachment without Symfony BinaryFileResponse.
 *
 * RunCloud (and some hosts) disable ignore_user_abort() and fpassthru().
 * BinaryFileResponse needs the former; avoid both and stream with fread/echo.
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

            $handle = \fopen($path, 'rb');
            if ($handle === false) {
                @\unlink($path);

                return;
            }

            try {
                // Do not use fpassthru() — often in disable_functions on RunCloud.
                while (! \feof($handle)) {
                    $chunk = \fread($handle, 8192);
                    if ($chunk === false || $chunk === '') {
                        break;
                    }
                    echo $chunk;
                }
            } finally {
                \fclose($handle);
                @\unlink($path);
            }
        }, $filename, [
            'Content-Type' => $contentType,
        ]);
    }
}
