export type DataQualitySeverity = 'critical' | 'warning' | 'info';
export type DataQualityDomain = 'worker' | 'team' | 'site' | 'company' | 'dailyReport' | 'task';

export interface DataQualityIssue {
  id: string;
  severity: DataQualitySeverity;
  domain: DataQualityDomain;
  title: string;
  description: string;
  entityLabel: string;
  entityId?: string;
  route?: string;
  autoFixable: boolean;
}

export interface DataQualityAuditInput {
  workers: Array<Record<string, any>>;
  teams: Array<Record<string, any>>;
  sites: Array<Record<string, any>>;
  companies: Array<Record<string, any>>;
  reports: Array<Record<string, any>>;
  tasks?: Array<Record<string, any>>;
  today?: Date;
}

export interface DataQualityAuditSummary {
  totalIssues: number;
  critical: number;
  warning: number;
  info: number;
  scanned: {
    workers: number;
    teams: number;
    sites: number;
    companies: number;
    reports: number;
    tasks: number;
  };
  issues: DataQualityIssue[];
  generatedAt: string;
}

const normalizeKey = (value: unknown): string =>
  String(value ?? '').trim().replace(/\s+/g, '').toLowerCase();

const asText = (value: unknown): string => String(value ?? '').trim();

const isActiveStatus = (value: unknown): boolean => {
  const status = normalizeKey(value);
  return !status || ['active', '재직', '진행중', '운영중', '사용'].includes(status);
};

const isOpenTaskStatus = (value: unknown): boolean => {
  const status = normalizeKey(value);
  return !/완료|검수|complete|done|closed/.test(status);
};

const createId = (...parts: unknown[]): string =>
  parts.map((part) => asText(part) || 'unknown').join(':');

const mapById = (rows: Array<Record<string, any>>): Map<string, Record<string, any>> => {
  const result = new Map<string, Record<string, any>>();
  rows.forEach((row) => {
    const id = asText(row.id || row.legacyId);
    if (id) result.set(id, row);
  });
  return result;
};

const routeForDomain = (domain: DataQualityDomain): string => {
  switch (domain) {
    case 'worker':
      return '/database/manpower-db';
    case 'team':
      return '/database/team-db';
    case 'site':
      return '/site/management';
    case 'company':
      return '/database/company-db';
    case 'dailyReport':
      return '/reports/daily';
    case 'task':
      return '/todo';
    default:
      return '/admin/integrity';
  }
};

const pushIssue = (
  issues: DataQualityIssue[],
  issue: Omit<DataQualityIssue, 'route'>
) => {
  issues.push({
    ...issue,
    route: routeForDomain(issue.domain),
  });
};

export const analyzeErpDataQuality = (input: DataQualityAuditInput): DataQualityAuditSummary => {
  const issues: DataQualityIssue[] = [];
  const today = input.today ?? new Date();
  const todayTime = new Date(today);
  todayTime.setHours(0, 0, 0, 0);

  const teamById = mapById(input.teams);
  const siteById = mapById(input.sites);
  const companyById = mapById(input.companies);
  const workerById = mapById(input.workers);
  const workerDuplicateMap = new Map<string, Record<string, any>[]>();

  input.workers.forEach((worker, index) => {
    const workerId = asText(worker.id || worker.legacyId || index);
    const workerName = asText(worker.name || worker.workerName);
    const label = workerName || `작업자 ${index + 1}`;
    const duplicateKey = normalizeKey(worker.idNumber || worker.residentNumber || worker.contact || worker.phone || workerName);

    if (!workerName) {
      pushIssue(issues, {
        id: createId('worker-name', workerId),
        severity: 'critical',
        domain: 'worker',
        title: '작업자 이름 누락',
        description: '작업자 마스터에 이름이 없어 배정, 급여, 일보 검색에서 누락될 수 있습니다.',
        entityLabel: label,
        entityId: workerId,
        autoFixable: false,
      });
    }

    if (duplicateKey) {
      const rows = workerDuplicateMap.get(duplicateKey) ?? [];
      rows.push(worker);
      workerDuplicateMap.set(duplicateKey, rows);
    }

    const teamId = asText(worker.teamId);
    if (teamId && !teamById.has(teamId)) {
      pushIssue(issues, {
        id: createId('worker-team-missing', workerId, teamId),
        severity: 'critical',
        domain: 'worker',
        title: '작업자 팀 연결 끊김',
        description: `작업자에 저장된 팀 ID(${teamId})가 팀 마스터에 없습니다.`,
        entityLabel: label,
        entityId: workerId,
        autoFixable: false,
      });
    }

    const companyId = asText(worker.companyId);
    if (companyId && !companyById.has(companyId)) {
      pushIssue(issues, {
        id: createId('worker-company-missing', workerId, companyId),
        severity: 'critical',
        domain: 'worker',
        title: '작업자 회사 연결 끊김',
        description: `작업자에 저장된 회사 ID(${companyId})가 회사 마스터에 없습니다.`,
        entityLabel: label,
        entityId: workerId,
        autoFixable: false,
      });
    }

    if (isActiveStatus(worker.status) && !teamId && !companyId) {
      pushIssue(issues, {
        id: createId('active-worker-unassigned', workerId),
        severity: 'warning',
        domain: 'worker',
        title: '재직 작업자 소속 미지정',
        description: '재직 상태지만 팀과 회사가 모두 비어 있어 운영/정산 필터에서 누락될 수 있습니다.',
        entityLabel: label,
        entityId: workerId,
        autoFixable: false,
      });
    }
  });

  workerDuplicateMap.forEach((rows, key) => {
    if (rows.length < 2) return;
    pushIssue(issues, {
      id: createId('worker-duplicate', key),
      severity: 'warning',
      domain: 'worker',
      title: '작업자 중복 의심',
      description: '이름, 연락처 또는 식별번호가 같은 작업자가 2건 이상 있습니다.',
      entityLabel: rows.map((row) => asText(row.name || row.workerName || row.id)).join(', '),
      autoFixable: false,
    });
  });

  input.teams.forEach((team, index) => {
    const teamId = asText(team.id || team.legacyId || index);
    const teamName = asText(team.name) || `팀 ${index + 1}`;
    const companyId = asText(team.companyId);

    if (!asText(team.name)) {
      pushIssue(issues, {
        id: createId('team-name', teamId),
        severity: 'critical',
        domain: 'team',
        title: '팀 이름 누락',
        description: '팀 이름이 없어 배정, 메뉴, 정산 화면에서 식별이 어렵습니다.',
        entityLabel: teamName,
        entityId: teamId,
        autoFixable: false,
      });
    }

    if (companyId && !companyById.has(companyId)) {
      pushIssue(issues, {
        id: createId('team-company-missing', teamId, companyId),
        severity: 'warning',
        domain: 'team',
        title: '팀 회사 연결 끊김',
        description: `팀에 저장된 회사 ID(${companyId})가 회사 마스터에 없습니다.`,
        entityLabel: teamName,
        entityId: teamId,
        autoFixable: false,
      });
    }
  });

  input.sites.forEach((site, index) => {
    const siteId = asText(site.id || site.legacyId || index);
    const siteName = asText(site.name) || `현장 ${index + 1}`;
    const responsibleTeamId = asText(site.responsibleTeamId);
    const clientCompanyId = asText(site.clientCompanyId || site.companyId);

    if (!asText(site.name)) {
      pushIssue(issues, {
        id: createId('site-name', siteId),
        severity: 'critical',
        domain: 'site',
        title: '현장 이름 누락',
        description: '현장 이름이 없어 일보와 정산 화면에서 식별이 어렵습니다.',
        entityLabel: siteName,
        entityId: siteId,
        autoFixable: false,
      });
    }

    if (isActiveStatus(site.status) && responsibleTeamId && !teamById.has(responsibleTeamId)) {
      pushIssue(issues, {
        id: createId('site-team-missing', siteId, responsibleTeamId),
        severity: 'critical',
        domain: 'site',
        title: '현장 담당팀 연결 끊김',
        description: `현장 담당팀 ID(${responsibleTeamId})가 팀 마스터에 없습니다.`,
        entityLabel: siteName,
        entityId: siteId,
        autoFixable: false,
      });
    }

    if (isActiveStatus(site.status) && !clientCompanyId) {
      pushIssue(issues, {
        id: createId('site-company-empty', siteId),
        severity: 'warning',
        domain: 'site',
        title: '활성 현장 발주/소속 회사 미지정',
        description: '활성 현장에 회사 연결이 없어 거래처별 정산/통계에서 누락될 수 있습니다.',
        entityLabel: siteName,
        entityId: siteId,
        autoFixable: false,
      });
    }
  });

  input.reports.forEach((report, index) => {
    const reportId = asText(report.id || index);
    const label = `${asText(report.date) || '날짜 없음'} ${asText(report.siteName) || asText(report.siteId) || '현장 없음'}`.trim();
    const reportSiteId = asText(report.siteId);
    const reportTeamId = asText(report.teamId);
    const reportWorkers = Array.isArray(report.workers) ? report.workers : [];
    const manDay = Number(report.totalManDay ?? report.manDay ?? 0);

    if (!asText(report.date) || !reportSiteId || !reportTeamId) {
      pushIssue(issues, {
        id: createId('report-required', reportId),
        severity: 'critical',
        domain: 'dailyReport',
        title: '일보 필수 연결값 누락',
        description: '일보 날짜, 현장, 팀 중 하나 이상이 비어 있습니다.',
        entityLabel: label,
        entityId: reportId,
        autoFixable: false,
      });
    }

    if (reportSiteId && !siteById.has(reportSiteId)) {
      pushIssue(issues, {
        id: createId('report-site-missing', reportId, reportSiteId),
        severity: 'critical',
        domain: 'dailyReport',
        title: '일보 현장 연결 끊김',
        description: `일보의 현장 ID(${reportSiteId})가 현장 마스터에 없습니다.`,
        entityLabel: label,
        entityId: reportId,
        autoFixable: false,
      });
    }

    if (reportTeamId && !teamById.has(reportTeamId)) {
      pushIssue(issues, {
        id: createId('report-team-missing', reportId, reportTeamId),
        severity: 'critical',
        domain: 'dailyReport',
        title: '일보 팀 연결 끊김',
        description: `일보의 팀 ID(${reportTeamId})가 팀 마스터에 없습니다.`,
        entityLabel: label,
        entityId: reportId,
        autoFixable: false,
      });
    }

    if (reportWorkers.length > 0 && manDay <= 0) {
      pushIssue(issues, {
        id: createId('report-zero-manday', reportId),
        severity: 'warning',
        domain: 'dailyReport',
        title: '일보 공수 0',
        description: '작업자 내역은 있지만 총 공수가 0입니다. 급여/정산 누락 가능성이 있습니다.',
        entityLabel: label,
        entityId: reportId,
        autoFixable: false,
      });
    }

    reportWorkers.forEach((worker: Record<string, any>, workerIndex: number) => {
      const workerId = asText(worker.workerId || worker.id);
      if (workerId && !workerById.has(workerId)) {
        pushIssue(issues, {
          id: createId('report-worker-missing', reportId, workerId, workerIndex),
          severity: 'warning',
          domain: 'dailyReport',
          title: '일보 작업자 연결 끊김',
          description: `일보 작업자 ID(${workerId})가 작업자 마스터에 없습니다.`,
          entityLabel: `${label} / ${asText(worker.name || worker.workerName || workerId)}`,
          entityId: reportId,
          autoFixable: false,
        });
      }
    });
  });

  (input.tasks ?? []).forEach((task, index) => {
    const taskId = asText(task.id || index);
    const title = asText(task.title) || `업무 ${index + 1}`;
    const dueDateText = asText(task.dueDate);

    if (!asText(task.assignee)) {
      pushIssue(issues, {
        id: createId('task-assignee-empty', taskId),
        severity: 'warning',
        domain: 'task',
        title: '업무 담당자 미지정',
        description: '담당자가 없어 SLA 추적과 알림 대상 산정이 어렵습니다.',
        entityLabel: title,
        entityId: taskId,
        autoFixable: false,
      });
    }

    if (!dueDateText) {
      pushIssue(issues, {
        id: createId('task-due-empty', taskId),
        severity: 'info',
        domain: 'task',
        title: '업무 기한 미지정',
        description: '기한이 없어 지연 위험을 계산할 수 없습니다.',
        entityLabel: title,
        entityId: taskId,
        autoFixable: false,
      });
      return;
    }

    const dueDate = new Date(dueDateText);
    dueDate.setHours(0, 0, 0, 0);
    if (!Number.isNaN(dueDate.getTime()) && dueDate < todayTime && isOpenTaskStatus(task.status)) {
      pushIssue(issues, {
        id: createId('task-overdue', taskId),
        severity: 'warning',
        domain: 'task',
        title: '업무 SLA 지연',
        description: `기한(${dueDateText})이 지났지만 완료되지 않았습니다.`,
        entityLabel: title,
        entityId: taskId,
        autoFixable: false,
      });
    }
  });

  const critical = issues.filter((issue) => issue.severity === 'critical').length;
  const warning = issues.filter((issue) => issue.severity === 'warning').length;
  const info = issues.filter((issue) => issue.severity === 'info').length;

  return {
    totalIssues: issues.length,
    critical,
    warning,
    info,
    scanned: {
      workers: input.workers.length,
      teams: input.teams.length,
      sites: input.sites.length,
      companies: input.companies.length,
      reports: input.reports.length,
      tasks: input.tasks?.length ?? 0,
    },
    issues: issues.sort((a, b) => {
      const severityRank: Record<DataQualitySeverity, number> = { critical: 0, warning: 1, info: 2 };
      return severityRank[a.severity] - severityRank[b.severity] || a.domain.localeCompare(b.domain);
    }),
    generatedAt: new Date().toISOString(),
  };
};

export const dataQualityAuditService = {
  async run(): Promise<DataQualityAuditSummary> {
    const [
      { manpowerService },
      { teamService },
      { siteService },
      { companyService },
      { dailyReportService },
      { taskService },
    ] = await Promise.all([
      import('./manpowerService'),
      import('./teamService'),
      import('./siteService'),
      import('./companyService'),
      import('./dailyReportService'),
      import('./taskService'),
    ]);

    const [workers, teams, sites, companies, reports, tasks] = await Promise.all([
      manpowerService.getWorkers(),
      teamService.getTeams(),
      siteService.getSites(),
      companyService.getCompanies(),
      dailyReportService.getAllReports(),
      taskService.getTasks(),
    ]);

    return analyzeErpDataQuality({
      workers: workers as Array<Record<string, any>>,
      teams: teams as Array<Record<string, any>>,
      sites: sites as Array<Record<string, any>>,
      companies: companies as Array<Record<string, any>>,
      reports: reports as Array<Record<string, any>>,
      tasks: tasks as Array<Record<string, any>>,
    });
  },
};
