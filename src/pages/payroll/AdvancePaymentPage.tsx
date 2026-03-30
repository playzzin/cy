import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { teamService } from '../../services/teamService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { advancePaymentService, AdvancePayment } from '../../services/advancePaymentService';
import { dailyReportService } from '../../services/dailyReportService';
import { accommodationBillingService } from '../../services/accommodationBillingService';
import { accommodationService } from '../../services/accommodationService';
import { Accommodation } from '../../types/accommodation';
import { accommodationAssignmentService } from '../../services/accommodationAssignmentService';
import { companyService } from '../../services/companyService';
import {
    payrollConfigService,
    PayrollConfig,
    PayrollDeductionItem,
    AdvanceItemLabelKey,
    AdvanceItemLabelsConfig,
    DEFAULT_ADVANCE_ITEM_LABELS
} from '../../services/payrollConfigService';
import { siteService, Site } from '../../services/siteService';
import { useAuth } from '../../contexts/AuthContext';
import { userService } from '../../services/userService';
import { UserRole } from '../../types/roles';
import type { AccommodationAssignment } from '../../types/accommodationAssignment';
import type { UtilityRecord } from '../../types/accommodation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSave, faSearch, faSpinner, faCalculator, faFloppyDisk, faTrash, faRotateRight, faArrowUp, faArrowDown } from '@fortawesome/free-solid-svg-icons';
import Swal from 'sweetalert2';
import { useSearchParams } from 'react-router-dom';

// 임시저장 데이터 타입
type AdvanceTempData = {
    month: string;
    teamId: string;
    advances: { [workerId: string]: AdvancePayment };
    savedAt: number;
};

const LEGACY_DEDUCTION_FIELD_IDS = [
    'prevMonthCarryover',
    'accommodation',
    'privateRoom',
    'gloves',
    'deposit',
    'fines',
    'electricity',
    'gas',
    'internet',
    'water'
] as const;

type LegacyDeductionFieldId = (typeof LEGACY_DEDUCTION_FIELD_IDS)[number];

const isLegacyDeductionFieldId = (id: string): id is LegacyDeductionFieldId =>
    (LEGACY_DEDUCTION_FIELD_IDS as readonly string[]).includes(id);

const ALL_TEAMS_VALUE = '__ALL_TEAMS__';
type PersonalAccommodationField = 'accommodation' | 'electricity' | 'gas' | 'water' | 'internet' | 'maintenance' | 'other';
const PERSONAL_ACCOMMODATION_FIELDS: readonly PersonalAccommodationField[] = [
    'accommodation',
    'electricity',
    'gas',
    'water',
    'internet',
    'maintenance',
    'other'
];

const normalizeDeductionLabel = (label: string): string =>
    String(label ?? '').replace(/\s+/g, '').trim();

type PersonalAccommodationAggregate = Record<string, Record<PersonalAccommodationField, number>>;
type WorkerPaymentSummary = {
    laborManDay: number;
    laborAmount: number;
    invoiceManDay: number;
    invoiceAmount: number;
};

const createPersonalAccommodationFieldRecord = (): Record<PersonalAccommodationField, number> => ({
    accommodation: 0,
    electricity: 0,
    gas: 0,
    water: 0,
    internet: 0,
    maintenance: 0,
    other: 0
});

const createWorkerPaymentSummary = (): WorkerPaymentSummary => ({
    laborManDay: 0,
    laborAmount: 0,
    invoiceManDay: 0,
    invoiceAmount: 0
});

const EMPTY_WORKER_PAYMENT_SUMMARY: WorkerPaymentSummary = createWorkerPaymentSummary();

const CORPORATE_ADVANCE_ITEM_KEYS = [
    'corporateAdvance1',
    'corporateAdvance2',
    'corporateAdvance3',
    'corporateAdvance4'
] as const;

const LABOR_ADVANCE_ITEM_KEYS = [
    'laborAdvance1',
    'laborAdvance2',
    'laborAdvance3',
    'laborAdvance4'
] as const;

const toFiniteNumberOrZero = (value: unknown): number => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (typeof value === 'string') {
        const cleaned = value.replace(/,/g, '').trim();
        if (!cleaned) return 0;
        const parsed = Number(cleaned);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
};

const getAdvanceFieldValue = (advance: AdvancePayment, field: string): number => {
    if (isLegacyDeductionFieldId(field)) {
        return toFiniteNumberOrZero((advance as any)[field]);
    }
    return toFiniteNumberOrZero(advance.items?.[field]);
};

const setAdvanceFieldValue = (advance: AdvancePayment, field: string, amount: number): void => {
    const normalized = toFiniteNumberOrZero(amount);
    if (isLegacyDeductionFieldId(field)) {
        (advance as any)[field] = normalized;
        return;
    }
    advance.items = {
        ...(advance.items ?? {}),
        [field]: normalized
    };
};

const buildAutoImportedCellKey = (workerId: string, deductionId: string): string =>
    `${String(workerId ?? '').trim()}::${String(deductionId ?? '').trim()}`;

const normalizeDeductionItemOrders = (items: PayrollDeductionItem[]): PayrollDeductionItem[] =>
    items.map((item, index) => ({
        ...item,
        order: index + 1
    }));

const ensureAccommodationLinkedDeductionItems = (items: PayrollDeductionItem[]): PayrollDeductionItem[] => {
    const next = [...items];
    const idToIndex = new Map<string, number>();
    const normalizedEtcLabel = normalizeDeductionLabel('기타');

    next.forEach((item, index) => {
        const id = String(item.id ?? '').trim();
        if (!id) return;
        if (!idToIndex.has(id)) {
            idToIndex.set(id, index);
        }
    });

    let maxOrder = next.reduce((max, item) => Math.max(max, Number.isFinite(item.order) ? item.order : 0), 0);

    const required: Array<{ id: PersonalAccommodationField; label: string }> = [
        { id: 'accommodation', label: '숙소비' },
        { id: 'electricity', label: '전기료' },
        { id: 'gas', label: '도시가스' },
        { id: 'water', label: '수도세' },
        { id: 'internet', label: '인터넷' },
        { id: 'maintenance', label: '관리비' },
        { id: 'other', label: '기타' }
    ];

    required.forEach((item) => {
        let existingIndex = idToIndex.get(item.id);
        if (existingIndex === undefined && item.id === 'other') {
            const fallbackIndex = next.findIndex((candidate) =>
                normalizeDeductionLabel(candidate.label) === normalizedEtcLabel
            );
            if (fallbackIndex >= 0) {
                existingIndex = fallbackIndex;
            }
        }

        if (existingIndex !== undefined) {
            const existing = next[existingIndex];
            const normalizedLabel = String(existing.label ?? '').trim();
            next[existingIndex] = {
                ...existing,
                label: normalizedLabel || item.label,
                isActive: true
            };
            return;
        }

        maxOrder += 1;
        next.push({
            id: item.id,
            label: item.label,
            order: maxOrder,
            isActive: true
        });
        idToIndex.set(item.id, next.length - 1);
    });

    // '기타'는 하나만 유지: 기존 사용자 커스텀 ID를 우선 유지하고 중복 라벨 항목 제거
    const canonicalOtherIndex = (() => {
        const byId = next.findIndex((item) => String(item.id ?? '').trim() === 'other');
        if (byId >= 0) return byId;
        return next.findIndex((item) => normalizeDeductionLabel(item.label) === normalizedEtcLabel);
    })();

    if (canonicalOtherIndex < 0) return next;

    return next.filter((item, index) => {
        if (index === canonicalOtherIndex) return true;
        return normalizeDeductionLabel(item.label) !== normalizedEtcLabel;
    });
};

const parseYearMonthRange = (yearMonth: string): { monthStart: Date; monthEnd: Date } | null => {
    const matched = /^(\d{4})-(\d{2})$/.exec(String(yearMonth ?? '').trim());
    if (!matched) return null;

    const year = Number(matched[1]);
    const month = Number(matched[2]);
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null;

    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);
    return { monthStart, monthEnd };
};

const parseYmdDate = (ymd: string): Date | null => {
    const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd ?? '').trim());
    if (!matched) return null;

    const year = Number(matched[1]);
    const month = Number(matched[2]);
    const day = Number(matched[3]);
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;

    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
    return date;
};

const calculateOverlapDays = (params: {
    monthStart: Date;
    monthEnd: Date;
    startDate: Date;
    endDate?: Date | null;
}): number => {
    const actualStart = params.startDate.getTime() > params.monthStart.getTime() ? params.startDate : params.monthStart;
    const rawEnd = params.endDate && Number.isFinite(params.endDate.getTime()) ? params.endDate : params.monthEnd;
    const actualEnd = rawEnd.getTime() < params.monthEnd.getTime() ? rawEnd : params.monthEnd;
    if (actualEnd.getTime() < actualStart.getTime()) return 0;

    const oneDayMs = 24 * 60 * 60 * 1000;
    return Math.floor((actualEnd.getTime() - actualStart.getTime()) / oneDayMs) + 1;
};

const apportionByWeight = (
    totalAmount: number,
    weights: Array<{ workerId: string; weight: number }>
): Record<string, number> => {
    const roundedTotal = Math.round(toFiniteNumberOrZero(totalAmount));
    if (roundedTotal === 0) return {};

    const normalized = weights
        .map((item) => ({
            workerId: String(item.workerId ?? '').trim(),
            weight: toFiniteNumberOrZero(item.weight)
        }))
        .filter((item) => item.workerId.length > 0 && item.weight > 0);

    if (normalized.length === 0) return {};

    const sign = roundedTotal < 0 ? -1 : 1;
    const absTotal = Math.abs(roundedTotal);
    const weightSum = normalized.reduce((sum, item) => sum + item.weight, 0);
    if (weightSum <= 0) return {};

    const rows = normalized.map((item) => {
        const raw = (absTotal * item.weight) / weightSum;
        const base = Math.floor(raw);
        return {
            workerId: item.workerId,
            base,
            fraction: raw - base
        };
    });

    let remainder = absTotal - rows.reduce((sum, row) => sum + row.base, 0);
    rows.sort((a, b) => {
        if (b.fraction !== a.fraction) return b.fraction - a.fraction;
        return a.workerId.localeCompare(b.workerId, 'en');
    });

    for (let i = 0; i < remainder; i += 1) {
        rows[i % rows.length].base += 1;
    }

    const result: Record<string, number> = {};
    rows.forEach((row) => {
        result[row.workerId] = (result[row.workerId] ?? 0) + row.base * sign;
    });
    return result;
};

const buildPersonalAccommodationAggregate = (params: {
    yearMonth: string;
    assignments: AccommodationAssignment[];
    utilityRecords: UtilityRecord[];
    accommodations: Map<string, Accommodation>;
    resolveWorkerId: (rawWorkerId: string) => string | null;
    resolveWorkerName: (workerId: string) => string | null;
}): PersonalAccommodationAggregate => {
    const range = parseYearMonthRange(params.yearMonth);
    if (!range) return {};

    type WorkerBillingCandidate = {
        accommodationId: string;
        workerId: string;
        overlapDays: number;
        startMs: number;
        isActive: boolean;
    };

    const workerBillingCandidates: WorkerBillingCandidate[] = [];

    params.assignments.forEach((assignment) => {
        const source = assignment.source ? String(assignment.source).trim() : '';
        if (source !== 'worker') return;

        const accommodationId = String(assignment.accommodationId ?? '').trim();
        const rawWorkerId = String(assignment.workerId ?? '').trim();
        if (!accommodationId || !rawWorkerId) return;

        const resolvedWorkerId = params.resolveWorkerId(rawWorkerId);
        if (!resolvedWorkerId) return;

        const startDate = parseYmdDate(String(assignment.startDate ?? '').trim());
        if (!startDate) return;
        const endDate = assignment.endDate ? parseYmdDate(String(assignment.endDate).trim()) : null;

        const overlapDays = calculateOverlapDays({
            monthStart: range.monthStart,
            monthEnd: range.monthEnd,
            startDate,
            endDate
        });

        if (overlapDays <= 0) return;

        const isActive = (assignment.status ?? 'active') === 'active' && !assignment.endDate;
        workerBillingCandidates.push({
            accommodationId,
            workerId: resolvedWorkerId,
            overlapDays,
            startMs: startDate.getTime(),
            isActive
        });
    });

    // 숙소별 개인 청구 대상은 1명으로 정규화한다.
    // 데이터상 중복(worker source 다건)일 때는 활성 상태/최근 시작일을 우선한다.
    const primaryWorkerByAccommodation = new Map<string, string>();
    const primaryCandidateByAccommodation = new Map<string, WorkerBillingCandidate>();
    workerBillingCandidates.forEach((candidate) => {
        const current = primaryCandidateByAccommodation.get(candidate.accommodationId);
        if (!current) {
            primaryCandidateByAccommodation.set(candidate.accommodationId, candidate);
            primaryWorkerByAccommodation.set(candidate.accommodationId, candidate.workerId);
            return;
        }

        const shouldReplace =
            Number(candidate.isActive) > Number(current.isActive) ||
            (candidate.isActive === current.isActive && candidate.startMs > current.startMs) ||
            (candidate.isActive === current.isActive && candidate.startMs === current.startMs && candidate.overlapDays > current.overlapDays) ||
            (candidate.isActive === current.isActive &&
                candidate.startMs === current.startMs &&
                candidate.overlapDays === current.overlapDays &&
                candidate.workerId.localeCompare(current.workerId, 'en') < 0);

        if (!shouldReplace) return;
        primaryCandidateByAccommodation.set(candidate.accommodationId, candidate);
        primaryWorkerByAccommodation.set(candidate.accommodationId, candidate.workerId);
    });

    const occupantDaysByAccommodation = new Map<string, Map<string, number>>();
    workerBillingCandidates.forEach((candidate) => {
        const primaryWorkerId = primaryWorkerByAccommodation.get(candidate.accommodationId);
        if (!primaryWorkerId || primaryWorkerId !== candidate.workerId) return;

        const current = occupantDaysByAccommodation.get(candidate.accommodationId) ?? new Map<string, number>();
        current.set(candidate.workerId, (current.get(candidate.workerId) ?? 0) + candidate.overlapDays);
        occupantDaysByAccommodation.set(candidate.accommodationId, current);
    });

    const aggregate: PersonalAccommodationAggregate = {};

    params.utilityRecords.forEach((record) => {
        if (String(record.yearMonth ?? '') !== String(params.yearMonth)) return;

        const accommodationId = String(record.accommodationId ?? '').trim();
        if (!accommodationId) return;

        const occupantDays = occupantDaysByAccommodation.get(accommodationId);
        if (!occupantDays || occupantDays.size === 0) return;

        // --- Logic Update: Individual Ownership Handling ---
        const accommodation = params.accommodations.get(accommodationId);
        let weights: Array<{ workerId: string; weight: number }> = [];

        // Check if individual ownership & match owner
        let ownerFound = false;
        if (accommodation?.ownership === 'Individual') {
            const ownerName = (accommodation.currentOccupantName || accommodation.name || '').trim();
            if (ownerName) {
                // Find worker among occupants who matches the owner name
                for (const [workerId] of occupantDays) {
                    const wName = params.resolveWorkerName(workerId);
                    if (wName && wName.trim() === ownerName) {
                        weights = [{ workerId, weight: 1 }]; // Winner takes all
                        ownerFound = true;
                        break;
                    }
                }
            }
        }

        // Default N/1 (by days) if not individual or owner not found
        if (!ownerFound) {
            weights = Array.from(occupantDays.entries()).map(([workerId, days]) => ({
                workerId,
                weight: days
            }));
        }
        // ---------------------------------------------------

        const amountByField: Record<PersonalAccommodationField, number> = {
            accommodation: toFiniteNumberOrZero(record.costs?.rent),
            electricity: toFiniteNumberOrZero(record.costs?.electricity),
            gas: toFiniteNumberOrZero(record.costs?.gas),
            water: toFiniteNumberOrZero(record.costs?.water),
            internet: toFiniteNumberOrZero(record.costs?.internet),
            maintenance: toFiniteNumberOrZero(record.costs?.maintenance),
            other: toFiniteNumberOrZero(record.costs?.other)
        };

        PERSONAL_ACCOMMODATION_FIELDS.forEach((field) => {
            const apportioned = apportionByWeight(amountByField[field], weights);
            Object.entries(apportioned).forEach(([wId, amt]) => {
                if (amt === 0) return;
                if (!aggregate[wId]) aggregate[wId] = createPersonalAccommodationFieldRecord();
                aggregate[wId][field] = (aggregate[wId][field] || 0) + amt;
            });
        });
    });

    return aggregate;
};

const AdvancePaymentPage: React.FC = () => {
    const { currentUser } = useAuth();
    const [searchParams] = useSearchParams();
    const [canUseAdvanceManagement, setCanUseAdvanceManagement] = useState<boolean | null>(null);

    const parseNumberFromInput = useCallback((raw: string): number => {
        const cleaned = String(raw ?? '').replace(/[^0-9-]/g, '').trim();
        if (!cleaned) return 0;
        const parsed = Number(cleaned);
        return Number.isFinite(parsed) ? parsed : 0;
    }, []);

    const formatNumberForInput = useCallback((value: number): string => {
        const n = Number(value);
        if (!Number.isFinite(n)) return '0';
        return n.toLocaleString('ko-KR');
    }, []);

    const queryTeamId = searchParams.get('teamId') ?? '';
    const queryYearMonth = searchParams.get('yearMonth') ?? '';
    const queryHighlightWorkerId = searchParams.get('highlightWorkerId') ?? '';

    const didApplyQueryRef = useRef(false);
    const highlightedRowRef = useRef<HTMLTableRowElement | null>(null);

    useEffect(() => {
        let isCancelled = false;

        const resolveAccess = async () => {
            if (!currentUser) {
                if (!isCancelled) setCanUseAdvanceManagement(false);
                return;
            }

            try {
                const user = await userService.getUser(currentUser.uid);
                const role = user?.role;
                const isAdminRole = role === 'admin' || role === UserRole.ADMIN;
                if (isAdminRole) {
                    if (!isCancelled) setCanUseAdvanceManagement(true);
                    return;
                }

                const worker = await manpowerService.getWorkerByUid(currentUser.uid);
                const companyId = worker?.companyId;
                if (!companyId) {
                    if (!isCancelled) setCanUseAdvanceManagement(false);
                    return;
                }

                const company = await companyService.getCompanyById(companyId);
                if (!isCancelled) setCanUseAdvanceManagement(company?.type === '시공사');
            } catch {
                if (!isCancelled) setCanUseAdvanceManagement(false);
            }
        };

        resolveAccess();
        return () => {
            isCancelled = true;
        };
    }, [currentUser]);

    // Filters
    const [selectedCompany, setSelectedCompany] = useState('');
    const [selectedTeamId, setSelectedTeamId] = useState('');
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

    const [salaryModelFilter, setSalaryModelFilter] = useState<'all' | 'daily' | 'monthly'>('all');
    const [workerNameQuery, setWorkerNameQuery] = useState('');

    // Data State
    const [teams, setTeams] = useState<{ id: string; name: string; companyName?: string }[]>([]);
    const [companies, setCompanies] = useState<string[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [advances, setAdvances] = useState<{ [workerId: string]: AdvancePayment }>({});
    const [workerPaymentSummaryMap, setWorkerPaymentSummaryMap] = useState<Record<string, WorkerPaymentSummary>>({});

    const [, setPayrollConfig] = useState<PayrollConfig | null>(null);
    const [deductionItems, setDeductionItems] = useState<PayrollDeductionItem[]>([]);
    const [advanceItemLabels, setAdvanceItemLabels] = useState<AdvanceItemLabelsConfig>({ ...DEFAULT_ADVANCE_ITEM_LABELS });
    const [configSaving, setConfigSaving] = useState(false);
    const [advanceLabelSaving, setAdvanceLabelSaving] = useState(false);
    const [newDeductionLabel, setNewDeductionLabel] = useState('');

    // UI State
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [isDeductionSettingsOpen, setIsDeductionSettingsOpen] = useState(false);

    const [highlightWorkerId, setHighlightWorkerId] = useState<string>('');
    const [autoSearchRequested, setAutoSearchRequested] = useState<boolean>(false);
    const [hasTempData, setHasTempData] = useState(false);
    const [tempDataSavedAt, setTempDataSavedAt] = useState<number | null>(null);
    const [autoImportedCellMap, setAutoImportedCellMap] = useState<Record<string, true>>({});

    // 최신 상태 추적용 Ref
    const stateRef = useRef({
        advances,
        selectedMonth,
        selectedTeamId
    });

    useEffect(() => {
        stateRef.current = {
            advances,
            selectedMonth,
            selectedTeamId
        };
    }, [advances, selectedMonth, selectedTeamId]);

    const getTempKey = useCallback((teamId: string, month: string) => {
        return `advance_temp_${teamId}_${month}`;
    }, []);

    const clearTempData = useCallback((teamId?: string, month?: string) => {
        const tId = teamId || stateRef.current.selectedTeamId;
        const m = month || stateRef.current.selectedMonth;
        if (!tId || !m) return;

        localStorage.removeItem(getTempKey(tId, m));
        setHasTempData(false);
        setTempDataSavedAt(null);
    }, [getTempKey]);

    const saveTempData = useCallback(() => {
        const { advances: curAdvances, selectedMonth: curMonth, selectedTeamId: curTeamId } = stateRef.current;
        if (!curTeamId || !curMonth || Object.keys(curAdvances).length === 0) return;

        const tempData: AdvanceTempData = {
            month: curMonth,
            teamId: curTeamId,
            advances: curAdvances,
            savedAt: Date.now()
        };

        localStorage.setItem(getTempKey(curTeamId, curMonth), JSON.stringify(tempData));
        setHasTempData(true);
        setTempDataSavedAt(tempData.savedAt);
    }, [getTempKey]);

    const loadTempData = useCallback(() => {
        const { selectedMonth: curMonth, selectedTeamId: curTeamId } = stateRef.current;
        if (!curTeamId || !curMonth) return;

        try {
            const key = getTempKey(curTeamId, curMonth);
            const saved = localStorage.getItem(key);
            if (!saved) {
                setHasTempData(false);
                setTempDataSavedAt(null);
                return;
            }

            const parsed: AdvanceTempData = JSON.parse(saved);
            const now = Date.now();

            // 24시간 경과 시 삭제
            if (now - parsed.savedAt > 24 * 60 * 60 * 1000) {
                localStorage.removeItem(key);
                setHasTempData(false);
                setTempDataSavedAt(null);
                return;
            }

            setHasTempData(true);
            setTempDataSavedAt(parsed.savedAt);
        } catch (error) {
            console.error("Failed to load temp data:", error);
            setHasTempData(false);
        }
    }, [getTempKey]);

    const restoreTempData = useCallback(() => {
        const { selectedMonth: curMonth, selectedTeamId: curTeamId } = stateRef.current;
        if (!curTeamId || !curMonth) return;

        try {
            const key = getTempKey(curTeamId, curMonth);
            const saved = localStorage.getItem(key);
            if (!saved) return;

            const parsed: AdvanceTempData = JSON.parse(saved);
            setAdvances(parsed.advances);
            setHasChanges(true);

            Swal.fire({
                icon: 'success',
                title: '복구 완료',
                text: '임시저장된 데이터를 불러왔습니다.',
                timer: 1500,
                showConfirmButton: false
            });
        } catch (error) {
            console.error("Failed to restore temp data:", error);
            Swal.fire('오류', '임시저장 데이터 복구에 실패했습니다.', 'error');
        }
    }, [getTempKey]);

    // 필터 변경 시 임시저장 데이터 확인
    useEffect(() => {
        loadTempData();
    }, [selectedMonth, selectedTeamId, loadTempData]);

    // 자동 저장 (Debounce)
    useEffect(() => {
        if (!hasChanges) return;

        const timer = setTimeout(() => {
            saveTempData();
        }, 1500);

        return () => clearTimeout(timer);
    }, [advances, hasChanges, saveTempData]);

    // 브라우저 종료 및 페이지 이동 시 저장
    useEffect(() => {
        const handleBeforeUnload = () => {
            if (stateRef.current.selectedTeamId && stateRef.current.selectedMonth && Object.keys(stateRef.current.advances).length > 0) {
                saveTempData();
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            handleBeforeUnload();
        };
    }, [saveTempData]);

    const activeDeductionItems = useMemo(() => {
        return [...deductionItems]
            .filter((item) => item.isActive)
            .sort((a, b) => a.order - b.order);
    }, [deductionItems]);

    const splitColumnCount = useMemo(() => {
        if (activeDeductionItems.length <= 1) return activeDeductionItems.length;
        return Math.ceil(activeDeductionItems.length / 2);
    }, [activeDeductionItems.length]);

    const topDeductionItems = useMemo(() => {
        return activeDeductionItems.slice(0, splitColumnCount);
    }, [activeDeductionItems, splitColumnCount]);

    const bottomDeductionItems = useMemo(() => {
        return activeDeductionItems.slice(splitColumnCount);
    }, [activeDeductionItems, splitColumnCount]);

    const maxDeductionColumns = useMemo(() => {
        return Math.max(topDeductionItems.length, bottomDeductionItems.length);
    }, [topDeductionItems.length, bottomDeductionItems.length]);

    const tableColumnCount = useMemo(() => {
        return 3 + maxDeductionColumns + CORPORATE_ADVANCE_ITEM_KEYS.length + 2;
    }, [maxDeductionColumns]);

    const getAdvanceItemLabel = useCallback((key: AdvanceItemLabelKey): string => {
        const raw = advanceItemLabels[key];
        if (typeof raw === 'string' && raw.trim()) return raw.trim();
        return DEFAULT_ADVANCE_ITEM_LABELS[key];
    }, [advanceItemLabels]);

    const corporateAdvanceItems = useMemo(
        () => CORPORATE_ADVANCE_ITEM_KEYS.map((key) => ({ key, label: getAdvanceItemLabel(key) })),
        [getAdvanceItemLabel]
    );

    const laborAdvanceItems = useMemo(
        () => LABOR_ADVANCE_ITEM_KEYS.map((key) => ({ key, label: getAdvanceItemLabel(key) })),
        [getAdvanceItemLabel]
    );

    const resolvedOtherDeductionId = useMemo(() => {
        const byId = deductionItems.find((item) => String(item.id ?? '').trim() === 'other');
        if (byId) return byId.id;

        const byLabel = deductionItems.find(
            (item) => normalizeDeductionLabel(item.label) === normalizeDeductionLabel('기타')
        );
        return byLabel?.id ?? 'other';
    }, [deductionItems]);

    const isOtherDeductionId = useCallback((deductionId: string): boolean => {
        if (deductionId === 'other') return true;
        return deductionId === resolvedOtherDeductionId;
    }, [resolvedOtherDeductionId]);

    const getDeductionValue = useCallback((advance: AdvancePayment | undefined, deductionId: string): number => {
        if (!advance) return 0;
        if (isLegacyDeductionFieldId(deductionId)) {
            return (advance[deductionId] as number | undefined) ?? 0;
        }
        return advance.items?.[deductionId] ?? 0;
    }, []);

    const calculateTotalDeduction = useCallback((advance: AdvancePayment): number => {
        return activeDeductionItems.reduce((sum, item) => {
            return sum + getDeductionValue(advance, item.id);
        }, 0);
    }, [activeDeductionItems, getDeductionValue]);

    useEffect(() => {
        setAdvances((prev) => {
            const nextEntries = Object.entries(prev).map(([workerId, advance]) => {
                const nextTotal = calculateTotalDeduction(advance);
                if (advance.totalDeduction === nextTotal) return [workerId, advance] as const;
                return [workerId, { ...advance, totalDeduction: nextTotal }] as const;
            });
            return Object.fromEntries(nextEntries);
        });
    }, [calculateTotalDeduction]);

    const getDeductionCellClassName = useCallback((deductionId: string): string => {
        if (deductionId === 'prevMonthCarryover') return 'p-1 border-r border-slate-200 bg-amber-50/30';
        if (deductionId === 'accommodation') return 'p-1 border-r border-slate-200 bg-blue-50/30';
        if (deductionId === 'electricity') return 'p-1 border-r border-slate-200 bg-yellow-50/40';
        if (deductionId === 'gas') return 'p-1 border-r border-slate-200 bg-orange-50/40';
        if (deductionId === 'water') return 'p-1 border-r border-slate-200 bg-cyan-50/40';
        if (deductionId === 'internet') return 'p-1 border-r border-slate-200 bg-indigo-50/40';
        if (deductionId === 'maintenance') return 'p-1 border-r border-slate-200 bg-emerald-50/40';
        if (isOtherDeductionId(deductionId)) return 'p-1 border-r border-slate-200 bg-fuchsia-50/30';
        if (deductionId === 'privateRoom') return 'p-1 border-r border-slate-200 bg-violet-50/30';
        return 'p-1 border-r border-slate-200';
    }, [isOtherDeductionId]);

    const getDeductionHeaderClassName = useCallback((deductionId: string): string => {
        if (deductionId === 'prevMonthCarryover') return 'p-3 border-r border-slate-300 min-w-[100px] bg-amber-50';
        if (deductionId === 'accommodation') return 'p-3 border-r border-slate-300 min-w-[100px] bg-blue-50';
        if (deductionId === 'electricity') return 'p-3 border-r border-slate-300 min-w-[100px] bg-yellow-50';
        if (deductionId === 'gas') return 'p-3 border-r border-slate-300 min-w-[100px] bg-orange-50';
        if (deductionId === 'water') return 'p-3 border-r border-slate-300 min-w-[100px] bg-cyan-50';
        if (deductionId === 'internet') return 'p-3 border-r border-slate-300 min-w-[100px] bg-indigo-50';
        if (deductionId === 'maintenance') return 'p-3 border-r border-slate-300 min-w-[100px] bg-emerald-50';
        if (isOtherDeductionId(deductionId)) return 'p-3 border-r border-slate-300 min-w-[100px] bg-fuchsia-50';
        if (deductionId === 'privateRoom') return 'p-3 border-r border-slate-300 min-w-[100px] bg-violet-50';
        return 'p-3 border-r border-slate-300 min-w-[100px]';
    }, [isOtherDeductionId]);

    const createEmptyAdvance = useCallback((worker: Worker, teamId: string, month: string): AdvancePayment => {
        return {
            workerId: worker.id!,
            workerName: worker.name,
            teamId: teamId,
            teamName: worker.teamName || '',
            yearMonth: month,
            items: {},
            prevMonthCarryover: 0,
            accommodation: 0,
            privateRoom: 0,
            gloves: 0,
            deposit: 0,
            fines: 0,
            electricity: 0,
            gas: 0,
            internet: 0,
            water: 0,
            totalDeduction: 0
        };
    }, []);

    useEffect(() => {
        if (canUseAdvanceManagement !== true) return;

        let isCancelled = false;
        const loadPayrollConfig = async () => {
            try {
                const config = await payrollConfigService.getConfigFromServer();
                if (isCancelled) return;
                const normalizedDeductionItems = ensureAccommodationLinkedDeductionItems(
                    [...config.deductionItems].sort((a, b) => a.order - b.order)
                );
                setPayrollConfig({ ...config, deductionItems: normalizedDeductionItems });
                setDeductionItems(normalizedDeductionItems);
                setAdvanceItemLabels({
                    ...DEFAULT_ADVANCE_ITEM_LABELS,
                    ...(config.advanceItemLabels ?? {})
                });
            } catch {
                const config = await payrollConfigService.getConfig();
                if (isCancelled) return;
                const normalizedDeductionItems = ensureAccommodationLinkedDeductionItems(
                    [...config.deductionItems].sort((a, b) => a.order - b.order)
                );
                setPayrollConfig({ ...config, deductionItems: normalizedDeductionItems });
                setDeductionItems(normalizedDeductionItems);
                setAdvanceItemLabels({
                    ...DEFAULT_ADVANCE_ITEM_LABELS,
                    ...(config.advanceItemLabels ?? {})
                });
            }
        };

        void loadPayrollConfig();
        return () => {
            isCancelled = true;
        };
    }, [canUseAdvanceManagement]);

    // Lock main content scroll
    useEffect(() => {
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            const originalOverflow = mainContent.style.overflow;
            mainContent.style.overflow = 'hidden';
            return () => {
                mainContent.style.overflow = originalOverflow;
            };
        }
    }, []);

    // 1. Load Initial Teams/Companies
    useEffect(() => {
        if (canUseAdvanceManagement !== true) return;
        loadTeams();
    }, [canUseAdvanceManagement]);

    const loadTeams = async () => {
        try {
            const [teamList, constructionCompanies] = await Promise.all([
                teamService.getTeams(),
                companyService.getCompaniesByType('시공사')
            ]);

            const constructionCompanyIdSet = new Set(
                constructionCompanies
                    .map((c) => c.id)
                    .filter((id): id is string => Boolean(id))
            );
            const constructionCompanyNameSet = new Set(constructionCompanies.map((c) => c.name));
            const constructionCompanyNameById = new Map(
                constructionCompanies
                    .map((c) => (c.id ? ([c.id, c.name] as const) : null))
                    .filter((entry): entry is readonly [string, string] => entry !== null)
            );

            const allowedTeams = teamList.filter((team) => {
                if (team.companyId) return constructionCompanyIdSet.has(team.companyId);
                if (team.companyName) return constructionCompanyNameSet.has(team.companyName);
                return false;
            });

            const formattedTeams = allowedTeams.map((team) => ({
                id: team.id || '',
                name: team.name,
                companyName:
                    team.companyName ||
                    (team.companyId ? constructionCompanyNameById.get(team.companyId) : undefined) ||
                    '기타'
            }));
            setTeams(formattedTeams);

            const uniqueCompanies = Array.from(new Set(formattedTeams.map((t) => t.companyName))).sort((a, b) =>
                a.localeCompare(b, 'ko-KR')
            );
            setCompanies(uniqueCompanies);

            if (uniqueCompanies.length > 0) {
                setSelectedCompany((prev) => (uniqueCompanies.includes(prev) ? prev : uniqueCompanies[0]));
            } else {
                setSelectedCompany('');
            }
        } catch (error) {
            console.error("Failed to load teams:", error);
        }
    };

    // Filter Teams by Company and sort by name
    const filteredTeams = teams
        .filter(team => team.companyName === selectedCompany)
        .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));

    // Auto-select first team
    useEffect(() => {
        if (selectedTeamId === ALL_TEAMS_VALUE) return;
        if (filteredTeams.length > 0 && !filteredTeams.find(t => t.id === selectedTeamId)) {
            setSelectedTeamId(filteredTeams[0].id);
        } else if (filteredTeams.length === 0) {
            setSelectedTeamId('');
        }
    }, [filteredTeams, selectedTeamId]);

    // 2. Load Data (Workers + Existing Advances)
    const handleSearch = useCallback(async () => {
        if (canUseAdvanceManagement !== true) {
            Swal.fire('알림', '시공사 계정만 가불 및 공제 관리를 사용할 수 있습니다.', 'warning');
            return;
        }

        if (!selectedMonth) {
            Swal.fire('알림', '월을 선택해주세요.', 'warning');
            return;
        }

        if (!selectedTeamId) {
            Swal.fire('알림', '팀을 선택해주세요.', 'warning');
            return;
        }

        if (selectedTeamId === ALL_TEAMS_VALUE) {
            if (filteredTeams.length === 0) {
                Swal.fire('알림', '시공사 소속 팀만 조회할 수 있습니다.', 'warning');
                return;
            }
        } else {
            const isAllowedTeam = filteredTeams.some((team) => team.id === selectedTeamId);
            if (!isAllowedTeam) {
                Swal.fire('알림', '시공사 소속 팀만 조회할 수 있습니다.', 'warning');
                return;
            }
        }

        setLoading(true);
        setHasChanges(false);
        try {
            const allWorkers = await manpowerService.getWorkers();
            const allowedTeamIdSet = new Set(
                selectedTeamId === ALL_TEAMS_VALUE
                    ? filteredTeams.map((t) => t.id).filter(Boolean)
                    : [selectedTeamId]
            );

            const teamWorkers = allWorkers.filter((w) => {
                const teamId = String(w.teamId ?? '');
                return teamId && allowedTeamIdSet.has(teamId);
            });

            const [yearStr, monthStr] = selectedMonth.split('-');
            const parsedMonthRange = parseYearMonthRange(selectedMonth);
            const monthStartDate = `${selectedMonth}-01`;
            const monthEndDate = `${selectedMonth}-${String(parsedMonthRange?.monthEnd.getDate() ?? 31).padStart(2, '0')}`;

            // 데이터 병렬 로드: 가불 내역 + 숙소 청구 내역 + 숙소 개인배정/월별공과금대장
            const [existingAdvances, billingDocs, assignmentRows, utilityRecords, accommodations, monthlyReports, siteRows] = await Promise.all([
                selectedTeamId === ALL_TEAMS_VALUE
                    ? advancePaymentService.getAdvancePaymentsByYearMonth(
                        parseInt(yearStr),
                        parseInt(monthStr)
                    )
                    : advancePaymentService.getAdvancePayments(
                        parseInt(yearStr),
                        parseInt(monthStr),
                        selectedTeamId
                    ),
                accommodationBillingService.getBillingDocuments({
                    teamId: selectedTeamId === ALL_TEAMS_VALUE ? 'all' : selectedTeamId,
                    yearMonth: selectedMonth
                }),
                selectedTeamId === ALL_TEAMS_VALUE
                    ? accommodationAssignmentService.getAllAssignments()
                    : accommodationAssignmentService.getAssignmentsByTeam(selectedTeamId),
                accommodationService.getMonthlyLedger(selectedMonth),
                accommodationService.getAccommodations(),
                dailyReportService.getReportsByRange(monthStartDate, monthEndDate),
                siteService.getSites()
            ]);

            const accommodationsMap = new Map<string, Accommodation>();
            (accommodations as Accommodation[] ?? []).forEach((acc) => {
                if (acc && acc.id) accommodationsMap.set(String(acc.id), acc);
            });
            const siteMap = new Map<string, Site>();
            (siteRows as Site[] ?? []).forEach((site) => {
                const siteId = String(site.id ?? '').trim();
                const legacySiteId = String(site.legacyId ?? '').trim();
                if (siteId) siteMap.set(siteId, site);
                if (legacySiteId && !siteMap.has(legacySiteId)) siteMap.set(legacySiteId, site);
            });

            const advancesMap: { [key: string]: AdvancePayment } = {};
            const importedCellMap: Record<string, true> = {};
            let hasAutoImportUpdates = false;

            // worker.id/worker.legacyId 혼용으로 인한 재조회 누락을 막기 위해 canonical worker key를 먼저 만든다.
            const canonicalWorkerKeyByAnyId = new Map<string, string>();
            teamWorkers.forEach((worker) => {
                const workerId = String(worker.id ?? '').trim();
                const legacyId = String(worker.legacyId ?? '').trim();
                const canonicalKey = workerId || legacyId;
                if (!canonicalKey) return;
                if (workerId) canonicalWorkerKeyByAnyId.set(workerId, canonicalKey);
                if (legacyId) canonicalWorkerKeyByAnyId.set(legacyId, canonicalKey);
            });

            // 1. 기존 가불 내역 먼저 맵에 담기
            existingAdvances
                .filter((record) => {
                    if (selectedTeamId !== ALL_TEAMS_VALUE) return true;
                    return allowedTeamIdSet.has(String(record.teamId ?? ''));
                })
                .forEach(record => {
                    const rawWorkerId = String(record.workerId ?? '').trim();
                    const workerKey = canonicalWorkerKeyByAnyId.get(rawWorkerId) ?? rawWorkerId;
                    if (!workerKey) return;

                    const normalizedRecord: AdvancePayment = {
                        ...record,
                        workerId: workerKey,
                        privateRoom: record.privateRoom ?? 0,
                        items: record.items ?? {}
                    };

                    advancesMap[workerKey] = {
                        ...normalizedRecord,
                        totalDeduction: calculateTotalDeduction(normalizedRecord)
                    };
                });

            // 2. 누락된 근로자들에 대해 빈 레코드 생성
            teamWorkers.forEach(w => {
                const candidateWorkerIds = [String(w.id ?? ''), String(w.legacyId ?? '')]
                    .map((id) => id.trim())
                    .filter((id) => id.length > 0);
                const hasExisting = candidateWorkerIds.some((id) => Boolean(advancesMap[id]));
                if (hasExisting) return;

                const workerKey = candidateWorkerIds[0];
                if (!workerKey) return;

                const teamId = String(w.teamId ?? '');
                advancesMap[workerKey] = createEmptyAdvance({ ...w, id: workerKey }, teamId, selectedMonth);
            });

            const advanceWorkerKeyByAnyWorkerId = new Map<string, string>();
            const workerIdToNameMap = new Map<string, string>();
            Object.keys(advancesMap).forEach((key) => {
                const normalized = String(key ?? '').trim();
                if (!normalized) return;
                advanceWorkerKeyByAnyWorkerId.set(normalized, normalized);
                workerIdToNameMap.set(normalized, advancesMap[normalized].workerName);
            });

            teamWorkers.forEach((w) => {
                const candidateWorkerIds = [String(w.id ?? ''), String(w.legacyId ?? '')]
                    .map((id) => id.trim())
                    .filter((id) => id.length > 0);
                if (candidateWorkerIds.length === 0) return;

                const canonicalKey = candidateWorkerIds.find((id) => Boolean(advancesMap[id])) ?? candidateWorkerIds[0];
                if (!canonicalKey) return;

                candidateWorkerIds.forEach((id) => {
                    advanceWorkerKeyByAnyWorkerId.set(id, canonicalKey);
                });
                workerIdToNameMap.set(canonicalKey, w.name);
            });

            const workerUnitPriceByAnyWorkerId = new Map<string, number>();
            teamWorkers.forEach((worker) => {
                const unitPrice = toFiniteNumberOrZero(worker.unitPrice);
                const candidateWorkerIds = [String(worker.id ?? ''), String(worker.legacyId ?? '')]
                    .map((id) => id.trim())
                    .filter((id) => id.length > 0);
                candidateWorkerIds.forEach((id) => {
                    workerUnitPriceByAnyWorkerId.set(id, unitPrice);
                });
            });

            const aggregatedWorkerPaymentSummaryMap: Record<string, WorkerPaymentSummary> = {};
            const ensureWorkerPaymentSummary = (workerKey: string): WorkerPaymentSummary => {
                if (!aggregatedWorkerPaymentSummaryMap[workerKey]) {
                    aggregatedWorkerPaymentSummaryMap[workerKey] = createWorkerPaymentSummary();
                }
                return aggregatedWorkerPaymentSummaryMap[workerKey];
            };

            monthlyReports.forEach((report) => {
                if ((report.date ?? '').slice(0, 7) !== selectedMonth) return;

                const reportPaymentType = String((report as any).paymentType ?? '').trim();
                const sitePaymentType = String(siteMap.get(String(report.siteId ?? '').trim())?.paymentMethod ?? '').trim();
                const paymentType = reportPaymentType || sitePaymentType;
                const isLaborSite = paymentType === '노무';

                report.workers.forEach((reportWorker) => {
                    const reportWorkerId = String(reportWorker.workerId ?? '').trim();
                    if (!reportWorkerId) return;

                    const workerKey = advanceWorkerKeyByAnyWorkerId.get(reportWorkerId);
                    if (!workerKey) return;

                    const manDay = toFiniteNumberOrZero(reportWorker.manDay);
                    if (manDay <= 0) return;

                    const reportUnitPrice = toFiniteNumberOrZero(reportWorker.unitPrice);
                    const fallbackUnitPrice = workerUnitPriceByAnyWorkerId.get(reportWorkerId) ?? 0;
                    const unitPrice = reportUnitPrice > 0 ? reportUnitPrice : fallbackUnitPrice;
                    const amount = Math.round(manDay * unitPrice);

                    const summary = ensureWorkerPaymentSummary(workerKey);
                    if (isLaborSite) {
                        summary.laborManDay += manDay;
                        summary.laborAmount += amount;
                        return;
                    }
                    summary.invoiceManDay += manDay;
                    summary.invoiceAmount += amount;
                });
            });

            // 3. 숙소 청구 내역(Billing) 자동 연동
            // workerId -> { field: totalAmount }
            const billingAggregate: Record<string, Record<string, number>> = {};
            const billingProvidedFields: Record<string, Set<string>> = {};
            const fieldsToIntegrate = new Set(['accommodation', 'electricity', 'gas', 'water', 'privateRoom', 'internet']);

            billingDocs
                .filter(d => d.issuedToType === 'worker' && d.issuedToWorkerId)
                .forEach(doc => {
                    const resolvedWorkerKey = advanceWorkerKeyByAnyWorkerId.get(String(doc.issuedToWorkerId ?? '').trim());
                    if (!resolvedWorkerKey) return;

                    if (!billingAggregate[resolvedWorkerKey]) {
                        billingAggregate[resolvedWorkerKey] = {};
                    }
                    if (!billingProvidedFields[resolvedWorkerKey]) {
                        billingProvidedFields[resolvedWorkerKey] = new Set();
                    }

                    doc.lineItems.forEach(li => {
                        const amount = toFiniteNumberOrZero(li.amount);

                        const field = accommodationBillingService.getAdvanceFieldForTargetField(li.targetField);
                        if (!fieldsToIntegrate.has(field)) return;

                        billingProvidedFields[resolvedWorkerKey].add(field);
                        billingAggregate[resolvedWorkerKey][field] = (billingAggregate[resolvedWorkerKey][field] || 0) + amount;
                    });
                });

            // 4. 집계된 숙소 데이터를 가불 맵에 반영
            Object.entries(billingAggregate).forEach(([workerKey, amounts]) => {
                const target = advancesMap[workerKey];
                if (!target) return;

                let hasUpdate = false;
                Object.entries(amounts).forEach(([field, amount]) => {
                    // 기존 값이 청구값과 다른 경우에만 업데이트 (청구 데이터를 소스 트루스로 간주)
                    const normalizedAmount = toFiniteNumberOrZero(amount);
                    const currentAmount = getAdvanceFieldValue(target, field);

                    // 자동연동 0값으로 수동 입력 금액을 지우지 않도록 보호한다.
                    if (normalizedAmount <= 0 && currentAmount > 0) {
                        return;
                    }

                    if (currentAmount !== normalizedAmount) {
                        setAdvanceFieldValue(target, field, normalizedAmount);
                        hasUpdate = true;
                    }
                    if (normalizedAmount !== 0) {
                        importedCellMap[buildAutoImportedCellKey(workerKey, field)] = true;
                    }
                });

                if (hasUpdate) {
                    target.totalDeduction = calculateTotalDeduction(target);
                    hasAutoImportUpdates = true;
                }
            });

            // 5. 숙소관리 개인배정(개인 배정 source) 기반 자동 연동
            const personalAccommodationAggregate = buildPersonalAccommodationAggregate({
                yearMonth: selectedMonth,
                assignments: assignmentRows,
                utilityRecords,
                accommodations: accommodationsMap,
                resolveWorkerId: (rawWorkerId) => {
                    const normalized = String(rawWorkerId ?? '').trim();
                    if (!normalized) return null;
                    return advanceWorkerKeyByAnyWorkerId.get(normalized) ?? null;
                },
                resolveWorkerName: (workerId) => workerIdToNameMap.get(workerId) ?? null
            });

            Object.entries(personalAccommodationAggregate).forEach(([workerKey, amounts]) => {
                const target = advancesMap[workerKey];
                if (!target) return;

                let hasUpdate = false;
                PERSONAL_ACCOMMODATION_FIELDS.forEach((field) => {
                    const deductionFieldId = field === 'other' ? resolvedOtherDeductionId : field;
                    const isFieldProvidedByBilling = billingProvidedFields[workerKey]?.has(deductionFieldId)
                        || billingProvidedFields[workerKey]?.has(field)
                        || false;
                    if (isFieldProvidedByBilling) return;

                    const nextAmount = toFiniteNumberOrZero(amounts[field]);
                    const currentAmount = getAdvanceFieldValue(target, deductionFieldId);

                    // 개인배정 자동연동 0값이 수동 공과금을 덮어쓰지 않도록 보호한다.
                    if (nextAmount <= 0 && currentAmount > 0) {
                        return;
                    }

                    if (currentAmount !== nextAmount) {
                        setAdvanceFieldValue(target, deductionFieldId, nextAmount);
                        hasUpdate = true;
                    }
                    if (nextAmount !== 0) {
                        importedCellMap[buildAutoImportedCellKey(workerKey, deductionFieldId)] = true;
                    }
                });

                if (hasUpdate) {
                    target.totalDeduction = calculateTotalDeduction(target);
                    hasAutoImportUpdates = true;
                }
            });

            setWorkers(teamWorkers);
            setAdvances(advancesMap);
            setWorkerPaymentSummaryMap(aggregatedWorkerPaymentSummaryMap);
            setAutoImportedCellMap(importedCellMap);
            setHasChanges(hasAutoImportUpdates);

        } catch (error) {
            console.error("Error loading data:", error);
            setWorkerPaymentSummaryMap({});
            setAutoImportedCellMap({});
            Swal.fire('오류', '데이터를 불러오는 중 오류가 발생했습니다.', 'error');
        } finally {
            setLoading(false);
        }
    }, [calculateTotalDeduction, canUseAdvanceManagement, createEmptyAdvance, filteredTeams, resolvedOtherDeductionId, selectedMonth, selectedTeamId]);

    useEffect(() => {
        if (didApplyQueryRef.current) return;
        if (canUseAdvanceManagement !== true) return;
        if (teams.length === 0) return;

        if (!queryTeamId && !queryYearMonth && !queryHighlightWorkerId) {
            didApplyQueryRef.current = true;
            return;
        }

        if (queryTeamId) {
            const matchedTeam = teams.find((t) => t.id === queryTeamId);
            if (matchedTeam?.companyName) {
                setSelectedCompany(matchedTeam.companyName);
            }
            setSelectedTeamId(queryTeamId);
        }

        if (queryYearMonth) {
            setSelectedMonth(queryYearMonth);
        }

        if (queryHighlightWorkerId) {
            setHighlightWorkerId(queryHighlightWorkerId);
        }

        setAutoSearchRequested(true);
        didApplyQueryRef.current = true;
    }, [canUseAdvanceManagement, queryHighlightWorkerId, queryTeamId, queryYearMonth, teams]);

    useEffect(() => {
        if (!autoSearchRequested) return;
        if (!selectedTeamId || !selectedMonth) return;
        if (selectedTeamId !== ALL_TEAMS_VALUE && !filteredTeams.some((t) => t.id === selectedTeamId)) return;

        void handleSearch();
        setAutoSearchRequested(false);
    }, [autoSearchRequested, filteredTeams, handleSearch, selectedMonth, selectedTeamId]);

    useEffect(() => {
        if (!highlightWorkerId) return;
        if (workers.length === 0) return;

        const target = highlightedRowRef.current;
        if (!target) return;

        requestAnimationFrame(() => {
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
    }, [highlightWorkerId, workers.length]);

    const visibleWorkers = useMemo(() => {
        const normalizedQuery = workerNameQuery.trim();

        const matchesSalaryModel = (worker: Worker): boolean => {
            if (salaryModelFilter === 'all') return true;

            const model = String(worker.salaryModel ?? worker.payType ?? '').trim();
            if (!model) return salaryModelFilter === 'daily';
            if (salaryModelFilter === 'monthly') return model.includes('월급');
            return model.includes('일급');
        };

        const matchesName = (worker: Worker): boolean => {
            if (!normalizedQuery) return true;
            return String(worker.name ?? '').includes(normalizedQuery);
        };

        return [...workers]
            .filter((worker) => matchesSalaryModel(worker) && matchesName(worker))
            .sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? ''), 'ko-KR'));
    }, [salaryModelFilter, workerNameQuery, workers]);

    const inputRefMap = useRef(new Map<string, HTMLInputElement>());

    const setInputRef = useCallback((workerId: string, deductionId: string, rowNum: 0 | 1) => {
        const key = `${workerId}::${deductionId}::${rowNum}`;
        return (el: HTMLInputElement | null) => {
            if (!el) {
                inputRefMap.current.delete(key);
                return;
            }
            inputRefMap.current.set(key, el);
        };
    }, []);

    const handleArrowNavigation = useCallback((event: React.KeyboardEvent<HTMLInputElement>, workerId: string, deductionId: string, rowNum: 0 | 1) => {
        const { key } = event;
        if (key !== 'ArrowLeft' && key !== 'ArrowRight' && key !== 'ArrowUp' && key !== 'ArrowDown') return;

        event.preventDefault();

        const workerIds = visibleWorkers.map(w => w.id!);
        const currentWorkerIndex = workerIds.indexOf(workerId);

        // Calculate current column index based on the row arrays
        const currentList = rowNum === 0 ? topDeductionItems : bottomDeductionItems;
        const currentColIndex = currentList.findIndex(item => item.id === deductionId);

        if (currentWorkerIndex === -1 || currentColIndex === -1) return;

        let nextWorkerIndex = currentWorkerIndex;
        let nextRowIndex = rowNum;
        let nextColIndex = currentColIndex;

        if (key === 'ArrowLeft') {
            if (nextColIndex > 0) {
                nextColIndex--;
            } else {
                // Move to previous row/worker's end
                if (nextRowIndex === 1) {
                    nextRowIndex = 0;
                    nextColIndex = topDeductionItems.length - 1;
                } else if (nextWorkerIndex > 0) {
                    nextWorkerIndex--;
                    nextRowIndex = 1;
                    nextColIndex = bottomDeductionItems.length - 1;
                }
            }
        } else if (key === 'ArrowRight') {
            const currentMaxCols = nextRowIndex === 0 ? topDeductionItems.length : bottomDeductionItems.length;
            if (nextColIndex < currentMaxCols - 1) {
                nextColIndex++;
            } else {
                // Move to next row/worker's start
                if (nextRowIndex === 0) {
                    if (bottomDeductionItems.length > 0) {
                        nextRowIndex = 1;
                        nextColIndex = 0;
                    } else if (nextWorkerIndex < workerIds.length - 1) {
                        // Skip empty bottom row and go to next worker top
                        nextWorkerIndex++;
                        nextColIndex = 0;
                    }
                } else if (nextWorkerIndex < workerIds.length - 1) {
                    nextWorkerIndex++;
                    nextRowIndex = 0;
                    nextColIndex = 0;
                }
            }
        } else if (key === 'ArrowUp') {
            if (nextRowIndex === 1) {
                // Try to move to same column in top row
                nextRowIndex = 0;
                if (nextColIndex >= topDeductionItems.length) nextColIndex = topDeductionItems.length - 1;
            } else if (nextWorkerIndex > 0) {
                nextWorkerIndex--;
                nextRowIndex = 1;
                if (nextColIndex >= bottomDeductionItems.length) nextColIndex = bottomDeductionItems.length - 1;
            }
        } else if (key === 'ArrowDown') {
            if (nextRowIndex === 0) {
                // Try to move to same column in bottom row
                if (bottomDeductionItems.length > 0) {
                    nextRowIndex = 1;
                    if (nextColIndex >= bottomDeductionItems.length) nextColIndex = bottomDeductionItems.length - 1;
                } else if (nextWorkerIndex < workerIds.length - 1) {
                    nextWorkerIndex++;
                    // Stay in top row but next worker
                    if (nextColIndex >= topDeductionItems.length) nextColIndex = topDeductionItems.length - 1; // Should allow staying in same col
                }
            } else if (nextWorkerIndex < workerIds.length - 1) {
                nextWorkerIndex++;
                nextRowIndex = 0;
                if (nextColIndex >= topDeductionItems.length) nextColIndex = topDeductionItems.length - 1;
            }
        }

        const nextWorkerId = workerIds[nextWorkerIndex];
        const nextList = nextRowIndex === 0 ? topDeductionItems : bottomDeductionItems;
        const nextDeductionItem = nextList[nextColIndex];

        if (!nextDeductionItem) return;

        const nextKey = `${nextWorkerId}::${nextDeductionItem.id}::${nextRowIndex}`;
        const target = inputRefMap.current.get(nextKey);
        if (!target) return;
        target.focus();
        target.select();
    }, [topDeductionItems, bottomDeductionItems, visibleWorkers]);

    // 3. Input Handling
    const handleDeductionChange = useCallback((workerId: string, deductionId: string, value: string) => {
        const numVal = parseNumberFromInput(value);

        setAdvances(prev => {
            const current = prev[workerId];
            if (!current) return prev;

            let updated: AdvancePayment;
            if (isLegacyDeductionFieldId(deductionId)) {
                updated = { ...current, [deductionId]: numVal };
            } else {
                const nextItems = { ...(current.items ?? {}), [deductionId]: numVal };
                updated = { ...current, items: nextItems };
            }

            updated.totalDeduction = calculateTotalDeduction(updated);
            return { ...prev, [workerId]: updated };
        });

        const importedKey = buildAutoImportedCellKey(workerId, deductionId);
        setAutoImportedCellMap((prev) => {
            if (!prev[importedKey]) return prev;
            const next = { ...prev };
            delete next[importedKey];
            return next;
        });

        setHasChanges(true);
    }, [calculateTotalDeduction, parseNumberFromInput]);

    const handleMemoChange = useCallback((workerId: string, value: string) => {
        setAdvances(prev => {
            const current = prev[workerId];
            if (!current) return prev;
            return { ...prev, [workerId]: { ...current, memo: value } };
        });
        setHasChanges(true);
    }, []);

    // 4. Save Logic
    const handleSave = async () => {
        setSaving(true);
        try {
            const normalizedRecords = Object.values(advances)
                .map((record) => {
                    const cleanedItems = record.items
                        ? Object.fromEntries(
                            Object.entries(record.items).filter(([key]) => !isLegacyDeductionFieldId(key))
                        )
                        : {};

                    const normalized: AdvancePayment = {
                        ...record,
                        workerId: String(record.workerId ?? '').trim(),
                        teamId: String(record.teamId ?? '').trim(),
                        yearMonth: String(record.yearMonth ?? '').trim(),
                        items: cleanedItems
                    };

                    normalized.totalDeduction = calculateTotalDeduction(normalized);
                    return normalized;
                })
                .filter((record) => record.workerId && record.teamId && record.yearMonth);

            if (normalizedRecords.length === 0) {
                Swal.fire('알림', '저장할 데이터가 없습니다.', 'info');
                return;
            }

            const results = await Promise.allSettled(
                normalizedRecords.map((record) => advancePaymentService.saveAdvancePayment(record))
            );

            const successCount = results.filter((result) => result.status === 'fulfilled').length;
            const failCount = results.length - successCount;

            if (failCount === 0) {
                Swal.fire({
                    icon: 'success',
                    title: '저장 완료',
                    text: `가불 내역 ${successCount}건이 저장되었습니다.`,
                    timer: 1500,
                    showConfirmButton: false
                });

                setHasChanges(false);
                // 저장 성공 시 임시저장 데이터 삭제
                clearTempData();
                return;
            }

            const firstError = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
            const firstMessage = firstError
                ? (firstError.reason instanceof Error
                    ? firstError.reason.message
                    : String(firstError.reason ?? '알 수 없는 오류'))
                : '알 수 없는 오류';

            if (successCount > 0) {
                Swal.fire('일부 저장됨', `${successCount}건 저장, ${failCount}건 실패\n${firstMessage}`, 'warning');
                return;
            }

            Swal.fire('오류', `저장 중 오류가 발생했습니다.\n${firstMessage}`, 'error');
        } catch (error) {
            console.error("Save failed:", error);
            const code = typeof (error as { code?: unknown })?.code === 'string' ? String((error as { code: string }).code) : '';
            const message = error instanceof Error
                ? error.message
                : (typeof (error as { message?: unknown })?.message === 'string' ? String((error as { message: string }).message) : '저장 중 오류가 발생했습니다.');
            const detail = code ? ` (${code})` : '';
            Swal.fire('오류', `저장 중 오류가 발생했습니다.${detail}\n${message}`, 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleAddDeductionItem = useCallback(() => {
        const label = newDeductionLabel.trim();
        if (!label) return;

        const id = `custom_${Date.now()}`;

        setDeductionItems(prev => normalizeDeductionItemOrders([...prev, { id, label, order: prev.length + 1, isActive: true }]));
        setNewDeductionLabel('');
    }, [newDeductionLabel]);

    const handleUpdateDeductionItem = useCallback((id: string, patch: Partial<Pick<PayrollDeductionItem, 'label' | 'isActive'>>) => {
        setDeductionItems(prev =>
            prev.map(item => {
                if (item.id !== id) return item;
                return {
                    ...item,
                    ...(patch.label !== undefined ? { label: patch.label } : {}),
                    ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {})
                };
            })
        );
    }, []);

    const handleDeleteDeductionItem = useCallback(async (id: string) => {
        const item = deductionItems.find((x) => x.id === id);
        const label = item?.label ?? '공제항목';
        const result = await Swal.fire({
            icon: 'warning',
            title: '삭제 확인',
            text: `${label} 항목을 삭제할까요?`,
            showCancelButton: true,
            confirmButtonText: '삭제',
            cancelButtonText: '취소'
        });

        if (!result.isConfirmed) return;
        setDeductionItems(prev => normalizeDeductionItemOrders(prev.filter(item => item.id !== id)));
    }, [deductionItems]);

    const handleMoveDeductionItem = useCallback((id: string, direction: -1 | 1) => {
        setDeductionItems((prev) => {
            const sorted = [...prev].sort((a, b) => a.order - b.order);
            const currentIndex = sorted.findIndex((item) => item.id === id);
            if (currentIndex < 0) return prev;

            const nextIndex = currentIndex + direction;
            if (nextIndex < 0 || nextIndex >= sorted.length) return prev;

            const [moved] = sorted.splice(currentIndex, 1);
            sorted.splice(nextIndex, 0, moved);
            return normalizeDeductionItemOrders(sorted);
        });
    }, []);

    const handleSaveDeductionConfig = useCallback(async () => {
        setConfigSaving(true);
        try {
            const hasInvalidLabel = deductionItems.some((item) => !item.label.trim());
            if (hasInvalidLabel) {
                await Swal.fire('알림', '공제항목 이름은 비어있을 수 없습니다.', 'warning');
                return;
            }

            const idCounts = new Map<string, number>();
            deductionItems.forEach((item) => {
                const id = item.id.trim();
                if (!id) return;
                idCounts.set(id, (idCounts.get(id) ?? 0) + 1);
            });
            const duplicatedIds = Array.from(idCounts.entries())
                .filter(([, count]) => count > 1)
                .map(([id]) => id);
            if (duplicatedIds.length > 0) {
                await Swal.fire('알림', `공제항목 ID가 중복되었습니다.\n${duplicatedIds.slice(0, 5).join(', ')}`, 'warning');
                return;
            }

            const normalizedItems = ensureAccommodationLinkedDeductionItems(
                [...deductionItems]
                    .map((item) => ({ ...item, label: item.label.trim(), id: item.id.trim() }))
                    .sort((a, b) => a.order - b.order)
            );

            await payrollConfigService.updateDeductionItems(normalizedItems);
            const latest = await payrollConfigService.getConfigFromServer();

            const requestedIds = new Set(normalizedItems.map((item) => item.id));
            const persistedIds = new Set(latest.deductionItems.map((item) => item.id));
            const missingIds = Array.from(requestedIds).filter((id) => !persistedIds.has(id));

            const latestDeductionItems = ensureAccommodationLinkedDeductionItems(
                [...latest.deductionItems].sort((a, b) => a.order - b.order)
            );

            setPayrollConfig({ ...latest, deductionItems: latestDeductionItems });
            setDeductionItems(latestDeductionItems);

            if (missingIds.length > 0) {
                await Swal.fire('경고', `일부 공제항목이 서버에 반영되지 않았습니다.\n${missingIds.slice(0, 5).join(', ')}`, 'warning');
                return;
            }

            Swal.fire({
                icon: 'success',
                title: '저장 완료',
                text: '공제항목 설정이 저장되었습니다.',
                timer: 1200,
                showConfirmButton: false
            });
        } catch (error) {
            console.error('Failed to save deduction config:', error);
            const code = typeof (error as { code?: unknown }).code === 'string' ? (error as { code: string }).code : '';
            const message = typeof (error as { message?: unknown }).message === 'string' ? (error as { message: string }).message : '';
            const detail = code ? ` (${code})` : '';
            const suffix = message ? `\n${message}` : '';
            Swal.fire('오류', `공제항목 설정 저장 중 오류가 발생했습니다.${detail}${suffix}`, 'error');
        } finally {
            setConfigSaving(false);
        }
    }, [deductionItems]);

    const handleAdvanceLabelChange = useCallback((key: AdvanceItemLabelKey, value: string) => {
        setAdvanceItemLabels((prev) => ({
            ...prev,
            [key]: value
        }));
    }, []);

    const handleSaveAdvanceLabelConfig = useCallback(async () => {
        setAdvanceLabelSaving(true);
        try {
            const trimmedLabels = Object.fromEntries(
                (Object.keys(DEFAULT_ADVANCE_ITEM_LABELS) as AdvanceItemLabelKey[]).map((key) => [
                    key,
                    String(advanceItemLabels[key] ?? '').trim()
                ])
            ) as AdvanceItemLabelsConfig;

            const hasEmpty = (Object.keys(trimmedLabels) as AdvanceItemLabelKey[])
                .some((key) => !trimmedLabels[key]);
            if (hasEmpty) {
                await Swal.fire('알림', '가불항목 이름은 비어있을 수 없습니다.', 'warning');
                return;
            }

            await payrollConfigService.updateAdvanceItemLabels(trimmedLabels);
            const latest = await payrollConfigService.getConfigFromServer();
            const latestDeductionItems = ensureAccommodationLinkedDeductionItems(
                [...latest.deductionItems].sort((a, b) => a.order - b.order)
            );

            setPayrollConfig({ ...latest, deductionItems: latestDeductionItems });
            setDeductionItems(latestDeductionItems);
            setAdvanceItemLabels({
                ...DEFAULT_ADVANCE_ITEM_LABELS,
                ...(latest.advanceItemLabels ?? {})
            });

            await Swal.fire({
                icon: 'success',
                title: '저장 완료',
                text: '가불항목 설정이 저장되었습니다.',
                timer: 1200,
                showConfirmButton: false
            });
        } catch (error) {
            console.error('Failed to save advance label config:', error);
            const code = typeof (error as { code?: unknown }).code === 'string' ? (error as { code: string }).code : '';
            const message = typeof (error as { message?: unknown }).message === 'string' ? (error as { message: string }).message : '';
            const detail = code ? ` (${code})` : '';
            const suffix = message ? `\n${message}` : '';
            await Swal.fire('오류', `가불항목 설정 저장 중 오류가 발생했습니다.${detail}${suffix}`, 'error');
        } finally {
            setAdvanceLabelSaving(false);
        }
    }, [advanceItemLabels]);

    const handleAdvanceItemChange = useCallback((workerId: string, itemKey: string, value: string) => {
        const numVal = parseNumberFromInput(value);

        setAdvances((prev) => {
            const current = prev[workerId];
            if (!current) return prev;

            const nextItems = { ...(current.items ?? {}), [itemKey]: numVal };
            const updated = { ...current, items: nextItems };
            updated.totalDeduction = calculateTotalDeduction(updated);
            return { ...prev, [workerId]: updated };
        });

        setHasChanges(true);
    }, [calculateTotalDeduction, parseNumberFromInput]);



    const renderDeductionInput = (workerId: string, deductionId: string, rowNum: 0 | 1) => {
        const isAutoImported = Boolean(autoImportedCellMap[buildAutoImportedCellKey(workerId, deductionId)]);
        // 윗칸/아랫칸 색상 구분
        let rowBg = '';
        if (!isAutoImported) {
            rowBg = rowNum === 0 ? 'bg-blue-100 focus:bg-blue-200' : 'bg-emerald-100 focus:bg-emerald-200';
        }
        return (
            <input
                type="text"
                inputMode="numeric"
                value={formatNumberForInput(getDeductionValue(advances[workerId], deductionId) || 0)}
                onChange={(e) => handleDeductionChange(workerId, deductionId, e.target.value)}
                onKeyDown={(e) => handleArrowNavigation(e, workerId, deductionId, rowNum)}
                ref={setInputRef(workerId, deductionId, rowNum)}
                className={`w-full text-right outline-none rounded px-1 transition-colors ${isAutoImported
                    ? 'bg-emerald-50 text-emerald-800 font-bold ring-1 ring-emerald-200 focus:bg-emerald-100 focus:ring-2 focus:ring-emerald-300'
                    : `${rowBg} focus:ring-2 focus:ring-blue-500` 
                    }`}
                onFocus={(e) => e.target.select()}
            />
        );
    };

    // rowNum: 0(윗칸), 1(아랫칸)
    const renderAdvanceItemInput = (workerId: string, itemKey: string, rowNum: 0 | 1) => {
        let rowBg = rowNum === 0 ? 'bg-blue-100 focus:bg-blue-200' : 'bg-emerald-100 focus:bg-emerald-200';
        return (
            <input
                type="text"
                inputMode="numeric"
                value={formatNumberForInput(getDeductionValue(advances[workerId], itemKey) || 0)}
                onChange={(e) => handleAdvanceItemChange(workerId, itemKey, e.target.value)}
                className={`w-full text-right outline-none rounded px-1 transition-colors ${rowBg} focus:ring-2 focus:ring-amber-400`}
                onFocus={(e) => e.target.select()}
            />
        );
    };

    // 5. Render
    return (
        <div className="flex flex-col h-full bg-slate-100 p-4">
            <div className="flex justify-between items-center mb-4 shrink-0">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <FontAwesomeIcon icon={faCalculator} className="text-blue-600" />
                    가불 및 공제 관리
                </h1>
                <div className="flex items-center gap-2">
                    {/* Settings Toggle */}
                    {canUseAdvanceManagement && (
                        <button
                            onClick={() => setIsDeductionSettingsOpen(!isDeductionSettingsOpen)}
                            className={`px-3 py-2 rounded font-bold transition-colors flex items-center gap-2 ${isDeductionSettingsOpen
                                ? 'bg-slate-700 text-white shadow-inner'
                                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                                }`}
                            title="가불항목 추가/설정"
                        >
                            <FontAwesomeIcon icon={faCalculator} />
                            <span>가불항목 추가/설정</span>
                        </button>
                    )}

                    {/* Temp Data Restoration */}
                    {hasTempData && (
                        <div className="flex items-center gap-2 mr-2 animate-pulse">
                            <span className="text-xs text-amber-600 font-bold">
                                {tempDataSavedAt ? new Date(tempDataSavedAt).toLocaleTimeString() : ''} 임시저장됨
                            </span>
                            <button
                                onClick={restoreTempData}
                                className="px-3 py-1.5 text-xs bg-amber-100 text-amber-700 rounded hover:bg-amber-200"
                            >
                                <FontAwesomeIcon icon={faRotateRight} className="mr-1" />
                                불러오기
                            </button>
                            <button
                                onClick={() => clearTempData()}
                                className="px-2 py-1.5 text-xs text-slate-400 hover:text-red-500"
                                title="임시저장 삭제"
                            >
                                <FontAwesomeIcon icon={faTrash} />
                            </button>
                        </div>
                    )}

                    {/* Save Button */}
                    {hasChanges && (
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow-lg flex items-center gap-2 animate-bounce-subtle"
                        >
                            <FontAwesomeIcon icon={saving ? faSpinner : faFloppyDisk} spin={saving} />
                            <span>{saving ? '저장 중...' : '변경사항 저장'}</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-lg shadow-sm mb-4 flex flex-wrap gap-4 items-end shrink-0">
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">업체 구분</label>
                    <select
                        value={selectedCompany}
                        onChange={(e) => {
                            setSelectedCompany(e.target.value);
                            setSelectedTeamId('');
                        }}
                        className="border border-slate-300 rounded px-2 py-1.5 text-sm min-w-[120px]"
                        disabled={loading && !autoSearchRequested}
                    >
                        <option value="">전체 업체</option>
                        {companies.map((c) => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">팀 선택</label>
                    <select
                        value={selectedTeamId}
                        onChange={(e) => setSelectedTeamId(e.target.value)}
                        className="border border-slate-300 rounded px-2 py-1.5 text-sm min-w-[150px]"
                        disabled={loading && !autoSearchRequested}
                    >
                        <option value="">팀 선택</option>
                        {filteredTeams.map((t) => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                        <option value={ALL_TEAMS_VALUE}>전체 보기 (조회 전용)</option>
                    </select>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">조회 월</label>
                    <input
                        type="month"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="border border-slate-300 rounded px-2 py-1.5 text-sm"
                        disabled={loading && !autoSearchRequested}
                    />
                </div>

                <div className="flex-1"></div>

                <div className="flex items-end gap-2">
                    <button
                        onClick={() => void handleSearch()}
                        disabled={loading}
                        className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-1.5 rounded flex items-center gap-2 text-sm"
                    >
                        <FontAwesomeIcon icon={loading ? faSpinner : faSearch} spin={loading} />
                        조회
                    </button>
                </div>
            </div>

            {/* Deduction Settings Panel */}
            {isDeductionSettingsOpen && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4 shrink-0 animate-fade-in-down">
                    <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                        <FontAwesomeIcon icon={faCalculator} />
                        공제항목 건별 설정
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                        {deductionItems
                            .slice()
                            .sort((a, b) => a.order - b.order)
                            .map((item, index, list) => (
                            <div key={item.id} className={`flex items-center gap-1 px-2 py-1 rounded border text-xs ${item.isActive ? 'bg-white border-slate-300' : 'bg-slate-100 border-slate-200 text-slate-400'}`}>
                                <div className="flex flex-col gap-0.5 mr-1">
                                    <button
                                        onClick={() => handleMoveDeductionItem(item.id, -1)}
                                        disabled={index === 0}
                                        className="w-5 h-4 rounded border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                                        title="위로 이동"
                                    >
                                        <FontAwesomeIcon icon={faArrowUp} />
                                    </button>
                                    <button
                                        onClick={() => handleMoveDeductionItem(item.id, 1)}
                                        disabled={index === list.length - 1}
                                        className="w-5 h-4 rounded border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                                        title="아래로 이동"
                                    >
                                        <FontAwesomeIcon icon={faArrowDown} />
                                    </button>
                                </div>
                                <input
                                    type="text"
                                    value={item.label}
                                    onChange={(e) => handleUpdateDeductionItem(item.id, { label: e.target.value })}
                                    className="border-none bg-transparent outline-none w-20"
                                    placeholder="항목명"
                                />
                                <button
                                    onClick={() => handleUpdateDeductionItem(item.id, { isActive: !item.isActive })}
                                    className={`px-1.5 py-0.5 rounded text-[10px] ${item.isActive ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-500'}`}
                                >
                                    {item.isActive ? '사용' : '미사용'}
                                </button>
                                {!LEGACY_DEDUCTION_FIELD_IDS.includes(item.id as any) && (
                                    <button
                                        onClick={() => handleDeleteDeductionItem(item.id)}
                                        className="text-red-400 hover:text-red-600 px-1"
                                    >
                                        &times;
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                    <div className="flex items-center gap-2 border-t border-slate-200 pt-3">
                        <input
                            type="text"
                            value={newDeductionLabel}
                            onChange={(e) => setNewDeductionLabel(e.target.value)}
                            placeholder="새 공제항목 이름"
                            className="border border-slate-300 rounded px-2 py-1 text-sm w-40"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleAddDeductionItem();
                            }}
                        />
                        <button
                            onClick={handleAddDeductionItem}
                            disabled={!newDeductionLabel.trim()}
                            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs disabled:opacity-50"
                        >
                            추가
                        </button>
                        <div className="flex-1"></div>
                        <button
                            onClick={handleSaveDeductionConfig}
                            disabled={configSaving}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded text-sm flex items-center gap-2"
                        >
                            {configSaving ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSave} />}
                            설정 저장
                        </button>
                    </div>

                    <div className="mt-4 border-t border-slate-200 pt-4">
                        <h4 className="text-sm font-bold text-slate-700 mb-2">가불항목 추가설정</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                            {([...corporateAdvanceItems, ...laborAdvanceItems]).map((item) => (
                                <label key={item.key} className="flex items-center justify-between gap-2 bg-white border border-slate-300 rounded px-2 py-1.5 text-xs">
                                    <span className="text-slate-600 min-w-[88px]">{DEFAULT_ADVANCE_ITEM_LABELS[item.key]}</span>
                                    <input
                                        type="text"
                                        value={advanceItemLabels[item.key] ?? ''}
                                        onChange={(e) => handleAdvanceLabelChange(item.key, e.target.value)}
                                        className="border border-slate-300 rounded px-2 py-1 text-xs w-full"
                                        placeholder={DEFAULT_ADVANCE_ITEM_LABELS[item.key]}
                                    />
                                </label>
                            ))}
                        </div>
                        <div className="flex justify-end">
                            <button
                                onClick={handleSaveAdvanceLabelConfig}
                                disabled={advanceLabelSaving}
                                className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-1.5 rounded text-sm flex items-center gap-2"
                            >
                                {advanceLabelSaving ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSave} />}
                                가불항목 설정 저장
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Keyword Filter & Salary Type Filter */}
            <div className="flex items-center gap-2 mb-2 shrink-0">
                <div className="flex items-center bg-white border border-slate-300 rounded px-2 py-1">
                    <FontAwesomeIcon icon={faSearch} className="text-slate-400 mr-2" />
                    <input
                        type="text"
                        value={workerNameQuery}
                        onChange={(e) => setWorkerNameQuery(e.target.value)}
                        placeholder="이름 검색..."
                        className="bg-transparent outline-none text-sm w-32"
                    />
                </div>
                <div className="flex bg-white rounded border border-slate-300 p-0.5">
                    <button
                        onClick={() => setSalaryModelFilter('all')}
                        className={`px-3 py-1 text-xs rounded ${salaryModelFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                    >
                        전체
                    </button>
                    <button
                        onClick={() => setSalaryModelFilter('daily')}
                        className={`px-3 py-1 text-xs rounded ${salaryModelFilter === 'daily' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                    >
                        일당직
                    </button>
                    <button
                        onClick={() => setSalaryModelFilter('monthly')}
                        className={`px-3 py-1 text-xs rounded ${salaryModelFilter === 'monthly' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                    >
                        월급직
                    </button>
                </div>
                <div className="text-xs text-slate-500 ml-auto flex items-center gap-4">
                    <span>총 인원: <b>{visibleWorkers.length}</b>명</span>
                    {hasChanges && <span className="text-red-500 font-bold animate-pulse">※ 변경된 내용이 있습니다. 저장해주세요.</span>}
                </div>
            </div>

            {/* Table Area */}
            <div className="flex-1 bg-white rounded-lg shadow border border-slate-200 overflow-hidden flex flex-col relative" id="table-container">
                <div className="overflow-auto flex-1 relative">
                    <table className="w-full text-xs border-collapse">
                        <thead className="bg-slate-100 sticky top-0 z-30 shadow-sm text-slate-700 font-bold border-b border-slate-300 h-10">
                            <tr>
                                <th rowSpan={2} className="p-2 border-r border-slate-300 w-12 text-center bg-slate-100 sticky left-0 z-40 shadow-[1px_0_2px_rgba(0,0,0,0.1)]">No</th>
                                <th rowSpan={2} className="p-2 border-r border-slate-300 w-24 text-center bg-slate-100 sticky left-12 z-40 shadow-[1px_0_2px_rgba(0,0,0,0.1)] min-w-[80px]">이름</th>
                                <th rowSpan={2} className="p-2 border-r border-slate-300 w-44 text-center min-w-[170px]">노무/계산서</th>

                                {/* Top Row Headers */}
                                {topDeductionItems.map((item) => (
                                    <th key={item.id} className={getDeductionHeaderClassName(item.id)}>
                                        {item.label}
                                    </th>
                                ))}

                                {corporateAdvanceItems.map((item) => (
                                    <th key={item.key} className="p-3 border-r border-slate-300 min-w-[112px] bg-yellow-100">
                                        {item.label}
                                    </th>
                                ))}

                                <th rowSpan={2} className="p-2 border-r border-slate-300 w-24 text-right bg-slate-100 text-slate-800">공제계</th>
                                <th rowSpan={2} className="p-2 border-r border-slate-300 min-w-[200px] text-center w-64">메모</th>
                            </tr>
                            <tr>
                                {/* Bottom Row Headers - ColSpan handled by rowSpan above for common cols */}
                                {bottomDeductionItems.map((item) => (
                                    <th key={item.id} className={getDeductionHeaderClassName(item.id)} style={{ backgroundColor: '#fdfdfd' }}>
                                        {item.label}
                                    </th>
                                ))}
                                {/* Fill empty cells if top row has more items than bottom row */}
                                {Array.from({ length: Math.max(0, topDeductionItems.length - bottomDeductionItems.length) }).map((_, i) => (
                                    <th key={`empty-${i}`} className="p-3 border-r border-slate-300 bg-slate-50"></th>
                                ))}

                                {laborAdvanceItems.map((item) => (
                                    <th key={item.key} className="p-3 border-r border-slate-300 min-w-[112px] bg-yellow-50">
                                        {item.label}
                                    </th>
                                ))}
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-200">
                            {loading ? (
                                <tr>
                                    <td colSpan={tableColumnCount} className="p-10 text-center text-slate-500">
                                        <FontAwesomeIcon icon={faSpinner} spin className="text-2xl mb-2" />
                                        <p>데이터를 불러오고 있습니다...</p>
                                    </td>
                                </tr>
                            ) : visibleWorkers.length === 0 ? (
                                <tr>
                                    <td colSpan={tableColumnCount} className="p-10 text-center text-slate-400">
                                        데이터가 없습니다.
                                    </td>
                                </tr>
                            ) : (
                                visibleWorkers.map((worker, index) => {
                                    const isHighlighted = worker.id === highlightWorkerId;
                                    const rowClass = isHighlighted ? 'bg-yellow-50 animate-pulse' : 'hover:bg-blue-50/30';
                                    const advance = advances[worker.id!] || createEmptyAdvance(worker, selectedTeamId, selectedMonth);
                                    const workerPaymentSummary =
                                        workerPaymentSummaryMap[worker.id!]
                                        || workerPaymentSummaryMap[String(worker.legacyId ?? '').trim()]
                                        || EMPTY_WORKER_PAYMENT_SUMMARY;

                                    return (
                                        <React.Fragment key={worker.id}>
                                            {/* Top Row */}
                                            <tr
                                                ref={isHighlighted ? highlightedRowRef : null}
                                                className={`transition-colors h-10 border-b-0 ${rowClass}`}
                                            >
                                                <td rowSpan={2} className="p-2 text-center border-r border-slate-200 sticky left-0 z-20 bg-white">{index + 1}</td>
                                                <td rowSpan={2} className="p-2 text-center border-r border-slate-200 font-medium sticky left-12 z-20 bg-white shadow-[1px_0_2px_rgba(0,0,0,0.05)]">
                                                    {worker.name}
                                                    <div className="text-[10px] text-slate-400 font-normal">{worker.rank || '-'}</div>
                                                </td>
                                                <td rowSpan={2} className="p-1.5 text-center border-r border-slate-200 text-[10px] leading-tight min-w-[170px]">
                                                    <div className="font-semibold text-indigo-700 whitespace-nowrap">
                                                        노무 {workerPaymentSummary.laborManDay.toFixed(1)}공수 / {workerPaymentSummary.laborAmount.toLocaleString()}원
                                                    </div>
                                                    <div className="font-semibold text-blue-700 whitespace-nowrap mt-0.5">
                                                        계산서 {workerPaymentSummary.invoiceManDay.toFixed(1)}공수 / {workerPaymentSummary.invoiceAmount.toLocaleString()}원
                                                    </div>
                                                </td>

                                                {/* Top Deduction Items */}
                                                {topDeductionItems.map((item) => (
                                                    <td key={item.id} className={getDeductionCellClassName(item.id)}>
                                                        {renderDeductionInput(worker.id!, item.id, 0)}
                                                    </td>
                                                ))}
                                                {Array.from({ length: Math.max(0, maxDeductionColumns - topDeductionItems.length) }).map((_, i) => (
                                                    <td key={`empty-top-${i}`} className="p-1 border-r border-slate-200 bg-slate-50/30"></td>
                                                ))}

                                                {corporateAdvanceItems.map((item) => (
                                                    <td key={item.key} className="p-1 border-r border-slate-200">
                                                        {renderAdvanceItemInput(worker.id!, item.key, 0)}
                                                    </td>
                                                ))}

                                                <td rowSpan={2} className="p-2 text-right font-bold text-slate-700 bg-white">
                                                    {advance.totalDeduction.toLocaleString()}
                                                </td>
                                                <td rowSpan={2} className="p-1 border-r border-slate-200">
                                                    <input
                                                        type="text"
                                                        value={advance.memo || ''}
                                                        onChange={(e) => handleMemoChange(worker.id!, e.target.value)}
                                                        className="w-full h-full min-h-[60px] bg-transparent outline-none px-2 text-xs text-slate-600 resize-none whitespace-pre-wrap text-center"
                                                        placeholder="메모..."
                                                    />
                                                </td>
                                            </tr>

                                            {/* Bottom Row */}
                                            <tr className={`transition-colors h-10 border-b border-slate-300 ${rowClass}`}>
                                                {bottomDeductionItems.map((item) => (
                                                    <td key={item.id} className={getDeductionCellClassName(item.id)}>
                                                        {renderDeductionInput(worker.id!, item.id, 1)}
                                                    </td>
                                                ))}
                                                {/* Fill empty cells if bottom row has fewer items than top row (or max cols) */}
                                                {Array.from({ length: Math.max(0, maxDeductionColumns - bottomDeductionItems.length) }).map((_, i) => (
                                                    <td key={`empty-bottom-${i}`} className="p-1 border-r border-slate-200 bg-slate-50/30"></td>
                                                ))}

                                                {laborAdvanceItems.map((item) => (
                                                    <td key={item.key} className="p-1 border-r border-slate-200">
                                                        {renderAdvanceItemInput(worker.id!, item.key, 1)}
                                                    </td>
                                                ))}
                                            </tr>
                                        </React.Fragment>
                                    );
                                })
                            )}
                        </tbody>

                        {visibleWorkers.length > 0 && (
                            <tfoot className="bg-slate-800 text-white font-bold sticky bottom-0 z-30 shadow-[0_-2px_4px_rgba(0,0,0,0.1)]">
                                <tr>
                                    <td colSpan={3} rowSpan={2} className="p-3 text-center sticky left-0 z-40 bg-slate-800 border-r border-slate-700">전체 합계</td>

                                    {/* Top Row Totals */}
                                    {topDeductionItems.map((item) => (
                                        <td key={item.id} className="p-3 text-right text-xs">
                                            {visibleWorkers
                                                .filter((w) => Boolean(w.id))
                                                .reduce((sum, w) => sum + getDeductionValue(advances[w.id!], item.id), 0)
                                                .toLocaleString()}
                                        </td>
                                    ))}
                                    {Array.from({ length: Math.max(0, maxDeductionColumns - topDeductionItems.length) }).map((_, i) => (
                                        <td key={`empty-total-top-${i}`} className="p-3 bg-slate-800"></td>
                                    ))}

                                    {corporateAdvanceItems.map((item) => (
                                        <td key={item.key} className="p-3 text-right text-xs bg-yellow-900/40">
                                            {visibleWorkers
                                                .filter((w) => Boolean(w.id))
                                                .reduce((sum, w) => sum + getDeductionValue(advances[w.id!], item.key), 0)
                                                .toLocaleString()}
                                        </td>
                                    ))}

                                    <td rowSpan={2} className="p-3 text-right text-amber-400 bg-slate-800 border-l border-slate-700 text-sm">
                                        {visibleWorkers.reduce((sum, w) => sum + (advances[w.id!]?.totalDeduction || 0), 0).toLocaleString()}
                                    </td>
                                    <td rowSpan={2} className="p-3 border-r border-slate-700"></td>
                                </tr>
                                <tr>
                                    {/* Bottom Row Totals */}
                                    {bottomDeductionItems.map((item) => (
                                        <td key={item.id} className="p-3 text-right text-xs bg-slate-700/50">
                                            {visibleWorkers
                                                .filter((w) => Boolean(w.id))
                                                .reduce((sum, w) => sum + getDeductionValue(advances[w.id!], item.id), 0)
                                                .toLocaleString()}
                                        </td>
                                    ))}
                                    {/* Fill empty cells if bottom row has fewer items than top row (or max cols) */}
                                    {Array.from({ length: Math.max(0, maxDeductionColumns - bottomDeductionItems.length) }).map((_, i) => (
                                        <td key={`empty-total-bottom-${i}`} className="p-3 bg-slate-700/50"></td>
                                    ))}

                                    {laborAdvanceItems.map((item) => (
                                        <td key={item.key} className="p-3 text-right text-xs bg-yellow-800/40">
                                            {visibleWorkers
                                                .filter((w) => Boolean(w.id))
                                                .reduce((sum, w) => sum + getDeductionValue(advances[w.id!], item.key), 0)
                                                .toLocaleString()}
                                        </td>
                                    ))}
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>

            <div className="mt-4 text-xs text-slate-500 shrink-0">
                <span>* 방향키로 셀을 이동할 수 있습니다. (상/하/좌/우)</span>
                <br />
                <span>* 숫자를 입력하면 자동으로 합계가 계산됩니다. 입력 후 반드시 [저장] 버튼을 눌러주세요.</span>
                <br />
                <span>* <span className="text-emerald-600 font-bold">연녹색 배경</span>: 자동 반영된 값 (숙소/공과금 등)</span>
            </div>
        </div>
    );

};

export default AdvancePaymentPage;
