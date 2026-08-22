import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DEFAULT_STATUS_COLOR, defaultColorForIndex, STATUS_COLOR_PRESETS } from '@/lib/statusColors';
import { StatusBadgePreview, StatusColorPreviewPanel } from '@/components/settings/StatusColorPreview';
import { useDisplayFormat } from '@/lib/DisplayFormatProvider';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Loader2, Plus, Search, Trash2 } from 'lucide-react';

function ColorSwatchPicker({ value, onChange, label }) {
  const [open, setOpen] = useState(false);
  const hex = value || DEFAULT_STATUS_COLOR;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Color for ${label || 'status'}`}
          className="h-9 w-9 shrink-0 rounded-lg border border-border shadow-sm ring-offset-background transition-shadow hover:ring-2 hover:ring-ring/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={{ backgroundColor: hex }}
        />
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3 z-[100]" align="start">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2">
          Preset colors
        </p>
        <div className="grid grid-cols-6 gap-1.5">
          {STATUS_COLOR_PRESETS.map((preset) => {
            const selected = hex.toLowerCase() === preset.toLowerCase();
            return (
              <button
                key={preset}
                type="button"
                aria-label={`Use ${preset}`}
                onClick={() => {
                  onChange(preset);
                  setOpen(false);
                }}
                className={cn(
                  'h-7 w-7 rounded-md border border-border transition-transform hover:scale-110',
                  selected && 'ring-2 ring-primary ring-offset-1 ring-offset-background',
                )}
                style={{ backgroundColor: preset }}
              />
            );
          })}
        </div>
        <div className="mt-3 flex items-center gap-2 border-t pt-3">
          <Input
            type="color"
            value={hex}
            onChange={(e) => onChange(e.target.value)}
            className="h-8 w-11 shrink-0 cursor-pointer p-1"
            aria-label="Custom color"
          />
          <span className="text-xs font-mono text-muted-foreground truncate">{hex}</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function LookupItemRow({
  item,
  index,
  total,
  showColors,
  canReorder,
  onUpdate,
  onMove,
  onRemove,
}) {
  const name = item.name || '';

  return (
    <div className="group rounded-xl border border-border bg-card p-2 sm:p-2.5 shadow-sm transition-colors hover:border-primary/30">
      <div className="flex items-center gap-2">
        <div className="flex flex-col shrink-0">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-5 w-7 text-muted-foreground disabled:opacity-30"
            disabled={!canReorder || index === 0}
            onClick={() => onMove(index, -1)}
            aria-label={`Move ${name || 'item'} up`}
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-5 w-7 text-muted-foreground disabled:opacity-30"
            disabled={!canReorder || index === total - 1}
            onClick={() => onMove(index, 1)}
            aria-label={`Move ${name || 'item'} down`}
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </Button>
        </div>
        <span className="w-6 shrink-0 text-center text-[11px] font-medium tabular-nums text-muted-foreground">
          {index + 1}
        </span>
        {showColors && (
          <ColorSwatchPicker
            value={item.color}
            label={name}
            onChange={(color) => onUpdate(index, { color })}
          />
        )}
        <Input
          value={name}
          onChange={(e) => onUpdate(index, { name: e.target.value })}
          className="h-9 text-sm flex-1 min-w-0"
          placeholder={showColors ? 'Status name' : 'Item name'}
        />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={() => onRemove(index)}
          aria-label={`Remove ${name || 'item'}`}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
      {showColors && (
        <div className="flex items-center justify-end pt-2 pr-1">
          <StatusBadgePreview name={name} color={item.color} />
        </div>
      )}
    </div>
  );
}

export default function LookupEditDialog({
  open,
  onOpenChange,
  section,
  items,
  loading,
  saving,
  onSave,
  onItemsChange,
}) {
  const [search, setSearch] = useState('');
  const [newItem, setNewItem] = useState('');
  const { formatNumber } = useDisplayFormat();
  const showColors = section?.key === 'complaint_statuses';
  const Icon = section?.icon;
  const noun = showColors ? 'status' : 'item';
  const nounPlural = showColors ? 'statuses' : 'items';

  const normalizedSearch = search.trim().toLowerCase();
  const canReorder = !normalizedSearch;

  const visibleItems = useMemo(() => {
    if (!normalizedSearch) return items.map((item, index) => ({ item, index }));
    return items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.name.toLowerCase().includes(normalizedSearch));
  }, [items, normalizedSearch]);

  const handleOpenChange = (next) => {
    if (!next) {
      setSearch('');
      setNewItem('');
    }
    onOpenChange(next);
  };

  const addItem = () => {
    const name = newItem.trim();
    if (!name) return;
    const nextItem = { name };
    if (showColors) {
      nextItem.color = defaultColorForIndex(items.length);
    }
    onItemsChange([...items, nextItem]);
    setNewItem('');
  };

  const updateItem = (index, patch) => {
    onItemsChange(items.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));
  };

  const removeItem = (index) => {
    onItemsChange(items.filter((_, i) => i !== index));
  };

  const moveItem = (index, direction) => {
    const to = index + direction;
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(index, 1);
    next.splice(to, 0, moved);
    onItemsChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          'w-[calc(100vw-1.5rem)] max-h-[90vh] p-0 gap-0 flex flex-col overflow-hidden rounded-xl sm:rounded-2xl',
          showColors ? 'sm:max-w-3xl' : 'sm:max-w-lg',
        )}
      >
        <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 pr-12 shrink-0 border-b border-border/70 text-left">
          <div className="flex items-start gap-3">
            {Icon && (
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="w-5 h-5" />
              </span>
            )}
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <DialogTitle>Edit {section?.label}</DialogTitle>
                {!loading && (
                  <Badge variant="secondary" className="text-[10px] tabular-nums font-semibold">
                    {formatNumber(items.length)}
                  </Badge>
                )}
              </div>
              <DialogDescription>
                {section?.description
                  || (showColors
                    ? 'Set a color for each status. Preview updates live.'
                    : 'Rename, reorder, or add values used in dropdowns.')}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Loading {nounPlural}…
          </div>
        ) : (
          <div
            className={cn(
              'flex-1 min-h-0 flex flex-col',
              showColors
                ? 'overflow-y-auto lg:overflow-hidden lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(240px,280px)]'
                : 'overflow-hidden',
            )}
          >
            <div className={cn(
              'flex flex-col min-h-0',
              showColors ? 'lg:min-h-0 lg:overflow-hidden lg:border-r' : 'flex-1 overflow-hidden',
            )}
            >
              <div className="px-4 sm:px-6 pt-4 pb-3 shrink-0 space-y-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={`Search ${nounPlural}…`}
                    className="h-9 text-sm pl-8"
                  />
                </div>
                {normalizedSearch && (
                  <p className="text-[11px] text-muted-foreground">
                    Showing {formatNumber(visibleItems.length)} of {formatNumber(items.length)}. Clear search to reorder.
                  </p>
                )}
              </div>

              <div className={cn(
                'px-4 sm:px-6 space-y-2 pb-4',
                showColors ? 'lg:flex-1 lg:min-h-0 lg:overflow-y-auto' : 'flex-1 min-h-0 overflow-y-auto',
              )}
              >
                {visibleItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center py-12 px-4">
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground mb-3">
                      {Icon ? <Icon className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                    </span>
                    <p className="text-sm font-medium">
                      {normalizedSearch ? 'No matches' : `No ${nounPlural} yet`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-[220px]">
                      {normalizedSearch
                        ? 'Try a different search term.'
                        : `Add a ${noun} below. Order is saved top to bottom.`}
                    </p>
                  </div>
                ) : visibleItems.map(({ item, index }) => (
                  <LookupItemRow
                    key={item.id || `row-${index}`}
                    item={item}
                    index={index}
                    total={items.length}
                    showColors={showColors}
                    canReorder={canReorder}
                    onUpdate={updateItem}
                    onMove={moveItem}
                    onRemove={removeItem}
                  />
                ))}
              </div>

              <div className="px-4 sm:px-6 py-3 sm:py-4 shrink-0 border-t bg-muted/30">
                <div className="flex gap-2">
                  <Input
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addItem();
                      }
                    }}
                    placeholder={showColors ? 'Add a status…' : 'Add an item…'}
                    className="h-9 text-sm"
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="h-9 shrink-0 gap-1.5"
                    onClick={addItem}
                    disabled={!newItem.trim()}
                  >
                    <Plus className="w-4 h-4" />
                    Add
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">
                  {formatNumber(items.length)} {items.length === 1 ? noun : nounPlural}
                  {canReorder ? ' · use arrows to reorder' : ''}
                </p>
              </div>
            </div>

            {showColors && (
              <div className="flex flex-col min-h-0 bg-muted/20 lg:overflow-hidden">
                <div className="px-4 sm:px-5 py-3 sm:py-4 border-b shrink-0">
                  <p className="text-sm font-medium">Live preview</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    How statuses appear on tickets and the board
                  </p>
                </div>
                <div className="px-4 sm:px-5 py-4 lg:flex-1 lg:min-h-0 lg:overflow-y-auto">
                  <StatusColorPreviewPanel items={items} />
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="px-4 sm:px-6 py-4 shrink-0 border-t border-border/70 bg-background flex-row justify-end gap-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
          <Button onClick={onSave} disabled={saving || loading}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
