import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { STATUS_COLORS } from '@/lib/ticketUtils';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';

export default function RecentActivity({ activities }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 max-h-[340px] overflow-y-auto">
        {activities.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">No recent activity</p>
        )}
        {activities.slice(0, 15).map(a => (
          <div key={a.id} className="flex items-start gap-3 py-2 border-b border-border last:border-0">
            <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-snug">{a.description}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground">{a.user_name || 'System'}</span>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(a.created_date), 'MMM dd, HH:mm')}
                </span>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}