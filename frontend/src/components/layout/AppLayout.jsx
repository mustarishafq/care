import { db } from '@/api/db';

import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';

import TopBar from './TopBar';
import BottomNav from './BottomNav';
import ForcePasswordChange from '@/components/auth/ForcePasswordChange';
import { usePermissions } from '@/lib/usePermissions';
import { useNotifications } from '@/lib/useNotifications';
import { pageTransitionMotion } from '@/lib/motion';
import { isRunningStandalone } from '@/lib/pwa';
import { cn } from '@/lib/utils';

export default function AppLayout() {
  const [currentUser, setCurrentUser] = useState(null);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const { permissions, isAdmin } = usePermissions();
  const standalone = isRunningStandalone();

  useEffect(() => {
    db.auth.me().then((u) => {
      setCurrentUser(u);
      if (u?.must_change_password) setShowPasswordChange(true);
    }).catch(() => {});
  }, []);

  const { unreadCount } = useNotifications();
  const location = useLocation();

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

      <main
        className={cn(
          'flex-1',
          // Safe-area clearance only in standalone — browser chrome already insets (§2.1)
          standalone
            ? 'pb-[calc(5.25rem+env(safe-area-inset-bottom))]'
            : 'pb-[5.25rem]',
        )}
      >
        <div className="max-w-[1600px] mx-auto w-full p-4 sm:p-6">
          <motion.div key={location.pathname} {...pageTransitionMotion}>
            <Outlet />
          </motion.div>
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
