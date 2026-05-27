<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\HasLegacyDates;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProductResource extends JsonResource
{
    use HasLegacyDates;

    public function toArray(Request $request): array
    {
        return $this->withLegacyDates([
            'id' => (string) $this->id,
            'name' => $this->name,
            'sku' => $this->sku,
            'category_id' => $this->category_id ? (string) $this->category_id : null,
            'category' => $this->category?->name,
            'description' => $this->description,
            'is_active' => $this->is_active,
        ], $this->resource);
    }
}
