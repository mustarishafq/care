import { db } from '@/api/db';

import React, { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { useNotifications } from '@/lib/useNotifications';
import { invalidateNotificationQueries } from '@/lib/notifications';
import { filterNotifications } from '@/lib/notificationFilters';
import PageHeader from '@/components/layout/PageHeader';
import PageContent from '@/components/layout/PageContent';
import NotificationFiltersBar from '@/components/notifications/NotificationFiltersBar';
import NotificationList from '@/components/notifications/NotificationList';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function Notifications() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [type, setType] = useState('all');
  const [category, setCategory] = useState('all');
  const [markingAll, setMarkingAll] = useState(false);
  const { notifications, unreadCount, isLoading } = useNotifications();

  const filtered = useMemo(
    () => filterNotifications(notifications, { search, status, type, category }),
    [notifications, search, status, type, category],
  );

  const markRead = async (id) => {
    await db.entities.Notification.update(id, { is_read: true });
    invalidateNotificationQueries(queryClient);
  };

  const markAllRead = async () => {
    if (unreadCount === 0 || markingAll) return;
    setMarkingAll(true);
    try {
      const unread = notifications.filter((n) => !n.is_read);
      await Promise.all(unread.map((n) => db.entities.Notification.update(n.id, { is_read: true })));
      invalidateNotificationQueries(queryClient);
      toast.success('All notifications marked as read');
    } catch {
      toast.error('Failed to mark all as read');
    } finally {
      setMarkingAll(false);
    }
  };

  const description = unreadCount > 0
    ? `${unreadCount} unread of ${notifications.length} total`
    : `${notifications.length} total`;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Bell}
        title="Notification Center"
        description={description}
        actions={(
          <Button
            variant="outline"
            size="sm"
            onClick={markAllRead}
            disabled={unreadCount === 0 || markingAll}
            className="gap-2 h-10 w-full sm:w-auto sm:h-9"
          >
            <CheckCheck className="w-4 h-4" />
            Mark all read
          </Button>
        )}
      />

      <PageContent className="space-y-4 max-w-4xl">
        <NotificationFiltersBar
          search={search}
          onSearchChange={setSearch}
          status={status}
          onStatusChange={setStatus}
          type={type}
          onTypeChange={setType}
          category={category}
          onCategoryChange={setCategory}
        />

        <NotificationList
          notifications={filtered}
          onMarkRead={markRead}
          onActivate={(url) => navigate(url)}
        />
      </PageContent>
    </div>
  );
}
