import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { DASHBOARD_REPORT_DEADLINE_MINUTES } from '../features/daily-report-coverage/dailyReportCoverage';
import { getKoreanDateKey, getKoreanMinuteOfDay } from '../utils/koreanBusinessDate';
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
  const sessionRef = useRef<{ uid: string; refreshing: boolean } | null>(null);
  const [dataUid, setDataUid] = useState(uid);
  const emptyStats = useMemo(() => createEmptyDashboardExecutiveStats(), [uid]);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [stats, setStats] = useState<DashboardExecutiveStats>(() => createEmptyDashboardExecutiveStats());

  useEffect(() => {
    let isMounted = true;
    const session = uid ? { uid, refreshing: false } : null;
    sessionRef.current = session;
    setDataUid(uid);
    setStats(createEmptyDashboardExecutiveStats());
    setLastUpdatedAt(null);
    setRefreshing(false);
    setLoading(Boolean(uid));

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

    const unsubscribeTasks = uid ? dashboardExecutiveService.subscribeRecentTasks((recentTasks) => {
      if (!isMounted) return;
      setStats((prev) => ({
        ...prev,
        recentTasks,
      }));
    }) : () => {};

    return () => {
      isMounted = false;
      if (sessionRef.current === session) sessionRef.current = null;
      unsubscribeTasks();
    };
  }, [uid]);

  const refresh = useCallback(async () => {
    const session = sessionRef.current;
    if (!uid || session?.uid !== uid || session.refreshing) return;

    session.refreshing = true;
    setRefreshing(true);
    try {
      const snapshot = await dashboardExecutiveService.getSnapshot({ forceRefresh: true });
      if (sessionRef.current !== session) return;
      setStats((prev) => mergeDashboardSnapshot(snapshot, prev));
      setLastUpdatedAt(new Date());
    } catch (error) {
      console.error('Dashboard refresh failed', error);
    } finally {
      if (sessionRef.current === session) {
        session.refreshing = false;
        setRefreshing(false);
      }
    }
  }, [uid]);

  useEffect(() => {
    if (!uid || loading || refreshing) return;
    const checkBusinessBoundary = () => {
      if (document.visibilityState === 'hidden') return;
      const now = new Date();
      const changedDate = stats.dailyReportCoverage.date !== getKoreanDateKey(now);
      const reachedDeadline = stats.dailyReportCoverage.status === 'collecting'
        && DASHBOARD_REPORT_DEADLINE_MINUTES !== null
        && getKoreanMinuteOfDay(now) >= DASHBOARD_REPORT_DEADLINE_MINUTES;
      if (changedDate || reachedDeadline) void refresh();
    };
    const interval = window.setInterval(checkBusinessBoundary, 60_000);
    window.addEventListener('focus', checkBusinessBoundary);
    document.addEventListener('visibilitychange', checkBusinessBoundary);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', checkBusinessBoundary);
      document.removeEventListener('visibilitychange', checkBusinessBoundary);
    };
  }, [uid, loading, refreshing, refresh, stats.dailyReportCoverage.date, stats.dailyReportCoverage.status]);

  return {
    loading: dataUid === uid ? loading : Boolean(uid),
    refreshing: dataUid === uid ? refreshing : false,
    lastUpdatedAt: dataUid === uid ? lastUpdatedAt : null,
    stats: dataUid === uid ? stats : emptyStats,
    refresh,
  };
};
