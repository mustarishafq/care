import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LogOut, Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { glassPanelStyles } from './glassStyles';
import ThemeToggle from '@/components/theme/ThemeToggle';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from 'next-themes';
import { isNavActive, buildMobileMoreItems } from './navItems';

function formatBadge(count) {
  return count > 99 ? '99+' : count;
}

function GridLink({ item, active, unreadCount, onNavigate }) {
  return (
    <Link
      to={item.path}
      onClick={onNavigate}
      className={cn(
        'relative flex flex-col items-center gap-1.5 rounded-xl py-3 transition-colors',
        active
          ? 'bg-primary/15 text-primary'
          : 'text-foreground hover:bg-foreground/5',
      )}
    >
      <item.icon className="h-5 w-5 shrink-0" />
      <span className="max-w-full truncate px-1 text-center text-[11px] font-medium leading-none">
        {item.label}
      </span>
      {item.badge && unreadCount > 0 && (
        <span className="absolute right-2 top-2 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold leading-4 text-destructive-foreground">
          {formatBadge(unreadCount)}
        </span>
      )}
    </Link>
  );
}

export default function MobileMoreMenu({
  open,
  onOpenChange,
  permissions,
  isAdmin,
  unreadCount = 0,
  centerOrb,
}) {
  const location = useLocation();
  const { logout } = useAuth();
  const { resolvedTheme } = useTheme();
  const { main, admin } = buildMobileMoreItems(permissions, isAdmin, centerOrb);
  const isDark = resolvedTheme === 'dark';

  const close = () => onOpenChange(false);

  const handleSignOut = () => {
    close();
    logout();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        hideCloseButton
        overlayClassName="bg-black/25 backdrop-blur-sm"
        className={cn(
          'flex max-h-[85dvh] flex-col rounded-t-2xl border-t p-0 shadow-2xl',
          glassPanelStyles,
        )}
      >
        <div className="flex items-center gap-3 border-b border-border/50 px-4 py-4">
          <img
            src="/icons/logo.svg"
            alt="EMZI Nexus Care"
            className="h-9 w-9 rounded-xl object-cover"
          />
          <span className="text-base font-bold tracking-tight">EMZI Nexus Care</span>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4">
          {permissions === null ? (
            <div className="grid grid-cols-4 gap-1">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="flex flex-col items-center gap-2 rounded-xl py-3 animate-pulse">
                  <div className="h-5 w-5 rounded bg-muted" />
                  <div className="h-3 w-12 rounded bg-muted" />
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-1">
                {main.map((item) => (
                  <GridLink
                    key={item.path}
                    item={item}
                    active={isNavActive(location.pathname, item.path)}
                    unreadCount={unreadCount}
                    onNavigate={close}
                  />
                ))}
              </div>

              {admin.length > 0 && (
                <>
                  <p className="mb-2 mt-5 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Admin
                  </p>
                  <div className="grid grid-cols-4 gap-1">
                    {admin.map((item) => (
                      <GridLink
                        key={item.path}
                        item={item}
                        active={isNavActive(location.pathname, item.path)}
                        unreadCount={unreadCount}
                        onNavigate={close}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <div className="mt-auto space-y-3 border-t border-border/50 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                {isDark ? (
                  <Moon className="h-4 w-4 text-primary" />
                ) : (
                  <Sun className="h-4 w-4 text-primary" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">Dark Mode</p>
                <p className="text-xs text-muted-foreground">Switch between light and dark themes</p>
              </div>
            </div>
            <ThemeToggle variant="switch" />
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/60 py-3 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
