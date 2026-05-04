import React from 'react';
import { Outlet } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import { MasterDataProvider } from '../contexts/MasterDataContext';
import { useWorkerTeamIdMigration } from '../hooks/useWorkerTeamIdMigration';
import { menuServiceV11 } from '../services/menuServiceV11';

const RouteLoadingFallback: React.FC = () => (
  <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
    로딩 중...
  </div>
);

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
    <React.Suspense fallback={<RouteLoadingFallback />}>
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
