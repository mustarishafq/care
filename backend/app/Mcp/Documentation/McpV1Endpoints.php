<?php

namespace App\Mcp\Documentation;

class McpV1Endpoints
{
    /** @return list<string> */
    private static function serverAuth(): array
    {
        return ['X-API-Key', 'X-Webhook-Secret', 'Bearer'];
    }

    /** @return list<array<string, mixed>> */
    public static function all(): array
    {
        return [
            self::catalog(),
            self::listComplaints(),
            self::showComplaint(),
            self::listComplaintStatuses(),
            self::trackingUpdate(),
            self::ssoVerify(),
        ];
    }

    /** @return array<string, mixed> */
    private static function catalog(): array
    {
        return [
            'method' => 'GET',
            'path' => '/api/mcp/v1/catalog',
            'description' => 'Discover all MCP v1 endpoints available on this Care instance, including auth requirements and example payloads.',
            'auth' => self::serverAuth(),
            'params' => [],
            'request_example' => 'GET /api/mcp/v1/catalog',
            'response_example' => [
                'success' => true,
                'message' => null,
                'data' => [
                    [
                        'method' => 'GET',
                        'path' => '/api/mcp/v1/complaints',
                        'description' => 'List or search complaint tickets with filtering, sorting, and pagination.',
                        'auth' => self::serverAuth(),
                    ],
                ],
                'meta' => new \stdClass,
            ],
            'error_examples' => [
                ['status' => 401, 'message' => 'Invalid or missing credentials.'],
            ],
        ];
    }

    /** @return array<string, mixed> */
    private static function listComplaints(): array
    {
        return [
            'method' => 'GET',
            'path' => '/api/mcp/v1/complaints',
            'description' => 'List or search complaint tickets with filtering, sorting, and pagination.',
            'auth' => self::serverAuth(),
            'params' => [
                ['name' => 'search', 'in' => 'query', 'type' => 'string', 'required' => false, 'description' => 'Search ticket ID, customer name/phone, order number, or product name/SKU'],
                ['name' => 'order_number', 'in' => 'query', 'type' => 'string', 'required' => false, 'description' => 'Filter by exact order number'],
                ['name' => 'status_id', 'in' => 'query', 'type' => 'integer', 'required' => false, 'description' => 'Filter by complaint status ID'],
                ['name' => 'page', 'in' => 'query', 'type' => 'integer', 'required' => false, 'description' => 'Page number'],
                ['name' => 'per_page', 'in' => 'query', 'type' => 'integer', 'required' => false, 'rules' => 'min:1|max:200', 'description' => 'Results per page (default 50)'],
                ['name' => 'sort_by', 'in' => 'query', 'type' => 'string', 'required' => false, 'description' => 'Sort field (default: created_date)'],
                ['name' => 'sort_order', 'in' => 'query', 'type' => 'string', 'required' => false, 'description' => 'asc or desc (default: desc)'],
            ],
            'request_example' => 'GET /api/mcp/v1/complaints?search=jane&page=1&per_page=50',
            'response_example' => [
                'success' => true,
                'message' => null,
                'data' => [
                    ['id' => '42', 'ticket_id' => 'RH-250608-1234', 'customer_name' => 'Jane Doe', 'order_number' => 'ORD-2024-001', 'status' => 'Open'],
                ],
                'meta' => ['current_page' => 1, 'last_page' => 1, 'per_page' => 50, 'total' => 1],
            ],
            'error_examples' => [
                ['status' => 401, 'message' => 'Invalid or missing credentials.'],
                ['status' => 422, 'message' => 'The given data was invalid.'],
            ],
        ];
    }

    /** @return array<string, mixed> */
    private static function showComplaint(): array
    {
        return [
            'method' => 'GET',
            'path' => '/api/mcp/v1/complaints/{id}',
            'description' => 'Fetch a single complaint ticket by numeric ID, including products, status, and assignment details.',
            'auth' => self::serverAuth(),
            'params' => [
                ['name' => 'id', 'in' => 'path', 'type' => 'integer', 'required' => true, 'description' => 'Complaint ID'],
            ],
            'request_example' => 'GET /api/mcp/v1/complaints/42',
            'response_example' => [
                'success' => true,
                'message' => null,
                'data' => [
                    'id' => '42',
                    'ticket_id' => 'RH-250608-1234',
                    'customer_name' => 'Jane Doe',
                    'order_number' => 'ORD-2024-001',
                    'status' => 'Open',
                    'tracking_number' => 'JNE123456789',
                ],
                'meta' => new \stdClass,
            ],
            'error_examples' => [
                ['status' => 401, 'message' => 'Invalid or missing credentials.'],
                ['status' => 403, 'message' => 'You do not have permission to view this ticket.'],
                ['status' => 404, 'message' => 'Complaint not found.'],
            ],
        ];
    }

    /** @return array<string, mixed> */
    private static function listComplaintStatuses(): array
    {
        return [
            'method' => 'GET',
            'path' => '/api/mcp/v1/complaint-statuses',
            'description' => 'List active complaint status values for mapping external status strings to Care statuses.',
            'auth' => self::serverAuth(),
            'params' => [
                ['name' => 'page', 'in' => 'query', 'type' => 'integer', 'required' => false, 'description' => 'Page number'],
                ['name' => 'per_page', 'in' => 'query', 'type' => 'integer', 'required' => false, 'rules' => 'min:1|max:200'],
                ['name' => 'sort_by', 'in' => 'query', 'type' => 'string', 'required' => false, 'description' => 'Sort field (default: sort_order)'],
                ['name' => 'sort_order', 'in' => 'query', 'type' => 'string', 'required' => false, 'description' => 'asc or desc (default: asc)'],
            ],
            'request_example' => 'GET /api/mcp/v1/complaint-statuses',
            'response_example' => [
                'success' => true,
                'message' => null,
                'data' => [
                    ['id' => '1', 'name' => 'Open', 'color' => '#3B82F6', 'is_active' => true, 'sort_order' => 1],
                ],
                'meta' => ['current_page' => 1, 'last_page' => 1, 'per_page' => 50, 'total' => 1],
            ],
            'error_examples' => [
                ['status' => 401, 'message' => 'Invalid or missing credentials.'],
            ],
        ];
    }

    /** @return array<string, mixed> */
    private static function trackingUpdate(): array
    {
        return [
            'method' => 'POST',
            'path' => '/api/mcp/v1/webhooks/tracking-update',
            'description' => 'Push tracking numbers or shipment status updates to a complaint ticket, identified by ticket ID or order number.',
            'auth' => self::serverAuth(),
            'params' => [
                ['name' => 'ticket_id', 'in' => 'body', 'type' => 'string', 'required' => false, 'description' => 'Care ticket ID (e.g. RH-250608-1234); required if order_number is omitted'],
                ['name' => 'order_number', 'in' => 'body', 'type' => 'string', 'required' => false, 'description' => 'Customer order number; required if ticket_id is omitted'],
                ['name' => 'tracking_number', 'in' => 'body', 'type' => 'string', 'required' => false, 'description' => 'Primary shipment tracking number'],
                ['name' => 'replacement_tracking_number', 'in' => 'body', 'type' => 'string', 'required' => false, 'description' => 'Replacement shipment tracking number'],
                ['name' => 'status', 'in' => 'body', 'type' => 'string', 'required' => false, 'description' => 'Complaint status name to apply (must match an active status in Care)'],
            ],
            'request_example' => 'POST /api/mcp/v1/webhooks/tracking-update {"ticket_id":"RH-250608-1234","tracking_number":"JNE123456789"}',
            'response_example' => [
                'success' => true,
                'message' => 'Tracking updated successfully.',
                'data' => [
                    'id' => '42',
                    'ticket_id' => 'RH-250608-1234',
                    'order_number' => 'ORD-2024-001',
                    'tracking_number' => 'JNE123456789',
                    'status' => 'Shipped',
                ],
                'meta' => new \stdClass,
            ],
            'error_examples' => [
                ['status' => 401, 'message' => 'Invalid or missing credentials.'],
                ['status' => 404, 'message' => 'Complaint not found.'],
                ['status' => 422, 'message' => 'The given data was invalid.'],
            ],
        ];
    }

    /** @return array<string, mixed> */
    private static function ssoVerify(): array
    {
        return [
            'method' => 'POST',
            'path' => '/api/v1/sso/nexus/verify',
            'description' => 'Exchange a Nexus Brain-signed JWT for a Sanctum API token and user profile after an SSO redirect.',
            'auth' => self::serverAuth(),
            'params' => [
                ['name' => 'token', 'in' => 'body', 'type' => 'string', 'required' => true, 'description' => 'JWT signed by Nexus Brain with sub, email, exp, and optional redirect_to claims'],
            ],
            'request_example' => 'POST /api/v1/sso/nexus/verify {"token":"<jwt>"}',
            'response_example' => [
                'token' => '1|sanctum-plain-text-token',
                'user' => [
                    'id' => '1',
                    'email' => 'agent@example.com',
                    'nexus_sso_id' => 'nexus-user-uuid',
                ],
                'redirect_to' => '/dashboard',
            ],
            'error_examples' => [
                ['status' => 401, 'message' => 'Invalid token signature.'],
                ['status' => 422, 'message' => 'SSO is not configured.'],
            ],
        ];
    }
}
