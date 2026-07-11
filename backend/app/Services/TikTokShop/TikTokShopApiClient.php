<?php

namespace App\Services\TikTokShop;

use App\Services\Marketplace\MarketplacePlatformConfigService;
use App\Support\MarketplacePlatform;
use App\Support\TikTokShopScopes;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class TikTokShopApiClient
{
    public function __construct(
        private readonly string $appKey,
        private readonly string $appSecret,
        private readonly string $baseUrl,
        private readonly string $authBaseUrl,
        private readonly string $apiVersion,
    ) {}

    public static function fromConfig(): self
    {
        return self::forPlatform(MarketplacePlatform::TIKTOK_SHOP);
    }

    public static function forPlatform(string $platform = MarketplacePlatform::TIKTOK_SHOP): self
    {
        $credentials = app(MarketplacePlatformConfigService::class)->getCredentials($platform);

        if ($credentials['app_key'] === '' || $credentials['app_secret'] === '') {
            throw new RuntimeException('TikTok Shop app credentials are not configured.');
        }

        return new self(
            $credentials['app_key'],
            $credentials['app_secret'],
            rtrim((string) config('tiktok_shop.api_base_url'), '/'),
            rtrim((string) config('tiktok_shop.auth_base_url'), '/'),
            (string) config('tiktok_shop.api_version', '202309'),
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function exchangeAuthCode(string $authCode): array
    {
        return $this->unwrapAuthResponse($this->authHttp()->get('/api/v2/token/get', [
            'app_key' => $this->appKey,
            'app_secret' => $this->appSecret,
            'auth_code' => $authCode,
            'grant_type' => 'authorized_code',
        ]));
    }

    /**
     * @return array<string, mixed>
     */
    public function refreshAccessToken(string $refreshToken): array
    {
        return $this->unwrapAuthResponse($this->authHttp()->get('/api/v2/token/refresh', [
            'app_key' => $this->appKey,
            'app_secret' => $this->appSecret,
            'refresh_token' => $refreshToken,
            'grant_type' => 'refresh_token',
        ]));
    }

    /**
     * @return array<string, mixed>
     */
    public function getAuthorizedShops(string $accessToken): array
    {
        return $this->request('GET', 'authorization', 'shops', $accessToken);
    }

    /**
     * @param  array<string, mixed>  $body
     * @return array<string, mixed>
     */
    public function searchProducts(
        string $accessToken,
        string $shopCipher,
        array $body = [],
        int $pageSize = 20,
        ?string $pageToken = null,
    ): array {
        $query = ['page_size' => $pageSize];

        if ($pageToken) {
            $query['page_token'] = $pageToken;
        }

        return $this->request('POST', 'product', 'products/search', $accessToken, $shopCipher, $query, $body);
    }

    /**
     * @param  array<string, mixed>  $body
     * @return array<string, mixed>
     */
    public function searchReviews(
        string $accessToken,
        string $shopCipher,
        array $body = [],
        int $pageSize = 20,
        ?string $pageToken = null,
    ): array {
        $query = ['page_size' => $pageSize];

        if ($pageToken) {
            $query['page_token'] = $pageToken;
        }

        return $this->request('POST', 'review', 'reviews/search', $accessToken, $shopCipher, $query, $body);
    }

    /**
     * @return array<string, mixed>
     */
    public function replyToReview(string $accessToken, string $shopCipher, string $reviewId, string $content): array
    {
        return $this->request('POST', 'review', 'reviews/reply', $accessToken, $shopCipher, [], [
            'review_id' => $reviewId,
            'content' => $content,
        ]);
    }

    /**
     * @param  array<string, mixed>  $query
     * @param  array<string, mixed>  $body
     * @return array<string, mixed>
     */
    private function request(
        string $method,
        string $category,
        string $action,
        string $accessToken,
        ?string $shopCipher = null,
        array $query = [],
        array $body = [],
    ): array {
        if ($shopCipher) {
            $this->throttleShopRequest($shopCipher);
        }

        $path = sprintf('/%s/%s/%s', $category, $this->apiVersion, ltrim($action, '/'));
        $query = array_merge([
            'app_key' => $this->appKey,
            'timestamp' => (string) time(),
        ], $query);

        if ($shopCipher && ! $this->shouldOmitShopCipher($path, $method)) {
            $query['shop_cipher'] = $shopCipher;
        }

        $bodyJson = $method === 'GET'
            ? ''
            : json_encode($body === [] ? (object) [] : $body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $query['sign'] = $this->signRequest($path, $query, $bodyJson, $method);

        $requestOptions = ['query' => $query];
        if ($method !== 'GET') {
            $requestOptions['body'] = $bodyJson;
        }

        $response = Http::withHeaders([
            'x-tts-access-token' => $accessToken,
            'Content-Type' => 'application/json',
        ])->send($method, $this->baseUrl.$path, $requestOptions);

        return $this->unwrapApiResponse($response);
    }

    /**
     * @param  array<string, string>  $query
     */
    private function signRequest(string $path, array $query, string $bodyJson, string $method): string
    {
        $params = $query;
        unset($params['sign'], $params['access_token'], $params['x-tts-access-token']);
        ksort($params);

        $payload = $path;
        foreach ($params as $key => $value) {
            if (! is_array($value)) {
                $payload .= $key.$value;
            }
        }

        if ($method !== 'GET' && $bodyJson !== '') {
            $payload .= $bodyJson;
        }

        $payload = $this->appSecret.$payload.$this->appSecret;

        return hash_hmac('sha256', $payload, $this->appSecret);
    }

    private function shouldOmitShopCipher(string $path, string $method): bool
    {
        if (preg_match('#^/authorization/#', $path) || preg_match('#^/seller/#', $path)) {
            return true;
        }

        if (preg_match('#^/product/\d{6}/(compliance|global_products|files/upload|images/upload)#', $path)) {
            return true;
        }

        return $method === 'POST' && preg_match('#^/product/\d{6}/brands#', $path);
    }

    /**
     * @return array<string, mixed>
     */
    private function unwrapApiResponse(Response $response): array
    {
        $json = $response->json();

        if (! is_array($json)) {
            throw new RuntimeException('Invalid TikTok Shop API response.');
        }

        $code = $json['code'] ?? -1;
        if ((int) $code !== 0) {
            $message = (string) ($json['message'] ?? 'TikTok Shop API request failed.');

            if (TikTokShopScopes::isScopeError($message) || (int) $code === 105005) {
                throw new RuntimeException(TikTokShopScopes::scopeErrorGuidance($message), (int) $code);
            }

            throw new RuntimeException($message, (int) $code);
        }

        return is_array($json['data'] ?? null) ? $json['data'] : [];
    }

    /**
     * @return array<string, mixed>
     */
    private function unwrapAuthResponse(Response $response): array
    {
        $json = $response->json();

        if (! is_array($json)) {
            throw new RuntimeException('Invalid TikTok Shop auth response.');
        }

        $code = $json['code'] ?? -1;
        if ((int) $code !== 0) {
            throw new RuntimeException($json['message'] ?? 'TikTok Shop authorization failed.', (int) $code);
        }

        return is_array($json['data'] ?? null) ? $json['data'] : [];
    }

    private function authHttp(): PendingRequest
    {
        return Http::baseUrl($this->authBaseUrl)->acceptJson();
    }

    private function throttleShopRequest(string $shopCipher): void
    {
        $key = 'marketplace:tiktok_rate:'.$shopCipher.':'.now()->format('YmdHis');
        $count = (int) Cache::get($key, 0);

        if ($count >= 45) {
            usleep(250_000);
        }

        Cache::put($key, $count + 1, now()->addSecond());
    }
}
