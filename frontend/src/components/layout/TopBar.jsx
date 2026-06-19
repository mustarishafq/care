import React from 'react';
import { cn } from '@/lib/utils';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { useIsMobile } from '@/hooks/use-mobile';
import ProfileMenu from './ProfileMenu';
import NavNotificationBell from './NavNotificationBell';
import MobileMoreMenu from './MobileMoreMenu';
import { GlobalSearchTrigger } from './GlobalSearch';
import ThemeToggle from '@/components/theme/ThemeToggle';
import { glassPanelStyles } from './glassStyles';

export default function TopBar({ permissions, isAdmin, unreadCount }) {
  const { user } = useCurrentUser();
  const isMobile = useIsMobile();

  return (
    <header
      className={cn(
        glassPanelStyles,
        'sticky top-0 z-30 h-16 w-full border-b flex items-center justify-between px-4 sm:px-6 transition-all duration-200',
      )}
    >
      <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
        <MobileMoreMenu
          permissions={permissions}
          isAdmin={isAdmin}
          unreadCount={unreadCount}
        />
        <GlobalSearchTrigger className="flex-1 max-w-xl" />
      </div>

      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        {!isMobile && (
          <>
            <ThemeToggle />
            <NavNotificationBell />
            <div className="hidden sm:block h-5 w-px bg-border shrink-0 mx-1" aria-hidden />
          </>
        )}
        {isMobile && <ThemeToggle />}
        <ProfileMenu user={user} />
      </div>
    </header>
  );
}
