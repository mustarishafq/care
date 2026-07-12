import React from 'react';
import {
  FileText, CheckCircle2, Clock, Timer, ShieldCheck, AlertTriangle,
  Star, MessageSquare, ThumbsDown,
} from 'lucide-react';
import StatCard from '@/components/dashboard/StatCard';

export default function AnalyticsKpiStrip({
  complaintKpis,
  reviewKpis,
  avgRating,
  showReviews = false,
  onComplaintClick,
  onReviewClick,
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Complaints"
          value={complaintKpis.total}
          icon={FileText}
          color="blue"
          index={0}
          onClick={onComplaintClick}
        />
        <StatCard
          label="Resolution Rate"
          value={`${complaintKpis.resolutionRatePct}%`}
          icon={CheckCircle2}
          color="success"
          index={1}
          format="none"
        />
        <StatCard
          label="Avg Resolution"
          value={complaintKpis.avgResolutionHours}
          icon={Timer}
          color="primary"
          index={2}
        />
        <StatCard
          label="SLA Compliance"
          value={complaintKpis.slaCompliancePct == null ? '—' : `${complaintKpis.slaCompliancePct}%`}
          icon={ShieldCheck}
          color={complaintKpis.slaCompliancePct != null && complaintKpis.slaCompliancePct < 80 ? 'danger' : 'success'}
          index={3}
          format="none"
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Open Tickets"
          value={complaintKpis.open}
          icon={Clock}
          color="warning"
          index={4}
          onClick={onComplaintClick}
        />
        <StatCard
          label="SLA Breached"
          value={complaintKpis.slaBreached}
          icon={AlertTriangle}
          color="danger"
          index={5}
        />
        {showReviews ? (
          <>
            <StatCard
              label="Avg Rating"
              value={avgRating == null ? '—' : avgRating}
              icon={Star}
              color="purple"
              index={6}
              format="none"
              onClick={onReviewClick}
            />
            <StatCard
              label="Review Reply Rate"
              value={`${reviewKpis.replyRatePct}%`}
              icon={MessageSquare}
              color="blue"
              index={7}
              format="none"
              onClick={onReviewClick}
            />
          </>
        ) : (
          <>
            <StatCard
              label="Resolved"
              value={complaintKpis.resolved}
              icon={CheckCircle2}
              color="success"
              index={6}
            />
            <StatCard
              label="SLA At Risk"
              value={complaintKpis.slaAtRisk}
              icon={AlertTriangle}
              color="warning"
              index={7}
            />
          </>
        )}
      </div>

      {showReviews && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard
            label="Total Reviews"
            value={reviewKpis.total}
            icon={Star}
            color="blue"
            index={8}
            onClick={onReviewClick}
          />
          <StatCard
            label="Needs Reply"
            value={reviewKpis.unreplied}
            icon={MessageSquare}
            color="warning"
            index={9}
            onClick={onReviewClick}
          />
          <StatCard
            label="Low (≤3★)"
            value={reviewKpis.low}
            icon={ThumbsDown}
            color="danger"
            index={10}
            onClick={onReviewClick}
          />
          <StatCard
            label="Low Rating Rate"
            value={`${reviewKpis.lowRatePct}%`}
            icon={ThumbsDown}
            color="purple"
            index={11}
            format="none"
          />
        </div>
      )}
    </div>
  );
}
