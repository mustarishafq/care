import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useSlaSettings } from '@/lib/useSlaSettings';
import { chartTooltipProps } from '@/lib/chartTooltip';

export default function ResolvedUnresolvedChart({ complaints }) {
  const { resolvedStatusNames } = useSlaSettings();
  const total = complaints.length;
  const resolved = complaints.filter(c => resolvedStatusNames.includes(c.status)).length;
  const unresolved = total - resolved;

  const resolvedPct = total > 0 ? ((resolved / total) * 100).toFixed(1) : 0;
  const unresolvedPct = total > 0 ? ((unresolved / total) * 100).toFixed(1) : 0;

  const data = [
    { name: 'Resolved', value: resolved, pct: resolvedPct },
    { name: 'Unresolved', value: unresolved, pct: unresolvedPct },
  ];

  const COLORS = ['#22c55e', '#f59e0b'];

  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, index }) => {
    if (data[index].value === 0) return null;
    const RADIAN = Math.PI / 180;
    const r = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + r * Math.cos(-midAngle * RADIAN);
    const y = cy + r * Math.sin(-midAngle * RADIAN);
    return (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={600}>
        {data[index].pct}%
      </text>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Resolved vs Unresolved</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="h-[220px] w-full sm:w-[220px] shrink-0">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                  labelLine={false}
                  label={renderCustomLabel}
                >
                  {data.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip {...chartTooltipProps} formatter={(v, name, props) => [`${v} (${props.payload.pct}%)`, name]} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-col gap-4 w-full">
            {data.map((item, i) => (
              <div key={item.name} className="flex items-center justify-between p-3 rounded-xl bg-muted/40">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ background: COLORS[i] }} />
                  <span className="text-sm font-medium">{item.name}</span>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold leading-none">{item.value}</p>
                  <p className="text-xs text-muted-foreground">{item.pct}%</p>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between p-3 rounded-xl border border-dashed">
              <span className="text-sm text-muted-foreground">Total Cases</span>
              <span className="text-lg font-bold">{total}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
