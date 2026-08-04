import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/api/db';
import { DUPLICATE_CHECK_DEFAULT, normalizeDuplicateCheckSettings } from '@/lib/duplicateCheckSettings';

export function useComplaintCreateOptions({ enabled = true } = {}) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['complaint_create_form_options'],
    queryFn: () => db.complaints.createFormOptions(),
    staleTime: 60_000,
    enabled,
    retry: 1,
  });

  const preResolved = useMemo(() => data?.pre_resolved ?? {
    enabled: false,
    status_id: null,
    status_name: null,
    require_closure_proof: true,
    require_resolution_notes: false,
  }, [data]);

  const orderSources = useMemo(() => data?.order_sources ?? [], [data]);

  const duplicateCheck = useMemo(
    () => normalizeDuplicateCheckSettings(data?.duplicate_check ?? DUPLICATE_CHECK_DEFAULT),
    [data],
  );

  return {
    preResolved,
    orderSources,
    duplicateCheck,
    isLoading,
    error,
    refetch,
  };
}
