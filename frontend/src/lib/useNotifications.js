import { useQuery } from '@tanstack/react-query';
import { db } from '@/api/db';
import { useCurrentUser } from '@/lib/useCurrentUser';

export function useNotifications() {
  const { user } = useCurrentUser();

  const query = useQuery({
    queryKey: ['notifications', user?.email],
    queryFn: () => db.entities.Notification.filter({ recipient_email: user?.email }, '-created_date'),
    enabled: !!user?.email,
    refetchInterval: 15_000,
  });

  const notifications = query.data ?? [];
  const unread = notifications.filter(n => !n.is_read);

  return {
    ...query,
    notifications,
    unread,
    unreadCount: unread.length,
  };
}
