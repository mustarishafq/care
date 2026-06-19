import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Loader2, Search } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useGlobalSearchShortcut } from '@/hooks/useGlobalSearchShortcut';
import { usePermissions } from '@/lib/usePermissions';
import { searchComplaints, searchUsers } from '@/lib/globalSearch';
import { getRoleLabel } from '@/lib/roles';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

const DEBOUNCE_MS = 250;

function userInitials(user) {
  return user.full_name
    ? user.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : '??';
}

function departmentLabel(user) {
  const names = (user.departments ?? []).map((d) => d.name).filter(Boolean);
  return names.length ? names.join(', ') : null;
}

export function GlobalSearchTrigger({ className }) {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();

  const handleOpen = useCallback(() => setOpen(true), []);

  useGlobalSearchShortcut(handleOpen);

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        aria-label="Open search"
        className={cn(
          'relative flex w-full items-center rounded-lg bg-muted/50 pl-9 pr-3 h-10',
          'text-sm text-left text-muted-foreground transition-colors',
          'hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          className,
        )}
      >
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
        <span className="truncate">Search complaints, users…</span>
        {!isMobile && (
          <kbd className="pointer-events-none ml-auto hidden h-5 shrink-0 items-center rounded border bg-muted px-1.5 font-mono text-[10px] sm:inline-flex">
            ⌘K
          </kbd>
        )}
      </button>
      <GlobalSearchDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

function GlobalSearchDialog({ open, onOpenChange }) {
  const navigate = useNavigate();
  const { hasPermission, loading: permLoading } = usePermissions();
  const canSearchComplaints = hasPermission('complaints.view');
  const canSearchUsers =
    hasPermission('users.view')
    || hasPermission('complaints.assign')
    || hasPermission('complaints.add_notes');
  const canSearch = canSearchComplaints || canSearchUsers;

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [complaints, setComplaints] = useState([]);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setDebouncedQuery('');
      setComplaints([]);
      setUsers([]);
      return undefined;
    }

    const timer = setTimeout(() => setDebouncedQuery(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, open]);

  useEffect(() => {
    if (!open || !debouncedQuery || permLoading || !canSearch) {
      setComplaints([]);
      setUsers([]);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const tasks = [];
        if (canSearchComplaints) {
          tasks.push(searchComplaints(debouncedQuery).then((r) => ({ complaints: r })));
        }
        if (canSearchUsers) {
          tasks.push(searchUsers(debouncedQuery).then((r) => ({ users: r })));
        }

        const results = await Promise.all(tasks);
        if (cancelled) return;

        setComplaints(results.find((r) => r.complaints)?.complaints ?? []);
        setUsers(results.find((r) => r.users)?.users ?? []);
      } catch {
        if (!cancelled) {
          setComplaints([]);
          setUsers([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, open, canSearch, canSearchComplaints, canSearchUsers, permLoading]);

  const hasResults = complaints.length > 0 || users.length > 0;
  const showIdle = !debouncedQuery;
  const showNoResults = debouncedQuery && !loading && !permLoading && canSearch && !hasResults;

  const handleSelectComplaint = (id) => {
    onOpenChange(false);
    navigate(`/complaints/${id}`);
  };

  const handleSelectUser = () => {
    onOpenChange(false);
    navigate('/users');
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      shouldFilter={false}
      contentClassName="w-[calc(100%-2rem)] max-w-lg rounded-xl p-0"
    >
      <CommandInput
        placeholder="Search complaints, users, phone, orders…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList className="max-h-[300px]">
        {showIdle && (
          <CommandEmpty>Type a ticket ID, customer, phone, order, name, or email.</CommandEmpty>
        )}
        {loading && debouncedQuery && (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Searching…
          </div>
        )}
        {showNoResults && (
          <CommandEmpty>No results found.</CommandEmpty>
        )}
        {!loading && complaints.length > 0 && (
          <CommandGroup heading="Complaints">
            {complaints.map((complaint) => (
              <CommandItem
                key={complaint.id}
                value={`complaint-${complaint.id}`}
                onSelect={() => handleSelectComplaint(complaint.id)}
                className="gap-3"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{complaint.ticket_id}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[complaint.customer_name, complaint.customer_phone, complaint.order_number]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                {complaint.status && (
                  <Badge variant="secondary" className="shrink-0 text-[10px] capitalize">
                    {complaint.status}
                  </Badge>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {!loading && users.length > 0 && (
          <CommandGroup heading="Users">
            {users.map((user) => (
              <CommandItem
                key={user.id}
                value={`user-${user.id}`}
                onSelect={handleSelectUser}
                className="gap-3"
              >
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                    {userInitials(user)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{user.full_name}</p>
                  {departmentLabel(user) && (
                    <p className="truncate text-xs text-muted-foreground">{departmentLabel(user)}</p>
                  )}
                </div>
                <Badge variant="secondary" className="shrink-0 text-[10px] capitalize">
                  {getRoleLabel(user.role_id, [], user.role_label)}
                </Badge>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}

export default GlobalSearchTrigger;
