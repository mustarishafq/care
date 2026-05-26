import React from 'react';
import { differenceInHours, addHours } from 'date-fns';
import { AlertTriangle, CheckCircle, Clock, AlertCircle } from 'lucide-react';

export function getEffectiveDeadline(complaint) {
  // Base deadline
  let deadline;
  if (complaint.sla_deadline) {
    deadline = new Date(complaint.sla_deadline);
  } else {
    const base = complaint.created_date ? new Date(complaint.created_date) : new Date();
    const hours = complaint.priority_sla_hours ?? 24;
    deadline = addHours(base, hours);
  }

  // Add accumulated paused seconds
  let totalPausedSeconds = complaint.sla_paused_duration || 0;

  // If currently paused, also add the current ongoing pause duration
  if (complaint.status === 'Waiting for Customer' && complaint.sla_paused_at) {
    const pausedSince = new Date(complaint.sla_paused_at);
    const currentPause = Math.floor((new Date() - pausedSince) / 1000);
    totalPausedSeconds += currentPause;
  }

  // Extend deadline by total paused time
  return new Date(deadline.getTime() + totalPausedSeconds * 1000);
}

export function getSlaStatus(complaint) {
  if (complaint.status === 'Waiting for Customer') return 'paused';

  const closed = ['Delivered', 'Closed', 'Rejected'].includes(complaint.status);
  const deadline = getEffectiveDeadline(complaint);
  const now = new Date();
  const hoursLeft = differenceInHours(deadline, now);

  if (closed) {
    const resolvedAt = complaint.resolved_at ? new Date(complaint.resolved_at) : now;
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
  const status = getSlaStatus(complaint);
  if (!status) return null;
  const { label, icon: Icon, className } = CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${className}`}>
      <Icon className="w-2.5 h-2.5" />
      {label}
    </span>
  );
}