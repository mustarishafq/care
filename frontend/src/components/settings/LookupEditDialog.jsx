import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Loader2, Plus, Search, X } from 'lucide-react';

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
    onItemsChange([...items, { name }]);
    setNewItem('');
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit {section?.label}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />Loading...
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search items..."
                className="h-8 text-sm pl-8"
              />
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {visibleItems.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">
                  {normalizedSearch ? 'No matches found.' : 'No items yet.'}
                </p>
              ) : visibleItems.map(({ item, index }) => (
                <div key={item.id || `row-${index}`} className="flex items-center gap-2">
                  <Input
                    value={item.name}
                    onChange={(e) => onItemsChange(items.map((entry, i) => (
                      i === index ? { ...entry, name: e.target.value } : entry
                    )))}
                    className="h-8 text-sm"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                    onClick={() => onItemsChange(items.filter((_, i) => i !== index))}
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

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
          <Button onClick={onSave} disabled={saving || loading}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
