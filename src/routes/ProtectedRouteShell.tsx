import React from 'react';
import { Outlet } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import AppIntroScreen from '../components/common/AppIntroScreen';
import { MasterDataProvider } from '../contexts/MasterDataContext';
import { useWorkerTeamIdMigration } from '../hooks/useWorkerTeamIdMigration';
import { menuServiceV11 } from '../services/menuServiceV11';

const MigrationRunner: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { status, result } = useWorkerTeamIdMigration();

  React.useEffect(() => {
    if (status === 'done' && result && result.updated > 0) {
      console.log(`[App] Migration completed: ${result.updated} reports updated`);
    }

    // Auto-migrate menu structure for Admin and Prune Duplicates
    // Menu configuration is loaded from Firestore
    menuServiceV11.pruneDuplicates()
      .catch(err => console.error(err));
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

const ProtectedRouteShell: React.FC = () => (
  <MigrationRunner>
    <MasterDataProvider>
      <DashboardLayoutWrapper />
    </MasterDataProvider>
  </MigrationRunner>
);

export default ProtectedRouteShell;
