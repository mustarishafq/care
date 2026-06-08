import React, { useState, useEffect } from 'react';
import { differenceInSeconds } from 'date-fns';
import { Clock, AlertTriangle, CheckCircle, AlertCircle, PauseCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getEffectiveDeadline, getResolvedAt } from './SlaBadge';

function formatCountdown(totalSeconds) {
  if (totalSeconds <= 0) return null;
  const d = Math.floor(totalSeconds / 86400);
  const h = Math.floor((totalSeconds % 86400) / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

export default function SlaTimer({ complaint }) {
  const [now, setNow] = useState(() => new Date());

  const isClosed = ['Delivered', 'Closed', 'Rejected'].includes(complaint.status);
  const isPaused = complaint.status === 'Waiting for Customer';

  useEffect(() => {
    if (isClosed || isPaused) return;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [isClosed, isPaused]);

  const deadline = getEffectiveDeadline(complaint);

  // Paused — SLA clock is stopped
  if (isPaused) {
    return (
      <Badge className="border-0 text-xs font-medium gap-1.5 bg-orange-100 text-orange-700">
        <PauseCircle className="w-3 h-3" />
        SLA Paused
      </Badge>
    );
  }

  // Closed tickets — show static met/breached
  if (isClosed) {
    const resolvedAt = getResolvedAt(complaint) ?? now;
    const met = resolvedAt <= deadline;
    return (
      <Badge className={`border-0 text-xs font-medium gap-1.5 ${met ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'}`}>
        {met ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
        {met ? 'SLA Met' : 'SLA Breached'}
      </Badge>
    );
  }

  const secsLeft = differenceInSeconds(deadline, now);
  const hoursLeft = secsLeft / 3600;

  // Breached
  if (secsLeft <= 0) {
    const overdueSecs = Math.abs(secsLeft);
    return (
      <Badge className="border-0 text-xs font-medium gap-1.5 bg-destructive/15 text-destructive animate-pulse">
        <AlertCircle className="w-3 h-3" />
        Overdue {formatCountdown(overdueSecs)}
      </Badge>
    );
  }

  // At risk (≤ 4h)
  if (hoursLeft <= 4) {
    return (
      <Badge className="border-0 text-xs font-medium gap-1.5 bg-warning/15 text-warning">
        <AlertTriangle className="w-3 h-3" />
        {formatCountdown(secsLeft)} left
      </Badge>
    );
  }

  // On track
  return (
    <Badge className="border-0 text-xs font-medium gap-1.5 bg-primary/15 text-primary">
      <Clock className="w-3 h-3" />
      {formatCountdown(secsLeft)} left
    </Badge>
  );
}