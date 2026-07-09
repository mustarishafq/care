import React from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const TONE_STYLES = {
  primary: 'bg-primary/10 text-primary',
  info: 'bg-info/10 text-info',
  warning: 'bg-warning/10 text-warning',
};

export default function SettingsSwitchRow({
  icon: Icon,
  title,
  description,
  children,
  iconTone = 'primary',
  className,
}) {
  return (
    <div className={cn('flex items-center justify-between gap-4', className)}>
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={cn(
            'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
            TONE_STYLES[iconTone] ?? TONE_STYLES.primary,
          )}
        >
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <Label className="text-sm font-medium">{title}</Label>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
