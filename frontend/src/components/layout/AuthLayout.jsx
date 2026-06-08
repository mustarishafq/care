import React from 'react';
import { Shield } from 'lucide-react';
import { redirectToNexusBrain } from '@/lib/nexusBrain';

export default function AuthLayout({ title, description, children, footer }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex flex-col">
      <header className="bg-card/80 backdrop-blur-sm border-b px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <img
            src="/icons/logo.svg"
            alt="EMZI Nexus Care"
            className="w-10 h-10 rounded-xl shrink-0 object-cover shadow-sm"
          />
          <div>
            <h1 className="font-bold text-lg leading-tight tracking-tight">EMZI Nexus Care</h1>
            <p className="text-xs text-muted-foreground">Complaint Management Platform</p>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-primary/10 rounded-2xl mb-4">
              <Shield className="w-7 h-7 text-primary" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">{title}</h2>
            {description && (
              <p className="text-muted-foreground mt-2 text-sm sm:text-base">{description}</p>
            )}
          </div>

          <div className="bg-card border rounded-xl shadow-lg p-6 sm:p-8">
            {children}
          </div>

          {footer && (
            <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>
          )}
        </div>
      </main>

      <footer className="py-4 text-center text-xs text-muted-foreground border-t bg-card/50">
        <p>
          Part of the{' '}
          <button
            type="button"
            onClick={redirectToNexusBrain}
            className="text-primary hover:underline font-medium"
          >
            EMZI Nexus Brain
          </button>{' '}
          ecosystem
        </p>
      </footer>
    </div>
  );
}
