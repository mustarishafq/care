import React from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';
import { buildStatusOrder } from '@/lib/ticketUtils';
import { useDepartments } from '@/lib/useDepartments';
import { useComplaintStatuses, useComplaintTypes, useCouriers, usePriorities } from '@/lib/useLookups';
import { DEFAULT_COMPLAINT_FILTERS } from '@/lib/complaintFilterParams';

export default function ComplaintFilters({ filters, setFilters }) {
  const { data: departments = [] } = useDepartments();
  const { data: complaintTypes = [] } = useComplaintTypes();
  const { data: couriers = [] } = useCouriers();
  const { data: priorities = [] } = usePriorities();
  const { data: complaintStatuses = [] } = useComplaintStatuses();
  const statusOrder = buildStatusOrder(complaintStatuses);

  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value === 'all' ? '' : value }));
  };

  const clearFilters = () => {
    setFilters({ ...DEFAULT_COMPLAINT_FILTERS });
  };

  const hasFilters = Object.values(filters).some(v => v);

  return (
    <div className="flex flex-col gap-2">
      <div className="relative w-full">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search tickets, customers, orders..."
          value={filters.search}
          onChange={e => updateFilter('search', e.target.value)}
          className="pl-9 h-9 w-full"
        />
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <Select value={filters.status || 'all'} onValueChange={v => updateFilter('status', v)}>
          <SelectTrigger className="flex-1 min-w-[120px] h-9"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {statusOrder.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filters.type || 'all'} onValueChange={v => updateFilter('type', v)}>
          <SelectTrigger className="flex-1 min-w-[120px] h-9"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {complaintTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filters.priority || 'all'} onValueChange={v => updateFilter('priority', v)}>
          <SelectTrigger className="flex-1 min-w-[120px] h-9"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            {priorities.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filters.department || 'all'} onValueChange={v => updateFilter('department', v)}>
          <SelectTrigger className="flex-1 min-w-[120px] h-9"><SelectValue placeholder="Department" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Depts</SelectItem>
            {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filters.courier || 'all'} onValueChange={v => updateFilter('courier', v)}>
          <SelectTrigger className="flex-1 min-w-[120px] h-9"><SelectValue placeholder="Courier" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Couriers</SelectItem>
            {couriers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 text-muted-foreground shrink-0">
            <X className="w-4 h-4 mr-1" /> Clear
          </Button>
        )}
      </div>
    </div>
  );
}
