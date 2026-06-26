<?php

namespace App\Http\Requests\Mcp\V1;

use Illuminate\Foundation\Http\FormRequest;

class IndexComplaintsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'search' => ['nullable', 'string', 'max:255'],
            'order_number' => ['nullable', 'string', 'max:255'],
            'status_id' => ['nullable', 'integer', 'exists:complaint_statuses,id'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:200'],
            'sort_by' => ['nullable', 'string', 'max:64'],
            'sort_order' => ['nullable', 'string', 'in:asc,desc'],
        ];
    }
}
