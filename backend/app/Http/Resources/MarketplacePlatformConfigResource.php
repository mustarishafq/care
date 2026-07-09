<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class MarketplacePlatformConfigResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $canManage = (bool) ($this->additional['can_manage'] ?? false);

        return [
            'platform' => $this->platform,
            'label' => $this->additional['label'] ?? $this->platform,
            'service_id' => $this->service_id,
            'region' => $this->region,
            'is_active' => (bool) $this->is_active,
            'has_app_key' => (bool) $this->app_key,
            'has_app_secret' => (bool) $this->app_secret,
            'app_key' => $canManage ? $this->when($this->app_key, '••••••••') : null,
            'app_secret' => $canManage ? $this->when($this->app_secret, '••••••••') : null,
            'settings' => array_merge(
                \App\Services\Marketplace\MarketplacePlatformConfigService::DEFAULT_SETTINGS,
                $this->settings ?? [],
            ),
            'callback_url' => $this->additional['callback_url'] ?? null,
            'webhook_url' => $this->additional['webhook_url'] ?? null,
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
