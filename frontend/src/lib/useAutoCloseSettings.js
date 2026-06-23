import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/api/db';
import { useComplaintStatuses } from '@/lib/useLookups';
import {
  getAutoCloseTargetStatusName,
  getAutoCloseTriggerStatusName,
  normalizeAutoCloseSettings,
} from '@/lib/autoCloseSettings';

export function useAutoCloseSettings() {
  const { data: configs = [], isLoading: loadingConfigs } = useQuery({
    queryKey: ['system_configs'],
    queryFn: () => db.entities.SystemConfig.list(),
    staleTime: 60_000,
  });

  const { data: complaintStatuses = [], isLoading: loadingStatuses } = useComplaintStatuses();

  const settings = useMemo(() => normalizeAutoCloseSettings(
    configs.find((config) => config.key === 'auto_close_delivered')?.json_value,
    complaintStatuses,
  ), [configs, complaintStatuses]);

  const triggerStatusName = useMemo(
    () => getAutoCloseTriggerStatusName(settings, complaintStatuses),
    [settings, complaintStatuses],
  );

  const targetStatusName = useMemo(
    () => getAutoCloseTargetStatusName(settings, complaintStatuses),
    [settings, complaintStatuses],
  );

  return {
    settings,
    triggerStatusName,
    targetStatusName,
    triggerStatusId: settings.trigger_status_id,
    targetStatusId: settings.target_status_id,
    isLoading: loadingConfigs || loadingStatuses,
  };
}
