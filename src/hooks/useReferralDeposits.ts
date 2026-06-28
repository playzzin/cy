import { useCallback, useEffect, useState } from 'react';
import { serviceReferralDepositService } from '../services/serviceReferralDepositService';
import type { ServiceReferralDeposit, ServiceReferralDepositDashboard } from '../types/recruiting';

const getCurrentYearMonth = (): string => new Date().toISOString().slice(0, 7);

export const useReferralDeposits = (initialYearMonth: string = getCurrentYearMonth()) => {
  const [yearMonth, setYearMonth] = useState(initialYearMonth);
  const [verified, setVerified] = useState<boolean | 'all'>('all');
  const [deposits, setDeposits] = useState<ServiceReferralDeposit[]>([]);
  const [summary, setSummary] = useState<ServiceReferralDepositDashboard | null>(null);
  const [trend, setTrend] = useState<Array<{ month: string; expectedAmount: number; depositAmount: number }>>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [depositRows, dashboard, trendRows] = await Promise.all([
        serviceReferralDepositService.listDeposits(yearMonth, verified),
        serviceReferralDepositService.getDashboardSummary(yearMonth),
        serviceReferralDepositService.getDepositTrend(),
      ]);
      setDeposits(depositRows);
      setSummary(dashboard);
      setTrend(trendRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [yearMonth, verified]);

  const run = useCallback(async (task: () => Promise<void>) => {
    setSaving(true);
    try {
      await task();
      await refresh();
    } finally {
      setSaving(false);
    }
  }, [refresh]);

  const sync = useCallback(() => run(async () => {
    await serviceReferralDepositService.syncExpectedDepositsFromSettlements(yearMonth);
  }), [run, yearMonth]);

  const saveDeposit = useCallback((input: Partial<ServiceReferralDeposit>) => run(async () => {
    await serviceReferralDepositService.saveDeposit({ ...input, yearMonth: input.yearMonth || yearMonth });
  }), [run, yearMonth]);

  const verifyDeposit = useCallback((id: string) => run(async () => {
    await serviceReferralDepositService.verifyDeposit(id);
  }), [run]);

  const cancelDeposit = useCallback((id: string) => run(async () => {
    await serviceReferralDepositService.cancelDeposit(id);
  }), [run]);

  const uploadEvidence = useCallback((file: File, depositId?: string) => serviceReferralDepositService.uploadEvidence(file, depositId), []);

  const downloadExcel = useCallback(async () => {
    await serviceReferralDepositService.downloadDepositsExcel(yearMonth);
  }, [yearMonth]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    yearMonth,
    setYearMonth,
    verified,
    setVerified,
    deposits,
    summary,
    trend,
    loading,
    saving,
    error,
    refresh,
    sync,
    saveDeposit,
    verifyDeposit,
    cancelDeposit,
    uploadEvidence,
    downloadExcel,
  };
};
