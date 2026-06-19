import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Pencil } from 'lucide-react';

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
  return (
    <Card
      className={`group hover:border-primary/30 transition-colors ${canManage ? 'cursor-pointer' : ''} ${className}`}
      onClick={() => canManage && onEdit?.()}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="w-4 h-4" />
              </span>
              <span className="truncate">{title}</span>
            </CardTitle>
            {description && <CardDescription className="text-xs">{description}</CardDescription>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {enabled !== undefined && (
              <Badge variant={enabled ? 'default' : 'secondary'} className="text-[10px]">
                {enabled ? 'Enabled' : 'Disabled'}
              </Badge>
            )}
            {onEdit && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 opacity-60 group-hover:opacity-100"
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                disabled={!canManage}
              >
                <Pencil className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {children}
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between items-center gap-3 py-1.5 border-b border-border last:border-0">
            <span className="text-sm">{row.label}</span>
            {row.badge ? (
              <Badge variant="secondary" className="text-xs shrink-0">{row.value}</Badge>
            ) : (
              <span className="text-xs text-muted-foreground text-right truncate max-w-[55%]">{row.value}</span>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
