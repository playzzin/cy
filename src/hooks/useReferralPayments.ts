import { useCallback, useEffect, useState } from 'react';
import { serviceReferralPaymentService } from '../services/serviceReferralPaymentService';
import type { ServiceReferralPayment, ServiceReferralPaymentDashboard, ServiceReferralPaymentStatus } from '../types/recruiting';

const getCurrentYearMonth = (): string => new Date().toISOString().slice(0, 7);

export const useReferralPayments = (initialYearMonth: string = getCurrentYearMonth()) => {
  const [yearMonth, setYearMonth] = useState(initialYearMonth);
  const [status, setStatus] = useState<ServiceReferralPaymentStatus | 'all'>('all');
  const [payments, setPayments] = useState<ServiceReferralPayment[]>([]);
  const [summary, setSummary] = useState<ServiceReferralPaymentDashboard | null>(null);
  const [trend, setTrend] = useState<Array<{ month: string; pendingAmount: number; paidAmount: number }>>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [paymentRows, dashboard, trendRows] = await Promise.all([
        serviceReferralPaymentService.listPayments(yearMonth, status),
        serviceReferralPaymentService.getDashboardSummary(yearMonth),
        serviceReferralPaymentService.getPaymentTrend(),
      ]);
      setPayments(paymentRows);
      setSummary(dashboard);
      setTrend(trendRows);
      setSelectedIds((prev) => prev.filter((id) => paymentRows.some((payment) => payment.id === id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [yearMonth, status]);

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
    await serviceReferralPaymentService.syncPaymentsFromSettlements(yearMonth);
  }), [run, yearMonth]);

  const approve = useCallback((id: string) => run(async () => {
    await serviceReferralPaymentService.approvePayment(id);
  }), [run]);

  const pay = useCallback((id: string, userId?: string) => run(async () => {
    await serviceReferralPaymentService.payPayment(id, userId);
  }), [run]);

  const cancel = useCallback((id: string) => run(async () => {
    await serviceReferralPaymentService.cancelPayment(id);
  }), [run]);

  const bulkApprove = useCallback(() => run(async () => {
    await serviceReferralPaymentService.bulkApprove(selectedIds);
  }), [run, selectedIds]);

  const bulkPay = useCallback((userId?: string) => run(async () => {
    await serviceReferralPaymentService.bulkPay(selectedIds, userId);
  }), [run, selectedIds]);

  const downloadExcel = useCallback(async () => {
    await serviceReferralPaymentService.downloadPaymentsExcel(yearMonth);
  }, [yearMonth]);

  const toggleSelected = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => checked ? Array.from(new Set([...prev, id])) : prev.filter((item) => item !== id));
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    yearMonth,
    setYearMonth,
    status,
    setStatus,
    payments,
    summary,
    trend,
    selectedIds,
    setSelectedIds,
    loading,
    saving,
    error,
    refresh,
    sync,
    approve,
    pay,
    cancel,
    bulkApprove,
    bulkPay,
    downloadExcel,
    toggleSelected,
  };
};
