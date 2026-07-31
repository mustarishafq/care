import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Search, Users, X } from 'lucide-react';

const EMPTY_FORM = {
  id: null,
  name: '',
  department_id: '',
  lead_user_id: '',
  member_ids: [],
  sort_order: 0,
};

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

  const normalizedSearch = search.trim().toLowerCase();

  const visibleTeams = useMemo(() => {
    if (!normalizedSearch) return teams;
    return teams.filter((t) => {
      const hay = `${t.name || ''} ${t.department || ''}`.toLowerCase();
      return hay.includes(normalizedSearch);
    });
  }, [teams, normalizedSearch]);

  const departmentName = (id) => departments.find((d) => String(d.id) === String(id))?.name || '—';

  const startCreate = () => {
    setEditing({
      ...EMPTY_FORM,
      department_id: departments[0]?.id ? String(departments[0].id) : '',
      sort_order: teams.length,
    });
  };

  const startEdit = (team) => {
    setEditing({
      id: team.id,
      name: team.name || '',
      department_id: team.department_id ? String(team.department_id) : '',
      lead_user_id: team.lead_user_id ? String(team.lead_user_id) : '',
      member_ids: (team.member_ids || []).map(String),
      sort_order: team.sort_order ?? 0,
    });
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
    setEditing(null);
  };

  const handleOpenChange = (next) => {
    if (!next) {
      setSearch('');
      setEditing(null);
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Teams
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading teams…
          </div>
        ) : editing ? (
          <div className="space-y-4 overflow-y-auto pr-1 flex-1 min-h-0">
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
              <Select
                value={editing.lead_user_id || 'none'}
                onValueChange={(v) => setEditing((p) => ({
                  ...p,
                  lead_user_id: v === 'none' ? '' : v,
                  member_ids: v !== 'none' && !p.member_ids.includes(v)
                    ? [...p.member_ids, v]
                    : p.member_ids,
                }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select lead" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No lead</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.full_name || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Members</Label>
              <div className="max-h-48 overflow-y-auto rounded-md border p-2 space-y-1.5">
                {users.map((u) => (
                  <label key={u.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={editing.member_ids.includes(String(u.id))}
                      onCheckedChange={() => toggleMember(u.id)}
                    />
                    <span className="truncate">{u.full_name || u.email}</span>
                  </label>
                ))}
                {users.length === 0 && (
                  <p className="text-xs text-muted-foreground py-2">No users available.</p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3 overflow-y-auto flex-1 min-h-0">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search teams…"
                  className="pl-8 h-9"
                />
              </div>
              {canCreate && (
                <Button size="sm" onClick={startCreate} className="gap-1.5 shrink-0">
                  <Plus className="w-3.5 h-3.5" /> Add
                </Button>
              )}
            </div>
            {visibleTeams.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No teams yet.</p>
            ) : (
              <ul className="space-y-2">
                {visibleTeams.map((team) => (
                  <li
                    key={team.id}
                    className="flex items-start justify-between gap-3 rounded-lg border p-3 hover:bg-muted/40"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{team.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {team.department || departmentName(team.department_id)}
                        {team.lead?.full_name ? ` · Lead: ${team.lead.full_name}` : ''}
                        {(team.member_ids?.length || team.members?.length)
                          ? ` · ${(team.member_ids || team.members || []).length} members`
                          : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="sm" variant="ghost" onClick={() => startEdit(team)}>Edit</Button>
                      {canCreate && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive"
                          onClick={() => onDeactivate?.(team)}
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {editing ? (
            <>
              <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>Back</Button>
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
