import { db } from '@/api/db';

import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { isToday, isThisMonth } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Plus, FileText } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import ComplaintFilters from '@/components/complaints/ComplaintFilters';
import ComplaintTable from '@/components/complaints/ComplaintTable';
import CreateComplaintDialog from '@/components/complaints/CreateComplaintDialog';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { usePermissions } from '@/lib/usePermissions';
import { canViewComplaint } from '@/lib/complaintVisibility';
import { useSlaSettings } from '@/lib/useSlaSettings';
import { parseComplaintFilters } from '@/lib/complaintFilterParams';

export default function Complaints() {
  const [searchParams] = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const [filters, setFilters] = useState(() => parseComplaintFilters(searchParams));
  const { user: currentUser, loading: userLoading } = useCurrentUser();
  const { hasPermission, loading: permLoading } = usePermissions();
  const { resolvedStatusNames } = useSlaSettings();
  const canCreate = hasPermission('complaints.create');

  useEffect(() => {
    setFilters(parseComplaintFilters(searchParams));
  }, [searchParams]);

  const { data: complaints = [], isLoading } = useQuery({
    queryKey: ['complaints'],
    queryFn: () => db.entities.Complaint.list('-created_date', 500),
  });

  const filtered = useMemo(() => {
    return complaints.filter(c => {
      if (!canViewComplaint(currentUser, c)) return false;
      if (filters.preset === 'today' && !isToday(new Date(c.created_date))) return false;
      if (filters.preset === 'month' && !isThisMonth(new Date(c.created_date))) return false;
      if (filters.preset === 'open' && resolvedStatusNames.includes(c.status)) return false;
      if (filters.preset === 'pending-fulfillment' && !['Approved Replacement', 'Reprocessing by Fulfillment'].includes(c.status)) return false;
      if (filters.status && c.status !== filters.status) return false;
      if (filters.type && c.complaint_type_id !== filters.type) return false;
      if (filters.priority && c.priority_id !== filters.priority) return false;
      if (filters.department && c.assigned_department_id !== filters.department) return false;
      if (filters.courier && c.courier_id !== filters.courier) return false;
      if (filters.search) {
        const s = filters.search.toLowerCase();
        const searchable = `${c.ticket_id} ${c.customer_name} ${c.customer_phone ?? ''} ${c.order_number} ${c.product_name}`.toLowerCase();
        if (!searchable.includes(s)) return false;
      }
      return true;
    });
  }, [complaints, filters, currentUser, resolvedStatusNames]);

  if (isLoading || userLoading || permLoading) {
    return (
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-2">
            <div className="h-7 w-40 bg-muted animate-pulse rounded-md" />
            <div className="h-4 w-24 bg-muted animate-pulse rounded-md" />
          </div>
          <div className="h-9 w-36 bg-muted animate-pulse rounded-md" />
        </div>
        {/* Filter bar skeleton */}
        <div className="flex gap-2 flex-wrap">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-9 w-28 bg-muted animate-pulse rounded-md" />
          ))}
        </div>
        {/* Table skeleton */}
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="h-10 bg-muted/60 animate-pulse" />
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3 border-t border-border">
              <div className="h-4 w-24 bg-muted animate-pulse rounded" />
              <div className="h-4 w-32 bg-muted animate-pulse rounded flex-1" />
              <div className="h-5 w-20 bg-muted animate-pulse rounded-full" />
              <div className="h-5 w-16 bg-muted animate-pulse rounded-full" />
              <div className="h-4 w-20 bg-muted animate-pulse rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={FileText}
        title="Complaints"
        description={`${filtered.length} tickets found`}
        actions={canCreate ? (
          <Button onClick={() => setCreateOpen(true)} className="gap-2 h-10 w-full sm:w-auto sm:h-9 shadow-md shadow-primary/20 hover:shadow-primary/30">
            <Plus className="w-4 h-4" />New Complaint
          </Button>
        ) : null}
      />

      <ComplaintFilters filters={filters} setFilters={setFilters} />
      <ComplaintTable complaints={filtered} />
      {canCreate && <CreateComplaintDialog open={createOpen} onOpenChange={setCreateOpen} />}
    </div>
  );
}