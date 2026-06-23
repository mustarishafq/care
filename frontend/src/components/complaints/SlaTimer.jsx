import React, { useState, useEffect } from 'react';
import { differenceInSeconds } from 'date-fns';
import { Clock, AlertTriangle, CheckCircle, AlertCircle, PauseCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getEffectiveDeadline, getResolvedAt } from './SlaBadge';
import { isSlaPausedStatus } from '@/lib/slaSettings';
import { useSlaSettings } from '@/lib/useSlaSettings';

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
  const { pausedStatusNames, resolvedStatusNames } = useSlaSettings();
  const [now, setNow] = useState(() => new Date());

  const isClosed = resolvedStatusNames.includes(complaint.status);
  const isPaused = isSlaPausedStatus(complaint.status, pausedStatusNames);

  useEffect(() => {
    if (isClosed || isPaused) return;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [isClosed, isPaused]);

  const deadline = getEffectiveDeadline(complaint, pausedStatusNames);

  if (isPaused) {
    return (
      <Badge className="border-0 text-xs font-medium gap-1.5 bg-orange-100 text-orange-700">
        <PauseCircle className="w-3 h-3" />
        SLA Paused
      </Badge>
    );
  }

  if (isClosed) {
    const resolvedAt = getResolvedAt(complaint, resolvedStatusNames) ?? now;
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

  if (secsLeft <= 0) {
    const overdueSecs = Math.abs(secsLeft);
    return (
      <Badge className="border-0 text-xs font-medium gap-1.5 bg-destructive/15 text-destructive animate-pulse">
        <AlertCircle className="w-3 h-3" />
        Overdue {formatCountdown(overdueSecs)}
      </Badge>
    );
  }

  if (hoursLeft <= 4) {
    return (
      <Badge className="border-0 text-xs font-medium gap-1.5 bg-warning/15 text-warning">
        <AlertTriangle className="w-3 h-3" />
        {formatCountdown(secsLeft)} left
      </Badge>
    );
  }

  return (
    <Badge className="border-0 text-xs font-medium gap-1.5 bg-primary/15 text-primary">
      <Clock className="w-3 h-3" />
      {formatCountdown(secsLeft)} left
    </Badge>
  );
}
