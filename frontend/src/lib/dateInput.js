import { format, isValid, parse } from 'date-fns';
import { DISPLAY_FORMAT_DEFAULT } from '@/lib/displayFormat';

const ISO_FORMAT = 'yyyy-MM-dd';

export function formatDateForDisplay(isoDate, dateFormat = DISPLAY_FORMAT_DEFAULT.date_format) {
  if (!isoDate) return '';
  const date = parse(isoDate, ISO_FORMAT, new Date());
  if (!isValid(date)) return '';
  try {
    return format(date, dateFormat);
  } catch {
    return format(date, DISPLAY_FORMAT_DEFAULT.date_format);
  }
}

export function parseDateInput(text, dateFormat = DISPLAY_FORMAT_DEFAULT.date_format) {
  if (!text?.trim()) return '';

  const trimmed = text.trim();

  const configured = parse(trimmed, dateFormat, new Date());
  if (isValid(configured)) return format(configured, ISO_FORMAT);

  const dmy = parse(trimmed, 'dd/MM/yyyy', new Date());
  if (isValid(dmy)) return format(dmy, ISO_FORMAT);

  const iso = parse(trimmed, ISO_FORMAT, new Date());
  if (isValid(iso)) return format(iso, ISO_FORMAT);

  return '';
}

export function isValidIsoDate(isoDate) {
  if (!isoDate) return false;
  const date = parse(isoDate, ISO_FORMAT, new Date());
  return isValid(date);
}
