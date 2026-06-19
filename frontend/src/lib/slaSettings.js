export const SLA_DEFAULT = {
  first_response: 2,
  low: 72,
  medium: 48,
  high: 24,
  urgent: 6,
  stale_alert_hours: 24,
  paused_status_ids: [],
};

export const DEFAULT_SLA_PAUSED_STATUS_NAMES = ['Waiting for Customer', 'Waiting for Vendor'];

export function normalizeSlaSettings(raw = {}, complaintStatuses = []) {
  const merged = {
    ...SLA_DEFAULT,
    ...(raw && typeof raw === 'object' ? raw : {}),
  };

  let pausedStatusIds = Array.isArray(merged.paused_status_ids)
    ? merged.paused_status_ids.map((id) => String(id)).filter(Boolean)
    : [];

  if (pausedStatusIds.length === 0 && complaintStatuses.length > 0) {
    pausedStatusIds = complaintStatuses
      .filter((status) => DEFAULT_SLA_PAUSED_STATUS_NAMES.includes(status.name))
      .map((status) => String(status.id));
  }

  return {
    ...merged,
    paused_status_ids: pausedStatusIds,
  };
}

export function getPausedStatusNames(settings, complaintStatuses = []) {
  const ids = new Set((settings?.paused_status_ids ?? []).map(String));

  if (!ids.size) {
    return [...DEFAULT_SLA_PAUSED_STATUS_NAMES];
  }

  const names = complaintStatuses
    .filter((status) => ids.has(String(status.id)))
    .map((status) => status.name);

  return names.length > 0 ? names : [...DEFAULT_SLA_PAUSED_STATUS_NAMES];
}

export function isSlaPausedStatus(status, pausedStatusNames = DEFAULT_SLA_PAUSED_STATUS_NAMES) {
  if (!status) return false;
  return pausedStatusNames.includes(status);
}

export function togglePausedStatusId(currentIds, statusId) {
  const id = String(statusId);
  const next = new Set((currentIds ?? []).map(String));

  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }

  return [...next];
}
