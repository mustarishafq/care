<?php

namespace Tests\Feature\Mcp\V1;

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
}
