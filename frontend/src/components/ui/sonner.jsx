"use client";
import { useTheme } from 'next-themes';
import { Toaster as Sonner } from 'sonner';
import { glassPanelStyles } from '@/components/layout/glassStyles';
import { cn } from '@/lib/utils';

const Toaster = ({ ...props }) => {
  const { theme = 'system' } = useTheme();

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      position="top-right"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast: cn(
            'group toast group-[.toaster]:text-foreground',
            glassPanelStyles,
          ),
          description: 'group-[.toast]:text-muted-foreground',
          actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
