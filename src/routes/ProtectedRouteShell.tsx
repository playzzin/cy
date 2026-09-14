import React from 'react';
import { Outlet } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import DashboardLayout from '../components/layout/DashboardLayout';
import AppIntroScreen from '../components/common/AppIntroScreen';
import ProfileSetup from '../components/auth/ProfileSetup';
import AccountApprovalStatus from '../components/auth/AccountApprovalStatus';
import { MasterDataProvider } from '../contexts/MasterDataContext';
import { useAuth } from '../contexts/AuthContext';
import { useWorkerTeamIdMigration } from '../hooks/useWorkerTeamIdMigration';
import type { UserData } from '../services/userService';
import { db } from '../config/firebase';
import { isDevAdminSessionEnabled } from '../utils/devAdminSession';
import { resolveAccountOnboardingMode } from '../utils/accountOnboardingState';

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

const AccountOnboardingGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = React.useState(true);
  const [profile, setProfile] = React.useState<UserData | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [retrySetup, setRetrySetup] = React.useState(false);

  React.useEffect(() => {
    if (isDevAdminSessionEnabled()) {
      setLoading(false);
      return undefined;
    }

    let alive = true;
    if (!currentUser?.uid) {
      setProfile(null);
      setLoading(false);
      return () => {
        alive = false;
      };
    }

    setLoading(true);
    const unsubscribe = onSnapshot(doc(db, 'users', currentUser.uid), async (snapshot) => {
      const loaded = snapshot.exists()
        ? ({ uid: snapshot.id, ...snapshot.data() } as UserData)
        : null;
      if (loaded?.status === 'active') {
        await currentUser.getIdToken(true).catch((error) => {
          console.warn('[AccountOnboardingGate] Failed to refresh the access token.', error);
        });
      }
      if (alive) {
        setProfile(loaded);
        setLoading(false);
      }
    }, (error) => {
      console.error('[AccountOnboardingGate] Failed to subscribe to user profile:', error);
      if (alive) {
        setProfile(null);
        setLoading(false);
      }
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

  return <>{children}</>;
};

const ProtectedRouteShell: React.FC = () => (
  <AccountOnboardingGate>
    <MigrationRunner>
      <MasterDataProvider>
        <DashboardLayoutWrapper />
      </MasterDataProvider>
    </MigrationRunner>
  </AccountOnboardingGate>
);

export default ProtectedRouteShell;
