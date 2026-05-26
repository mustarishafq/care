import { db } from '@/api/db';

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Shield, FileText, RefreshCw, Building2, Truck, AlertCircle, Pencil, Plus, X, Loader2, Bell, Link2, Eye, EyeOff, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { usePermissions } from '@/lib/usePermissions';
import { useDepartments } from '@/lib/useDepartments';
import { useComplaintTypes, useCouriers, usePriorities } from '@/lib/useLookups';

const SLA_DEFAULT = { first_response: 2, low: 72, medium: 48, high: 24, urgent: 6, stale_alert_hours: 24 };

const LOOKUP_SECTIONS = [
  { key: 'departments', label: 'Departments', icon: Building2, entity: 'Department', queryKey: 'departments' },
  { key: 'complaint_types', label: 'Complaint Types', icon: FileText, entity: 'ComplaintType', queryKey: 'complaint_types' },
  { key: 'couriers', label: 'Courier List', icon: Truck, entity: 'Courier', queryKey: 'couriers' },
  { key: 'priorities', label: 'Priority Levels', icon: AlertCircle, entity: 'Priority', queryKey: 'priorities' },
];

const NOTIFICATION_TRIGGERS = [
  { event: 'Ticket Assigned', when: 'A complaint is assigned to a user', type: 'ticket_assigned' },
  { event: 'Status Changed', when: 'Complaint status is updated', type: 'status_changed' },
  { event: 'SLA Warning', when: '80% of SLA deadline reached', type: 'sla_warning' },
  { event: 'Overdue', when: 'SLA deadline has passed', type: 'overdue' },
  { event: 'Internal Note', when: 'A new internal note is added', type: 'mention' },
];

export default function Settings() {
  const queryClient = useQueryClient();
  const { hasPermission, loading: permLoading } = usePermissions();
  const canManage = hasPermission('settings.manage');
  const [saving, setSaving] = useState(false);
  const [slaOpen, setSlaOpen] = useState(false);
  const [slaForm, setSlaForm] = useState(SLA_DEFAULT);
  const [ssoOpen, setSsoOpen] = useState(false);
  const [ssoForm, setSsoForm] = useState({ api_key: '', issuer_url: '', enabled: false });
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lookupOpen, setLookupOpen] = useState(false);
  const [lookupMeta, setLookupMeta] = useState(null);
  const [lookupItems, setLookupItems] = useState([]);
  const [newLookupItem, setNewLookupItem] = useState('');

  const { data: departments = [], refetch: refetchDepartments } = useDepartments();
  const { data: complaintTypes = [], refetch: refetchComplaintTypes } = useComplaintTypes();
  const { data: couriers = [], refetch: refetchCouriers } = useCouriers();
  const { data: priorities = [], refetch: refetchPriorities } = usePriorities();

  const lookupData = {
    departments,
    complaint_types: complaintTypes,
    couriers,
    priorities,
  };

  const lookupRefetchers = {
    departments: refetchDepartments,
    complaint_types: refetchComplaintTypes,
    couriers: refetchCouriers,
    priorities: refetchPriorities,
  };

  const { data: configs = [] } = useQuery({
    queryKey: ['system_configs'],
    queryFn: () => db.entities.SystemConfig.list(),
  });

  const getSla = () => {
    const found = configs.find(c => c.key === 'sla_settings');
    return found?.json_value || SLA_DEFAULT;
  };

  const openSla = () => {
    setSlaForm(getSla());
    setSlaOpen(true);
  };

  const saveSla = async () => {
    setSaving(true);
    const existing = configs.find(c => c.key === 'sla_settings');
    if (existing) {
      await db.entities.SystemConfig.update(existing.id, { json_value: slaForm });
    } else {
      await db.entities.SystemConfig.create({ key: 'sla_settings', label: 'SLA Settings', json_value: slaForm });
    }
    queryClient.invalidateQueries({ queryKey: ['system_configs'] });
    toast.success('SLA settings saved');
    setSaving(false);
    setSlaOpen(false);
  };

  const sla = getSla();

  const getSso = () => {
    const found = configs.find(c => c.key === 'nexus_sso');
    const raw = found?.json_value ?? {};
    return {
      api_key: raw.api_key ?? raw.secret ?? '',
      issuer_url: raw.issuer_url ?? raw.issuer ?? '',
      enabled: raw.enabled ?? false,
      default_role: raw.default_role ?? 'viewer',
    };
  };

  const toSsoPayload = (form) => ({
    enabled: form.enabled ?? false,
    secret: form.api_key ?? '',
    issuer: form.issuer_url ?? '',
    default_role: form.default_role ?? 'viewer',
  });

  const openSso = () => {
    setSsoForm(getSso());
    setSsoOpen(true);
  };

  const saveSso = async () => {
    setSaving(true);
    const payload = toSsoPayload(ssoForm);
    const existing = configs.find(c => c.key === 'nexus_sso');
    if (existing) {
      await db.entities.SystemConfig.update(existing.id, { json_value: payload });
    } else {
      await db.entities.SystemConfig.create({ key: 'nexus_sso', label: 'Nexus SSO Settings', json_value: payload });
    }
    queryClient.invalidateQueries({ queryKey: ['system_configs'] });
    toast.success('SSO settings saved');
    setSaving(false);
    setSsoOpen(false);
  };

  const copyKey = () => {
    navigator.clipboard.writeText(ssoForm.api_key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const generateKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const key = Array.from({ length: 48 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    setSsoForm(p => ({ ...p, api_key: key }));
  };

  const sso = getSso();

  const openLookup = (section) => {
    const items = lookupData[section.key] || [];
    setLookupMeta(section);
    setLookupItems(items.map((item) => ({ id: item.id, name: item.name })));
    setNewLookupItem('');
    setLookupOpen(true);
  };

  const saveLookup = async () => {
    if (!lookupMeta) return;
    setSaving(true);
    const current = lookupData[lookupMeta.key] || [];
    const nextIds = new Set(lookupItems.filter((item) => item.id).map((item) => item.id));

    for (const item of current) {
      if (!nextIds.has(item.id)) {
        await db.entities[lookupMeta.entity].delete(item.id);
      }
    }

    for (const [index, item] of lookupItems.entries()) {
      if (item.id) {
        await db.entities[lookupMeta.entity].update(item.id, { name: item.name.trim(), sort_order: index });
      } else if (item.name.trim()) {
        await db.entities[lookupMeta.entity].create({ name: item.name.trim(), sort_order: index, is_active: true });
      }
    }

    await lookupRefetchers[lookupMeta.key]?.();
    queryClient.invalidateQueries({ queryKey: [lookupMeta.queryKey] });
    toast.success(`${lookupMeta.label} saved`);
    setSaving(false);
    setLookupOpen(false);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">System configuration — click the edit icon to modify any setting</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {LOOKUP_SECTIONS.map((section) => (
          <Card key={section.key}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <section.icon className="w-4 h-4" />{section.label}
                </CardTitle>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openLookup(section)} disabled={!canManage}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {(lookupData[section.key] || []).map(item => (
                  <Badge key={item.id} variant="secondary" className="text-xs">{item.name}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}

        {/* SLA Settings */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="w-4 h-4" />SLA Settings
              </CardTitle>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={openSla} disabled={!canManage}>
                <Pencil className="w-3.5 h-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { label: 'First Response Target', value: sla.first_response, unit: 'hours' },
              { label: 'Resolution (Low)', value: sla.low, unit: 'hours' },
              { label: 'Resolution (Medium)', value: sla.medium, unit: 'hours' },
              { label: 'Resolution (High)', value: sla.high, unit: 'hours' },
              { label: 'Resolution (Urgent)', value: sla.urgent, unit: 'hours' },
              { label: 'Stale Alert Threshold', value: sla.stale_alert_hours ?? 24, unit: 'hours' },
            ].map(row => (
              <div key={row.label} className="flex justify-between items-center py-1.5 border-b border-border last:border-0">
                <span className="text-sm">{row.label}</span>
                <Badge variant="secondary">{row.value} {row.unit}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Nexus SSO Settings */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Link2 className="w-4 h-4" />Nexus SSO Integration
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant={sso.enabled ? 'default' : 'secondary'} className="text-[10px]">
                  {sso.enabled ? 'Enabled' : 'Disabled'}
                </Badge>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={openSso} disabled={!canManage}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { label: 'API Key (Secret)', value: sso.api_key ? '••••••••••••••••' : 'Not configured' },
              { label: 'Expected Issuer URL', value: sso.issuer_url || 'Not configured' },
              { label: 'SSO Endpoint', value: `${window.location.origin}/sso/nexus` },
            ].map(row => (
              <div key={row.label} className="flex justify-between items-center py-1.5 border-b border-border last:border-0 gap-3">
                <span className="text-sm">{row.label}</span>
                <span className="text-xs text-muted-foreground font-mono truncate max-w-[160px]">{row.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Notification Triggers (read-only info) */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="w-4 h-4" />Notification Triggers
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {NOTIFICATION_TRIGGERS.map(n => (
              <div key={n.event} className="flex items-start justify-between py-1.5 border-b border-border last:border-0 gap-3">
                <div>
                  <p className="text-sm font-medium">{n.event}</p>
                  <p className="text-xs text-muted-foreground">{n.when}</p>
                </div>
                <Badge variant="outline" className="text-[10px] shrink-0">{n.type}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Dialog open={lookupOpen} onOpenChange={setLookupOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit {lookupMeta?.label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {lookupItems.map((item, idx) => (
                <div key={item.id || `new-${idx}`} className="flex items-center gap-2">
                  <Input
                    value={item.name}
                    onChange={e => setLookupItems(prev => prev.map((v, i) => i === idx ? { ...v, name: e.target.value } : v))}
                    className="h-8 text-sm"
                  />
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive shrink-0" onClick={() => setLookupItems(prev => prev.filter((_, i) => i !== idx))}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newLookupItem}
                onChange={e => setNewLookupItem(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newLookupItem.trim()) {
                    setLookupItems(prev => [...prev, { name: newLookupItem.trim() }]);
                    setNewLookupItem('');
                  }
                }}
                placeholder="Add new item..."
                className="h-8 text-sm"
              />
              <Button size="icon" variant="outline" className="h-8 w-8 shrink-0" onClick={() => {
                if (!newLookupItem.trim()) return;
                setLookupItems(prev => [...prev, { name: newLookupItem.trim() }]);
                setNewLookupItem('');
              }}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLookupOpen(false)}>Cancel</Button>
            <Button onClick={saveLookup} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Nexus SSO Dialog */}
      <Dialog open={ssoOpen} onOpenChange={setSsoOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Link2 className="w-4 h-4" />Nexus SSO Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="rounded-lg bg-muted/50 border p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">How it works</p>
              <p>Share your API Key with Nexus (Connected Systems → Edit → API Key). Nexus will sign JWT tokens with this secret to authenticate users into this app.</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">API Key (Shared Secret) <span className="text-destructive">*</span></Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showKey ? 'text' : 'password'}
                    value={ssoForm.api_key}
                    onChange={e => setSsoForm(p => ({ ...p, api_key: e.target.value }))}
                    placeholder="Min. 32 characters..."
                    className="h-8 text-sm pr-8 font-mono"
                  />
                  <button className="absolute right-2 top-1.5 text-muted-foreground hover:text-foreground" onClick={() => setShowKey(v => !v)}>
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <Button size="icon" variant="outline" className="h-8 w-8 shrink-0" onClick={copyKey} title="Copy key">
                  {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                </Button>
                <Button size="sm" variant="outline" className="h-8 shrink-0 text-xs" onClick={generateKey}>Generate</Button>
              </div>
              {ssoForm.api_key && ssoForm.api_key.length < 32 && (
                <p className="text-xs text-destructive">Key must be at least 32 characters</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Expected Issuer URL (Nexus base URL)</Label>
              <Input
                type="url"
                value={ssoForm.issuer_url}
                onChange={e => setSsoForm(p => ({ ...p, issuer_url: e.target.value }))}
                placeholder="https://nexus.example.com"
                className="h-8 text-sm"
              />
              <p className="text-xs text-muted-foreground">JWT tokens with a different <code className="bg-muted px-1 rounded">iss</code> claim will be rejected.</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">SSO Endpoint (share this with Nexus as your Base URL)</Label>
              <div className="flex gap-2">
                <Input readOnly value={`${window.location.origin}/sso/nexus`} className="h-8 text-sm font-mono bg-muted" />
                <Button size="icon" variant="outline" className="h-8 w-8 shrink-0" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/sso/nexus`); toast.success('Copied!'); }}>
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <input
                type="checkbox"
                id="sso-enabled"
                checked={!!ssoForm.enabled}
                onChange={e => setSsoForm(p => ({ ...p, enabled: e.target.checked }))}
                className="h-4 w-4 rounded"
              />
              <Label htmlFor="sso-enabled" className="text-sm cursor-pointer">Enable Nexus SSO</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSsoOpen(false)}>Cancel</Button>
            <Button onClick={saveSso} disabled={saving || ((ssoForm.api_key?.length ?? 0) > 0 && (ssoForm.api_key?.length ?? 0) < 32)}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SLA Edit Dialog */}
      <Dialog open={slaOpen} onOpenChange={setSlaOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Edit SLA Settings (hours)</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {[
              { field: 'first_response', label: 'First Response Target' },
              { field: 'low', label: 'Resolution Target — Low' },
              { field: 'medium', label: 'Resolution Target — Medium' },
              { field: 'high', label: 'Resolution Target — High' },
              { field: 'urgent', label: 'Resolution Target — Urgent' },
              { field: 'stale_alert_hours', label: 'Stale Ticket Alert (New/Pending)' },
            ].map(row => (
              <div key={row.field} className="flex items-center gap-3">
                <Label className="text-xs w-52 shrink-0">{row.label}</Label>
                <Input
                  type="number"
                  min={1}
                  className="h-8 text-sm w-24"
                  value={slaForm[row.field]}
                  onChange={e => setSlaForm(p => ({ ...p, [row.field]: Number(e.target.value) }))}
                />
                <span className="text-xs text-muted-foreground">hrs</span>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSlaOpen(false)}>Cancel</Button>
            <Button onClick={saveSla} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}