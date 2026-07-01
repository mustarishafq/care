import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

export default function TopIssuesCard({ title, data, onItemClick }) {
  const total = data.reduce((acc, d) => acc + d.count, 0) || 1;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.length === 0 && (
          <p className="text-sm text-muted-foreground py-2 text-center">No data</p>
        )}
        {data.slice(0, 5).map((item, i) => {
          const clickable = typeof onItemClick === 'function';

          return (
            <div
              key={i}
              role={clickable ? 'button' : undefined}
              tabIndex={clickable ? 0 : undefined}
              onClick={clickable ? () => onItemClick(item) : undefined}
              onKeyDown={clickable ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onItemClick(item);
                }
              } : undefined}
              className={clickable ? 'space-y-1 rounded-lg -mx-1 px-1 py-1 cursor-pointer hover:bg-muted/60 transition-colors' : 'space-y-1'}
            >
              <div className="flex justify-between items-center text-sm">
                <span className="font-medium truncate mr-2">{item.name}</span>
                <span className="text-muted-foreground shrink-0">{item.count}</span>
              </div>
              <Progress value={(item.count / total) * 100} className="h-1.5" />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}