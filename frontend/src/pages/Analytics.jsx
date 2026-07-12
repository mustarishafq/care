import { db } from '@/api/db';

import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  LineChart, CalendarDays, BarChart3, ExternalLink,
} from 'lucide-react';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/layout/PageHeader';
import PageContent from '@/components/layout/PageContent';
import AnimatedSection from '@/components/layout/AnimatedSection';
import SectionLabel from '@/components/dashboard/SectionLabel';
import TopIssuesCard from '@/components/dashboard/TopIssuesCard';
import AnalyticsKpiStrip from '@/components/analytics/AnalyticsKpiStrip';
import VolumeTrendChart from '@/components/analytics/VolumeTrendChart';
import ReviewRatingChart from '@/components/analytics/ReviewRatingChart';
import AgentPerformanceCard from '@/components/analytics/AgentPerformanceCard';
import ResolvedUnresolvedChart from '@/components/reports/ResolvedUnresolvedChart';
import SlaReport from '@/components/reports/SlaReport';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { usePermissions } from '@/lib/usePermissions';
import { useSlaSettings } from '@/lib/useSlaSettings';
import { filterVisibleComplaints } from '@/lib/complaintVisibility';
import { buildComplaintsUrl } from '@/lib/complaintFilterParams';
import {
  getRangeDates,
  filterByCreatedRange,
  computeComplaintKpis,
  computeReviewKpis,
  buildVolumeTrend,
  topRanked,
  agentWorkload,
  averageRatingFromDistribution,
} from '@/lib/analyticsKpis';

async function fetchRatingDistribution(params) {
  const stars = [1, 2, 3, 4, 5];
  const results = await Promise.all(
    stars.map((star) => db.integrations.Marketplace.listReviews({
      ...params,
      page: 1,
      per_page: 1,
      min_rating: star,
      max_rating: star,
    })),
  );

  const distribution = {};
  stars.forEach((star, i) => {
    distribution[star] = results[i]?.stats?.total ?? results[i]?.meta?.total ?? 0;
  });
  return distribution;
}

export default function Analytics() {
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const { hasPermission } = usePermissions();
  const canViewReviews = hasPermission('reviews.view');
  const { resolvedStatusNames, pausedStatusNames } = useSlaSettings();

  const [range, setRange] = useState('30');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const { from, to } = useMemo(
    () => getRangeDates(range, customFrom, customTo),
    [range, customFrom, customTo],
  );

  const dateParams = useMemo(() => ({
    start_date: format(from, 'yyyy-MM-dd'),
    end_date: format(to, 'yyyy-MM-dd'),
  }), [from, to]);

  const { data: complaints = [], isLoading } = useQuery({
    queryKey: ['complaints'],
    queryFn: () => db.entities.Complaint.list('-created_date', 1000),
  });

  const visibleComplaints = useMemo(
    () => filterVisibleComplaints(user, complaints),
    [user, complaints],
  );

  const filtered = useMemo(
    () => filterByCreatedRange(visibleComplaints, from, to),
    [visibleComplaints, from, to],
  );

  const { data: reviewStatsResponse, isLoading: loadingReviewStats } = useQuery({
    queryKey: ['analytics-review-stats', dateParams],
    queryFn: () => db.integrations.Marketplace.listReviews({
      page: 1,
      per_page: 1,
      ...dateParams,
    }),
    enabled: canViewReviews,
  });

  const { data: ratingDistribution = {}, isLoading: loadingDistribution } = useQuery({
    queryKey: ['analytics-rating-distribution', dateParams],
    queryFn: () => fetchRatingDistribution(dateParams),
    enabled: canViewReviews,
  });

  const complaintKpis = useMemo(
    () => computeComplaintKpis(filtered, { resolvedStatusNames, pausedStatusNames }),
    [filtered, resolvedStatusNames, pausedStatusNames],
  );

  const reviewKpis = useMemo(
    () => computeReviewKpis(reviewStatsResponse?.stats),
    [reviewStatsResponse],
  );

  const avgRating = useMemo(
    () => averageRatingFromDistribution(ratingDistribution),
    [ratingDistribution],
  );

  const volumeTrend = useMemo(
    () => buildVolumeTrend(filtered, from, to, resolvedStatusNames),
    [filtered, from, to, resolvedStatusNames],
  );

  const topTypes = useMemo(
    () => topRanked(filtered, (c) => c.complaint_type),
    [filtered],
  );
  const topProducts = useMemo(
    () => topRanked(filtered, (c) => c.product_name),
    [filtered],
  );
  const topCouriers = useMemo(
    () => topRanked(filtered, (c) => c.courier_name),
    [filtered],
  );

  const agents = useMemo(
    () => agentWorkload(filtered, resolvedStatusNames),
    [filtered, resolvedStatusNames],
  );

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
      <PageHeader
        icon={LineChart}
        title="Analytics"
        description={`Management review · ${filtered.length} complaints · ${rangeLabel}`}
        actions={(
          <Button variant="outline" size="sm" onClick={() => navigate('/reports')}>
            <BarChart3 className="w-4 h-4 mr-2" />
            Detailed reports
            <ExternalLink className="w-3.5 h-3.5 ml-2 opacity-60" />
          </Button>
        )}
      />

      <PageContent className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={range} onValueChange={setRange}>
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
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 bg-muted/50 border rounded-lg px-3 py-1.5">
                <CalendarDays className="w-4 h-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="border-0 bg-transparent p-0 h-auto text-sm w-[130px] focus-visible:ring-0"
                />
              </div>
              <span className="text-muted-foreground text-sm">to</span>
              <div className="flex items-center gap-1 bg-muted/50 border rounded-lg px-3 py-1.5">
                <CalendarDays className="w-4 h-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="border-0 bg-transparent p-0 h-auto text-sm w-[130px] focus-visible:ring-0"
                />
              </div>
            </div>
          )}
        </div>

        <AnimatedSection delay={0.05}>
          <AnalyticsKpiStrip
            complaintKpis={complaintKpis}
            reviewKpis={reviewKpis}
            avgRating={loadingDistribution || loadingReviewStats ? null : avgRating}
            showReviews={canViewReviews}
            onComplaintClick={() => navigate(buildComplaintsUrl())}
            onReviewClick={() => navigate('/marketplace-reviews')}
          />
        </AnimatedSection>

        <AnimatedSection delay={0.1} className="space-y-3">
          <SectionLabel
            title="Operations"
            description="Intake vs resolution and case outcomes"
          />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <VolumeTrendChart data={volumeTrend} title="Created vs Resolved" />
            </div>
            <ResolvedUnresolvedChart complaints={filtered} />
          </div>
        </AnimatedSection>

        {canViewReviews && (
          <AnimatedSection delay={0.15} className="space-y-3">
            <SectionLabel
              title="Marketplace Reviews"
              description="Rating quality and reply health"
              href="/marketplace-reviews"
            />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ReviewRatingChart
                distribution={ratingDistribution}
                avgRating={loadingDistribution ? null : avgRating}
              />
              <Card className="rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">Review Health</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-2">
                  {[
                    { label: 'Reply rate', value: reviewKpis.replyRatePct, hint: `${reviewKpis.replied} of ${reviewKpis.total} replied` },
                    { label: 'Low rating share', value: reviewKpis.lowRatePct, hint: `${reviewKpis.low} reviews ≤3★`, warn: true },
                    { label: 'Needs reply', value: reviewKpis.total > 0 ? Math.round((reviewKpis.unreplied / reviewKpis.total) * 100) : 0, hint: `${reviewKpis.unreplied} unreplied`, warn: true },
                  ].map((row) => (
                    <div key={row.label} className="space-y-1.5">
                      <div className="flex justify-between text-sm gap-2">
                        <span className="font-medium">{row.label}</span>
                        <span className="tabular-nums text-muted-foreground">{row.value}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${row.warn ? 'bg-amber-500' : 'bg-emerald-500'}`}
                          style={{ width: `${Math.min(row.value, 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">{row.hint}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </AnimatedSection>
        )}

        <AnimatedSection delay={0.2} className="space-y-3">
          <SectionLabel
            title="Team & Issues"
            description="Where volume and risk concentrate"
          />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <AgentPerformanceCard agents={agents} />
            <div className="grid grid-cols-1 gap-4">
              <TopIssuesCard title="Top Complaint Types" data={topTypes} />
              <TopIssuesCard title="Most Problematic Products" data={topProducts} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TopIssuesCard title="Most Problematic Couriers" data={topCouriers} />
            <Card className="rounded-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Period snapshot</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Open</p>
                  <p className="text-xl font-bold tabular-nums mt-1">{complaintKpis.open}</p>
                </div>
                <div className="rounded-xl bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Resolved</p>
                  <p className="text-xl font-bold tabular-nums mt-1">{complaintKpis.resolved}</p>
                </div>
                <div className="rounded-xl bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">SLA met</p>
                  <p className="text-xl font-bold tabular-nums mt-1 text-emerald-600">{complaintKpis.slaMet}</p>
                </div>
                <div className="rounded-xl bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">SLA breached</p>
                  <p className="text-xl font-bold tabular-nums mt-1 text-destructive">{complaintKpis.slaBreached}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </AnimatedSection>

        <AnimatedSection delay={0.25} className="space-y-3">
          <SectionLabel
            title="SLA Performance"
            description="Policy adherence for tickets with an SLA"
          />
          <SlaReport complaints={filtered} />
        </AnimatedSection>
      </PageContent>
    </div>
  );
}
