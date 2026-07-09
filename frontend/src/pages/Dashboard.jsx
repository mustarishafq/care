import { db } from '@/api/db';

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import {
  LayoutDashboard, FileText, AlertCircle, CheckCircle2, Clock,
  Package, Truck, Timer, TrendingUp, UserCheck
} from 'lucide-react';
import { isToday, isThisMonth, differenceInHours } from 'date-fns';
import { useSlaSettings } from '@/lib/useSlaSettings';
import StatCard from '@/components/dashboard/StatCard';
import ComplaintTrendChart from '@/components/dashboard/ComplaintTrendChart';
import RecentActivity from '@/components/dashboard/RecentActivity';
import TopIssuesCard from '@/components/dashboard/TopIssuesCard';
import AssignAgentDialog from '@/components/complaints/AssignAgentDialog';
import PageHeader from '@/components/layout/PageHeader';
import AnimatedSection from '@/components/layout/AnimatedSection';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import StatusBadge from '@/components/complaints/StatusBadge';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { filterVisibleComplaints, filterVisibleActivities } from '@/lib/complaintVisibility';
import { hasAssignedAgents } from '@/lib/assignedAgents';
import { buildComplaintsUrl } from '@/lib/complaintFilterParams';

export default function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [assignTarget, setAssignTarget] = useState(null);
  const { user } = useCurrentUser();

  const goToComplaints = (filters) => navigate(buildComplaintsUrl(filters));

  const { data: complaints = [], isLoading } = useQuery({
    queryKey: ['complaints'],
    queryFn: () => db.entities.Complaint.list('-created_date', 500),
  });

  const visibleComplaints = useMemo(
    () => filterVisibleComplaints(user, complaints),
    [user, complaints],
  );

  const { data: activities = [] } = useQuery({
    queryKey: ['activities-recent'],
    queryFn: () => db.entities.TicketActivity.list('-created_date', 50),
  });

  const visibleActivities = useMemo(
    () => filterVisibleActivities(user, activities, complaints).slice(0, 20),
    [user, activities, complaints],
  );

  const { resolvedStatusNames } = useSlaSettings();

  const todayCount = visibleComplaints.filter(c => isToday(new Date(c.created_date))).length;
  const monthCount = visibleComplaints.filter(c => isThisMonth(new Date(c.created_date))).length;
  const openCount = visibleComplaints.filter(c => !resolvedStatusNames.includes(c.status)).length;
  const closedCount = visibleComplaints.filter(c => c.status === 'Closed').length;
  const pendingFulfillment = visibleComplaints.filter(c => ['Approved Replacement', 'Reprocessing by Fulfillment'].includes(c.status)).length;
  const pendingLogistics = visibleComplaints.filter(c => c.status === 'Ready to Ship').length;

  const resolved = visibleComplaints.filter(c => c.resolved_at);
  const avgResolution = resolved.length
    ? Math.round(resolved.reduce((sum, c) => sum + differenceInHours(new Date(c.resolved_at), new Date(c.created_date)), 0) / resolved.length)
    : 0;

  // Top complaint types
  const typeMap = {};
  visibleComplaints.forEach(c => {
    if (!c.complaint_type) return;
    const existing = typeMap[c.complaint_type];
    if (existing) {
      existing.count += 1;
    } else {
      typeMap[c.complaint_type] = { name: c.complaint_type, count: 1, typeId: c.complaint_type_id };
    }
  });
  const topTypes = Object.values(typeMap).sort((a, b) => b.count - a.count);

  // Top products
  const prodMap = {};
  visibleComplaints.forEach(c => { if (c.product_name) prodMap[c.product_name] = (prodMap[c.product_name] || 0) + 1; });
  const topProducts = Object.entries(prodMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

  // Top couriers
  const courMap = {};
  visibleComplaints.forEach(c => {
    if (!c.courier_name) return;
    const existing = courMap[c.courier_name];
    if (existing) {
      existing.count += 1;
    } else {
      courMap[c.courier_name] = { name: c.courier_name, count: 1, courierId: c.courier_id };
    }
  });
  const topCouriers = Object.values(courMap).sort((a, b) => b.count - a.count);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={LayoutDashboard}
        title="Dashboard"
        description="Overview of complaint management performance"
      />

      <AnimatedSection delay={0.05}>
      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Today's Complaints" value={todayCount} icon={FileText} color="blue" index={0} onClick={() => goToComplaints({ preset: 'today' })} />
        <StatCard label="This Month" value={monthCount} icon={TrendingUp} color="purple" index={1} onClick={() => goToComplaints({ preset: 'month' })} />
        <StatCard label="Open Tickets" value={openCount} icon={AlertCircle} color="warning" index={2} onClick={() => goToComplaints({ preset: 'open' })} />
        <StatCard label="Closed" value={closedCount} icon={CheckCircle2} color="success" index={3} onClick={() => goToComplaints({ status: 'Closed' })} />
        <StatCard label="Pending Fulfillment" value={pendingFulfillment} icon={Package} color="purple" index={4} onClick={() => goToComplaints({ preset: 'pending-fulfillment' })} />
        <StatCard label="Pending Courier" value={pendingLogistics} icon={Truck} color="blue" index={5} onClick={() => goToComplaints({ status: 'Ready to Ship' })} />
        <StatCard label="Avg Resolution (hrs)" value={avgResolution} icon={Timer} color="primary" index={6} />
        <StatCard label="Total Complaints" value={visibleComplaints.length} icon={Clock} color="danger" index={7} onClick={() => goToComplaints()} />
      </div>
      </AnimatedSection>

      {/* Charts Row — on lg+: trend chart (2 cols) + recent activity (1 col); on mobile recent activity moves to bottom */}
      <AnimatedSection delay={0.2} className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ComplaintTrendChart complaints={visibleComplaints} />
        <div className="hidden lg:block">
          <RecentActivity activities={visibleActivities} />
        </div>
      </AnimatedSection>

      {/* Bottom Row */}
      <AnimatedSection delay={0.25} className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <TopIssuesCard
          title="Top Complaint Types"
          data={topTypes}
          onItemClick={(item) => item.typeId && goToComplaints({ type: item.typeId })}
        />
        <TopIssuesCard
          title="Most Problematic Products"
          data={topProducts}
          onItemClick={(item) => goToComplaints({ search: item.name })}
        />
        <TopIssuesCard
          title="Most Problematic Couriers"
          data={topCouriers}
          onItemClick={(item) => item.courierId && goToComplaints({ courier: item.courierId })}
        />
      </AnimatedSection>

      {/* Recent Activity — visible only on mobile/tablet, hidden on lg+ */}
      <AnimatedSection delay={0.3} className="lg:hidden">
        <RecentActivity activities={visibleActivities} />
      </AnimatedSection>

      {/* Unassigned Tickets — Quick Reassign */}
      <AnimatedSection delay={0.35}>
      <UnassignedTickets
        complaints={visibleComplaints}
        onAssign={c => setAssignTarget(c)}
      />
      </AnimatedSection>

      {assignTarget && (
        <AssignAgentDialog
          complaint={assignTarget}
          open={!!assignTarget}
          onClose={() => setAssignTarget(null)}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ['complaints'] })}
        />
      )}
    </div>
  );
}

function UnassignedTickets({ complaints, onAssign }) {
  const unassigned = complaints
    .filter(c => !hasAssignedAgents(c) && !resolvedStatusNames.includes(c.status))
    .slice(0, 10);

  if (!unassigned.length) return null;

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-amber-500" />
          Unassigned Tickets
          <Badge variant="secondary" className="ml-1">{unassigned.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="divide-y">
          {unassigned.map(c => (
            <div key={c.id} className="flex items-center justify-between py-2.5 gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-semibold text-primary">{c.ticket_id}</span>
                  <StatusBadge status={c.status} />
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{c.customer_name} — {c.product_name}</p>
              </div>
              <Button size="sm" variant="outline" className="shrink-0" onClick={() => onAssign(c)}>
                <UserCheck className="w-3.5 h-3.5 mr-1" /> Assign
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}