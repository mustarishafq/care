import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadgePreview } from '@/components/settings/StatusColorPreview';
import { Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';

const PREVIEW_LIMIT = 8;

export default function SettingsLookupCard({ section, items = [], canManage, onEdit }) {
  const Icon = section.icon;
  const preview = items.slice(0, PREVIEW_LIMIT);
  const remaining = Math.max(0, items.length - PREVIEW_LIMIT);

  return (
    <Card
      className={cn(
        'rounded-2xl border border-border shadow-sm transition-all duration-300 group',
        'hover:shadow-lg hover:shadow-primary/5 hover:border-primary/30',
        canManage && 'cursor-pointer',
      )}
      onClick={() => canManage && onEdit(section)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="w-4 h-4" />
              </span>
              <span className="truncate">{section.label}</span>
            </CardTitle>
            <CardDescription className="text-xs line-clamp-2">{section.description}</CardDescription>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="secondary" className="text-[10px] tabular-nums">{items.length}</Badge>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 opacity-60 group-hover:opacity-100"
              onClick={(e) => { e.stopPropagation(); onEdit(section); }}
              disabled={!canManage}
            >
              <Pencil className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground">No items yet. Click to add.</p>
        ) : section.key === 'complaint_statuses' ? (
          <div className="flex flex-wrap gap-1.5">
            {preview.map((item) => (
              <StatusBadgePreview key={item.id} name={item.name} color={item.color} />
            ))}
            {remaining > 0 && (
              <Badge variant="secondary" className="text-xs font-normal">+{remaining} more</Badge>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {preview.map((item) => (
              <Badge key={item.id} variant="outline" className="text-xs font-normal">{item.name}</Badge>
            ))}
            {remaining > 0 && (
              <Badge variant="secondary" className="text-xs font-normal">+{remaining} more</Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
