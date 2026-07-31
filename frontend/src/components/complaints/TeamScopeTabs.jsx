import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users } from 'lucide-react';
import { isTeamLead } from '@/lib/complaintVisibility';
import { cn } from '@/lib/utils';

/**
 * All / Team scope switch for team leads. Renders nothing for non-leads.
 */
export default function TeamScopeTabs({
  user,
  value = 'all',
  onValueChange,
  teamCount,
  className,
}) {
  if (!isTeamLead(user)) return null;

  return (
    <Tabs value={value} onValueChange={onValueChange} className={cn(className)}>
      <TabsList>
        <TabsTrigger value="all">All</TabsTrigger>
        <TabsTrigger value="team" className="gap-1.5">
          <Users className="w-3.5 h-3.5" />
          Team
          {teamCount != null && (
            <span className="text-muted-foreground tabular-nums">({teamCount})</span>
          )}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
