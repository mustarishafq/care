# Display format requirements (numbers, money, dates)

Portable requirements for **every EMZI Nexus satellite app**. Implement once under **Settings → General**, store workspace-wide, and use shared formatters everywhere UI (and exports) show numbers, money, or dates.

Care (this repo) is a reference implementation. Copy this contract when building or auditing other systems.

**Also in the design system:** [DESIGN_TEMPLATE.md](./DESIGN_TEMPLATE.md) §12.7 (UI rules), §26.3 General tab, and §28 pre-ship checklist.

---

## Goal

Users must be able to configure:

| Kind | Example output | Notes |
|------|----------------|-------|
| Number | `1,000` / `12,139` | Thousands separators; optional decimals |
| Money | `1,000.00` / `RM 1,000.00` | Fixed decimal places + currency |
| Date | `12/07/2026` (configurable pattern) | One workspace date pattern |
| Date-time | `12/07/2026 13:05` (configurable) | Separate pattern from date-only |

Changing settings must **reflect across the whole app** (dashboard stats, tables, filters, reports, review counts, etc.) without hard-coded `toLocaleString()` / ad-hoc `date-fns` patterns per screen.

---

## Storage

| Item | Requirement |
|------|-------------|
| Store | Workspace `system_configs` (or equivalent key/value JSON settings) |
| Key | `display_format` |
| Label | `Display Format` |
| Scope | **Workspace / org**, not per-device (unlike theme) |
| Permission | `settings.view` to read; `settings.manage` to edit |
| UI | **Settings → General → Display & format** |

### `json_value` schema

```json
{
  "locale": "en-MY",
  "currency_code": "MYR",
  "currency_decimals": 2,
  "date_format": "dd/MM/yyyy",
  "datetime_format": "dd/MM/yyyy HH:mm"
}
```

| Field | Type | Default (MY / Care) | Purpose |
|-------|------|---------------------|---------|
| `locale` | string (BCP 47) | `en-MY` | Drives thousand/decimal separators via `Intl` |
| `currency_code` | string (ISO 4217) | `MYR` | Money formatting |
| `currency_decimals` | int 0–4 | `2` | Money fraction digits (`1,000.00`) |
| `date_format` | string | `dd/MM/yyyy` | date-fns (or equivalent) pattern for dates |
| `datetime_format` | string | `dd/MM/yyyy HH:mm` | date-fns pattern for date+time |

### Allowed date / datetime presets (minimum)

Apps must offer at least these selectable presets (values are the stored patterns):

**Date**

- `dd/MM/yyyy` → `12/07/2026`
- `MM/dd/yyyy` → `07/12/2026`
- `yyyy-MM-dd` → `2026-07-12`
- `d MMM yyyy` → `12 Jul 2026`
- `d MMMM yyyy` → `12 July 2026`

**Date-time**

- `dd/MM/yyyy HH:mm`
- `dd/MM/yyyy hh:mm a`
- `yyyy-MM-dd HH:mm`
- `d MMM yyyy, HH:mm`

Custom free-text patterns are optional; presets are required.

### Locale presets (minimum)

Offer a short list that maps to `locale` (and optionally suggests currency):

| Label | `locale` | Number example | Suggested currency |
|-------|----------|----------------|--------------------|
| Malaysia (English) | `en-MY` | `1,000.00` | `MYR` |
| United States | `en-US` | `1,000.00` | `USD` |
| United Kingdom | `en-GB` | `1,000.00` | `GBP` |
| Indonesia | `id-ID` | `1.000,00` | `IDR` |
| Germany | `de-DE` | `1.000,00` | `EUR` |

---

## Shared formatters (required API)

Expose one module (e.g. `lib/displayFormat.js`) and a React hook/provider that loads `display_format` from settings (with defaults if missing).

| Function | Input | Output rule |
|----------|-------|-------------|
| `formatNumber(value, options?)` | number / numeric string / null | Grouped integer/decimal per `locale`. Empty/null → `—` or `''` (pick one app-wide). Do **not** force money decimals. |
| `formatMoney(value, options?)` | number / numeric string / null | Currency per `currency_code` + `currency_decimals` (e.g. `RM 1,000.00` or `1,000.00` depending on `Intl` currency display). |
| `formatDate(value)` | Date / ISO string / timestamp | Format with `date_format`. Invalid → `—` / `''`. |
| `formatDateTime(value)` | Date / ISO string / timestamp | Format with `datetime_format`. |

### Rules

1. **Never** format money with `formatNumber` alone when the value is a price/amount.
2. **Never** hard-code `dd/MM/yyyy` or `toLocaleString()` in feature screens — call these helpers.
3. Stat / KPI cards that show counts must use `formatNumber` (e.g. `12139` → `12,139`).
4. Tables, charts axis ticks, CSV/PDF exports should use the same settings (backend may mirror helpers for exports).
5. HTML `<input type="date">` values stay **ISO `yyyy-MM-dd`**; only **display** labels use `date_format`.
6. After save, invalidate settings cache so all open screens refresh formatting without a full reload.

---

## UI requirements (Settings → General)

1. Card titled **Display & format** (workspace-wide; not “this device”).
2. Controls:
   - Locale / number style (preset select)
   - Currency code (select or text)
   - Currency decimals (0–4)
   - Date format (preset select)
   - Date-time format (preset select)
3. Live **preview** panel: sample number, money, date, date-time, and phone using current form values.
4. Save button (respect `settings.manage`); toast on success.
5. Dark mode / theme stays separate (personal device preference).

---

## Where it must apply (checklist)

When adding this to an app, verify:

```
[ ] Settings → General can edit display_format
[ ] StatCard / KPI numbers use formatNumber
[ ] Money fields use formatMoney
[ ] Review / list / report dates use formatDate / formatDateTime
[ ] Pagination text (“1–20 of 12,139”) uses formatNumber
[ ] Date range picker display labels follow date_format (storage remains ISO)
[ ] No leftover hard-coded en-US/en-GB or dd/MM/yyyy in feature code
[ ] Defaults match regional product (Care: en-MY, MYR, dd/MM/yyyy)
```

---

## Backend (recommended)

For emails, PDFs, and CSV:

- Read the same `display_format` config.
- Provide PHP (or server) helpers equivalent to `formatNumber` / `formatMoney` / `formatDate`.
- Use app timezone (`Asia/Kuala_Lumpur` for Care) when converting timestamps to calendar dates.

---

## Non-goals

- Per-user format overrides (unless a later product asks for them).
- Translating UI copy (i18n strings) — this spec is **numeric/date display only**.
- Changing how dates are stored in the database (always store UTC/ISO / app-tz consistently; format only at the edge).

---

## Reference (Care)

| Piece | Location |
|-------|----------|
| Settings UI | `frontend/src/pages/Settings.jsx` → General → Display & format |
| Config key | `display_format` in `system_configs` |
| Formatters | `frontend/src/lib/displayFormat.js` |
| Provider / hook | `frontend/src/lib/DisplayFormatProvider.jsx` |
| Stat cards | `frontend/src/components/dashboard/StatCard.jsx` |
