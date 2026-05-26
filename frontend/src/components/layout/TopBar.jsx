import React, { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { useCurrentUser } from '@/lib/useCurrentUser';
import ProfileMenu from './ProfileMenu';
import NavNotificationBell from './NavNotificationBell';
import { Menu, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function TopBar({ onMenuClick }) {
  const { user } = useCurrentUser();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === 'dark';

  const toggleDark = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  return (
    <header className="h-16 border-b border-border bg-card/80 backdrop-blur-sm flex items-center justify-between px-4 md:px-6 sticky top-0 z-30">
      {/* Burger button — mobile only */}
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onMenuClick}
      >
        <Menu className="w-5 h-5" />
      </Button>
      <div className="hidden lg:block" />
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="flex items-center">
          <NavNotificationBell />
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleDark}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {mounted && (isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />)}
          </Button>
        </div>
        <div className="hidden sm:block h-5 w-px bg-border shrink-0" aria-hidden />
        <ProfileMenu user={user} />
      </div>
    </header>
  );
}
