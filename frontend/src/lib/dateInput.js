import { format, isValid, parse } from 'date-fns';

const DISPLAY_FORMAT = 'dd/MM/yyyy';
const ISO_FORMAT = 'yyyy-MM-dd';

export function formatDateForDisplay(isoDate) {
  if (!isoDate) return '';
  const date = parse(isoDate, ISO_FORMAT, new Date());
  return isValid(date) ? format(date, DISPLAY_FORMAT) : '';
}

export function parseDateInput(text) {
  if (!text?.trim()) return '';

  const trimmed = text.trim();

  const dmy = parse(trimmed, DISPLAY_FORMAT, new Date());
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
