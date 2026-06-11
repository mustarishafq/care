import { formatAgentNames } from '@/lib/assignedAgents';

const EVENT_LABELS = {
  created: 'NEW COMPLAINT RECEIVED',
  status_changed: 'STATUS UPDATE',
  assigned: 'ASSIGNMENT UPDATE',
  updated: 'TICKET UPDATE',
};

/** Built at runtime so emojis survive encoding/build pipelines and WhatsApp URL prefill. */
const EMOJI = {
  alert: String.fromCodePoint(0x1f6a8),
  ticket: String.fromCodePoint(0x1f3ab),
  pin: String.fromCodePoint(0x1f4cc),
  warning: String.fromCodePoint(0x26a0, 0xfe0f),
  person: String.fromCodePoint(0x1f464),
  tag: String.fromCodePoint(0x1f3f7, 0xfe0f),
  package: String.fromCodePoint(0x1f4e6),
  building: String.fromCodePoint(0x1f3e2),
  briefcase: String.fromCodePoint(0x1f4bc),
  link: String.fromCodePoint(0x1f517),
  bullet: '\u2022',
  arrow: '\u2192',
};

function productNumberEmoji(index) {
  const n = index + 1;
  if (n >= 1 && n <= 9) {
    return String.fromCodePoint(0x30 + n, 0xfe0f, 0x20e3);
  }
  if (n === 10) {
    return String.fromCodePoint(0x1f51f);
  }
  return `${n}.`;
}

/** Public app URL for deep links (falls back to current origin). */
export function getAppBaseUrl() {
  const configured = import.meta.env.VITE_APP_URL?.replace(/\/$/, '');
  return configured || window.location.origin;
}

export function getComplaintUrl(complaintId) {
  return `${getAppBaseUrl()}/complaints/${complaintId}`;
}

/** @returns {Array<{ product_id?: string, product_name?: string, batch_number?: string, quantity_affected?: number, unit_of_measurement?: string }>} */
export function getAffectedProducts(complaint) {
  if (complaint?.affected_products?.length) {
    return complaint.affected_products.flatMap((item) => {
      if (item.batch_entries?.length) {
        return item.batch_entries.map((entry) => ({
          product_id: item.product_id,
          product_name: item.product_name,
          batch_number: entry.batch_number,
          quantity_affected: entry.quantity_affected,
          unit_of_measurement: entry.unit_of_measurement,
          unit_of_measurement_id: entry.unit_of_measurement_id,
        }));
      }

      if (item.batch_numbers?.length) {
        return item.batch_numbers.map((batch, index) => ({
          product_id: item.product_id,
          product_name: item.product_name,
          batch_number: batch,
          quantity_affected: index === 0 ? item.quantity_affected : null,
          unit_of_measurement: index === 0 ? item.unit_of_measurement : null,
          unit_of_measurement_id: index === 0 ? item.unit_of_measurement_id : null,
        }));
      }

      return [{
        product_id: item.product_id,
        product_name: item.product_name,
        batch_number: item.batch_number,
        quantity_affected: item.quantity_affected,
        unit_of_measurement: item.unit_of_measurement,
        unit_of_measurement_id: item.unit_of_measurement_id,
      }];
    });
  }

  if (!complaint?.product_name && !complaint?.product_id) {
    return [];
  }

  return [{
    product_name: complaint.product_name,
    batch_number: complaint.batch_number,
    quantity_affected: complaint.quantity_affected,
    unit_of_measurement: complaint.unit_of_measurement,
  }];
}

export function groupAffectedProductsByProduct(lines) {
  const groups = [];
  const indexByKey = new Map();

  lines.forEach((line) => {
    const key = line.product_id || line.product_name || 'unknown';
    if (!indexByKey.has(key)) {
      indexByKey.set(key, groups.length);
      groups.push({
        product_id: line.product_id,
        product_name: line.product_name,
        lines: [],
      });
    }
    groups[indexByKey.get(key)].lines.push(line);
  });

  return groups;
}

function formatBatchQtyUnit(line) {
  const qty = line.quantity_affected;
  const unit = line.unit_of_measurement;
  if (qty == null && !unit) return '';
  if (qty != null && unit) return ` (${qty} ${unit})`;
  if (qty != null) return ` ${qty}`;
  return ` ${unit}`;
}

function formatBatchLine(line) {
  const batch = line.batch_number;
  if (!batch) return null;
  return `   ${EMOJI.bullet} Batch No: ${batch}${formatBatchQtyUnit(line)}`;
}

function formatAffectedProductsSection(complaint) {
  const lines = getAffectedProducts(complaint);
  if (!lines.length) return [];

  const groups = groupAffectedProductsByProduct(lines);
  const output = ['', `${EMOJI.package} Affected Products`];

  groups.forEach((group, index) => {
    const prefix = productNumberEmoji(index);
    const name = group.product_name || 'Unknown product';
    output.push(`${prefix} ${name}`);

    group.lines.forEach((line) => {
      const batchLine = formatBatchLine(line);
      if (batchLine) output.push(batchLine);
    });
  });

  return output;
}

function formatPurchaseDate(value) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * @param {object} complaint
 * @param {{ event?: string, oldStatus?: string, newStatus?: string, note?: string }} [options]
 */
export function buildComplaintShareMessage(complaint, options = {}) {
  const { event = 'updated', oldStatus, newStatus, note } = options;
  const label = EVENT_LABELS[event] ?? EVENT_LABELS.updated;
  const lines = [`${EMOJI.alert} *${label}*`, ''];

  lines.push(`${EMOJI.ticket} Ticket ID: *${complaint.ticket_id}*`);

  if (event === 'status_changed' && oldStatus != null && newStatus != null) {
    lines.push(`${EMOJI.pin} Status: ${oldStatus} ${EMOJI.arrow} ${newStatus}`);
  } else if (complaint.status) {
    lines.push(`${EMOJI.pin} Status: ${complaint.status}`);
  }

  if (complaint.priority) lines.push(`${EMOJI.warning} Priority: ${complaint.priority}`);

  if (complaint.customer_name) {
    lines.push('', `${EMOJI.person} Customer`, complaint.customer_name);
  }

  const hasDetails = complaint.order_source || complaint.tracking_number || complaint.complaint_type || complaint.order_number || complaint.purchase_date;
  if (hasDetails) {
    lines.push('', `${EMOJI.tag} Complaint Details`);
    if (complaint.order_source) lines.push(`${EMOJI.bullet} Source: ${complaint.order_source}`);
    if (complaint.order_number) lines.push(`${EMOJI.bullet} Order No: ${complaint.order_number}`);
    if (complaint.purchase_date) lines.push(`${EMOJI.bullet} Purchase Date: ${formatPurchaseDate(complaint.purchase_date)}`);
    if (complaint.tracking_number) lines.push(`${EMOJI.bullet} Tracking No: ${complaint.tracking_number}`);
    if (complaint.complaint_type) lines.push(`${EMOJI.bullet} Type: ${complaint.complaint_type}`);
  }

  lines.push(...formatAffectedProductsSection(complaint));

  if (complaint.assigned_department) {
    lines.push('', `${EMOJI.building} Department: ${complaint.assigned_department}`);
  }

  const agents = formatAgentNames(complaint);
  if (agents) lines.push(`${EMOJI.briefcase} Assigned To: ${agents}`);

  if (note) lines.push('', note);

  lines.push('', `${EMOJI.link} View Ticket`, getComplaintUrl(complaint.id));

  return lines.join('\n');
}

export function getWhatsappShareUrl(text) {
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
}

export function openWhatsappShare(complaint, options = {}) {
  const text = buildComplaintShareMessage(complaint, options);
  const url = getWhatsappShareUrl(text);
  window.open(url, '_blank', 'noopener,noreferrer');
}

export async function copyComplaintShareMessage(complaint, options = {}) {
  const text = buildComplaintShareMessage(complaint, options);
  await navigator.clipboard.writeText(text);
  return text;
}
