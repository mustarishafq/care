<?php

namespace App\Http\Resources;

use App\Services\DisplayFormatService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class MarketplaceOrderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $items = is_array($this->items) ? array_values($this->items) : [];
        $formatter = app(DisplayFormatService::class);
        $addressRaw = is_array($this->buyer_address_raw) ? $this->buyer_address_raw : null;
        $formattedAddress = $addressRaw !== null ? $formatter->formatAddress($addressRaw) : '';

        return [
            'id' => (string) $this->id,
            'platform' => $this->platform,
            'marketplace_shop_connection_id' => (string) $this->marketplace_shop_connection_id,
            'external_order_id' => $this->external_order_id,
            'buyer_nickname' => $this->buyer_nickname,
            'buyer_name' => $this->buyer_name,
            'buyer_phone' => $formatter->normalizePhone($this->buyer_phone) ?? $this->buyer_phone,
            'buyer_address' => $formattedAddress !== '' ? $formattedAddress : $this->buyer_address,
            'items' => $items,
            'item_count' => (int) $this->item_count,
            'product_summary' => $this->product_summary,
            'order_status' => $this->order_status,
            'order_status_label' => $this->order_status_label,
            'grand_total' => $this->grand_total !== null ? (string) $this->grand_total : null,
            'currency' => $this->currency,
            'pay_method' => $this->pay_method,
            'order_created_at' => $this->order_created_at?->toIso8601String(),
            'paid_at' => $this->paid_at?->toIso8601String(),
            'contact_synced_at' => $this->contact_synced_at?->toIso8601String(),
            'synced_at' => $this->synced_at?->toIso8601String(),
            'has_contact' => filled($this->buyer_name) || filled($this->buyer_phone) || filled($this->buyer_address),
            'shop_name' => $this->whenLoaded('shopConnection', fn () => $this->shopConnection?->shop_name),
        ];
    }
}
