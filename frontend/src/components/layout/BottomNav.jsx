import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { glassDockStyles } from './glassStyles';
import CreateComplaintDialog from '@/components/complaints/CreateComplaintDialog';
import {
  mobileBottomNavItems,
  desktopBottomNavItems,
  isNavActive,
  buildBottomNavItems,
  filterNavItems,
} from './navItems';

function formatBadge(count) {
  return count > 99 ? '99+' : count;
}

function BottomNavItem({ item, active, badgeCount, mobile, onAction }) {
  const isAction = !!item.action;
  const className = cn(
    'relative flex h-16 flex-col items-center justify-center gap-0.5 transition-colors',
    mobile
      ? 'min-w-0 flex-1 px-1'
      : 'min-w-[4.5rem] shrink-0 px-2',
    isAction
      ? 'text-primary hover:text-primary/90'
      : active
        ? 'text-primary'
        : 'text-muted-foreground hover:text-foreground',
  );

  const content = (
    <>
      {active && !isAction && (
        <span
          className="absolute top-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-primary"
          aria-hidden
        />
      )}
      <span className="relative flex items-center justify-center">
        {isAction ? (
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md shadow-primary/30">
            <item.icon className="h-5 w-5 shrink-0" />
          </span>
        ) : (
          <item.icon className="h-5 w-5 shrink-0" />
        )}
        {!isAction && badgeCount > 0 && (
          <span className="absolute -right-2 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold leading-4 text-destructive-foreground">
            {formatBadge(badgeCount)}
          </span>
        )}
      </span>
      <span className="max-w-full truncate px-0.5 text-[10px] font-medium leading-none">
        {item.label}
      </span>
    </>
  );

  if (isAction) {
    return (
      <button
        type="button"
        onClick={() => onAction?.(item.action)}
        className={className}
        aria-label={item.label}
      >
        {content}
      </button>
    );
  }

  return (
    <Link to={item.path} className={className}>
      {content}
    </Link>
  );
}

function BottomNavDock({ items, location, unreadCount, mobile, onAction }) {
  if (!items.length) return null;

  return (
    <div
      className={cn(
        glassDockStyles,
        'pointer-events-auto flex h-16 items-stretch overflow-hidden',
        mobile ? 'w-full max-w-lg' : 'w-fit max-w-[min(calc(100vw-2rem),56rem)]',
      )}
    >
      <div
        className={cn(
          'flex h-16 min-w-0 flex-1 items-stretch',
          !mobile && 'overflow-x-auto scrollbar-hide',
        )}
      >
        {items.map((item) => (
          <BottomNavItem
            key={item.path ?? item.action}
            item={item}
            active={item.path ? isNavActive(location.pathname, item.path) : false}
            badgeCount={item.badge ? unreadCount : 0}
            mobile={mobile}
            onAction={onAction}
          />
        ))}
      </div>
    </div>
  );
}

export default function BottomNav({ unreadCount = 0, permissions, isAdmin }) {
  const location = useLocation();
  const [createOpen, setCreateOpen] = useState(false);
  const mobileItems = buildBottomNavItems(mobileBottomNavItems, permissions, isAdmin, {
    includeAddComplaint: true,
  });
  const desktopItems = filterNavItems(desktopBottomNavItems, permissions, isAdmin);

  const handleAction = (action) => {
    if (action === 'create-complaint') setCreateOpen(true);
  };

  if (!mobileItems.length && !desktopItems.length) return null;

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 flex justify-center pointer-events-none pb-[calc(0.75rem+env(safe-area-inset-bottom))] px-3 sm:px-4"
        aria-label="Main navigation"
      >
        {/* Mobile — max 6 items, evenly distributed (§7.4) */}
        <div className="w-full max-w-lg md:hidden">
          <BottomNavDock
            items={mobileItems}
            location={location}
            unreadCount={unreadCount}
            mobile
            onAction={handleAction}
          />
        </div>

        {/* Desktop — scrollable centered glass dock (§7.4) */}
        <div className="hidden md:flex justify-center w-full">
          <BottomNavDock
            items={desktopItems}
            location={location}
            unreadCount={unreadCount}
            mobile={false}
            onAction={handleAction}
          />
        </div>
      </nav>

      <CreateComplaintDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}
