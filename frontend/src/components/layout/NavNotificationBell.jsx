import { db } from '@/api/db';

import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNotifications } from '@/lib/useNotifications';
import { invalidateNotificationQueries } from '@/lib/notifications';

import { Bell, RefreshCw, AlertTriangle, Clock, UserPlus, FileText, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

const TYPE_ICONS = {
  ticket_assigned: UserPlus,
  status_changed: RefreshCw,
  sla_warning: AlertTriangle,
  overdue: Clock,
  mention: Bell,
  general: Bell,
};

export default function NavNotificationBell() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const { notifications, unread } = useNotifications();
  const recent = notifications.slice(0, 10);

  const markRead = async (id) => {
    await db.entities.Notification.update(id, { is_read: true });
    invalidateNotificationQueries(queryClient);
  };

  const markAllRead = async () => {
    await Promise.all(unread.map(n => db.entities.Notification.update(n.id, { is_read: true })));
    invalidateNotificationQueries(queryClient);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="p-2 rounded-lg hover:bg-muted transition-colors relative"
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5" />
          {unread.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-0.5 animate-pulse">
              {unread.length > 99 ? '99+' : unread.length}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4" />
            <span className="font-semibold text-sm">Notifications</span>
            {unread.length > 0 && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0">{unread.length} new</Badge>
            )}
          </div>
          {unread.length > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={markAllRead}>
              <CheckCheck className="w-3.5 h-3.5 mr-1" />All read
            </Button>
          )}
        </div>

        {/* List */}
        <div className="max-h-96 overflow-y-auto divide-y">
          {recent.length === 0 && (
            <div className="text-center py-10 text-muted-foreground text-sm">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
              No notifications
            </div>
          )}
          {recent.map(n => {
            const Icon = TYPE_ICONS[n.type] || Bell;
            return (
              <div key={n.id} className={`flex items-start gap-3 px-4 py-3 ${!n.is_read ? 'bg-primary/5' : ''}`}>
                <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${!n.is_read ? 'bg-primary/10' : 'bg-muted'}`}>
                  <Icon className={`w-3.5 h-3.5 ${!n.is_read ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-xs leading-snug ${!n.is_read ? 'font-semibold' : 'font-medium'}`}>{n.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-muted-foreground">{format(new Date(n.created_date), 'MMM d, HH:mm')}</span>
                    {n.complaint_id && (
                      <Link to={`/complaints/${n.complaint_id}`} onClick={() => setOpen(false)}>
                        <span className="text-[10px] text-primary hover:underline flex items-center gap-0.5">
                          <FileText className="w-2.5 h-2.5" />View ticket
                        </span>
                      </Link>
                    )}
                    {!n.is_read && (
                      <button className="text-[10px] text-muted-foreground hover:text-foreground" onClick={() => markRead(n.id)}>
                        Mark read
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="border-t px-4 py-2">
          <Link to="/notifications" onClick={() => setOpen(false)}>
            <Button variant="ghost" size="sm" className="w-full text-xs">View all notifications</Button>
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}