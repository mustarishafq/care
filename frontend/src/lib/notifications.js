import { db } from '@/api/db';

const DEFAULTS = {
  ticket_assigned: { severity: 'info', category: 'task' },
  status_changed: { severity: 'info', category: 'task' },
  mention: { severity: 'info', category: 'task' },
  sla_warning: { severity: 'warning', category: 'system' },
  overdue: { severity: 'critical', category: 'system' },
  approval: { severity: 'info', category: 'approval' },
  announcement: { severity: 'info', category: 'announcement' },
  general: { severity: 'info', category: 'other' },
};

function actionUrlForComplaint(complaintId) {
  if (!complaintId) return null;
  return `${window.location.origin}/complaints/${complaintId}`;
}

/** Turn absolute same-origin action URLs into SPA paths; leave external URLs intact. */
export function resolveNotificationPath(url) {
  if (!url) return null;
  if (url.startsWith('/')) return url;
  try {
    const parsed = new URL(url, window.location.origin);
    if (parsed.origin === window.location.origin) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
  } catch {
    // Fall through and return the original value.
  }
  return url;
}

function normalizeNotificationPayload({ type, complaint_id, severity, category, action_url, ...rest }) {
  const defaults = DEFAULTS[type] ?? DEFAULTS.general;

  return {
    ...rest,
    type,
    complaint_id: complaint_id ?? null,
    severity: severity ?? defaults.severity,
    category: category ?? defaults.category,
    action_url: action_url ?? actionUrlForComplaint(complaint_id),
    is_read: false,
  };
}

/** Split note content into text and @mention segments (longest-name-first). */
export function parseMentionSegments(content, users) {
  const candidates = users
    .filter(u => u.full_name)
    .sort((a, b) => b.full_name.length - a.full_name.length);

  const segments = [];
  let i = 0;
  let textStart = 0;

  while (i < content.length) {
    if (content[i] !== '@') {
      i++;
      continue;
    }

    const afterAt = content.slice(i + 1);
    let matched = null;

    for (const u of candidates) {
      if (!afterAt.toLowerCase().startsWith(u.full_name.toLowerCase())) {
        continue;
      }

      const next = afterAt[u.full_name.length];
      if (next === undefined || /[\s,.!?;:]/.test(next)) {
        matched = u;
        break;
      }
    }

    if (matched) {
      if (textStart < i) {
        segments.push({ type: 'text', value: content.slice(textStart, i) });
      }
      segments.push({ type: 'mention', value: matched.full_name, user: matched });
      i += 1 + matched.full_name.length;
      textStart = i;
    } else {
      i++;
    }
  }

  if (textStart < content.length) {
    segments.push({ type: 'text', value: content.slice(textStart) });
  }

  return segments;
}

/** Find users @mentioned in note content (longest-name-first to avoid partial matches). */
export function findMentionedUsers(content, users, excludeUserId = null) {
  const mentioned = new Map();

  for (const segment of parseMentionSegments(content, users)) {
    if (segment.type !== 'mention') continue;
    if (String(segment.user.id) === String(excludeUserId)) continue;
    mentioned.set(segment.user.id, segment.user);
  }

  return [...mentioned.values()];
}

export async function sendNotification(payload) {
  if (!payload?.recipient_user_id) return null;

  return db.entities.Notification.create(normalizeNotificationPayload(payload));
}

export async function notifyAssignedUser({ assigneeUserId, assignerName, ticketId, complaintId }) {
  if (!assigneeUserId) return;

  await sendNotification({
    recipient_user_id: assigneeUserId,
    title: 'Ticket assigned to you',
    message: `${assignerName || 'Someone'} assigned ticket ${ticketId} to you.`,
    type: 'ticket_assigned',
    complaint_id: complaintId,
  });
}

export async function notifyStatusChange({ recipientUserId, changerName, ticketId, oldStatus, newStatus, complaintId }) {
  if (!recipientUserId) return;

  await sendNotification({
    recipient_user_id: recipientUserId,
    title: 'Ticket status updated',
    message: `${changerName || 'Someone'} changed ticket ${ticketId} from "${oldStatus}" to "${newStatus}".`,
    type: 'status_changed',
    complaint_id: complaintId,
  });
}

export function invalidateNotificationQueries(queryClient) {
  queryClient.invalidateQueries({ queryKey: ['notifications'] });
}
