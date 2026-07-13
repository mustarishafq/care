import { db } from '@/api/db';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import {
  Star, Loader2, RefreshCw, MessageSquare, ExternalLink, Store,
  ChevronDown, SlidersHorizontal, CalendarDays, ChevronLeft, ChevronRight,
} from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import PageContent from '@/components/layout/PageContent';
import StatCard from '@/components/dashboard/StatCard';
import ProofImageGallery from '@/components/complaints/ProofImageGallery';
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

function Stars({ rating, size = 'sm' }) {
  const value = Number(rating) || 0;
  const iconClass = size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5';

  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(
            iconClass,
            n <= value ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30',
          )}
        />
      ))}
      <span className="ml-1.5 text-xs font-medium text-muted-foreground tabular-nums">{value || '—'}/5</span>
    </span>
  );
}

function activeFilterCount(filters) {
  return Object.values(filters).filter((v) => v && v !== 'all').length;
}

function hasReply(review) {
  if (typeof review?.has_seller_reply === 'boolean') {
    return review.has_seller_reply;
  }
  if (Number(review?.reply_count) > 0) {
    return true;
  }
  return Boolean(review?.seller_reply && String(review.seller_reply).trim());
}

function reviewGalleryItems(review) {
  return (review.review_images || []).flatMap((img, index) => {
    const url = img.url || img.thumb_url;
    if (!url) return [];
    return [{
      url,
      path: `review-${review.id}-${index}`,
      name: `Review photo ${index + 1}`,
      isImage: true,
    }];
  });
}

function ReviewCard({
  review,
  canManage,
  replyOpen,
  onToggleReply,
  replyDrafts,
  setReplyDrafts,
  replyingId,
  onSubmitReply,
  highlighted = false,
  cardRef = null,
}) {
  const replied = hasReply(review);
  const canReply = canManage && !replied && ['tiktok_shop', 'shopee'].includes(review.platform);
  const galleryItems = reviewGalleryItems(review);
  const reviewPhotoCount = (review.review_images || []).length;
  const reviewedAt = review.review_created_at ? new Date(review.review_created_at) : null;
  const { formatDate, formatDateTime, formatNumber } = useDisplayFormat();

  return (
    <article
      ref={cardRef}
      id={`review-${review.id}`}
      className={cn(
        'rounded-xl sm:rounded-2xl border bg-card/50 p-3.5 sm:p-5 space-y-3 transition-all duration-500 scroll-mt-24',
        highlighted
          ? 'border-amber-400 bg-amber-50/70 ring-2 ring-amber-400/60 dark:bg-amber-950/30 dark:border-amber-500 dark:ring-amber-500/40'
          : 'hover:bg-card',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2 min-w-0 flex-1">
          <Stars rating={review.rating} size="md" />
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="text-[10px] sm:text-xs font-normal">
              {platformLabel(review.platform)}
            </Badge>
            {review.shop_name && (
              <Badge variant="secondary" className="max-w-[140px] sm:max-w-[200px] truncate text-[10px] sm:text-xs font-normal">
                {review.shop_name}
              </Badge>
            )}
            <Badge
              variant={replied ? 'secondary' : 'outline'}
              className={cn(
                'text-[10px] sm:text-xs font-normal',
                replied
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                  : 'text-amber-700 border-amber-200 dark:text-amber-300 dark:border-amber-800',
              )}
            >
              {replied ? 'Replied' : 'Needs reply'}
            </Badge>
            {reviewPhotoCount > 0 && (
              <Badge variant="outline" className="text-[10px] sm:text-xs font-normal">
                {formatNumber(reviewPhotoCount)} photo{reviewPhotoCount === 1 ? '' : 's'}
              </Badge>
            )}
            {review.complaint_id && (
              <Link
                to={`/complaints/${review.complaint_id}`}
                className="text-[10px] sm:text-xs text-primary inline-flex items-center gap-1 hover:underline py-0.5"
              >
                Ticket <ExternalLink className="w-3 h-3 shrink-0" />
              </Link>
            )}
          </div>
        </div>
        {reviewedAt && (
          <time className="text-[11px] sm:text-xs text-muted-foreground shrink-0 inline-flex items-center gap-1 pt-0.5 text-right">
            <CalendarDays className="w-3.5 h-3.5 hidden sm:inline" />
            <span className="md:hidden">{formatDate(reviewedAt)}</span>
            <span className="hidden md:inline">{formatDateTime(reviewedAt)}</span>
          </time>
        )}
      </div>

      <div className="space-y-1.5">
        <h3 className="font-medium text-sm leading-snug line-clamp-2 sm:line-clamp-none">
          {review.product_name || review.external_product_id || 'Untitled product'}
        </h3>
        <p className="text-sm leading-relaxed text-foreground/80 break-words whitespace-pre-wrap">
          {review.review_text?.trim() ? review.review_text : (
            <span className="text-muted-foreground italic">No written review (rating only)</span>
          )}
        </p>
        {review.reviewer_name && (
          <p className="text-xs text-muted-foreground">Buyer · {review.reviewer_name}</p>
        )}
      </div>

      {galleryItems.length > 0 && (
        <ProofImageGallery
          items={galleryItems}
          className="grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 max-w-none sm:max-w-md md:max-w-lg"
        />
      )}

      {replied && (
        <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/60 dark:bg-emerald-950/20 dark:border-emerald-900 p-3 space-y-1.5">
          <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300 inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <span className="inline-flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" />
              Your reply
            </span>
            {review.seller_replied_at && (
              <span className="font-normal text-emerald-700/70 dark:text-emerald-400/70">
                · {formatDate(review.seller_replied_at)}
              </span>
            )}
          </p>
          <p className="text-sm leading-relaxed break-words whitespace-pre-wrap text-foreground/90">
            {review.seller_reply?.trim()
              ? review.seller_reply
              : 'Reply exists on TikTok (text not available in this sync).'}
          </p>
        </div>
      )}

      {canReply && !replyOpen && (
        <div className="pt-0.5">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onToggleReply(review.id)}
            className="w-full sm:w-auto h-10 sm:h-9"
          >
            <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
            Write reply
          </Button>
        </div>
      )}

      {canReply && replyOpen && (
        <div className="rounded-xl border bg-muted/30 p-3 space-y-2.5">
          <Textarea
            placeholder="Write a seller reply…"
            value={replyDrafts[review.id] || ''}
            onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [review.id]: e.target.value }))}
            className="min-h-[96px] sm:min-h-[88px] text-sm bg-background"
            autoFocus
          />
          <div className="grid grid-cols-2 sm:flex sm:flex-row gap-2 sm:justify-end">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onToggleReply(null)}
              disabled={replyingId === review.id}
              className="h-10 sm:h-9"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => onSubmitReply(review.id)}
              disabled={replyingId === review.id}
              className="h-10 sm:h-9"
            >
              {replyingId === review.id ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Post reply
            </Button>
          </div>
        </div>
      )}
    </article>
  );
}

function SyncFields({
  shops,
  syncShopId,
  setSyncShopId,
  syncStartDate,
  setSyncStartDate,
  syncEndDate,
  setSyncEndDate,
  syncRating,
  setSyncRating,
  className,
}) {
  return (
    <div className={cn('grid grid-cols-1 sm:grid-cols-2 gap-3', className)}>
      <div className="space-y-1.5 sm:col-span-2">
        <Label className="text-xs text-muted-foreground">Shop</Label>
        <Select value={syncShopId || 'none'} onValueChange={(v) => setSyncShopId(v === 'none' ? '' : v)}>
          <SelectTrigger className="h-10">
            <SelectValue placeholder="Shop to sync" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Select shop</SelectItem>
            {shops.map((shop) => (
              <SelectItem key={shop.id} value={String(shop.id)}>
                {platformLabel(shop.platform)} — {shop.shop_name || shop.shop_id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5 sm:col-span-2">
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
      <div className="space-y-1.5 sm:col-span-2">
        <Label className="text-xs text-muted-foreground">Stars</Label>
        <Select value={syncRating} onValueChange={setSyncRating}>
          <SelectTrigger className="h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ratings</SelectItem>
            <SelectItem value="low">Low (≤3★)</SelectItem>
            <SelectItem value="5">5★ only</SelectItem>
            <SelectItem value="4">4★ only</SelectItem>
            <SelectItem value="3">3★ only</SelectItem>
            <SelectItem value="2">2★ only</SelectItem>
            <SelectItem value="1">1★ only</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export default function MarketplaceReviews() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasPermission } = usePermissions();
  const { formatNumber } = useDisplayFormat();
  const canManage = hasPermission('reviews.manage');
  const listTopRef = useRef(null);
  const focusedCardRef = useRef(null);

  const focusReviewId = searchParams.get('review') || '';
  const [highlightFocused, setHighlightFocused] = useState(Boolean(focusReviewId));

  const [platformFilter, setPlatformFilter] = useState('all');
  const [shopFilter, setShopFilter] = useState('all');
  const [productFilter, setProductFilter] = useState('all');
  const [ratingFilter, setRatingFilter] = useState('all');
  const [replyFilter, setReplyFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [syncShopId, setSyncShopId] = useState('');
  const [syncStartDate, setSyncStartDate] = useState(() => daysAgoIso(7));
  const [syncEndDate, setSyncEndDate] = useState(todayIso);
  const [syncRating, setSyncRating] = useState('all');
  const [syncing, setSyncing] = useState(false);
  const [replyDrafts, setReplyDrafts] = useState({});
  const [replyingId, setReplyingId] = useState(null);
  const [replyOpenId, setReplyOpenId] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [page, setPage] = useState(1);
  const perPage = 20;

  const { data: products = [] } = useQuery({
    queryKey: ['products', 'active'],
    queryFn: () => db.entities.Product.filter({ is_active: true }, 'name', 200),
  });

  const reviewParams = useMemo(() => {
    const params = { page, per_page: perPage };
    if (platformFilter !== 'all') params.platform = platformFilter;
    if (shopFilter !== 'all') params.shop_connection_id = Number(shopFilter);
    if (productFilter !== 'all') {
      const product = products.find((p) => String(p.id) === String(productFilter));
      if (product?.name) params.product_name = product.name;
    }
    if (ratingFilter === 'low') {
      params.max_rating = 3;
    } else if (ratingFilter !== 'all') {
      params.min_rating = Number(ratingFilter);
      params.max_rating = Number(ratingFilter);
    }
    if (replyFilter === 'replied' || replyFilter === 'unreplied') {
      params.reply_status = replyFilter;
    }
    if (fromDate) params.start_date = fromDate;
    if (toDate) params.end_date = toDate;
    return params;
  }, [platformFilter, shopFilter, productFilter, products, ratingFilter, replyFilter, fromDate, toDate, page]);

  const { data: shops = [], isLoading: loadingShops } = useQuery({
    queryKey: ['marketplace-shops'],
    queryFn: () => db.integrations.Marketplace.listShops(),
  });

  const { data: reviewsResponse, isLoading: loadingReviews, refetch: refetchReviews } = useQuery({
    queryKey: ['marketplace-reviews', reviewParams],
    queryFn: () => db.integrations.Marketplace.listReviews(reviewParams),
    refetchOnMount: 'always',
    staleTime: 0,
  });

  const {
    data: focusedReview,
    isLoading: loadingFocused,
    isError: focusedMissing,
  } = useQuery({
    queryKey: ['marketplace-review', focusReviewId],
    queryFn: () => db.integrations.Marketplace.getReview(focusReviewId),
    enabled: Boolean(focusReviewId),
    retry: false,
  });

  const reviews = reviewsResponse?.data ?? [];
  const meta = reviewsResponse?.meta ?? {
    current_page: page,
    last_page: 1,
    per_page: perPage,
    total: reviews.length,
    from: reviews.length ? 1 : null,
    to: reviews.length || null,
  };

  const stats = reviewsResponse?.stats ?? {
    total: meta.total ?? reviews.length,
    unreplied: 0,
    replied: 0,
    low: 0,
  };

  const listReviews = useMemo(() => {
    if (!focusedReview?.id) return reviews;
    return reviews.filter((review) => String(review.id) !== String(focusedReview.id));
  }, [reviews, focusedReview]);

  const clearFocusedReview = () => {
    setHighlightFocused(false);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('review');
      return next;
    }, { replace: true });
  };

  useEffect(() => {
    if (!focusReviewId) {
      setHighlightFocused(false);
      return;
    }
    setHighlightFocused(true);
  }, [focusReviewId]);

  useEffect(() => {
    if (!focusedReview?.id || !focusedCardRef.current) return;
    focusedCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const timer = window.setTimeout(() => setHighlightFocused(false), 4000);
    return () => window.clearTimeout(timer);
  }, [focusedReview?.id]);

  const filteredShops = useMemo(() => (
    platformFilter === 'all'
      ? shops
      : shops.filter((shop) => shop.platform === platformFilter)
  ), [shops, platformFilter]);

  const filterCount = activeFilterCount({
    platformFilter,
    shopFilter,
    productFilter,
    ratingFilter,
    replyFilter,
    dateRange: fromDate || toDate,
  });

  const resetToFirstPage = () => setPage(1);

  useEffect(() => {
    if (page <= 1) return;
    listTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [page]);

  const syncReviews = async () => {
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
    };

    if (syncStartDate) payload.start_date = syncStartDate;
    if (syncEndDate) payload.end_date = syncEndDate;

    if (syncRating === 'low') {
      payload.min_rating = 1;
      payload.max_rating = 3;
    } else if (syncRating !== 'all') {
      payload.min_rating = Number(syncRating);
      payload.max_rating = Number(syncRating);
    }

    setSyncing(true);
    try {
      const result = await db.integrations.Marketplace.syncReviews(payload);
      await queryClient.invalidateQueries({ queryKey: ['marketplace-shops'] });
      await queryClient.invalidateQueries({ queryKey: ['marketplace-reviews'] });
      await refetchReviews();
      const created = result.sync?.created_complaints ?? 0;
      toast.success(`${result.message}${created ? ` · ${created} complaint(s) auto-created` : ''}`);
      setSyncModalOpen(false);
    } catch (error) {
      toastApiError(error, 'Failed to sync reviews');
    } finally {
      setSyncing(false);
    }
  };

  const submitReply = async (reviewId) => {
    const content = (replyDrafts[reviewId] || '').trim();
    if (!content) {
      toast.error('Reply text is required');
      return;
    }
    setReplyingId(reviewId);
    try {
      await db.integrations.Marketplace.replyToReview(reviewId, content);
      setReplyDrafts((prev) => ({ ...prev, [reviewId]: '' }));
      setReplyOpenId(null);
      await Promise.all([
        refetchReviews(),
        queryClient.invalidateQueries({ queryKey: ['marketplace-review', String(reviewId)] }),
      ]);
      toast.success('Reply posted');
    } catch (error) {
      toastApiError(error, 'Failed to post reply');
    } finally {
      setReplyingId(null);
    }
  };

  const clearBrowseFilters = () => {
    setPlatformFilter('all');
    setShopFilter('all');
    setProductFilter('all');
    setRatingFilter('all');
    setReplyFilter('all');
    setFromDate('');
    setToDate('');
    resetToFirstPage();
  };

  const filterControls = (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Platform</Label>
          <Select value={platformFilter} onValueChange={(v) => { setPlatformFilter(v); setShopFilter('all'); resetToFirstPage(); }}>
            <SelectTrigger className="w-full h-10">
              <SelectValue placeholder="Platform" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All platforms</SelectItem>
              <SelectItem value="tiktok_shop">TikTok Shop</SelectItem>
              <SelectItem value="shopee">Shopee</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Shop</Label>
          <Select value={shopFilter} onValueChange={(v) => { setShopFilter(v); resetToFirstPage(); }}>
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
          <Label className="text-xs text-muted-foreground">Product</Label>
          <Select value={productFilter} onValueChange={(v) => { setProductFilter(v); resetToFirstPage(); }}>
            <SelectTrigger className="w-full h-10">
              <SelectValue placeholder="Product" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All products</SelectItem>
              {products.map((product) => (
                <SelectItem key={product.id} value={String(product.id)}>
                  {product.name}{product.sku ? ` (${product.sku})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Rating</Label>
          <Select value={ratingFilter} onValueChange={(v) => { setRatingFilter(v); resetToFirstPage(); }}>
            <SelectTrigger className="w-full h-10">
              <SelectValue placeholder="Rating" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All ratings</SelectItem>
              <SelectItem value="low">Low (≤3★)</SelectItem>
              <SelectItem value="5">5★ only</SelectItem>
              <SelectItem value="4">4★ only</SelectItem>
              <SelectItem value="3">3★ only</SelectItem>
              <SelectItem value="2">2★ only</SelectItem>
              <SelectItem value="1">1★ only</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Reply</Label>
          <Select value={replyFilter} onValueChange={(v) => { setReplyFilter(v); resetToFirstPage(); }}>
            <SelectTrigger className="w-full h-10">
              <SelectValue placeholder="Reply status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All replies</SelectItem>
              <SelectItem value="unreplied">Needs reply</SelectItem>
              <SelectItem value="replied">Already replied</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Date range</Label>
          <DateRangePicker
            from={fromDate}
            to={toDate}
            onChange={({ from, to }) => {
              setFromDate(from);
              setToDate(to);
              resetToFirstPage();
            }}
            placeholder="Any dates"
            className="w-full"
          />
        </div>
        {filterCount > 0 && (
          <div className="flex items-end">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={clearBrowseFilters}
              className="h-10 px-3 text-muted-foreground"
            >
              Clear
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader
        icon={Star}
        title="Reviews"
        description="Sync and reply to product reviews across TikTok Shop and Shopee"
        actions={canManage ? (
          <Button onClick={() => setSyncModalOpen(true)} className="w-full sm:w-auto">
            <RefreshCw className="w-4 h-4 mr-2" />
            Resync
          </Button>
        ) : null}
      />

      <PageContent className="space-y-4 md:space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3 md:gap-4">
          <StatCard label="Total" value={loadingReviews ? '…' : stats.total} icon={Star} color="blue" index={0} />
          <StatCard label="Needs reply" value={loadingReviews ? '…' : stats.unreplied} icon={MessageSquare} color="warning" index={1} />
          <StatCard label="Replied" value={loadingReviews ? '…' : stats.replied} icon={MessageSquare} color="success" index={2} />
          <StatCard label="Low (≤3★)" value={loadingReviews ? '…' : stats.low} icon={Store} color="purple" index={3} />
        </div>

        <div ref={listTopRef} className="scroll-mt-20 md:scroll-mt-24" />

        <Card className="rounded-xl sm:rounded-2xl border shadow-sm">
          <CardHeader className="pb-3 px-3.5 sm:px-5 pt-3.5 sm:pt-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4 text-muted-foreground shrink-0" />
                  Filters
                  {filterCount > 0 && (
                    <Badge variant="secondary" className="text-[10px] font-normal">{filterCount} active</Badge>
                  )}
                </CardTitle>
                <CardDescription className="mt-1">
                  Narrow the stored review list
                </CardDescription>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="md:hidden h-8 px-2 text-muted-foreground"
                onClick={() => setFiltersOpen((open) => !open)}
                aria-expanded={filtersOpen}
              >
                <ChevronDown className={cn('h-4 w-4 transition-transform', filtersOpen && 'rotate-180')} />
              </Button>
            </div>
          </CardHeader>
          <CardContent className={cn('pt-0 px-3.5 sm:px-5 pb-3.5 sm:pb-5', !filtersOpen && 'hidden md:block')}>
            {filterControls}
          </CardContent>
        </Card>

        <Card className="rounded-xl sm:rounded-2xl border shadow-sm overflow-hidden">
          <CardHeader className="pb-3 px-3.5 sm:px-5 pt-3.5 sm:pt-5">
            <div className="flex items-baseline justify-between gap-2">
              <CardTitle className="text-sm sm:text-base">
                {loadingReviews
                  ? 'Loading…'
                  : `${formatNumber(meta.from ?? 0, { empty: '0' })}–${formatNumber(meta.to ?? 0, { empty: '0' })} of ${formatNumber(meta.total ?? 0, { empty: '0' })}`}
              </CardTitle>
              <p className="text-xs text-muted-foreground shrink-0">reviews</p>
            </div>
          </CardHeader>
          <CardContent className="pt-0 px-3.5 sm:px-5 pb-3.5 sm:pb-5 space-y-3 sm:space-y-4">
            {focusReviewId && (
              <div className="space-y-2.5 sm:space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                    Review from notification
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2 text-muted-foreground"
                    onClick={clearFocusedReview}
                  >
                    Clear
                  </Button>
                </div>
                {loadingFocused ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading review…
                  </div>
                ) : focusedMissing || !focusedReview ? (
                  <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground text-center">
                    That review could not be found. It may have been removed.
                  </div>
                ) : (
                  <ReviewCard
                    review={focusedReview}
                    canManage={canManage}
                    replyOpen={replyOpenId === focusedReview.id}
                    onToggleReply={(id) => setReplyOpenId(id)}
                    replyDrafts={replyDrafts}
                    setReplyDrafts={setReplyDrafts}
                    replyingId={replyingId}
                    onSubmitReply={submitReply}
                    highlighted={highlightFocused}
                    cardRef={focusedCardRef}
                  />
                )}
              </div>
            )}

            {loadingReviews || loadingShops ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-10 justify-center">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading reviews…
              </div>
            ) : listReviews.length === 0 && !focusedReview ? (
              <div className="py-10 text-center space-y-2 px-2 sm:px-4">
                <p className="text-sm font-medium">No reviews match these filters</p>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Add a shop cookie under Marketplace → TikTok Shop or Shopee, then tap Resync.
                </p>
              </div>
            ) : (
              <>
                {listReviews.length > 0 && (
                  <div className="space-y-2.5 sm:space-y-3">
                    {focusReviewId && (
                      <p className="text-xs text-muted-foreground pt-1">All reviews</p>
                    )}
                    {listReviews.map((review) => (
                      <ReviewCard
                        key={review.id}
                        review={review}
                        canManage={canManage}
                        replyOpen={replyOpenId === review.id}
                        onToggleReply={(id) => setReplyOpenId(id)}
                        replyDrafts={replyDrafts}
                        setReplyDrafts={setReplyDrafts}
                        replyingId={replyingId}
                        onSubmitReply={submitReply}
                      />
                    ))}
                  </div>
                )}

                {meta.last_page > 1 && (
                  <div className="sticky bottom-0 -mx-3.5 sm:-mx-5 px-3.5 sm:px-5 pt-3 pb-1 sm:pb-0 sm:static sm:border-0 border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 sm:bg-transparent sm:backdrop-blur-none">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-3">
                      <p className="text-xs text-muted-foreground text-center sm:text-left order-2 sm:order-1">
                        Page {meta.current_page} of {meta.last_page}
                      </p>
                      <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 order-1 sm:order-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={meta.current_page <= 1 || loadingReviews}
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          className="h-10 sm:h-9"
                        >
                          <ChevronLeft className="w-4 h-4 mr-1" />
                          Previous
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={meta.current_page >= meta.last_page || loadingReviews}
                          onClick={() => setPage((p) => p + 1)}
                          className="h-10 sm:h-9"
                        >
                          Next
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </PageContent>

      {canManage && (
        <Dialog open={syncModalOpen} onOpenChange={(open) => !syncing && setSyncModalOpen(open)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Sync from platform</DialogTitle>
              <DialogDescription>
                Pulls every matching review in the date range (all pages). Existing reviews are updated, not duplicated.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <SyncFields
                shops={shops}
                syncShopId={syncShopId}
                setSyncShopId={setSyncShopId}
                syncStartDate={syncStartDate}
                setSyncStartDate={setSyncStartDate}
                syncEndDate={syncEndDate}
                setSyncEndDate={setSyncEndDate}
                syncRating={syncRating}
                setSyncRating={setSyncRating}
              />
              <p className="text-xs text-muted-foreground">
                Defaults to last 7 days so replies on older reviews are refreshed.
              </p>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setSyncModalOpen(false)}
                disabled={syncing}
              >
                Cancel
              </Button>
              <Button
                onClick={syncReviews}
                disabled={syncing || !syncShopId}
              >
                {syncing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                {syncing ? 'Syncing…' : 'Sync all matching'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
