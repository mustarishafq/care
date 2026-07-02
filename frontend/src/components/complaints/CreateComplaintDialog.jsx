import { db } from '@/api/db';

import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { generateTicketId } from '@/lib/ticketUtils';
import { findIdByName, useComplaintTypes, useCouriers, usePriorities, useUnitsOfMeasurement } from '@/lib/useLookups';
import { useComplaintCreateOptions } from '@/lib/useComplaintCreateOptions';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { offerWhatsappShareToast } from '@/lib/whatsappShareToast';
import { formatDateForDisplay, isValidIsoDate, parseDateInput } from '@/lib/dateInput';
import { MAX_PROOF_FILE_BYTES, formatProofFileSize } from '@/lib/proofFiles';
import ProofImageGallery from '@/components/complaints/ProofImageGallery';
import AffectedProductsEditor, { EMPTY_AFFECTED_PRODUCT } from '@/components/complaints/AffectedProductsEditor';

const storageUrl = (path) => {
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

const EMPTY_FORM = {
  customer_name: '',
  customer_phone: '',
  order_number: '',
  order_source: '',
  purchase_date: '',
  affected_products: [{ ...EMPTY_AFFECTED_PRODUCT }],
  complaint_type_id: '',
  description: '',
  courier_id: '',
  tracking_number: '',
  priority_id: '',
  proof_files: [],
  pre_resolved: false,
  closure_proof_files: [],
  closure_proof_notes: '',
  resolution_notes: '',
};

export default function CreateComplaintDialog({ open, onOpenChange }) {
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const { data: complaintTypes = [] } = useComplaintTypes();
  const { data: couriers = [] } = useCouriers();
  const { data: priorities = [] } = usePriorities();
  const { data: unitsOfMeasurement = [] } = useUnitsOfMeasurement();
  const { preResolved, orderSources, isLoading: loadingCreateOptions, error: createOptionsError, refetch: refetchCreateOptions } = useComplaintCreateOptions({ enabled: open });
  const [form, setForm] = useState(EMPTY_FORM);
  const [purchaseDateInput, setPurchaseDateInput] = useState('');
  const [invalidFields, setInvalidFields] = useState([]);

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => db.entities.Product.filter({ is_active: true }, 'name', 200),
  });

  useEffect(() => {
    if (!open) return;
    setUploadError('');
    setInvalidFields([]);
    setPurchaseDateInput('');
    setForm({
      ...EMPTY_FORM,
      priority_id: String(findIdByName(priorities, 'Medium') || ''),
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const mediumId = findIdByName(priorities, 'Medium');
    if (!mediumId) return;
    setForm((prev) => (prev.priority_id ? prev : { ...prev, priority_id: String(mediumId) }));
  }, [open, priorities]);

  const update = (key, value) => {
    setInvalidFields((prev) => prev.filter((field) => field !== key));
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const syncPurchaseDate = (text) => {
    const isoDate = parseDateInput(text);
    setPurchaseDateInput(isoDate ? formatDateForDisplay(isoDate) : text);
    setForm((prev) => ({ ...prev, purchase_date: isoDate }));
    if (isoDate) {
      setInvalidFields((prev) => prev.filter((field) => field !== 'purchase_date'));
    }
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

  const handleClosureProofUpload = async (e) => {
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
            type: 'vendor_screenshot',
          });
        } catch (err) {
          const message = err.message || `Failed to upload "${file.name}"`;
          errors.push(message);
          toast.error(message);
        }
      }

      if (uploaded.length) {
        setForm((prev) => ({ ...prev, closure_proof_files: [...prev.closure_proof_files, ...uploaded] }));
      }
      if (errors.length) {
        setUploadError(errors.join(' '));
      }
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const removeClosureProofFile = (index) => {
    update('closure_proof_files', form.closure_proof_files.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    const purchaseDate = parseDateInput(purchaseDateInput) || form.purchase_date;
    const formForValidation = { ...form, purchase_date: purchaseDate };
    const missing = getMissingComplaintFields(formForValidation);
    if (missing.length) {
      setInvalidFields(missing);
      const labels = missing.map((key) => FIELD_LABELS[key] ?? key);
      toast.error(
        labels.length === 1
          ? `Please fill in: ${labels[0]}`
          : `Please fill in: ${labels.join(', ')}`,
      );
      document.getElementById(`complaint-field-${missing[0]}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setInvalidFields([]);
    setForm((prev) => ({ ...prev, purchase_date: purchaseDate }));
    setPurchaseDateInput(formatDateForDisplay(purchaseDate));

    if (form.pre_resolved) {
      if (preResolved.require_closure_proof && form.closure_proof_files.length === 0) {
        toast.error('Add at least one vendor closure proof before creating this ticket.');
        return;
      }
      if (preResolved.require_resolution_notes && !form.resolution_notes?.trim()) {
        toast.error('Resolution notes are required for pre-resolved complaints.');
        return;
      }
    }

    const affectedProducts = form.affected_products
      .filter((item) => item.product_id)
      .map((item) => ({
        product_id: item.product_id,
        batch_entries: (item.batch_entries ?? [])
          .map((entry) => ({
            batch_number: entry.batch_number?.trim() || null,
            quantity_affected: Number(entry.quantity_affected) || null,
            unit_of_measurement_id: entry.unit_of_measurement_id || null,
          })),
      }));

    setSaving(true);
    const ticketId = generateTicketId();
    const complaintData = {
      customer_name: form.customer_name,
      customer_phone: form.customer_phone,
      order_number: form.order_number.trim() || null,
      order_source: form.order_source || null,
      purchase_date: purchaseDate,
      affected_products: affectedProducts,
      complaint_type_id: form.complaint_type_id,
      description: form.description,
      proof_files: form.proof_files.map((file) => file.path),
      assigned_user_id: user?.id || null,
      courier_id: form.courier_id || null,
      tracking_number: form.tracking_number,
      priority_id: form.priority_id || findIdByName(priorities, 'Medium') || null,
      ticket_id: ticketId,
      pre_resolved: !!form.pre_resolved,
      resolution_notes: form.pre_resolved ? (form.resolution_notes?.trim() || null) : null,
      closure_proof_notes: form.pre_resolved ? (form.closure_proof_notes?.trim() || null) : null,
      closure_proof_files: form.pre_resolved
        ? form.closure_proof_files.map((file) => ({
          path: file.path,
          type: file.type || 'vendor_screenshot',
          name: file.name,
        }))
        : undefined,
    };
    const created = await db.entities.Complaint.create(complaintData);
    const statusLabel = created.status || (form.pre_resolved ? preResolved.status_name : null);
    await db.entities.TicketActivity.create({
      complaint_id: created.id,
      action_type: 'created',
      description: form.pre_resolved && statusLabel
        ? `Ticket ${created.ticket_id || ticketId} logged as ${statusLabel} (already resolved at vendor) by ${user?.full_name || 'Unknown'}`
        : `Ticket ${created.ticket_id || ticketId} created by ${user?.full_name || 'Unknown'}`,
      user_id: user?.id,
    });
    queryClient.invalidateQueries({ queryKey: ['complaints'] });
    const sharePayload = {
      ...created,
      complaint_type: created.complaint_type ?? complaintTypes.find((t) => String(t.id) === String(form.complaint_type_id))?.name,
      priority: created.priority ?? priorities.find((p) => String(p.id) === String(form.priority_id))?.name,
      assigned_department: created.assigned_department,
      assigned_user_name: created.assigned_user_name ?? user?.full_name,
      customer_name: created.customer_name ?? form.customer_name,
      order_number: created.order_number ?? form.order_number,
      order_source: created.order_source ?? form.order_source,
      purchase_date: created.purchase_date ?? purchaseDate,
      tracking_number: created.tracking_number ?? form.tracking_number,
      status: created.status,
      affected_products: (created.affected_products ?? []).map((item) => ({
        ...item,
        product_name: item.product_name ?? products.find((p) => String(p.id) === String(item.product_id))?.name,
        unit_of_measurement: item.unit_of_measurement ?? unitsOfMeasurement.find((u) => String(u.id) === String(item.unit_of_measurement_id))?.name,
      })),
    };
    offerWhatsappShareToast(sharePayload, { event: form.pre_resolved ? 'status_changed' : 'created' });
    setSaving(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="shrink-0 border-b px-6 py-4 pr-12">
          <DialogTitle className="text-lg">Create New Complaint</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div id="complaint-field-customer_name" className="space-y-1.5">
            <Label className="text-xs font-medium">Customer Name *</Label>
            <Input className={fieldClass('customer_name')} value={form.customer_name} onChange={e => update('customer_name', e.target.value)} placeholder="Full name" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Phone Number</Label>
            <Input value={form.customer_phone} onChange={e => update('customer_phone', e.target.value)} placeholder="60123456789" />
          </div>
          <div id="complaint-field-tracking_number" className="space-y-1.5">
            <Label className="text-xs font-medium">Tracking Number *</Label>
            <Input className={fieldClass('tracking_number')} value={form.tracking_number} onChange={e => update('tracking_number', e.target.value)} placeholder="Tracking #" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Order Number</Label>
            <Input value={form.order_number} onChange={e => update('order_number', e.target.value)} placeholder="ORD-..." />
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
          <div id="complaint-field-purchase_date" className="space-y-1.5">
            <Label className="text-xs font-medium">Purchase Date *</Label>
            <Input
              type="text"
              inputMode="numeric"
              className={fieldClass('purchase_date')}
              value={purchaseDateInput}
              onChange={(e) => syncPurchaseDate(e.target.value)}
              onBlur={(e) => syncPurchaseDate(e.target.value)}
              placeholder="DD/MM/YYYY"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Courier</Label>
            <Select value={String(form.courier_id || '')} onValueChange={v => update('courier_id', v)}>
              <SelectTrigger><SelectValue placeholder="Select courier" /></SelectTrigger>
              <SelectContent>
                {couriers.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div id="complaint-field-complaint_type_id" className="space-y-1.5">
            <Label className="text-xs font-medium">Complaint Type *</Label>
            <Select value={String(form.complaint_type_id || '')} onValueChange={v => update('complaint_type_id', v)}>
              <SelectTrigger className={fieldClass('complaint_type_id')}><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                {complaintTypes.map(t => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Priority</Label>
            <Select value={String(form.priority_id || '')} onValueChange={v => update('priority_id', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {priorities.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div id="complaint-field-description" className="space-y-1.5">
          <Label className="text-xs font-medium">Description *</Label>
          <Textarea
            className={fieldClass('description')}
            value={form.description}
            onChange={e => update('description', e.target.value)}
            placeholder="Describe the complaint in detail..."
            rows={3}
          />
        </div>

        <div id="complaint-field-product_id" className={invalidFields.includes('product_id') ? 'rounded-lg ring-1 ring-destructive/30' : undefined}>
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

        {loadingCreateOptions && (
          <p className="text-xs text-muted-foreground">Loading form options…</p>
        )}

        {createOptionsError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive flex items-center justify-between gap-2">
            <span>Could not load pre-resolved options.</span>
            <Button type="button" variant="outline" size="sm" onClick={() => refetchCreateOptions()}>Retry</Button>
          </div>
        )}

        {preResolved.enabled && (
          <div className="rounded-lg border p-4 space-y-4 bg-muted/20">
            <label className="flex items-start gap-3 cursor-pointer">
              <Checkbox
                checked={!!form.pre_resolved}
                onCheckedChange={(checked) => update('pre_resolved', !!checked)}
                className="mt-0.5"
              />
              <div className="space-y-1">
                <p className="text-sm font-medium">Already resolved at vendor</p>
                <p className="text-xs text-muted-foreground">
                  Use for marketplace orders settled directly with the vendor. Ticket will be created as
                  {' '}
                  <span className="font-medium text-foreground">{preResolved.status_name || 'the configured status'}</span>
                  {' '}
                  for later review before closing.
                </p>
              </div>
            </label>

            {form.pre_resolved && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">
                    Resolution Notes{preResolved.require_resolution_notes ? ' *' : ''}
                  </Label>
                  <Textarea
                    value={form.resolution_notes}
                    onChange={(e) => update('resolution_notes', e.target.value)}
                    placeholder="How was this resolved with the vendor?"
                    rows={2}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">
                    Vendor Closure Proof{preResolved.require_closure_proof ? ' *' : ''}
                  </Label>
                  <div className="space-y-3">
                    <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border hover:border-primary cursor-pointer text-sm text-muted-foreground hover:text-primary transition-colors">
                      {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      <span>{uploading ? 'Uploading...' : 'Upload vendor screenshot / chat proof'}</span>
                      <input type="file" multiple accept="image/*" className="hidden" onChange={handleClosureProofUpload} />
                    </label>
                    <ProofImageGallery
                      items={form.closure_proof_files}
                      onRemove={removeClosureProofFile}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Closure Proof Notes</Label>
                  <Textarea
                    value={form.closure_proof_notes}
                    onChange={(e) => update('closure_proof_notes', e.target.value)}
                    placeholder="Optional notes about the vendor proof"
                    rows={2}
                  />
                </div>
              </>
            )}
          </div>
        )}
        </div>

        <DialogFooter className="shrink-0 border-t px-6 py-4 bg-background flex-row gap-2 sm:justify-end">
          <Button variant="outline" className="flex-1 sm:flex-initial" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="flex-1 sm:flex-initial" onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {form.pre_resolved ? 'Log Pre-Resolved Ticket' : 'Create Ticket'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
