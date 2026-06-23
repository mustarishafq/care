import {
  AlertCircle, Bell, Building2, CircleDot, FileText, Ruler, Truck,
} from 'lucide-react';

export { SLA_DEFAULT } from '@/lib/slaSettings';
export { AUTO_CLOSE_DEFAULT, formatAutoCloseDelay } from '@/lib/autoCloseSettings';

export const ROUTING_DEFAULT = { enabled: false, default_department_id: '', default_status_id: '', rules: [] };

export const LOOKUP_SECTIONS = [
  { key: 'departments', label: 'Departments', description: 'Teams that tickets can be assigned to', icon: Building2, entity: 'Department', queryKey: 'departments' },
  { key: 'complaint_types', label: 'Complaint Types', description: 'Categories customers report issues under', icon: FileText, entity: 'ComplaintType', queryKey: 'complaint_types' },
  { key: 'complaint_statuses', label: 'Complaint Statuses', description: 'Workflow stages a ticket moves through', icon: CircleDot, entity: 'ComplaintStatus', queryKey: 'complaint_statuses' },
  { key: 'couriers', label: 'Couriers', description: 'Shipping carriers used on tickets', icon: Truck, entity: 'Courier', queryKey: 'couriers' },
  { key: 'units_of_measurement', label: 'Units of Measurement', description: 'Quantity units for affected products', icon: Ruler, entity: 'UnitOfMeasurement', queryKey: 'units_of_measurement' },
  { key: 'priorities', label: 'Priority Levels', description: 'Urgency levels that drive SLA targets', icon: AlertCircle, entity: 'Priority', queryKey: 'priorities' },
];

export const NOTIFICATION_TRIGGERS = [
  { event: 'Ticket Assigned', when: 'A complaint is assigned to a user', type: 'ticket_assigned' },
  { event: 'Status Changed', when: 'Complaint status is updated', type: 'status_changed' },
  { event: 'SLA Warning', when: '80% of SLA deadline reached', type: 'sla_warning' },
  { event: 'Overdue', when: 'SLA deadline has passed', type: 'overdue' },
  { event: 'Internal Note', when: 'A new internal note is added', type: 'mention' },
];
