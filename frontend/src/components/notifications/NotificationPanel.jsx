import { db } from '@/api/db';

import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, CheckCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import NotificationList from '@/components/notifications/NotificationList';
import { glassPanelStyles } from '@/components/layout/glassStyles';
import { useNotifications } from '@/lib/useNotifications';
import { invalidateNotificationQueries } from '@/lib/notifications';
import { isCriticalNotification, normalizeNotification } from '@/lib/notificationVisuals';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function NotificationPanel({ open, onClose }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('all');
  const [markingAll, setMarkingAll] = useState(false);
  const { notifications, unread, isLoading } = useNotifications();

  const unreadCount = unread.length;

  const filtered = useMemo(() => {
    if (filter === 'unread') return notifications.filter((n) => !normalizeNotification(n).is_read);
    if (filter === 'critical') return notifications.filter(isCriticalNotification);
    return notifications;
  }, [notifications, filter]);

  const visible = filtered.slice(0, 50);

  const markRead = async (id) => {
    await db.entities.Notification.update(id, { is_read: true });
    invalidateNotificationQueries(queryClient);
  };

  const markAllRead = async () => {
    if (unreadCount === 0 || markingAll) return;
    setMarkingAll(true);
    try {
      await Promise.all(unread.map((n) => db.entities.Notification.update(n.id, { is_read: true })));
      invalidateNotificationQueries(queryClient);
      toast.success('All notifications marked as read');
    } catch {
      toast.error('Failed to mark all as read');
    } finally {
      setMarkingAll(false);
    }
  };

  const handleActivate = (url) => {
    onClose();
    if (url.startsWith('http')) {
      window.location.href = url;
      return;
    }
    navigate(url);
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[60] bg-black/20 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className={cn(
              'fixed right-0 top-0 bottom-0 z-[61] flex w-full max-w-md flex-col',
              'rounded-bl-2xl sm:rounded-none border-l',
              glassPanelStyles,
            )}
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            <div className="flex items-center gap-2 border-b border-border/50 p-4">
              <Bell className="w-5 h-5 shrink-0 text-primary" />
              <h2 className="font-semibold text-lg shrink-0">Notifications</h2>
              {unreadCount > 0 && (
                <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-medium shrink-0">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
              <div className="flex-1" />
              <Button
                variant="ghost"
                size="sm"
                className="h-8 shrink-0 whitespace-nowrap px-2 text-xs text-foreground hover:text-foreground"
                onClick={markAllRead}
                disabled={unreadCount === 0 || markingAll}
              >
                <CheckCheck className="w-3.5 h-3.5 mr-1" />
                Mark all read
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={onClose}
                aria-label="Close notifications"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="px-4 pt-3">
              <Tabs value={filter} onValueChange={setFilter}>
                <TabsList className="w-full bg-muted/50 h-9 text-foreground/60">
                  <TabsTrigger value="all" className="text-xs flex-1 data-[state=active]:text-foreground">
                    All
                  </TabsTrigger>
                  <TabsTrigger value="unread" className="text-xs flex-1 data-[state=active]:text-foreground">
                    Unread
                  </TabsTrigger>
                  <TabsTrigger value="critical" className="text-xs flex-1 data-[state=active]:text-foreground">
                    Critical
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <ScrollArea className="flex-1 px-3 py-2">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" />
                </div>
              ) : visible.length === 0 ? (
                <div className="py-16 text-center">
                  <Bell className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">No notifications</p>
                  <p className="text-xs text-foreground/60 dark:text-muted-foreground mt-1">
                    You&apos;re all caught up!
                  </p>
                </div>
              ) : (
                <NotificationList
                  notifications={visible}
                  onMarkRead={markRead}
                  onActivate={handleActivate}
                  animate={false}
                  className="space-y-4 pb-2"
                />
              )}
            </ScrollArea>

            <div className="p-3 border-t border-border/50">
              <Button variant="outline" className="w-full text-sm h-9" asChild onClick={onClose}>
                <Link to="/notifications">View All Notifications</Link>
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
