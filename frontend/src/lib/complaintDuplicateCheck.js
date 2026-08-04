import { db } from '@/api/db';

/** @param {Record<string, unknown>} form @param {string[]} fields */
export function hasDuplicateCheckCriteria(form, fields = []) {
  return fields.some((field) => String(form?.[field] ?? '').trim() !== '');
}

/**
 * @param {Record<string, unknown>} form
 * @param {string[]} fields
 * @param {number|string|null} [excludeId]
 */
export function buildDuplicateCheckPayload(form, fields = [], excludeId = null) {
  const payload = {};
  for (const field of fields) {
    const value = String(form?.[field] ?? '').trim();
    if (value) payload[field] = value;
  }
  if (excludeId != null && excludeId !== '') {
    payload.exclude_id = Number(excludeId);
  }
  return payload;
}

/**
 * @returns {Promise<{ duplicates: Array<Record<string, unknown>> }>}
 */
export async function fetchComplaintDuplicates(form, settings, excludeId = null) {
  if (!settings?.enabled || !hasDuplicateCheckCriteria(form, settings.fields)) {
    return { duplicates: [] };
  }

  const payload = buildDuplicateCheckPayload(form, settings.fields, excludeId);
  if (!Object.keys(payload).some((key) => key !== 'exclude_id')) {
    return { duplicates: [] };
  }

  const result = await db.complaints.checkDuplicates(payload);
  return {
    duplicates: Array.isArray(result?.duplicates) ? result.duplicates : [],
  };
}
