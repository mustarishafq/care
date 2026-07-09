import { db } from '@/api/db';

import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useCurrentUser } from '@/lib/useCurrentUser';
import { useDepartments } from '@/lib/useDepartments';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  UserPlus, Loader2, Pencil, KeyRound, Mail, Search, Users as UsersIcon,
  UserCheck, UserX, Shield, MoreHorizontal, AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import RoleSelectOptions from '@/components/users/RoleSelectOptions';
import PageHeader from '@/components/layout/PageHeader';
import PageContent from '@/components/layout/PageContent';
import { getRoleLabel } from '@/lib/roles';
import { usePermissions } from '@/lib/usePermissions';
import StatCard from '@/components/dashboard/StatCard';

const EMPTY_FILTERS = { search: '', role: '', status: '', department: '', approval: '' };

function userInitials(user) {
  return user.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '??';
}

export default function Users() {
  const { user: currentUser } = useCurrentUser();
  const { hasPermission, loading: permLoading } = usePermissions();
  const canInvite = hasPermission('users.invite');
  const canManage = hasPermission('users.manage');
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editUserOpen, setEditUserOpen] = useState(false);
  const [editUserTarget, setEditUserTarget] = useState(null);
  const [editUserForm, setEditUserForm] = useState({ full_name: '', phone: '', status: 'active', department_ids: [], role_id: '' });
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRoleId, setInviteRoleId] = useState('');
  const [addForm, setAddForm] = useState({ email: '', full_name: '', password: '', role_id: '', department_ids: [] });
  const [inviting, setInviting] = useState(false);
  const [adding, setAdding] = useState(false);
  const [savingUser, setSavingUser] = useState(false);
  const [actionUserId, setActionUserId] = useState(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => db.entities.User.list(),
  });

  const { data: departments = [] } = useDepartments();

  const { data: roles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: () => db.entities.Role.list('sort_order'),
  });

  const defaultRoleId = roles.find(r => r.slug === 'viewer')?.id || roles[0]?.id || '';

  const stats = useMemo(() => ({
    total: users.length,
    active: users.filter(u => u.status !== 'inactive' && u.approval_status !== 'pending').length,
    inactive: users.filter(u => u.status === 'inactive').length,
    pending: users.filter(u => u.approval_status === 'pending').length,
  }), [users]);

  const filteredUsers = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return users.filter(u => {
      if (filters.role && String(u.role_id) !== filters.role) return false;
      if (filters.status && u.status !== filters.status) return false;
      if (filters.approval && u.approval_status !== filters.approval) return false;
      if (filters.department) {
        const deptIds = (u.departments || []).map(d => String(d.id));
        if (!deptIds.includes(filters.department)) return false;
      }
      if (search) {
        const haystack = `${u.full_name || ''} ${u.email || ''} ${u.phone || ''}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });
  }, [users, filters]);

  const hasActiveFilters = Object.values(filters).some(Boolean);

  const openEditUser = (u) => {
    setEditUserTarget(u);
    setEditUserForm({
      full_name: u.full_name || '',
      phone: u.phone || '',
      role_id: u.role_id || defaultRoleId,
      status: u.status || 'active',
      department_ids: u.department_ids || u.departments?.map((d) => d.id) || [],
    });
    setEditUserOpen(true);
  };

  const toggleDept = (deptId) => {
    setEditUserForm(p => ({
      ...p,
      department_ids: p.department_ids.includes(deptId)
        ? p.department_ids.filter(id => id !== deptId)
        : [...p.department_ids, deptId],
    }));
  };

  const toggleAddDept = (deptId) => {
    setAddForm(p => ({
      ...p,
      department_ids: p.department_ids.includes(deptId)
        ? p.department_ids.filter(id => id !== deptId)
        : [...p.department_ids, deptId],
    }));
  };

  const openAddUser = () => {
    setAddForm({ email: '', full_name: '', password: '', role_id: defaultRoleId, department_ids: [] });
    setAddOpen(true);
  };

  const invalidateUsers = () => queryClient.invalidateQueries({ queryKey: ['users'] });

  const saveEditUser = async () => {
    setSavingUser(true);
    try {
      await db.entities.User.update(editUserTarget.id, {
        full_name: editUserForm.full_name,
        phone: editUserForm.phone,
        role_id: editUserForm.role_id,
        status: editUserForm.status,
        department_ids: editUserForm.department_ids,
      });
      invalidateUsers();
      toast.success('User updated');
      setEditUserOpen(false);
    } catch (err) {
      toast.error(err.message || 'Failed to update user');
    } finally {
      setSavingUser(false);
    }
  };

  const forcePasswordReset = async (u) => {
    setActionUserId(u.id);
    try {
      await db.entities.User.update(u.id, { must_change_password: true });
      invalidateUsers();
      toast.success(`Password reset flagged for ${u.full_name || u.email}`);
    } catch (err) {
      toast.error(err.message || 'Failed to flag password reset');
    } finally {
      setActionUserId(null);
    }
  };

  const handleApprove = async (u) => {
    setActionUserId(u.id);
    try {
      await db.users.approve(u.id);
      invalidateUsers();
      toast.success(`${u.full_name || u.email} approved`);
    } catch (err) {
      toast.error(err.message || 'Failed to approve user');
    } finally {
      setActionUserId(null);
    }
  };

  const handleReject = async (u) => {
    setActionUserId(u.id);
    try {
      await db.users.reject(u.id);
      invalidateUsers();
      toast.success(`${u.full_name || u.email} rejected`);
    } catch (err) {
      toast.error(err.message || 'Failed to reject user');
    } finally {
      setActionUserId(null);
    }
  };

  const handleStatusToggle = async (u, active) => {
    if (u.id === currentUser?.id) {
      toast.error('You cannot change your own status');
      return;
    }
    setActionUserId(u.id);
    try {
      await db.entities.User.update(u.id, { status: active ? 'active' : 'inactive' });
      invalidateUsers();
      toast.success(`${u.full_name || u.email} ${active ? 'activated' : 'deactivated'}`);
    } catch (err) {
      toast.error(err.message || 'Failed to update status');
    } finally {
      setActionUserId(null);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      await db.users.inviteUser(inviteEmail.trim(), inviteRoleId || defaultRoleId);
      invalidateUsers();
      toast.success(`Invitation sent to ${inviteEmail}`);
      setInviteEmail('');
      setInviteOpen(false);
    } catch (err) {
      toast.error(err.message || 'Failed to send invitation');
    } finally {
      setInviting(false);
    }
  };

  const handleAddUser = async () => {
    if (!addForm.email.trim() || !addForm.password.trim()) {
      toast.error('Email and password are required');
      return;
    }
    if (addForm.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setAdding(true);
    try {
      await db.users.createUser({
        email: addForm.email.trim(),
        full_name: addForm.full_name.trim() || undefined,
        password: addForm.password,
        role_id: addForm.role_id || defaultRoleId,
        department_ids: addForm.department_ids,
      });
      invalidateUsers();
      toast.success(`User ${addForm.email} created`);
      setAddOpen(false);
    } catch (err) {
      toast.error(err.message || 'Failed to create user');
    } finally {
      setAdding(false);
    }
  };

  if (isLoading || permLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={UsersIcon}
        title="User Management"
        description={
          hasActiveFilters
            ? `${filteredUsers.length} of ${users.length} users`
            : `${users.length} users`
        }
        actions={(canManage || canInvite) ? (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            {canManage && (
              <Button variant="outline" onClick={openAddUser} className="gap-2 h-10 sm:h-9">
                <UserPlus className="w-4 h-4" />Add User
              </Button>
            )}
            {canInvite && (
              <Button onClick={() => setInviteOpen(true)} className="gap-2 h-10 sm:h-9 shadow-md shadow-primary/20 hover:shadow-primary/30">
                <Mail className="w-4 h-4" />Invite User
              </Button>
            )}
          </div>
        ) : null}
      />

      <PageContent>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Users" value={stats.total} icon={UsersIcon} color="primary" index={0} />
        <StatCard label="Active" value={stats.active} icon={UserCheck} color="success" index={1} />
        <StatCard label="Inactive" value={stats.inactive} icon={UserX} color="danger" index={2} />
        <StatCard label="Pending Approval" value={stats.pending} icon={Shield} color="warning" index={3} />
      </div>

      {stats.pending > 0 && canManage && (
        <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800 dark:text-amber-300">
            {stats.pending} user{stats.pending !== 1 ? 's' : ''} awaiting approval
          </AlertTitle>
          <AlertDescription className="text-amber-700 dark:text-amber-400">
            Review and approve or reject pending registrations below.
            <Button
              variant="link"
              className="h-auto p-0 ml-1 text-amber-800 dark:text-amber-300"
              onClick={() => setFilters(p => ({ ...p, approval: 'pending' }))}
            >
              Show pending only
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name, email, or phone..."
            value={filters.search}
            onChange={e => setFilters(p => ({ ...p, search: e.target.value }))}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={filters.role || 'all'} onValueChange={v => setFilters(p => ({ ...p, role: v === 'all' ? '' : v }))}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Role" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              {roles.map(r => (
                <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filters.status || 'all'} onValueChange={v => setFilters(p => ({ ...p, status: v === 'all' ? '' : v }))}>
            <SelectTrigger className="w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filters.approval || 'all'} onValueChange={v => setFilters(p => ({ ...p, approval: v === 'all' ? '' : v }))}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Approval" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All approvals</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filters.department || 'all'} onValueChange={v => setFilters(p => ({ ...p, department: v === 'all' ? '' : v }))}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Department" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {departments.map(d => (
                <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={() => setFilters(EMPTY_FILTERS)}>
              Clear filters
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold text-xs uppercase tracking-wider">User</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider">Email</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider">Role</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider">Departments</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider">Status</TableHead>
                {canManage && <TableHead className="font-semibold text-xs uppercase tracking-wider w-28">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map(u => {
                const userDepts = u.departments || [];
                const isSelf = u.id === currentUser?.id;
                const isPending = u.approval_status === 'pending';
                const isBusy = actionUserId === u.id;
                return (
                  <TableRow key={u.id} className={isPending ? 'bg-amber-50/50 dark:bg-amber-900/10' : undefined}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="text-[10px] font-bold">{userInitials(u)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm">{u.full_name || 'Unnamed'}</p>
                          {u.phone && <p className="text-xs text-muted-foreground">{u.phone}</p>}
                          {isSelf && <Badge variant="outline" className="text-[10px] mt-0.5">You</Badge>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {getRoleLabel(u.role_id, roles, u.role_label)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {userDepts.length > 0
                          ? userDepts.map(d => <Badge key={d.id} variant="outline" className="text-[10px]">{d.name}</Badge>)
                          : <span className="text-sm text-muted-foreground">—</span>
                        }
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          {canManage && !isSelf && !isPending ? (
                            <Switch
                              checked={u.status !== 'inactive'}
                              onCheckedChange={v => handleStatusToggle(u, v)}
                              disabled={isBusy}
                            />
                          ) : (
                            <Badge className={`text-xs border-0 w-fit ${u.status === 'inactive' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'}`}>
                              {u.status || 'active'}
                            </Badge>
                          )}
                        </div>
                        {isPending && (
                          <Badge variant="outline" className="text-xs w-fit border-amber-300 text-amber-700 dark:text-amber-400">Pending approval</Badge>
                        )}
                        {u.must_change_password && (
                          <Badge variant="outline" className="text-[10px] w-fit">Reset required</Badge>
                        )}
                      </div>
                    </TableCell>
                    {canManage && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {isPending && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                disabled={isBusy}
                                onClick={() => handleApprove(u)}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs text-destructive"
                                disabled={isBusy}
                                onClick={() => handleReject(u)}
                              >
                                Reject
                              </Button>
                            </>
                          )}
                          <Button size="icon" variant="ghost" className="h-7 w-7" title="Edit user" onClick={() => openEditUser(u)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-7 w-7" disabled={isBusy}>
                                <MoreHorizontal className="w-3.5 h-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditUser(u)}>
                                <Pencil className="w-4 h-4 mr-2" />Edit user
                              </DropdownMenuItem>
                              {isPending && (
                                <>
                                  <DropdownMenuItem onClick={() => handleApprove(u)}>
                                    <UserCheck className="w-4 h-4 mr-2" />Approve
                                  </DropdownMenuItem>
                                  <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleReject(u)}>
                                    <UserX className="w-4 h-4 mr-2" />Reject
                                  </DropdownMenuItem>
                                </>
                              )}
                              {!isSelf && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => forcePasswordReset(u)}>
                                    <KeyRound className="w-4 h-4 mr-2" />Force password reset
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
              {filteredUsers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={canManage ? 6 : 5} className="text-center py-12 text-muted-foreground">
                    <UsersIcon className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    {hasActiveFilters ? 'No users match your filters' : 'No users yet'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      </PageContent>

      <Dialog open={editUserOpen} onOpenChange={setEditUserOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Edit User</DialogTitle>
            <p className="text-sm text-muted-foreground">{editUserTarget?.email}</p>
          </DialogHeader>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
            <div className="space-y-1.5">
              <Label className="text-xs">Full Name</Label>
              <Input value={editUserForm.full_name} onChange={e => setEditUserForm(p => ({ ...p, full_name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Phone</Label>
              <Input value={editUserForm.phone} onChange={e => setEditUserForm(p => ({ ...p, phone: e.target.value }))} placeholder="+62..." />
            </div>
            {canManage && editUserTarget?.id !== currentUser?.id && (
              <div className="space-y-1.5">
                <Label className="text-xs">Role</Label>
                <Select value={String(editUserForm.role_id || defaultRoleId)} onValueChange={v => setEditUserForm(p => ({ ...p, role_id: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <RoleSelectOptions roles={roles} />
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={editUserForm.status} onValueChange={v => setEditUserForm(p => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Departments</Label>
              <div className="space-y-1">
                {departments.map(dept => (
                  <label key={dept.id} className="flex items-center gap-3 cursor-pointer p-1.5 rounded hover:bg-muted/50">
                    <Checkbox
                      checked={editUserForm.department_ids.includes(dept.id)}
                      onCheckedChange={() => toggleDept(dept.id)}
                    />
                    <span className="text-sm">{dept.name}</span>
                  </label>
                ))}
              </div>
            </div>
            {editUserTarget?.id !== currentUser?.id && (
              <div className="border rounded-lg p-3 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
                <p className="text-xs font-medium text-amber-800 dark:text-amber-300 mb-1">Force Password Reset</p>
                <p className="text-[10px] text-amber-700 dark:text-amber-400 mb-2">User will be prompted to change their password on next login.</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-amber-700 border-amber-300 h-7 text-xs"
                  onClick={() => { forcePasswordReset(editUserTarget); setEditUserOpen(false); }}
                >
                  <KeyRound className="w-3 h-3 mr-1" />Flag Reset
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUserOpen(false)}>Cancel</Button>
            <Button onClick={saveEditUser} disabled={savingUser}>
              {savingUser && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add User</DialogTitle>
            <p className="text-sm text-muted-foreground">Create an account immediately without sending an invitation email.</p>
          </DialogHeader>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input value={addForm.email} onChange={e => setAddForm(p => ({ ...p, email: e.target.value }))} placeholder="test@example.com" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Full Name</Label>
              <Input value={addForm.full_name} onChange={e => setAddForm(p => ({ ...p, full_name: e.target.value }))} placeholder="Optional — defaults to email" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Password</Label>
              <Input type="password" value={addForm.password} onChange={e => setAddForm(p => ({ ...p, password: e.target.value }))} placeholder="Min. 8 characters" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Role</Label>
              <Select value={String(addForm.role_id || defaultRoleId)} onValueChange={v => setAddForm(p => ({ ...p, role_id: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <RoleSelectOptions roles={roles} />
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Departments</Label>
              <div className="space-y-1">
                {departments.map(dept => (
                  <label key={dept.id} className="flex items-center gap-3 cursor-pointer p-1.5 rounded hover:bg-muted/50">
                    <Checkbox
                      checked={addForm.department_ids.includes(dept.id)}
                      onCheckedChange={() => toggleAddDept(dept.id)}
                    />
                    <span className="text-sm">{dept.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAddUser} disabled={adding}>
              {adding && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Create User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Invite User</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="user@company.com" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Role</Label>
              <Select value={String(inviteRoleId || defaultRoleId)} onValueChange={setInviteRoleId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <RoleSelectOptions roles={roles} />
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Departments (assign after user joins)</Label>
              <p className="text-[10px] text-muted-foreground">You can assign departments to this user once they accept the invitation.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button onClick={handleInvite} disabled={inviting}>
              {inviting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Send Invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
