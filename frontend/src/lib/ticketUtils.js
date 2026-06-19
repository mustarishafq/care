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
  'Closed',
  'Drop',
];

import { DEFAULT_SLA_PAUSED_STATUS_NAMES, isSlaPausedStatus } from '@/lib/slaSettings';

/** @deprecated Use settings from useSlaSettings() instead */
export const SLA_PAUSED_STATUSES = DEFAULT_SLA_PAUSED_STATUS_NAMES;

export const SLA_CLOSED_STATUSES = ['Delivered', 'Closed', 'Rejected', 'Drop'];

export const TERMINAL_STATUSES = ['Rejected', 'Drop'];

export const CLOSURE_PROOF_REQUIRED_STATUSES = ['Closed', 'Drop'];

export function requiresClosureProof(status) {
  return CLOSURE_PROOF_REQUIRED_STATUSES.includes(status);
}

export function hasClosureProof(complaint) {
  return Array.isArray(complaint?.closure_proof_files) && complaint.closure_proof_files.length > 0;
}

export const STATUS_COLORS = {
  'New Complaint': { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', dot: 'bg-blue-500' },
  'Under Review': { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300', dot: 'bg-amber-500' },
  'Waiting for Customer': { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300', dot: 'bg-orange-500' },
  'Waiting for Vendor': { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-300', dot: 'bg-yellow-500' },
  'Approved Replacement': { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500' },
  'Rejected': { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300', dot: 'bg-red-500' },
  'Reprocessing by Fulfillment': { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300', dot: 'bg-purple-500' },
  'Ready to Ship': { bg: 'bg-cyan-100 dark:bg-cyan-900/30', text: 'text-cyan-700 dark:text-cyan-300', dot: 'bg-cyan-500' },
  'Shipped': { bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-700 dark:text-indigo-300', dot: 'bg-indigo-500' },
  'Delivered': { bg: 'bg-teal-100 dark:bg-teal-900/30', text: 'text-teal-700 dark:text-teal-300', dot: 'bg-teal-500' },
  'Closed': { bg: 'bg-gray-100 dark:bg-gray-900/30', text: 'text-gray-700 dark:text-gray-300', dot: 'bg-gray-500' },
  'Drop': { bg: 'bg-slate-100 dark:bg-slate-900/30', text: 'text-slate-700 dark:text-slate-300', dot: 'bg-slate-500' },
};

export const DEFAULT_STATUS_COLORS = {
  bg: 'bg-muted',
  text: 'text-muted-foreground',
  dot: 'bg-muted-foreground',
};

export function getStatusColors(status) {
  return STATUS_COLORS[status] ?? DEFAULT_STATUS_COLORS;
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
) {
  const updates = {
    status: newStatus,
    status_id: findStatusIdByName(statuses, newStatus),
  };
  const isoNow = now.toISOString();

  if (newStatus !== 'New Complaint' && !complaint.first_response_at) {
    updates.first_response_at = isoNow;
  }
  if (SLA_CLOSED_STATUSES.includes(newStatus)) {
    updates.resolved_at = isoNow;
  }
  if (newStatus === 'Delivered') {
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