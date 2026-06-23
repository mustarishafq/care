export const AUTO_CLOSE_DEFAULT = {
  enabled: false,
  delay_amount: 1,
  delay_unit: 'days',
  trigger_status_id: '',
  target_status_id: '',
};

export const DEFAULT_AUTO_CLOSE_TRIGGER_STATUS_NAME = 'Delivered';
export const DEFAULT_AUTO_CLOSE_TARGET_STATUS_NAME = 'Closed';

export function normalizeAutoCloseSettings(raw = {}, complaintStatuses = []) {
  const merged = {
    ...AUTO_CLOSE_DEFAULT,
    ...(raw && typeof raw === 'object' ? raw : {}),
  };

  let triggerStatusId = merged.trigger_status_id ? String(merged.trigger_status_id) : '';
  let targetStatusId = merged.target_status_id ? String(merged.target_status_id) : '';

  if (!triggerStatusId && complaintStatuses.length > 0) {
    const trigger = complaintStatuses.find((s) => s.name === DEFAULT_AUTO_CLOSE_TRIGGER_STATUS_NAME);
    triggerStatusId = trigger ? String(trigger.id) : '';
  }

  if (!targetStatusId && complaintStatuses.length > 0) {
    const target = complaintStatuses.find((s) => s.name === DEFAULT_AUTO_CLOSE_TARGET_STATUS_NAME);
    targetStatusId = target ? String(target.id) : '';
  }

  return {
    ...merged,
    delay_amount: Math.max(1, Number(merged.delay_amount) || 1),
    delay_unit: merged.delay_unit === 'hours' ? 'hours' : 'days',
    trigger_status_id: triggerStatusId,
    target_status_id: targetStatusId,
  };
}

export function getAutoCloseStatusName(settings, complaintStatuses, field, fallbackName) {
  const id = settings?.[field];
  if (id) {
    const match = complaintStatuses.find((status) => String(status.id) === String(id));
    if (match) return match.name;
  }
  return fallbackName;
}

export function getAutoCloseTriggerStatusName(settings, complaintStatuses = []) {
  return getAutoCloseStatusName(
    settings,
    complaintStatuses,
    'trigger_status_id',
    DEFAULT_AUTO_CLOSE_TRIGGER_STATUS_NAME,
  );
}

export function getAutoCloseTargetStatusName(settings, complaintStatuses = []) {
  return getAutoCloseStatusName(
    settings,
    complaintStatuses,
    'target_status_id',
    DEFAULT_AUTO_CLOSE_TARGET_STATUS_NAME,
  );
}

export function formatAutoCloseDelay({ delay_amount, delay_unit }) {
  const unit = delay_unit === 'hours'
    ? (delay_amount === 1 ? 'hour' : 'hours')
    : (delay_amount === 1 ? 'day' : 'days');
  return `${delay_amount} ${unit}`;
}
