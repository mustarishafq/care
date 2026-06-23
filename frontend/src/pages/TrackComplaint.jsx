import { db } from '@/api/db';

import React, { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Search, Package, Phone, AlertCircle, CheckCircle2, Clock, Truck, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { buildStatusOrder, TERMINAL_STATUSES } from '@/lib/ticketUtils';
import { useSlaSettings } from '@/lib/useSlaSettings';
import { getStatusColorStyles } from '@/lib/statusColors';
import { useComplaintStatuses } from '@/lib/useLookups';

const STATUS_ICONS = {
  'New Complaint': Clock,
  'Under Review': Search,
  'Approved Replacement': CheckCircle2,
  'Rejected': AlertCircle,
  'Reprocessing by Fulfillment': Package,
  'Ready to Ship': Package,
  'Shipped': Truck,
  'Delivered': CheckCircle2,
  'Closed': CheckCircle2,
  'Drop': CheckCircle2,
};

function StatusProgressBar({ status }) {
  const { data: complaintStatuses = [] } = useComplaintStatuses();
  const statusOrder = buildStatusOrder(complaintStatuses, { includeNames: [status] });

  if (TERMINAL_STATUSES.includes(status)) {
    const colors = getStatusColorStyles(status, complaintStatuses);
    return (
      <div className="flex items-center gap-2 mt-4">
        <span className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full" style={colors.badge}>
          <AlertCircle className="w-4 h-4" /> {status}
        </span>
      </div>);
  }
  const steps = statusOrder.filter((s) => !TERMINAL_STATUSES.includes(s));
  const currentIdx = steps.indexOf(status);
  return (
    <div className="mt-4 w-full">
      <div className="flex items-start w-full">
        {steps.map((step, i) => {
          const done = i < currentIdx;
          const active = i === currentIdx;
          const isLast = i === steps.length - 1;
          return (
            <React.Fragment key={step}>
              {/* Step node */}
              <div className="flex flex-col items-center shrink-0" style={{ width: 64 }}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all
                  ${active ? 'bg-primary border-primary text-white' : done ? 'bg-primary/20 border-primary text-primary' : 'bg-muted border-border text-muted-foreground'}`}>
                  {done ? '✓' : i + 1}
                </div>
                <span className={`text-[10px] mt-1.5 text-center w-full px-0.5 leading-tight
                  ${active ? 'text-primary font-semibold' : done ? 'text-primary/70' : 'text-muted-foreground'}`}>
                  {step}
                </span>
              </div>
              {/* Connector */}
              {!isLast &&
              <div className={`h-0.5 flex-1 mt-3.5 ${i < currentIdx ? 'bg-primary' : 'bg-border'}`} />
              }
            </React.Fragment>);

        })}
      </div>
    </div>);

}

function ComplaintCard({ complaint }) {
  const { data: complaintStatuses = [] } = useComplaintStatuses();
  const colors = getStatusColorStyles(complaint.status, complaintStatuses);
  const Icon = STATUS_ICONS[complaint.status] || Clock;

  return (
    <Card className="border-l-4 border-l-primary">
      <CardContent className="pt-5 pb-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Ticket ID</p>
            <p className="text-lg font-bold font-mono">{complaint.ticket_id || complaint.id?.slice(0, 8).toUpperCase()}</p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium" style={colors.badge}>
            <Icon className="w-4 h-4" />
            {complaint.status}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm mb-4">
          <div>
            <p className="text-xs text-muted-foreground">Order Number</p>
            <p className="font-medium">{complaint.order_number || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Purchase Date</p>
            <p className="font-medium">
              {complaint.purchase_date
                ? format(new Date(`${complaint.purchase_date}T00:00:00`), 'd MMM yyyy')
                : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Product</p>
            <p className="font-medium">{complaint.product_name || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Type</p>
            <p className="font-medium">{complaint.complaint_type || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Submitted</p>
            <p className="font-medium">{format(new Date(complaint.created_date), 'd MMM yyyy')}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Courier</p>
            <p className="font-medium">{complaint.courier_name || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Replacement Tracking</p>
            <p className="font-medium font-mono">{complaint.replacement_tracking_number || '—'}</p>
          </div>
        </div>

        <StatusProgressBar status={complaint.status} />

        {complaint.resolution_notes &&
        <div className="mt-4 bg-muted/50 rounded-lg px-4 py-3 text-sm">
            <p className="text-xs text-muted-foreground font-medium uppercase mb-1">Resolution Notes</p>
            <p>{complaint.resolution_notes}</p>
          </div>
        }
      </CardContent>
    </Card>);

}

function ResultsTabs({ results, phone }) {
  const { resolvedStatusNames } = useSlaSettings();
  const active = results.filter((c) => !resolvedStatusNames.includes(c.status));
  const closed = results.filter((c) => resolvedStatusNames.includes(c.status));

  return (
    <div>
      <p className="text-sm text-muted-foreground font-medium mb-3">
        {results.length} complaint{results.length > 1 ? 's' : ''} found for <span className="font-semibold text-foreground">{phone}</span>
      </p>
      <Tabs defaultValue="active">
        <TabsList className="mb-4">
          <TabsTrigger value="active">
            Active <span className="ml-1.5 bg-primary/15 text-primary text-xs font-semibold px-1.5 py-0.5 rounded-full">{active.length}</span>
          </TabsTrigger>
          <TabsTrigger value="closed">
            Closed / Resolved <span className="ml-1.5 bg-muted text-muted-foreground text-xs font-semibold px-1.5 py-0.5 rounded-full">{closed.length}</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="active">
          {active.length > 0 ?
          <div className="space-y-4">{active.map((c) => <ComplaintCard key={c.id} complaint={c} />)}</div> :

          <p className="text-sm text-muted-foreground py-6 text-center">No active complaints.</p>
          }
        </TabsContent>
        <TabsContent value="closed">
          {closed.length > 0 ?
          <div className="space-y-4">{closed.map((c) => <ComplaintCard key={c.id} complaint={c} />)}</div> :

          <p className="text-sm text-muted-foreground py-6 text-center">No closed complaints.</p>
          }
        </TabsContent>
      </Tabs>
    </div>);

}

export default function TrackComplaint() {
  const [phone, setPhone] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!phone.trim()) return;
    setLoading(true);
    setSearched(false);
    const complaints = await db.entities.Complaint.filter({ customer_phone: phone.trim() }, '-created_date', 50);
    setResults(complaints);
    setSearched(true);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex flex-col">
      {/* Header */}
      <header className="bg-card border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <img src="/icons/logo.png" alt="EMZI Nexus Care" className="w-9 h-9 rounded-xl shrink-0 object-cover" />
          <div>
            <h1 className="font-bold text-lg leading-tight">EMZI Nexus Care</h1>
            <p className="text-xs text-muted-foreground">Complaint Status Tracker</p>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col items-center justify-start px-4 pt-12 pb-16">
        <div className="w-full max-w-3xl">
          {/* Hero */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-2xl mb-4">
              <Search className="w-8 h-8 text-[#1d679d]" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight mb-2">Track Your Complaint</h2>
            <p className="text-muted-foreground text-base">Enter your phone number to check the status of your complaint(s).</p>
          </div>

          {/* Search box */}
          <Card className="shadow-lg mb-8">
            <CardContent className="pt-6 pb-6">
              <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="tel"
                    placeholder="e.g. 08123456789"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="pl-9 h-11 text-base" />
                  
                </div>
                <Button type="submit" disabled={loading || !phone.trim()} className="h-11 px-6 bg-[#1d679d]">
                  {loading ?
                  <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Searching…
                    </span> :

                  <span className="flex items-center gap-2">
                      Search <ArrowRight className="w-4 h-4" />
                    </span>
                  }
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Results */}
          {searched &&
          <div>
              {results && results.length > 0 ?
            <ResultsTabs results={results} phone={phone} /> :

            <Card>
                  <CardContent className="py-14 text-center">
                    <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                    <p className="font-semibold text-lg mb-1">No complaints found</p>
                    <p className="text-sm text-muted-foreground">No complaints are associated with <span className="font-medium">{phone}</span>. Please check the number and try again.</p>
                  </CardContent>
                </Card>
            }
            </div>
          }
        </div>
      </main>

      <footer className="text-center text-xs text-muted-foreground pb-6">
        Need help? Contact our customer service team.
      </footer>
    </div>);

}