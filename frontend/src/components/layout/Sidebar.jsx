import { db } from '@/api/db';

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, FileText, Columns3, BarChart3,
  Settings, Users, Bell, ChevronLeft, ChevronRight,
  Package, Plug, ShieldCheck, X } from
'lucide-react';
import { Badge } from '@/components/ui/badge';

const navItems = [
{ label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard', permission: null },
{ label: 'Complaints', icon: FileText, path: '/complaints', permission: 'complaints.view' },
{ label: 'Kanban Board', icon: Columns3, path: '/kanban', permission: 'complaints.view' },
{ label: 'Reports', icon: BarChart3, path: '/reports', permission: 'reports.view' },
{ label: 'Notifications', icon: Bell, path: '/notifications', permission: null },
{ label: 'Products', icon: Package, path: '/products', permission: 'products.view' },
{ label: 'Users', icon: Users, path: '/users', permission: 'users.view' },
{ label: 'Roles & Permissions', icon: ShieldCheck, path: '/roles', permission: 'users.manage' },
{ label: 'Integrations', icon: Plug, path: '/integrations', permission: 'oms.view' },
{ label: 'Settings', icon: Settings, path: '/settings', permission: 'settings.view' }];

export default function Sidebar({ collapsed, setCollapsed, unreadCount, sidebarOpen, setSidebarOpen, permissions, isAdmin }) {
  const location = useLocation();

  const isAllowed = (permission) => {
    if (!permission) return true; // no restriction
    if (permissions === null) return false; // still loading — hide restricted items
    if (permissions === '*' || isAdmin) return true;
    return permissions.includes(permission);
  };

  return (
    <aside className={`
      fixed top-0 left-0 h-full z-50 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col transition-all duration-300
      ${collapsed ? 'w-[68px]' : 'w-[260px]'}
      lg:translate-x-0
      ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
    `}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border shrink-0">
        <img
          src="/icons/logo.png"
          alt="EMZI Nexus Care"
          className="w-8 h-8 rounded-lg shrink-0 object-cover"
        />
        {!collapsed &&
        <span className="font-bold text-lg tracking-tight whitespace-nowrap flex-1">EMZI Nexus Care</span>
        }
        {/* Close button on mobile */}
        {!collapsed &&
        <button
          className="lg:hidden text-sidebar-muted hover:text-sidebar-foreground p-1 rounded"
          onClick={() => setSidebarOpen(false)}>
          
            <X className="w-4 h-4" />
          </button>
        }
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {permissions === null &&
        <div className="space-y-1 px-1">
            {[...Array(6)].map((_, i) =>
          <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-lg animate-pulse">
                <div className="w-5 h-5 rounded bg-sidebar-accent shrink-0" />
                {!collapsed && <div className="h-4 rounded bg-sidebar-accent flex-1" style={{ width: `${55 + i % 3 * 15}%` }} />}
              </div>
          )}
          </div>
        }
        {permissions !== null && navItems.filter((item) => isAllowed(item.permission)).map((item) => {
          const isActive = location.pathname === item.path ||
          item.path !== '/dashboard' && item.path !== '/' && location.pathname.startsWith(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative ${collapsed ? 'justify-center px-0' : 'px-3'} ${
              isActive ?
              'bg-sidebar-accent text-sidebar-primary' :
              'text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground'}`
              }>
              
              <item.icon className={`w-5 h-5 shrink-0 ${collapsed ? 'mx-auto' : ''} ${isActive ? 'text-sidebar-primary' : ''}`} />
              {!collapsed && <span className="truncate">{item.label}</span>}
              {item.label === 'Notifications' && unreadCount > 0 && !collapsed &&
              <Badge className="ml-auto bg-destructive text-destructive-foreground text-[10px] h-5 min-w-[20px] flex items-center justify-center">
                  {unreadCount}
                </Badge>
              }
              {item.label === 'Notifications' && unreadCount > 0 && collapsed &&
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-destructive" />
              }
              {isActive &&
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-sidebar-primary rounded-r-full" />
              }
            </Link>);

        })}
      </nav>

      {/* Collapse toggle — desktop only */}
      <div className="p-2 border-t border-sidebar-border hidden lg:block">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors w-full">
          
          {collapsed ? <ChevronRight className="w-5 h-5 shrink-0" /> : <ChevronLeft className="w-5 h-5 shrink-0" />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>);

}