import { format } from 'date-fns';
import { normalizeNotification } from '@/lib/notificationVisuals';

export const NOTIFICATION_STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'read', label: 'Read' },
];

export const NOTIFICATION_TYPE_OPTIONS = [
  { value: 'all', label: 'All Types' },
  { value: 'ticket_assigned', label: 'Ticket assigned' },
  { value: 'status_changed', label: 'Status changed' },
  { value: 'sla_warning', label: 'SLA warning' },
  { value: 'low_rating_review', label: 'Low rating review' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'mention', label: 'Mention' },
  { value: 'general', label: 'General' },
];

export const NOTIFICATION_CATEGORY_OPTIONS = [
  { value: 'all', label: 'All Categories' },
  { value: 'task', label: 'Task' },
  { value: 'system', label: 'System' },
  { value: 'approval', label: 'Approval' },
  { value: 'announcement', label: 'Announcement' },
  { value: 'other', label: 'Other' },
];

export function filterNotifications(notifications, { search = '', status = 'all', type = 'all', category = 'all' } = {}) {
  let result = [...notifications];

  if (status === 'unread') {
    result = result.filter((n) => !n.is_read);
  } else if (status === 'read') {
    result = result.filter((n) => n.is_read);
  }

  if (type !== 'all') {
    result = result.filter((n) => n.type === type);
  }

  if (category !== 'all') {
    result = result.filter((n) => normalizeNotification(n).category === category);
  }

  const query = search.trim().toLowerCase();
  if (query) {
    result = result.filter((n) => {
      const normalized = normalizeNotification(n);
      return (
        normalized.title?.toLowerCase().includes(query)
        || normalized.message?.toLowerCase().includes(query)
        || normalized.type?.toLowerCase().includes(query)
        || normalized.category?.toLowerCase().includes(query)
      );
    });
  }

  return result;
}

export function groupNotificationsByDate(notifications) {
  const groups = new Map();

  for (const notification of notifications) {
    const { created_at: createdAt } = normalizeNotification(notification);
    if (!createdAt) continue;

    const date = new Date(createdAt);
    const key = format(date, 'yyyy-MM-dd');
    if (!groups.has(key)) {
      groups.set(key, { date, items: [] });
    }
    groups.get(key).items.push(notification);
  }

  return [...groups.values()].sort((a, b) => b.date.getTime() - a.date.getTime());
}

export function formatNotificationGroupLabel(date) {
  return format(date, 'EEEE, MMM d').toUpperCase();
}
