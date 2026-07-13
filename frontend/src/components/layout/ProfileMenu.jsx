import { db } from '@/api/db';

import React, { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { LogOut, User, Loader2, Eye, EyeOff, KeyRound } from 'lucide-react';

import { toast } from 'sonner';
import { toastApiError } from '@/lib/toastApi';

export default function ProfileMenu({ user }) {
  const { logout } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [form, setForm] = useState({ full_name: '', phone: '' });
  const [passwordForm, setPasswordForm] = useState({ current: '', password: '', confirm: '' });
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [saving, setSaving] = useState(false);

  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '??';

  const resetPasswordForm = () => {
    setPasswordForm({ current: '', password: '', confirm: '' });
    setShowPasswordSection(false);
    setShowCurrentPass(false);
    setShowNewPass(false);
  };

  const openProfile = () => {
    setForm({ full_name: user?.full_name || '', phone: user?.phone || '' });
    resetPasswordForm();
    setProfileOpen(true);
  };

  const changingPassword = showPasswordSection && (
    passwordForm.current || passwordForm.password || passwordForm.confirm
  );

  const handleSave = async () => {
    if (!form.full_name.trim()) { toast.error('Name is required'); return; }

    if (changingPassword) {
      if (!passwordForm.current) { toast.error('Current password is required'); return; }
      if (passwordForm.password.length < 8) { toast.error('New password must be at least 8 characters'); return; }
      if (passwordForm.password !== passwordForm.confirm) { toast.error('New passwords do not match'); return; }
    }

    setSaving(true);
    try {
      const payload = { full_name: form.full_name, phone: form.phone };
      if (changingPassword) {
        payload.current_password = passwordForm.current;
        payload.password = passwordForm.password;
        payload.password_confirmation = passwordForm.confirm;
      }
      await db.auth.updateMe(payload);
      toast.success(changingPassword ? 'Profile and password updated' : 'Profile updated');
      setProfileOpen(false);
      window.location.reload();
    } catch (err) {
      toastApiError(
        err.data?.errors?.current_password?.[0] || err,
        'Failed to update profile',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-muted transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-ring">
            <span className="text-sm font-medium leading-none text-foreground truncate max-w-[160px] hidden md:inline">
              {user?.full_name || 'Loading...'}
            </span>
            <Avatar className="h-8 w-8 rounded-lg shrink-0">
              <AvatarFallback className="rounded-lg bg-primary/10 text-sm font-semibold text-primary">{initials}</AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <div className="px-3 py-2 border-b border-border mb-1">
            <p className="text-sm font-semibold truncate">{user?.full_name}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
          <DropdownMenuItem onClick={openProfile}>
            <User className="w-4 h-4 mr-2" />Profile
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => logout()}>
            <LogOut className="w-4 h-4 mr-2" />Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={profileOpen} onOpenChange={(open) => { setProfileOpen(open); if (!open) resetPasswordForm(); }}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Profile</DialogTitle></DialogHeader>
          <div className="flex justify-center mb-2">
            <Avatar className="w-16 h-16 bg-primary/10 border-2 border-primary/20">
              <AvatarFallback className="text-xl font-bold text-primary bg-transparent">{initials}</AvatarFallback>
            </Avatar>
          </div>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Full Name</Label>
              <Input value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} placeholder="Your name" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Phone</Label>
              <Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+62..." />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input value={user?.email || ''} disabled className="bg-muted" />
              <p className="text-[10px] text-muted-foreground">Email cannot be changed</p>
            </div>

            <div className="pt-2 border-t border-border">
              {!showPasswordSection ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setShowPasswordSection(true)}
                >
                  <KeyRound className="w-4 h-4 mr-2" />Change Password
                </Button>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">Change Password</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground"
                      onClick={resetPasswordForm}
                    >
                      Cancel
                    </Button>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Current Password</Label>
                    <div className="relative">
                      <Input
                        type={showCurrentPass ? 'text' : 'password'}
                        value={passwordForm.current}
                        onChange={e => setPasswordForm(p => ({ ...p, current: e.target.value }))}
                        placeholder="Enter current password"
                        className="pr-10"
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                        onClick={() => setShowCurrentPass(!showCurrentPass)}
                      >
                        {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">New Password</Label>
                    <div className="relative">
                      <Input
                        type={showNewPass ? 'text' : 'password'}
                        value={passwordForm.password}
                        onChange={e => setPasswordForm(p => ({ ...p, password: e.target.value }))}
                        placeholder="Minimum 8 characters"
                        className="pr-10"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                        onClick={() => setShowNewPass(!showNewPass)}
                      >
                        {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Confirm New Password</Label>
                    <Input
                      type="password"
                      value={passwordForm.confirm}
                      onChange={e => setPasswordForm(p => ({ ...p, confirm: e.target.value }))}
                      placeholder="Repeat new password"
                      autoComplete="new-password"
                    />
                  </div>
                  {passwordForm.password && passwordForm.confirm && passwordForm.password !== passwordForm.confirm && (
                    <p className="text-xs text-destructive">Passwords do not match</p>
                  )}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProfileOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}