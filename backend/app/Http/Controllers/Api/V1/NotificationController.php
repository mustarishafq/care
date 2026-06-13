<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\AppliesEntityQueries;
use App\Http\Controllers\Controller;
use App\Http\Resources\NotificationResource;
use App\Models\Notification;
use App\Support\NotificationPayload;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Mail;

class NotificationController extends Controller
{
    use AppliesEntityQueries;

    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Notification::query()->with('recipient');
        $this->applyFilters($query, $request->except(['sort', 'limit']));
        $this->applySort($query, $request->query('sort', '-created_date'));

        if ($limit = $request->integer('limit')) {
            $query->limit($limit);
        }

        return NotificationResource::collection($query->get());
    }

    public function store(Request $request): NotificationResource
    {
        $data = $request->validate([
            'recipient_user_id' => ['required', 'integer', 'exists:users,id'],
            'title' => ['required', 'string', 'max:255'],
            'message' => ['required', 'string'],
            'type' => ['required', 'string', 'max:255'],
            'severity' => ['nullable', 'string', 'in:'.implode(',', NotificationPayload::SEVERITIES)],
            'category' => ['nullable', 'string', 'in:'.implode(',', NotificationPayload::CATEGORIES)],
            'action_url' => ['nullable', 'string', 'max:2048'],
            'complaint_id' => ['nullable', 'integer', 'exists:complaints,id'],
            'is_read' => ['nullable', 'boolean'],
        ]);

        $notification = Notification::create(NotificationPayload::normalize($data));

        return new NotificationResource($notification->load('recipient'));
    }

    public function update(Request $request, string $id): NotificationResource
    {
        $notification = Notification::findOrFail($id);
        $notification->update($request->validate([
            'is_read' => ['sometimes', 'boolean'],
        ]));

        return new NotificationResource($notification->fresh()->load('recipient'));
    }

    public function sendEmail(Request $request): JsonResponse
    {
        $data = $request->validate([
            'to' => ['required', 'email'],
            'subject' => ['required', 'string', 'max:255'],
            'body' => ['required', 'string'],
        ]);

        Mail::raw($data['body'], function ($message) use ($data) {
            $message->to($data['to'])
                ->subject($data['subject']);
        });

        return response()->json(['message' => 'Email sent successfully.']);
    }

    public function destroy(string $id): JsonResponse
    {
        Notification::findOrFail($id)->delete();

        return response()->json(['message' => 'Deleted successfully.']);
    }
}
