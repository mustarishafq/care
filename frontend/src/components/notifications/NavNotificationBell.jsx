import React, { useState } from 'react';
import { Bell } from 'lucide-react';
import { useNotifications } from '@/lib/useNotifications';
import NotificationPanel from '@/components/notifications/NotificationPanel';
import { cn } from '@/lib/utils';

export default function NavNotificationBell({ className }) {
  const [open, setOpen] = useState(false);
  const { unreadCount } = useNotifications();

  return (
    <>
      <button
        type="button"
        className={cn('p-2 rounded-lg hover:bg-muted transition-colors relative', className)}
        aria-label="Notifications"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center px-0.5">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
      <NotificationPanel open={open} onClose={() => setOpen(false)} />
    </>
  );
}
