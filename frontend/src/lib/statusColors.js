export const DEFAULT_STATUS_COLOR = '#6b7280';

export const STATUS_COLOR_PRESETS = [
  '#3b82f6',
  '#f59e0b',
  '#f97316',
  '#eab308',
  '#10b981',
  '#ef4444',
  '#a855f7',
  '#06b6d4',
  '#6366f1',
  '#14b8a6',
  '#6b7280',
  '#64748b',
];

export const LEGACY_STATUS_COLOR_HEX = {
  'New Complaint': '#3b82f6',
  'Under Review': '#f59e0b',
  'Waiting for Customer': '#f97316',
  'Waiting for Vendor': '#eab308',
  'Approved Replacement': '#10b981',
  'Rejected': '#ef4444',
  'Reprocessing by Fulfillment': '#a855f7',
  'Ready to Ship': '#06b6d4',
  'Shipped': '#6366f1',
  'Delivered': '#14b8a6',
  'Closed': '#6b7280',
  'Drop': '#64748b',
};

export function normalizeHexColor(color) {
  if (typeof color !== 'string') return null;
  const trimmed = color.trim();
  return /^#[0-9A-Fa-f]{6}$/.test(trimmed) ? trimmed : null;
}

export function resolveStatusHex(statusName, statuses = []) {
  const row = statuses.find((status) => status.name === statusName);
  const configured = normalizeHexColor(row?.color);
  if (configured) return configured;
  return LEGACY_STATUS_COLOR_HEX[statusName] ?? DEFAULT_STATUS_COLOR;
}

export function hexToRgb(hex) {
  const normalized = normalizeHexColor(hex) ?? DEFAULT_STATUS_COLOR;
  const value = normalized.slice(1);
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

export function getStatusColorStyles(statusName, statuses = []) {
  const hex = resolveStatusHex(statusName, statuses);
  return getStatusColorStylesFromHex(hex);
}

export function getStatusColorStylesFromHex(hex) {
  const normalized = normalizeHexColor(hex) ?? DEFAULT_STATUS_COLOR;
  const { r, g, b } = hexToRgb(normalized);

  return {
    hex: normalized,
    badge: {
      backgroundColor: `rgba(${r}, ${g}, ${b}, 0.15)`,
      color: normalized,
    },
    dot: {
      backgroundColor: normalized,
    },
  };
}

export function defaultColorForIndex(index) {
  return STATUS_COLOR_PRESETS[index % STATUS_COLOR_PRESETS.length] ?? DEFAULT_STATUS_COLOR;
}
