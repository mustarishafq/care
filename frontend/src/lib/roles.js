export function activeRoles(roles = []) {
  return roles.filter((r) => r.is_active !== false);
}

export function getRoleLabel(roleId, roles = [], roleLabel) {
  if (roleLabel) {
    return roleLabel;
  }

  const active = activeRoles(roles);
  return active.find((r) => String(r.id) === String(roleId))?.name || 'Viewer';
}
