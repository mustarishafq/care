import { db } from '@/api/db';

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid
} from 'recharts';
import { buildStatusOrder } from '@/lib/ticketUtils';
import { useComplaintStatuses } from '@/lib/useLookups';
import { useComplaintTypes, useCouriers, usePriorities } from '@/lib/useLookups';
import { subDays, startOfDay, endOfDay, isAfter, isBefore } from 'date-fns';
import SlaReport from '@/components/reports/SlaReport';
import CasesOverTimeChart from '@/components/reports/CasesOverTimeChart';
import ResolvedUnresolvedChart from '@/components/reports/ResolvedUnresolvedChart';
import TopInsightsCards from '@/components/reports/TopInsightsCards';
import ResolutionTimeChart from '@/components/reports/ResolutionTimeChart';
import { useDepartments } from '@/lib/useDepartments';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { filterVisibleComplaints } from '@/lib/complaintVisibility';
import { CalendarDays, BarChart3 } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';

const CHART_COLORS = ['#0ea5e9', '#22c55e', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#64748b', '#14b8a6'];

function getRangeDates(range, customFrom, customTo) {
  const now = new Date();
  if (range === 'today') return { from: startOfDay(now), to: endOfDay(now) };
  if (range === 'custom') {
    return {
      from: customFrom ? startOfDay(new Date(customFrom)) : startOfDay(subDays(now, 30)),
      to: customTo ? endOfDay(new Date(customTo)) : endOfDay(now),
    };
  }
  return { from: startOfDay(subDays(now, parseInt(range))), to: endOfDay(now) };
}

export default function Reports() {
  const [range, setRange] = useState('30');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const { user } = useCurrentUser();

  const { data: complaints = [], isLoading } = useQuery({
    queryKey: ['complaints'],
    queryFn: () => db.entities.Complaint.list('-created_date', 1000),
  });

  const visibleComplaints = useMemo(
    () => filterVisibleComplaints(user, complaints),
    [user, complaints],
  );

  const { data: departments = [] } = useDepartments();
  const { data: complaintTypes = [] } = useComplaintTypes();
  const { data: couriers = [] } = useCouriers();
  const { data: priorities = [] } = usePriorities();
  const { data: complaintStatuses = [] } = useComplaintStatuses();
  const statusOrder = useMemo(() => {
    const inUseStatuses = [...new Set(visibleComplaints.map((c) => c.status).filter(Boolean))];
    return buildStatusOrder(complaintStatuses, { includeNames: inUseStatuses });
  }, [complaintStatuses, visibleComplaints]);

  const { from, to } = useMemo(() => getRangeDates(range, customFrom, customTo), [range, customFrom, customTo]);

  const filtered = useMemo(() =>
    visibleComplaints.filter(c => {
      const d = new Date(c.created_date);
      return !isBefore(d, from) && !isAfter(d, to);
    }),
    [visibleComplaints, from, to]
  );

  // By Status
  const byStatus = statusOrder.map(s => ({
    name: s.length > 15 ? s.slice(0, 15) + '…' : s,
    count: filtered.filter(c => c.status === s).length,
  }));

  // By Type
  const byType = complaintTypes.map(t => ({
    name: t.name,
    count: filtered.filter(c => c.complaint_type_id === t.id).length,
  })).filter(d => d.count > 0);

  const byPriority = priorities.map(p => ({
    name: p.name,
    count: filtered.filter(c => c.priority_id === p.id).length,
  }));

  // By Department
  const byDept = departments.map(d => ({
    name: d.name,
    count: filtered.filter(c => c.assigned_department_id === d.id).length,
  }));

  // By Courier
  const byCourier = couriers.map(c => ({
    name: c.name,
    count: filtered.filter(item => item.courier_id === c.id).length,
  })).filter(d => d.count > 0).sort((a, b) => b.count - a.count).slice(0, 8);

  const rangeLabel = range === 'today'
    ? 'Today'
    : range === 'custom'
      ? `${customFrom || '—'} → ${customTo || '—'}`
      : `Last ${range} days`;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header + Filters */}
      <PageHeader
        icon={BarChart3}
        title="Reports & Analytics"
        description={`${filtered.length} complaints · ${rangeLabel}`}
      />

      <div className="flex flex-wrap items-center gap-2">
          <Select value={range} onValueChange={v => setRange(v)}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
              <SelectItem value="custom">Custom range…</SelectItem>
            </SelectContent>
          </Select>

          {range === 'custom' && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-muted/50 border rounded-lg px-3 py-1.5">
                <CalendarDays className="w-4 h-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={customFrom}
                  onChange={e => setCustomFrom(e.target.value)}
                  className="border-0 bg-transparent p-0 h-auto text-sm w-[130px] focus-visible:ring-0"
                />
              </div>
              <span className="text-muted-foreground text-sm">to</span>
              <div className="flex items-center gap-1 bg-muted/50 border rounded-lg px-3 py-1.5">
                <CalendarDays className="w-4 h-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={customTo}
                  onChange={e => setCustomTo(e.target.value)}
                  className="border-0 bg-transparent p-0 h-auto text-sm w-[130px] focus-visible:ring-0"
                />
              </div>
            </div>
          )}
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="mb-2">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="breakdown">Breakdown</TabsTrigger>
          <TabsTrigger value="performance">SLA & Performance</TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Overview ── */}
        <TabsContent value="overview" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CasesOverTimeChart complaints={filtered} dateFrom={from} dateTo={to} />
            <ResolvedUnresolvedChart complaints={filtered} />
          </div>
          <TopInsightsCards complaints={filtered} />
        </TabsContent>

        {/* ── Tab 2: Breakdown ── */}
        <TabsContent value="breakdown" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* By Status */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">By Status</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[340px]">
                  <ResponsiveContainer>
                    <BarChart data={byStatus} layout="vertical" margin={{ left: 10, right: 16, top: 4, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={140} />
                      <Tooltip />
                      <Bar dataKey="count" fill="hsl(199, 89%, 48%)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* By Type Pie */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">By Complaint Type</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[220px]">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={byType} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={2} dataKey="count" label={false}>
                        {byType.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v, name) => [v, name]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
                  {byType.map((item, i) => {
                    const total = byType.reduce((s, d) => s + d.count, 0);
                    const pct = total > 0 ? ((item.count / total) * 100).toFixed(0) : 0;
                    return (
                      <div key={item.name} className="flex items-center gap-1.5 text-xs">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                        <span className="text-muted-foreground">{item.name}</span>
                        <span className="font-semibold">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* By Priority */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">By Priority</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <ResponsiveContainer>
                    <BarChart data={byPriority}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {byPriority.map((_, i) => <Cell key={i} fill={['#64748b', '#0ea5e9', '#f59e0b', '#ef4444'][i]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* By Department */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">By Department</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <ResponsiveContainer>
                    <BarChart data={byDept}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="hsl(262, 83%, 58%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* By Courier */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2"><CardTitle className="text-base">By Courier</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <ResponsiveContainer>
                    <BarChart data={byCourier}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Tab 3: SLA & Performance ── */}
        <TabsContent value="performance" className="space-y-8 mt-4">
          <div>
            <h2 className="text-lg font-semibold mb-4">Resolution Time</h2>
            <ResolutionTimeChart complaints={filtered} />
          </div>
          <div>
            <h2 className="text-lg font-semibold mb-4">SLA Performance</h2>
            <SlaReport complaints={filtered} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}