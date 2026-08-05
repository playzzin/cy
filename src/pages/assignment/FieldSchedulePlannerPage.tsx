import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    DndContext,
    DragEndEvent,
    DragOverlay,
    DragStartEvent,
    KeyboardSensor,
    PointerSensor,
    closestCenter,
    useDraggable,
    useDroppable,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import html2canvas from 'html2canvas';
import {
    AlertTriangle,
    CalendarDays,
    Check,
    ChevronLeft,
    ChevronRight,
    ClipboardCopy,
    ClipboardPaste,
    Eye,
    GripVertical,
    MapPin,
    MessageCircle,
    Plus,
    RefreshCw,
    Save,
    Search,
    Trash2,
    Truck,
    Upload,
    UserPlus,
    UserX,
    UsersRound,
    X,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { dispatchService, DispatchAssignment } from '../../services/dispatchService';
import { fieldScheduleRequestService, FieldScheduleRequest, isOffDutyOnlyFieldScheduleRequest } from '../../services/fieldScheduleRequestService';
import { scheduleConfirmationBoardService } from '../../services/scheduleConfirmationBoardService';
import { dailyReportService, DailyReport } from '../../services/dailyReportService';
import { AnalyzedDailyReport, geminiService, KakaoAnalyzeContext } from '../../services/geminiService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { siteService, Site } from '../../services/siteService';
import { teamService, Team } from '../../services/teamService';
import { companyService, Company } from '../../services/companyService';
import { vehicleService } from '../../services/vehicleService';
import type { UserData } from '../../services/userService';
import { useAuth } from '../../contexts/AuthContext';
import {
    useWorkerAccessScope,
    workerAccessMatchesSchedule,
    workerAccessMatchesSite,
    workerAccessMatchesTeam,
    workerAccessMatchesWorker,
} from '../../hooks/useWorkerAccessScope';
import { Vehicle } from '../../types/vehicle';
import {
    applyDailyReportSiteSnapshotToReport,
    buildDailyReportSiteSnapshot,
    DailyReportSiteSnapshot,
} from '../../utils/dailyReportSiteSnapshot';
import { getOpenSites } from '../../utils/siteStatus';

type ScheduleStatus = 'draft' | 'confirmed' | 'working' | 'done';
type DragKind = 'team' | 'worker' | 'vehicle' | 'site' | 'schedule';
type LeftPanelTab = 'sites' | 'teams' | 'support' | 'vehicles';
type RosterKind = 'team' | 'support' | 'unassigned';
type PlannerMode = 'dispatch' | 'daily-report' | 'schedule-confirmation';

interface FieldSchedulePlannerPageProps {
    mode?: PlannerMode;
}

interface ScheduleItem {
    id: string;
    date: string;
    teamId: string;
    teamName: string;
    teamColor: string;
    siteId: string;
    siteName: string;
    siteAddress: string;
    siteColor: string;
    clientCompanyName?: string;
    constructorCompanyName?: string;
    partnerName?: string;
    siteType?: string;
    paymentType?: string;
    responsibleTeamId?: string;
    responsibleTeamName?: string;
    siteManagerId?: string;
    siteManagerName?: string;
    workerIds: string[];
    supportTeams: ScheduleSupportTeam[];
    vehicleIds: string[];
    vehicleLabels: string[];
    vehicleTeamColors?: Record<string, string>;
    vehicleId: string;
    vehicleLabel: string;
    status: ScheduleStatus;
    memo: string;
    workerManDays?: Record<string, number>;
    workerUnitPrices?: Record<string, number>;
    workerPayTypes?: Record<string, string>;
    workerWorkContents?: Record<string, string>;
    workerTeamIds?: Record<string, string>;
    workerTeamNames?: Record<string, string>;
    requestId?: string;
    requestedHeadcount?: number;
    requestedRoles?: string[];
    requestMemo?: string;
    requestPriority?: 'normal' | 'urgent';
    requestStatus?: string;
    offDutyWorkerIds?: string[];
    offDutyWorkerNames?: string[];
}

interface ScheduleSupportTeam {
    id: string;
    name: string;
    color: string;
    role?: string;
    manDay?: number;
    unitPrice?: number;
    payType?: string;
    workContent?: string;
    workerId?: string;
}

interface ScheduleClipboard {
    sourceDate: string;
    assignments: DispatchAssignment[];
}

interface TeamRoster {
    id: string;
    name: string;
    color: string;
    kind: RosterKind;
    leaderName?: string;
    sourceLabel?: string;
    workers: Worker[];
}

interface DragPayload {
    kind: DragKind;
    id: string;
    label: string;
    sourceScheduleId?: string;
    sourceRosterId?: string;
    sourceRosterName?: string;
}

interface ViewerTeamScope {
    enabled: boolean;
    teamIds: string[];
    teamNames: string[];
    teamNameKeys: string[];
    label: string;
}

const UNASSIGNED_TEAM_ID = 'unassigned';
const EMPTY_VIEWER_TEAM_SCOPE: ViewerTeamScope = {
    enabled: false,
    teamIds: [],
    teamNames: [],
    teamNameKeys: [],
    label: '',
};
const DEFAULT_RESOURCE_COLOR = '#64748b';
const TEMP_DRAFT_STORAGE_PREFIX = 'fieldSchedulePlannerDraft';
const DAILY_REPORT_BOARD_DRAFT_STORAGE_PREFIX = 'dailyReportBoardInputDraft';
const SCHEDULE_CONFIRMATION_BOARD_DRAFT_STORAGE_PREFIX = 'scheduleConfirmationBoardDraft';
const DAILY_PAY_TYPE_OPTIONS = ['일급제', '월급제', '용역팀', '지원팀'];
const DAILY_PAY_TYPE_SET = new Set(DAILY_PAY_TYPE_OPTIONS);
const BOARD_SITE_NAME_VISIBLE_CHARS = 13;
const BOARD_WORKER_NAME_VISIBLE_CHARS = 5;
const BOARD_SITE_NAME_MIN_CARD_WIDTH = 284;
const BOARD_WORKER_NAME_CELL_MIN_WIDTH = 76;
const BOARD_WORKERS_PER_COLUMN = 6;
const BOARD_VEHICLE_TWO_COLUMN_WORKER_THRESHOLD = 18;
const BOARD_CAPTURE_MAX_PIXELS = 18000000;
const isPersonnelBoardMode = (mode: PlannerMode) => mode === 'daily-report' || mode === 'schedule-confirmation';

const waitForDocumentFonts = async () => {
    const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
    if (fonts?.ready) {
        await fonts.ready;
    }
};

const waitForNextPaint = () =>
    new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });

const getBoardCaptureScale = (width: number, height: number) => {
    const pixelCount = Math.max(1, width * height);
    const maxScaleByPixelBudget = Math.sqrt(BOARD_CAPTURE_MAX_PIXELS / pixelCount);
    const deviceScale = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    return Math.max(1, Math.min(2, deviceScale, maxScaleByPixelBudget));
};

const downloadPngBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

const getTempDraftStorageKey = (date: string, mode: PlannerMode = 'dispatch') =>
    `${mode === 'daily-report'
        ? DAILY_REPORT_BOARD_DRAFT_STORAGE_PREFIX
        : mode === 'schedule-confirmation'
            ? SCHEDULE_CONFIRMATION_BOARD_DRAFT_STORAGE_PREFIX
            : TEMP_DRAFT_STORAGE_PREFIX}:${date}`;

const getTodayInputValue = () => {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
};

const DATE_INPUT_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const normalizeDateInputParam = (value?: string | null): string | null => {
    const trimmed = String(value ?? '').trim();
    return DATE_INPUT_PATTERN.test(trimmed) ? trimmed : null;
};

const shiftDate = (date: string, amount: number) => {
    const next = new Date(`${date}T00:00:00`);
    next.setDate(next.getDate() + amount);
    const local = new Date(next.getTime() - next.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
};

const formatDisplayDate = (date: string) =>
    new Date(`${date}T00:00:00`).toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        weekday: 'short',
    });

const makeScheduleId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `field_schedule_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

const cloneDispatchAssignments = (assignments: DispatchAssignment[]): DispatchAssignment[] =>
    assignments.map((assignment) => ({
        ...assignment,
        workerIds: [...(assignment.workerIds || [])],
        supportTeamIds: assignment.supportTeamIds ? [...assignment.supportTeamIds] : undefined,
        supportTeams: assignment.supportTeams ? assignment.supportTeams.map((team) => ({ ...team })) : undefined,
        vehicleIds: [...(assignment.vehicleIds || [])],
        vehicleLabels: assignment.vehicleLabels ? [...assignment.vehicleLabels] : undefined,
    }));

const cleanIds = (ids: Array<string | undefined | null>) =>
    Array.from(new Set(ids.filter((id): id is string => Boolean(id))));

const getScheduleVehicleIds = (schedule: Partial<ScheduleItem>) =>
    cleanIds([...(schedule.vehicleIds || []), schedule.vehicleId]);

const makeSiteKey = (schedule: Pick<ScheduleItem, 'siteId' | 'siteName'>) =>
    schedule.siteId ? `id:${schedule.siteId}` : schedule.siteName.trim() ? `name:${schedule.siteName.trim()}` : '';

const getAssignedHeadcount = (schedule: Pick<ScheduleItem, 'workerIds' | 'supportTeams'>) =>
    cleanIds(schedule.workerIds || []).length + (schedule.supportTeams || []).length;

const makeSiteSelectionKey = (site: Site) =>
    makeSiteKey({ siteId: site.id || '', siteName: site.name });

const toFiniteNumber = (value: unknown, fallback = 0) => {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : fallback;
};

const toPositiveNumber = (value: unknown, fallback = 1) => {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : fallback;
};

const formatWon = (value: unknown) => {
    const amount = toFiniteNumber(value, 0);
    return amount > 0 ? `${amount.toLocaleString('ko-KR')}원` : '0원';
};

const getSiteType = (site?: Site | null, fallback?: unknown) => {
    const value = toTrimmedText(site?.siteType) || toTrimmedText(fallback);
    return value;
};

const getPaymentType = (site?: Site | null, fallback?: unknown) => {
    const value = toTrimmedText(site?.paymentMethod) || toTrimmedText(fallback);
    return value;
};

const getSupportTeamPayType = (team?: Partial<Team> | null, fallback?: unknown) => {
    const saved = normalizeSalaryType(toTrimmedText(fallback));
    if (saved) return saved;

    const teamType = normalizeSalaryType(team?.type);
    if (teamType === '지원팀') return '지원팀';
    if (teamType === '협력사' || teamType === '용역팀') return '용역팀';

    const defaultSalaryModel = normalizeSalaryType(team?.defaultSalaryModel);
    if (defaultSalaryModel) return defaultSalaryModel;

    return '지원팀';
};

const getSupportTeamUnitPrice = (team?: Partial<Team> | null, fallback?: unknown) => {
    const saved = Number(fallback);
    if (Number.isFinite(saved) && saved > 0) return saved;
    const supportRate = Number(team?.supportRate);
    if (Number.isFinite(supportRate) && supportRate > 0) return supportRate;
    const serviceRate = Number(team?.serviceRate);
    if (Number.isFinite(serviceRate) && serviceRate > 0) return serviceRate;
    return 0;
};

const mergeSupportTeams = (supportTeams: ScheduleSupportTeam[]) => {
    const map = new Map<string, ScheduleSupportTeam>();
    supportTeams.forEach((team) => {
        const key = team.id || team.name;
        if (key && !map.has(key)) {
            map.set(key, team);
            return;
        }
        if (key) {
            const current = map.get(key)!;
            map.set(key, {
                ...current,
                ...team,
                manDay: toFiniteNumber(current.manDay, 0) + toFiniteNumber(team.manDay, 0),
                unitPrice: team.unitPrice ?? current.unitPrice,
                payType: team.payType || current.payType,
                workContent: [current.workContent, team.workContent].filter(Boolean).join(' / '),
            });
        }
    });
    return Array.from(map.values());
};

const mergeScheduleEntries = (base: ScheduleItem, incoming: ScheduleItem): ScheduleItem => {
    const vehicleIds = getScheduleVehicleIds({ vehicleIds: [...getScheduleVehicleIds(base), ...getScheduleVehicleIds(incoming)] });
    const vehicleLabels = vehicleIds.map((vehicleId) => {
        const baseIndex = getScheduleVehicleIds(base).indexOf(vehicleId);
        if (baseIndex >= 0) return base.vehicleLabels?.[baseIndex] || base.vehicleLabel;
        const incomingIndex = getScheduleVehicleIds(incoming).indexOf(vehicleId);
        return incoming.vehicleLabels?.[incomingIndex] || incoming.vehicleLabel;
    });
    return {
        ...base,
        teamId: base.teamId || incoming.teamId,
        teamName: base.teamName || incoming.teamName,
        teamColor: base.teamColor || incoming.teamColor,
        siteId: base.siteId || incoming.siteId,
        siteName: base.siteName || incoming.siteName,
        siteAddress: base.siteAddress || incoming.siteAddress,
        siteColor: base.siteColor || incoming.siteColor,
        clientCompanyName: base.clientCompanyName || incoming.clientCompanyName,
        constructorCompanyName: base.constructorCompanyName || incoming.constructorCompanyName,
        partnerName: base.partnerName || incoming.partnerName,
        siteType: base.siteType || incoming.siteType,
        paymentType: base.paymentType || incoming.paymentType,
        responsibleTeamId: base.responsibleTeamId || incoming.responsibleTeamId,
        responsibleTeamName: base.responsibleTeamName || incoming.responsibleTeamName,
        siteManagerId: base.siteManagerId || incoming.siteManagerId,
        siteManagerName: base.siteManagerName || incoming.siteManagerName,
        requestId: base.requestId || incoming.requestId,
        requestedHeadcount: base.requestedHeadcount ?? incoming.requestedHeadcount,
        requestedRoles: cleanIds([...(base.requestedRoles || []), ...(incoming.requestedRoles || [])]),
        requestMemo: base.requestMemo || incoming.requestMemo,
        requestPriority: base.requestPriority || incoming.requestPriority,
        requestStatus: base.requestStatus || incoming.requestStatus,
        workerIds: cleanIds([...base.workerIds, ...incoming.workerIds]),
        supportTeams: mergeSupportTeams([...(base.supportTeams || []), ...(incoming.supportTeams || [])]),
        vehicleIds,
        vehicleLabels,
        vehicleTeamColors: {
            ...(base.vehicleTeamColors || {}),
            ...(incoming.vehicleTeamColors || {}),
        },
        vehicleId: vehicleIds[0] || '',
        vehicleLabel: vehicleLabels[0] || '',
        memo: [base.memo, incoming.memo].filter(Boolean).join(' / '),
        workerManDays: {
            ...(base.workerManDays || {}),
            ...(incoming.workerManDays || {}),
        },
        workerUnitPrices: {
            ...(base.workerUnitPrices || {}),
            ...(incoming.workerUnitPrices || {}),
        },
        workerPayTypes: {
            ...(base.workerPayTypes || {}),
            ...(incoming.workerPayTypes || {}),
        },
        workerWorkContents: {
            ...(base.workerWorkContents || {}),
            ...(incoming.workerWorkContents || {}),
        },
        workerTeamIds: {
            ...(base.workerTeamIds || {}),
            ...(incoming.workerTeamIds || {}),
        },
        workerTeamNames: {
            ...(base.workerTeamNames || {}),
            ...(incoming.workerTeamNames || {}),
        },
    };
};

const mergeSchedulesBySite = (items: ScheduleItem[]) => {
    const rows: ScheduleItem[] = [];
    items.forEach((item) => {
        const key = makeSiteKey(item);
        const existingIndex = key ? rows.findIndex((row) => makeSiteKey(row) === key) : -1;
        if (existingIndex >= 0) {
            rows[existingIndex] = mergeScheduleEntries(rows[existingIndex], item);
            return;
        }
        rows.push(item);
    });
    return rows;
};

const normalizeColor = (color?: string | null) => {
    const trimmed = typeof color === 'string' ? color.trim() : '';
    if (!trimmed) return '';
    return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed) ? trimmed : '';
};

const getTeamColor = (team: Partial<Team> | undefined) => {
    return normalizeColor(team?.color) || DEFAULT_RESOURCE_COLOR;
};

const getTeamColorWithFallback = (team: Partial<Team> | undefined, fallbackColor?: string | null) => {
    return normalizeColor(team?.color) || normalizeColor(fallbackColor) || DEFAULT_RESOURCE_COLOR;
};

const getScheduleVehicleColor = (
    schedule: Partial<Pick<ScheduleItem, 'teamColor' | 'siteColor' | 'vehicleTeamColors'>>,
    vehicleId: string,
    vehicleAssignedTeamColorById: Map<string, string>
) => {
    const scheduleVehicleColor = normalizeColor(schedule.vehicleTeamColors?.[vehicleId]);
    if (scheduleVehicleColor) return scheduleVehicleColor;

    const assignedTeamColor = normalizeColor(vehicleAssignedTeamColorById.get(vehicleId));
    if (assignedTeamColor) return assignedTeamColor;

    const scheduleTeamColor = normalizeColor(schedule.teamColor);
    const siteColor = normalizeColor(schedule.siteColor);
    if (scheduleTeamColor && scheduleTeamColor !== siteColor) return scheduleTeamColor;

    return DEFAULT_RESOURCE_COLOR;
};

const normalizeComparableText = (value?: unknown) =>
    String(value ?? '')
        .replace(/\s+/g, '')
        .toLowerCase();

const sameText = (left?: unknown, right?: unknown) => {
    const normalizedLeft = normalizeComparableText(left);
    const normalizedRight = normalizeComparableText(right);
    return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight);
};

const koreanNameCollator = new Intl.Collator('ko-KR', { numeric: true, sensitivity: 'base' });

const compareKoreanName = (left?: unknown, right?: unknown) =>
    koreanNameCollator.compare(String(left ?? ''), String(right ?? ''));

const hexToRgba = (hex: string, opacity: number) => {
    const normalized = hex.replace('#', '');
    if (normalized.length !== 6) return `rgba(37, 99, 235, ${opacity})`;
    const r = parseInt(normalized.slice(0, 2), 16);
    const g = parseInt(normalized.slice(2, 4), 16);
    const b = parseInt(normalized.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

const getReadableTextColor = (hex?: string) => {
    const color = normalizeColor(hex) || DEFAULT_RESOURCE_COLOR;
    const normalized = color.replace('#', '');
    const full = normalized.length === 3
        ? normalized.split('').map((char) => `${char}${char}`).join('')
        : normalized;
    const value = parseInt(full, 16);
    if (!Number.isFinite(value)) return '#0f172a';
    const r = (value >> 16) & 255;
    const g = (value >> 8) & 255;
    const b = value & 255;
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.58 ? '#0f172a' : '#ffffff';
};

const getSolidTeamColorStyle = (color?: string, fallbackColor = DEFAULT_RESOURCE_COLOR): React.CSSProperties => {
    const backgroundColor = normalizeColor(color) || normalizeColor(fallbackColor) || DEFAULT_RESOURCE_COLOR;
    return {
        backgroundColor,
        borderColor: backgroundColor,
        color: getReadableTextColor(backgroundColor),
    };
};

const isInactiveWorker = (worker?: Worker) => {
    const status = String(worker?.status ?? '');
    return status.includes('퇴사') || status.includes('휴무') || worker?.isActive === false;
};

const isUnavailableVehicle = (vehicle?: Vehicle) =>
    vehicle?.status === 'MAINTENANCE' || vehicle?.status === 'DISPOSED';

const toTrimmedText = (value: unknown) => String(value ?? '').trim();

const formatBoardDisplayText = (value: unknown, maxLength: number) => {
    const text = toTrimmedText(value);
    if (!text || maxLength <= 0) return '';

    const characters = Array.from(text);
    if (characters.length <= maxLength) return text;

    return `${characters.slice(0, maxLength).join('')}…`;
};

const normalizeSalaryType = (value?: string | null): string => {
    const normalized = toTrimmedText(value);
    if (!normalized) return '';
    if (normalized === '일급') return '일급제';
    if (normalized === '일당') return '일급제';
    if (normalized === '월급') return '월급제';
    if (normalized === '용역') return '용역팀';
    if (normalized === '지원') return '지원팀';
    return normalized;
};

const normalizeDailyPayType = (value: unknown, fallback = ''): string => {
    const normalized = normalizeSalaryType(toTrimmedText(value));
    return DAILY_PAY_TYPE_SET.has(normalized) ? normalized : fallback;
};

const getBoardPayTypeStyle = (payType: unknown) => {
    const normalized = normalizeDailyPayType(payType, '일급제');

    if (normalized === '월급제') {
        return {
            label: '월급제',
            background: '#ffffff',
            borderColor: '#cbd5e1',
            color: '#0f172a',
            shadow: 'inset 0 0 0 1px rgba(148, 163, 184, 0.24)',
        };
    }

    if (normalized === '용역팀' || normalized === '지원팀') {
        return {
            label: normalized,
            background: '#22c55e',
            borderColor: '#15803d',
            color: '#052e16',
            shadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.32)',
        };
    }

    return {
        label: '일급제',
        background: '#facc15',
        borderColor: '#ca8a04',
        color: '#1f2937',
        shadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.32)',
    };
};

const resolveScheduleWorkerSalaryType = (worker?: Partial<Worker> | null): string => {
    if (!worker) return '일급제';
    const row = worker as Partial<Worker> & Record<string, unknown>;

    const teamType = normalizeDailyPayType(row.teamType);
    if (teamType === '지원팀') return '지원팀';
    if (teamType === '용역팀') return '용역팀';

    const payType = normalizeDailyPayType(row.payType);
    if (payType) return payType;

    const salaryModel = normalizeDailyPayType(row.salaryModel);
    if (salaryModel) return salaryModel;

    const legacyPayType =
        normalizeDailyPayType(row.salaryType) ||
        normalizeDailyPayType(row.paymentType) ||
        normalizeDailyPayType(row.wageType) ||
        normalizeDailyPayType(row.employmentType);
    if (legacyPayType) return legacyPayType;

    return teamType || '일급제';
};

const resolveReportWorkerSalaryType = (
    reportWorker?: { payType?: string | null; salaryModel?: string | null } | null,
    worker?: Partial<Worker> | null
): string => {
    const payType = normalizeDailyPayType(reportWorker?.payType);
    if (payType) return payType;

    const salaryModel = normalizeDailyPayType(reportWorker?.salaryModel);
    if (salaryModel) return salaryModel;

    return resolveScheduleWorkerSalaryType(worker);
};

const findSiteInRows = (sites: Site[], siteId?: unknown, siteName?: unknown) => {
    const normalizedSiteId = toTrimmedText(siteId);
    const normalizedSiteName = toTrimmedText(siteName);

    if (normalizedSiteId) {
        const matchedById = sites.find((site) =>
            toTrimmedText(site.id) === normalizedSiteId || toTrimmedText(site.legacyId) === normalizedSiteId
        );
        if (matchedById) return matchedById;
    }

    if (!normalizedSiteName) return undefined;
    return sites.find((site) => sameText(site.name, normalizedSiteName));
};

const findTeamInRows = (teams: Team[], teamId?: unknown, teamName?: unknown) => {
    const normalizedTeamId = toTrimmedText(teamId);
    const normalizedTeamName = toTrimmedText(teamName);

    if (normalizedTeamId) {
        const matchedById = teams.find((team) =>
            toTrimmedText(team.id) === normalizedTeamId || toTrimmedText(team.legacyId) === normalizedTeamId
        );
        if (matchedById) return matchedById;
    }

    if (!normalizedTeamName) return undefined;
    const exactMatch = teams.find((team) => sameText(team.name, normalizedTeamName));
    if (exactMatch) return exactMatch;

    const normalizedNameKey = normalizeComparableText(normalizedTeamName);
    return teams.find((team) => {
        const teamNameKey = normalizeComparableText(team.name);
        return Boolean(teamNameKey && (teamNameKey === `${normalizedNameKey}팀` || `${teamNameKey}팀` === normalizedNameKey));
    });
};

const getSiteColorFromRows = (
    site: Site | undefined,
    teams: Team[],
    teamsById: Map<string, Team>,
    fallbackColor = DEFAULT_RESOURCE_COLOR
) => {
    const responsibleTeam =
        (site?.responsibleTeamId ? teamsById.get(site.responsibleTeamId) : undefined) ||
        findTeamInRows(teams, site?.responsibleTeamId, site?.responsibleTeamName);
    const responsibleTeamColor = normalizeColor(responsibleTeam?.color);
    if (responsibleTeamColor) return responsibleTeamColor;

    const directSiteColor = normalizeColor(site?.color);
    if (directSiteColor) return directSiteColor;

    return fallbackColor;
};

const mapDailyReportsToSchedules = (
    reports: DailyReport[],
    targetDate: string,
    workersById: Map<string, Worker>,
    teamsById: Map<string, Team>,
    sites: Site[],
    teams: Team[],
    companies: Company[] = []
) => {
    const rows: ScheduleItem[] = [];

    reports.forEach((report, index) => {
        const site = findSiteInRows(sites, report.siteId, report.siteName);
        const siteSnapshot = buildDailyReportSiteSnapshot({
            site,
            siteId: report.siteId,
            siteName: report.siteName,
            teams,
            companies,
            fallback: report,
        });
        const siteId = siteSnapshot.siteId;
        const siteName = siteSnapshot.siteName;
        if (!siteId && !siteName) return;

        const reportWorkers = Array.isArray(report.workers) ? report.workers : [];
        const workerIds: string[] = [];
        const workerManDays: Record<string, number> = {};
        const workerUnitPrices: Record<string, number> = {};
        const workerPayTypes: Record<string, string> = {};
        const workerWorkContents: Record<string, string> = {};
        const workerTeamIds: Record<string, string> = {};
        const workerTeamNames: Record<string, string> = {};
        const supportTeams: ScheduleSupportTeam[] = [];

        reportWorkers.forEach((reportWorker) => {
            const workerId = toTrimmedText(reportWorker.workerId);
            const workerName = toTrimmedText(reportWorker.name);
            const worker = workersById.get(workerId) || Array.from(workersById.values()).find((row) => sameText(row.name, workerName));
            const payType = resolveReportWorkerSalaryType(reportWorker as any, worker);
            const manDay = toPositiveNumber(reportWorker.manDay, 1);
            const unitPrice = toFiniteNumber(reportWorker.unitPrice, worker?.unitPrice || 0);
            const workContent = toTrimmedText(reportWorker.workContent) || toTrimmedText(report.workContent);

            if (worker?.id && !isInactiveWorker(worker)) {
                const resolvedWorkerId = toTrimmedText(worker.id) || workerId;
                workerIds.push(resolvedWorkerId);
                workerManDays[resolvedWorkerId] = manDay;
                workerUnitPrices[resolvedWorkerId] = unitPrice;
                workerPayTypes[resolvedWorkerId] = payType;
                workerWorkContents[resolvedWorkerId] = workContent;
                workerTeamIds[resolvedWorkerId] =
                    toTrimmedText((reportWorker as any).workerTeamId) ||
                    toTrimmedText((reportWorker as any).teamId) ||
                    toTrimmedText(report.teamId) ||
                    toTrimmedText(worker.teamId);
                workerTeamNames[resolvedWorkerId] =
                    toTrimmedText((reportWorker as any).workerTeamName) ||
                    toTrimmedText(report.teamName) ||
                    toTrimmedText(worker.teamName);
                return;
            }

            const supportTeamId = toTrimmedText((reportWorker as any).teamId) || toTrimmedText(report.teamId) || workerId || `unknown_support_${index}_${supportTeams.length}`;
            const supportTeam = findTeamInRows(teams, supportTeamId, (reportWorker as any).workerTeamName || report.teamName || workerName);
            supportTeams.push({
                id: supportTeamId,
                name: toTrimmedText(supportTeam?.name) || toTrimmedText((reportWorker as any).workerTeamName) || workerName || toTrimmedText(report.teamName) || '지원팀',
                color: getTeamColor(supportTeam),
                role: toTrimmedText(reportWorker.role) || '팀',
                manDay,
                unitPrice: getSupportTeamUnitPrice(supportTeam, unitPrice),
                payType: payType || getSupportTeamPayType(supportTeam),
                workContent,
                workerId: workerId || `unknown_support_${supportTeamId}`,
            });
        });

        const cleanWorkerIds = cleanIds(workerIds);
        const cleanSupportTeams = mergeSupportTeams(supportTeams);
        if (cleanWorkerIds.length === 0 && cleanSupportTeams.length === 0) return;

        const firstWorkerTeamId = workerIds.map((workerId) => workerTeamIds[workerId] || toTrimmedText(workersById.get(workerId)?.teamId)).find(Boolean);
        const reportTeamId = toTrimmedText(report.teamId);
        const responsibleTeamId = siteSnapshot.responsibleTeamId;
        const teamId = reportTeamId || firstWorkerTeamId || responsibleTeamId || UNASSIGNED_TEAM_ID;
        const team = findTeamInRows(teams, teamId, report.teamName || siteSnapshot.responsibleTeamName);
        const teamColor = getTeamColor(team);
        const siteColor = getSiteColorFromRows(site, teams, teamsById, teamColor);

        rows.push({
            id: `${targetDate}_daily_${siteId || siteName}_${index}`,
            date: targetDate,
            teamId,
            teamName: toTrimmedText(team?.name) || toTrimmedText(report.teamName) || siteSnapshot.responsibleTeamName || '미배정',
            teamColor,
            siteId,
            siteName,
            siteAddress: toTrimmedText(site?.address),
            siteColor,
            clientCompanyName: siteSnapshot.clientCompanyName,
            constructorCompanyName: siteSnapshot.constructorCompanyName,
            partnerName: siteSnapshot.partnerName,
            siteType: siteSnapshot.siteType,
            paymentType: siteSnapshot.paymentType,
            responsibleTeamId,
            responsibleTeamName: siteSnapshot.responsibleTeamName,
            siteManagerId: siteSnapshot.siteManagerId,
            siteManagerName: siteSnapshot.siteManagerName,
            workerIds: cleanWorkerIds,
            workerManDays,
            workerUnitPrices,
            workerPayTypes,
            workerWorkContents,
            workerTeamIds,
            workerTeamNames,
            supportTeams: cleanSupportTeams,
            vehicleIds: [],
            vehicleLabels: [],
            vehicleId: '',
            vehicleLabel: '',
            status: 'confirmed',
            memo: toTrimmedText(report.workContent),
        });
    });

    return mergeSchedulesBySite(rows);
};

const scheduleToDispatchAssignment = (schedule: ScheduleItem): DispatchAssignment => ({
    id: schedule.id,
    siteId: schedule.siteId,
    siteName: schedule.siteName,
    siteAddress: schedule.siteAddress,
    teamId: schedule.teamId,
    teamName: schedule.teamName,
    teamColor: schedule.teamColor,
    siteColor: schedule.siteColor,
    siteType: schedule.siteType,
    paymentType: schedule.paymentType,
    responsibleTeamId: schedule.responsibleTeamId,
    responsibleTeamName: schedule.responsibleTeamName,
    workerIds: schedule.workerIds,
    workerManDays: schedule.workerManDays,
    workerUnitPrices: schedule.workerUnitPrices,
    workerPayTypes: schedule.workerPayTypes,
    workerWorkContents: schedule.workerWorkContents,
    workerTeamIds: schedule.workerTeamIds,
    workerTeamNames: schedule.workerTeamNames,
    supportTeams: schedule.supportTeams,
    supportTeamIds: schedule.supportTeams.map((team) => team.id),
    vehicleIds: getScheduleVehicleIds(schedule),
    vehicleId: getScheduleVehicleIds(schedule)[0] || '',
    vehicleLabel: schedule.vehicleLabels[0] || schedule.vehicleLabel,
    vehicleLabels: schedule.vehicleLabels,
    vehicleTeamColors: schedule.vehicleTeamColors,
    requestId: schedule.requestId,
    requestedHeadcount: schedule.requestedHeadcount,
    requestedRoles: schedule.requestedRoles,
    requestMemo: schedule.requestMemo,
    requestPriority: schedule.requestPriority,
    requestStatus: schedule.requestStatus,
    status: schedule.status,
    note: schedule.memo,
} as DispatchAssignment & Partial<ScheduleItem>);

const getWorkerAssignedTeam = (worker: Worker | undefined, teamsById: Map<string, Team>, teams: Team[]) => {
    if (!worker) return undefined;

    const teamId = String(worker.teamId || '');
    if (teamId) {
        const byId = teamsById.get(teamId);
        if (byId) return byId;

        const byLegacyId = teams.find((team) => String(team.legacyId || '') === teamId);
        if (byLegacyId) return byLegacyId;
    }

    return teams.find((team) => sameText(team.name, worker.teamName));
};

const parseLinkedIds = (raw: unknown): string[] => {
    if (Array.isArray(raw)) return cleanIds(raw.map((value) => toTrimmedText(value)));
    const text = toTrimmedText(raw);
    if (!text) return [];
    try {
        const parsed = JSON.parse(text);
        return Array.isArray(parsed) ? cleanIds(parsed.map((value) => toTrimmedText(value))) : [text];
    } catch {
        return [text];
    }
};




const matchesViewerTeamScope = (scope: ViewerTeamScope, teamId?: unknown, teamName?: unknown) => {
    if (!scope.enabled) return false;

    const normalizedTeamId = toTrimmedText(teamId);
    if (normalizedTeamId && scope.teamIds.includes(normalizedTeamId)) return true;

    const teamNameKey = normalizeComparableText(teamName);
    return Boolean(teamNameKey && scope.teamNameKeys.includes(teamNameKey));
};

const siteBelongsToViewerTeamScope = (site: Site | undefined, scope: ViewerTeamScope) =>
    Boolean(site && matchesViewerTeamScope(scope, site.responsibleTeamId, site.responsibleTeamName));

const hasSupportSiteMarker = (...values: unknown[]) =>
    values.some((value) => {
        const text = normalizeComparableText(value);
        return Boolean(text && (text.includes('지원') || text.includes('용역')));
    });

const siteIsSupportSite = (
    site: Site | undefined,
    teamsById: Map<string, Team>,
    teams: Team[]
) => {
    if (!site) return false;
    if (hasSupportSiteMarker(site.siteType)) return true;

    const responsibleTeam =
        (site.responsibleTeamId ? teamsById.get(site.responsibleTeamId) : undefined) ||
        findTeamInRows(teams, site.responsibleTeamId, site.responsibleTeamName);

    return hasSupportSiteMarker(
        site.responsibleTeamName,
        responsibleTeam?.name,
        responsibleTeam?.type,
        responsibleTeam?.role
    );
};

const getSiteViewerScopePriority = (
    site: Site | undefined,
    scope: ViewerTeamScope,
    teamsById: Map<string, Team>,
    teams: Team[]
) => {
    if (!scope.enabled) return 0;
    if (siteBelongsToViewerTeamScope(site, scope)) return 0;
    if (siteIsSupportSite(site, teamsById, teams)) return 1;
    return 2;
};

const getScheduleViewerScopePriority = (
    schedule: ScheduleItem,
    scope: ViewerTeamScope,
    sitesById: Map<string, Site>,
    teamsById: Map<string, Team>,
    teams: Team[]
) => {
    if (!scope.enabled) return 0;

    const scheduleSite = schedule.siteId ? sitesById.get(schedule.siteId) : undefined;
    if (
        siteBelongsToViewerTeamScope(scheduleSite, scope) ||
        matchesViewerTeamScope(scope, schedule.responsibleTeamId, schedule.responsibleTeamName)
    ) {
        return 0;
    }

    if (
        siteIsSupportSite(scheduleSite, teamsById, teams) ||
        hasSupportSiteMarker(schedule.siteType, schedule.responsibleTeamName)
    ) {
        return 1;
    }

    return 2;
};


const getVehicleAssignedTeam = (
    vehicle: Vehicle | undefined,
    teamsById: Map<string, Team>,
    teams: Team[],
    workersById?: Map<string, Worker>,
    workers: Worker[] = []
) => {
    if (!vehicle) return undefined;

    const assigneeType = String(vehicle.currentAssigneeType || '').toUpperCase();
    const assigneeId = String(vehicle.currentAssigneeId || '');
    const assigneeName = vehicle.currentAssigneeName;
    const directTeam = findTeamInRows(teams, assigneeId, assigneeName);
    const assignedWorker =
        (assigneeId ? workersById?.get(assigneeId) : undefined) ||
        (assigneeId ? workers.find((row) => String(row.legacyId || '') === assigneeId) : undefined) ||
        workers.find((row) => sameText(row.name, assigneeName));

    if (assigneeType === 'TEAM') {
        return directTeam;
    }

    if (assigneeType === 'WORKER') {
        return getWorkerAssignedTeam(assignedWorker, teamsById, teams) || directTeam;
    }

    return directTeam || getWorkerAssignedTeam(assignedWorker, teamsById, teams);
};

const getVehicleTeamColorFromRows = (
    vehicleId: string,
    vehiclesById: Map<string, Vehicle>,
    teamsById: Map<string, Team>,
    teams: Team[],
    workersById: Map<string, Worker>,
    workers: Worker[],
    fallbackColor?: string
) => {
    const assignedTeam = getVehicleAssignedTeam(vehiclesById.get(vehicleId), teamsById, teams, workersById, workers);
    return normalizeColor(assignedTeam?.color) || normalizeColor(fallbackColor);
};

const buildVehicleTeamColorsFromRows = (
    vehicleIds: string[],
    vehiclesById: Map<string, Vehicle>,
    teamsById: Map<string, Team>,
    teams: Team[],
    workersById: Map<string, Worker>,
    workers: Worker[],
    fallbackColor?: string
) =>
    Object.fromEntries(
        vehicleIds
            .map((vehicleId) => [vehicleId, getVehicleTeamColorFromRows(vehicleId, vehiclesById, teamsById, teams, workersById, workers, fallbackColor)] as const)
            .filter((entry) => Boolean(entry[1]))
    );

const includesKeyword = (keywords: string[], ...values: unknown[]) =>
    values.some((value) => {
        const text = normalizeComparableText(value);
        return Boolean(text) && keywords.some((keyword) => text.includes(normalizeComparableText(keyword)));
    });

const includesSupportKeyword = (...values: unknown[]) =>
    includesKeyword(['지원', '용역'], ...values);

const includesWorkerSupportKeyword = (...values: unknown[]) =>
    includesKeyword(['지원'], ...values);

const includesConstructionKeyword = (...values: unknown[]) =>
    includesKeyword(['시공사', '시공팀', '시공'], ...values);

const includesCheongyeonKeyword = (...values: unknown[]) =>
    includesKeyword(['청연이엔지', '청연엔지', '청연', 'cheongyeon'], ...values);

const isSupportWorker = (worker?: Worker) =>
    includesWorkerSupportKeyword(worker?.teamType, worker?.salaryModel, worker?.payType, worker?.role);

const isFieldTeamSource = (team: Team, teamWorkers: Worker[] = []) =>
    includesConstructionKeyword(team.name, team.type, team.role, team.companyName, team.parentTeamName) ||
    includesCheongyeonKeyword(team.name, team.type, team.role, team.companyName, team.parentTeamName) ||
    teamWorkers.some((worker) =>
        includesConstructionKeyword(worker.teamName, worker.teamType, worker.role, worker.companyName) ||
        includesCheongyeonKeyword(worker.teamName, worker.teamType, worker.companyName)
    );

const isSupportTeam = (team: Team, teamWorkers: Worker[]) => {
    if (isFieldTeamSource(team, teamWorkers)) return false;

    const explicitSupportTeam = includesSupportKeyword(
        team.name,
        team.type,
        team.role,
        team.companyName,
        team.parentTeamName,
        team.defaultSalaryModel,
        team.supportModel,
        team.supportDescription,
        team.serviceDescription
    );
    if (explicitSupportTeam) return true;

    return teamWorkers.length > 0 && teamWorkers.every(isSupportWorker);
};

const getWorkerSourceLabel = (worker?: Worker) => {
    if (includesConstructionKeyword(worker?.teamType, worker?.role, worker?.companyName)) return '시공사';
    if (includesCheongyeonKeyword(worker?.companyName, worker?.teamType, worker?.teamName)) return '(주)청연이엔지';
    return String(worker?.companyName || worker?.teamType || '작업자').trim();
};

const getTeamSourceLabel = (team: Team, teamWorkers: Worker[]) => {
    if (includesConstructionKeyword(team.type, team.role, team.companyName, team.name)) return '시공사';
    if (includesCheongyeonKeyword(team.companyName, team.parentTeamName, team.name, team.role)) return '(주)청연이엔지';
    if (teamWorkers.some((worker) => includesConstructionKeyword(worker.teamType, worker.role, worker.companyName))) return '시공사';
    if (teamWorkers.some((worker) => includesCheongyeonKeyword(worker.companyName, worker.teamName, worker.teamType))) {
        return '(주)청연이엔지';
    }
    return String(team.companyName || team.type || '팀').trim();
};

const workerMatchesTeam = (worker: Worker, team: Team, memberIds: Set<string>, memberNames: Set<string>) => {
    if (!worker.id) return false;
    if (worker.teamId) return Boolean(team.id && worker.teamId === team.id);
    if (memberIds.has(worker.id)) return true;
    if (memberNames.has(normalizeComparableText(worker.name))) return true;
    return sameText(worker.teamName, team.name);
};

const groupUnassignedWorkers = (workers: Worker[], kind: RosterKind, fallbackName: string, fallbackId: string): TeamRoster[] => {
    const groups = new Map<string, TeamRoster>();

    workers.forEach((worker) => {
        const existing = groups.get(fallbackId);
        if (existing) {
            existing.workers.push(worker);
            return;
        }

        groups.set(fallbackId, {
            id: fallbackId,
            name: fallbackName,
            color: normalizeColor(worker.color) || DEFAULT_RESOURCE_COLOR,
            kind,
            sourceLabel: getWorkerSourceLabel(worker),
            workers: [worker],
        });
    });

    return Array.from(groups.values()).map((group) => ({
        ...group,
        workers: [...group.workers].sort((left, right) => compareKoreanName(left.name, right.name)),
    }));
};

const compareRosterPanelOrder = (left: TeamRoster, right: TeamRoster) => {
    if (left.kind === 'unassigned' && right.kind !== 'unassigned') return 1;
    if (left.kind !== 'unassigned' && right.kind === 'unassigned') return -1;
    return compareKoreanName(left.name, right.name);
};

const moveItem = <T,>(items: T[], fromIndex: number, toIndex: number) => {
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return items;
    const next = [...items];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    return next;
};

const DraggableWorkerPill: React.FC<{
    worker: Worker;
    sourceScheduleId?: string;
    sourceRosterId?: string;
    sourceRosterName?: string;
    teamColor?: string;
    onRemove?: () => void;
    selectable?: boolean;
    selected?: boolean;
    onToggleSelect?: () => void;
}> = ({ worker, sourceScheduleId, sourceRosterId, sourceRosterName, teamColor, onRemove, selectable, selected, onToggleSelect }) => {
    const workerId = worker.id || '';
    const workerTeamColor = normalizeColor(teamColor) || normalizeColor(worker.color) || DEFAULT_RESOURCE_COLOR;
    const workerTeamTextColor = getReadableTextColor(workerTeamColor);
    const inactive = isInactiveWorker(worker);
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: sourceScheduleId ? `schedule-worker:${sourceScheduleId}:${workerId}` : `worker:${workerId}`,
        data: {
            kind: 'worker',
            id: workerId,
            label: worker.name,
            sourceScheduleId,
            sourceRosterId,
            sourceRosterName,
        } satisfies DragPayload,
        disabled: !workerId,
    });

    const style: React.CSSProperties = {
        transform: transform ? CSS.Translate.toString(transform) : undefined,
        opacity: isDragging ? 0.35 : 1,
        borderColor: inactive ? '#fecaca' : selected ? workerTeamColor : hexToRgba(workerTeamColor, 0.45),
        backgroundColor: inactive
            ? '#fef2f2'
            : selected
                ? hexToRgba(workerTeamColor, 0.14)
                : hexToRgba(workerTeamColor, 0.06),
        boxShadow: selected && !inactive ? `0 0 0 2px ${hexToRgba(workerTeamColor, 0.16)}` : undefined,
    };

    return (
        <span
            ref={setNodeRef}
            style={style}
            role={selectable ? 'button' : undefined}
            tabIndex={selectable ? 0 : undefined}
            aria-pressed={selectable ? selected : undefined}
            onClick={selectable ? onToggleSelect : undefined}
            onKeyDown={(event) => {
                if (!selectable || !onToggleSelect) return;
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onToggleSelect();
                }
            }}
            className={`inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-1 text-xs font-bold ${
                inactive ? 'text-red-700' : 'text-slate-800'
            } ${selectable ? 'cursor-pointer hover:shadow-sm' : ''}`}
        >
            <span
                {...attributes}
                {...listeners}
                onClick={(event) => event.stopPropagation()}
                className="cursor-grab active:cursor-grabbing"
            >
                <GripVertical size={12} />
            </span>
            {selectable ? (
                <span
                    className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border bg-white"
                    style={
                        selected && !inactive
                            ? { borderColor: workerTeamColor, backgroundColor: workerTeamColor, color: workerTeamTextColor }
                            : { borderColor: hexToRgba(workerTeamColor, 0.45) }
                    }
                >
                    {selected ? <Check size={10} /> : null}
                </span>
            ) : null}
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: inactive ? '#ef4444' : workerTeamColor }} />
            <span className="truncate">{worker.name}</span>
            {onRemove ? (
                <button
                    type="button"
                    onClick={(event) => {
                        event.stopPropagation();
                        onRemove();
                    }}
                    className="text-slate-400 hover:text-red-500"
                    title="작업자 제거"
                >
                    <X size={12} />
                </button>
            ) : null}
        </span>
    );
};

const DraggableVehicleCard: React.FC<{
    vehicle: Vehicle;
    selected?: boolean;
    assignedTeamColor?: string;
    onToggleSelect?: () => void;
    onAdd?: () => void;
}> = ({ vehicle, selected, assignedTeamColor, onToggleSelect, onAdd }) => {
    const normalizedAssignedTeamColor = normalizeColor(assignedTeamColor);
    const assignedTeamTextColor = getReadableTextColor(normalizedAssignedTeamColor);
    const vehicleUnavailable = isUnavailableVehicle(vehicle);
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `vehicle:${vehicle.id}`,
        data: {
            kind: 'vehicle',
            id: vehicle.id,
            label: vehicle.licensePlate,
        } satisfies DragPayload,
    });

    const style: React.CSSProperties = {
        transform: transform ? CSS.Translate.toString(transform) : undefined,
        opacity: isDragging ? 0.35 : 1,
        borderColor: selected
            ? '#2563eb'
            : vehicleUnavailable
                ? '#fecaca'
                : normalizedAssignedTeamColor
                    ? hexToRgba(normalizedAssignedTeamColor, 0.55)
                    : '#cbd5e1',
        backgroundColor: !selected && normalizedAssignedTeamColor && !vehicleUnavailable ? hexToRgba(normalizedAssignedTeamColor, 0.07) : undefined,
        boxShadow: selected ? '0 0 0 3px rgba(37, 99, 235, 0.16)' : undefined,
    };

    return (
        <article
            ref={setNodeRef}
            style={style}
            onClick={onToggleSelect}
            className={`flex h-12 cursor-pointer items-center gap-2 rounded-lg border-2 bg-white px-2.5 shadow-sm transition hover:shadow-md ${
                vehicleUnavailable ? 'bg-red-50' : ''
            }`}
        >
            <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border bg-slate-100 text-slate-600"
                style={
                    normalizedAssignedTeamColor && !vehicleUnavailable
                        ? { backgroundColor: normalizedAssignedTeamColor, borderColor: normalizedAssignedTeamColor, color: assignedTeamTextColor }
                        : undefined
                }
            >
                <Truck size={15} />
            </span>
            <h3 className="min-w-0 flex-1 truncate text-xs font-black text-slate-900">{vehicle.licensePlate}</h3>
            <button
                type="button"
                onClick={(event) => {
                    event.stopPropagation();
                    onAdd?.();
                }}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                title="차량 추가"
            >
                <Plus size={14} />
            </button>
            <button
                type="button"
                {...attributes}
                {...listeners}
                onClick={(event) => event.stopPropagation()}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                title="차량 드래그"
            >
                <GripVertical size={14} />
            </button>
        </article>
    );
};

const DraggableSiteCard: React.FC<{
    site: Site;
    color: string;
    selected: boolean;
    onSelect: () => void;
    onRegister: () => void;
}> = ({ site, color, selected, onSelect, onRegister }) => {
    const siteId = site.id || site.name;
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `site:${siteId}`,
        data: {
            kind: 'site',
            id: siteId,
            label: site.name,
        } satisfies DragPayload,
        disabled: !siteId,
    });

    const style: React.CSSProperties = {
        transform: transform ? CSS.Translate.toString(transform) : undefined,
        opacity: isDragging ? 0.35 : 1,
        borderColor: selected ? color : hexToRgba(color, 0.5),
        boxShadow: selected ? `0 0 0 3px ${hexToRgba(color, 0.18)}` : undefined,
    };

    return (
        <article
            ref={setNodeRef}
            style={style}
            onClick={onSelect}
            className="flex h-12 cursor-pointer items-center gap-2 rounded-lg border-2 bg-white px-2.5 shadow-sm transition hover:shadow-md"
        >
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: color }} />
            <h3 className="min-w-0 flex-1 truncate text-xs font-black text-slate-900">{site.name}</h3>
            <button
                type="button"
                onClick={(event) => {
                    event.stopPropagation();
                    onRegister();
                }}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                title="현장 등록"
            >
                <Plus size={14} />
            </button>
            <button
                type="button"
                {...attributes}
                {...listeners}
                onClick={(event) => event.stopPropagation()}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                title="현장 드래그"
            >
                <GripVertical size={14} />
            </button>
        </article>
    );
};

const SupportRosterLineCard: React.FC<{
    roster: TeamRoster;
    selected: boolean;
    onSelect: () => void;
    onAdd: () => void;
}> = ({ roster, selected, onSelect, onAdd }) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `team:${roster.id}`,
        data: { kind: 'team', id: roster.id, label: roster.name } satisfies DragPayload,
    });

    const style: React.CSSProperties = {
        transform: transform ? CSS.Translate.toString(transform) : undefined,
        opacity: isDragging ? 0.35 : 1,
        borderColor: selected ? roster.color : hexToRgba(roster.color, 0.5),
        boxShadow: selected ? `0 0 0 3px ${hexToRgba(roster.color, 0.18)}` : undefined,
    };

    return (
        <article
            ref={setNodeRef}
            style={style}
            onClick={onSelect}
            className="flex h-12 cursor-pointer items-center gap-2 rounded-lg border-2 bg-white px-2.5 shadow-sm transition hover:shadow-md"
        >
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: roster.color }} />
            <h3 className="min-w-0 flex-1 truncate text-xs font-black text-slate-900">{roster.name}</h3>
            <button
                type="button"
                onClick={(event) => {
                    event.stopPropagation();
                    onAdd();
                }}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                title="지원팀 추가"
            >
                <Plus size={14} />
            </button>
            <button
                type="button"
                {...attributes}
                {...listeners}
                onClick={(event) => event.stopPropagation()}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                title="지원팀 드래그"
            >
                <GripVertical size={14} />
            </button>
        </article>
    );
};

const TeamRosterCard: React.FC<{
    roster: TeamRoster;
    selected: boolean;
    onSelect: () => void;
    selectedWorkerIds: Set<string>;
    supportSelected: boolean;
    forceWorkerSelection?: boolean;
    showSupportTeamToggle?: boolean;
    onToggleSupportTeam: () => void;
    onToggleWorker: (workerId: string) => void;
    onToggleAllWorkers: () => void;
}> = ({
    roster,
    selected,
    onSelect,
    selectedWorkerIds,
    supportSelected,
    forceWorkerSelection = false,
    showSupportTeamToggle = false,
    onToggleSupportTeam,
    onToggleWorker,
    onToggleAllWorkers,
}) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `team:${roster.id}`,
        data: { kind: 'team', id: roster.id, label: roster.name } satisfies DragPayload,
    });

    const style = transform
        ? { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.35 : 1 }
        : { opacity: isDragging ? 0.35 : 1 };
    const isSupportRoster = roster.kind === 'support';
    const useWorkerSelection = !isSupportRoster || forceWorkerSelection;
    const selectedCount = roster.workers.filter((worker) => worker.id && selectedWorkerIds.has(worker.id)).length;
    const allWorkersSelected = useWorkerSelection && roster.workers.length > 0 && selectedCount === roster.workers.length;
    const someWorkersSelected = useWorkerSelection && selectedCount > 0;
    const rosterSelected = selected || supportSelected;
    const showSupportTeamNameToggle = isSupportRoster && useWorkerSelection && showSupportTeamToggle;
    const cardStyle: React.CSSProperties = {
        ...style,
        borderColor: rosterSelected ? roster.color : hexToRgba(roster.color, 0.55),
        boxShadow: rosterSelected ? `0 0 0 3px ${hexToRgba(roster.color, 0.18)}` : undefined,
    };

    return (
        <article
            ref={setNodeRef}
            style={cardStyle}
            className="rounded-lg border-2 bg-white p-3 shadow-sm transition hover:shadow-md"
        >
            <div className="flex items-start justify-between gap-3">
                <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left">
                    <div className="flex items-center gap-2">
                        <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: roster.color }} />
                        <h3 className="truncate text-sm font-black text-slate-900">{roster.name}</h3>
                        {roster.sourceLabel ? (
                            <span
                                className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black"
                                style={getSolidTeamColorStyle(roster.color)}
                            >
                                {roster.sourceLabel}
                            </span>
                        ) : null}
                        {roster.kind === 'support' ? (
                            <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-black text-blue-700">
                                지원팀
                            </span>
                        ) : null}
                    </div>
                    <p className="mt-1 text-xs font-medium text-slate-500">
                        {roster.leaderName ? `팀장 ${roster.leaderName} · ` : ''}
                        {isSupportRoster && !useWorkerSelection ? '팀명 배치' : `작업자 ${roster.workers.length}명`}
                    </p>
                </button>
                <button
                    type="button"
                    {...attributes}
                    {...listeners}
                    className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    title="팀 선택"
                >
                    <GripVertical size={16} />
                </button>
            </div>

            {useWorkerSelection ? (
                <>
                <div
                    className="mt-3 flex flex-wrap gap-1.5 rounded-md p-2"
                    style={{ backgroundColor: hexToRgba(roster.color, 0.06) }}
                >
                    <label
                        onClick={(event) => event.stopPropagation()}
                        className="mb-1 flex w-full cursor-pointer items-center justify-between rounded-md bg-white px-2 py-1.5 text-xs font-black text-slate-700"
                    >
                        <span className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={allWorkersSelected}
                                ref={(node) => {
                                    if (node) node.indeterminate = someWorkersSelected && !allWorkersSelected;
                                }}
                                onChange={onToggleAllWorkers}
                                className="h-4 w-4 rounded border-slate-300 text-blue-600"
                            />
                            {isSupportRoster ? '지원팀 작업자 전체 선택' : '전체 선택'}
                        </span>
                        <span className="text-slate-400">
                            {selectedCount}/{roster.workers.length}
                        </span>
                    </label>
                    {roster.workers.length > 0 ? (
                        roster.workers.map((worker) => (
                            <DraggableWorkerPill
                                key={worker.id}
                                worker={worker}
                                sourceRosterId={roster.id}
                                sourceRosterName={roster.name}
                                teamColor={roster.kind === 'unassigned' ? normalizeColor(worker.color) || roster.color : roster.color}
                                selectable
                                selected={Boolean(worker.id && selectedWorkerIds.has(worker.id))}
                                onToggleSelect={() => worker.id && onToggleWorker(worker.id)}
                            />
                        ))
                    ) : (
                        <span className="text-xs font-semibold text-slate-400">등록된 작업자가 없습니다.</span>
                    )}
                </div>
                {showSupportTeamNameToggle ? (
                    <button
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation();
                            onToggleSupportTeam();
                        }}
                        className={`mt-2 flex h-9 w-full items-center justify-center gap-2 rounded-md border text-xs font-black ${
                            supportSelected
                                ? 'border-blue-300 bg-blue-50 text-blue-700'
                                : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-blue-200 hover:bg-blue-50'
                        }`}
                    >
                        <span
                            className={`flex h-4 w-4 items-center justify-center rounded border ${
                                supportSelected ? 'border-blue-500 bg-blue-500 text-white' : 'border-slate-300 bg-white'
                            }`}
                        >
                            {supportSelected ? <Check size={11} /> : null}
                        </span>
                        지원팀명으로 추가
                    </button>
                ) : null}
                </>
            ) : (
                <button
                    type="button"
                    onClick={(event) => {
                        event.stopPropagation();
                        onToggleSupportTeam();
                    }}
                    className={`mt-3 flex h-9 w-full items-center justify-center gap-2 rounded-md border text-xs font-black ${
                        supportSelected
                            ? 'border-blue-300 bg-blue-50 text-blue-700'
                            : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-blue-200 hover:bg-blue-50'
                    }`}
                >
                    <span
                        className={`flex h-4 w-4 items-center justify-center rounded border ${
                            supportSelected ? 'border-blue-500 bg-blue-500 text-white' : 'border-slate-300 bg-white'
                        }`}
                    >
                        {supportSelected ? <Check size={11} /> : null}
                    </span>
                    팀명 선택
                </button>
            )}

            {selected && useWorkerSelection ? (
                <div className="mt-3 rounded-md bg-slate-50 px-2.5 py-2 text-xs font-bold text-slate-600">
                    선택 {selectedCount}명
                </div>
            ) : null}
        </article>
    );
};

const ScheduleCard: React.FC<{
    schedule: ScheduleItem;
    workersById: Map<string, Worker>;
    workerTeamColorById: Map<string, string>;
    vehiclesById: Map<string, Vehicle>;
    vehicleAssignedTeamColorById: Map<string, string>;
    issues: string[];
    mode?: PlannerMode;
    selectedDestination: boolean;
    recentlyUpdated: boolean;
    onSelectDestination: () => void;
    onDelete: () => void;
    onMemoChange?: (memo: string) => void;
    onWorkerManDayChange?: (workerId: string, manDay: number) => void;
    onWorkerUnitPriceChange?: (workerId: string, unitPrice: number) => void;
    onWorkerPayTypeChange?: (workerId: string, payType: string) => void;
    onSupportTeamChange?: (teamId: string, patch: Partial<ScheduleSupportTeam>) => void;
    onRemoveWorker: (workerId: string) => void;
    onRemoveSupportTeam: (teamId: string) => void;
    onRemoveVehicle: (vehicleId: string) => void;
}> = ({
    schedule,
    workersById,
    workerTeamColorById,
    vehiclesById,
    vehicleAssignedTeamColorById,
    issues,
    mode = 'dispatch',
    selectedDestination,
    recentlyUpdated,
    onSelectDestination,
    onDelete,
    onMemoChange,
    onWorkerManDayChange,
    onWorkerUnitPriceChange,
    onWorkerPayTypeChange,
    onSupportTeamChange,
    onRemoveWorker,
    onRemoveSupportTeam,
    onRemoveVehicle,
}) => {
    const { setNodeRef: setDropNodeRef, isOver } = useDroppable({
        id: `schedule-drop:${schedule.id}`,
        data: { kind: 'schedule-drop', scheduleId: schedule.id },
    });
    const { attributes, listeners, setNodeRef: setDragNodeRef, transform, isDragging } = useDraggable({
        id: `schedule:${schedule.id}`,
        data: { kind: 'schedule', id: schedule.id, label: schedule.siteName || schedule.teamName } satisfies DragPayload,
    });

    const scheduleVehicleIds = getScheduleVehicleIds(schedule);
    const isDailyReportCard = isPersonnelBoardMode(mode);
    const inputTargetLabel = mode === 'schedule-confirmation' ? '일정확정' : '출력일보';
    const dailyReportSiteFields = [
        { label: '발주', value: schedule.clientCompanyName },
        { label: '시공', value: schedule.constructorCompanyName },
        { label: '협력', value: schedule.partnerName },
        { label: '구분', value: schedule.siteType },
        { label: '결제방식', value: schedule.paymentType },
        { label: '현장담당팀', value: schedule.responsibleTeamName },
        { label: '현장책임자', value: schedule.siteManagerName },
    ];

    const setRefs = (node: HTMLDivElement | null) => {
        setDropNodeRef(node);
        setDragNodeRef(node);
    };

    const style = {
        transform: CSS.Translate.toString(transform),
        borderColor: issues.length > 0 ? '#ef4444' : isOver ? schedule.teamColor : schedule.siteColor || undefined,
        opacity: isDragging ? 0.35 : 1,
    };

    return (
        <article
            ref={setRefs}
            style={style}
            onClick={onSelectDestination}
            className={`relative cursor-pointer rounded-lg bg-white p-4 shadow-sm transition hover:shadow-md ${
                recentlyUpdated
                    ? 'border-2 border-emerald-400 ring-4 ring-emerald-100 animate-pulse'
                    : 'border border-slate-200'
            }`}
        >
            {selectedDestination ? (
                <span
                    className="absolute right-12 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-200"
                    title={isDailyReportCard ? '입력 중인 현장' : '선택 중인 이동 대상'}
                >
                    <MapPin size={17} />
                </span>
            ) : null}
            <div
                className="-mx-4 -mt-4 mb-3 h-1 rounded-t-lg"
                style={{ backgroundColor: schedule.siteColor || schedule.teamColor }}
            />
            <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="mb-1 flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: schedule.teamColor }} />
                        {issues.length > 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-black text-red-600">
                                <AlertTriangle size={12} />
                                {issues.length}
                            </span>
                        ) : null}
                    </div>
                    <h3 className="truncate text-base font-black text-slate-950">{schedule.siteName || '현장 선택 필요'}</h3>
                    <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: schedule.siteColor || '#cbd5e1' }} />
                        <p className="truncate text-xs font-medium text-slate-500">{schedule.siteAddress || '주소 없음'}</p>
                    </div>
                    {isDailyReportCard ? (
                        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-black">
                            {dailyReportSiteFields.map((field) => {
                                const value = toTrimmedText(field.value);
                                return (
                                    <span
                                        key={field.label}
                                        className={`rounded-full px-2 py-0.5 ${value ? 'bg-slate-100 text-slate-600' : 'bg-slate-50 text-slate-400'}`}
                                    >
                                        {field.label} {value || '미지정'}
                                    </span>
                                );
                            })}
                        </div>
                    ) : null}
                </div>
                <button
                    type="button"
                    {...attributes}
                    {...listeners}
                    className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    title="카드 순서 이동"
                >
                    <GripVertical size={17} />
                </button>
            </div>

            {schedule.requestId || Number(schedule.requestedHeadcount || 0) > 0 ? (
                <div className="mt-3 rounded-md border border-blue-100 bg-blue-50 px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-black text-blue-800">
                        <span>요청 {Number(schedule.requestedHeadcount || 0)}명</span>
                        <span>배치 {getAssignedHeadcount(schedule)}명</span>
                        {Number(schedule.requestedHeadcount || 0) > getAssignedHeadcount(schedule) ? (
                            <span className="rounded-full bg-white px-2 py-0.5 text-rose-600">
                                부족 {Number(schedule.requestedHeadcount || 0) - getAssignedHeadcount(schedule)}명
                            </span>
                        ) : null}
                        {getAssignedHeadcount(schedule) > Number(schedule.requestedHeadcount || 0) && Number(schedule.requestedHeadcount || 0) > 0 ? (
                            <span className="rounded-full bg-white px-2 py-0.5 text-amber-700">
                                초과 {getAssignedHeadcount(schedule) - Number(schedule.requestedHeadcount || 0)}명
                            </span>
                        ) : null}
                    </div>
                    {schedule.requestMemo ? (
                        <div className="mt-2 text-xs font-semibold text-blue-900">{schedule.requestMemo}</div>
                    ) : null}
                </div>
            ) : null}

            {schedule.workerIds.length > 0 ? (
                <div
                    className="mt-3 rounded-md border border-dashed border-slate-200 p-2"
                    style={{ backgroundColor: hexToRgba(schedule.teamColor, 0.05) }}
                >
                    <div className="mb-2 flex items-center justify-between">
                        <span className="text-[11px] font-black text-slate-500">작업자 {schedule.workerIds.length}명</span>
                        {isDailyReportCard ? (
                            <span className="text-[11px] font-semibold text-slate-400">공수 입력</span>
                        ) : null}
                    </div>
                    {isDailyReportCard ? (
                        <div className="space-y-1.5">
                            {schedule.workerIds.map((workerId) => {
                                const worker = workersById.get(workerId);
                                if (!worker) return null;
                                const teamColor = workerTeamColorById.get(workerId) || schedule.teamColor;
                                const manDay = toPositiveNumber(schedule.workerManDays?.[workerId], 1);
                                const unitPrice = toFiniteNumber(schedule.workerUnitPrices?.[workerId], worker.unitPrice || 0);
                                const payType = normalizeDailyPayType(schedule.workerPayTypes?.[workerId]) || resolveScheduleWorkerSalaryType(worker);
                                return (
                                    <div
                                        key={workerId}
                                        className="rounded-md border border-slate-200 bg-white px-2 py-1.5"
                                    >
                                        <div className="flex min-w-0 items-center gap-1.5">
                                            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: teamColor }} />
                                            <div className="min-w-0 flex-1">
                                                <div className="truncate text-xs font-black text-slate-900">{worker.name}</div>
                                            </div>
                                            <select
                                                value={payType}
                                                onClick={(event) => event.stopPropagation()}
                                                onChange={(event) => onWorkerPayTypeChange?.(workerId, event.target.value)}
                                                className="h-8 w-[74px] shrink-0 rounded-md border border-slate-200 bg-slate-50 px-1 text-[11px] font-black text-slate-700 outline-none focus:border-blue-400 focus:bg-white"
                                                aria-label="급여구분"
                                            >
                                                {DAILY_PAY_TYPE_OPTIONS.map((option) => (
                                                    <option key={option} value={option}>{option}</option>
                                                ))}
                                            </select>
                                            <label className="sr-only" htmlFor={`unit-price-${schedule.id}-${workerId}`}>단가</label>
                                            <input
                                                id={`unit-price-${schedule.id}-${workerId}`}
                                                type="number"
                                                min="0"
                                                step="1000"
                                                value={unitPrice}
                                                onClick={(event) => event.stopPropagation()}
                                                onChange={(event) => onWorkerUnitPriceChange?.(workerId, toFiniteNumber(event.target.value, 0))}
                                                className="h-8 w-[82px] shrink-0 rounded-md border border-slate-200 bg-slate-50 px-1.5 text-right text-[11px] font-black text-slate-900 outline-none focus:border-blue-400 focus:bg-white"
                                                title={`단가 ${formatWon(unitPrice)}`}
                                            />
                                            <label className="sr-only" htmlFor={`man-day-${schedule.id}-${workerId}`}>공수</label>
                                            <input
                                                id={`man-day-${schedule.id}-${workerId}`}
                                                type="number"
                                                min="0.1"
                                                step="0.1"
                                                value={manDay}
                                                onClick={(event) => event.stopPropagation()}
                                                onChange={(event) => onWorkerManDayChange?.(workerId, toPositiveNumber(event.target.value, 1))}
                                                className="h-8 w-[52px] shrink-0 rounded-md border border-slate-200 bg-slate-50 px-1.5 text-right text-xs font-black text-slate-900 outline-none focus:border-blue-400 focus:bg-white"
                                            />
                                            <button
                                                type="button"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    onRemoveWorker(workerId);
                                                }}
                                                className="flex h-8 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-500"
                                                title="작업자 제거"
                                            >
                                                <X size={13} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="flex flex-wrap gap-1.5">
                            {schedule.workerIds.map((workerId) => {
                                const worker = workersById.get(workerId);
                                if (!worker) return null;
                                return (
                                    <DraggableWorkerPill
                                        key={workerId}
                                        worker={worker}
                                        teamColor={workerTeamColorById.get(workerId) || schedule.teamColor}
                                        sourceScheduleId={schedule.id}
                                        onRemove={() => onRemoveWorker(workerId)}
                                    />
                                );
                            })}
                        </div>
                    )}
                </div>
            ) : isDailyReportCard && schedule.supportTeams.length > 0 ? null : (
                <div className="mt-3 rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500">
                    {isDailyReportCard ? `${inputTargetLabel} 작업자 또는 지원팀 없음` : '작업자 없음'}
                </div>
            )}

            {isDailyReportCard ? (
                <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-2">
                    <label className="mb-1 block text-[11px] font-black text-slate-500" htmlFor={`work-content-${schedule.id}`}>
                        작업내용
                    </label>
                    <textarea
                        id={`work-content-${schedule.id}`}
                        value={schedule.memo}
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) => onMemoChange?.(event.target.value)}
                        placeholder={`${inputTargetLabel}에 저장할 작업내용`}
                        className="min-h-[72px] w-full resize-y rounded-md border border-slate-200 bg-white px-2 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-blue-400"
                    />
                </div>
            ) : null}

            {isDailyReportCard && schedule.supportTeams.length > 0 ? (
                <div className="mt-3 rounded-md border border-orange-200 bg-orange-50 p-2">
                    <div className="mb-2 flex items-center justify-between">
                        <span className="text-[11px] font-black text-orange-700">지원팀/용역팀 {schedule.supportTeams.length}건</span>
                        <span className="text-[11px] font-semibold text-orange-600">{mode === 'schedule-confirmation' ? '확정 입력줄 저장' : '일보 입력줄 저장'}</span>
                    </div>
                    <div className="space-y-1.5">
                        {schedule.supportTeams.map((team) => {
                            const teamKey = team.id || team.name;
                            const manDay = toPositiveNumber(team.manDay, 1);
                            const unitPrice = toFiniteNumber(team.unitPrice, 0);
                            const payType = normalizeDailyPayType(team.payType, '지원팀');
                            return (
                                <div key={teamKey} className="rounded-md border border-orange-100 bg-white px-2 py-1.5">
                                    <div className="flex min-w-0 items-center gap-1.5">
                                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: team.color }} />
                                        <div className="min-w-0 flex-1">
                                            <div className="truncate text-xs font-black text-slate-900">{team.name}</div>
                                        </div>
                                        <select
                                            value={payType}
                                            onClick={(event) => event.stopPropagation()}
                                            onChange={(event) => onSupportTeamChange?.(teamKey, { payType: event.target.value })}
                                            className="h-8 w-[74px] shrink-0 rounded-md border border-orange-100 bg-orange-50 px-1 text-[11px] font-black text-slate-700 outline-none focus:border-orange-300 focus:bg-white"
                                            aria-label="지원팀 급여구분"
                                        >
                                            {DAILY_PAY_TYPE_OPTIONS.map((option) => (
                                                <option key={option} value={option}>{option}</option>
                                            ))}
                                        </select>
                                        <input
                                            type="number"
                                            min="0"
                                            step="1000"
                                            value={unitPrice}
                                            onClick={(event) => event.stopPropagation()}
                                            onChange={(event) => onSupportTeamChange?.(teamKey, { unitPrice: toFiniteNumber(event.target.value, 0) })}
                                            className="h-8 w-[82px] shrink-0 rounded-md border border-orange-100 bg-orange-50 px-1.5 text-right text-[11px] font-black text-slate-900 outline-none focus:border-orange-300 focus:bg-white"
                                            aria-label="지원팀 단가"
                                        />
                                        <input
                                            type="number"
                                            min="0.1"
                                            step="0.1"
                                            value={manDay}
                                            onClick={(event) => event.stopPropagation()}
                                            onChange={(event) => onSupportTeamChange?.(teamKey, { manDay: toPositiveNumber(event.target.value, 1) })}
                                            className="h-8 w-[52px] shrink-0 rounded-md border border-orange-100 bg-orange-50 px-1.5 text-right text-xs font-black text-slate-900 outline-none focus:border-orange-300 focus:bg-white"
                                            aria-label="지원팀 공수"
                                        />
                                        <button
                                            type="button"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                onRemoveSupportTeam(teamKey);
                                            }}
                                            className="flex h-8 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-500"
                                            title="지원팀 제거"
                                        >
                                            <X size={13} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : !isDailyReportCard && schedule.supportTeams.length > 0 ? (
                <div className="mt-3 rounded-md border border-dashed border-slate-200 bg-white p-2">
                    <div className="mb-2 flex items-center justify-between">
                        <span className="text-[11px] font-black text-slate-500">지원팀 {schedule.supportTeams.length}팀</span>
                        <span className="text-[11px] font-semibold text-slate-400">팀명 배치</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {schedule.supportTeams.map((team) => {
                            const teamColor = normalizeColor(team.color) || '#22c55e';
                            return (
                            <span
                                key={team.id || team.name}
                                className="inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-bold shadow-sm"
                                style={getSolidTeamColorStyle(teamColor, '#22c55e')}
                            >
                                <span className="truncate">{team.name}</span>
                                <button
                                    type="button"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        onRemoveSupportTeam(team.id || team.name);
                                    }}
                                    className="opacity-70 hover:opacity-100"
                                    style={{ color: 'inherit' }}
                                    title="지원팀 제거"
                                >
                                    <X size={12} />
                                </button>
                            </span>
                            );
                        })}
                    </div>
                </div>
            ) : !isDailyReportCard ? (
                <div className="mt-3 rounded-md border border-dashed border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-500">
                    지원팀 없음
                </div>
            ) : null}

            {!isDailyReportCard && scheduleVehicleIds.length > 0 ? (
                <div className="mt-3 rounded-md border border-dashed border-slate-200 bg-slate-50 p-2">
                    <div className="mb-2 flex items-center">
                        <span className="text-[11px] font-black text-slate-500">차량</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {scheduleVehicleIds.map((vehicleId, index) => {
                            const assignedVehicle = vehiclesById.get(vehicleId);
                            const vehicleTeamColor = getScheduleVehicleColor(schedule, vehicleId, vehicleAssignedTeamColorById);
                            const vehicleTextColor = getReadableTextColor(vehicleTeamColor);
                            const vehicleUnavailable = isUnavailableVehicle(assignedVehicle);
                            return (
                                <span
                                    key={vehicleId}
                                    className={`inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-1 text-xs font-bold ${
                                        vehicleUnavailable
                                            ? 'border-red-200 bg-red-50 text-red-700'
                                            : 'text-slate-800'
                                    }`}
                                    style={
                                        vehicleUnavailable
                                            ? undefined
                                            : vehicleTeamColor
                                                ? {
                                                    borderColor: vehicleTeamColor,
                                                    backgroundColor: vehicleTeamColor,
                                                    color: vehicleTextColor,
                                                }
                                            : {
                                                borderColor: '#cbd5e1',
                                                backgroundColor: '#f8fafc',
                                            }
                                    }
                                >
                                    <Truck size={13} style={vehicleUnavailable ? undefined : { color: 'inherit' }} />
                                    <span className="truncate">
                                        {assignedVehicle?.licensePlate || schedule.vehicleLabels[index] || schedule.vehicleLabel}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            onRemoveVehicle(vehicleId);
                                        }}
                                        className={vehicleUnavailable ? 'text-slate-400 hover:text-red-500' : 'opacity-70 hover:opacity-100'}
                                        style={vehicleUnavailable ? undefined : { color: 'inherit' }}
                                        title="차량 제거"
                                    >
                                        <X size={12} />
                                    </button>
                                </span>
                            );
                        })}
                    </div>
                </div>
            ) : !isDailyReportCard ? (
                <div className="mt-3 rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500">
                    차량 없음
                </div>
            ) : null}

            {issues.length > 0 ? (
                <div className="mt-3 rounded-md bg-red-50 px-2.5 py-2 text-xs font-bold text-red-700">
                    {issues[0]}
                </div>
            ) : null}

            <div className="mt-3 flex justify-end gap-1">
                <button
                    type="button"
                    onClick={onDelete}
                    className="flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-bold text-red-500 hover:bg-red-50"
                >
                    <Trash2 size={14} />
                    삭제
                </button>
            </div>
        </article>
    );
};

const BoardViewScheduleCard: React.FC<{
    schedule: ScheduleItem;
    workersById: Map<string, Worker>;
    workerTeamColorById: Map<string, string>;
    teams: Team[];
    teamsById: Map<string, Team>;
    vehiclesById: Map<string, Vehicle>;
    vehicleAssignedTeamColorById: Map<string, string>;
    mode?: PlannerMode;
    selectedDestination: boolean;
    recentlyUpdated: boolean;
    onSelectDestination: () => void;
}> = ({
    schedule,
    workersById,
    workerTeamColorById,
    teams,
    teamsById,
    vehiclesById,
    vehicleAssignedTeamColorById,
    mode = 'dispatch',
    selectedDestination,
    recentlyUpdated,
    onSelectDestination,
}) => {
    const { setNodeRef: setDropNodeRef, isOver } = useDroppable({
        id: `board-schedule-drop:${schedule.id}`,
        data: { kind: 'schedule-drop', scheduleId: schedule.id },
    });
    const { attributes, listeners, setNodeRef: setDragNodeRef, transform, isDragging } = useDraggable({
        id: `schedule:${schedule.id}`,
        data: { kind: 'schedule', id: schedule.id, label: schedule.siteName || schedule.teamName } satisfies DragPayload,
    });
    const siteColor = normalizeColor(schedule.siteColor) || normalizeColor(schedule.teamColor) || DEFAULT_RESOURCE_COLOR;
    const scheduleVehicleIds = getScheduleVehicleIds(schedule);
    const isDailyReportCard = isPersonnelBoardMode(mode);
    const siteNameLabel = formatBoardDisplayText(schedule.siteName || '현장 미지정', BOARD_SITE_NAME_VISIBLE_CHARS);
    const setRefs = (node: HTMLElement | null) => {
        setDropNodeRef(node);
        setDragNodeRef(node);
    };
    const workerRows = schedule.workerIds
        .map((workerId) => {
            const worker = workersById.get(workerId);
            if (!worker) return null;
            const teamName = toTrimmedText(schedule.workerTeamNames?.[workerId]) || toTrimmedText(worker.teamName);
            const teamId = toTrimmedText(schedule.workerTeamIds?.[workerId]) || toTrimmedText(worker.teamId);
            const scheduledTeam = (teamId ? teamsById.get(teamId) : undefined) || findTeamInRows(teams, teamId, teamName);
            const teamColor =
                normalizeColor(scheduledTeam?.color) ||
                normalizeColor(workerTeamColorById.get(workerId)) ||
                normalizeColor(worker.color) ||
                normalizeColor(schedule.teamColor) ||
                siteColor;
            const payType = normalizeDailyPayType(schedule.workerPayTypes?.[workerId]) || resolveScheduleWorkerSalaryType(worker);
            return { workerId, worker, teamColor, teamName, teamId, payType };
        })
        .filter((row): row is { workerId: string; worker: Worker; teamColor: string; teamName: string; teamId: string; payType: string } => Boolean(row));

    const workerNameRows = workerRows.map((row) => {
        const rawManDay = Number(schedule.workerManDays?.[row.workerId] ?? 1);
        const manDay = Number.isFinite(rawManDay) && rawManDay > 0 ? rawManDay : 1;
        const workerNameLabel = formatBoardDisplayText(row.worker.name, BOARD_WORKER_NAME_VISIBLE_CHARS);
        const fullLabel = isDailyReportCard ? `${row.worker.name} ${manDay.toFixed(1)}` : row.worker.name;
        return {
            id: `worker:${row.workerId}`,
            label: isDailyReportCard ? `${workerNameLabel} ${manDay.toFixed(1)}` : workerNameLabel,
            fullLabel,
            payType: row.payType,
            teamColor: row.teamColor,
            teamName: row.teamName,
            teamId: row.teamId,
        };
    });

    const supportNameRows = schedule.supportTeams.map((team) => ({
        id: `support:${team.id || team.name}`,
        label: isDailyReportCard
            ? `${team.name} ${toPositiveNumber(team.manDay, 1).toFixed(1)}`
            : team.name,
        payType: normalizeDailyPayType(team.payType, '지원팀'),
        teamColor: normalizeColor(team.color) || '#22c55e',
    }));

    const hasAssignedRows = workerNameRows.length > 0 || supportNameRows.length > 0;
    const workerPanelColor = siteColor;
    const getWorkerGridColumnCount = (count: number) =>
        count > 0 ? Math.max(2, Math.ceil(count / BOARD_WORKERS_PER_COLUMN)) : 2;
    const workerTeamGroups = workerNameRows.reduce<Array<{
        key: string;
        teamName: string;
        teamColor: string;
        rows: typeof workerNameRows;
    }>>((groups, row) => {
        const key = row.teamId || row.teamName || row.teamColor || 'unassigned';
        const existing = groups.find((group) => group.key === key);
        if (existing) {
            existing.rows.push(row);
            return groups;
        }

        groups.push({
            key,
            teamName: row.teamName,
            teamColor: row.teamColor,
            rows: [row],
        });
        return groups;
    }, []);
    const workerGridColumnCount = workerTeamGroups.length > 0
        ? getWorkerGridColumnCount(workerNameRows.length)
        : 2;
    const orderedWorkerNameRows = workerTeamGroups.flatMap((group) => group.rows);
    const maxWorkerLabelLength = workerNameRows.reduce((max, row) => Math.max(max, Array.from(row.label).length), 0);
    const workerNameFontSize = maxWorkerLabelLength >= 5 || workerGridColumnCount >= 3 ? 11 : 12;
    const workerNamePaddingX = maxWorkerLabelLength >= 5 || workerGridColumnCount >= 3 ? 2 : 4;
    const workerNameCellMinWidth = BOARD_WORKER_NAME_CELL_MIN_WIDTH;
    const boardCardWidth = Math.max(
        BOARD_SITE_NAME_MIN_CARD_WIDTH,
        Math.min(640, workerGridColumnCount * workerNameCellMinWidth + Math.max(0, workerGridColumnCount - 1) * 6 + 16)
    );
    const vehicleGridColumnCount =
        workerNameRows.length > BOARD_VEHICLE_TWO_COLUMN_WORKER_THRESHOLD && scheduleVehicleIds.length > 1 ? 2 : 1;

    return (
        <article
            ref={setRefs}
            onClick={onSelectDestination}
            className={`relative self-start cursor-pointer border-2 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                recentlyUpdated ? 'ring-4 ring-emerald-200' : ''
            }`}
            style={{
                alignSelf: 'start',
                borderColor: isOver ? '#2563eb' : siteColor,
                height: 'max-content',
                opacity: isDragging ? 0.4 : 1,
                overflow: 'visible',
                transform: transform ? CSS.Translate.toString(transform) : undefined,
                width: boardCardWidth,
                maxWidth: '100%',
            }}
        >
            {selectedDestination ? (
                <span
                    data-board-capture-ignore="true"
                    className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-slate-950 text-white shadow-lg"
                    title="선택 중인 현장"
                >
                    <MapPin size={15} />
                </span>
            ) : null}

            <button
                type="button"
                data-board-capture-ignore="true"
                {...attributes}
                {...listeners}
                onClick={(event) => event.stopPropagation()}
                className="absolute left-1 top-1 z-10 flex h-7 w-7 cursor-grab items-center justify-center rounded-md bg-white/80 text-slate-700 shadow-sm transition hover:bg-white active:cursor-grabbing"
                title="카드 순서 이동"
                aria-label="카드 순서 이동"
            >
                <GripVertical size={15} />
            </button>

            <div
                className="px-9 py-1.5 text-center"
                style={{
                    background: `linear-gradient(180deg, ${hexToRgba(siteColor, 0.68)}, ${siteColor})`,
                    color: getReadableTextColor(siteColor),
                }}
            >
                <h3 data-capture-text-safe="true" className="truncate pb-px text-lg font-black leading-[1.35]" title={schedule.siteName || '현장 미지정'}>
                    {siteNameLabel}
                </h3>
            </div>

            <div className="border-b border-slate-300 px-2 py-1.5 text-center">
                <div data-capture-text-safe="true" className="truncate pb-px text-sm font-bold leading-[1.4] text-slate-900">{schedule.siteAddress || '주소 없음'}</div>
            </div>

            {schedule.requestId || Number(schedule.requestedHeadcount || 0) > 0 ? (
                <div className="border-b border-slate-300 bg-blue-50 px-2 py-1.5 text-center text-xs font-black text-blue-800">
                    요청 {Number(schedule.requestedHeadcount || 0)}명 / 배치 {getAssignedHeadcount(schedule)}명
                </div>
            ) : null}

            {hasAssignedRows ? (
                <div className="border-b border-slate-300">
                    {workerNameRows.length > 0 ? (
                        <div
                            className="grid items-start gap-1.5 p-2"
                            style={{
                                background: `linear-gradient(180deg, ${hexToRgba(workerPanelColor, 0.28)}, ${hexToRgba(workerPanelColor, 0.62)})`,
                                gridTemplateColumns: `repeat(${workerGridColumnCount}, minmax(${workerNameCellMinWidth}px, 1fr))`,
                            }}
                        >
                            {orderedWorkerNameRows.map((row) => {
                                const style = getBoardPayTypeStyle(row.payType);
                                const teamBorderColor = normalizeColor(row.teamColor) || workerPanelColor;
                                return (
                                    <div
                                        key={row.id}
                                        className="min-w-0 border-2 p-1 shadow-sm"
                                        style={{
                                            background: `linear-gradient(180deg, ${hexToRgba(teamBorderColor, 0.9)}, ${teamBorderColor})`,
                                            borderColor: teamBorderColor,
                                        }}
                                        title={`${row.fullLabel} · ${row.teamName || '팀 미지정'} · ${style.label}`}
                                    >
                                        <div
                                            className="min-w-0 border py-0.5 text-center font-black leading-[1.35] shadow-sm"
                                            style={{
                                                background: style.background,
                                                borderColor: teamBorderColor,
                                                color: style.color,
                                                fontSize: workerNameFontSize,
                                                boxShadow: style.shadow,
                                                letterSpacing: 0,
                                                paddingLeft: workerNamePaddingX,
                                                paddingRight: workerNamePaddingX,
                                            }}
                                        >
                                            <span data-capture-text-safe="true" className="block truncate pb-px">{row.label}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : null}

                    {supportNameRows.length > 0 ? (
                        <div className={`bg-emerald-50 px-2 py-2 ${workerNameRows.length > 0 ? 'border-t-2 border-emerald-700' : ''}`}>
                            <div className="mb-1.5 flex items-center justify-center gap-1 border border-emerald-700 bg-emerald-600 px-2 py-0.5 text-[11px] font-black text-white shadow-sm">
                                지원팀
                            </div>
                            <div
                                className="grid gap-1.5"
                                style={{
                                    gridAutoRows: 'max-content',
                                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                                }}
                            >
                                {supportNameRows.map((row) => {
                                    const style = getBoardPayTypeStyle(row.payType);
                                    const teamColor = normalizeColor(row.teamColor) || '#22c55e';
                                    return (
                                        <div
                                            key={row.id}
                                            className="min-w-0 border p-1 shadow-sm"
                                            style={{
                                                background: `linear-gradient(180deg, ${hexToRgba(teamColor, 0.9)}, ${teamColor})`,
                                                borderColor: teamColor,
                                            }}
                                            title={`${row.label} · ${style.label}`}
                                        >
                                            <div
                                                className="min-w-0 border px-1.5 py-0.5 text-center text-[13px] font-black leading-[1.35] shadow-sm"
                                                style={{
                                                    background: style.background,
                                                    borderColor: style.borderColor,
                                                    color: style.color,
                                                    boxShadow: style.shadow,
                                                }}
                                            >
                                                <span data-capture-text-safe="true" className="block truncate pb-px">{row.label}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : null}
                </div>
            ) : (
                <div className="border-b border-slate-300 px-2 py-2 text-center text-sm font-bold text-slate-400">
                    {isDailyReportCard ? '일보 작업자 미배치' : '작업자/지원팀 미배치'}
                </div>
            )}

            {!isDailyReportCard && scheduleVehicleIds.length > 0 ? (
                <div
                    className="grid gap-px bg-slate-300"
                    style={{
                        gridTemplateColumns: `repeat(${vehicleGridColumnCount}, minmax(0, 1fr))`,
                    }}
                >
                    {scheduleVehicleIds.map((vehicleId, index) => {
                        const vehicle = vehiclesById.get(vehicleId);
                        const vehicleColor = getScheduleVehicleColor(schedule, vehicleId, vehicleAssignedTeamColorById);
                        const vehicleTextColor = getReadableTextColor(vehicleColor);
                        return (
                            <div
                                key={vehicleId}
                                className="flex items-center justify-center gap-1 px-2 py-1.5 text-center text-sm font-black"
                                style={{
                                    backgroundColor: vehicleColor,
                                    color: vehicleTextColor,
                                }}
                            >
                                <Truck size={14} style={{ color: vehicleTextColor }} />
                                <span data-capture-text-safe="true" className="min-w-0 truncate pb-px leading-[1.35]">{vehicle?.licensePlate || schedule.vehicleLabels[index] || schedule.vehicleLabel}</span>
                            </div>
                        );
                    })}
                </div>
            ) : !isDailyReportCard ? (
                <div className="px-2 py-2 text-center text-sm font-bold text-slate-400">
                    차량 미배치
                </div>
            ) : null}
        </article>
    );
};

export default function FieldSchedulePlannerPage({ mode = 'dispatch' }: FieldSchedulePlannerPageProps = {}) {
    const { currentUser } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const isDailyReportInput = mode === 'daily-report';
    const isScheduleConfirmationInput = mode === 'schedule-confirmation';
    const isPersonnelInputMode = isPersonnelBoardMode(mode);
    const boardRef = useRef<HTMLDivElement | null>(null);
    const urlDate = normalizeDateInputParam(searchParams.get('date'));
    const syncedUrlDateRef = useRef(urlDate);
    const [date, setDateState] = useState(() => urlDate ?? getTodayInputValue());
    const [copySourceDate, setCopySourceDate] = useState(() => shiftDate(getTodayInputValue(), -1));
    const [teams, setTeams] = useState<Team[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [sites, setSites] = useState<Site[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
    const [selectedTeamId, setSelectedTeamId] = useState('');
    const [selectedSiteId, setSelectedSiteId] = useState('');
    const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);
    const [selectedSupportTeamIds, setSelectedSupportTeamIds] = useState<string[]>([]);
    const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);
    const [offDutyWorkerIds, setOffDutyWorkerIds] = useState<string[]>([]);
    const [offDutySelectionMode, setOffDutySelectionMode] = useState(false);
    const [offDutyDraftWorkerIds, setOffDutyDraftWorkerIds] = useState<string[]>([]);
    const [recentlyUpdatedSiteKey, setRecentlyUpdatedSiteKey] = useState('');
    const [leftPanelTab, setLeftPanelTab] = useState<LeftPanelTab>('sites');
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [activePayload, setActivePayload] = useState<DragPayload | null>(null);
    const [deletedSchedule, setDeletedSchedule] = useState<ScheduleItem | null>(null);
    const [hasTemporaryDraft, setHasTemporaryDraft] = useState(false);
    const [boardViewMode, setBoardViewMode] = useState(false);
    // Kept only to preserve existing draft/UI state; scoped accounts can no
    // longer use this value to reveal another team's schedule or sites.
    const [showAllScheduleConfirmationSites, setShowAllScheduleConfirmationSites] = useState(false);
    const [isMobileBoardLayout, setIsMobileBoardLayout] = useState(() =>
        typeof window !== 'undefined' ? window.innerWidth < 1024 : false
    );
    const [scheduleClipboard, setScheduleClipboard] = useState<ScheduleClipboard | null>(null);
    const [copyingSchedule, setCopyingSchedule] = useState(false);
    const [capturingBoard, setCapturingBoard] = useState(false);
    const [analyzingSchedule, setAnalyzingSchedule] = useState(false);
    const [isKakaoModalOpen, setIsKakaoModalOpen] = useState(false);
    const [isKakaoAnalyzing, setIsKakaoAnalyzing] = useState(false);
    const [isKakaoFileDragging, setIsKakaoFileDragging] = useState(false);
    const [kakaoText, setKakaoText] = useState('');
    const [kakaoFile, setKakaoFile] = useState<File | null>(null);
    const kakaoFileInputRef = useRef<HTMLInputElement | null>(null);
    const workerAccessScope = useWorkerAccessScope(workers, teams);
    const viewerTeamScope = useMemo<ViewerTeamScope>(() => {
        if (workerAccessScope.mode !== 'team') return EMPTY_VIEWER_TEAM_SCOPE;

        return {
            enabled: true,
            teamIds: workerAccessScope.teamIds,
            teamNames: workerAccessScope.teamNames,
            teamNameKeys: workerAccessScope.teamNameKeys,
            label: workerAccessScope.label,
        };
    }, [workerAccessScope]);

    const setDate = useCallback((nextValue: React.SetStateAction<string>) => {
        if (saving) {
            setMessage('저장 중에는 날짜를 변경할 수 없습니다. 저장이 끝난 뒤 다시 시도해주세요.');
            return;
        }

        setDateState((prev) => {
            const resolved = typeof nextValue === 'function'
                ? (nextValue as (prevState: string) => string)(prev)
                : nextValue;
            return normalizeDateInputParam(resolved) ?? prev;
        });
    }, [saving]);

    useEffect(() => {
        if (!isDailyReportInput) return;
        if (urlDate === syncedUrlDateRef.current) return;

        syncedUrlDateRef.current = urlDate;
        const nextDate = urlDate ?? getTodayInputValue();
        if (nextDate !== date && !saving) {
            setDateState(nextDate);
        }
    }, [date, isDailyReportInput, saving, urlDate]);

    useEffect(() => {
        if (!isDailyReportInput) return;

        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            next.set('tab', 'board-input');
            next.set('date', date);
            return next.toString() === prev.toString() ? prev : next;
        }, { replace: true });
    }, [date, isDailyReportInput, setSearchParams]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (!dirty && !saving) return;

        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = '';
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [dirty, saving]);

    useEffect(() => {
        if (isPersonnelInputMode && leftPanelTab === 'vehicles') {
            setLeftPanelTab('teams');
        }
    }, [isPersonnelInputMode, leftPanelTab]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const updateMobileBoardLayout = () => {
            setIsMobileBoardLayout(window.innerWidth < 1024);
        };

        updateMobileBoardLayout();
        window.addEventListener('resize', updateMobileBoardLayout);

        return () => window.removeEventListener('resize', updateMobileBoardLayout);
    }, []);

    const sensors = useMemo(
        () => [
            { sensor: PointerSensor, options: { activationConstraint: { distance: 12 } } },
            { sensor: KeyboardSensor, options: {} },
        ],
        []
    );

    const { setNodeRef: setBoardDropRef, isOver: isBoardOver } = useDroppable({
        id: 'schedule-board-drop',
        data: { kind: 'board-drop' },
    });

    const workersById = useMemo(() => new Map(workers.map((worker) => [worker.id || '', worker])), [workers]);
    const vehiclesById = useMemo(() => new Map(vehicles.map((vehicle) => [vehicle.id, vehicle])), [vehicles]);
    const sitesById = useMemo(() => new Map(sites.map((site) => [site.id || '', site])), [sites]);
    const teamsById = useMemo(() => new Map(teams.map((team) => [team.id || '', team])), [teams]);

    const getSiteColor = useCallback(
        (site?: Site, fallbackColor = DEFAULT_RESOURCE_COLOR) => {
            const responsibleTeam =
                (site?.responsibleTeamId ? teamsById.get(site.responsibleTeamId) : undefined) ||
                teams.find((team) => team.name === site?.responsibleTeamName);
            const responsibleTeamColor = normalizeColor(responsibleTeam?.color);
            if (responsibleTeamColor) return responsibleTeamColor;

            const directSiteColor = normalizeColor(site?.color);
            if (directSiteColor) return directSiteColor;

            return fallbackColor;
        },
        [teams, teamsById]
    );

    const buildKakaoAnalyzeContext = useCallback((): KakaoAnalyzeContext => ({
        today: date,
        sites: sites
            .filter((site) => !workerAccessScope.loading && workerAccessMatchesSite(workerAccessScope, site))
            .map((site) => site.name)
            .filter(Boolean),
        teams: teams
            .filter((team) => !workerAccessScope.loading && workerAccessMatchesTeam(workerAccessScope, team))
            .map((team) => team.name)
            .filter(Boolean),
        workers: workers
            .filter((worker) => !workerAccessScope.loading && workerAccessMatchesWorker(workerAccessScope, worker))
            .map((worker) => worker.name)
            .filter(Boolean),
    }), [date, sites, teams, workerAccessScope, workers]);

    const findWorkerByAnalyzedName = useCallback((workerName?: string | null) => {
        const normalized = normalizeComparableText(workerName);
        if (!normalized) return undefined;
        const matched = workers.find((worker) => normalizeComparableText(worker.name) === normalized) ||
            workers.find((worker) => {
                const candidate = normalizeComparableText(worker.name);
                return Boolean(candidate) && (candidate.includes(normalized) || normalized.includes(candidate));
            });
        return matched && !workerAccessScope.loading && workerAccessMatchesWorker(workerAccessScope, matched)
            ? matched
            : undefined;
    }, [workerAccessScope, workers]);

    const buildSchedulesFromAnalyzedReports = useCallback((reports: AnalyzedDailyReport[], sourceLabel: string) => {
        const rows: ScheduleItem[] = [];
        let unknownWorkerCount = 0;
        let skippedReportCount = 0;
        let totalWorkerCount = 0;

        reports.forEach((report, reportIndex) => {
            const site = findSiteInRows(sites, undefined, report.siteName);
            const siteId = toTrimmedText(site?.id);
            const siteName = toTrimmedText(site?.name) || toTrimmedText(report.siteName);
            const siteSnapshot = buildDailyReportSiteSnapshot({
                site,
                siteId,
                siteName,
                teams,
                companies,
            });
            const reportWorkers = Array.isArray(report.workers)
                ? report.workers.filter((worker) => toTrimmedText(worker?.name))
                : [];
            const workContent = toTrimmedText(report.workContent) ||
                Array.from(new Set(reportWorkers.map((worker) => toTrimmedText(worker.workContent)).filter(Boolean))).join(', ');

            if (!siteName && reportWorkers.length === 0) {
                skippedReportCount += 1;
                return;
            }

            const reportTeam = findTeamInRows(teams, undefined, report.teamName);
            const workerIds: string[] = [];
            const workerManDays: Record<string, number> = {};
            const workerUnitPrices: Record<string, number> = {};
            const workerPayTypes: Record<string, string> = {};
            const workerWorkContents: Record<string, string> = {};
            const workerTeamIds: Record<string, string> = {};
            const workerTeamNames: Record<string, string> = {};
            const supportTeams: ScheduleSupportTeam[] = [];

            reportWorkers.forEach((analyzedWorker, workerIndex) => {
                const worker = findWorkerByAnalyzedName(analyzedWorker.name);
                const analyzedManDay = Number(analyzedWorker.manDay);
                const manDay = Number.isFinite(analyzedManDay) && analyzedManDay > 0 ? analyzedManDay : 1;
                const workerWorkContent = toTrimmedText(analyzedWorker.workContent) || workContent;

                if (worker?.id && !isInactiveWorker(worker)) {
                    const workerId = toTrimmedText(worker.id);
                    const workerTeam = getWorkerAssignedTeam(worker, teamsById, teams) ||
                        findTeamInRows(teams, worker.teamId, worker.teamName || analyzedWorker.teamName || report.teamName);
                    workerIds.push(workerId);
                    workerManDays[workerId] = manDay;
                    workerUnitPrices[workerId] = toFiniteNumber(worker.unitPrice, 0);
                    workerPayTypes[workerId] = resolveScheduleWorkerSalaryType(worker);
                    workerWorkContents[workerId] = workerWorkContent;
                    workerTeamIds[workerId] = toTrimmedText(worker.teamId) || toTrimmedText(workerTeam?.id) || toTrimmedText(reportTeam?.id);
                    workerTeamNames[workerId] = toTrimmedText(worker.teamName) || toTrimmedText(workerTeam?.name) || toTrimmedText(report.teamName);
                    totalWorkerCount += 1;
                    return;
                }

                unknownWorkerCount += 1;
                totalWorkerCount += 1;
                const unknownId = `unknown_kakao_worker_${reportIndex}_${workerIndex}_${normalizeComparableText(analyzedWorker.name) || workerIndex}`;
                supportTeams.push({
                    id: unknownId,
                    name: toTrimmedText(analyzedWorker.name),
                    color: getTeamColor(reportTeam),
                    role: toTrimmedText(analyzedWorker.role) || '작업자',
                    manDay,
                    unitPrice: 0,
                    payType: '일급제',
                    workContent: workerWorkContent,
                    workerId: unknownId,
                });
            });

            const firstWorkerTeamId = workerIds.map((workerId) => workerTeamIds[workerId] || toTrimmedText(workersById.get(workerId)?.teamId)).find(Boolean);
            const teamId =
                toTrimmedText(reportTeam?.id) ||
                firstWorkerTeamId ||
                toTrimmedText(site?.responsibleTeamId) ||
                UNASSIGNED_TEAM_ID;
            const team = findTeamInRows(teams, teamId, report.teamName || site?.responsibleTeamName);
            const teamColor = getTeamColor(team || reportTeam);
            rows.push({
                id: `${date}_${sourceLabel}_${siteId || siteName || reportIndex}_${reportIndex}`,
                date,
                teamId,
                teamName: toTrimmedText(team?.name) || toTrimmedText(report.teamName) || toTrimmedText(site?.responsibleTeamName) || '미배정',
                teamColor,
                siteId,
                siteName,
                siteAddress: toTrimmedText(site?.address),
                siteColor: getSiteColor(site, teamColor),
                clientCompanyName: siteSnapshot.clientCompanyName,
                constructorCompanyName: siteSnapshot.constructorCompanyName,
                partnerName: siteSnapshot.partnerName,
                siteType: siteSnapshot.siteType,
                paymentType: siteSnapshot.paymentType,
                responsibleTeamId: siteSnapshot.responsibleTeamId,
                responsibleTeamName: siteSnapshot.responsibleTeamName,
                siteManagerId: siteSnapshot.siteManagerId,
                siteManagerName: siteSnapshot.siteManagerName,
                workerIds: cleanIds(workerIds),
                supportTeams,
                vehicleIds: [],
                vehicleLabels: [],
                vehicleId: '',
                vehicleLabel: '',
                status: 'draft',
                memo: workContent,
                workerManDays,
                workerUnitPrices,
                workerPayTypes,
                workerWorkContents,
                workerTeamIds,
                workerTeamNames,
            });
        });

        return {
            schedules: mergeSchedulesBySite(rows),
            totalWorkerCount,
            unknownWorkerCount,
            skippedReportCount,
        };
    }, [companies, date, findWorkerByAnalyzedName, getSiteColor, sites, teams, teamsById, workersById]);

    const rosters = useMemo<TeamRoster[]>(() => {
        const activeTeams = teams
            .filter((team) => !workerAccessScope.loading && team.status !== 'closed' && workerAccessMatchesTeam(workerAccessScope, team))
            .sort((left, right) => compareKoreanName(left.name, right.name));
        const activeWorkers = workers.filter((worker) =>
            !workerAccessScope.loading &&
            worker.id &&
            !isInactiveWorker(worker) &&
            workerAccessMatchesWorker(workerAccessScope, worker)
        );
        const rows: TeamRoster[] = activeTeams.map((team) => {
            const memberIds = new Set([...(team.assignedWorkers || []), ...(team.memberIds || [])]);
            const memberNames = new Set((team.memberNames || []).map((name) => normalizeComparableText(name)));
            const teamWorkers = activeWorkers
                .filter((worker) => {
                    return workerMatchesTeam(worker, team, memberIds, memberNames);
                })
                .sort((left, right) => compareKoreanName(left.name, right.name));
            const kind: RosterKind = isSupportTeam(team, teamWorkers) ? 'support' : 'team';

            return {
                id: team.id || team.name,
                name: team.name,
                color: getTeamColor(team),
                kind,
                leaderName: team.leaderName || undefined,
                sourceLabel: getTeamSourceLabel(team, teamWorkers),
                workers: teamWorkers,
            };
        });

        const assignedWorkerIds = new Set(rows.flatMap((row) => row.workers.map((worker) => worker.id || '')));
        const unassignedWorkers = activeWorkers.filter((worker) => worker.id && !assignedWorkerIds.has(worker.id));
        const unassignedRegularWorkers = unassignedWorkers.filter((worker) => !isSupportWorker(worker));

        rows.push(...groupUnassignedWorkers(unassignedRegularWorkers, 'unassigned', '미배정 작업자', UNASSIGNED_TEAM_ID));

        return rows;
    }, [teams, workerAccessScope, workers]);

    const assignedWorkerIdSet = useMemo(() => {
        const set = new Set<string>();
        schedules.forEach((schedule) => schedule.workerIds.forEach((workerId) => workerId && set.add(workerId)));
        return set;
    }, [schedules]);
    const offDutyWorkerIdSet = useMemo(() => new Set(offDutyWorkerIds), [offDutyWorkerIds]);

    const assignedSupportTeamKeySet = useMemo(() => {
        const set = new Set<string>();
        schedules.forEach((schedule) => {
            schedule.supportTeams.forEach((team) => {
                const key = team.id || team.name;
                if (key) set.add(key);
            });
        });
        return set;
    }, [schedules]);

    const assignedVehicleIdSet = useMemo(() => {
        const set = new Set<string>();
        schedules.forEach((schedule) => getScheduleVehicleIds(schedule).forEach((vehicleId) => vehicleId && set.add(vehicleId)));
        return set;
    }, [schedules]);

    const registeredSiteKeySet = useMemo(() => {
        const set = new Set<string>();
        schedules.forEach((schedule) => {
            const key = makeSiteKey(schedule);
            if (key) set.add(key);
        });
        return set;
    }, [schedules]);

    const hasScopedPersonnelAccess = !workerAccessScope.loading && workerAccessScope.mode !== 'all';
    const hasScheduleConfirmationTeamScope = isScheduleConfirmationInput && workerAccessScope.mode === 'team';
    const shouldApplyScheduleConfirmationScope = hasScopedPersonnelAccess;

    const scheduleMatchesViewerScope = useCallback(
        (schedule: ScheduleItem) => workerAccessMatchesSchedule(workerAccessScope, {
            teamId: schedule.teamId,
            teamName: schedule.teamName,
            responsibleTeamId: schedule.responsibleTeamId,
            responsibleTeamName: schedule.responsibleTeamName,
            workerIds: schedule.workerIds,
            workerNames: schedule.workerIds.map((workerId) => workersById.get(workerId)?.name),
            workerTeamIds: Object.values(schedule.workerTeamIds ?? {}),
            workerTeamNames: Object.values(schedule.workerTeamNames ?? {}),
        }),
        [workerAccessScope, workersById]
    );

    const viewerScheduleSiteKeys = useMemo(() => {
        const keys = new Set<string>();
        schedules.filter(scheduleMatchesViewerScope).forEach((schedule) => {
            const siteId = toTrimmedText(schedule.siteId);
            const siteName = normalizeComparableText(schedule.siteName);
            if (siteId) keys.add(`id:${siteId}`);
            if (siteName) keys.add(`name:${siteName}`);
        });
        return keys;
    }, [scheduleMatchesViewerScope, schedules]);

    const siteMatchesViewerScope = useCallback(
        (site: Site) => {
            if (!shouldApplyScheduleConfirmationScope) return true;
            if (workerAccessScope.mode === 'team') {
                return workerAccessMatchesSite(workerAccessScope, site);
            }

            const siteId = toTrimmedText(site.id) || toTrimmedText(site.legacyId);
            const siteName = normalizeComparableText(site.name);
            return (siteId && viewerScheduleSiteKeys.has(`id:${siteId}`)) ||
                (siteName && viewerScheduleSiteKeys.has(`name:${siteName}`));
        },
        [shouldApplyScheduleConfirmationScope, viewerScheduleSiteKeys, workerAccessScope]
    );

    const displaySchedules = useMemo(() => {
        const scopedSchedules = shouldApplyScheduleConfirmationScope
            ? schedules.filter(scheduleMatchesViewerScope)
            : schedules;

        if (!shouldApplyScheduleConfirmationScope || workerAccessScope.mode !== 'team') return scopedSchedules;

        return scopedSchedules
            .map((schedule, index) => ({ schedule, index }))
            .sort((left, right) => {
                const priorityDiff =
                    getScheduleViewerScopePriority(left.schedule, viewerTeamScope, sitesById, teamsById, teams) -
                    getScheduleViewerScopePriority(right.schedule, viewerTeamScope, sitesById, teamsById, teams);
                if (priorityDiff !== 0) return priorityDiff;

                const nameDiff = compareKoreanName(left.schedule.siteName, right.schedule.siteName);
                return nameDiff || left.index - right.index;
            })
            .map(({ schedule }) => schedule);
    }, [
        scheduleMatchesViewerScope,
        schedules,
        shouldApplyScheduleConfirmationScope,
        sitesById,
        teams,
        teamsById,
        viewerTeamScope,
        workerAccessScope.mode,
    ]);

    const visibleScheduleCountLabel = shouldApplyScheduleConfirmationScope
        ? `${displaySchedules.length}/${schedules.length}`
        : `${schedules.length}`;

    const availableRosters = useMemo(
        () =>
            rosters
                .map((roster) => {
                    if (roster.kind === 'support') {
                        const availableWorkers = roster.workers.filter((worker) => worker.id && !assignedWorkerIdSet.has(worker.id) && !offDutyWorkerIdSet.has(worker.id));
                        return isPersonnelInputMode || roster.workers.length > 0
                            ? {
                                ...roster,
                                workers: availableWorkers,
                            }
                            : roster;
                    }
                    return {
                        ...roster,
                        workers: roster.workers.filter((worker) => worker.id && !assignedWorkerIdSet.has(worker.id) && !offDutyWorkerIdSet.has(worker.id)),
                    };
                })
                .filter((roster) => {
                    if (roster.kind === 'support') {
                        return isPersonnelInputMode
                            ? roster.workers.length > 0
                            : !assignedSupportTeamKeySet.has(roster.id || roster.name);
                    }
                    return roster.workers.length > 0;
                }),
        [assignedSupportTeamKeySet, assignedWorkerIdSet, isPersonnelInputMode, offDutyWorkerIdSet, rosters]
    );

    const panelRosters = useMemo(
        () =>
            availableRosters.filter((roster) =>
                leftPanelTab === 'support' ? roster.kind === 'support' : roster.kind !== 'support'
            ).sort(compareRosterPanelOrder),
        [availableRosters, leftPanelTab]
    );

    const filteredRosters = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return panelRosters;
        return panelRosters.filter((roster) => {
            const workerNames = roster.workers.map((worker) => `${worker.name} ${worker.role || ''}`).join(' ');
            return `${roster.name} ${roster.sourceLabel || ''} ${roster.leaderName || ''} ${workerNames}`.toLowerCase().includes(term);
        }).sort(compareRosterPanelOrder);
    }, [panelRosters, searchTerm]);
    const displayFilteredRosters = useMemo(
        () => offDutySelectionMode ? filteredRosters.filter((roster) => roster.workers.length > 0) : filteredRosters,
        [filteredRosters, offDutySelectionMode]
    );

    const filteredVehicles = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        return vehicles
            .filter((vehicle) => {
                if (assignedVehicleIdSet.has(vehicle.id)) return false;
                if (hasScopedPersonnelAccess) {
                    if (workerAccessScope.mode !== 'team') return false;
                    const assignedTeam = getVehicleAssignedTeam(vehicle, teamsById, teams, workersById, workers);
                    if (!assignedTeam || !workerAccessMatchesTeam(workerAccessScope, assignedTeam)) return false;
                }
                if (!term) return true;
                return `${vehicle.licensePlate} ${vehicle.model || ''} ${vehicle.currentAssigneeName || ''}`.toLowerCase().includes(term);
            })
            .sort((left, right) => compareKoreanName(left.licensePlate || left.model, right.licensePlate || right.model));
    }, [assignedVehicleIdSet, hasScopedPersonnelAccess, searchTerm, teams, teamsById, vehicles, workerAccessScope, workers, workersById]);

    const vehicleAssignedTeamColorById = useMemo(() => {
        const map = new Map<string, string>();
        vehicles.forEach((vehicle) => {
            const assignedTeam = getVehicleAssignedTeam(vehicle, teamsById, teams, workersById, workers);
            const color = normalizeColor(assignedTeam?.color);
            if (vehicle.id && color) map.set(vehicle.id, color);
        });
        return map;
    }, [teams, teamsById, vehicles, workers, workersById]);

    const workerTeamColorById = useMemo(() => {
        const map = new Map<string, string>();
        workers.forEach((worker) => {
            const assignedTeam = getWorkerAssignedTeam(worker, teamsById, teams);
            const color = normalizeColor(assignedTeam?.color) || normalizeColor(worker.color);
            if (worker.id && color) map.set(worker.id, color);
        });
        return map;
    }, [teams, teamsById, workers]);

    const filteredSites = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        return sites
            .filter((site) => {
                if (registeredSiteKeySet.has(makeSiteSelectionKey(site))) return false;
                if (!siteMatchesViewerScope(site)) return false;
                if (!term) return true;
                return `${site.name} ${site.address || ''} ${site.responsibleTeamName || ''} ${site.companyName || ''} ${site.code || ''}`
                    .toLowerCase()
                    .includes(term);
            })
            .sort((left, right) => {
                if (shouldApplyScheduleConfirmationScope) {
                    const priorityDiff =
                        getSiteViewerScopePriority(left, viewerTeamScope, teamsById, teams) -
                        getSiteViewerScopePriority(right, viewerTeamScope, teamsById, teams);
                    if (priorityDiff !== 0) return priorityDiff;
                }

                return compareKoreanName(left.name, right.name);
            });
    }, [
        registeredSiteKeySet,
        searchTerm,
        shouldApplyScheduleConfirmationScope,
        siteMatchesViewerScope,
        sites,
        teams,
        teamsById,
        viewerTeamScope,
    ]);

    useEffect(() => {
        if (!shouldApplyScheduleConfirmationScope || !selectedSiteId) return;
        const selectedSite = sitesById.get(selectedSiteId);
        if (!selectedSite || siteMatchesViewerScope(selectedSite)) return;
        setSelectedSiteId('');
    }, [selectedSiteId, shouldApplyScheduleConfirmationScope, siteMatchesViewerScope, sitesById]);

    const selectedRoster = useMemo(
        () => availableRosters.find((roster) => roster.id === selectedTeamId) || availableRosters[0],
        [availableRosters, selectedTeamId]
    );
    const selectedWorkerIdSet = useMemo(() => new Set(selectedWorkerIds), [selectedWorkerIds]);
    const offDutyDraftWorkerIdSet = useMemo(() => new Set(offDutyDraftWorkerIds), [offDutyDraftWorkerIds]);
    const selectedSupportTeamIdSet = useMemo(() => new Set(selectedSupportTeamIds), [selectedSupportTeamIds]);
    const selectedVehicleIdSet = useMemo(() => new Set(selectedVehicleIds), [selectedVehicleIds]);
    const selectedWorkers = useMemo(
        () => selectedWorkerIds.map((workerId) => workersById.get(workerId)).filter((worker): worker is Worker => Boolean(worker)),
        [selectedWorkerIds, workersById]
    );
    const offDutyWorkers = useMemo(
        () =>
            offDutyWorkerIds
                .map((workerId) => workersById.get(workerId))
                .filter((worker): worker is Worker => Boolean(worker))
                .sort((left, right) => compareKoreanName(left.name, right.name)),
        [offDutyWorkerIds, workersById]
    );
    const offDutyWorkerGroups = useMemo(() => {
        const groups = new Map<string, { id: string; name: string; color: string; workers: Worker[] }>();
        offDutyWorkers.forEach((worker) => {
            const assignedTeam = getWorkerAssignedTeam(worker, teamsById, teams);
            const groupId = assignedTeam?.id || toTrimmedText(worker.teamId) || toTrimmedText(worker.teamName) || 'unassigned';
            const groupName = assignedTeam?.name || toTrimmedText(worker.teamName) || '팀 미지정';
            const groupColor = getTeamColor(assignedTeam);
            if (!groups.has(groupId)) {
                groups.set(groupId, { id: groupId, name: groupName, color: groupColor, workers: [] });
            }
            groups.get(groupId)?.workers.push(worker);
        });
        return Array.from(groups.values()).sort((left, right) => compareKoreanName(left.name, right.name));
    }, [offDutyWorkers, teams, teamsById]);
    const selectedSupportTeams = useMemo(
        () => selectedSupportTeamIds.map((teamId) => availableRosters.find((roster) => roster.id === teamId)).filter((team): team is TeamRoster => Boolean(team)),
        [availableRosters, selectedSupportTeamIds]
    );
    const selectedVehicles = useMemo(
        () => selectedVehicleIds.map((vehicleId) => vehiclesById.get(vehicleId)).filter((vehicle): vehicle is Vehicle => Boolean(vehicle)),
        [selectedVehicleIds, vehiclesById]
    );
    const isSupportScheduleItem = useCallback(
        (schedule: ScheduleItem) => {
            const scheduleRoster = rosters.find((roster) => roster.id === schedule.teamId);
            return schedule.supportTeams.length > 0 || scheduleRoster?.kind === 'support' || includesSupportKeyword(schedule.teamName);
        },
        [rosters]
    );

    const getScheduleIssues = useCallback(
        (schedule: ScheduleItem, allSchedules = schedules) => {
            const issues: string[] = [];
            const isSupportSchedule = isSupportScheduleItem(schedule);
            if (!schedule.siteId && !schedule.siteName.trim()) issues.push('현장이 선택되지 않았습니다.');

            const requestedHeadcount = Number(schedule.requestedHeadcount || 0);
            if (requestedHeadcount > 0) {
                const assignedHeadcount = getAssignedHeadcount(schedule);
                if (assignedHeadcount < requestedHeadcount) {
                    issues.push(`요청 ${requestedHeadcount}명 / 배치 ${assignedHeadcount}명`);
                }
                if (assignedHeadcount > requestedHeadcount) {
                    issues.push(`요청보다 ${assignedHeadcount - requestedHeadcount}명 초과`);
                }
            }
            schedule.workerIds.forEach((workerId) => {
                if (!offDutyWorkerIdSet.has(workerId)) return;
                const workerName = workersById.get(workerId)?.name || '휴무자';
                issues.push(`${workerName} 휴무 요청자 배치`);
            });

            if (isPersonnelInputMode) {
                if (schedule.workerIds.length === 0 && schedule.supportTeams.length === 0) {
                    issues.push(isScheduleConfirmationInput ? '확정할 작업자 또는 지원팀이 없습니다.' : '출력일보 작업자 또는 지원팀이 없습니다.');
                }
                schedule.workerIds.forEach((workerId) => {
                    const worker = workersById.get(workerId);
                    const duplicated = allSchedules.filter((entry) => entry.workerIds.includes(workerId));
                    if (duplicated.length > 1) issues.push(`${worker?.name || '작업자'} 중복 입력`);
                });
                return Array.from(new Set(issues));
            }

            const scheduleVehicleIds = getScheduleVehicleIds(schedule);
            const hasAssignedResources =
                schedule.workerIds.length > 0 || schedule.supportTeams.length > 0 || scheduleVehicleIds.length > 0;
            if (hasAssignedResources && scheduleVehicleIds.length === 0) issues.push('차량이 등록되지 않았습니다.');
            if (hasAssignedResources && !isSupportSchedule && schedule.workerIds.length === 0) {
                issues.push('작업자 또는 지원팀이 없습니다.');
            }

            schedule.workerIds.forEach((workerId) => {
                const worker = workersById.get(workerId);
                const duplicated = allSchedules.filter((entry) => entry.workerIds.includes(workerId));
                if (duplicated.length > 1) issues.push(`${worker?.name || '작업자'} 중복 배정`);
            });

            scheduleVehicleIds.forEach((vehicleId) => {
                const vehicle = vehiclesById.get(vehicleId);
                const duplicated = allSchedules.filter((entry) => getScheduleVehicleIds(entry).includes(vehicleId));
                if (duplicated.length > 1) issues.push(`${vehicle?.licensePlate || '차량'} 중복 배정`);
            });

            return Array.from(new Set(issues));
        },
        [isPersonnelInputMode, isScheduleConfirmationInput, isSupportScheduleItem, offDutyWorkerIdSet, schedules, vehiclesById, workersById]
    );

    const totalIssues = useMemo(
        () => displaySchedules.reduce((count, schedule) => count + getScheduleIssues(schedule).length, 0),
        [displaySchedules, getScheduleIssues]
    );

    const mapAssignmentToSchedule = useCallback(
        (assignment: DispatchAssignment, index: number): ScheduleItem => {
            const raw = assignment as DispatchAssignment & Partial<ScheduleItem> & { supportTeamIds?: string[] };
            const rawWorkerIds = cleanIds(assignment.workerIds || []).filter((workerId) => {
                const worker = workersById.get(workerId);
                return Boolean(worker && !isInactiveWorker(worker));
            });
            const firstWorkerTeamId = rawWorkerIds.map((workerId) => workersById.get(workerId)?.teamId || '').find(Boolean);
            const rawTeamId = raw.teamId || firstWorkerTeamId;
            const team = findTeamInRows(teams, rawTeamId, raw.teamName || assignment.teamName);
            const teamId = rawTeamId || toTrimmedText(team?.id) || UNASSIGNED_TEAM_ID;
            const vehicleIds = cleanIds([...(raw.vehicleIds || []), ...(assignment.vehicleIds || []), raw.vehicleId]);
            const site = assignment.siteId ? sitesById.get(assignment.siteId) : undefined;
            const teamColor = getTeamColorWithFallback(team, raw.teamColor);
            const isSupportAssignment = Boolean(team && isSupportTeam(team, []));
            const workerIds = isSupportAssignment && !isPersonnelInputMode ? [] : rawWorkerIds;
            const supportTeams = mergeSupportTeams([
                ...(raw.supportTeams || []).map((supportTeam) => {
                    const currentSupportTeam = findTeamInRows(teams, supportTeam.id, supportTeam.name);
                    return {
                        ...supportTeam,
                        color: getTeamColorWithFallback(currentSupportTeam, supportTeam.color),
                    };
                }),
                ...(raw.supportTeamIds || []).map((supportTeamId) => {
                    const supportTeam = findTeamInRows(teams, supportTeamId);
                    return {
                        id: supportTeamId,
                        name: supportTeam?.name || supportTeamId,
                        color: getTeamColor(supportTeam),
                    };
                }),
                ...(isSupportAssignment && team && (!isPersonnelInputMode || workerIds.length === 0) ? [{ id: teamId, name: team.name, color: teamColor }] : []),
            ]);
            const vehicleLabels = vehicleIds.map((id) => vehiclesById.get(id)?.licensePlate || raw.vehicleLabel || '');
            const vehicleTeamColors =
                raw.vehicleTeamColors ||
                buildVehicleTeamColorsFromRows(vehicleIds, vehiclesById, teamsById, teams, workersById, workers);

            return {
                id: raw.id || `${date}_${teamId}_${assignment.siteId || 'site'}_${index}`,
                date,
                teamId,
                teamName: team?.name || raw.teamName || '미배정',
                teamColor,
                siteId: assignment.siteId || '',
                siteName: assignment.siteName || site?.name || '',
                siteAddress: raw.siteAddress || site?.address || '',
                siteColor: getSiteColor(site, teamColor),
                clientCompanyName: toTrimmedText(site?.clientCompanyName) || raw.clientCompanyName,
                constructorCompanyName: toTrimmedText(site?.companyName) || toTrimmedText(site?.constructorCompanyName) || raw.constructorCompanyName,
                partnerName: toTrimmedText(site?.partnerName) || raw.partnerName,
                siteType: getSiteType(site, raw.siteType),
                paymentType: getPaymentType(site, raw.paymentType),
                responsibleTeamId: toTrimmedText(site?.responsibleTeamId) || raw.responsibleTeamId,
                responsibleTeamName: toTrimmedText(site?.responsibleTeamName) || raw.responsibleTeamName,
                siteManagerId: toTrimmedText((site as any)?.siteManagerId) || raw.siteManagerId,
                siteManagerName: toTrimmedText((site as any)?.siteManagerName) || raw.siteManagerName,
                requestId: raw.requestId,
                requestedHeadcount: raw.requestedHeadcount,
                requestedRoles: raw.requestedRoles,
                requestMemo: raw.requestMemo,
                requestPriority: raw.requestPriority,
                requestStatus: raw.requestStatus,
                workerIds,
                supportTeams,
                vehicleIds,
                vehicleLabels,
                vehicleTeamColors,
                vehicleId: vehicleIds[0] || '',
                vehicleLabel: vehicleLabels[0] || '',
                status: (raw.status as ScheduleStatus) || 'confirmed',
                memo: assignment.note || raw.memo || '',
                workerManDays: raw.workerManDays || Object.fromEntries(workerIds.map((workerId) => [workerId, 1])),
                workerUnitPrices: raw.workerUnitPrices || Object.fromEntries(workerIds.map((workerId) => [workerId, workersById.get(workerId)?.unitPrice || 0])),
                workerPayTypes: raw.workerPayTypes || Object.fromEntries(workerIds.map((workerId) => [workerId, resolveScheduleWorkerSalaryType(workersById.get(workerId))])),
                workerWorkContents: raw.workerWorkContents || Object.fromEntries(workerIds.map((workerId) => [workerId, raw.memo || assignment.note || ''])),
                workerTeamIds: raw.workerTeamIds || Object.fromEntries(workerIds.map((workerId) => {
                    const worker = workersById.get(workerId);
                    const assignedTeam = getWorkerAssignedTeam(worker, teamsById, teams);
                    return [workerId, toTrimmedText(worker?.teamId) || toTrimmedText(assignedTeam?.id)];
                })),
                workerTeamNames: raw.workerTeamNames || Object.fromEntries(workerIds.map((workerId) => {
                    const worker = workersById.get(workerId);
                    const assignedTeam = getWorkerAssignedTeam(worker, teamsById, teams);
                    return [workerId, toTrimmedText(worker?.teamName) || toTrimmedText(assignedTeam?.name)];
                })),
            };
        },
        [date, getSiteColor, isPersonnelInputMode, sitesById, teams, teamsById, vehiclesById, workers, workersById]
    );

    const buildDailyReportsFromSchedules = useCallback((sourceSchedules: ScheduleItem[]) => {
        const reportGroups = new Map<string, {
            site: Site;
            siteSnapshot: DailyReportSiteSnapshot;
            teamId: string;
            teamName: string;
            workContent: string;
            workers: any[];
        }>();
        let skippedScheduleCount = 0;
        let skippedWorkerCount = 0;
        let supportTeamCount = 0;
        let totalWorkerCount = 0;
        const involvedTeamIds = new Set<string>();

        const appendReportWorker = (
            schedule: ScheduleItem,
            site: Site,
            resolvedTeamId: string,
            fallbackTeamName: string,
            workerRow: any
        ) => {
            const siteSnapshot = buildDailyReportSiteSnapshot({
                site,
                siteId: schedule.siteId,
                siteName: schedule.siteName,
                teams,
                companies,
                fallback: schedule,
            });
            const siteId = siteSnapshot.siteId || toTrimmedText(site.id) || toTrimmedText(schedule.siteId);
            const responsibleTeam = findTeamInRows(teams, siteSnapshot.responsibleTeamId, siteSnapshot.responsibleTeamName);
            const reportTeam = responsibleTeam || findTeamInRows(teams, resolvedTeamId, fallbackTeamName);
            const reportTeamId = toTrimmedText(reportTeam?.id) || siteSnapshot.responsibleTeamId || resolvedTeamId;
            const reportTeamName = toTrimmedText(reportTeam?.name) || siteSnapshot.responsibleTeamName || fallbackTeamName;
            const groupKey = `${siteId}:${reportTeamId}`;
            const siteWorkContent = toTrimmedText(schedule.memo);
            const reportSnapshot = {
                ...siteSnapshot,
                responsibleTeamId: reportTeamId,
                responsibleTeamName: reportTeamName,
            };

            if (reportTeamId) involvedTeamIds.add(reportTeamId);
            if (toTrimmedText(workerRow.teamId)) involvedTeamIds.add(toTrimmedText(workerRow.teamId));

            if (!reportGroups.has(groupKey)) {
                reportGroups.set(groupKey, {
                    site,
                    siteSnapshot: reportSnapshot,
                    teamId: reportTeamId,
                    teamName: reportTeamName,
                    workContent: siteWorkContent,
                    workers: [],
                });
            }

            const group = reportGroups.get(groupKey)!;
            if (siteWorkContent && !group.workContent.includes(siteWorkContent)) {
                group.workContent = group.workContent ? `${group.workContent}, ${siteWorkContent}` : siteWorkContent;
            }
            group.workers.push({
                ...workerRow,
                siteType: reportSnapshot.siteType,
                paymentType: reportSnapshot.paymentType,
            });
            totalWorkerCount += 1;
        };

        sourceSchedules.forEach((schedule) => {
            const site = findSiteInRows(sites, schedule.siteId, schedule.siteName);
            const siteId = toTrimmedText(site?.id) || toTrimmedText(schedule.siteId);
            if (!site || !siteId) {
                skippedScheduleCount += 1;
                return;
            }

            const scheduleTeamId = schedule.teamId !== UNASSIGNED_TEAM_ID ? toTrimmedText(schedule.teamId) : '';
            const scheduleWorkContent = toTrimmedText(schedule.memo);

            cleanIds(schedule.workerIds).forEach((workerId) => {
                const worker = workersById.get(workerId);
                if (!worker || isInactiveWorker(worker)) {
                    skippedWorkerCount += 1;
                    return;
                }

                const workerAssignedTeam = getWorkerAssignedTeam(worker, teamsById, teams);
                const mappedWorkerTeamId =
                    toTrimmedText(schedule.workerTeamIds?.[workerId]) ||
                    toTrimmedText(worker.teamId) ||
                    toTrimmedText(workerAssignedTeam?.id);
                const mappedWorkerTeamName =
                    toTrimmedText(schedule.workerTeamNames?.[workerId]) ||
                    toTrimmedText(worker.teamName) ||
                    toTrimmedText(workerAssignedTeam?.name);
                const resolvedTeamId =
                    mappedWorkerTeamId ||
                    scheduleTeamId ||
                    toTrimmedText(site.responsibleTeamId);
                if (!resolvedTeamId) {
                    skippedWorkerCount += 1;
                    return;
                }

                const team = findTeamInRows(teams, resolvedTeamId, mappedWorkerTeamName || schedule.teamName);
                const salaryType = normalizeDailyPayType(schedule.workerPayTypes?.[workerId]) || resolveScheduleWorkerSalaryType(worker);
                const defaultUnitPrice = toFiniteNumber(worker.unitPrice, 0) || (salaryType === '지원팀' ? getSupportTeamUnitPrice(team) : 0);
                const unitPrice = toFiniteNumber(schedule.workerUnitPrices?.[workerId], defaultUnitPrice);
                const manDay = toPositiveNumber(schedule.workerManDays?.[workerId], 1);
                appendReportWorker(schedule, site, resolvedTeamId, mappedWorkerTeamName || toTrimmedText(schedule.teamName), {
                    salaryModel: salaryType,
                    payType: salaryType,
                    workerId: toTrimmedText(worker.id) || workerId,
                    name: worker.name,
                    role: worker.role || '작업자',
                    status: 'attendance' as const,
                    manDay,
                    workContent: scheduleWorkContent,
                    teamId: resolvedTeamId,
                    unitPrice,
                    workerTeamId: mappedWorkerTeamId || resolvedTeamId,
                    workerTeamName: toTrimmedText(team?.name) || mappedWorkerTeamName || toTrimmedText(schedule.teamName),
                });
            });

            schedule.supportTeams.forEach((supportTeam) => {
                supportTeamCount += 1;
                const unknownAnalyzedWorker = toTrimmedText(supportTeam.workerId).startsWith('unknown_kakao_worker_') ||
                    toTrimmedText(supportTeam.id).startsWith('unknown_kakao_worker_');
                const resolvedTeamId =
                    (unknownAnalyzedWorker ? '' : toTrimmedText(supportTeam.id)) ||
                    scheduleTeamId ||
                    toTrimmedText(site.responsibleTeamId);
                if (!resolvedTeamId) {
                    skippedWorkerCount += 1;
                    return;
                }

                const team = findTeamInRows(teams, resolvedTeamId, supportTeam.name);
                const salaryType = getSupportTeamPayType(team, supportTeam.payType);
                const unitPrice = getSupportTeamUnitPrice(team, supportTeam.unitPrice);
                const manDay = toPositiveNumber(supportTeam.manDay, 1);
                const workerId = toTrimmedText(supportTeam.workerId) || `unknown_support_${resolvedTeamId}`;
                const teamName = toTrimmedText(team?.name) || toTrimmedText(supportTeam.name);
                const workerName = unknownAnalyzedWorker
                    ? toTrimmedText(supportTeam.name) || teamName
                    : teamName;

                appendReportWorker(schedule, site, resolvedTeamId, teamName, {
                    salaryModel: salaryType,
                    payType: salaryType,
                    workerId,
                    name: workerName,
                    role: unknownAnalyzedWorker ? supportTeam.role || '작업자' : supportTeam.role || '팀',
                    status: 'attendance' as const,
                    manDay,
                    workContent: scheduleWorkContent,
                    teamId: resolvedTeamId,
                    unitPrice,
                    workerTeamId: resolvedTeamId,
                    workerTeamName: teamName,
                });
            });
        });

        const reports = Array.from(reportGroups.values()).map((group) => {
            const totalManDay = group.workers.reduce((sum, worker) => sum + Number(worker.manDay || 0), 0);
            const totalAmount = group.workers.reduce(
                (sum, worker) => sum + Number(worker.manDay || 0) * Number(worker.unitPrice || 0),
                0
            );
            const responsibleTeamId = group.siteSnapshot.responsibleTeamId || group.teamId;
            const responsibleTeamName = group.siteSnapshot.responsibleTeamName || group.teamName;

            return applyDailyReportSiteSnapshotToReport({
                date,
                teamId: group.teamId,
                teamName: group.teamName,
                siteId: group.siteSnapshot.siteId || toTrimmedText(group.site.id),
                siteName: group.siteSnapshot.siteName || group.site.name,
                writerId: currentUser?.uid || 'unknown',
                workers: group.workers,
                totalManDay,
                totalAmount,
                responsibleTeamId,
                responsibleTeamName,
                workContent: group.workContent,
                siteType: group.siteSnapshot.siteType,
                paymentType: group.siteSnapshot.paymentType,
            }, {
                ...group.siteSnapshot,
                responsibleTeamId,
                responsibleTeamName,
            }) as Omit<DailyReport, 'id'>;
        });

        return {
            reports,
            involvedTeamIds: Array.from(involvedTeamIds),
            skippedScheduleCount,
            skippedWorkerCount,
            supportTeamCount,
            totalWorkerCount,
        };
    }, [companies, currentUser?.uid, date, sites, teams, teamsById, workersById]);

    const loadData = useCallback(async () => {
        setLoading(true);
        setMessage('');

        try {
            const [teamRows, workerRows, siteRows, companyRows, vehicleRows] = await Promise.all([
                teamService.getTeams(),
                manpowerService.getWorkers(),
                siteService.getSites(),
                companyService.getCompanies(),
                vehicleService.getVehicles(),
            ]);

            setTeams(teamRows);
            setWorkers(workerRows);
            const visibleSiteRows = isDailyReportInput ? getOpenSites(siteRows) : siteRows;

            setSites(visibleSiteRows);
            setCompanies(companyRows);
            setVehicles(vehicleRows);

            const workerMap = new Map<string, Worker>();
            workerRows.forEach((worker) => {
                if (worker.id) workerMap.set(worker.id, worker);
                if (worker.legacyId) workerMap.set(String(worker.legacyId), worker);
            });
            const teamMap = new Map<string, Team>();
            teamRows.forEach((team) => {
                if (team.id) teamMap.set(team.id, team);
                if (team.legacyId) teamMap.set(String(team.legacyId), team);
            });
            const siteMap = new Map<string, Site>();
            siteRows.forEach((site) => {
                if (site.id) siteMap.set(site.id, site);
                if (site.legacyId) siteMap.set(String(site.legacyId), site);
            });
            const vehicleMap = new Map(vehicleRows.map((vehicle) => [vehicle.id, vehicle]));
            const getLoadedSiteColor = (site?: Site, fallbackColor = DEFAULT_RESOURCE_COLOR) => {
                const responsibleTeam =
                    (site?.responsibleTeamId ? teamMap.get(site.responsibleTeamId) : undefined) ||
                    teamRows.find((team) => team.name === site?.responsibleTeamName);
                const responsibleTeamColor = normalizeColor(responsibleTeam?.color);
                if (responsibleTeamColor) return responsibleTeamColor;

                const directSiteColor = normalizeColor(site?.color);
                if (directSiteColor) return directSiteColor;

                return fallbackColor;
            };
            const requestRows: FieldScheduleRequest[] = !isDailyReportInput && !isScheduleConfirmationInput
                ? await fieldScheduleRequestService.listByDate(date)
                : [];

            if (isDailyReportInput) {
                const reports = await dailyReportService.getReports(date);
                const dailySchedules = mapDailyReportsToSchedules(reports, date, workerMap, teamMap, siteRows, teamRows, companyRows);
                setSchedules(dailySchedules);
                setSelectedTeamId((prev) => prev || teamRows[0]?.id || UNASSIGNED_TEAM_ID);
                setSelectedSiteId((prev) => (prev && visibleSiteRows.some((site) => site.id === prev) ? prev : ''));
                setDirty(false);
                return;
            }

            const savedAssignments = isScheduleConfirmationInput
                ? (await scheduleConfirmationBoardService.getBoardByDate(date))?.assignments || []
                : (await dispatchService.getDispatchByDate(date))?.assignments || [];
            const nextSchedules = savedAssignments.map((assignment, index) => {
                const raw = assignment as DispatchAssignment & Partial<ScheduleItem> & { supportTeamIds?: string[] };
                const rawWorkerIds = cleanIds(assignment.workerIds || []).filter((workerId) => {
                    const worker = workerMap.get(workerId);
                    return Boolean(worker && !isInactiveWorker(worker));
                });
                const rawTeamId =
                    raw.teamId ||
                    rawWorkerIds.map((workerId) => workerMap.get(workerId)?.teamId || '').find(Boolean);
                const team = findTeamInRows(teamRows, rawTeamId, raw.teamName || assignment.teamName);
                const teamId = rawTeamId || toTrimmedText(team?.id) || UNASSIGNED_TEAM_ID;
                const site = assignment.siteId ? siteMap.get(assignment.siteId) : undefined;
                const vehicleIds = cleanIds([...(raw.vehicleIds || []), ...(assignment.vehicleIds || []), raw.vehicleId]);
                const teamColor = getTeamColorWithFallback(team, raw.teamColor);
                const isSupportAssignment = Boolean(team && isSupportTeam(team, []));
                const workerIds = isSupportAssignment && !isPersonnelInputMode ? [] : rawWorkerIds;
                const supportTeams = mergeSupportTeams([
                    ...(raw.supportTeams || []).map((supportTeam) => {
                        const currentSupportTeam = findTeamInRows(teamRows, supportTeam.id, supportTeam.name);
                        return {
                            ...supportTeam,
                            color: getTeamColorWithFallback(currentSupportTeam, supportTeam.color),
                        };
                    }),
                    ...(raw.supportTeamIds || []).map((supportTeamId) => {
                        const supportTeam = findTeamInRows(teamRows, supportTeamId);
                        return {
                            id: supportTeamId,
                            name: supportTeam?.name || supportTeamId,
                            color: getTeamColor(supportTeam),
                        };
                    }),
                    ...(isSupportAssignment && team && (!isPersonnelInputMode || workerIds.length === 0) ? [{ id: teamId, name: team.name, color: teamColor }] : []),
                ]);
                const vehicleLabels = vehicleIds.map((id) => vehicleMap.get(id)?.licensePlate || raw.vehicleLabel || '');
                const vehicleTeamColors =
                    raw.vehicleTeamColors ||
                    buildVehicleTeamColorsFromRows(vehicleIds, vehicleMap, teamMap, teamRows, workerMap, workerRows);

                return {
                    id: raw.id || `${date}_${teamId}_${assignment.siteId || 'site'}_${index}`,
                    date,
                    teamId,
                    teamName: team?.name || raw.teamName || '미배정',
                    teamColor,
                    siteId: assignment.siteId || '',
                    siteName: assignment.siteName || site?.name || '',
                    siteAddress: raw.siteAddress || site?.address || '',
                    siteColor: getLoadedSiteColor(site, teamColor),
                    clientCompanyName: toTrimmedText(site?.clientCompanyName) || raw.clientCompanyName,
                    constructorCompanyName: toTrimmedText(site?.companyName) || toTrimmedText(site?.constructorCompanyName) || raw.constructorCompanyName,
                    partnerName: toTrimmedText(site?.partnerName) || raw.partnerName,
                    siteType: getSiteType(site, raw.siteType),
                    paymentType: getPaymentType(site, raw.paymentType),
                    responsibleTeamId: toTrimmedText(site?.responsibleTeamId) || raw.responsibleTeamId,
                    responsibleTeamName: toTrimmedText(site?.responsibleTeamName) || raw.responsibleTeamName,
                    siteManagerId: toTrimmedText((site as any)?.siteManagerId) || raw.siteManagerId,
                    siteManagerName: toTrimmedText((site as any)?.siteManagerName) || raw.siteManagerName,
                    requestId: raw.requestId,
                    requestedHeadcount: raw.requestedHeadcount,
                    requestedRoles: raw.requestedRoles,
                    requestMemo: raw.requestMemo,
                    requestPriority: raw.requestPriority,
                    requestStatus: raw.requestStatus,
                    workerIds,
                    supportTeams,
                    vehicleIds,
                    vehicleLabels,
                    vehicleTeamColors,
                    vehicleId: vehicleIds[0] || '',
                    vehicleLabel: vehicleLabels[0] || '',
                    status: (raw.status as ScheduleStatus) || 'confirmed',
                    memo: assignment.note || raw.memo || '',
                    workerManDays: raw.workerManDays || Object.fromEntries(workerIds.map((workerId) => [workerId, 1])),
                    workerUnitPrices: raw.workerUnitPrices || Object.fromEntries(workerIds.map((workerId) => [workerId, workerMap.get(workerId)?.unitPrice || 0])),
                    workerPayTypes: raw.workerPayTypes || Object.fromEntries(workerIds.map((workerId) => [workerId, resolveScheduleWorkerSalaryType(workerMap.get(workerId))])),
                    workerWorkContents: raw.workerWorkContents || Object.fromEntries(workerIds.map((workerId) => [workerId, raw.memo || assignment.note || ''])),
                    workerTeamIds: raw.workerTeamIds || Object.fromEntries(workerIds.map((workerId) => {
                        const worker = workerMap.get(workerId);
                        const assignedTeam = getWorkerAssignedTeam(worker, teamMap, teamRows);
                        return [workerId, toTrimmedText(worker?.teamId) || toTrimmedText(assignedTeam?.id)];
                    })),
                    workerTeamNames: raw.workerTeamNames || Object.fromEntries(workerIds.map((workerId) => {
                        const worker = workerMap.get(workerId);
                        const assignedTeam = getWorkerAssignedTeam(worker, teamMap, teamRows);
                        return [workerId, toTrimmedText(worker?.teamName) || toTrimmedText(assignedTeam?.name)];
                    })),
                } satisfies ScheduleItem;
            });

            const requestSchedules: ScheduleItem[] = requestRows
                .filter((request) =>
                    request.status !== 'cancelled' &&
                    !isOffDutyOnlyFieldScheduleRequest(request) &&
                    Number(request.requestedHeadcount || 0) > 0
                )
                .map((request, index) => {
                    const site = siteMap.get(request.siteId) || siteRows.find((entry) => entry.name === request.siteName);
                    const responsibleTeam =
                        (request.responsibleTeamId ? teamMap.get(request.responsibleTeamId) : undefined) ||
                        (site?.responsibleTeamId ? teamMap.get(site.responsibleTeamId) : undefined) ||
                        teamRows.find((team) => team.name === request.responsibleTeamName || team.name === site?.responsibleTeamName);
                    const siteColor = getLoadedSiteColor(site, getTeamColorWithFallback(responsibleTeam, request.siteColor));
                    return {
                        id: `request-${request.id || `${date}-${index}`}`,
                        date,
                        teamId: '',
                        teamName: '',
                        teamColor: siteColor,
                        siteId: request.siteId || site?.id || '',
                        siteName: request.siteName || site?.name || '',
                        siteAddress: request.siteAddress || site?.address || '',
                        siteColor,
                        clientCompanyName: toTrimmedText(site?.clientCompanyName),
                        constructorCompanyName: toTrimmedText(site?.companyName) || toTrimmedText(site?.constructorCompanyName),
                        partnerName: toTrimmedText(site?.partnerName),
                        siteType: getSiteType(site),
                        paymentType: getPaymentType(site),
                        responsibleTeamId: request.responsibleTeamId || toTrimmedText(site?.responsibleTeamId),
                        responsibleTeamName: request.responsibleTeamName || toTrimmedText(site?.responsibleTeamName),
                        siteManagerId: request.siteManagerId || toTrimmedText((site as any)?.siteManagerId),
                        siteManagerName: request.siteManagerName || toTrimmedText((site as any)?.siteManagerName),
                        workerIds: [],
                        supportTeams: [],
                        vehicleIds: [],
                        vehicleLabels: [],
                        vehicleId: '',
                        vehicleLabel: '',
                        status: 'draft',
                        memo: '',
                        workerManDays: {},
                        workerUnitPrices: {},
                        workerPayTypes: {},
                        workerWorkContents: {},
                        workerTeamIds: {},
                        workerTeamNames: {},
                        requestId: request.id,
                        requestedHeadcount: request.requestedHeadcount,
                        requestedRoles: request.requestedRoles,
                        requestMemo: request.memo,
                        requestPriority: request.priority,
                        requestStatus: request.status,
                    };
                });
            if (!isScheduleConfirmationInput) {
                setOffDutyWorkerIds(cleanIds([
                    ...requestRows.flatMap((request) => request.offDutyWorkerIds || []),
                    ...savedAssignments.flatMap((assignment) => {
                        const raw = assignment as Partial<ScheduleItem>;
                        return raw.offDutyWorkerIds || [];
                    }),
                ]));
            }
            setSchedules(mergeSchedulesBySite([...nextSchedules, ...requestSchedules]));
            const defaultTeamId = teamRows[0]?.id || UNASSIGNED_TEAM_ID;
            setSelectedTeamId((prev) => prev || defaultTeamId);
            setSelectedSiteId((prev) => (prev && visibleSiteRows.some((site) => site.id === prev) ? prev : ''));
            setDirty(false);
        } catch (error) {
            console.error('[FieldSchedulePlanner] Failed to load data', error);
            setMessage('데이터를 불러오지 못했습니다. 권한과 네트워크를 확인해주세요.');
        } finally {
            setLoading(false);
        }
    }, [currentUser?.uid, date, isDailyReportInput, isPersonnelInputMode, isScheduleConfirmationInput]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        setHasTemporaryDraft(Boolean(window.localStorage.getItem(getTempDraftStorageKey(date, mode))));
    }, [date, mode]);

    useEffect(() => {
        setOffDutyWorkerIds([]);
        setOffDutyDraftWorkerIds([]);
        setOffDutySelectionMode(false);
    }, [date, mode]);

    useEffect(() => {
        if (!selectedTeamId && rosters[0]) {
            setSelectedTeamId(rosters[0].id);
        }
    }, [rosters, selectedTeamId]);

    useEffect(() => {
        if (!selectedRoster) {
            setSelectedWorkerIds([]);
            return;
        }

        const availableWorkerIds = new Set(selectedRoster.workers.map((worker) => worker.id).filter(Boolean));
        setSelectedWorkerIds((prev) => prev.filter((workerId) => availableWorkerIds.has(workerId)));
    }, [selectedRoster]);

    useEffect(() => {
        setSelectedWorkerIds((prev) => prev.filter((workerId) => !assignedWorkerIdSet.has(workerId) && !offDutyWorkerIdSet.has(workerId)));
        setOffDutyDraftWorkerIds((prev) =>
            prev.filter((workerId) => workersById.has(workerId) && !assignedWorkerIdSet.has(workerId) && !offDutyWorkerIdSet.has(workerId))
        );
        setSelectedSupportTeamIds((prev) => prev.filter((teamId) => !assignedSupportTeamKeySet.has(teamId)));
        setSelectedVehicleIds((prev) => prev.filter((vehicleId) => !assignedVehicleIdSet.has(vehicleId)));
    }, [assignedSupportTeamKeySet, assignedVehicleIdSet, assignedWorkerIdSet, offDutyWorkerIdSet, workersById]);

    useEffect(() => {
        setOffDutyWorkerIds((prev) => prev.filter((workerId) => workersById.has(workerId) && !assignedWorkerIdSet.has(workerId)));
    }, [assignedWorkerIdSet, workersById]);

    useEffect(() => {
        if (!recentlyUpdatedSiteKey) return;
        const timeout = window.setTimeout(() => setRecentlyUpdatedSiteKey(''), 900);
        return () => window.clearTimeout(timeout);
    }, [recentlyUpdatedSiteKey]);

    const toggleWorkerSelection = (rosterId: string, workerId: string) => {
        setSelectedTeamId(rosterId);
        if (rosters.find((roster) => roster.id === rosterId)?.kind === 'support') {
            setSelectedSupportTeamIds((prev) => prev.filter((teamId) => teamId !== rosterId));
        }
        setSelectedWorkerIds((prev) => {
            const base = selectedTeamId === rosterId ? prev : [];
            return base.includes(workerId) ? base.filter((id) => id !== workerId) : [...base, workerId];
        });
    };

    const toggleAllWorkers = (roster: TeamRoster) => {
        setSelectedTeamId(roster.id);
        if (roster.kind === 'support') {
            setSelectedSupportTeamIds((prev) => prev.filter((teamId) => teamId !== roster.id));
        }
        const workerIds = cleanIds(roster.workers.map((worker) => worker.id));
        setSelectedWorkerIds((prev) => {
            const current = selectedTeamId === roster.id ? prev : [];
            const allSelected = workerIds.length > 0 && workerIds.every((workerId) => current.includes(workerId));
            return allSelected ? [] : workerIds;
        });
    };

    const startOffDutySelection = () => {
        setOffDutySelectionMode(true);
        setOffDutyDraftWorkerIds([]);
        setSelectedWorkerIds([]);
        setSelectedSupportTeamIds([]);
        setSelectedVehicleIds([]);
        setLeftPanelTab((prev) => prev === 'sites' || prev === 'vehicles' ? 'teams' : prev);
        setMessage('휴무 처리할 작업자를 체크한 뒤 휴무자로 분리하세요.');
    };

    const cancelOffDutySelection = () => {
        setOffDutySelectionMode(false);
        setOffDutyDraftWorkerIds([]);
        setMessage('휴무자 선택을 취소했습니다.');
    };

    const toggleOffDutyDraftWorker = (workerId: string) => {
        setSelectedWorkerIds([]);
        setSelectedSupportTeamIds([]);
        setSelectedVehicleIds([]);
        setOffDutyDraftWorkerIds((prev) =>
            prev.includes(workerId) ? prev.filter((id) => id !== workerId) : [...prev, workerId]
        );
    };

    const toggleAllOffDutyDraftWorkers = (roster: TeamRoster) => {
        const workerIds = cleanIds(roster.workers.map((worker) => worker.id))
            .filter((workerId) => !assignedWorkerIdSet.has(workerId) && !offDutyWorkerIdSet.has(workerId));
        setSelectedWorkerIds([]);
        setSelectedSupportTeamIds([]);
        setSelectedVehicleIds([]);
        setOffDutyDraftWorkerIds((prev) => {
            const allSelected = workerIds.length > 0 && workerIds.every((workerId) => prev.includes(workerId));
            return allSelected
                ? prev.filter((workerId) => !workerIds.includes(workerId))
                : cleanIds([...prev, ...workerIds]);
        });
    };

    const applyOffDutySelection = () => {
        const workerIds = cleanIds(offDutyDraftWorkerIds)
            .filter((workerId) => workersById.has(workerId) && !assignedWorkerIdSet.has(workerId));
        if (workerIds.length === 0) {
            setMessage('휴무자로 분리할 작업자를 먼저 선택하세요.');
            return;
        }

        setOffDutyWorkerIds((prev) => cleanIds([...prev, ...workerIds]));
        setOffDutyDraftWorkerIds([]);
        setOffDutySelectionMode(false);
        setSelectedWorkerIds((prev) => prev.filter((workerId) => !workerIds.includes(workerId)));
        setMessage(`휴무자 ${workerIds.length}명을 명단에서 별도 분리했습니다.`);
    };

    const restoreOffDutyWorker = (workerId: string) => {
        const workerName = workersById.get(workerId)?.name || '작업자';
        setOffDutyWorkerIds((prev) => prev.filter((id) => id !== workerId));
        setOffDutyDraftWorkerIds((prev) => prev.filter((id) => id !== workerId));
        setMessage(`${workerName}을 휴무자에서 제외했습니다.`);
    };

    const clearOffDutyWorkers = () => {
        setOffDutyWorkerIds([]);
        setOffDutyDraftWorkerIds([]);
        setMessage('휴무자 분리를 모두 해제했습니다.');
    };

    const toggleSupportTeamSelection = (roster: TeamRoster) => {
        setSelectedTeamId(roster.id);
        if (roster.kind === 'support') {
            setSelectedWorkerIds([]);
        }
        setSelectedSupportTeamIds((prev) =>
            prev.includes(roster.id) ? prev.filter((teamId) => teamId !== roster.id) : [...prev, roster.id]
        );
    };

    const toggleVehicleSelection = (vehicleId: string) => {
        setSelectedVehicleIds((prev) =>
            prev.includes(vehicleId) ? prev.filter((id) => id !== vehicleId) : [...prev, vehicleId]
        );
    };

    const updateSchedules = (updater: React.SetStateAction<ScheduleItem[]>) => {
        setSchedules(updater);
        setDirty(true);
    };

    const patchSchedule = (scheduleId: string, patch: Partial<ScheduleItem>) => {
        updateSchedules((prev) =>
            prev.map((schedule) => (schedule.id === scheduleId ? { ...schedule, ...patch } : schedule))
        );
    };

    const revealInputCardsOnMobile = () => {
        if (isMobileBoardLayout) {
            setBoardViewMode(true);
        }
    };

    const makeScheduleFromRoster = (roster: TeamRoster, overrides: Partial<ScheduleItem> = {}): ScheduleItem => {
        const siteId = overrides.siteId ?? selectedSiteId;
        const site = siteId ? sitesById.get(siteId) : undefined;
        const teamColor = overrides.teamColor ?? roster.color;
        const rosterTeam = teamsById.get(roster.id);
        const defaultWorkerIds =
            roster.kind === 'support' && !isPersonnelInputMode
                ? []
                : cleanIds(roster.workers.map((worker) => worker.id));
        const workerIds = cleanIds(overrides.workerIds ?? defaultWorkerIds);
        const supportTeams =
            overrides.supportTeams ??
            (roster.kind === 'support' && workerIds.length === 0
                ? [{
                    id: roster.id,
                    name: roster.name,
                    color: roster.color,
                    role: '팀',
                    manDay: 1,
                    unitPrice: getSupportTeamUnitPrice(rosterTeam),
                    payType: getSupportTeamPayType(rosterTeam),
                    workContent: overrides.memo ?? '',
                    workerId: `unknown_support_${roster.id}`,
                }]
                : []);
        const vehicleIds = cleanIds([...(overrides.vehicleIds || []), overrides.vehicleId]);
        const vehicleLabels =
            overrides.vehicleLabels ??
            vehicleIds.map((vehicleId) => vehiclesById.get(vehicleId)?.licensePlate || overrides.vehicleLabel || '');
        const vehicleTeamColors =
            overrides.vehicleTeamColors ??
            buildVehicleTeamColorsFromRows(vehicleIds, vehiclesById, teamsById, teams, workersById, workers, teamColor);
        const workerTeamIds = Object.fromEntries(workerIds.map((workerId) => {
            const worker = workersById.get(workerId);
            const assignedTeam = getWorkerAssignedTeam(worker, teamsById, teams);
            return [workerId, toTrimmedText(worker?.teamId) || toTrimmedText(assignedTeam?.id) || (roster.kind === 'support' ? roster.id : '')];
        }));
        const workerTeamNames = Object.fromEntries(workerIds.map((workerId) => {
            const worker = workersById.get(workerId);
            const assignedTeam = getWorkerAssignedTeam(worker, teamsById, teams);
            return [workerId, toTrimmedText(worker?.teamName) || toTrimmedText(assignedTeam?.name) || (roster.kind === 'support' ? roster.name : '')];
        }));

        return {
            id: makeScheduleId(),
            date,
            teamId: overrides.teamId ?? roster.id,
            teamName: overrides.teamName ?? roster.name,
            teamColor,
            siteId,
            siteName: overrides.siteName ?? site?.name ?? '',
            siteAddress: overrides.siteAddress ?? site?.address ?? '',
            siteColor: overrides.siteColor ?? getSiteColor(site, teamColor),
            clientCompanyName: overrides.clientCompanyName ?? toTrimmedText(site?.clientCompanyName),
            constructorCompanyName: overrides.constructorCompanyName ?? (toTrimmedText(site?.companyName) || toTrimmedText(site?.constructorCompanyName)),
            partnerName: overrides.partnerName ?? toTrimmedText(site?.partnerName),
            siteType: overrides.siteType ?? getSiteType(site),
            paymentType: overrides.paymentType ?? getPaymentType(site),
            responsibleTeamId: overrides.responsibleTeamId ?? toTrimmedText(site?.responsibleTeamId),
            responsibleTeamName: overrides.responsibleTeamName ?? toTrimmedText(site?.responsibleTeamName),
            siteManagerId: overrides.siteManagerId ?? toTrimmedText((site as any)?.siteManagerId),
            siteManagerName: overrides.siteManagerName ?? toTrimmedText((site as any)?.siteManagerName),
            workerIds,
            supportTeams,
            vehicleIds,
            vehicleLabels,
            vehicleTeamColors,
            vehicleId: vehicleIds[0] || '',
            vehicleLabel: vehicleLabels[0] || '',
            status: overrides.status ?? 'draft',
            memo: overrides.memo ?? '',
            workerManDays: overrides.workerManDays || Object.fromEntries(workerIds.map((workerId) => [workerId, 1])),
            workerUnitPrices: overrides.workerUnitPrices || Object.fromEntries(workerIds.map((workerId) => {
                const worker = workersById.get(workerId);
                const defaultUnitPrice = toFiniteNumber(worker?.unitPrice, 0) || (roster.kind === 'support' ? getSupportTeamUnitPrice(rosterTeam) : 0);
                return [workerId, defaultUnitPrice];
            })),
            workerPayTypes: overrides.workerPayTypes || Object.fromEntries(workerIds.map((workerId) => {
                const worker = workersById.get(workerId);
                const workerType = resolveScheduleWorkerSalaryType(worker);
                return [workerId, roster.kind === 'support' && workerType === '일급제' ? getSupportTeamPayType(rosterTeam) : workerType];
            })),
            workerWorkContents: overrides.workerWorkContents || Object.fromEntries(workerIds.map((workerId) => [workerId, overrides.memo ?? ''])),
            workerTeamIds: overrides.workerTeamIds || workerTeamIds,
            workerTeamNames: overrides.workerTeamNames || workerTeamNames,
        };
    };

    const upsertScheduleForSite = (incoming: ScheduleItem) => {
        const siteKey = makeSiteKey(incoming);
        setRecentlyUpdatedSiteKey(siteKey);
        if (incoming.siteId) {
            setSelectedSiteId(incoming.siteId);
        }
        updateSchedules((prev) => {
            const key = siteKey;
            const incomingWorkerIds = new Set(incoming.workerIds);
            const incomingVehicleIds = new Set(getScheduleVehicleIds(incoming));
            const cleanedPrev = prev.map((schedule) => {
                if (makeSiteKey(schedule) === key) return schedule;
                const vehicleIds = getScheduleVehicleIds(schedule).filter((vehicleId) => !incomingVehicleIds.has(vehicleId));
                const vehicleLabels = vehicleIds.map((vehicleId) => vehiclesById.get(vehicleId)?.licensePlate || '');
                const vehicleTeamColors = { ...(schedule.vehicleTeamColors || {}) };
                incomingVehicleIds.forEach((vehicleId) => delete vehicleTeamColors[vehicleId]);
                const workerManDays = { ...(schedule.workerManDays || {}) };
                const workerUnitPrices = { ...(schedule.workerUnitPrices || {}) };
                const workerPayTypes = { ...(schedule.workerPayTypes || {}) };
                const workerWorkContents = { ...(schedule.workerWorkContents || {}) };
                const workerTeamIds = { ...(schedule.workerTeamIds || {}) };
                const workerTeamNames = { ...(schedule.workerTeamNames || {}) };
                incomingWorkerIds.forEach((workerId) => delete workerManDays[workerId]);
                incomingWorkerIds.forEach((workerId) => delete workerUnitPrices[workerId]);
                incomingWorkerIds.forEach((workerId) => delete workerPayTypes[workerId]);
                incomingWorkerIds.forEach((workerId) => delete workerWorkContents[workerId]);
                incomingWorkerIds.forEach((workerId) => delete workerTeamIds[workerId]);
                incomingWorkerIds.forEach((workerId) => delete workerTeamNames[workerId]);
                return {
                    ...schedule,
                    workerIds: schedule.workerIds.filter((workerId) => !incomingWorkerIds.has(workerId)),
                    workerManDays,
                    workerUnitPrices,
                    workerPayTypes,
                    workerWorkContents,
                    workerTeamIds,
                    workerTeamNames,
                    vehicleIds,
                    vehicleLabels,
                    vehicleTeamColors,
                    vehicleId: vehicleIds[0] || '',
                    vehicleLabel: vehicleLabels[0] || '',
                };
            });

            const existingIndex = key ? cleanedPrev.findIndex((schedule) => makeSiteKey(schedule) === key) : -1;
            if (existingIndex < 0) return [incoming, ...cleanedPrev];

            const next = [...cleanedPrev];
            next[existingIndex] = mergeScheduleEntries(next[existingIndex], incoming);
            return next;
        });
    };

    const registerSiteToBoard = (siteIdOrName?: string) => {
        const site =
            (siteIdOrName ? sitesById.get(siteIdOrName) : undefined) ||
            sites.find((entry) => entry.name === siteIdOrName) ||
            selectedSite;
        if (!site) {
            setMessage('등록할 현장을 먼저 선택하세요.');
            return;
        }

        const siteColor = getSiteColor(site, selectedRoster?.color || DEFAULT_RESOURCE_COLOR);
        const next: ScheduleItem = {
            id: makeScheduleId(),
            date,
            teamId: '',
            teamName: '',
            teamColor: siteColor,
            siteId: site.id || '',
            siteName: site.name,
            siteAddress: site.address || '',
            siteColor,
            clientCompanyName: toTrimmedText(site.clientCompanyName),
            constructorCompanyName: toTrimmedText(site.companyName) || toTrimmedText(site.constructorCompanyName),
            partnerName: toTrimmedText(site.partnerName),
            siteType: getSiteType(site),
            paymentType: getPaymentType(site),
            responsibleTeamId: toTrimmedText(site.responsibleTeamId),
            responsibleTeamName: toTrimmedText(site.responsibleTeamName),
            siteManagerId: toTrimmedText((site as any).siteManagerId),
            siteManagerName: toTrimmedText((site as any).siteManagerName),
            workerIds: [],
            supportTeams: [],
            vehicleIds: [],
            vehicleLabels: [],
            vehicleId: '',
            vehicleLabel: '',
            status: 'draft',
            memo: '',
            workerManDays: {},
            workerUnitPrices: {},
            workerPayTypes: {},
            workerWorkContents: {},
            workerTeamIds: {},
            workerTeamNames: {},
        };

        setSelectedSiteId(site.id || '');
        upsertScheduleForSite(next);
        revealInputCardsOnMobile();
        boardRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        setMessage(
            isPersonnelInputMode
                ? `${site.name} 현장 카드를 만들었습니다. 작업자와 공수, 작업내용을 입력하세요.`
                : `${site.name} 현장을 먼저 등록했습니다. 이후 작업자, 지원팀, 차량을 추가하세요.`
        );
    };

    const moveVehicleToBoard = (vehicle: Vehicle) => {
        if (isPersonnelInputMode) {
            setMessage(isScheduleConfirmationInput ? '일정확정보드에서는 차량을 사용하지 않습니다. 작업자를 추가하세요.' : '보드입력에서는 차량을 사용하지 않습니다. 작업자를 추가하세요.');
            return;
        }
        if (!selectedSiteId || !selectedSite) {
            setMessage('이동 대상 현장을 먼저 선택하세요.');
            return;
        }
        if (isUnavailableVehicle(vehicle)) {
            setMessage('사용할 수 없는 차량입니다.');
            return;
        }

        const siteColor = getSiteColor(selectedSite, selectedRoster?.color || DEFAULT_RESOURCE_COLOR);
        const vehicleTeamColor = getVehicleTeamColorFromRows(vehicle.id, vehiclesById, teamsById, teams, workersById, workers, selectedRoster?.color);
        const next: ScheduleItem = {
            id: makeScheduleId(),
            date,
            teamId: '',
            teamName: '',
            teamColor: selectedRoster?.color || siteColor,
            siteId: selectedSiteId,
            siteName: selectedSite.name,
            siteAddress: selectedSite.address || '',
            siteColor,
            workerIds: [],
            supportTeams: [],
            vehicleIds: [vehicle.id],
            vehicleLabels: [vehicle.licensePlate],
            vehicleTeamColors: vehicleTeamColor ? { [vehicle.id]: vehicleTeamColor } : {},
            vehicleId: vehicle.id,
            vehicleLabel: vehicle.licensePlate,
            status: 'draft',
            memo: '',
            workerManDays: {},
        };

        upsertScheduleForSite(next);
        setSelectedVehicleIds((prev) => prev.filter((vehicleId) => vehicleId !== vehicle.id));
        revealInputCardsOnMobile();
        boardRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        setMessage(`${selectedSite.name}에 ${vehicle.licensePlate} 차량을 추가했습니다.`);
    };

    const moveRosterToBoard = (roster: TeamRoster, overrides: Partial<ScheduleItem> = {}) => {
        if (!roster) return;
        const selectedRosterWorkerIds = cleanIds(overrides.workerIds ?? (selectedTeamId === roster.id ? selectedWorkerIds : []));
        const workerIds =
            roster.kind === 'support'
                ? selectedRosterWorkerIds.length > 0
                    ? selectedRosterWorkerIds
                    : isPersonnelInputMode
                        ? cleanIds(roster.workers.map((worker) => worker.id))
                        : []
                : selectedRosterWorkerIds;

        if (!selectedSiteId && !overrides.siteId) {
            setSelectedTeamId(roster.id);
            setMessage(isPersonnelInputMode ? '입력할 현장을 먼저 선택하세요.' : '현장을 먼저 선택한 뒤 보드로 이동하세요.');
            return;
        }

        if (roster.kind !== 'support' && workerIds.length === 0) {
            setSelectedTeamId(roster.id);
            setMessage('작업자를 선택한 뒤 보드로 이동하세요.');
            return;
        }

        if (isPersonnelInputMode && roster.kind === 'support' && workerIds.length === 0) {
            setSelectedTeamId(roster.id);
            setMessage('지원팀 작업자를 선택한 뒤 보드에 추가하세요.');
            return;
        }

        const next = makeScheduleFromRoster(roster, { ...overrides, workerIds });
        upsertScheduleForSite(next);
        revealInputCardsOnMobile();
        setSelectedTeamId(roster.id);
        if (roster.kind !== 'support' || isPersonnelInputMode) {
            setSelectedWorkerIds([]);
        }
        boardRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        setMessage(
            isPersonnelInputMode
                ? `${next.siteName || '현장'} ${isScheduleConfirmationInput ? '확정 보드' : '일보'}에 ${roster.kind === 'support' ? roster.name : `${workerIds.length}명의 작업자`}를 추가했습니다.`
                : `${roster.name} → ${next.siteName || '현장'} 이동 등록되었습니다. 차량은 좌측 차량 목록에서 카드로 드래그해 등록하세요.`
        );
    };

    const moveSelectedToBoard = () => {
        if (offDutySelectionMode) {
            setMessage('휴무자 선택 중에는 작업자를 보드에 추가할 수 없습니다.');
            return;
        }
        if (!selectedSiteId || !selectedSite) {
            setMessage(isPersonnelInputMode ? '입력할 현장을 먼저 선택하세요.' : '이동 대상 현장을 먼저 선택하세요.');
            return;
        }

        const supportTeams = isPersonnelInputMode ? [] : selectedSupportTeams.map((team) => ({
            id: team.id,
            name: team.name,
            color: team.color,
            role: '팀',
            manDay: 1,
            unitPrice: getSupportTeamUnitPrice(teamsById.get(team.id)),
            payType: getSupportTeamPayType(teamsById.get(team.id)),
            workContent: '',
            workerId: `unknown_support_${team.id}`,
        }));
        const workerIds = cleanIds(selectedWorkerIds);
        const vehicleIds = isPersonnelInputMode ? [] : cleanIds(selectedVehicleIds);

        if (workerIds.length === 0 && supportTeams.length === 0 && vehicleIds.length === 0) {
            setMessage(isPersonnelInputMode ? '추가할 작업자 또는 지원팀을 선택하세요.' : '추가할 작업자, 지원팀 또는 차량을 선택하세요.');
            return;
        }

        const sourceRoster = selectedRoster || selectedSupportTeams[0] || rosters[0];
        if (!sourceRoster) return;

        const next = makeScheduleFromRoster(sourceRoster, {
            siteId: selectedSiteId,
            siteName: selectedSite.name,
            siteAddress: selectedSite.address || '',
            siteColor: getSiteColor(selectedSite, sourceRoster.color),
            workerIds,
            supportTeams,
            vehicleIds,
            vehicleLabels: vehicleIds.map((vehicleId) => vehiclesById.get(vehicleId)?.licensePlate || ''),
        });

        upsertScheduleForSite(next);
        revealInputCardsOnMobile();
        setSelectedWorkerIds([]);
        setSelectedSupportTeamIds([]);
        setSelectedVehicleIds([]);
        boardRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        setMessage(isPersonnelInputMode ? `${selectedSite.name} ${isScheduleConfirmationInput ? '확정 보드' : '일보'}에 선택한 작업자/지원팀을 추가했습니다.` : `${selectedSite.name}에 선택한 리소스를 추가했습니다.`);
    };

    const addSupportTeamToSchedule = (scheduleId: string, teamId: string) => {
        const roster = rosters.find((entry) => entry.id === teamId);
        if (!roster || roster.kind !== 'support') {
            setMessage('지원팀은 지원팀 탭에서 팀명만 현장에 배치합니다.');
            return;
        }
        if (isPersonnelInputMode) {
            const target = schedules.find((entry) => entry.id === scheduleId);
            if (!target) return;
            const sourceRoster = availableRosters.find((entry) => entry.id === roster.id) || roster;
            const rosterTeam = teamsById.get(roster.id);
            const workerIds = cleanIds(sourceRoster.workers.map((worker) => worker.id));
            if (workerIds.length === 0) {
                setMessage('지원팀에 등록된 작업자가 없습니다.');
                return;
            }

            patchSchedule(scheduleId, {
                workerIds: cleanIds([...target.workerIds, ...workerIds]),
                workerManDays: {
                    ...(target.workerManDays || {}),
                    ...Object.fromEntries(workerIds.map((workerId) => [workerId, target.workerManDays?.[workerId] ?? 1])),
                },
                workerUnitPrices: {
                    ...(target.workerUnitPrices || {}),
                    ...Object.fromEntries(workerIds.map((workerId) => {
                        const worker = workersById.get(workerId);
                        return [workerId, target.workerUnitPrices?.[workerId] ?? (toFiniteNumber(worker?.unitPrice, 0) || getSupportTeamUnitPrice(rosterTeam))];
                    })),
                },
                workerPayTypes: {
                    ...(target.workerPayTypes || {}),
                    ...Object.fromEntries(workerIds.map((workerId) => {
                        const worker = workersById.get(workerId);
                        const workerType = resolveScheduleWorkerSalaryType(worker);
                        const fallbackPayType = roster.kind === 'support' && workerType === '일급제'
                            ? getSupportTeamPayType(rosterTeam)
                            : workerType;
                        return [workerId, target.workerPayTypes?.[workerId] ?? fallbackPayType];
                    })),
                },
                workerWorkContents: {
                    ...(target.workerWorkContents || {}),
                    ...Object.fromEntries(workerIds.map((workerId) => [workerId, target.workerWorkContents?.[workerId] ?? target.memo])),
                },
                workerTeamIds: {
                    ...(target.workerTeamIds || {}),
                    ...Object.fromEntries(workerIds.map((workerId) => [workerId, target.workerTeamIds?.[workerId] ?? roster.id])),
                },
                workerTeamNames: {
                    ...(target.workerTeamNames || {}),
                    ...Object.fromEntries(workerIds.map((workerId) => [workerId, target.workerTeamNames?.[workerId] ?? roster.name])),
                },
            });
            return;
        }

        patchSchedule(scheduleId, {
            supportTeams: mergeSupportTeams([
                ...(schedules.find((entry) => entry.id === scheduleId)?.supportTeams || []),
                {
                    id: roster.id,
                    name: roster.name,
                    color: roster.color,
                    role: '팀',
                    manDay: 1,
                    unitPrice: getSupportTeamUnitPrice(teamsById.get(roster.id)),
                    payType: getSupportTeamPayType(teamsById.get(roster.id)),
                    workContent: '',
                    workerId: `unknown_support_${roster.id}`,
                },
            ]),
        });
    };

    const applySiteToSchedule = (scheduleId: string, siteId: string) => {
        const site = siteId ? sitesById.get(siteId) : undefined;
        updateSchedules((prev) => {
            const target = prev.find((entry) => entry.id === scheduleId);
            if (!target) return prev;

            const patched: ScheduleItem = {
                ...target,
                siteId,
                siteName: site?.name || '',
                siteAddress: site?.address || '',
                siteColor: site ? getSiteColor(site, target.teamColor) : '',
                clientCompanyName: toTrimmedText(site?.clientCompanyName),
                constructorCompanyName: toTrimmedText(site?.companyName) || toTrimmedText(site?.constructorCompanyName),
                partnerName: toTrimmedText(site?.partnerName),
                siteType: getSiteType(site),
                paymentType: getPaymentType(site),
                responsibleTeamId: toTrimmedText(site?.responsibleTeamId),
                responsibleTeamName: toTrimmedText(site?.responsibleTeamName),
                siteManagerId: toTrimmedText((site as any)?.siteManagerId),
                siteManagerName: toTrimmedText((site as any)?.siteManagerName),
            };
            const key = makeSiteKey(patched);
            const existingIndex = key ? prev.findIndex((entry) => entry.id !== scheduleId && makeSiteKey(entry) === key) : -1;
            if (existingIndex < 0) {
                return prev.map((entry) => (entry.id === scheduleId ? patched : entry));
            }

            const next = prev.filter((entry) => entry.id !== scheduleId);
            const mergeIndex = next.findIndex((entry) => makeSiteKey(entry) === key);
            next[mergeIndex] = mergeScheduleEntries(next[mergeIndex], patched);
            return next;
        });
    };

    const addWorkerToSchedule = (scheduleId: string, workerId: string, sourceScheduleId?: string, sourceRosterId?: string, sourceRosterName?: string) => {
        updateSchedules((prev) =>
            prev.map((schedule) => {
                if (sourceScheduleId && schedule.id === sourceScheduleId) {
                    const workerManDays = { ...(schedule.workerManDays || {}) };
                    const workerUnitPrices = { ...(schedule.workerUnitPrices || {}) };
                    const workerPayTypes = { ...(schedule.workerPayTypes || {}) };
                    const workerWorkContents = { ...(schedule.workerWorkContents || {}) };
                    const workerTeamIds = { ...(schedule.workerTeamIds || {}) };
                    const workerTeamNames = { ...(schedule.workerTeamNames || {}) };
                    delete workerManDays[workerId];
                    delete workerUnitPrices[workerId];
                    delete workerPayTypes[workerId];
                    delete workerWorkContents[workerId];
                    delete workerTeamIds[workerId];
                    delete workerTeamNames[workerId];
                    return {
                        ...schedule,
                        workerIds: schedule.workerIds.filter((id) => id !== workerId),
                        workerManDays,
                        workerUnitPrices,
                        workerPayTypes,
                        workerWorkContents,
                        workerTeamIds,
                        workerTeamNames,
                    };
                }

                if (!sourceScheduleId && schedule.id !== scheduleId && schedule.workerIds.includes(workerId)) {
                    const workerManDays = { ...(schedule.workerManDays || {}) };
                    const workerUnitPrices = { ...(schedule.workerUnitPrices || {}) };
                    const workerPayTypes = { ...(schedule.workerPayTypes || {}) };
                    const workerWorkContents = { ...(schedule.workerWorkContents || {}) };
                    const workerTeamIds = { ...(schedule.workerTeamIds || {}) };
                    const workerTeamNames = { ...(schedule.workerTeamNames || {}) };
                    delete workerManDays[workerId];
                    delete workerUnitPrices[workerId];
                    delete workerPayTypes[workerId];
                    delete workerWorkContents[workerId];
                    delete workerTeamIds[workerId];
                    delete workerTeamNames[workerId];
                    return {
                        ...schedule,
                        workerIds: schedule.workerIds.filter((id) => id !== workerId),
                        workerManDays,
                        workerUnitPrices,
                        workerPayTypes,
                        workerWorkContents,
                        workerTeamIds,
                        workerTeamNames,
                    };
                }

                if (schedule.id === scheduleId) {
                    const worker = workersById.get(workerId);
                    const assignedTeam = getWorkerAssignedTeam(worker, teamsById, teams);
                    const sourceRoster = sourceRosterId ? rosters.find((roster) => roster.id === sourceRosterId) : undefined;
                    const sourceRosterTeam = sourceRosterId ? teamsById.get(sourceRosterId) : undefined;
                    const defaultUnitPrice = toFiniteNumber(worker?.unitPrice, 0) || (isSupportWorker(worker) || sourceRoster?.kind === 'support' ? getSupportTeamUnitPrice(assignedTeam || sourceRosterTeam) : 0);
                    return {
                        ...schedule,
                        workerIds: cleanIds([...schedule.workerIds, workerId]),
                        workerManDays: {
                            ...(schedule.workerManDays || {}),
                            [workerId]: schedule.workerManDays?.[workerId] ?? 1,
                        },
                        workerUnitPrices: {
                            ...(schedule.workerUnitPrices || {}),
                            [workerId]: schedule.workerUnitPrices?.[workerId] ?? defaultUnitPrice,
                        },
                        workerPayTypes: {
                            ...(schedule.workerPayTypes || {}),
                            [workerId]: schedule.workerPayTypes?.[workerId] ?? (sourceRoster?.kind === 'support' ? getSupportTeamPayType(assignedTeam || sourceRosterTeam) : resolveScheduleWorkerSalaryType(worker)),
                        },
                        workerWorkContents: {
                            ...(schedule.workerWorkContents || {}),
                            [workerId]: schedule.workerWorkContents?.[workerId] ?? schedule.memo,
                        },
                        workerTeamIds: {
                            ...(schedule.workerTeamIds || {}),
                            [workerId]: schedule.workerTeamIds?.[workerId] ?? (toTrimmedText(worker?.teamId) || toTrimmedText(assignedTeam?.id) || toTrimmedText(sourceRoster?.id) || toTrimmedText(sourceRosterId)),
                        },
                        workerTeamNames: {
                            ...(schedule.workerTeamNames || {}),
                            [workerId]: schedule.workerTeamNames?.[workerId] ?? (toTrimmedText(worker?.teamName) || toTrimmedText(assignedTeam?.name) || toTrimmedText(sourceRoster?.name) || toTrimmedText(sourceRosterName)),
                        },
                    };
                }

                return schedule;
            })
        );
    };

    const addVehicleToSchedule = (scheduleId: string, vehicleId: string) => {
        updateSchedules((prev) =>
            prev.map((schedule) => {
                if (schedule.id === scheduleId) {
                    const vehicleIds = cleanIds([...getScheduleVehicleIds(schedule), vehicleId]);
                    const vehicleLabels = vehicleIds.map((id) => vehiclesById.get(id)?.licensePlate || schedule.vehicleLabel || '');
                    const vehicleTeamColors = {
                        ...(schedule.vehicleTeamColors || {}),
                        ...buildVehicleTeamColorsFromRows(vehicleIds, vehiclesById, teamsById, teams, workersById, workers, schedule.teamColor),
                    };
                    return {
                        ...schedule,
                        vehicleIds,
                        vehicleLabels,
                        vehicleTeamColors,
                        vehicleId: vehicleIds[0] || '',
                        vehicleLabel: vehicleLabels[0] || '',
                    };
                }

                if (getScheduleVehicleIds(schedule).includes(vehicleId)) {
                    const vehicleIds = getScheduleVehicleIds(schedule).filter((id) => id !== vehicleId);
                    const vehicleLabels = vehicleIds.map((id) => vehiclesById.get(id)?.licensePlate || '');
                    const vehicleTeamColors = { ...(schedule.vehicleTeamColors || {}) };
                    delete vehicleTeamColors[vehicleId];
                    return {
                        ...schedule,
                        vehicleIds,
                        vehicleLabels,
                        vehicleTeamColors,
                        vehicleId: vehicleIds[0] || '',
                        vehicleLabel: vehicleLabels[0] || '',
                    };
                }

                return schedule;
            })
        );
    };

    const removeWorkerFromSchedule = (scheduleId: string, workerId: string) => {
        const target = schedules.find((schedule) => schedule.id === scheduleId);
        const workerManDays = { ...(target?.workerManDays || {}) };
        const workerUnitPrices = { ...(target?.workerUnitPrices || {}) };
        const workerPayTypes = { ...(target?.workerPayTypes || {}) };
        const workerWorkContents = { ...(target?.workerWorkContents || {}) };
        const workerTeamIds = { ...(target?.workerTeamIds || {}) };
        const workerTeamNames = { ...(target?.workerTeamNames || {}) };
        delete workerManDays[workerId];
        delete workerUnitPrices[workerId];
        delete workerPayTypes[workerId];
        delete workerWorkContents[workerId];
        delete workerTeamIds[workerId];
        delete workerTeamNames[workerId];
        patchSchedule(scheduleId, {
            workerIds: target?.workerIds.filter((id) => id !== workerId) || [],
            workerManDays,
            workerUnitPrices,
            workerPayTypes,
            workerWorkContents,
            workerTeamIds,
            workerTeamNames,
        });
    };

    const updateScheduleMemo = (scheduleId: string, memo: string) => {
        patchSchedule(scheduleId, { memo });
    };

    const updateWorkerManDay = (scheduleId: string, workerId: string, manDay: number) => {
        const target = schedules.find((schedule) => schedule.id === scheduleId);
        if (!target) return;
        patchSchedule(scheduleId, {
            workerManDays: {
                ...(target.workerManDays || {}),
                [workerId]: manDay,
            },
        });
    };

    const updateWorkerUnitPrice = (scheduleId: string, workerId: string, unitPrice: number) => {
        const target = schedules.find((schedule) => schedule.id === scheduleId);
        if (!target) return;
        patchSchedule(scheduleId, {
            workerUnitPrices: {
                ...(target.workerUnitPrices || {}),
                [workerId]: unitPrice,
            },
        });
    };

    const updateWorkerPayType = (scheduleId: string, workerId: string, payType: string) => {
        const target = schedules.find((schedule) => schedule.id === scheduleId);
        if (!target) return;
        patchSchedule(scheduleId, {
            workerPayTypes: {
                ...(target.workerPayTypes || {}),
                [workerId]: payType,
            },
        });
    };


    const updateSupportTeamInSchedule = (scheduleId: string, teamKey: string, patch: Partial<ScheduleSupportTeam>) => {
        const target = schedules.find((schedule) => schedule.id === scheduleId);
        if (!target) return;
        patchSchedule(scheduleId, {
            supportTeams: target.supportTeams.map((team) =>
                (team.id || team.name) === teamKey ? { ...team, ...patch } : team
            ),
        });
    };

    const removeSupportTeamFromSchedule = (scheduleId: string, teamId: string) => {
        patchSchedule(scheduleId, {
            supportTeams:
                schedules
                    .find((schedule) => schedule.id === scheduleId)
                    ?.supportTeams.filter((team) => (team.id || team.name) !== teamId) || [],
        });
    };

    const removeVehicleFromSchedule = (scheduleId: string, vehicleId: string) => {
        const target = schedules.find((schedule) => schedule.id === scheduleId);
        const vehicleIds = getScheduleVehicleIds(target || {}).filter((id) => id !== vehicleId);
        const vehicleLabels = vehicleIds.map((id) => vehiclesById.get(id)?.licensePlate || '');
        const vehicleTeamColors = { ...(target?.vehicleTeamColors || {}) };
        delete vehicleTeamColors[vehicleId];
        patchSchedule(scheduleId, {
            vehicleIds,
            vehicleLabels,
            vehicleTeamColors,
            vehicleId: vehicleIds[0] || '',
            vehicleLabel: vehicleLabels[0] || '',
        });
    };

    const deleteSchedule = (scheduleId: string) => {
        const target = schedules.find((schedule) => schedule.id === scheduleId);
        if (!target) return;
        setDeletedSchedule(target);
        updateSchedules((prev) => prev.filter((schedule) => schedule.id !== scheduleId));
    };

    const restoreDeletedSchedule = () => {
        if (!deletedSchedule) return;
        updateSchedules((prev) => [deletedSchedule, ...prev]);
        setDeletedSchedule(null);
    };


    const handleDragStart = (event: DragStartEvent) => {
        setActivePayload(event.active.data.current as DragPayload);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const activeData = event.active.data.current as DragPayload | undefined;
        const overData = event.over?.data.current as any;
        setActivePayload(null);

        if (!activeData || !event.over) return;

        if (activeData.kind === 'schedule' && overData?.kind === 'schedule-drop') {
            const fromIndex = schedules.findIndex((schedule) => schedule.id === activeData.id);
            const toIndex = schedules.findIndex((schedule) => schedule.id === overData.scheduleId);
            updateSchedules((prev) => moveItem(prev, fromIndex, toIndex));
            return;
        }

        if (overData?.kind === 'schedule-drop') {
            const targetScheduleId = String(overData.scheduleId);
            if (activeData.kind === 'worker') {
                addWorkerToSchedule(
                    targetScheduleId,
                    activeData.id,
                    activeData.sourceScheduleId,
                    activeData.sourceRosterId,
                    activeData.sourceRosterName
                );
            }
            if (activeData.kind === 'vehicle') {
                addVehicleToSchedule(targetScheduleId, activeData.id);
            }
            if (activeData.kind === 'team') {
                addSupportTeamToSchedule(targetScheduleId, activeData.id);
            }
            if (activeData.kind === 'site') {
                applySiteToSchedule(targetScheduleId, activeData.id);
                setSelectedSiteId(activeData.id);
            }
            return;
        }

        if (overData?.kind === 'board-drop') {
            if (activeData.kind === 'site') {
                registerSiteToBoard(activeData.id);
                return;
            }

            if (activeData.kind === 'team') {
                const roster = rosters.find((entry) => entry.id === activeData.id);
                if (roster) moveRosterToBoard(roster);
                return;
            }

            if (activeData.kind === 'worker') {
                const worker = workersById.get(activeData.id);
                const roster =
                    rosters.find((entry) => entry.id === activeData.sourceRosterId) ||
                    rosters.find(
                        (entry) =>
                            entry.id === worker?.teamId ||
                            entry.workers.some((entryWorker) => entryWorker.id === activeData.id)
                    ) || selectedRoster;
                if (!roster) return;
                moveRosterToBoard(roster, { workerIds: [activeData.id] });
                return;
            }

            if (activeData.kind === 'vehicle') {
                const vehicle = vehiclesById.get(activeData.id);
                if (!vehicle) return;
                moveVehicleToBoard(vehicle);
            }
        }
    };

    const handleDragCancel = () => {
        setActivePayload(null);
    };

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const clearActiveDrag = () => setActivePayload(null);
        const handleVisibilityChange = () => {
            if (document.visibilityState !== 'visible') {
                clearActiveDrag();
            }
        };

        window.addEventListener('blur', clearActiveDrag);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.removeEventListener('blur', clearActiveDrag);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    const handleSave = async () => {
        setSaving(true);
        setMessage('');

        try {
            const normalizedSchedules = mergeSchedulesBySite(schedules);

            if (isDailyReportInput) {
                const result = buildDailyReportsFromSchedules(normalizedSchedules);
                if (result.reports.length === 0) {
                    setMessage('일보로 저장할 작업자 또는 지원팀이 없습니다. 현장 카드에 배치한 뒤 저장하세요.');
                    return;
                }

                const existingReports = await dailyReportService.getReports(date);
                const teamIdsToCheck = Array.from(new Set([
                    ...existingReports.map((report) => toTrimmedText(report.teamId)).filter(Boolean),
                    ...result.involvedTeamIds,
                ]));
                await dailyReportService.overwriteReports(date, result.reports as any, teamIdsToCheck);
                setSchedules(normalizedSchedules);
                setDirty(false);
                if (typeof window !== 'undefined') {
                    window.localStorage.removeItem(getTempDraftStorageKey(date, mode));
                    setHasTemporaryDraft(false);
                }

                const warnings = [
                    result.supportTeamCount > 0 ? `지원팀/용역팀 ${result.supportTeamCount}건 포함` : '',
                    result.skippedScheduleCount > 0 ? `현장 미확인 ${result.skippedScheduleCount}건 제외` : '',
                    result.skippedWorkerCount > 0 ? `작업자/팀 미확인 ${result.skippedWorkerCount}건 제외` : '',
                ].filter(Boolean);
                setMessage(`일보 ${result.reports.length}건, 입력줄 ${result.totalWorkerCount}건이 저장되었습니다.${warnings.length ? ` ${warnings.join(' · ')}` : ''}`);
                return;
            }

            const assignments = normalizedSchedules.map(scheduleToDispatchAssignment) as DispatchAssignment[];

            if (isScheduleConfirmationInput) {
                if (assignments.length === 0) {
                    setMessage('확정할 현장 카드가 없습니다. 현장과 작업자를 추가한 뒤 저장하세요.');
                    return;
                }

                await scheduleConfirmationBoardService.saveBoard(date, assignments);
                setSchedules(normalizedSchedules);
                setDirty(false);
                if (typeof window !== 'undefined') {
                    window.localStorage.removeItem(getTempDraftStorageKey(date, mode));
                    setHasTemporaryDraft(false);
                }
                setMessage(`일정확정보드 ${assignments.length}개 현장이 저장되었습니다.`);
                return;
            }

            await dispatchService.saveDispatch(date, assignments);
            setSchedules(normalizedSchedules);
            setDirty(false);
            if (typeof window !== 'undefined') {
                window.localStorage.removeItem(getTempDraftStorageKey(date, mode));
                setHasTemporaryDraft(false);
            }
            setMessage('일정이 저장되었습니다.');
        } catch (error) {
            console.error('[FieldSchedulePlanner] Failed to save', error);
            setMessage('저장에 실패했습니다. 잠시 후 다시 시도해주세요.');
        } finally {
            setSaving(false);
        }
    };

    const appendAnalyzedSchedulesToBoard = useCallback((nextSchedules: ScheduleItem[]) => {
        if (nextSchedules.length === 0) return;
        updateSchedules((prev) => mergeSchedulesBySite([...prev, ...nextSchedules]));
        const firstSite = nextSchedules.find((schedule) => schedule.siteId);
        if (firstSite?.siteId) setSelectedSiteId(firstSite.siteId);
        boardRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }, []);

    const handleScheduleAnalyzeClick = useCallback(async () => {
        if (!isPersonnelInputMode) return;
        if (loading || analyzingSchedule) {
            setMessage('기준 데이터를 불러오는 중입니다. 잠시 후 다시 시도하세요.');
            return;
        }

        setAnalyzingSchedule(true);
        setMessage('');
        try {
            const dispatch = await dispatchService.getDispatchByDate(date);
            const assignments = Array.isArray(dispatch?.assignments) ? dispatch.assignments : [];
            if (assignments.length === 0) {
                setMessage(`${date}에 저장된 현장 일정이 없습니다.`);
                return;
            }

            const mappedSchedules = assignments
                .map((assignment, index) => ({
                    ...mapAssignmentToSchedule(assignment, index),
                    id: makeScheduleId(),
                    status: 'draft' as ScheduleStatus,
                    supportTeams: [],
                }));
            const scopedSchedules = hasScopedPersonnelAccess
                ? mappedSchedules.filter(scheduleMatchesViewerScope)
                : mappedSchedules;

            if (hasScopedPersonnelAccess && scopedSchedules.length === 0) {
                setMessage(`${date} 일정 중 ${viewerTeamScope.label} 담당현장 또는 지원팀 현장이 없습니다.`);
                return;
            }

            const analyzedSchedules = scopedSchedules
                .filter((schedule) => schedule.workerIds.length > 0);

            if (analyzedSchedules.length === 0) {
                setMessage('일정 분석에서 불러올 작업자 입력줄이 없습니다. 지원팀은 일정 분석에서 제외됩니다.');
                return;
            }

            const nextSchedules = mergeSchedulesBySite(analyzedSchedules);
            appendAnalyzedSchedulesToBoard(nextSchedules);
            const totalWorkers = nextSchedules.reduce(
                (sum, schedule) => sum + schedule.workerIds.length,
                0
            );
            setMessage(`일정 분석으로 ${nextSchedules.length}개 현장, ${totalWorkers}개 입력줄을 보드에 추가했습니다.`);
        } catch (error) {
            console.error('[FieldSchedulePlanner] Failed to analyze schedule', error);
            const errorMessage = error instanceof Error ? error.message : '일정 분석에 실패했습니다.';
            setMessage(`일정 분석에 실패했습니다. ${errorMessage}`);
        } finally {
            setAnalyzingSchedule(false);
        }
    }, [
        analyzingSchedule,
        appendAnalyzedSchedulesToBoard,
        date,
        hasScopedPersonnelAccess,
        isPersonnelInputMode,
        loading,
        mapAssignmentToSchedule,
        scheduleMatchesViewerScope,
        viewerTeamScope.label,
    ]);

    const resetKakaoModal = useCallback(() => {
        setKakaoText('');
        setKakaoFile(null);
        setIsKakaoFileDragging(false);
        if (kakaoFileInputRef.current) kakaoFileInputRef.current.value = '';
    }, []);

    const closeKakaoModal = useCallback(() => {
        setIsKakaoModalOpen(false);
        resetKakaoModal();
    }, [resetKakaoModal]);

    const selectKakaoFile = useCallback((file?: File | null) => {
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            setMessage('카톡 분석은 이미지 파일만 첨부할 수 있습니다.');
            return;
        }
        setKakaoFile(file);
    }, []);

    const formatFileSize = useCallback((bytes: number) => {
        if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
        if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }, []);

    const handleKakaoModalAnalyze = useCallback(async () => {
        const text = kakaoText.trim();
        const file = kakaoFile;

        if (!text && !file) {
            setMessage('카톡 텍스트를 입력하거나 스크린샷을 첨부하세요.');
            return;
        }

        const apiKey = geminiService.getKey();
        if (!apiKey) {
            setMessage('Gemini API 키가 설정되어 있지 않아 카톡 분석을 실행할 수 없습니다.');
            return;
        }

        setIsKakaoAnalyzing(true);
        setMessage('');
        try {
            const analyzedReports = file
                ? await geminiService.analyzeKakaoImage(file, buildKakaoAnalyzeContext())
                : await geminiService.analyzeKakaoText(text, buildKakaoAnalyzeContext());
            const result = buildSchedulesFromAnalyzedReports(analyzedReports, 'kakao');
            if (result.schedules.length === 0) {
                setMessage('카톡에서 보드로 만들 일보 데이터를 찾지 못했습니다.');
                return;
            }

            appendAnalyzedSchedulesToBoard(result.schedules);
            setIsKakaoModalOpen(false);
            resetKakaoModal();
            const warnings = [
                result.unknownWorkerCount > 0 ? `미등록 작업자 ${result.unknownWorkerCount}명은 임시 입력줄로 추가` : '',
                result.skippedReportCount > 0 ? `분석 제외 ${result.skippedReportCount}건` : '',
            ].filter(Boolean);
            setMessage(`카톡 분석으로 ${result.schedules.length}개 현장, ${result.totalWorkerCount}개 입력줄을 보드에 추가했습니다.${warnings.length ? ` ${warnings.join(' · ')}` : ''}`);
        } catch (error) {
            console.error('[FieldSchedulePlanner] Failed to analyze Kakao report', error);
            const errorMessage = error instanceof Error ? error.message : '카톡 분석에 실패했습니다.';
            setMessage(`카톡 분석에 실패했습니다. ${errorMessage}`);
        } finally {
            setIsKakaoAnalyzing(false);
        }
    }, [
        appendAnalyzedSchedulesToBoard,
        buildKakaoAnalyzeContext,
        buildSchedulesFromAnalyzedReports,
        kakaoFile,
        kakaoText,
        resetKakaoModal,
    ]);

    const handleTemporarySave = () => {
        if (typeof window === 'undefined') return;

        const normalizedSchedules = mergeSchedulesBySite(schedules);
        const payload = {
            version: 1,
            date,
            savedAt: new Date().toISOString(),
            selectedSiteId,
            offDutyWorkerIds,
            schedules: normalizedSchedules,
        };

        window.localStorage.setItem(getTempDraftStorageKey(date, mode), JSON.stringify(payload));
        setHasTemporaryDraft(true);
        setMessage('임시저장되었습니다.');
    };

    const handleLoadTemporaryDraft = () => {
        if (typeof window === 'undefined') return;

        const raw = window.localStorage.getItem(getTempDraftStorageKey(date, mode));
        if (!raw) {
            setHasTemporaryDraft(false);
            setMessage('불러올 임시저장이 없습니다.');
            return;
        }

        try {
            const parsed = JSON.parse(raw) as {
                schedules?: ScheduleItem[];
                selectedSiteId?: string;
                offDutyWorkerIds?: string[];
            };
            const draftSchedules = Array.isArray(parsed.schedules) ? parsed.schedules : [];
            setSchedules(mergeSchedulesBySite(draftSchedules));
            setSelectedSiteId(parsed.selectedSiteId || '');
            setOffDutyWorkerIds(cleanIds([
                ...(Array.isArray(parsed.offDutyWorkerIds) ? parsed.offDutyWorkerIds : []),
                ...draftSchedules.flatMap((schedule) => schedule.offDutyWorkerIds || []),
            ]));
            setOffDutyDraftWorkerIds([]);
            setOffDutySelectionMode(false);
            setDirty(true);
            setMessage('임시저장을 불러왔습니다.');
        } catch (error) {
            console.error('[FieldSchedulePlanner] Failed to load temporary draft', error);
            window.localStorage.removeItem(getTempDraftStorageKey(date, mode));
            setHasTemporaryDraft(false);
            setMessage('임시저장을 불러오지 못했습니다.');
        }
    };

    const handleCopyScheduleFromDate = async () => {
        if (!copySourceDate) {
            setMessage('복사할 날짜를 선택해주세요.');
            return;
        }

        setCopyingSchedule(true);
        setMessage('');

        try {
            if (isDailyReportInput) {
                const reports = await dailyReportService.getReports(copySourceDate);
                const copiedSchedules = mapDailyReportsToSchedules(reports, copySourceDate, workersById, teamsById, sites, teams, companies);
                const assignments = copiedSchedules.map(scheduleToDispatchAssignment);
                if (assignments.length === 0) {
                    setScheduleClipboard(null);
                    setMessage(`${copySourceDate} 일보 보드 데이터가 없습니다.`);
                    return;
                }

                setScheduleClipboard({
                    sourceDate: copySourceDate,
                    assignments: cloneDispatchAssignments(assignments),
                });
                setMessage(`${copySourceDate} 일보 보드 ${assignments.length}건을 복사했습니다.`);
                return;
            }

            const source = isScheduleConfirmationInput
                ? await scheduleConfirmationBoardService.getBoardByDate(copySourceDate)
                : await dispatchService.getDispatchByDate(copySourceDate);
            const assignments = source?.assignments || [];
            if (assignments.length === 0) {
                setScheduleClipboard(null);
                setMessage(`${copySourceDate} ${isScheduleConfirmationInput ? '일정확정보드' : '일정'}이 없습니다.`);
                return;
            }

            setScheduleClipboard({
                sourceDate: copySourceDate,
                assignments: cloneDispatchAssignments(assignments),
            });
            setMessage(`${copySourceDate} ${isScheduleConfirmationInput ? '일정확정보드' : '일정'} ${assignments.length}건을 복사했습니다.`);
        } catch (error) {
            console.error('[FieldSchedulePlanner] Failed to copy schedule', error);
            setMessage('일정을 복사하지 못했습니다. 잠시 후 다시 시도해주세요.');
        } finally {
            setCopyingSchedule(false);
        }
    };

    const handlePasteScheduleClipboard = () => {
        if (!scheduleClipboard || scheduleClipboard.assignments.length === 0) {
            setMessage('먼저 복사할 날짜의 일정을 복사해주세요.');
            return;
        }

        const clipboardLabel = isDailyReportInput ? '일보 보드' : isScheduleConfirmationInput ? '일정확정보드' : '일정';
        const ok = window.confirm(
            `${scheduleClipboard.sourceDate} ${clipboardLabel}을 ${date}에 붙여넣을까요? 현재 날짜의 ${clipboardLabel}은 대체됩니다.`
        );
        if (!ok) return;

        const copied = scheduleClipboard.assignments.map((assignment, index) => ({
            ...mapAssignmentToSchedule(assignment, index),
            id: makeScheduleId(),
            date,
            status: 'draft' as ScheduleStatus,
        }));
        const nextSchedules = mergeSchedulesBySite(copied);
        updateSchedules(nextSchedules);
        setSelectedSiteId(nextSchedules[0]?.siteId || '');
        setSelectedWorkerIds([]);
        setSelectedSupportTeamIds([]);
        setSelectedVehicleIds([]);
        setDeletedSchedule(null);
        setMessage(`${scheduleClipboard.sourceDate} ${clipboardLabel}을 ${date}에 붙여넣었습니다. 확인 후 저장하세요.`);
    };

    const handleCaptureBoardImage = useCallback(async () => {
        const node = boardRef.current;
        if (!node) {
            setMessage('캡처할 일정 보드를 찾지 못했습니다.');
            return;
        }

        const shouldRestoreEditMode = !boardViewMode;
        const previousScrollTop = node.scrollTop;

        try {
            setCapturingBoard(true);
            if (shouldRestoreEditMode) {
                setBoardViewMode(true);
            }
            await waitForNextPaint();
            await waitForDocumentFonts();

            const target = boardRef.current;
            if (!target) {
                throw new Error('Board capture target was not available');
            }

            const rect = target.getBoundingClientRect();
            const width = Math.ceil(target.scrollWidth || rect.width);
            const height = Math.ceil(target.scrollHeight || rect.height);

            if (width <= 0 || height <= 0) {
                throw new Error('Board capture target has no size');
            }

            const canvas = await html2canvas(target, {
                backgroundColor: '#f8fafc',
                scale: getBoardCaptureScale(width, height),
                useCORS: true,
                allowTaint: false,
                logging: false,
                width,
                height,
                windowWidth: Math.max(document.documentElement.clientWidth, width),
                windowHeight: Math.max(document.documentElement.clientHeight, height),
                scrollX: 0,
                scrollY: -window.scrollY,
                onclone: (clonedDocument: Document) => {
                    const clonedBoard = clonedDocument.getElementById('field-schedule-board') as HTMLElement | null;
                    if (!clonedBoard) return;

                    clonedBoard.style.width = `${width}px`;
                    clonedBoard.style.height = `${height}px`;
                    clonedBoard.style.overflow = 'visible';
                    clonedBoard.style.maxHeight = 'none';

                    let parent = clonedBoard.parentElement;
                    while (parent) {
                        parent.style.overflow = 'visible';
                        parent.style.maxHeight = 'none';
                        parent = parent.parentElement;
                    }

                    clonedDocument.querySelectorAll('[data-board-capture-ignore="true"]').forEach((element) => {
                        (element as HTMLElement).style.display = 'none';
                    });
                },
            } as any);

            const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
            if (!blob) {
                throw new Error('PNG blob generation failed');
            }

            downloadPngBlob(blob, `field-schedule-board-${date}.png`);
            setMessage('커서가 없는 일정 보드 이미지를 저장했습니다.');
        } catch (error) {
            console.error('[FieldSchedulePlanner] Failed to capture board image', error);
            window.alert('일정 보드 이미지 저장 중 문제가 발생했습니다. 다시 시도해주세요.');
        } finally {
            if (shouldRestoreEditMode) {
                setBoardViewMode(false);
            }
            setCapturingBoard(false);
            if (boardRef.current) {
                boardRef.current.scrollTop = previousScrollTop;
            }
        }
    }, [boardViewMode, date]);

    const pageEyebrow = isDailyReportInput
        ? '일보 보드 입력'
        : isScheduleConfirmationInput
            ? ''
            : '현장 이동 일정 등록';
    const pageTitle = isDailyReportInput ? '보드입력' : isScheduleConfirmationInput ? '일정확정보드' : '현장 일정 보드';
    const pageDescription = isDailyReportInput
        ? '현장을 선택하고 작업자/지원팀, 공수, 단가, 급여구분, 작업내용을 카드에서 입력한 뒤 출력일보로 저장합니다.'
        : isScheduleConfirmationInput
            ? ''
            : '현장을 선택하고 작업자 또는 지원팀명을 고른 뒤 하나의 현장 카드에 모아 배치합니다.';
    const copyInputLabel = '복사일';
    const boardSummaryLabel = isDailyReportInput
        ? `일보 보드 ${visibleScheduleCountLabel}개 현장 · 현장구분/결제와 단가까지 출력일보로 반영합니다.`
        : isScheduleConfirmationInput
            ? `확정보드 ${visibleScheduleCountLabel}개 현장 · 현장별 작업자와 지원팀 입력값을 별도 저장합니다.`
            : `보드보기 ${visibleScheduleCountLabel}개 현장 · 현장/팀 색상과 작업자, 지원팀, 차량을 한눈에 확인합니다.`;
    const editSummaryLabel = isDailyReportInput
        ? `현장 카드 ${visibleScheduleCountLabel}건 · 작업자와 지원팀을 출력일보 입력줄로 저장합니다.`
        : isScheduleConfirmationInput
            ? `현장 카드 ${visibleScheduleCountLabel}건 · 모바일에서 공수, 단가, 급여구분, 작업내용을 바로 확정합니다.`
            : `현장 카드 ${visibleScheduleCountLabel}건 · 같은 날짜의 같은 현장은 하나의 카드로 합쳐집니다.`;

    const selectedSite = selectedSiteId ? sitesById.get(selectedSiteId) : undefined;
    const selectedSiteColor = selectedSite ? getSiteColor(selectedSite, selectedRoster?.color) : '';
    const selectedResourceCount = isPersonnelInputMode
        ? selectedWorkerIds.length
        : selectedWorkerIds.length + selectedSupportTeamIds.length + selectedVehicleIds.length;
    const canMoveSelected =
        !offDutySelectionMode && Boolean(selectedSiteId) && selectedResourceCount > 0;
    const moveTargetLabel = selectedSite?.name || '현장 선택';
    const moveSourceLabel =
        selectedWorkerIds.length > 0
            ? selectedRoster?.name || '팀 선택'
            : selectedSupportTeams.length > 0
                ? selectedSupportTeams[0].name
                : !isPersonnelInputMode && selectedVehicleIds.length > 0
                    ? '차량'
                    : '대상 선택';
    const selectedWorkerNames = selectedWorkers.map((worker) => worker.name);
    const selectedResourceParts = [
        selectedWorkers.length > 0
            ? `${selectedWorkerNames.slice(0, 3).join(', ')}${selectedWorkerNames.length > 3 ? ` 외 ${selectedWorkerNames.length - 3}명` : ''}`
            : '',
        !isPersonnelInputMode && selectedSupportTeams.length > 0 ? `지원팀 ${selectedSupportTeams.length}팀` : '',
        !isPersonnelInputMode && selectedVehicles.length > 0 ? `차량 ${selectedVehicles.length}대` : '',
    ].filter(Boolean);
    const moveWorkerLabel = selectedResourceParts.join(' · ') || (isPersonnelInputMode ? '작업자/지원팀 선택' : '작업자/지원팀/차량 선택');
    const addGuideLabel = selectedSite
        ? selectedResourceParts.length > 0
            ? isPersonnelInputMode
                ? `${selectedSite.name} ${isScheduleConfirmationInput ? '확정보드' : '일보'}에 ${selectedResourceParts.join(', ')} 추가`
                : `${selectedSite.name}으로 ${selectedResourceParts.join(', ')} 추가`
            : isPersonnelInputMode
                ? `${selectedSite.name} 현장 카드에 작업자를 추가하세요.`
                : `${selectedSite.name} 현장만 먼저 등록할 수 있습니다.`
        : isPersonnelInputMode ? '입력할 현장을 먼저 선택하세요' : '현장 카드를 먼저 선택하세요';
    const selectedDestinationScheduleKey = selectedSite
        ? makeSiteKey({ siteId: selectedSite.id || '', siteName: selectedSite.name } as Pick<ScheduleItem, 'siteId' | 'siteName'>)
        : '';
    const selectedWorkerPreviewNames = selectedWorkerNames.filter(Boolean);
    const selectedSupportTeamNames = selectedSupportTeams.map((team) => team.name).filter(Boolean);
    const selectedVehicleNames = selectedVehicles
        .map((vehicle) => vehicle.licensePlate || vehicle.model || vehicle.id)
        .filter(Boolean);
    const selectedResourcePreviewItems = isPersonnelInputMode
        ? selectedWorkerPreviewNames
        : [
            ...selectedWorkerPreviewNames,
            ...selectedSupportTeamNames.map((name) => `지원 ${name}`),
            ...selectedVehicleNames.map((name) => `차량 ${name}`),
        ];
    const selectedResourcePreviewLimit = isPersonnelInputMode ? 5 : 6;
    const selectedResourcePreviewOverflow = Math.max(0, selectedResourcePreviewItems.length - selectedResourcePreviewLimit);
    const selectedResourceKindLabel = isPersonnelInputMode
        ? selectedRoster?.kind === 'support' ? '지원팀 인원' : '작업자'
        : '선택 항목';
    const selectedResourcePreviewCount = isPersonnelInputMode ? selectedWorkerPreviewNames.length : selectedResourceCount;
    const selectedGroupLabel = selectedRoster
        ? `${selectedRoster.name}${selectedRoster.kind === 'support' ? ' · 지원팀' : ''}`
        : '팀/지원팀 미선택';
    const mobileSecondaryRowLabel = isPersonnelInputMode ? '팀/지원' : '선택';
    const mobileSecondaryRowValue = isPersonnelInputMode
        ? selectedGroupLabel
        : selectedResourceParts.join(' · ') || '작업자/지원팀/차량 미선택';
    const mobileSelectionStatusLabel = !selectedSite
        ? '현장 선택 필요'
        : selectedResourceCount > 0
            ? isPersonnelInputMode ? '등록 가능' : '추가 가능'
            : isPersonnelInputMode ? '인원 선택 필요' : '항목 선택 필요';
    const mobileSelectionStatusClass = !selectedSite
        ? 'bg-amber-50 text-amber-700'
        : selectedResourceCount > 0
            ? 'bg-emerald-50 text-emerald-700'
            : 'bg-slate-100 text-slate-500';
    const mobileSelectionEmptyLabel = isPersonnelInputMode
        ? '팀/작업자 또는 지원팀 탭에서 인원을 선택하세요.'
        : '팀/작업자, 지원팀, 차량 탭에서 항목을 선택하세요.';
    const mobileSelectionButtonLabel = isPersonnelInputMode ? '선택 인원 추가하기' : '선택 항목 추가하기';
    const offDutyDraftCount = offDutyDraftWorkerIds.length;
    const showOffDutyControls = leftPanelTab === 'teams' || leftPanelTab === 'support';
    const showMobileSelectionSummary = !offDutySelectionMode;
    const showDailyReportMobileInputMode = isDailyReportInput && isMobileBoardLayout;
    const showDisplayBoardCards = boardViewMode && !isScheduleConfirmationInput && !showDailyReportMobileInputMode;
    const showCopyControls = !isDailyReportInput && !isScheduleConfirmationInput;
    const useSelectionInputToggleLabel = isScheduleConfirmationInput || showDailyReportMobileInputMode;
    const viewToggleLabel = useSelectionInputToggleLabel
        ? boardViewMode ? '선택보기' : '입력보기'
        : boardViewMode ? '편집보기' : '보드보기';

    return (
        <div className={`${isPersonnelInputMode ? 'min-h-full overflow-visible lg:h-full lg:min-h-0 lg:overflow-hidden' : 'min-h-full'} bg-slate-100 text-slate-900`}>
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragCancel={handleDragCancel}
            >
                <div className={isPersonnelInputMode
                    ? 'flex min-h-full flex-col lg:h-full lg:min-h-0 lg:overflow-hidden'
                    : 'flex min-h-[calc(100vh-72px)] flex-col lg:h-[calc(100vh-72px)] lg:min-h-[760px]'}
                >
                    <header className="shrink-0 border-b border-slate-200 bg-white px-4 py-4 sm:px-5">
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                            <div>
                                {pageEyebrow ? (
                                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                                        <UsersRound size={14} />
                                        {pageEyebrow}
                                    </div>
                                ) : null}
                                <h1 className={`${pageEyebrow ? 'mt-1' : ''} text-2xl font-black tracking-tight text-slate-950`}>{pageTitle}</h1>
                                {pageDescription ? (
                                    <p className="mt-1 text-sm text-slate-500">
                                        {pageDescription}
                                    </p>
                                ) : null}
                            </div>

                            <div className="flex w-full flex-wrap items-center gap-2 xl:w-auto">
                                <div className="flex min-w-[214px] flex-1 items-center rounded-lg border border-slate-200 bg-slate-50 p-1 sm:flex-none">
                                    <button
                                        type="button"
                                        onClick={() => setDate((prev) => shiftDate(prev, -1))}
                                        disabled={loading || saving}
                                        className="flex h-9 w-9 items-center justify-center rounded-md text-slate-600 hover:bg-white"
                                        title="이전일"
                                        aria-label="이전일"
                                    >
                                        <ChevronLeft size={17} />
                                    </button>
                                    <input
                                        type="date"
                                        value={date}
                                        onChange={(event) => setDate(event.target.value)}
                                        disabled={loading || saving}
                                        aria-label="보드입력 기준 날짜"
                                        className="h-9 min-w-0 flex-1 rounded-md border-0 bg-transparent px-2 text-sm font-bold text-slate-800 outline-none disabled:cursor-not-allowed disabled:text-slate-400 sm:flex-none"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setDate((prev) => shiftDate(prev, 1))}
                                        disabled={loading || saving}
                                        className="flex h-9 w-9 items-center justify-center rounded-md text-slate-600 hover:bg-white"
                                        title="다음일"
                                        aria-label="다음일"
                                    >
                                        <ChevronRight size={17} />
                                    </button>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setDate(getTodayInputValue())}
                                    disabled={loading || saving}
                                    className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                                >
                                    오늘
                                </button>
                                {false && hasScheduleConfirmationTeamScope ? (
                                    <button
                                        type="button"
                                        onClick={() => setShowAllScheduleConfirmationSites((prev) => !prev)}
                                        className={`flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-bold sm:flex-none ${
                                            showAllScheduleConfirmationSites
                                                ? 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                                                : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                                        }`}
                                        title={showAllScheduleConfirmationSites ? '내 팀 담당현장과 지원팀 현장만 보기' : '전체 현장 보기'}
                                    >
                                        <MapPin size={16} />
                                        {showAllScheduleConfirmationSites ? '내 팀 보기' : '전체보기'}
                                    </button>
                                ) : null}
                                {hasScopedPersonnelAccess ? (
                                    <div className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 text-sm font-bold text-blue-700 sm:flex-none">
                                        <MapPin size={16} />
                                        {workerAccessScope.mode === 'team'
                                            ? `${workerAccessScope.label} 팀 정보`
                                            : `${workerAccessScope.label} 본인 정보`}
                                    </div>
                                ) : null}
                                {isPersonnelInputMode ? (
                                    <>
                                        <button
                                            type="button"
                                            onClick={handleScheduleAnalyzeClick}
                                            disabled={loading || analyzingSchedule}
                                            className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 text-sm font-bold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300 sm:flex-none"
                                        >
                                            <CalendarDays size={16} />
                                            {analyzingSchedule ? '분석 중' : '일정 분석'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setIsKakaoModalOpen(true)}
                                            disabled={loading || isKakaoAnalyzing}
                                            className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-yellow-400 px-3 text-sm font-black text-slate-900 shadow-sm hover:bg-yellow-500 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 sm:flex-none"
                                        >
                                            <MessageCircle size={16} />
                                            {isKakaoAnalyzing ? '분석 중' : '카톡 분석'}
                                        </button>
                                    </>
                                ) : null}
                                {showCopyControls ? (
                                    <>
                                        <div className="flex w-full min-w-0 flex-none items-center rounded-lg border border-slate-200 bg-slate-50 p-1 sm:w-auto">
                                            <span className="hidden px-2 text-xs font-bold text-slate-500 sm:inline">{copyInputLabel}</span>
                                            <input
                                                type="date"
                                                value={copySourceDate}
                                                onChange={(event) => setCopySourceDate(event.target.value)}
                                                className="h-9 min-w-0 flex-1 rounded-md border-0 bg-transparent px-2 text-sm font-bold text-slate-800 outline-none sm:w-[142px] sm:flex-none"
                                                aria-label="복사할 일정 날짜"
                                            />
                                            <button
                                                type="button"
                                                onClick={handleCopyScheduleFromDate}
                                                disabled={copyingSchedule || !copySourceDate}
                                                className="flex h-9 items-center gap-1.5 rounded-md px-2 text-sm font-bold text-slate-700 hover:bg-white disabled:cursor-not-allowed disabled:text-slate-300 sm:px-3"
                                                title="선택한 날짜 일정 복사"
                                            >
                                                <ClipboardCopy size={16} />
                                                {copyingSchedule ? '복사 중' : '복사'}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handlePasteScheduleClipboard}
                                                disabled={!scheduleClipboard || copyingSchedule || loading}
                                                className="flex h-9 items-center gap-1.5 rounded-md px-2 text-sm font-bold text-blue-700 hover:bg-white disabled:cursor-not-allowed disabled:text-slate-300 sm:px-3"
                                                title={scheduleClipboard ? `${scheduleClipboard.sourceDate} 일정 붙여넣기` : '복사된 일정 없음'}
                                            >
                                                <ClipboardPaste size={16} />
                                                붙여넣기
                                            </button>
                                        </div>
                                        {scheduleClipboard ? (
                                            <span className="flex h-10 items-center rounded-lg bg-blue-50 px-3 text-xs font-bold text-blue-700">
                                                {scheduleClipboard.sourceDate} 복사됨
                                            </span>
                                        ) : null}
                                    </>
                                ) : null}
                                <button
                                    type="button"
                                    onClick={() => setBoardViewMode((prev) => !prev)}
                                    className={`flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-bold sm:flex-none ${
                                        boardViewMode
                                            ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                    }`}
                                >
                                    <Eye size={16} />
                                    {viewToggleLabel}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleTemporarySave}
                                    className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 text-sm font-bold text-amber-700 hover:bg-amber-100 sm:flex-none"
                                >
                                    <Save size={16} />
                                    임시저장
                                </button>
                                {hasTemporaryDraft ? (
                                    <button
                                        type="button"
                                        onClick={handleLoadTemporaryDraft}
                                        className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 hover:bg-slate-50 sm:flex-none"
                                    >
                                        <RefreshCw size={16} />
                                        임시불러오기
                                    </button>
                                ) : null}
                                <button
                                    type="button"
                                    onClick={handleSave}
                                    disabled={saving || !dirty}
                                    className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 sm:flex-none"
                                >
                                    <Save size={16} />
                                    {saving ? '저장 중' : dirty ? (isDailyReportInput ? '일보 저장' : isScheduleConfirmationInput ? '확정 저장' : '저장') : '저장됨'}
                                </button>
                            </div>
                        </div>
                    </header>

                    <div className={`grid min-h-0 flex-none overflow-visible lg:h-0 lg:flex-1 lg:overflow-hidden ${boardViewMode ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)]'}`}>
                        {!boardViewMode ? (
                        <aside className="relative flex min-h-0 flex-col overflow-visible border-b border-slate-200 bg-white lg:h-full lg:overflow-hidden lg:border-b-0 lg:border-r">
                            <div className="shrink-0 border-b border-slate-200 p-4">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input
                                        value={searchTerm}
                                        onChange={(event) => setSearchTerm(event.target.value)}
                                        placeholder={
                                            isPersonnelInputMode
                                                ? leftPanelTab === 'sites'
                                                    ? '현장명, 주소 검색'
                                                    : leftPanelTab === 'support'
                                                        ? '지원팀, 용역팀 검색'
                                                        : '팀, 작업자 검색'
                                            : leftPanelTab === 'vehicles'
                                                ? '차량번호, 모델 검색'
                                                : leftPanelTab === 'sites'
                                                    ? '현장명, 주소 검색'
                                                    : '팀, 작업자 검색'
                                        }
                                        className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white"
                                    />
                                </div>

                                <div className={`mt-3 grid ${isPersonnelInputMode ? 'grid-cols-3' : 'grid-cols-4'} gap-1 rounded-lg bg-slate-100 p-1`}>
                                    <button
                                        type="button"
                                        onClick={() => setLeftPanelTab('sites')}
                                        className={`flex h-8 items-center justify-center gap-1.5 rounded-md text-xs font-black ${
                                            leftPanelTab === 'sites' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'
                                        }`}
                                    >
                                        <MapPin size={14} />
                                        현장
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setLeftPanelTab('teams')}
                                        className={`flex h-8 items-center justify-center gap-1.5 rounded-md text-xs font-black ${
                                            leftPanelTab === 'teams' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'
                                        }`}
                                    >
                                        <UsersRound size={14} />
                                        팀/작업자
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setLeftPanelTab('support')}
                                        className={`flex h-8 items-center justify-center gap-1.5 rounded-md text-xs font-black ${
                                            leftPanelTab === 'support' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'
                                        }`}
                                    >
                                        <UserPlus size={14} />
                                        지원팀
                                    </button>
                                    {!isPersonnelInputMode ? (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => setLeftPanelTab('vehicles')}
                                                className={`flex h-8 items-center justify-center gap-1.5 rounded-md text-xs font-black ${
                                                    leftPanelTab === 'vehicles' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'
                                                }`}
                                            >
                                                <Truck size={14} />
                                                차량
                                            </button>
                                        </>
                                    ) : null}
                                </div>

                                {false && hasScheduleConfirmationTeamScope ? (
                                    <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800">
                                        <span className="min-w-0 flex-1 truncate">
                                            {showAllScheduleConfirmationSites
                                                ? '전체 현장 표시 중'
                                                : `${viewerTeamScope.label} 담당현장 + 지원팀 현장`}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setShowAllScheduleConfirmationSites((prev) => !prev)}
                                            className="shrink-0 rounded-md bg-white px-2 py-1 font-black text-blue-700 hover:bg-blue-100"
                                        >
                                            {showAllScheduleConfirmationSites ? '기본보기' : '전체보기'}
                                        </button>
                                    </div>
                                ) : null}

                                {showOffDutyControls ? (
                                    <div className="fixed bottom-3 z-20 max-h-[min(42vh,360px)] w-[calc(100vw-1.5rem)] max-w-[336px] overflow-y-auto rounded-lg border border-rose-100 bg-rose-50/95 p-2 shadow-lg backdrop-blur lg:w-[336px]">
                                        {!offDutySelectionMode ? (
                                            <button
                                                type="button"
                                                onClick={startOffDutySelection}
                                                className="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-rose-200 bg-white text-xs font-black text-rose-700 hover:bg-rose-50"
                                            >
                                                <UserX size={15} />
                                                휴무자 선택
                                                {offDutyWorkers.length > 0 ? (
                                                    <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px]">
                                                        {offDutyWorkers.length}명
                                                    </span>
                                                ) : null}
                                            </button>
                                        ) : (
                                            <div className="grid gap-2">
                                                <div className="flex items-center justify-between gap-2 px-1 text-xs font-black text-rose-800">
                                                    <span className="inline-flex items-center gap-1.5">
                                                        <UserX size={14} />
                                                        휴무자 선택 중
                                                    </span>
                                                    <span>{offDutyDraftCount}명 체크</span>
                                                </div>
                                                <div className="grid grid-cols-[1fr_auto] gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={applyOffDutySelection}
                                                        disabled={offDutyDraftCount === 0}
                                                        className="flex h-9 items-center justify-center rounded-md bg-rose-600 px-3 text-xs font-black text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                                                    >
                                                        휴무자로 분리
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={cancelOffDutySelection}
                                                        className="h-9 rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:bg-slate-50"
                                                    >
                                                        취소
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {offDutyWorkers.length > 0 ? (
                                            <div className="mt-2 rounded-md bg-white px-2 py-2">
                                                <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px] font-black text-slate-500">
                                                    <span>휴무자 {offDutyWorkers.length}명</span>
                                                    <button
                                                        type="button"
                                                        onClick={clearOffDutyWorkers}
                                                        className="text-rose-600 hover:text-rose-700"
                                                    >
                                                        전체 해제
                                                    </button>
                                                </div>
                                                <div className="space-y-2">
                                                    {offDutyWorkerGroups.map((group) => (
                                                        <div key={group.id} className="rounded-md border border-rose-100 bg-rose-50/70 px-2 py-1.5">
                                                            <div className="mb-1 flex items-center justify-between gap-2 text-[11px] font-black text-rose-700">
                                                                <span className="inline-flex min-w-0 items-center gap-1.5">
                                                                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: group.color }} />
                                                                    <span className="truncate">{group.name}</span>
                                                                </span>
                                                                <span className="shrink-0">{group.workers.length}명</span>
                                                            </div>
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {group.workers.map((worker) => (
                                                                    <span
                                                                        key={worker.id}
                                                                        className="inline-flex max-w-full items-center gap-1 rounded-md border border-rose-100 bg-white px-2 py-1 text-xs font-bold text-rose-700"
                                                                    >
                                                                        <span className="truncate">{worker.name}</span>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => worker.id && restoreOffDutyWorker(worker.id)}
                                                                            className="shrink-0 text-rose-400 hover:text-rose-700"
                                                                            title="휴무자에서 제외"
                                                                        >
                                                                            <X size={12} />
                                                                        </button>
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : null}
                                    </div>
                                ) : null}

                                {showMobileSelectionSummary ? (
                                    <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50/80 p-3 shadow-sm lg:hidden">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-xs font-black text-blue-800">선택 정보</span>
                                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-black ${mobileSelectionStatusClass}`}>
                                                {mobileSelectionStatusLabel}
                                            </span>
                                        </div>
                                        <div className="mt-2 grid gap-2 text-xs font-bold text-slate-700">
                                            <div className="flex min-w-0 items-center gap-2 rounded-lg bg-white px-2.5 py-2">
                                                <MapPin size={14} className="shrink-0 text-blue-600" />
                                                <span className="shrink-0 text-slate-400">현장</span>
                                                <span className="min-w-0 flex-1 truncate text-right font-black text-slate-900">
                                                    {selectedSite?.name || '미선택'}
                                                </span>
                                            </div>
                                            <div className="flex min-w-0 items-center gap-2 rounded-lg bg-white px-2.5 py-2">
                                                <UsersRound size={14} className="shrink-0 text-blue-600" />
                                                <span className="shrink-0 text-slate-400">{mobileSecondaryRowLabel}</span>
                                                <span className="min-w-0 flex-1 truncate text-right font-black text-slate-900">
                                                    {mobileSecondaryRowValue}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="mt-2 rounded-lg bg-white px-2.5 py-2">
                                            <div className="flex items-center justify-between gap-2 text-xs font-black">
                                                <span className="text-slate-500">{selectedResourceKindLabel}</span>
                                                <span className="text-blue-700">
                                                    {isPersonnelInputMode ? `${selectedResourcePreviewCount}명 선택` : `${selectedResourcePreviewCount}개 선택`}
                                                </span>
                                            </div>
                                            {selectedResourcePreviewItems.length > 0 ? (
                                                <div className="mt-2 flex flex-wrap gap-1.5">
                                                    {selectedResourcePreviewItems.slice(0, selectedResourcePreviewLimit).map((name, index) => (
                                                        <span
                                                            key={`${name}-${index}`}
                                                            className="max-w-full truncate rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-700"
                                                        >
                                                            {name}
                                                        </span>
                                                    ))}
                                                    {selectedResourcePreviewOverflow > 0 ? (
                                                        <span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-black text-blue-700">
                                                            외 {selectedResourcePreviewOverflow}{isPersonnelInputMode ? '명' : '개'}
                                                        </span>
                                                    ) : null}
                                                </div>
                                            ) : (
                                                <p className="mt-1 text-xs font-semibold text-slate-400">
                                                    {mobileSelectionEmptyLabel}
                                                </p>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={moveSelectedToBoard}
                                            disabled={!canMoveSelected}
                                            className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-slate-900 text-sm font-black text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                                        >
                                            <Plus size={17} />
                                            {mobileSelectionButtonLabel}
                                        </button>
                                    </div>
                                ) : null}

                                {leftPanelTab !== 'sites' && !offDutySelectionMode ? (
                                    <div className={`mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2 ${showMobileSelectionSummary ? 'hidden lg:block' : ''}`}>
                                        <div className="mb-2 flex min-w-0 items-center gap-2 px-1 text-xs font-bold text-slate-600">
                                            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: selectedSiteColor || '#cbd5e1' }} />
                                            <span className="min-w-0 flex-1 truncate">{moveTargetLabel}</span>
                                            <span className="shrink-0 text-slate-400">{selectedResourceCount}개 선택</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={moveSelectedToBoard}
                                            disabled={!canMoveSelected}
                                            className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-slate-900 text-sm font-black text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                                        >
                                            <Plus size={17} />
                                            추가하기
                                        </button>
                                    </div>
                                ) : null}
                            </div>

                            <div className={`h-auto flex-none space-y-3 overflow-visible p-3 ${showOffDutyControls ? 'pb-96' : 'pb-24'} lg:h-0 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain`} style={{ scrollbarGutter: 'stable' }}>
                                {loading ? (
                                    <div className="rounded-lg border border-dashed border-slate-200 p-5 text-center text-sm font-semibold text-slate-500">
                                        데이터를 불러오는 중입니다.
                                    </div>
                                ) : leftPanelTab === 'sites' ? (
                                    filteredSites.length > 0 ? (
                                        <div className="space-y-2">
                                            {filteredSites.map((site) => {
                                                const siteColor = getSiteColor(site, selectedRoster?.color || DEFAULT_RESOURCE_COLOR);
                                                const siteKey = makeSiteSelectionKey(site);
                                                return (
                                                    <DraggableSiteCard
                                                        key={site.id || site.name}
                                                        site={site}
                                                        color={siteColor}
                                                        selected={Boolean(selectedSite && siteKey === makeSiteSelectionKey(selectedSite))}
                                                        onSelect={() => {
                                                            setSelectedSiteId(site.id || '');
                                                            setMessage(isPersonnelInputMode ? `입력 현장: ${site.name}` : `이동 대상: ${site.name}`);
                                                        }}
                                                        onRegister={() => registerSiteToBoard(site.id || site.name)}
                                                    />
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="rounded-lg border border-dashed border-slate-200 p-5 text-center text-sm text-slate-500">
                                            표시할 현장이 없습니다.
                                        </div>
                                    )
                                ) : leftPanelTab === 'support' ? (
                                    displayFilteredRosters.length > 0 ? (
                                        <div className="space-y-2">
                                            {displayFilteredRosters.map((roster) => {
                                                const useSupportWorkerSelection = isPersonnelInputMode || roster.workers.length > 0;
                                                return useSupportWorkerSelection ? (
                                                    <TeamRosterCard
                                                        key={roster.id}
                                                        roster={roster}
                                                        selected={offDutySelectionMode ? roster.workers.some((worker) => Boolean(worker.id && offDutyDraftWorkerIdSet.has(worker.id))) : selectedRoster?.id === roster.id}
                                                        onSelect={() => setSelectedTeamId(roster.id)}
                                                        selectedWorkerIds={offDutySelectionMode ? offDutyDraftWorkerIdSet : selectedRoster?.id === roster.id ? selectedWorkerIdSet : new Set()}
                                                        supportSelected={!offDutySelectionMode && !isPersonnelInputMode && selectedSupportTeamIdSet.has(roster.id)}
                                                        forceWorkerSelection
                                                        showSupportTeamToggle={!offDutySelectionMode && !isPersonnelInputMode}
                                                        onToggleSupportTeam={() => !offDutySelectionMode && toggleSupportTeamSelection(roster)}
                                                        onToggleWorker={(workerId) => offDutySelectionMode ? toggleOffDutyDraftWorker(workerId) : toggleWorkerSelection(roster.id, workerId)}
                                                        onToggleAllWorkers={() => offDutySelectionMode ? toggleAllOffDutyDraftWorkers(roster) : toggleAllWorkers(roster)}
                                                    />
                                                ) : (
                                                    <SupportRosterLineCard
                                                        key={roster.id}
                                                        roster={roster}
                                                        selected={selectedSupportTeamIdSet.has(roster.id)}
                                                        onSelect={() => toggleSupportTeamSelection(roster)}
                                                        onAdd={() => moveRosterToBoard(roster)}
                                                    />
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="rounded-lg border border-dashed border-slate-200 p-5 text-center text-sm text-slate-500">
                                            {offDutySelectionMode ? '휴무 처리할 지원팀 작업자가 없습니다.' : '표시할 지원팀이 없습니다.'}
                                        </div>
                                    )
                                ) : leftPanelTab !== 'vehicles' ? (
                                    displayFilteredRosters.length > 0 ? (
                                        displayFilteredRosters.map((roster) => (
                                            <TeamRosterCard
                                                key={roster.id}
                                                roster={roster}
                                                selected={offDutySelectionMode ? roster.workers.some((worker) => Boolean(worker.id && offDutyDraftWorkerIdSet.has(worker.id))) : selectedRoster?.id === roster.id}
                                                onSelect={() => setSelectedTeamId(roster.id)}
                                                selectedWorkerIds={offDutySelectionMode ? offDutyDraftWorkerIdSet : selectedRoster?.id === roster.id ? selectedWorkerIdSet : new Set()}
                                                supportSelected={!offDutySelectionMode && selectedSupportTeamIdSet.has(roster.id)}
                                                onToggleSupportTeam={() => !offDutySelectionMode && toggleSupportTeamSelection(roster)}
                                                onToggleWorker={(workerId) => offDutySelectionMode ? toggleOffDutyDraftWorker(workerId) : toggleWorkerSelection(roster.id, workerId)}
                                                onToggleAllWorkers={() => offDutySelectionMode ? toggleAllOffDutyDraftWorkers(roster) : toggleAllWorkers(roster)}
                                            />
                                        ))
                                    ) : (
                                        <div className="rounded-lg border border-dashed border-slate-200 p-5 text-center text-sm text-slate-500">
                                            {offDutySelectionMode ? '휴무 처리할 작업자가 없습니다.' : '표시할 팀이나 작업자가 없습니다.'}
                                        </div>
                                    )
                                ) : filteredVehicles.length > 0 ? (
                                    <div className="space-y-2">
                                        {filteredVehicles.map((vehicle) => (
                                            <DraggableVehicleCard
                                                key={vehicle.id}
                                                vehicle={vehicle}
                                                selected={selectedVehicleIdSet.has(vehicle.id)}
                                                assignedTeamColor={vehicleAssignedTeamColorById.get(vehicle.id)}
                                                onToggleSelect={() => toggleVehicleSelection(vehicle.id)}
                                                onAdd={() => moveVehicleToBoard(vehicle)}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="rounded-lg border border-dashed border-slate-200 p-5 text-center text-sm text-slate-500">
                                        표시할 차량이 없습니다.
                                    </div>
                                )}
                            </div>
                        </aside>
                        ) : null}

                        <main className={`${boardViewMode ? 'flex' : 'hidden lg:flex'} min-w-0 flex-col overflow-visible bg-slate-100 lg:min-h-0 lg:overflow-hidden`}>
                            {!boardViewMode ? (
                            <div className="shrink-0 border-b border-slate-200 bg-white px-5 py-4">
                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                    <div className="min-w-0">
                                        <div className="mb-2 text-xs font-black text-slate-500">{isPersonnelInputMode ? (isScheduleConfirmationInput ? '일정확정 입력' : '일보 입력') : '이동 경로'}</div>
                                        <div className="flex flex-wrap items-center gap-2 text-sm font-black text-slate-800">
                                            <span className="inline-flex min-w-0 items-center gap-1.5 rounded-md bg-white px-2.5 py-1">
                                                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: selectedRoster?.color || '#cbd5e1' }} />
                                                <span className="truncate">{moveSourceLabel}</span>
                                            </span>
                                            <ChevronRight size={16} className="text-slate-400" />
                                            <span className="inline-flex max-w-full items-center rounded-md bg-white px-2.5 py-1 text-slate-600">
                                                <span className="truncate">{moveWorkerLabel}</span>
                                            </span>
                                            <ChevronRight size={16} className="text-slate-400" />
                                            <span className="inline-flex min-w-0 items-center gap-1.5 rounded-md bg-white px-2.5 py-1">
                                                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: selectedSiteColor || '#cbd5e1' }} />
                                                <span className="truncate">{moveTargetLabel}</span>
                                            </span>
                                        </div>
                                        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs font-bold text-slate-500">
                                            <span>{addGuideLabel}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-700">
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1">
                                        <UsersRound size={13} />
                                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: selectedRoster?.color || '#cbd5e1' }} />
                                        {selectedRoster?.name || '팀 미선택'}
                                    </span>
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1">
                                        <MapPin size={13} />
                                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: selectedSiteColor || '#cbd5e1' }} />
                                        {selectedSite?.name || '현장 미선택'}
                                    </span>
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1">
                                        {isPersonnelInputMode ? <Check size={13} /> : <Truck size={13} />}
                                        {isPersonnelInputMode ? '공수·작업내용 입력' : '차량 선택 후 추가 가능'}
                                    </span>
                                    {totalIssues > 0 ? (
                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-red-600">
                                            <AlertTriangle size={13} />
                                            확인 필요 {totalIssues}건
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
                                            <Check size={13} />
                                            충돌 없음
                                        </span>
                                    )}
                                    <button
                                        type="button"
                                        onClick={loadData}
                                        className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-slate-600 hover:bg-slate-50"
                                    >
                                        <RefreshCw size={13} />
                                        새로고침
                                    </button>
                                </div>
                            </div>
                            ) : null}

                            <div
                                ref={(node) => {
                                    setBoardDropRef(node);
                                    boardRef.current = node;
                                }}
                                id="field-schedule-board"
                                data-capture-full-content="true"
                                data-capture-clean={capturingBoard ? 'true' : undefined}
                                className={`flex-none overflow-visible px-4 pt-4 pb-24 transition lg:min-h-0 lg:flex-1 lg:overflow-y-auto ${boardViewMode ? 'sm:px-6 sm:pt-6' : 'sm:px-5 sm:pt-5'} ${
                                    isBoardOver ? 'bg-blue-50 ring-2 ring-inset ring-blue-100' : ''
                                }`}
                                style={
                                    boardViewMode
                                        ? {
                                            backgroundColor: '#f8fafc',
                                            backgroundImage:
                                                'linear-gradient(#e2e8f0 1px, transparent 1px), linear-gradient(90deg, #e2e8f0 1px, transparent 1px)',
                                            backgroundSize: '33px 33px',
                                        }
                                        : undefined
                                }
                            >
                                <div className={`mb-4 flex items-center justify-between ${boardViewMode ? 'rounded-lg border border-slate-200 bg-white/92 px-4 py-3 shadow-sm' : ''}`}>
                                    <div>
                                        <h2 className={`${boardViewMode ? 'text-xl' : 'text-lg'} font-black text-slate-950`}>{formatDisplayDate(date)}</h2>
                                        <p className="mt-1 text-sm font-bold text-slate-500">
                                            {boardViewMode ? boardSummaryLabel : editSummaryLabel}
                                        </p>
                                    </div>
                                </div>

                                {loading ? (
                                    <div className="flex min-h-[360px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white text-sm font-bold text-slate-500">
                                        {isPersonnelInputMode ? (isScheduleConfirmationInput ? '일정확정보드를 불러오는 중입니다.' : '일보 보드를 불러오는 중입니다.') : '일정을 불러오는 중입니다.'}
                                    </div>
                                ) : displaySchedules.length > 0 ? (
                                    <div
                                        className={showDisplayBoardCards ? 'flex flex-wrap items-start justify-center gap-x-8 gap-y-8 sm:justify-start' : 'grid gap-3'}
                                        style={
                                            showDisplayBoardCards
                                                ? undefined
                                                : {
                                                    gridTemplateColumns: isPersonnelInputMode
                                                        ? 'repeat(auto-fill, minmax(min(360px, 100%), 1fr))'
                                                        : 'repeat(auto-fill, minmax(min(280px, 100%), 1fr))',
                                                }
                                        }
                                    >
                                        {displaySchedules.map((schedule) => {
                                            const scheduleKey = makeSiteKey(schedule);
                                            return showDisplayBoardCards ? (
                                                <BoardViewScheduleCard
                                                    key={schedule.id}
                                                    schedule={schedule}
                                                    workersById={workersById}
                                                    workerTeamColorById={workerTeamColorById}
                                                    teams={teams}
                                                    teamsById={teamsById}
                                                    vehiclesById={vehiclesById}
                                                    vehicleAssignedTeamColorById={vehicleAssignedTeamColorById}
                                                    mode={mode}
                                                    selectedDestination={Boolean(selectedDestinationScheduleKey && scheduleKey === selectedDestinationScheduleKey)}
                                                    recentlyUpdated={Boolean(recentlyUpdatedSiteKey && scheduleKey === recentlyUpdatedSiteKey)}
                                                    onSelectDestination={() => {
                                                        if (schedule.siteId) {
                                                            setSelectedSiteId(schedule.siteId);
                                                            setMessage(isPersonnelInputMode ? `입력 현장: ${schedule.siteName}` : `이동 대상: ${schedule.siteName}`);
                                                        }
                                                    }}
                                                />
                                            ) : (
                                                <ScheduleCard
                                                    key={schedule.id}
                                                    schedule={schedule}
                                                    workersById={workersById}
                                                    workerTeamColorById={workerTeamColorById}
                                                    vehiclesById={vehiclesById}
                                                    vehicleAssignedTeamColorById={vehicleAssignedTeamColorById}
                                                    issues={getScheduleIssues(schedule)}
                                                    mode={mode}
                                                    selectedDestination={Boolean(selectedDestinationScheduleKey && scheduleKey === selectedDestinationScheduleKey)}
                                                    recentlyUpdated={Boolean(recentlyUpdatedSiteKey && scheduleKey === recentlyUpdatedSiteKey)}
                                                    onSelectDestination={() => {
                                                        if (schedule.siteId) {
                                                            setSelectedSiteId(schedule.siteId);
                                                            setMessage(isPersonnelInputMode ? `입력 현장: ${schedule.siteName}` : `이동 대상: ${schedule.siteName}`);
                                                        }
                                                    }}
                                                    onDelete={() => deleteSchedule(schedule.id)}
                                                    onMemoChange={(memo) => updateScheduleMemo(schedule.id, memo)}
                                                    onWorkerManDayChange={(workerId, manDay) => updateWorkerManDay(schedule.id, workerId, manDay)}
                                                    onWorkerUnitPriceChange={(workerId, unitPrice) => updateWorkerUnitPrice(schedule.id, workerId, unitPrice)}
                                                    onWorkerPayTypeChange={(workerId, payType) => updateWorkerPayType(schedule.id, workerId, payType)}
                                                    onSupportTeamChange={(teamId, patch) => updateSupportTeamInSchedule(schedule.id, teamId, patch)}
                                                    onRemoveWorker={(workerId) => removeWorkerFromSchedule(schedule.id, workerId)}
                                                    onRemoveSupportTeam={(teamId) => removeSupportTeamFromSchedule(schedule.id, teamId)}
                                                    onRemoveVehicle={(vehicleId) => removeVehicleFromSchedule(schedule.id, vehicleId)}
                                                />
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="flex min-h-[460px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white text-center">
                                        <UserPlus size={36} className="text-slate-400" />
                                        <p className="mt-3 text-base font-black text-slate-800">
                                            {shouldApplyScheduleConfirmationScope && schedules.length > 0
                                                ? '내 팀 담당현장 또는 지원팀 현장이 없습니다.'
                                                : isPersonnelInputMode ? (isScheduleConfirmationInput ? '아직 확정할 현장이 없습니다.' : '아직 작성할 일보 현장이 없습니다.') : '아직 만든 일정이 없습니다.'}
                                        </p>
                                        <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">
                                            {shouldApplyScheduleConfirmationScope && schedules.length > 0
                                                ? '전체보기를 켜면 다른 현장까지 확인할 수 있습니다.'
                                                : isPersonnelInputMode
                                                ? '좌측 현장에서 현장 카드를 만들고 팀/작업자 또는 지원팀 탭에서 입력줄을 추가하세요.'
                                                : '좌측 현장 탭에서 현장을 먼저 등록하거나, 현장 선택 후 작업자와 차량을 추가하세요.'}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </main>
                    </div>

                    {isPersonnelInputMode && isKakaoModalOpen ? (
                        <div
                            className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/45 p-4"
                            onMouseDown={(event) => {
                                if (event.target === event.currentTarget) closeKakaoModal();
                            }}
                        >
                            <div className="flex max-h-[calc(100vh-32px)] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
                                <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 text-sm font-black text-slate-950">
                                            <MessageCircle size={18} className="text-yellow-500" />
                                            카톡 분석
                                        </div>
                                        <p className="mt-1 text-xs font-bold text-slate-500">
                                            카톡 텍스트나 스크린샷에서 현장, 작업자, 공수, 작업내용을 읽어 보드 입력줄로 만듭니다.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={closeKakaoModal}
                                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                                        aria-label="카톡 분석 닫기"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>

                                <div className="grid min-h-0 gap-5 overflow-y-auto px-5 py-5 md:grid-cols-[1.08fr_0.92fr]">
                                    <div className="flex min-h-[320px] flex-col">
                                        <label className="mb-2 text-sm font-black text-slate-800" htmlFor="kakao-board-input-text">
                                            카톡 텍스트
                                        </label>
                                        <textarea
                                            id="kakao-board-input-text"
                                            value={kakaoText}
                                            onChange={(event) => setKakaoText(event.target.value)}
                                            className="min-h-[260px] flex-1 resize-none rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-800 outline-none transition focus:border-yellow-400 focus:bg-white focus:ring-2 focus:ring-yellow-100"
                                            placeholder="카톡 대화 내용을 붙여넣으세요."
                                        />
                                        <p className="mt-2 text-xs font-semibold text-slate-500">
                                            텍스트와 이미지가 모두 있으면 이미지 분석을 우선 실행합니다.
                                        </p>
                                    </div>

                                    <div className="flex min-h-[320px] flex-col">
                                        <div className="mb-2 flex items-center justify-between gap-3">
                                            <label className="text-sm font-black text-slate-800" htmlFor="kakao-board-input-file">
                                                스크린샷
                                            </label>
                                            {kakaoFile ? (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setKakaoFile(null);
                                                        if (kakaoFileInputRef.current) kakaoFileInputRef.current.value = '';
                                                    }}
                                                    className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-50"
                                                >
                                                    <Trash2 size={13} />
                                                    제거
                                                </button>
                                            ) : null}
                                        </div>
                                        <input
                                            ref={kakaoFileInputRef}
                                            id="kakao-board-input-file"
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={(event) => selectKakaoFile(event.target.files?.[0])}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => kakaoFileInputRef.current?.click()}
                                            onDragOver={(event) => {
                                                event.preventDefault();
                                                setIsKakaoFileDragging(true);
                                            }}
                                            onDragLeave={(event) => {
                                                if (event.currentTarget === event.target) setIsKakaoFileDragging(false);
                                            }}
                                            onDrop={(event) => {
                                                event.preventDefault();
                                                setIsKakaoFileDragging(false);
                                                selectKakaoFile(event.dataTransfer.files?.[0]);
                                            }}
                                            className={`flex min-h-[260px] flex-1 flex-col items-center justify-center rounded-lg border border-dashed px-4 text-center transition ${
                                                isKakaoFileDragging
                                                    ? 'border-yellow-400 bg-yellow-50 text-yellow-700'
                                                    : 'border-slate-300 bg-slate-50 text-slate-500 hover:border-yellow-300 hover:bg-yellow-50/60'
                                            }`}
                                        >
                                            <Upload size={28} />
                                            {kakaoFile ? (
                                                <span className="mt-3 max-w-full">
                                                    <span className="block truncate text-sm font-black text-slate-800">{kakaoFile.name}</span>
                                                    <span className="mt-1 block text-xs font-bold text-slate-500">{formatFileSize(kakaoFile.size)}</span>
                                                </span>
                                            ) : (
                                                <span className="mt-3 text-sm font-black">이미지를 선택하거나 끌어오세요.</span>
                                            )}
                                        </button>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-end">
                                    <button
                                        type="button"
                                        onClick={closeKakaoModal}
                                        className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50"
                                    >
                                        취소
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleKakaoModalAnalyze}
                                        disabled={isKakaoAnalyzing || (!kakaoText.trim() && !kakaoFile)}
                                        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-yellow-400 px-4 text-sm font-black text-slate-950 shadow-sm hover:bg-yellow-500 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
                                    >
                                        <MessageCircle size={16} />
                                        {isKakaoAnalyzing ? '분석 중' : '분석해서 보드 만들기'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : null}

                    {(message || deletedSchedule) && (
                        <div className="fixed bottom-5 right-5 z-50 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-xl">
                            {message ? <span>{message}</span> : null}
                            {deletedSchedule ? (
                                <button type="button" onClick={restoreDeletedSchedule} className="ml-3 text-blue-700 hover:text-blue-800">
                                    삭제 되돌리기
                                </button>
                            ) : null}
                        </div>
                    )}
                </div>

                <DragOverlay>
                    {activePayload ? (
                        <div className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-black text-slate-800 shadow-xl">
                            {activePayload.label}
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext>
        </div>
    );
}
