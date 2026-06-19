import React from 'react';
import ThemeToggle from '@/components/theme/ThemeToggle';
import { redirectToNexusBrain } from '@/lib/nexusBrain';
import { cn } from '@/lib/utils';

const FEATURES = [
  'Complaint tracking',
  'SLA management',
  'Team collaboration',
  'Real-time notifications',
];

export default function AuthLayout({ title, description, children, footer }) {
  return (
    <div className="min-h-screen flex relative">
      {/* Brand panel — desktop only */}
      <div
        className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-[hsl(206,92%,15%)] text-white flex-col justify-between p-12"
        aria-hidden
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[hsl(206,92%,25%)] via-[hsl(206,92%,20%)] to-[hsl(206,92%,10%)]" />
        <div className="absolute top-1/4 -left-20 w-72 h-72 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute bottom-1/4 -right-16 w-64 h-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[500px] h-[500px] rounded-full border border-white/5" />
          <div className="absolute w-[350px] h-[350px] rounded-full border border-white/5" />
          <div className="absolute w-[200px] h-[200px] rounded-full border border-white/5" />
        </div>

        <div className="relative z-10 flex items-center gap-3">
          <img src="/icons/logo.svg" alt="" className="h-10 w-10 rounded-xl" />
          <span className="text-lg font-bold tracking-tight">EMZI Nexus Care</span>
        </div>

        <div className="relative z-10 space-y-6 max-w-md">
          <h2 className="text-3xl font-bold tracking-tight leading-tight">
            Manage complaints with clarity and speed
          </h2>
          <p className="text-white/60 text-sm leading-relaxed">
            Track tickets, monitor SLAs, and resolve customer issues — all in one place within the EMZI Nexus Brain ecosystem.
          </p>
          <div className="flex flex-wrap gap-2">
            {FEATURES.map((feature) => (
              <span
                key={feature}
                className="px-3 py-1 rounded-full bg-white/10 text-white/70 text-xs font-medium ring-1 ring-white/10"
              >
                {feature}
              </span>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-white/50 text-xs">
          Part of{' '}
          <button
            type="button"
            onClick={redirectToNexusBrain}
            className="text-white/70 hover:text-white font-medium transition-colors"
          >
            EMZI Nexus Brain
          </button>
        </p>
      </div>

      {/* Form panel */}
      <div
        className={cn(
          'flex-1 flex flex-col min-h-screen relative',
          'bg-gradient-to-b from-[hsl(206,92%,20%)] to-[hsl(206,92%,12%)]',
          'lg:bg-background lg:from-transparent lg:to-transparent',
        )}
      >
        <div className="absolute top-4 right-4 z-20">
          <ThemeToggle className="text-white lg:text-foreground hover:bg-white/10 lg:hover:bg-muted" />
        </div>

        {/* Mobile banner */}
        <div className="lg:hidden pt-12 px-6 pb-4">
          <img
            src="/icons/logo.svg"
            alt="EMZI Nexus Care"
            className="h-12 w-12 mx-auto rounded-xl"
          />
        </div>

        <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-12">
          <div className="w-full max-w-md">
            <div
              className={cn(
                'space-y-6',
                'bg-card rounded-3xl p-8 shadow-2xl',
                'lg:bg-transparent lg:rounded-none lg:p-0 lg:shadow-none lg:space-y-8',
              )}
            >
              <div className="space-y-2 text-center lg:text-left">
                <div className="hidden lg:flex items-center gap-3 mb-6">
                  <img src="/icons/logo.svg" alt="" className="h-9 w-9 rounded-xl" />
                  <span className="font-bold text-lg tracking-tight">EMZI Nexus Care</span>
                </div>
                <h1 className="text-3xl lg:text-2xl font-bold tracking-tight">
                  {title}
                </h1>
                {description && (
                  <p className="text-sm text-muted-foreground">{description}</p>
                )}
              </div>

              {children}
            </div>

            {footer && (
              <div className="mt-6 text-center text-sm text-white/50 lg:text-muted-foreground">
                {footer}
              </div>
            )}
          </div>
        </main>

        <footer className="py-4 text-center text-xs text-white/50 lg:text-muted-foreground lg:hidden">
          <p>
            Part of{' '}
            <button
              type="button"
              onClick={redirectToNexusBrain}
              className="text-white/70 hover:text-white font-medium transition-colors"
            >
              EMZI Nexus Brain
            </button>
          </p>
        </footer>
      </div>
    </div>
  );
}
