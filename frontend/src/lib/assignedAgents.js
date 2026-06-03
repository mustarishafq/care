/**
 * Returns assigned agents for a complaint, falling back to legacy single-assignee fields.
 */
export function getAssignedAgents(complaint) {
  if (!complaint) return [];

  if (complaint.assigned_agents?.length) {
    return complaint.assigned_agents;
  }

  if (complaint.assigned_user_id) {
    return [{
      id: String(complaint.assigned_user_id),
      email: complaint.assigned_user,
      full_name: complaint.assigned_user_name || complaint.assigned_user,
    }];
  }

  return [];
}

export function getAssignedAgentIds(complaint) {
  return getAssignedAgents(complaint).map((a) => String(a.id));
}

export function isUserAssignedToComplaint(complaint, userId) {
  if (!userId) return false;
  return getAssignedAgentIds(complaint).includes(String(userId));
}

export function hasAssignedAgents(complaint) {
  return getAssignedAgents(complaint).length > 0;
}

export function formatAgentNames(complaint) {
  const agents = getAssignedAgents(complaint);
  if (!agents.length) return null;
  return agents.map((a) => a.full_name || a.email).join(', ');
}
