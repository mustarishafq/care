import { db } from '@/api/db';

import React from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { useNotifications } from '@/lib/useNotifications';
import { invalidateNotificationQueries } from '@/lib/notifications';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, CheckCheck, FileText, RefreshCw, AlertTriangle, Clock, UserPlus } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
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
    <div className="space-y-6">
      <PageHeader
        icon={Bell}
        title="Notifications"
        description={`${unreadCount} unread`}
        actions={unreadCount > 0 ? (
          <Button variant="outline" size="sm" onClick={markAllRead} className="gap-2 h-10 w-full sm:w-auto sm:h-9">
            <CheckCheck className="w-4 h-4" />Mark All Read
          </Button>
        ) : null}
      />

      <div className="mx-auto w-full max-w-2xl">
        {notifications.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Bell className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>No notifications yet</p>
          </div>
        ) : (
          <Card className="rounded-2xl overflow-hidden">
            <CardContent className="p-0 divide-y">
              {notifications.map(n => {
                const Icon = TYPE_ICONS[n.type] || Bell;
                return (
                  <div
                    key={n.id}
                    className={`flex items-start gap-3 px-4 py-3.5 sm:px-5 ${!n.is_read ? 'bg-primary/5' : ''}`}
                  >
                    <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${!n.is_read ? 'bg-primary/10' : 'bg-muted'}`}>
                      <Icon className={`w-4 h-4 ${!n.is_read ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-2">
                        <p className={`text-sm leading-snug ${!n.is_read ? 'font-semibold' : 'font-medium'}`}>
                          {n.title}
                        </p>
                        {!n.is_read && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">New</Badge>
                        )}
                      </div>
                      {n.message && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{n.message}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(n.created_date), 'MMM dd, yyyy HH:mm')}
                        </span>
                        {n.complaint_id && (
                          <Link
                            to={`/complaints/${n.complaint_id}`}
                            className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                          >
                            <FileText className="w-3 h-3" />View ticket
                          </Link>
                        )}
                        {!n.is_read && (
                          <button
                            type="button"
                            className="text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => markRead(n.id)}
                          >
                            Mark read
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
