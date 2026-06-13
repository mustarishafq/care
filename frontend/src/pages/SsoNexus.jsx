import { http, setToken } from '@/api/http';

import React, { useEffect, useState } from 'react';

import { Loader2, ShieldCheck, ShieldX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { rememberSsoRedirect, resolveSsoRedirect } from '@/lib/ssoRedirect';

export default function SsoNexus() {
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [userInfo, setUserInfo] = useState(null);

  useEffect(() => {
    handleSso();
  }, []);

  const handleSso = async () => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (!token) {
      setError('No SSO token provided in the URL.');
      setStatus('error');
      return;
    }

    setStatus('validating');

    try {
      const data = await http.post('/sso/nexus/verify', { token });
      setToken(data.token);
      const user = data.user?.data ?? data.user;
      const finalRedirect = resolveSsoRedirect(
        params.get('redirect_to'),
        params.get('return_to'),
        data.redirect_to,
      );

      rememberSsoRedirect(finalRedirect);
      setUserInfo({ email: user.email, name: user.full_name || user.email, redirectTo: finalRedirect });
      setStatus('success');

      setTimeout(() => {
        window.location.href = finalRedirect;
      }, 1200);
    } catch (e) {
      setError(e.message || 'SSO verification failed.');
      setStatus('error');
    }
  };

  if (status === 'loading' || status === 'validating') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground text-sm">Validating SSO token…</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full bg-card border rounded-xl shadow-lg p-8 text-center space-y-5">
          <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <ShieldX className="w-7 h-7 text-destructive" />
          </div>
          <div>
            <h1 className="text-xl font-bold">SSO Authentication Failed</h1>
            <p className="text-muted-foreground text-sm mt-2">{error}</p>
          </div>
          <Button variant="outline" onClick={() => { window.location.href = '/login'; }}>Go to Login</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-sm w-full bg-card border rounded-xl shadow-lg p-8 text-center space-y-5">
        <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
          <ShieldCheck className="w-7 h-7 text-emerald-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold">SSO Verified</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Welcome, <span className="font-medium text-foreground">{userInfo?.name}</span>
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{userInfo?.email}</p>
        </div>
        <p className="text-sm text-muted-foreground">
          Redirecting you{userInfo?.redirectTo !== '/dashboard' ? ' to your requested page' : ' to the dashboard'}…
        </p>
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
      </div>
    </div>
  );
}
