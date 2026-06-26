<?php

namespace App\Http\Requests\Mcp\V1;

use Illuminate\Foundation\Http\FormRequest;

class TrackingUpdateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'ticket_id' => ['required_without:order_number', 'string'],
            'order_number' => ['required_without:ticket_id', 'string'],
            'tracking_number' => ['nullable', 'string'],
            'replacement_tracking_number' => ['nullable', 'string'],
            'status' => ['nullable', 'string'],
        ];
    }
}
