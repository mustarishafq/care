import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { chartTooltipProps } from '@/lib/chartTooltip';

export default function AgentPerformanceCard({ agents = [] }) {
  const chartData = agents.map((a) => ({
    name: a.name.length > 14 ? `${a.name.slice(0, 14)}…` : a.name,
    open: a.open,
    resolved: a.resolved,
  }));

  return (
    <Card className="rounded-2xl h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Agent Workload</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {agents.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">No assigned agents in this period</p>
        ) : (
          <>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                    height={48}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip {...chartTooltipProps} />
                  <Bar dataKey="resolved" name="Resolved" stackId="a" fill="hsl(142, 71%, 45%)" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="open" name="Open" stackId="a" fill="hsl(38, 92%, 50%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2.5 max-h-[160px] overflow-y-auto">
              {agents.slice(0, 5).map((agent) => {
                const rate = agent.total > 0 ? Math.round((agent.resolved / agent.total) * 100) : 0;
                return (
                  <div key={agent.name} className="space-y-1">
                    <div className="flex justify-between text-sm gap-2">
                      <span className="font-medium truncate">{agent.name}</span>
                      <span className="text-muted-foreground shrink-0 tabular-nums">
                        {agent.resolved}/{agent.total} · {rate}%
                      </span>
                    </div>
                    <Progress value={rate} className="h-1.5" />
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
