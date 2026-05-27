import { db } from '@/api/db';

import { useState, useEffect } from 'react';

let cachedUser = null;
let cachedPromise = null;

function getUser() {
  if (cachedUser) return Promise.resolve(cachedUser);
  if (!cachedPromise) {
    cachedPromise = db.auth.me().then(u => { cachedUser = u; return u; });
  }
  return cachedPromise;
}

export function useCurrentUser() {
  const [user, setUser] = useState(cachedUser);
  const [loading, setLoading] = useState(!cachedUser);

  useEffect(() => {
    if (cachedUser) return;
    getUser().then(u => {
      setUser(u);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const hasRole = (roleIds) => {
    if (!user?.role_id) return false;
    if (typeof roleIds === 'string') return String(user.role_id) === String(roleIds);
    return roleIds.some((id) => String(user.role_id) === String(id));
  };

  const isAdmin = !!user?.is_admin;

  return { user, loading, hasRole, isAdmin };
}
