import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { AlertTriangle, CheckCircle2, Clock, TrendingDown } from 'lucide-react';
import { differenceInHours, differenceInMinutes } from 'date-fns';
import {
  getEffectiveDeadline,
  getSlaStatus,
  hasSlaPolicy,
} from '@/components/complaints/SlaBadge';
import { SLA_CLOSED_STATUSES } from '@/lib/ticketUtils';
import { isSlaPausedStatus } from '@/lib/slaSettings';
import { useSlaSettings } from '@/lib/useSlaSettings';

function formatRemaining(complaint, pausedStatusNames) {
  if (isSlaPausedStatus(complaint.status, pausedStatusNames)) return 'Paused';

  const deadline = getEffectiveDeadline(complaint, pausedStatusNames);
  const now = new Date();
  const diffH = differenceInHours(deadline, now);
  if (diffH < 0) return `${Math.abs(diffH)}h overdue`;
  if (diffH < 1) {
    const diffM = differenceInMinutes(deadline, now);
    return `${diffM}m left`;
  }
  return `${diffH}h left`;
}

export default function SlaReport({ complaints }) {
  const { pausedStatusNames } = useSlaSettings();
  const withSla = complaints.filter(hasSlaPolicy);

  const stats = {
    total: withSla.length,
    met: withSla.filter(c => getSlaStatus(c, pausedStatusNames) === 'met').length,
    breached: withSla.filter(c => getSlaStatus(c, pausedStatusNames) === 'breached').length,
    warning: withSla.filter(c => getSlaStatus(c, pausedStatusNames) === 'at_risk').length,
    on_track: withSla.filter(c => getSlaStatus(c, pausedStatusNames) === 'on_track').length,
  };

  const breachByPriority = ['Low', 'Medium', 'High', 'Urgent'].map(p => {
    const total = withSla.filter(c => c.priority === p).length;
    const breached = withSla.filter(c => c.priority === p && getSlaStatus(c, pausedStatusNames) === 'breached').length;
    return { name: p, total, breached };
  });

  const openWithSla = withSla
    .filter(c => !SLA_CLOSED_STATUSES.includes(c.status))
    .map(c => ({
      ...c,
      status_sla: getSlaStatus(c, pausedStatusNames),
      remaining: formatRemaining(c, pausedStatusNames),
    }))
    .sort((a, b) => getEffectiveDeadline(a, pausedStatusNames) - getEffectiveDeadline(b, pausedStatusNames))
    .slice(0, 10);

  const breachRate = stats.total > 0 ? ((stats.breached / stats.total) * 100).toFixed(1) : 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">SLA Met</p>
                <p className="text-2xl font-bold text-emerald-600">{stats.met}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                <AlertTriangle className="w-4 h-4 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">SLA Breached</p>
                <p className="text-2xl font-bold text-red-600">{stats.breached}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">At Risk (&lt;20%)</p>
                <p className="text-2xl font-bold text-amber-600">{stats.warning}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <TrendingDown className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Breach Rate</p>
                <p className="text-2xl font-bold text-primary">{breachRate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Breach by Priority Chart */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">SLA Breach by Priority</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[220px]">
              <ResponsiveContainer>
                <BarChart data={breachByPriority} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="total" name="Total" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="breached" name="Breached" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Open tickets sorted by remaining SLA */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Open Tickets — SLA Urgency</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border max-h-[240px] overflow-y-auto">
              {openWithSla.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">No open tickets with SLA</p>
              )}
              {openWithSla.map(c => {
                const isBreached = c.status_sla === 'breached';
                const isWarning = c.status_sla === 'at_risk';
                const isPaused = c.status_sla === 'paused';
                return (
                  <div key={c.id} className={`flex items-center justify-between px-4 py-2.5 ${isBreached ? 'bg-red-50 dark:bg-red-900/10' : isWarning ? 'bg-amber-50 dark:bg-amber-900/10' : ''}`}>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate">{c.ticket_id || c.id.slice(0, 8)}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{c.customer_name}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <Badge className={`text-[10px] border-0 ${
                        c.priority === 'Urgent' ? 'bg-red-100 text-red-700' :
                        c.priority === 'High' ? 'bg-amber-100 text-amber-700' :
                        c.priority === 'Medium' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                      }`}>{c.priority || '—'}</Badge>
                      <span className={`text-xs font-medium ${isBreached ? 'text-red-600' : isWarning ? 'text-amber-600' : isPaused ? 'text-orange-600' : 'text-emerald-600'}`}>
                        {c.remaining}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
