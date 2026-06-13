import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, X } from 'lucide-react';

export const EMPTY_BATCH_ENTRY = {
  batch_number: '',
  quantity_affected: 1,
  unit_of_measurement_id: '',
};

export const EMPTY_AFFECTED_PRODUCT = {
  product_id: '',
  batch_entries: [{ ...EMPTY_BATCH_ENTRY }],
};

export default function AffectedProductsEditor({
  products = [],
  unitsOfMeasurement = [],
  value = [],
  onChange,
}) {
  const updateProduct = (index, patch) => {
    onChange(value.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const updateBatchEntry = (productIndex, entryIndex, patch) => {
    const batchEntries = (value[productIndex].batch_entries ?? []).map((entry, i) =>
      i === entryIndex ? { ...entry, ...patch } : entry,
    );
    updateProduct(productIndex, { batch_entries: batchEntries });
  };

  const addBatchEntry = (productIndex) => {
    const batchEntries = [...(value[productIndex].batch_entries ?? []), { ...EMPTY_BATCH_ENTRY }];
    updateProduct(productIndex, { batch_entries: batchEntries });
  };

  const removeBatchEntry = (productIndex, entryIndex) => {
    const batchEntries = (value[productIndex].batch_entries ?? []).filter((_, i) => i !== entryIndex);
    updateProduct(productIndex, {
      batch_entries: batchEntries.length ? batchEntries : [{ ...EMPTY_BATCH_ENTRY }],
    });
  };

  const addProduct = () => {
    onChange([...value, { ...EMPTY_AFFECTED_PRODUCT, batch_entries: [{ ...EMPTY_BATCH_ENTRY }] }]);
  };

  const removeProduct = (index) => {
    if (value.length <= 1) return;
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">Affected Products *</Label>
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={addProduct}>
          <Plus className="w-3.5 h-3.5 mr-1" />
          Add product
        </Button>
      </div>

      {products.length === 0 && (
        <p className="text-sm text-muted-foreground">Add products on the Products page before creating complaints.</p>
      )}

      {value.map((item, productIndex) => (
        <div key={productIndex} className="rounded-lg border p-4 space-y-3 bg-muted/30">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Product {productIndex + 1}
            </p>
            {value.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => removeProduct(productIndex)}
                aria-label={`Remove product ${productIndex + 1}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Product *</Label>
            <Select
              value={item.product_id}
              onValueChange={(v) => updateProduct(productIndex, { product_id: v })}
              disabled={!products.length}
            >
              <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name}{p.sku ? ` (${p.sku})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Batch &amp; Affected Units</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => addBatchEntry(productIndex)}
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add batch
              </Button>
            </div>

            {(item.batch_entries ?? [{ ...EMPTY_BATCH_ENTRY }]).map((entry, entryIndex) => (
              <div key={entryIndex} className="rounded-md border bg-background p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-muted-foreground">Batch {entryIndex + 1}</p>
                  {(item.batch_entries?.length ?? 0) > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeBatchEntry(productIndex, entryIndex)}
                      aria-label={`Remove batch ${entryIndex + 1}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-[minmax(0,1fr)_4.5rem_7rem] gap-2 items-end">
                  <div className="space-y-1.5 min-w-0">
                    <Label className="text-xs font-medium">Batch Number</Label>
                    <Input
                      value={entry.batch_number}
                      onChange={(e) => updateBatchEntry(productIndex, entryIndex, { batch_number: e.target.value })}
                      placeholder="Batch #"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Qty</Label>
                    <Input
                      type="number"
                      min={1}
                      value={entry.quantity_affected}
                      onChange={(e) => updateBatchEntry(productIndex, entryIndex, { quantity_affected: e.target.value })}
                    />
                  </div>

                  <div className="space-y-1.5 min-w-0">
                    <Label className="text-xs font-medium">Unit</Label>
                    {unitsOfMeasurement.length > 0 ? (
                      <Select
                        value={entry.unit_of_measurement_id}
                        onValueChange={(v) => updateBatchEntry(productIndex, entryIndex, { unit_of_measurement_id: v })}
                      >
                        <SelectTrigger><SelectValue placeholder="Unit" /></SelectTrigger>
                        <SelectContent>
                          {unitsOfMeasurement.map((unit) => (
                            <SelectItem key={unit.id} value={String(unit.id)}>{unit.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-xs text-muted-foreground py-2">No units</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
