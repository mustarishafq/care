import React, { useMemo, useState } from 'react';
import { getAssignedAgents } from '@/lib/assignedAgents';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { differenceInHours } from 'date-fns';

const COLORS = ['#0ea5e9', '#8b5cf6', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#64748b'];

const RESOLVED_STATUSES = ['Delivered', 'Closed'];

function getResolvedAt(c) {
  // Use explicit resolved_at, else fall back to closed_at, else updated_date for terminal statuses
  if (c.resolved_at) return c.resolved_at;
  if (c.closed_at) return c.closed_at;
  if (RESOLVED_STATUSES.includes(c.status)) return c.updated_date;
  return null;
}

function avgHours(list) {
  const resolved = list.filter(c => c.created_date && getResolvedAt(c));
  if (!resolved.length) return null;
  const total = resolved.reduce((sum, c) => sum + Math.max(0, differenceInHours(new Date(getResolvedAt(c)), new Date(c.created_date))), 0);
  return Math.round(total / resolved.length);
}

function formatHours(h) {
  if (h === null || h === undefined) return '—';
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  const hrs = h % 24;
  return hrs > 0 ? `${days}d ${hrs}h` : `${days}d`;
}

function groupBy(complaints, keyFn, labelFn) {
  const map = {};
  complaints.forEach(c => {
    const key = keyFn(c);
    if (!key) return;
    if (!map[key]) map[key] = { label: labelFn ? labelFn(c) : key, items: [] };
    map[key].items.push(c);
  });
  return Object.values(map)
    .map(({ label, items }) => ({ name: label.length > 22 ? label.slice(0, 22) + '…' : label, avgHours: avgHours(items) ?? 0, count: items.filter(c => getResolvedAt(c)).length }))
    .filter(d => d.avgHours > 0)
    .sort((a, b) => b.avgHours - a.avgHours);
}

function ResolutionBarChart({ data, color }) {
  if (!data.length) return <p className="text-sm text-muted-foreground text-center py-8">No resolved tickets with this grouping in the selected period.</p>;
  return (
    <div className="h-[280px]">
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 32, top: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} tickFormatter={v => `${v}h`} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={160} />
          <Tooltip formatter={(v, _, props) => [`${formatHours(v)} (${props.payload.count} resolved)`, 'Avg resolution']} />
          <Bar dataKey="avgHours" radius={[0, 4, 4, 0]}>
            {data.map((_, i) => <Cell key={i} fill={color || COLORS[i % COLORS.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function ResolutionTimeChart({ complaints }) {
  const [view, setView] = useState('type'); // 'type' | 'department' | 'agent'

  const resolved = complaints.filter(c => getResolvedAt(c)).length;
  const overall = useMemo(() => avgHours(complaints), [complaints]);

  const byType = useMemo(() => groupBy(complaints, c => c.complaint_type, c => c.complaint_type), [complaints]);
  const byDept = useMemo(() => groupBy(complaints, c => c.assigned_department, c => c.assigned_department), [complaints]);
  const byAgent = useMemo(() => {
    const map = {};
    complaints.forEach((c) => {
      const agents = getAssignedAgents(c);
      if (!agents.length) return;
      agents.forEach((agent) => {
        const key = agent.id;
        if (!map[key]) {
          map[key] = { label: agent.full_name || agent.email || 'Unassigned', items: [] };
        }
        map[key].items.push(c);
      });
    });
    return Object.values(map)
      .map(({ label, items }) => ({
        name: label.length > 22 ? label.slice(0, 22) + '…' : label,
        avgHours: avgHours(items) ?? 0,
        count: items.filter((item) => getResolvedAt(item)).length,
      }))
      .filter((d) => d.avgHours > 0)
      .sort((a, b) => b.avgHours - a.avgHours);
  }, [complaints]);

  const fastest = (data) => data.length ? data[data.length - 1] : null;
  const slowest = (data) => data.length ? data[0] : null;

  const activeData = view === 'type' ? byType : view === 'department' ? byDept : byAgent;
  const activeColor = view === 'type' ? '#0ea5e9' : view === 'department' ? '#8b5cf6' : '#22c55e';

  return (
    <div className="space-y-4">
      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase font-medium">Avg Resolution Time</p>
            <p className="text-2xl font-bold mt-1 text-primary">{formatHours(overall)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">across {resolved} resolved tickets</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase font-medium">Fastest</p>
            <p className="text-base font-bold mt-1 truncate">{fastest(activeData)?.name || '—'}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{fastest(activeData) ? formatHours(fastest(activeData).avgHours) : ''}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase font-medium">Slowest</p>
            <p className="text-base font-bold mt-1 truncate">{slowest(activeData)?.name || '—'}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{slowest(activeData) ? formatHours(slowest(activeData).avgHours) : ''}</p>
          </CardContent>
        </Card>
      </div>

      {/* Chart card with toggle */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-base">Avg Resolution Time</CardTitle>
            <div className="flex rounded-lg border overflow-hidden text-xs">
              {[['type', 'By Type'], ['department', 'By Department'], ['agent', 'By Agent']].map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setView(val)}
                  className={`px-3 py-1.5 transition-colors ${view === val ? 'bg-primary text-primary-foreground font-medium' : 'hover:bg-muted text-muted-foreground'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ResolutionBarChart data={activeData} color={activeColor} />
        </CardContent>
      </Card>

      {resolved === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            No resolved tickets in this period yet — data will appear once tickets are marked as Delivered or Closed.
          </CardContent>
        </Card>
      )}
    </div>
  );
}