import { useQuery } from '@tanstack/react-query';
import { db } from '@/api/db';

export function useComplaintTypes() {
  return useQuery({
    queryKey: ['complaint_types'],
    queryFn: () => db.entities.ComplaintType.list('sort_order'),
    staleTime: 60_000,
  });
}

export function useCouriers() {
  return useQuery({
    queryKey: ['couriers'],
    queryFn: () => db.entities.Courier.list('sort_order'),
    staleTime: 60_000,
  });
}

export function usePriorities() {
  return useQuery({
    queryKey: ['priorities'],
    queryFn: () => db.entities.Priority.list('sort_order'),
    staleTime: 60_000,
  });
}

export function useUnitsOfMeasurement() {
  return useQuery({
    queryKey: ['units_of_measurement'],
    queryFn: () => db.entities.UnitOfMeasurement.list('sort_order'),
    staleTime: 60_000,
  });
}

export function useComplaintStatuses() {
  return useQuery({
    queryKey: ['complaint_statuses'],
    queryFn: () => db.entities.ComplaintStatus.list('sort_order'),
    staleTime: 60_000,
  });
}

export function findByName(items, name) {
  return items.find((item) => item.name === name);
}

export function findIdByName(items, name) {
  return findByName(items, name)?.id ?? null;
}

export function buildPriorityOrder(priorities) {
  return Object.fromEntries(
    [...priorities]
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((p, index) => [p.id, index])
  );
}
