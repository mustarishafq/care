<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\AuthorizesPermissions;
use App\Http\Controllers\Controller;
use App\Http\Resources\SchedulerLogResource;
use App\Models\SchedulerLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SchedulerLogController extends Controller
{
    use AuthorizesPermissions;

    public function index(Request $request): JsonResponse
    {
        $this->ensurePermission($request->user(), 'scheduler.view');

        $validated = $request->validate([
            'command' => ['sometimes', 'nullable', 'string', 'max:128'],
            'level' => ['sometimes', 'nullable', 'string', 'in:'.implode(',', SchedulerLog::LEVELS)],
            'source' => ['sometimes', 'nullable', 'string', 'max:128'],
            'search' => ['sometimes', 'nullable', 'string', 'max:255'],
            'start_date' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'end_date' => ['sometimes', 'nullable', 'date_format:Y-m-d', 'after_or_equal:start_date'],
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);

        $search = isset($validated['search']) ? trim((string) $validated['search']) : null;
        if ($search === '') {
            $search = null;
        }

        $query = SchedulerLog::query()
            ->with('shopConnection')
            ->when($validated['command'] ?? null, fn ($q, $command) => $q->where('command', $command))
            ->when($validated['level'] ?? null, fn ($q, $level) => $q->where('level', $level))
            ->when($validated['source'] ?? null, fn ($q, $source) => $q->where('source', 'like', '%'.$source.'%'))
            ->when($search, function ($q) use ($search) {
                $like = '%'.$search.'%';
                $q->where(function ($inner) use ($like) {
                    $inner->where('message', 'like', $like)
                        ->orWhere('title', 'like', $like)
                        ->orWhere('command', 'like', $like)
                        ->orWhere('source', 'like', $like);
                });
            })
            ->when(! empty($validated['start_date']), function ($q) use ($validated) {
                $q->where(
                    'created_at',
                    '>=',
                    \Carbon\Carbon::createFromFormat('Y-m-d', $validated['start_date'])->startOfDay(),
                );
            })
            ->when(! empty($validated['end_date']), function ($q) use ($validated) {
                $q->where(
                    'created_at',
                    '<=',
                    \Carbon\Carbon::createFromFormat('Y-m-d', $validated['end_date'])->endOfDay(),
                );
            })
            ->orderByDesc('id');

        $paginator = $query->paginate(
            perPage: min(max((int) ($validated['per_page'] ?? 30), 1), 100),
            page: max((int) ($validated['page'] ?? 1), 1),
        );

        $statsBase = SchedulerLog::query()
            ->when(! empty($validated['start_date']), function ($q) use ($validated) {
                $q->where(
                    'created_at',
                    '>=',
                    \Carbon\Carbon::createFromFormat('Y-m-d', $validated['start_date'])->startOfDay(),
                );
            })
            ->when(! empty($validated['end_date']), function ($q) use ($validated) {
                $q->where(
                    'created_at',
                    '<=',
                    \Carbon\Carbon::createFromFormat('Y-m-d', $validated['end_date'])->endOfDay(),
                );
            });

        $stats = [
            'total' => (clone $statsBase)->count(),
            'info' => (clone $statsBase)->where('level', SchedulerLog::LEVEL_INFO)->count(),
            'success' => (clone $statsBase)->where('level', SchedulerLog::LEVEL_SUCCESS)->count(),
            'warning' => (clone $statsBase)->where('level', SchedulerLog::LEVEL_WARNING)->count(),
            'error' => (clone $statsBase)->where('level', SchedulerLog::LEVEL_ERROR)->count(),
        ];

        $commands = SchedulerLog::query()
            ->select('command')
            ->distinct()
            ->orderBy('command')
            ->pluck('command')
            ->values()
            ->all();

        return response()->json([
            'data' => SchedulerLogResource::collection($paginator->items())->resolve(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
            ],
            'stats' => $stats,
            'commands' => $commands,
        ]);
    }
}
