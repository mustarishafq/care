import { db } from '@/api/db';

import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useComplaintTypes, useCouriers, usePriorities, useUnitsOfMeasurement } from '@/lib/useLookups';
import { useComplaintCreateOptions } from '@/lib/useComplaintCreateOptions';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { isValidIsoDate } from '@/lib/dateInput';
import { DatePicker } from '@/components/ui/date-picker';
import { MAX_PROOF_FILE_BYTES, formatProofFileSize } from '@/lib/proofFiles';
import ProofImageGallery from '@/components/complaints/ProofImageGallery';
import AffectedProductsEditor, { EMPTY_AFFECTED_PRODUCT, EMPTY_BATCH_ENTRY } from '@/components/complaints/AffectedProductsEditor';

const storageUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `/storage/${path.replace(/^\//, '')}`;
};

const FIELD_LABELS = {
  customer_name: 'Customer Name',
  tracking_number: 'Tracking Number',
  purchase_date: 'Purchase Date',
  complaint_type_id: 'Complaint Type',
  product_id: 'Product',
  description: 'Description',
};

function getMissingComplaintFields(form) {
  const missing = [];
  if (!form.customer_name?.trim()) missing.push('customer_name');
  if (!form.tracking_number?.trim()) missing.push('tracking_number');
  if (!isValidIsoDate(form.purchase_date)) missing.push('purchase_date');
  if (!form.complaint_type_id) missing.push('complaint_type_id');
  if (!form.affected_products.some((item) => item.product_id)) missing.push('product_id');
  if (!form.description?.trim()) missing.push('description');
  return missing;
}

function mapProofFiles(files = []) {
  return files.map((file, index) => {
    if (typeof file === 'string') {
      const name = file.split('/').pop() || `file-${index + 1}`;
      return { path: file, url: file, name };
    }
    return {
      path: file.path || file.url,
      url: file.url || storageUrl(file.path),
      name: file.name,
      isImage: file.isImage,
      isVideo: file.isVideo,
    };
  });
}

/** Convert API affected_products (flat lines or batch_entries) into editor shape. */
export function complaintToAffectedProductForm(complaint) {
  const items = complaint?.affected_products ?? [];
  if (!items.length) {
    return [{ ...EMPTY_AFFECTED_PRODUCT, batch_entries: [{ ...EMPTY_BATCH_ENTRY }] }];
  }

  if (items.some((item) => Array.isArray(item.batch_entries))) {
    return items.map((item) => ({
      product_id: item.product_id ? String(item.product_id) : '',
      batch_entries: (item.batch_entries?.length ? item.batch_entries : [{ ...EMPTY_BATCH_ENTRY }]).map((entry) => ({
        batch_number: entry.batch_number || '',
        quantity_affected: entry.quantity_affected ?? 1,
        unit_of_measurement_id: entry.unit_of_measurement_id ? String(entry.unit_of_measurement_id) : '',
      })),
    }));
  }

  const groups = [];
  const indexByKey = new Map();
  for (const line of items) {
    const key = String(line.product_id || line.product_name || 'unknown');
    if (!indexByKey.has(key)) {
      indexByKey.set(key, groups.length);
      groups.push({
        product_id: line.product_id ? String(line.product_id) : '',
        batch_entries: [],
      });
    }
    groups[indexByKey.get(key)].batch_entries.push({
      batch_number: line.batch_number || '',
      quantity_affected: line.quantity_affected ?? 1,
      unit_of_measurement_id: line.unit_of_measurement_id ? String(line.unit_of_measurement_id) : '',
    });
  }

  return groups.map((group) => ({
    ...group,
    batch_entries: group.batch_entries.length ? group.batch_entries : [{ ...EMPTY_BATCH_ENTRY }],
  }));
}

function complaintToForm(complaint) {
  return {
    customer_name: complaint.customer_name || '',
    customer_phone: complaint.customer_phone || '',
    order_number: complaint.order_number || '',
    order_source: complaint.order_source || '',
    purchase_date: complaint.purchase_date || '',
    affected_products: complaintToAffectedProductForm(complaint),
    complaint_type_id: complaint.complaint_type_id ? String(complaint.complaint_type_id) : '',
    description: complaint.description || '',
    courier_id: complaint.courier_id ? String(complaint.courier_id) : '',
    tracking_number: complaint.tracking_number || '',
    priority_id: complaint.priority_id ? String(complaint.priority_id) : '',
    proof_files: mapProofFiles(complaint.proof_files),
  };
}

export default function EditComplaintDialog({ complaint, open, onOpenChange, onSaved }) {
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const { data: complaintTypes = [] } = useComplaintTypes();
  const { data: couriers = [] } = useCouriers();
  const { data: priorities = [] } = usePriorities();
  const { data: unitsOfMeasurement = [] } = useUnitsOfMeasurement();
  const { orderSources } = useComplaintCreateOptions({ enabled: open });
  const [form, setForm] = useState(() => (complaint ? complaintToForm(complaint) : null));
  const [invalidFields, setInvalidFields] = useState([]);

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => db.entities.Product.filter({ is_active: true }, 'name', 200),
  });

  useEffect(() => {
    if (!open || !complaint) return;
    setUploadError('');
    setInvalidFields([]);
    setForm(complaintToForm(complaint));
  }, [open, complaint]);

  if (!form) return null;

  const update = (key, value) => {
    setInvalidFields((prev) => prev.filter((field) => field !== key));
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateAffectedProducts = (affected_products) => {
    if (affected_products.some((item) => item.product_id)) {
      setInvalidFields((prev) => prev.filter((field) => field !== 'product_id'));
    }
    setForm((prev) => ({ ...prev, affected_products }));
  };

  const fieldClass = (key, className = '') =>
    invalidFields.includes(key) ? `${className} border-destructive ring-1 ring-destructive/30`.trim() : className;

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    setUploading(true);
    setUploadError('');
    const uploaded = [];
    const errors = [];

    try {
      for (const file of files) {
        if (file.size > MAX_PROOF_FILE_BYTES) {
          const message = `"${file.name}" is too large (${formatProofFileSize(file.size)}). Maximum size is 10 MB.`;
          errors.push(message);
          toast.error(message);
          continue;
        }

        try {
          const { path, url } = await db.integrations.Core.UploadFile({ file });
          uploaded.push({
            path,
            url: url || storageUrl(path),
            name: file.name,
            isImage: file.type.startsWith('image/'),
            isVideo: file.type.startsWith('video/'),
          });
        } catch (err) {
          const message = err.message || `Failed to upload "${file.name}"`;
          errors.push(message);
          toast.error(message);
        }
      }

      if (uploaded.length) {
        setForm((prev) => ({ ...prev, proof_files: [...prev.proof_files, ...uploaded] }));
      }
      if (errors.length) {
        setUploadError(errors.join(' '));
      }
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const removeProofFile = (index) => {
    update('proof_files', form.proof_files.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    const missing = getMissingComplaintFields(form);
    if (missing.length) {
      setInvalidFields(missing);
      const labels = missing.map((key) => FIELD_LABELS[key] ?? key);
      toast.error(
        labels.length === 1
          ? `Please fill in: ${labels[0]}`
          : `Please fill in: ${labels.join(', ')}`,
      );
      document.getElementById(`edit-complaint-field-${missing[0]}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setInvalidFields([]);

    const affectedProducts = form.affected_products
      .filter((item) => item.product_id)
      .map((item) => ({
        product_id: item.product_id,
        batch_entries: (item.batch_entries ?? []).map((entry) => ({
          batch_number: entry.batch_number?.trim() || null,
          quantity_affected: Number(entry.quantity_affected) || null,
          unit_of_measurement_id: entry.unit_of_measurement_id || null,
        })),
      }));

    setSaving(true);
    try {
      const updates = {
        customer_name: form.customer_name.trim(),
        customer_phone: form.customer_phone.trim() || null,
        order_number: form.order_number.trim() || null,
        order_source: form.order_source || null,
        purchase_date: form.purchase_date,
        affected_products: affectedProducts,
        complaint_type_id: form.complaint_type_id,
        description: form.description.trim(),
        courier_id: form.courier_id || null,
        tracking_number: form.tracking_number.trim(),
        priority_id: form.priority_id || null,
        proof_files: form.proof_files.map((file) => file.path || file.url).filter(Boolean),
      };

      await db.entities.Complaint.update(complaint.id, updates);
      await db.entities.TicketActivity.create({
        complaint_id: complaint.id,
        action_type: 'updated',
        description: `Ticket details edited by ${user?.full_name || 'Unknown'}`,
        user_id: user?.id,
      });

      queryClient.invalidateQueries({ queryKey: ['complaint', String(complaint.id)] });
      queryClient.invalidateQueries({ queryKey: ['activities', String(complaint.id)] });
      queryClient.invalidateQueries({ queryKey: ['complaints'] });
      toast.success('Complaint updated');
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      toast.error(err.message || 'Failed to update complaint');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden rounded-xl sm:rounded-2xl">
        <DialogHeader className="shrink-0 border-b px-4 sm:px-6 py-4 pr-12">
          <DialogTitle className="text-lg">Edit Complaint</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div id="edit-complaint-field-customer_name" className="space-y-1.5">
              <Label className="text-xs font-medium">Customer Name *</Label>
              <Input className={fieldClass('customer_name')} value={form.customer_name} onChange={(e) => update('customer_name', e.target.value)} placeholder="Full name" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Phone Number</Label>
              <Input value={form.customer_phone} onChange={(e) => update('customer_phone', e.target.value)} placeholder="60123456789" />
            </div>
            <div id="edit-complaint-field-tracking_number" className="space-y-1.5">
              <Label className="text-xs font-medium">Tracking Number *</Label>
              <Input className={fieldClass('tracking_number')} value={form.tracking_number} onChange={(e) => update('tracking_number', e.target.value)} placeholder="Tracking #" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Order Number</Label>
              <Input value={form.order_number} onChange={(e) => update('order_number', e.target.value)} placeholder="ORD-..." />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Order Source</Label>
              {orderSources.length > 0 ? (
                <Select value={form.order_source} onValueChange={(v) => update('order_source', v)}>
                  <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
                  <SelectContent>
                    {orderSources.map((source) => (
                      <SelectItem key={source} value={source}>{source}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={form.order_source}
                  onChange={(e) => update('order_source', e.target.value)}
                  placeholder="e.g. Shopee, TikTok"
                />
              )}
            </div>
            <div id="edit-complaint-field-purchase_date" className="space-y-1.5">
              <Label className="text-xs font-medium">Purchase Date *</Label>
              <DatePicker
                id="edit-complaint-field-purchase_date-input"
                value={form.purchase_date}
                onChange={(value) => update('purchase_date', value)}
                placeholder="Select purchase date"
                className={fieldClass('purchase_date')}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Courier</Label>
              <Select value={String(form.courier_id || '')} onValueChange={(v) => update('courier_id', v)}>
                <SelectTrigger><SelectValue placeholder="Select courier" /></SelectTrigger>
                <SelectContent>
                  {couriers.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div id="edit-complaint-field-complaint_type_id" className="space-y-1.5">
              <Label className="text-xs font-medium">Complaint Type *</Label>
              <Select value={String(form.complaint_type_id || '')} onValueChange={(v) => update('complaint_type_id', v)}>
                <SelectTrigger className={fieldClass('complaint_type_id')}><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {complaintTypes.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Priority</Label>
              <Select value={String(form.priority_id || '')} onValueChange={(v) => update('priority_id', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {priorities.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div id="edit-complaint-field-description" className="space-y-1.5">
            <Label className="text-xs font-medium">Description *</Label>
            <Textarea
              className={fieldClass('description')}
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              placeholder="Describe the complaint in detail..."
              rows={3}
            />
          </div>

          <div id="edit-complaint-field-product_id" className={invalidFields.includes('product_id') ? 'rounded-lg ring-1 ring-destructive/30' : undefined}>
            <AffectedProductsEditor
              products={products}
              unitsOfMeasurement={unitsOfMeasurement}
              value={form.affected_products}
              onChange={updateAffectedProducts}
              invalid={invalidFields.includes('product_id')}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Proof Files</Label>
            <div className="space-y-3">
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border hover:border-primary cursor-pointer text-sm text-muted-foreground hover:text-primary transition-colors">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                <span>{uploading ? 'Uploading...' : 'Upload files'}</span>
                <input type="file" multiple accept="image/*,video/*,.pdf,.doc,.docx" className="hidden" onChange={handleFileUpload} />
              </label>
              <ProofImageGallery
                items={form.proof_files}
                onRemove={removeProofFile}
              />
            </div>
            {uploadError && (
              <p className="text-xs text-destructive" role="alert">{uploadError}</p>
            )}
            <p className="text-xs text-muted-foreground">Maximum file size: 10 MB per file.</p>
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t px-4 sm:px-6 py-4 bg-background flex-row gap-2 sm:justify-end">
          <Button variant="outline" className="flex-1 sm:flex-initial" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="flex-1 sm:flex-initial" onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
