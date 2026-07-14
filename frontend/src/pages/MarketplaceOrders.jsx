import { db } from '@/api/db';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import {
  ClipboardList, Loader2, RefreshCw, Store, ChevronDown, SlidersHorizontal,
  CalendarDays, ChevronLeft, ChevronRight, Phone, MapPin, User, Package, CheckCircle2, CircleDashed, Copy,
  Download,
} from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import PageContent from '@/components/layout/PageContent';
import StatCard from '@/components/dashboard/StatCard';
import { toast } from 'sonner';
import { toastApiError } from '@/lib/toastApi';
import { usePermissions } from '@/lib/usePermissions';
import { useDisplayFormat } from '@/lib/DisplayFormatProvider';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const PLATFORM_LABELS = {
  tiktok_shop: 'TikTok Shop',
  shopee: 'Shopee',
};

function platformLabel(platform) {
  return PLATFORM_LABELS[platform] ?? platform;
}

function todayIso() {
  return format(new Date(), 'yyyy-MM-dd');
}

function daysAgoIso(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return format(d, 'yyyy-MM-dd');
}

function activeFilterCount(filters) {
  return Object.values(filters).filter((v) => v && v !== 'all').length;
}

const ORDER_STATUS_FILTERS = [
  { value: 'all', label: 'All statuses' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'to_ship', label: 'To ship' },
  { value: 'awaiting_collection', label: 'Awaiting collection' },
  { value: 'partially_shipping', label: 'Partially shipping' },
  { value: 'in_transit', label: 'In transit' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const ORDER_STATUS_STYLES = {
  unpaid: 'bg-amber-100 text-amber-800 border-amber-200/80 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
  to_ship: 'bg-sky-100 text-sky-800 border-sky-200/80 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800',
  awaiting_collection: 'bg-indigo-100 text-indigo-800 border-indigo-200/80 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800',
  partially_shipping: 'bg-violet-100 text-violet-800 border-violet-200/80 dark:bg-violet-950/50 dark:text-violet-300 dark:border-violet-800',
  in_transit: 'bg-blue-100 text-blue-800 border-blue-200/80 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800',
  delivered: 'bg-emerald-100 text-emerald-800 border-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
  completed: 'bg-emerald-100 text-emerald-800 border-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
  cancelled: 'bg-rose-100 text-rose-800 border-rose-200/80 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800',
};

function orderStatusClass(status) {
  return ORDER_STATUS_STYLES[status] || 'bg-muted text-foreground/80 border-border';
}

async function copyText(value, label) {
  if (!value) return;
  try {
    await navigator.clipboard.writeText(String(value));
    toast.success(`${label} copied`);
  } catch {
    toast.error(`Could not copy ${label.toLowerCase()}`);
  }
}

function OrderCard({ order }) {
  const { formatDate, formatDateTime, formatNumber, formatMoney } = useDisplayFormat();
  const createdAt = order.order_created_at ? new Date(order.order_created_at) : null;
  const items = Array.isArray(order.items) ? order.items : [];
  const totalLabel = order.grand_total != null
    ? formatMoney(Number(order.grand_total))
    : '—';
  const buyerName = order.buyer_name || order.buyer_nickname || null;
  const hasPhone = Boolean(order.buyer_phone);
  const hasAddress = Boolean(order.buyer_address);
  const metaParts = [
    platformLabel(order.platform),
    order.shop_name,
  ].filter(Boolean);

  return (
    <article className="rounded-xl sm:rounded-2xl border bg-card/50 hover:bg-card transition-colors overflow-hidden">
      <div className="p-3.5 sm:p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => copyText(order.external_order_id, 'Order ID')}
                className="group inline-flex items-center gap-1.5 font-mono text-xs sm:text-sm text-foreground/90 hover:text-foreground"
                title="Copy order ID"
              >
                <span>#{order.external_order_id}</span>
                <Copy className="w-3.5 h-3.5 opacity-0 group-hover:opacity-60 transition-opacity" />
              </button>
              {order.order_status_label && (
                <Badge
                  variant="outline"
                  className={cn(
                    'border text-[10px] sm:text-xs font-medium',
                    orderStatusClass(order.order_status),
                  )}
                >
                  {order.order_status_label}
                </Badge>
              )}
            </div>
            {metaParts.length > 0 && (
              <p className="text-xs text-muted-foreground truncate">
                {metaParts.join(' · ')}
              </p>
            )}
          </div>
          <div className="shrink-0 text-right space-y-1">
            <p className="text-base sm:text-lg font-semibold tabular-nums tracking-tight leading-none">
              {totalLabel}
            </p>
            {createdAt && (
              <time className="text-[11px] sm:text-xs text-muted-foreground inline-flex items-center gap-1 justify-end">
                <CalendarDays className="w-3.5 h-3.5 hidden sm:inline" />
                <span className="md:hidden">{formatDate(createdAt)}</span>
                <span className="hidden md:inline">{formatDateTime(createdAt)}</span>
              </time>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)] sm:gap-5">
          <div className="space-y-2 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Customer
              </p>
              <span
                className={cn(
                  'inline-flex items-center gap-1 text-[11px]',
                  order.has_contact
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-amber-700 dark:text-amber-400',
                )}
              >
                {order.has_contact ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                  <CircleDashed className="w-3.5 h-3.5" />
                )}
                {order.has_contact ? 'Synced' : 'Pending'}
              </span>
            </div>
            <p className="text-sm font-medium break-words">
              {buyerName || <span className="text-muted-foreground italic font-normal">Name not revealed</span>}
            </p>
            <div className="space-y-1.5 text-sm text-foreground/85">
              <p className="inline-flex items-start gap-2 min-w-0">
                <Phone className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                {hasPhone ? (
                  <button
                    type="button"
                    onClick={() => copyText(order.buyer_phone, 'Phone')}
                    className="text-left break-all hover:underline underline-offset-2"
                    title="Copy phone"
                  >
                    {order.buyer_phone}
                  </button>
                ) : (
                  <span className="text-muted-foreground italic">Phone not revealed</span>
                )}
              </p>
              <p className="inline-flex items-start gap-2 min-w-0">
                <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                {hasAddress ? (
                  <span className="break-words leading-snug">{order.buyer_address}</span>
                ) : (
                  <span className="text-muted-foreground italic">Address not revealed</span>
                )}
              </p>
            </div>
          </div>

          <div className="space-y-2 min-w-0 sm:border-l sm:border-border/70 sm:pl-5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground inline-flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5" />
              Items · {formatNumber(order.item_count || items.length)}
            </p>
            <ul className="space-y-2.5">
              {items.map((item, index) => {
                const skuLine = [item.sku_name, item.seller_sku_name].filter(Boolean).join(' · ');
                return (
                  <li
                    key={`${item.sku_id || item.product_id || index}`}
                    className="flex gap-3 items-start"
                  >
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt=""
                        className="w-11 h-11 sm:w-12 sm:h-12 rounded-lg object-cover border shrink-0 bg-muted"
                      />
                    ) : (
                      <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-lg border bg-muted shrink-0" />
                    )}
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="text-sm font-medium leading-snug line-clamp-2">
                        {item.product_name || 'Product'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {skuLine || '—'}
                        {' · '}
                        x{formatNumber(item.quantity || 0)}
                      </p>
                      {item.total_price_formatted && (
                        <p className="text-xs font-medium tabular-nums text-foreground/80">
                          {item.total_price_formatted}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
              {items.length === 0 && (
                <li className="text-sm text-muted-foreground italic">
                  {order.product_summary || 'No items stored for this order'}
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function MarketplaceOrders({ embedded = false } = {}) {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const { formatNumber } = useDisplayFormat();
  const canManage = hasPermission('orders.manage');
  const listTopRef = useRef(null);

  const [platformFilter, setPlatformFilter] = useState('tiktok_shop');
  const [shopFilter, setShopFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [orderIdFilter, setOrderIdFilter] = useState('');
  const [buyerFilter, setBuyerFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [debouncedOrderId, setDebouncedOrderId] = useState('');
  const [debouncedBuyer, setDebouncedBuyer] = useState('');
  const [debouncedProduct, setDebouncedProduct] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [phoneModalOpen, setPhoneModalOpen] = useState(false);
  const [syncShopId, setSyncShopId] = useState('');
  const [phoneShopId, setPhoneShopId] = useState('');
  const [syncStartDate, setSyncStartDate] = useState(() => daysAgoIso(7));
  const [syncEndDate, setSyncEndDate] = useState(todayIso);
  const [phoneStartDate, setPhoneStartDate] = useState(() => daysAgoIso(7));
  const [phoneEndDate, setPhoneEndDate] = useState(todayIso);
  const [phoneLimit, setPhoneLimit] = useState('15');
  const [syncing, setSyncing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [revealingPhones, setRevealingPhones] = useState(false);
  const [page, setPage] = useState(1);
  const perPage = 20;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedOrderId(orderIdFilter.trim());
      setDebouncedBuyer(buyerFilter.trim());
      setDebouncedProduct(productFilter.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [orderIdFilter, buyerFilter, productFilter]);

  useEffect(() => {
    setPage(1);
  }, [debouncedOrderId, debouncedBuyer, debouncedProduct, platformFilter, shopFilter, statusFilter, fromDate, toDate]);

  const filterParams = useMemo(() => {
    const params = {};
    if (platformFilter !== 'all') params.platform = platformFilter;
    if (shopFilter !== 'all') params.shop_connection_id = Number(shopFilter);
    if (statusFilter !== 'all') params.order_status = statusFilter;
    if (debouncedOrderId) params.order_id = debouncedOrderId;
    if (debouncedBuyer) params.buyer = debouncedBuyer;
    if (debouncedProduct) params.product_name = debouncedProduct;
    if (fromDate) params.start_date = fromDate;
    if (toDate) params.end_date = toDate;
    return params;
  }, [platformFilter, shopFilter, statusFilter, debouncedOrderId, debouncedBuyer, debouncedProduct, fromDate, toDate]);

  const orderParams = useMemo(() => ({
    ...filterParams,
    page,
    per_page: perPage,
  }), [filterParams, page]);

  const { data: shops = [], isLoading: loadingShops } = useQuery({
    queryKey: ['marketplace-shops'],
    queryFn: () => db.integrations.Marketplace.listShops(),
  });

  const tiktokShops = useMemo(
    () => shops.filter((shop) => shop.platform === 'tiktok_shop'),
    [shops],
  );

  const filteredShops = useMemo(() => (
    platformFilter === 'all'
      ? shops
      : shops.filter((shop) => shop.platform === platformFilter)
  ), [shops, platformFilter]);

  const { data: ordersResponse, isLoading: loadingOrders, refetch: refetchOrders } = useQuery({
    queryKey: ['marketplace-orders', orderParams],
    queryFn: () => db.integrations.Marketplace.listOrders(orderParams),
    refetchOnMount: 'always',
    staleTime: 0,
  });

  const orders = ordersResponse?.data ?? [];
  const meta = ordersResponse?.meta ?? {
    current_page: page,
    last_page: 1,
    per_page: perPage,
    total: orders.length,
    from: orders.length ? 1 : null,
    to: orders.length || null,
  };
  const stats = ordersResponse?.stats ?? {
    total: meta.total ?? orders.length,
    with_contact: 0,
    without_contact: 0,
    with_phone: 0,
    missing_phone: 0,
    items: 0,
  };

  const filterCount = activeFilterCount({
    platformFilter: platformFilter === 'tiktok_shop' ? '' : platformFilter,
    shopFilter,
    statusFilter,
    orderIdFilter,
    buyerFilter,
    productFilter,
    dateRange: fromDate || toDate,
  });

  useEffect(() => {
    if (page <= 1) return;
    listTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [page]);

  const exportOrders = async () => {
    setExporting(true);
    try {
      await db.integrations.Marketplace.exportOrders(filterParams);
      toast.success('Orders exported');
    } catch (error) {
      toastApiError(error, 'Failed to export orders');
    } finally {
      setExporting(false);
    }
  };

  const syncOrders = async () => {
    if (!syncShopId) {
      toast.error('Select a shop to sync');
      return;
    }
    if (syncStartDate && syncEndDate && syncStartDate > syncEndDate) {
      toast.error('Start date must be before end date');
      return;
    }

    const payload = {
      shop_connection_id: Number(syncShopId),
      page_size: 50,
      fetch_all: true,
      fetch_contacts: true,
      fetch_phones: false,
    };
    if (syncStartDate) payload.start_date = syncStartDate;
    if (syncEndDate) payload.end_date = syncEndDate;

    setSyncing(true);
    try {
      const result = await db.integrations.Marketplace.syncOrders(payload);
      await queryClient.invalidateQueries({ queryKey: ['marketplace-shops'] });
      await queryClient.invalidateQueries({ queryKey: ['marketplace-orders'] });
      await refetchOrders();
      const sync = result.sync || {};
      const ordersCount = Number(sync.synced ?? 0);
      const unmasked = Number(sync.unmasked ?? (
        (sync.names_revealed || 0) + (sync.addresses_revealed || 0) + (sync.phones_synced || 0)
      ));
      toast.success(
        result.message
        || `Synced ${ordersCount} order(s) · ${unmasked} unmasked reveal(s).`,
      );
      setSyncModalOpen(false);
    } catch (error) {
      const raw = String(error?.message || error || '');
      if (/failed to fetch|networkerror|load failed/i.test(raw)) {
        toast.error('Sync timed out or lost connection. Try a smaller date range, or sync again — already-saved orders will be skipped.');
      } else {
        toastApiError(error, 'Failed to sync orders');
      }
    } finally {
      setSyncing(false);
    }
  };

  const revealPhones = async () => {
    if (!phoneShopId) {
      toast.error('Select a shop');
      return;
    }
    if (phoneStartDate && phoneEndDate && phoneStartDate > phoneEndDate) {
      toast.error('Start date must be before end date');
      return;
    }

    const payload = {
      shop_connection_id: Number(phoneShopId),
      limit: Math.min(30, Math.max(1, Number(phoneLimit) || 15)),
    };
    if (phoneStartDate) payload.start_date = phoneStartDate;
    if (phoneEndDate) payload.end_date = phoneEndDate;

    setRevealingPhones(true);
    try {
      const result = await db.integrations.Marketplace.revealOrderPhones(payload);
      await queryClient.invalidateQueries({ queryKey: ['marketplace-orders'] });
      await refetchOrders();
      const reveal = result.reveal || {};
      toast.success(
        result.message
        || `Revealed ${Number(reveal.revealed || 0)} phone(s) · ${Number(reveal.remaining || 0)} still missing.`,
      );
      setPhoneModalOpen(false);
    } catch (error) {
      toastApiError(error, 'Failed to reveal phones');
    } finally {
      setRevealingPhones(false);
    }
  };

  const clearBrowseFilters = () => {
    setPlatformFilter('tiktok_shop');
    setShopFilter('all');
    setStatusFilter('all');
    setOrderIdFilter('');
    setBuyerFilter('');
    setProductFilter('');
    setDebouncedOrderId('');
    setDebouncedBuyer('');
    setDebouncedProduct('');
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  const filterControls = (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Order number</Label>
          <Input
            className="h-10"
            value={orderIdFilter}
            onChange={(e) => setOrderIdFilter(e.target.value)}
            placeholder="e.g. 58500…"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Customer</Label>
          <Input
            className="h-10"
            value={buyerFilter}
            onChange={(e) => setBuyerFilter(e.target.value)}
            placeholder="Name or phone"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Product</Label>
          <Input
            className="h-10"
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            placeholder="Product name"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Platform</Label>
          <Select value={platformFilter} onValueChange={(v) => { setPlatformFilter(v); setShopFilter('all'); }}>
            <SelectTrigger className="w-full h-10">
              <SelectValue placeholder="Platform" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All platforms</SelectItem>
              <SelectItem value="tiktok_shop">TikTok Shop</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Shop</Label>
          <Select value={shopFilter} onValueChange={setShopFilter}>
            <SelectTrigger className="w-full h-10">
              <SelectValue placeholder="Shop" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All shops</SelectItem>
              {filteredShops.map((shop) => (
                <SelectItem key={shop.id} value={String(shop.id)}>
                  {shop.shop_name || shop.shop_id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Order status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full h-10">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {ORDER_STATUS_FILTERS.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Order date</Label>
          <DateRangePicker
            from={fromDate}
            to={toDate}
            onChange={({ from, to }) => {
              setFromDate(from || '');
              setToDate(to || '');
            }}
            placeholder="Any date"
            allowClear
          />
        </div>
      </div>
      {filterCount > 0 && (
        <div className="flex justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={clearBrowseFilters}>
            Clear filters
          </Button>
        </div>
      )}
    </div>
  );

  const headerActions = (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="outline"
        onClick={exportOrders}
        disabled={exporting || loadingOrders || (meta.total ?? 0) < 1}
        className="gap-2"
      >
        {exporting
          ? <Loader2 className="w-4 h-4 animate-spin" />
          : <Download className="w-4 h-4" />}
        Export
      </Button>
      {canManage && (
        <>
          <Button
            variant="outline"
            onClick={() => {
              setPhoneShopId(syncShopId || (shopFilter !== 'all' ? shopFilter : ''));
              setPhoneModalOpen(true);
            }}
            className="gap-2"
          >
            <Phone className="w-4 h-4" />
            Reveal phones
          </Button>
          <Button onClick={() => setSyncModalOpen(true)} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Resync
          </Button>
        </>
      )}
    </div>
  );

  const content = (
    <>
      {!embedded ? (
        <PageHeader
          title="Orders"
          description="Marketplace customers and order items synced from Seller Center"
          actions={headerActions}
        />
      ) : (
        <div className="flex justify-end">{headerActions}</div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Orders" value={loadingOrders ? '…' : stats.total} icon={ClipboardList} color="blue" index={0} />
        <StatCard label="With contact" value={loadingOrders ? '…' : stats.with_contact} icon={User} color="success" index={1} />
        <StatCard label="With phone" value={loadingOrders ? '…' : stats.with_phone} icon={Phone} color="info" index={2} />
        <StatCard label="Missing phone" value={loadingOrders ? '…' : stats.missing_phone} icon={Phone} color="warning" index={3} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Order list</CardTitle>
              <CardDescription>
                {loadingOrders ? 'Loading…' : `${formatNumber(meta.total ?? 0)} order(s)`}
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="sm:hidden gap-1.5"
              onClick={() => setFiltersOpen((open) => !open)}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filters
              {filterCount > 0 && (
                <Badge variant="secondary" className="ml-0.5 h-5 px-1.5 text-[10px]">
                  {filterCount}
                </Badge>
              )}
              <ChevronDown className={cn('w-4 h-4 transition-transform', filtersOpen && 'rotate-180')} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className={cn('hidden sm:block', filtersOpen && '!block')}>
            {filterControls}
          </div>

          <div ref={listTopRef} className="space-y-3">
            {(loadingOrders || loadingShops) && orders.length === 0 && (
              <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Loading orders…
              </div>
            )}

            {!loadingOrders && orders.length === 0 && (
              <div className="rounded-xl border border-dashed p-8 text-center space-y-2">
                <Store className="w-8 h-8 mx-auto text-muted-foreground/60" />
                <p className="text-sm font-medium">No orders yet</p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  {canManage
                    ? 'Use Resync to pull TikTok orders, items, and customer contact details for a date range.'
                    : 'Ask someone with orders.manage to sync TikTok orders.'}
                </p>
              </div>
            )}

            {orders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>

          {meta.last_page > 1 && (
            <div className="flex items-center justify-between gap-3 pt-1">
              <p className="text-xs text-muted-foreground">
                Page {formatNumber(meta.current_page)} of {formatNumber(meta.last_page)}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page >= meta.last_page}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={syncModalOpen} onOpenChange={setSyncModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sync orders</DialogTitle>
            <DialogDescription>
              Pull orders, items, buyer name, and address. Phones are skipped here to avoid TikTok reveal limits — use Reveal phones afterward.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Shop</Label>
              <Select value={syncShopId || 'none'} onValueChange={(v) => setSyncShopId(v === 'none' ? '' : v)}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Shop to sync" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select shop</SelectItem>
                  {tiktokShops.map((shop) => (
                    <SelectItem key={shop.id} value={String(shop.id)}>
                      TikTok Shop — {shop.shop_name || shop.shop_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Date range</Label>
              <DateRangePicker
                from={syncStartDate}
                to={syncEndDate}
                onChange={({ from, to }) => {
                  setSyncStartDate(from);
                  setSyncEndDate(to);
                }}
                placeholder="Select date range"
                allowClear={false}
              />
            </div>
            {tiktokShops.length === 0 && (
              <p className="text-xs text-amber-700 dark:text-amber-300">
                No TikTok cookie shops found. Add one under Marketplace → TikTok Shop.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setSyncModalOpen(false)} disabled={syncing}>
              Cancel
            </Button>
            <Button type="button" onClick={syncOrders} disabled={syncing || !syncShopId}>
              {syncing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Sync all matching
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={phoneModalOpen} onOpenChange={setPhoneModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reveal missing phones</DialogTitle>
            <DialogDescription>
              Backfills phones for active orders missing them (5 at a time). Unpaid, canceled, and completed orders are skipped — TikTok blocks those. Run another batch if some remain.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Shop</Label>
              <Select value={phoneShopId || 'none'} onValueChange={(v) => setPhoneShopId(v === 'none' ? '' : v)}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Shop" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select shop</SelectItem>
                  {tiktokShops.map((shop) => (
                    <SelectItem key={shop.id} value={String(shop.id)}>
                      TikTok Shop — {shop.shop_name || shop.shop_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Order date range</Label>
              <DateRangePicker
                from={phoneStartDate}
                to={phoneEndDate}
                onChange={({ from, to }) => {
                  setPhoneStartDate(from);
                  setPhoneEndDate(to);
                }}
                placeholder="Select date range"
                allowClear={false}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Batch size</Label>
              <Select value={phoneLimit} onValueChange={setPhoneLimit}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 phones</SelectItem>
                  <SelectItem value="10">10 phones</SelectItem>
                  <SelectItem value="15">15 phones</SelectItem>
                  <SelectItem value="20">20 phones</SelectItem>
                  <SelectItem value="30">30 phones</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              Missing phones now: {formatNumber(stats.missing_phone || 0)}. A 15-phone batch usually finishes in a few seconds.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setPhoneModalOpen(false)} disabled={revealingPhones}>
              Cancel
            </Button>
            <Button type="button" onClick={revealPhones} disabled={revealingPhones || !phoneShopId}>
              {revealingPhones ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Phone className="w-4 h-4 mr-2" />}
              Reveal batch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  if (embedded) {
    return <div className="space-y-6">{content}</div>;
  }

  return <PageContent>{content}</PageContent>;
}
