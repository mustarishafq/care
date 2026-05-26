import { useQuery } from '@tanstack/react-query';
import { db } from '@/api/db';

export function useDepartments() {
  return useQuery({
    queryKey: ['departments'],
    queryFn: () => db.entities.Department.list('sort_order'),
    staleTime: 60_000,
  });
}

export function getUserDepartmentIds(user) {
  if (!user) return [];
  if (user.department_ids?.length) return user.department_ids;
  if (Array.isArray(user.departments) && user.departments.length) {
    if (typeof user.departments[0] === 'object') {
      return user.departments.map((d) => d.id);
    }
  }
  return [];
}

export function getUserDepartmentNames(user) {
  if (!user) return [];
  if (Array.isArray(user.departments) && user.departments.length) {
    if (typeof user.departments[0] === 'object') {
      return user.departments.map((d) => d.name);
    }
    return user.departments;
  }
  return [];
}

export function findDepartmentByName(departments, name) {
  return departments.find((d) => d.name === name);
}

export function findDepartmentIdByName(departments, name) {
  return findDepartmentByName(departments, name)?.id ?? null;
}
