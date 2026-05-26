import React from 'react';
import { Link } from 'react-router-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import StatusBadge from './StatusBadge';
import PriorityBadge from './PriorityBadge';
import { ChevronRight } from 'lucide-react';
import SlaTimer from './SlaTimer';
import { getSlaStatus } from './SlaBadge';

export default function ComplaintTable({ complaints }) {
  if (complaints.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="text-lg font-medium">No complaints found</p>
        <p className="text-sm mt-1">Try adjusting your filters</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border overflow-x-auto bg-card">
      <Table className="min-w-[800px]">
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="font-semibold text-xs uppercase tracking-wider">Ticket</TableHead>
            <TableHead className="font-semibold text-xs uppercase tracking-wider">Customer</TableHead>
            <TableHead className="font-semibold text-xs uppercase tracking-wider">Product</TableHead>
            <TableHead className="font-semibold text-xs uppercase tracking-wider">Type</TableHead>
            <TableHead className="font-semibold text-xs uppercase tracking-wider">Priority</TableHead>
            <TableHead className="font-semibold text-xs uppercase tracking-wider">Status</TableHead>
            <TableHead className="font-semibold text-xs uppercase tracking-wider">SLA</TableHead>
            <TableHead className="font-semibold text-xs uppercase tracking-wider">Assigned</TableHead>
            <TableHead className="font-semibold text-xs uppercase tracking-wider">Date</TableHead>
            <TableHead className="w-8" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {complaints.map(c => {
            const slaStatus = getSlaStatus(c);
            const rowHighlight = slaStatus === 'breached' ? 'bg-red-50/60 dark:bg-red-950/20' : slaStatus === 'at_risk' ? 'bg-amber-50/60 dark:bg-amber-950/20' : '';
            return (
            <TableRow key={c.id} className={`group hover:bg-muted/30 transition-colors cursor-pointer ${rowHighlight}`}>
              <TableCell>
                <Link to={`/complaints/${c.id}`} className="font-mono text-sm font-semibold text-primary hover:underline">
                  {c.ticket_id}
                </Link>
              </TableCell>
              <TableCell>
                <div>
                  <p className="text-sm font-medium">{c.customer_name}</p>
                  <p className="text-xs text-muted-foreground">{c.order_number}</p>
                </div>
              </TableCell>
              <TableCell className="text-sm max-w-[150px] truncate">{c.product_name}</TableCell>
              <TableCell className="text-sm">{c.complaint_type}</TableCell>
              <TableCell><PriorityBadge priority={c.priority} /></TableCell>
              <TableCell><StatusBadge status={c.status} /></TableCell>
              <TableCell><SlaTimer complaint={c} /></TableCell>
              <TableCell className="text-sm text-muted-foreground">{c.assigned_department || '—'}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {format(new Date(c.created_date), 'MMM dd, yyyy')}
              </TableCell>
              <TableCell>
                <Link to={`/complaints/${c.id}`}>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </Link>
              </TableCell>
            </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}