import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { MasterDataProvider } from './contexts/MasterDataContext';
import DashboardLayout from './components/layout/DashboardLayout';
import PrivateRoute from './components/auth/PrivateRoute';

import DashboardPage from './pages/DashboardPage';
import { DashboardExecutiveView } from './components/dashboard/executive/DashboardExecutiveView';
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
import WorkerSummaryPage from './pages/manpower/WorkerSummaryPage';
import { VehicleManagerPage } from './pages/support/VehicleManagerPage';

import { CardManagerPage } from './pages/support/CardManagerPage';
import MaterialMasterPage from './pages/materials/MaterialMasterPage';
import MaterialInboundPage from './pages/materials/MaterialInboundPage';
import MaterialOutboundPage from './pages/materials/MaterialOutboundPage';
import MaterialTransactionsPage from './pages/materials/MaterialTransactionsPage';
import MaterialInventoryPage from './pages/materials/MaterialInventoryPage';
// import MaterialInventoryBySitePage from './pages/materials/MaterialInventoryBySitePage'; // Fixed import
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
import DailyWageStatementPage from './pages/payroll/DailyWageStatementPage';
import MonthlyWageDraftPage from './pages/payroll/MonthlyWageDraftPage';
import SupportTeamPage from './pages/payroll/SupportTeamPage';
import SupportClaimPage from './pages/payroll/SupportClaimPage';
import PayrollRateManagementPage from './pages/payroll/PayrollRateManagementPage';
import AdvancePaymentPage from './pages/payroll/AdvancePaymentPage';
import PayrollStatisticsPage from './pages/payroll/PayrollStatisticsPage';
import WorkerBulkRegistrationPage from './pages/manpower/WorkerBulkRegistrationPage';
import SignManagementPage from './pages/payroll/SignManagementPage';
import SignatureGeneratorPage from './pages/payroll/SignatureGeneratorPage';
import DelegationLetterPage from './pages/payroll/DelegationLetterPage';
import DelegationLetterV2Page from './pages/payroll/DelegationLetterV2Page';
import DelegationBuilderPage from './pages/payroll/DelegationBuilderPage';
import DelegationLetterV5Page from './pages/payroll/DelegationLetterV5Page';
import LaborCostStatementGeneratorPage from './pages/payroll/LaborCostStatementGeneratorPage';

import LaborExchangePage from './pages/payroll/LaborExchangePage';
import TeamSettlementPage from './pages/payroll/TeamSettlementPage';
import SupportRateManagementPage from './pages/support/SupportRateManagementPage';
import TeamBasedPaymentDraftPage from './pages/payroll/TeamBasedPaymentDraftPage';
import TeamBasedPaymentDraftPageV2 from './pages/payroll/TeamBasedPaymentDraftPageV2';
import EmploymentCertificatePage from './pages/hr/EmploymentCertificatePage';
import DailyReportStatisticsPage from './pages/report/DailyReportStatisticsPage';
import OfficeManagementPage from './pages/office/OfficeManagementPage';

import Login from './components/auth/Login';
import IntegratedDatabase from './pages/database/ManpowerDatabase';
import ManualPage from './pages/manual';
import ProfilePage from './pages/profile/ProfilePage';

import StorageManagerPage from './pages/storage/StorageManagerPage';
import { GoogleDriveManagerPage } from './pages/storage/GoogleDriveManagerPage';
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
import AISettingsPage from './pages/settings/AISettingsPage';
import MassDailyReportUploader from './pages/report/MassDailyReportUploader';
import SystemManagementPage from './pages/system/SystemManagementPage';
import WorkerMassUploader from './pages/mass-upload/WorkerMassUploader';
import TeamMassUploader from './pages/mass-upload/TeamMassUploader';
import SiteMassUploader from './pages/mass-upload/SiteMassUploader';
import CompanyMassUploader from './pages/mass-upload/CompanyMassUploader';
import DailyReportMassUploader from './pages/mass-upload/DailyReportMassUploader';
import IntegratedMassUploader from './pages/mass-upload/IntegratedMassUploader';
import IntegratedDailyReportUploader from './pages/mass-upload/IntegratedDailyReportUploader';
import CompanyManagementPage from './pages/company/CompanyManagementPage';
import CompanyRegistrationPage from './pages/company/CompanyRegistrationPage';
import SafeExcelGuidePage from './pages/manual/SafeExcelGuidePage';
import ActivityLogPage from './pages/admin/ActivityLogPage';
import ComponentManagementPage from './pages/admin/ComponentManagementPage';
import ComponentGalleryPage from './pages/design-system/ComponentGalleryPage';
import { MenuManagementPage } from './pages/admin/MenuManagementPage';
import DataConsolePage from './pages/admin/DataConsolePage';
import DataBackupPage from './pages/admin/DataBackupPage';
import StatusGraphPage from './pages/jeonkuk/StatusGraphPage';
import NationwidePartnersPage from './pages/jeonkuk/NationwidePartnersPage';
import SalaryModelUpdater from './pages/admin/SalaryModelUpdater';
import AdminDataIntegrityPage from './pages/admin/AdminDataIntegrityPage';
import UserManagementPage from './pages/admin/UserManagementPage';
import AgentPlayground from './pages/developer/AgentPlayground';
import AgentDashboard from './pages/developer/AgentDashboard';
import AdvancedMenuManager from './pages/admin/menu/AdvancedMenuManager';
import RoleMenuAssignmentPage from './pages/admin/RoleMenuAssignmentPage';
import SystemStatusPage from './pages/admin/SystemStatusPage';

import TeamPersonnelStatusReportPage from './pages/report/TeamPersonnelStatusReportPage';
import SettlementArchitecturePage from './pages/design/SettlementArchitecturePage';

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
import CheongyeonOrgChartPage from './pages/cheongyeon/CheongyeonOrgChartPage';
import CheongyeonGreetingPage from './pages/cheongyeon/CheongyeonGreetingPage';
import CheongyeonDirectionsPage from './pages/cheongyeon/CheongyeonDirectionsPage';
import CheongyeonHome from './pages/cheongyeon/CheongyeonHome';
import CheongyeonTechVisionPage from './pages/cheongyeon/CheongyeonTechVisionPage';
import CompanyLandingPage from './pages/company/CompanyLandingPage';

import HomepageClientProgressPage from './pages/homepage/HomepageClientProgressPage';
import HomepageRequestListPage from './pages/homepage/HomepageRequestListPage';
import { KakaoTestPage } from './pages/kakao/KakaoTestPage';
import HomepageRequestDetailPage from './pages/homepage/HomepageRequestDetailPage';
import HomepageRequestCreatePage from './pages/homepage/HomepageRequestCreatePage';
import TaxInvoicePage from './pages/taxinvoice/TaxInvoicePage';
import TaxInvoiceLedgerPage from './pages/taxinvoice/TaxInvoiceLedgerPage';
import ReceivablesManagerPage from './pages/taxinvoice/ReceivablesManagerPage';

import ReceivablesDashboardPage from './pages/taxinvoice/ReceivablesDashboardPage';
import PartnerTransactionLedgerPage from './pages/taxinvoice/PartnerTransactionLedgerPage';
import WorkbookLedgerPage from './pages/taxinvoice/WorkbookLedgerPage';
import KakaoNotificationPage from './pages/taxinvoice/KakaoNotificationPage';
import AccountInquiryPage from './pages/taxinvoice/AccountInquiryPage';
import { useWorkerTeamIdMigration } from './hooks/useWorkerTeamIdMigration';
import { menuServiceV11 } from './services/menuServiceV11';
import { RefineWrapper } from './providers/refine/RefineWrapper';
import RefineSiteList from './pages/refine/RefineSiteList';
import { RefineSmartSelectDemo } from './pages/refine/RefineSmartSelectDemo';
import { ProjectGalleryPage } from './pages/gallery/ProjectGalleryPage';
import { AiImageGalleryPage } from './pages/gallery/AiImageGalleryPage';
import SiteManagementPage from './pages/site/SiteManagementPage';
import RefineWorkerList from './pages/refine/RefineWorkerList';
import RefineTeamList from './pages/refine/RefineTeamList';
import RefineCompanyList from './pages/refine/RefineCompanyList';
import { MemoPage } from './features/smart-memo/pages/MemoPage'; // New Feature Import
import BarobillKakaoConnectionPage from './pages/admin/settings/BarobillKakaoConnectionPage';
import KakaoSenderPage from './pages/helper/KakaoSenderPage';
import TodoPage from './pages/helper/TodoPage';
import TaxAffairsPage from './pages/tax/TaxAffairsPage';
import KakaoMessageCenterPage from './pages/kakao/KakaoMessageCenterPage';
import FreelancerPage from './pages/manpower/FreelancerPage';

// 마이그레이션 실행 래퍼 (앱 시작시 한 번만 실행)
const MigrationRunner: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { status, result } = useWorkerTeamIdMigration();


  // 마이그레이션 결과 로깅 (콘솔에서만)
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
    <Outlet />
  </DashboardLayout>
);




const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Login />} />
          <Route path="/login" element={<Login />} />
          <Route path="/homepage/client/:requestId" element={<HomepageClientProgressPage />} />
          <Route path="/company/landing" element={<CompanyLandingPage />} />

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

            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/dashboard-v2" element={<DashboardExecutiveView />} />
            {/* 청연사이트 전용 대시보드 */}
            <Route path="/dashboard2" element={<CheongyeonHome />} />

            {/* Reports */}
            {/* Daily Reports */}
            <Route path="/reports/daily" element={<DailyReportPage />} />
            <Route path="/reports/daily-v2" element={<DailyReportV2Page />} />
            <Route path="/reports/team-personnel-status" element={<TeamPersonnelStatusReportPage />} />
            <Route path="/reports/statistics" element={<DailyReportStatisticsPage />} />
            <Route path="/reports/list" element={<div>보고서 목록</div>} />

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
              <Route path="summary" element={<WorkerSummaryPage />} />
              <Route path="freelancer" element={<FreelancerPage />} />
            </Route>

            {/* Smart Memo System - Phase 5 Integration */}
            <Route path="/memos" element={<MemoPage />} />
            <Route path="/todo" element={<TodoPage />} />

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
            <Route path="/mass-upload/daily-report-integrated" element={<IntegratedDailyReportUploader />} />
            <Route path="/manual/excel-guide" element={<SafeExcelGuidePage />} />

            {/* Manpower Input (Migrated from insik.html) */}
            <Route path="/manpower" element={<ManpowerInputPage />} />

            {/* Database Management */}
            {/* Payroll Management */}
            <Route path="/payroll">
              <Route path="wage-payment" element={<WagePaymentPage />} />
              <Route path="daily-wage" element={<DailyWageDraftPage />} />
              <Route path="daily-wage-statement" element={<DailyWageStatementPage />} />
              <Route path="monthly-wage" element={<MonthlyWageDraftPage />} />
              <Route path="statistics" element={<PayrollStatisticsPage />} />
              <Route path="support-team" element={<SupportTeamPage />} />
              <Route path="support-claim" element={<SupportClaimPage />} />
              <Route path="rate-management" element={<PayrollRateManagementPage />} />
              <Route path="advance-payment" element={<AdvancePaymentPage />} />
              <Route path="team-payslip" element={<TaxAdvanceTeamPayslipPage />} />
              <Route path="sign-management" element={<SignManagementPage />} />
              <Route path="signature-generator" element={<SignatureGeneratorPage />} />
              <Route path="team-payment-draft" element={<TeamBasedPaymentDraftPageV2 />} />
              <Route path="team-payment-draft-legacy" element={<TeamBasedPaymentDraftPage />} />
              <Route path="labor-cost-statement-generator" element={<LaborCostStatementGeneratorPage />} />
              <Route path="tax-invoice" element={<TaxInvoicePage />} />
              <Route path="tax-invoice-ledger" element={<TaxInvoiceLedgerPage />} />
              {/* Taxinvoice new routes */}
              <Route path="taxinvoice/issue" element={<TaxInvoicePage />} />
              <Route path="taxinvoice/ledger" element={<TaxInvoiceLedgerPage />} />
              <Route path="taxinvoice/receivables" element={<ReceivablesManagerPage />} />

              <Route path="taxinvoice/dashboard" element={<ReceivablesDashboardPage />} />
              <Route path="partner-ledger" element={<PartnerTransactionLedgerPage />} />
              <Route path="workbook-ledger" element={<WorkbookLedgerPage />} />
              <Route path="kakao-notification" element={<KakaoNotificationPage />} />
              <Route path="taxinvoice/account-inquiry" element={<AccountInquiryPage />} />
              <Route path="kakao-test" element={<KakaoTestPage />} />
              <Route path="kakao-sender" element={<KakaoSenderPage />} />
              <Route path="kakao-message-center" element={<KakaoMessageCenterPage />} />
              <Route path="barobill-kakao-connection" element={<BarobillKakaoConnectionPage />} />
              <Route path="tax-affairs" element={<TaxAffairsPage />} />
              <Route path="delegation-letter" element={<DelegationLetterPage />} />
              <Route path="delegation-letter-v2" element={<DelegationLetterV2Page />} />
              <Route path="delegation-letter-v3" element={<DelegationBuilderPage />} />
              <Route path="delegation-letter-v5" element={<DelegationLetterV5Page />} />
              <Route path="labor-exchange" element={<LaborExchangePage />} />
              <Route path="team-settlement" element={<TeamSettlementPage />} />
            </Route>

            {/* Office Management */}
            <Route path="/office/management" element={<OfficeManagementPage />} />

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
            <Route path="/storage/google-drive" element={<GoogleDriveManagerPage />} />

            {/* Settings */}
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/settings/ai" element={<AISettingsPage />} />
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
            <Route path="/support/vehicles" element={<VehicleManagerPage />} />
            <Route path="/support/cards" element={<CardManagerPage />} />

            <Route path="/hr/certificate" element={<EmploymentCertificatePage />} />
            {/* Payroll Management */}
            <Route path="/payroll/payslip" element={<PayslipPage />} />

            {/* Materials Management */}
            <Route path="/materials/master" element={<MaterialMasterPage />} />
            <Route path="/materials/inbound" element={<MaterialInboundPage />} />
            <Route path="/materials/outbound" element={<MaterialOutboundPage />} />
            <Route path="/materials/transactions" element={<MaterialTransactionsPage />} />
            <Route path="/materials/inventory" element={<MaterialInventoryPage />} />
            {/* <Route path="/materials/inventory-by-site" element={<MaterialInventoryBySitePage />} /> */}

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
              <Route path="nationwide-partners" element={<NationwidePartnersPage />} />
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
            <Route path="/design/settlement-architecture" element={<SettlementArchitecturePage />} />

            {/* Admin Routes */}
            <Route path="/admin">
              <Route path="user-management" element={<UserManagementPage />} />
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
              <Route path="agent-dashboard" element={<AgentDashboard />} />
              <Route path="menu-manager" element={<AdvancedMenuManager />} />
              <Route path="menu-sync-too" element={<Navigate to="/admin/menu-sync-tool" replace />} />
              <Route path="menu-sync-tool" element={<MenuManagementPage />} />
              <Route path="role-menu" element={<RoleMenuAssignmentPage />} />
              <Route path="system-status" element={<SystemStatusPage />} />
            </Route>

            {/* Design System */}
            <Route path="/design-system" element={<ComponentGalleryPage />} />

            {/* Daily Report Routes */}
            <Route path="/system-management" element={<SystemManagementPage />} />
            <Route path="/system/sync-status" element={<DataSyncStatusPage />} />
            <Route path="/structure/organization" element={<OrganizationChartPage />} />
            <Route path="/cheongyeon/organization" element={<CheongyeonOrgChartPage />} />
            <Route path="/cheongyeon/greeting" element={<CheongyeonGreetingPage />} />
            <Route path="/cheongyeon/directions" element={<CheongyeonDirectionsPage />} />
            <Route path="/cheongyeon/tech-vision" element={<CheongyeonTechVisionPage />} />

            {/* Company */}
            <Route path="/company/management" element={<CompanyManagementPage />} />
            <Route path="/company/registration" element={<CompanyRegistrationPage />} />

            {/* Gallery */}
            <Route path="/gallery/projects" element={<ProjectGalleryPage />} />
            <Route path="/gallery/ai-images" element={<AiImageGalleryPage />} />

            {/* Site Management */}
            <Route path="/site/management" element={<SiteManagementPage />} />

          </Route>

          {/* Catch all - redirect to dashboard */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;
