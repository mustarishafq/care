import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { chartTooltipProps } from '@/lib/chartTooltip';

const STAR_COLORS = {
  1: '#ef4444',
  2: '#f97316',
  3: '#f59e0b',
  4: '#84cc16',
  5: '#22c55e',
};

export default function ReviewRatingChart({ distribution = {}, avgRating }) {
  const data = [1, 2, 3, 4, 5].map((star) => ({
    name: `${star}★`,
    star,
    count: Number(distribution[star]) || 0,
  }));

  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <Card className="rounded-2xl h-full">
      <CardHeader className="pb-2">
        <div className="flex items-baseline justify-between gap-2">
          <CardTitle className="text-base font-semibold">Rating Distribution</CardTitle>
          {avgRating != null && (
            <p className="text-sm text-muted-foreground">
              Avg <span className="font-semibold text-foreground tabular-nums">{avgRating}</span>/5
            </p>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[220px]">
          {total === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-16">No reviews in this period</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip {...chartTooltipProps} formatter={(v) => [v, 'Reviews']} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {data.map((entry) => (
                    <Cell key={entry.star} fill={STAR_COLORS[entry.star]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        {total > 0 && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
            {data.filter((d) => d.count > 0).map((d) => (
              <div key={d.star} className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{d.name}</span>
                {' '}
                {Math.round((d.count / total) * 100)}%
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
