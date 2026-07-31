<?php

namespace Tests\Feature;

use App\Models\Complaint;
use App\Models\ComplaintStatus;
use App\Models\ComplaintType;
use App\Models\Department;
use App\Models\Product;
use App\Models\Role;
use App\Models\Team;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TeamLeadTest extends TestCase
{
    use RefreshDatabase;

    protected function migrateFreshUsing(): array
    {
        return ['--path' => 'database/migrations/testing'];
    }

    private function makeRole(string $slug, array $attrs = []): Role
    {
        return Role::create(array_merge([
            'slug' => $slug,
            'name' => ucfirst($slug),
            'permissions' => ['complaints.view'],
            'is_active' => true,
            'is_admin' => false,
            'complaint_visibility' => 'assigned',
        ], $attrs));
    }

    private function makeUser(Role $role, array $attrs = []): User
    {
        return User::factory()->create(array_merge([
            'role_id' => $role->id,
            'approval_status' => User::APPROVAL_APPROVED,
            'status' => User::STATUS_ACTIVE,
        ], $attrs));
    }

    private function createComplaint(array $overrides = []): Complaint
    {
        $type = ComplaintType::first() ?? ComplaintType::create(['name' => 'Damaged']);
        $status = ComplaintStatus::first() ?? ComplaintStatus::create(['name' => 'Open']);
        $product = Product::first() ?? Product::create(['name' => 'Widget', 'sku' => 'W-1']);

        $complaint = Complaint::create(array_merge([
            'ticket_id' => 'TKT-'.uniqid(),
            'customer_name' => 'Customer',
            'description' => 'Issue',
            'complaint_type_id' => $type->id,
            'status_id' => $status->id,
            'tracking_number' => 'TRK-1',
        ], $overrides));

        $complaint->affectedProducts()->create([
            'product_id' => $product->id,
            'quantity_affected' => 1,
            'sort_order' => 0,
        ]);

        return $complaint->fresh();
    }

    public function test_team_lead_can_update_own_team_but_not_create(): void
    {
        $role = $this->makeRole('agent');
        $adminRole = $this->makeRole('admin', [
            'permissions' => ['settings.manage', 'teams.manage'],
            'is_admin' => true,
            'complaint_visibility' => 'all',
        ]);

        $admin = $this->makeUser($adminRole);
        $lead = $this->makeUser($role);
        $member = $this->makeUser($role);
        $outsider = $this->makeUser($role);

        $department = Department::create(['name' => 'Fulfillment']);
        $team = Team::create([
            'name' => 'Returns',
            'department_id' => $department->id,
            'lead_user_id' => $lead->id,
        ]);
        $team->syncMembers([$lead->id, $member->id]);

        Sanctum::actingAs($lead);
        $this->patchJson("/api/v1/teams/{$team->id}", [
            'name' => 'Returns Squad',
            'member_ids' => [$lead->id, $member->id],
            'lead_user_id' => $lead->id,
        ])->assertOk()
            ->assertJsonPath('data.name', 'Returns Squad');

        $this->postJson('/api/v1/teams', [
            'name' => 'New Team',
            'department_id' => $department->id,
            'lead_user_id' => $lead->id,
            'member_ids' => [$lead->id],
        ])->assertForbidden();

        Sanctum::actingAs($outsider);
        $this->patchJson("/api/v1/teams/{$team->id}", [
            'name' => 'Hacked',
        ])->assertForbidden();

        Sanctum::actingAs($admin);
        $this->postJson('/api/v1/teams', [
            'name' => 'New Team',
            'department_id' => $department->id,
            'lead_user_id' => $lead->id,
            'member_ids' => [$lead->id],
        ])->assertOk();
    }

    public function test_syncing_team_members_attaches_parent_department(): void
    {
        $role = $this->makeRole('admin', [
            'permissions' => ['teams.manage', 'settings.manage'],
            'is_admin' => true,
            'complaint_visibility' => 'all',
        ]);
        $admin = $this->makeUser($role);
        $member = $this->makeUser($this->makeRole('agent-2'));

        $department = Department::create(['name' => 'Logistics']);

        Sanctum::actingAs($admin);
        $response = $this->postJson('/api/v1/teams', [
            'name' => 'Dispatch',
            'department_id' => $department->id,
            'lead_user_id' => $admin->id,
            'member_ids' => [$member->id],
        ])->assertOk();

        $this->assertDatabaseHas('department_user', [
            'department_id' => $department->id,
            'user_id' => $member->id,
        ]);
        $this->assertDatabaseHas('department_user', [
            'department_id' => $department->id,
            'user_id' => $admin->id,
        ]);
        $this->assertNotEmpty($response->json('data.member_ids'));
    }

    public function test_team_lead_sees_tickets_assigned_to_or_created_by_members(): void
    {
        $leadRole = $this->makeRole('lead', [
            'permissions' => ['complaints.view'],
            'complaint_visibility' => 'assigned',
        ]);
        $memberRole = $this->makeRole('member', [
            'permissions' => ['complaints.view'],
            'complaint_visibility' => 'assigned',
        ]);

        $lead = $this->makeUser($leadRole);
        $member = $this->makeUser($memberRole);
        $other = $this->makeUser($memberRole);

        $department = Department::create(['name' => 'CS']);
        $team = Team::create([
            'name' => 'Frontline',
            'department_id' => $department->id,
            'lead_user_id' => $lead->id,
        ]);
        $team->syncMembers([$lead->id, $member->id]);

        $assignedToMember = $this->createComplaint(['created_by_user_id' => $other->id]);
        $assignedToMember->assignedUsers()->sync([$member->id]);
        $assignedToMember->forceFill(['assigned_user_id' => $member->id])->saveQuietly();

        $createdByMember = $this->createComplaint([
            'created_by_user_id' => $member->id,
        ]);
        $createdByMember->assignedUsers()->sync([$other->id]);
        $createdByMember->forceFill(['assigned_user_id' => $other->id])->saveQuietly();

        $unrelated = $this->createComplaint([
            'created_by_user_id' => $other->id,
        ]);
        $unrelated->assignedUsers()->sync([$other->id]);
        $unrelated->forceFill(['assigned_user_id' => $other->id])->saveQuietly();

        Sanctum::actingAs($lead);

        $ids = collect($this->getJson('/api/v1/complaints')->assertOk()->json('data'))
            ->pluck('id')
            ->map(fn ($id) => (string) $id)
            ->all();

        $this->assertContains((string) $assignedToMember->id, $ids);
        $this->assertContains((string) $createdByMember->id, $ids);
        $this->assertNotContains((string) $unrelated->id, $ids);

        $this->getJson("/api/v1/complaints/{$assignedToMember->id}")->assertOk();
        $this->getJson("/api/v1/complaints/{$createdByMember->id}")->assertOk();
        $this->getJson("/api/v1/complaints/{$unrelated->id}")->assertForbidden();
    }

    public function test_team_lead_can_manage_lookup_statuses(): void
    {
        $role = $this->makeRole('lead', [
            'permissions' => ['complaints.view'],
            'complaint_visibility' => 'assigned',
        ]);
        $lead = $this->makeUser($role);
        $department = Department::create(['name' => 'Ops']);
        $team = Team::create([
            'name' => 'Ops Team',
            'department_id' => $department->id,
            'lead_user_id' => $lead->id,
        ]);
        $team->syncMembers([$lead->id]);

        $status = ComplaintStatus::create(['name' => 'Open', 'sort_order' => 0]);

        Sanctum::actingAs($lead);
        $this->patchJson("/api/v1/complaint-statuses/{$status->id}", [
            'name' => 'In Progress',
        ])->assertOk()
            ->assertJsonPath('data.name', 'In Progress');

        $nonLead = $this->makeUser($this->makeRole('viewer-x'));
        Sanctum::actingAs($nonLead);
        $this->patchJson("/api/v1/complaint-statuses/{$status->id}", [
            'name' => 'Blocked',
        ])->assertForbidden();
    }
}
