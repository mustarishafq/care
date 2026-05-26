import React from 'react';
import { Badge } from '@/components/ui/badge';
import { PRIORITY_COLORS } from '@/lib/ticketUtils';

export default function PriorityBadge({ priority }) {
  const colors = PRIORITY_COLORS[priority] || PRIORITY_COLORS['Medium'];
  return (
    <Badge className={`${colors.bg} ${colors.text} border-0 text-xs font-medium`}>
      {priority}
    </Badge>
  );
}