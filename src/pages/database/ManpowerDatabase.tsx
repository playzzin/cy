import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { manpowerService, Worker } from '../../services/manpowerService';
import { teamService, Team } from '../../services/teamService';
import { siteService, Site } from '../../services/siteService';
import { companyService, Company } from '../../services/companyService';
import { officeStaffService, OfficeStaff } from '../../services/officeStaffService';
import { dailyReportService, DailyReport } from '../../services/dailyReportService';
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

type IntegratedDatabaseTab = 'overview' | 'workers' | 'offices' | 'settlementTargets' | 'teams' | 'sites' | 'companies' | 'accounts' | 'reports';

const parseIntegratedDatabaseTab = (value: string | null): IntegratedDatabaseTab | null => {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'workers') return 'workers';
    if (normalized === 'offices' || normalized === 'office' || normalized === 'office-staff' || normalized === 'office_staff') return 'offices';
    if (normalized === 'settlement-targets' || normalized === 'settlementtargets' || normalized === 'payback' || normalized === 'buyback') return 'settlementTargets';
    if (normalized === 'teams') return 'teams';
    if (normalized === 'sites') return 'sites';
    if (normalized === 'companies') return 'companies';
    if (normalized === 'accounts') return 'accounts';
    if (normalized === 'reports') return 'reports';
    if (normalized === 'overview') return 'overview';
    return null;
};

const isDatabaseLogTabValue = (value: string | null): boolean => {
    const normalized = String(value || '').trim().toLowerCase();
    return normalized === 'logs' || normalized === 'database-logs' || normalized === 'db-logs';
};

interface DatabaseStats {
    workers: {
        total: number;
        active: number;
        inactive: number;
        unassigned: number;
    };
    offices: {
        total: number;
        active: number;
        pending: number;
        linked: number;
    };
    teams: {
        total: number;
        active: number;
        inactive: number;
    };
    sites: {
        total: number;
        active: number;
        completed: number;
    };
    companies: {
        total: number;
        contractor: number; // 시공팀
        partner: number;
        builder: number; // 건설사
        rental: number; // 임대사
    };
    accounts: {
        workerMissing: number;
        teamMissing: number;
        companyMissing: number;
    };
    reports: {
        total: number;
        thisMonth: number;
        today: number;
    };
}

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
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<IntegratedDatabaseTab>(() => parseIntegratedDatabaseTab(searchParams.get('tab')) || 'overview');

    // Stats State
    const [stats, setStats] = useState<DatabaseStats>({
        workers: { total: 0, active: 0, inactive: 0, unassigned: 0 },
        offices: { total: 0, active: 0, pending: 0, linked: 0 },
        teams: { total: 0, active: 0, inactive: 0 },
        sites: { total: 0, active: 0, completed: 0 },
        companies: { total: 0, contractor: 0, partner: 0, builder: 0, rental: 0 },
        accounts: { workerMissing: 0, teamMissing: 0, companyMissing: 0 },
        reports: { total: 0, thisMonth: 0, today: 0 }
    });

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

    const loadStats = async () => {
        setLoading(true);
        try {
            // Calculate date range for Ghost Worker check (last 30 days)
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 30);

            const startDateStr = startDate.toISOString().split('T')[0];
            const endDateStr = endDate.toISOString().split('T')[0];

            const [workersData, officeStaffData, teamsData, sitesData, companiesData, reportStats, recentReports, allReports] = await Promise.all([
                manpowerService.getWorkers(),
                officeStaffService.getOfficeStaff(),
                teamService.getTeams(),
                siteService.getSites(),
                companyService.getCompanies(),
                dailyReportService.getDBStats(), // Optimized: Count only
                dailyReportService.getReports({ startDate: startDateStr, endDate: endDateStr }),
                dailyReportService.getAllReports()
            ]);

            calculateStats(workersData, officeStaffData, teamsData, sitesData, companiesData, reportStats);
            calculateIssues(workersData, teamsData, sitesData, companiesData, recentReports, allReports);
        } catch (error) {
            console.error('Failed to load stats:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadStats();
    }, []);

    useEffect(() => {
        const tabParam = searchParams.get('tab');
        if (isDatabaseLogTabValue(tabParam)) {
            navigate('/database/logs', { replace: true });
            return;
        }
        const requestedTab = parseIntegratedDatabaseTab(tabParam);
        if (requestedTab) setActiveTab(requestedTab);
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


    const calculateStats = (
        workers: Worker[],
        officeStaff: OfficeStaff[],
        teams: Team[],
        sites: Site[],
        companies: Company[],
        reportStats: { total: number; thisMonth: number; today: number }
    ) => {
        setStats({
            workers: {
                total: workers.length,
                active: workers.filter(w => w.status === '재직').length,
                inactive: workers.filter(w => w.status === '퇴사' || w.status === '휴직').length,
                unassigned: workers.filter(w => !w.teamId).length
            },
            offices: {
                total: officeStaff.length,
                active: officeStaff.filter((staff) => (staff.status || '재직') !== '퇴사').length,
                pending: officeStaff.filter((staff) => staff.status === '승인대기').length,
                linked: officeStaff.filter((staff) => !!staff.uid).length,
            },
            teams: {
                total: teams.length,
                active: teams.filter(t => t.status === 'active' || !t.status).length,
                inactive: teams.filter(t => t.status === 'waiting' || t.status === 'closed').length
            },
            sites: {
                total: sites.length,
                active: sites.filter(s => s.status === 'active').length,
                completed: sites.filter(s => s.status === 'completed').length
            },
            companies: {
                total: companies.length,
                contractor: companies.filter(c => c.type === '시공사').length,
                partner: companies.filter(c => c.type === '협력사').length,
                builder: companies.filter(c => c.type === '건설사').length,
                rental: companies.filter(c => c.type === '임대사').length
            },
            accounts: {
                workerMissing: workers.filter(w => !w.accountNumber).length,
                teamMissing: teams.filter(t => !t.accountNumber).length,
                companyMissing: companies.filter(c => !c.accountNumber).length,
            },
            reports: reportStats // Use pre-calculated stats directly
        });
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

        // Company Checks (Builders without any assigned sites via Site.companyId)
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

    return (
        <div className="bg-slate-50 min-h-screen pb-20">
            <div className="bg-white border-b border-slate-200">
                <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-3">
                            <div className="bg-indigo-600 p-2 rounded-lg">
                                <FontAwesomeIcon icon={faDatabase} className="text-white text-xl" />
                            </div>
                            <h1 className="text-2xl font-bold text-slate-800">통합 데이터베이스</h1>
                        </div>
                    </div>

                    <div className="mb-4 flex justify-end">
                        <button
                            type="button"
                            onClick={handleRebuildManDays}
                            disabled={isRebuildingManDay || loading}
                            className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-bold shadow-sm transition-colors ${
                                isRebuildingManDay
                                    ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                                    : 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                            }`}
                        >
                            <FontAwesomeIcon icon={faChartBar} />
                            {isRebuildingManDay ? '누적공수 재계산 중...' : '누적공수 재계산'}
                        </button>
                    </div>

                    {/* Main Stats Cards */}
                    <div className="flex flex-wrap gap-4 mb-4">
                        <div className="flex-1 min-w-[200px] bg-white p-4 rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:border-indigo-300 transition-colors" onClick={() => setActiveTab('workers')}>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-slate-500 font-medium text-sm">총 작업자</span>
                                <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs">
                                    <FontAwesomeIcon icon={faHardHat} />
                                </div>
                            </div>
                            <div className="flex items-end gap-2">
                                <h3 className="text-2xl font-bold text-slate-800">{stats.workers.total}</h3>
                                <span className="text-xs text-slate-500 mb-1">명</span>
                            </div>
                            <div className="mt-2 text-xs text-slate-400 flex justify-between">
                                <span>재직 {stats.workers.active}</span>
                                <span>미배정 {stats.workers.unassigned}</span>
                            </div>
                        </div>

                        <div className="flex-1 min-w-[200px] bg-white p-4 rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:border-indigo-300 transition-colors" onClick={() => setActiveTab('offices')}>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-slate-500 font-medium text-sm">사무실 직원</span>
                                <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs">
                                    <FontAwesomeIcon icon={faIdBadge} />
                                </div>
                            </div>
                            <div className="flex items-end gap-2">
                                <h3 className="text-2xl font-bold text-slate-800">{stats.offices.total}</h3>
                                <span className="text-xs text-slate-500 mb-1">명</span>
                            </div>
                            <div className="mt-2 text-xs text-slate-400 flex justify-between">
                                <span>재직 {stats.offices.active}</span>
                                <span>연동 {stats.offices.linked}</span>
                            </div>
                        </div>

                        <div className="flex-1 min-w-[200px] bg-white p-4 rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:border-indigo-300 transition-colors" onClick={() => setActiveTab('teams')}>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-slate-500 font-medium text-sm">등록 팀</span>
                                <div className="p-1.5 bg-purple-50 text-purple-600 rounded-lg text-xs">
                                    <FontAwesomeIcon icon={faUsers} />
                                </div>
                            </div>
                            <div className="flex items-end gap-2">
                                <h3 className="text-2xl font-bold text-slate-800">{stats.teams.total}</h3>
                                <span className="text-xs text-slate-500 mb-1">팀</span>
                            </div>
                            <div className="mt-2 text-xs text-slate-400">
                                <span>협업 {stats.teams.active} · 대기/폐업 {stats.teams.inactive}</span>
                            </div>
                        </div>

                        <div className="flex-1 min-w-[200px] bg-white p-4 rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:border-indigo-300 transition-colors" onClick={() => setActiveTab('sites')}>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-slate-500 font-medium text-sm">현장 현황</span>
                                <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-xs">
                                    <FontAwesomeIcon icon={faBuilding} />
                                </div>
                            </div>
                            <div className="flex items-end gap-2">
                                <h3 className="text-2xl font-bold text-slate-800">{stats.sites.total}</h3>
                                <span className="text-xs text-slate-500 mb-1">곳</span>
                            </div>
                            <div className="mt-2 text-xs text-slate-400">
                                <span>진행중 {stats.sites.active} · 종료 {stats.sites.completed}</span>
                            </div>
                        </div>

                        <div className="flex-1 min-w-[200px] bg-white p-4 rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:border-indigo-300 transition-colors" onClick={() => setActiveTab('companies')}>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-slate-500 font-medium text-sm">거래처</span>
                                <div className="p-1.5 bg-orange-50 text-orange-600 rounded-lg text-xs">
                                    <FontAwesomeIcon icon={faBuilding} />
                                </div>
                            </div>
                            <div className="flex items-end gap-2">
                                <h3 className="text-2xl font-bold text-slate-800">{stats.companies.total}</h3>
                                <span className="text-xs text-slate-500 mb-1">개사</span>
                            </div>
                            <div className="mt-2 text-xs text-slate-400">
                                <span>시공사 {stats.companies.contractor} · 협력사 {stats.companies.partner} · 건설사 {stats.companies.builder} · 임대사 {stats.companies.rental}</span>
                            </div>
                        </div>

                        <div className="flex-1 min-w-[200px] bg-white p-4 rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:border-indigo-300 transition-colors" onClick={() => setActiveTab('accounts')}>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-slate-500 font-medium text-sm">계좌 관리</span>
                                <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg text-xs">
                                    <FontAwesomeIcon icon={faCreditCard} />
                                </div>
                            </div>
                            <div className="flex items-end gap-2">
                                <h3 className="text-2xl font-bold text-slate-800">{stats.accounts.workerMissing + stats.accounts.teamMissing + stats.accounts.companyMissing}</h3>
                                <span className="text-xs text-slate-500 mb-1">건 누락</span>
                            </div>
                            <div className="mt-2 text-xs text-slate-400">
                                <span>작업자 {stats.accounts.workerMissing} · 팀 {stats.accounts.teamMissing} · 회사 {stats.accounts.companyMissing}</span>
                            </div>
                        </div>

                        <div className="flex-1 min-w-[200px] bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-slate-500 font-medium text-sm">일일 보고서</span>
                                <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs">
                                    <FontAwesomeIcon icon={faCalendar} />
                                </div>
                            </div>
                            <div className="flex items-end gap-2">
                                <h3 className="text-2xl font-bold text-slate-800">{stats.reports.total}</h3>
                                <span className="text-xs text-slate-500 mb-1">건</span>
                            </div>
                            <div className="mt-2 text-xs text-slate-400">
                                <span>금일 {stats.reports.today} · 이번달 {stats.reports.thisMonth}</span>
                            </div>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-slate-200 mt-8 overflow-x-auto">
                        <button
                            onClick={() => setActiveTab('overview')}
                            className={`px-6 py-4 text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'overview' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                        >
                            데이터베이스 현황
                        </button>
                        <button
                            onClick={() => setActiveTab('workers')}
                            className={`px-6 py-4 text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'workers' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                        >
                            작업자 목록
                        </button>
                        <button
                            onClick={() => setActiveTab('offices')}
                            className={`px-6 py-4 text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'offices' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                        >
                            사무실 목록
                        </button>
                        <button
                            onClick={() => setActiveTab('settlementTargets')}
                            className={`px-6 py-4 text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'settlementTargets' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                        >
                            정산 대상자
                        </button>
                        <button
                            onClick={() => setActiveTab('teams')}
                            className={`px-6 py-4 text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'teams' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                        >
                            팀 목록
                        </button>
                        <button
                            onClick={() => setActiveTab('sites')}
                            className={`px-6 py-4 text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'sites' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                        >
                            현장 목록
                        </button>
                        <button
                            onClick={() => setActiveTab('companies')}
                            className={`px-6 py-4 text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'companies' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                        >
                            회사 목록
                        </button>
                        <button
                            onClick={() => setActiveTab('accounts')}
                            className={`px-6 py-4 text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'accounts' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                        >
                            계좌 관리
                        </button>
                    </div>
                </div>

                <div className="p-6">
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
                                    {renderIssueCard('unassignedBuilders', '미배정 건설사', issues.unassignedBuilders.length, faBuilding, 'text-orange-500', '개')}
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
                                                {expandedIssue === 'unassignedBuilders' && '담당 현장이 없는 건설사 목록'}
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
                                                                onClick={() => {
                                                                    setActiveTab('workers');
                                                                    setHighlightedId(worker.id || null);
                                                                }}
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
                                                            <button onClick={() => { setActiveTab('sites'); setHighlightedId(site.id || null); }} className="text-xs text-indigo-600 hover:underline">관리</button>
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
                                                            <button onClick={() => { setActiveTab('companies'); setHighlightedId(comp.id || null); }} className="text-xs text-indigo-600 hover:underline">관리</button>
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
                                                            <button onClick={() => { setActiveTab('teams'); setHighlightedId(team.id || null); }} className="text-xs text-indigo-600 hover:underline">관리</button>
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
