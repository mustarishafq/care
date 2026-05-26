import { db } from '@/api/db';

import { useState, useEffect } from 'react';

// Module-level cache so user is only fetched once per session
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

  const hasRole = (roles) => {
    if (!user) return false;
    if (typeof roles === 'string') return user.role === roles;
    return roles.includes(user.role);
  };

  const isAdmin = user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'management';
  const isCS = user?.role === 'customer_service';
  const isFulfillment = user?.role === 'fulfillment';
  const isLogistics = user?.role === 'logistics';
  const isManagement = user?.role === 'management';

  return { user, loading, hasRole, isAdmin, isCS, isFulfillment, isLogistics, isManagement };
}