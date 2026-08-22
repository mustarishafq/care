<?php

namespace Tests\Feature;

use App\Models\Complaint;
use App\Models\ComplaintStatus;
use App\Models\ComplaintType;
use App\Models\Department;
use App\Models\Notification;
use App\Models\Product;
use App\Models\Role;
use App\Models\Team;
use App\Models\User;
use App\Services\ComplaintNotificationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ComplaintDepartmentNotificationTest extends TestCase
{
    use RefreshDatabase;

    private Department $department;

    private Department $otherDepartment;

    /** @var list<User> */
    private array $departmentMembers;

    private User $actor;

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

        $this->departmentMembers = [
            User::factory()->create([
                'role_id' => $role->id,
                'approval_status' => User::APPROVAL_APPROVED,
                'status' => User::STATUS_ACTIVE,
            ]),
            User::factory()->create([
                'role_id' => $role->id,
                'approval_status' => User::APPROVAL_APPROVED,
                'status' => User::STATUS_ACTIVE,
            ]),
            User::factory()->create([
                'role_id' => $role->id,
                'approval_status' => User::APPROVAL_APPROVED,
                'status' => User::STATUS_ACTIVE,
            ]),
        ];

        $this->department = Department::create(['name' => 'Fulfillment']);
        $this->otherDepartment = Department::create(['name' => 'Logistics']);

        $this->department->users()->sync(collect($this->departmentMembers)->pluck('id'));
        $this->otherDepartment->users()->sync([$this->departmentMembers[0]->id]);
    }

    public function test_notify_department_assigned_notifies_all_department_members_except_actor(): void
    {
        $complaint = $this->createComplaint(['assigned_department_id' => $this->department->id]);

        $count = app(ComplaintNotificationService::class)->notifyDepartmentAssigned($complaint, $this->actor);

        $this->assertSame(3, $count);
        $this->assertSame(
            3,
            Notification::query()->where('type', 'department_assigned')->where('complaint_id', $complaint->id)->count(),
        );

        foreach ($this->departmentMembers as $member) {
            $this->assertDatabaseHas('notifications', [
                'recipient_user_id' => $member->id,
                'complaint_id' => $complaint->id,
                'type' => 'department_assigned',
            ]);
        }

        $this->assertDatabaseMissing('notifications', [
            'recipient_user_id' => $this->actor->id,
            'complaint_id' => $complaint->id,
            'type' => 'department_assigned',
        ]);
    }

    public function test_creating_complaint_notifies_department_members(): void
    {
        Sanctum::actingAs($this->actor);

        $complaintType = ComplaintType::create(['name' => 'Damaged Item']);
        $product = Product::create(['name' => 'Test Product']);

        $response = $this->postJson('/api/v1/complaints', [
            'customer_name' => 'Jane Doe',
            'purchase_date' => '2026-01-01',
            'complaint_type_id' => $complaintType->id,
            'description' => 'Item arrived damaged',
            'tracking_number' => 'TRK123456',
            'assigned_department_id' => $this->department->id,
            'affected_products' => [
                ['product_id' => $product->id, 'quantity_affected' => 1],
            ],
        ]);

        $response->assertCreated();

        $complaintId = (int) $response->json('data.id');

        $this->assertSame(
            3,
            Notification::query()->where('type', 'department_assigned')->where('complaint_id', $complaintId)->count(),
        );
    }

    public function test_updating_department_notifies_new_department_members(): void
    {
        Sanctum::actingAs($this->actor);

        $complaint = $this->createComplaint();

        $this->patchJson("/api/v1/complaints/{$complaint->id}", [
            'assigned_department_id' => $this->department->id,
        ])->assertOk();

        $this->assertSame(
            3,
            Notification::query()
                ->where('type', 'department_assigned')
                ->where('complaint_id', $complaint->id)
                ->count(),
        );
    }

    public function test_reassigning_same_department_does_not_send_duplicate_notifications(): void
    {
        Sanctum::actingAs($this->actor);

        $complaint = $this->createComplaint(['assigned_department_id' => $this->department->id]);

        app(ComplaintNotificationService::class)->notifyDepartmentAssigned($complaint, $this->actor);

        $this->patchJson("/api/v1/complaints/{$complaint->id}", [
            'assigned_department_id' => $this->department->id,
        ])->assertOk();

        $this->assertSame(
            3,
            Notification::query()
                ->where('type', 'department_assigned')
                ->where('complaint_id', $complaint->id)
                ->count(),
        );
    }

    public function test_changing_to_different_department_notifies_new_department(): void
    {
        Sanctum::actingAs($this->actor);

        $complaint = $this->createComplaint(['assigned_department_id' => $this->department->id]);

        app(ComplaintNotificationService::class)->notifyDepartmentAssigned($complaint, $this->actor);

        Notification::query()->where('complaint_id', $complaint->id)->delete();

        $this->patchJson("/api/v1/complaints/{$complaint->id}", [
            'assigned_department_id' => $this->otherDepartment->id,
        ])->assertOk();

        $this->assertSame(
            1,
            Notification::query()
                ->where('type', 'department_assigned')
                ->where('complaint_id', $complaint->id)
                ->count(),
        );

        $this->assertDatabaseHas('notifications', [
            'recipient_user_id' => $this->departmentMembers[0]->id,
            'complaint_id' => $complaint->id,
            'type' => 'department_assigned',
        ]);
    }

    public function test_notifies_team_members_and_leads_even_if_missing_from_department_pivot(): void
    {
        $role = Role::query()->first();

        $teamMember = User::factory()->create([
            'role_id' => $role->id,
            'approval_status' => User::APPROVAL_APPROVED,
            'status' => User::STATUS_ACTIVE,
        ]);
        $teamLead = User::factory()->create([
            'role_id' => $role->id,
            'approval_status' => User::APPROVAL_APPROVED,
            'status' => User::STATUS_ACTIVE,
        ]);

        $team = Team::create([
            'name' => 'Warehouse',
            'department_id' => $this->department->id,
            'lead_user_id' => $teamLead->id,
            'is_active' => true,
        ]);
        $team->users()->sync([$teamMember->id]);

        $complaint = $this->createComplaint(['assigned_department_id' => $this->department->id]);

        $count = app(ComplaintNotificationService::class)->notifyDepartmentAssigned($complaint, $this->actor);

        $this->assertSame(5, $count);

        foreach ([$teamMember, $teamLead, ...$this->departmentMembers] as $user) {
            $this->assertDatabaseHas('notifications', [
                'recipient_user_id' => $user->id,
                'complaint_id' => $complaint->id,
                'type' => 'department_assigned',
            ]);
        }
    }

    public function test_skips_inactive_and_pending_department_members(): void
    {
        $role = Role::query()->first();

        $inactive = User::factory()->create([
            'role_id' => $role->id,
            'approval_status' => User::APPROVAL_APPROVED,
            'status' => User::STATUS_INACTIVE,
        ]);
        $pending = User::factory()->create([
            'role_id' => $role->id,
            'approval_status' => User::APPROVAL_PENDING,
            'status' => User::STATUS_ACTIVE,
        ]);

        $this->department->users()->syncWithoutDetaching([$inactive->id, $pending->id]);

        $complaint = $this->createComplaint(['assigned_department_id' => $this->department->id]);

        $count = app(ComplaintNotificationService::class)->notifyDepartmentAssigned($complaint, $this->actor);

        $this->assertSame(3, $count);
        $this->assertDatabaseMissing('notifications', [
            'recipient_user_id' => $inactive->id,
            'complaint_id' => $complaint->id,
            'type' => 'department_assigned',
        ]);
        $this->assertDatabaseMissing('notifications', [
            'recipient_user_id' => $pending->id,
            'complaint_id' => $complaint->id,
            'type' => 'department_assigned',
        ]);
    }

    /** @param  array<string, mixed>  $overrides */
    private function createComplaint(array $overrides = []): Complaint
    {
        $complaintType = ComplaintType::first() ?? ComplaintType::create(['name' => 'Damaged Item']);
        $status = ComplaintStatus::first() ?? ComplaintStatus::create(['name' => 'New Complaint']);

        return Complaint::create(array_merge([
            'ticket_id' => 'TKT-TEST001',
            'customer_name' => 'John Doe',
            'order_number' => 'ORD-1',
            'purchase_date' => '2026-01-01',
            'complaint_type_id' => $complaintType->id,
            'description' => 'Test complaint',
            'tracking_number' => 'TRK000001',
            'status_id' => $status->id,
        ], $overrides))->fresh();
    }
}
