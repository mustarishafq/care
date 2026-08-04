<?php

namespace Tests\Feature;

use App\Models\Complaint;
use App\Models\ComplaintStatus;
use App\Models\ComplaintType;
use App\Models\Product;
use App\Models\Role;
use App\Models\SystemConfig;
use App\Models\User;
use App\Services\ComplaintDuplicateCheckService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ComplaintDuplicateCheckTest extends TestCase
{
    use RefreshDatabase;

    private User $actor;

    private ComplaintType $complaintType;

    private Product $product;

    private ComplaintStatus $status;

    protected function migrateFreshUsing(): array
    {
        return ['--path' => 'database/migrations/testing'];
    }

    protected function setUp(): void
    {
        parent::setUp();

        $role = Role::create([
            'slug' => 'admin',
            'name' => 'Admin',
            'permissions' => [],
            'is_active' => true,
            'is_admin' => true,
        ]);

        $this->actor = User::factory()->create([
            'role_id' => $role->id,
            'approval_status' => User::APPROVAL_APPROVED,
            'status' => User::STATUS_ACTIVE,
        ]);

        $this->complaintType = ComplaintType::create(['name' => 'Damaged Item']);
        $this->product = Product::create(['name' => 'Test Product']);
        $this->status = ComplaintStatus::create([
            'name' => 'New Complaint',
            'color' => '#3b82f6',
            'is_active' => true,
            'sort_order' => 1,
        ]);

        Sanctum::actingAs($this->actor);
    }

    public function test_check_duplicates_returns_empty_when_disabled(): void
    {
        $this->configureDuplicateCheck(enabled: false, fields: ['tracking_number'], mode: 'warn');
        $this->createComplaint(['tracking_number' => 'TRK-DUP-1']);

        $this->postJson('/api/v1/complaints/check-duplicates', [
            'tracking_number' => 'TRK-DUP-1',
        ])->assertOk()->assertJson(['duplicates' => []]);
    }

    public function test_check_duplicates_matches_tracking_order_and_phone(): void
    {
        $this->configureDuplicateCheck(
            enabled: true,
            fields: ['tracking_number', 'order_number', 'customer_phone'],
            mode: 'warn',
            matchLogic: 'or',
        );

        $byTracking = $this->createComplaint([
            'tracking_number' => 'TRK-AAA',
            'order_number' => 'ORD-1',
            'customer_phone' => '111',
        ]);
        $byOrder = $this->createComplaint([
            'tracking_number' => 'TRK-BBB',
            'order_number' => 'ORD-MATCH',
            'customer_phone' => '222',
        ]);
        $byPhone = $this->createComplaint([
            'tracking_number' => 'TRK-CCC',
            'order_number' => 'ORD-3',
            'customer_phone' => '0999-8888',
        ]);

        $response = $this->postJson('/api/v1/complaints/check-duplicates', [
            'tracking_number' => 'trk-aaa',
            'order_number' => 'ord-match',
            'customer_phone' => '0999-8888',
        ])->assertOk();

        $ids = collect($response->json('duplicates'))->pluck('id')->all();
        $this->assertContains($byTracking->id, $ids);
        $this->assertContains($byOrder->id, $ids);
        $this->assertContains($byPhone->id, $ids);
    }

    public function test_and_logic_requires_all_selected_fields_to_match(): void
    {
        $this->configureDuplicateCheck(
            enabled: true,
            fields: ['tracking_number', 'customer_phone'],
            mode: 'warn',
            matchLogic: 'and',
        );

        $fullMatch = $this->createComplaint([
            'tracking_number' => 'TRK-AND',
            'customer_phone' => '60111111111',
        ]);
        $this->createComplaint([
            'tracking_number' => 'TRK-AND',
            'customer_phone' => '60222222222',
        ]);
        $this->createComplaint([
            'tracking_number' => 'TRK-OTHER',
            'customer_phone' => '60111111111',
        ]);

        $response = $this->postJson('/api/v1/complaints/check-duplicates', [
            'tracking_number' => 'TRK-AND',
            'customer_phone' => '60111111111',
        ])->assertOk();

        $ids = collect($response->json('duplicates'))->pluck('id')->all();
        $this->assertSame([$fullMatch->id], $ids);
    }

    public function test_and_logic_returns_empty_when_a_selected_field_is_missing(): void
    {
        $this->configureDuplicateCheck(
            enabled: true,
            fields: ['tracking_number', 'customer_phone'],
            mode: 'warn',
            matchLogic: 'and',
        );

        $this->createComplaint([
            'tracking_number' => 'TRK-AND-MISS',
            'customer_phone' => '60333333333',
        ]);

        $this->postJson('/api/v1/complaints/check-duplicates', [
            'tracking_number' => 'TRK-AND-MISS',
        ])->assertOk()->assertJson(['duplicates' => []]);
    }

    public function test_check_duplicates_excludes_self_on_edit(): void
    {
        $this->configureDuplicateCheck(enabled: true, fields: ['tracking_number'], mode: 'warn');
        $existing = $this->createComplaint(['tracking_number' => 'TRK-SELF']);

        $this->postJson('/api/v1/complaints/check-duplicates', [
            'tracking_number' => 'TRK-SELF',
            'exclude_id' => $existing->id,
        ])->assertOk()->assertJson(['duplicates' => []]);
    }

    public function test_warn_mode_allows_create_without_override(): void
    {
        $this->configureDuplicateCheck(enabled: true, fields: ['tracking_number'], mode: 'warn');
        $this->createComplaint(['tracking_number' => 'TRK-WARN']);

        $this->postJson('/api/v1/complaints', $this->validPayload([
            'tracking_number' => 'TRK-WARN',
        ]))->assertSuccessful();
    }

    public function test_hard_block_rejects_create(): void
    {
        $this->configureDuplicateCheck(enabled: true, fields: ['tracking_number'], mode: 'hard_block');
        $existing = $this->createComplaint(['tracking_number' => 'TRK-HARD']);

        $this->postJson('/api/v1/complaints', $this->validPayload([
            'tracking_number' => 'TRK-HARD',
            'duplicate_override' => true,
        ]))
            ->assertStatus(422)
            ->assertJsonPath('code', 'duplicate_complaints')
            ->assertJsonPath('mode', 'hard_block')
            ->assertJsonPath('duplicates.0.id', $existing->id);
    }

    public function test_require_override_blocks_without_flag_and_allows_with_flag(): void
    {
        $this->configureDuplicateCheck(enabled: true, fields: ['order_number'], mode: 'require_override');
        $this->createComplaint(['order_number' => 'ORD-OVERRIDE', 'tracking_number' => 'TRK-1']);

        $this->postJson('/api/v1/complaints', $this->validPayload([
            'order_number' => 'ORD-OVERRIDE',
            'tracking_number' => 'TRK-2',
        ]))
            ->assertStatus(422)
            ->assertJsonPath('code', 'duplicate_complaints')
            ->assertJsonPath('mode', 'require_override');

        $this->postJson('/api/v1/complaints', $this->validPayload([
            'order_number' => 'ORD-OVERRIDE',
            'tracking_number' => 'TRK-3',
            'duplicate_override' => true,
        ]))->assertSuccessful();
    }

    public function test_update_hard_block_when_changing_to_duplicate_tracking(): void
    {
        $this->configureDuplicateCheck(enabled: true, fields: ['tracking_number'], mode: 'hard_block');
        $this->createComplaint(['tracking_number' => 'TRK-EXISTING']);
        $target = $this->createComplaint(['tracking_number' => 'TRK-OTHER']);

        $this->patchJson("/api/v1/complaints/{$target->id}", [
            'tracking_number' => 'TRK-EXISTING',
        ])
            ->assertStatus(422)
            ->assertJsonPath('code', 'duplicate_complaints');
    }

    public function test_create_form_options_includes_duplicate_check_settings(): void
    {
        $this->configureDuplicateCheck(
            enabled: true,
            fields: ['customer_phone'],
            mode: 'hard_block',
            matchLogic: 'and',
        );

        $this->getJson('/api/v1/complaints/create-form-options')
            ->assertOk()
            ->assertJsonPath('duplicate_check.enabled', true)
            ->assertJsonPath('duplicate_check.mode', 'hard_block')
            ->assertJsonPath('duplicate_check.match_logic', 'and')
            ->assertJsonPath('duplicate_check.fields.0', 'customer_phone');
    }

    /** @param  list<string>  $fields */
    private function configureDuplicateCheck(
        bool $enabled,
        array $fields,
        string $mode,
        string $matchLogic = 'or',
    ): void {
        SystemConfig::query()->updateOrCreate(
            ['key' => ComplaintDuplicateCheckService::CONFIG_KEY],
            [
                'json_value' => [
                    'enabled' => $enabled,
                    'fields' => $fields,
                    'mode' => $mode,
                    'match_logic' => $matchLogic,
                ],
            ],
        );
    }

    /** @param  array<string, mixed>  $overrides */
    private function createComplaint(array $overrides = []): Complaint
    {
        return Complaint::create(array_merge([
            'ticket_id' => 'TKT-'.uniqid(),
            'customer_name' => 'Jane Doe',
            'customer_phone' => null,
            'order_number' => null,
            'purchase_date' => '2026-01-01',
            'complaint_type_id' => $this->complaintType->id,
            'description' => 'Test complaint',
            'tracking_number' => 'TRK-'.uniqid(),
            'status_id' => $this->status->id,
        ], $overrides));
    }

    /** @param  array<string, mixed>  $overrides */
    private function validPayload(array $overrides = []): array
    {
        return array_merge([
            'customer_name' => 'Jane Doe',
            'purchase_date' => '2026-01-01',
            'complaint_type_id' => $this->complaintType->id,
            'description' => 'Item arrived damaged',
            'tracking_number' => 'TRK-NEW-'.uniqid(),
            'affected_products' => [
                ['product_id' => $this->product->id, 'quantity_affected' => 1],
            ],
        ], $overrides);
    }
}
