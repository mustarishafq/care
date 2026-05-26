<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\HasLegacyDates;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SystemConfigResource extends JsonResource
{
    use HasLegacyDates;

    public function toArray(Request $request): array
    {
        return $this->withLegacyDates([
            'id' => (string) $this->id,
            'key' => $this->key,
            'label' => $this->label,
            'value' => $this->value ?? [],
            'json_value' => $this->json_value,
        ], $this->resource);
    }
}
