import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { db } from '@/api/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AuthLayout from '@/components/layout/AuthLayout';
import { Loader2, Mail, CheckCircle2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { toastApiError } from '@/lib/toastApi';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await db.auth.forgotPassword(email);
      toast.success(result.message || 'Reset link sent');
      setSent(true);
    } catch (err) {
      toastApiError(err, 'Failed to send reset link');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title={sent ? 'Check your inbox' : 'Forgot password?'}
      description={
        sent
          ? `We've sent a password reset link to ${email}`
          : "Enter your email and we'll send you a link to reset your password"
      }
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
      {sent ? (
        <div className="text-center space-y-5 py-2">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500/10 rounded-full">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <p className="text-sm text-muted-foreground">
            {"Didn't receive the email? Check your spam folder or"}{' '}
            <button
              type="button"
              onClick={() => setSent(false)}
              className="text-primary hover:underline font-medium"
            >
              try again
            </button>
            .
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="pl-10 h-11"
                autoComplete="email"
                required
              />
            </div>
          </div>

          <Button type="submit" className="w-full h-11" disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Send Reset Link
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
