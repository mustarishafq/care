import React, { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

export default function ThemeToggle({ variant = 'icon', className }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === 'dark';

  const toggle = () => setTheme(isDark ? 'light' : 'dark');

  if (!mounted) {
    if (variant === 'switch') {
      return <Switch disabled checked={false} className={className} />;
    }
    return (
      <Button variant="ghost" size="icon" className={cn('h-9 w-9', className)} disabled>
        <Sun className="h-5 w-5" />
      </Button>
    );
  }

  if (variant === 'switch') {
    return (
      <Switch
        checked={isDark}
        onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
        className={className}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      />
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn('h-9 w-9', className)}
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </Button>
  );
}
