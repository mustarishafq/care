import React from 'react';
import { cn } from '@/lib/utils';

export default function SettingsSectionIntro({ title, description, icon: Icon, className }) {
  if (!title && !description) return null;

  return (
    <div className={cn('flex items-start gap-3', className)}>
      {Icon && (
        <span className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="w-5 h-5" />
        </span>
      )}
      <div className="space-y-1 min-w-0">
        {title && <h2 className="text-lg font-semibold tracking-tight">{title}</h2>}
        {description && (
          <p className="text-sm text-muted-foreground max-w-2xl">{description}</p>
        )}
      </div>
    </div>
  );
}
