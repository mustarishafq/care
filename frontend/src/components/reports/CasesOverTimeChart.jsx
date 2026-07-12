import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { format, eachDayOfInterval, parseISO, startOfDay } from 'date-fns';
import { chartTooltipProps } from '@/lib/chartTooltip';

export default function CasesOverTimeChart({ complaints, dateFrom, dateTo }) {
  const days = eachDayOfInterval({ start: dateFrom, end: dateTo });

  const data = days.map(day => {
    const label = format(day, 'MMM d');
    const dayStr = format(day, 'yyyy-MM-dd');
    const count = complaints.filter(c => {
      const d = format(startOfDay(new Date(c.created_date)), 'yyyy-MM-dd');
      return d === dayStr;
    }).length;
    return { label, count };
  });

  // If too many days, aggregate by week
  const aggregated = data.length > 60
    ? (() => {
        const weeks = [];
        for (let i = 0; i < data.length; i += 7) {
          const chunk = data.slice(i, i + 7);
          weeks.push({
            label: chunk[0].label,
            count: chunk.reduce((s, d) => s + d.count, 0),
          });
        }
        return weeks;
      })()
    : data;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Cases Over Time</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[260px]">
          <ResponsiveContainer>
            <AreaChart data={aggregated} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="caseGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(199,89%,48%)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="hsl(199,89%,48%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                interval="preserveStartEnd"
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip {...chartTooltipProps} formatter={(v) => [v, 'Cases']} />
              <Area
                type="monotone"
                dataKey="count"
                stroke="hsl(199,89%,48%)"
                strokeWidth={2}
                fill="url(#caseGrad)"
                dot={false}
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}