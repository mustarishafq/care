import { useQuery } from '@tanstack/react-query';
import { db } from '@/api/db';

export function useTeams() {
  return useQuery({
    queryKey: ['teams'],
    queryFn: () => db.entities.Team.list('sort_order'),
    staleTime: 60_000,
  });
}

export function getUserTeamIds(user) {
  if (!user) return [];
  if (user.team_ids?.length) return user.team_ids.map(String);
  if (Array.isArray(user.teams) && user.teams.length) {
    if (typeof user.teams[0] === 'object') {
      return user.teams.map((t) => String(t.id));
    }
  }
  return [];
}
