import React from 'react';
import { Badge } from '@/components/ui/badge';
import { getStatusColorStyles } from '@/lib/statusColors';
import { useComplaintStatuses } from '@/lib/useLookups';

export default function StatusBadge({ status }) {
  const { data: complaintStatuses = [] } = useComplaintStatuses();
  const colors = getStatusColorStyles(status, complaintStatuses);

  return (
    <Badge className="border-0 text-xs font-medium gap-1.5" style={colors.badge}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={colors.dot} />
      {status}
    </Badge>
  );
}
