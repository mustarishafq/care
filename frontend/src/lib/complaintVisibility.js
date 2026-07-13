import { getUserDepartmentIds } from '@/lib/useDepartments';
import { isUserAssignedToComplaint } from '@/lib/assignedAgents';

export const COMPLAINT_VISIBILITY_ALL = 'all';
export const COMPLAINT_VISIBILITY_DEPARTMENT = 'department';
export const COMPLAINT_VISIBILITY_ASSIGNED = 'assigned';

export const COMPLAINT_VISIBILITY_OPTIONS = [
  {
    key: COMPLAINT_VISIBILITY_ALL,
    label: 'All complaints',
    description: 'Can view every complaint in the system.',
  },
  {
    key: COMPLAINT_VISIBILITY_DEPARTMENT,
    label: 'Department only',
    description: 'Can view complaints in their department(s), plus any ticket assigned to them.',
  },
  {
    key: COMPLAINT_VISIBILITY_ASSIGNED,
    label: 'Assigned only',
    description: 'Can view only complaints assigned to them as an agent.',
  },
];

function sameId(a, b) {
  if (a == null || b == null) return false;
  return String(a) === String(b);
}

export function getComplaintVisibility(user) {
  if (!user) return COMPLAINT_VISIBILITY_ALL;
  const value = user.complaint_visibility;
  if (
    value === COMPLAINT_VISIBILITY_ALL
    || value === COMPLAINT_VISIBILITY_DEPARTMENT
    || value === COMPLAINT_VISIBILITY_ASSIGNED
  ) {
    return value;
  }
  return user.is_admin ? COMPLAINT_VISIBILITY_ALL : COMPLAINT_VISIBILITY_DEPARTMENT;
}

/**
 * Whether the user may view a complaint/ticket.
 * Scope comes from the role's complaint_visibility setting.
 * Assigned agents always retain access under department/assigned scopes.
 */
export function canViewComplaint(user, complaint) {
  if (!complaint) return false;

  const visibility = getComplaintVisibility(user);

  if (visibility === COMPLAINT_VISIBILITY_ALL) return true;

  // Assigned agents always see their tickets.
  if (isUserAssignedToComplaint(complaint, user?.id)) return true;

  if (visibility === COMPLAINT_VISIBILITY_ASSIGNED) return false;

  const userDeptIds = getUserDepartmentIds(user);
  if (complaint.assigned_department_id && userDeptIds.some((id) => sameId(id, complaint.assigned_department_id))) {
    return true;
  }

  return false;
}

export function filterVisibleComplaints(user, complaints) {
  if (getComplaintVisibility(user) === COMPLAINT_VISIBILITY_ALL) return complaints;
  return complaints.filter((c) => canViewComplaint(user, c));
}

export function filterVisibleActivities(user, activities, complaints) {
  if (getComplaintVisibility(user) === COMPLAINT_VISIBILITY_ALL) return activities;

  const visibleIds = new Set(
    filterVisibleComplaints(user, complaints).map((c) => String(c.id)),
  );

  return activities.filter(
    (a) => a.complaint_id && visibleIds.has(String(a.complaint_id)),
  );
}
