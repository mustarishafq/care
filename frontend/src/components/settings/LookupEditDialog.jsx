import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Loader2, Plus, Search, X } from 'lucide-react';
import { DEFAULT_STATUS_COLOR, defaultColorForIndex } from '@/lib/statusColors';
import { StatusBadgePreview, StatusColorPreviewPanel } from '@/components/settings/StatusColorPreview';

function StatusEditorRow({ item, index, onUpdate, onRemove }) {
  return (
    <div className="rounded-lg border bg-card/50 p-2 space-y-2">
      <div className="flex items-center gap-2">
        <Input
          type="color"
          value={item.color || DEFAULT_STATUS_COLOR}
          onChange={(e) => onUpdate(index, { color: e.target.value })}
          className="h-9 w-11 shrink-0 cursor-pointer p-1 border rounded-md"
          aria-label={`Color for ${item.name || 'status'}`}
        />
        <Input
          value={item.name}
          onChange={(e) => onUpdate(index, { name: e.target.value })}
          className="h-9 text-sm flex-1 min-w-0"
          placeholder="Status name"
        />
        <Button
          size="icon"
          variant="ghost"
          className="h-9 w-9 text-destructive hover:text-destructive shrink-0"
          onClick={() => onRemove(index)}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
      <div className="flex items-center justify-between gap-2 px-0.5">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Preview</span>
        <StatusBadgePreview name={item.name} color={item.color} />
      </div>
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
  const showColors = section?.key === 'complaint_statuses';

  const normalizedSearch = search.trim().toLowerCase();

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

  if (showColors) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="!max-w-4xl w-[calc(100vw-2rem)] max-h-[90vh] p-0 gap-0 flex flex-col overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 shrink-0 border-b">
            <DialogTitle>Edit {section?.label}</DialogTitle>
            <p className="text-sm text-muted-foreground pt-1">
              Set a color for each status. Preview updates live on the right.
            </p>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />Loading...
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
              <div className="flex flex-col lg:min-h-0 lg:overflow-hidden border-b lg:border-b-0 lg:border-r">
                <div className="px-6 pt-4 pb-3 shrink-0">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search statuses..."
                      className="h-9 text-sm pl-8"
                    />
                  </div>
                </div>

                <div className="px-6 space-y-2 pb-4 lg:flex-1 lg:min-h-0 lg:overflow-y-auto lg:pb-0">
                  {visibleItems.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-8">
                      {normalizedSearch ? 'No matches found.' : 'No statuses yet.'}
                    </p>
                  ) : visibleItems.map(({ item, index }) => (
                    <StatusEditorRow
                      key={item.id || `row-${index}`}
                      item={item}
                      index={index}
                      onUpdate={updateItem}
                      onRemove={removeItem}
                    />
                  ))}
                </div>

                <div className="px-6 py-4 shrink-0 border-t bg-muted/20">
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
                      placeholder="Add new status..."
                      className="h-9 text-sm"
                    />
                    <Button size="icon" variant="outline" className="h-9 w-9 shrink-0" onClick={addItem}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2">
                    {items.length} status{items.length === 1 ? '' : 'es'} · order is saved top to bottom
                  </p>
                </div>
              </div>

              <div className="flex flex-col lg:min-h-0 lg:overflow-hidden bg-muted/20">
                <div className="px-5 py-4 border-b shrink-0">
                  <p className="text-sm font-medium">Live preview</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    How statuses appear across the app
                  </p>
                </div>
                <div className="px-5 py-4 lg:flex-1 lg:min-h-0 lg:overflow-y-auto">
                  <StatusColorPreviewPanel items={items} />
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="px-6 py-4 shrink-0 border-t bg-background">
            <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
            <Button onClick={onSave} disabled={saving || loading}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle>Edit {section?.label}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />Loading...
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search items..."
                className="h-8 text-sm pl-8"
              />
            </div>

            <div className="space-y-2 pr-1">
              {visibleItems.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">
                  {normalizedSearch ? 'No matches found.' : 'No items yet.'}
                </p>
              ) : visibleItems.map(({ item, index }) => (
                <div key={item.id || `row-${index}`} className="flex items-center gap-2">
                  <Input
                    value={item.name}
                    onChange={(e) => updateItem(index, { name: e.target.value })}
                    className="h-8 text-sm"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                    onClick={() => removeItem(index)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>

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
                placeholder="Add new item..."
                className="h-8 text-sm"
              />
              <Button size="icon" variant="outline" className="h-8 w-8 shrink-0" onClick={addItem}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            <p className="text-[11px] text-muted-foreground">
              {items.length} item{items.length === 1 ? '' : 's'} · order is saved top to bottom
            </p>
          </div>
        )}

        <DialogFooter className="shrink-0 border-t pt-4">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
          <Button onClick={onSave} disabled={saving || loading}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
