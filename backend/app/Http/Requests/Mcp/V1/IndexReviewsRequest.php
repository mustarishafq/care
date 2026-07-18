<?php

namespace App\Http\Requests\Mcp\V1;

use App\Support\MarketplacePlatform;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class IndexReviewsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'platform' => ['nullable', 'string', 'max:32', Rule::in(MarketplacePlatform::all())],
            'shop_connection_id' => ['nullable', 'integer'],
            'product_name' => ['nullable', 'string', 'max:255'],
            'reviewer_name' => ['nullable', 'string', 'max:255'],
            'min_rating' => ['nullable', 'integer', 'min:1', 'max:5'],
            'max_rating' => ['nullable', 'integer', 'min:1', 'max:5'],
            'reply_status' => ['nullable', 'string', Rule::in(['replied', 'unreplied'])],
            'start_date' => ['nullable', 'date_format:Y-m-d'],
            'end_date' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:start_date'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:200'],
        ];
    }
}
