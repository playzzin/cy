import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import PrivateRoute from './components/auth/PrivateRoute';
import { Login } from './components/auth/index';
import AppIntroScreen from './components/common/AppIntroScreen';

const lazyNamed = <T extends React.ComponentType<any>>(
  loader: () => Promise<unknown>,
  exportName: string
) =>
  React.lazy(async () => {
    const module = (await loader()) as Record<string, T>;
    return { default: module[exportName] };
  });

const ProtectedRouteShell = React.lazy(() => import('./routes/ProtectedRouteShell'));
const DashboardPage = React.lazy(() => import('./pages/DashboardPage'));
const DashboardExecutiveView = lazyNamed(() => import('./components/dashboard/executive/DashboardExecutiveView'), 'DashboardExecutiveView');
const DailyReportPage = React.lazy(() => import('./pages/report/DailyReportPage'));
const TestSettingsPage = React.lazy(() => import('./pages/settings/TestSettingsPage'));
const DailyDispatchPage = React.lazy(() => import('./pages/assignment/DailyDispatchPage'));
const FieldScheduleRequestPage = React.lazy(() => import('./pages/assignment/FieldScheduleRequestPage'));
const FieldSchedulePlannerPage = React.lazy(() => import('./pages/assignment/FieldSchedulePlannerPage'));
const ScheduleConfirmationBoardPage = React.lazy(() => import('./pages/assignment/ScheduleConfirmationBoardPage'));
const TeamAssignmentPage = React.lazy(() => import('./pages/assignment/TeamAssignmentPage'));
const SiteAssignmentPage = React.lazy(() => import('./pages/assignment/SiteAssignmentPage'));
const SupportAssignmentPage = React.lazy(() => import('./pages/assignment/SupportAssignmentPage'));
const PositionManager = React.lazy(() => import('./pages/hr/PositionManager'));
const RateChangePage = React.lazy(() => import('./pages/hr/RateChangePage'));
const SupportSettingsPage = React.lazy(() => import('./pages/support/SupportSettingsPage'));
const SupportStatusPage = React.lazy(() => import('./pages/support/SupportStatusPage'));
const WorkerSummaryPage = React.lazy(() => import('./pages/manpower/WorkerSummaryPage'));
const TeamWorkerDetailPage = React.lazy(() => import('./pages/manpower/TeamWorkerDetailPage'));
const SiteResponsibleDetailPage = React.lazy(() => import('./pages/manpower/SiteResponsibleDetailPage'));
const MaterialManagementPage = React.lazy(() => import('./pages/materials/MaterialManagementPage'));
const MaterialMasterPage = React.lazy(() => import('./pages/materials/MaterialMasterPage'));
const MaterialInboundPage = React.lazy(() => import('./pages/materials/MaterialInboundPage'));
const MaterialOutboundPage = React.lazy(() => import('./pages/materials/MaterialOutboundPage'));
const MaterialTransactionsPage = React.lazy(() => import('./pages/materials/MaterialTransactionsPage'));
const MaterialInventoryPage = React.lazy(() => import('./pages/materials/MaterialInventoryPage'));
const MaterialInventoryBySitePage = React.lazy(() => import('./pages/materials/MaterialInventoryBySitePage'));
const MaterialLogPage = React.lazy(() => import('./pages/materials/MaterialLogPage'));
const FieldGoodsProgramPage = React.lazy(() => import('./pages/materials/FieldGoodsProgramPage'));
const CompanyDatabase = React.lazy(() => import('./pages/database/CompanyDatabase'));
const ManpowerInputPage = React.lazy(() => import('./pages/manpower/ManpowerInputPage'));
const WorkerDatabase = React.lazy(() => import('./pages/database/WorkerDatabase'));
const TeamDatabase = React.lazy(() => import('./pages/database/TeamDatabase'));
const SiteDatabase = React.lazy(() => import('./pages/database/SiteDatabase'));
const DailyReportDragDropPage = React.lazy(() => import('./pages/report/DailyReportDragDropPage'));
const DailyReportV2Page = React.lazy(() => import('./pages/report/DailyReportV2Page'));
const SmartWorkerRegistrationPage = React.lazy(() => import('./pages/manpower/SmartWorkerRegistrationPage'));
const SmartTeamRegistrationPage = React.lazy(() => import('./pages/manpower/SmartTeamRegistrationPage'));
const SmartCompanyRegistrationPage = React.lazy(() => import('./pages/database/SmartCompanyRegistrationPage'));
const SmartSiteRegistrationPage = React.lazy(() => import('./pages/manpower/SmartSiteRegistrationPage'));
const SmartDailyReportRegistrationPage = React.lazy(() => import('./pages/report/SmartDailyReportRegistrationPage'));
const PayslipPage = React.lazy(() => import('./pages/payroll/PayslipPage'));
const TaxAdvanceTeamPayslipPage = React.lazy(() => import('./pages/payroll/TaxAdvanceTeamPayslipPage'));
const WagePaymentPage = React.lazy(() => import('./pages/payroll/WagePaymentPage'));
const DailyWageDraftPage = React.lazy(() => import('./pages/payroll/DailyWageDraftPage'));
const DailyWageStatementPage = React.lazy(() => import('./pages/payroll/DailyWageStatementPage'));
const DailyAdvanceWorkbookPage = React.lazy(() => import('./pages/payroll/DailyAdvanceWorkbookPage'));
const MonthlyWageDraftPage = React.lazy(() => import('./pages/payroll/MonthlyWageDraftPage'));
const SupportTeamPaymentPage = React.lazy(() => import('./pages/payroll/SupportTeamPaymentPage'));
const SupportClientSitePage = React.lazy(() => import('./pages/payroll/SupportClientSitePage'));
const SupportClaimPage = React.lazy(() => import('./pages/payroll/SupportClaimPage'));
const PayrollRateManagementPage = React.lazy(() => import('./pages/payroll/PayrollRateManagementPage'));
const AdvancePaymentPage = React.lazy(() => import('./pages/payroll/AdvancePaymentPage'));
const PayrollStatisticsPage = React.lazy(() => import('./pages/payroll/PayrollStatisticsPage'));
const WorkerBulkRegistrationPage = React.lazy(() => import('./pages/manpower/WorkerBulkRegistrationPage'));
const SignManagementPage = React.lazy(() => import('./pages/payroll/SignManagementPage'));
const SignatureGeneratorPage = React.lazy(() => import('./pages/payroll/SignatureGeneratorPage'));
const DelegationLetterPage = React.lazy(() => import('./pages/payroll/DelegationLetterPage'));
const DelegationLetterV2Page = React.lazy(() => import('./pages/payroll/DelegationLetterV2Page'));
const DelegationBuilderPage = React.lazy(() => import('./pages/payroll/DelegationBuilderPage'));
const DelegationLetterV5Page = React.lazy(() => import('./pages/payroll/DelegationLetterV5Page'));
const LaborCostStatementGeneratorPage = React.lazy(() => import('./pages/payroll/LaborCostStatementGeneratorPage'));
const LaborExchangePage = React.lazy(() => import('./pages/payroll/LaborExchangePage'));
const TeamSettlementPage = React.lazy(() => import('./pages/payroll/TeamSettlementPage'));
const SupportRateManagementPage = React.lazy(() => import('./pages/support/SupportRateManagementPage'));
const SupportManagerPage = React.lazy(() => import('./pages/support/SupportManagerPage'));
const ExpenseLedgerPage = React.lazy(() => import('./pages/support/ExpenseLedgerPage'));
const VehicleBillingLogPage = React.lazy(() => import('./pages/support/VehicleBillingLogPage'));
const CardBillingLogPage = React.lazy(() => import('./pages/support/CardBillingLogPage'));
const AccommodationBillingLogPage = React.lazy(() => import('./pages/support/AccommodationBillingLogPage'));
const ExpenseClaimManagementPage = React.lazy(() => import('./pages/support/ExpenseClaimManagementPage'));
const TeamResourceDetailPage = React.lazy(() => import('./pages/support/TeamResourceDetailPage'));
const TeamBasedPaymentDraftPage = React.lazy(() => import('./pages/payroll/TeamBasedPaymentDraftPage'));
const TeamBasedPaymentDraftPageV2 = React.lazy(() => import('./pages/payroll/TeamBasedPaymentDraftPageV2'));
const EmploymentCertificatePage = React.lazy(() => import('./pages/hr/EmploymentCertificatePage'));
const TerminationCertificatePage = React.lazy(() => import('./pages/hr/TerminationCertificatePage'));
const DailyReportStatisticsPage = React.lazy(() => import('./pages/report/DailyReportStatisticsPage'));
const DailyReportLogPage = React.lazy(() => import('./pages/report/DailyReportLogPage'));
const OfficeManagementPage = React.lazy(() => import('./pages/office/OfficeManagementPage'));
const IntegratedDatabase = React.lazy(() => import('./pages/database/ManpowerDatabase'));
const DatabaseLogPage = React.lazy(() => import('./pages/database/DatabaseLogPage'));
const ManualPage = React.lazy(() => import('./pages/manual'));
const ProfilePage = React.lazy(() => import('./pages/profile/ProfilePage'));
const MessageCenterPage = React.lazy(() => import('./pages/messages/MessageCenterPage'));
const NoticeBoardPage = React.lazy(() => import('./pages/notices/NoticeBoardPage'));
const MessageAutomationSettingsPage = React.lazy(() => import('./pages/messages/MessageAutomationSettingsPage'));
const StorageManagerPage = React.lazy(() => import('./pages/storage/StorageManagerPage'));
const GoogleDriveManagerPage = lazyNamed(() => import('./pages/storage/GoogleDriveManagerPage'), 'GoogleDriveManagerPage');
const SchemaDesignViewer = React.lazy(() => import('./pages/structure/SchemaDesignViewer'));
const WhiteboardStatusBoard = React.lazy(() => import('./pages/jeonkuk/WhiteboardStatusBoard'));
const IntegratedSupportStatusBoard = React.lazy(() => import('./pages/dashboard/IntegratedSupportStatusBoard'));
const TotalPersonnelHistoryPage = React.lazy(() => import('./pages/jeonkuk/TotalPersonnelHistoryPage'));
const DataIntegrityPage = React.lazy(() => import('./pages/jeonkuk/DataIntegrityPage'));
const StatusManagementPage = React.lazy(() => import('./pages/jeonkuk/StatusManagementPage'));
const TestDataGeneratorPage = React.lazy(() => import('./pages/jeonkuk/TestDataGeneratorPage'));
const TestDailyReportGeneratorPage = React.lazy(() => import('./pages/jeonkuk/TestDailyReportGeneratorPage'));
const DailyReportExcelPage = React.lazy(() => import('./pages/report/DailyReportExcelPage'));
const DataSyncStatusPage = React.lazy(() => import('./pages/system/DataSyncStatusPage'));
const SettingsPage = React.lazy(() => import('./pages/SettingsPage'));
const SystemMessagePage = React.lazy(() => import('./pages/settings/SystemMessagePage'));
const AISettingsPage = React.lazy(() => import('./pages/settings/AISettingsPage'));
const MassDailyReportUploader = React.lazy(() => import('./pages/report/MassDailyReportUploader'));
const SystemManagementPage = React.lazy(() => import('./pages/system/SystemManagementPage'));
const WorkerMassUploader = React.lazy(() => import('./pages/mass-upload/WorkerMassUploader'));
const TeamMassUploader = React.lazy(() => import('./pages/mass-upload/TeamMassUploader'));
const SiteMassUploader = React.lazy(() => import('./pages/mass-upload/SiteMassUploader'));
const CompanyMassUploader = React.lazy(() => import('./pages/mass-upload/CompanyMassUploader'));
const DailyReportMassUploader = React.lazy(() => import('./pages/mass-upload/DailyReportMassUploader'));
const IntegratedMassUploader = React.lazy(() => import('./pages/mass-upload/IntegratedMassUploader'));
const IntegratedDailyReportUploader = React.lazy(() => import('./pages/mass-upload/IntegratedDailyReportUploader'));
const CompanyManagementPage = React.lazy(() => import('./pages/company/CompanyManagementPage'));
const CompanyRegistrationPage = React.lazy(() => import('./pages/company/CompanyRegistrationPage'));
const SafeExcelGuidePage = React.lazy(() => import('./pages/manual/SafeExcelGuidePage'));
const ActivityLogPage = React.lazy(() => import('./pages/admin/ActivityLogPage'));
const ComponentManagementPage = React.lazy(() => import('./pages/admin/ComponentManagementPage'));
const ComponentGalleryPage = React.lazy(() => import('./pages/design-system/ComponentGalleryPage'));
const MenuManagementPage = lazyNamed(() => import('./pages/admin/MenuManagementPage'), 'MenuManagementPage');
const DataConsolePage = React.lazy(() => import('./pages/admin/DataConsolePage'));
const DataBackupPage = React.lazy(() => import('./pages/admin/DataBackupPage'));
const StatusGraphPage = React.lazy(() => import('./pages/jeonkuk/StatusGraphPage'));
const NationwidePartnersPage = React.lazy(() => import('./pages/jeonkuk/NationwidePartnersPage'));
const SalaryModelUpdater = React.lazy(() => import('./pages/admin/SalaryModelUpdater'));
const AdminDataIntegrityPage = React.lazy(() => import('./pages/admin/AdminDataIntegrityPage'));
const UserManagementPage = React.lazy(() => import('./pages/admin/UserManagementPage'));
const LoginLogPage = React.lazy(() => import('./pages/admin/LoginLogPage'));
const WelfareAssetPlatformPage = React.lazy(() => import('./pages/admin/WelfareAssetPlatformPage'));
const AgentPlayground = React.lazy(() => import('./pages/developer/AgentPlayground'));
const AgentDashboard = React.lazy(() => import('./pages/developer/AgentDashboard'));
const AdvancedMenuManager = React.lazy(() => import('./pages/admin/menu/AdvancedMenuManager'));
const RoleMenuAssignmentPage = React.lazy(() => import('./pages/admin/RoleMenuAssignmentPage'));
const SystemStatusPage = React.lazy(() => import('./pages/admin/SystemStatusPage'));
const TeamPersonnelStatusReportPage = React.lazy(() => import('./pages/report/TeamPersonnelStatusReportPage'));
const SettlementArchitecturePage = React.lazy(() => import('./pages/design/SettlementArchitecturePage'));
const FirestoreStructureViewer = React.lazy(() => import('./pages/database/FirestoreStructureViewer'));
const ProjectFileStructureViewer = React.lazy(() => import('./pages/admin/ProjectFileStructureViewer'));
const DataRelationshipViewer = React.lazy(() => import('./pages/structure/DataRelationshipViewer'));
const RelationshipConsolePage = React.lazy(() => import('./pages/admin/RelationshipConsole'));
const ExcelDataGuideViewer = React.lazy(() => import('./pages/structure/ExcelDataGuideViewer'));
const AccommodationDesignViewer = React.lazy(() => import('./pages/structure/AccommodationDesignViewer'));
const LibraryGuideViewer = React.lazy(() => import('./pages/structure/LibraryGuideViewer'));
const OrganizationChartPage = React.lazy(() => import('./pages/structure/OrganizationChartPage'));
const DesignManagementPage = React.lazy(() => import('./pages/design/DesignManagementPage'));
const CheongyeonOrgChartPage = React.lazy(() => import('./pages/cheongyeon/CheongyeonOrgChartPage'));
const CheongyeonGreetingPage = React.lazy(() => import('./pages/cheongyeon/CheongyeonGreetingPage'));
const CheongyeonDirectionsPage = React.lazy(() => import('./pages/cheongyeon/CheongyeonDirectionsPage'));
const CheongyeonHome = React.lazy(() => import('./pages/cheongyeon/CheongyeonHome'));
const CheongyeonTechVisionPage = React.lazy(() => import('./pages/cheongyeon/CheongyeonTechVisionPage'));
const CheongyeonHistoryPage = React.lazy(() => import('./pages/cheongyeon/history'));
const CheongyeonPhilosophyPage = React.lazy(() => import('./pages/cheongyeon/CheongyeonPhilosophyPage'));
const NationwideDashboardHome = React.lazy(() => import('./pages/jeonkuk/NationwideDashboardHome'));
const CompanyLandingPage = React.lazy(() => import('./pages/company/CompanyLandingPage'));
const EstimateManagePage = React.lazy(() => import('./pages/estimate/EstimateManagePage'));
const DetailedEstimatePage = React.lazy(() => import('./pages/estimate/DetailedEstimatePage'));
const DrawingAiEstimatePage = React.lazy(() => import('./pages/estimate/DrawingAiEstimatePage'));
const TransactionManagePage = React.lazy(() => import('./pages/estimate/TransactionManagePage'));
const EstimateRequestPage = React.lazy(() => import('./pages/estimate/EstimateRequestPage'));
const AccountManagementPage = React.lazy(() => import('./pages/database/AccountManagementPage'));
const ConstructionCompanyDatabase = React.lazy(() => import('./pages/database/ConstructionCompanyDatabase'));
const WorkerDatabaseInput = React.lazy(() => import('./pages/database/WorkerDatabaseInput'));
const OfficeStaffDatabase = React.lazy(() => import('./pages/database/OfficeStaffDatabase'));
const HomepageClientProgressPage = React.lazy(() => import('./pages/homepage/HomepageClientProgressPage'));
const HomepageRequestListPage = React.lazy(() => import('./pages/homepage/HomepageRequestListPage'));
const KakaoTestPage = lazyNamed(() => import('./pages/kakao/KakaoTestPage'), 'KakaoTestPage');
const HomepageRequestDetailPage = React.lazy(() => import('./pages/homepage/HomepageRequestDetailPage'));
const HomepageRequestCreatePage = React.lazy(() => import('./pages/homepage/HomepageRequestCreatePage'));
const TaxInvoicePage = React.lazy(() => import('./pages/taxinvoice/TaxInvoicePage'));
const TaxInvoiceLedgerPage = React.lazy(() => import('./pages/taxinvoice/TaxInvoiceLedgerPage'));
const TaxInvoiceIssueListPage = React.lazy(() => import('./pages/taxinvoice/TaxInvoiceIssueListPage'));
const ReceivablesManagerPage = React.lazy(() => import('./pages/taxinvoice/ReceivablesManagerPage'));
const ReceivablesDashboardPage = React.lazy(() => import('./pages/taxinvoice/ReceivablesDashboardPage'));
const WorkbookLedgerPage = React.lazy(() => import('./pages/taxinvoice/WorkbookLedgerPage'));
const WorkbookLedgerLogPage = React.lazy(() => import('./pages/taxinvoice/WorkbookLedgerLogPage'));
const WorkbookLedgerUpgradePage = React.lazy(() => import('./pages/taxinvoice/WorkbookLedgerUpgradePage'));
const PartnerTransactionLedgerPage = React.lazy(() => import('./pages/taxinvoice/PartnerTransactionLedgerPage'));
const KakaoNotificationPage = React.lazy(() => import('./pages/taxinvoice/KakaoNotificationPage'));
const AccountInquiryPage = React.lazy(() => import('./pages/taxinvoice/AccountInquiryPage'));
const RefineWrapper = lazyNamed(() => import('./providers/refine/RefineWrapper'), 'RefineWrapper');
const RefineSiteList = React.lazy(() => import('./pages/refine/RefineSiteList'));
const RefineSmartSelectDemo = lazyNamed(() => import('./pages/refine/RefineSmartSelectDemo'), 'RefineSmartSelectDemo');
const ProjectGalleryPage = lazyNamed(() => import('./pages/gallery/ProjectGalleryPage'), 'ProjectGalleryPage');
const AiImageGalleryPage = lazyNamed(() => import('./pages/gallery/AiImageGalleryPage'), 'AiImageGalleryPage');
const SiteManagementPage = React.lazy(() => import('./pages/site/SiteManagementPage'));
const ClosedSiteManagementPage = lazyNamed(() => import('./pages/site/SiteManagementPage'), 'ClosedSiteManagementPage');
const RefineWorkerList = React.lazy(() => import('./pages/refine/RefineWorkerList'));
const RefineTeamList = React.lazy(() => import('./pages/refine/RefineTeamList'));
const RefineCompanyList = React.lazy(() => import('./pages/refine/RefineCompanyList'));
const MemoPage = lazyNamed(() => import('./features/smart-memo/pages/MemoPage'), 'MemoPage');
const BarobillKakaoConnectionPage = React.lazy(() => import('./pages/admin/settings/BarobillKakaoConnectionPage'));
const KakaoSenderPage = React.lazy(() => import('./pages/helper/KakaoSenderPage'));
const TodoPage = React.lazy(() => import('./pages/helper/TodoPage'));
const TaxAffairsPage = React.lazy(() => import('./pages/tax/TaxAffairsPage'));
const KakaoMessageCenterPage = React.lazy(() => import('./pages/kakao/KakaoMessageCenterPage'));
const FreelancerPage = React.lazy(() => import('./pages/manpower/FreelancerPage'));

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router future={{ v7_relativeSplatPath: true }}>
        <React.Suspense fallback={<AppIntroScreen />}>
          <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Login />} />
          <Route path="/login" element={<Login />} />
          <Route path="/homepage/client/:requestId" element={<HomepageClientProgressPage />} />
          <Route path="/company/landing" element={<CompanyLandingPage />} />

          {/* Protected Routes */}
          <Route element={
            <PrivateRoute>
              <ProtectedRouteShell />
            </PrivateRoute>
          }>

            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/dashboard-v2" element={<DashboardExecutiveView />} />
            {/* 청연사이트 전용 대시보드 */}
            <Route path="/dashboard2" element={<CheongyeonHome />} />
            <Route path="/dashboard3" element={<NationwideDashboardHome />} />
            <Route path="/cheongyeon/home" element={<Navigate to="/dashboard2" replace />} />

            {/* Reports */}
            {/* Daily Reports */}
            <Route path="/reports/daily" element={<DailyReportPage />} />
            <Route path="/reports/daily-v2" element={<DailyReportV2Page />} />
            <Route path="/reports/daily-logs" element={<DailyReportLogPage />} />
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
              <Route path="team-worker-detail" element={<TeamWorkerDetailPage />} />
              <Route path="site-responsible-detail" element={<SiteResponsibleDetailPage />} />
              <Route path="site-manager-detail" element={<SiteResponsibleDetailPage />} />
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
              <Route path="company-db-construction" element={<ConstructionCompanyDatabase />} />
              <Route path="manpower-db" element={<IntegratedDatabase />} />
              <Route path="logs" element={<DatabaseLogPage />} />
              <Route path="office-staff-db" element={<OfficeStaffDatabase />} />
              <Route path="account-management" element={<AccountManagementPage />} />
              <Route path="worker-input" element={<WorkerDatabaseInput />} />
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
              <Route path="daily-advance-workbook" element={<DailyAdvanceWorkbookPage />} />
              <Route path="monthly-wage" element={<MonthlyWageDraftPage />} />
              <Route path="statistics" element={<PayrollStatisticsPage />} />
              <Route path="support-team" element={<SupportTeamPaymentPage />} />
              <Route path="support-client-site" element={<SupportClientSitePage />} />
              <Route path="support-company-site" element={<SupportClientSitePage />} />
              <Route path="support-site" element={<SupportClientSitePage />} />
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
              <Route path="taxinvoice/issue-list" element={<TaxInvoiceIssueListPage />} />
              <Route path="taxinvoice/dashboard" element={<ReceivablesDashboardPage />} />
              <Route path="workbook-ledger" element={<WorkbookLedgerPage key="cheongyeon" tenantKey="cheongyeon" companyLabel="청연" />} />
              <Route path="workbook-ledger/logs" element={<WorkbookLedgerLogPage />} />
              <Route path="workbook-ledger-upgrade" element={<WorkbookLedgerUpgradePage key="cheongyeon-upgrade" tenantKey="cheongyeon" companyLabel="청연" />} />
              <Route path="workbook-ledger-dawon" element={<WorkbookLedgerPage key="dawon" tenantKey="dawon" companyLabel="다원" />} />
              <Route path="partner-ledger" element={<PartnerTransactionLedgerPage />} />
              <Route path="kakao-notification" element={<KakaoNotificationPage />} />
              <Route path="taxinvoice/account-inquiry" element={<AccountManagementPage />} />
              <Route path="taxinvoice/bank-inquiry" element={<AccountInquiryPage />} />
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
            <Route path="/notices" element={<NoticeBoardPage />} />
            <Route path="/notice-board" element={<NoticeBoardPage />} />
            <Route path="/messages" element={<MessageCenterPage />} />
            <Route path="/messages/compose" element={<MessageCenterPage mode="compose" />} />
            <Route path="/messages/settings" element={<MessageAutomationSettingsPage />} />

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
            <Route path="/assignment/field-request" element={<FieldScheduleRequestPage />} />
            <Route path="/assignment/field-schedule" element={<FieldSchedulePlannerPage />} />
            <Route path="/assignment/schedule-confirmation" element={<ScheduleConfirmationBoardPage />} />
            <Route path="/assignment/schedule-confirmation-board" element={<ScheduleConfirmationBoardPage />} />
            <Route path="/assignment/team-assignment" element={<TeamAssignmentPage />} />
            <Route path="/assignment/site-assignment" element={<SiteAssignmentPage />} />

            {/* HR Management */}
            <Route path="/hr/position-management" element={<PositionManager />} />
            <Route path="/hr/position-assignment" element={<Navigate to="/hr/position-management" replace />} />
            <Route path="/hr/rate-change" element={<RateChangePage />} />

            {/* Support Management */}
            <Route path="/support/settings" element={<SupportSettingsPage />} />
            <Route path="/support/status" element={<SupportStatusPage />} />
            <Route path="/support/accommodation" element={<SupportManagerPage />} />
            <Route path="/support/accommodation/logs" element={<AccommodationBillingLogPage />} />
            <Route path="/support/vehicles" element={<SupportManagerPage />} />
            <Route path="/support/vehicles/logs" element={<VehicleBillingLogPage />} />
            <Route path="/support/cards" element={<SupportManagerPage />} />
            <Route path="/support/cards/logs" element={<CardBillingLogPage />} />
            <Route path="/support/expense-ledger" element={<ExpenseLedgerPage />} />
            <Route path="/support/expense-claims" element={<ExpenseClaimManagementPage />} />
            <Route path="/support/expense-claim-input" element={<ExpenseClaimManagementPage />} />
            <Route path="/support/team-resource-detail" element={<TeamResourceDetailPage />} />
            <Route path="/support/team-resources" element={<TeamResourceDetailPage />} />

            <Route path="/hr/certificate" element={<EmploymentCertificatePage />} />
            <Route path="/hr/termination-certificate" element={<TerminationCertificatePage />} />
            {/* Payroll Management */}
            <Route path="/payroll/payslip" element={<PayslipPage />} />

            {/* Materials Management */}
            <Route path="/materials" element={<MaterialManagementPage />}>
              <Route index element={<Navigate to="master" replace />} />
              <Route path="master" element={<MaterialMasterPage />} />
              <Route path="inbound" element={<MaterialInboundPage />} />
              <Route path="outbound" element={<MaterialOutboundPage />} />
              <Route path="transactions" element={<MaterialTransactionsPage />} />
              <Route path="inventory" element={<MaterialInventoryPage />} />
              <Route path="inventory-by-site" element={<MaterialInventoryBySitePage />} />
              <Route path="logs" element={<MaterialLogPage />} />
              <Route path="field-goods" element={<FieldGoodsProgramPage />} />
            </Route>

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
              <Route path="login-logs" element={<LoginLogPage />} />
              <Route path="welfare-assets" element={<WelfareAssetPlatformPage />} />
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
            <Route path="/cheongyeon/philosophy" element={<CheongyeonPhilosophyPage />} />
            <Route path="/cheongyeon/history" element={<CheongyeonHistoryPage />} />

            {/* Company */}
            <Route path="/company/management" element={<CompanyManagementPage />} />
            <Route path="/company/registration" element={<CompanyRegistrationPage />} />
            <Route path="/estimate" element={<Navigate to="/estimate/manage" replace />} />
            <Route path="/estimate/manage" element={<EstimateManagePage />} />
            <Route path="/estimate/detail-manage" element={<DetailedEstimatePage />} />
            <Route path="/estimate/drawing-ai" element={<DrawingAiEstimatePage />} />
            <Route path="/estimate/list" element={<EstimateManagePage />} />
            <Route path="/estimate/new" element={<EstimateManagePage />} />
            <Route path="/transaction/manage" element={<TransactionManagePage />} />
            <Route path="/transaction/list" element={<TransactionManagePage />} />
            <Route path="/transaction/new" element={<TransactionManagePage />} />
            <Route path="/estimate/request" element={<EstimateRequestPage />} />

            {/* Gallery */}
            <Route path="/gallery/projects" element={<ProjectGalleryPage />} />
            <Route path="/gallery/ai-images" element={<AiImageGalleryPage />} />

            {/* Site Management */}
            <Route path="/site/management" element={<SiteManagementPage />} />
            <Route path="/site/management/closed" element={<ClosedSiteManagementPage />} />
            <Route path="/site/management-closed" element={<ClosedSiteManagementPage />} />

          </Route>

          {/* Catch all - redirect to dashboard */}
          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </React.Suspense>
      </Router>
    </AuthProvider>
  );
};

export default App;
