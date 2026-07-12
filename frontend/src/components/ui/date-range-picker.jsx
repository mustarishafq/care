import * as React from 'react';
import { format, isValid, parse } from 'date-fns';
import { CalendarIcon, X } from 'lucide-react';
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

function formatDisplay(from, to) {
  if (from && to) {
    return `${format(from, 'dd/MM/yyyy')} – ${format(to, 'dd/MM/yyyy')}`;
  }
  if (from) {
    return `${format(from, 'dd/MM/yyyy')} – …`;
  }
  return null;
}

function useMediaQuery(query) {
  const [matches, setMatches] = React.useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  React.useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setMatches(media.matches);
    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

export function DateRangePicker({
  from = '',
  to = '',
  onChange,
  placeholder = 'Select date range',
  className,
  id,
  disabled,
  numberOfMonths,
  allowClear = true,
}) {
  const [open, setOpen] = React.useState(false);
  const isWide = useMediaQuery('(min-width: 640px)');
  const months = numberOfMonths ?? (isWide ? 2 : 1);
  const selected = {
    from: parseIsoDate(from),
    to: parseIsoDate(to),
  };
  const label = formatDisplay(selected.from, selected.to);
  const hasValue = Boolean(from || to);

  const handleSelect = (range) => {
    onChange?.({
      from: range?.from ? format(range.from, ISO_FORMAT) : '',
      to: range?.to ? format(range.to, ISO_FORMAT) : '',
    });
    if (range?.from && range?.to) {
      setOpen(false);
    }
  };

  const clear = (event) => {
    event.preventDefault();
    event.stopPropagation();
    onChange?.({ from: '', to: '' });
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
            'w-full justify-start text-left font-normal h-10 px-3 pr-2',
            !label && 'text-muted-foreground',
            className,
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0 opacity-60" />
          <span className="truncate flex-1">{label || placeholder}</span>
          {allowClear && hasValue && !disabled ? (
            <span
              role="button"
              tabIndex={-1}
              aria-label="Clear date range"
              className="ml-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={clear}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  clear(event);
                }
              }}
            >
              <X className="h-3.5 w-3.5" />
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 z-[100]" align="start">
        <Calendar
          mode="range"
          selected={selected}
          onSelect={handleSelect}
          numberOfMonths={months}
          defaultMonth={selected.from || selected.to || new Date()}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
