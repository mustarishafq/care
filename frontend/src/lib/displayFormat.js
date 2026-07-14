import { format as formatFns, isValid, parseISO } from 'date-fns';

export const DISPLAY_FORMAT_CONFIG_KEY = 'display_format';

export const DISPLAY_FORMAT_DEFAULT = {
  locale: 'en-MY',
  currency_code: 'MYR',
  currency_decimals: 2,
  date_format: 'dd/MM/yyyy',
  datetime_format: 'dd/MM/yyyy HH:mm',
  phone_country_code: '+60',
};

export const LOCALE_PRESETS = [
  { value: 'en-MY', label: 'Malaysia (English)', currency: 'MYR', phone: '+60', sample: '1,000.00' },
  { value: 'en-US', label: 'United States', currency: 'USD', phone: '+1', sample: '1,000.00' },
  { value: 'en-GB', label: 'United Kingdom', currency: 'GBP', phone: '+44', sample: '1,000.00' },
  { value: 'id-ID', label: 'Indonesia', currency: 'IDR', phone: '+62', sample: '1.000,00' },
  { value: 'de-DE', label: 'Germany', currency: 'EUR', phone: '+49', sample: '1.000,00' },
];

export const PHONE_COUNTRY_CODE_PRESETS = [
  { value: '+60', label: 'Malaysia (+60)', sample: '+60139989571' },
  { value: '+65', label: 'Singapore (+65)', sample: '+6591234567' },
  { value: '+62', label: 'Indonesia (+62)', sample: '+628123456789' },
  { value: '+66', label: 'Thailand (+66)', sample: '+66812345678' },
  { value: '+63', label: 'Philippines (+63)', sample: '+639123456789' },
  { value: '+84', label: 'Vietnam (+84)', sample: '+84912345678' },
  { value: '+1', label: 'United States (+1)', sample: '+12025550123' },
  { value: '+44', label: 'United Kingdom (+44)', sample: '+447911123456' },
];

export const DATE_FORMAT_PRESETS = [
  { value: 'dd/MM/yyyy', label: '12/07/2026' },
  { value: 'MM/dd/yyyy', label: '07/12/2026' },
  { value: 'yyyy-MM-dd', label: '2026-07-12' },
  { value: 'd MMM yyyy', label: '12 Jul 2026' },
  { value: 'd MMMM yyyy', label: '12 July 2026' },
];

export const DATETIME_FORMAT_PRESETS = [
  { value: 'dd/MM/yyyy HH:mm', label: '12/07/2026 13:05' },
  { value: 'dd/MM/yyyy hh:mm a', label: '12/07/2026 01:05 PM' },
  { value: 'yyyy-MM-dd HH:mm', label: '2026-07-12 13:05' },
  { value: 'd MMM yyyy, HH:mm', label: '12 Jul 2026, 13:05' },
];

export function normalizeDisplayFormat(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const decimals = Number(src.currency_decimals);
  return {
    locale: typeof src.locale === 'string' && src.locale.trim()
      ? src.locale.trim()
      : DISPLAY_FORMAT_DEFAULT.locale,
    currency_code: typeof src.currency_code === 'string' && src.currency_code.trim()
      ? src.currency_code.trim().toUpperCase()
      : DISPLAY_FORMAT_DEFAULT.currency_code,
    currency_decimals: Number.isFinite(decimals)
      ? Math.min(4, Math.max(0, Math.round(decimals)))
      : DISPLAY_FORMAT_DEFAULT.currency_decimals,
    date_format: typeof src.date_format === 'string' && src.date_format.trim()
      ? src.date_format.trim()
      : DISPLAY_FORMAT_DEFAULT.date_format,
    datetime_format: typeof src.datetime_format === 'string' && src.datetime_format.trim()
      ? src.datetime_format.trim()
      : DISPLAY_FORMAT_DEFAULT.datetime_format,
    phone_country_code: normalizePhoneCountryCode(src.phone_country_code),
  };
}

export function normalizePhoneCountryCode(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  const cleaned = raw.replace(/[^\d+]/g, '');
  if (!cleaned) return DISPLAY_FORMAT_DEFAULT.phone_country_code;
  const withPlus = cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
  const digits = withPlus.replace(/\D/g, '');
  return digits ? `+${digits}` : DISPLAY_FORMAT_DEFAULT.phone_country_code;
}

/** Format local/raw phones to +60139989571 using configured country code. */
export function formatPhoneNumber(value, settings = DISPLAY_FORMAT_DEFAULT, options = {}) {
  if (value === null || value === undefined || value === '') return options.empty ?? '—';
  const cfg = normalizeDisplayFormat(settings);
  const cc = cfg.phone_country_code;
  const ccDigits = cc.replace(/\D/g, '');
  const digits = String(value).replace(/\D/g, '');
  if (!digits) return options.empty ?? '—';

  let local;
  if (ccDigits && digits.startsWith(ccDigits)) {
    local = digits.slice(ccDigits.length);
  } else {
    local = digits.replace(/^0+/, '');
  }
  if (!local) return options.empty ?? '—';
  return `${cc}${local}`;
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return null;
}

function toDate(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return isValid(value) ? value : null;
  if (typeof value === 'number') {
    const date = new Date(value > 9999999999 ? value : value * 1000);
    return isValid(date) ? date : null;
  }
  if (typeof value === 'string') {
    const iso = parseISO(value);
    if (isValid(iso)) return iso;
    const fallback = new Date(value);
    return isValid(fallback) ? fallback : null;
  }
  return null;
}

export function formatNumber(value, settings = DISPLAY_FORMAT_DEFAULT, options = {}) {
  const amount = toNumber(value);
  if (amount === null) return options.empty ?? '—';

  const cfg = normalizeDisplayFormat(settings);
  const {
    minimumFractionDigits,
    maximumFractionDigits,
  } = options;

  try {
    return new Intl.NumberFormat(cfg.locale, {
      minimumFractionDigits: minimumFractionDigits ?? 0,
      maximumFractionDigits: maximumFractionDigits ?? (Number.isInteger(amount) ? 0 : 2),
    }).format(amount);
  } catch {
    return String(amount);
  }
}

export function formatMoney(value, settings = DISPLAY_FORMAT_DEFAULT, options = {}) {
  const amount = toNumber(value);
  if (amount === null) return options.empty ?? '—';

  const cfg = normalizeDisplayFormat(settings);
  try {
    return new Intl.NumberFormat(cfg.locale, {
      style: 'currency',
      currency: cfg.currency_code,
      minimumFractionDigits: cfg.currency_decimals,
      maximumFractionDigits: cfg.currency_decimals,
    }).format(amount);
  } catch {
    return formatNumber(amount, cfg, {
      minimumFractionDigits: cfg.currency_decimals,
      maximumFractionDigits: cfg.currency_decimals,
      empty: options.empty,
    });
  }
}

export function formatDate(value, settings = DISPLAY_FORMAT_DEFAULT, options = {}) {
  const date = toDate(value);
  if (!date) return options.empty ?? '—';
  const cfg = normalizeDisplayFormat(settings);
  try {
    return formatFns(date, cfg.date_format);
  } catch {
    return formatFns(date, DISPLAY_FORMAT_DEFAULT.date_format);
  }
}

export function formatDateTime(value, settings = DISPLAY_FORMAT_DEFAULT, options = {}) {
  const date = toDate(value);
  if (!date) return options.empty ?? '—';
  const cfg = normalizeDisplayFormat(settings);
  try {
    return formatFns(date, cfg.datetime_format);
  } catch {
    return formatFns(date, DISPLAY_FORMAT_DEFAULT.datetime_format);
  }
}

export function createDisplayFormatters(settings = DISPLAY_FORMAT_DEFAULT) {
  const cfg = normalizeDisplayFormat(settings);
  return {
    settings: cfg,
    formatNumber: (value, options) => formatNumber(value, cfg, options),
    formatMoney: (value, options) => formatMoney(value, cfg, options),
    formatDate: (value, options) => formatDate(value, cfg, options),
    formatDateTime: (value, options) => formatDateTime(value, cfg, options),
    formatPhone: (value, options) => formatPhoneNumber(value, cfg, options),
  };
}
