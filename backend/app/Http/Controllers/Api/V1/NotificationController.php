<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\AppliesEntityQueries;
use App\Http\Controllers\Controller;
use App\Http\Resources\NotificationResource;
use App\Models\Notification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Mail;

class NotificationController extends Controller
{
    use AppliesEntityQueries;

    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Notification::query();
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
            'recipient_email' => ['required', 'email'],
            'title' => ['required', 'string', 'max:255'],
            'message' => ['required', 'string'],
            'type' => ['required', 'string', 'max:255'],
            'complaint_id' => ['nullable', 'string'],
            'is_read' => ['nullable', 'boolean'],
        ]);

        $notification = Notification::create($data);

        return new NotificationResource($notification);
    }

    public function update(Request $request, string $id): NotificationResource
    {
        $notification = Notification::findOrFail($id);
        $notification->update($request->validate([
            'is_read' => ['sometimes', 'boolean'],
        ]));

        return new NotificationResource($notification->fresh());
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
