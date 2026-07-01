export const DEFAULT_COMPLAINT_FILTERS = {
  search: '',
  status: '',
  type: '',
  priority: '',
  department: '',
  courier: '',
  preset: '',
};

const FILTER_KEYS = Object.keys(DEFAULT_COMPLAINT_FILTERS);

export function filtersToSearchParams(filters) {
  const params = new URLSearchParams();
  FILTER_KEYS.forEach((key) => {
    if (filters[key]) params.set(key, filters[key]);
  });
  return params;
}

export function buildComplaintsUrl(filters = {}) {
  const params = filtersToSearchParams({ ...DEFAULT_COMPLAINT_FILTERS, ...filters });
  const qs = params.toString();
  return qs ? `/complaints?${qs}` : '/complaints';
}

export function parseComplaintFilters(searchParams) {
  const filters = { ...DEFAULT_COMPLAINT_FILTERS };
  FILTER_KEYS.forEach((key) => {
    const value = searchParams.get(key);
    if (value) filters[key] = value;
  });
  return filters;
}
