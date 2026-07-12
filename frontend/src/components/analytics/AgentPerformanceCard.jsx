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
    <Card className="rounded-2xl h-full flex flex-col">
      <CardHeader className="pb-2 shrink-0">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base font-semibold">Agent Workload</CardTitle>
          {agents.length > 0 && (
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-sm bg-[hsl(142,71%,45%)]" />
                Resolved
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-sm bg-[hsl(38,92%,50%)]" />
                Open
              </span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col min-h-0 gap-3 pt-0">
        {agents.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">No assigned agents in this period</p>
        ) : (
          <>
            <div className="h-[200px] shrink-0 sm:h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                    height={52}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                    width={28}
                  />
                  <Tooltip {...chartTooltipProps} />
                  <Bar dataKey="resolved" name="Resolved" stackId="a" fill="hsl(142, 71%, 45%)" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="open" name="Open" stackId="a" fill="hsl(38, 92%, 50%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-0.5">
              {agents.map((agent) => {
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
