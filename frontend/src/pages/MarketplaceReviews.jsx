import { db } from '@/api/db';

import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Star, Loader2, RefreshCw, MessageSquare, ExternalLink, Store, ChevronDown, SlidersHorizontal } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import PageContent from '@/components/layout/PageContent';
import StatCard from '@/components/dashboard/StatCard';
import { toast } from 'sonner';
import { usePermissions } from '@/lib/usePermissions';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const PLATFORM_LABELS = {
  tiktok_shop: 'TikTok Shop',
  shopee: 'Shopee',
};

function platformLabel(platform) {
  return PLATFORM_LABELS[platform] ?? platform;
}

function Stars({ rating }) {
  if (!rating) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center gap-1 text-amber-600">
      <Star className="w-3.5 h-3.5 fill-current" />
      {rating}/5
    </span>
  );
}

function activeFilterCount(platformFilter, shopFilter, ratingFilter) {
  return [platformFilter, shopFilter, ratingFilter].filter((v) => v !== 'all').length;
}

function ReviewCard({ review, canManage, replyDrafts, setReplyDrafts, replyingId, onSubmitReply }) {
  return (
    <div className="rounded-xl border p-3 sm:p-4 space-y-2.5 sm:space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0">
          <Stars rating={review.rating} />
          <Badge variant="outline" className="text-[10px] sm:text-xs">{platformLabel(review.platform)}</Badge>
          {review.shop_name && (
            <Badge variant="secondary" className="max-w-[140px] truncate text-[10px] sm:text-xs sm:max-w-none">
              {review.shop_name}
            </Badge>
          )}
          {review.complaint_id && (
            <Link
              to={`/complaints/${review.complaint_id}`}
              className="text-[10px] sm:text-xs text-primary inline-flex items-center gap-1 hover:underline"
            >
              Linked <ExternalLink className="w-3 h-3 shrink-0" />
            </Link>
          )}
        </div>
        {review.review_created_at && (
          <span className="text-[10px] sm:text-xs text-muted-foreground shrink-0">
            {format(new Date(review.review_created_at), 'dd MMM yyyy')}
          </span>
        )}
      </div>

      <p className="font-medium text-sm leading-snug line-clamp-2">
        {review.product_name || review.external_product_id}
      </p>
      <p className="text-sm text-muted-foreground leading-relaxed break-words">
        {review.review_text || '—'}
      </p>
      {review.reviewer_name && (
        <p className="text-xs text-muted-foreground">— {review.reviewer_name}</p>
      )}

      {review.seller_reply && (
        <div className="rounded-lg bg-muted p-2.5 sm:p-3 text-sm">
          <p className="text-xs font-medium mb-1 flex items-center gap-1">
            <MessageSquare className="w-3 h-3 shrink-0" /> Seller reply
          </p>
          <p className="break-words">{review.seller_reply}</p>
        </div>
      )}

      {canManage && !review.seller_reply && ['tiktok_shop', 'shopee'].includes(review.platform) && (
        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <Textarea
            placeholder="Write a seller reply…"
            value={replyDrafts[review.id] || ''}
            onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [review.id]: e.target.value }))}
            className="min-h-[72px] sm:min-h-[60px] flex-1 text-sm"
          />
          <Button
            size="sm"
            className="w-full sm:w-auto shrink-0"
            onClick={() => onSubmitReply(review.id)}
            disabled={replyingId === review.id}
          >
            {replyingId === review.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Reply'}
          </Button>
        </div>
      )}
    </div>
  );
}

export default function MarketplaceReviews() {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('oms.manage');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [shopFilter, setShopFilter] = useState('all');
  const [ratingFilter, setRatingFilter] = useState('all');
  const [syncShopId, setSyncShopId] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [replyDrafts, setReplyDrafts] = useState({});
  const [replyingId, setReplyingId] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const reviewParams = useMemo(() => {
    const params = { limit: 200 };
    if (platformFilter !== 'all') params.platform = platformFilter;
    if (shopFilter !== 'all') params.shop_connection_id = Number(shopFilter);
    if (ratingFilter === 'low') {
      params.max_rating = 3;
    } else if (ratingFilter !== 'all') {
      params.min_rating = Number(ratingFilter);
      params.max_rating = Number(ratingFilter);
    }
    return params;
  }, [platformFilter, shopFilter, ratingFilter]);

  const { data: shops = [], isLoading: loadingShops } = useQuery({
    queryKey: ['marketplace-shops'],
    queryFn: () => db.integrations.Marketplace.listShops(),
  });

  const { data: reviews = [], isLoading: loadingReviews, refetch: refetchReviews } = useQuery({
    queryKey: ['marketplace-reviews', reviewParams],
    queryFn: () => db.integrations.Marketplace.listReviews(reviewParams),
  });

  const stats = useMemo(() => ({
    total: reviews.length,
    low: reviews.filter((r) => r.rating && r.rating <= 3).length,
    linked: reviews.filter((r) => r.complaint_id).length,
    platforms: new Set(reviews.map((r) => r.platform)).size,
  }), [reviews]);

  const filteredShops = useMemo(() => (
    platformFilter === 'all'
      ? shops
      : shops.filter((shop) => shop.platform === platformFilter)
  ), [shops, platformFilter]);

  const filterCount = activeFilterCount(platformFilter, shopFilter, ratingFilter);

  const syncReviews = async () => {
    if (!syncShopId) {
      toast.error('Select a shop to sync');
      return;
    }
    setSyncing(true);
    try {
      const result = await db.integrations.Marketplace.syncReviews({
        shop_connection_id: Number(syncShopId),
        page_size: 50,
      });
      await refetchReviews();
      const created = result.sync?.created_complaints ?? 0;
      toast.success(`${result.message}${created ? ` (${created} complaint(s) auto-created)` : ''}`);
      queryClient.invalidateQueries({ queryKey: ['marketplace-reviews'] });
    } catch (error) {
      toast.error(error.message || 'Failed to sync reviews');
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
      await refetchReviews();
      toast.success('Reply posted');
    } catch (error) {
      toast.error(error.message || 'Failed to post reply');
    } finally {
      setReplyingId(null);
    }
  };

  const filterControls = (
    <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
      <Select value={platformFilter} onValueChange={(v) => { setPlatformFilter(v); setShopFilter('all'); }}>
        <SelectTrigger className="w-full sm:w-[160px] h-9">
          <SelectValue placeholder="Platform" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All platforms</SelectItem>
          <SelectItem value="tiktok_shop">TikTok Shop</SelectItem>
          <SelectItem value="shopee">Shopee</SelectItem>
        </SelectContent>
      </Select>
      <Select value={shopFilter} onValueChange={setShopFilter}>
        <SelectTrigger className="w-full sm:w-[200px] h-9">
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
      <Select value={ratingFilter} onValueChange={setRatingFilter}>
        <SelectTrigger className="w-full sm:w-[160px] h-9">
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
      <Button
        size="sm"
        variant="outline"
        onClick={() => refetchReviews()}
        disabled={loadingReviews}
        className="w-full sm:w-9 sm:px-0 h-9"
        aria-label="Refresh reviews"
      >
        {loadingReviews ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
        <span className="sm:hidden ml-2">Refresh</span>
      </Button>
    </div>
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        icon={Star}
        title="Reviews"
        description="Product reviews from TikTok Shop, Shopee, and connected platforms"
      />

      <PageContent className="space-y-4 sm:space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard label="Reviews" value={loadingReviews ? '…' : stats.total} icon={Star} color="blue" index={0} />
          <StatCard label="Low (≤3★)" value={loadingReviews ? '…' : stats.low} icon={Star} color="warning" index={1} />
          <StatCard label="Linked" value={loadingReviews ? '…' : stats.linked} icon={MessageSquare} color="purple" index={2} />
          <StatCard label="Platforms" value={loadingReviews ? '…' : stats.platforms} icon={Store} color="success" index={3} />
        </div>

        {canManage && (
          <Card className="rounded-2xl border shadow-sm">
            <CardContent className="p-3 sm:p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Select value={syncShopId || 'none'} onValueChange={(v) => setSyncShopId(v === 'none' ? '' : v)}>
                  <SelectTrigger className="w-full sm:flex-1 h-10">
                    <SelectValue placeholder="Shop to sync" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select shop to sync</SelectItem>
                    {shops.map((shop) => (
                      <SelectItem key={shop.id} value={String(shop.id)}>
                        {platformLabel(shop.platform)} — {shop.shop_name || shop.shop_id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={syncReviews}
                  disabled={syncing || !syncShopId}
                  className="w-full sm:w-auto h-10 shrink-0"
                >
                  {syncing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                  Sync from platform
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Mobile — collapsible filters */}
        <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen} className="sm:hidden">
          <Card className="rounded-2xl border shadow-sm">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 p-3 text-left"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <SlidersHorizontal className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="text-sm font-medium">Filters</span>
                  {filterCount > 0 && (
                    <Badge variant="secondary" className="text-[10px]">{filterCount} active</Badge>
                  )}
                </div>
                <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', filtersOpen && 'rotate-180')} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 pb-3 px-3">
                {filterControls}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Tablet/desktop — always-visible filters */}
        <Card className="rounded-2xl border shadow-sm hidden sm:block">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Filters</CardTitle>
            <CardDescription>TikTok Shop and Shopee reviews in one place</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {filterControls}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border shadow-sm">
          <CardHeader className="pb-3 sm:pb-6">
            <CardTitle className="text-base">
              {loadingReviews ? 'Loading…' : `${reviews.length} review${reviews.length === 1 ? '' : 's'}`}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {loadingReviews || loadingShops ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading reviews…
              </div>
            ) : reviews.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center px-2">
                No reviews yet. Connect a shop under Marketplace, then sync reviews here.
              </p>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {reviews.map((review) => (
                  <ReviewCard
                    key={review.id}
                    review={review}
                    canManage={canManage}
                    replyDrafts={replyDrafts}
                    setReplyDrafts={setReplyDrafts}
                    replyingId={replyingId}
                    onSubmitReply={submitReply}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </PageContent>
    </div>
  );
}
