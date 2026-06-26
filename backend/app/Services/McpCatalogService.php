<?php

namespace App\Services;

class McpCatalogService
{
    /** @return list<array<string, mixed>> */
    public function endpoints(): array
    {
        return [
            [
                'method' => 'POST',
                'path' => '/api/v1/webhook/tracking-update',
                'description' => 'Push tracking numbers or shipment status updates to a complaint ticket, identified by ticket ID or order number.',
                'auth_required' => true,
                'params' => [
                    ['name' => 'X-Webhook-Secret', 'in' => 'header', 'type' => 'string', 'required' => true, 'description' => 'Incoming webhook secret configured in Care settings'],
                    ['name' => 'ticket_id', 'in' => 'body', 'type' => 'string', 'required' => false, 'description' => 'Care ticket ID (e.g. RH-250608-1234); required if order_number is omitted'],
                    ['name' => 'order_number', 'in' => 'body', 'type' => 'string', 'required' => false, 'description' => 'Customer order number; required if ticket_id is omitted'],
                    ['name' => 'tracking_number', 'in' => 'body', 'type' => 'string', 'required' => false, 'description' => 'Primary shipment tracking number'],
                    ['name' => 'replacement_tracking_number', 'in' => 'body', 'type' => 'string', 'required' => false, 'description' => 'Replacement shipment tracking number'],
                    ['name' => 'status', 'in' => 'body', 'type' => 'string', 'required' => false, 'description' => 'Complaint status name to apply (must match an active status in Care)'],
                ],
                'response_example' => [
                    'message' => 'Tracking updated successfully.',
                    'complaint' => [
                        'id' => '42',
                        'ticket_id' => 'RH-250608-1234',
                        'order_number' => 'ORD-2024-001',
                        'tracking_number' => 'JNE123456789',
                        'status' => 'Shipped',
                    ],
                ],
            ],
            [
                'method' => 'POST',
                'path' => '/api/v1/sso/nexus/verify',
                'description' => 'Exchange a Nexus Brain-signed JWT for a Sanctum API token and user profile after an SSO redirect.',
                'auth_required' => true,
                'params' => [
                    ['name' => 'token', 'in' => 'body', 'type' => 'string', 'required' => true, 'description' => 'JWT signed by Nexus Brain with sub, email, exp, and optional redirect_to claims'],
                ],
                'response_example' => [
                    'token' => '1|sanctum-plain-text-token',
                    'user' => [
                        'id' => '1',
                        'email' => 'agent@example.com',
                        'nexus_sso_id' => 'nexus-user-uuid',
                    ],
                    'redirect_to' => '/dashboard',
                ],
            ],
            [
                'method' => 'GET',
                'path' => '/api/v1/complaints',
                'description' => 'List complaint tickets with optional search and filters; unauthenticated callers receive all tickets.',
                'auth_required' => false,
                'params' => [
                    ['name' => 'search', 'in' => 'query', 'type' => 'string', 'required' => false, 'description' => 'Search ticket ID, customer name/phone, order number, or product name/SKU'],
                    ['name' => 'order_number', 'in' => 'query', 'type' => 'string', 'required' => false, 'description' => 'Filter by exact order number'],
                    ['name' => 'status_id', 'in' => 'query', 'type' => 'integer', 'required' => false, 'description' => 'Filter by complaint status ID'],
                    ['name' => 'limit', 'in' => 'query', 'type' => 'integer', 'required' => false, 'description' => 'Maximum number of results to return'],
                    ['name' => 'sort', 'in' => 'query', 'type' => 'string', 'required' => false, 'description' => 'Sort field; prefix with - for descending (default: -created_date)'],
                ],
                'response_example' => [
                    ['id' => '42', 'ticket_id' => 'RH-250608-1234', 'customer_name' => 'Jane Doe', 'order_number' => 'ORD-2024-001', 'status' => 'Open'],
                ],
            ],
            [
                'method' => 'GET',
                'path' => '/api/v1/complaints/{id}',
                'description' => 'Fetch a single complaint ticket by numeric ID, including products, status, and assignment details.',
                'auth_required' => false,
                'params' => [
                    ['name' => 'id', 'in' => 'path', 'type' => 'integer', 'required' => true, 'description' => 'Complaint ID'],
                ],
                'response_example' => [
                    'id' => '42',
                    'ticket_id' => 'RH-250608-1234',
                    'customer_name' => 'Jane Doe',
                    'order_number' => 'ORD-2024-001',
                    'status' => 'Open',
                    'tracking_number' => 'JNE123456789',
                ],
            ],
            [
                'method' => 'GET',
                'path' => '/api/v1/complaint-statuses',
                'description' => 'List active complaint status values for mapping external status strings to Care statuses.',
                'auth_required' => false,
                'params' => [
                    ['name' => 'limit', 'in' => 'query', 'type' => 'integer', 'required' => false, 'description' => 'Maximum number of results to return'],
                    ['name' => 'sort', 'in' => 'query', 'type' => 'string', 'required' => false, 'description' => 'Sort field (default: sort_order)'],
                ],
                'response_example' => [
                    ['id' => '1', 'name' => 'Open', 'color' => '#3B82F6', 'is_active' => true, 'sort_order' => 1],
                ],
            ],
        ];
    }
}
