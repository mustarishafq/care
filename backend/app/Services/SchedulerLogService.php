<?php

namespace App\Services;

use App\Models\MarketplaceShopConnection;
use App\Models\SchedulerLog;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class SchedulerLogService
{
    /**
     * Persist a scheduler/job output line for the admin Scheduler Logs page.
     *
     * @param  array<string, mixed>  $context
     */
    public function write(
        string $command,
        string $level,
        string $message,
        ?string $source = null,
        ?string $title = null,
        array $context = [],
        ?int $shopConnectionId = null,
    ): SchedulerLog {
        $level = in_array($level, SchedulerLog::LEVELS, true) ? $level : SchedulerLog::LEVEL_INFO;
        $command = Str::limit(trim($command) ?: 'unknown', 128, '');
        $source = $source !== null ? Str::limit(trim($source), 128, '') : null;
        if ($source === '') {
            $source = null;
        }

        $message = trim($message);
        if ($message === '') {
            $message = '(empty message)';
        }

        $log = SchedulerLog::query()->create([
            'command' => $command,
            'source' => $source,
            'level' => $level,
            'title' => $title !== null ? Str::limit(trim($title), 255, '') : null,
            'message' => Str::limit($message, 5000, '…'),
            'marketplace_shop_connection_id' => $shopConnectionId,
            'context' => $context !== [] ? $context : null,
        ]);

        $channelPayload = [
            'scheduler_log_id' => $log->id,
            'command' => $command,
            'source' => $source,
            'level' => $level,
            'shop_connection_id' => $shopConnectionId,
        ];

        match ($level) {
            SchedulerLog::LEVEL_ERROR => Log::error($message, $channelPayload),
            SchedulerLog::LEVEL_WARNING => Log::warning($message, $channelPayload),
            default => Log::info($message, $channelPayload),
        };

        return $log;
    }

    public function info(string $command, string $message, ?string $source = null, array $context = [], ?int $shopConnectionId = null, ?string $title = null): SchedulerLog
    {
        return $this->write($command, SchedulerLog::LEVEL_INFO, $message, $source, $title, $context, $shopConnectionId);
    }

    public function success(string $command, string $message, ?string $source = null, array $context = [], ?int $shopConnectionId = null, ?string $title = null): SchedulerLog
    {
        return $this->write($command, SchedulerLog::LEVEL_SUCCESS, $message, $source, $title, $context, $shopConnectionId);
    }

    public function warning(string $command, string $message, ?string $source = null, array $context = [], ?int $shopConnectionId = null, ?string $title = null): SchedulerLog
    {
        return $this->write($command, SchedulerLog::LEVEL_WARNING, $message, $source, $title, $context, $shopConnectionId);
    }

    public function error(string $command, string $message, ?string $source = null, array $context = [], ?int $shopConnectionId = null, ?string $title = null): SchedulerLog
    {
        return $this->write($command, SchedulerLog::LEVEL_ERROR, $message, $source, $title, $context, $shopConnectionId);
    }

    public function forShop(
        string $command,
        string $level,
        string $message,
        MarketplaceShopConnection $connection,
        ?string $source = null,
        array $context = [],
        ?string $title = null,
    ): SchedulerLog {
        return $this->write(
            $command,
            $level,
            $message,
            $source,
            $title,
            array_merge([
                'platform' => $connection->platform,
                'shop_name' => $connection->shop_name,
                'shop_id' => $connection->shop_id,
            ], $context),
            $connection->id,
        );
    }
}
