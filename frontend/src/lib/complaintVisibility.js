import { getUserDepartmentIds } from '@/lib/useDepartments';

function sameId(a, b) {
  if (a == null || b == null) return false;
  return String(a) === String(b);
}

/**
 * Whether the user may view a complaint/ticket.
 * Admins see all. Agents see tickets in their departments or assigned to them (any status).
 */
export function canViewComplaint(user, complaint) {
  if (!complaint) return false;
  if (!user || user.is_admin) return true;

  if (sameId(complaint.assigned_user_id, user.id)) return true;

  const userDeptIds = getUserDepartmentIds(user);
  if (complaint.assigned_department_id && userDeptIds.some((id) => sameId(id, complaint.assigned_department_id))) {
    return true;
  }

  return false;
}

export function filterVisibleComplaints(user, complaints) {
  if (!user || user.is_admin) return complaints;
  return complaints.filter((c) => canViewComplaint(user, c));
}

export function filterVisibleActivities(user, activities, complaints) {
  if (!user || user.is_admin) return activities;

  const visibleIds = new Set(
    filterVisibleComplaints(user, complaints).map((c) => String(c.id)),
  );

  return activities.filter(
    (a) => a.complaint_id && visibleIds.has(String(a.complaint_id)),
  );
}
