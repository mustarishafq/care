import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Check, ChevronsUpDown, Loader2, Plus, Search, Trash2, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

const EMPTY_FORM = {
  id: null,
  name: '',
  department_id: '',
  lead_user_id: '',
  member_ids: [],
  sort_order: 0,
};

function userMatchesQuery(user, query) {
  if (!query) return true;
  const name = (user.full_name || '').toLowerCase();
  const email = (user.email || '').toLowerCase();
  return name.includes(query) || email.includes(query);
}

export default function TeamEditDialog({
  open,
  onOpenChange,
  teams = [],
  departments = [],
  users = [],
  loading,
  saving,
  canCreate,
  onSave,
  onDeactivate,
}) {
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [leadPickerOpen, setLeadPickerOpen] = useState(false);
  const [leadSearch, setLeadSearch] = useState('');
  const [memberSearch, setMemberSearch] = useState('');

  const normalizedSearch = search.trim().toLowerCase();
  const normalizedLeadSearch = leadSearch.trim().toLowerCase();
  const normalizedMemberSearch = memberSearch.trim().toLowerCase();

  const visibleTeams = useMemo(() => {
    if (!normalizedSearch) return teams;
    return teams.filter((t) => {
      const hay = `${t.name || ''} ${t.department || ''}`.toLowerCase();
      return hay.includes(normalizedSearch);
    });
  }, [teams, normalizedSearch]);

  const filteredLeadUsers = useMemo(
    () => users.filter((u) => userMatchesQuery(u, normalizedLeadSearch)),
    [users, normalizedLeadSearch],
  );

  const filteredMemberUsers = useMemo(
    () => users.filter((u) => userMatchesQuery(u, normalizedMemberSearch)),
    [users, normalizedMemberSearch],
  );

  const selectedLead = useMemo(
    () => users.find((u) => String(u.id) === String(editing?.lead_user_id)),
    [users, editing?.lead_user_id],
  );

  const departmentName = (id) => departments.find((d) => String(d.id) === String(id))?.name || '—';

  const resetUserFilters = () => {
    setLeadPickerOpen(false);
    setLeadSearch('');
    setMemberSearch('');
  };

  const startCreate = () => {
    resetUserFilters();
    setEditing({
      ...EMPTY_FORM,
      department_id: departments[0]?.id ? String(departments[0].id) : '',
      sort_order: teams.length,
    });
  };

  const startEdit = (team) => {
    resetUserFilters();
    setEditing({
      id: team.id,
      name: team.name || '',
      department_id: team.department_id ? String(team.department_id) : '',
      lead_user_id: team.lead_user_id ? String(team.lead_user_id) : '',
      member_ids: (team.member_ids || []).map(String),
      sort_order: team.sort_order ?? 0,
    });
  };

  const selectLead = (value) => {
    setEditing((prev) => {
      if (!prev) return prev;
      const lead_user_id = value === 'none' ? '' : value;
      return {
        ...prev,
        lead_user_id,
        member_ids: lead_user_id && !prev.member_ids.includes(lead_user_id)
          ? [...prev.member_ids, lead_user_id]
          : prev.member_ids,
      };
    });
    setLeadPickerOpen(false);
    setLeadSearch('');
  };

  const toggleMember = (userId) => {
    setEditing((prev) => {
      if (!prev) return prev;
      const id = String(userId);
      const member_ids = prev.member_ids.includes(id)
        ? prev.member_ids.filter((x) => x !== id)
        : [...prev.member_ids, id];
      return { ...prev, member_ids };
    });
  };

  const handleSave = async () => {
    if (!editing) return;
    const name = editing.name.trim();
    if (!name || !editing.department_id) return;

    const memberIds = [...editing.member_ids];
    if (editing.lead_user_id && !memberIds.includes(editing.lead_user_id)) {
      memberIds.push(editing.lead_user_id);
    }

    await onSave({
      id: editing.id,
      name,
      department_id: Number(editing.department_id),
      lead_user_id: editing.lead_user_id ? Number(editing.lead_user_id) : null,
      member_ids: memberIds.map(Number),
      sort_order: Number(editing.sort_order) || 0,
      is_active: true,
    });
    resetUserFilters();
    setEditing(null);
  };

  const handleOpenChange = (next) => {
    if (!next) {
      setSearch('');
      resetUserFilters();
      setEditing(null);
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-2xl max-h-[90vh] p-0 gap-0 overflow-hidden flex flex-col rounded-xl sm:rounded-2xl">
        <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 pr-12 shrink-0 border-b border-border/70 text-left">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Users className="w-5 h-5" />
            </span>
            <div className="min-w-0 space-y-1">
              <DialogTitle>{editing ? (editing.id ? 'Edit team' : 'New team') : 'Teams'}</DialogTitle>
              <DialogDescription>
                {editing
                  ? 'Set the department, lead, and members for this team.'
                  : 'Teams sit inside a department and can have an optional lead.'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading teams…
          </div>
        ) : editing ? (
          <div className="space-y-4 overflow-y-auto px-4 sm:px-6 py-4 flex-1 min-h-0">
            <div className="space-y-2">
              <Label>Team name</Label>
              <Input
                value={editing.name}
                onChange={(e) => setEditing((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Returns Squad"
              />
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Select
                value={editing.department_id || undefined}
                onValueChange={(v) => setEditing((p) => ({ ...p, department_id: v }))}
                disabled={!!editing.id && !canCreate}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {editing.id && !canCreate && (
                <p className="text-[10px] text-muted-foreground">Team leads cannot move a team to another department.</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Team lead</Label>
              <Popover
                open={leadPickerOpen}
                onOpenChange={(next) => {
                  setLeadPickerOpen(next);
                  if (!next) setLeadSearch('');
                }}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={leadPickerOpen}
                    className="w-full justify-between font-normal h-9"
                  >
                    <span className={cn('truncate', !selectedLead && 'text-muted-foreground')}>
                      {selectedLead
                        ? (selectedLead.full_name || selectedLead.email)
                        : 'Select lead'}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[var(--radix-popover-trigger-width)] p-2 z-[100]"
                  align="start"
                  onOpenAutoFocus={(e) => e.preventDefault()}
                >
                  <div className="relative mb-2">
                    <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={leadSearch}
                      onChange={(e) => setLeadSearch(e.target.value)}
                      placeholder="Search users…"
                      className="h-9 pl-8"
                    />
                  </div>
                  <div
                    className="max-h-56 overflow-y-auto overscroll-contain space-y-0.5"
                    onWheel={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      className={cn(
                        'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-left hover:bg-muted',
                        !editing.lead_user_id && 'bg-muted',
                      )}
                      onClick={() => selectLead('none')}
                    >
                      <Check className={cn('h-4 w-4 shrink-0', editing.lead_user_id ? 'opacity-0' : 'opacity-100')} />
                      <span>No lead</span>
                    </button>
                    {filteredLeadUsers.length === 0 ? (
                      <p className="py-4 text-center text-sm text-muted-foreground">No users found.</p>
                    ) : (
                      filteredLeadUsers.map((u) => {
                        const id = String(u.id);
                        const selected = editing.lead_user_id === id;
                        return (
                          <button
                            key={u.id}
                            type="button"
                            className={cn(
                              'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-left hover:bg-muted',
                              selected && 'bg-muted',
                            )}
                            onClick={() => selectLead(id)}
                          >
                            <Check className={cn('h-4 w-4 shrink-0', selected ? 'opacity-100' : 'opacity-0')} />
                            <span className="truncate">{u.full_name || u.email}</span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Members</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder="Search members…"
                  className="pl-8 h-9"
                />
              </div>
              <div className="max-h-48 overflow-y-auto rounded-xl border p-2 space-y-1">
                {filteredMemberUsers.map((u) => (
                  <label key={u.id} className="flex items-center gap-2 text-sm cursor-pointer rounded-lg px-2 py-1.5 hover:bg-muted/50">
                    <Checkbox
                      checked={editing.member_ids.includes(String(u.id))}
                      onCheckedChange={() => toggleMember(u.id)}
                    />
                    <span className="truncate">{u.full_name || u.email}</span>
                  </label>
                ))}
                {users.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">No users available.</p>
                ) : filteredMemberUsers.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">No members found.</p>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3 overflow-y-auto flex-1 min-h-0 px-4 sm:px-6 py-4">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search teams…"
                  className="pl-8 h-9"
                />
              </div>
              {canCreate && (
                <Button size="sm" onClick={startCreate} className="gap-1.5 shrink-0 h-9">
                  <Plus className="w-4 h-4" /> Add
                </Button>
              )}
            </div>
            {visibleTeams.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-12">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground mb-3">
                  <Users className="w-5 h-5" />
                </span>
                <p className="text-sm font-medium">No teams yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {canCreate ? 'Create a team to group agents inside a department.' : 'No teams match this search.'}
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {visibleTeams.map((team) => (
                  <li
                    key={team.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-border bg-card p-3 shadow-sm hover:border-primary/30 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{team.name}</p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {team.department || departmentName(team.department_id)}
                        {team.lead?.full_name ? ` · Lead: ${team.lead.full_name}` : ''}
                        {(team.member_ids?.length || team.members?.length)
                          ? ` · ${(team.member_ids || team.members || []).length} members`
                          : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="sm" variant="ghost" className="h-8" onClick={() => startEdit(team)}>Edit</Button>
                      {canCreate && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => onDeactivate?.(team)}
                          aria-label={`Deactivate ${team.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <DialogFooter className="px-4 sm:px-6 py-4 shrink-0 border-t border-border/70 bg-background flex-row justify-end gap-2">
          {editing ? (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  resetUserFilters();
                  setEditing(null);
                }}
                disabled={saving}
              >
                Back
              </Button>
              <Button onClick={handleSave} disabled={saving || !editing.name.trim() || !editing.department_id}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save team'}
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => handleOpenChange(false)}>Close</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
