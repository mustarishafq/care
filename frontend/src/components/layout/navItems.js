import {
  LayoutDashboard, FileText, Columns3, BarChart3,
  Bell, Package, Users, ShieldCheck, Plug, Settings, Plus,
} from 'lucide-react';

/** All navigation items for EMZI Nexus Care */
export const careNavItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard', permission: null },
  { label: 'Complaints', icon: FileText, path: '/complaints', permission: 'complaints.view' },
  { label: 'Kanban', icon: Columns3, path: '/kanban', permission: 'complaints.view' },
  { label: 'Reports', icon: BarChart3, path: '/reports', permission: 'reports.view' },
  { label: 'Notifications', icon: Bell, path: '/notifications', permission: null, badge: true },
  { label: 'Products', icon: Package, path: '/products', permission: 'products.view' },
  { label: 'Users', icon: Users, path: '/users', permission: 'users.view', admin: true },
  { label: 'Roles', icon: ShieldCheck, path: '/roles', permission: 'users.manage', admin: true },
  { label: 'Integrations', icon: Plug, path: '/integrations', permission: 'oms.view' },
  { label: 'Settings', icon: Settings, path: '/settings', permission: 'settings.view' },
];

/** Bottom dock on mobile — max 6 items */
export const mobileBottomNavItems = [
  careNavItems[0], // Dashboard
  careNavItems[1], // Complaints
  careNavItems[2], // Kanban
  careNavItems[3], // Reports
  careNavItems[4], // Notifications
  careNavItems[9], // Settings
];

/** Bottom dock on desktop — all permitted items, horizontal scroll when overflow (§7.4) */
export const desktopBottomNavItems = careNavItems;

export function isNavActive(pathname, itemPath) {
  if (itemPath === '/dashboard') {
    return pathname === '/dashboard';
  }
  return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
}

export function filterNavItems(items, permissions, isAdmin) {
  if (permissions === null) return [];
  return items.filter((item) => {
    if (!item.permission) return true;
    if (permissions === '*' || isAdmin) return true;
    return permissions.includes(item.permission);
  });
}

/** Center-dock action — non-admin users with complaints.create only */
export const addComplaintNavAction = {
  label: 'Add Complaint',
  icon: Plus,
  action: 'create-complaint',
  permission: 'complaints.create',
};

export function canShowAddComplaint(permissions, isAdmin) {
  if (isAdmin || !permissions) return false;
  return permissions.includes('complaints.create');
}

export function insertCenterNavAction(items, actionItem) {
  const mid = Math.floor(items.length / 2);
  return [...items.slice(0, mid), actionItem, ...items.slice(mid)];
}

export function buildBottomNavItems(items, permissions, isAdmin, { includeAddComplaint = false } = {}) {
  const filtered = filterNavItems(items, permissions, isAdmin);
  if (includeAddComplaint && canShowAddComplaint(permissions, isAdmin)) {
    return insertCenterNavAction(filtered, addComplaintNavAction);
  }
  return filtered;
}
