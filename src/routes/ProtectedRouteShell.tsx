import React from 'react';
import { Outlet } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import AppIntroScreen from '../components/common/AppIntroScreen';
import ProfileSetup from '../components/auth/ProfileSetup';
import { MasterDataProvider } from '../contexts/MasterDataContext';
import { useAuth } from '../contexts/AuthContext';
import { useWorkerTeamIdMigration } from '../hooks/useWorkerTeamIdMigration';
import { userService, type UserData } from '../services/userService';
import { isDevAdminSessionEnabled } from '../utils/devAdminSession';

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

  React.useEffect(() => {
    let alive = true;
    const loadProfile = async () => {
      if (!currentUser?.uid) {
        if (alive) {
          setProfile(null);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      try {
        const loaded = await userService.getUser(currentUser.uid);
        if (alive) setProfile(loaded);
      } catch (error) {
        console.error('[AccountOnboardingGate] Failed to load user profile:', error);
        if (alive) setProfile(null);
      } finally {
        if (alive) setLoading(false);
      }
    };

    void loadProfile();
    return () => {
      alive = false;
    };
  }, [currentUser?.uid, refreshKey]);

  if (isDevAdminSessionEnabled()) {
    return <>{children}</>;
  }

  if (loading) {
    return <AppIntroScreen message="계정 정보를 확인하는 중" />;
  }

  const linkedWorkerCount = Array.isArray(profile?.linkedWorkerIds) ? profile?.linkedWorkerIds.length || 0 : 0;
  const shouldSetup =
    Boolean(currentUser?.uid) &&
    !isAdminLike(profile) &&
    profile?.status !== 'active' &&
    !profile?.accountType &&
    linkedWorkerCount === 0;

  if (shouldSetup) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-8">
        <ProfileSetup onComplete={() => setRefreshKey((prev) => prev + 1)} />
      </div>
    );
  }

  return <>{children}</>;
};

const ProtectedRouteShell: React.FC = () => (
  <MigrationRunner>
    <MasterDataProvider>
      <AccountOnboardingGate>
        <DashboardLayoutWrapper />
      </AccountOnboardingGate>
    </MasterDataProvider>
  </MigrationRunner>
);

export default ProtectedRouteShell;
