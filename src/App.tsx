import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import PrivateRoute from './components/auth/PrivateRoute';
import Login from './components/auth/Login';
import AppIntroScreen from './components/common/AppIntroScreen';
import AnalyticsRouteTracker from './components/analytics/AnalyticsRouteTracker';
import { lazyNamed } from './utils/lazyNamed';

const ProtectedRouteShell = React.lazy(() => import('./routes/ProtectedRouteShell'));
const DashboardPage = React.lazy(() => import('./pages/DashboardPage'));
const DashboardExecutiveView = lazyNamed(() => import('./components/dashboard/executive/DashboardExecutiveView'), 'DashboardExecutiveView');
const DailyReportPage = React.lazy(() => import('./pages/report/DailyReportPage'));
const DailyReportWorkerCalendarPage = React.lazy(() => import('./pages/report/DailyReportWorkerCalendarPage'));
const LaborCheckPage = React.lazy(() => import('./pages/report/LaborCheckPage'));
const TestSettingsPage = React.lazy(() => import('./pages/settings/TestSettingsPage'));
const DailyDispatchPage = React.lazy(() => import('./pages/assignment/DailyDispatchPage'));
const FieldScheduleRequestPage = React.lazy(() => import('./pages/assignment/FieldScheduleRequestPage'));
const FieldSchedulePlannerPage = React.lazy(() => import('./pages/assignment/FieldSchedulePlannerPage'));
const WorkerOffDutyRequestPage = React.lazy(() => import('./pages/assignment/WorkerOffDutyRequestPage'));
const ScheduleConfirmationBoardPage = React.lazy(() => import('./pages/assignment/ScheduleConfirmationBoardPage'));
const TeamAssignmentPage = React.lazy(() => import('./pages/assignment/TeamAssignmentPage'));
const SiteAssignmentPage = React.lazy(() => import('./pages/assignment/SiteAssignmentPage'));
const SupportAssignmentPage = React.lazy(() => import('./pages/assignment/SupportAssignmentPage'));
const RateChangePage = React.lazy(() => import('./pages/hr/RateChangePage'));
const IncidentCaseRegisterPage = React.lazy(() => import('./pages/hr/IncidentCaseRegisterPage'));
const SupportSettingsPage = React.lazy(() => import('./pages/support/SupportSettingsPage'));
const SupportStatusPage = React.lazy(() => import('./pages/support/SupportStatusPage'));
const WorkerSummaryPage = React.lazy(() => import('./pages/manpower/WorkerSummaryPage'));
const TeamWorkerDetailPage = React.lazy(() => import('./pages/manpower/TeamWorkerDetailPage'));
const SiteResponsibleDetailPage = React.lazy(() => import('./pages/manpower/SiteResponsibleDetailPage'));
const MaterialManagementPage = React.lazy(() => import('./pages/materials/MaterialManagementPage'));
const MaterialMasterPage = React.lazy(() => import('./pages/materials/MaterialMasterPage'));
const MaterialInboundPage = React.lazy(() => import('./pages/materials/MaterialInboundPage'));
const MaterialOutboundPage = React.lazy(() => import('./pages/materials/MaterialOutboundPage'));
const MaterialInboundCertificatePage = React.lazy(() => import('./pages/materials/MaterialInboundCertificatePage'));
const MaterialOutboundCertificatePage = React.lazy(() => import('./pages/materials/MaterialOutboundCertificatePage'));
const MaterialTransactionsPage = React.lazy(() => import('./pages/materials/MaterialTransactionsPage'));
const MaterialTransactionsBySiteDatePage = React.lazy(() => import('./pages/materials/MaterialTransactionsBySiteDatePage'));
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
const PartnerPhotoRegistrationPage = React.lazy(() => import('./pages/database/PartnerPhotoRegistrationPage'));
const BusinessCardContactsPage = React.lazy(() => import('./pages/database/BusinessCardContactsPage'));
const IdentityBundlePage = React.lazy(() => import('./pages/database/IdentityBundlePage'));
const SmartSiteRegistrationPage = React.lazy(() => import('./pages/manpower/SmartSiteRegistrationPage'));
const SmartDailyReportRegistrationPage = React.lazy(() => import('./pages/report/SmartDailyReportRegistrationPage'));
const PayslipPage = React.lazy(() => import('./pages/payroll/PayslipPage'));
const TaxAdvanceTeamPayslipPage = React.lazy(() => import('./pages/payroll/TaxAdvanceTeamPayslipPage'));
const WagePaymentPage = React.lazy(() => import('./pages/payroll/WagePaymentPage'));
const DailyWageDraftPage = React.lazy(() => import('./pages/payroll/DailyWageDraftPage'));
const DailyWageStatementPage = React.lazy(() => import('./pages/payroll/DailyWageStatementPage'));
const DailyAdvanceWorkbookPage = React.lazy(() => import('./pages/payroll/DailyAdvanceWorkbookPage'));
const MonthlyWageDraftPage = React.lazy(() => import('./pages/payroll/MonthlyWageDraftPage'));
const OfficeStaffPayrollPage = React.lazy(() => import('./pages/payroll/OfficeStaffPayrollPage'));
const SupportTeamPaymentPage = React.lazy(() => import('./pages/payroll/SupportTeamPaymentPage'));
const SupportClientSitePage = React.lazy(() => import('./pages/payroll/SupportClientSitePage'));
const PartnerSupportWorkersPage = React.lazy(() => import('./pages/payroll/PartnerSupportWorkersPage'));
const ClientSiteLaborPage = React.lazy(() => import('./pages/payroll/ClientSiteLaborPage'));
const SupportClaimPage = React.lazy(() => import('./pages/payroll/SupportClaimPage'));
const ProgressClaimPage = React.lazy(() => import('./pages/payroll/ProgressClaimPage'));
const ProgressClaimsEntry = React.lazy(() => import('./pages/payroll/ProgressClaimsEntry'));
const FieldBuybackWorkbookPage = React.lazy(() => import('./pages/payroll/FieldBuybackWorkbookPage'));
const PayrollRateManagementPage = React.lazy(() => import('./pages/payroll/PayrollRateManagementPage'));
const AdvancePaymentPage = React.lazy(() => import('./pages/payroll/AdvancePaymentPage'));
const WorkerAdvanceRequestPage = React.lazy(() => import('./pages/payroll/WorkerAdvanceRequestPage'));
const PayrollStatisticsPage = React.lazy(() => import('./pages/payroll/PayrollStatisticsPage'));
const WorkerBulkRegistrationPage = React.lazy(() => import('./pages/manpower/WorkerBulkRegistrationPage'));
const SignManagementPage = React.lazy(() => import('./pages/payroll/SignManagementPage'));
const SignatureGeneratorPage = React.lazy(() => import('./pages/payroll/SignatureGeneratorPage'));
const DelegationLetterPage = React.lazy(() => import('./pages/payroll/DelegationLetterPage'));
const DelegationLetterV2Page = React.lazy(() => import('./pages/payroll/DelegationLetterV2Page'));
const CashReceiptConfirmationPage = React.lazy(() => import('./pages/payroll/CashReceiptConfirmationPage'));
const AccountChangeRequestPage = React.lazy(() => import('./pages/payroll/AccountChangeRequestPage'));
const DelegationBuilderPage = React.lazy(() => import('./pages/payroll/DelegationBuilderPage'));
const DelegationLetterV5Page = React.lazy(() => import('./pages/payroll/DelegationLetterV5Page'));
const LaborCostStatementGeneratorPage = React.lazy(() => import('./pages/payroll/LaborCostStatementGeneratorPage'));
const LaborExchangePage = React.lazy(() => import('./pages/payroll/LaborExchangePage'));
const TeamSettlementPage = React.lazy(() => import('./pages/payroll/TeamSettlementPage'));
const TeamSettlementStatisticsPage = React.lazy(() => import('./pages/payroll/TeamSettlementStatisticsPage'));
const TeamSettlementStatisticsManagementPage = React.lazy(() => import('./pages/payroll/TeamSettlementStatisticsManagementPage'));
const TeamSettlementAnnualStatisticsPage = React.lazy(() => import('./pages/payroll/TeamSettlementAnnualStatisticsPage'));
const TeamSettlementAnnualStatisticsManagementPage = React.lazy(() => import('./pages/payroll/TeamSettlementAnnualStatisticsManagementPage'));
const SupportRateManagementPage = React.lazy(() => import('./pages/support/SupportRateManagementPage'));
const SupportManagerPage = React.lazy(() => import('./pages/support/SupportManagerPage'));
const VehicleBillingLogPage = React.lazy(() => import('./pages/support/VehicleBillingLogPage'));
const EngineOilCyclePage = React.lazy(() => import('./pages/support/EngineOilCyclePage'));
const TeamEquipmentStatusPage = React.lazy(() => import('./pages/support/TeamEquipmentStatusPage'));
const CardBillingLogPage = React.lazy(() => import('./pages/support/CardBillingLogPage'));
const AccommodationBillingLogPage = React.lazy(() => import('./pages/support/AccommodationBillingLogPage'));
const TeamResourceDetailPage = React.lazy(() => import('./pages/support/TeamResourceDetailPage'));
const TeamBasedPaymentDraftPage = React.lazy(() => import('./pages/payroll/TeamBasedPaymentDraftPage'));
const TeamBasedPaymentDraftPageV2 = React.lazy(() => import('./pages/payroll/TeamBasedPaymentDraftPageV2'));
const EmploymentCertificatePage = React.lazy(() => import('./pages/hr/EmploymentCertificatePage'));
const TerminationCertificatePage = React.lazy(() => import('./pages/hr/TerminationCertificatePage'));
const DailyReportStatisticsPage = React.lazy(() => import('./pages/report/DailyReportStatisticsPage'));
const DailyReportLogPage = React.lazy(() => import('./pages/report/DailyReportLogPage'));
const OfficeDashboardPage = React.lazy(() => import('./pages/office/OfficeDashboardPage'));
const OfficeRequestCenterPage = React.lazy(() => import('./pages/office/OfficeRequestCenterPage'));
const OfficeManagementPage = React.lazy(() => import('./pages/office/OfficeManagementPage'));
const OfficeTeamSettlementManagementPage = React.lazy(() => import('./pages/office/OfficeTeamSettlementManagementPage'));
const OperationalWorkflowPage = React.lazy(() => import('./pages/office/OperationalWorkflowPage'));
const IntegratedDatabase = React.lazy(() => import('./pages/database/ManpowerDatabase'));
const DatabaseLogPage = React.lazy(() => import('./pages/database/DatabaseLogPage'));
const ManualPage = React.lazy(() => import('./pages/manual'));
const ProfilePage = React.lazy(() => import('./pages/profile/ProfilePage'));
const WorkerDelegationSignaturePage = React.lazy(() => import('./pages/worker/WorkerDelegationSignaturePage'));
const MessageCenterPage = React.lazy(() => import('./pages/messages/MessageCenterPage'));
const NoticeBoardPage = React.lazy(() => import('./pages/notices/NoticeBoardPage'));
const MessageAutomationSettingsPage = React.lazy(() => import('./pages/messages/MessageAutomationSettingsPage'));
const MessageAutomationLogPage = React.lazy(() => import('./pages/messages/MessageAutomationLogPage'));
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
const PermissionChangeLogPage = React.lazy(() => import('./pages/admin/PermissionChangeLogPage'));
const ExcelTransferLogPage = lazyNamed(() => import('./pages/admin/FileTransferLogPage'), 'ExcelTransferLogPage');
const PdfTransferLogPage = lazyNamed(() => import('./pages/admin/FileTransferLogPage'), 'PdfTransferLogPage');
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
const DesignManagementPage = React.lazy(() => import('./pages/design/DesignManagementCodeitPage'));
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
const KakaoSenderPage = React.lazy(() => import('./pages/helper/KakaoSenderPage'));
const TodoPage = React.lazy(() => import('./pages/helper/TodoPage'));
const TaxAffairsPage = React.lazy(() => import('./pages/tax/TaxAffairsPage'));
const SettlementAlertCenterPage = React.lazy(() => import('./pages/settlement/SettlementAlertCenterPage'));
const BankNotificationsPage = React.lazy(() => import('./features/bank-notifications/BankNotificationsPage'));
const KakaoMessageCenterPage = React.lazy(() => import('./pages/kakao/KakaoMessageCenterPage'));
const FreelancerPage = React.lazy(() => import('./pages/manpower/FreelancerPage'));
const ConstructionPlanListPage = React.lazy(() => import('./features/construction-plan/pages/ConstructionPlanListPage'));
const ConstructionPlanCreatePage = React.lazy(() => import('./features/construction-plan/pages/ConstructionPlanCreatePage'));
const ConstructionPlanEditorPage = React.lazy(() => import('./features/construction-plan/pages/ConstructionPlanEditorPage'));
const ConstructionPlanReviewInboxPage = React.lazy(() => import('./features/construction-plan/pages/ConstructionPlanReviewInboxPage'));
const ConstructionPlanExportsPage = React.lazy(() => import('./features/construction-plan/pages/ConstructionPlanExportsPage'));
const ConstructionPlanTemplateAdminPage = React.lazy(() => import('./features/construction-plan/pages/ConstructionPlanTemplateAdminPage'));
const ConstructionPlanRecordListPage = React.lazy(() => import('./features/construction-plan/pages/ConstructionPlanRecordListPage'));
const ConstructionPlanRecordDetailPage = React.lazy(() => import('./features/construction-plan/pages/ConstructionPlanRecordDetailPage'));

const INITIAL_INTRO_DURATION_MS = 0;

const App: React.FC = () => {
  const [introVisible, setIntroVisible] = React.useState(INITIAL_INTRO_DURATION_MS > 0);

  React.useEffect(() => {
    if (INITIAL_INTRO_DURATION_MS <= 0) return;

    const timer = window.setTimeout(() => {
      setIntroVisible(false);
    }, INITIAL_INTRO_DURATION_MS);

    return () => window.clearTimeout(timer);
  }, []);

  if (introVisible) {
    return <AppIntroScreen message="앱을 준비하는 중" />;
  }

  return (
    <AuthProvider>
      <Router future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <AnalyticsRouteTracker />
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

            {/* Construction-plan quick PDF creation and document management */}
            <Route path="/construction-plans" element={<ConstructionPlanCreatePage />} />
            <Route path="/construction-plans/create" element={<ConstructionPlanCreatePage />} />
            <Route path="/construction-plans/new" element={<Navigate to="/construction-plans/create" replace />} />
            <Route path="/construction-plans/manage" element={<ConstructionPlanListPage />} />
            <Route path="/construction-plans/:planId/preview" element={<ConstructionPlanEditorPage />} />
            <Route path="/construction-plans/:planId" element={<ConstructionPlanEditorPage />} />
            <Route path="/construction-plans/:planId/drawings/:drawingId" element={<ConstructionPlanEditorPage />} />
            <Route path="/construction-plans/:planId/compare/:snapshotId" element={<ConstructionPlanEditorPage />} />
            <Route path="/construction-plans/:planId/exports" element={<ConstructionPlanExportsPage />} />
            <Route path="/construction-plan-approvals" element={<ConstructionPlanReviewInboxPage />} />
            <Route path="/construction-plan-reviews" element={<Navigate to="/construction-plan-approvals" replace />} />
            <Route path="/construction-plan-exports" element={<ConstructionPlanExportsPage />} />
            <Route path="/construction-plan-templates" element={<ConstructionPlanTemplateAdminPage />} />
            <Route path="/construction-plan-records" element={<ConstructionPlanRecordListPage />} />
            <Route path="/construction-plan-records/:recordId" element={<ConstructionPlanRecordDetailPage />} />

            {/* Reports */}
            {/* Daily Reports */}
            <Route path="/reports/daily" element={<DailyReportPage />} />
            <Route path="/reports/daily-worker-calendar" element={<DailyReportWorkerCalendarPage />} />
            <Route path="/reports/labor-check" element={<LaborCheckPage />} />
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
            <Route path="/settlement/alerts" element={<SettlementAlertCenterPage />} />
            <Route path="/finance/bank-notifications" element={<BankNotificationsPage />} />

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
              <Route path="partner-photo-registration" element={<PartnerPhotoRegistrationPage />} />
              <Route path="business-card-contacts" element={<BusinessCardContactsPage />} />
              <Route path="identity-bundle" element={<IdentityBundlePage />} />
            </Route>

            {/* Restricted internal compliance records */}
            <Route path="/hr/incident-cases" element={<IncidentCaseRegisterPage />} />

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
              <Route path="office-staff-payroll" element={<OfficeStaffPayrollPage />} />
              <Route path="statistics" element={<PayrollStatisticsPage />} />
              <Route path="support-team" element={<SupportTeamPaymentPage />} />
              <Route path="support-team-incoming" element={<SupportTeamPaymentPage scope="incoming" />} />
              <Route path="support-team-internal" element={<SupportTeamPaymentPage scope="internalOut" />} />
              <Route path="support-team-internal-incoming" element={<SupportTeamPaymentPage scope="internalIn" />} />
              <Route path="support-client-site" element={<SupportClientSitePage />} />
              <Route path="support-company-site" element={<SupportClientSitePage />} />
              <Route path="support-site" element={<SupportClientSitePage />} />
              <Route path="partner-support-workers" element={<PartnerSupportWorkersPage />} />
              <Route path="partner-support-labor" element={<PartnerSupportWorkersPage />} />
              <Route path="client-site-labor" element={<ClientSiteLaborPage />} />
              <Route path="client-site-labor-statement" element={<ClientSiteLaborPage />} />
              <Route path="support-claim" element={<SupportClaimPage />} />
              <Route path="progress-claims" element={<ProgressClaimsEntry />} />
              <Route path="progress-claim-invoice" element={<ProgressClaimPage mode="invoice" />} />
              <Route path="field-buyback" element={<FieldBuybackWorkbookPage />} />
              <Route path="buyback-ledger" element={<Navigate to="/payroll/field-buyback" replace />} />
              <Route path="rate-management" element={<PayrollRateManagementPage />} />
              <Route path="advance-payment" element={<AdvancePaymentPage />} />
              <Route path="advance-request" element={<WorkerAdvanceRequestPage />} />
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
              <Route path="kakao-test" element={<KakaoTestPage />} />
              <Route path="kakao-sender" element={<KakaoSenderPage />} />
              <Route path="kakao-message-center" element={<KakaoMessageCenterPage />} />
              <Route path="tax-affairs" element={<TaxAffairsPage />} />
              <Route path="delegation-letter" element={<DelegationLetterPage />} />
              <Route path="delegation-letter-v2" element={<DelegationLetterV2Page />} />
              <Route path="cash-receipt-confirmation" element={<CashReceiptConfirmationPage />} />
              <Route path="account-change-request" element={<AccountChangeRequestPage />} />
              <Route path="delegation-letter-v3" element={<DelegationBuilderPage />} />
              <Route path="delegation-letter-v5" element={<DelegationLetterV5Page />} />
              <Route path="labor-exchange" element={<LaborExchangePage />} />
              <Route path="team-settlement" element={<TeamSettlementPage />} />
              <Route path="team-settlement-statistics" element={<TeamSettlementStatisticsPage />} />
              <Route path="team-settlement-statistics/management" element={<TeamSettlementStatisticsManagementPage />} />
              <Route path="team-settlement-stats" element={<TeamSettlementStatisticsPage />} />
              <Route path="team-settlement-stats/management" element={<TeamSettlementStatisticsManagementPage />} />
              <Route path="team-settlement-annual-statistics" element={<TeamSettlementAnnualStatisticsPage />} />
              <Route path="team-settlement-annual-statistics/management" element={<TeamSettlementAnnualStatisticsManagementPage />} />
              <Route path="team-settlement-annual-stats" element={<TeamSettlementAnnualStatisticsPage />} />
              <Route path="team-settlement-annual-stats/management" element={<TeamSettlementAnnualStatisticsManagementPage />} />
            </Route>

            {/* Office Management */}
            <Route path="/office/dashboard" element={<OfficeDashboardPage />} />
            <Route path="/office/request-center" element={<OfficeRequestCenterPage />} />
            <Route
              path="/office/daily-review"
              element={
                <OperationalWorkflowPage
                  eyebrow="사무실 검수"
                  title="일보 / 출역 검수"
                  description="일보 목록, 일정 확정 보드, 통계 화면으로 이동해 출역 누락과 일보 상태를 확인합니다."
                  actions={[
                    { label: '일보 목록 확인', description: '작업자별/일자별 일보와 출역 기록을 확인합니다.', path: '/reports/daily?tab=list-v2' },
                    { label: '일정 확정 보드', description: '확정된 현장 배정과 출역 기준을 확인합니다.', path: '/assignment/schedule-confirmation' },
                    { label: '일보 통계', description: '기간별 출역 흐름과 누락 가능성을 점검합니다.', path: '/reports/statistics' },
                  ]}
                />
              }
            />
            <Route
              path="/office/worker-documents"
              element={
                <OperationalWorkflowPage
                  eyebrow="사무실 관리"
                  title="작업자 / 계좌 / 서류 관리"
                  description="작업자 기본정보, 계좌, 신분증/통장/위임장 확인 업무를 기존 관리 화면과 연결합니다."
                  actions={[
                    { label: '통합 DB', description: '작업자 기본정보와 소속팀 정보를 관리합니다.', path: '/database/manpower-db' },
                    { label: '작업자 계좌', description: '급여 지급에 사용하는 작업자 계좌 정보를 확인합니다.', path: '/payroll/taxinvoice/account-inquiry?tab=workers' },
                    { label: '위임장 관리', description: '급여 수령 위임장과 서명 문서를 확인합니다.', path: '/payroll/delegation-letter' },
                  ]}
                />
              }
            />
            <Route
              path="/office/communications"
              element={
                <OperationalWorkflowPage
                  eyebrow="사무실 커뮤니케이션"
                  title="공지 / 메시지 발송"
                  description="공지사항 작성, 업무 메시지 발송, 발송 내역 확인 화면으로 이동합니다."
                  actions={[
                    { label: '공지사항', description: '회사/급여/현장 공지를 작성하고 확인합니다.', path: '/notices' },
                    { label: '메시지 작성', description: '대상자를 선택해 업무 메시지를 발송합니다.', path: '/messages/compose' },
                    { label: '메시지함', description: '발송 및 수신 메시지를 확인합니다.', path: '/messages' },
                  ]}
                />
              }
            />
            <Route
              path="/office/payroll-check"
              element={
                <OperationalWorkflowPage
                  eyebrow="사무실 급여"
                  title="급여 지급 전 확인"
                  description="급여 지급 전에 일보, 가불, 세금/공제, 팀별 명세를 확인합니다."
                  actions={[
                    { label: '급여 지급 관리', description: '일급/월급 지급 준비와 지급 상태를 확인합니다.', path: '/payroll/wage-payment' },
                    { label: '가불 처리', description: '승인된 가불과 지급완료 상태를 확인합니다.', path: '/payroll/advance-payment' },
                    { label: '팀장별 명세서', description: '팀별 세금/가불 명세를 확인합니다.', path: '/payroll/team-payslip' },
                  ]}
                />
              }
            />
            <Route
              path="/office/audit-log"
              element={
                <OperationalWorkflowPage
                  eyebrow="사무실 이력"
                  title="처리 이력 / 로그"
                  description="데이터 변경, 접속, 일보, 매입매출 로그 화면으로 이동해 처리 이력을 추적합니다."
                  actions={[
                    { label: '통합 DB 로그', description: '기초 데이터 변경 이력을 확인합니다.', path: '/database/logs' },
                    { label: '일보 로그', description: '일보 변경 이력을 확인합니다.', path: '/reports/daily-logs' },
                    { label: '접속 로그', description: '사용자 접속 이력을 확인합니다.', path: '/admin/login-logs' },
                  ]}
                />
              }
            />
            <Route path="/office/management" element={<OfficeManagementPage />} />
            <Route path="/office/team-settlement-management" element={<OfficeTeamSettlementManagementPage />} />
            <Route path="/office/team-settlement" element={<OfficeTeamSettlementManagementPage />} />
            <Route path="/office/payroll" element={<OfficeStaffPayrollPage />} />

            <Route
              path="/team/requests"
              element={
                <OperationalWorkflowPage
                  eyebrow="팀장 업무"
                  title="팀 요청함"
                  description="팀원 휴무, 인원 요청, 경비 요청, 가불 현황을 확인하는 팀장용 업무 허브입니다."
                  actions={[
                    { label: '현장 인원 요청', description: '현장별 필요 인원과 휴무 요청을 등록/확인합니다.', path: '/assignment/field-request' },
                    { label: '경비 요청', description: '팀 경비와 후청구 요청을 확인합니다.', path: '/support/expense-claims' },
                    { label: '가불 현황', description: '팀 단위 가불/공제 상태를 확인합니다.', path: '/payroll/advance-payment' },
                  ]}
                />
              }
            />
            <Route
              path="/worker/home"
              element={
                <OperationalWorkflowPage
                  eyebrow="작업자 홈"
                  title="오늘 업무"
                  description="모바일 작업자 홈에서 자주 쓰는 일정, 출역, 급여, 신청 화면으로 바로 이동합니다."
                  actions={[
                    { label: '내 일정', description: '오늘 배정 현장과 일정 확정 상태를 확인합니다.', path: '/assignment/schedule-confirmation' },
                    { label: '내 출역 확인', description: '최근 출역과 일보 기록을 확인합니다.', path: '/reports/daily?tab=list-v2' },
                    { label: '가불 신청', description: '가불 신청과 처리 상태를 확인합니다.', path: '/payroll/advance-request' },
                    { label: '휴무 신청', description: '휴무/결근/개인 일정 요청을 등록합니다.', path: '/assignment/off-duty-request' },
                    { label: '위임장 서명', description: '위임장 내용을 확인하고 동의한 뒤 직접 서명합니다.', path: '/worker/delegation-signature' },
                  ]}
                />
              }
            />
            <Route path="/worker/delegation-signature" element={<WorkerDelegationSignaturePage />} />

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
            <Route path="/messages/automation-logs" element={<MessageAutomationLogPage />} />

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
            <Route path="/assignment/off-duty-request" element={<WorkerOffDutyRequestPage />} />
            <Route path="/worker/off-duty-request" element={<WorkerOffDutyRequestPage />} />
            <Route path="/assignment/field-schedule" element={<FieldSchedulePlannerPage />} />
            <Route path="/assignment/schedule-confirmation" element={<ScheduleConfirmationBoardPage />} />
            <Route path="/assignment/schedule-confirmation-board" element={<ScheduleConfirmationBoardPage />} />
            <Route path="/assignment/team-assignment" element={<TeamAssignmentPage />} />
            <Route path="/assignment/site-assignment" element={<SiteAssignmentPage />} />

            {/* HR Management */}
            <Route path="/hr/position-management" element={<Navigate to="/admin/user-management" replace />} />
            <Route path="/hr/position-assignment" element={<Navigate to="/admin/user-management" replace />} />
            <Route path="/hr/rate-change" element={<RateChangePage />} />

            {/* Support Management */}
            <Route path="/support/settings" element={<SupportSettingsPage />} />
            <Route path="/support/status" element={<SupportStatusPage />} />
            <Route path="/support/accommodation" element={<SupportManagerPage />} />
            <Route path="/support/accommodation/logs" element={<AccommodationBillingLogPage />} />
            <Route path="/support/vehicles" element={<SupportManagerPage />} />
            <Route path="/support/vehicles/oil-cycle" element={<EngineOilCyclePage />} />
            <Route path="/support/vehicles/engine-oil" element={<EngineOilCyclePage />} />
            <Route path="/support/engine-oil" element={<EngineOilCyclePage />} />
            <Route path="/support/vehicles/team-equipment" element={<TeamEquipmentStatusPage />} />
            <Route path="/support/team-equipment" element={<TeamEquipmentStatusPage />} />
            <Route path="/support/team-equipment-status" element={<TeamEquipmentStatusPage />} />
            <Route path="/support/vehicles/logs" element={<VehicleBillingLogPage />} />
            <Route path="/support/cards" element={<SupportManagerPage />} />
            <Route path="/support/cards/logs" element={<CardBillingLogPage />} />
            <Route path="/support/expense-ledger" element={<SupportManagerPage />} />
            <Route path="/support/expense-claims" element={<SupportManagerPage />} />
            <Route path="/support/expense-claim-input" element={<SupportManagerPage />} />
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
              <Route path="inbound-certificate" element={<MaterialInboundCertificatePage />} />
              <Route path="outbound-certificate" element={<MaterialOutboundCertificatePage />} />
              <Route path="transactions" element={<MaterialTransactionsPage />} />
              <Route path="transactions-by-site-date" element={<MaterialTransactionsBySiteDatePage />} />
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
              <Route path="user-management/*" element={<UserManagementPage />} />
              <Route path="login-logs" element={<LoginLogPage />} />
              <Route path="permission-change-logs" element={<PermissionChangeLogPage />} />
              <Route path="excel-transfer-logs" element={<ExcelTransferLogPage />} />
              <Route path="pdf-transfer-logs" element={<PdfTransferLogPage />} />
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
              <Route path="menu" element={<AdvancedMenuManager />} />
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
            <Route path="/corp/company/ceo-intro" element={<CheongyeonGreetingPage />} />
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
