import React, { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';

const OPTIONS = [
  {
    value: 'light',
    label: 'Light',
    icon: Sun,
    previewClass: 'bg-[hsl(220,20%,97%)]',
    cardClass: 'bg-white border-[hsl(220,13%,91%)]',
    accentClass: 'bg-[hsl(206,92%,36%)]',
    barClass: 'bg-[hsl(220,13%,91%)]',
  },
  {
    value: 'dark',
    label: 'Dark',
    icon: Moon,
    previewClass: 'bg-[hsl(222,47%,6%)]',
    cardClass: 'bg-[hsl(222,47%,9%)] border-[hsl(222,40%,16%)]',
    accentClass: 'bg-[hsl(206,92%,36%)]',
    barClass: 'bg-[hsl(222,40%,16%)]',
  },
];

export default function AppearancePicker() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const active = mounted ? resolvedTheme : 'light';

  return (
    <div className="grid grid-cols-2 gap-3 max-w-md">
      {OPTIONS.map((option) => {
        const Icon = option.icon;
        const selected = active === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setTheme(option.value)}
            aria-pressed={selected}
            className={cn(
              'rounded-xl border p-3 text-left transition-all duration-200',
              selected
                ? 'border-primary ring-2 ring-primary/20 shadow-sm'
                : 'border-border hover:border-primary/40 hover:bg-muted/30',
            )}
          >
            <div className={cn('mb-3 h-16 rounded-lg overflow-hidden p-2', option.previewClass)}>
              <div className={cn('h-full rounded-md border flex items-center px-2 gap-1.5', option.cardClass)}>
                <span className={cn('h-2 w-2 rounded-full shrink-0', option.accentClass)} />
                <span className={cn('h-1.5 flex-1 rounded-full', option.barClass)} />
              </div>
            </div>
            <span className="flex items-center gap-2 text-sm font-medium">
              <Icon className="w-4 h-4 text-muted-foreground" />
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
