import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/api/db';
import { usePermissions } from '@/lib/usePermissions';
import { shopCookieStatus } from '@/lib/shopCookieHealth';

export function useShopCookieAlerts() {
  const { hasPermission, loading } = usePermissions();
  const canReviews = hasPermission('reviews.view');
  const canMarketplace = hasPermission('marketplace.view');
  const enabled = !loading && (canReviews || canMarketplace);

  const query = useQuery({
    queryKey: ['marketplace-shops', 'cookie-health'],
    queryFn: async () => {
      if (canReviews) {
        const shops = await db.integrations.Marketplace.listShops();
        return Array.isArray(shops) ? shops : [];
      }

      const [tiktok, shopee] = await Promise.all([
        db.integrations.TikTokShop.listConnections(),
        db.integrations.Shopee.listConnections(),
      ]);

      return [...(tiktok ?? []), ...(shopee ?? [])];
    },
    enabled,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const shops = query.data ?? [];

  const expired = useMemo(
    () => shops.filter((shop) => {
      const status = shopCookieStatus(shop);
      return status === 'expired' || status === 'missing' || status === 'error';
    }),
    [shops],
  );

  const aging = useMemo(
    () => shops.filter((shop) => shopCookieStatus(shop) === 'aging'),
    [shops],
  );

  return {
    ...query,
    shops,
    expired,
    aging,
    alerts: [...expired, ...aging],
    hasAlerts: expired.length > 0 || aging.length > 0,
    canSee: enabled,
  };
}
