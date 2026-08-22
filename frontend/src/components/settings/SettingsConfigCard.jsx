import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function SettingsConfigCard({
  title,
  description,
  icon: Icon,
  enabled,
  canManage,
  onEdit,
  rows = [],
  children = null,
  className = '',
}) {
  const clickable = canManage && onEdit;

  return (
    <Card
      className={cn(
        'relative rounded-2xl border border-border shadow-sm transition-all duration-300 group overflow-hidden',
        'hover:shadow-lg hover:shadow-primary/5 hover:border-primary/30',
        clickable && 'cursor-pointer',
        className,
      )}
      onClick={() => clickable && onEdit()}
    >
      {enabled !== undefined && (
        <span
          className={cn(
            'absolute inset-y-0 left-0 w-1',
            enabled ? 'bg-primary' : 'bg-muted-foreground/25',
          )}
        />
      )}
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Icon className="w-5 h-5" />
            </span>
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-base truncate">{title}</CardTitle>
              {description && <CardDescription className="text-xs">{description}</CardDescription>}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {enabled !== undefined && (
              <Badge
                variant={enabled ? 'default' : 'secondary'}
                className="text-[10px] gap-1"
              >
                <span className={cn('h-1.5 w-1.5 rounded-full', enabled ? 'bg-primary-foreground' : 'bg-muted-foreground')} />
                {enabled ? 'On' : 'Off'}
              </Badge>
            )}
            {onEdit && (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-muted-foreground opacity-70 group-hover:opacity-100 group-hover:text-primary"
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                disabled={!canManage}
                aria-label={`${canManage ? 'Edit' : 'View'} ${title}`}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {children}
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex justify-between items-center gap-3 py-2 border-b border-border/70 last:border-0"
          >
            <span className="text-sm text-muted-foreground">{row.label}</span>
            {row.badge ? (
              <Badge variant="secondary" className="text-xs shrink-0 tabular-nums">{row.value}</Badge>
            ) : (
              <span className="text-sm font-medium text-right truncate max-w-[55%]">{row.value}</span>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
