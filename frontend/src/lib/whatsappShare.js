import { formatAgentNames } from '@/lib/assignedAgents';

const EVENT_LABELS = {
  created: 'New ticket',
  status_changed: 'Status update',
  assigned: 'Assignment update',
  updated: 'Ticket update',
};

/** Public app URL for deep links (falls back to current origin). */
export function getAppBaseUrl() {
  const configured = import.meta.env.VITE_APP_URL?.replace(/\/$/, '');
  return configured || window.location.origin;
}

export function getComplaintUrl(complaintId) {
  return `${getAppBaseUrl()}/complaints/${complaintId}`;
}

/**
 * @param {object} complaint
 * @param {{ event?: string, oldStatus?: string, newStatus?: string, note?: string }} [options]
 */
export function buildComplaintShareMessage(complaint, options = {}) {
  const { event = 'updated', oldStatus, newStatus, note } = options;
  const label = EVENT_LABELS[event] ?? EVENT_LABELS.updated;
  const lines = [`[CARE] ${label}: ${complaint.ticket_id}`];

  if (event === 'status_changed' && oldStatus != null && newStatus != null) {
    lines.push(`Status: ${oldStatus} → ${newStatus}`);
  } else if (complaint.status) {
    lines.push(`Status: ${complaint.status}`);
  }

  if (complaint.order_number) lines.push(`Order: ${complaint.order_number}`);
  if (complaint.complaint_type) lines.push(`Type: ${complaint.complaint_type}`);
  if (complaint.priority) lines.push(`Priority: ${complaint.priority}`);
  if (complaint.assigned_department) lines.push(`Department: ${complaint.assigned_department}`);

  const agents = formatAgentNames(complaint);
  if (agents) lines.push(`Assigned: ${agents}`);

  if (complaint.customer_name) lines.push(`Customer: ${complaint.customer_name}`);
  if (note) lines.push(note);

  lines.push(getComplaintUrl(complaint.id));

  return lines.join('\n');
}

export function getWhatsappShareUrl(text) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function openWhatsappShare(complaint, options = {}) {
  const url = getWhatsappShareUrl(buildComplaintShareMessage(complaint, options));
  window.open(url, '_blank', 'noopener,noreferrer');
}

export async function copyComplaintShareMessage(complaint, options = {}) {
  const text = buildComplaintShareMessage(complaint, options);
  await navigator.clipboard.writeText(text);
  return text;
}
