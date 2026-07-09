import * as React from 'react';
import { format, isValid, parse } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const ISO_FORMAT = 'yyyy-MM-dd';

function parseIsoDate(value) {
  if (!value) return undefined;
  const date = parse(value, ISO_FORMAT, new Date());
  return isValid(date) ? date : undefined;
}

export function DatePicker({
  value = '',
  onChange,
  placeholder = 'Select date',
  className,
  id,
  disabled,
}) {
  const [open, setOpen] = React.useState(false);
  const selected = parseIsoDate(value);

  const handleSelect = (date) => {
    onChange?.(date ? format(date, ISO_FORMAT) : '');
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            'w-full justify-start text-left font-normal h-10 px-3',
            !value && 'text-muted-foreground',
            className,
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0 opacity-60" />
          {selected ? format(selected, 'dd/MM/yyyy') : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 z-[100]" align="start">
        <Calendar mode="single" selected={selected} onSelect={handleSelect} initialFocus />
      </PopoverContent>
    </Popover>
  );
}
