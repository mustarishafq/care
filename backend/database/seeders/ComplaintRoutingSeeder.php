<?php

namespace Database\Seeders;

use App\Models\ComplaintStatus;
use App\Models\ComplaintType;
use App\Models\Department;
use App\Models\SystemConfig;
use Illuminate\Database\Seeder;

class ComplaintRoutingSeeder extends Seeder
{
    /** @var array<string, array{department: string, status: string}> */
    private const RULES = [
        'Damaged Product' => ['department' => 'Logistics', 'status' => 'Under Review'],
        'Broken Item' => ['department' => 'Fulfillment', 'status' => 'Under Review'],
        'Missing Item' => ['department' => 'Fulfillment', 'status' => 'Under Review'],
        'Wrong Item' => ['department' => 'Fulfillment', 'status' => 'Under Review'],
        'Leakage' => ['department' => 'Logistics', 'status' => 'Under Review'],
        'Packaging Damage' => ['department' => 'Logistics', 'status' => 'Under Review'],
        'Parcel Not Arrived' => ['department' => 'Logistics', 'status' => 'Under Review'],
        'Other' => ['department' => 'Customer Service', 'status' => 'New Complaint'],
    ];

    public function run(): void
    {
        $rules = [];

        foreach (self::RULES as $complaintTypeName => $routing) {
            $complaintTypeId = ComplaintType::where('name', $complaintTypeName)->value('id');
            $departmentId = Department::where('name', $routing['department'])->value('id');
            $statusId = ComplaintStatus::where('name', $routing['status'])->value('id');

            if (! $complaintTypeId) {
                $this->command?->warn("Skipping routing for \"{$complaintTypeName}\": complaint type not found.");

                continue;
            }

            $rules[] = [
                'complaint_type_id' => (int) $complaintTypeId,
                'department_id' => $departmentId ? (int) $departmentId : null,
                'status_id' => $statusId ? (int) $statusId : null,
            ];
        }

        SystemConfig::updateOrCreate(
            ['key' => 'complaint_routing'],
            [
                'label' => 'Complaint Routing',
                'json_value' => [
                    'enabled' => true,
                    'default_department_id' => Department::where('name', 'Customer Service')->value('id'),
                    'default_status_id' => ComplaintStatus::where('name', 'New Complaint')->value('id'),
                    'rules' => $rules,
                ],
            ],
        );

        $this->command?->info('Complaint routing settings seeded.');
    }
}
