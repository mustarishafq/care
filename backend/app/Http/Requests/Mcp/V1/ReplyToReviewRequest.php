<?php

namespace App\Http\Requests\Mcp\V1;

use Illuminate\Foundation\Http\FormRequest;

class ReplyToReviewRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'content' => ['required', 'string', 'max:2000'],
        ];
    }
}
