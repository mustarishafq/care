/** Built-in role slugs stored on users.role — permissions defined in usePermissions.js */
export const BUILTIN_ROLES = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'customer_service', label: 'Customer Service' },
  { value: 'fulfillment', label: 'Fulfillment' },
  { value: 'logistics', label: 'Logistics' },
  { value: 'management', label: 'Management' },
  { value: 'viewer', label: 'Viewer' },
];

export const BUILTIN_ROLE_LABELS = Object.fromEntries(
  BUILTIN_ROLES.map(({ value, label }) => [value, label]),
);

export function activeCustomRoles(customRoles = []) {
  return customRoles.filter((r) => r.is_active !== false);
}

export function getRoleLabel(roleValue, customRoles = [], roleLabel) {
  if (roleLabel) {
    return roleLabel;
  }
  if (BUILTIN_ROLE_LABELS[roleValue]) {
    return BUILTIN_ROLE_LABELS[roleValue];
  }
  const active = activeCustomRoles(customRoles);
  return active.find((r) => String(r.id) === String(roleValue))?.name
    || active.find((r) => r.name === roleValue)?.name
    || roleValue
    || 'Viewer';
}
