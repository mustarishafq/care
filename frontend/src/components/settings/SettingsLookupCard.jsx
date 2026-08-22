import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadgePreview } from '@/components/settings/StatusColorPreview';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDisplayFormat } from '@/lib/DisplayFormatProvider';

const PREVIEW_LIMIT = 6;

export default function SettingsLookupCard({ section, items = [], canManage, onEdit }) {
  const Icon = section.icon;
  const { formatNumber } = useDisplayFormat();
  const preview = items.slice(0, PREVIEW_LIMIT);
  const remaining = Math.max(0, items.length - PREVIEW_LIMIT);
  const clickable = canManage;

  return (
    <Card
      className={cn(
        'rounded-2xl border border-border shadow-sm transition-all duration-300 group overflow-hidden',
        'hover:shadow-lg hover:shadow-primary/5 hover:border-primary/30',
        clickable && 'cursor-pointer',
      )}
      onClick={() => clickable && onEdit(section)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Icon className="w-5 h-5" />
            </span>
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-base truncate">{section.label}</CardTitle>
              <CardDescription className="text-xs line-clamp-2">{section.description}</CardDescription>
            </div>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 shrink-0 text-muted-foreground opacity-70 group-hover:opacity-100 group-hover:text-primary"
            onClick={(e) => { e.stopPropagation(); onEdit(section); }}
            disabled={!canManage}
            aria-label={`${canManage ? 'Edit' : 'View'} ${section.label}`}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-2xl font-bold tracking-tight tabular-nums leading-none">
          {formatNumber(items.length)}
          <span className="ml-1.5 text-xs font-medium text-muted-foreground">
            {items.length === 1 ? 'item' : 'items'}
          </span>
        </p>
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground">No items yet{canManage ? ' — click to add.' : '.'}</p>
        ) : section.key === 'complaint_statuses' ? (
          <div className="flex flex-wrap gap-1.5">
            {preview.map((item) => (
              <StatusBadgePreview key={item.id} name={item.name} color={item.color} />
            ))}
            {remaining > 0 && (
              <Badge variant="secondary" className="text-xs font-normal">+{remaining}</Badge>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {preview.map((item) => (
              <Badge key={item.id} variant="outline" className="text-xs font-normal">{item.name}</Badge>
            ))}
            {remaining > 0 && (
              <Badge variant="secondary" className="text-xs font-normal">+{remaining}</Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
