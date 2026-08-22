import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { shopCookieLabel, shopCookieStatus } from '@/lib/shopCookieHealth';

const STATUS_BADGE = {
  expired: { variant: 'destructive', className: '' },
  missing: { variant: 'destructive', className: '' },
  error: { variant: 'destructive', className: '' },
  aging: { variant: 'outline', className: 'text-amber-800 border-amber-500/50 bg-amber-500/10 dark:text-amber-300' },
  ok: { variant: 'outline', className: 'text-emerald-700 dark:text-emerald-400' },
};

export function ShopCookieStatusBadge({ shop }) {
  const status = shopCookieStatus(shop);
  const label = shopCookieLabel(shop);
  if (!label || status === 'oauth') return null;

  const visual = STATUS_BADGE[status] ?? STATUS_BADGE.ok;

  return (
    <Badge variant={visual.variant} className={visual.className}>
      {label}
    </Badge>
  );
}

export function ShopCookieCard({ shop, highlighted = false, children }) {
  const status = shopCookieStatus(shop);
  const problem = status === 'expired' || status === 'missing' || status === 'error';
  const aging = status === 'aging';

  return (
    <div
      className={cn(
        'rounded-lg border p-3 space-y-3',
        problem && 'border-destructive/60 bg-destructive/5',
        aging && !problem && 'border-amber-500/40 bg-amber-500/5',
        highlighted && 'ring-2 ring-primary/70',
      )}
    >
      {shop.connection_error && (
        <p className="text-xs text-destructive">{shop.connection_error}</p>
      )}
      {aging && !shop.connection_error && (
        <p className="text-xs text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          This cookie is getting old. Paste a fresh Seller Center cookie to avoid sync failures.
        </p>
      )}
      {children}
    </div>
  );
}
