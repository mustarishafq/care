import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { subDays, startOfDay, endOfDay, format } from 'date-fns';
import { LineChart, ArrowRight, ShieldCheck, Timer, Star, MessageSquare } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import VolumeTrendChart from '@/components/analytics/VolumeTrendChart';
import { usePermissions } from '@/lib/usePermissions';
import { useSlaSettings } from '@/lib/useSlaSettings';
import { useDisplayFormat } from '@/lib/DisplayFormatProvider';
import { db } from '@/api/db';
import {
  filterByCreatedRange,
  computeComplaintKpis,
  computeReviewKpis,
  buildVolumeTrend,
  averageRatingFromDistribution,
} from '@/lib/analyticsKpis';

async function fetchAvgRating(params) {
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
  return averageRatingFromDistribution(distribution);
}

export default function AnalyticsSnapshot({ complaints = [] }) {
  const { hasPermission } = usePermissions();
  const canViewAnalytics = hasPermission('reports.view');
  const canViewReviews = hasPermission('reviews.view');
  const { resolvedStatusNames, pausedStatusNames } = useSlaSettings();

  const { from, to, dateParams } = useMemo(() => {
    const start = startOfDay(subDays(new Date(), 29));
    const end = endOfDay(new Date());
    return {
      from: start,
      to: end,
      dateParams: {
        start_date: format(start, 'yyyy-MM-dd'),
        end_date: format(end, 'yyyy-MM-dd'),
      },
    };
  }, []);

  const periodComplaints = useMemo(
    () => filterByCreatedRange(complaints, from, to),
    [complaints, from, to],
  );

  const kpis = useMemo(
    () => computeComplaintKpis(periodComplaints, { resolvedStatusNames, pausedStatusNames }),
    [periodComplaints, resolvedStatusNames, pausedStatusNames],
  );

  const trend = useMemo(
    () => buildVolumeTrend(periodComplaints, from, to, resolvedStatusNames),
    [periodComplaints, from, to, resolvedStatusNames],
  );

  const { data: reviewStatsResponse } = useQuery({
    queryKey: ['dashboard-analytics-review-stats', dateParams],
    queryFn: () => db.integrations.Marketplace.listReviews({
      page: 1,
      per_page: 1,
      ...dateParams,
    }),
    enabled: canViewAnalytics && canViewReviews,
  });

  const { data: avgRating } = useQuery({
    queryKey: ['dashboard-analytics-avg-rating', dateParams],
    queryFn: () => fetchAvgRating(dateParams),
    enabled: canViewAnalytics && canViewReviews,
  });

  const reviewKpis = computeReviewKpis(reviewStatsResponse?.stats);

  if (!canViewAnalytics) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight flex items-center gap-1.5">
            <LineChart className="w-3.5 h-3.5 text-primary" />
            Analytics
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">Last 30 days · management snapshot</p>
        </div>
        <Button asChild variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground">
          <Link to="/analytics">
            Full analytics
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricTile
          icon={Timer}
          label="Avg resolution"
          value={`${kpis.avgResolutionHours}h`}
          tone="primary"
        />
        <MetricTile
          icon={ShieldCheck}
          label="SLA compliance"
          value={kpis.slaCompliancePct == null ? '—' : `${kpis.slaCompliancePct}%`}
          tone={kpis.slaCompliancePct != null && kpis.slaCompliancePct < 80 ? 'danger' : 'success'}
        />
        {canViewReviews ? (
          <>
            <MetricTile
              icon={Star}
              label="Avg rating"
              value={avgRating == null ? '—' : `${avgRating}`}
              tone="purple"
            />
            <MetricTile
              icon={MessageSquare}
              label="Reply rate"
              value={`${reviewKpis.replyRatePct}%`}
              tone="warning"
            />
          </>
        ) : (
          <>
            <MetricTile
              icon={ShieldCheck}
              label="Resolution rate"
              value={`${kpis.resolutionRatePct}%`}
              tone="success"
            />
            <MetricTile
              icon={Timer}
              label="Open tickets"
              value={kpis.open}
              tone="warning"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <VolumeTrendChart data={trend} title="Created vs Resolved (30 days)" />
        </div>
        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Period totals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Row label="Complaints" value={kpis.total} />
            <Row label="Resolved" value={kpis.resolved} />
            <Row label="Open" value={kpis.open} />
            <Row label="SLA breached" value={kpis.slaBreached} danger={kpis.slaBreached > 0} />
            {canViewReviews && (
              <>
                <div className="border-t pt-3" />
                <Row label="Reviews" value={reviewKpis.total} />
                <Row label="Low (≤3★)" value={reviewKpis.low} danger={reviewKpis.low > 0} />
                <Row label="Needs reply" value={reviewKpis.unreplied} danger={reviewKpis.unreplied > 0} />
              </>
            )}
            <Button asChild className="w-full mt-2" variant="outline" size="sm">
              <Link to="/analytics">Open management analytics</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricTile({ icon: Icon, label, value, tone = 'primary' }) {
  const { formatNumber } = useDisplayFormat();
  const tones = {
    primary: 'bg-primary/10 text-primary',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
    danger: 'bg-destructive/10 text-destructive',
    purple: 'bg-chart-3/10 text-chart-3',
  };
  const displayValue = typeof value === 'number' ? formatNumber(value) : value;

  return (
    <div className="rounded-2xl border bg-card p-4 flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </p>
        <p className="text-2xl font-bold mt-1 tracking-tight tabular-nums">{displayValue}</p>
      </div>
      <div className={`p-2 rounded-lg shrink-0 ${tones[tone] || tones.primary}`}>
        <Icon className="w-4 h-4" />
      </div>
    </div>
  );
}

function Row({ label, value, danger = false }) {
  const { formatNumber } = useDisplayFormat();
  const displayValue = typeof value === 'number' ? formatNumber(value) : value;

  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-semibold tabular-nums ${danger ? 'text-destructive' : ''}`}>{displayValue}</span>
    </div>
  );
}
