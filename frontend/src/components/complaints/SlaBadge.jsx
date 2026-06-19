import React from 'react';
import { differenceInHours, addHours } from 'date-fns';
import { AlertTriangle, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { DEFAULT_SLA_PAUSED_STATUS_NAMES, isSlaPausedStatus } from '@/lib/slaSettings';
import { SLA_CLOSED_STATUSES } from '@/lib/ticketUtils';
import { useSlaSettings } from '@/lib/useSlaSettings';

export function getResolvedAt(complaint) {
  if (complaint.resolved_at) return new Date(complaint.resolved_at);
  if (complaint.closed_at) return new Date(complaint.closed_at);
  if (SLA_CLOSED_STATUSES.includes(complaint.status) && complaint.updated_date) {
    return new Date(complaint.updated_date);
  }
  return null;
}

export function hasSlaPolicy(complaint) {
  return !!(complaint.priority || complaint.priority_id || complaint.priority_sla_hours || complaint.sla_deadline);
}

export function getEffectiveDeadline(complaint, pausedStatusNames = DEFAULT_SLA_PAUSED_STATUS_NAMES) {
  let deadline;
  if (complaint.sla_deadline) {
    deadline = new Date(complaint.sla_deadline);
  } else {
    const base = complaint.created_date ? new Date(complaint.created_date) : new Date();
    const hours = complaint.priority_sla_hours ?? 24;
    deadline = addHours(base, hours);
  }

  let totalPausedSeconds = complaint.sla_paused_duration || 0;

  if (isSlaPausedStatus(complaint.status, pausedStatusNames) && complaint.sla_paused_at) {
    const pausedSince = new Date(complaint.sla_paused_at);
    const currentPause = Math.floor((new Date() - pausedSince) / 1000);
    totalPausedSeconds += currentPause;
  }

  return new Date(deadline.getTime() + totalPausedSeconds * 1000);
}

export function getSlaStatus(complaint, pausedStatusNames = DEFAULT_SLA_PAUSED_STATUS_NAMES) {
  if (isSlaPausedStatus(complaint.status, pausedStatusNames)) return 'paused';

  const closed = SLA_CLOSED_STATUSES.includes(complaint.status);
  const deadline = getEffectiveDeadline(complaint, pausedStatusNames);
  const now = new Date();
  const hoursLeft = differenceInHours(deadline, now);

  if (closed) {
    const resolvedAt = getResolvedAt(complaint) ?? now;
    return resolvedAt <= deadline ? 'met' : 'breached';
  }
  if (now > deadline) return 'breached';
  if (hoursLeft <= 4) return 'at_risk';
  return 'on_track';
}

const CONFIG = {
  met:      { label: 'SLA Met',     icon: CheckCircle,  className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  breached: { label: 'SLA Breached',icon: AlertCircle,  className: 'bg-red-100 text-red-700 border-red-200' },
  at_risk:  { label: 'At Risk',     icon: AlertTriangle,className: 'bg-amber-100 text-amber-700 border-amber-200' },
  on_track: { label: 'On Track',    icon: Clock,        className: 'bg-blue-100 text-blue-700 border-blue-200' },
  paused:   { label: 'SLA Paused',  icon: Clock,        className: 'bg-orange-100 text-orange-700 border-orange-200' },
};

export default function SlaBadge({ complaint }) {
  const { pausedStatusNames } = useSlaSettings();
  const status = getSlaStatus(complaint, pausedStatusNames);
  if (!status) return null;
  const { label, icon: Icon, className } = CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${className}`}>
      <Icon className="w-2.5 h-2.5" />
      {label}
    </span>
  );
}
