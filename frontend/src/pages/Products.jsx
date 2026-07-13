import { db } from '@/api/db';

import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus, Pencil, Trash2, Package, Search, Loader2,
  PackageCheck, PackageX, MoreHorizontal,
} from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import PageContent from '@/components/layout/PageContent';
import StatCard from '@/components/dashboard/StatCard';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';
import { usePermissions } from '@/lib/usePermissions';
import { cn } from '@/lib/utils';

const EMPTY_FILTERS = { search: '', status: '' };
const emptyProduct = { name: '', sku: '', description: '', is_active: true };

function productInitials(name) {
  return (name || '??')
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function Products() {
  const queryClient = useQueryClient();
  const { hasPermission, loading: permLoading } = usePermissions();
  const canManage = hasPermission('products.manage');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [form, setForm] = useState(emptyProduct);
  const [saving, setSaving] = useState(false);
  const [actionProductId, setActionProductId] = useState(null);
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () => db.entities.Product.list('name', 500),
  });

  const stats = useMemo(() => ({
    total: products.length,
    active: products.filter(p => p.is_active !== false).length,
    inactive: products.filter(p => p.is_active === false).length,
  }), [products]);

  const filtered = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return products.filter(p => {
      if (filters.status === 'active' && p.is_active === false) return false;
      if (filters.status === 'inactive' && p.is_active !== false) return false;
      if (search) {
        const haystack = `${p.name || ''} ${p.sku || ''} ${p.description || ''}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });
  }, [products, filters]);

  const hasActiveFilters = Object.values(filters).some(Boolean);

  const openCreate = () => {
    setEditingProduct(null);
    setForm(emptyProduct);
    setDialogOpen(true);
  };

  const openEdit = (p) => {
    setEditingProduct(p);
    setForm({
      name: p.name,
      sku: p.sku || '',
      description: p.description || '',
      is_active: p.is_active !== false,
    });
    setDialogOpen(true);
  };

  const invalidateProducts = () => queryClient.invalidateQueries({ queryKey: ['products'] });

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Product name is required');
      return;
    }
    setSaving(true);
    try {
      if (editingProduct) {
        await db.entities.Product.update(editingProduct.id, form);
        toast.success('Product updated');
      } else {
        await db.entities.Product.create(form);
        toast.success('Product created');
      }
      invalidateProducts();
      setDialogOpen(false);
    } catch (err) {
      toast.error(err.message || 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (product) => {
    if (!window.confirm(`Delete "${product.name}"? This cannot be undone.`)) return;
    setActionProductId(product.id);
    try {
      await db.entities.Product.delete(product.id);
      invalidateProducts();
      toast.success('Product deleted');
    } catch (err) {
      toast.error(err.message || 'Failed to delete product');
    } finally {
      setActionProductId(null);
    }
  };

  const handleToggleActive = async (product) => {
    setActionProductId(product.id);
    try {
      const nextActive = product.is_active === false;
      await db.entities.Product.update(product.id, { is_active: nextActive });
      invalidateProducts();
      toast.success(`${product.name} ${nextActive ? 'activated' : 'deactivated'}`);
    } catch (err) {
      toast.error(err.message || 'Failed to update status');
    } finally {
      setActionProductId(null);
    }
  };

  if (isLoading || permLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Package}
        title="Products"
        description={
          hasActiveFilters
            ? `${filtered.length} of ${products.length} products`
            : `${products.length} products in catalog`
        }
        actions={canManage ? (
          <Button onClick={openCreate} className="gap-2 h-10 w-full sm:w-auto sm:h-9 shadow-md shadow-primary/20 hover:shadow-primary/30">
            <Plus className="w-4 h-4" />Add Product
          </Button>
        ) : null}
      />

      <PageContent>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard label="Total Products" value={stats.total} icon={Package} color="primary" index={0} />
        <StatCard label="Active" value={stats.active} icon={PackageCheck} color="success" index={1} />
        <StatCard label="Inactive" value={stats.inactive} icon={PackageX} color="danger" index={2} />
      </div>

      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name, SKU, or description..."
            value={filters.search}
            onChange={e => setFilters(p => ({ ...p, search: e.target.value }))}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={filters.status || 'all'} onValueChange={v => setFilters(p => ({ ...p, status: v === 'all' ? '' : v }))}>
            <SelectTrigger className="w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={() => setFilters(EMPTY_FILTERS)}>
              Clear filters
            </Button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="rounded-2xl">
          <CardContent className="py-12 text-center text-muted-foreground">
            <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">
              {hasActiveFilters ? 'No products match your filters' : 'No products yet'}
            </p>
            <p className="text-sm mt-1">
              {hasActiveFilters
                ? 'Try adjusting your search or filters.'
                : canManage
                  ? 'Add your first product to get started.'
                  : 'Products will appear here once added.'}
            </p>
            {canManage && !hasActiveFilters && (
              <Button onClick={openCreate} variant="outline" size="sm" className="mt-4 gap-2">
                <Plus className="w-4 h-4" />Add Product
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(p => {
            const isActive = p.is_active !== false;
            const isBusy = actionProductId === p.id;
            return (
              <Card
                key={p.id}
                className={cn(
                  'rounded-2xl transition-opacity',
                  !isActive && 'opacity-70',
                )}
              >
                <CardContent className="p-4 flex flex-col gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-primary">{productInitials(p.name)}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-sm leading-snug truncate">{p.name}</p>
                          {p.description ? (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{p.description}</p>
                          ) : (
                            <p className="text-xs text-muted-foreground/60 mt-0.5 italic">No description</p>
                          )}
                        </div>
                        {canManage && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 -mt-1 -mr-1" disabled={isBusy}>
                                {isBusy
                                  ? <Loader2 className="w-4 h-4 animate-spin" />
                                  : <MoreHorizontal className="w-4 h-4" />
                                }
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEdit(p)}>
                                <Pencil className="w-4 h-4 mr-2" />Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => handleDelete(p)}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-1 border-t border-border/60">
                    <div className="min-w-0">
                      {p.sku ? (
                        <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{p.sku}</code>
                      ) : (
                        <span className="text-xs text-muted-foreground">No SKU</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {canManage ? (
                        <>
                          <span className="text-xs text-muted-foreground">{isActive ? 'Active' : 'Inactive'}</span>
                          <Switch
                            checked={isActive}
                            onCheckedChange={() => handleToggleActive(p)}
                            disabled={isBusy}
                          />
                        </>
                      ) : (
                        <Badge className={`text-xs border-0 w-fit ${isActive
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                          {isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      </PageContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Edit Product' : 'Add Product'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Product Name *</Label>
              <Input
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Organic Almond Milk 1L"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">SKU</Label>
              <Input
                value={form.sku}
                onChange={e => setForm(p => ({ ...p, sku: e.target.value }))}
                placeholder="SKU-XXX-001"
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Textarea
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Optional product details"
                rows={3}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label className="text-sm">Active</Label>
                <p className="text-xs text-muted-foreground">Inactive products are hidden from complaint forms</p>
              </div>
              <Switch checked={form.is_active} onCheckedChange={v => setForm(p => ({ ...p, is_active: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingProduct ? 'Save Changes' : 'Add Product'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
