import React from 'react';
import { useTheme } from 'next-themes';
import {
  getNotificationCategoryIcon,
  getNotificationCategoryLabel,
  getNotificationPriorityVisual,
  normalizeNotification,
} from '@/lib/notificationVisuals';
import { cn } from '@/lib/utils';

export default function NotificationVisualBadges({ notification }) {
  const { resolvedTheme } = useTheme();
  const normalized = normalizeNotification(notification);
  const CategoryIcon = getNotificationCategoryIcon(normalized.category);
  const showPriority = normalized.priority === 'high' || normalized.priority === 'critical';

  return (
    <div className="flex items-center flex-wrap gap-1.5 mt-2">
      {normalized.category && (
        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-foreground/80 dark:text-muted-foreground bg-background/90 dark:bg-muted border border-border/50 px-1.5 py-0.5 rounded">
          <CategoryIcon className="w-2.5 h-2.5" />
          {getNotificationCategoryLabel(normalized.category)}
        </span>
      )}
      {normalized.system_id && (
        <span className="text-[10px] font-mono text-foreground/70 dark:text-muted-foreground bg-background/80 dark:bg-muted/80 border border-border/40 px-1.5 py-0.5 rounded">
          {normalized.system_id}
        </span>
      )}
      {showPriority && (
        <span
          className={cn(
            'text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded',
            getNotificationPriorityVisual(normalized.priority, resolvedTheme === 'dark'),
          )}
        >
          {normalized.priority}
        </span>
      )}
    </div>
  );
}
