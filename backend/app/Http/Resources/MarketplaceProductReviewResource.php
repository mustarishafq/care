<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class MarketplaceProductReviewResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'platform' => $this->platform,
            'marketplace_shop_connection_id' => (string) $this->marketplace_shop_connection_id,
            'external_review_id' => $this->external_review_id,
            'external_product_id' => $this->external_product_id,
            'product_name' => $this->product_name,
            'rating' => $this->rating,
            'review_text' => $this->review_text,
            'reviewer_name' => $this->reviewer_name,
            'review_created_at' => $this->review_created_at?->toIso8601String(),
            'seller_reply' => $this->seller_reply,
            'seller_replied_at' => $this->seller_replied_at?->toIso8601String(),
            'complaint_id' => $this->complaint_id ? (string) $this->complaint_id : null,
            'synced_at' => $this->synced_at?->toIso8601String(),
            'shop_name' => $this->whenLoaded('shopConnection', fn () => $this->shopConnection?->shop_name),
        ];
    }
}
