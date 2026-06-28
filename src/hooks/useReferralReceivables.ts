import { useCallback, useEffect, useState } from 'react';
import { serviceReferralReceivableService } from '../services/serviceReferralReceivableService';
import type {
  ServiceReferralReceivable,
  ServiceReferralReceivableDashboard,
  ServiceReferralReceivableStatistics,
  ServiceReferralReceivableStatus,
} from '../types/recruiting';

const getCurrentYearMonth = (): string => new Date().toISOString().slice(0, 7);

export const useReferralReceivables = (initialMonth: string = getCurrentYearMonth()) => {
  const [month, setMonth] = useState(initialMonth);
  const [status, setStatus] = useState<ServiceReferralReceivableStatus | 'all'>('all');
  const [receivables, setReceivables] = useState<ServiceReferralReceivable[]>([]);
  const [summary, setSummary] = useState<ServiceReferralReceivableDashboard | null>(null);
  const [statistics, setStatistics] = useState<ServiceReferralReceivableStatistics | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rows, dashboard, stats] = await Promise.all([
        serviceReferralReceivableService.listReceivables(month, status),
        serviceReferralReceivableService.getDashboardSummary(month),
        serviceReferralReceivableService.getStatistics(),
      ]);
      setReceivables(rows);
      setSummary(dashboard);
      setStatistics(stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [month, status]);

  const run = useCallback(async (task: () => Promise<void>) => {
    setSaving(true);
    try {
      await task();
      await refresh();
    } finally {
      setSaving(false);
    }
  }, [refresh]);

  const generate = useCallback(() => run(async () => {
    await serviceReferralReceivableService.generateFromDeposits(month);
  }), [run, month]);

  const collect = useCallback((id: string, amount: number, memo?: string) => run(async () => {
    await serviceReferralReceivableService.collectReceivable(id, amount, memo);
  }), [run]);

  const close = useCallback((id: string, memo?: string) => run(async () => {
    await serviceReferralReceivableService.closeReceivable(id, memo);
  }), [run]);

  const downloadExcel = useCallback(async () => {
    await serviceReferralReceivableService.downloadReceivablesExcel(month);
  }, [month]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    month,
    setMonth,
    status,
    setStatus,
    receivables,
    summary,
    statistics,
    loading,
    saving,
    error,
    refresh,
    generate,
    collect,
    close,
    downloadExcel,
  };
};
