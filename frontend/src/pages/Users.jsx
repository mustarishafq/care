import { db } from '@/api/db';

import React, { useState } from 'react';
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
import { UserPlus, Loader2, Pencil, KeyRound, Mail } from 'lucide-react';
import { toast } from 'sonner';
import RoleSelectOptions from '@/components/users/RoleSelectOptions';
import { getRoleLabel } from '@/lib/roles';
import { usePermissions } from '@/lib/usePermissions';

export default function Users() {
  const { user: currentUser, isAdmin } = useCurrentUser();
  const { hasPermission, loading: permLoading } = usePermissions();
  const canInvite = hasPermission('users.invite');
  const canManage = hasPermission('users.manage');
  const queryClient = useQueryClient();
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

  const saveEditUser = async () => {
    setSavingUser(true);
    await db.entities.User.update(editUserTarget.id, {
      full_name: editUserForm.full_name,
      phone: editUserForm.phone,
      role_id: editUserForm.role_id,
      status: editUserForm.status,
      department_ids: editUserForm.department_ids,
    });
    queryClient.invalidateQueries({ queryKey: ['users'] });
    toast.success('User updated');
    setSavingUser(false);
    setEditUserOpen(false);
  };

  const forcePasswordReset = async (u) => {
    await db.entities.User.update(u.id, { must_change_password: true });
    queryClient.invalidateQueries({ queryKey: ['users'] });
    toast.success(`Password reset flagged for ${u.full_name}`);
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      await db.users.inviteUser(inviteEmail.trim(), inviteRoleId || defaultRoleId);
      queryClient.invalidateQueries({ queryKey: ['users'] });
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
      queryClient.invalidateQueries({ queryKey: ['users'] });
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
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground text-sm mt-1">{users.length} users</p>
        </div>
        {(canManage || canInvite) && (
          <div className="flex items-center gap-2">
            {canManage && (
              <Button variant="outline" onClick={openAddUser}>
                <UserPlus className="w-4 h-4 mr-2" />Add User
              </Button>
            )}
            {canInvite && (
              <Button onClick={() => setInviteOpen(true)}>
                <Mail className="w-4 h-4 mr-2" />Invite User
              </Button>
            )}
          </div>
        )}
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
                {canManage && <TableHead className="font-semibold text-xs uppercase tracking-wider w-20">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map(u => {
                const initials = u.full_name ? u.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '??';
                const userDepts = u.departments || [];
                return (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="text-[10px] font-bold">{initials}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium text-sm">{u.full_name || 'Unnamed'}</span>
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
                      <div className="flex flex-col gap-1">
                        <Badge className={`text-xs border-0 w-fit ${u.status === 'inactive' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {u.status || 'active'}
                        </Badge>
                        {u.approval_status === 'pending' && (
                          <Badge variant="outline" className="text-xs w-fit">Pending approval</Badge>
                        )}
                      </div>
                    </TableCell>
                    {canManage && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {u.approval_status === 'pending' && (
                            <>
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={async () => {
                                await db.users.approve(u.id);
                                queryClient.invalidateQueries({ queryKey: ['users'] });
                                toast.success('User approved');
                              }}>Approve</Button>
                              <Button size="sm" variant="outline" className="h-7 text-xs text-destructive" onClick={async () => {
                                await db.users.reject(u.id);
                                queryClient.invalidateQueries({ queryKey: ['users'] });
                                toast.success('User rejected');
                              }}>Reject</Button>
                            </>
                          )}
                          <Button size="icon" variant="ghost" className="h-7 w-7" title="Edit user" onClick={() => openEditUser(u)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
            <div className="border rounded-lg p-3 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
              <p className="text-xs font-medium text-amber-800 dark:text-amber-300 mb-1">Force Password Reset</p>
              <p className="text-[10px] text-amber-700 dark:text-amber-400 mb-2">User will be prompted to change their password on next login.</p>
              <Button size="sm" variant="outline" className="text-amber-700 border-amber-300 h-7 text-xs" onClick={() => { forcePasswordReset(editUserTarget); setEditUserOpen(false); }}>
                <KeyRound className="w-3 h-3 mr-1" />Flag Reset
              </Button>
            </div>
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
