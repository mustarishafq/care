import { db } from '@/api/db';

import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Clock, Database, GitBranch, Link2, Loader2, Eye, EyeOff, Copy, Check,
  Shield, Settings2, Lock, ClipboardCheck, ShoppingBag, CalendarDays,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { toastApiError } from '@/lib/toastApi';
import { usePermissions } from '@/lib/usePermissions';
import { useDepartments } from '@/lib/useDepartments';
import { useComplaintTypes, useCouriers, usePriorities, useUnitsOfMeasurement, useComplaintStatuses } from '@/lib/useLookups';
import StatCard from '@/components/dashboard/StatCard';
import PageHeader from '@/components/layout/PageHeader';
import PageContent from '@/components/layout/PageContent';
import Integrations from '@/pages/Integrations';
import LookupEditDialog from '@/components/settings/LookupEditDialog';
import TeamEditDialog from '@/components/settings/TeamEditDialog';
import SettingsConfigCard from '@/components/settings/SettingsConfigCard';
import SettingsLookupCard from '@/components/settings/SettingsLookupCard';
import SettingsSectionIntro from '@/components/settings/SettingsSectionIntro';
import SettingsNav from '@/components/settings/SettingsNav';
import AppearancePicker from '@/components/settings/AppearancePicker';
import NotificationTriggersList from '@/components/settings/NotificationTriggersList';
import OrderSourcesDialog from '@/components/settings/OrderSourcesDialog';
import {
  AUTO_CLOSE_DEFAULT,
  formatAutoCloseDelay,
  LOOKUP_SECTIONS,
  ROUTING_DEFAULT,
  SETTINGS_NAV,
  SETTINGS_TABS,
  SLA_DEFAULT,
  PRE_RESOLVED_DEFAULT,
  ORDER_SOURCES_DEFAULT,
  DUPLICATE_CHECK_DEFAULT,
} from '@/components/settings/constants';
import { useTeams } from '@/lib/useTeams';
import { getPausedStatusNames, getResolvedStatusNames, normalizeSlaSettings, toggleStatusId } from '@/lib/slaSettings';
import {
  getPreResolvedStatusName,
  normalizeOrderSources,
  normalizePreResolvedSettings,
} from '@/lib/preResolvedSettings';
import {
  duplicateCheckFieldsLabel,
  duplicateCheckMatchLogicLabel,
  duplicateCheckModeLabel,
  DUPLICATE_CHECK_CONFIG_KEY,
  DUPLICATE_CHECK_FIELDS,
  DUPLICATE_CHECK_MATCH_LOGICS,
  DUPLICATE_CHECK_MODES,
  normalizeDuplicateCheckSettings,
} from '@/lib/duplicateCheckSettings';
import {
  getAutoCloseTargetStatusName,
  getAutoCloseTriggerStatusName,
  normalizeAutoCloseSettings,
} from '@/lib/autoCloseSettings';
import { DEFAULT_STATUS_COLOR, defaultColorForIndex } from '@/lib/statusColors';
import {
  DATE_FORMAT_PRESETS,
  DATETIME_FORMAT_PRESETS,
  DISPLAY_FORMAT_CONFIG_KEY,
  DISPLAY_FORMAT_DEFAULT,
  LOCALE_PRESETS,
  PHONE_COUNTRY_CODE_PRESETS,
  createDisplayFormatters,
  normalizeDisplayFormat,
} from '@/lib/displayFormat';

export default function Settings() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasPermission, isTeamLead } = usePermissions();
  const canManage = hasPermission('settings.manage');
  const canManageLookups = canManage || isTeamLead;
  const canManageTeams = canManage || hasPermission('teams.manage') || isTeamLead;
  const canCreateTeams = canManage || hasPermission('teams.manage');
  const tabFromUrl = searchParams.get('tab');
  const activeTab = SETTINGS_TABS.has(tabFromUrl) ? tabFromUrl : 'general';
  const setActiveTab = (tab) => {
    setSearchParams(tab === 'general' ? {} : { tab }, { replace: true });
  };
  const [saving, setSaving] = useState(false);
  const [slaOpen, setSlaOpen] = useState(false);
  const [slaForm, setSlaForm] = useState(SLA_DEFAULT);
  const [ssoOpen, setSsoOpen] = useState(false);
  const [ssoForm, setSsoForm] = useState({ api_key: '', issuer_url: '', enabled: false });
  const [autoCloseOpen, setAutoCloseOpen] = useState(false);
  const [autoCloseForm, setAutoCloseForm] = useState(AUTO_CLOSE_DEFAULT);
  const [routingOpen, setRoutingOpen] = useState(false);
  const [routingForm, setRoutingForm] = useState(ROUTING_DEFAULT);
  const [preResolvedOpen, setPreResolvedOpen] = useState(false);
  const [preResolvedForm, setPreResolvedForm] = useState(PRE_RESOLVED_DEFAULT);
  const [duplicateCheckOpen, setDuplicateCheckOpen] = useState(false);
  const [duplicateCheckForm, setDuplicateCheckForm] = useState(DUPLICATE_CHECK_DEFAULT);
  const [orderSourcesOpen, setOrderSourcesOpen] = useState(false);
  const [orderSourcesForm, setOrderSourcesForm] = useState(ORDER_SOURCES_DEFAULT);
  const [displayFormatForm, setDisplayFormatForm] = useState(DISPLAY_FORMAT_DEFAULT);
  const [displayFormatDirty, setDisplayFormatDirty] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lookupOpen, setLookupOpen] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupMeta, setLookupMeta] = useState(null);
  const [lookupItems, setLookupItems] = useState([]);
  const [teamsOpen, setTeamsOpen] = useState(false);
  const [teamsSaving, setTeamsSaving] = useState(false);

  const { data: departments = [], refetch: refetchDepartments } = useDepartments();
  const { data: teams = [], refetch: refetchTeams, isFetching: teamsLoading } = useTeams();
  const { data: complaintTypes = [], refetch: refetchComplaintTypes } = useComplaintTypes();
  const { data: complaintStatuses = [], refetch: refetchComplaintStatuses } = useComplaintStatuses();
  const { data: couriers = [], refetch: refetchCouriers } = useCouriers();
  const { data: unitsOfMeasurement = [], refetch: refetchUnitsOfMeasurement } = useUnitsOfMeasurement();
  const { data: priorities = [], refetch: refetchPriorities } = usePriorities();

  const { data: allUsers = [] } = useQuery({
    queryKey: ['users', 'settings-teams'],
    queryFn: () => db.entities.User.list(),
    enabled: canManageTeams,
    staleTime: 60_000,
  });

  const lookupData = useMemo(() => ({
    departments,
    teams,
    complaint_types: complaintTypes,
    complaint_statuses: complaintStatuses,
    couriers,
    units_of_measurement: unitsOfMeasurement,
    priorities,
  }), [departments, teams, complaintTypes, complaintStatuses, couriers, unitsOfMeasurement, priorities]);

  const lookupRefetchers = {
    departments: refetchDepartments,
    teams: refetchTeams,
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
  const getPreResolved = () => normalizePreResolvedSettings(
    configs.find((c) => c.key === 'pre_resolved_complaints')?.json_value,
  );
  const getDuplicateCheck = () => normalizeDuplicateCheckSettings(
    configs.find((c) => c.key === DUPLICATE_CHECK_CONFIG_KEY)?.json_value,
  );
  const getOrderSources = () => normalizeOrderSources(
    configs.find((c) => c.key === 'order_sources')?.json_value,
  );
  const getDisplayFormat = () => normalizeDisplayFormat(
    configs.find((c) => c.key === DISPLAY_FORMAT_CONFIG_KEY)?.json_value,
  );
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
  const preResolved = getPreResolved();
  const preResolvedStatusName = getPreResolvedStatusName(preResolved, complaintStatuses);
  const duplicateCheck = getDuplicateCheck();
  const orderSources = getOrderSources();
  const sso = getSso();
  const routingRuleCount = routing.rules.filter((rule) => rule.department_id || rule.status_id).length;
  const automationActive = [routing.enabled, autoClose.enabled, preResolved.enabled, duplicateCheck.enabled].filter(Boolean).length;

  useEffect(() => {
    if (!displayFormatDirty) {
      setDisplayFormatForm(getDisplayFormat());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- sync from configs when saved / loaded
  }, [configs, displayFormatDirty]);

  const displayFormatPreview = useMemo(
    () => createDisplayFormatters(displayFormatForm),
    [displayFormatForm],
  );
  const previewNow = useMemo(() => new Date('2026-07-12T13:05:00'), []);

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

  const updateDisplayFormatForm = (patch) => {
    setDisplayFormatForm((prev) => normalizeDisplayFormat({ ...prev, ...patch }));
    setDisplayFormatDirty(true);
  };

  const saveDisplayFormat = async () => {
    setSaving(true);
    try {
      await saveConfig(
        DISPLAY_FORMAT_CONFIG_KEY,
        'Display Format',
        normalizeDisplayFormat(displayFormatForm),
      );
      setDisplayFormatDirty(false);
      toast.success('Display format saved');
    } finally {
      setSaving(false);
    }
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

  const openPreResolved = () => {
    setPreResolvedForm(getPreResolved());
    setPreResolvedOpen(true);
  };

  const savePreResolved = async () => {
    if (preResolvedForm.enabled && !preResolvedForm.status_id) {
      toast.error('Select a target status for pre-resolved complaints.');
      return;
    }

    setSaving(true);
    try {
      await saveConfig('pre_resolved_complaints', 'Pre-Resolved Complaints', {
        enabled: !!preResolvedForm.enabled,
        status_id: preResolvedForm.status_id ? Number(preResolvedForm.status_id) : null,
        require_closure_proof: !!preResolvedForm.require_closure_proof,
        require_resolution_notes: !!preResolvedForm.require_resolution_notes,
      });
      toast.success('Pre-resolved complaint settings saved');
      setPreResolvedOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['complaint_create_form_options'] });
    } finally {
      setSaving(false);
    }
  };

  const openDuplicateCheck = () => {
    setDuplicateCheckForm(getDuplicateCheck());
    setDuplicateCheckOpen(true);
  };

  const toggleDuplicateCheckField = (fieldKey, checked) => {
    setDuplicateCheckForm((prev) => {
      const nextFields = checked
        ? [...new Set([...prev.fields, fieldKey])]
        : prev.fields.filter((field) => field !== fieldKey);
      return {
        ...prev,
        fields: nextFields.length ? nextFields : prev.fields,
      };
    });
  };

  const saveDuplicateCheck = async () => {
    const normalized = normalizeDuplicateCheckSettings(duplicateCheckForm);
    if (normalized.enabled && !normalized.fields.length) {
      toast.error('Select at least one field to check for duplicates.');
      return;
    }

    setSaving(true);
    try {
      await saveConfig(DUPLICATE_CHECK_CONFIG_KEY, 'Duplicate Complaints', normalized);
      toast.success('Duplicate complaint settings saved');
      setDuplicateCheckOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['complaint_create_form_options'] });
    } finally {
      setSaving(false);
    }
  };

  const openOrderSources = () => {
    setOrderSourcesForm(getOrderSources());
    setOrderSourcesOpen(true);
  };

  const saveOrderSources = async () => {
    setSaving(true);
    try {
      await saveConfig('order_sources', 'Order Sources', normalizeOrderSources(orderSourcesForm));
      toast.success('Order sources saved');
      setOrderSourcesOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['complaint_create_form_options'] });
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
    if (section.key === 'teams') {
      setTeamsOpen(true);
      refetchTeams();
      return;
    }

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
      toastApiError(err, `Failed to load ${section.label}`);
      setLookupOpen(false);
    } finally {
      setLookupLoading(false);
    }
  };

  const saveTeam = async (payload) => {
    setTeamsSaving(true);
    try {
      if (payload.id) {
        const body = { ...payload };
        if (!canCreateTeams) {
          delete body.department_id;
        }
        delete body.id;
        await db.entities.Team.update(payload.id, body);
      } else {
        await db.entities.Team.create(payload);
      }
      await refetchTeams();
      await queryClient.invalidateQueries({ queryKey: ['teams'] });
      toast.success('Team saved');
    } catch (err) {
      toastApiError(err, 'Failed to save team');
      throw err;
    } finally {
      setTeamsSaving(false);
    }
  };

  const deactivateTeam = async (team) => {
    if (!canCreateTeams) return;
    setTeamsSaving(true);
    try {
      await db.entities.Team.delete(team.id);
      await refetchTeams();
      await queryClient.invalidateQueries({ queryKey: ['teams'] });
      toast.success('Team deactivated');
    } catch (err) {
      toastApiError(err, 'Failed to deactivate team');
    } finally {
      setTeamsSaving(false);
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
      toastApiError(err, `Failed to save ${lookupMeta.label}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Settings2}
        title="Settings"
        description="Workspace appearance, lookup data, automation, and integrations"
        actions={!canManage && !canManageLookups ? (
          <Badge variant="outline" className="w-fit gap-1.5 py-1">
            <Lock className="w-3 h-3" />
            View only
          </Badge>
        ) : null}
      />

      <PageContent>
      {!canManage && (
        <Alert className="rounded-2xl border-amber-200/80 bg-amber-50/80 dark:border-amber-800/40 dark:bg-amber-900/20">
          <Lock className="h-4 w-4" />
          <AlertTitle>{canManageLookups ? 'Limited settings access' : 'Read-only access'}</AlertTitle>
          <AlertDescription>
            {canManageLookups
              ? 'As a team lead you can manage lookup data and your teams. Other sections remain read-only unless you have settings.manage.'
              : (
                <>
                  You can review settings but need the <code className="text-xs bg-muted px-1 rounded">settings.manage</code> permission to edit them.
                </>
              )}
          </AlertDescription>
        </Alert>
      )}

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex flex-col gap-6 lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start lg:gap-8"
      >
        <SettingsNav
          tabs={SETTINGS_NAV}
          badges={{
            lookups: lookupTotal,
            automation: automationActive,
            integrations: sso.enabled ? 'On' : undefined,
          }}
        />

        <div className="min-w-0 space-y-6">
        <TabsContent value="general" className="space-y-6 mt-0">
          <SettingsSectionIntro
            title="General"
            description="Appearance is local to this device. Display formats apply across the workspace."
            icon={SETTINGS_NAV.find((tab) => tab.value === 'general')?.icon}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard label="Lookup items" value={lookupTotal} icon={Database} index={0} onClick={() => setActiveTab('lookups')} />
            <StatCard label="Automation active" value={automationActive} icon={GitBranch} color="blue" index={1} onClick={() => setActiveTab('automation')} />
            <StatCard label="Routing rules" value={routingRuleCount} icon={Shield} color="purple" index={2} onClick={() => setActiveTab('automation')} />
            <StatCard label="SSO" value={sso.enabled ? 'On' : 'Off'} icon={Link2} color={sso.enabled ? 'success' : 'primary'} index={3} format="none" onClick={() => setActiveTab('integrations')} />
          </div>

          <Card className="rounded-2xl border border-border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Appearance</CardTitle>
              <p className="text-sm text-muted-foreground">Choose how Care looks on this device. Theme is not shared with other users.</p>
            </CardHeader>
            <CardContent>
              <AppearancePicker />
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-muted-foreground" />
                    Display &amp; format
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Workspace-wide number, money, date, and phone formats used across Care.
                  </p>
                </div>
                {canManage && (
                  <Button
                    size="sm"
                    onClick={saveDisplayFormat}
                    disabled={saving || !displayFormatDirty}
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    {displayFormatDirty ? 'Save' : 'Saved'}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_260px] gap-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Number style (locale)</Label>
                  <Select
                    value={displayFormatForm.locale}
                    onValueChange={(value) => {
                      const preset = LOCALE_PRESETS.find((item) => item.value === value);
                      updateDisplayFormatForm({
                        locale: value,
                        ...(preset?.currency ? { currency_code: preset.currency } : {}),
                        ...(preset?.phone ? { phone_country_code: preset.phone } : {}),
                      });
                    }}
                    disabled={!canManage}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LOCALE_PRESETS.map((preset) => (
                        <SelectItem key={preset.value} value={preset.value}>
                          {preset.label} · {preset.sample}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Currency</Label>
                  <Select
                    value={displayFormatForm.currency_code}
                    onValueChange={(value) => updateDisplayFormatForm({ currency_code: value })}
                    disabled={!canManage}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {['MYR', 'USD', 'SGD', 'IDR', 'GBP', 'EUR'].map((code) => (
                        <SelectItem key={code} value={code}>{code}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Money decimals</Label>
                  <Select
                    value={String(displayFormatForm.currency_decimals)}
                    onValueChange={(value) => updateDisplayFormatForm({ currency_decimals: Number(value) })}
                    disabled={!canManage}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[0, 1, 2, 3, 4].map((n) => (
                        <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Date format</Label>
                  <Select
                    value={displayFormatForm.date_format}
                    onValueChange={(value) => updateDisplayFormatForm({ date_format: value })}
                    disabled={!canManage}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DATE_FORMAT_PRESETS.map((preset) => (
                        <SelectItem key={preset.value} value={preset.value}>
                          {preset.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs text-muted-foreground">Date &amp; time format</Label>
                  <Select
                    value={displayFormatForm.datetime_format}
                    onValueChange={(value) => updateDisplayFormatForm({ datetime_format: value })}
                    disabled={!canManage}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DATETIME_FORMAT_PRESETS.map((preset) => (
                        <SelectItem key={preset.value} value={preset.value}>
                          {preset.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs text-muted-foreground">Phone country code</Label>
                  <Select
                    value={displayFormatForm.phone_country_code}
                    onValueChange={(value) => updateDisplayFormatForm({ phone_country_code: value })}
                    disabled={!canManage}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PHONE_COUNTRY_CODE_PRESETS.map((preset) => (
                        <SelectItem key={preset.value} value={preset.value}>
                          {preset.label} · {preset.sample}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Marketplace numbers are stored as international format, e.g. +60139989571.
                  </p>
                </div>
                </div>

                <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3 h-fit xl:sticky xl:top-20">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Live preview</p>
                  {[
                    { label: 'Number', value: displayFormatPreview.formatNumber(12139) },
                    { label: 'Money', value: displayFormatPreview.formatMoney(1000) },
                    { label: 'Date', value: displayFormatPreview.formatDate(previewNow) },
                    { label: 'Date & time', value: displayFormatPreview.formatDateTime(previewNow) },
                    { label: 'Phone', value: displayFormatPreview.formatPhone('0139989571') },
                  ].map((row) => (
                    <div key={row.label} className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-2 last:border-0 last:pb-0">
                      <p className="text-xs text-muted-foreground">{row.label}</p>
                      <p className="text-sm font-medium tabular-nums text-right">{row.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lookups" className="space-y-6 mt-0">
          <SettingsSectionIntro
            title="Lookups"
            description="Dropdown values used across tickets, filters, and reports. Click a card to edit."
            icon={SETTINGS_NAV.find((tab) => tab.value === 'lookups')?.icon}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {LOOKUP_SECTIONS.map((section) => (
              <SettingsLookupCard
                key={section.key}
                section={section}
                items={lookupData[section.key] || []}
                canManage={section.key === 'teams' ? canManageTeams : canManageLookups}
                onEdit={openLookup}
              />
            ))}
            <SettingsConfigCard
              title="Order Sources"
              description="Platforms shown when creating a complaint"
              icon={ShoppingBag}
              canManage={canManage}
              onEdit={openOrderSources}
              rows={[
                { label: 'Configured sources', value: orderSources.sources.length ? `${orderSources.sources.length} options` : 'None' },
                {
                  label: 'Preview',
                  value: orderSources.sources.length
                    ? orderSources.sources.slice(0, 3).join(', ') + (orderSources.sources.length > 3 ? '…' : '')
                    : '—',
                },
              ]}
            />
          </div>
        </TabsContent>

        <TabsContent value="automation" className="space-y-6 mt-0">
          <SettingsSectionIntro
            title="Automation"
            description="Routing rules, SLA targets, and automatic ticket workflows."
            icon={SETTINGS_NAV.find((tab) => tab.value === 'automation')?.icon}
          />
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

            <SettingsConfigCard
              title="Pre-Resolved at Vendor"
              description="Log marketplace complaints already settled with the vendor"
              icon={ClipboardCheck}
              enabled={preResolved.enabled}
              canManage={canManage}
              onEdit={openPreResolved}
              rows={[
                {
                  label: 'Create as status',
                  value: preResolved.enabled
                    ? (preResolvedStatusName ?? 'Not configured')
                    : '—',
                },
                {
                  label: 'Require closure proof',
                  value: preResolved.enabled ? (preResolved.require_closure_proof ? 'Yes' : 'No') : '—',
                },
                {
                  label: 'Require resolution notes',
                  value: preResolved.enabled ? (preResolved.require_resolution_notes ? 'Yes' : 'No') : '—',
                },
              ]}
            />

            <SettingsConfigCard
              title="Duplicate Complaints"
              description="Warn or block when creating or editing tickets that match existing ones"
              icon={Copy}
              enabled={duplicateCheck.enabled}
              canManage={canManage}
              onEdit={openDuplicateCheck}
              rows={[
                {
                  label: 'Match on',
                  value: duplicateCheck.enabled
                    ? duplicateCheckFieldsLabel(duplicateCheck.fields)
                    : '—',
                },
                {
                  label: 'Logic',
                  value: duplicateCheck.enabled
                    ? duplicateCheckMatchLogicLabel(duplicateCheck.match_logic)
                    : '—',
                },
                {
                  label: 'When found',
                  value: duplicateCheck.enabled
                    ? duplicateCheckModeLabel(duplicateCheck.mode)
                    : '—',
                },
              ]}
            />
          </div>
        </TabsContent>

        <TabsContent value="integrations" className="space-y-6 mt-0">
          <SettingsSectionIntro
            title="Integrations"
            description="Authentication and connections to external systems."
            icon={SETTINGS_NAV.find((tab) => tab.value === 'integrations')?.icon}
          />
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
          <div className="space-y-3">
            <div>
              <h3 className="text-base font-semibold tracking-tight">Webhooks</h3>
              <p className="text-sm text-muted-foreground">
                Connect fulfillment systems and external apps using incoming and outgoing webhooks.
              </p>
            </div>
            <Integrations embedded />
          </div>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6 mt-0">
          <SettingsSectionIntro
            title="Notification triggers"
            description="System events that generate in-app notifications for agents."
            icon={SETTINGS_NAV.find((tab) => tab.value === 'notifications')?.icon}
          />
          <NotificationTriggersList />
        </TabsContent>
        </div>
      </Tabs>
      </PageContent>

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

      <TeamEditDialog
        open={teamsOpen}
        onOpenChange={setTeamsOpen}
        teams={teams}
        departments={departments}
        users={allUsers}
        loading={teamsLoading && !teams.length}
        saving={teamsSaving}
        canCreate={canCreateTeams}
        onSave={saveTeam}
        onDeactivate={deactivateTeam}
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

      <Dialog open={preResolvedOpen} onOpenChange={setPreResolvedOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ClipboardCheck className="w-4 h-4" />Pre-Resolved at Vendor</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="rounded-lg bg-muted/50 border p-3 text-xs text-muted-foreground">
              When enabled, agents can log complaints already settled with a marketplace vendor. Tickets are created in your chosen status for later review before closing.
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="pre-resolved-enabled" className="text-sm">Enable pre-resolved complaints</Label>
              <Switch
                id="pre-resolved-enabled"
                checked={!!preResolvedForm.enabled}
                onCheckedChange={(checked) => setPreResolvedForm((p) => ({ ...p, enabled: checked }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Create as status</Label>
              <Select
                value={preResolvedForm.status_id || '__none__'}
                onValueChange={(value) => setPreResolvedForm((p) => ({ ...p, status_id: value === '__none__' ? '' : value }))}
                disabled={!preResolvedForm.enabled}
              >
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select status" /></SelectTrigger>
                <SelectContent>
                  {complaintStatuses.map((status) => (
                    <SelectItem key={status.id} value={String(status.id)}>{status.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={!!preResolvedForm.require_closure_proof}
                disabled={!preResolvedForm.enabled}
                onCheckedChange={(checked) => setPreResolvedForm((p) => ({ ...p, require_closure_proof: !!checked }))}
              />
              Require closure proof on create (image or notes)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={!!preResolvedForm.require_resolution_notes}
                disabled={!preResolvedForm.enabled}
                onCheckedChange={(checked) => setPreResolvedForm((p) => ({ ...p, require_resolution_notes: !!checked }))}
              />
              Require resolution notes on create
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreResolvedOpen(false)}>Cancel</Button>
            <Button onClick={savePreResolved} disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={duplicateCheckOpen} onOpenChange={setDuplicateCheckOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Copy className="w-4 h-4" />Duplicate Complaints</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="rounded-lg bg-muted/50 border p-3 text-xs text-muted-foreground">
              When enabled, create and edit forms check for existing tickets using the selected fields and match logic.
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="duplicate-check-enabled" className="text-sm">Enable duplicate checking</Label>
              <Switch
                id="duplicate-check-enabled"
                checked={!!duplicateCheckForm.enabled}
                onCheckedChange={(checked) => setDuplicateCheckForm((p) => ({ ...p, enabled: checked }))}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Match on</Label>
              {DUPLICATE_CHECK_FIELDS.map((field) => (
                <label key={field.key} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={duplicateCheckForm.fields.includes(field.key)}
                    disabled={!duplicateCheckForm.enabled || (duplicateCheckForm.fields.length === 1 && duplicateCheckForm.fields.includes(field.key))}
                    onCheckedChange={(checked) => toggleDuplicateCheckField(field.key, !!checked)}
                  />
                  {field.label}
                </label>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Match logic</Label>
              <Select
                value={duplicateCheckForm.match_logic || 'or'}
                onValueChange={(value) => setDuplicateCheckForm((p) => ({ ...p, match_logic: value }))}
                disabled={!duplicateCheckForm.enabled}
              >
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DUPLICATE_CHECK_MATCH_LOGICS.map((logic) => (
                    <SelectItem key={logic.value} value={logic.value}>{logic.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                {duplicateCheckForm.match_logic === 'and'
                  ? 'All selected fields must match the same existing ticket. Every selected field must also be filled in.'
                  : 'A ticket is flagged if any one of the selected fields matches.'}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">When a match is found</Label>
              <Select
                value={duplicateCheckForm.mode}
                onValueChange={(value) => setDuplicateCheckForm((p) => ({ ...p, mode: value }))}
                disabled={!duplicateCheckForm.enabled}
              >
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DUPLICATE_CHECK_MODES.map((mode) => (
                    <SelectItem key={mode.value} value={mode.value}>{mode.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDuplicateCheckOpen(false)}>Cancel</Button>
            <Button onClick={saveDuplicateCheck} disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <OrderSourcesDialog
        open={orderSourcesOpen}
        onOpenChange={setOrderSourcesOpen}
        sources={orderSourcesForm.sources}
        onSourcesChange={(sources) => setOrderSourcesForm({ sources })}
        saving={saving}
        onSave={saveOrderSources}
      />

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
