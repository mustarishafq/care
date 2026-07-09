import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

const NERVE_NODES = [
  { angle: 0, delay: '0s' },
  { angle: 72, delay: '1.6s' },
  { angle: 144, delay: '3.2s' },
  { angle: 216, delay: '4.8s' },
  { angle: 288, delay: '6.4s' },
];

function OrbChrome({ active, icon: Icon }) {
  return (
    <span className={cn('apps-orb-nav relative -mt-6 flex h-12 w-12 items-center justify-center', active && 'apps-orb-nav--active')}>
      <span className="apps-orb-nav__pulse" aria-hidden />
      <span className="apps-orb-nav__pulse apps-orb-nav__pulse--delayed" aria-hidden />
      <span className="apps-orb-nav__nerve" aria-hidden>
        <span className="apps-orb-nav__nerve-track" />
        <span className="apps-orb-nav__nerve-impulse" />
        {NERVE_NODES.map((node) => (
          <span
            key={node.angle}
            className="apps-orb-nav__nerve-node"
            style={{ '--nerve-angle': `${node.angle}deg`, '--nerve-delay': node.delay }}
          />
        ))}
      </span>
      <span className="apps-orb-nav__core">
        <span className="apps-orb-nav__icon">
          <Icon className="h-6 w-6 text-primary-foreground" strokeWidth={2.25} />
        </span>
      </span>
    </span>
  );
}

export default function CenterOrbNavItem({ item, active, onAction }) {
  const className = cn(
    'relative flex min-w-0 flex-1 flex-col items-center justify-end gap-2 pb-1 transition-colors',
    active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
  );

  const content = (
    <>
      <OrbChrome active={active} icon={item.icon} />
      <span className="mt-0.5 max-w-full truncate px-0.5 text-[10px] font-semibold leading-none">
        {item.label}
      </span>
    </>
  );

  if (item.action) {
    return (
      <button
        type="button"
        onClick={() => onAction?.(item.action)}
        className={className}
        aria-label={item.label}
      >
        {content}
      </button>
    );
  }

  return (
    <Link to={item.path} className={className}>
      {content}
    </Link>
  );
}
