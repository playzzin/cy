import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    CalendarDays,
    Check,
    ChevronLeft,
    ChevronRight,
    ClipboardList,
    Copy,
    MapPin,
    RefreshCw,
    Save,
    Search,
    Trash2,
    UserX,
    UsersRound,
    XCircle,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
    FIELD_REQUEST_OFF_DUTY_SITE_ID,
    fieldScheduleRequestService,
    FieldScheduleRequest,
    isOffDutyOnlyFieldScheduleRequest,
} from '../../services/fieldScheduleRequestService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { officeStaffService } from '../../services/officeStaffService';
import { siteService, Site } from '../../services/siteService';
import { teamService, Team } from '../../services/teamService';
import { userService, UserData } from '../../services/userService';

const REQUEST_RANGE_DAYS = 30;
const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

type SiteGroup = 'my-team' | 'support';
type RequestPageTab = 'register' | 'month-list';

interface SiteTeamScope {
    enabled: boolean;
    allSiteAccess: boolean;
    teamIds: string[];
    teamNameKeys: string[];
    label: string;
}

const EMPTY_SITE_TEAM_SCOPE: SiteTeamScope = {
    enabled: false,
    allSiteAccess: false,
    teamIds: [],
    teamNameKeys: [],
    label: '',
};

const OFFICE_SITE_TEAM_SCOPE: SiteTeamScope = {
    enabled: true,
    allSiteAccess: true,
    teamIds: [],
    teamNameKeys: [],
    label: '사무실 전체',
};

const getTodayInputValue = () => {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
};

const shiftDate = (date: string, amount: number) => {
    const next = new Date(`${date}T00:00:00`);
    next.setDate(next.getDate() + amount);
    const local = new Date(next.getTime() - next.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
};

const getWeekday = (date: string) => new Date(`${date}T00:00:00`).getDay();

const formatDate = (date: string) =>
    new Date(`${date}T00:00:00`).toLocaleDateString('ko-KR', {
        month: '2-digit',
        day: '2-digit',
        weekday: 'short',
    });

const formatFullDate = (date: string) =>
    new Date(`${date}T00:00:00`).toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        weekday: 'short',
    });

const getMonthStart = (date: string) => `${date.slice(0, 7)}-01`;

const toInputDateValue = (date: Date) => {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
};

const shiftMonth = (monthStart: string, amount: number) => {
    const next = new Date(`${monthStart}T00:00:00`);
    next.setDate(1);
    next.setMonth(next.getMonth() + amount);
    return toInputDateValue(next);
};

const getMonthEnd = (monthStart: string) => {
    const date = new Date(`${monthStart}T00:00:00`);
    return toInputDateValue(new Date(date.getFullYear(), date.getMonth() + 1, 0));
};

const getCalendarDates = (monthStart: string) => {
    const start = new Date(`${monthStart}T00:00:00`);
    const firstWeekday = start.getDay();
    const gridStart = new Date(start);
    gridStart.setDate(1 - firstWeekday);

    return Array.from({ length: 42 }, (_, index) => {
        const date = new Date(gridStart);
        date.setDate(gridStart.getDate() + index);
        return toInputDateValue(date);
    });
};

const formatMonthTitle = (monthStart: string) =>
    new Date(`${monthStart}T00:00:00`).toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
    });

const normalizeText = (value: unknown) => String(value ?? '').trim();
const normalizeKey = (value: unknown) => normalizeText(value).toLowerCase().replace(/\s+/g, '');

const cleanList = (values: unknown[]) =>
    Array.from(new Set(values.map(normalizeText).filter(Boolean)));

const parseLinkedIds = (raw: unknown): string[] => {
    if (Array.isArray(raw)) return cleanList(raw);
    const text = normalizeText(raw);
    if (!text) return [];
    try {
        const parsed = JSON.parse(text);
        return Array.isArray(parsed) ? cleanList(parsed) : [text];
    } catch {
        return [text];
    }
};

const isInactiveWorker = (worker: Worker) => {
    const status = normalizeText(worker.status);
    return worker.isActive === false || status.includes('퇴사');
};

const getTeamColor = (team?: Team | null) => normalizeText(team?.color) || '#64748b';

const sameText = (left?: unknown, right?: unknown) =>
    normalizeText(left).toLowerCase() === normalizeText(right).toLowerCase();

const includesKeyword = (keywords: string[], ...values: unknown[]) =>
    values.some((value) => {
        const key = normalizeKey(value);
        return Boolean(key) && keywords.some((keyword) => key.includes(normalizeKey(keyword)));
    });

const isExternalSupportSite = (site: Site, teamsById: Map<string, Team>, teams: Team[]) => {
    const responsibleTeam =
        (site.responsibleTeamId ? teamsById.get(site.responsibleTeamId) : undefined) ||
        teams.find((team) => normalizeText(team.legacyId) === normalizeText(site.responsibleTeamId)) ||
        teams.find((team) => sameText(team.name, site.responsibleTeamName));

    return includesKeyword(
        ['외부지원', '지원팀', '지원', '용역'],
        site.siteType,
        site.responsibleTeamName,
        responsibleTeam?.name,
        responsibleTeam?.type,
        responsibleTeam?.role,
        responsibleTeam?.companyName,
        responsibleTeam?.parentTeamName,
        responsibleTeam?.supportModel,
        responsibleTeam?.supportDescription,
        responsibleTeam?.serviceModel,
        responsibleTeam?.serviceDescription
    );
};

const findWorkerTeam = (worker: Worker | undefined, teamsById: Map<string, Team>, teams: Team[]) => {
    if (!worker) return undefined;
    const teamId = normalizeText(worker.teamId);
    if (teamId) {
        const byId = teamsById.get(teamId);
        if (byId) return byId;
        const byLegacyId = teams.find((team) => normalizeText(team.legacyId) === teamId);
        if (byLegacyId) return byLegacyId;
    }
    return teams.find((team) => sameText(team.name, worker.teamName));
};

const findViewerWorker = (uid: string | undefined, workers: Worker[], userData?: UserData | null) => {
    const normalizedUid = normalizeText(uid);
    if (!normalizedUid) return undefined;

    const directWorker = workers.find((worker) => normalizeText(worker.uid) === normalizedUid);
    if (directWorker) return directWorker;

    const linkedWorkerIds = parseLinkedIds(userData?.linkedWorkerIds);
    if (linkedWorkerIds.length === 0) return undefined;

    return workers.find((worker) => {
        const workerKeys = cleanList([worker.id, worker.legacyId]);
        return linkedWorkerIds.some((linkedId) => workerKeys.includes(linkedId));
    });
};

const isOfficeStaffViewer = (userData?: UserData | null, linkedOfficeStaff?: unknown) =>
    userData?.accountType === 'office' ||
    parseLinkedIds(userData?.linkedOfficeStaffIds).length > 0 ||
    Boolean(linkedOfficeStaff);

const buildSiteTeamScope = (worker: Worker | undefined, teamsById: Map<string, Team>, teams: Team[]): SiteTeamScope => {
    const team = findWorkerTeam(worker, teamsById, teams);
    const teamIds = cleanList([worker?.teamId, team?.id, team?.legacyId]);
    const teamNames = cleanList([worker?.teamName, team?.name]);
    if (teamIds.length === 0 && teamNames.length === 0) return EMPTY_SITE_TEAM_SCOPE;

    return {
        enabled: true,
        allSiteAccess: false,
        teamIds,
        teamNameKeys: cleanList(teamNames.map(normalizeKey)),
        label: teamNames[0] || teamIds[0],
    };
};

const siteMatchesTeamScope = (site: Site, scope: SiteTeamScope) => {
    if (!scope.enabled) return false;
    const responsibleTeamId = normalizeText(site.responsibleTeamId);
    if (responsibleTeamId && scope.teamIds.includes(responsibleTeamId)) return true;
    return Boolean(normalizeKey(site.responsibleTeamName) && scope.teamNameKeys.includes(normalizeKey(site.responsibleTeamName)));
};

const getSiteIdentity = (site: Site) => site.id || site.name;

const buildSelectableSiteGroups = (siteRows: Site[], scope: SiteTeamScope, supportSiteIds: Set<string>) => {
    const activeSites = siteRows
        .filter((site) => site.status !== 'completed')
        .sort((left, right) => normalizeText(left.name).localeCompare(normalizeText(right.name), 'ko'));

    if (scope.allSiteAccess) {
        return {
            myTeam: activeSites,
            support: activeSites.filter((site) => supportSiteIds.has(getSiteIdentity(site))),
        };
    }

    if (!scope.enabled) {
        return {
            myTeam: [] as Site[],
            support: activeSites.filter((site) => supportSiteIds.has(getSiteIdentity(site))),
        };
    }

    return {
        myTeam: activeSites.filter((site) => siteMatchesTeamScope(site, scope)),
        support: activeSites.filter((site) =>
            supportSiteIds.has(getSiteIdentity(site)) && !siteMatchesTeamScope(site, scope)
        ),
    };
};

export default function FieldScheduleRequestPage() {
    const { currentUser } = useAuth();
    const today = getTodayInputValue();
    const [selectedDate, setSelectedDate] = useState(() => shiftDate(getTodayInputValue(), 1));
    const [calendarMonth, setCalendarMonth] = useState(() => getMonthStart(shiftDate(getTodayInputValue(), 1)));
    const [sites, setSites] = useState<Site[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [requests, setRequests] = useState<FieldScheduleRequest[]>([]);
    const [siteGroup, setSiteGroup] = useState<SiteGroup>('my-team');
    const [siteTeamScope, setSiteTeamScope] = useState<SiteTeamScope>(EMPTY_SITE_TEAM_SCOPE);
    const [selectedSiteId, setSelectedSiteId] = useState('');
    const [requestedHeadcount, setRequestedHeadcount] = useState(1);
    const [offDutyWorkerIds, setOffDutyWorkerIds] = useState<string[]>([]);
    const [memo, setMemo] = useState('');
    const [siteSearch, setSiteSearch] = useState('');
    const [workerSearch, setWorkerSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [activeTab, setActiveTab] = useState<RequestPageTab>('register');

    const requestStartDate = useMemo(() => shiftDate(today, 1), [today]);
    const requestEndDate = useMemo(() => shiftDate(today, REQUEST_RANGE_DAYS), [today]);
    const selectedDateAllowed = Boolean(selectedDate) && selectedDate >= requestStartDate && selectedDate <= requestEndDate;
    const requestListDateLabel = formatDate(selectedDate);

    const teamsById = useMemo(() => new Map(teams.map((team) => [team.id || '', team])), [teams]);
    const supportSiteIds = useMemo(
        () => new Set(sites.filter((site) => isExternalSupportSite(site, teamsById, teams)).map((site) => site.id || site.name)),
        [sites, teams, teamsById]
    );
    const workersById = useMemo(() => new Map(workers.map((worker) => [worker.id || '', worker])), [workers]);
    const selectedSite = useMemo(
        () => sites.find((site) => site.id === selectedSiteId),
        [selectedSiteId, sites]
    );
    const selectedOffDutyWorkers = useMemo(
        () =>
            offDutyWorkerIds
                .map((workerId) => workersById.get(workerId))
                .filter((worker): worker is Worker => Boolean(worker)),
        [offDutyWorkerIds, workersById]
    );
    const activeRequests = useMemo(
        () => requests.filter((request) => request.status !== 'cancelled'),
        [requests]
    );
    const selectedDateRequests = useMemo(
        () => activeRequests.filter((request) => request.date === selectedDate),
        [activeRequests, selectedDate]
    );
    const siteRequests = useMemo(
        () => selectedDateRequests.filter((request) => !isOffDutyOnlyFieldScheduleRequest(request)),
        [selectedDateRequests]
    );
    const offDutyRequests = useMemo(
        () => selectedDateRequests.filter(isOffDutyOnlyFieldScheduleRequest),
        [selectedDateRequests]
    );
    const monthlySiteRequests = useMemo(
        () => activeRequests.filter((request) => !isOffDutyOnlyFieldScheduleRequest(request)),
        [activeRequests]
    );
    const monthlyOffDutyRequests = useMemo(
        () => activeRequests.filter(isOffDutyOnlyFieldScheduleRequest),
        [activeRequests]
    );
    const selectedDateOffDutyRequest = useMemo(
        () => offDutyRequests.find((request) => request.date === selectedDate),
        [offDutyRequests, selectedDate]
    );

    const siteGroups = useMemo(() => {
        return buildSelectableSiteGroups(sites, siteTeamScope, supportSiteIds);
    }, [siteTeamScope, sites, supportSiteIds]);

    const filteredSites = useMemo(() => {
        const term = siteSearch.trim().toLowerCase();
        const groupSites = siteGroup === 'support' ? siteGroups.support : siteGroups.myTeam;
        return groupSites
            .filter((site) => {
                if (!term) return true;
                return `${site.name} ${site.address || ''} ${site.responsibleTeamName || ''} ${site.code || ''}`
                    .toLowerCase()
                    .includes(term);
            });
    }, [siteGroup, siteGroups, siteSearch]);

    const filteredWorkers = useMemo(() => {
        const term = workerSearch.trim().toLowerCase();
        return workers
            .filter((worker) => worker.id && !isInactiveWorker(worker))
            .filter((worker) => {
                if (!term) return true;
                return `${worker.name} ${worker.teamName || ''} ${worker.role || ''}`.toLowerCase().includes(term);
            })
            .sort((left, right) => {
                const teamDiff = normalizeText(left.teamName).localeCompare(normalizeText(right.teamName), 'ko');
                return teamDiff || normalizeText(left.name).localeCompare(normalizeText(right.name), 'ko');
            });
    }, [workerSearch, workers]);

    const requestSummary = useMemo(() => {
        return {
            siteCount: new Set(siteRequests.map((request) => `${request.date}:${request.siteId}`)).size,
            requestedPeople: siteRequests.reduce((sum, request) => sum + request.requestedHeadcount, 0),
            offDutyPeople: offDutyRequests.reduce((sum, request) => sum + request.offDutyWorkerIds.length, 0),
        };
    }, [offDutyRequests, siteRequests]);
    const monthlyRequestSummary = useMemo(() => {
        return {
            siteCount: new Set(monthlySiteRequests.map((request) => `${request.date}:${request.siteId}`)).size,
            requestedPeople: monthlySiteRequests.reduce((sum, request) => sum + request.requestedHeadcount, 0),
            offDutyPeople: monthlyOffDutyRequests.reduce((sum, request) => sum + request.offDutyWorkerIds.length, 0),
        };
    }, [monthlyOffDutyRequests, monthlySiteRequests]);
    const monthlySiteRequestsByDate = useMemo(() => {
        const next = new Map<string, FieldScheduleRequest[]>();
        monthlySiteRequests.forEach((request) => {
            const rows = next.get(request.date) || [];
            rows.push(request);
            next.set(request.date, rows);
        });
        return next;
    }, [monthlySiteRequests]);
    const monthlyOffDutyRequestByDate = useMemo(
        () => new Map(monthlyOffDutyRequests.map((request) => [request.date, request])),
        [monthlyOffDutyRequests]
    );
    const requestedDateSet = useMemo(
        () => new Set(activeRequests.map((request) => request.date)),
        [activeRequests]
    );
    const calendarDates = useMemo(() => getCalendarDates(calendarMonth), [calendarMonth]);
    const canMovePrevMonth = useMemo(() => getMonthEnd(shiftMonth(calendarMonth, -1)) >= requestStartDate, [calendarMonth, requestStartDate]);
    const canMoveNextMonth = useMemo(() => shiftMonth(calendarMonth, 1) <= requestEndDate, [calendarMonth, requestEndDate]);

    const loadRequests = useCallback(async (from = requestStartDate, to = requestEndDate) => {
        const rangeRows = await fieldScheduleRequestService.listByDateRange(from, to);
        const needsSelectedDateRows = selectedDateAllowed && (selectedDate < from || selectedDate > to);
        const selectedDateRows = needsSelectedDateRows
            ? await fieldScheduleRequestService.listByDate(selectedDate)
            : [];
        const rowsById = new Map<string, FieldScheduleRequest>();
        [...rangeRows, ...selectedDateRows].forEach((request) => {
            rowsById.set(request.id || `${request.date}:${request.siteId}`, request);
        });
        setRequests(Array.from(rowsById.values()).sort((left, right) =>
            left.date.localeCompare(right.date) || left.siteName.localeCompare(right.siteName, 'ko')
        ));
    }, [requestEndDate, requestStartDate, selectedDate, selectedDateAllowed]);

    const loadData = useCallback(async () => {
        setLoading(true);
        setMessage('');
        try {
            const [siteRows, workerRows, teamRows, viewerUser, linkedOfficeStaff] = await Promise.all([
                siteService.getSites(),
                manpowerService.getWorkers(),
                teamService.getTeams(),
                currentUser?.uid ? userService.getUser(currentUser.uid) : Promise.resolve(null),
                currentUser?.uid ? officeStaffService.getOfficeStaffByUid(currentUser.uid).catch(() => null) : Promise.resolve(null),
            ]);
            const teamMap = new Map(teamRows.map((team) => [team.id || '', team]));
            const nextScope = isOfficeStaffViewer(viewerUser, linkedOfficeStaff)
                ? OFFICE_SITE_TEAM_SCOPE
                : buildSiteTeamScope(findViewerWorker(currentUser?.uid, workerRows, viewerUser), teamMap, teamRows);
            setSites(siteRows);
            setWorkers(workerRows);
            setTeams(teamRows);
            setSiteTeamScope(nextScope);
            const nextSupportSiteIds = new Set(siteRows.filter((site) => isExternalSupportSite(site, teamMap, teamRows)).map(getSiteIdentity));
            const nextSiteGroups = buildSelectableSiteGroups(siteRows, nextScope, nextSupportSiteIds);
            setSiteGroup(nextSiteGroups.myTeam.length > 0 ? 'my-team' : 'support');
            await loadRequests();
        } catch (error) {
            console.error('[FieldScheduleRequestPage] Failed to load data', error);
            setMessage('데이터를 불러오지 못했습니다.');
        } finally {
            setLoading(false);
        }
    }, [currentUser?.uid, loadRequests]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    useEffect(() => {
        if (loading) return;
        loadRequests().catch((error) => {
            console.error('[FieldScheduleRequestPage] Failed to reload requests', error);
            setMessage('요청 목록을 불러오지 못했습니다.');
        });
    }, [loading, loadRequests]);

    useEffect(() => {
        setOffDutyWorkerIds(selectedDateOffDutyRequest?.offDutyWorkerIds || []);
    }, [selectedDateOffDutyRequest]);

    const toggleOffDutyWorker = (workerId: string) => {
        setOffDutyWorkerIds((prev) => prev.includes(workerId) ? prev.filter((id) => id !== workerId) : [...prev, workerId]);
    };

    const resetForm = () => {
        setSelectedSiteId('');
        setRequestedHeadcount(1);
        setMemo('');
        setSiteSearch('');
    };

    const selectCalendarDate = (date: string) => {
        if (date < requestStartDate || date > requestEndDate) {
            setMessage(`${formatDate(requestStartDate)}부터 ${formatDate(requestEndDate)}까지 등록할 수 있습니다.`);
            return;
        }
        setSelectedDate(date);
    };

    const applyRequestToForm = (request: FieldScheduleRequest) => {
        setActiveTab('register');
        setSelectedDate(request.date);
        setCalendarMonth(getMonthStart(request.date));
        const requestSite = sites.find((site) => site.id === request.siteId || site.name === request.siteName);
        if (requestSite && siteTeamScope.allSiteAccess) {
            setSiteGroup(supportSiteIds.has(getSiteIdentity(requestSite)) ? 'support' : 'my-team');
        } else if (requestSite && siteTeamScope.enabled) {
            setSiteGroup(siteMatchesTeamScope(requestSite, siteTeamScope) ? 'my-team' : 'support');
        }
        setSelectedSiteId(request.siteId);
        setRequestedHeadcount(request.requestedHeadcount || 1);
        setMemo(request.memo || '');
        setMessage(`${request.siteName} 요청을 불러왔습니다.`);
    };

    const handleSave = async () => {
        if (!selectedSite) {
            setMessage('현장을 선택해주세요.');
            return;
        }
        if (requestedHeadcount < 0) {
            setMessage('요청 인원은 0명 이상이어야 합니다.');
            return;
        }
        if (!selectedDateAllowed) {
            setMessage(`${formatDate(requestStartDate)}부터 ${formatDate(requestEndDate)}까지 등록할 수 있습니다.`);
            return;
        }

        setSaving(true);
        setMessage('');
        try {
            const siteTeam = selectedSite.responsibleTeamId ? teamsById.get(selectedSite.responsibleTeamId) : undefined;
            const requestedByName = currentUser?.displayName || currentUser?.email || currentUser?.uid || '';
            await fieldScheduleRequestService.upsertRequest({
                date: selectedDate,
                siteId: selectedSite.id || selectedSite.name,
                siteName: selectedSite.name,
                siteAddress: selectedSite.address || '',
                siteColor: selectedSite.color || getTeamColor(siteTeam),
                responsibleTeamId: selectedSite.responsibleTeamId || '',
                responsibleTeamName: selectedSite.responsibleTeamName || '',
                siteManagerId: selectedSite.siteManagerId || '',
                siteManagerName: selectedSite.siteManagerName || '',
                requestedHeadcount,
                requestedRoles: [],
                offDutyWorkerIds: [],
                offDutyWorkerNames: [],
                memo,
                priority: 'normal',
                requestedById: currentUser?.uid || '',
                requestedByName,
                status: 'requested',
            });
            await loadRequests();
            setMessage(`${formatDate(selectedDate)} 요청을 저장했습니다.`);
        } catch (error) {
            console.error('[FieldScheduleRequestPage] Failed to save request', error);
            setMessage('요청 저장에 실패했습니다.');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveOffDuty = async () => {
        if (!selectedDateAllowed) {
            setMessage(`${formatDate(requestStartDate)}부터 ${formatDate(requestEndDate)}까지 등록할 수 있습니다.`);
            return;
        }

        setSaving(true);
        setMessage('');
        try {
            if (offDutyWorkerIds.length === 0) {
                if (selectedDateOffDutyRequest?.id) {
                    await fieldScheduleRequestService.deleteRequest(selectedDateOffDutyRequest.id);
                    await loadRequests();
                }
                setMessage(`${formatDate(selectedDate)} 휴무자를 비웠습니다.`);
                return;
            }

            const requestedByName = currentUser?.displayName || currentUser?.email || currentUser?.uid || '';
            await fieldScheduleRequestService.upsertRequest({
                id: selectedDateOffDutyRequest?.id,
                date: selectedDate,
                siteId: FIELD_REQUEST_OFF_DUTY_SITE_ID,
                siteName: '날짜별 휴무자',
                siteAddress: '',
                siteColor: '#e11d48',
                responsibleTeamId: '',
                responsibleTeamName: '',
                siteManagerId: '',
                siteManagerName: '',
                requestedHeadcount: 0,
                requestedRoles: [],
                offDutyWorkerIds,
                offDutyWorkerNames: selectedOffDutyWorkers.map((worker) => worker.name),
                memo: selectedDateOffDutyRequest?.memo || '',
                priority: 'normal',
                requestedById: currentUser?.uid || '',
                requestedByName,
                status: 'requested',
            });
            await loadRequests();
            setMessage(`${formatDate(selectedDate)} 휴무자 ${offDutyWorkerIds.length}명을 저장했습니다.`);
        } catch (error) {
            console.error('[FieldScheduleRequestPage] Failed to save off-duty request', error);
            setMessage('휴무자 저장에 실패했습니다.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (request: FieldScheduleRequest) => {
        if (!request.id) return;
        const ok = window.confirm(`${formatDate(request.date)} ${request.siteName} 요청을 삭제할까요?`);
        if (!ok) return;

        try {
            await fieldScheduleRequestService.deleteRequest(request.id);
            await loadRequests();
            setMessage('요청을 삭제했습니다.');
        } catch (error) {
            console.error('[FieldScheduleRequestPage] Failed to delete request', error);
            setMessage('요청 삭제에 실패했습니다.');
        }
    };

    const handleRemoveOffDutyWorker = async (request: FieldScheduleRequest, workerId: string | undefined, workerName: string) => {
        if (!workerId) return;
        const ok = window.confirm(`${formatFullDate(request.date)} ${workerName} 휴무를 취소할까요?`);
        if (!ok) return;

        setSaving(true);
        setMessage('');
        try {
            await fieldScheduleRequestService.removeOffDutyWorker({
                date: request.date,
                workerId,
                workerName,
            });
            await loadRequests();
            if (request.date === selectedDate) {
                setOffDutyWorkerIds((prev) => prev.filter((id) => id !== workerId));
            }
            setMessage(`${formatDate(request.date)} ${workerName} 휴무를 취소했습니다.`);
        } catch (error) {
            console.error('[FieldScheduleRequestPage] Failed to remove off-duty worker', error);
            setMessage('휴무자 취소에 실패했습니다.');
        } finally {
            setSaving(false);
        }
    };

    const handleCopyPreviousDay = async () => {
        const previousDate = shiftDate(selectedDate, -1);
        setSaving(true);
        setMessage('');
        try {
            const previousRows = await fieldScheduleRequestService.listByDate(previousDate);
            if (previousRows.length === 0) {
                setMessage(`${formatDate(previousDate)} 요청이 없습니다.`);
                return;
            }
            await Promise.all(previousRows.map((request) => {
                const offDutyOnly = isOffDutyOnlyFieldScheduleRequest(request);
                return fieldScheduleRequestService.upsertRequest({
                    ...request,
                    id: undefined,
                    date: selectedDate,
                    offDutyWorkerIds: offDutyOnly ? request.offDutyWorkerIds : [],
                    offDutyWorkerNames: offDutyOnly ? request.offDutyWorkerNames : [],
                    status: 'requested',
                    requestedById: currentUser?.uid || request.requestedById || '',
                    requestedByName: currentUser?.displayName || currentUser?.email || request.requestedByName || '',
                });
            }));
            await loadRequests();
            setMessage(`${formatDate(previousDate)} 요청 ${previousRows.length}건을 복사했습니다.`);
        } catch (error) {
            console.error('[FieldScheduleRequestPage] Failed to copy previous requests', error);
            setMessage('전날 요청 복사에 실패했습니다.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="min-h-full bg-slate-100 text-slate-900">
            <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div>
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                            <ClipboardList size={14} />
                            현장 일정 요청
                        </div>
                        <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950">현장 인원 요청</h1>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex h-10 items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 text-sm font-black text-blue-800">
                            <CalendarDays size={16} />
                            {formatDate(selectedDate)}
                        </div>
                        <Link
                            to="/assignment/off-duty-request"
                            className="flex h-10 items-center justify-center gap-2 rounded-lg border border-rose-100 bg-rose-50 px-3 text-sm font-bold text-rose-700 hover:bg-rose-100"
                        >
                            <UserX size={16} />
                            휴무신청
                        </Link>
                        <Link
                            to="/assignment/field-schedule"
                            className="flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-950 px-3 text-sm font-bold text-white hover:bg-slate-800"
                        >
                            <UsersRound size={16} />
                            배치 보드
                        </Link>
                    </div>
                </div>
            </header>

            <div className="border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={() => setActiveTab('register')}
                        className={`flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-black transition ${
                            activeTab === 'register'
                                ? 'bg-slate-950 text-white shadow-sm'
                                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                    >
                        <Save size={16} />
                        등록
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('month-list')}
                        className={`flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-black transition ${
                            activeTab === 'month-list'
                                ? 'bg-slate-950 text-white shadow-sm'
                                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                    >
                        <ClipboardList size={16} />
                        한달 요청목록
                    </button>
                </div>
            </div>

            {activeTab === 'register' ? (
            <main className="grid min-h-[calc(100vh-202px)] grid-cols-1 gap-4 p-4 lg:grid-cols-[390px_minmax(0,1fr)]">
                <aside className="flex min-h-0 flex-col rounded-lg border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-200 p-4">
                        <div className="mb-2 flex items-center justify-between">
                            <div className="text-xs font-black text-slate-500">등록 날짜</div>
                            <div className="text-[11px] font-bold text-slate-400">30일 선택 가능</div>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white p-3">
                            <div className="mb-3 flex items-center justify-between gap-2">
                                <button
                                    type="button"
                                    onClick={() => setCalendarMonth((prev) => shiftMonth(prev, -1))}
                                    disabled={!canMovePrevMonth}
                                    aria-label="이전 달"
                                    className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                <div className="text-sm font-black text-slate-900">{formatMonthTitle(calendarMonth)}</div>
                                <button
                                    type="button"
                                    onClick={() => setCalendarMonth((prev) => shiftMonth(prev, 1))}
                                    disabled={!canMoveNextMonth}
                                    aria-label="다음 달"
                                    className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                                >
                                    <ChevronRight size={16} />
                                </button>
                            </div>

                            <div className="grid grid-cols-7 gap-1 text-center">
                                {WEEKDAY_LABELS.map((weekday, index) => (
                                    <div
                                        key={weekday}
                                        className={`py-1 text-[11px] font-black ${
                                            index === 0 ? 'text-rose-500' : index === 6 ? 'text-blue-500' : 'text-slate-400'
                                        }`}
                                    >
                                        {weekday}
                                    </div>
                                ))}
                                {calendarDates.map((date) => {
                                    const selected = date === selectedDate;
                                    const alreadyRequested = requestedDateSet.has(date);
                                    const weekday = getWeekday(date);
                                    const inCurrentMonth = date.startsWith(calendarMonth.slice(0, 7));
                                    const disabledDate = date < requestStartDate || date > requestEndDate;
                                    const dateToneClass = selected
                                        ? 'bg-slate-900 text-white shadow-sm'
                                        : disabledDate
                                            ? 'bg-slate-50 text-slate-300'
                                            : alreadyRequested
                                                ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-100'
                                                : weekday === 0
                                                    ? 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                                                    : weekday === 6
                                                        ? 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                                                        : 'bg-white text-slate-700 hover:bg-slate-100';

                                    return (
                                        <button
                                            key={date}
                                            type="button"
                                            onClick={() => selectCalendarDate(date)}
                                            disabled={disabledDate}
                                            aria-pressed={selected}
                                            aria-label={`${formatFullDate(date)}${alreadyRequested ? ' 등록됨' : ''}`}
                                            className={`relative flex aspect-square min-h-10 flex-col items-center justify-center rounded-md border text-xs font-black transition ${dateToneClass} ${
                                                selected ? 'border-slate-900' : 'border-slate-100'
                                            } ${inCurrentMonth ? '' : 'opacity-60'}`}
                                        >
                                            <span>{Number(date.slice(8, 10))}</span>
                                            {alreadyRequested ? (
                                                <span className={`mt-0.5 h-1.5 w-1.5 rounded-full ${selected ? 'bg-white' : 'bg-rose-500'}`} />
                                            ) : null}
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-bold text-slate-500">
                                <span className="inline-flex items-center gap-1">
                                    <span className="h-2 w-2 rounded-full bg-slate-900" />
                                    선택
                                </span>
                                <span className="inline-flex items-center gap-1">
                                    <span className="h-2 w-2 rounded-full bg-rose-500" />
                                    등록됨
                                </span>
                                <span>{formatDate(requestStartDate)}부터 {formatDate(requestEndDate)}까지 신청 가능</span>
                            </div>
                        </div>

                        <div className="mt-4 grid grid-cols-3 gap-2">
                            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                <div className="text-[11px] font-black text-slate-500">현장</div>
                                <div className="mt-1 text-xl font-black text-slate-950">{requestSummary.siteCount}</div>
                            </div>
                            <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
                                <div className="text-[11px] font-black text-blue-600">요청</div>
                                <div className="mt-1 text-xl font-black text-blue-800">{requestSummary.requestedPeople}</div>
                            </div>
                            <div className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2">
                                <div className="text-[11px] font-black text-rose-600">휴무</div>
                                <div className="mt-1 text-xl font-black text-rose-800">{requestSummary.offDutyPeople}</div>
                            </div>
                        </div>

                        {message ? (
                            <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800">
                                {message}
                            </div>
                        ) : null}
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto p-4">
                        <div className="space-y-4">
                            <section>
                                <div className="mb-2 flex items-center justify-between">
                                    <label className="text-xs font-black text-slate-500">현장</label>
                                    <button
                                        type="button"
                                        onClick={resetForm}
                                        className="text-xs font-black text-slate-400 hover:text-slate-700"
                                    >
                                        초기화
                                    </button>
                                </div>
                                <div className="mb-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                                    <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px] font-bold text-slate-500">
                                        <span>{siteTeamScope.allSiteAccess ? siteTeamScope.label : `해당팀 ${siteTeamScope.label || '팀 연결 필요'}`}</span>
                                        <span>{siteGroup === 'support' ? '외부지원팀 현장 선택' : siteTeamScope.allSiteAccess ? '전체 우리팀 현장 선택' : '우리팀 현장 선택'}</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-1 rounded-md bg-slate-100 p-1">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSiteGroup('my-team');
                                                setSelectedSiteId('');
                                            }}
                                            className={`h-8 rounded-md text-xs font-black ${
                                                siteGroup === 'my-team'
                                                    ? 'bg-white text-blue-700 shadow-sm'
                                                    : 'text-slate-500 hover:bg-white'
                                            }`}
                                        >
                                            우리팀 현장 {siteGroups.myTeam.length}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSiteGroup('support');
                                                setSelectedSiteId('');
                                            }}
                                            className={`h-8 rounded-md text-xs font-black ${
                                                siteGroup === 'support'
                                                    ? 'bg-white text-emerald-700 shadow-sm'
                                                    : 'text-slate-500 hover:bg-white'
                                            }`}
                                        >
                                            외부지원팀 현장 {siteGroups.support.length}
                                        </button>
                                    </div>
                                </div>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input
                                        value={siteSearch}
                                        onChange={(event) => setSiteSearch(event.target.value)}
                                        placeholder="현장명, 주소, 담당팀 검색"
                                        className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm font-semibold outline-none focus:border-blue-400 focus:bg-white"
                                    />
                                </div>
                                <div className="mt-2 max-h-52 overflow-y-auto rounded-lg border border-slate-200">
                                    {filteredSites.map((site) => {
                                        const selected = site.id === selectedSiteId;
                                        const supportGroup = siteGroup === 'support';
                                        return (
                                            <button
                                                key={site.id || site.name}
                                                type="button"
                                                onClick={() => setSelectedSiteId(site.id || '')}
                                                className={`flex w-full items-start gap-2 border-b border-slate-100 px-3 py-2 text-left last:border-b-0 ${
                                                    supportGroup ? 'hover:bg-emerald-50' : 'hover:bg-blue-50'
                                                } ${
                                                    selected ? (supportGroup ? 'bg-emerald-50' : 'bg-blue-50') : 'bg-white'
                                                }`}
                                            >
                                                <span
                                                    className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                                                    style={{ backgroundColor: site.color || '#94a3b8' }}
                                                />
                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate text-sm font-black text-slate-900">{site.name}</span>
                                                    <span className="block truncate text-xs font-semibold text-slate-500">
                                                        {site.responsibleTeamName || '담당팀 미지정'} · {site.address || '주소 없음'}
                                                    </span>
                                                </span>
                                        <span className={`mt-1 shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                                                    supportGroup ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                                                }`}>
                                                    {supportGroup ? '외부지원' : '우리'}
                                                </span>
                                                {selected ? <Check size={16} className={`mt-1 ${supportGroup ? 'text-emerald-600' : 'text-blue-600'}`} /> : null}
                                            </button>
                                        );
                                    })}
                                    {filteredSites.length === 0 ? (
                                        <div className="px-3 py-6 text-center text-xs font-bold text-slate-400">
                                            {siteGroup === 'support' ? '외부지원팀 현장 없음' : '우리팀 현장 없음'}
                                        </div>
                                    ) : null}
                                </div>
                            </section>

                            <section>
                                <label>
                                    <span className="mb-2 block text-xs font-black text-slate-500">요청 인원</span>
                                    <input
                                        type="number"
                                        min="0"
                                        value={requestedHeadcount}
                                        onChange={(event) => setRequestedHeadcount(Math.max(0, Number(event.target.value) || 0))}
                                        className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-right text-lg font-black text-slate-950 outline-none focus:border-blue-400 focus:bg-white"
                                    />
                                </label>
                            </section>

                            <section>
                                <div className="mb-2 text-xs font-black text-slate-500">요청사항</div>
                                <textarea
                                    value={memo}
                                    onChange={(event) => setMemo(event.target.value)}
                                    placeholder="집결 시간, 작업 내용, 특이사항"
                                    className="min-h-[92px] w-full resize-y rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-blue-400 focus:bg-white"
                                />
                                <button
                                    type="button"
                                    onClick={handleSave}
                                    disabled={saving || loading || !selectedSite || !selectedDateAllowed}
                                    className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-black text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                                >
                                    <Save size={16} />
                                    {saving ? '저장 중' : '현장 요청 저장'}
                                </button>
                            </section>

                            <section className="rounded-lg border border-rose-100 bg-rose-50/70 p-3">
                                <div className="mb-2 flex items-start justify-between gap-2">
                                    <div>
                                        <div className="text-xs font-black text-rose-700">날짜별 휴무자</div>
                                        <div className="mt-0.5 text-[11px] font-bold text-rose-500">현장 선택과 별도로 배치 대상에서 제외됩니다.</div>
                                    </div>
                                    {offDutyWorkerIds.length > 0 ? (
                                        <button
                                            type="button"
                                            onClick={() => setOffDutyWorkerIds([])}
                                            className="shrink-0 text-xs font-black text-rose-600 hover:text-rose-700"
                                        >
                                            전체 해제
                                        </button>
                                    ) : null}
                                </div>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-rose-300" size={16} />
                                    <input
                                        value={workerSearch}
                                        onChange={(event) => setWorkerSearch(event.target.value)}
                                        placeholder="휴무자 이름, 팀 검색"
                                        className="h-10 w-full rounded-lg border border-rose-100 bg-white pl-9 pr-3 text-sm font-semibold outline-none focus:border-rose-300"
                                    />
                                </div>
                                <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-rose-100 bg-white">
                                    {filteredWorkers.map((worker) => {
                                        const selected = Boolean(worker.id && offDutyWorkerIds.includes(worker.id));
                                        const team = worker.teamId ? teamsById.get(worker.teamId) : teams.find((item) => sameText(item.name, worker.teamName));
                                        return (
                                            <button
                                                key={worker.id || worker.name}
                                                type="button"
                                                onClick={() => worker.id && toggleOffDutyWorker(worker.id)}
                                                className={`flex w-full items-center gap-2 border-b border-rose-50 px-3 py-2 text-left last:border-b-0 hover:bg-rose-50 ${
                                                    selected ? 'bg-rose-50' : 'bg-white'
                                                }`}
                                            >
                                                <span
                                                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                                                    style={{ backgroundColor: getTeamColor(team) }}
                                                />
                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate text-sm font-black text-slate-900">{worker.name}</span>
                                                    <span className="block truncate text-xs font-semibold text-slate-500">
                                                        {worker.teamName || '팀 미지정'} · {worker.role || '직무 없음'}
                                                    </span>
                                                </span>
                                                {selected ? <UserX size={16} className="text-rose-600" /> : null}
                                            </button>
                                        );
                                    })}
                                    {filteredWorkers.length === 0 ? (
                                        <div className="px-3 py-6 text-center text-xs font-bold text-slate-400">인원 없음</div>
                                    ) : null}
                                </div>
                                <button
                                    type="button"
                                    onClick={handleSaveOffDuty}
                                    disabled={saving || loading || !selectedDateAllowed}
                                    className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-rose-600 px-3 text-sm font-black text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                                >
                                    <UserX size={16} />
                                    휴무자 저장
                                    {offDutyWorkerIds.length > 0 ? ` ${offDutyWorkerIds.length}명` : ''}
                                </button>
                            </section>
                        </div>
                    </div>

                    <div className="border-t border-slate-200 p-4">
                        <button
                            type="button"
                            onClick={handleCopyPreviousDay}
                            disabled={saving || loading}
                            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                            title="선택 날짜 전날 요청 복사"
                        >
                            <Copy size={16} />
                            전날 요청 복사
                        </button>
                    </div>
                </aside>

                <section className="flex min-h-0 flex-col rounded-lg border border-slate-200 bg-white shadow-sm">
                    <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <div className="flex items-center gap-2 text-xs font-black text-slate-500">
                                <CalendarDays size={14} />
                                {requestListDateLabel}
                            </div>
                            <h2 className="mt-1 text-lg font-black text-slate-950">요청 목록</h2>
                        </div>
                        <button
                            type="button"
                            onClick={loadData}
                            disabled={loading}
                            className="flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:text-slate-300"
                        >
                            <RefreshCw size={16} />
                            새로고침
                        </button>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto p-4">
                        {loading ? (
                            <div className="grid h-full min-h-[300px] place-items-center text-sm font-bold text-slate-400">
                                불러오는 중
                            </div>
                        ) : siteRequests.length === 0 && offDutyRequests.length === 0 ? (
                            <div className="grid h-full min-h-[300px] place-items-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm font-bold text-slate-400">
                                요청 없음
                            </div>
                        ) : (
                            <>
                                {offDutyRequests.length > 0 ? (
                                    <div className="mb-4 rounded-lg border border-rose-100 bg-rose-50 px-4 py-3">
                                        <div className="mb-2 flex items-center gap-2 text-sm font-black text-rose-800">
                                            <UserX size={16} />
                                            날짜별 휴무자
                                        </div>
                                        <div className="grid gap-2 lg:grid-cols-2">
                                            {offDutyRequests.map((request) => (
                                                <div key={request.id || `${request.date}:off-duty`} className="rounded-md bg-white px-3 py-2 ring-1 ring-rose-100">
                                                    <div className="mb-1 text-xs font-black text-rose-700">{formatDate(request.date)}</div>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {request.offDutyWorkerNames.map((name, index) => {
                                                            const workerId = request.offDutyWorkerIds[index];
                                                            return (
                                                                <button
                                                                    key={`${request.id}:${workerId || name}`}
                                                                    type="button"
                                                                    onClick={() => handleRemoveOffDutyWorker(request, workerId, name)}
                                                                    disabled={saving || !workerId}
                                                                    className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-1 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:text-rose-300"
                                                                    title="휴무 취소"
                                                                >
                                                                    {name}
                                                                    <XCircle size={12} />
                                                                    <span className="text-[10px] text-rose-500">취소</span>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                    {request.memo ? (
                                                        <div className="mt-2 whitespace-pre-line rounded-md bg-rose-50 px-2 py-1.5 text-xs font-semibold leading-5 text-rose-700">
                                                            {request.memo}
                                                        </div>
                                                    ) : null}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : null}

                                {siteRequests.length === 0 ? (
                                    <div className="grid min-h-[220px] place-items-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm font-bold text-slate-400">
                                        현장 인원 요청 없음
                                    </div>
                                ) : (
                                    <div className="grid gap-3 xl:grid-cols-2 2xl:grid-cols-3">
                                {siteRequests.map((request) => {
                                    const shortageBase = request.requestedHeadcount;
                                    return (
                                        <article
                                            key={request.id || `${request.date}:${request.siteId}`}
                                            className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <div className="mb-1 flex flex-wrap items-center gap-1.5">
                                                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-black text-slate-600">
                                                            {formatDate(request.date)}
                                                        </span>
                                                    </div>
                                                    <h3 className="truncate text-base font-black text-slate-950">{request.siteName}</h3>
                                                    <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs font-semibold text-slate-500">
                                                        <MapPin size={13} />
                                                        <span className="truncate">{request.siteAddress || '주소 없음'}</span>
                                                    </div>
                                                </div>
                                                <div className="shrink-0 rounded-lg bg-blue-50 px-3 py-2 text-center">
                                                    <div className="text-[11px] font-black text-blue-600">요청</div>
                                                    <div className="text-xl font-black text-blue-800">{shortageBase}</div>
                                                </div>
                                            </div>

                                            {request.memo ? (
                                                <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                                                    {request.memo}
                                                </div>
                                            ) : null}

                                            <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                                                <span className="truncate text-xs font-bold text-slate-400">
                                                    {request.requestedByName || '요청자 미지정'}
                                                </span>
                                                <div className="flex gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => applyRequestToForm(request)}
                                                        className="h-8 rounded-md px-2 text-xs font-black text-blue-700 hover:bg-blue-50"
                                                    >
                                                        수정
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDelete(request)}
                                                        className="flex h-8 items-center gap-1 rounded-md px-2 text-xs font-black text-rose-600 hover:bg-rose-50"
                                                    >
                                                        <Trash2 size={13} />
                                                        삭제
                                                    </button>
                                                </div>
                                            </div>
                                        </article>
                                    );
                                })}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </section>
            </main>
            ) : (
                <main className="min-h-[calc(100vh-202px)] p-4">
                    <section className="flex min-h-[calc(100vh-234px)] flex-col rounded-lg border border-slate-200 bg-white shadow-sm">
                        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 xl:flex-row xl:items-center xl:justify-between">
                            <div>
                                <div className="flex items-center gap-2 text-xs font-black text-slate-500">
                                    <CalendarDays size={14} />
                                    {formatDate(requestStartDate)}부터 {formatDate(requestEndDate)}까지
                                </div>
                                <h2 className="mt-1 text-lg font-black text-slate-950">한달 요청목록</h2>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <div className="flex h-10 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-black text-slate-700">
                                    현장 {monthlyRequestSummary.siteCount}건
                                </div>
                                <div className="flex h-10 items-center rounded-lg border border-blue-100 bg-blue-50 px-3 text-sm font-black text-blue-700">
                                    요청 {monthlyRequestSummary.requestedPeople}명
                                </div>
                                <div className="flex h-10 items-center rounded-lg border border-rose-100 bg-rose-50 px-3 text-sm font-black text-rose-700">
                                    휴무 {monthlyRequestSummary.offDutyPeople}명
                                </div>
                                <button
                                    type="button"
                                    onClick={loadData}
                                    disabled={loading}
                                    className="flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:text-slate-300"
                                >
                                    <RefreshCw size={16} />
                                    새로고침
                                </button>
                            </div>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto p-4">
                            {loading ? (
                                <div className="grid h-full min-h-[300px] place-items-center text-sm font-bold text-slate-400">
                                    불러오는 중
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <div className="min-w-[980px]">
                                        <div className="mb-3 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-2">
                                            <button
                                                type="button"
                                                onClick={() => setCalendarMonth((prev) => shiftMonth(prev, -1))}
                                                disabled={!canMovePrevMonth}
                                                aria-label="이전 달"
                                                className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                                            >
                                                <ChevronLeft size={16} />
                                            </button>
                                            <div className="text-sm font-black text-slate-950">{formatMonthTitle(calendarMonth)}</div>
                                            <button
                                                type="button"
                                                onClick={() => setCalendarMonth((prev) => shiftMonth(prev, 1))}
                                                disabled={!canMoveNextMonth}
                                                aria-label="다음 달"
                                                className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                                            >
                                                <ChevronRight size={16} />
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-7 gap-1 text-center">
                                            {WEEKDAY_LABELS.map((weekday, index) => (
                                                <div
                                                    key={weekday}
                                                    className={`rounded-md bg-slate-100 py-2 text-[11px] font-black ${
                                                        index === 0 ? 'text-rose-500' : index === 6 ? 'text-blue-500' : 'text-slate-500'
                                                    }`}
                                                >
                                                    {weekday}
                                                </div>
                                            ))}
                                        </div>

                                        <div className="mt-1 grid grid-cols-7 gap-1">
                                            {calendarDates.map((date) => {
                                                const siteRows = monthlySiteRequestsByDate.get(date) || [];
                                                const offDutyRow = monthlyOffDutyRequestByDate.get(date);
                                                const inCurrentMonth = date.startsWith(calendarMonth.slice(0, 7));
                                                const disabledDate = date < requestStartDate || date > requestEndDate;
                                                const weekday = getWeekday(date);
                                                const hasRows = siteRows.length > 0 || Boolean(offDutyRow);
                                                return (
                                                    <div
                                                        key={date}
                                                        className={`min-h-[148px] rounded-lg border p-2 ${
                                                            disabledDate
                                                                ? 'border-slate-100 bg-slate-50 text-slate-300'
                                                                : hasRows
                                                                    ? 'border-slate-200 bg-white'
                                                                    : 'border-slate-100 bg-white'
                                                        } ${inCurrentMonth ? '' : 'opacity-60'}`}
                                                    >
                                                        <div className="mb-2 flex items-center justify-between">
                                                            <button
                                                                type="button"
                                                                onClick={() => !disabledDate && selectCalendarDate(date)}
                                                                disabled={disabledDate}
                                                                className={`flex h-7 w-7 items-center justify-center rounded-md text-xs font-black ${
                                                                    date === selectedDate
                                                                        ? 'bg-slate-900 text-white'
                                                                        : weekday === 0
                                                                            ? 'text-rose-600 hover:bg-rose-50'
                                                                            : weekday === 6
                                                                                ? 'text-blue-600 hover:bg-blue-50'
                                                                                : 'text-slate-700 hover:bg-slate-100'
                                                                } disabled:text-slate-300`}
                                                            >
                                                                {Number(date.slice(8, 10))}
                                                            </button>
                                                            {hasRows ? (
                                                                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-black text-slate-500">
                                                                    {siteRows.length + (offDutyRow ? 1 : 0)}건
                                                                </span>
                                                            ) : null}
                                                        </div>

                                                        {disabledDate ? null : hasRows ? (
                                                            <div className="space-y-1.5">
                                                                {siteRows.map((request) => (
                                                                    <div key={request.id || `${request.date}:${request.siteId}`} className="rounded-md border border-blue-100 bg-blue-50 px-2 py-1.5">
                                                                        <div className="flex items-start gap-1.5">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => applyRequestToForm(request)}
                                                                                className="min-w-0 flex-1 text-left"
                                                                            >
                                                                                <span className="block truncate text-[11px] font-black text-blue-900">{request.siteName}</span>
                                                                                <span className="block truncate text-[10px] font-bold text-blue-600">요청 {request.requestedHeadcount}명</span>
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleDelete(request)}
                                                                                className="shrink-0 rounded p-1 text-rose-600 hover:bg-white"
                                                                                title="삭제"
                                                                            >
                                                                                <Trash2 size={12} />
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                ))}

                                                                {offDutyRow ? (
                                                                    <div className="rounded-md border border-rose-100 bg-rose-50 px-2 py-1.5">
                                                                        <div className="mb-1 flex items-center gap-1 text-[11px] font-black text-rose-700">
                                                                            <UserX size={12} />
                                                                            휴무 {offDutyRow.offDutyWorkerIds.length}명
                                                                        </div>
                                                                        <div className="flex flex-wrap gap-1">
                                                                            {offDutyRow.offDutyWorkerNames.map((name, index) => {
                                                                                const workerId = offDutyRow.offDutyWorkerIds[index];
                                                                                return (
                                                                                    <button
                                                                                        key={`${offDutyRow.id}:${workerId || name}`}
                                                                                        type="button"
                                                                                        onClick={() => handleRemoveOffDutyWorker(offDutyRow, workerId, name)}
                                                                                        disabled={saving || !workerId}
                                                                                        className="inline-flex items-center gap-1 rounded bg-white px-1.5 py-0.5 text-[10px] font-bold text-rose-700 ring-1 ring-rose-100 hover:bg-rose-100 disabled:cursor-not-allowed disabled:text-rose-300"
                                                                                        title="휴무 취소"
                                                                                    >
                                                                                        {name}
                                                                                        <XCircle size={10} />
                                                                                        취소
                                                                                    </button>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                ) : null}
                                                            </div>
                                                        ) : (
                                                            <div className="mt-8 text-center text-[11px] font-bold text-slate-300">요청 없음</div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>
                </main>
            )}
        </div>
    );
}
