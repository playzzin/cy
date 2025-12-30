import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { MasterDataProvider } from './contexts/MasterDataContext';
import DashboardLayout from './components/layout/DashboardLayout';
import PrivateRoute from './components/auth/PrivateRoute';

import DashboardPage from './pages/DashboardPage';
import DailyReportPage from './pages/report/DailyReportPage';
import TestSettingsPage from './pages/settings/TestSettingsPage';
import DailyDispatchPage from './pages/assignment/DailyDispatchPage';
import TeamAssignmentPage from './pages/assignment/TeamAssignmentPage';
import SiteAssignmentPage from './pages/assignment/SiteAssignmentPage';
import SupportAssignmentPage from './pages/assignment/SupportAssignmentPage';
import PositionManager from './pages/hr/PositionManager';
import RateChangePage from './pages/hr/RateChangePage';
import SupportSettingsPage from './pages/support/SupportSettingsPage';
import SupportStatusPage from './pages/support/SupportStatusPage';
import AccommodationManager from './pages/support/AccommodationManager';
import MaterialMasterPage from './pages/materials/MaterialMasterPage';
import MaterialInboundPage from './pages/materials/MaterialInboundPage';
import MaterialOutboundPage from './pages/materials/MaterialOutboundPage';
import MaterialTransactionsPage from './pages/materials/MaterialTransactionsPage';
import MaterialInventoryPage from './pages/materials/MaterialInventoryPage';
import MaterialInventoryBySitePage from './pages/materials/MaterialInventoryBySitePage';
import CompanyDatabase from './pages/database/CompanyDatabase';
import ManpowerInputPage from './pages/manpower/ManpowerInputPage';
import WorkerDatabase from './pages/database/WorkerDatabase';
import TeamDatabase from './pages/database/TeamDatabase';
import SiteDatabase from './pages/database/SiteDatabase';
import DailyReportDragDropPage from './pages/report/DailyReportDragDropPage';
import DailyReportV2Page from './pages/report/DailyReportV2Page';
import SmartWorkerRegistrationPage from './pages/manpower/SmartWorkerRegistrationPage';
import SmartTeamRegistrationPage from './pages/manpower/SmartTeamRegistrationPage';
import SmartCompanyRegistrationPage from './pages/database/SmartCompanyRegistrationPage';
import SmartSiteRegistrationPage from './pages/manpower/SmartSiteRegistrationPage';
import SmartDailyReportRegistrationPage from './pages/report/SmartDailyReportRegistrationPage';
import PayslipPage from './pages/payroll/PayslipPage';
import TaxAdvanceTeamPayslipPage from './pages/payroll/TaxAdvanceTeamPayslipPage';
import WagePaymentPage from './pages/payroll/WagePaymentPage';
import DailyWageDraftPage from './pages/payroll/DailyWageDraftPage';
import MonthlyWageDraftPage from './pages/payroll/MonthlyWageDraftPage';
import SupportTeamPaymentPage from './pages/payroll/SupportTeamPaymentPage';
import SupportClaimPage from './pages/payroll/SupportClaimPage';
import PayrollRateManagementPage from './pages/payroll/PayrollRateManagementPage';
import AdvancePaymentPage from './pages/payroll/AdvancePaymentPage';
import WorkerBulkRegistrationPage from './pages/manpower/WorkerBulkRegistrationPage';
import SignManagementPage from './pages/payroll/SignManagementPage';
import SignatureGeneratorPage from './pages/payroll/SignatureGeneratorPage';
import DelegationLetterPage from './pages/payroll/DelegationLetterPage';
import DelegationLetterV2Page from './pages/payroll/DelegationLetterV2Page';
import LaborExchangePage from './pages/payroll/LaborExchangePage';
import SupportRateManagementPage from './pages/support/SupportRateManagementPage';
import TeamBasedPaymentDraftPage from './pages/payroll/TeamBasedPaymentDraftPage';
import TeamBasedPaymentDraftPageV2 from './pages/payroll/TeamBasedPaymentDraftPageV2';

import Login from './components/auth/Login';
import IntegratedDatabase from './pages/database/ManpowerDatabase';
import ManualPage from './pages/manual/ManualPage';
import ProfilePage from './pages/profile/ProfilePage';
import StorageManagerPage from './pages/storage/StorageManagerPage';
import SchemaDesignViewer from './pages/structure/SchemaDesignViewer';
import WhiteboardStatusBoard from './pages/jeonkuk/WhiteboardStatusBoard';
import IntegratedSupportStatusBoard from './pages/dashboard/IntegratedSupportStatusBoard';
import TotalPersonnelHistoryPage from './pages/jeonkuk/TotalPersonnelHistoryPage';
import DataIntegrityPage from './pages/jeonkuk/DataIntegrityPage';
import StatusManagementPage from './pages/jeonkuk/StatusManagementPage';
import TestDataGeneratorPage from './pages/jeonkuk/TestDataGeneratorPage';
import TestDailyReportGeneratorPage from './pages/jeonkuk/TestDailyReportGeneratorPage';
import DailyReportExcelPage from './pages/report/DailyReportExcelPage';
import DataSyncStatusPage from './pages/system/DataSyncStatusPage';

import SettingsPage from './pages/SettingsPage';
import SystemMessagePage from './pages/settings/SystemMessagePage';
import MassDailyReportUploader from './pages/report/MassDailyReportUploader';
import SystemManagementPage from './pages/system/SystemManagementPage';
import WorkerMassUploader from './pages/mass-upload/WorkerMassUploader';
import TeamMassUploader from './pages/mass-upload/TeamMassUploader';
import SiteMassUploader from './pages/mass-upload/SiteMassUploader';
import CompanyMassUploader from './pages/mass-upload/CompanyMassUploader';
import DailyReportMassUploader from './pages/mass-upload/DailyReportMassUploader';
import IntegratedMassUploader from './pages/mass-upload/IntegratedMassUploader';
import SafeExcelGuidePage from './pages/manual/SafeExcelGuidePage';
import ActivityLogPage from './pages/admin/ActivityLogPage';
import ComponentManagementPage from './pages/admin/ComponentManagementPage';
import ComponentGalleryPage from './pages/design-system/ComponentGalleryPage';
import DataConsolePage from './pages/admin/DataConsolePage';
import DataBackupPage from './pages/admin/DataBackupPage';
import StatusGraphPage from './pages/jeonkuk/StatusGraphPage';
import SalaryModelUpdater from './pages/admin/SalaryModelUpdater';
import AdminDataIntegrityPage from './pages/admin/AdminDataIntegrityPage';
import AgentPlayground from './pages/developer/AgentPlayground';
import AdvancedMenuManager from './pages/admin/menu/AdvancedMenuManager';

import TeamPersonnelStatusReportPage from './pages/report/TeamPersonnelStatusReportPage';

import FirestoreStructureViewer from './pages/database/FirestoreStructureViewer';
import PayrollDesignViewer from './pages/structure/PayrollDesignViewer';

import ProjectFileStructureViewer from './pages/admin/ProjectFileStructureViewer';
import DataRelationshipViewer from './pages/structure/DataRelationshipViewer';
import RelationshipConsolePage from './pages/admin/RelationshipConsole';
import ExcelDataGuideViewer from './pages/structure/ExcelDataGuideViewer';
import AccommodationDesignViewer from './pages/structure/AccommodationDesignViewer';

import LibraryGuideViewer from './pages/structure/LibraryGuideViewer';
import OrganizationChartPage from './pages/structure/OrganizationChartPage';
import DesignManagementPage from './pages/design/DesignManagementPage';
import CheongyeonOrganizationPage from './pages/cheongyeon/CheongyeonOrganizationPage';
import CheongyeonGreetingPage from './pages/cheongyeon/CheongyeonGreetingPage';
import CheongyeonDirectionsPage from './pages/cheongyeon/CheongyeonDirectionsPage';

import HomepageClientProgressPage from './pages/homepage/HomepageClientProgressPage';
import HomepageRequestListPage from './pages/homepage/HomepageRequestListPage';
import HomepageRequestDetailPage from './pages/homepage/HomepageRequestDetailPage';
import HomepageRequestCreatePage from './pages/homepage/HomepageRequestCreatePage';
import TaxInvoicePage from './pages/taxinvoice/TaxInvoicePage';
import TaxInvoiceLedgerPage from './pages/taxinvoice/TaxInvoiceLedgerPage';
import ReceivablesManagementPage from './pages/taxinvoice/ReceivablesManagementPage';
import ReceivablesDashboardPage from './pages/taxinvoice/ReceivablesDashboardPage';
import PartnerTransactionLedgerPage from './pages/taxinvoice/PartnerTransactionLedgerPage';
import KakaoNotificationPage from './pages/taxinvoice/KakaoNotificationPage';
import { useWorkerTeamIdMigration } from './hooks/useWorkerTeamIdMigration';
import { menuServiceV11 } from './services/menuServiceV11';
import { RefineWrapper } from './providers/refine/RefineWrapper';
import RefineSiteList from './pages/refine/RefineSiteList';
import { RefineSmartSelectDemo } from './pages/refine/RefineSmartSelectDemo';
import RefineWorkerList from './pages/refine/RefineWorkerList';
import RefineTeamList from './pages/refine/RefineTeamList';
import RefineCompanyList from './pages/refine/RefineCompanyList';

// 마이그레이션 실행 래퍼 (앱 시작시 한 번만 실행)
const MigrationRunner: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { status, result } = useWorkerTeamIdMigration();

  // 마이그레이션 결과 로깅 (콘솔에서만)
  React.useEffect(() => {
    if (status === 'done' && result && result.updated > 0) {
      console.log(`[App] Migration completed: ${result.updated} reports updated`);
    }

    // Auto-migrate menu structure for Admin and Prune Duplicates
    menuServiceV11.ensureSystemMenuExists()
      .then(() => menuServiceV11.pruneDuplicates())
      .catch(err => console.error(err));
  }, [status, result]);

  return <>{children}</>;
};

const DashboardLayoutWrapper = () => (
  <DashboardLayout>
    <Outlet />
  </DashboardLayout>
);


const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/homepage/client/:requestId" element={<HomepageClientProgressPage />} />

          {/* Protected Routes */}
          <Route element={
            <PrivateRoute>
              <MigrationRunner>
                <MasterDataProvider>
                  <DashboardLayoutWrapper />
                </MasterDataProvider>
              </MigrationRunner>
            </PrivateRoute>
          }>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />

            {/* Reports */}
            <Route path="/reports">
              <Route path="daily" element={<DailyReportPage />} />
              <Route path="daily-v2" element={<DailyReportV2Page />} />
              <Route path="team-personnel-status" element={<TeamPersonnelStatusReportPage />} />
              <Route path="list" element={<div>보고서 목록</div>} />
            </Route>

            <Route path="/report/excel" element={<DailyReportExcelPage />} />
            <Route path="/report/mass-upload" element={<MassDailyReportUploader />} />
            <Route path="/report/smart-registration" element={<SmartDailyReportRegistrationPage />} />

            {/* Labor Management */}
            <Route path="/labor">
              <Route index element={<div>인력 관리</div>} />
              <Route path="workers" element={<div>작업자 목록</div>} />
            </Route>

            {/* Manpower Management */}
            <Route path="/manpower">
              <Route path="team-management" element={<TeamDatabase />} />
              <Route path="smart-registration" element={<SmartWorkerRegistrationPage />} />
              <Route path="smart-registration-grid" element={<WorkerBulkRegistrationPage />} />
              <Route path="smart-team-registration" element={<SmartTeamRegistrationPage />} />
              <Route path="smart-site-registration" element={<SmartSiteRegistrationPage />} />
            </Route>

            {/* Refine Integration - Safe Zone */}
            <Route element={<RefineWrapper />}>
              <Route path="/manpower/refine-sites" element={<RefineSiteList />} />
              <Route path="/manpower/refine-workers" element={<RefineWorkerList />} />
              <Route path="/manpower/refine-teams" element={<RefineTeamList />} />
              <Route path="/manpower/refine-companies" element={<RefineCompanyList />} />
              <Route path="/manpower/refine-smart-select" element={<RefineSmartSelectDemo />} />
            </Route>

            {/* Database Management */}
            <Route path="/database">
              <Route path="company-db" element={<CompanyDatabase />} />
              <Route path="manpower-db" element={<IntegratedDatabase />} />
              <Route path="smart-company-registration" element={<SmartCompanyRegistrationPage />} />
            </Route>

            {/* Mass Upload (Excel) */}
            <Route path="/upload/worker" element={<WorkerMassUploader />} />
            <Route path="/upload/team" element={<TeamMassUploader />} />
            <Route path="/upload/site" element={<SiteMassUploader />} />
            <Route path="/upload/company" element={<CompanyMassUploader />} />
            <Route path="/mass-upload/daily-report" element={<DailyReportMassUploader />} />
            <Route path="/mass-upload/integrated" element={<IntegratedMassUploader />} />
            <Route path="/manual/excel-guide" element={<SafeExcelGuidePage />} />

            {/* Manpower Input (Migrated from insik.html) */}
            <Route path="/manpower" element={<ManpowerInputPage />} />

            {/* Database Management */}
            {/* Payroll Management */}
            <Route path="/payroll">
              <Route path="wage-payment" element={<WagePaymentPage />} />
              <Route path="daily-wage" element={<DailyWageDraftPage />} />
              <Route path="monthly-wage" element={<MonthlyWageDraftPage />} />
              <Route path="support-team" element={<SupportTeamPaymentPage />} />
              <Route path="support-claim" element={<SupportClaimPage />} />
              <Route path="rate-management" element={<PayrollRateManagementPage />} />
              <Route path="advance-payment" element={<AdvancePaymentPage />} />
              <Route path="team-payslip" element={<TaxAdvanceTeamPayslipPage />} />
              <Route path="sign-management" element={<SignManagementPage />} />
              <Route path="signature-generator" element={<SignatureGeneratorPage />} />
              <Route path="team-payment-draft" element={<TeamBasedPaymentDraftPageV2 />} />
              <Route path="team-payment-draft-legacy" element={<TeamBasedPaymentDraftPage />} />
              <Route path="tax-invoice" element={<TaxInvoicePage />} />
              <Route path="tax-invoice-ledger" element={<TaxInvoiceLedgerPage />} />
              {/* Taxinvoice new routes */}
              <Route path="taxinvoice/issue" element={<TaxInvoicePage />} />
              <Route path="taxinvoice/ledger" element={<TaxInvoiceLedgerPage />} />
              <Route path="taxinvoice/receivables" element={<ReceivablesManagementPage />} />
              <Route path="taxinvoice/dashboard" element={<ReceivablesDashboardPage />} />
              <Route path="partner-ledger" element={<PartnerTransactionLedgerPage />} />
              <Route path="kakao-notification" element={<KakaoNotificationPage />} />
              <Route path="delegation-letter" element={<DelegationLetterPage />} />
              <Route path="delegation-letter-v2" element={<DelegationLetterV2Page />} />
              <Route path="labor-exchange" element={<LaborExchangePage />} />
            </Route>

            {/* Support Management */}
            <Route path="/support">
              <Route path="rate-management" element={<SupportRateManagementPage />} />
              <Route path="labor-exchange" element={<LaborExchangePage />} />
            </Route>

            <Route
              path="/planning/advance-ledger"
              element={<Navigate to="/payroll/advance-payment?tab=register" replace />}
            />



            {/* Homepage Request Management (Internal) */}
            <Route path="/homepage">
              <Route path="requests" element={<HomepageRequestListPage />} />
              <Route path="requests/new" element={<HomepageRequestCreatePage />} />
              <Route path="requests/:requestId" element={<HomepageRequestDetailPage />} />
            </Route>



            {/* User Manual */}
            <Route path="/manual" element={<ManualPage />} />

            {/* Profile Settings */}
            <Route path="/profile" element={<ProfilePage />} />

            {/* Storage Management */}
            <Route path="/storage" element={<StorageManagerPage />} />

            {/* Settings */}
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/settings/system-messages" element={<SystemMessagePage />} />
            <Route path="/test-settings" element={<TestSettingsPage />} />

            {/* Assignment Management */}
            <Route path="/assignment/daily-dispatch" element={<DailyDispatchPage />} />
            <Route path="/assignment/team-assignment" element={<TeamAssignmentPage />} />
            <Route path="/assignment/site-assignment" element={<SiteAssignmentPage />} />

            {/* HR Management */}
            <Route path="/hr/position-management" element={<PositionManager />} />
            <Route path="/hr/position-assignment" element={<Navigate to="/hr/position-management" replace />} />
            <Route path="/hr/rate-change" element={<RateChangePage />} />

            {/* Support Management */}
            <Route path="/support/settings" element={<SupportSettingsPage />} />
            <Route path="/support/status" element={<SupportStatusPage />} />
            <Route path="/support/accommodation" element={<AccommodationManager />} />

            {/* Materials Management */}
            <Route path="/materials/master" element={<MaterialMasterPage />} />
            <Route path="/materials/inbound" element={<MaterialInboundPage />} />
            <Route path="/materials/outbound" element={<MaterialOutboundPage />} />
            <Route path="/materials/transactions" element={<MaterialTransactionsPage />} />
            <Route path="/materials/inventory" element={<MaterialInventoryPage />} />
            <Route path="/materials/inventory-by-site" element={<MaterialInventoryBySitePage />} />

            {/* Company DB */}
            <Route path="/database/company-db" element={<CompanyDatabase />} />

            {/* 전국JS ERP */}
            <Route path="/jeonkuk">
              <Route path="worker-registration" element={<WorkerDatabase />} />
              <Route path="team-registration" element={<TeamDatabase />} />
              <Route path="site-registration" element={<SiteDatabase />} />
              <Route path="support-assignment" element={<SupportAssignmentPage />} />
              <Route path="report-register" element={<DailyReportDragDropPage />} />
              <Route path="db-structure" element={<FirestoreStructureViewer />} />
              <Route path="db-design" element={<SchemaDesignViewer />} />
              <Route path="integrated-status" element={<WhiteboardStatusBoard />} />
              <Route path="status-graph" element={<StatusGraphPage />} />
              <Route path="integrated-support-status" element={<IntegratedSupportStatusBoard />} />
              <Route path="total-history" element={<TotalPersonnelHistoryPage />} />
              <Route path="data-integrity" element={<DataIntegrityPage />} />
              <Route path="status-management" element={<StatusManagementPage />} />
              <Route path="test-data-generator" element={<TestDataGeneratorPage />} />
              <Route path="test-daily-report-generator" element={<TestDailyReportGeneratorPage />} />
              <Route path="salary-model-updater" element={<SalaryModelUpdater />} />
            </Route>

            {/* Design Management */}
            <Route path="/design/management" element={<DesignManagementPage />} />

            {/* Admin Routes */}
            <Route path="/admin">
              <Route path="component-management" element={<ComponentManagementPage />} />
              <Route path="activity-logs" element={<ActivityLogPage />} />

              <Route path="project-structure" element={<ProjectFileStructureViewer />} />
              <Route path="data-relationships" element={<DataRelationshipViewer />} />
              <Route path="relationship-console" element={<RelationshipConsolePage />} />
              <Route path="excel-guide" element={<ExcelDataGuideViewer />} />
              <Route path="library-guide" element={<LibraryGuideViewer />} />
              <Route path="console" element={<DataConsolePage />} />
              <Route path="integrity" element={<AdminDataIntegrityPage />} />
              <Route path="data-backup" element={<DataBackupPage />} />
              <Route path="accommodation-design" element={<AccommodationDesignViewer />} />
              <Route path="agent-playground" element={<AgentPlayground />} />
              <Route path="menu-manager" element={<AdvancedMenuManager />} />
            </Route>

            {/* Design System */}
            <Route path="/design-system" element={<ComponentGalleryPage />} />

            {/* Daily Report Routes */}
            <Route path="/system-management" element={<SystemManagementPage />} />
            <Route path="/system/sync-status" element={<DataSyncStatusPage />} />
            <Route path="/structure/organization" element={<OrganizationChartPage />} />
            <Route path="/cheongyeon/organization" element={<CheongyeonOrganizationPage />} />
            <Route path="/cheongyeon/greeting" element={<CheongyeonGreetingPage />} />
            <Route path="/cheongyeon/directions" element={<CheongyeonDirectionsPage />} />

          </Route>

          {/* Catch all - redirect to dashboard */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;
