export const DUPLICATE_CHECK_CONFIG_KEY = 'complaint_duplicate_check';

export const DUPLICATE_CHECK_FIELDS = [
  { key: 'order_number', label: 'Order number' },
  { key: 'tracking_number', label: 'Tracking number' },
  { key: 'customer_phone', label: 'Customer phone' },
];

export const DUPLICATE_CHECK_MODES = [
  { value: 'warn', label: 'Warn and allow continue' },
  { value: 'require_override', label: 'Require confirmation to continue' },
  { value: 'hard_block', label: 'Hard block' },
];

export const DUPLICATE_CHECK_MATCH_LOGICS = [
  { value: 'or', label: 'Match ANY selected field (OR)' },
  { value: 'and', label: 'Match ALL selected fields (AND)' },
];

export const DUPLICATE_CHECK_DEFAULT = {
  enabled: false,
  fields: ['tracking_number'],
  mode: 'warn',
  match_logic: 'or',
};

const ALLOWED_FIELDS = DUPLICATE_CHECK_FIELDS.map((field) => field.key);
const ALLOWED_MODES = DUPLICATE_CHECK_MODES.map((mode) => mode.value);
const ALLOWED_MATCH_LOGICS = DUPLICATE_CHECK_MATCH_LOGICS.map((item) => item.value);

export function normalizeDuplicateCheckSettings(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  let fields = Array.isArray(source.fields) ? source.fields.map(String) : DUPLICATE_CHECK_DEFAULT.fields;
  fields = fields.filter((field) => ALLOWED_FIELDS.includes(field));
  if (!fields.length) {
    fields = [...DUPLICATE_CHECK_DEFAULT.fields];
  }

  const mode = ALLOWED_MODES.includes(source.mode) ? source.mode : DUPLICATE_CHECK_DEFAULT.mode;
  const match_logic = ALLOWED_MATCH_LOGICS.includes(source.match_logic)
    ? source.match_logic
    : DUPLICATE_CHECK_DEFAULT.match_logic;

  return {
    enabled: !!source.enabled,
    fields,
    mode,
    match_logic,
  };
}

export function duplicateCheckModeLabel(mode) {
  return DUPLICATE_CHECK_MODES.find((item) => item.value === mode)?.label ?? mode;
}

export function duplicateCheckMatchLogicLabel(matchLogic) {
  return DUPLICATE_CHECK_MATCH_LOGICS.find((item) => item.value === matchLogic)?.label ?? matchLogic;
}

export function duplicateCheckFieldsLabel(fields = []) {
  if (!fields.length) return '—';
  return fields
    .map((key) => DUPLICATE_CHECK_FIELDS.find((field) => field.key === key)?.label ?? key)
    .join(', ');
}
