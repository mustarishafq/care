import { db } from '@/api/db';

import React from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { useNotifications } from '@/lib/useNotifications';
import { invalidateNotificationQueries } from '@/lib/notifications';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, CheckCheck, FileText, RefreshCw, AlertTriangle, Clock, UserPlus } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';

const TYPE_ICONS = {
  ticket_assigned: UserPlus,
  status_changed: RefreshCw,
  sla_warning: AlertTriangle,
  overdue: Clock,
  mention: Bell,
  general: Bell,
};

export default function Notifications() {
  const queryClient = useQueryClient();
  const { notifications, unreadCount, isLoading } = useNotifications();

  const markRead = async (id) => {
    await db.entities.Notification.update(id, { is_read: true });
    invalidateNotificationQueries(queryClient);
  };

  const markAllRead = async () => {
    const unread = notifications.filter(n => !n.is_read);
    for (const n of unread) {
      await db.entities.Notification.update(n.id, { is_read: true });
    }
    invalidateNotificationQueries(queryClient);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground text-sm mt-1">{unreadCount} unread</p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead}>
            <CheckCheck className="w-4 h-4 mr-2" />Mark All Read
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {notifications.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Bell className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>No notifications yet</p>
          </div>
        )}
        {notifications.map(n => {
          const Icon = TYPE_ICONS[n.type] || Bell;
          return (
            <Card key={n.id} className={`transition-colors ${!n.is_read ? 'bg-primary/5 border-primary/20' : ''}`}>
              <CardContent className="flex items-start gap-3 py-3 px-4">
                <div className={`p-2 rounded-lg shrink-0 ${!n.is_read ? 'bg-primary/10' : 'bg-muted'}`}>
                  <Icon className={`w-4 h-4 ${!n.is_read ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${!n.is_read ? 'font-semibold' : 'font-medium'}`}>{n.title}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{n.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(n.created_date), 'MMM dd, yyyy HH:mm')}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {n.complaint_id && (
                    <Link to={`/complaints/${n.complaint_id}`}>
                      <Button variant="ghost" size="sm" className="text-xs"><FileText className="w-3 h-3 mr-1" />View</Button>
                    </Link>
                  )}
                  {!n.is_read && (
                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => markRead(n.id)}>Mark Read</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}