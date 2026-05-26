import { db } from '@/api/db';

import { useState, useEffect } from 'react';

export function usePermissions() {
  const [permissions, setPermissions] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const user = await db.auth.me();
        setPermissions(user?.permissions ?? []);
        setIsAdmin(!!user?.is_admin);
      } catch {
        setPermissions([]);
        setIsAdmin(false);
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

  return { permissions, isAdmin, hasPermission, canView, loading: loading || permissions === null };
}
