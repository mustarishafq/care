import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/api/db';
import { useComplaintStatuses } from '@/lib/useLookups';
import { getPausedStatusNames, normalizeSlaSettings } from '@/lib/slaSettings';

export function useSlaSettings() {
  const { data: configs = [], isLoading: loadingConfigs } = useQuery({
    queryKey: ['system_configs'],
    queryFn: () => db.entities.SystemConfig.list(),
    staleTime: 60_000,
  });

  const { data: complaintStatuses = [], isLoading: loadingStatuses } = useComplaintStatuses();

  const settings = useMemo(() => normalizeSlaSettings(
    configs.find((config) => config.key === 'sla_settings')?.json_value,
    complaintStatuses,
  ), [configs, complaintStatuses]);

  const pausedStatusNames = useMemo(
    () => getPausedStatusNames(settings, complaintStatuses),
    [settings, complaintStatuses],
  );

  return {
    settings,
    pausedStatusNames,
    pausedStatusIds: settings.paused_status_ids,
    isLoading: loadingConfigs || loadingStatuses,
  };
}
