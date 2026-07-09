<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ShopeeConnectionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'platform' => $this->platform ?? 'shopee',
            'shop_id' => $this->shop_id,
            'shop_cipher' => $this->shop_cipher,
            'shop_name' => $this->shop_name,
            'region' => $this->region,
            'is_active' => (bool) $this->is_active,
            'connection_error' => $this->connection_error,
            'token_refresh_failed_at' => $this->token_refresh_failed_at?->toIso8601String(),
            'connected_by_user_id' => $this->connected_by_user_id ? (string) $this->connected_by_user_id : null,
            'access_token_expires_at' => $this->access_token_expires_at?->toIso8601String(),
            'refresh_token_expires_at' => $this->refresh_token_expires_at?->toIso8601String(),
            'last_synced_at' => $this->last_synced_at?->toIso8601String(),
            'metadata' => $this->metadata,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
