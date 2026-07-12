import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { glassDockStyles } from './glassStyles';
import CreateComplaintDialog from '@/components/complaints/CreateComplaintDialog';
import CenterOrbNavItem from './CenterOrbNavItem';
import MobileMoreMenu from './MobileMoreMenu';
import { useVisualViewportBottomOffset } from '@/hooks/useVisualViewportBottomOffset';
import { isRunningStandalone } from '@/lib/pwa';
import {
  desktopBottomNavItems,
  isNavActive,
  filterNavItems,
  buildMobileDockItems,
  getMobileCenterOrbItem,
  isMoreMenuActive,
} from './navItems';

function formatBadge(count) {
  return count > 99 ? '99+' : count;
}

function BottomNavItem({ item, active, badgeCount, mobile }) {
  const className = cn(
    'relative flex flex-col items-center justify-center gap-0.5 transition-colors',
    mobile
      ? 'min-w-0 flex-1 px-1'
      : 'h-16 min-w-[4.5rem] shrink-0 px-2',
    active
      ? 'text-primary'
      : 'text-muted-foreground hover:text-foreground',
  );

  const label = item.mobileLabel ?? item.label;

  return (
    <Link to={item.path} className={className}>
      {active && (
        <span
          className="absolute top-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-primary"
          aria-hidden
        />
      )}
      <span className="relative flex items-center justify-center">
        <item.icon className="h-5 w-5 shrink-0" />
        {item.badge && badgeCount > 0 && (
          <span className="absolute -right-2 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold leading-4 text-destructive-foreground">
            {formatBadge(badgeCount)}
          </span>
        )}
      </span>
      <span className="max-w-full truncate px-0.5 text-[10px] font-medium leading-none">
        {label}
      </span>
    </Link>
  );
}

function BottomNavDock({
  items,
  location,
  unreadCount,
  mobile,
  onAction,
  onMoreOpen,
  centerOrb,
  permissions,
  isAdmin,
}) {
  if (!items.length) return null;

  const moreActive = mobile && isMoreMenuActive(location.pathname, permissions, isAdmin, centerOrb);

  return (
    <div
      className={cn(
        glassDockStyles,
        'pointer-events-auto flex items-stretch px-1',
        mobile
          ? 'h-[4.25rem] w-full max-w-lg overflow-visible'
          : 'h-16 w-fit max-w-full overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden',
      )}
    >
      <div
        className={cn(
          'flex min-w-0 flex-1 items-stretch',
          mobile ? 'h-[4.25rem] overflow-visible' : 'h-16',
        )}
      >
        {items.map((item) => {
          if (item.type === 'center-orb') {
            return (
              <CenterOrbNavItem
                key={item.action ?? item.path}
                item={item}
                active={item.path ? isNavActive(location.pathname, item.path) : false}
                onAction={onAction}
              />
            );
          }

          if (item.type === 'more') {
            return (
              <button
                key="more"
                type="button"
                onClick={onMoreOpen}
                className={cn(
                  'relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 transition-colors',
                  moreActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
                aria-label="More navigation"
              >
                {moreActive && (
                  <span
                    className="absolute top-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-primary"
                    aria-hidden
                  />
                )}
                <span className="relative flex items-center justify-center">
                  <item.icon className="h-5 w-5 shrink-0" />
                  {unreadCount > 0 && (
                    <span className="absolute -right-2 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold leading-4 text-destructive-foreground">
                      {formatBadge(unreadCount)}
                    </span>
                  )}
                </span>
                <span className="max-w-full truncate px-0.5 text-[10px] font-medium leading-none">
                  {item.label}
                </span>
              </button>
            );
          }

          return (
            <BottomNavItem
              key={item.path}
              item={item}
              active={isNavActive(location.pathname, item.path)}
              badgeCount={item.badge ? unreadCount : 0}
              mobile={mobile}
            />
          );
        })}
      </div>
    </div>
  );
}

export default function BottomNav({ unreadCount = 0, permissions, isAdmin }) {
  const location = useLocation();
  const [createOpen, setCreateOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const viewportBottomOffset = useVisualViewportBottomOffset();
  const standalone = isRunningStandalone();

  const centerOrb = getMobileCenterOrbItem(permissions, isAdmin);
  const mobileItems = buildMobileDockItems(permissions, isAdmin);
  const desktopItems = filterNavItems(desktopBottomNavItems, permissions, isAdmin);

  const handleAction = (action) => {
    if (action === 'create-complaint') setCreateOpen(true);
  };

  if (!mobileItems.length && !desktopItems.length) return null;

  return (
    <>
      <nav
        className={cn(
          'fixed inset-x-0 bottom-0 z-40 pointer-events-none',
          // Browser chrome already clears the home indicator; safe-area only in PWA (§2.1)
          standalone
            ? 'pb-[calc(0.75rem+env(safe-area-inset-bottom))]'
            : 'pb-3',
        )}
        // Only lift for soft keyboard — ignore Safari toolbar deltas (avoids mid-scroll jump)
        style={viewportBottomOffset > 0 ? { bottom: viewportBottomOffset } : undefined}
        aria-label="Main navigation"
      >
        <div className="flex justify-center px-3 sm:px-4">
          <div className="w-full max-w-lg overflow-visible md:hidden">
            <BottomNavDock
              items={mobileItems}
              location={location}
              unreadCount={unreadCount}
              mobile
              onAction={handleAction}
              onMoreOpen={() => setMoreOpen(true)}
              centerOrb={centerOrb}
              permissions={permissions}
              isAdmin={isAdmin}
            />
          </div>

          <div className="hidden w-full justify-center md:flex">
            <BottomNavDock
              items={desktopItems}
              location={location}
              unreadCount={unreadCount}
              mobile={false}
            />
          </div>
        </div>
      </nav>

      <MobileMoreMenu
        open={moreOpen}
        onOpenChange={setMoreOpen}
        permissions={permissions}
        isAdmin={isAdmin}
        unreadCount={unreadCount}
        centerOrb={centerOrb}
      />

      <CreateComplaintDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}
