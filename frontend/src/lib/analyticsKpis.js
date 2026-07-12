import { differenceInHours, format, eachDayOfInterval, startOfDay, subDays, endOfDay, isBefore, isAfter } from 'date-fns';
import { getAssignedAgents } from '@/lib/assignedAgents';
import { getSlaStatus, hasSlaPolicy } from '@/components/complaints/SlaBadge';

export function getRangeDates(range, customFrom, customTo) {
  const now = new Date();
  if (range === 'today') return { from: startOfDay(now), to: endOfDay(now) };
  if (range === 'custom') {
    return {
      from: customFrom ? startOfDay(new Date(customFrom)) : startOfDay(subDays(now, 30)),
      to: customTo ? endOfDay(new Date(customTo)) : endOfDay(now),
    };
  }
  return { from: startOfDay(subDays(now, parseInt(range, 10))), to: endOfDay(now) };
}

export function filterByCreatedRange(items, from, to, dateKey = 'created_date') {
  return items.filter((item) => {
    const raw = item[dateKey];
    if (!raw) return false;
    const d = new Date(raw);
    return !isBefore(d, from) && !isAfter(d, to);
  });
}

function getResolvedAt(c) {
  if (c.resolved_at) return c.resolved_at;
  if (c.closed_at) return c.closed_at;
  return null;
}

export function computeComplaintKpis(complaints, { resolvedStatusNames = [], pausedStatusNames = [] } = {}) {
  const total = complaints.length;
  const open = complaints.filter((c) => !resolvedStatusNames.includes(c.status)).length;
  const resolved = total - open;

  const withResolvedAt = complaints.filter((c) => c.created_date && getResolvedAt(c));
  const avgResolutionHours = withResolvedAt.length
    ? Math.round(
      withResolvedAt.reduce(
        (sum, c) => sum + Math.max(0, differenceInHours(new Date(getResolvedAt(c)), new Date(c.created_date))),
        0,
      ) / withResolvedAt.length,
    )
    : 0;

  const withSla = complaints.filter(hasSlaPolicy);
  const slaMet = withSla.filter((c) => getSlaStatus(c, pausedStatusNames, resolvedStatusNames) === 'met').length;
  const slaBreached = withSla.filter((c) => getSlaStatus(c, pausedStatusNames, resolvedStatusNames) === 'breached').length;
  const slaAtRisk = withSla.filter((c) => getSlaStatus(c, pausedStatusNames, resolvedStatusNames) === 'at_risk').length;
  const slaCompliancePct = withSla.length > 0
    ? Math.round((slaMet / withSla.length) * 100)
    : null;

  const resolutionRatePct = total > 0 ? Math.round((resolved / total) * 100) : 0;

  return {
    total,
    open,
    resolved,
    resolutionRatePct,
    avgResolutionHours,
    slaTotal: withSla.length,
    slaMet,
    slaBreached,
    slaAtRisk,
    slaCompliancePct,
  };
}

export function buildVolumeTrend(complaints, from, to, resolvedStatusNames = []) {
  const days = eachDayOfInterval({ start: from, end: to });
  const data = days.map((day) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    const created = complaints.filter((c) => {
      if (!c.created_date) return false;
      return format(startOfDay(new Date(c.created_date)), 'yyyy-MM-dd') === dayStr;
    }).length;
    const resolved = complaints.filter((c) => {
      const at = getResolvedAt(c);
      if (!at) return false;
      if (!resolvedStatusNames.includes(c.status) && !c.resolved_at && !c.closed_at) return false;
      return format(startOfDay(new Date(at)), 'yyyy-MM-dd') === dayStr;
    }).length;
    return {
      label: format(day, 'MMM d'),
      created,
      resolved,
    };
  });

  if (data.length <= 60) return data;

  const weeks = [];
  for (let i = 0; i < data.length; i += 7) {
    const chunk = data.slice(i, i + 7);
    weeks.push({
      label: chunk[0].label,
      created: chunk.reduce((s, d) => s + d.created, 0),
      resolved: chunk.reduce((s, d) => s + d.resolved, 0),
    });
  }
  return weeks;
}

export function topRanked(complaints, keyFn, limit = 5) {
  const map = {};
  complaints.forEach((c) => {
    const name = keyFn(c);
    if (!name) return;
    map[name] = (map[name] || 0) + 1;
  });
  return Object.entries(map)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function agentWorkload(complaints, resolvedStatusNames = []) {
  const map = {};
  complaints.forEach((c) => {
    const agents = getAssignedAgents(c);
    if (!agents.length) return;
    agents.forEach((agent) => {
      const key = agent.id || agent.email || agent.full_name;
      if (!key) return;
      const displayName = agent.full_name || agent.name || agent.email || 'Unknown';
      if (!map[key]) {
        map[key] = { name: displayName, open: 0, resolved: 0, total: 0 };
      }
      map[key].total += 1;
      if (resolvedStatusNames.includes(c.status)) {
        map[key].resolved += 1;
      } else {
        map[key].open += 1;
      }
    });
  });
  return Object.values(map)
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);
}

export function computeReviewKpis(stats = {}) {
  const total = Number(stats.total) || 0;
  const unreplied = Number(stats.unreplied) || 0;
  const replied = Number(stats.replied) || 0;
  const low = Number(stats.low) || 0;
  const replyRatePct = total > 0 ? Math.round((replied / total) * 100) : 0;
  const lowRatePct = total > 0 ? Math.round((low / total) * 100) : 0;

  return {
    total,
    unreplied,
    replied,
    low,
    replyRatePct,
    lowRatePct,
  };
}

/** Weighted average from rating counts `{1:n, 2:n, ...}` */
export function averageRatingFromDistribution(distribution = {}) {
  let sum = 0;
  let count = 0;
  for (let star = 1; star <= 5; star += 1) {
    const n = Number(distribution[star]) || 0;
    sum += star * n;
    count += n;
  }
  if (!count) return null;
  return Math.round((sum / count) * 10) / 10;
}
