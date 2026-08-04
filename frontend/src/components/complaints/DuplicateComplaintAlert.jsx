import React from 'react';
import { Link } from 'react-router-dom';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

export default function DuplicateComplaintAlert({
  duplicates = [],
  mode = 'warn',
  onContinue,
  onDismiss,
  continuing = false,
}) {
  if (!duplicates.length) return null;

  const isHardBlock = mode === 'hard_block';
  const continueLabel = mode === 'require_override' ? 'Confirm and continue' : 'Continue anyway';

  return (
    <Alert variant="destructive" className="border-amber-500/40 bg-amber-50 text-amber-950 dark:bg-amber-950/30 dark:text-amber-50">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>
        {isHardBlock ? 'Possible duplicate complaint' : 'Possible duplicate complaints found'}
      </AlertTitle>
      <AlertDescription className="space-y-3">
        <p className="text-sm">
          {isHardBlock
            ? 'Saving is blocked because a matching complaint already exists.'
            : 'Review the matching tickets below before continuing.'}
        </p>
        <ul className="space-y-1.5 text-sm">
          {duplicates.map((item) => (
            <li key={item.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <Link
                to={`/complaints/${item.id}`}
                className="font-medium underline underline-offset-2 hover:opacity-80"
                target="_blank"
                rel="noreferrer"
              >
                {item.ticket_id || `#${item.id}`}
              </Link>
              <span className="text-muted-foreground">
                {[item.customer_name, item.status].filter(Boolean).join(' · ')}
              </span>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2 pt-1">
          {!isHardBlock && (
            <Button size="sm" variant="default" onClick={onContinue} disabled={continuing}>
              {continueLabel}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={onDismiss} disabled={continuing}>
            {isHardBlock ? 'OK' : 'Cancel'}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
