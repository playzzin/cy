import { useCallback, useEffect, useState } from 'react';
import { recruitingReferrerService } from '../services/recruitingReferrerService';
import type { RecruitingReferrer } from '../types/recruiting';

export const useReferrers = () => {
  const [referrers, setReferrers] = useState<RecruitingReferrer[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setReferrers(await recruitingReferrerService.listReferrers());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const save = useCallback(async (input: Partial<RecruitingReferrer>) => {
    setSaving(true);
    try {
      if (input.id) {
        await recruitingReferrerService.updateReferrer(input.id, input);
      } else {
        await recruitingReferrerService.createReferrer(input);
      }
      await refresh();
    } finally {
      setSaving(false);
    }
  }, [refresh]);

  const remove = useCallback(async (id: string) => {
    setSaving(true);
    try {
      await recruitingReferrerService.deleteReferrer(id);
      await refresh();
    } finally {
      setSaving(false);
    }
  }, [refresh]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { referrers, loading, saving, error, refresh, save, remove };
};
