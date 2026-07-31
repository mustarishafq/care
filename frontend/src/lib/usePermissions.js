import { db } from '@/api/db';

import { useState, useEffect } from 'react';

export function usePermissions() {
  const [permissions, setPermissions] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isTeamLead, setIsTeamLead] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const user = await db.auth.me();
        const perms = Array.isArray(user?.permissions) ? [...user.permissions] : [];
        // Team leads need Settings nav access for lookup management.
        if (user?.is_team_lead && !perms.includes('settings.view') && !user?.is_admin) {
          perms.push('settings.view');
        }
        setPermissions(perms);
        setIsAdmin(!!user?.is_admin);
        setIsTeamLead(!!user?.is_team_lead);
      } catch {
        setPermissions([]);
        setIsAdmin(false);
        setIsTeamLead(false);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const hasPermission = (key) => {
    if (isAdmin) return true;
    if (!permissions) return false;
    if (permissions.includes(key)) return true;
    // e.g. products.manage implies products.view
    if (key.endsWith('.view')) {
      const section = key.split('.')[0];
      return permissions.includes(`${section}.manage`);
    }
    return false;
  };

  const canView = (section) => hasPermission(`${section}.view`) || hasPermission(`${section}.manage`);

  return {
    permissions,
    isAdmin,
    isTeamLead,
    hasPermission,
    canView,
    loading: loading || permissions === null,
  };
}
