import { useCallback, useEffect, useState } from 'react';
import { serviceReferralSettlementService } from '../services/serviceReferralSettlementService';
import type { RecruitingDashboardSummary } from '../types/recruiting';

const getCurrentYearMonth = (): string => new Date().toISOString().slice(0, 7);

export const useRecruitingDashboard = (initialYearMonth: string = getCurrentYearMonth()) => {
  const [yearMonth, setYearMonth] = useState(initialYearMonth);
  const [summary, setSummary] = useState<RecruitingDashboardSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSummary(await serviceReferralSettlementService.getDashboardSummary(yearMonth));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [yearMonth]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { yearMonth, setYearMonth, summary, loading, error, refresh };
};
