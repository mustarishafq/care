import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { NOTIFICATION_TRIGGERS } from '@/components/settings/constants';

export default function NotificationTriggersList() {
  return (
    <Card className="rounded-2xl border border-border shadow-sm overflow-hidden">
      <ul className="divide-y divide-border">
        {NOTIFICATION_TRIGGERS.map((trigger) => {
          const Icon = trigger.icon;
          return (
            <li key={trigger.type} className="flex items-start gap-3 p-4 sm:p-5 hover:bg-muted/30 transition-colors">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="w-4 h-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{trigger.event}</p>
                  <Badge variant="outline" className="text-[10px] font-mono font-normal">
                    {trigger.type}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{trigger.when}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
