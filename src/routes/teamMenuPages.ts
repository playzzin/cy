const loadWorkers = () => import('../pages/manpower/TeamWorkerDetailPage');
const loadSites = () => import('../pages/manpower/SiteResponsibleDetailPage');
export const loadMaterialWorkspace = () => import('../pages/materials/MaterialManagementPage');

// Each of these pages loads its own data. No shared MasterDataProvider fetch is needed.
export const teamMenuPages = {
  '/dashboard': () => import('../pages/DashboardPage'),
  '/manpower/team-worker-detail': loadWorkers,
  '/manpower/team-worker-history': loadWorkers,
  '/manpower/team-worker-payslip': loadWorkers,
  '/manpower/site-responsible-detail': loadSites,
  '/manpower/site-daily-report': loadSites,
  '/manpower/summary': () => import('../pages/manpower/WorkerSummaryPage'),
  '/assignment/schedule-confirmation': () => import('../pages/assignment/ScheduleConfirmationBoardPage'),
  '/manpower/team-worker-requests': () => import('../pages/manpower/TeamWorkerRequestPage'),
  '/support/team-expense-requests': () => import('../pages/support/TeamExpenseRequestPage'),
  '/payroll/advance-request': () => import('../pages/payroll/WorkerAdvanceRequestPage'),
  '/payroll/team-settlement': () => import('../pages/payroll/TeamSettlementPage'),
  '/team/requests': () => import('../pages/office/OperationalWorkflowPage'),
  '/support/vehicles/oil-cycle': () => import('../pages/support/EngineOilCyclePage'),
  '/support/team-resource-detail': () => import('../pages/support/TeamResourceDetailPage'),
  '/materials/inbound': async () => {
    const [page] = await Promise.all([import('../pages/materials/MaterialInboundPage'), loadMaterialWorkspace()]);
    return page;
  },
  '/notices': () => import('../pages/notices/NoticeBoardPage'),
  '/worker/delegation-signature': () => import('../pages/worker/WorkerDelegationSignaturePage'),
};

export function getTeamMenuPage(pathname: string): (() => Promise<unknown>) | undefined {
  const path = pathname.replace(/\/+$/, '');
  return Object.prototype.hasOwnProperty.call(teamMenuPages, path)
    ? teamMenuPages[path as keyof typeof teamMenuPages]
    : undefined;
}
