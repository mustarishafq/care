<?php

namespace App\Services\Marketplace;

use App\Models\Complaint;
use App\Models\ComplaintStatus;
use App\Models\ComplaintType;
use App\Models\MarketplaceProductReview;
use App\Models\MarketplaceShopConnection;
use App\Models\TicketActivity;
use App\Services\TicketIdGenerator;
use App\Support\MarketplacePlatform;

class MarketplaceComplaintBridgeService
{
    public function __construct(
        private readonly MarketplacePlatformConfigService $platformConfig,
        private readonly TicketIdGenerator $ticketIdGenerator,
    ) {}

    public function maybeCreateComplaintForReview(MarketplaceProductReview $review): ?Complaint
    {
        if ($review->complaint_id || ! $review->rating) {
            return null;
        }

        $settings = $this->platformConfig->getCredentials($review->platform)['settings'];

        if (! ($settings['auto_complaint_enabled'] ?? false)) {
            return null;
        }

        $maxRating = (int) ($settings['auto_complaint_max_rating'] ?? 3);
        if ($review->rating > $maxRating) {
            return null;
        }

        $complaintTypeId = $settings['auto_complaint_type_id'] ?? ComplaintType::query()
            ->where('name', 'Other')
            ->value('id');

        if (! $complaintTypeId) {
            $complaintTypeId = ComplaintType::query()->orderBy('sort_order')->value('id');
        }

        $statusId = ComplaintStatus::query()->where('name', 'New Complaint')->value('id')
            ?? ComplaintStatus::query()->orderBy('sort_order')->value('id');

        $shop = $review->shopConnection;
        $platformLabel = MarketplacePlatform::label($review->platform);
        $reviewer = $review->reviewer_name ?: "{$platformLabel} Buyer";

        $description = trim(implode("\n\n", array_filter([
            "Auto-created from {$platformLabel} product review ({$review->rating}/5).",
            $review->product_name ? "Product: {$review->product_name}" : null,
            $review->review_text ? "Review: {$review->review_text}" : null,
            $shop?->shop_name ? "Shop: {$shop->shop_name}" : null,
        ])));

        $complaint = Complaint::create([
            'ticket_id' => $this->ticketIdGenerator->generate(),
            'customer_name' => $reviewer,
            'customer_phone' => null,
            'order_number' => null,
            'order_source' => MarketplacePlatform::orderSource($review->platform),
            'purchase_date' => ($review->review_created_at ?? now())->toDateString(),
            'complaint_type_id' => $complaintTypeId,
            'description' => $description,
            'status_id' => $statusId,
        ]);

        $review->update(['complaint_id' => $complaint->id]);

        TicketActivity::create([
            'complaint_id' => $complaint->id,
            'action_type' => 'created',
            'description' => "[Marketplace] Auto-created from {$platformLabel} review (rating {$review->rating}/5).",
            'new_value' => $complaint->ticket_id,
        ]);

        return $complaint;
    }
}
