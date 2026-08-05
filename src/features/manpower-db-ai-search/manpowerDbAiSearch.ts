import {
    filterReportsByDateRange,
    type IntegratedDatabaseOverviewSnapshot,
} from '../../pages/database/manpowerDatabaseOverview';
import type { Worker } from '../../services/manpowerService';
import type { Team } from '../../services/teamService';
import type { Site } from '../../services/siteService';
import type { Company } from '../../services/companyService';
import type { DailyReport, DailyReportWorker } from '../../services/dailyReportService';
import { parseManpowerDbQuestion } from './manpowerDbQueryParser';
import {
    compareTeamActivity,
    filterReports,
    findSitesWithoutResponsibleTeamWithReports,
    findWorkersFromReports,
    buildManpowerDbSupportFlows,
    type ManpowerDbSupportFlow,
} from './manpowerDbAnalysisEngine';
import { parseManpowerDbQuestionHybrid } from './manpowerDbLlmParser';
import { resolveManpowerDbEntities } from './manpowerDbEntityResolver';
import { buildManpowerDbQueryPlan } from './manpowerDbQueryPlanner';
import { createDeterministicManpowerDbExplanation } from './manpowerDbResultExplainer';
import { rankTextMatch } from './manpowerDbSearchRanking';
import {
    MANPOWER_DB_TAB_PATHS,
    ManpowerDbRelatedData,
    ManpowerDbSearchAction,
    ManpowerDbSearchField,
    ManpowerDbSearchQuery,
    ManpowerDbSearchResult,
    ManpowerDbSearchResultType,
    ManpowerDbSearchRow,
} from './manpowerDbSearchTypes';
import type { ManpowerDbEntityCandidate } from './manpowerDbEntityResolver';

export { MANPOWER_DB_EXAMPLE_QUESTIONS, shouldUseManpowerDbSearch } from './manpowerDbQueryParser';
export type {
    ManpowerDbRelatedData,
    ManpowerDbSearchAction,
    ManpowerDbSearchField,
    ManpowerDbSearchQuery,
    ManpowerDbSearchResult,
    ManpowerDbSearchRow,
} from './manpowerDbSearchTypes';

const MAX_ROWS = 50;
const ACTIVE_WORKER_STATUS = '재직';
const RETIRED_WORKER_STATUS = '퇴사';
const ACTIVE_SITE_STATUS = 'active';

const text = (value: unknown): string => String(value ?? '').trim();
const hasText = (value: unknown): boolean => text(value).length > 0;

const normalize = (value: unknown): string => text(value)
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[()（）]/g, '')
    .replace(/주식회사|유한회사|\(주\)|㈜|주\)/g, '');

const includesLoose = (candidate: unknown, keyword?: string): boolean => {
    const normalizedKeyword = normalize(keyword);
    if (!normalizedKeyword) return true;
    return normalize(candidate).includes(normalizedKeyword);
};

const uniqBy = <T,>(rows: T[], getKey: (row: T) => string): T[] => {
    const seen = new Set<string>();
    const result: T[] = [];
    rows.forEach((row) => {
        const key = getKey(row);
        if (!key || seen.has(key)) return;
        seen.add(key);
        result.push(row);
    });
    return result;
};

export const maskPhoneNumber = (value?: string | null): string => {
    const digits = text(value).replace(/\D/g, '');
    if (digits.length < 7) return value ? '****' : '없음';
    const first = digits.slice(0, Math.min(3, digits.length - 4));
    const last = digits.slice(-4);
    return `${first}-****-${last}`;
};

export const maskAccountNumber = (value?: string | null): string => {
    const raw = text(value);
    const digits = raw.replace(/\D/g, '');
    if (!raw) return '없음';
    if (digits.length >= 7) {
        return `${digits.slice(0, 3)}-****-${digits.slice(-3)}`;
    }
    if (raw.length > 4) {
        return `${raw.slice(0, 2)}****${raw.slice(-2)}`;
    }
    return '****';
};

const statusLabel = (value: unknown, fallback = '미지정'): string => text(value) || fallback;
const accountLabel = (bankName?: string | null, accountNumber?: string | null, holder?: string | null): string => {
    if (!hasText(accountNumber)) return '없음';
    return [text(bankName), maskAccountNumber(accountNumber), text(holder)].filter(Boolean).join(' / ');
};

const makeAction = (label: string, path: string): ManpowerDbSearchAction => ({ label, path });

const rowPath = (entity: 'worker' | 'team' | 'site' | 'company'): string => {
    if (entity === 'worker') return MANPOWER_DB_TAB_PATHS.workers;
    if (entity === 'team') return MANPOWER_DB_TAB_PATHS.teams;
    if (entity === 'site') return MANPOWER_DB_TAB_PATHS.sites;
    return MANPOWER_DB_TAB_PATHS.companies;
};

const makeWorkerRow = (worker: Worker, snapshot: IntegratedDatabaseOverviewSnapshot): ManpowerDbSearchRow => {
    const team = findTeamForWorker(worker, snapshot);
    const company = findCompanyForWorker(worker, snapshot);
    const site = findSiteForWorker(worker, snapshot);

    return {
        id: text(worker.id) || text(worker.uid) || text(worker.name),
        rowType: 'worker',
        name: text(worker.name) || '이름 없음',
        subtitle: [text(team?.name || worker.teamName), text(site?.name || worker.siteName)].filter(Boolean).join(' · '),
        status: statusLabel(worker.status),
        badges: [text(worker.role), text(worker.salaryModel || worker.payType)].filter(Boolean),
        path: MANPOWER_DB_TAB_PATHS.workers,
        rawRef: { entity: 'worker', id: text(worker.id) },
        fields: [
            { label: '소속팀', value: text(team?.name || worker.teamName) || '미배정', tone: team ? 'info' : 'warning' },
            { label: '현장', value: text(site?.name || worker.siteName) || '미지정', tone: site ? 'default' : 'muted' },
            { label: '회사', value: text(company?.name || worker.companyName) || '미지정', tone: company ? 'default' : 'muted' },
            { label: '연락처', value: maskPhoneNumber(worker.contact), tone: hasText(worker.contact) ? 'default' : 'muted' },
            { label: '계좌', value: accountLabel(worker.bankName, worker.accountNumber, worker.accountHolder), tone: hasText(worker.accountNumber) ? 'success' : 'warning' },
        ],
    };
};

const makeTeamRow = (team: Team): ManpowerDbSearchRow => ({
    id: text(team.id) || text(team.name),
    rowType: 'team',
    name: text(team.name) || '팀명 없음',
    subtitle: text(team.companyName) || text(team.type) || undefined,
    status: statusLabel(team.status),
    badges: [text(team.type), `${Number(team.memberCount || 0)}명`].filter(Boolean),
    path: MANPOWER_DB_TAB_PATHS.teams,
    rawRef: { entity: 'team', id: text(team.id) },
    fields: [
        { label: '팀장', value: text(team.leaderName) || '미지정', tone: hasText(team.leaderName) ? 'default' : 'muted' },
        { label: '회사', value: text(team.companyName) || '미지정', tone: hasText(team.companyName) ? 'default' : 'muted' },
        { label: '담당 현장', value: Array.isArray(team.siteNames) && team.siteNames.length > 0 ? team.siteNames.join(', ') : '미지정', tone: Array.isArray(team.siteNames) && team.siteNames.length > 0 ? 'info' : 'muted' },
        { label: '계좌', value: accountLabel(team.bankName, team.accountNumber, team.accountHolder), tone: hasText(team.accountNumber) ? 'success' : 'warning' },
    ],
});

const makeSiteRow = (site: Site): ManpowerDbSearchRow => ({
    id: text(site.id) || text(site.name),
    rowType: 'site',
    name: text(site.name) || '현장명 없음',
    subtitle: text(site.address) || undefined,
    status: statusLabel(site.status),
    badges: [text(site.code), text(site.siteType)].filter(Boolean),
    path: MANPOWER_DB_TAB_PATHS.sites,
    rawRef: { entity: 'site', id: text(site.id) },
    fields: [
        { label: '담당팀', value: text(site.responsibleTeamName) || '없음', tone: hasText(site.responsibleTeamName) || hasText(site.responsibleTeamId) ? 'info' : 'warning' },
        { label: '현장소장', value: text(site.siteManagerName) || '미지정', tone: hasText(site.siteManagerName) ? 'default' : 'muted' },
        { label: '원청/시공사', value: text(site.companyName || site.constructorCompanyName) || '미지정', tone: hasText(site.companyName || site.constructorCompanyName) ? 'default' : 'muted' },
        { label: '협력사', value: text(site.partnerName || site.clientCompanyName) || '미지정', tone: hasText(site.partnerName || site.clientCompanyName) ? 'default' : 'muted' },
    ],
});

const makeCompanyRow = (company: Company): ManpowerDbSearchRow => ({
    id: text(company.id) || text(company.name),
    rowType: 'company',
    name: text(company.name) || '회사명 없음',
    subtitle: text(company.ceoName) ? `대표 ${text(company.ceoName)}` : undefined,
    status: statusLabel(company.status),
    badges: [text(company.type), text(company.code)].filter(Boolean),
    path: MANPOWER_DB_TAB_PATHS.companies,
    rawRef: { entity: 'company', id: text(company.id) },
    fields: [
        { label: '연락처', value: maskPhoneNumber(company.phone), tone: hasText(company.phone) ? 'default' : 'muted' },
        { label: '담당 현장', value: Array.isArray(company.siteNames) && company.siteNames.length > 0 ? company.siteNames.join(', ') : '미지정', tone: Array.isArray(company.siteNames) && company.siteNames.length > 0 ? 'info' : 'muted' },
        { label: '계좌', value: accountLabel(company.bankName, company.accountNumber, company.accountHolder), tone: hasText(company.accountNumber) ? 'success' : 'warning' },
    ],
});

const makeSupportFlowRow = (flow: ManpowerDbSupportFlow): ManpowerDbSearchRow => ({
    id: flow.id,
    rowType: 'support',
    name: `${flow.supportOutTeamName} → ${flow.supportInTeamName}`,
    subtitle: `${flow.siteName || '미지정 현장'} · ${flow.workerName}`,
    status: flow.direction,
    badges: [flow.supportScope, flow.flowType, `${flow.totalManDay.toFixed(1)}공수`],
    path: '/support/status',
    rawRef: { entity: 'support', id: flow.id },
    source: 'support',
    matchReason: `${flow.supportScope} ${flow.flowType} 지원 방향으로 분류됨`,
    confidence: 0.88,
    fields: [
        { label: '지원방향', value: flow.direction, tone: flow.supportScope === '외부' ? 'warning' : 'info' },
        { label: '지원간 팀', value: flow.supportOutTeamName || '미지정', tone: 'info' },
        { label: '지원온 팀', value: flow.supportInTeamName || '미지정', tone: 'success' },
        { label: '현장', value: flow.siteName || '미지정' },
        { label: '작업자', value: flow.workerName || '미지정' },
        { label: '상대', value: flow.counterpartyName || '미지정', tone: 'muted' },
        { label: '공수', value: flow.totalManDay.toFixed(1), tone: 'info' },
        { label: '금액', value: `${Math.round(flow.totalAmount).toLocaleString('ko-KR')}원`, tone: 'default' },
        { label: '기간', value: flow.dates.length ? `${flow.dates[0]}~${flow.dates[flow.dates.length - 1]}` : '미지정', tone: 'muted' },
    ],
});

const makeSupportRelated = (
    flows: ManpowerDbSupportFlow[],
    snapshot: IntegratedDatabaseOverviewSnapshot
): ManpowerDbRelatedData => {
    const teamNames = new Set(flows.flatMap((flow) => [flow.supportOutTeamName, flow.supportInTeamName]).map(text).filter(Boolean));
    const siteNames = new Set(flows.map((flow) => text(flow.siteName)).filter(Boolean));
    const workerNames = new Set(flows.map((flow) => text(flow.workerName)).filter(Boolean));
    const related: ManpowerDbRelatedData = {};
    const teams = snapshot.teams.filter((team) => teamNames.has(text(team.name))).slice(0, 8).map(makeTeamRow);
    const sites = snapshot.sites.filter((site) => siteNames.has(text(site.name))).slice(0, 8).map(makeSiteRow);
    const workers = snapshot.workers.filter((worker) => workerNames.has(text(worker.name))).slice(0, 8).map((worker) => makeWorkerRow(worker, snapshot));
    if (teams.length) related.teams = teams;
    if (sites.length) related.sites = sites;
    if (workers.length) related.workers = workers;
    return related;
};

const findTeamForWorker = (worker: Worker, snapshot: IntegratedDatabaseOverviewSnapshot): Team | undefined => {
    const workerId = text(worker.id);
    const workerName = text(worker.name);
    return snapshot.teams.find((team) =>
        (hasText(worker.teamId) && text(team.id) === text(worker.teamId)) ||
        (hasText(worker.teamName) && includesLoose(team.name, worker.teamName)) ||
        (Array.isArray(team.memberIds) && team.memberIds.map(text).includes(workerId)) ||
        (Array.isArray(team.memberNames) && team.memberNames.some((name) => includesLoose(name, workerName)))
    );
};

const findSiteForWorker = (worker: Worker, snapshot: IntegratedDatabaseOverviewSnapshot): Site | undefined => (
    snapshot.sites.find((site) =>
        (hasText(worker.siteId) && text(site.id) === text(worker.siteId)) ||
        (hasText(worker.siteName) && includesLoose(site.name, worker.siteName))
    )
);

const findCompanyForWorker = (worker: Worker, snapshot: IntegratedDatabaseOverviewSnapshot): Company | undefined => (
    snapshot.companies.find((company) =>
        (hasText(worker.companyId) && text(company.id) === text(worker.companyId)) ||
        (hasText(worker.companyName) && includesLoose(company.name, worker.companyName))
    )
);

const teamMatchesWorker = (team: Team, worker: Worker): boolean => {
    const workerId = text(worker.id);
    const workerName = text(worker.name);
    return (hasText(worker.teamId) && text(worker.teamId) === text(team.id)) ||
        (hasText(worker.teamName) && includesLoose(worker.teamName, text(team.name))) ||
        (Array.isArray(team.memberIds) && team.memberIds.map(text).includes(workerId)) ||
        (Array.isArray(team.memberNames) && team.memberNames.some((name) => includesLoose(name, workerName)));
};

const reportWorkerId = (worker: DailyReportWorker): string => text(worker.workerId);
const reportWorkerName = (worker: DailyReportWorker): string => text((worker as DailyReportWorker & { workerName?: string }).workerName || worker.name);
const reportManDay = (worker: DailyReportWorker): number => {
    const row = worker as DailyReportWorker & { manDay?: number; gongsu?: number };
    return Number(row.manDay ?? row.gongsu ?? 0);
};

const reportMatchesSite = (report: DailyReport, site: Site): boolean => (
    (hasText(report.siteId) && text(report.siteId) === text(site.id)) ||
    includesLoose(report.siteName, text(site.name)) ||
    includesLoose((report as DailyReport & { site?: string }).site, text(site.name))
);

const workerAppearsInReports = (worker: Worker, reports: DailyReport[]): boolean => {
    const workerId = text(worker.id);
    const workerName = text(worker.name);
    return reports.some((report) => (report.workers || []).some((reportWorker) =>
        (workerId && reportWorkerId(reportWorker) === workerId) ||
        (workerName && includesLoose(reportWorkerName(reportWorker), workerName))
    ));
};

const rowsForWorkerReports = (
    reports: DailyReport[],
    snapshot: IntegratedDatabaseOverviewSnapshot
): ManpowerDbSearchRow[] => {
    const rows: ManpowerDbSearchRow[] = [];

    reports.forEach((report) => {
        (report.workers || [])
            .filter((worker) => reportManDay(worker) > 0)
            .forEach((reportWorker) => {
                const matchedWorker = snapshot.workers.find((worker) =>
                    (reportWorkerId(reportWorker) && text(worker.id) === reportWorkerId(reportWorker)) ||
                    includesLoose(worker.name, reportWorkerName(reportWorker))
                );

                if (matchedWorker) {
                    rows.push(makeWorkerRow(matchedWorker, snapshot));
                } else {
                    rows.push({
                        id: `${text(report.id)}_${reportWorkerId(reportWorker) || reportWorkerName(reportWorker)}`,
                        rowType: 'worker',
                        name: reportWorkerName(reportWorker) || '이름 없음',
                        subtitle: [text(report.siteName), text(report.teamName)].filter(Boolean).join(' · '),
                        status: '일보 전용',
                        badges: [text(report.date), `${reportManDay(reportWorker)}공수`],
                        path: MANPOWER_DB_TAB_PATHS.workers,
                        fields: [
                            { label: '일보일자', value: text(report.date), tone: 'info' },
                            { label: '현장', value: text(report.siteName) || text((report as DailyReport & { site?: string }).site) || '미지정' },
                            { label: '팀', value: text(report.teamName) || text((report as DailyReport & { team?: string }).team) || '미지정' },
                            { label: '계좌', value: '마스터 미매칭', tone: 'warning' },
                        ],
                    });
                }
            });
    });

    return uniqBy(rows, (row) => row.rawRef?.id || row.name);
};

const collectRelated = (
    rows: ManpowerDbSearchRow[],
    snapshot: IntegratedDatabaseOverviewSnapshot
): ManpowerDbRelatedData => {
    const workerRows = rows.filter((row) => row.rowType === 'worker');
    const relatedTeamIds = new Set<string>();
    const relatedSiteIds = new Set<string>();
    const relatedCompanyIds = new Set<string>();

    workerRows.forEach((row) => {
        const worker = snapshot.workers.find((item) => text(item.id) === text(row.rawRef?.id) || includesLoose(item.name, row.name));
        if (!worker) return;
        const team = findTeamForWorker(worker, snapshot);
        const site = findSiteForWorker(worker, snapshot);
        const company = findCompanyForWorker(worker, snapshot);
        if (team?.id) relatedTeamIds.add(text(team.id));
        if (site?.id) relatedSiteIds.add(text(site.id));
        if (company?.id) relatedCompanyIds.add(text(company.id));
    });

    const related: ManpowerDbRelatedData = {};
    const teams = snapshot.teams.filter((team) => relatedTeamIds.has(text(team.id))).slice(0, 8).map(makeTeamRow);
    const sites = snapshot.sites.filter((site) => relatedSiteIds.has(text(site.id))).slice(0, 8).map(makeSiteRow);
    const companies = snapshot.companies.filter((company) => relatedCompanyIds.has(text(company.id))).slice(0, 8).map(makeCompanyRow);

    if (teams.length) related.teams = teams;
    if (sites.length) related.sites = sites;
    if (companies.length) related.companies = companies;
    return related;
};

const completeResult = (params: {
    parsedQuestion: string;
    query: ManpowerDbSearchQuery;
    summary: string;
    resultType: ManpowerDbSearchResultType;
    rows: ManpowerDbSearchRow[];
    related?: ManpowerDbRelatedData;
    actions?: ManpowerDbSearchAction[];
    followUpQuestions?: string[];
    warnings?: string[];
}): ManpowerDbSearchResult => {
    const shownRows = params.rows.slice(0, MAX_ROWS);
    const warnings = [
        ...(params.warnings || []),
        '연락처와 계좌번호는 기본 마스킹했습니다. 주민번호/신분번호는 결과에 포함하지 않습니다.',
        '상세 민감정보 표시 권한 설계는 별도 단계에서 구현해야 합니다.',
    ];

    return {
        success: true,
        parsedQuestion: params.parsedQuestion,
        query: params.query,
        summary: params.summary,
        resultType: params.resultType,
        rows: shownRows,
        counts: { total: params.rows.length, shown: shownRows.length },
        related: params.related,
        actions: params.actions,
        followUpQuestions: params.followUpQuestions,
        warnings,
    };
};

const emptyResult = (
    parsedQuestion: string,
    query: ManpowerDbSearchQuery,
    resultType: ManpowerDbSearchResultType,
    actions: ManpowerDbSearchAction[]
): ManpowerDbSearchResult => completeResult({
    parsedQuestion,
    query,
    summary: '검색 조건에 맞는 데이터가 없습니다.',
    resultType,
    rows: [],
    actions,
    followUpQuestions: [
        '계좌 없는 작업자',
        '미배정 작업자',
        '담당팀 없는 진행중 현장',
    ],
});

const actionsForResultType = (resultType: ManpowerDbSearchResultType): ManpowerDbSearchAction[] => {
    if (resultType === 'worker_list') {
        return [makeAction('작업자 DB 열기', MANPOWER_DB_TAB_PATHS.workers), makeAction('계좌 탭 열기', MANPOWER_DB_TAB_PATHS.accounts)];
    }
    if (resultType === 'team_list') {
        return [makeAction('팀 DB 열기', MANPOWER_DB_TAB_PATHS.teams), makeAction('계좌 탭 열기', MANPOWER_DB_TAB_PATHS.accounts)];
    }
    if (resultType === 'site_list') {
        return [makeAction('현장 DB 열기', MANPOWER_DB_TAB_PATHS.sites)];
    }
    if (resultType === 'company_list') {
        return [makeAction('회사 DB 열기', MANPOWER_DB_TAB_PATHS.companies), makeAction('계좌 탭 열기', MANPOWER_DB_TAB_PATHS.accounts)];
    }
    if (resultType === 'support') {
        return [makeAction('지원 현황 보기', '/support/status'), makeAction('지원팀 분석 탭 보기', '/reports/statistics')];
    }
    return [
        makeAction('작업자 DB 열기', MANPOWER_DB_TAB_PATHS.workers),
        makeAction('팀 DB 열기', MANPOWER_DB_TAB_PATHS.teams),
        makeAction('현장 DB 열기', MANPOWER_DB_TAB_PATHS.sites),
        makeAction('회사 DB 열기', MANPOWER_DB_TAB_PATHS.companies),
    ];
};

const queryKeyword = (query: ManpowerDbSearchQuery): string | undefined =>
    query.filters.name ||
    query.filters.teamName ||
    query.filters.siteName ||
    query.filters.companyName ||
    query.filters.keyword;

const defaultSourceForRow = (row: ManpowerDbSearchRow): NonNullable<ManpowerDbSearchRow['source']> => {
    if (row.rowType === 'integrity') return 'integrity';
    if (row.status === '일보 전용') return 'daily_report';
    return 'master';
};

const defaultMatchReason = (row: ManpowerDbSearchRow, query: ManpowerDbSearchQuery): string => {
    if (query.filters.missingFields?.includes('accountNumber')) return '계좌번호 누락 조건과 일치';
    if (query.filters.missingFields?.some((field) => field.includes('responsibleTeam'))) return '담당팀 누락 조건과 일치';
    if (query.intent === 'comparison') return '기간별 일보 투입 공수 비교 결과';
    if (query.entity === 'integrity') return '마스터 데이터와 일보 데이터 대조 결과';

    const keyword = queryKeyword(query);
    if (keyword) {
        const rank = rankTextMatch([row.name, row.subtitle, ...(row.badges || [])].filter(Boolean).join(' '), keyword, rowTypeLabel(row.rowType));
        if (rank.score > 0) return rank.matchReason;
    }

    return `${rowTypeLabel(row.rowType)} 기본 조건 일치`;
};

const rowTypeLabel = (rowType: ManpowerDbSearchRow['rowType']): string => {
    if (rowType === 'worker') return '작업자';
    if (rowType === 'team') return '팀';
    if (rowType === 'site') return '현장';
    if (rowType === 'company') return '회사';
    if (rowType === 'support') return '지원';
    return '무결성';
};

const buildFilterLabels = (query: ManpowerDbSearchQuery): Array<{ label: string; value: string }> => {
    const filters: Array<{ label: string; value: string }> = [];
    const entries: Array<[string, string | undefined]> = [
        ['키워드', query.filters.keyword],
        ['이름', query.filters.name],
        ['팀', query.filters.teamName],
        ['현장', query.filters.siteName],
        ['회사', query.filters.companyName],
        ['상태', query.filters.status],
    ];

    entries.forEach(([label, value]) => {
        if (value) filters.push({ label, value });
    });
    if (query.filters.missingFields?.length) {
        filters.push({ label: '누락 필드', value: query.filters.missingFields.join(', ') });
    }
    if (query.filters.dateRange) {
        filters.push({ label: '기간', value: `${query.filters.dateRange.startDate}~${query.filters.dateRange.endDate}` });
    }
    if (query.filters.compareDateRange) {
        filters.push({ label: '비교 기간', value: `${query.filters.compareDateRange.startDate}~${query.filters.compareDateRange.endDate}` });
    }
    if (query.filters.supportDirection) {
        filters.push({ label: '지원방향', value: query.filters.supportDirection });
    }
    if (query.filters.supportScope) {
        filters.push({ label: '지원범위', value: query.filters.supportScope });
    }
    if (query.filters.supportFlowType) {
        filters.push({ label: '지원흐름', value: query.filters.supportFlowType });
    }
    return filters;
};

const candidateToResultCandidate = (candidate: ManpowerDbEntityCandidate) => ({
    entity: candidate.entity,
    id: candidate.id,
    name: candidate.name,
    score: candidate.score,
    matchReason: candidate.matchReason,
});

const enhanceSearchResult = (
    result: ManpowerDbSearchResult,
    query: ManpowerDbSearchQuery,
    snapshot: IntegratedDatabaseOverviewSnapshot,
    question: string
): ManpowerDbSearchResult => {
    const resolution = resolveManpowerDbEntities(snapshot, queryKeyword(query), query.entity);
    const plan = buildManpowerDbQueryPlan(question, query, resolution).map((step, index, steps) => ({
        ...step,
        outputCount: index === steps.length - 1 ? result.counts.total : step.outputCount,
    }));
    const rows = result.rows.map((row) => ({
        ...row,
        matchReason: row.matchReason || defaultMatchReason(row, query),
        source: row.source || defaultSourceForRow(row),
        confidence: row.confidence ?? Math.max(0.5, Math.min(0.99, query.confidence ?? 0.86)),
    }));

    const enhanced: ManpowerDbSearchResult = {
        ...result,
        rows,
        interpretation: {
            entity: query.entity,
            intent: query.intent,
            confidence: query.confidence ?? (resolution.selected ? 0.9 : resolution.candidates.length > 1 ? 0.72 : 0.82),
            filters: buildFilterLabels(query),
            clarificationNeeded: query.clarificationNeeded || (!resolution.selected && resolution.candidates.length > 1),
            candidates: resolution.candidates.map(candidateToResultCandidate),
        },
        plan,
    };

    return {
        ...enhanced,
        aiExplanation: createDeterministicManpowerDbExplanation(enhanced),
    };
};

const searchWorkerName = (
    parsedQuestion: string,
    query: ManpowerDbSearchQuery,
    snapshot: IntegratedDatabaseOverviewSnapshot
): ManpowerDbSearchResult => {
    const keyword = query.filters.name || query.filters.keyword;
    const rows = snapshot.workers
        .filter((worker) => includesLoose(worker.name, keyword))
        .map((worker) => makeWorkerRow(worker, snapshot));

    return completeResult({
        parsedQuestion,
        query,
        summary: `${keyword || '전체'} 작업자 정보 ${rows.length}건을 찾았습니다.`,
        resultType: 'worker_list',
        rows,
        related: collectRelated(rows, snapshot),
        actions: actionsForResultType('worker_list'),
        followUpQuestions: [
            `${keyword || '해당 작업자'} 최근 30일 출역`,
            '계좌 없는 작업자',
            '미배정 작업자',
        ],
    });
};

const searchWorkersByTeam = (
    parsedQuestion: string,
    query: ManpowerDbSearchQuery,
    snapshot: IntegratedDatabaseOverviewSnapshot
): ManpowerDbSearchResult => {
    const teamName = query.filters.teamName || query.filters.keyword;
    const teams = snapshot.teams.filter((team) => includesLoose(team.name, teamName));
    const rows = snapshot.workers
        .filter((worker) => teams.some((team) => teamMatchesWorker(team, worker)) || includesLoose(worker.teamName, teamName))
        .filter((worker) => !query.filters.missingFields?.includes('accountNumber') || !hasText(worker.accountNumber))
        .map((worker) => makeWorkerRow(worker, snapshot));
    const related: ManpowerDbRelatedData = {
        teams: teams.slice(0, 8).map(makeTeamRow),
        ...collectRelated(rows, snapshot),
    };
    const accountPart = query.filters.missingFields?.includes('accountNumber') ? ' 중 계좌가 없는' : '';

    return completeResult({
        parsedQuestion,
        query,
        summary: `${teamName || '지정 팀'} 소속${accountPart} 작업자 ${rows.length}명을 찾았습니다.`,
        resultType: 'worker_list',
        rows,
        related,
        actions: actionsForResultType('worker_list'),
        followUpQuestions: [
            `${teamName || '해당 팀'} 소속 작업자 중 계좌 없는 사람`,
            '최근 30일 출역 없는 재직자',
            '퇴사자인데 이번 달 일보에 나온 사람',
        ],
    });
};

const searchMissingAccounts = (
    parsedQuestion: string,
    query: ManpowerDbSearchQuery,
    snapshot: IntegratedDatabaseOverviewSnapshot
): ManpowerDbSearchResult => {
    if (query.entity === 'team') {
        const rows = snapshot.teams
            .filter((team) => !hasText(team.accountNumber))
            .filter((team) => !query.filters.companyName || includesLoose(team.companyName, query.filters.companyName))
            .map((team) => ({
                ...makeTeamRow(team),
                matchReason: query.filters.companyName
                    ? `${query.filters.companyName} 소속 팀 중 계좌번호 누락`
                    : '팀 계좌번호 누락',
                confidence: 0.9,
            }));
        return completeResult({
            parsedQuestion,
            query,
            summary: `${query.filters.companyName ? `${query.filters.companyName} 소속 ` : ''}계좌가 없는 팀 ${rows.length}건을 찾았습니다.`,
            resultType: 'team_list',
            rows,
            actions: actionsForResultType('team_list'),
            followUpQuestions: ['계좌 없는 작업자', '계좌 없는 회사', '청연 소속 팀'],
        });
    }

    if (query.entity === 'company') {
        const rows = snapshot.companies.filter((company) => !hasText(company.accountNumber)).map(makeCompanyRow);
        return completeResult({
            parsedQuestion,
            query,
            summary: `계좌가 없는 회사 ${rows.length}건을 찾았습니다.`,
            resultType: 'company_list',
            rows,
            actions: actionsForResultType('company_list'),
            followUpQuestions: ['계좌 없는 팀', '현대 포함된 회사', '청연 소속 팀'],
        });
    }

    if (query.filters.teamName) {
        return searchWorkersByTeam(parsedQuestion, query, snapshot);
    }

    const rows = snapshot.workers.filter((worker) => !hasText(worker.accountNumber)).map((worker) => makeWorkerRow(worker, snapshot));
    return completeResult({
        parsedQuestion,
        query,
        summary: `계좌가 없는 작업자 ${rows.length}명을 찾았습니다.`,
        resultType: 'worker_list',
        rows,
        related: collectRelated(rows, snapshot),
        actions: actionsForResultType('worker_list'),
        followUpQuestions: ['1팀 소속 작업자 중 계좌 없는 사람', '미배정 작업자', '계좌 없는 팀'],
    });
};

const searchUnassignedWorkers = (
    parsedQuestion: string,
    query: ManpowerDbSearchQuery,
    snapshot: IntegratedDatabaseOverviewSnapshot
): ManpowerDbSearchResult => {
    const rows = snapshot.workers
        .filter((worker) => !hasText(worker.teamId) && !hasText(worker.teamName))
        .map((worker) => makeWorkerRow(worker, snapshot));

    return completeResult({
        parsedQuestion,
        query,
        summary: `팀이 미배정된 작업자 ${rows.length}명을 찾았습니다.`,
        resultType: 'worker_list',
        rows,
        actions: actionsForResultType('worker_list'),
        followUpQuestions: ['계좌 없는 작업자', '최근 30일 출역 없는 재직자', '퇴사자인데 이번 달 일보에 나온 사람'],
    });
};

const searchActiveSitesWithoutTeam = (
    parsedQuestion: string,
    query: ManpowerDbSearchQuery,
    snapshot: IntegratedDatabaseOverviewSnapshot
): ManpowerDbSearchResult => {
    const rows = snapshot.sites
        .filter((site) => (site.status === ACTIVE_SITE_STATUS || query.filters.status !== ACTIVE_SITE_STATUS) &&
            !hasText(site.responsibleTeamId) &&
            !hasText(site.responsibleTeamName))
        .map(makeSiteRow);

    return completeResult({
        parsedQuestion,
        query,
        summary: `담당팀이 없는 진행중 현장 ${rows.length}건을 찾았습니다.`,
        resultType: 'site_list',
        rows,
        actions: actionsForResultType('site_list'),
        followUpQuestions: ['과천 현장 담당팀', '과천 현장 최근 투입 작업자', '청연 소속 팀'],
    });
};

const searchInactiveActiveWorkers = (
    parsedQuestion: string,
    query: ManpowerDbSearchQuery,
    snapshot: IntegratedDatabaseOverviewSnapshot
): ManpowerDbSearchResult => {
    const range = query.filters.dateRange;
    const reports = range ? filterReportsByDateRange(snapshot.allReports, range.startDate, range.endDate) : snapshot.recentReports;
    const rows = snapshot.workers
        .filter((worker) => (worker.status || ACTIVE_WORKER_STATUS) === ACTIVE_WORKER_STATUS)
        .filter((worker) => !workerAppearsInReports(worker, reports))
        .map((worker) => makeWorkerRow(worker, snapshot));

    return completeResult({
        parsedQuestion,
        query,
        summary: `${range?.startDate || '최근'}~${range?.endDate || '현재'} 출역 기록이 없는 재직자 ${rows.length}명을 찾았습니다.`,
        resultType: 'integrity',
        rows,
        related: collectRelated(rows, snapshot),
        actions: actionsForResultType('worker_list'),
        followUpQuestions: ['퇴사자인데 이번 달 일보에 나온 사람', '미배정 작업자', '계좌 없는 작업자'],
    });
};

const searchRetiredWorkersInReports = (
    parsedQuestion: string,
    query: ManpowerDbSearchQuery,
    snapshot: IntegratedDatabaseOverviewSnapshot
): ManpowerDbSearchResult => {
    const range = query.filters.dateRange;
    const reports = range ? filterReportsByDateRange(snapshot.allReports, range.startDate, range.endDate) : snapshot.allReports;
    const rows = snapshot.workers
        .filter((worker) => worker.status === RETIRED_WORKER_STATUS)
        .filter((worker) => workerAppearsInReports(worker, reports))
        .map((worker) => makeWorkerRow(worker, snapshot));

    return completeResult({
        parsedQuestion,
        query,
        summary: `${range?.startDate || '선택 기간'}~${range?.endDate || '현재'} 일보에 등장한 퇴사자 ${rows.length}명을 찾았습니다.`,
        resultType: 'integrity',
        rows,
        related: collectRelated(rows, snapshot),
        actions: actionsForResultType('worker_list'),
        followUpQuestions: ['최근 30일 출역 없는 재직자', '계좌 없는 작업자', '담당팀 없는 진행중 현장'],
    });
};

const searchSiteRelation = (
    parsedQuestion: string,
    query: ManpowerDbSearchQuery,
    snapshot: IntegratedDatabaseOverviewSnapshot
): ManpowerDbSearchResult => {
    const siteName = query.filters.siteName || query.filters.keyword;
    const sites = snapshot.sites.filter((site) => includesLoose(site.name, siteName));
    const rows = sites.map(makeSiteRow);
    const relatedTeams = snapshot.teams
        .filter((team) => sites.some((site) =>
            (hasText(site.responsibleTeamId) && text(team.id) === text(site.responsibleTeamId)) ||
            includesLoose(team.name, site.responsibleTeamName)
        ))
        .map(makeTeamRow);
    const relatedCompanies = snapshot.companies
        .filter((company) => sites.some((site) =>
            [site.companyId, site.constructorCompanyId, site.clientCompanyId, site.partnerId].map(text).includes(text(company.id)) ||
            [site.companyName, site.constructorCompanyName, site.clientCompanyName, site.partnerName].some((name) => includesLoose(company.name, name))
        ))
        .map(makeCompanyRow);

    return completeResult({
        parsedQuestion,
        query,
        summary: `${siteName || '지정 현장'} 담당팀/회사 관계 ${rows.length}건을 찾았습니다.`,
        resultType: 'site_list',
        rows,
        related: {
            teams: relatedTeams.slice(0, 8),
            companies: relatedCompanies.slice(0, 8),
        },
        actions: actionsForResultType('site_list'),
        followUpQuestions: [`${siteName || '해당'} 현장 최근 투입 작업자`, '담당팀 없는 진행중 현장', '청연 소속 팀'],
    });
};

const searchSiteRecentWorkers = (
    parsedQuestion: string,
    query: ManpowerDbSearchQuery,
    snapshot: IntegratedDatabaseOverviewSnapshot
): ManpowerDbSearchResult => {
    const siteName = query.filters.siteName || query.filters.keyword;
    const range = query.filters.dateRange;
    const sites = snapshot.sites.filter((site) => includesLoose(site.name, siteName));
    const reports = (range ? filterReportsByDateRange(snapshot.allReports, range.startDate, range.endDate) : snapshot.recentReports)
        .filter((report) => sites.some((site) => reportMatchesSite(report, site)) || includesLoose(report.siteName, siteName));
    const rows = rowsForWorkerReports(reports, snapshot);

    return completeResult({
        parsedQuestion,
        query,
        summary: `${siteName || '지정 현장'} 최근 투입 작업자 ${rows.length}명을 찾았습니다.`,
        resultType: 'worker_list',
        rows,
        related: {
            sites: sites.slice(0, 8).map(makeSiteRow),
            ...collectRelated(rows, snapshot),
        },
        actions: actionsForResultType('worker_list'),
        followUpQuestions: [`${siteName || '해당'} 현장 담당팀`, '퇴사자인데 이번 달 일보에 나온 사람', '최근 30일 출역 없는 재직자'],
    });
};

const searchCompanies = (
    parsedQuestion: string,
    query: ManpowerDbSearchQuery,
    snapshot: IntegratedDatabaseOverviewSnapshot
): ManpowerDbSearchResult => {
    const keyword = query.filters.companyName || query.filters.keyword;
    const rows = snapshot.companies.filter((company) => includesLoose(company.name, keyword)).map(makeCompanyRow);

    return completeResult({
        parsedQuestion,
        query,
        summary: `${keyword || '전체'} 회사 ${rows.length}건을 찾았습니다.`,
        resultType: 'company_list',
        rows,
        actions: actionsForResultType('company_list'),
        followUpQuestions: ['청연 소속 팀', '계좌 없는 회사', '담당팀 없는 진행중 현장'],
    });
};

const searchTeamsByCompany = (
    parsedQuestion: string,
    query: ManpowerDbSearchQuery,
    snapshot: IntegratedDatabaseOverviewSnapshot
): ManpowerDbSearchResult => {
    const companyName = query.filters.companyName || query.filters.keyword;
    const companies = snapshot.companies.filter((company) => includesLoose(company.name, companyName));
    const rows = snapshot.teams
        .filter((team) =>
            includesLoose(team.companyName, companyName) ||
            companies.some((company) => text(team.companyId) === text(company.id) || includesLoose(team.companyName, company.name))
        )
        .map(makeTeamRow);

    return completeResult({
        parsedQuestion,
        query,
        summary: `${companyName || '지정 회사'} 소속 팀 ${rows.length}건을 찾았습니다.`,
        resultType: 'team_list',
        rows,
        related: { companies: companies.slice(0, 8).map(makeCompanyRow) },
        actions: actionsForResultType('team_list'),
        followUpQuestions: [`${companyName || '해당 회사'} 소속 작업자`, '계좌 없는 팀', '담당팀 없는 진행중 현장'],
    });
};

const reportMatchesSiteKeyword = (report: DailyReport, siteKeyword?: string): boolean => {
    if (!siteKeyword) return true;
    return includesLoose(report.siteName, siteKeyword) ||
        includesLoose((report as DailyReport & { site?: string }).site, siteKeyword);
};

const searchRecentReportWorkers = (
    parsedQuestion: string,
    query: ManpowerDbSearchQuery,
    snapshot: IntegratedDatabaseOverviewSnapshot
): ManpowerDbSearchResult => {
    const range = query.filters.dateRange;
    const reports = filterReports(snapshot, range)
        .filter((report) => reportMatchesSiteKeyword(report, query.filters.siteName));
    const reportWorkers = findWorkersFromReports(snapshot, reports);
    const rows = reportWorkers
        .filter((worker) => !query.filters.missingFields?.includes('accountNumber') || !hasText(worker.accountNumber))
        .map((worker) => ({
            ...makeWorkerRow(worker, snapshot),
            source: 'daily_report' as const,
            matchReason: query.filters.missingFields?.includes('accountNumber')
                ? '일보 출역자 중 작업자 마스터 계좌번호 누락'
                : '일보 출역 기록과 작업자 마스터 조인',
            confidence: 0.9,
        }));

    const sitePart = query.filters.siteName ? `${query.filters.siteName} 현장 ` : '';
    const accountPart = query.filters.missingFields?.includes('accountNumber') ? '계좌 없는 ' : '';
    return completeResult({
        parsedQuestion,
        query,
        summary: `${sitePart}${range?.startDate || '선택 기간'}~${range?.endDate || '현재'} ${accountPart}출역 작업자 ${rows.length}명을 찾았습니다.`,
        resultType: 'worker_list',
        rows,
        related: collectRelated(rows, snapshot),
        actions: actionsForResultType('worker_list'),
        followUpQuestions: ['퇴사자인데 최근 7일 출역한 사람', '최근 30일 출역 없는 재직자', '담당팀 없는 현장 중 이번 달 일보 있는 현장'],
    });
};

const searchSitesWithoutTeamWithReports = (
    parsedQuestion: string,
    query: ManpowerDbSearchQuery,
    snapshot: IntegratedDatabaseOverviewSnapshot
): ManpowerDbSearchResult => {
    const range = query.filters.dateRange;
    const sites = range
        ? findSitesWithoutResponsibleTeamWithReports(snapshot, range)
        : snapshot.sites.filter((site) => !hasText(site.responsibleTeamId) && !hasText(site.responsibleTeamName));
    const rows = sites.map((site) => ({
        ...makeSiteRow(site),
        source: 'integrity' as const,
        matchReason: range ? '담당팀 누락 현장이고 선택 기간 일보가 존재' : '담당팀 누락 현장',
        confidence: 0.92,
    }));

    return completeResult({
        parsedQuestion,
        query,
        summary: `담당팀이 없고 일보가 있는 진행중 현장 ${rows.length}건을 찾았습니다.`,
        resultType: 'integrity',
        rows,
        actions: actionsForResultType('site_list'),
        followUpQuestions: ['담당팀 없는 진행중 현장', '현대 관련 현장 담당팀 보여줘', '과천 현장 담당팀'],
    });
};

const searchTeamActivityComparison = (
    parsedQuestion: string,
    query: ManpowerDbSearchQuery,
    snapshot: IntegratedDatabaseOverviewSnapshot
): ManpowerDbSearchResult => {
    const currentRange = query.filters.dateRange;
    const previousRange = query.filters.compareDateRange;
    if (!currentRange || !previousRange) {
        return emptyResult(parsedQuestion, query, 'team_list', actionsForResultType('team_list'));
    }

    const direction = query.filters.status === 'decrease' ? 'decrease' : 'increase';
    const deltas = compareTeamActivity(snapshot, currentRange, previousRange)
        .filter((row) => direction === 'decrease' ? row.diff < 0 : row.diff > 0)
        .sort((a, b) => direction === 'decrease' ? a.diff - b.diff : b.diff - a.diff);
    const rows = deltas.map((delta) => {
        const team = snapshot.teams.find((item) => text(item.id) === delta.teamId || text(item.name) === delta.teamName);
        const baseRow = team ? makeTeamRow(team) : {
            id: delta.teamId || delta.teamName,
            rowType: 'team' as const,
            name: delta.teamName,
            fields: [],
            path: MANPOWER_DB_TAB_PATHS.teams,
        };
        return {
            ...baseRow,
            source: 'derived' as const,
            matchReason: `이번 기간 ${delta.currentManDay.toFixed(1)}공수, 비교 기간 ${delta.previousManDay.toFixed(1)}공수`,
            confidence: 0.88,
            fields: [
                ...baseRow.fields,
                { label: '현재 공수', value: delta.currentManDay.toFixed(1), tone: 'info' as const },
                { label: '비교 공수', value: delta.previousManDay.toFixed(1), tone: 'muted' as const },
                { label: '증감', value: `${delta.diff > 0 ? '+' : ''}${delta.diff.toFixed(1)}`, tone: delta.diff > 0 ? 'warning' as const : 'info' as const },
            ],
        };
    });

    return completeResult({
        parsedQuestion,
        query,
        summary: `지난달 대비 투입이 ${direction === 'decrease' ? '감소한' : '증가한'} 팀 ${rows.length}건을 찾았습니다.`,
        resultType: 'team_list',
        rows,
        actions: actionsForResultType('team_list'),
        followUpQuestions: [
            direction === 'decrease' ? '지난달보다 투입 급증한 팀' : '지난달보다 투입 줄어든 팀',
            '계좌 없는 팀',
            '청연 소속 팀 중 계좌 없는 팀',
        ],
    });
};

const searchSiteRelationByCompany = (
    parsedQuestion: string,
    query: ManpowerDbSearchQuery,
    snapshot: IntegratedDatabaseOverviewSnapshot
): ManpowerDbSearchResult => {
    const companyName = query.filters.companyName || query.filters.keyword;
    const sites = snapshot.sites.filter((site) =>
        includesLoose(site.companyName, companyName) ||
        includesLoose(site.constructorCompanyName, companyName) ||
        includesLoose(site.clientCompanyName, companyName) ||
        includesLoose(site.partnerName, companyName)
    );
    const rows = sites.map((site) => ({
        ...makeSiteRow(site),
        matchReason: `${companyName || '회사'} 관련 회사명이 현장 관계 필드와 일치`,
        confidence: 0.86,
    }));
    const relatedTeams = snapshot.teams.filter((team) => sites.some((site) =>
        text(site.responsibleTeamId) === text(team.id) || includesLoose(team.name, site.responsibleTeamName)
    )).map(makeTeamRow);

    return completeResult({
        parsedQuestion,
        query,
        summary: `${companyName || '지정 회사'} 관련 현장 담당팀 ${rows.length}건을 찾았습니다.`,
        resultType: 'site_list',
        rows,
        related: {
            teams: relatedTeams.slice(0, 8),
            companies: snapshot.companies.filter((company) => includesLoose(company.name, companyName)).slice(0, 8).map(makeCompanyRow),
        },
        actions: actionsForResultType('site_list'),
        followUpQuestions: ['담당팀 없는 현장 중 이번 달 일보 있는 현장', '과천 현장 최근 투입 작업자', '계좌 없는 팀'],
    });
};

const supportFilterLabel = (query: ManpowerDbSearchQuery): string => {
    if (query.filters.supportDirection) return query.filters.supportDirection;
    const parts = [query.filters.supportScope, query.filters.supportFlowType].filter(Boolean);
    return parts.length ? `${parts.join(' ')} 지원` : '전체 지원';
};

const searchSupportFlows = (
    parsedQuestion: string,
    query: ManpowerDbSearchQuery,
    snapshot: IntegratedDatabaseOverviewSnapshot
): ManpowerDbSearchResult => {
    const flows = buildManpowerDbSupportFlows(snapshot, {
        supportDirection: query.filters.supportDirection,
        supportScope: query.filters.supportScope,
        supportFlowType: query.filters.supportFlowType,
        teamName: query.filters.teamName,
        siteName: query.filters.siteName,
        workerName: query.filters.name,
        dateRange: query.filters.dateRange,
    });
    const rows = flows.map(makeSupportFlowRow);
    const label = supportFilterLabel(query);
    const range = query.filters.dateRange;
    const rangeLabel = range ? `${range.startDate}~${range.endDate}` : '전체 기간';

    return completeResult({
        parsedQuestion,
        query,
        summary: `${rangeLabel} ${label} 흐름 ${rows.length}건을 찾았습니다.`,
        resultType: 'support',
        rows,
        related: makeSupportRelated(flows, snapshot),
        actions: actionsForResultType('support'),
        followUpQuestions: [
            '이번 달 외부팀 지원온곳',
            '이번 달 외부팀 지원간곳',
            '이번 달 내부팀 지원온곳',
            '이번 달 내부팀 지원간곳',
        ],
    });
};

const dispatchSearch = (
    parsedQuestion: string,
    query: ManpowerDbSearchQuery,
    snapshot: IntegratedDatabaseOverviewSnapshot
): ManpowerDbSearchResult => {
    if (query.entity === 'support') {
        return searchSupportFlows(parsedQuestion, query, snapshot);
    }
    if (query.entity === 'worker' && query.intent === 'recent_activity') {
        return searchRecentReportWorkers(parsedQuestion, query, snapshot);
    }
    if (query.entity === 'site' && query.intent === 'data_quality' && query.filters.missingFields?.some((field) => field.includes('responsibleTeam'))) {
        return searchSitesWithoutTeamWithReports(parsedQuestion, query, snapshot);
    }
    if (query.entity === 'team' && query.intent === 'comparison') {
        return searchTeamActivityComparison(parsedQuestion, query, snapshot);
    }
    if (query.entity === 'site' && query.intent === 'relation' && query.filters.companyName) {
        return searchSiteRelationByCompany(parsedQuestion, query, snapshot);
    }
    if (query.intent === 'missing_field' && query.filters.missingFields?.includes('accountNumber')) {
        return searchMissingAccounts(parsedQuestion, query, snapshot);
    }
    if (query.entity === 'worker' && query.intent === 'missing_field' && query.filters.missingFields?.includes('teamId')) {
        return searchUnassignedWorkers(parsedQuestion, query, snapshot);
    }
    if (query.entity === 'site' && query.intent === 'missing_field') {
        return searchActiveSitesWithoutTeam(parsedQuestion, query, snapshot);
    }
    if (query.entity === 'integrity' && query.intent === 'recent_activity') {
        return searchInactiveActiveWorkers(parsedQuestion, query, snapshot);
    }
    if (query.entity === 'integrity' && query.intent === 'data_quality') {
        return searchRetiredWorkersInReports(parsedQuestion, query, snapshot);
    }
    if (query.entity === 'site' && query.intent === 'relation') {
        return searchSiteRelation(parsedQuestion, query, snapshot);
    }
    if (query.entity === 'site' && query.intent === 'recent_activity') {
        return searchSiteRecentWorkers(parsedQuestion, query, snapshot);
    }
    if (query.entity === 'company') {
        return searchCompanies(parsedQuestion, query, snapshot);
    }
    if (query.entity === 'team' && query.intent === 'relation') {
        return searchTeamsByCompany(parsedQuestion, query, snapshot);
    }
    if (query.entity === 'worker' && query.filters.teamName) {
        return searchWorkersByTeam(parsedQuestion, query, snapshot);
    }
    if (query.entity === 'worker') {
        return searchWorkerName(parsedQuestion, query, snapshot);
    }

    return emptyResult(parsedQuestion, query, 'mixed', actionsForResultType('mixed'));
};

export const searchManpowerDbSnapshot = (
    question: string,
    snapshot: IntegratedDatabaseOverviewSnapshot,
    today = new Date()
): ManpowerDbSearchResult => {
    const parsedQuestion = question.trim();
    const query = parseManpowerDbQuestion(parsedQuestion, today);
    return searchManpowerDbSnapshotWithQuery(parsedQuestion, query, snapshot);
};

const searchManpowerDbSnapshotWithQuery = (
    parsedQuestion: string,
    query: ManpowerDbSearchQuery,
    snapshot: IntegratedDatabaseOverviewSnapshot
): ManpowerDbSearchResult => {
    try {
        const result = dispatchSearch(parsedQuestion, query, snapshot);
        return enhanceSearchResult(result, query, snapshot, parsedQuestion);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
            success: false,
            parsedQuestion,
            query,
            summary: '인력 DB 검색 중 오류가 발생했습니다.',
            resultType: 'mixed',
            rows: [],
            counts: { total: 0, shown: 0 },
            actions: actionsForResultType('mixed'),
            followUpQuestions: MANPOWER_DB_TAB_PATHS ? ['계좌 없는 작업자', '미배정 작업자'] : [],
            warnings: [message],
        };
    }
};

const getGeminiApiKeyForParser = (): string | undefined => {
    if (typeof window === 'undefined') return undefined;
    return window.localStorage.getItem('gemini_api_key') ||
        window.localStorage.getItem('geminiApiKey') ||
        undefined;
};

export const searchManpowerDatabase = async (
    question: string,
    today = new Date()
): Promise<ManpowerDbSearchResult> => {
    const { loadIntegratedDatabaseOverviewSnapshot } = await import('../../pages/database/useIntegratedDatabaseOverview');
    const { snapshot, warning } = await loadIntegratedDatabaseOverviewSnapshot(today);
    const parserResult = await parseManpowerDbQuestionHybrid(question, today, {
        apiKey: getGeminiApiKeyForParser(),
        fetchImpl: typeof fetch !== 'undefined' ? fetch : undefined,
    });
    const result = searchManpowerDbSnapshotWithQuery(question.trim(), parserResult.query, snapshot);
    return {
        ...result,
        warnings: [
            ...(warning ? [warning] : []),
            ...(parserResult.warning ? [parserResult.warning] : []),
            ...(result.warnings || []),
        ],
    };
};
