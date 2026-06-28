import { useCallback, useEffect, useState } from 'react';
import { serviceWorkerReferralService, type CreateServiceWorkerReferralInput } from '../services/serviceWorkerReferralService';
import type { ServiceWorkerCandidate, ServiceWorkerReferral } from '../types/recruiting';

export const useServiceWorkers = () => {
  const [candidates, setCandidates] = useState<ServiceWorkerCandidate[]>([]);
  const [referrals, setReferrals] = useState<ServiceWorkerReferral[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [candidateRows, referralRows] = await Promise.all([
        serviceWorkerReferralService.listServiceWorkerCandidates(),
        serviceWorkerReferralService.listReferrals(),
      ]);
      setCandidates(candidateRows);
      setReferrals(referralRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const createReferral = useCallback(async (input: CreateServiceWorkerReferralInput) => {
    setSaving(true);
    try {
      await serviceWorkerReferralService.createReferral(input);
      await refresh();
    } finally {
      setSaving(false);
    }
  }, [refresh]);

  const updateReferral = useCallback(async (id: string, updates: Partial<ServiceWorkerReferral>) => {
    setSaving(true);
    try {
      await serviceWorkerReferralService.updateReferral(id, updates);
      await refresh();
    } finally {
      setSaving(false);
    }
  }, [refresh]);

  const stopReferral = useCallback(async (id: string, stopDate: string, reason: string) => {
    setSaving(true);
    try {
      await serviceWorkerReferralService.stopReferral(id, stopDate, reason);
      await refresh();
    } finally {
      setSaving(false);
    }
  }, [refresh]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    candidates,
    referrals,
    loading,
    saving,
    error,
    refresh,
    createReferral,
    updateReferral,
    stopReferral,
  };
};
