<?php

namespace App\Services;

use App\Models\Complaint;

class ComplaintAffectedProductService
{
    /** @param list<array<string, mixed>> $items */
    public function sync(Complaint $complaint, array $items): void
    {
        $complaint->affectedProducts()->delete();

        foreach ($items as $sortOrder => $item) {
            $complaint->affectedProducts()->create([
                'product_id' => $item['product_id'],
                'batch_number' => $item['batch_number'] ?? null,
                'quantity_affected' => $item['quantity_affected'] ?? null,
                'unit_of_measurement_id' => $item['unit_of_measurement_id'] ?? null,
                'sort_order' => $sortOrder,
            ]);
        }
    }
}
