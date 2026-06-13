<?php

namespace App\Services;

use App\Models\SystemConfig;
use Illuminate\Support\Str;

class WebhookSettingsService
{
    public const INCOMING_CONFIG_KEY = 'webhook_api_key';

    public const OUTGOING_CONFIG_KEY = 'outgoing_webhook';

    /** @return list<string> */
    public function availableOutgoingEvents(): array
    {
        return OutgoingWebhookService::EVENTS;
    }

    public function webhookAcceptsEvent(array $webhook, string $event): bool
    {
        $events = $webhook['events'] ?? [];

        if ($events === []) {
            return true;
        }

        return in_array($event, $events, true);
    }

    public function getIncomingSecret(): string
    {
        $config = SystemConfig::where('key', self::INCOMING_CONFIG_KEY)->first();
        $value = $config?->json_value ?? [];

        return (string) ($value['secret'] ?? $value['key'] ?? '');
    }

    public function regenerateIncomingSecret(): string
    {
        $secret = bin2hex(random_bytes(32));

        SystemConfig::updateOrCreate(
            ['key' => self::INCOMING_CONFIG_KEY],
            [
                'label' => 'Webhook Secret',
                'json_value' => ['secret' => $secret],
            ]
        );

        return $secret;
    }

    public function ensureIncomingSecret(): string
    {
        $secret = $this->getIncomingSecret();

        if ($secret !== '') {
            return $secret;
        }

        return $this->regenerateIncomingSecret();
    }

    public function validateIncomingSecret(?string $provided): bool
    {
        $stored = $this->getIncomingSecret();

        if (! $provided || ! $stored) {
            return false;
        }

        return hash_equals($stored, $provided);
    }

    /** @return list<array{id: string, name: string, enabled: bool, url: string, secret: string, events: list<string>}> */
    public function getOutgoingWebhooks(): array
    {
        $config = SystemConfig::where('key', self::OUTGOING_CONFIG_KEY)->first();
        $value = $config?->json_value ?? [];

        if (isset($value['webhooks']) && is_array($value['webhooks'])) {
            return array_values(array_map(fn (array $webhook) => $this->normalizeOutgoingWebhook($webhook), $value['webhooks']));
        }

        return $this->migrateLegacyOutgoing($value);
    }

    /**
     * @param  list<array{id?: string, name?: string, enabled?: bool, url?: string, secret?: string, events?: list<string>}>  $webhooks
     * @return list<array{id: string, name: string, enabled: bool, url: string, secret: string, events: list<string>}>
     */
    public function saveOutgoingWebhooks(array $webhooks): array
    {
        $existing = collect($this->getOutgoingWebhooks())->keyBy('id');
        $saved = [];

        foreach ($webhooks as $webhook) {
            $id = (string) ($webhook['id'] ?? '');
            if ($id === '') {
                $id = $this->generateOutgoingWebhookId();
            }

            $previous = $existing->get($id, []);
            $secret = trim((string) ($webhook['secret'] ?? ''));

            if ($secret === '') {
                $secret = (string) ($previous['secret'] ?? '');
            }

            if ($secret === '') {
                $secret = bin2hex(random_bytes(32));
            }

            $saved[] = [
                'id' => $id,
                'name' => trim((string) ($webhook['name'] ?? $previous['name'] ?? 'Webhook')),
                'enabled' => (bool) ($webhook['enabled'] ?? $previous['enabled'] ?? false),
                'url' => trim((string) ($webhook['url'] ?? $previous['url'] ?? '')),
                'secret' => $secret,
                'events' => $this->normalizeEvents($webhook['events'] ?? $previous['events'] ?? []),
            ];
        }

        SystemConfig::updateOrCreate(
            ['key' => self::OUTGOING_CONFIG_KEY],
            [
                'label' => 'Outgoing Webhooks',
                'json_value' => ['webhooks' => $saved],
            ]
        );

        return $saved;
    }

    public function findOutgoingWebhook(string $id): ?array
    {
        foreach ($this->getOutgoingWebhooks() as $webhook) {
            if ($webhook['id'] === $id) {
                return $webhook;
            }
        }

        return null;
    }

    public function regenerateOutgoingSecret(string $id): ?string
    {
        $webhooks = $this->getOutgoingWebhooks();
        $newSecret = null;

        foreach ($webhooks as &$webhook) {
            if ($webhook['id'] !== $id) {
                continue;
            }

            $webhook['secret'] = bin2hex(random_bytes(32));
            $newSecret = $webhook['secret'];
            break;
        }
        unset($webhook);

        if ($newSecret === null) {
            return null;
        }

        SystemConfig::updateOrCreate(
            ['key' => self::OUTGOING_CONFIG_KEY],
            [
                'label' => 'Outgoing Webhooks',
                'json_value' => ['webhooks' => $webhooks],
            ]
        );

        return $newSecret;
    }

    /**
     * @param  list<array{id: string, name: string, enabled: bool, url: string, secret: string, events: list<string>}>  $webhooks
     * @return list<array{id: string, name: string, enabled: bool, url: string, secret: string|null, header: string, events: list<string>}>
     */
    public function presentOutgoingWebhooks(array $webhooks, bool $includeSecrets): array
    {
        return array_map(fn (array $webhook) => [
            'id' => $webhook['id'],
            'name' => $webhook['name'],
            'enabled' => $webhook['enabled'],
            'url' => $webhook['url'],
            'secret' => $includeSecrets ? $webhook['secret'] : null,
            'header' => 'X-Webhook-Secret',
            'events' => $webhook['events'],
        ], $webhooks);
    }

    public function incomingEndpointUrl(): string
    {
        return Str::of(config('app.url'))
            ->rtrim('/')
            ->append('/api/v1/webhook/tracking-update')
            ->toString();
    }

    /** @return list<array{id: string, name: string, enabled: bool, url: string, secret: string}> */
    private function migrateLegacyOutgoing(array $value): array
    {
        $url = trim((string) ($value['url'] ?? ''));
        $secret = (string) ($value['secret'] ?? '');

        if ($url === '' && $secret === '' && ! ($value['enabled'] ?? false)) {
            return [];
        }

        return [[
            'id' => $this->generateOutgoingWebhookId(),
            'name' => 'Default Webhook',
            'enabled' => (bool) ($value['enabled'] ?? false),
            'url' => $url,
            'secret' => $secret !== '' ? $secret : bin2hex(random_bytes(32)),
            'events' => [],
        ]];
    }

    /** @param  array<string, mixed>  $webhook */
    private function normalizeOutgoingWebhook(array $webhook): array
    {
        $secret = trim((string) ($webhook['secret'] ?? ''));

        return [
            'id' => (string) ($webhook['id'] ?? $this->generateOutgoingWebhookId()),
            'name' => trim((string) ($webhook['name'] ?? 'Webhook')),
            'enabled' => (bool) ($webhook['enabled'] ?? false),
            'url' => trim((string) ($webhook['url'] ?? '')),
            'secret' => $secret !== '' ? $secret : bin2hex(random_bytes(32)),
            'events' => $this->normalizeEvents($webhook['events'] ?? []),
        ];
    }

    /** @param  list<string>|mixed  $events */
    public function normalizeEventsForRequest(mixed $events): array
    {
        return $this->normalizeEvents($events);
    }

    /** @param  list<string>|mixed  $events */
    private function normalizeEvents(mixed $events): array
    {
        if (! is_array($events)) {
            return [];
        }

        return array_values(array_unique(array_filter(
            $events,
            fn ($event) => is_string($event) && in_array($event, $this->availableOutgoingEvents(), true),
        )));
    }

    private function generateOutgoingWebhookId(): string
    {
        return 'wh_'.bin2hex(random_bytes(8));
    }
}
