import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import type { ApiError } from '../types';

export interface PaymentInsights {
  reliability_pct?: number;
  avg_days_to_pay?: number;
  avg_emails_before_payment?: number;
}

export interface RecommendedAction {
  invoiceId: string;
  customerId: string;
  customerName: string;
  customerEmail: string | null;
  amount: number;
  daysOverdue: number;
  riskScore: number;
  paymentProbability: number;
  recommendedAction: 'sms' | 'email' | 'call' | 'wait';
  priority: 'critical' | 'high' | 'medium';
  aiReasoning: string;
  previousAttempts: number;
  paymentInsights: PaymentInsights | null;
}

export interface UseRecommendedActionsResult {
  actions: RecommendedAction[];
  loading: boolean;
  error: ApiError | null;
  refetch: () => Promise<void>;
}

export const useRecommendedActions = (limit: number = 3): UseRecommendedActionsResult => {
  const [actions, setActions] = useState<RecommendedAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchActions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<{ data: RecommendedAction[] }>(
        `/api/dashboard/recommended-actions?limit=${limit}`
      );
      setActions(result.data || []);
    } catch (err: any) {
      setError(err);
      setActions([]);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchActions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit]);

  return { actions, loading, error, refetch: fetchActions };
};
