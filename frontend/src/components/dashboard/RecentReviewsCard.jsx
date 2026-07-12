import React from 'react';
import { Link } from 'react-router-dom';
import { Star, MessageSquare, ArrowRight } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useDisplayFormat } from '@/lib/DisplayFormatProvider';
import { cn } from '@/lib/utils';

const PLATFORM_LABELS = {
  tiktok_shop: 'TikTok',
  shopee: 'Shopee',
};

function Stars({ rating }) {
  const value = Number(rating) || 0;

  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(
            'w-3 h-3',
            n <= value ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30',
          )}
        />
      ))}
    </span>
  );
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

export default function RecentReviewsCard({ reviews = [], isLoading = false }) {
  const { formatDate } = useDisplayFormat();

  return (
    <Card className="rounded-2xl h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-500" />
            Reviews needing attention
          </CardTitle>
          <Button asChild variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground shrink-0">
            <Link to="/marketplace-reviews">
              View all
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-0 max-h-[340px] overflow-y-auto">
        {isLoading && (
          <div className="flex items-center justify-center py-10">
            <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        )}

        {!isLoading && reviews.length === 0 && (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No low-rated unreplied reviews
          </p>
        )}

        {!isLoading && reviews.map((review) => {
          const replied = hasReply(review);
          const reviewedAt = review.review_created_at ? new Date(review.review_created_at) : null;

          return (
            <Link
              key={review.id}
              to="/marketplace-reviews"
              className="flex items-start gap-3 py-3 border-b border-border last:border-0 hover:bg-muted/40 -mx-2 px-2 rounded-lg transition-colors"
            >
              {review.product_image_url ? (
                <img
                  src={review.product_image_url}
                  alt=""
                  className="w-10 h-10 rounded-lg object-cover shrink-0 bg-muted"
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <Star className="w-4 h-4 text-muted-foreground/50" />
                </div>
              )}
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Stars rating={review.rating} />
                  <Badge variant="outline" className="text-[10px] font-normal px-1.5 py-0">
                    {PLATFORM_LABELS[review.platform] ?? review.platform}
                  </Badge>
                  {!replied && (
                    <Badge
                      variant="outline"
                      className="text-[10px] font-normal px-1.5 py-0 text-amber-700 border-amber-200 dark:text-amber-300 dark:border-amber-800"
                    >
                      <MessageSquare className="w-2.5 h-2.5 mr-0.5" />
                      Needs reply
                    </Badge>
                  )}
                </div>
                <p className="text-sm font-medium truncate leading-snug">
                  {review.product_name || review.external_product_id || 'Untitled product'}
                </p>
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                  {review.review_text?.trim() || 'Rating only — no written review'}
                </p>
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  {review.shop_name && <span className="truncate max-w-[120px]">{review.shop_name}</span>}
                  {review.shop_name && reviewedAt && <span>·</span>}
                  {reviewedAt && <span>{formatDate(reviewedAt)}</span>}
                </div>
              </div>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
