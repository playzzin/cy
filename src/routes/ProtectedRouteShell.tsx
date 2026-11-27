import { accountLinkService } from '../services/accountLinkService';
import { invalidateTeamScopedCache } from '../services/teamScopedReadService';
import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import DashboardLayout from '../components/layout/DashboardLayout';
import AppIntroScreen from '../components/common/AppIntroScreen';
import MasterDataLoadNotice from '../components/common/MasterDataLoadNotice';
import ProfileSetup from '../components/auth/ProfileSetup';
import AccountApprovalStatus from '../components/auth/AccountApprovalStatus';
import { MasterDataProvider } from '../contexts/MasterDataContext';
import { useAuth } from '../contexts/AuthContext';
import { useWorkerTeamIdMigration } from '../hooks/useWorkerTeamIdMigration';
import type { UserData } from '../services/userService';
import { db } from '../config/firebase';
import { isDevAdminSessionEnabled } from '../utils/devAdminSession';
import { canReuseScopedWorkerClaims, resolveAccountOnboardingMode } from '../utils/accountOnboardingState';
import TeamWorkflowGate from './TeamWorkflowGate';
import { INVESTMENT_PATH } from '../constants/siteModes';
import { TEAM_SITE_PATH } from '../constants/teamWorkflowActions';

const MigrationRunner: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { status, result } = useWorkerTeamIdMigration();

  React.useEffect(() => {
    if (status === 'done' && result && result.updated > 0) {
      console.log(`[App] Migration completed: ${result.updated} reports updated`);
    }

  }, [status, result]);

  return <>{children}</>;
};

const DashboardLayoutWrapper = () => (
  <DashboardLayout>
    <MasterDataLoadNotice />
    <React.Suspense fallback={<AppIntroScreen message="업무 화면 준비 중" />}>
      <Outlet />
    </React.Suspense>
  </DashboardLayout>
);

const ADMIN_ROLE_KEYS = [
  'admin',
  'administrator',
  'super_admin',
  'owner',
  'manager',
  'dev',
  'developer',
  'system_admin',
  'jhl2vtnk9v3c4eiz4qqi',
  'pos_jhl2vtnk9v3c4eiz4qqi',
  '관리자',
  '사장',
  '실장',
  '매니저',
  '메니저',
  '개발',
  '개발자',
  '시스템관리자',
];

const isAdminLike = (profile: UserData | null): boolean => {
  const roles = [
    profile?.role,
    profile?.position,
    ...(Array.isArray(profile?.additionalPositions) ? profile.additionalPositions : []),
  ];
  return roles.some((role) => ADMIN_ROLE_KEYS.includes(String(role || '').trim().toLowerCase()));
};

export const AccountOnboardingGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = React.useState(true);
  const [profile, setProfile] = React.useState<UserData | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [accessError, setAccessError] = React.useState(false);
  const [retrySetup, setRetrySetup] = React.useState(false);

  React.useEffect(() => {
    if (isDevAdminSessionEnabled()) {
      setLoading(false);
      return undefined;
    }

    let alive = true;
    let revision = 0;
    let lastAccessKey: string | undefined;
    let verified = false;
    let pendingVerification: { key: string; promise: Promise<unknown> } | undefined;
    if (!currentUser?.uid) {
      setProfile(null);
      setLoading(false);
      return () => {
        alive = false;
      };
    }

    setLoading(true);
    setAccessError(false);
    const unsubscribe = onSnapshot(doc(db, 'users', currentUser.uid), { includeMetadataChanges: true }, async (snapshot) => {
      if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return;
      const request = ++revision;
      const loaded = snapshot.exists() ? ({ uid: snapshot.id, ...snapshot.data() } as UserData) : null;
      const firstProfile = lastAccessKey === undefined && refreshKey === 0;
      const key = JSON.stringify(Object.entries(loaded ?? {})
        .filter(([field]) => !['lastLogin', 'updatedAt', 'displayName', 'photoURL'].includes(field))
        .sort(([left], [right]) => left.localeCompare(right)));
      if (key !== lastAccessKey) {
        lastAccessKey = key;
        verified = false;
        pendingVerification = undefined;
      }
      try {
        if (loaded?.status === 'active' && !verified) {
          if (pendingVerification?.key !== key) {
            const verify = async () => {
              if (loaded.accountType === 'worker') {
                if (firstProfile) {
                  const token = await currentUser.getIdTokenResult().catch(() => null);
                  if (token && canReuseScopedWorkerClaims(loaded, token.claims)) return;
                }
                const status = await accountLinkService.getMyStatus({ refreshAccessClaims: true });
                if (status.user.status !== 'active') throw new Error('Account status changed');
              }
              return currentUser.getIdToken(true);
            };
            const promise = verify().finally(() => {
              if (pendingVerification?.promise === promise) pendingVerification = undefined;
            });
            pendingVerification = { key, promise };
          }
          await pendingVerification.promise;
        } else {
          pendingVerification = undefined;
        }
        if (alive && request === revision) {
          if (!verified) invalidateTeamScopedCache();
          verified = true;
          setAccessError(false);
          setProfile(loaded);
          setLoading(false);
        }
      } catch {
        if (alive && request === revision) { setAccessError(true); setLoading(false); }
      }
    }, () => {
      revision += 1;
      verified = false;
      pendingVerification = undefined;
      if (alive) { setAccessError(true); setLoading(false); }
    });

    return () => {
      alive = false;
      unsubscribe();
    };
  }, [currentUser?.uid, refreshKey]);

  if (isDevAdminSessionEnabled()) {
    return <>{children}</>;
  }

  if (loading) {
    return <AppIntroScreen message="계정 정보를 확인하는 중" />;
  }

  if (accessError) return <div role="alert" className="min-h-screen bg-slate-50 p-8 text-center">
    <p>계정 승인 상태와 권한을 확인하지 못했습니다. 다시 확인해 주세요.</p>
    <button type="button" className="mt-4 rounded-lg bg-indigo-600 px-6 py-3 text-white" onClick={() => setRefreshKey(value => value + 1)}>다시 확인</button>
  </div>;

  const onboardingMode = resolveAccountOnboardingMode({
    profile,
    retrySetup,
    adminLike: isAdminLike(profile),
  });

  if (Boolean(currentUser?.uid) && onboardingMode === 'setup') {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-8">
        <ProfileSetup onComplete={() => {
          setRetrySetup(false);
          setRefreshKey((prev) => prev + 1);
        }} />
      </div>
    );
  }

  if (onboardingMode === 'status' && profile) {
    return (
      <AccountApprovalStatus
        profile={profile}
        onRefresh={() => setRefreshKey((prev) => prev + 1)}
        onRetry={() => setRetrySetup(true)}
      />
    );
  }

  return <TeamWorkflowGate profile={profile}>{children}</TeamWorkflowGate>;
};

const ProtectedRouteShell: React.FC = () => {
  const { pathname } = useLocation();
  const hasSelfContainedRequestData = [
    '/manpower/team-worker-requests',
    '/manpower/team-account-approvals',
    '/support/team-expense-requests',
    '/jeonkuk/recruitment',
    TEAM_SITE_PATH,
    INVESTMENT_PATH,
  ].includes(pathname.replace(/\/+$/, ''));
  return (
    <AccountOnboardingGate>
      <MigrationRunner>
        <MasterDataProvider autoLoad={!hasSelfContainedRequestData}>
          <DashboardLayoutWrapper />
        </MasterDataProvider>
      </MigrationRunner>
    </AccountOnboardingGate>
  );
};

export default ProtectedRouteShell;
