import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useDisplayFormat } from '@/lib/DisplayFormatProvider';
import { ChevronDown, ChevronUp, Loader2, Plus, Search, ShoppingBag, Trash2 } from 'lucide-react';

export default function OrderSourcesDialog({
  open,
  onOpenChange,
  sources = [],
  onSourcesChange,
  saving = false,
  onSave,
}) {
  const [search, setSearch] = useState('');
  const [newSource, setNewSource] = useState('');
  const { formatNumber } = useDisplayFormat();

  const normalizedSearch = search.trim().toLowerCase();
  const canReorder = !normalizedSearch;

  const visible = useMemo(() => {
    const mapped = sources.map((source, index) => ({ source, index }));
    if (!normalizedSearch) return mapped;
    return mapped.filter(({ source }) => source.toLowerCase().includes(normalizedSearch));
  }, [sources, normalizedSearch]);

  const handleOpenChange = (next) => {
    if (!next) {
      setSearch('');
      setNewSource('');
    }
    onOpenChange(next);
  };

  const updateSource = (index, value) => {
    onSourcesChange(sources.map((item, i) => (i === index ? value : item)));
  };

  const removeSource = (index) => {
    onSourcesChange(sources.filter((_, i) => i !== index));
  };

  const moveSource = (index, direction) => {
    const to = index + direction;
    if (to < 0 || to >= sources.length) return;
    const next = [...sources];
    const [moved] = next.splice(index, 1);
    next.splice(to, 0, moved);
    onSourcesChange(next);
  };

  const addSource = () => {
    const name = newSource.trim();
    if (!name) return;
    const exists = sources.some((item) => item.trim().toLowerCase() === name.toLowerCase());
    if (!exists) {
      onSourcesChange([...sources, name]);
    }
    setNewSource('');
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-lg max-h-[90vh] p-0 gap-0 flex flex-col overflow-hidden rounded-xl sm:rounded-2xl">
        <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 pr-12 shrink-0 border-b border-border/70 text-left">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShoppingBag className="w-5 h-5" />
            </span>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <DialogTitle>Order sources</DialogTitle>
                <Badge variant="secondary" className="text-[10px] tabular-nums font-semibold">
                  {formatNumber(sources.filter((item) => item.trim()).length)}
                </Badge>
              </div>
              <DialogDescription>
                Platform names shown when creating a complaint — Shopee, TikTok, or any channel you use.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="px-4 sm:px-6 pt-4 pb-3 shrink-0 space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search sources…"
                className="h-9 text-sm pl-8"
              />
            </div>
            {normalizedSearch && (
              <p className="text-[11px] text-muted-foreground">
                Showing {formatNumber(visible.length)} of {formatNumber(sources.length)}. Clear search to reorder.
              </p>
            )}
          </div>

          <div className="px-4 sm:px-6 space-y-2 pb-4 flex-1 min-h-0 overflow-y-auto">
            {visible.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-12 px-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground mb-3">
                  <ShoppingBag className="w-5 h-5" />
                </span>
                <p className="text-sm font-medium">
                  {normalizedSearch ? 'No matches' : 'No sources yet'}
                </p>
                <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">
                  {normalizedSearch
                    ? 'Try a different search term.'
                    : 'Add a marketplace or channel below. Order is saved top to bottom.'}
                </p>
              </div>
            ) : visible.map(({ source, index }) => (
              <div
                key={`order-source-${index}`}
                className="rounded-xl border border-border bg-card p-2 sm:p-2.5 shadow-sm transition-colors hover:border-primary/30"
              >
                <div className="flex items-center gap-2">
                  <div className="flex flex-col shrink-0">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-5 w-7 text-muted-foreground disabled:opacity-30"
                      disabled={!canReorder || index === 0}
                      onClick={() => moveSource(index, -1)}
                      aria-label={`Move ${source || 'source'} up`}
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-5 w-7 text-muted-foreground disabled:opacity-30"
                      disabled={!canReorder || index === sources.length - 1}
                      onClick={() => moveSource(index, 1)}
                      aria-label={`Move ${source || 'source'} down`}
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <span className="w-6 shrink-0 text-center text-[11px] font-medium tabular-nums text-muted-foreground">
                    {index + 1}
                  </span>
                  <Input
                    value={source}
                    onChange={(e) => updateSource(index, e.target.value)}
                    placeholder="e.g. Shopee"
                    className="h-9 text-sm flex-1 min-w-0"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeSource(index)}
                    aria-label={`Remove ${source || 'source'}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="px-4 sm:px-6 py-3 sm:py-4 shrink-0 border-t bg-muted/30">
            <div className="flex gap-2">
              <Input
                value={newSource}
                onChange={(e) => setNewSource(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addSource();
                  }
                }}
                placeholder="Add a source…"
                className="h-9 text-sm"
              />
              <Button
                type="button"
                size="sm"
                className="h-9 shrink-0 gap-1.5"
                onClick={addSource}
                disabled={!newSource.trim()}
              >
                <Plus className="w-4 h-4" />
                Add
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              {formatNumber(sources.filter((item) => item.trim()).length)}
              {' '}
              {sources.filter((item) => item.trim()).length === 1 ? 'source' : 'sources'}
              {canReorder ? ' · use arrows to reorder' : ''}
            </p>
          </div>
        </div>

        <DialogFooter className="px-4 sm:px-6 py-4 shrink-0 border-t border-border/70 bg-background flex-row justify-end gap-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
          <Button onClick={onSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
