import { db } from '@/api/db';
import { http } from '@/api/http';

import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2, Shield, Loader2, ShieldCheck } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import PageContent from '@/components/layout/PageContent';
import { toast } from 'sonner';

/** Fallback catalog if /roles/meta is unavailable */
export const ALL_PERMISSIONS = [
  { key: 'complaints.view', label: 'View Complaints', group: 'Complaints' },
  { key: 'complaints.create', label: 'Create Complaints', group: 'Complaints' },
  { key: 'complaints.edit', label: 'Edit Complaints', group: 'Complaints' },
  { key: 'complaints.delete', label: 'Delete Complaints', group: 'Complaints' },
  { key: 'complaints.assign', label: 'Assign Department/User', group: 'Complaints' },
  { key: 'complaints.change_status', label: 'Change Status', group: 'Complaints' },
  { key: 'complaints.add_notes', label: 'Add Internal Notes', group: 'Complaints' },
  { key: 'reports.view', label: 'View Reports', group: 'Reports' },
  { key: 'reports.export', label: 'Export Reports', group: 'Reports' },
  { key: 'users.view', label: 'View Users', group: 'Users' },
  { key: 'users.invite', label: 'Invite Users', group: 'Users' },
  { key: 'users.manage', label: 'Manage Users & Roles', group: 'Users' },
  { key: 'products.view', label: 'View Products', group: 'Products' },
  { key: 'products.manage', label: 'Manage Products', group: 'Products' },
  { key: 'settings.view', label: 'View Settings', group: 'Settings' },
  { key: 'settings.manage', label: 'Manage Settings', group: 'Settings' },
  { key: 'oms.view', label: 'View Integrations', group: 'Integrations' },
  { key: 'oms.manage', label: 'Manage Integrations', group: 'Integrations' },
  { key: 'reviews.view', label: 'View Reviews', group: 'Reviews' },
  { key: 'reviews.manage', label: 'Manage Reviews', group: 'Reviews' },
  { key: 'marketplace.view', label: 'View Marketplace', group: 'Marketplace' },
  { key: 'marketplace.manage', label: 'Manage Marketplace', group: 'Marketplace' },
];

const FALLBACK_DEFAULT_PAGES = [
  { path: '/dashboard', label: 'Dashboard' },
  { path: '/complaints', label: 'Complaints' },
  { path: '/marketplace-reviews', label: 'Reviews' },
  { path: '/kanban', label: 'Kanban' },
  { path: '/reports', label: 'Reports' },
  { path: '/notifications', label: 'Notifications' },
  { path: '/products', label: 'Products' },
  { path: '/users', label: 'Users' },
  { path: '/roles', label: 'Roles' },
  { path: '/integrations', label: 'Integrations' },
  { path: '/marketplace', label: 'Marketplace' },
  { path: '/settings', label: 'Settings' },
];

const emptyRole = {
  name: '',
  description: '',
  permissions: [],
  default_page: '/dashboard',
  is_active: true,
};

export default function RolesPermissions() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [form, setForm] = useState(emptyRole);
  const [saving, setSaving] = useState(false);

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: () => db.entities.Role.list('-created_date'),
  });

  const { data: meta } = useQuery({
    queryKey: ['roles-meta'],
    queryFn: async () => {
      const data = await http.get('/roles/meta');
      return data;
    },
  });

  const permissionsCatalog = meta?.permissions?.length ? meta.permissions : ALL_PERMISSIONS;
  const defaultPages = meta?.default_pages?.length ? meta.default_pages : FALLBACK_DEFAULT_PAGES;
  const groups = useMemo(
    () => [...new Set(permissionsCatalog.map((p) => p.group))],
    [permissionsCatalog],
  );

  const pageLabel = (path) => defaultPages.find((p) => p.path === path)?.label || path;

  const openCreate = () => {
    setEditingRole(null);
    setForm(emptyRole);
    setDialogOpen(true);
  };

  const openEdit = (role) => {
    setEditingRole(role);
    setForm({
      name: role.name,
      description: role.description || '',
      permissions: role.permissions || [],
      default_page: role.default_page || '/dashboard',
      is_active: role.is_active !== false,
    });
    setDialogOpen(true);
  };

  const togglePermission = (key) => {
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(key)
        ? prev.permissions.filter((p) => p !== key)
        : [...prev.permissions, key],
    }));
  };

  const toggleGroup = (group) => {
    const groupKeys = permissionsCatalog.filter((p) => p.group === group).map((p) => p.key);
    const allChecked = groupKeys.every((k) => form.permissions.includes(k));
    setForm((prev) => ({
      ...prev,
      permissions: allChecked
        ? prev.permissions.filter((k) => !groupKeys.includes(k))
        : [...new Set([...prev.permissions, ...groupKeys])],
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Role name is required');
      return;
    }
    setSaving(true);
    try {
      if (editingRole) {
        await db.entities.Role.update(editingRole.id, form);
        toast.success('Role updated');
      } else {
        await db.entities.Role.create(form);
        toast.success('Role created');
      }
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      setDialogOpen(false);
    } catch (err) {
      toast.error(err.message || 'Failed to save role');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (roleId) => {
    await db.entities.Role.delete(roleId);
    queryClient.invalidateQueries({ queryKey: ['roles'] });
    toast.success('Role deleted');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ShieldCheck}
        title="Roles & Permissions"
        description="Manage roles, permissions, and default landing pages"
        actions={(
          <Button onClick={openCreate} className="gap-2 h-10 w-full sm:w-auto sm:h-9 shadow-md shadow-primary/20 hover:shadow-primary/30">
            <Plus className="w-4 h-4" />
            New Role
          </Button>
        )}
      />

      <PageContent>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {roles.map((role) => (
            <Card key={role.id} className="rounded-2xl">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-primary" />
                    <CardTitle className="text-sm">{role.name}</CardTitle>
                    {role.is_system && <Badge variant="outline" className="text-[10px]">System</Badge>}
                    {role.is_active === false && <Badge variant="secondary" className="text-[10px]">Inactive</Badge>}
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(role)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    {!role.is_system && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(role.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
                {role.description && <p className="text-xs text-muted-foreground mt-1">{role.description}</p>}
                <p className="text-[11px] text-muted-foreground mt-2">
                  Default page: {pageLabel(role.default_page || '/dashboard')}
                </p>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {(role.permissions || []).slice(0, 8).map((pKey) => {
                    const p = permissionsCatalog.find((x) => x.key === pKey);
                    return (
                      <Badge key={pKey} variant="outline" className="text-[10px] py-0">
                        {p?.label || pKey}
                      </Badge>
                    );
                  })}
                  {(role.permissions || []).length > 8 && (
                    <Badge variant="secondary" className="text-[10px] py-0">
                      +{role.permissions.length - 8} more
                    </Badge>
                  )}
                  {!(role.permissions?.length) && (
                    <span className="text-xs text-muted-foreground">
                      {role.is_admin ? 'Full access' : 'No permissions'}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {roles.length === 0 && (
            <div className="col-span-3 text-center py-16 text-muted-foreground">
              <Shield className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No custom roles yet. Create one to get started.</p>
            </div>
          )}
        </div>
      </PageContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRole ? 'Edit Role' : 'Create New Role'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Role Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Senior CS Agent"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Description</Label>
                <Input
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Brief description"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Default page</Label>
              <Select
                value={form.default_page || '/dashboard'}
                onValueChange={(v) => setForm((p) => ({ ...p, default_page: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select default page" />
                </SelectTrigger>
                <SelectContent>
                  {defaultPages.map((page) => (
                    <SelectItem key={page.path} value={page.path}>
                      {page.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Users with this role land here after login (unless a redirect URL is provided).
              </p>
            </div>

            <div>
              <Label className="text-xs font-medium mb-3 block">Permissions</Label>
              <div className="space-y-4">
                {groups.map((group) => {
                  const groupPerms = permissionsCatalog.filter((p) => p.group === group);
                  const allChecked = groupPerms.every((p) => form.permissions.includes(p.key));
                  const someChecked = groupPerms.some((p) => form.permissions.includes(p.key));
                  return (
                    <div key={group} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={allChecked}
                          onCheckedChange={() => toggleGroup(group)}
                          className={someChecked && !allChecked ? 'opacity-50' : ''}
                        />
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {group}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 ml-6">
                        {groupPerms.map((p) => (
                          <label key={p.key} className="flex items-center gap-2 cursor-pointer">
                            <Checkbox
                              checked={form.permissions.includes(p.key)}
                              onCheckedChange={() => togglePermission(p.key)}
                            />
                            <span className="text-xs">{p.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                checked={form.is_active}
                onCheckedChange={(v) => setForm((p) => ({ ...p, is_active: v }))}
              />
              <Label className="text-xs">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingRole ? 'Save Changes' : 'Create Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
