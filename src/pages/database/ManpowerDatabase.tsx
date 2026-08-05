import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Worker } from '../../services/manpowerService';
import type { Team } from '../../services/teamService';
import type { Site } from '../../services/siteService';
import type { Company } from '../../services/companyService';
import type { DailyReport } from '../../services/dailyReportService';
import { statisticsService } from '../../services/statisticsService';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faDatabase, faUsers, faBuilding, faHardHat, faCalendar, faChartBar,
    faExclamationTriangle, faUserSlash, faIdBadge, faCreditCard, faChevronDown, faChevronUp, faLink, faUserClock,
    faUserXmark, faStoreSlash
} from '@fortawesome/free-solid-svg-icons';

// Sub-components
import WorkerDatabase from './WorkerDatabase';
import TeamDatabase from './TeamDatabase';
import SiteDatabase from './SiteDatabase';
import CompanyDatabase from './CompanyDatabase';
import OfficeStaffDatabase from './OfficeStaffDatabase';
import AccountManagementPage from './AccountManagementPage';
import SettlementTargetDatabase from './SettlementTargetDatabase';
import { useIntegratedDatabaseOverview } from './useIntegratedDatabaseOverview';

type IntegratedDatabaseTab = 'overview' | 'workers' | 'offices' | 'settlementTargets' | 'teams' | 'sites' | 'companies' | 'accounts';

const TAB_QUERY_VALUES: Record<IntegratedDatabaseTab, string> = {
    overview: 'overview',
    workers: 'workers',
    offices: 'offices',
    settlementTargets: 'settlement-targets',
    teams: 'teams',
    sites: 'sites',
    companies: 'companies',
    accounts: 'accounts',
};

const parseIntegratedDatabaseTab = (value: string | null): IntegratedDatabaseTab | null => {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'workers') return 'workers';
    if (normalized === 'offices' || normalized === 'office' || normalized === 'office-staff' || normalized === 'office_staff') return 'offices';
    if (normalized === 'settlement-targets' || normalized === 'settlementtargets' || normalized === 'payback' || normalized === 'buyback') return 'settlementTargets';
    if (normalized === 'teams') return 'teams';
    if (normalized === 'sites') return 'sites';
    if (normalized === 'companies') return 'companies';
    if (normalized === 'accounts') return 'accounts';
    if (normalized === 'overview') return 'overview';
    return null;
};

const isDatabaseLogTabValue = (value: string | null): boolean => {
    const normalized = String(value || '').trim().toLowerCase();
    return normalized === 'logs' || normalized === 'database-logs' || normalized === 'db-logs';
};

const isDailyReportTabValue = (value: string | null): boolean => {
    const normalized = String(value || '').trim().toLowerCase();
    return normalized === 'reports' || normalized === 'daily-reports' || normalized === 'dailyreports';
};

interface IssueStats {
    unassignedWorkers: Worker[];
    noIdCardWorkers: Worker[];
    noAccountWorkers: Worker[];
    unassignedSites: Site[];
    unassignedBuilders: Company[];
    unassignedTeamLeaders: Worker[];
    isolatedWorkers: Worker[];
    duplicateWorkers: { list: Worker[], label: string }[]; // Groups of duplicates
    ghostWorkers: Worker[]; // Active but no work in 30 days
    retiredWorkers: Worker[];
    closedTeams: Team[];
    reportMissingSites: DailyReportIntegrityIssue[];
    reportMissingTeams: DailyReportIntegrityIssue[];
    reportMissingWorkers: DailyReportIntegrityIssue[];
    reportEmptyWorkers: DailyReportIntegrityIssue[];
    reportMissingSiteSnapshots: DailyReportIntegrityIssue[];
    reportSiteResponsibleTeamMismatches: DailyReportIntegrityIssue[];
}

interface DailyReportIntegrityIssue {
    id: string;
    reportId?: string;
    date?: string;
    siteId?: string;
    siteName?: string;
    siteAddress?: string;
    teamId?: string;
    teamName?: string;
    workerId?: string;
    workerName?: string;
    detail: string;
}

const DAILY_REPORT_ISSUE_KEYS: Array<keyof IssueStats> = [
    'reportMissingSites',
    'reportMissingTeams',
    'reportMissingWorkers',
    'reportEmptyWorkers',
    'reportMissingSiteSnapshots',
    'reportSiteResponsibleTeamMismatches'
];

const toText = (value: unknown): string => String(value ?? '').trim();

const normalizeNameKey = (value: unknown): string => toText(value).replace(/\s+/g, '').toLowerCase();

const extractTrailingTeamName = (siteName: unknown): string => {
    const match = toText(siteName).match(/\(([^()]*)\)\s*$/);
    return match?.[1]?.trim() || '';
};

const findTeamByNameHint = (teams: Team[], rawName: string): Team | undefined => {
    const trimmed = rawName.trim();
    if (!trimmed) return undefined;

    const candidates = new Set([
        normalizeNameKey(trimmed),
        normalizeNameKey(trimmed.endsWith('팀') ? trimmed.slice(0, -1) : `${trimmed}팀`)
    ]);

    return teams.find((team) => candidates.has(normalizeNameKey(team.name)));
};

const normalizeCompanyKey = (value: unknown): string =>
    toText(value).replace(/\(\s*주\s*\)|㈜/g, '').replace(/\s+/g, '').toLowerCase();

const isCheongyeonCompanyName = (value: unknown): boolean =>
    normalizeCompanyKey(value).includes('청연이엔지');

const findTeamByIdentity = (teams: Team[], ids: string[], names: string[]): Team | undefined => {
    const idSet = new Set(ids.map(toText).filter(Boolean));
    if (idSet.size > 0) {
        const team = teams.find((candidate) => idSet.has(toText(candidate.id)) || idSet.has(toText(candidate.legacyId)));
        if (team) return team;
    }

    const nameSet = new Set(names.map(normalizeNameKey).filter(Boolean));
    if (nameSet.size === 0) return undefined;

    return teams.find((team) => nameSet.has(normalizeNameKey(team.name)));
};

const resolveTeamCompanyName = (team: Team | undefined, companies: Company[]): string => {
    if (!team) return '';

    const ownCompanyName = toText(team.companyName);
    if (ownCompanyName) return ownCompanyName;

    const companyId = toText(team.companyId);
    if (!companyId) return '';

    return toText(companies.find((company) => toText(company.id) === companyId || toText(company.legacyId) === companyId)?.name);
};

const collectEntityIds = <T extends { id?: string | null; legacyId?: string | null }>(items: T[]): Set<string> =>
    new Set(items.flatMap(item => [toText(item.id), toText(item.legacyId)]).filter(Boolean));

const collectEntityNames = <T extends { name?: string | null }>(items: T[]): Set<string> =>
    new Set(items.map(item => toText(item.name)).filter(Boolean));

const isDailyReportIssueKey = (issueKey: keyof IssueStats | null): issueKey is typeof DAILY_REPORT_ISSUE_KEYS[number] =>
    !!issueKey && DAILY_REPORT_ISSUE_KEYS.includes(issueKey);

const isTeamBackedReportWorker = (worker: DailyReport['workers'][number], teamIds: Set<string>): boolean => {
    const workerId = toText(worker.workerId);
    const teamId = toText(worker.teamId);
    if (workerId && teamIds.has(workerId)) return true;

    const marker = [
        worker.role,
        worker.payType,
        worker.salaryModel,
        worker.workerTeamName
    ].map(toText).join(' ');
    const isSupportTeamRow = marker.includes('지원팀') || marker.includes('용역팀') || marker.includes('팀정산') || marker.includes('팀급');

    return isSupportTeamRow && !!teamId && teamIds.has(teamId);
};

function IntegratedDatabase() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { loading, loadWarning, snapshot, stats, reload: loadStats } = useIntegratedDatabaseOverview();
    const [activeTab, setActiveTab] = useState<IntegratedDatabaseTab>(() => parseIntegratedDatabaseTab(searchParams.get('tab')) || 'overview');

    // Issue State
    const [issues, setIssues] = useState<IssueStats>({
        unassignedWorkers: [],
        noIdCardWorkers: [],
        noAccountWorkers: [],
        unassignedSites: [],
        unassignedBuilders: [],
        unassignedTeamLeaders: [],
        isolatedWorkers: [],
        duplicateWorkers: [],
        ghostWorkers: [],
        retiredWorkers: [],
        closedTeams: [],
        reportMissingSites: [],
        reportMissingTeams: [],
        reportMissingWorkers: [],
        reportEmptyWorkers: [],
        reportMissingSiteSnapshots: [],
        reportSiteResponsibleTeamMismatches: []
    });

    const [expandedIssue, setExpandedIssue] = useState<keyof IssueStats | null>(null);
    const [highlightedId, setHighlightedId] = useState<string | null>(null);
    const [isRebuildingManDay, setIsRebuildingManDay] = useState(false);

    const selectTab = (tab: IntegratedDatabaseTab, nextHighlightedId: string | null = null) => {
        const nextParams = new URLSearchParams(searchParams);
        if (tab === 'overview') {
            nextParams.delete('tab');
        } else {
            nextParams.set('tab', TAB_QUERY_VALUES[tab]);
        }

        const nextSearch = nextParams.toString();
        if (nextSearch !== searchParams.toString()) {
            navigate({
                pathname: '/database/manpower-db',
                search: nextSearch ? `?${nextSearch}` : ''
            });
        }
        setActiveTab(tab);
        setHighlightedId(nextHighlightedId);
        if (tab !== 'overview') setExpandedIssue(null);
    };

    useEffect(() => {
        if (!snapshot) return;
        calculateIssues(
            snapshot.workers,
            snapshot.teams,
            snapshot.sites,
            snapshot.companies,
            snapshot.recentReports,
            snapshot.allReports
        );
    }, [snapshot]);

    useEffect(() => {
        const tabParam = searchParams.get('tab');
        if (isDatabaseLogTabValue(tabParam)) {
            navigate('/database/logs', { replace: true });
            return;
        }
        if (isDailyReportTabValue(tabParam)) {
            navigate('/reports/daily?tab=list-v2', { replace: true });
            return;
        }
        const requestedTab = parseIntegratedDatabaseTab(tabParam);
        setActiveTab(requestedTab || 'overview');
        if (!requestedTab) setHighlightedId(null);
    }, [navigate, searchParams]);

    const handleRebuildManDays = async () => {
        const ok = window.confirm(
            '출력일보 전체를 기준으로 작업자/팀/현장/발주사/시공사/협력사 누적공수를 다시 계산합니다.\n기존 누적공수 값은 정확한 계산값으로 덮어씁니다. 계속할까요?'
        );
        if (!ok) return;

        setIsRebuildingManDay(true);
        try {
            const result = await statisticsService.rebuildCumulativeManDays();
            await loadStats();
            alert(
                `누적공수 재계산 완료\n` +
                `일보 ${result.reportsProcessed}건 기준\n` +
                `작업자 ${result.workersUpdated}명, 팀 ${result.teamsUpdated}개, 현장 ${result.sitesUpdated}곳, 회사 ${result.companiesUpdated}개 반영\n` +
                `발주사 미연결 일보 ${result.reportsWithoutClientCompany}건, 시공사 미연결 일보 ${result.reportsWithoutConstructorCompany}건, 협력사 미연결 일보 ${result.reportsWithoutPartnerCompany}건`
            );
        } catch (error) {
            console.error('Failed to rebuild cumulative man-days:', error);
            alert('누적공수 재계산 중 오류가 발생했습니다. 콘솔 로그를 확인해 주세요.');
        } finally {
            setIsRebuildingManDay(false);
        }
    };

    const calculateIssues = (
        workers: Worker[],
        teams: Team[],
        sites: Site[],
        companies: Company[],
        recentReports: DailyReport[],
        allReports: DailyReport[]
    ) => {
        const newIssues: IssueStats = {
            unassignedWorkers: [],
            noIdCardWorkers: [],
            noAccountWorkers: [],
            unassignedSites: [],
            unassignedBuilders: [],
            unassignedTeamLeaders: [],
            isolatedWorkers: [],
            duplicateWorkers: [],
            ghostWorkers: [],
            retiredWorkers: workers.filter(w => w.status === '퇴사'),
            closedTeams: teams.filter(t => t.status === 'closed' || t.status === 'waiting'),
            reportMissingSites: [],
            reportMissingTeams: [],
            reportMissingWorkers: [],
            reportEmptyWorkers: [],
            reportMissingSiteSnapshots: [],
            reportSiteResponsibleTeamMismatches: []
        };

        // Helper sets
        const activeTeamLeaderIds = new Set(teams.map(t => t.leaderId).filter(Boolean));
        const workerIds = collectEntityIds(workers);
        const teamIds = collectEntityIds(teams);
        const teamNames = collectEntityNames(teams);
        const siteIds = collectEntityIds(sites);
        const siteNames = collectEntityNames(sites);
        const sitesById = new Map<string, Site>();
        const sitesByName = new Map<string, Site>();
        sites.forEach((site) => {
            [toText(site.id), toText(site.legacyId)].filter(Boolean).forEach((id) => sitesById.set(id, site));
            const nameKey = normalizeNameKey(site.name);
            if (nameKey) sitesByName.set(nameKey, site);
        });
        const recentWorkerIds = new Set<string>();
        recentReports.forEach(r => {
            r.workers.forEach(w => {
                if (w.manDay > 0) recentWorkerIds.add(w.workerId);
            });
        });

        // Worker Checks
        workers.forEach(w => {
            // Unassigned (No Team)
            if (!w.teamId) newIssues.unassignedWorkers.push(w);

            // Missing Info
            if (!w.fileNameSaved) newIssues.noIdCardWorkers.push(w);
            if (!w.accountNumber) newIssues.noAccountWorkers.push(w);

            // Unassigned Team Leader
            if (w.role === '팀장' && !activeTeamLeaderIds.has(w.id || '')) {
                newIssues.unassignedTeamLeaders.push(w);
            }

            // Isolated
            if (!w.teamId && !w.siteId && !w.companyId) {
                newIssues.isolatedWorkers.push(w);
            }

            // Ghost Worker (Active but no work in 30 days)
            if (w.status === '재직' && !recentWorkerIds.has(w.id || '')) {
                newIssues.ghostWorkers.push(w);
            }
        });

        // Sites Checks
        newIssues.unassignedSites = sites.filter(s => !s.responsibleTeamId);

        // Company Checks (client/orderer companies without any assigned sites via Site.companyId)
        newIssues.unassignedBuilders = companies.filter(c => {
            if (c.type !== '건설사') return false;
            const hasSite = sites.some(s => s.companyId === c.id);
            return !hasSite;
        });

        // Duplicate Functionality
        const idMap = new Map<string, Worker[]>();
        const phoneMap = new Map<string, Worker[]>();

        workers.forEach(w => {
            if (w.idNumber) {
                const list = idMap.get(w.idNumber) || [];
                list.push(w);
                idMap.set(w.idNumber, list);
            }
            if (w.contact) {
                const list = phoneMap.get(w.contact) || [];
                list.push(w);
                phoneMap.set(w.contact, list);
            }
        });

        idMap.forEach((list, key) => {
            if (list.length > 1) newIssues.duplicateWorkers.push({ list, label: `주민번호 중복: ${key}` });
        });
        phoneMap.forEach((list, key) => {
            // Only add if not already added by ID number to avoid noise
            const isAlreadyAdded = newIssues.duplicateWorkers.some(d => d.label.includes(key));
            if (!isAlreadyAdded && list.length > 1) newIssues.duplicateWorkers.push({ list, label: `연락처 중복: ${key}` });
        });

        allReports.forEach((report, reportIndex) => {
            const reportKey = report.id || report.legacyId || `${report.date}-${report.siteId}-${report.teamId}-${reportIndex}`;
            const reportSiteId = toText(report.siteId);
            const reportSiteName = toText(report.siteName);
            const matchedReportSite = (reportSiteId ? sitesById.get(reportSiteId) : undefined) || sitesByName.get(normalizeNameKey(reportSiteName));
            const reportSiteAddress = toText(matchedReportSite?.address) || toText((report as any).siteAddress);
            const reportTeamIds = [toText(report.responsibleTeamId), toText(report.teamId)].filter(Boolean);
            const reportTeamNames = [toText(report.responsibleTeamName), toText(report.teamName)].filter(Boolean);
            const reportTeamId = reportTeamIds[0] || '';
            const reportTeamName = reportTeamNames[0] || '';
            const baseIssue = {
                reportId: report.id || report.legacyId,
                date: report.date,
                siteId: reportSiteId,
                siteName: reportSiteName,
                ...(reportSiteAddress ? { siteAddress: reportSiteAddress } : {}),
                teamId: reportTeamId,
                teamName: reportTeamName
            };

            const hasLinkedSite = Boolean(matchedReportSite) || (!!reportSiteId && siteIds.has(reportSiteId)) || (!!reportSiteName && siteNames.has(reportSiteName));
            if (!hasLinkedSite) {
                newIssues.reportMissingSites.push({
                    id: `${reportKey}-site`,
                    ...baseIssue,
                    detail: reportSiteId || reportSiteName ? '현장 DB와 매칭되지 않음' : '현장 정보 없음'
                });
            }

            const hasLinkedTeam = reportTeamIds.some(id => teamIds.has(id)) || reportTeamNames.some(name => teamNames.has(name));
            if (!hasLinkedTeam) {
                newIssues.reportMissingTeams.push({
                    id: `${reportKey}-team`,
                    ...baseIssue,
                    detail: reportTeamId || reportTeamName ? '팀 DB와 매칭되지 않음' : '팀 정보 없음'
                });
            }

            const reportWorkers = Array.isArray(report.workers) ? report.workers : [];
            const expectedResponsibleTeamHint = extractTrailingTeamName(reportSiteName);
            const savedResponsibleIds = [toText(report.responsibleTeamId), toText(report.teamId)].filter(Boolean);
            const savedResponsibleNames = [toText(report.responsibleTeamName), toText(report.teamName)].filter(Boolean);
            const savedResponsibleTeam = findTeamByIdentity(teams, savedResponsibleIds, savedResponsibleNames);
            const savedResponsibleDisplayName = savedResponsibleNames[0] || savedResponsibleTeam?.name || savedResponsibleIds[0] || '';
            const responsibleTeamCompanyName = resolveTeamCompanyName(savedResponsibleTeam, companies);
            const responsibleMismatchDetails: string[] = [];

            if (expectedResponsibleTeamHint) {
                const expectedTeam = findTeamByNameHint(teams, expectedResponsibleTeamHint);
                const expectedTeamName = expectedTeam?.name || expectedResponsibleTeamHint;
                const expectedNameKeys = new Set([
                    normalizeNameKey(expectedTeamName),
                    normalizeNameKey(expectedResponsibleTeamHint)
                ]);
                const hasExpectedName = expectedNameKeys.has(normalizeNameKey(savedResponsibleDisplayName));

                if (!hasExpectedName) {
                    const currentTeam = savedResponsibleDisplayName || savedResponsibleIds[0] || '없음';
                    responsibleMismatchDetails.push(`현장명 기준 현장소속팀 불일치: 현재 ${currentTeam}, 기대 ${expectedTeamName}`);
                }
            }

            if (toText(report.siteType) === '지원' && isCheongyeonCompanyName(responsibleTeamCompanyName)) {
                responsibleMismatchDetails.push(`지원 현장 담당팀 소속 불일치: ${savedResponsibleDisplayName || '팀 정보 없음'} 소속 ${responsibleTeamCompanyName}`);
            }

            if (responsibleMismatchDetails.length > 0) {
                newIssues.reportSiteResponsibleTeamMismatches.push({
                    id: `${reportKey}-site-responsible-team`,
                    ...baseIssue,
                    detail: responsibleMismatchDetails.join(' / ')
                });
            }

            if (reportWorkers.length === 0) {
                newIssues.reportEmptyWorkers.push({
                    id: `${reportKey}-empty-workers`,
                    ...baseIssue,
                    detail: '작업자 행이 없는 출력일보'
                });

                const missingHeaderSnapshot = [
                    !toText(report.siteType) ? '구분' : '',
                    !toText(report.paymentType) ? '결제방식' : ''
                ].filter(Boolean);

                if (missingHeaderSnapshot.length > 0) {
                    newIssues.reportMissingSiteSnapshots.push({
                        id: `${reportKey}-header-site-snapshot`,
                        ...baseIssue,
                        detail: `일보 헤더 ${missingHeaderSnapshot.join(', ')} 미저장`
                    });
                }
            }

            reportWorkers.forEach((worker, workerIndex) => {
                const workerId = toText(worker.workerId);
                const isLinkedWorker = !!workerId && workerIds.has(workerId);
                const isLinkedTeamRow = isTeamBackedReportWorker(worker, teamIds);

                if (!isLinkedWorker && !isLinkedTeamRow) {
                    newIssues.reportMissingWorkers.push({
                        id: `${reportKey}-worker-${workerIndex}`,
                        ...baseIssue,
                        workerId,
                        workerName: toText(worker.name),
                        detail: workerId ? '작업자 DB와 매칭되지 않음' : '작업자 ID 없음'
                    });
                }

                const missingSnapshot = [
                    !toText(worker.siteType || report.siteType) ? '구분' : '',
                    !toText(worker.paymentType || report.paymentType) ? '결제방식' : ''
                ].filter(Boolean);

                if (missingSnapshot.length > 0) {
                    newIssues.reportMissingSiteSnapshots.push({
                        id: `${reportKey}-site-snapshot-${workerIndex}`,
                        ...baseIssue,
                        workerId,
                        workerName: toText(worker.name),
                        detail: `${missingSnapshot.join(', ')} 미저장`
                    });
                }
            });
        });

        setIssues(newIssues);
    };

    const openDailyReportFromIssue = (issue: DailyReportIntegrityIssue) => {
        const params = new URLSearchParams({ tab: 'list-v2' });
        if (issue.date) params.set('date', issue.date);
        if (issue.reportId) params.set('reportId', issue.reportId);
        navigate(`/reports/daily?${params.toString()}`);
    };

    const toggleIssue = (issueKey: keyof IssueStats) => {
        if (expandedIssue === issueKey) {
            setExpandedIssue(null);
        } else {
            setExpandedIssue(issueKey);
        }
    };

    const renderIssueCard = (
        key: keyof IssueStats,
        title: string,
        count: number,
        icon: any,
        colorClass: string,
        unit: string = '명'
    ) => {


        const isSelected = expandedIssue === key;

        return (
            <div
                onClick={() => toggleIssue(key)}
                className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 relative overflow-hidden group
                    ${isSelected
                        ? 'bg-white border-slate-400 ring-2 ring-slate-200 shadow-md transform -translate-y-1'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
                    }
                `}
            >
                <div className={`absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity ${colorClass}`}>
                    <FontAwesomeIcon icon={icon} className="text-4xl" />
                </div>

                <div className="flex items-center gap-2 mb-2">
                    <div className={`p-1.5 rounded-lg text-xs ${colorClass.replace('text-', 'bg-').replace('600', '50').replace('500', '50')} ${colorClass}`}>
                        <FontAwesomeIcon icon={icon} />
                    </div>
                    <span className="text-slate-600 font-bold text-sm">{title}</span>
                </div>

                <div className="flex items-end gap-1 relative z-10">
                    <span className={`text-2xl font-bold ${colorClass}`}>{count}</span>
                    <span className="text-xs text-slate-400 mb-1">{unit}</span>
                </div>

                <div className="mt-2 flex justify-between items-center text-xs text-slate-400">
                    <span>상세보기</span>
                    <FontAwesomeIcon icon={isSelected ? faChevronUp : faChevronDown} />
                </div>
            </div>
        );
    };

    const missingAccountCount = stats.accounts.workerMissing + stats.accounts.teamMissing + stats.accounts.companyMissing;
    const databaseTabs: Array<{
        id: IntegratedDatabaseTab;
        label: string;
        description: string;
        badge: string;
        icon: any;
        iconClassName: string;
    }> = [
        {
            id: 'overview',
            label: '데이터베이스 현황',
            description: '전체 기준정보와 데이터 무결성 상태를 한눈에 확인합니다.',
            badge: '전체 요약',
            icon: faDatabase,
            iconClassName: 'bg-indigo-50 text-indigo-600',
        },
        {
            id: 'workers',
            label: '작업자 목록',
            description: '작업자 인적사항, 재직 상태와 소속 팀 정보를 관리합니다.',
            badge: `${stats.workers.total}명`,
            icon: faHardHat,
            iconClassName: 'bg-blue-50 text-blue-600',
        },
        {
            id: 'offices',
            label: '사무실 목록',
            description: '사무실 직원의 직무, 재직 상태와 계정 연결을 관리합니다.',
            badge: `${stats.offices.total}명`,
            icon: faIdBadge,
            iconClassName: 'bg-violet-50 text-violet-600',
        },
        {
            id: 'settlementTargets',
            label: '정산 대상자',
            description: '바이백과 정산에 사용할 대상자 및 연결 회사를 관리합니다.',
            badge: '정산 관리',
            icon: faCalendar,
            iconClassName: 'bg-amber-50 text-amber-600',
        },
        {
            id: 'teams',
            label: '팀 목록',
            description: '팀 구성, 팀장과 운영 상태를 체계적으로 관리합니다.',
            badge: `${stats.teams.total}팀`,
            icon: faUsers,
            iconClassName: 'bg-fuchsia-50 text-fuchsia-600',
        },
        {
            id: 'sites',
            label: '현장 목록',
            description: '공사 현장과 담당 팀, 진행 상태를 확인하고 관리합니다.',
            badge: `${stats.sites.total}곳`,
            icon: faBuilding,
            iconClassName: 'bg-emerald-50 text-emerald-600',
        },
        {
            id: 'companies',
            label: '회사 목록',
            description: '시공사, 협력사, 발주사와 임대사 정보를 통합 관리합니다.',
            badge: `${stats.companies.total}개사`,
            icon: faBuilding,
            iconClassName: 'bg-orange-50 text-orange-600',
        },
        {
            id: 'accounts',
            label: '계좌 관리',
            description: '작업자, 팀과 회사의 지급 계좌 등록 상태를 점검합니다.',
            badge: missingAccountCount > 0 ? `${missingAccountCount}건 누락` : '등록 완료',
            icon: faCreditCard,
            iconClassName: missingAccountCount > 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600',
        },
    ];
    const databaseSummaryCards = [
        {
            label: '작업자',
            value: stats.workers.total,
            unit: '명',
            detail: `재직 ${stats.workers.active} · 미배정 ${stats.workers.unassigned}`,
            icon: faHardHat,
            iconClassName: 'bg-blue-50 text-blue-600',
            onClick: () => selectTab('workers'),
        },
        {
            label: '사무실',
            value: stats.offices.total,
            unit: '명',
            detail: `재직 ${stats.offices.active} · 연동 ${stats.offices.linked}`,
            icon: faIdBadge,
            iconClassName: 'bg-violet-50 text-violet-600',
            onClick: () => selectTab('offices'),
        },
        {
            label: '팀',
            value: stats.teams.total,
            unit: '팀',
            detail: `운영 ${stats.teams.active} · 대기/폐업 ${stats.teams.inactive}`,
            icon: faUsers,
            iconClassName: 'bg-fuchsia-50 text-fuchsia-600',
            onClick: () => selectTab('teams'),
        },
        {
            label: '현장',
            value: stats.sites.total,
            unit: '곳',
            detail: `진행 ${stats.sites.active} · 종료 ${stats.sites.completed}`,
            icon: faBuilding,
            iconClassName: 'bg-emerald-50 text-emerald-600',
            onClick: () => selectTab('sites'),
        },
        {
            label: '회사',
            value: stats.companies.total,
            unit: '개사',
            detail: `협력 ${stats.companies.partner} · 발주 ${stats.companies.builder}`,
            icon: faBuilding,
            iconClassName: 'bg-orange-50 text-orange-600',
            onClick: () => selectTab('companies'),
        },
        {
            label: '계좌 누락',
            value: missingAccountCount,
            unit: '건',
            detail: `작업자 ${stats.accounts.workerMissing} · 팀 ${stats.accounts.teamMissing} · 회사 ${stats.accounts.companyMissing}`,
            icon: faCreditCard,
            iconClassName: missingAccountCount > 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600',
            onClick: () => selectTab('accounts'),
        },
        {
            label: '일일 보고서',
            value: stats.reports.total,
            unit: '건',
            detail: `금일 ${stats.reports.today} · 이번달 ${stats.reports.thisMonth}`,
            icon: faCalendar,
            iconClassName: 'bg-indigo-50 text-indigo-600',
            onClick: () => navigate('/reports/daily?tab=list-v2'),
        },
    ];

    return (
        <div className="bg-slate-50 min-h-screen pb-20">
            <div className="bg-white border-b border-slate-200">
                <div className="p-4 sm:p-5">
                    <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-600 shadow-sm shadow-indigo-200">
                                <FontAwesomeIcon icon={faDatabase} className="text-white" />
                            </div>
                            <div>
                                <h1 className="whitespace-nowrap text-lg font-bold text-slate-800 sm:text-xl">통합 데이터베이스</h1>
                                <p className="hidden text-xs text-slate-400 sm:block">기준정보를 빠르게 조회하고 관리하세요.</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={handleRebuildManDays}
                            disabled={isRebuildingManDay || loading}
                            aria-label={isRebuildingManDay ? '누적공수 재계산 중' : '누적공수 재계산'}
                            className={`inline-flex h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-lg border text-xs font-bold shadow-sm transition-colors sm:w-auto sm:px-3 ${
                                isRebuildingManDay
                                    ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                                    : 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                            }`}
                        >
                            <FontAwesomeIcon icon={faChartBar} />
                            <span className="hidden sm:inline">{isRebuildingManDay ? '누적공수 재계산 중...' : '누적공수 재계산'}</span>
                        </button>
                    </div>

                    {/* Compact database navigation */}
                    <nav aria-label="통합 데이터베이스 메뉴">
                        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-100/80 p-1 shadow-inner">
                            <div role="tablist" aria-label="데이터베이스 관리 영역" className="grid min-w-[900px] grid-cols-8 gap-1">
                                {databaseTabs.map((tab) => {
                                    const isActive = activeTab === tab.id;
                                    return (
                                        <button
                                            key={tab.id}
                                            type="button"
                                            role="tab"
                                            aria-selected={isActive}
                                            aria-controls={`database-panel-${tab.id}`}
                                            onClick={() => selectTab(tab.id)}
                                            className={`group relative flex h-12 items-center justify-center gap-1.5 rounded-lg border px-3 text-sm font-bold whitespace-nowrap transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                                                isActive
                                                    ? 'border-indigo-200 bg-white text-indigo-700 shadow-sm'
                                                    : 'border-transparent text-slate-500 hover:bg-white/80 hover:text-slate-800'
                                            }`}
                                        >
                                            <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md text-xs ${tab.iconClassName}`}>
                                                <FontAwesomeIcon icon={tab.icon} />
                                            </span>
                                            <span>{tab.label}</span>
                                            {isActive && <span aria-hidden="true" className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-indigo-500" />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </nav>

                    {/* Compact status summary: overview only */}
                    {activeTab === 'overview' && (
                        <section aria-label="데이터베이스 요약" className="mt-3 overflow-x-auto">
                            <div className="grid min-w-[840px] grid-cols-7 gap-2">
                                {databaseSummaryCards.map((card) => (
                                    <button
                                        key={card.label}
                                        type="button"
                                        onClick={card.onClick}
                                        className="flex min-h-[66px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
                                    >
                                        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[11px] ${card.iconClassName}`}>
                                            <FontAwesomeIcon icon={card.icon} />
                                        </span>
                                        <span className="min-w-0">
                                            <span className="block truncate text-[10px] font-bold text-slate-500">{card.label}</span>
                                            <span className="mt-0.5 flex items-baseline gap-1">
                                                <strong className="text-lg leading-none text-slate-800">{card.value}</strong>
                                                <span className="text-[10px] font-medium text-slate-400">{card.unit}</span>
                                            </span>
                                            <span className="mt-1 block truncate text-[9px] text-slate-400">{card.detail}</span>
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </section>
                    )}

                    {loadWarning && (
                        <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                            <FontAwesomeIcon icon={faExclamationTriangle} className="text-amber-500" />
                            <span>{loadWarning}</span>
                        </div>
                    )}
                </div>

                <div id={`database-panel-${activeTab}`} role="tabpanel" className="p-4 sm:p-5">
                    {activeTab === 'overview' && (
                        <div className="space-y-6">
                            {/* Data Integrity Board */}
                            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
                                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                                    <FontAwesomeIcon icon={faExclamationTriangle} className="text-amber-500" />
                                    데이터 무결성 현황 (Data Integrity)
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
                                    {renderIssueCard('unassignedWorkers', '미배정 작업자', issues.unassignedWorkers.length, faUserSlash, 'text-rose-500')}
                                    {renderIssueCard('noIdCardWorkers', '신분증 미등록', issues.noIdCardWorkers.length, faIdBadge, 'text-orange-500')}
                                    {renderIssueCard('noAccountWorkers', '계좌 미등록', issues.noAccountWorkers.length, faCreditCard, 'text-amber-600')}
                                    {renderIssueCard('unassignedSites', '미배정 현장', issues.unassignedSites.length, faBuilding, 'text-rose-500', '곳')}
                                    {renderIssueCard('unassignedBuilders', '미배정 발주사', issues.unassignedBuilders.length, faBuilding, 'text-orange-500', '개')}
                                    {renderIssueCard('unassignedTeamLeaders', '미배정 팀장', issues.unassignedTeamLeaders.length, faUserSlash, 'text-rose-600')}
                                    {renderIssueCard('isolatedWorkers', '고립된 작업자', issues.isolatedWorkers.length, faLink, 'text-slate-600')}
                                    {renderIssueCard('duplicateWorkers', '중복 데이터', issues.duplicateWorkers.length, faUsers, 'text-purple-600', '건')}
                                    {renderIssueCard('ghostWorkers', '유령 작업자', issues.ghostWorkers.length, faUserClock, 'text-slate-500')}
                                    {renderIssueCard('retiredWorkers', '퇴사자', issues.retiredWorkers.length, faUserXmark, 'text-slate-500')}
                                    {renderIssueCard('closedTeams', '폐업/대기 팀', issues.closedTeams.length, faStoreSlash, 'text-slate-500', '팀')}
                                </div>

                                <div className="mt-6">
                                    <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-700">
                                        <FontAwesomeIcon icon={faCalendar} className="text-indigo-500" />
                                        출력일보 무결성
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
                                        {renderIssueCard('reportMissingSites', '일보 현장 미연결', issues.reportMissingSites.length, faBuilding, 'text-rose-500', '건')}
                                        {renderIssueCard('reportMissingTeams', '일보 팀 미연결', issues.reportMissingTeams.length, faUsers, 'text-orange-500', '건')}
                                        {renderIssueCard('reportMissingWorkers', '일보 작업자 미연결', issues.reportMissingWorkers.length, faUserSlash, 'text-amber-600', '줄')}
                                        {renderIssueCard('reportEmptyWorkers', '빈 일보', issues.reportEmptyWorkers.length, faChartBar, 'text-slate-500', '건')}
                                        {renderIssueCard('reportMissingSiteSnapshots', '구분/결제 누락', issues.reportMissingSiteSnapshots.length, faExclamationTriangle, 'text-purple-600', '줄')}
                                        {renderIssueCard('reportSiteResponsibleTeamMismatches', '현장소속팀 불일치', issues.reportSiteResponsibleTeamMismatches.length, faHardHat, 'text-blue-600', '건')}
                                    </div>
                                </div>

                                {/* Accordion Detail View */}
                                {expandedIssue && (
                                    <div className="mt-4 bg-white rounded-xl border border-slate-200 shadow-sm animate-fade-in-down">
                                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
                                            <h4 className="font-bold text-slate-700">
                                                {expandedIssue === 'unassignedWorkers' && '미배정 작업자 목록 (팀 정보 없음)'}
                                                {expandedIssue === 'noIdCardWorkers' && '신분증 미등록 작업자 목록'}
                                                {expandedIssue === 'noAccountWorkers' && '계좌번호 누락 작업자 목록'}
                                                {expandedIssue === 'unassignedSites' && '담당 팀이 없는 현장 목록'}
                                                {expandedIssue === 'unassignedBuilders' && '담당 현장이 없는 발주사 목록'}
                                                {expandedIssue === 'unassignedTeamLeaders' && '직책이 팀장이지만 팀을 맡고 있지 않은 인원'}
                                                {expandedIssue === 'isolatedWorkers' && '팀, 현장, 회사 어디에도 소속되지 않은 작업자'}
                                                {expandedIssue === 'duplicateWorkers' && '중복 의심 데이터 (주민번호/연락처)'}
                                                {expandedIssue === 'ghostWorkers' && '최근 30일간 작업 기록이 없는 재직자 (유령 작업자)'}
                                                {expandedIssue === 'retiredWorkers' && '퇴사자 목록 (히스토리)'}
                                                {expandedIssue === 'closedTeams' && '폐업 또는 대기 상태인 팀 목록'}
                                                {expandedIssue === 'reportMissingSites' && '출력일보 현장 연결 누락'}
                                                {expandedIssue === 'reportMissingTeams' && '출력일보 팀 연결 누락'}
                                                {expandedIssue === 'reportMissingWorkers' && '출력일보 작업자 연결 누락'}
                                                {expandedIssue === 'reportEmptyWorkers' && '작업자 행이 없는 출력일보'}
                                                {expandedIssue === 'reportMissingSiteSnapshots' && '출력일보 구분/결제방식 저장 누락'}
                                                {expandedIssue === 'reportSiteResponsibleTeamMismatches' && '출력일보 현장소속팀 불일치'}
                                            </h4>
                                            <button onClick={() => setExpandedIssue(null)} className="text-slate-400 hover:text-slate-600">
                                                닫기
                                            </button>
                                        </div>
                                        <div className="p-4 max-h-96 overflow-y-auto">
                                            {/* Worker Lists */}
                                            {['unassignedWorkers', 'noIdCardWorkers', 'noAccountWorkers', 'unassignedTeamLeaders', 'isolatedWorkers', 'ghostWorkers', 'retiredWorkers'].includes(expandedIssue) && (
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                                    {(issues[expandedIssue as keyof IssueStats] as Worker[])?.map((worker) => (
                                                        <div key={worker.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                                                            <div>
                                                                <div className="font-bold text-slate-800">{worker.name}</div>
                                                                <div className="text-xs text-slate-500">{worker.idNumber} / {worker.role}</div>
                                                            </div>
                                                            <button
                                                                onClick={() => selectTab('workers', worker.id || null)}
                                                                className="text-xs text-indigo-600 hover:underline"
                                                            >
                                                                관리
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Site List */}
                                            {expandedIssue === 'unassignedSites' && (
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                                    {(issues.unassignedSites).map((site) => (
                                                        <div key={site.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                                                            <div>
                                                                <div className="font-bold text-slate-800">{site.name}</div>
                                                                <div className="text-xs text-slate-500">{site.code}</div>
                                                            </div>
                                                            <button onClick={() => selectTab('sites', site.id || null)} className="text-xs text-indigo-600 hover:underline">관리</button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Company List */}
                                            {expandedIssue === 'unassignedBuilders' && (
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                                    {(issues.unassignedBuilders).map((comp) => (
                                                        <div key={comp.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                                                            <div>
                                                                <div className="font-bold text-slate-800">{comp.name}</div>
                                                                <div className="text-xs text-slate-500">{comp.ceoName}</div>
                                                            </div>
                                                            <button onClick={() => selectTab('companies', comp.id || null)} className="text-xs text-indigo-600 hover:underline">관리</button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Closed Teams List */}
                                            {expandedIssue === 'closedTeams' && (
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                                    {(issues.closedTeams).map((team) => (
                                                        <div key={team.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                                                            <div>
                                                                <div className="font-bold text-slate-800">{team.name}</div>
                                                                <div className="text-xs text-slate-500">{team.leaderName} / {team.status === 'closed' ? '폐업' : '대기'}</div>
                                                            </div>
                                                            <button onClick={() => selectTab('teams', team.id || null)} className="text-xs text-indigo-600 hover:underline">관리</button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Duplicate List */}
                                            {expandedIssue === 'duplicateWorkers' && (
                                                <div className="space-y-3">
                                                    {issues.duplicateWorkers.map((group, idx) => (
                                                        <div key={idx} className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                                                            <div className="text-sm font-bold text-rose-600 mb-2">{group.label} ({group.list.length}명)</div>
                                                            <div className="flex flex-wrap gap-2">
                                                                {group.list.map(w => (
                                                                    <div key={w.id} className="bg-white px-3 py-1.5 rounded border border-slate-300 text-sm">
                                                                        {w.name} <span className="text-slate-400 text-xs">({w.status})</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Daily Report Integrity Lists */}
                                            {isDailyReportIssueKey(expandedIssue) && (
                                                <div className="space-y-2">
                                                    {(issues[expandedIssue] as DailyReportIntegrityIssue[]).map((issue) => (
                                                        <div key={issue.id} className="flex items-center justify-between gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                                                            <div className="min-w-0">
                                                                <div className="font-bold text-slate-800 truncate">
                                                                    {issue.date || '날짜 없음'} · {issue.siteName || issue.siteId || '현장 없음'}
                                                                </div>
                                                                <div className="text-xs text-slate-500 truncate">
                                                                    {[issue.siteAddress, issue.teamName || issue.teamId, issue.workerName || issue.workerId, issue.detail].filter(Boolean).join(' · ')}
                                                                </div>
                                                            </div>
                                                            <button
                                                                onClick={() => openDailyReportFromIssue(issue)}
                                                                className="shrink-0 text-xs text-indigo-600 hover:underline"
                                                            >
                                                                일보 확인
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'workers' && (
                        <WorkerDatabase hideHeader={true} highlightedId={highlightedId} />
                    )}
                    {activeTab === 'offices' && (
                        <OfficeStaffDatabase hideHeader={true} highlightedId={highlightedId} />
                    )}
                    {activeTab === 'settlementTargets' && (
                        <SettlementTargetDatabase hideHeader={true} highlightedId={highlightedId} />
                    )}
                    {activeTab === 'teams' && (
                        <TeamDatabase hideHeader={false} highlightedId={highlightedId} />
                    )}
                    {activeTab === 'sites' && (
                        <SiteDatabase hideHeader={true} highlightedId={highlightedId} />
                    )}
                    {activeTab === 'companies' && (
                        <CompanyDatabase
                            hideHeader={false}
                            highlightedId={highlightedId}
                            entityLabel="회사"
                            defaultType="미지정"
                        />
                    )}
                    {activeTab === 'accounts' && (
                        <AccountManagementPage embedded={true} />
                    )}
                </div>
            </div>
        </div>
    );
}

export default IntegratedDatabase;
