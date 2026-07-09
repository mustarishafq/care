<?php

namespace App\Services\Marketplace;

use App\Models\MarketplacePlatformConfig;
use App\Support\MarketplacePlatform;
use Illuminate\Support\Arr;

class MarketplacePlatformConfigService
{
    public const DEFAULT_SETTINGS = [
        'auto_complaint_enabled' => false,
        'auto_complaint_max_rating' => 3,
        'auto_complaint_type_id' => null,
        'webhook_secret' => null,
    ];

    public function getOrCreate(string $platform): MarketplacePlatformConfig
    {
        $this->assertValidPlatform($platform);

        return MarketplacePlatformConfig::firstOrCreate(
            ['platform' => $platform],
            [
                'region' => $this->defaultRegion($platform),
                'settings' => self::DEFAULT_SETTINGS,
                'is_active' => true,
            ],
        );
    }

    private function defaultRegion(string $platform): string
    {
        return match ($platform) {
            MarketplacePlatform::SHOPEE => (string) config('shopee.region', 'MY'),
            default => (string) config('tiktok_shop.region', 'MY'),
        };
    }

    public function isConfigured(string $platform): bool
    {
        $credentials = $this->getCredentials($platform);

        if ($platform === MarketplacePlatform::TIKTOK_SHOP) {
            return $credentials['app_key'] !== ''
                && $credentials['app_secret'] !== ''
                && $credentials['service_id'] !== '';
        }

        return $credentials['app_key'] !== '' && $credentials['app_secret'] !== '';
    }

    /**
     * @return array{
     *     platform: string,
     *     app_key: string,
     *     app_secret: string,
     *     service_id: string|null,
     *     region: string,
     *     is_active: bool,
     *     settings: array<string, mixed>,
     *     has_app_key: bool,
     *     has_app_secret: bool,
     * }
     */
    public function getCredentials(string $platform): array
    {
        $config = $this->getOrCreate($platform);

        $appKey = (string) ($config->app_key ?? '');
        $appSecret = (string) ($config->app_secret ?? '');
        $serviceId = (string) ($config->service_id ?? '');
        $region = (string) ($config->region ?: $this->defaultRegion($platform));

        if ($platform === MarketplacePlatform::TIKTOK_SHOP && ($appKey === '' || $appSecret === '' || $serviceId === '')) {
            $appKey = $appKey ?: (string) config('tiktok_shop.app_key', '');
            $appSecret = $appSecret ?: (string) config('tiktok_shop.app_secret', '');
            $serviceId = $serviceId ?: (string) config('tiktok_shop.service_id', '');
            $region = $region ?: (string) config('tiktok_shop.region', 'MY');
        }

        if ($platform === MarketplacePlatform::SHOPEE && ($appKey === '' || $appSecret === '')) {
            $appKey = $appKey ?: (string) config('shopee.partner_id', '');
            $appSecret = $appSecret ?: (string) config('shopee.partner_key', '');
            $region = $region ?: (string) config('shopee.region', 'MY');
        }

        return [
            'platform' => $platform,
            'app_key' => $appKey,
            'app_secret' => $appSecret,
            'service_id' => $serviceId !== '' ? $serviceId : null,
            'region' => $region,
            'is_active' => (bool) $config->is_active,
            'settings' => array_merge(self::DEFAULT_SETTINGS, $config->settings ?? []),
            'has_app_key' => $appKey !== '',
            'has_app_secret' => $appSecret !== '',
        ];
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    public function update(string $platform, array $payload, ?int $userId = null): MarketplacePlatformConfig
    {
        $this->assertValidPlatform($platform);
        $config = $this->getOrCreate($platform);

        $updates = Arr::only($payload, ['service_id', 'region', 'is_active']);

        if (array_key_exists('app_key', $payload) && $payload['app_key'] !== '' && $payload['app_key'] !== null) {
            $updates['app_key'] = $payload['app_key'];
        }

        if (array_key_exists('app_secret', $payload) && $payload['app_secret'] !== '' && $payload['app_secret'] !== null) {
            $updates['app_secret'] = $payload['app_secret'];
        }

        if (isset($payload['settings']) && is_array($payload['settings'])) {
            $updates['settings'] = array_merge(self::DEFAULT_SETTINGS, $config->settings ?? [], $payload['settings']);
        }

        if ($userId) {
            $updates['updated_by_user_id'] = $userId;
        }

        $config->fill($updates);
        $config->save();

        return $config->fresh();
    }

    public function getSetting(string $platform, string $key, mixed $default = null): mixed
    {
        $settings = $this->getCredentials($platform)['settings'];

        return $settings[$key] ?? $default;
    }

    private function assertValidPlatform(string $platform): void
    {
        if (! MarketplacePlatform::isValid($platform)) {
            throw new \InvalidArgumentException("Unsupported marketplace platform [{$platform}].");
        }
    }
}
