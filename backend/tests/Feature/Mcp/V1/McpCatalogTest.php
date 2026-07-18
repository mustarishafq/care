<?php

namespace Tests\Feature\Mcp\V1;

use App\Services\WebhookSettingsService;
use Tests\TestCase;

class McpCatalogTest extends TestCase
{
    private const API_KEY = 'test-mcp-api-key-with-32-chars-min';

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'mcp.api_key' => self::API_KEY,
            'mcp.api_keys' => [],
            'mcp.rate_limit' => 60,
        ]);

        $this->mock(WebhookSettingsService::class, function ($mock): void {
            $mock->shouldReceive('validateIncomingSecret')
                ->andReturnUsing(fn (?string $secret) => $secret === 'incoming-webhook-secret');
        });
    }

    public function test_catalog_requires_authentication(): void
    {
        $this->getJson('/api/mcp/v1/catalog')
            ->assertUnauthorized()
            ->assertJson([
                'success' => false,
                'message' => 'Invalid or missing credentials.',
            ]);
    }

    public function test_catalog_returns_standard_envelope_with_endpoints(): void
    {
        $response = $this->withHeader('X-API-Key', self::API_KEY)
            ->getJson('/api/mcp/v1/catalog');

        $response->assertOk()
            ->assertJson([
                'success' => true,
                'message' => null,
            ])
            ->assertJsonStructure([
                'data' => [
                    '*' => ['method', 'path', 'description', 'auth'],
                ],
                'meta',
            ]);

        $paths = collect($response->json('data'))->pluck('path');

        $this->assertTrue($paths->contains('/api/mcp/v1/catalog'));
        $this->assertTrue($paths->contains('/api/mcp/v1/complaints'));
        $this->assertTrue($paths->contains('/api/mcp/v1/reviews'));
        $this->assertTrue($paths->contains('/api/mcp/v1/reviews/{id}'));
        $this->assertTrue($paths->contains('/api/mcp/v1/reviews/{id}/reply'));
        $this->assertTrue($paths->contains('/api/v1/sso/nexus/verify'));
    }

    public function test_rotated_api_key_is_accepted(): void
    {
        config([
            'mcp.api_key' => 'primary-key-32-characters-long!!!',
            'mcp.api_keys' => [self::API_KEY],
        ]);

        $this->withHeader('X-API-Key', self::API_KEY)
            ->getJson('/api/mcp/v1/catalog')
            ->assertOk()
            ->assertJson(['success' => true]);
    }

    public function test_webhook_secret_header_is_accepted(): void
    {
        $this->withHeader('X-Webhook-Secret', 'incoming-webhook-secret')
            ->getJson('/api/mcp/v1/catalog')
            ->assertOk()
            ->assertJson(['success' => true]);
    }

    public function test_webhook_secret_via_bearer_is_accepted(): void
    {
        $this->withHeader('Authorization', 'Bearer incoming-webhook-secret')
            ->getJson('/api/mcp/v1/catalog')
            ->assertOk()
            ->assertJson(['success' => true]);
    }

    public function test_webhook_secret_via_x_api_key_header_is_accepted(): void
    {
        config(['mcp.api_key' => null, 'mcp.api_keys' => []]);

        $this->withHeader('X-API-Key', 'incoming-webhook-secret')
            ->getJson('/api/mcp/v1/catalog')
            ->assertOk()
            ->assertJson(['success' => true]);
    }

    public function test_complaints_index_validates_query_parameters_without_database(): void
    {
        $this->withHeader('X-API-Key', self::API_KEY)
            ->getJson('/api/mcp/v1/complaints?per_page=500')
            ->assertUnprocessable()
            ->assertJson([
                'success' => false,
                'message' => 'The given data was invalid.',
            ]);
    }

    public function test_reviews_index_validates_query_parameters_without_database(): void
    {
        $this->withHeader('X-API-Key', self::API_KEY)
            ->getJson('/api/mcp/v1/reviews?per_page=500')
            ->assertUnprocessable()
            ->assertJson([
                'success' => false,
                'message' => 'The given data was invalid.',
            ]);
    }

    public function test_reviews_reply_validates_body_without_database(): void
    {
        $this->withHeader('X-API-Key', self::API_KEY)
            ->postJson('/api/mcp/v1/reviews/1/reply', [])
            ->assertUnprocessable()
            ->assertJson([
                'success' => false,
                'message' => 'The given data was invalid.',
            ]);
    }
}
