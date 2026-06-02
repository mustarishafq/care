import { db } from '@/api/db';

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import ComplaintFilters from '@/components/complaints/ComplaintFilters';
import ComplaintTable from '@/components/complaints/ComplaintTable';
import CreateComplaintDialog from '@/components/complaints/CreateComplaintDialog';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { usePermissions } from '@/lib/usePermissions';
import { canViewComplaint } from '@/lib/complaintVisibility';

export default function Complaints() {
  const [createOpen, setCreateOpen] = useState(false);
  const [filters, setFilters] = useState({ search: '', status: '', type: '', priority: '', department: '', courier: '' });
  const { user: currentUser, loading: userLoading } = useCurrentUser();
  const { hasPermission, loading: permLoading } = usePermissions();
  const canCreate = hasPermission('complaints.create');

  const { data: complaints = [], isLoading } = useQuery({
    queryKey: ['complaints'],
    queryFn: () => db.entities.Complaint.list('-created_date', 500),
  });

  const filtered = useMemo(() => {
    return complaints.filter(c => {
      if (!canViewComplaint(currentUser, c)) return false;
      if (filters.status && c.status !== filters.status) return false;
      if (filters.type && c.complaint_type_id !== filters.type) return false;
      if (filters.priority && c.priority_id !== filters.priority) return false;
      if (filters.department && c.assigned_department_id !== filters.department) return false;
      if (filters.courier && c.courier_id !== filters.courier) return false;
      if (filters.search) {
        const s = filters.search.toLowerCase();
        const searchable = `${c.ticket_id} ${c.customer_name} ${c.order_number} ${c.product_name}`.toLowerCase();
        if (!searchable.includes(s)) return false;
      }
      return true;
    });
  }, [complaints, filters, currentUser]);

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
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Complaints</h1>
          <p className="text-muted-foreground text-sm mt-1">{filtered.length} tickets found</p>
        </div>
        {canCreate && (
          <Button onClick={() => setCreateOpen(true)} className="self-start sm:self-auto">
            <Plus className="w-4 h-4 mr-2" />New Complaint
          </Button>
        )}
      </div>

      <ComplaintFilters filters={filters} setFilters={setFilters} />
      <ComplaintTable complaints={filtered} />
      {canCreate && <CreateComplaintDialog open={createOpen} onOpenChange={setCreateOpen} />}
    </div>
  );
}