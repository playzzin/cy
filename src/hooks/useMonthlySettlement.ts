import { useCallback, useEffect, useState } from 'react';
import { serviceReferralSettlementService } from '../services/serviceReferralSettlementService';
import type { ServiceReferralDailyLine, ServiceReferralMonthlySettlement } from '../types/recruiting';

const getCurrentYearMonth = (): string => new Date().toISOString().slice(0, 7);

export const useMonthlySettlement = (initialYearMonth: string = getCurrentYearMonth()) => {
  const [yearMonth, setYearMonth] = useState(initialYearMonth);
  const [settlements, setSettlements] = useState<ServiceReferralMonthlySettlement[]>([]);
  const [lines, setLines] = useState<ServiceReferralDailyLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await serviceReferralSettlementService.getMonthlySettlement(yearMonth);
      setSettlements(result.settlements);
      setLines(result.lines);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [yearMonth]);

  const calculate = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      setSettlements(await serviceReferralSettlementService.calculateMonthlySettlement(yearMonth));
      const result = await serviceReferralSettlementService.getMonthlySettlement(yearMonth);
      setLines(result.lines);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [yearMonth]);

  const updateSettlement = useCallback(async (id: string, updates: Partial<ServiceReferralMonthlySettlement>) => {
    setSaving(true);
    try {
      await serviceReferralSettlementService.updateMonthlySettlement(id, updates);
      await refresh();
    } finally {
      setSaving(false);
    }
  }, [refresh]);

  const confirm = useCallback(async (id: string, userId?: string) => {
    setSaving(true);
    try {
      await serviceReferralSettlementService.confirmMonthlySettlement(id, userId);
      await refresh();
    } finally {
      setSaving(false);
    }
  }, [refresh]);

  const markPaid = useCallback(async (id: string, userId?: string) => {
    setSaving(true);
    try {
      await serviceReferralSettlementService.markSettlementPaid(id, userId);
      await refresh();
    } finally {
      setSaving(false);
    }
  }, [refresh]);

  const overrideDailyLine = useCallback(async (lineId: string, values: {
    introIncomeAmount?: number;
    introPayoutAmount?: number;
    dailyCommissionAmount?: number;
    reason: string;
  }) => {
    setSaving(true);
    try {
      await serviceReferralSettlementService.overrideDailyLine({ lineId, ...values });
      await refresh();
    } finally {
      setSaving(false);
    }
  }, [refresh]);

  const downloadMonthlyExcel = useCallback(async () => {
    await serviceReferralSettlementService.downloadMonthlySettlementExcel(yearMonth);
  }, [yearMonth]);

  const downloadReferrerExcel = useCallback(async (referrerId: string) => {
    await serviceReferralSettlementService.downloadReferrerSettlementExcel(yearMonth, referrerId);
  }, [yearMonth]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    yearMonth,
    setYearMonth,
    settlements,
    lines,
    loading,
    saving,
    error,
    refresh,
    calculate,
    updateSettlement,
    confirm,
    markPaid,
    overrideDailyLine,
    downloadMonthlyExcel,
    downloadReferrerExcel,
  };
};
