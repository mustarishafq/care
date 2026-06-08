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
  'Approved Replacement',
  'Rejected',
  'Reprocessing by Fulfillment',
  'Ready to Ship',
  'Shipped',
  'Delivered',
  'Closed'
];

export const STATUS_COLORS = {
  'New Complaint': { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', dot: 'bg-blue-500' },
  'Under Review': { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300', dot: 'bg-amber-500' },
  'Waiting for Customer': { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300', dot: 'bg-orange-500' },
  'Approved Replacement': { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500' },
  'Rejected': { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300', dot: 'bg-red-500' },
  'Reprocessing by Fulfillment': { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300', dot: 'bg-purple-500' },
  'Ready to Ship': { bg: 'bg-cyan-100 dark:bg-cyan-900/30', text: 'text-cyan-700 dark:text-cyan-300', dot: 'bg-cyan-500' },
  'Shipped': { bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-700 dark:text-indigo-300', dot: 'bg-indigo-500' },
  'Delivered': { bg: 'bg-teal-100 dark:bg-teal-900/30', text: 'text-teal-700 dark:text-teal-300', dot: 'bg-teal-500' },
  'Closed': { bg: 'bg-gray-100 dark:bg-gray-900/30', text: 'text-gray-700 dark:text-gray-300', dot: 'bg-gray-500' },
};

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
export function buildStatusChangeUpdates(complaint, newStatus, statuses = [], now = new Date()) {
  const updates = { status_id: findStatusIdByName(statuses, newStatus) };
  const isoNow = now.toISOString();

  if (newStatus !== 'New Complaint' && !complaint.first_response_at) {
    updates.first_response_at = isoNow;
  }
  if (['Delivered', 'Closed'].includes(newStatus)) {
    updates.resolved_at = isoNow;
  }
  if (newStatus === 'Delivered') {
    updates.delivered_at = isoNow;
  }
  if (newStatus === 'Closed') {
    updates.closed_at = isoNow;
  }

  if (newStatus === 'Waiting for Customer') {
    updates.sla_paused_at = isoNow;
  }

  if (complaint.status === 'Waiting for Customer' && newStatus !== 'Waiting for Customer') {
    if (complaint.sla_paused_at) {
      const pausedSeconds = Math.floor((now - new Date(complaint.sla_paused_at)) / 1000);
      updates.sla_paused_duration = (complaint.sla_paused_duration || 0) + pausedSeconds;
    }
    updates.sla_paused_at = null;
  }

  return updates;
}