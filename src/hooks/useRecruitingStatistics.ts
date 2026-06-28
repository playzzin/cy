import { useCallback, useEffect, useState } from 'react';
import { serviceReferralSettlementService } from '../services/serviceReferralSettlementService';
import type { RecruitingMonthlyStatistics } from '../types/recruiting';

const getCurrentYearMonth = (): string => new Date().toISOString().slice(0, 7);

export const useRecruitingStatistics = (initialYearMonth: string = getCurrentYearMonth()) => {
  const [yearMonth, setYearMonth] = useState(initialYearMonth);
  const [statistics, setStatistics] = useState<RecruitingMonthlyStatistics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStatistics(await serviceReferralSettlementService.getMonthlyStatistics(yearMonth));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [yearMonth]);

  const downloadExcel = useCallback(async () => {
    await serviceReferralSettlementService.downloadMonthlyStatisticsExcel(yearMonth);
  }, [yearMonth]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { yearMonth, setYearMonth, statistics, loading, error, refresh, downloadExcel };
};
