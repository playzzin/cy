import { useCallback, useEffect, useState } from 'react';
import { serviceWorkerHistoryService } from '../services/serviceWorkerHistoryService';
import type { ServiceWorkerHistory, ServiceWorkerHistoryDetail } from '../types/recruiting';

export interface WorkerHistoryFilters {
  workerName: string;
  referrerName: string;
  siteName: string;
  teamName: string;
  startDate: string;
  endDate: string;
}

export const useWorkerHistory = () => {
  const [filters, setFilters] = useState<WorkerHistoryFilters>({
    workerName: '',
    referrerName: '',
    siteName: '',
    teamName: '',
    startDate: '',
    endDate: '',
  });
  const [history, setHistory] = useState<ServiceWorkerHistory[]>([]);
  const [detail, setDetail] = useState<ServiceWorkerHistoryDetail | null>(null);
  const [trend, setTrend] = useState<Array<{ month: string; workers: number }>>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rows, trendRows] = await Promise.all([
        serviceWorkerHistoryService.listHistory(filters),
        serviceWorkerHistoryService.getWorkerGrowthTrend(),
      ]);
      setHistory(rows);
      setTrend(trendRows);
      const selectedExists = rows.some((row) => row.workerId === selectedWorkerId);
      const nextWorkerId = selectedExists ? selectedWorkerId : rows[0]?.workerId || '';
      setSelectedWorkerId(nextWorkerId);
      setDetail(nextWorkerId ? await serviceWorkerHistoryService.getWorkerHistoryDetail(nextWorkerId) : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [filters, selectedWorkerId]);

  const selectWorker = useCallback(async (workerId: string) => {
    setSelectedWorkerId(workerId);
    setLoading(true);
    setError(null);
    try {
      setDetail(await serviceWorkerHistoryService.getWorkerHistoryDetail(workerId));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const syncHistoricalWorkers = useCallback(async (createdBy?: string) => {
    setSaving(true);
    setError(null);
    try {
      await serviceWorkerHistoryService.syncHistoricalWorkerEvents(createdBy);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [refresh]);

  const downloadExcel = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      await serviceWorkerHistoryService.downloadHistoryExcel(filters);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [filters]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    filters,
    setFilters,
    history,
    detail,
    trend,
    selectedWorkerId,
    loading,
    saving,
    error,
    refresh,
    selectWorker,
    syncHistoricalWorkers,
    downloadExcel,
  };
};
