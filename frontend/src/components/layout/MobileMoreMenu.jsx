import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { glassPanelStyles } from './glassStyles';
import ThemeToggle from '@/components/theme/ThemeToggle';
import { careNavItems, isNavActive, filterNavItems } from './navItems';

export default function MobileMoreMenu({ permissions, isAdmin, unreadCount = 0 }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  const mainItems = filterNavItems(
    careNavItems.filter((item) => !item.admin),
    permissions,
    isAdmin,
  );
  const adminItems = filterNavItems(
    careNavItems.filter((item) => item.admin),
    permissions,
    isAdmin,
  );

  const NavLink = ({ item }) => {
    const active = isNavActive(location.pathname, item.path);
    return (
      <Link
        to={item.path}
        onClick={() => setOpen(false)}
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors',
          active
            ? 'bg-primary/15 text-primary'
            : 'text-foreground hover:bg-foreground/5',
        )}
      >
        <item.icon className="h-5 w-5 shrink-0" />
        <span className="text-sm font-medium flex-1">{item.label}</span>
        {item.badge && unreadCount > 0 && (
          <span className="min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Link>
    );
  };

  return (
    <>
      <button
        type="button"
        className="p-2 rounded-lg hover:bg-muted transition-colors lg:hidden shrink-0"
        onClick={() => setOpen(true)}
        aria-label="Open navigation menu"
      >
        <Menu className="w-5 h-5 text-muted-foreground" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          hideCloseButton
          overlayClassName="bg-black/25 backdrop-blur-sm"
          className={cn(
            'w-[280px] flex flex-col border-r p-0 shadow-2xl',
            glassPanelStyles,
          )}
        >
          <div className="border-b border-border/50 px-4 py-4 flex items-center gap-3">
            <img
              src="/icons/logo.svg"
              alt="EMZI Nexus Care"
              className="h-9 w-9 rounded-xl object-cover"
            />
            <span className="text-base font-bold tracking-tight">Nexus Care</span>
          </div>

          <nav className="flex-1 overflow-y-auto p-3 space-y-1">
            {permissions === null ? (
              <div className="space-y-1 px-1">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-lg animate-pulse">
                    <div className="w-5 h-5 rounded bg-muted shrink-0" />
                    <div className="h-4 rounded bg-muted flex-1" />
                  </div>
                ))}
              </div>
            ) : (
              <>
                {mainItems.map((item) => (
                  <NavLink key={item.path} item={item} />
                ))}
                {adminItems.length > 0 && (
                  <>
                    <p className="px-3 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Administration
                    </p>
                    {adminItems.map((item) => (
                      <NavLink key={item.path} item={item} />
                    ))}
                  </>
                )}
              </>
            )}
          </nav>

          <div className="mt-auto border-t border-border/50 p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <img src="/icons/logo.svg" alt="" className="w-5 h-5 rounded" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">EMZI Nexus Care</p>
                <p className="text-xs text-muted-foreground">Complaint management</p>
              </div>
            </div>
            <ThemeToggle variant="switch" />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
