import React from 'react';
import { Link } from 'react-router-dom';
import { Cookie } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useShopCookieAlerts } from '@/lib/useShopCookieAlerts';
import { shopCookieFixPathWithId } from '@/lib/shopCookieHealth';
import { cn } from '@/lib/utils';

function shopName(shop) {
  return shop.shop_name || shop.shop_id || 'Unknown shop';
}

export default function CookieHealthBanner() {
  const { expired, aging, hasAlerts } = useShopCookieAlerts();

  if (!hasAlerts) return null;

  const broken = expired.length > 0;
  const lead = broken ? expired : aging;
  const extra = lead.length - 1;
  const first = lead[0];

  return (
    <Alert
      variant={broken ? 'destructive' : 'default'}
      className={cn(
        'mb-4',
        !broken && 'border-amber-500/50 bg-amber-500/10 text-amber-950 dark:text-amber-100 [&>svg]:text-amber-700 dark:[&>svg]:text-amber-300',
      )}
    >
      <Cookie />
      <AlertTitle className="pr-2">
        {broken
          ? 'Shop cookie expired or unusable'
          : 'Shop cookie is getting old'}
      </AlertTitle>
      <AlertDescription className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        <span className="flex-1 min-w-0">
          {shopName(first)}
          {extra > 0 ? ` and ${extra} other shop${extra === 1 ? '' : 's'}` : ''}
          {broken
            ? ' need a fresh Seller Center cookie, or reviews and orders will stop syncing.'
            : ' — refresh the cookie soon so scheduled sync does not fail.'}
        </span>
        <Button asChild size="sm" variant={broken ? 'destructive' : 'secondary'} className="shrink-0 self-start sm:self-center">
          <Link to={shopCookieFixPathWithId(first)}>Update cookie</Link>
        </Button>
      </AlertDescription>
    </Alert>
  );
}
