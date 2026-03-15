import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import type { ApiError } from '../types';

export interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
  refetch: () => Promise<void>;
}

export const useApi = <T = any>(
  url: string,
  options?: { skip?: boolean; deps?: any[] }
): UseApiResult<T> => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<T>(url);
      setData(result);
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    if (!options?.skip) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchData, options?.skip, ...(options?.deps || [])]);

  return { data, loading, error, refetch: fetchData };
};
