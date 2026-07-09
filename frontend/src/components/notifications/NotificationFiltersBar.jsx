import React from 'react';
import { Search } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  NOTIFICATION_CATEGORY_OPTIONS,
  NOTIFICATION_STATUS_FILTERS,
  NOTIFICATION_TYPE_OPTIONS,
} from '@/lib/notificationFilters';

export default function NotificationFiltersBar({
  search,
  onSearchChange,
  status,
  onStatusChange,
  type,
  onTypeChange,
  category,
  onCategoryChange,
  compact = false,
}) {
  return (
    <Card className="rounded-2xl border border-border shadow-sm">
      <CardContent className={compact ? 'p-3' : 'p-4'}>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search notifications..."
              className="h-10 border-0 bg-muted/50 pl-9"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:items-center shrink-0">
            <Tabs value={status} onValueChange={onStatusChange}>
              <TabsList className="h-9 w-full sm:w-auto bg-muted/50 text-foreground/60">
                {NOTIFICATION_STATUS_FILTERS.map((item) => (
                  <TabsTrigger
                    key={item.value}
                    value={item.value}
                    className="flex-1 sm:flex-none text-xs px-3 data-[state=active]:text-foreground"
                  >
                    {item.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            <Select value={type} onValueChange={onTypeChange}>
              <SelectTrigger className="h-9 w-full sm:w-[140px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NOTIFICATION_TYPE_OPTIONS.map((item) => (
                  <SelectItem key={item.value} value={item.value} className="text-xs">
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={category} onValueChange={onCategoryChange}>
              <SelectTrigger className="h-9 w-full sm:w-[160px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NOTIFICATION_CATEGORY_OPTIONS.map((item) => (
                  <SelectItem key={item.value} value={item.value} className="text-xs">
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
