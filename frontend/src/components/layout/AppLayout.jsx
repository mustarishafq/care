import { db } from '@/api/db';

import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';

import TopBar from './TopBar';
import BottomNav from './BottomNav';
import ForcePasswordChange from '@/components/auth/ForcePasswordChange';
import { usePermissions } from '@/lib/usePermissions';
import { useNotifications } from '@/lib/useNotifications';

export default function AppLayout() {
  const [currentUser, setCurrentUser] = useState(null);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const { permissions, isAdmin } = usePermissions();

  useEffect(() => {
    db.auth.me().then((u) => {
      setCurrentUser(u);
      if (u?.must_change_password) setShowPasswordChange(true);
    }).catch(() => {});
  }, []);

  const { unreadCount } = useNotifications();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {showPasswordChange && currentUser && (
        <ForcePasswordChange user={currentUser} onDone={() => setShowPasswordChange(false)} />
      )}

      <TopBar
        permissions={permissions}
        isAdmin={isAdmin}
        unreadCount={unreadCount}
      />

      <main className="flex-1 pb-[calc(4.75rem+env(safe-area-inset-bottom))]">
        <div className="max-w-[1600px] mx-auto w-full p-4 sm:p-6">
          <Outlet />
        </div>
      </main>

      <BottomNav
        unreadCount={unreadCount}
        permissions={permissions}
        isAdmin={isAdmin}
      />
    </div>
  );
}
