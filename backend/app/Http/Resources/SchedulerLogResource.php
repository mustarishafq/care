<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SchedulerLogResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'command' => $this->command,
            'source' => $this->source,
            'level' => $this->level,
            'title' => $this->title,
            'message' => $this->message,
            'marketplace_shop_connection_id' => $this->marketplace_shop_connection_id
                ? (string) $this->marketplace_shop_connection_id
                : null,
            'shop_name' => $this->whenLoaded(
                'shopConnection',
                fn () => $this->shopConnection?->shop_name,
            ),
            'platform' => $this->whenLoaded(
                'shopConnection',
                fn () => $this->shopConnection?->platform,
            ),
            'context' => is_array($this->context) ? $this->context : null,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
