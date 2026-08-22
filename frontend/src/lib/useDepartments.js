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

  const ids = new Set();

  const add = (value) => {
    if (value != null && value !== '') ids.add(String(value));
  };

  if (Array.isArray(user.accessible_department_ids)) {
    user.accessible_department_ids.forEach(add);
  }
  if (Array.isArray(user.department_ids)) {
    user.department_ids.forEach(add);
  }
  if (Array.isArray(user.departments)) {
    for (const dept of user.departments) {
      add(typeof dept === 'object' ? dept?.id : dept);
    }
  }
  if (Array.isArray(user.teams)) {
    for (const team of user.teams) {
      if (team?.is_active === false) continue;
      add(team?.department_id ?? team?.department?.id);
    }
  }

  return [...ids];
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
