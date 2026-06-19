import React from 'react';
import { cn } from '@/lib/utils';

const colorMap = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-destructive/10 text-destructive',
  info: 'bg-info/10 text-info',
  purple: 'bg-chart-3/10 text-chart-3',
  blue: 'bg-primary/10 text-primary',
};

export default function StatCard({ label, value, icon: Icon, trend, color = 'primary', index = 0 }) {
  return (
    <div
      className="bg-card rounded-2xl border border-border p-4 sm:p-5 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 group"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider leading-snug">{label}</p>
          <p className="text-2xl sm:text-3xl font-bold mt-1 tracking-tight">{value}</p>
          {trend != null && (
            <p className={cn(
              'text-xs mt-1.5 font-medium',
              trend >= 0 ? 'text-success' : 'text-destructive',
            )}>
              {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}% from last month
            </p>
          )}
        </div>
        <div className={cn(
          'p-2 sm:p-2.5 rounded-lg shrink-0 transition-transform duration-300 group-hover:scale-110',
          colorMap[color] || colorMap.primary,
        )}>
          <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
      </div>
    </div>
  );
}
