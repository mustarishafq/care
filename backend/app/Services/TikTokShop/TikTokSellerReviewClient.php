<?php

namespace App\Services\TikTokShop;

use App\Models\TikTokShopConnection;
use App\Services\Marketplace\MarketplacePlatformConfigService;
use App\Support\MarketplacePlatform;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Http;
use RuntimeException;
use Throwable;

class TikTokSellerReviewClient
{
    public function __construct(
        private readonly string $cookie,
        private readonly string $region,
        private readonly ?string $fp = null,
        private readonly ?string $oecBsid = null,
    ) {}

    public static function fromConnection(TikTokShopConnection $connection): self
    {
        $metadata = is_array($connection->metadata) ? $connection->metadata : [];
        $cookie = self::decryptCookie($metadata['seller_cookie'] ?? null);

        // Legacy fallback: platform-level cookie used before per-shop storage.
        if ($cookie === '') {
            $settings = app(MarketplacePlatformConfigService::class)
                ->getCredentials(MarketplacePlatform::TIKTOK_SHOP)['settings'];
            $cookie = self::decryptCookie($settings['seller_cookie'] ?? null);
        }

        if ($cookie === '') {
            throw new RuntimeException(
                'No Seller Center cookie saved for this TikTok shop. Add/update the cookie under Marketplace → TikTok Shop.',
            );
        }

        $fp = is_string($metadata['seller_fp'] ?? null) && $metadata['seller_fp'] !== ''
            ? $metadata['seller_fp']
            : self::cookieValue($cookie, 's_v_web_id');

        $oecBsid = is_string($metadata['seller_oec_bsid'] ?? null) && $metadata['seller_oec_bsid'] !== ''
            ? $metadata['seller_oec_bsid']
            : null;

        return new self(
            $cookie,
            strtoupper((string) ($connection->region ?: 'MY')),
            $fp !== '' ? $fp : null,
            $oecBsid,
        );
    }

    /** @deprecated Prefer fromConnection() for multi-shop support. */
    public static function fromConfig(string $platform = MarketplacePlatform::TIKTOK_SHOP): self
    {
        $credentials = app(MarketplacePlatformConfigService::class)->getCredentials($platform);
        $settings = $credentials['settings'];
        $cookie = self::decryptCookie($settings['seller_cookie'] ?? null);

        if ($cookie === '') {
            throw new RuntimeException(
                'TikTok Seller Center cookie is not configured. Add a shop cookie under Marketplace → TikTok Shop.',
            );
        }

        $fp = is_string($settings['seller_fp'] ?? null) && $settings['seller_fp'] !== ''
            ? $settings['seller_fp']
            : self::cookieValue($cookie, 's_v_web_id');

        return new self(
            $cookie,
            strtoupper((string) ($credentials['region'] ?: 'MY')),
            $fp !== '' ? $fp : null,
            is_string($settings['seller_oec_bsid'] ?? null) ? $settings['seller_oec_bsid'] : null,
        );
    }

    public static function encryptCookie(string $cookie): string
    {
        return Crypt::encryptString(trim($cookie));
    }

    public static function decryptCookie(mixed $value): string
    {
        if (! is_string($value) || trim($value) === '') {
            return '';
        }

        $value = trim($value);

        try {
            return trim(Crypt::decryptString($value));
        } catch (Throwable) {
            return $value;
        }
    }

    public static function extractSellerIdFromCookie(string $cookie): string
    {
        foreach ([
            'oec_seller_id_unified_seller_env',
            'global_seller_id_unified_seller_env',
            'oec_seller_id',
        ] as $cookieName) {
            $value = self::cookieValue($cookie, $cookieName);
            if ($value !== '') {
                return $value;
            }
        }

        throw new RuntimeException(
            'Could not find seller id in the TikTok cookie. Switch to the correct shop in Seller Center, then re-copy the Cookie header.',
        );
    }

    public static function hasConfiguredCookie(string $platform = MarketplacePlatform::TIKTOK_SHOP): bool
    {
        $hasShopCookie = TikTokShopConnection::query()
            ->where('is_active', true)
            ->get()
            ->contains(function (TikTokShopConnection $connection) {
                $metadata = is_array($connection->metadata) ? $connection->metadata : [];

                return self::decryptCookie($metadata['seller_cookie'] ?? null) !== '';
            });

        if ($hasShopCookie) {
            return true;
        }

        $settings = app(MarketplacePlatformConfigService::class)->getCredentials($platform)['settings'];

        return self::decryptCookie($settings['seller_cookie'] ?? null) !== '';
    }

    public static function resolveSellerId(string $platform = MarketplacePlatform::TIKTOK_SHOP): string
    {
        $credentials = app(MarketplacePlatformConfigService::class)->getCredentials($platform);
        $settings = $credentials['settings'];

        foreach (['seller_id', 'oec_seller_id'] as $key) {
            if (is_string($settings[$key] ?? null) && trim($settings[$key]) !== '') {
                return trim($settings[$key]);
            }
        }

        $cookie = self::decryptCookie($settings['seller_cookie'] ?? null);
        if ($cookie === '') {
            throw new RuntimeException(
                'TikTok Seller Center cookie is not configured. Add a shop cookie under Marketplace → TikTok Shop.',
            );
        }

        return self::extractSellerIdFromCookie($cookie);
    }

    public static function cookieValue(string $cookieHeader, string $name): string
    {
        if (! preg_match('/(?:^|;\s*)'.preg_quote($name, '/').'=([^;]+)/', $cookieHeader, $matches)) {
            return '';
        }

        return trim(urldecode($matches[1]));
    }

    /**
     * @return array{list: list<array<string, mixed>>, total: int, next_page: int|null, page: int, size: int}
     */
    public function listReviews(
        string $sellerId,
        int $page = 1,
        int $size = 50,
        ?int $reviewStartTime = null,
        ?int $reviewEndTime = null,
    ): array {
        $page = max(1, $page);
        $size = min(max($size, 1), 50);
        $end = $reviewEndTime ?? now()->endOfDay()->timestamp;
        $start = $reviewStartTime ?? now()->subDays(30)->startOfDay()->timestamp;

        $payload = $this->request('POST', '/api/v1/review/biz_backend/list', $sellerId, [
            'review_start_time' => $start,
            'review_end_time' => $end,
            'page' => $page,
            'size' => $size,
        ]);

        $data = is_array($payload['data'] ?? null) ? $payload['data'] : [];
        $list = is_array($data['list'] ?? null) ? array_values($data['list']) : [];
        $total = (int) ($data['total'] ?? count($list));

        // TikTok often returns a short final-looking page (e.g. 49/50) while more pages still exist.
        // Keep paging while we have results and haven't reached the reported total.
        $nextPage = null;
        if (count($list) > 0 && ($page * $size) < $total) {
            $nextPage = $page + 1;
        }

        return [
            'list' => $list,
            'total' => $total,
            'page' => $page,
            'size' => $size,
            'next_page' => $nextPage,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function replyToReview(string $sellerId, string $reviewId, string $content): array
    {
        $text = trim($content);
        if ($text === '') {
            throw new RuntimeException('Reply text is required.');
        }

        $payload = $this->request('POST', '/api/v1/review/biz_backend/reply', $sellerId, [
            'review_id' => $reviewId,
            'text' => $text,
            'reply_text' => $text,
        ]);

        return is_array($payload['data'] ?? null) ? $payload['data'] : $payload;
    }

    /**
     * @param  array<string, mixed>  $body
     * @return array<string, mixed>
     */
    private function request(string $method, string $path, string $sellerId, array $body = []): array
    {
        $host = sprintf('https://seller-%s.tiktok.com', strtolower($this->region));
        $csrf = self::cookieValue($this->cookie, 'tt_csrf_token');

        $query = array_filter([
            'locale' => 'en',
            'language' => 'en',
            'oec_seller_id' => $sellerId,
            'seller_id' => $sellerId,
            'aid' => '4068',
            'app_name' => 'i18n_ecom_shop',
            'fp' => $this->fp,
            'device_platform' => 'web',
            'cookie_enabled' => 'true',
            'browser_language' => 'en-GB',
            'browser_platform' => 'MacIntel',
            'browser_name' => 'Mozilla',
            'browser_version' => '5.0',
            'browser_online' => 'true',
            'timezone_name' => 'Asia/Kuala_Lumpur',
            'X-Tts-Oec-Bsid' => $this->oecBsid,
        ], fn ($value) => $value !== null && $value !== '');

        $headers = [
            'accept' => '*/*',
            'content-type' => 'application/json',
            'origin' => $host,
            'referer' => $host.'/product/rating?shop_region='.$this->region,
            'user-agent' => 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36',
            'x-tt-oec-region' => $this->region,
            'Cookie' => $this->cookie,
        ];

        if ($csrf !== '') {
            $headers['x-tt-csrf-token'] = $csrf;
        }

        $pending = Http::withHeaders($headers)->timeout(45);
        $url = $host.$path.'?'.http_build_query($query);
        $attempts = 0;
        $lastException = null;

        while ($attempts < 3) {
            $attempts++;
            try {
                $response = $pending->send($method, $url, ['json' => $body]);

                return $this->unwrap($response);
            } catch (RuntimeException $exception) {
                $lastException = $exception;
                $message = strtolower($exception->getMessage());
                $retryable = str_contains($message, 'internal error')
                    || str_contains($message, 'timeout')
                    || str_contains($message, 'temporarily');

                if (! $retryable || $attempts >= 3) {
                    throw $exception;
                }

                usleep(250000 * $attempts);
            }
        }

        throw $lastException ?? new RuntimeException('TikTok seller review request failed.');
    }

    /**
     * @return array<string, mixed>
     */
    private function unwrap(Response $response): array
    {
        $json = $response->json();

        if (! is_array($json)) {
            $snippet = substr($response->body(), 0, 300);

            throw new RuntimeException(
                "Invalid TikTok seller review response (HTTP {$response->status()}): {$snippet}",
            );
        }

        $code = $json['code'] ?? -1;
        if ((int) $code !== 0) {
            $message = (string) ($json['message'] ?? 'TikTok seller review request failed.');

            if ($this->looksLikeAuthFailure($response->status(), $message, $json)) {
                throw new RuntimeException(
                    'TikTok Seller Center cookie expired or is invalid. Paste a fresh cookie for this shop and try again. ('.$message.')',
                    (int) $code,
                );
            }

            throw new RuntimeException($message, (int) $code);
        }

        return $json;
    }

    /**
     * @param  array<string, mixed>  $json
     */
    private function looksLikeAuthFailure(int $status, string $message, array $json): bool
    {
        if (in_array($status, [401, 403], true)) {
            return true;
        }

        $normalized = strtolower($message.(string) ($json['msg'] ?? ''));

        return str_contains($normalized, 'login')
            || str_contains($normalized, 'auth')
            || str_contains($normalized, 'session')
            || str_contains($normalized, 'permission')
            || str_contains($normalized, 'not login');
    }
}
