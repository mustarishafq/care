import React from 'react';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { redirectToNexusBrain } from '@/lib/nexusBrain';

export default function NexusBrainLoginButton() {
  return (
    <Button
      type="button"
      variant="outline"
      className="group w-full h-11 border-primary/30 text-foreground hover:!bg-primary/10 hover:border-primary/60 hover:!text-foreground"
      onClick={redirectToNexusBrain}
    >
      <img src="/icons/logo.svg" alt="" className="w-5 h-5 rounded" aria-hidden="true" />
      Continue with EMZI Nexus Brain
      <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
    </Button>
  );
}
