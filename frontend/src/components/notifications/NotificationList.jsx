import React from 'react';
import { motion } from 'framer-motion';
import { Bell } from 'lucide-react';
import NotificationItem from '@/components/notifications/NotificationItem';
import { formatNotificationGroupLabel, groupNotificationsByDate } from '@/lib/notificationFilters';
import { listItemMotion } from '@/lib/motion';

export default function NotificationList({
  notifications,
  onMarkRead,
  onActivate,
  animate = true,
  className = '',
}) {
  if (!notifications.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border px-6 py-16 text-center">
        <Bell className="w-10 h-10 mx-auto mb-3 text-muted-foreground/60" />
        <p className="text-sm font-medium">No notifications</p>
        <p className="text-xs text-muted-foreground mt-1">You&apos;re all caught up!</p>
      </div>
    );
  }

  const groups = groupNotificationsByDate(notifications);
  let itemIndex = 0;

  return (
    <div className={className}>
      {groups.map((group) => (
        <section key={group.date.toISOString()} className="space-y-2.5">
          <h2 className="px-1 pt-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {formatNotificationGroupLabel(group.date)}
          </h2>
          <div className="space-y-2.5">
            {group.items.map((notification) => {
              const motionProps = animate ? listItemMotion(itemIndex++) : {};
              const item = (
                <NotificationItem
                  notification={notification}
                  onMarkRead={onMarkRead}
                  onActivate={onActivate}
                />
              );

              if (!animate) {
                return <div key={notification.id}>{item}</div>;
              }

              return (
                <motion.div key={notification.id} {...motionProps}>
                  {item}
                </motion.div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
