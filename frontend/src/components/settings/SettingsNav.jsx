import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

export default function SettingsNav({ tabs = [], badges = {} }) {
  return (
    <div className="lg:sticky lg:top-20 w-full min-w-0">
      <nav aria-label="Settings sections" className="rounded-2xl border border-border bg-card p-1 lg:p-2 shadow-sm overflow-x-auto lg:overflow-visible">
        <p className="hidden lg:block px-3 pt-1.5 pb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Sections
        </p>
        <TabsList className="h-auto w-max min-w-full lg:w-full lg:min-w-0 justify-start gap-1 lg:flex-col lg:items-stretch bg-transparent p-0">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const badge = badges[tab.value];
            return (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className={cn(
                  'group h-10 lg:h-auto shrink-0 justify-start gap-2 lg:gap-3 rounded-xl px-3 lg:py-2.5 text-left font-medium shadow-none',
                  'hover:bg-muted/70 hover:text-foreground',
                  'data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none',
                )}
              >
                <span className="flex h-4 w-4 lg:h-8 lg:w-8 shrink-0 items-center justify-center rounded-lg lg:bg-muted lg:text-muted-foreground lg:group-data-[state=active]:bg-primary/15 lg:group-data-[state=active]:text-primary">
                  <Icon className="w-4 h-4" />
                </span>
                <span className="lg:hidden text-sm">{tab.label}</span>
                <span className="hidden lg:block min-w-0 flex-1">
                  <span className="block truncate text-sm">{tab.label}</span>
                  {tab.description && (
                    <span className="mt-0.5 block truncate text-[11px] font-normal text-muted-foreground group-data-[state=active]:text-primary/70">
                      {tab.description}
                    </span>
                  )}
                </span>
                {badge != null && badge !== '' && (
                  <span className="hidden lg:inline-flex ml-auto shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground group-data-[state=active]:bg-primary/15 group-data-[state=active]:text-primary">
                    {badge}
                  </span>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </nav>
    </div>
  );
}
