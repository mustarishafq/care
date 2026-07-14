import { db } from '@/api/db';

import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import {
  ScrollText, Loader2, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle2, Info, Ban,
} from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import PageContent from '@/components/layout/PageContent';
import StatCard from '@/components/dashboard/StatCard';
import { usePermissions } from '@/lib/usePermissions';
import { useDisplayFormat } from '@/lib/DisplayFormatProvider';
import { cn } from '@/lib/utils';

const LEVEL_STYLES = {
  info: 'bg-sky-100 text-sky-800 border-sky-200/80 dark:bg-sky-950/50 dark:text-sky-300',
  success: 'bg-emerald-100 text-emerald-800 border-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-300',
  warning: 'bg-amber-100 text-amber-800 border-amber-200/80 dark:bg-amber-950/50 dark:text-amber-300',
  error: 'bg-rose-100 text-rose-800 border-rose-200/80 dark:bg-rose-950/50 dark:text-rose-300',
};

function LevelIcon({ level }) {
  if (level === 'success') return <CheckCircle2 className="w-3.5 h-3.5" />;
  if (level === 'warning') return <AlertTriangle className="w-3.5 h-3.5" />;
  if (level === 'error') return <Ban className="w-3.5 h-3.5" />;
  return <Info className="w-3.5 h-3.5" />;
}

export default function SchedulerLogs() {
  const { hasPermission, loading: permLoading } = usePermissions();
  const { formatDateTime, formatNumber } = useDisplayFormat();
  const canView = hasPermission('scheduler.view');

  const [commandFilter, setCommandFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 30;

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [commandFilter, levelFilter, debouncedSearch, fromDate, toDate]);

  const params = useMemo(() => {
    const next = { page, per_page: perPage };
    if (commandFilter !== 'all') next.command = commandFilter;
    if (levelFilter !== 'all') next.level = levelFilter;
    if (debouncedSearch) next.search = debouncedSearch;
    if (fromDate) next.start_date = fromDate;
    if (toDate) next.end_date = toDate;
    return next;
  }, [page, commandFilter, levelFilter, debouncedSearch, fromDate, toDate]);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['scheduler-logs', params],
    queryFn: () => db.schedulerLogs.list(params),
    enabled: canView && !permLoading,
    refetchOnMount: 'always',
    staleTime: 0,
  });

  const logs = data?.data ?? [];
  const meta = data?.meta ?? { current_page: 1, last_page: 1, total: 0, from: null, to: null };
  const stats = data?.stats ?? { total: 0, info: 0, success: 0, warning: 0, error: 0 };
  const commands = data?.commands ?? [];

  if (permLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="space-y-6">
        <PageHeader icon={ScrollText} title="Scheduler Logs" description="Access denied" />
        <PageContent>
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              You need the scheduler.view permission to open this page.
            </CardContent>
          </Card>
        </PageContent>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ScrollText}
        title="Scheduler Logs"
        description="Outputs from marketplace schedulers and queue jobs"
        actions={(
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Refresh
          </Button>
        )}
      />

      <PageContent className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <StatCard label="Total" value={isLoading ? '…' : stats.total} icon={ScrollText} color="blue" index={0} />
          <StatCard label="Info" value={isLoading ? '…' : stats.info} icon={Info} color="info" index={1} />
          <StatCard label="Success" value={isLoading ? '…' : stats.success} icon={CheckCircle2} color="success" index={2} />
          <StatCard label="Warning" value={isLoading ? '…' : stats.warning} icon={AlertTriangle} color="warning" index={3} />
          <StatCard label="Error" value={isLoading ? '…' : stats.error} icon={Ban} color="danger" index={4} />
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Filters</CardTitle>
            <CardDescription>Browse queued and scheduled job output</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search message…"
              className="h-10"
            />
            <Select value={commandFilter} onValueChange={setCommandFilter}>
              <SelectTrigger className="h-10"><SelectValue placeholder="Command" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All commands</SelectItem>
                {commands.map((command) => (
                  <SelectItem key={command} value={command}>{command}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="h-10"><SelectValue placeholder="Level" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All levels</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
            <DateRangePicker
              from={fromDate}
              to={toDate}
              onChange={({ from, to }) => {
                setFromDate(from || '');
                setToDate(to || '');
              }}
              placeholder="Any date"
              allowClear
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-baseline justify-between gap-2">
              <CardTitle className="text-base">
                {isLoading
                  ? 'Loading…'
                  : `${formatNumber(meta.from ?? 0, { empty: '0' })}–${formatNumber(meta.to ?? 0, { empty: '0' })} of ${formatNumber(meta.total ?? 0, { empty: '0' })}`}
              </CardTitle>
              <p className="text-xs text-muted-foreground">log entries</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Loading logs…
              </div>
            ) : logs.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                No scheduler logs yet. They appear when marketplace:sync-orders, reveal-order-phones, or low-rating-alerts run.
              </div>
            ) : (
              <div className="rounded-lg border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="uppercase text-[11px] tracking-wide">When</TableHead>
                      <TableHead className="uppercase text-[11px] tracking-wide">Level</TableHead>
                      <TableHead className="uppercase text-[11px] tracking-wide">Command</TableHead>
                      <TableHead className="uppercase text-[11px] tracking-wide">Shop</TableHead>
                      <TableHead className="uppercase text-[11px] tracking-wide">Message</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground align-top">
                          {log.created_at ? formatDateTime(log.created_at) : '—'}
                        </TableCell>
                        <TableCell className="align-top">
                          <Badge
                            variant="outline"
                            className={cn('gap-1 capitalize font-normal', LEVEL_STYLES[log.level] || '')}
                          >
                            <LevelIcon level={log.level} />
                            {log.level}
                          </Badge>
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="text-sm font-medium">{log.command}</div>
                          {log.source && (
                            <div className="text-[11px] text-muted-foreground mt-0.5">{log.source}</div>
                          )}
                          {log.title && (
                            <div className="text-[11px] text-muted-foreground mt-0.5">{log.title}</div>
                          )}
                        </TableCell>
                        <TableCell className="align-top text-sm">
                          {log.shop_name || (log.context?.shop_name) || '—'}
                        </TableCell>
                        <TableCell className="align-top text-sm max-w-xl whitespace-pre-wrap break-words">
                          {log.message}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {meta.last_page > 1 && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <p className="text-xs text-muted-foreground text-center sm:text-left">
                  Page {meta.current_page} of {meta.last_page}
                </p>
                <div className="grid grid-cols-2 sm:flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={meta.current_page <= 1 || isLoading}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="h-9"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={meta.current_page >= meta.last_page || isLoading}
                    onClick={() => setPage((p) => p + 1)}
                    className="h-9"
                  >
                    Next
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </PageContent>
    </div>
  );
}
