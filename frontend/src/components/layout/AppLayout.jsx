import { db } from '@/api/db';

import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';

import Sidebar from './Sidebar';
import TopBar from './TopBar';
import ForcePasswordChange from '@/components/auth/ForcePasswordChange';
import { usePermissions } from '@/lib/usePermissions';
import { useNotifications } from '@/lib/useNotifications';

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile sidebar visible
  const [currentUser, setCurrentUser] = useState(null);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const { permissions, isAdmin } = usePermissions();

  useEffect(() => {
    db.auth.me().then(u => {
      setCurrentUser(u);
      if (u?.must_change_password) setShowPasswordChange(true);
    }).catch(() => {});
  }, []);

  // Close mobile sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [window.location.pathname]);

  const { unreadCount } = useNotifications();

  return (
    <div className="min-h-screen bg-background">
      {showPasswordChange && currentUser && (
        <ForcePasswordChange user={currentUser} onDone={() => setShowPasswordChange(false)} />
      )}

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        unreadCount={unreadCount}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        permissions={permissions}
        isAdmin={isAdmin}
      />

      {/* Main content — on desktop shift by sidebar width, on mobile full width */}
      <div className={`transition-all duration-300 ${collapsed ? 'lg:ml-[68px]' : 'lg:ml-[260px]'}`}>
        <TopBar onMenuClick={() => setSidebarOpen(true)} />
        <main className="p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}