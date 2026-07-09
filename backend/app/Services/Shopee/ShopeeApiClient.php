<?php

namespace App\Services\Shopee;

use App\Services\Marketplace\MarketplacePlatformConfigService;
use App\Support\MarketplacePlatform;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class ShopeeApiClient
{
    public function __construct(
        private readonly int $partnerId,
        private readonly string $partnerKey,
        private readonly string $baseUrl,
    ) {}

    public static function fromConfig(): self
    {
        $credentials = app(MarketplacePlatformConfigService::class)->getCredentials(MarketplacePlatform::SHOPEE);
        $settings = $credentials['settings'];

        $partnerId = (int) ($credentials['app_key'] ?: config('shopee.partner_id', 0));
        $partnerKey = (string) ($credentials['app_secret'] ?: config('shopee.partner_key', ''));

        if ($partnerId <= 0 || $partnerKey === '') {
            throw new RuntimeException('Shopee partner credentials are not configured.');
        }

        $sandbox = (bool) ($settings['use_sandbox'] ?? config('shopee.sandbox', false));
        $host = $sandbox
            ? (string) config('shopee.sandbox_host')
            : (string) config('shopee.host');

        return new self($partnerId, $partnerKey, rtrim($host, '/').'/api/v2/');
    }

    public function buildAuthorizationUrl(string $redirectUri): string
    {
        $path = '/api/v2/shop/auth_partner';
        $timestamp = time();
        $sign = $this->sign($path, $timestamp);

        $query = http_build_query([
            'partner_id' => $this->partnerId,
            'timestamp' => $timestamp,
            'sign' => $sign,
            'redirect' => $redirectUri,
        ]);

        return $this->hostWithoutApi().$path.'?'.$query;
    }

    /**
     * @return array<string, mixed>
     */
    public function exchangeAuthCode(string $code, int $shopId): array
    {
        return $this->postAuth('auth/token/get', [
            'code' => $code,
            'shop_id' => $shopId,
            'partner_id' => $this->partnerId,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public function refreshAccessToken(string $refreshToken, int $shopId): array
    {
        return $this->postAuth('auth/access_token/get', [
            'refresh_token' => $refreshToken,
            'shop_id' => $shopId,
            'partner_id' => $this->partnerId,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public function getShopInfo(string $accessToken, int $shopId): array
    {
        return $this->get('shop/get_shop_info', $accessToken, $shopId);
    }

    /**
     * @param  array<string, mixed>  $query
     * @return array<string, mixed>
     */
    public function getItemList(string $accessToken, int $shopId, array $query = []): array
    {
        return $this->get('product/get_item_list', $accessToken, $shopId, array_merge([
            'offset' => 0,
            'page_size' => 20,
            'item_status' => 'NORMAL',
        ], $query));
    }

    /**
     * @param  array<int, int|string>  $itemIds
     * @return array<string, mixed>
     */
    public function getItemBaseInfo(string $accessToken, int $shopId, array $itemIds): array
    {
        return $this->get('product/get_item_base_info', $accessToken, $shopId, [
            'item_id_list' => implode(',', array_map('strval', $itemIds)),
        ]);
    }

    /**
     * @param  array<string, mixed>  $query
     * @return array<string, mixed>
     */
    public function getComments(string $accessToken, int $shopId, array $query = []): array
    {
        return $this->get('product/get_comment', $accessToken, $shopId, array_merge([
            'cursor' => '',
            'page_size' => 50,
        ], $query));
    }

    /**
     * @return array<string, mixed>
     */
    public function replyComment(string $accessToken, int $shopId, int $commentId, string $comment): array
    {
        return $this->post('product/reply_comment', $accessToken, $shopId, [
            'comment_list' => [
                [
                    'comment_id' => $commentId,
                    'comment' => $comment,
                ],
            ],
        ]);
    }

    /**
     * @param  array<string, mixed>  $body
     * @return array<string, mixed>
     */
    private function postAuth(string $action, array $body): array
    {
        $path = '/api/v2/'.$action;
        $timestamp = time();
        $sign = $this->sign($path, $timestamp);

        $response = Http::asJson()->post(
            $this->baseUrl.$action.'?'.http_build_query([
                'partner_id' => $this->partnerId,
                'timestamp' => $timestamp,
                'sign' => $sign,
            ]),
            $body,
        );

        return $this->unwrap($response->json());
    }

    /**
     * @param  array<string, mixed>  $query
     * @return array<string, mixed>
     */
    private function get(string $action, string $accessToken, int $shopId, array $query = []): array
    {
        $path = '/api/v2/'.$action;
        $timestamp = time();
        $sign = $this->sign($path, $timestamp, $accessToken, $shopId);

        $response = Http::get($this->baseUrl.$action, array_merge($query, [
            'partner_id' => $this->partnerId,
            'timestamp' => $timestamp,
            'sign' => $sign,
            'access_token' => $accessToken,
            'shop_id' => $shopId,
        ]));

        return $this->unwrap($response->json());
    }

    /**
     * @param  array<string, mixed>  $body
     * @return array<string, mixed>
     */
    private function post(string $action, string $accessToken, int $shopId, array $body): array
    {
        $path = '/api/v2/'.$action;
        $timestamp = time();
        $sign = $this->sign($path, $timestamp, $accessToken, $shopId);

        $response = Http::withHeaders(['Content-Type' => 'application/json'])
            ->post($this->baseUrl.$action.'?'.http_build_query([
                'partner_id' => $this->partnerId,
                'timestamp' => $timestamp,
                'sign' => $sign,
                'access_token' => $accessToken,
                'shop_id' => $shopId,
            ]), $body);

        return $this->unwrap($response->json());
    }

    private function sign(string $path, int $timestamp, string $accessToken = '', int|string $shopId = ''): string
    {
        $baseString = $this->partnerId.$path.$timestamp.$accessToken.(string) $shopId;

        return hash_hmac('sha256', $baseString, $this->partnerKey);
    }

    /**
     * @param  array<string, mixed>|null  $json
     * @return array<string, mixed>
     */
    private function unwrap(?array $json): array
    {
        if (! is_array($json)) {
            throw new RuntimeException('Invalid Shopee API response.');
        }

        $error = $json['error'] ?? null;
        if ($error !== null && $error !== '' && $error !== 0 && $error !== '0') {
            throw new RuntimeException($json['message'] ?? (string) $error, is_numeric($error) ? (int) $error : 0);
        }

        return is_array($json['response'] ?? null) ? $json['response'] : [];
    }

    private function hostWithoutApi(): string
    {
        return rtrim(str_replace('/api/v2/', '', $this->baseUrl), '/');
    }
}
