import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { db } from '@/api/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import AuthLayout from '@/components/layout/AuthLayout';
import NexusBrainLoginButton from '@/components/auth/NexusBrainLoginButton';
import { Loader2, User, Mail, Phone, Lock, Eye, EyeOff, Info } from 'lucide-react';
import { toast } from 'sonner';
import { toastApiError } from '@/lib/toastApi';

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    password_confirmation: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await db.auth.register(form);
      toast.success(result.message || 'Registration successful');
      navigate('/login');
    } catch (err) {
      toastApiError(err, 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const update = (field) => (e) => setForm((p) => ({ ...p, [field]: e.target.value }));

  return (
    <AuthLayout
      title="Create your account"
      description="Join EMZI Nexus Care to manage customer complaints"
      footer={
        <p>
          Already have an account?{' '}
          <Link to="/login" className="text-primary hover:underline font-medium">
            Sign in
          </Link>
        </p>
      }
    >
      <div className="space-y-6">
        <NexusBrainLoginButton />

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <Separator />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-3 text-muted-foreground">or register with email</span>
          </div>
        </div>

        <div className="flex items-start gap-2.5 rounded-lg bg-primary/5 border border-primary/15 px-3.5 py-3 text-sm">
          <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <p className="text-muted-foreground">
            New accounts require admin approval before you can sign in.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="full_name">Full Name</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="full_name"
                value={form.full_name}
                onChange={update('full_name')}
                placeholder="John Doe"
                className="pl-10 h-11"
                autoComplete="name"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={update('email')}
                placeholder="you@company.com"
                className="pl-10 h-11"
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="phone"
                type="tel"
                value={form.phone}
                onChange={update('phone')}
                placeholder="+60 12 345 6789"
                className="pl-10 h-11"
                autoComplete="tel"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
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
            Create Account
          </Button>
        </form>
      </div>
    </AuthLayout>
  );
}
