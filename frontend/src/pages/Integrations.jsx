import { db } from '@/api/db';

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Copy, CheckCircle, Webhook, Code2, Clock, RefreshCw, Search, Eye, EyeOff,
  Send, Loader2, Plus, Trash2, ArrowDownToLine, ArrowUpFromLine, Activity,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { usePermissions } from '@/lib/usePermissions';
import { Switch } from '@/components/ui/switch';
import StatCard from '@/components/dashboard/StatCard';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

function buildWebhookBase(apiBase = API_BASE) {
  const normalized = apiBase.replace(/\/$/, '');
  if (normalized.startsWith('http')) {
    return `${normalized}/webhook`;
  }
  return `${window.location.origin}${normalized}/webhook`;
}

function buildIncomingExample(endpointUrl) {
  return `POST ${endpointUrl}
Content-Type: application/json
X-Webhook-Secret: YOUR_WEBHOOK_SECRET

{
  "order_number": "ORD-2024-001",
  "tracking_number": "JNE123456789",
  "status": "Shipped"
}

// You can also identify the ticket by ticket_id instead of order_number.

// Response:
{
  "message": "Tracking updated successfully.",
  "complaint": { ... }
}`;
}

function buildCurlExample(endpointUrl) {
  return `curl -X POST "${endpointUrl}" \\
  -H "Content-Type: application/json" \\
  -H "X-Webhook-Secret: YOUR_WEBHOOK_SECRET" \\
  -d '{
    "order_number": "ORD-2024-001",
    "tracking_number": "JNE123456789",
    "status": "Shipped"
  }'`;
}

function buildPythonExample(endpointUrl) {
  return `import requests

def update_ticket_status(order_number, tracking_number, status, webhook_secret):
    response = requests.post(
        "${endpointUrl}",
        headers={
            "Content-Type": "application/json",
            "X-Webhook-Secret": webhook_secret
        },
        json={
            "order_number": order_number,
            "tracking_number": tracking_number,
            "status": status,
        }
    )
    return response.json()

# Example usage
update_ticket_status("ORD-2024-001", "JNE123456789", "Shipped", "your-webhook-secret")`;
}

const EVENT_LABELS = {
  'complaint.created': 'Ticket created',
  'complaint.updated': 'Ticket updated',
  'complaint.status_changed': 'Status changed',
  'complaint.tracking_updated': 'Tracking updated',
  'notification.created': 'Notification sent',
};

const OUTGOING_EXAMPLE = `// Complaint event example
POST https://your-system.example.com/webhooks/care
Content-Type: application/json
X-Webhook-Secret: YOUR_OUTGOING_SECRET

{
  "event": "complaint.status_changed",
  "timestamp": "2026-06-13T10:30:00+00:00",
  "complaint": {
    "ticket_id": "RH-250608-1234",
    "order_number": "ORD-2024-001",
    "status": "Approved Replacement"
  }
}

// Notification event example
{
  "event": "notification.created",
  "timestamp": "2026-06-13T10:30:00+00:00",
  "notification": {
    "title": "Ticket assigned to you",
    "message": "Admin assigned ticket RH-250608-1234 to you.",
    "type": "info",
    "category": "task",
    "action_url": "https://care.example.com/complaints/42",
    "event_type": "ticket_assigned",
    "recipient_email": "agent@example.com"
  },
  "complaint": { ... }
}

// Leave events empty on a webhook to receive all event types.`;

const EMPTY_OUTGOING_WEBHOOK = {
  id: '',
  name: '',
  enabled: true,
  url: '',
  secret: '',
  events: ['notification.created'],
};

const STATUSES = [
  'Under Review', 'Approved Replacement', 'Waiting for Vendor', 'Reprocessing by Fulfillment',
  'Ready to Ship', 'Shipped', 'Delivered', 'Closed', 'Drop',
];

function createOutgoingWebhook() {
  return {
    ...EMPTY_OUTGOING_WEBHOOK,
    name: 'Notification Webhook',
    enabled: true,
  };
}

export default function Integrations() {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('oms.manage');
  const [copied, setCopied] = useState(null);
  const [showIncomingSecret, setShowIncomingSecret] = useState(false);
  const [visibleSecrets, setVisibleSecrets] = useState({});
  const [searchOrder, setSearchOrder] = useState('');
  const [manualUpdateOpen, setManualUpdateOpen] = useState(false);
  const [manualForm, setManualForm] = useState({ order_number: '', tracking_number: '', status: '', notes: '' });
  const [updating, setUpdating] = useState(false);
  const [savingOutgoing, setSavingOutgoing] = useState(false);
  const [testingOutgoingId, setTestingOutgoingId] = useState(null);
  const [regeneratingIncoming, setRegeneratingIncoming] = useState(false);
  const [regeneratingOutgoingId, setRegeneratingOutgoingId] = useState(null);
  const [codeTab, setCodeTab] = useState('curl');
  const [outgoingWebhooks, setOutgoingWebhooks] = useState([]);
  const [activeTab, setActiveTab] = useState('incoming');

  const { data: webhookSettings, isLoading: loadingWebhook, refetch: refetchWebhook } = useQuery({
    queryKey: ['webhook-settings'],
    queryFn: () => db.integrations.Webhook.getSettings(),
  });

  React.useEffect(() => {
    if (webhookSettings?.outgoing_webhooks) {
      setOutgoingWebhooks(webhookSettings.outgoing_webhooks.map(webhook => ({
        id: webhook.id ?? '',
        name: webhook.name ?? 'Webhook',
        enabled: webhook.enabled ?? false,
        url: webhook.url ?? '',
        secret: webhook.secret ?? '',
        events: webhook.events ?? [],
      })));
    }
  }, [webhookSettings]);

  const availableEvents = webhookSettings?.available_events ?? Object.keys(EVENT_LABELS);

  const incomingEndpoint = webhookSettings?.incoming?.endpoint_url ?? `${buildWebhookBase()}/tracking-update`;
  const incomingExample = buildIncomingExample(incomingEndpoint);
  const curlExample = buildCurlExample(incomingEndpoint);
  const pythonExample = buildPythonExample(incomingEndpoint);
  const incomingSecret = webhookSettings?.incoming?.secret ?? '';

  const { data: recentActivity = [], isLoading: loadingActivity, refetch } = useQuery({
    queryKey: ['webhook-activity'],
    queryFn: () => db.entities.TicketActivity.list('-created_date', 50),
  });

  const webhookActivity = recentActivity.filter(a =>
    a.description?.includes('[Fulfillment System]') &&
    (!searchOrder || a.description?.toLowerCase().includes(searchOrder.toLowerCase()))
  );

  const enabledOutgoingCount = outgoingWebhooks.filter(w => w.enabled).length;

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
    toast.success('Copied!');
  };

  const regenerateIncomingSecret = async () => {
    setRegeneratingIncoming(true);
    try {
      await db.integrations.Webhook.regenerateIncomingSecret();
      await refetchWebhook();
      toast.success('Incoming webhook secret regenerated');
    } catch (error) {
      toast.error(error.message || 'Failed to regenerate secret');
    } finally {
      setRegeneratingIncoming(false);
    }
  };

  const saveOutgoingSettings = async () => {
    setSavingOutgoing(true);
    try {
      await db.integrations.Webhook.updateSettings({ outgoing_webhooks: outgoingWebhooks });
      await refetchWebhook();
      toast.success('Outgoing webhooks saved');
    } catch (error) {
      toast.error(error.message || 'Failed to save outgoing webhooks');
    } finally {
      setSavingOutgoing(false);
    }
  };

  const addOutgoingWebhook = () => {
    setOutgoingWebhooks(prev => [...prev, createOutgoingWebhook()]);
  };

  const removeOutgoingWebhook = (id, index) => {
    setOutgoingWebhooks(prev => (
      id ? prev.filter(webhook => webhook.id !== id) : prev.filter((_, i) => i !== index)
    ));
  };

  const updateOutgoingWebhook = (id, index, updates) => {
    setOutgoingWebhooks(prev => prev.map((webhook, i) => (
      (id ? webhook.id === id : i === index) ? { ...webhook, ...updates } : webhook
    )));
  };

  const toggleOutgoingEvent = (id, index, event) => {
    setOutgoingWebhooks(prev => prev.map((webhook, i) => {
      if (id ? webhook.id !== id : i !== index) return webhook;
      const events = webhook.events ?? [];
      const nextEvents = events.includes(event)
        ? events.filter(item => item !== event)
        : [...events, event];
      return { ...webhook, events: nextEvents };
    }));
  };

  const regenerateOutgoingSecret = async (id) => {
    setRegeneratingOutgoingId(id);
    try {
      const result = await db.integrations.Webhook.regenerateOutgoingSecret(id);
      updateOutgoingWebhook(id, null, { secret: result.webhook?.secret ?? '' });
      await refetchWebhook();
      toast.success('Outgoing webhook secret regenerated');
    } catch (error) {
      toast.error(error.message || 'Failed to regenerate secret');
    } finally {
      setRegeneratingOutgoingId(null);
    }
  };

  const testOutgoingWebhook = async (webhook, index) => {
    const testKey = webhook.id || `new-${index}`;
    setTestingOutgoingId(testKey);
    try {
      const result = await db.integrations.Webhook.testOutgoing({
        id: webhook.id || undefined,
        name: webhook.name,
        url: webhook.url,
        secret: webhook.secret,
        events: webhook.events ?? [],
      });
      const failed = (result.results ?? []).filter(item => !item.success);
      if (failed.length > 0) {
        toast.error(result.message || 'Outgoing webhook test failed');
      } else {
        toast.success(result.message || 'Test webhook delivered successfully');
      }
    } catch (error) {
      toast.error(error.message || 'Outgoing webhook test failed');
    } finally {
      setTestingOutgoingId(null);
    }
  };

  const toggleSecretVisibility = (id) => {
    setVisibleSecrets(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleManualUpdate = async () => {
    if (!manualForm.order_number || !manualForm.status) {
      toast.error('Order number and status are required');
      return;
    }
    setUpdating(true);

    const freshComplaints = await db.entities.Complaint.list('-created_date', 500);
    const matched = freshComplaints.filter(c => c.order_number === manualForm.order_number);
    if (matched.length === 0) {
      toast.error(`No complaints found for order ${manualForm.order_number}`);
      setUpdating(false);
      return;
    }

    for (const complaint of matched) {
      const updates = { status: manualForm.status };
      if (manualForm.tracking_number) updates.tracking_number = manualForm.tracking_number;

      await db.entities.Complaint.update(complaint.id, updates);
      await db.entities.TicketActivity.create({
        complaint_id: complaint.id,
        action_type: 'status_changed',
        description: `[Fulfillment System] Status updated to "${manualForm.status}"${manualForm.notes ? ` — ${manualForm.notes}` : ''}`,
        old_value: complaint.status,
        new_value: manualForm.status,
      });
    }

    queryClient.invalidateQueries({ queryKey: ['complaints'] });
    queryClient.invalidateQueries({ queryKey: ['webhook-activity'] });
    toast.success(`Updated ${matched.length} ticket(s) for order ${manualForm.order_number}`);
    setUpdating(false);
    setManualUpdateOpen(false);
    setManualForm({ order_number: '', tracking_number: '', status: '', notes: '' });
    refetch();
  };

  const codeExamples = {
    curl: curlExample,
    json: incomingExample,
    python: pythonExample,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Integrations</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Connect fulfillment systems and external apps using incoming and outgoing webhooks
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Incoming"
          value={loadingWebhook ? '…' : (incomingSecret ? 'Configured' : 'Not set')}
          icon={ArrowDownToLine}
          color="blue"
        />
        <StatCard
          label="Outgoing"
          value={loadingWebhook ? '…' : `${enabledOutgoingCount} active`}
          icon={ArrowUpFromLine}
          color="purple"
        />
        <StatCard
          label="Recent activity"
          value={loadingActivity ? '…' : webhookActivity.length}
          icon={Activity}
          color="success"
        />
      </div>

      <Card className="border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800">
        <CardContent className="pt-4 pb-4">
          <div className="flex gap-3 text-sm text-blue-700 dark:text-blue-300">
            <Webhook className="w-5 h-5 shrink-0 mt-0.5 text-blue-600" />
            <div>
              <p className="font-medium mb-1">How it works</p>
              <ol className="text-xs space-y-1 list-decimal ml-4">
                <li><strong>Incoming:</strong> Your fulfillment system POSTs tracking/status updates to Care using <code className="bg-blue-100 dark:bg-blue-950 px-1 rounded">X-Webhook-Secret</code></li>
                <li><strong>Outgoing:</strong> Care POSTs ticket and notification events to each configured URL with <code className="bg-blue-100 dark:bg-blue-950 px-1 rounded">X-Webhook-Secret</code></li>
                <li>All updates are logged in the ticket activity timeline</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="incoming" className="gap-1.5">
            <ArrowDownToLine className="w-3.5 h-3.5" />
            Incoming
          </TabsTrigger>
          <TabsTrigger value="outgoing" className="gap-1.5">
            <ArrowUpFromLine className="w-3.5 h-3.5" />
            Outgoing
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="incoming" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Webhook URL</CardTitle>
                <CardDescription className="text-xs">Your fulfillment system sends POST requests here</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={loadingWebhook ? 'Loading...' : incomingEndpoint}
                    className="font-mono text-xs bg-muted"
                  />
                  <Button size="icon" variant="outline" onClick={() => copyToClipboard(incomingEndpoint, 'url')} disabled={loadingWebhook}>
                    {copied === 'url' ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">
                  Method: <code className="bg-muted px-1 rounded">POST</code> — Header: <code className="bg-muted px-1 rounded">X-Webhook-Secret</code>
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Webhook Secret</CardTitle>
                <CardDescription className="text-xs">Include this in the <code>X-Webhook-Secret</code> header of every request</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={loadingWebhook ? 'Loading...' : (canManage ? incomingSecret : '••••••••••••••••')}
                    className="font-mono text-xs bg-muted"
                    type={showIncomingSecret ? 'text' : 'password'}
                  />
                  {canManage && (
                    <>
                      <Button size="icon" variant="outline" onClick={() => setShowIncomingSecret(v => !v)} disabled={loadingWebhook}>
                        {showIncomingSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                      <Button size="icon" variant="outline" onClick={() => copyToClipboard(incomingSecret, 'key')} disabled={loadingWebhook || !incomingSecret}>
                        {copied === 'key' ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                      </Button>
                      <Button size="sm" variant="outline" onClick={regenerateIncomingSecret} disabled={regeneratingIncoming || loadingWebhook}>
                        {regeneratingIncoming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      </Button>
                    </>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">Keep this secret. Regenerate if compromised.</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2"><Code2 className="w-4 h-4" />Integration Examples</CardTitle>
                <Button size="sm" variant="outline" onClick={() => copyToClipboard(codeExamples[codeTab], 'code')}>
                  {copied === 'code' ? <CheckCircle className="w-3 h-3 mr-1 text-emerald-500" /> : <Copy className="w-3 h-3 mr-1" />}
                  Copy
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs value={codeTab} onValueChange={setCodeTab}>
                <TabsList className="mb-3">
                  <TabsTrigger value="curl" className="text-xs">cURL</TabsTrigger>
                  <TabsTrigger value="json" className="text-xs">Request format</TabsTrigger>
                  <TabsTrigger value="python" className="text-xs">Python</TabsTrigger>
                </TabsList>
                <TabsContent value="curl">
                  <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto font-mono whitespace-pre-wrap leading-relaxed">{curlExample}</pre>
                </TabsContent>
                <TabsContent value="json">
                  <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto font-mono whitespace-pre-wrap leading-relaxed">{incomingExample}</pre>
                </TabsContent>
                <TabsContent value="python">
                  <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto font-mono whitespace-pre-wrap leading-relaxed">{pythonExample}</pre>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {canManage && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm">Manual Update (Test / Override)</CardTitle>
                    <CardDescription className="text-xs">Simulate a fulfillment status push without calling the webhook</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => setManualUpdateOpen(true)}>
                    <RefreshCw className="w-3.5 h-3.5 mr-2" />Push Update
                  </Button>
                </div>
              </CardHeader>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="outgoing" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-sm flex items-center gap-2"><Send className="w-4 h-4" />Outgoing Webhooks</CardTitle>
                  <CardDescription className="text-xs">Care notifies external systems when tickets change or in-app notifications are sent</CardDescription>
                </div>
                {canManage && (
                  <Button size="sm" variant="outline" onClick={addOutgoingWebhook} disabled={loadingWebhook}>
                    <Plus className="w-3.5 h-3.5 mr-1" />Add Webhook
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {outgoingWebhooks.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No outgoing webhooks configured yet.
                  {canManage && ' Click "Add Webhook" to notify an external system.'}
                </div>
              ) : (
                outgoingWebhooks.map((webhook, index) => (
                  <div key={webhook.id || index} className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1">
                        <Input
                          value={webhook.name}
                          onChange={e => updateOutgoingWebhook(webhook.id, index, { name: e.target.value })}
                          placeholder="Webhook name"
                          className="h-8 text-sm max-w-xs"
                          disabled={!canManage || loadingWebhook}
                        />
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`outgoing-enabled-${webhook.id}`} className="text-xs">Enabled</Label>
                          <Switch
                            id={`outgoing-enabled-${webhook.id}`}
                            checked={webhook.enabled}
                            onCheckedChange={checked => updateOutgoingWebhook(webhook.id, index, { enabled: checked })}
                            disabled={!canManage || loadingWebhook}
                          />
                        </div>
                      </div>
                      {canManage && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive"
                          onClick={() => removeOutgoingWebhook(webhook.id, index)}
                          disabled={loadingWebhook}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Target URL</Label>
                      <Input
                        value={webhook.url}
                        onChange={e => updateOutgoingWebhook(webhook.id, index, { url: e.target.value })}
                        placeholder="https://your-system.example.com/webhooks/care"
                        className="font-mono text-xs"
                        disabled={!canManage || loadingWebhook}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Secret (sent as <code>X-Webhook-Secret</code>)</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          readOnly={!canManage}
                          value={loadingWebhook ? 'Loading...' : (canManage ? webhook.secret : '••••••••••••••••')}
                          onChange={e => updateOutgoingWebhook(webhook.id, index, { secret: e.target.value })}
                          className="font-mono text-xs bg-muted"
                          type={visibleSecrets[webhook.id] ? 'text' : 'password'}
                          disabled={loadingWebhook}
                        />
                        {canManage && (
                          <>
                            <Button size="icon" variant="outline" onClick={() => toggleSecretVisibility(webhook.id)} disabled={loadingWebhook}>
                              {visibleSecrets[webhook.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </Button>
                            <Button size="icon" variant="outline" onClick={() => copyToClipboard(webhook.secret, `outgoing-${webhook.id}`)} disabled={loadingWebhook || !webhook.secret}>
                              {copied === `outgoing-${webhook.id}` ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => regenerateOutgoingSecret(webhook.id)} disabled={regeneratingOutgoingId === webhook.id || loadingWebhook || !webhook.id}>
                              {regeneratingOutgoingId === webhook.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs">Events</Label>
                      <p className="text-[10px] text-muted-foreground">Leave all unchecked to receive every event type.</p>
                      <div className="flex flex-wrap gap-2">
                        {availableEvents.map(event => {
                          const selected = (webhook.events ?? []).includes(event);
                          return (
                            <Button
                              key={event}
                              type="button"
                              size="sm"
                              variant={selected ? 'default' : 'outline'}
                              className="h-7 text-[11px]"
                              onClick={() => toggleOutgoingEvent(webhook.id, index, event)}
                              disabled={!canManage || loadingWebhook}
                            >
                              {EVENT_LABELS[event] ?? event}
                            </Button>
                          );
                        })}
                      </div>
                    </div>

                    {canManage && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => testOutgoingWebhook(webhook, index)}
                        disabled={testingOutgoingId === (webhook.id || `new-${index}`) || loadingWebhook || !webhook.url || !webhook.secret}
                      >
                        {testingOutgoingId === (webhook.id || `new-${index}`) ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-2" />}
                        Send Test
                      </Button>
                    )}
                  </div>
                ))
              )}

              {canManage && outgoingWebhooks.length > 0 && (
                <Button size="sm" onClick={saveOutgoingSettings} disabled={savingOutgoing || loadingWebhook}>
                  {savingOutgoing ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : null}
                  Save Outgoing Webhooks
                </Button>
              )}

              <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto font-mono whitespace-pre-wrap leading-relaxed">{OUTGOING_EXAMPLE}</pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <CardTitle className="text-sm">Webhook Activity Log</CardTitle>
                  <Badge variant="secondary" className="text-[10px]">{webhookActivity.length} events</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input className="pl-8 h-8 text-xs w-48" placeholder="Search order..." value={searchOrder} onChange={e => setSearchOrder(e.target.value)} />
                  </div>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => refetch()}><RefreshCw className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {webhookActivity.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <Webhook className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No fulfillment system updates yet</p>
                  <p className="text-xs mt-1">Updates pushed by your fulfillment system will appear here</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-xs uppercase tracking-wider font-semibold">Time</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider font-semibold">Ticket</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider font-semibold">Update</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider font-semibold">Change</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {webhookActivity.map(a => (
                      <TableRow key={a.id}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(a.created_date), 'MMM dd HH:mm')}
                        </TableCell>
                        <TableCell className="text-xs font-mono text-primary">{a.complaint_id?.slice(0, 8)}...</TableCell>
                        <TableCell className="text-xs max-w-xs truncate">{a.description?.replace('[Fulfillment System] ', '')}</TableCell>
                        <TableCell>
                          {a.old_value && a.new_value && (
                            <div className="flex items-center gap-1 text-[10px]">
                              <Badge variant="outline" className="text-[10px] py-0">{a.old_value}</Badge>
                              <span>→</span>
                              <Badge className="text-[10px] py-0 bg-emerald-100 text-emerald-700 border-0">{a.new_value}</Badge>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={manualUpdateOpen} onOpenChange={setManualUpdateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Push Status Update</DialogTitle>
            <p className="text-xs text-muted-foreground">This simulates what your fulfillment system would send via API</p>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Order Number *</Label>
              <Input
                value={manualForm.order_number}
                onChange={e => setManualForm(p => ({ ...p, order_number: e.target.value }))}
                placeholder="ORD-2024-001"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">New Status *</Label>
              <Select value={manualForm.status} onValueChange={v => setManualForm(p => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tracking Number (optional)</Label>
              <Input
                value={manualForm.tracking_number}
                onChange={e => setManualForm(p => ({ ...p, tracking_number: e.target.value }))}
                placeholder="JNE123456789"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Notes (optional)</Label>
              <Input
                value={manualForm.notes}
                onChange={e => setManualForm(p => ({ ...p, notes: e.target.value }))}
                placeholder="e.g. Package dispatched from warehouse"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualUpdateOpen(false)}>Cancel</Button>
            <Button onClick={handleManualUpdate} disabled={updating}>
              {updating ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Push Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
