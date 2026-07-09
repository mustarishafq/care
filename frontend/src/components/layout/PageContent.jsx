import React from 'react';
import AnimatedSection from '@/components/layout/AnimatedSection';
import { cn } from '@/lib/utils';

/** Wraps page body content below PageHeader with standard entrance animation (§20.1). */
export default function PageContent({ children, delay = 0.05, className }) {
  return (
    <AnimatedSection delay={delay} className={cn('space-y-6', className)}>
      {children}
    </AnimatedSection>
  );
}
