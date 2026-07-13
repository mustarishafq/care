import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { db } from '@/api/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AuthLayout from '@/components/layout/AuthLayout';
import { Loader2, Mail, Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { toastApiError } from '@/lib/toastApi';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get('token') || '';
  const [form, setForm] = useState({
    email: searchParams.get('email') || '',
    token: tokenFromUrl,
    password: '',
    password_confirmation: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await db.auth.resetPassword(form);
      toast.success(result.message || 'Password reset successfully');
      navigate('/login');
    } catch (err) {
      toastApiError(err, 'Password reset failed');
    } finally {
      setLoading(false);
    }
  };

  const update = (field) => (e) => setForm((p) => ({ ...p, [field]: e.target.value }));

  return (
    <AuthLayout
      title="Set a new password"
      description="Choose a strong password for your account"
      footer={
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-primary hover:underline font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={update('email')}
              className="pl-10 h-11"
              autoComplete="email"
              required
            />
          </div>
        </div>

        {!tokenFromUrl && (
          <div className="space-y-2">
            <Label htmlFor="token">Reset Token</Label>
            <Input
              id="token"
              value={form.token}
              onChange={update('token')}
              placeholder="Paste the token from your email"
              className="h-11 font-mono text-sm"
              required
            />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="password">New Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={update('password')}
              className="pl-10 pr-10 h-11"
              autoComplete="new-password"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="password_confirmation">Confirm Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="password_confirmation"
              type={showPassword ? 'text' : 'password'}
              value={form.password_confirmation}
              onChange={update('password_confirmation')}
              className="pl-10 h-11"
              autoComplete="new-password"
              required
            />
          </div>
        </div>

        <Button type="submit" className="w-full h-11" disabled={loading}>
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          Reset Password
        </Button>
      </form>
    </AuthLayout>
  );
}
