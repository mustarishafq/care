import {
  LayoutDashboard, FileText, Columns3, BarChart3,
  Bell, Package, Users, ShieldCheck, Webhook, Settings, Plus, ShoppingBag, Star, Grip,
} from 'lucide-react';

/** All navigation items for EMZI Nexus Care */
export const careNavItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard', permission: null },
  { label: 'Complaints', icon: FileText, path: '/complaints', permission: 'complaints.view' },
  { label: 'Reviews', icon: Star, path: '/marketplace-reviews', permission: 'reviews.view' },
  { label: 'Kanban', icon: Columns3, path: '/kanban', permission: 'complaints.view' },
  { label: 'Reports', icon: BarChart3, path: '/reports', permission: 'reports.view' },
  { label: 'Notifications', icon: Bell, path: '/notifications', permission: null, badge: true },
  { label: 'Products', icon: Package, path: '/products', permission: 'products.view' },
  { label: 'Users', icon: Users, path: '/users', permission: 'users.view', admin: true },
  { label: 'Roles', icon: ShieldCheck, path: '/roles', permission: 'users.manage', admin: true },
  { label: 'Integrations', icon: Webhook, path: '/integrations', permission: 'oms.view' },
  { label: 'Marketplace', icon: ShoppingBag, path: '/marketplace', permission: 'marketplace.view' },
  { label: 'Settings', icon: Settings, path: '/settings', permission: 'settings.view' },
];

/** More tab — opens bottom sheet on mobile (§9) */
export const moreNavItem = {
  type: 'more',
  label: 'More',
  icon: Grip,
};

/** Center-dock orb action — non-admin users with complaints.create only */
export const addComplaintNavAction = {
  type: 'center-orb',
  label: 'Add',
  icon: Plus,
  action: 'create-complaint',
  permission: 'complaints.create',
};

const centerOrbFallbacks = [
  careNavItems[3], // Kanban
  careNavItems[4], // Reports
];

/** Bottom dock on desktop/tablet — workflow first, then integrations, Settings, admin last */
export const desktopBottomNavItems = [
  careNavItems[0],  // Dashboard
  careNavItems[1],  // Complaints
  careNavItems[2],  // Reviews
  careNavItems[3],  // Kanban
  careNavItems[4],  // Reports
  careNavItems[6],  // Products
  careNavItems[9],  // Integrations
  careNavItems[10], // Marketplace
  careNavItems[11], // Settings
  careNavItems[7],  // Users
  careNavItems[8],  // Roles
];

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

export function canShowAddComplaint(permissions, isAdmin) {
  if (isAdmin || !permissions) return false;
  return permissions.includes('complaints.create');
}

export function getMobileCenterOrbItem(permissions, isAdmin) {
  if (canShowAddComplaint(permissions, isAdmin)) {
    return addComplaintNavAction;
  }

  const [fallback] = filterNavItems(centerOrbFallbacks, permissions, isAdmin);
  if (!fallback) return null;

  return {
    type: 'center-orb',
    label: fallback.label,
    icon: fallback.icon,
    path: fallback.path,
  };
}

/** Mobile dock — 5 tabs: Home, Complaints, center orb, Reviews, More (§3, §9) */
export function buildMobileDockItems(permissions, isAdmin) {
  if (permissions === null) return [];

  const centerOrb = getMobileCenterOrbItem(permissions, isAdmin);
  const items = [
    { ...careNavItems[0], mobileLabel: 'Home' },
    careNavItems[1],
    ...(centerOrb ? [centerOrb] : []),
    careNavItems[2], // Reviews
    moreNavItem,
  ];

  return items.filter((item) => {
    if (item.type === 'more' || item.type === 'center-orb') return true;
    if (!item.permission) return true;
    if (permissions === '*' || isAdmin) return true;
    return permissions.includes(item.permission);
  });
}

/** Routes shown in the mobile More bottom sheet */
export function buildMobileMoreItems(permissions, isAdmin, centerOrb) {
  const dockPaths = new Set(['/dashboard', '/complaints', '/marketplace-reviews']);
  if (centerOrb?.path) dockPaths.add(centerOrb.path);

  const permitted = filterNavItems(careNavItems, permissions, isAdmin);
  const overflow = permitted.filter((item) => !dockPaths.has(item.path));

  return {
    main: overflow.filter((item) => !item.admin),
    admin: overflow.filter((item) => item.admin),
  };
}

export function isMoreMenuActive(pathname, permissions, isAdmin, centerOrb) {
  const { main, admin } = buildMobileMoreItems(permissions, isAdmin, centerOrb);
  return [...main, ...admin].some((item) => isNavActive(pathname, item.path));
}
