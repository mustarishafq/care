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
import { Copy, CheckCircle, Webhook, Code2, Clock, RefreshCw, Search, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { usePermissions } from '@/lib/usePermissions';

// The webhook base URL — in production this would be a real backend function URL
const WEBHOOK_BASE = `${window.location.origin}/api/webhook`;

const CODE_EXAMPLE = `// Call this endpoint from your fulfillment system when tracking status changes

POST ${WEBHOOK_BASE}/tracking-update
Content-Type: application/json
X-API-Key: YOUR_API_KEY

{
  "order_number": "ORD-2024-001",
  "tracking_number": "JNE123456789",
  "status": "Shipped",           // ResolveHub status value
  "tracking_url": "https://...", // optional
  "notes": "Package picked up"   // optional
}

// Supported status values:
// "Under Review", "Approved Replacement", "Reprocessing by Fulfillment",
// "Ready to Ship", "Shipped", "Delivered", "Closed"

// Response:
{
  "success": true,
  "updated_tickets": 1,
  "ticket_ids": ["TKT-20240101-001"]
}`;

const PYTHON_EXAMPLE = `import requests

def update_ticket_status(order_number, tracking_number, status, api_key):
    response = requests.post(
        "${WEBHOOK_BASE}/tracking-update",
        headers={
            "Content-Type": "application/json",
            "X-API-Key": api_key
        },
        json={
            "order_number": order_number,
            "tracking_number": tracking_number,
            "status": status,
            "notes": "Auto-updated by fulfillment system"
        }
    )
    return response.json()

# Example usage
update_ticket_status("ORD-2024-001", "JNE123456789", "Shipped", "your-api-key")`;

export default function OmsIntegration() {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('oms.manage');
  const [apiKey] = useState(() => {
    // Persist a generated API key in localStorage per app
    const stored = localStorage.getItem('resolveHub_webhookApiKey');
    if (stored) return stored;
    const key = 'rh_' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    localStorage.setItem('resolveHub_webhookApiKey', key);
    return key;
  });
  const [copied, setCopied] = useState(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [searchOrder, setSearchOrder] = useState('');
  const [manualUpdateOpen, setManualUpdateOpen] = useState(false);
  const [manualForm, setManualForm] = useState({ order_number: '', tracking_number: '', status: '', notes: '' });
  const [updating, setUpdating] = useState(false);
  const [codeTab, setCodeTab] = useState('curl');

  const { data: recentActivity = [], isLoading: loadingActivity, refetch } = useQuery({
    queryKey: ['webhook-activity'],
    queryFn: () => db.entities.TicketActivity.list('-created_date', 50),
  });

  const { data: complaints = [] } = useQuery({
    queryKey: ['complaints'],
    queryFn: () => db.entities.Complaint.list('-created_date', 500),
  });

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
    toast.success('Copied!');
  };

  // Simulate manual status push (what fulfillment system would do via API)
  const handleManualUpdate = async () => {
    if (!manualForm.order_number || !manualForm.status) {
      toast.error('Order number and status are required');
      return;
    }
    setUpdating(true);

    // Fetch fresh complaints to avoid stale cache misses
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
        user_email: 'system@fulfillment',
        user_name: 'Fulfillment System',
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

  const webhookActivity = recentActivity.filter(a =>
    a.description?.includes('[Fulfillment System]') &&
    (!searchOrder || a.description?.toLowerCase().includes(searchOrder.toLowerCase()))
  );

  const STATUSES = [
    'Under Review', 'Approved Replacement', 'Reprocessing by Fulfillment',
    'Ready to Ship', 'Shipped', 'Delivered', 'Closed'
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Fulfillment Integration (Incoming Webhook)</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Your fulfillment system calls ResolveHub's API to push tracking & status updates automatically
        </p>
      </div>

      {/* How it works */}
      <Card className="border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800">
        <CardContent className="pt-4 pb-4">
          <div className="flex gap-3 text-sm text-blue-700 dark:text-blue-300">
            <Webhook className="w-5 h-5 shrink-0 mt-0.5 text-blue-600" />
            <div>
              <p className="font-medium mb-1">How it works</p>
              <ol className="text-xs space-y-1 list-decimal ml-4">
                <li>Copy the webhook endpoint URL and API key below</li>
                <li>Configure your fulfillment system to call the endpoint when order/tracking status changes</li>
                <li>ResolveHub automatically finds the matching complaint by <strong>order_number</strong> and updates its status + tracking</li>
                <li>All updates are logged in the ticket activity timeline</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Webhook URL */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Webhook Endpoint URL</CardTitle>
            <CardDescription className="text-xs">Your fulfillment system sends POST requests here</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={`${WEBHOOK_BASE}/tracking-update`}
                className="font-mono text-xs bg-muted"
              />
              <Button size="icon" variant="outline" onClick={() => copyToClipboard(`${WEBHOOK_BASE}/tracking-update`, 'url')}>
                {copied === 'url' ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">Method: <code className="bg-muted px-1 rounded">POST</code> — Content-Type: <code className="bg-muted px-1 rounded">application/json</code></p>
          </CardContent>
        </Card>

        {/* API Key */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">API Key</CardTitle>
            <CardDescription className="text-xs">Include this in the <code>X-API-Key</code> header of every request</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={apiKey}
                className="font-mono text-xs bg-muted"
                type={showApiKey ? 'text' : 'password'}
              />
              <Button size="icon" variant="outline" onClick={() => setShowApiKey(v => !v)}>
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
              <Button size="icon" variant="outline" onClick={() => copyToClipboard(apiKey, 'key')}>
                {copied === 'key' ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">Keep this secret. Regenerate if compromised.</p>
          </CardContent>
        </Card>
      </div>

      {/* Code Examples */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2"><Code2 className="w-4 h-4" />Integration Code Examples</CardTitle>
            <Button size="sm" variant="outline" onClick={() => copyToClipboard(codeTab === 'python' ? PYTHON_EXAMPLE : CODE_EXAMPLE, 'code')}>
              {copied === 'code' ? <CheckCircle className="w-3 h-3 mr-1 text-emerald-500" /> : <Copy className="w-3 h-3 mr-1" />}
              Copy
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={codeTab} onValueChange={setCodeTab}>
            <TabsList className="mb-3">
              <TabsTrigger value="curl" className="text-xs">cURL / JSON</TabsTrigger>
              <TabsTrigger value="python" className="text-xs">Python</TabsTrigger>
            </TabsList>
            <TabsContent value="curl">
              <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto font-mono whitespace-pre-wrap leading-relaxed">{CODE_EXAMPLE}</pre>
            </TabsContent>
            <TabsContent value="python">
              <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto font-mono whitespace-pre-wrap leading-relaxed">{PYTHON_EXAMPLE}</pre>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Manual Test / Simulate */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm">Manual Update (Test / Override)</CardTitle>
              <CardDescription className="text-xs">Manually push a status update — useful for testing or one-off corrections</CardDescription>
            </div>
            {canManage && (
              <Button size="sm" onClick={() => setManualUpdateOpen(true)}>
                <RefreshCw className="w-3.5 h-3.5 mr-2" />Push Update
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Activity Log */}
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

      {/* Manual Update Dialog */}
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