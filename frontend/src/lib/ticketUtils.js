import { DEFAULT_SLA_PAUSED_STATUS_NAMES, DEFAULT_SLA_RESOLVED_STATUS_NAMES, isSlaPausedStatus } from '@/lib/slaSettings';
import { getStatusColorStyles } from '@/lib/statusColors';

export function generateTicketId() {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `RH-${y}${m}${d}-${rand}`;
}

export const STATUS_ORDER = [
  'New Complaint',
  'Under Review',
  'Waiting for Customer',
  'Waiting for Vendor',
  'Approved Replacement',
  'Rejected',
  'Reprocessing by Fulfillment',
  'Ready to Ship',
  'Shipped',
  'Delivered',
  'Completed',
  'Closed',
  'Drop',
];

/** @deprecated Use settings from useSlaSettings() instead */
export const SLA_PAUSED_STATUSES = DEFAULT_SLA_PAUSED_STATUS_NAMES;

/** @deprecated Use settings from useSlaSettings() instead */
export const SLA_CLOSED_STATUSES = DEFAULT_SLA_RESOLVED_STATUS_NAMES;

export const TERMINAL_STATUSES = ['Rejected', 'Drop'];

export const CLOSURE_PROOF_REQUIRED_STATUSES = ['Closed', 'Drop'];

export function requiresClosureProof(status) {
  return CLOSURE_PROOF_REQUIRED_STATUSES.includes(status);
}

export function hasClosureProof(complaint) {
  return Array.isArray(complaint?.closure_proof_files) && complaint.closure_proof_files.length > 0;
}

/** @deprecated Use getStatusColorStyles() with complaint statuses from the API. */
export function getStatusColors(status, statuses = []) {
  return getStatusColorStyles(status, statuses);
}

export const PRIORITY_COLORS = {
  'Low': { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-300' },
  'Medium': { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300' },
  'High': { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300' },
  'Urgent': { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300' },
};

export function findStatusIdByName(statuses, name) {
  return statuses.find((s) => s.name === name)?.id ?? null;
}

function insertAtLegacyPosition(order, name) {
  if (order.includes(name)) return order;
  const legacyIndex = STATUS_ORDER.indexOf(name);
  if (legacyIndex === -1) return [...order, name];
  for (let i = 0; i < order.length; i++) {
    const idx = STATUS_ORDER.indexOf(order[i]);
    if (idx > legacyIndex) {
      return [...order.slice(0, i), name, ...order.slice(i)];
    }
  }
  return [...order, name];
}

/** Ordered status names from API lookup rows (falls back to STATUS_ORDER when empty). */
export function buildStatusOrder(statuses = [], { includeNames = [] } = {}) {
  if (!statuses.length) return [...STATUS_ORDER];
  let order = [...statuses]
    .filter((s) => s.is_active !== false)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((s) => s.name);

  for (const name of includeNames) {
    if (name) order = insertAtLegacyPosition(order, name);
  }

  return order;
}

/** Side-effect fields applied when a complaint status changes (Kanban, detail page, etc.). */
export function buildStatusChangeUpdates(
  complaint,
  newStatus,
  statuses = [],
  now = new Date(),
  pausedStatusNames = DEFAULT_SLA_PAUSED_STATUS_NAMES,
  resolvedStatusNames = DEFAULT_SLA_RESOLVED_STATUS_NAMES,
  autoCloseTriggerStatusName = null,
) {
  const updates = {
    status: newStatus,
    status_id: findStatusIdByName(statuses, newStatus),
  };
  const isoNow = now.toISOString();

  if (newStatus !== 'New Complaint' && !complaint.first_response_at) {
    updates.first_response_at = isoNow;
  }
  if (resolvedStatusNames.includes(newStatus)) {
    updates.resolved_at = isoNow;
  }
  if (autoCloseTriggerStatusName && newStatus === autoCloseTriggerStatusName) {
    updates.delivered_at = isoNow;
  }
  if (newStatus === 'Closed' || newStatus === 'Drop') {
    updates.closed_at = isoNow;
  }

  if (isSlaPausedStatus(newStatus, pausedStatusNames)) {
    updates.sla_paused_at = isoNow;
  }

  if (isSlaPausedStatus(complaint.status, pausedStatusNames) && !isSlaPausedStatus(newStatus, pausedStatusNames)) {
    if (complaint.sla_paused_at) {
      const pausedSeconds = Math.floor((now - new Date(complaint.sla_paused_at)) / 1000);
      updates.sla_paused_duration = (complaint.sla_paused_duration || 0) + pausedSeconds;
    }
    updates.sla_paused_at = null;
  }

  return updates;
}