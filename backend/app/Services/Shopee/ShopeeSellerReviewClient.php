<?php

namespace App\Services\Shopee;

use App\Models\ShopeeConnection;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Http;
use RuntimeException;
use Throwable;

class ShopeeSellerReviewClient
{
    public function __construct(
        private readonly string $cookie,
        private readonly string $region,
    ) {}

    public static function fromConnection(ShopeeConnection $connection): self
    {
        $metadata = is_array($connection->metadata) ? $connection->metadata : [];
        $cookie = self::decryptCookie($metadata['seller_cookie'] ?? null);

        if ($cookie === '') {
            throw new RuntimeException(
                'No Seller Center cookie saved for this Shopee shop. Add/update the cookie under Marketplace → Shopee.',
            );
        }

        return new self(
            $cookie,
            strtoupper((string) ($connection->region ?: 'MY')),
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

    public static function cookieValue(string $cookieHeader, string $name): string
    {
        if (! preg_match('/(?:^|;\s*)'.preg_quote($name, '/').'=([^;]+)/', $cookieHeader, $matches)) {
            return '';
        }

        return trim(urldecode($matches[1]));
    }

    public static function isCookieAuth(ShopeeConnection $connection): bool
    {
        $metadata = is_array($connection->metadata) ? $connection->metadata : [];

        return ($metadata['auth_mode'] ?? null) === 'seller_cookie'
            || $connection->access_token === 'seller_cookie'
            || $connection->shop_cipher === 'seller_cookie';
    }

    public static function sellerHost(string $region): string
    {
        return match (strtoupper($region)) {
            'SG' => 'https://seller.shopee.sg',
            'TH' => 'https://seller.shopee.co.th',
            'VN' => 'https://banhang.shopee.vn',
            'PH' => 'https://seller.shopee.ph',
            'ID' => 'https://seller.shopee.co.id',
            'BR' => 'https://seller.shopee.com.br',
            'TW' => 'https://seller.shopee.tw',
            'MX' => 'https://seller.shopee.com.mx',
            'CO' => 'https://seller.shopee.com.co',
            'CL' => 'https://seller.shopee.cl',
            default => 'https://seller.shopee.com.my',
        };
    }

    public static function imageCdnBase(string $region): string
    {
        $region = strtolower($region ?: 'my');

        return "https://down-{$region}.img.susercontent.com/file/";
    }

    public static function fileUrl(string $fileId, string $region = 'MY'): string
    {
        $fileId = trim($fileId);
        if ($fileId === '') {
            return '';
        }

        if (filter_var($fileId, FILTER_VALIDATE_URL)) {
            return $fileId;
        }

        return self::imageCdnBase($region).ltrim($fileId, '/');
    }

    /**
     * Resolve shop id + name from the Seller Center session.
     *
     * @return array{shop_id: string, shop_name: string|null, region: string}
     */
    public function resolveShopProfile(): array
    {
        $shopInfo = $this->getJson('/api/selleraccount/shop_info/');
        $data = is_array($shopInfo['data'] ?? null) ? $shopInfo['data'] : [];

        $shopId = (string) ($data['shop_id'] ?? '');
        $shopName = is_string($data['name'] ?? null) ? trim($data['name']) : null;
        $region = strtoupper((string) ($data['shop_region'] ?? $this->region ?: 'MY')) ?: 'MY';

        if ($shopId === '') {
            $login = $this->getJson('/api/v2/login/');
            $shopId = (string) ($login['shopid'] ?? $login['shop_id'] ?? '');
            if ($shopName === null || $shopName === '') {
                $shopName = is_string($login['shop_name'] ?? null) ? trim($login['shop_name']) : null;
            }
            if ($shopName === null || $shopName === '') {
                $shopName = is_string($login['username'] ?? null) ? trim($login['username']) : null;
            }
        }

        if ($shopId === '') {
            foreach (['SPC_SC_MAIN_SHOP_SA_UD', 'SC_SSO_U', 'SPC_U'] as $cookieName) {
                $value = self::cookieValue($this->cookie, $cookieName);
                if ($value !== '' && ctype_digit($value)) {
                    // Prefer main shop id from login/shop_info; cookie fallback is last resort.
                    $shopId = $value;
                    break;
                }
            }
        }

        if ($shopId === '') {
            throw new RuntimeException(
                'Could not detect Shopee shop id from this cookie. Open Seller Center for the correct shop, then re-copy the Cookie header.',
            );
        }

        return [
            'shop_id' => $shopId,
            'shop_name' => $shopName !== '' ? $shopName : null,
            'region' => $region,
        ];
    }

    /**
     * @param  list<int>|null  $ratingStars
     * @return array{list: list<array<string, mixed>>, total: int, next_page: int|null, page: int, size: int, next_cursor: int|null}
     */
    public function listReviews(
        int $page = 1,
        int $size = 20,
        ?int $timeStart = null,
        ?int $timeEnd = null,
        ?array $ratingStars = null,
        ?int $cursor = null,
    ): array {
        $page = max(1, $page);
        $size = min(max($size, 1), 50);
        $end = $timeEnd ?? now()->endOfDay()->timestamp;
        $start = $timeStart ?? now()->subDays(30)->startOfDay()->timestamp;
        // Seller Center paginates by cursor while keeping page_number=1.
        $cursor ??= ($page - 1) * $size;

        $stars = $ratingStars !== null && $ratingStars !== []
            ? implode(',', array_map('intval', $ratingStars))
            : '5,4,3,2,1';

        $query = [
            'time_start' => $start,
            'time_end' => $end,
            'rating_star' => $stars,
            'page_number' => 1,
            'page_size' => $size,
            'cursor' => max(0, $cursor),
            'from_page_number' => 1,
            'language' => $this->language(),
        ];

        $payload = $this->getJson('/api/v3/settings/search_shop_rating_comments_new/', $query);
        $data = is_array($payload['data'] ?? null) ? $payload['data'] : [];
        $list = is_array($data['list'] ?? null) ? array_values($data['list']) : [];
        $pageInfo = is_array($data['page_info'] ?? null) ? $data['page_info'] : [];
        $total = (int) ($pageInfo['total'] ?? $data['counts']['all_count'] ?? count($list));

        // Keep page_number=1; cursor alone is unreliable without signed browser headers.
        // Callers should prefer smaller date windows + page_size up to 50.
        $nextCursor = null;
        $nextPage = null;

        return [
            'list' => $list,
            'total' => $total,
            'page' => 1,
            'size' => $size,
            'next_page' => $nextPage,
            'next_cursor' => $nextCursor,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function replyToReview(int $commentId, string $content): array
    {
        $text = trim($content);
        if ($text === '') {
            throw new RuntimeException('Reply text is required.');
        }

        if ($commentId <= 0) {
            throw new RuntimeException('Shopee comment id is required.');
        }

        $payload = $this->postJson('/api/v3/settings/reply_shop_rating/', [
            'comment_id' => $commentId,
            'comment' => $text,
        ]);

        return is_array($payload['data'] ?? null) ? $payload['data'] : $payload;
    }

    /**
     * @param  array<string, mixed>  $query
     * @return array<string, mixed>
     */
    private function getJson(string $path, array $query = []): array
    {
        return $this->request('GET', $path, $query);
    }

    /**
     * @param  array<string, mixed>  $body
     * @return array<string, mixed>
     */
    private function postJson(string $path, array $body = []): array
    {
        return $this->request('POST', $path, [], $body);
    }

    /**
     * @param  array<string, mixed>  $query
     * @param  array<string, mixed>|null  $body
     * @return array<string, mixed>
     */
    private function request(string $method, string $path, array $query = [], ?array $body = null): array
    {
        $host = self::sellerHost($this->region);
        $cds = self::cookieValue($this->cookie, 'SPC_CDS');
        $csrf = self::cookieValue($this->cookie, 'csrftoken');

        $query = array_merge([
            'SPC_CDS' => $cds !== '' ? $cds : null,
            'SPC_CDS_VER' => '2',
        ], $query);

        $query = array_filter($query, fn ($value) => $value !== null && $value !== '');

        $headers = [
            'accept' => 'application/json, text/plain, */*',
            'origin' => $host,
            'referer' => $host.'/portal/settings/shop/rating',
            'user-agent' => 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36',
            'Cookie' => $this->cookie,
        ];

        if ($csrf !== '') {
            $headers['x-csrftoken'] = $csrf;
        }

        $url = $host.$path;
        if ($query !== []) {
            $url .= (str_contains($path, '?') ? '&' : '?').http_build_query($query);
        }

        $pending = Http::withHeaders($headers)->timeout(45);

        $response = $body !== null
            ? $pending->withHeaders(['content-type' => 'application/json'])->send($method, $url, ['json' => $body])
            : $pending->send($method, $url);

        return $this->unwrap($response);
    }

    /**
     * @return array<string, mixed>
     */
    private function unwrap(Response $response): array
    {
        $body = trim($response->body());
        if ($body === 'ERROR_PARAMS') {
            throw new RuntimeException('Shopee Seller Center rejected the request parameters.');
        }

        $json = $response->json();
        if (! is_array($json)) {
            $snippet = substr($body, 0, 300);

            throw new RuntimeException(
                "Invalid Shopee seller review response (HTTP {$response->status()}): {$snippet}",
            );
        }

        // /api/v2/login returns a flat profile object without code.
        if (! array_key_exists('code', $json) && (isset($json['shopid']) || isset($json['shop_id']))) {
            return $json;
        }

        $code = $json['code'] ?? null;
        if ($code !== null && (int) $code !== 0) {
            $message = (string) ($json['message'] ?? $json['user_message'] ?? 'Shopee seller review request failed.');

            if ($this->looksLikeAuthFailure($response->status(), $message, $json)) {
                throw new RuntimeException(
                    'Shopee Seller Center cookie expired or is invalid. Paste a fresh cookie for this shop and try again. ('.$message.')',
                    (int) $code,
                );
            }

            throw new RuntimeException($message, (int) $code);
        }

        if ($code === null && is_string($json['message'] ?? null) && str_contains(strtolower((string) $json['message']), 'param')) {
            throw new RuntimeException((string) $json['message']);
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

        $normalized = strtolower($message.(string) ($json['user_message'] ?? '').(string) ($json['msg'] ?? ''));

        return str_contains($normalized, 'login')
            || str_contains($normalized, 'auth')
            || str_contains($normalized, 'session')
            || str_contains($normalized, 'permission')
            || str_contains($normalized, 'not login')
            || str_contains($normalized, 'token');
    }

    private function language(): string
    {
        return match (strtoupper($this->region)) {
            'SG' => 'en',
            'TH' => 'th',
            'VN' => 'vi',
            'PH' => 'en',
            'ID' => 'id',
            'TW' => 'zh-Hant',
            'BR' => 'pt-BR',
            default => 'en-my',
        };
    }
}
