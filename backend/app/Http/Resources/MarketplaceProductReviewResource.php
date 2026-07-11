<?php

namespace App\Http\Resources;

use App\Support\MarketplaceReviewImages;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class MarketplaceProductReviewResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $metadata = is_array($this->raw_metadata) ? $this->raw_metadata : [];
        $region = 'MY';
        if ($this->relationLoaded('shopConnection') && $this->shopConnection?->region) {
            $region = (string) $this->shopConnection->region;
        }
        $reviewImages = is_array($this->review_images) && $this->review_images !== []
            ? $this->review_images
            : MarketplaceReviewImages::reviewImages($metadata, $region);
        $productImageUrl = $this->product_image_url
            ?: MarketplaceReviewImages::productImageUrl($metadata, $region);

        return [
            'id' => (string) $this->id,
            'platform' => $this->platform,
            'marketplace_shop_connection_id' => (string) $this->marketplace_shop_connection_id,
            'external_review_id' => $this->external_review_id,
            'external_product_id' => $this->external_product_id,
            'product_name' => $this->product_name,
            'product_image_url' => $productImageUrl,
            'rating' => $this->rating,
            'review_text' => $this->review_text,
            'review_images' => array_values($reviewImages),
            'reviewer_name' => $this->reviewer_name,
            'review_created_at' => $this->review_created_at?->toIso8601String(),
            'seller_reply' => $this->seller_reply,
            'seller_replied_at' => $this->seller_replied_at?->toIso8601String(),
            'has_seller_reply' => filled($this->seller_reply)
                || (int) ($metadata['reply_count'] ?? 0) > 0,
            'reply_count' => (int) (
                ($metadata['reply_count'] ?? null)
                ?? (filled($this->seller_reply) ? 1 : 0)
            ),
            'complaint_id' => $this->complaint_id ? (string) $this->complaint_id : null,
            'synced_at' => $this->synced_at?->toIso8601String(),
            'shop_name' => $this->whenLoaded('shopConnection', fn () => $this->shopConnection?->shop_name),
        ];
    }
}
