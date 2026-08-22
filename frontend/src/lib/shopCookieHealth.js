const AGING_HOURS = {
  tiktok_shop: 18,
  shopee: 72,
};

export function shopCookieFixPath(shop) {
  if (shop?.platform === 'shopee') return '/marketplace/shopee';
  return '/marketplace/tiktok-shop';
}

export function shopCookieFixPathWithId(shop) {
  const path = shopCookieFixPath(shop);
  return shop?.id ? `${path}?shop=${shop.id}` : path;
}

export function shopCookieStatus(shop) {
  if (!shop) return 'unknown';

  if (shop.connection_error) {
    return shop.auth_mode === 'seller_cookie' ? 'expired' : 'error';
  }

  if (shop.auth_mode !== 'seller_cookie') {
    return 'oauth';
  }

  if (!shop.has_seller_cookie) {
    return 'missing';
  }

  const updatedAt = shop.cookie_updated_at ? new Date(shop.cookie_updated_at) : null;
  if (updatedAt && !Number.isNaN(updatedAt.getTime())) {
    const maxAgeHours = AGING_HOURS[shop.platform] ?? 24;
    const ageHours = (Date.now() - updatedAt.getTime()) / 3_600_000;
    if (ageHours >= maxAgeHours) {
      return 'aging';
    }
  }

  return 'ok';
}

export function shopNeedsCookieAttention(shop) {
  const status = shopCookieStatus(shop);
  return status === 'expired' || status === 'aging' || status === 'missing' || status === 'error';
}

export function shopCookieLabel(shop) {
  switch (shopCookieStatus(shop)) {
    case 'expired':
      return 'Cookie expired';
    case 'aging':
      return 'Cookie aging';
    case 'missing':
      return 'No cookie';
    case 'error':
      return 'Connection issue';
    case 'ok':
      return 'Cookie OK';
    default:
      return null;
  }
}
