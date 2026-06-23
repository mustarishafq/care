import { db } from '@/api/db';

import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Bell, Clock, Database, GitBranch, Link2, Loader2, Eye, EyeOff, Copy, Check,
  Shield, Settings2, Webhook, Lock, Sun,
} from 'lucide-react';
import ThemeToggle from '@/components/theme/ThemeToggle';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { usePermissions } from '@/lib/usePermissions';
import { useDepartments } from '@/lib/useDepartments';
import { useComplaintTypes, useCouriers, usePriorities, useUnitsOfMeasurement, useComplaintStatuses } from '@/lib/useLookups';
import StatCard from '@/components/dashboard/StatCard';
import PageHeader from '@/components/layout/PageHeader';
import LookupEditDialog from '@/components/settings/LookupEditDialog';
import SettingsConfigCard from '@/components/settings/SettingsConfigCard';
import SettingsLookupCard from '@/components/settings/SettingsLookupCard';
import {
  AUTO_CLOSE_DEFAULT,
  formatAutoCloseDelay,
  LOOKUP_SECTIONS,
  NOTIFICATION_TRIGGERS,
  ROUTING_DEFAULT,
  SLA_DEFAULT,
} from '@/components/settings/constants';
import { getPausedStatusNames, getResolvedStatusNames, normalizeSlaSettings, toggleStatusId } from '@/lib/slaSettings';
import {
  getAutoCloseTargetStatusName,
  getAutoCloseTriggerStatusName,
  normalizeAutoCloseSettings,
} from '@/lib/autoCloseSettings';
import { DEFAULT_STATUS_COLOR, defaultColorForIndex } from '@/lib/statusColors';

export default function Settings() {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('settings.manage');
  const [activeTab, setActiveTab] = useState('lookups');
  const [saving, setSaving] = useState(false);
  const [slaOpen, setSlaOpen] = useState(false);
  const [slaForm, setSlaForm] = useState(SLA_DEFAULT);
  const [ssoOpen, setSsoOpen] = useState(false);
  const [ssoForm, setSsoForm] = useState({ api_key: '', issuer_url: '', enabled: false });
  const [autoCloseOpen, setAutoCloseOpen] = useState(false);
  const [autoCloseForm, setAutoCloseForm] = useState(AUTO_CLOSE_DEFAULT);
  const [routingOpen, setRoutingOpen] = useState(false);
  const [routingForm, setRoutingForm] = useState(ROUTING_DEFAULT);
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lookupOpen, setLookupOpen] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupMeta, setLookupMeta] = useState(null);
  const [lookupItems, setLookupItems] = useState([]);

  const { data: departments = [], refetch: refetchDepartments } = useDepartments();
  const { data: complaintTypes = [], refetch: refetchComplaintTypes } = useComplaintTypes();
  const { data: complaintStatuses = [], refetch: refetchComplaintStatuses } = useComplaintStatuses();
  const { data: couriers = [], refetch: refetchCouriers } = useCouriers();
  const { data: unitsOfMeasurement = [], refetch: refetchUnitsOfMeasurement } = useUnitsOfMeasurement();
  const { data: priorities = [], refetch: refetchPriorities } = usePriorities();

  const lookupData = useMemo(() => ({
    departments,
    complaint_types: complaintTypes,
    complaint_statuses: complaintStatuses,
    couriers,
    units_of_measurement: unitsOfMeasurement,
    priorities,
  }), [departments, complaintTypes, complaintStatuses, couriers, unitsOfMeasurement, priorities]);

  const lookupRefetchers = {
    departments: refetchDepartments,
    complaint_types: refetchComplaintTypes,
    complaint_statuses: refetchComplaintStatuses,
    couriers: refetchCouriers,
    units_of_measurement: refetchUnitsOfMeasurement,
    priorities: refetchPriorities,
  };

  const lookupTotal = useMemo(
    () => LOOKUP_SECTIONS.reduce((sum, section) => sum + (lookupData[section.key]?.length ?? 0), 0),
    [lookupData],
  );

  const { data: configs = [] } = useQuery({
    queryKey: ['system_configs'],
    queryFn: () => db.entities.SystemConfig.list(),
  });

  const getSla = () => normalizeSlaSettings(
    configs.find((c) => c.key === 'sla_settings')?.json_value,
    complaintStatuses,
  );
  const getAutoClose = () => normalizeAutoCloseSettings(
    configs.find((c) => c.key === 'auto_close_delivered')?.json_value,
    complaintStatuses,
  );
  const getRouting = () => {
    const raw = configs.find((c) => c.key === 'complaint_routing')?.json_value ?? {};
    return {
      enabled: raw.enabled ?? false,
      default_department_id: raw.default_department_id ? String(raw.default_department_id) : '',
      default_status_id: raw.default_status_id ? String(raw.default_status_id) : '',
      rules: Array.isArray(raw.rules) ? raw.rules : [],
    };
  };
  const getSso = () => {
    const raw = configs.find((c) => c.key === 'nexus_sso')?.json_value ?? {};
    return {
      api_key: raw.api_key ?? raw.secret ?? '',
      issuer_url: raw.issuer_url ?? raw.issuer ?? '',
      enabled: raw.enabled ?? false,
      default_role: raw.default_role ?? 'viewer',
    };
  };

  const sla = getSla();
  const slaPausedStatusNames = getPausedStatusNames(sla, complaintStatuses);
  const slaResolvedStatusNames = getResolvedStatusNames(sla, complaintStatuses);
  const autoClose = getAutoClose();
  const autoCloseTriggerStatusName = getAutoCloseTriggerStatusName(autoClose, complaintStatuses);
  const autoCloseTargetStatusName = getAutoCloseTargetStatusName(autoClose, complaintStatuses);
  const routing = getRouting();
  const sso = getSso();
  const routingRuleCount = routing.rules.filter((rule) => rule.department_id || rule.status_id).length;
  const automationActive = [routing.enabled, autoClose.enabled].filter(Boolean).length;

  const routingPreview = useMemo(() => routing.rules
    .filter((rule) => rule.department_id || rule.status_id)
    .map((rule) => {
      const type = complaintTypes.find((t) => String(t.id) === String(rule.complaint_type_id));
      const dept = departments.find((d) => String(d.id) === String(rule.department_id));
      const status = complaintStatuses.find((s) => String(s.id) === String(rule.status_id));
      return {
        id: rule.complaint_type_id,
        type: type?.name ?? 'Unknown type',
        department: dept?.name ?? 'Default',
        status: status?.name ?? 'Default',
      };
    })
    .slice(0, 5), [routing.rules, complaintTypes, departments, complaintStatuses]);

  const saveConfig = async (key, label, json_value) => {
    const existing = configs.find((c) => c.key === key);
    if (existing) {
      await db.entities.SystemConfig.update(existing.id, { json_value });
    } else {
      await db.entities.SystemConfig.create({ key, label, json_value });
    }
    await queryClient.invalidateQueries({ queryKey: ['system_configs'] });
  };

  const openSla = () => { setSlaForm(getSla()); setSlaOpen(true); };
  const saveSla = async () => {
    setSaving(true);
    try {
      await saveConfig('sla_settings', 'SLA Settings', {
        ...slaForm,
        paused_status_ids: (slaForm.paused_status_ids ?? [])
          .map((id) => Number(id))
          .filter((id) => id > 0),
        resolved_status_ids: (slaForm.resolved_status_ids ?? [])
          .map((id) => Number(id))
          .filter((id) => id > 0),
      });
      toast.success('SLA settings saved');
      setSlaOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const openAutoClose = () => { setAutoCloseForm(getAutoClose()); setAutoCloseOpen(true); };
  const saveAutoClose = async () => {
    setSaving(true);
    try {
      await saveConfig('auto_close_delivered', 'Auto-Close Delivered Tickets', {
        ...autoCloseForm,
        delay_amount: Math.max(1, Number(autoCloseForm.delay_amount) || 1),
        trigger_status_id: autoCloseForm.trigger_status_id ? Number(autoCloseForm.trigger_status_id) : null,
        target_status_id: autoCloseForm.target_status_id ? Number(autoCloseForm.target_status_id) : null,
      });
      toast.success('Auto-close settings saved');
      setAutoCloseOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const openRouting = () => {
    const saved = getRouting();
    const rules = complaintTypes.map((type) => {
      const existing = saved.rules.find((rule) => String(rule.complaint_type_id) === String(type.id));
      return {
        complaint_type_id: String(type.id),
        complaint_type_name: type.name,
        department_id: existing?.department_id ? String(existing.department_id) : '',
        status_id: existing?.status_id ? String(existing.status_id) : '',
      };
    });
    setRoutingForm({ ...saved, rules });
    setRoutingOpen(true);
  };

  const saveRouting = async () => {
    setSaving(true);
    try {
      await saveConfig('complaint_routing', 'Complaint Routing', {
        enabled: !!routingForm.enabled,
        default_department_id: routingForm.default_department_id || null,
        default_status_id: routingForm.default_status_id || null,
        rules: routingForm.rules
          .filter((rule) => rule.department_id || rule.status_id)
          .map((rule) => ({
            complaint_type_id: rule.complaint_type_id,
            department_id: rule.department_id || null,
            status_id: rule.status_id || null,
          })),
      });
      toast.success('Complaint routing saved');
      setRoutingOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const toSsoPayload = (form) => ({
    enabled: form.enabled ?? false,
    secret: form.api_key ?? '',
    issuer: form.issuer_url ?? '',
    default_role: form.default_role ?? 'viewer',
  });

  const openSso = () => { setSsoForm(getSso()); setSsoOpen(true); };
  const saveSso = async () => {
    setSaving(true);
    try {
      await saveConfig('nexus_sso', 'Nexus SSO Settings', toSsoPayload(ssoForm));
      toast.success('SSO settings saved');
      setSsoOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const openLookup = async (section) => {
    setLookupMeta(section);
    setLookupItems([]);
    setLookupOpen(true);
    setLookupLoading(true);
    try {
      const result = await lookupRefetchers[section.key]?.();
      const items = result?.data ?? lookupData[section.key] ?? [];
      setLookupItems(items.map((item, index) => ({
        id: String(item.id),
        name: item.name,
        ...(section.key === 'complaint_statuses'
          ? { color: item.color || defaultColorForIndex(index) }
          : {}),
      })));
    } catch (err) {
      toast.error(err.message || `Failed to load ${section.label}`);
      setLookupOpen(false);
    } finally {
      setLookupLoading(false);
    }
  };

  const saveLookup = async () => {
    if (!lookupMeta || lookupLoading) return;
    if (!lookupItems.length) {
      toast.error('Add at least one item');
      return;
    }

    setSaving(true);
    try {
      const result = await lookupRefetchers[lookupMeta.key]?.();
      const current = result?.data ?? lookupData[lookupMeta.key] ?? [];
      const nextIds = new Set(lookupItems.filter((item) => item.id).map((item) => String(item.id)));

      for (const item of current) {
        if (!nextIds.has(String(item.id))) {
          await db.entities[lookupMeta.entity].delete(item.id);
        }
      }

      for (const [index, item] of lookupItems.entries()) {
        const name = item.name.trim();
        if (!name) continue;
        const payload = { name, sort_order: index };
        if (lookupMeta.key === 'complaint_statuses') {
          payload.color = item.color || DEFAULT_STATUS_COLOR;
        }
        if (item.id) {
          await db.entities[lookupMeta.entity].update(item.id, payload);
        } else {
          await db.entities[lookupMeta.entity].create({ ...payload, is_active: true });
        }
      }

      await lookupRefetchers[lookupMeta.key]?.();
      await queryClient.invalidateQueries({ queryKey: [lookupMeta.queryKey] });
      toast.success(`${lookupMeta.label} saved`);
      setLookupOpen(false);
    } catch (err) {
      toast.error(err.message || `Failed to save ${lookupMeta.label}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Settings2}
        title="Settings"
        description="Manage lookup data, automation rules, and system integrations"
        actions={!canManage ? (
          <Badge variant="outline" className="w-fit gap-1.5 py-1">
            <Lock className="w-3 h-3" />
            View only
          </Badge>
        ) : null}
      />

      {!canManage && (
        <Alert>
          <Lock className="h-4 w-4" />
          <AlertTitle>Read-only access</AlertTitle>
          <AlertDescription>
            You can review settings but need the <code className="text-xs bg-muted px-1 rounded">settings.manage</code> permission to edit them.
          </AlertDescription>
        </Alert>
      )}

      <Card className="rounded-2xl">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Sun className="w-4 h-4 text-primary" />
              </div>
              <div>
                <Label className="text-sm font-medium">Dark Mode</Label>
                <p className="text-xs text-muted-foreground">Switch between light and dark themes</p>
              </div>
            </div>
            <ThemeToggle variant="switch" />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Lookup items" value={lookupTotal} icon={Database} />
        <StatCard label="Automation active" value={automationActive} icon={GitBranch} color="blue" />
        <StatCard label="Routing rules" value={routingRuleCount} icon={Shield} color="purple" />
        <StatCard label="SSO" value={sso.enabled ? 'On' : 'Off'} icon={Link2} color={sso.enabled ? 'success' : 'primary'} />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-10 grid w-full grid-cols-2 lg:grid-cols-4">
          <TabsTrigger value="lookups">Lookup Data</TabsTrigger>
          <TabsTrigger value="automation">Automation</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="lookups" className="mt-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            Dropdown values used across tickets, filters, and reports. Click a card to edit.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {LOOKUP_SECTIONS.map((section) => (
              <SettingsLookupCard
                key={section.key}
                section={section}
                items={lookupData[section.key] || []}
                canManage={canManage}
                onEdit={openLookup}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="automation" className="mt-6 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SettingsConfigCard
              title="Complaint Routing"
              description="Auto-assign department and initial status by complaint type"
              icon={GitBranch}
              enabled={routing.enabled}
              canManage={canManage}
              onEdit={openRouting}
              rows={[
                { label: 'Configured rules', value: routing.enabled ? `${routingRuleCount} types` : '—' },
                {
                  label: 'Default department',
                  value: routing.default_department_id
                    ? (departments.find((d) => String(d.id) === String(routing.default_department_id))?.name ?? '—')
                    : 'Customer Service (fallback)',
                },
                {
                  label: 'Default status',
                  value: routing.default_status_id
                    ? (complaintStatuses.find((s) => String(s.id) === String(routing.default_status_id))?.name ?? '—')
                    : 'New Complaint',
                },
              ]}
            >
              {routing.enabled && routingPreview.length > 0 && (
                <div className="rounded-lg border overflow-hidden mt-2">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="h-8 text-[11px]">Type</TableHead>
                        <TableHead className="h-8 text-[11px]">Department</TableHead>
                        <TableHead className="h-8 text-[11px]">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {routingPreview.map((row) => (
                        <TableRow key={row.id} className="hover:bg-muted/40">
                          <TableCell className="py-2 text-xs">{row.type}</TableCell>
                          <TableCell className="py-2 text-xs text-muted-foreground">{row.department}</TableCell>
                          <TableCell className="py-2 text-xs text-muted-foreground">{row.status}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {routingRuleCount > routingPreview.length && (
                    <p className="text-[11px] text-muted-foreground px-3 py-2 border-t">
                      +{routingRuleCount - routingPreview.length} more rules
                    </p>
                  )}
                </div>
              )}
            </SettingsConfigCard>

            <SettingsConfigCard
              title="SLA Settings"
              description="Response targets, stale alerts, and pause rules"
              icon={Shield}
              canManage={canManage}
              onEdit={openSla}
              rows={[
                { label: 'First response', value: `${sla.first_response} hours`, badge: true },
                { label: 'Resolution (Medium)', value: `${sla.medium} hours`, badge: true },
                { label: 'Resolution (Urgent)', value: `${sla.urgent} hours`, badge: true },
                { label: 'Stale alert', value: `${sla.stale_alert_hours ?? 24} hours`, badge: true },
                {
                  label: 'SLA paused in',
                  value: slaPausedStatusNames.length
                    ? `${slaPausedStatusNames.length} status${slaPausedStatusNames.length === 1 ? '' : 'es'}`
                    : 'None',
                },
                {
                  label: 'SLA stops in',
                  value: slaResolvedStatusNames.length
                    ? `${slaResolvedStatusNames.length} status${slaResolvedStatusNames.length === 1 ? '' : 'es'}`
                    : 'None',
                },
              ]}
            />

            <SettingsConfigCard
              title="Auto-Close Delivered"
              description="Automatically close tickets after a waiting period in a trigger status"
              icon={Clock}
              enabled={autoClose.enabled}
              canManage={canManage}
              onEdit={openAutoClose}
              rows={[
                { label: 'Trigger status', value: autoCloseTriggerStatusName },
                { label: 'Action', value: `Move to ${autoCloseTargetStatusName}` },
                { label: 'Delay', value: autoClose.enabled ? formatAutoCloseDelay(autoClose) : '—' },
              ]}
            />
          </div>
        </TabsContent>

        <TabsContent value="integrations" className="mt-6 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SettingsConfigCard
              title="Nexus SSO"
              description="Single sign-on from Nexus using signed JWT tokens"
              icon={Link2}
              enabled={sso.enabled}
              canManage={canManage}
              onEdit={openSso}
              rows={[
                { label: 'API key', value: sso.api_key ? 'Configured' : 'Not configured' },
                { label: 'Issuer URL', value: sso.issuer_url || 'Not configured' },
                { label: 'Endpoint', value: `${window.location.origin}/sso/nexus` },
              ]}
            />

            <Card className="hover:border-primary/30 transition-colors">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Webhook className="w-4 h-4" />
                  </span>
                  Webhooks
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Incoming tracking updates and outgoing event notifications are configured on the Integrations page.
                </p>
                <Button asChild variant="outline" size="sm">
                  <Link to="/integrations">Open Integrations</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="notifications" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="w-4 h-4" />
                Notification Triggers
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                System events that generate in-app notifications for agents.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead>
                    <TableHead>When it fires</TableHead>
                    <TableHead className="w-32">Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {NOTIFICATION_TRIGGERS.map((trigger) => (
                    <TableRow key={trigger.type}>
                      <TableCell className="font-medium text-sm">{trigger.event}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{trigger.when}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] font-mono">{trigger.type}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <LookupEditDialog
        open={lookupOpen}
        onOpenChange={setLookupOpen}
        section={lookupMeta}
        items={lookupItems}
        loading={lookupLoading}
        saving={saving}
        onSave={saveLookup}
        onItemsChange={setLookupItems}
      />

      <Dialog open={ssoOpen} onOpenChange={setSsoOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Link2 className="w-4 h-4" />Nexus SSO Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="rounded-lg bg-muted/50 border p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">How it works</p>
              <p>Share your API Key with Nexus. Nexus signs JWT tokens with this secret to authenticate users into this app.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">API Key (Shared Secret) <span className="text-destructive">*</span></Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showKey ? 'text' : 'password'}
                    value={ssoForm.api_key}
                    onChange={(e) => setSsoForm((p) => ({ ...p, api_key: e.target.value }))}
                    placeholder="Min. 32 characters..."
                    className="h-8 text-sm pr-8 font-mono"
                  />
                  <button type="button" className="absolute right-2 top-1.5 text-muted-foreground hover:text-foreground" onClick={() => setShowKey((v) => !v)}>
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <Button size="icon" variant="outline" className="h-8 w-8 shrink-0" onClick={() => { navigator.clipboard.writeText(ssoForm.api_key); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
                  {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                </Button>
                <Button size="sm" variant="outline" className="h-8 shrink-0 text-xs" onClick={() => {
                  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                  setSsoForm((p) => ({ ...p, api_key: Array.from({ length: 48 }, () => chars[Math.floor(Math.random() * chars.length)]).join('') }));
                }}>Generate</Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Expected Issuer URL</Label>
              <Input type="url" value={ssoForm.issuer_url} onChange={(e) => setSsoForm((p) => ({ ...p, issuer_url: e.target.value }))} placeholder="https://nexus.example.com" className="h-8 text-sm" />
            </div>
            <div className="flex items-center gap-3 pt-1">
              <Switch id="sso-enabled" checked={!!ssoForm.enabled} onCheckedChange={(checked) => setSsoForm((p) => ({ ...p, enabled: checked }))} />
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

      <Dialog open={autoCloseOpen} onOpenChange={setAutoCloseOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Clock className="w-4 h-4" />Auto-Close Tickets</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="rounded-lg bg-muted/50 border p-3 text-xs text-muted-foreground">
              Tickets in the trigger status are moved to the target status after the configured waiting period.
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="auto-close-enabled" className="text-sm">Enable auto-close</Label>
              <Switch id="auto-close-enabled" checked={!!autoCloseForm.enabled} onCheckedChange={(checked) => setAutoCloseForm((p) => ({ ...p, enabled: checked }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Trigger status</Label>
              <Select
                value={autoCloseForm.trigger_status_id || '__none__'}
                onValueChange={(value) => setAutoCloseForm((p) => ({ ...p, trigger_status_id: value === '__none__' ? '' : value }))}
                disabled={!autoCloseForm.enabled}
              >
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select status" /></SelectTrigger>
                <SelectContent>
                  {complaintStatuses.map((status) => (
                    <SelectItem key={status.id} value={String(status.id)}>{status.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Target status</Label>
              <Select
                value={autoCloseForm.target_status_id || '__none__'}
                onValueChange={(value) => setAutoCloseForm((p) => ({ ...p, target_status_id: value === '__none__' ? '' : value }))}
                disabled={!autoCloseForm.enabled}
              >
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select status" /></SelectTrigger>
                <SelectContent>
                  {complaintStatuses.map((status) => (
                    <SelectItem key={`target-${status.id}`} value={String(status.id)}>{status.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Close after waiting for</Label>
              <div className="flex items-center gap-2">
                <Input type="number" min={1} value={autoCloseForm.delay_amount} onChange={(e) => setAutoCloseForm((p) => ({ ...p, delay_amount: Math.max(1, Number(e.target.value) || 1) }))} className="h-8 text-sm w-20" disabled={!autoCloseForm.enabled} />
                <Select value={autoCloseForm.delay_unit} onValueChange={(value) => setAutoCloseForm((p) => ({ ...p, delay_unit: value }))} disabled={!autoCloseForm.enabled}>
                  <SelectTrigger className="h-8 text-sm w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hours">Hours</SelectItem>
                    <SelectItem value="days">Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAutoCloseOpen(false)}>Cancel</Button>
            <Button onClick={saveAutoClose} disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={routingOpen} onOpenChange={setRoutingOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
          <DialogHeader className="shrink-0 border-b px-6 py-4 pr-12">
            <DialogTitle className="flex items-center gap-2 text-lg"><GitBranch className="w-4 h-4" />Complaint Routing</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            <div className="rounded-lg bg-muted/50 border p-3 text-xs text-muted-foreground">
              New tickets are assigned to a department and initial status based on complaint type. Per-type rules override defaults.
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="routing-enabled" className="text-sm">Enable complaint routing</Label>
              <Switch id="routing-enabled" checked={!!routingForm.enabled} onCheckedChange={(checked) => setRoutingForm((p) => ({ ...p, enabled: checked }))} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Default department</Label>
                <Select value={routingForm.default_department_id || '__none__'} onValueChange={(value) => setRoutingForm((p) => ({ ...p, default_department_id: value === '__none__' ? '' : value }))} disabled={!routingForm.enabled}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {departments.map((dept) => <SelectItem key={dept.id} value={String(dept.id)}>{dept.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Default status</Label>
                <Select value={routingForm.default_status_id || '__none__'} onValueChange={(value) => setRoutingForm((p) => ({ ...p, default_status_id: value === '__none__' ? '' : value }))} disabled={!routingForm.enabled}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">New Complaint</SelectItem>
                    {complaintStatuses.map((status) => <SelectItem key={status.id} value={String(status.id)}>{status.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="rounded-lg border overflow-hidden">
              <div className="grid grid-cols-[1.2fr_1fr_1fr] gap-2 px-3 py-2 bg-muted/50 text-[11px] font-medium text-muted-foreground">
                <span>Complaint Type</span><span>Department</span><span>Status</span>
              </div>
              <div className="divide-y max-h-72 overflow-y-auto">
                {routingForm.rules.map((rule, index) => (
                  <div key={rule.complaint_type_id} className="grid grid-cols-[1.2fr_1fr_1fr] gap-2 px-3 py-2 items-center">
                    <span className="text-sm truncate" title={rule.complaint_type_name}>{rule.complaint_type_name}</span>
                    <Select value={rule.department_id || '__none__'} onValueChange={(value) => setRoutingForm((p) => ({ ...p, rules: p.rules.map((item, i) => i === index ? { ...item, department_id: value === '__none__' ? '' : value } : item) }))} disabled={!routingForm.enabled}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Default" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Use default</SelectItem>
                        {departments.map((dept) => <SelectItem key={dept.id} value={String(dept.id)}>{dept.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={rule.status_id || '__none__'} onValueChange={(value) => setRoutingForm((p) => ({ ...p, rules: p.rules.map((item, i) => i === index ? { ...item, status_id: value === '__none__' ? '' : value } : item) }))} disabled={!routingForm.enabled}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Default" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Use default</SelectItem>
                        {complaintStatuses.map((status) => <SelectItem key={status.id} value={String(status.id)}>{status.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="shrink-0 border-t px-6 py-4 bg-background">
            <Button variant="outline" onClick={() => setRoutingOpen(false)}>Cancel</Button>
            <Button onClick={saveRouting} disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={slaOpen} onOpenChange={setSlaOpen}>
        <DialogContent className="max-w-md max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
          <DialogHeader className="shrink-0 border-b px-6 py-4 pr-12">
            <DialogTitle>Edit SLA Settings</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            <div className="space-y-3">
              <Label className="text-xs font-medium">Resolution targets (hours)</Label>
              {[
                { field: 'first_response', label: 'First Response Target' },
                { field: 'low', label: 'Resolution Target — Low' },
                { field: 'medium', label: 'Resolution Target — Medium' },
                { field: 'high', label: 'Resolution Target — High' },
                { field: 'urgent', label: 'Resolution Target — Urgent' },
                { field: 'stale_alert_hours', label: 'Stale Ticket Alert' },
              ].map((row) => (
                <div key={row.field} className="flex items-center gap-3">
                  <Label className="text-xs w-44 shrink-0">{row.label}</Label>
                  <Input type="number" min={1} className="h-8 text-sm w-24" value={slaForm[row.field]} onChange={(e) => setSlaForm((p) => ({ ...p, [row.field]: Number(e.target.value) }))} />
                  <span className="text-xs text-muted-foreground">hrs</span>
                </div>
              ))}
            </div>

            <div className="space-y-2 pt-2 border-t">
              <div>
                <Label className="text-xs font-medium">SLA paused statuses</Label>
                <p className="text-[11px] text-muted-foreground mt-1">
                  While a ticket is in these statuses, the SLA countdown stops until it moves to another status.
                </p>
              </div>
              <div className="rounded-lg border divide-y max-h-48 overflow-y-auto">
                {complaintStatuses.map((status) => {
                  const checked = (slaForm.paused_status_ids ?? []).map(String).includes(String(status.id));
                  return (
                    <label
                      key={status.id}
                      htmlFor={`sla-pause-${status.id}`}
                      className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40 cursor-pointer"
                    >
                      <Checkbox
                        id={`sla-pause-${status.id}`}
                        checked={checked}
                        onCheckedChange={() => setSlaForm((prev) => ({
                          ...prev,
                          paused_status_ids: toggleStatusId(prev.paused_status_ids, status.id),
                        }))}
                      />
                      <span className="text-sm">{status.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t">
              <div>
                <Label className="text-xs font-medium">SLA stop statuses</Label>
                <p className="text-[11px] text-muted-foreground mt-1">
                  When a ticket reaches one of these statuses, the SLA timer stops and shows met or breached.
                </p>
              </div>
              <div className="rounded-lg border divide-y max-h-48 overflow-y-auto">
                {complaintStatuses.map((status) => {
                  const checked = (slaForm.resolved_status_ids ?? []).map(String).includes(String(status.id));
                  return (
                    <label
                      key={`resolved-${status.id}`}
                      htmlFor={`sla-resolved-${status.id}`}
                      className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40 cursor-pointer"
                    >
                      <Checkbox
                        id={`sla-resolved-${status.id}`}
                        checked={checked}
                        onCheckedChange={() => setSlaForm((prev) => ({
                          ...prev,
                          resolved_status_ids: toggleStatusId(prev.resolved_status_ids, status.id),
                        }))}
                      />
                      <span className="text-sm">{status.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter className="shrink-0 border-t px-6 py-4 bg-background">
            <Button variant="outline" onClick={() => setSlaOpen(false)}>Cancel</Button>
            <Button onClick={saveSla} disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
