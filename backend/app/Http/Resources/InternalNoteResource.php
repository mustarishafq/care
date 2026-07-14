<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\HasLegacyDates;
use App\Support\StoragePath;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class InternalNoteResource extends JsonResource
{
    use HasLegacyDates;

    public function toArray(Request $request): array
    {
        return $this->withLegacyDates([
            'id' => (string) $this->id,
            'complaint_id' => $this->complaint_id ? (string) $this->complaint_id : null,
            'content' => $this->content,
            'author_user_id' => $this->author_user_id ? (string) $this->author_user_id : null,
            'author_email' => $this->author?->email,
            'author_name' => $this->author?->full_name ?? $this->author?->name,
            'author_avatar_url' => StoragePath::resolveAvatarUrl($this->author?->avatar_url),
            'department_id' => $this->department_id ? (string) $this->department_id : null,
            'department' => $this->department?->name,
            'attachments' => StoragePath::urlMany($this->attachments),
        ], $this->resource);
    }
}
