import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  createEmptyDashboardExecutiveStats,
  dashboardExecutiveService,
  type DashboardExecutiveStats,
} from '../services/dashboardExecutiveService';

const mergeDashboardSnapshot = (
  snapshot: DashboardExecutiveStats,
  previous: DashboardExecutiveStats
): DashboardExecutiveStats => ({
  ...snapshot,
  recentTasks: previous.recentTasks,
});

export const useDashboardExecutiveStats = () => {
  const { currentUser } = useAuth();
  const uid = currentUser?.uid;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [stats, setStats] = useState<DashboardExecutiveStats>(() => createEmptyDashboardExecutiveStats());

  useEffect(() => {
    let isMounted = true;

    const initDashboard = async () => {
      if (!uid) {
        if (isMounted) setLoading(false);
        return;
      }

      try {
        const snapshot = await dashboardExecutiveService.getSnapshot();
        if (!isMounted) return;

        setStats((prev) => mergeDashboardSnapshot(snapshot, prev));
        setLastUpdatedAt(new Date());
      } catch (error) {
        console.error('Dashboard data load failed', error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void initDashboard();

    const unsubscribeTasks = dashboardExecutiveService.subscribeRecentTasks((recentTasks) => {
      if (!isMounted) return;
      setStats((prev) => ({
        ...prev,
        recentTasks,
      }));
    });

    return () => {
      isMounted = false;
      unsubscribeTasks();
    };
  }, [uid]);

  const refresh = useCallback(async () => {
    if (!uid || refreshing) return;

    setRefreshing(true);
    try {
      const snapshot = await dashboardExecutiveService.getSnapshot({ forceRefresh: true });
      setStats((prev) => mergeDashboardSnapshot(snapshot, prev));
      setLastUpdatedAt(new Date());
    } catch (error) {
      console.error('Dashboard refresh failed', error);
    } finally {
      setRefreshing(false);
    }
  }, [refreshing, uid]);

  return {
    loading,
    refreshing,
    lastUpdatedAt,
    stats,
    refresh,
  };
};
