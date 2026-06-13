import { db } from '@/api/db';

import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { generateTicketId } from '@/lib/ticketUtils';
import { findDepartmentIdByName, useDepartments } from '@/lib/useDepartments';
import { findIdByName, useComplaintStatuses, useComplaintTypes, useCouriers, usePriorities, useUnitsOfMeasurement } from '@/lib/useLookups';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { Loader2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { offerWhatsappShareToast } from '@/lib/whatsappShareToast';
import { MAX_PROOF_FILE_BYTES, formatProofFileSize } from '@/lib/proofFiles';
import ProofFileThumbnail from '@/components/complaints/ProofFileThumbnail';
import AffectedProductsEditor, { EMPTY_AFFECTED_PRODUCT } from '@/components/complaints/AffectedProductsEditor';

const storageUrl = (path) => {
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `/storage/${path.replace(/^\//, '')}`;
};

const ORDER_SOURCES = ['SiteGiant', 'FounderHQ'];

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
  assigned_department_id: '',
  proof_files: [],
};

export default function CreateComplaintDialog({ open, onOpenChange }) {
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const { data: departments = [] } = useDepartments();
  const { data: complaintTypes = [] } = useComplaintTypes();
  const { data: couriers = [] } = useCouriers();
  const { data: priorities = [] } = usePriorities();
  const { data: unitsOfMeasurement = [] } = useUnitsOfMeasurement();
  const { data: complaintStatuses = [] } = useComplaintStatuses();
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => db.entities.Product.filter({ is_active: true }, 'name', 200),
  });

  useEffect(() => {
    if (!open) return;
    setUploadError('');
    setForm({
      ...EMPTY_FORM,
      priority_id: findIdByName(priorities, 'Medium') || '',
      assigned_department_id: findDepartmentIdByName(departments, 'Customer Service') || '',
    });
  }, [open, priorities, departments]);

  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

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
    const hasValidProduct = form.affected_products.some((item) => item.product_id);
    if (!form.customer_name || !form.tracking_number.trim() || !form.purchase_date || !hasValidProduct || !form.complaint_type_id || !form.description) {
      toast.error('Please fill in all required fields');
      return;
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
      purchase_date: form.purchase_date,
      affected_products: affectedProducts,
      complaint_type_id: form.complaint_type_id,
      description: form.description,
      proof_files: form.proof_files.map((file) => file.path),
      assigned_department_id: form.assigned_department_id || findDepartmentIdByName(departments, 'Customer Service') || null,
      assigned_user_id: user?.id || null,
      courier_id: form.courier_id || null,
      tracking_number: form.tracking_number,
      priority_id: form.priority_id || findIdByName(priorities, 'Medium') || null,
      ticket_id: ticketId,
      status_id: findIdByName(complaintStatuses, 'New Complaint'),
    };
    const created = await db.entities.Complaint.create(complaintData);
    await db.entities.TicketActivity.create({
      complaint_id: created.id,
      action_type: 'created',
      description: `Ticket ${created.ticket_id || ticketId} created by ${user?.full_name || 'Unknown'}`,
      user_id: user?.id,
    });
    queryClient.invalidateQueries({ queryKey: ['complaints'] });
    const sharePayload = {
      ...created,
      complaint_type: created.complaint_type ?? complaintTypes.find((t) => String(t.id) === String(form.complaint_type_id))?.name,
      priority: created.priority ?? priorities.find((p) => String(p.id) === String(form.priority_id))?.name,
      assigned_department: created.assigned_department ?? departments.find((d) => String(d.id) === String(form.assigned_department_id))?.name,
      assigned_user_name: created.assigned_user_name ?? user?.full_name,
      customer_name: created.customer_name ?? form.customer_name,
      order_number: created.order_number ?? form.order_number,
      order_source: created.order_source ?? form.order_source,
      purchase_date: created.purchase_date ?? form.purchase_date,
      tracking_number: created.tracking_number ?? form.tracking_number,
      status: created.status ?? complaintStatuses.find((s) => String(s.id) === String(complaintData.status_id))?.name,
      affected_products: (created.affected_products ?? []).map((item) => ({
        ...item,
        product_name: item.product_name ?? products.find((p) => String(p.id) === String(item.product_id))?.name,
        unit_of_measurement: item.unit_of_measurement ?? unitsOfMeasurement.find((u) => String(u.id) === String(item.unit_of_measurement_id))?.name,
      })),
    };
    offerWhatsappShareToast(sharePayload, { event: 'created' });
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
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Customer Name *</Label>
            <Input value={form.customer_name} onChange={e => update('customer_name', e.target.value)} placeholder="Full name" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Phone Number</Label>
            <Input value={form.customer_phone} onChange={e => update('customer_phone', e.target.value)} placeholder="60123456789" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Tracking Number *</Label>
            <Input value={form.tracking_number} onChange={e => update('tracking_number', e.target.value)} placeholder="Tracking #" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Order Number</Label>
            <Input value={form.order_number} onChange={e => update('order_number', e.target.value)} placeholder="ORD-..." />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Order Source</Label>
            <Select value={form.order_source} onValueChange={v => update('order_source', v)}>
              <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
              <SelectContent>
                {ORDER_SOURCES.map(source => (
                  <SelectItem key={source} value={source}>{source}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Purchase Date *</Label>
            <Input
              type="date"
              value={form.purchase_date}
              onChange={e => update('purchase_date', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Courier</Label>
            <Select value={form.courier_id} onValueChange={v => update('courier_id', v)}>
              <SelectTrigger><SelectValue placeholder="Select courier" /></SelectTrigger>
              <SelectContent>
                {couriers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Complaint Type *</Label>
            <Select value={form.complaint_type_id} onValueChange={v => update('complaint_type_id', v)}>
              <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                {complaintTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Priority</Label>
            <Select value={form.priority_id} onValueChange={v => update('priority_id', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {priorities.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <AffectedProductsEditor
          products={products}
          unitsOfMeasurement={unitsOfMeasurement}
          value={form.affected_products}
          onChange={(affected_products) => update('affected_products', affected_products)}
        />

        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Description *</Label>
          <Textarea value={form.description} onChange={e => update('description', e.target.value)} placeholder="Describe the complaint in detail..." rows={3} />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Proof Files</Label>
          <div className="flex items-start gap-3 flex-wrap">
            <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border hover:border-primary cursor-pointer text-sm text-muted-foreground hover:text-primary transition-colors shrink-0">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              <span>{uploading ? 'Uploading...' : 'Upload files'}</span>
              <input type="file" multiple accept="image/*,video/*,.pdf,.doc,.docx" className="hidden" onChange={handleFileUpload} />
            </label>
            {form.proof_files.map((file, i) => (
              <div key={file.path} className="relative group w-20 h-20 rounded-lg border bg-muted overflow-hidden shrink-0">
                <ProofFileThumbnail
                  url={file.url}
                  name={file.name}
                  isImage={file.isImage}
                  isVideo={file.isVideo}
                />
                <button
                  type="button"
                  onClick={() => removeProofFile(i)}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
          {uploadError && (
            <p className="text-xs text-destructive" role="alert">{uploadError}</p>
          )}
          <p className="text-xs text-muted-foreground">Maximum file size: 10 MB per file.</p>
        </div>
        </div>

        <DialogFooter className="shrink-0 border-t px-6 py-4 bg-background">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Create Ticket
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
