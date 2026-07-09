import { useQuery } from '@tanstack/react-query';
import { db } from '@/api/db';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { normalizeNotification } from '@/lib/notificationVisuals';

export function useNotifications() {
  const { user } = useCurrentUser();

  const query = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: () => db.entities.Notification.filter({ recipient_user_id: user?.id }, '-created_date'),
    enabled: !!user?.id,
    refetchInterval: 15_000,
  });

  const notifications = query.data ?? [];
  const unread = notifications.filter((n) => !normalizeNotification(n).is_read);

  return {
    ...query,
    notifications,
    unread,
    unreadCount: unread.length,
  };
}
