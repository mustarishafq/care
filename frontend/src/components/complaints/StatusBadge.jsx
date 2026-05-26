import React from 'react';
import { Badge } from '@/components/ui/badge';
import { STATUS_COLORS } from '@/lib/ticketUtils';

export default function StatusBadge({ status }) {
  const colors = STATUS_COLORS[status] || STATUS_COLORS['New Complaint'];
  return (
    <Badge className={`${colors.bg} ${colors.text} border-0 text-xs font-medium gap-1.5`}>
      <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
      {status}
    </Badge>
  );
}