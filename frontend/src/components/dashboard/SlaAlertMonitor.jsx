import { db } from '@/api/db';

import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';

import { differenceInHours } from 'date-fns';
import { sendNotification, invalidateNotificationQueries } from '@/lib/notifications';
import { useQueryClient } from '@tanstack/react-query';

const STALE_STATUSES = ['New Complaint', 'Under Review'];
const CHECK_INTERVAL_MS = 5 * 60 * 1000; // check every 5 minutes
const STORAGE_KEY = 'sla_alerted_ids'; // avoid duplicate alerts per session

function getAlertedIds() {
  try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}
function markAlerted(id) {
  const ids = getAlertedIds();
  if (!ids.includes(id)) sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...ids, id]));
}

export default function SlaAlertMonitor({ user }) {
  const queryClient = useQueryClient();
  const isManager = !!user?.is_admin;
  const lastRunRef = useRef(0);

  const { data: complaints = [] } = useQuery({
    queryKey: ['complaints-sla-monitor'],
    queryFn: () => db.entities.Complaint.list(),
    enabled: isManager,
    refetchInterval: CHECK_INTERVAL_MS,
  });

  const { data: configs = [] } = useQuery({
    queryKey: ['system_configs'],
    queryFn: () => db.entities.SystemConfig.list(),
    enabled: isManager,
  });

  useEffect(() => {
    if (!isManager || !complaints.length) return;

    const slaConfig = configs.find(c => c.key === 'sla_settings');
    const threshold = slaConfig?.json_value?.stale_alert_hours ?? 24;

    const now = Date.now();
    if (now - lastRunRef.current < 60_000) return; // debounce
    lastRunRef.current = now;

    const alerted = getAlertedIds();
    const stale = complaints.filter(c =>
      STALE_STATUSES.includes(c.status) &&
      differenceInHours(new Date(), new Date(c.created_date)) >= threshold &&
      !alerted.includes(c.id)
    );

    if (!stale.length) return;

    stale.forEach(async (c) => {
      markAlerted(c.id);
      const ageH = differenceInHours(new Date(), new Date(c.created_date));
      const title = `⚠️ Stale Ticket: ${c.ticket_id}`;
      const message = `Ticket ${c.ticket_id} (${c.status}) has been open for ${ageH} hours without progress. Customer: ${c.customer_name}`;

      // In-app notification for the current manager
      await sendNotification({
        recipient_user_id: user.id,
        title,
        message,
        type: 'sla_warning',
        complaint_id: c.id,
      });

      invalidateNotificationQueries(queryClient);

      // Email alert
      await db.integrations.Core.SendEmail({
        to: user.email,
        subject: title,
        body: `${message}\n\nPlease review and take action: ${window.location.origin}/complaints/${c.id}`,
      });
    });
  }, [complaints, configs, isManager, user]);

  return null; // purely side-effect component
}