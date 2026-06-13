<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\AppliesEntityQueries;
use App\Http\Controllers\Concerns\AuthorizesPermissions;
use App\Http\Controllers\Controller;
use App\Http\Resources\InternalNoteResource;
use App\Models\Complaint;
use App\Models\InternalNote;
use App\Services\ComplaintNotificationService;
use App\Support\MentionParser;
use App\Support\StoragePath;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class InternalNoteController extends Controller
{
    use AppliesEntityQueries, AuthorizesPermissions;

    public function __construct(
        private ComplaintNotificationService $complaintNotifications,
    ) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $this->ensurePermission($request->user(), 'complaints.view');

        $query = InternalNote::query()->with(['department', 'author']);
        $this->applyFilters($query, $request->except(['sort', 'limit']));
        $this->applySort($query, $request->query('sort', '-created_date'));

        if ($limit = $request->integer('limit')) {
            $query->limit($limit);
        }

        return InternalNoteResource::collection($query->get());
    }

    public function store(Request $request): InternalNoteResource
    {
        $this->ensurePermission($request->user(), 'complaints.add_notes');

        $data = $request->validate([
            'complaint_id' => ['required', 'integer', 'exists:complaints,id'],
            'content' => ['required', 'string'],
            'author_user_id' => ['nullable', 'integer', 'exists:users,id'],
            'department_id' => ['nullable', 'integer', 'exists:departments,id'],
            'attachments' => ['nullable', 'array'],
        ]);

        if (empty($data['author_user_id']) && $request->user()) {
            $data['author_user_id'] = $request->user()->id;
        }

        if (isset($data['attachments'])) {
            $data['attachments'] = StoragePath::normalizeMany($data['attachments']);
        }

        $note = InternalNote::create($data);
        $complaint = Complaint::findOrFail($data['complaint_id']);
        $author = $request->user();

        if ($author) {
            foreach (MentionParser::findMentionedUsers($data['content'], $author->id) as $mentioned) {
                $this->complaintNotifications->notifyMention($complaint, $mentioned, $author, $data['content']);
            }
        }

        return new InternalNoteResource($note->load(['department', 'author']));
    }

    public function update(Request $request, string $id): InternalNoteResource
    {
        $this->ensurePermission($request->user(), 'complaints.add_notes');

        $note = InternalNote::findOrFail($id);

        $data = $request->validate([
            'content' => ['sometimes', 'string'],
            'attachments' => ['nullable', 'array'],
        ]);

        if (isset($data['attachments'])) {
            $data['attachments'] = StoragePath::normalizeMany($data['attachments']);
        }

        $note->update($data);

        return new InternalNoteResource($note->fresh()->load(['department', 'author']));
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $this->ensurePermission($request->user(), 'complaints.add_notes');

        InternalNote::findOrFail($id)->delete();

        return response()->json(['message' => 'Deleted successfully.']);
    }
}
