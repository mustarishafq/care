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
import { findIdByName, useComplaintStatuses, useComplaintTypes, useCouriers, usePriorities } from '@/lib/useLookups';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { FileText, FileVideo, Loader2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { offerWhatsappShareToast } from '@/lib/whatsappShareToast';

const storageUrl = (path) => {
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `/storage/${path.replace(/^\//, '')}`;
};

const EMPTY_FORM = {
  customer_name: '',
  customer_phone: '',
  order_number: '',
  product_id: '',
  quantity_affected: 1,
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
  const { data: departments = [] } = useDepartments();
  const { data: complaintTypes = [] } = useComplaintTypes();
  const { data: couriers = [] } = useCouriers();
  const { data: priorities = [] } = usePriorities();
  const { data: complaintStatuses = [] } = useComplaintStatuses();
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => db.entities.Product.filter({ is_active: true }, 'name', 200),
  });

  useEffect(() => {
    if (!open) return;
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
    const uploaded = [];
    for (const file of files) {
      const { path, url } = await db.integrations.Core.UploadFile({ file });
      uploaded.push({
        path,
        url: url || storageUrl(path),
        name: file.name,
        isImage: file.type.startsWith('image/'),
        isVideo: file.type.startsWith('video/'),
      });
    }
    update('proof_files', [...form.proof_files, ...uploaded]);
    setUploading(false);
    e.target.value = '';
  };

  const removeProofFile = (index) => {
    update('proof_files', form.proof_files.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!form.customer_name || !form.order_number || !form.product_id || !form.complaint_type_id || !form.description) {
      toast.error('Please fill in all required fields');
      return;
    }
    setSaving(true);
    const ticketId = generateTicketId();
    const complaintData = {
      ...form,
      proof_files: form.proof_files.map((file) => file.path),
      assigned_department_id: form.assigned_department_id || findDepartmentIdByName(departments, 'Customer Service') || null,
      courier_id: form.courier_id || null,
      priority_id: form.priority_id || findIdByName(priorities, 'Medium') || null,
      ticket_id: ticketId,
      status_id: findIdByName(complaintStatuses, 'New Complaint'),
      quantity_affected: Number(form.quantity_affected) || 1,
    };
    const created = await db.entities.Complaint.create(complaintData);
    await db.entities.TicketActivity.create({
      complaint_id: created.id,
      action_type: 'created',
      description: `Ticket ${created.ticket_id || ticketId} created by ${user?.full_name || 'Unknown'}`,
      user_id: user?.id,
    });
    queryClient.invalidateQueries({ queryKey: ['complaints'] });
    const product = products.find((p) => String(p.id) === String(form.product_id));
    const sharePayload = {
      ...created,
      complaint_type: created.complaint_type ?? complaintTypes.find((t) => String(t.id) === String(form.complaint_type_id))?.name,
      priority: created.priority ?? priorities.find((p) => String(p.id) === String(form.priority_id))?.name,
      assigned_department: created.assigned_department ?? departments.find((d) => String(d.id) === String(form.assigned_department_id))?.name,
      product_name: created.product_name ?? product?.name,
      customer_name: created.customer_name ?? form.customer_name,
      order_number: created.order_number ?? form.order_number,
      status: created.status ?? complaintStatuses.find((s) => String(s.id) === String(complaintData.status_id))?.name,
    };
    offerWhatsappShareToast(sharePayload, { event: 'created' });
    setSaving(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">Create New Complaint</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Customer Name *</Label>
            <Input value={form.customer_name} onChange={e => update('customer_name', e.target.value)} placeholder="Full name" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Phone Number</Label>
            <Input value={form.customer_phone} onChange={e => update('customer_phone', e.target.value)} placeholder="+62..." />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Order Number *</Label>
            <Input value={form.order_number} onChange={e => update('order_number', e.target.value)} placeholder="ORD-..." />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Product *</Label>
            {products.length > 0 ? (
              <Select value={form.product_id} onValueChange={v => update('product_id', v)}>
                <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                <SelectContent>
                  {products.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}{p.sku ? ` (${p.sku})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm text-muted-foreground py-2">Add products on the Products page before creating complaints.</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Quantity Affected</Label>
            <Input type="number" min={1} value={form.quantity_affected} onChange={e => update('quantity_affected', e.target.value)} />
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
            <Label className="text-xs font-medium">Tracking Number</Label>
            <Input value={form.tracking_number} onChange={e => update('tracking_number', e.target.value)} placeholder="Tracking #" />
          </div>
        </div>

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
                {file.isImage ? (
                  <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center justify-center w-full h-full p-1 gap-1">
                    {file.isVideo ? (
                      <FileVideo className="w-5 h-5 text-muted-foreground shrink-0" />
                    ) : (
                      <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
                    )}
                    <span className="text-[10px] text-muted-foreground truncate w-full text-center px-0.5" title={file.name}>
                      {file.name}
                    </span>
                  </div>
                )}
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
        </div>

        <DialogFooter>
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
