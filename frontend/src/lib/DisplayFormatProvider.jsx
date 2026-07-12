import React, { createContext, useContext, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/api/db';
import { getToken } from '@/api/http';
import {
  DISPLAY_FORMAT_CONFIG_KEY,
  DISPLAY_FORMAT_DEFAULT,
  createDisplayFormatters,
  normalizeDisplayFormat,
} from '@/lib/displayFormat';

const DisplayFormatContext = createContext(createDisplayFormatters(DISPLAY_FORMAT_DEFAULT));

export function DisplayFormatProvider({ children }) {
  const hasToken = Boolean(getToken());

  const { data: configs = [] } = useQuery({
    queryKey: ['system_configs'],
    queryFn: () => db.entities.SystemConfig.list(),
    enabled: hasToken,
    staleTime: 60_000,
  });

  const value = useMemo(() => {
    const raw = configs.find((c) => c.key === DISPLAY_FORMAT_CONFIG_KEY)?.json_value;
    return createDisplayFormatters(normalizeDisplayFormat(raw));
  }, [configs]);

  return (
    <DisplayFormatContext.Provider value={value}>
      {children}
    </DisplayFormatContext.Provider>
  );
}

export function useDisplayFormat() {
  return useContext(DisplayFormatContext);
}
