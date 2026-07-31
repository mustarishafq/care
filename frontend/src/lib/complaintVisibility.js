/**
 * Complaint visibility helpers — mirrors backend ScopesComplaintVisibility.
 */
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

function getLedTeamMemberIds(user) {
  if (!user) return [];

  // Prefer explicit member ids when the API provides them later.
  if (Array.isArray(user.led_team_member_ids) && user.led_team_member_ids.length) {
    return user.led_team_member_ids.map(String);
  }

  // Derive from led teams + teams membership when loaded on the user.
  const ledIds = new Set((user.led_team_ids || []).map(String));
  if (!ledIds.size) return [];

  const memberIds = new Set();
  const teams = Array.isArray(user.teams) ? user.teams : [];
  for (const team of teams) {
    if (!ledIds.has(String(team.id))) continue;
    for (const id of (team.member_ids || [])) memberIds.add(String(id));
    for (const m of (team.members || [])) {
      if (m?.id != null) memberIds.add(String(m.id));
    }
  }

  // Always include the lead themselves.
  if (user.id != null) memberIds.add(String(user.id));

  return [...memberIds];
}

function isTeamLeadTicket(user, complaint) {
  const memberIds = getLedTeamMemberIds(user);
  if (!memberIds.length) return false;

  if (complaint.created_by_user_id && memberIds.includes(String(complaint.created_by_user_id))) {
    return true;
  }

  const agents = complaint.assigned_agents || [];
  if (agents.some((a) => a?.id != null && memberIds.includes(String(a.id)))) {
    return true;
  }

  if (complaint.assigned_user_id && memberIds.includes(String(complaint.assigned_user_id))) {
    return true;
  }

  return false;
}

/**
 * Whether the user may view a complaint/ticket.
 * Scope comes from the role's complaint_visibility setting.
 * Assigned agents always retain access under department/assigned scopes.
 * Team leads also see tickets assigned to or created by their team members.
 */
export function canViewComplaint(user, complaint) {
  if (!complaint) return false;

  const visibility = getComplaintVisibility(user);

  if (visibility === COMPLAINT_VISIBILITY_ALL) return true;

  // Assigned agents always see their tickets.
  if (isUserAssignedToComplaint(complaint, user?.id)) return true;

  if (visibility === COMPLAINT_VISIBILITY_DEPARTMENT) {
    const userDeptIds = getUserDepartmentIds(user);
    if (complaint.assigned_department_id && userDeptIds.some((id) => sameId(id, complaint.assigned_department_id))) {
      return true;
    }
  }

  if (isTeamLeadTicket(user, complaint)) return true;

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
