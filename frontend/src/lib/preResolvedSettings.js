export const PRE_RESOLVED_DEFAULT = {
  enabled: false,
  status_id: '',
  require_closure_proof: true,
  require_resolution_notes: false,
};

export function normalizePreResolvedSettings(raw = {}) {
  const merged = {
    ...PRE_RESOLVED_DEFAULT,
    ...(raw && typeof raw === 'object' ? raw : {}),
  };

  return {
    enabled: !!merged.enabled,
    status_id: merged.status_id ? String(merged.status_id) : '',
    require_closure_proof: merged.require_closure_proof !== false,
    require_resolution_notes: !!merged.require_resolution_notes,
  };
}

export function getPreResolvedStatusName(settings, complaintStatuses = []) {
  const id = settings?.status_id;
  if (!id) return null;
  return complaintStatuses.find((status) => String(status.id) === String(id))?.name ?? null;
}

export const ORDER_SOURCES_DEFAULT = { sources: [] };

export function normalizeOrderSources(raw = {}) {
  const sources = Array.isArray(raw?.sources) ? raw.sources : [];
  return {
    sources: [...new Set(sources.map((source) => String(source).trim()).filter(Boolean))],
  };
}
