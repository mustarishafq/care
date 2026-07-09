import React from 'react';
import { cn } from '@/lib/utils';

export default function SettingsSectionIntro({ title, description, className }) {
  if (!title && !description) return null;

  return (
    <div className={cn('space-y-1', className)}>
      {title && <h2 className="text-base font-semibold tracking-tight">{title}</h2>}
      {description && (
        <p className="text-sm text-muted-foreground max-w-3xl">{description}</p>
      )}
    </div>
  );
}
