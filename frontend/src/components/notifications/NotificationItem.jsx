import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { BellOff, Check, Clock, MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import NotificationVisualBadges from '@/components/notifications/NotificationVisualBadges';
import {
  getNotificationTypeIcon,
  getNotificationTypeVisual,
  normalizeNotification,
} from '@/lib/notificationVisuals';
import { cn } from '@/lib/utils';

export default function NotificationItem({
  notification,
  onMarkRead,
  onActivate,
}) {
  const normalized = normalizeNotification(notification);
  const config = getNotificationTypeVisual(normalized.severity);
  const TypeIcon = getNotificationTypeIcon(normalized.type);
  const isUnread = !normalized.is_read;

  const handleClick = () => {
    if (isUnread && onMarkRead) onMarkRead(normalized.id);
    if (normalized.action_url && onActivate) onActivate(normalized.action_url);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      className={cn(
        'group relative flex gap-3 p-3.5 rounded-xl border transition-all duration-200 cursor-pointer',
        isUnread
          ? cn(config.bg, config.border, 'shadow-sm ring-1 ring-black/[0.05] dark:ring-white/[0.08] hover:opacity-95')
          : 'border-border bg-card/70 shadow-sm dark:bg-muted/30 hover:border-border/90 hover:bg-muted/40 dark:hover:bg-muted/50',
      )}
    >
      <div
        className={cn(
          'w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border border-black/[0.06] dark:border-white/10',
          config.bg,
        )}
      >
        <TypeIcon className={cn('w-[18px] h-[18px]', config.color)} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className={cn('text-sm text-foreground leading-snug font-medium flex-1 min-w-0', isUnread && 'font-semibold')}>
            {normalized.title}
          </p>
          <div className="flex items-center gap-1 shrink-0">
            {normalized.created_at && (
              <span className="text-[10px] text-foreground/60 dark:text-muted-foreground whitespace-nowrap">
                {formatDistanceToNow(new Date(normalized.created_at), { addSuffix: true })}
              </span>
            )}
            <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              {isUnread && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarkRead?.(normalized.id);
                  }}
                >
                  <Check className="w-4 h-4 mr-2" />
                  Mark as read
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  toast.info('Snooze is not available yet');
                }}
              >
                <Clock className="w-4 h-4 mr-2" />
                Snooze 1hr
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  toast.info('Dismiss is not available yet');
                }}
              >
                <BellOff className="w-4 h-4 mr-2" />
                Dismiss
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        </div>

        {normalized.message && (
          <p className="text-xs text-foreground/75 dark:text-muted-foreground mt-0.5 line-clamp-3">
            {normalized.message}
          </p>
        )}

        <NotificationVisualBadges notification={normalized} />
      </div>

      {isUnread && (
        <span className={cn('absolute top-3.5 right-3.5 w-2 h-2 rounded-full', config.dot)} />
      )}
    </div>
  );
}
