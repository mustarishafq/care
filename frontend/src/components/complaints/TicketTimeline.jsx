import React from 'react';
import { format } from 'date-fns';
import { 
  FileText, RefreshCw, UserPlus, MessageSquare, 
  Paperclip, Truck, CheckCircle2, AlertCircle, RotateCcw
} from 'lucide-react';

const ACTION_ICONS = {
  created: FileText,
  status_changed: RefreshCw,
  assigned: UserPlus,
  note_added: MessageSquare,
  attachment_uploaded: Paperclip,
  tracking_added: Truck,
  priority_changed: AlertCircle,
  resolved: CheckCircle2,
  closed: CheckCircle2,
  reopened: RotateCcw,
};

export default function TicketTimeline({ activities }) {
  return (
    <div className="space-y-0">
      {activities.map((a, i) => {
        const Icon = ACTION_ICONS[a.action_type] || FileText;
        return (
          <div key={a.id} className="flex gap-3 relative">
            {i < activities.length - 1 && (
              <div className="absolute left-[15px] top-8 bottom-0 w-px bg-border" />
            )}
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 z-10">
              <Icon className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <div className="pb-5 min-w-0">
              <p className="text-sm">{a.description}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-muted-foreground">{a.user_name || 'System'}</span>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(a.created_date), 'MMM dd, yyyy HH:mm')}
                </span>
              </div>
            </div>
          </div>
        );
      })}
      {activities.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">No activity yet</p>
      )}
    </div>
  );
}
