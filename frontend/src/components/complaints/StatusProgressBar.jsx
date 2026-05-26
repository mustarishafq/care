import React from 'react';
import { STATUS_COLORS, buildStatusOrder } from '@/lib/ticketUtils';
import { useComplaintStatuses } from '@/lib/useLookups';
import { CheckCircle2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export default function StatusProgressBar({ currentStatus }) {
  const { data: complaintStatuses = [] } = useComplaintStatuses();
  const statusOrder = buildStatusOrder(complaintStatuses);

  if (currentStatus === 'Rejected') {
    return (
      <div className="flex items-center gap-2 py-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-3 py-1.5 rounded-full">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          Rejected
        </div>
      </div>
    );
  }

  const steps = statusOrder.filter(s => s !== 'Rejected');
  const activeIndex = steps.indexOf(currentStatus);

  return (
    <TooltipProvider delayDuration={100}>
      <div className="flex items-center gap-1 overflow-x-auto py-2">
        {steps.map((step, i) => {
          const isPast = i < activeIndex;
          const isCurrent = i === activeIndex;
          return (
            <React.Fragment key={step}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-full whitespace-nowrap shrink-0 cursor-default ${
                    isPast ? 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300' :
                    isCurrent ? `${STATUS_COLORS[step]?.bg} ${STATUS_COLORS[step]?.text}` :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {isPast && <CheckCircle2 className="w-3 h-3" />}
                    {isCurrent && <span className="w-2 h-2 rounded-full bg-current animate-pulse" />}
                    <span className="hidden sm:inline">{step}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="sm:hidden">
                  <p>{step}</p>
                </TooltipContent>
              </Tooltip>
              {i < steps.length - 1 && (
                <div className={`w-4 h-px shrink-0 ${i < activeIndex ? 'bg-emerald-400' : 'bg-border'}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
