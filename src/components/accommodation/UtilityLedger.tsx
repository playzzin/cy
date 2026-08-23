import React, { useState, useEffect, useCallback, useRef, memo, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBuilding, faSave, faChevronLeft, faChevronRight, faExclamationTriangle, faFileInvoiceDollar, faUsers, faUser } from '@fortawesome/free-solid-svg-icons';
import { accommodationService } from '../../services/accommodationService';
import { accommodationAssignmentService } from '../../services/accommodationAssignmentService';
import { accommodationBillingTargetService } from '../../services/accommodationBillingTargetService';
import { teamSettlementProtectionService } from '../../services/teamSettlementProtectionService';
import {
    isAccommodationAssignmentActiveInMonth,
    hasSameAccommodationUtilityBillingAmounts,
    matchesAccommodationUtilityBillingLineItem,
    resolveAccommodationAutoBillingCandidateKeys,
} from '../../services/accommodationUtilityBillingSyncService';
import {
    accommodationUtilityBillingAtomicService,
    isAccommodationUtilityBillingAtomicProtectionError,
} from '../../services/accommodationUtilityBillingAtomicService';
import {
    accommodationBillingService,
    isDraftAccommodationBillingStatus,
    isProtectedAccommodationBillingStatus,
} from '../../services/accommodationBillingService';
import { teamService, Team } from '../../services/teamService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { Accommodation, UtilityRecord } from '../../types/accommodation';
import { AccommodationAssignment } from '../../types/accommodationAssignment';
import { AccommodationBillingTarget } from '../../types/accommodationBillingTarget';
import { AccommodationBillingDocument, AccommodationBillingLineItem, AccommodationBillingTargetField } from '../../types/accommodationBilling';
import { iconMap } from '../../constants/iconMap';
import AccommodationQuickAssignmentModal from './QuickAssignmentModal';
import { DEFAULT_SUPPORT_BILLING_START_DATE } from '../../utils/supportBillingPeriod';
import { getContrastingTextColor } from '../../utils/color';
import {
    getSupportManagementMonthDate,
    rememberSupportManagementYearMonth,
    subscribeSupportManagementYearMonth,
} from '../../utils/supportManagementState';
import { Droplets, Flame, Sparkles, Zap } from 'lucide-react';
import AccommodationUtilityBillImportModal from './AccommodationElectricityBillImportModal';
import {
    AccommodationUtilityBillApplyItem,
    AccommodationUtilityBillType,
} from '../../types/accommodationElectricityBillImport';
import {
    getAccommodationOvercharge,
    stripAccommodationOverchargeMemo,
} from '../../utils/accommodationOvercharge';
import {
    filterNewAccommodationUtilityBillItems,
    hasSameAccommodationUtilityBillingSnapshot,
} from '../../utils/accommodationUtilityDeduplication';
import {
    isOfficeBillingTargetForSelectedTeam,
    officeAssignmentReferencesMatch
} from '../../utils/supportAssignmentTargets';

const UTILITY_IMPORT_OPTIONS = [
    {
        type: 'electricity' as const,
        label: '전기',
        fullLabel: '전기요금',
        Icon: Zap,
        className: 'border-indigo-200 text-indigo-700 hover:bg-indigo-50',
    },
    {
        type: 'gas' as const,
        label: '가스',
        fullLabel: '가스요금',
        Icon: Flame,
        className: 'border-amber-300 text-amber-800 hover:bg-amber-50',
    },
    {
        type: 'water' as const,
        label: '수도',
        fullLabel: '수도요금',
        Icon: Droplets,
        className: 'border-cyan-200 text-cyan-700 hover:bg-cyan-50',
    },
];

const getUtilityImportLabel = (utilityType: AccommodationUtilityBillType): string => (
    UTILITY_IMPORT_OPTIONS.find((option) => option.type === utilityType)?.fullLabel || '공과금'
);

// ── 독립 EditableCell 컴포넌트 (Ref 기반 비제어 방식) ──────────
// typing 중 React 리렌더 0회 → 커서 이탈 완전 방지
// DOM input.value를 직접 제어하여 포맷 ↔ RAW 전환 처리
interface EditableCellProps {
    value: number;
    onCommit: (numValue: number) => void;
    className?: string;
    placeholder?: string;
    isIncluded?: boolean;
    tdClassName?: string;
}

const EditableCell = memo<EditableCellProps>(({ value, onCommit, className, placeholder = '0', isIncluded, tdClassName }) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const isFocusedRef = useRef(false);

    // 부모 value prop이 바뀌면 비편집 중일 때만 display 갱신
    useEffect(() => {
        const el = inputRef.current;
        if (el && !isFocusedRef.current) {
            el.value = value === 0 ? '' : value.toLocaleString();
        }
    }, [value]);

    const handleFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
        isFocusedRef.current = true;
        // 포맷 → raw 숫자로 전환 (직접 DOM 조작, 리렌더 없음)
        e.target.value = value === 0 ? '' : String(value);
        // 전체 선택 → 쉽게 덮어쓸 수 있도록
        e.target.select();
    }, [value]);

    const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
        isFocusedRef.current = false;
        const cleaned = e.target.value.replace(/[^0-9]/g, '');
        const numValue = parseInt(cleaned, 10) || 0;
        // 포맷된 표시값으로 복원 (직접 DOM 조작)
        e.target.value = numValue === 0 ? '' : numValue.toLocaleString();
        onCommit(numValue);
    }, [onCommit]);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        // 숫자가 아닌 문자 제거 (직접 DOM 조작, 리렌더 없음)
        const raw = e.target.value;
        const cleaned = raw.replace(/[^0-9]/g, '');
        if (raw !== cleaned) {
            const cursorPos = e.target.selectionStart || 0;
            const diff = raw.length - cleaned.length;
            e.target.value = cleaned;
            // 커서 위치 보정
            const newPos = Math.max(0, cursorPos - diff);
            e.target.setSelectionRange(newPos, newPos);
        }
    }, []);

    if (isIncluded) {
        return (
            <td className={tdClassName}>
                <div className="text-center text-xs text-slate-300 select-none py-2">-</div>
            </td>
        );
    }

    return (
        <td className={tdClassName}>
            <input
                ref={inputRef}
                type="text"
                defaultValue={value === 0 ? '' : value.toLocaleString()}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onChange={handleChange}
                className={className}
                placeholder={placeholder}
            />
        </td>
    );
});

EditableCell.displayName = 'EditableCell';

const UTILITY_FIELD_LABELS: Record<Exclude<keyof UtilityRecord['costs'], 'total'>, string> = {
    rent: '월세',
    electricity: '전기세',
    gas: '가스비',
    water: '수도세',
    internet: '인터넷',
    maintenance: '관리비',
    other: '기타'
};

const UTILITY_FIELD_TO_TARGET: Record<Exclude<keyof UtilityRecord['costs'], 'total'>, AccommodationBillingTargetField> = {
    rent: 'accommodation',
    electricity: 'electricity',
    gas: 'gas',
    water: 'water',
    internet: 'internet',
    maintenance: 'accommodation',
    other: 'accommodation'
};

const FIXED_SPLIT_FIELDS = new Set<Exclude<keyof UtilityRecord['costs'], 'total'>>(['rent', 'internet', 'maintenance']);
const OFFICE_TARGET_ID = '__office__';
const OFFICE_TARGET_NAME = '사무실';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const addDays = (date: Date, days: number): Date => {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
};

const minDate = (...dates: Date[]): Date => dates.reduce((min, date) => date.getTime() < min.getTime() ? date : min);
const maxDate = (...dates: Date[]): Date => dates.reduce((max, date) => date.getTime() > max.getTime() ? date : max);

const formatYmdDate = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const inclusiveDays = (start: Date, end: Date): number => {
    if (end.getTime() < start.getTime()) return 0;
    return Math.floor((end.getTime() - start.getTime()) / ONE_DAY_MS) + 1;
};

const sanitizeBillingIdPart = (value: unknown): string => {
    const text = String(value ?? '').trim();
    return ['/', '#', '[', ']', '?'].reduce((safe, char) => safe.split(char).join('_'), text || 'row');
};

const allocateAmountByDays = (amount: number, dayCounts: number[]): number[] => {
    if (amount <= 0 || dayCounts.length === 0) return dayCounts.map(() => 0);
    const totalDays = dayCounts.reduce((sum, days) => sum + Math.max(0, days), 0);
    if (totalDays <= 0) return dayCounts.map(() => 0);

    let allocated = 0;
    return dayCounts.map((days, index) => {
        if (index === dayCounts.length - 1) return amount - allocated;
        const share = Math.round(amount * (Math.max(0, days) / totalDays));
        allocated += share;
        return share;
    });
};

const allocateAmountEvenly = (amount: number, count: number): number[] => {
    if (amount <= 0 || count <= 0) return Array.from({ length: Math.max(0, count) }, () => 0);
    const baseAmount = Math.floor(amount / count);
    const remainder = amount - (baseAmount * count);
    let allocated = 0;
    return Array.from({ length: count }, (_, index) => {
        if (index === count - 1) return amount - allocated;
        const share = baseAmount + (index < remainder ? 1 : 0);
        allocated += share;
        return share;
    });
};

interface AccommodationBillingIdentity {
    issuedToType: AccommodationBillingDocument['issuedToType'];
    teamId: string;
    teamName: string;
    workerId: string;
    workerName: string;
    teamIds: Set<string>;
    teamNames: Set<string>;
    workerIds: Set<string>;
    workerNames: Set<string>;
}

interface AccommodationSplitBillingRange {
    target?: AccommodationBillingTarget;
    startDate: Date;
    endDate: Date;
    startLabel: string;
    endLabel: string;
    overlapDays: number;
    identityKey: string;
}

interface UtilityLedgerProps {
    selectedTeamId?: string;
    searchText?: string;
}

const UtilityLedger: React.FC<UtilityLedgerProps> = ({ selectedTeamId = '', searchText = '' }) => {
    // State for Year-Month
    const [currentDate, setCurrentDate] = useState(getSupportManagementMonthDate);
    const [yearMonth, setYearMonth] = useState('');

    // Data State
    const [records, setRecords] = useState<UtilityRecord[]>([]);
    const [accommodations, setAccommodations] = useState<Accommodation[]>([]); // needed for profile checks
    const [teams, setTeams] = useState<Team[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [assignments, setAssignments] = useState<AccommodationAssignment[]>([]);
    const [billingTargets, setBillingTargets] = useState<AccommodationBillingTarget[]>([]);
    const [billingDocuments, setBillingDocuments] = useState<AccommodationBillingDocument[]>([]);
    const [billingProcessingId, setBillingProcessingId] = useState('');
    const [bulkBillingAction, setBulkBillingAction] = useState<'bill' | 'unbill' | ''>('');
    const [billingEditor, setBillingEditor] = useState<{
        record: UtilityRecord;
        document: AccommodationBillingDocument;
        lineItems: AccommodationBillingLineItem[];
    } | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [billingSyncRetryCount, setBillingSyncRetryCount] = useState(0);
    const dirtyLedgerRecordKeysRef = useRef<Set<string>>(new Set());
    const forcedBillingRecordKeysRef = useRef<Set<string>>(new Set());
    const pendingBillingRecordKeysRef = useRef<Set<string>>(new Set());
    const [isStickyHeader, setIsStickyHeader] = useState(false); // Sticky header toggle
    const [quickAssignAccommodation, setQuickAssignAccommodation] = useState<Accommodation | null>(null);
    const [quickAssignSplitMode, setQuickAssignSplitMode] = useState(false);
    const [utilityBillImport, setUtilityBillImport] = useState<{
        utilityType: AccommodationUtilityBillType;
        files: File[];
    } | null>(null);

    const normalizeKey = (value: unknown): string => String(value ?? '').trim();
    const getUtilityRecordKey = (record: Pick<UtilityRecord, 'accommodationId' | 'yearMonth'>): string => (
        `${normalizeKey(record.accommodationId)}|${normalizeKey(record.yearMonth)}`
    );

    const teamByAnyId = useMemo(() => {
        const map = new Map<string, Team>();
        teams.forEach((team) => {
            if (team.id) map.set(String(team.id), team);
            if (team.legacyId) map.set(String(team.legacyId), team);
        });
        return map;
    }, [teams]);

    const teamByName = useMemo(() => {
        const map = new Map<string, Team>();
        teams.forEach((team) => {
            const name = String(team.name ?? '').trim();
            if (!name) return;
            if (!map.has(name)) map.set(name, team);
        });
        return map;
    }, [teams]);

    const workerByAnyId = useMemo(() => {
        const map = new Map<string, Worker>();
        workers.forEach((worker) => {
            if (worker.id) map.set(String(worker.id), worker);
            if (worker.legacyId) map.set(String(worker.legacyId), worker);
        });
        return map;
    }, [workers]);

    const workerByName = useMemo(() => {
        const map = new Map<string, Worker>();
        workers.forEach((worker) => {
            const name = normalizeKey(worker.name);
            if (name && !map.has(name)) map.set(name, worker);
        });
        return map;
    }, [workers]);

    const accommodationByAnyId = useMemo(() => {
        const map = new Map<string, Accommodation>();
        accommodations.forEach((accommodation) => {
            const id = normalizeKey(accommodation.id);
            const legacyId = normalizeKey((accommodation as any).legacyId);
            if (id) map.set(id, accommodation);
            if (legacyId) map.set(legacyId, accommodation);
        });
        return map;
    }, [accommodations]);

    const accommodationByName = useMemo(() => {
        const map = new Map<string, Accommodation>();
        accommodations.forEach((accommodation) => {
            const name = normalizeKey(accommodation.name);
            if (!name || map.has(name)) return;
            map.set(name, accommodation);
        });
        return map;
    }, [accommodations]);

    const resolveAccommodation = useCallback((params: { id?: string; name?: string }): Accommodation | undefined => {
        const id = normalizeKey(params.id);
        if (id) {
            const byId = accommodationByAnyId.get(id);
            if (byId) return byId;
        }

        const name = normalizeKey(params.name);
        if (!name) return undefined;
        return accommodationByName.get(name);
    }, [accommodationByAnyId, accommodationByName]);

    const removeAutomaticOverchargeMemoFromRecord = useCallback((record: UtilityRecord): UtilityRecord => {
        const memo = stripAccommodationOverchargeMemo(record.memo);
        return memo === (record.memo ?? '') ? record : { ...record, memo };
    }, []);

    const isMatchingAccommodationAssignment = useCallback(
        (assignment: AccommodationAssignment, canonicalAccommodationId: string, canonicalAccommodationName: string): boolean => {
            const assignmentAccommodationId = normalizeKey(assignment.accommodationId);
            const assignmentAccommodationName = normalizeKey(assignment.accommodationName);
            const assignmentMatchedAccommodation = assignmentAccommodationId
                ? accommodationByAnyId.get(assignmentAccommodationId)
                : undefined;
            const assignmentCanonicalId = normalizeKey(assignmentMatchedAccommodation?.id ?? assignmentAccommodationId);
            const assignmentCanonicalName = normalizeKey(assignmentMatchedAccommodation?.name ?? assignmentAccommodationName);

            const matchesById = Boolean(
                canonicalAccommodationId &&
                assignmentCanonicalId &&
                canonicalAccommodationId === assignmentCanonicalId
            );
            const matchesByName = Boolean(
                canonicalAccommodationName &&
                assignmentCanonicalName &&
                canonicalAccommodationName === assignmentCanonicalName
            );
            return matchesById || matchesByName;
        },
        [accommodationByAnyId]
    );

    const getActiveAssignmentsForAccommodation = useCallback((accommodation: Accommodation): AccommodationAssignment[] => {
        const canonicalAccommodationId = normalizeKey(accommodation.id);
        const canonicalAccommodationName = normalizeKey(accommodation.name);
        return assignments.filter(
            (assignment) =>
                isMatchingAccommodationAssignment(assignment, canonicalAccommodationId, canonicalAccommodationName) &&
                isAccommodationAssignmentActiveInMonth(assignment, yearMonth)
        ).sort((a, b) => {
            const left = a.startDate ? new Date(a.startDate).getTime() : 0;
            const right = b.startDate ? new Date(b.startDate).getTime() : 0;
            return (Number.isFinite(right) ? right : 0) - (Number.isFinite(left) ? left : 0);
        });
    }, [assignments, isMatchingAccommodationAssignment, yearMonth]);

    const getAssignmentsForAccommodation = useCallback((accommodation: Accommodation): AccommodationAssignment[] => {
        const canonicalAccommodationId = normalizeKey(accommodation.id);
        const canonicalAccommodationName = normalizeKey(accommodation.name);

        return assignments.filter((assignment) =>
            isMatchingAccommodationAssignment(assignment, canonicalAccommodationId, canonicalAccommodationName)
        );
    }, [assignments, isMatchingAccommodationAssignment]);

    const handleOpenQuickAssignFromRecord = useCallback((record: UtilityRecord, splitMode = false) => {
        const accommodation = resolveAccommodation({ id: record.accommodationId, name: record.accommodationName });
        if (!accommodation) return;
        setQuickAssignSplitMode(splitMode);
        setQuickAssignAccommodation(accommodation);
    }, [resolveAccommodation]);

    useEffect(() => {
        // Format YYYY-MM
        const y = currentDate.getFullYear();
        const m = String(currentDate.getMonth() + 1).padStart(2, '0');
        const nextYearMonth = `${y}-${m}`;
        setYearMonth(nextYearMonth);
        rememberSupportManagementYearMonth(nextYearMonth);
    }, [currentDate]);

    useEffect(() => subscribeSupportManagementYearMonth((nextYearMonth) => {
        const [year, month] = nextYearMonth.split('-').map(Number);
        setCurrentDate((previous) => (
            previous.getFullYear() === year && previous.getMonth() === month - 1
                ? previous
                : new Date(year, month - 1, 1)
        ));
    }), []);

    useEffect(() => {
        if (yearMonth) {
            dirtyLedgerRecordKeysRef.current.clear();
            forcedBillingRecordKeysRef.current.clear();
            pendingBillingRecordKeysRef.current.clear();
            setBillingSyncRetryCount(0);
            loadLedger();
        }
    }, [yearMonth]);

    const loadLedger = async () => {
        setLoading(true);
        try {
            // Load Accommodations first to get profiles
            // Also load teams and assignments for coloring
            const [accList, teamList, workerList, assignmentList, ledger, billingTargetList, billingDocList] = await Promise.all([
                accommodationService.getAccommodations(),
                teamService.getTeams(),
                manpowerService.getWorkers().catch(() => [] as Worker[]),
                accommodationAssignmentService.getAllAssignments(),
                accommodationService.getMonthlyLedger(yearMonth),
                accommodationBillingTargetService.listTargets(),
                accommodationBillingService.getBillingDocuments({ teamId: 'all', yearMonth }).catch(() => [] as AccommodationBillingDocument[])
            ]);

            setAccommodations(accList);
            setTeams(teamList);
            setWorkers(workerList);
            setAssignments(assignmentList);
            setBillingTargets(billingTargetList);
            setBillingDocuments(billingDocList);

            const ledgerWithManualMemos = ledger.map(removeAutomaticOverchargeMemoFromRecord);

            // Sort by accommodation name
            ledgerWithManualMemos.sort((a, b) => a.accommodationName.localeCompare(b.accommodationName, undefined, { numeric: true }));

            setRecords(ledgerWithManualMemos);
            dirtyLedgerRecordKeysRef.current.clear();
            ledgerWithManualMemos.forEach((record) => {
                if (record.billingSyncPending) {
                    pendingBillingRecordKeysRef.current.add(getUtilityRecordKey(record));
                }
            });
            setBillingSyncRetryCount(pendingBillingRecordKeysRef.current.size);
            setIsDirty(pendingBillingRecordKeysRef.current.size > 0);
        } catch (error) {
            console.error(error);
            alert("데이터를 불러오는데 실패했습니다.");
        } finally {
            setLoading(false);
        }
    };

    const handleMonthChange = (delta: number) => {
        if (isDirty) {
            if (!window.confirm('저장하지 않은 변경사항이 있습니다. 이동하시겠습니까?')) return;
        }
        const newDate = new Date(currentDate);
        newDate.setMonth(newDate.getMonth() + delta);
        setCurrentDate(newDate);
    };

    // EditableCell의 onCommit 콜백 — 셀 편집 완료 시 records state에 반영
    const handleCellCommit = useCallback((index: number, field: string, numValue: number) => {
        setRecords(prev => {
            const newRecords = [...prev];
            const record = { ...newRecords[index] };
            const costs = { ...record.costs, [field]: numValue };

            // Recalculate Total
            costs.total = (costs.rent || 0) +
                (costs.electricity || 0) +
                (costs.gas || 0) +
                (costs.water || 0) +
                (costs.internet || 0) +
                (costs.maintenance || 0) +
                (costs.other || 0);

            record.costs = costs;
            newRecords[index] = removeAutomaticOverchargeMemoFromRecord(record);
            dirtyLedgerRecordKeysRef.current.add(getUtilityRecordKey(record));
            return newRecords;
        });
        setIsDirty(true);
    }, [removeAutomaticOverchargeMemoFromRecord]);

    const handleSave = async () => {
        try {
            setSaving(true);
            const recordsWithManualMemos = records.map(removeAutomaticOverchargeMemoFromRecord);
            setRecords(recordsWithManualMemos);

            const [previousSavedRecords, freshBillingDocuments] = await Promise.all([
                accommodationService.listAllUtilityRecords(yearMonth),
                accommodationBillingService.getBillingDocuments({ teamId: 'all', yearMonth })
            ]);
            const previousSavedByKey = new Map(
                previousSavedRecords.map((record) => [getUtilityRecordKey(record), record])
            );
            const recordsToPersist = recordsWithManualMemos.filter((record) => {
                const key = getUtilityRecordKey(record);
                const previous = previousSavedByKey.get(key);
                return dirtyLedgerRecordKeysRef.current.has(key)
                    || !previous
                    || !hasSameAccommodationUtilityBillingSnapshot(record, previous);
            });
            const changedCandidateKeys = new Set<string>([
                ...forcedBillingRecordKeysRef.current,
                ...pendingBillingRecordKeysRef.current,
            ]);
            recordsWithManualMemos.forEach((record) => {
                const key = getUtilityRecordKey(record);
                const previous = previousSavedByKey.get(key);
                if (
                    record.billingSyncPending
                    || !previous
                    || !hasSameAccommodationUtilityBillingSnapshot(record, previous)
                ) {
                    changedCandidateKeys.add(key);
                }
            });
            previousSavedRecords.forEach((record) => {
                if (record.billingSyncPending) {
                    changedCandidateKeys.add(getUtilityRecordKey(record));
                }
            });
            const reconcileAllFallback = changedCandidateKeys.size === 0;
            const candidateRecordPool = new Map<string, UtilityRecord>();
            previousSavedRecords.forEach((record) => {
                candidateRecordPool.set(getUtilityRecordKey(record), record);
            });
            recordsWithManualMemos.forEach((record) => {
                candidateRecordPool.set(getUtilityRecordKey(record), record);
            });
            const candidateKeys = resolveAccommodationAutoBillingCandidateKeys(
                candidateRecordPool.keys(),
                changedCandidateKeys
            );

            const candidateRecords = Array.from(candidateRecordPool.values()).filter((record) => (
                candidateKeys.has(getUtilityRecordKey(record))
            ));
            const protectionKeys = new Set([
                ...candidateKeys,
                ...recordsToPersist.map((record) => getUtilityRecordKey(record)),
            ]);
            const protectionRecordPool = new Map(candidateRecordPool);
            recordsToPersist.forEach((record) => {
                protectionRecordPool.set(getUtilityRecordKey(record), record);
            });
            const protectionRecords = Array.from(protectionRecordPool.values()).filter((record) => (
                protectionKeys.has(getUtilityRecordKey(record))
            ));
            const preflightPlans = new Map(protectionRecords.map((record) => [
                getUtilityRecordKey(record),
                buildAutomaticBillingPlan(record, freshBillingDocuments)
            ]));
            const confirmedSettlementKeys = protectionRecords.length > 0
                ? await teamSettlementProtectionService.getConfirmedTeamSettlementKeys(yearMonth)
                : { teamIds: new Set<string>(), teamNames: new Set<string>() };
            const missingTargetNames: string[] = [];
            const protectedNames: string[] = [];
            const alreadySynchronizedProtectedKeys = new Set<string>();
            protectionRecords.forEach((record) => {
                const key = getUtilityRecordKey(record);
                const plan = preflightPlans.get(key)!;
                if (changedCandidateKeys.has(key) && plan.missingTarget) {
                    missingTargetNames.push(record.accommodationName);
                }
                const hasConfirmedTeamSettlement = [
                    ...plan.nextDocuments,
                    ...plan.relatedDocuments,
                ].some((document) => teamSettlementProtectionService.isConfirmedTarget(
                    confirmedSettlementKeys,
                    { teamId: document.teamId, teamName: document.teamName }
                ));
                const requiresWriteProtection = changedCandidateKeys.has(key)
                    || recordsToPersist.some((item) => getUtilityRecordKey(item) === key);
                const isProtected = plan.protectedDocuments.length > 0 || hasConfirmedTeamSettlement;
                const protectedSnapshotAlreadyMatches = Boolean(
                    record.billingSyncPending
                    && isProtected
                    && hasSameAccommodationUtilityBillingAmounts(
                        plan.nextDocuments,
                        plan.relatedDocuments,
                        {
                            recordId: normalizeKey(record.id),
                            accommodationId: normalizeKey(record.accommodationId),
                            accommodationName: normalizeKey(record.accommodationName),
                        }
                    )
                );
                if (protectedSnapshotAlreadyMatches) alreadySynchronizedProtectedKeys.add(key);
                if (requiresWriteProtection && isProtected && !protectedSnapshotAlreadyMatches) {
                    protectedNames.push(record.accommodationName);
                }
            });

            if (protectedNames.length > 0) {
                alert(`확정·지급·연체 정산에 포함된 숙소는 금액을 변경할 수 없어 대장을 저장하지 않았습니다.\n${protectedNames.slice(0, 5).join(', ')}${protectedNames.length > 5 ? ` 외 ${protectedNames.length - 5}건` : ''}\n팀정산 확정을 취소한 뒤 다시 저장해 주세요.`);
                return;
            }
            if (missingTargetNames.length > 0) {
                alert(`청구대상을 확인할 수 없어 대장을 저장하지 않았습니다.\n${missingTargetNames.slice(0, 5).join(', ')}${missingTargetNames.length > 5 ? ` 외 ${missingTargetNames.length - 5}건` : ''}\n배정/청구대상을 설정한 뒤 다시 저장해 주세요.`);
                return;
            }

            const recordsToWrite = new Map(
                recordsToPersist.map((record) => [getUtilityRecordKey(record), record])
            );
            candidateRecords.forEach((record) => {
                const key = getUtilityRecordKey(record);
                if (!changedCandidateKeys.has(key)) return;
                recordsToWrite.set(key, { ...record, billingSyncPending: true });
            });
            await accommodationService.saveUtilityRecords(Array.from(recordsToWrite.values()));
            recordsToPersist.forEach((record) => {
                dirtyLedgerRecordKeysRef.current.delete(getUtilityRecordKey(record));
            });
            candidateRecords.forEach((record) => {
                pendingBillingRecordKeysRef.current.add(getUtilityRecordKey(record));
            });
            setBillingSyncRetryCount(pendingBillingRecordKeysRef.current.size);

            const [storedRecords, storedBillingDocuments] = await Promise.all([
                accommodationService.listAllUtilityRecords(yearMonth),
                accommodationBillingService.getBillingDocuments({ teamId: 'all', yearMonth })
            ]);
            const storedRecordByKey = new Map(
                storedRecords.map((record) => [getUtilityRecordKey(record), record])
            );
            const workingDocuments = new Map(
                storedBillingDocuments.map((document) => [document.id, document])
            );
            const storedCandidatePlans = new Map<string, ReturnType<typeof buildAutomaticBillingPlan>>();
            candidateRecords.forEach((record) => {
                const savedRecord = storedRecordByKey.get(getUtilityRecordKey(record));
                if (!savedRecord) return;
                const plan = buildAutomaticBillingPlan(savedRecord, storedBillingDocuments);
                storedCandidatePlans.set(getUtilityRecordKey(record), plan);
            });
            const postSaveConfirmedSettlementKeys = candidateRecords.length > 0
                ? await teamSettlementProtectionService.getConfirmedTeamSettlementKeys(yearMonth)
                : { teamIds: new Set<string>(), teamNames: new Set<string>() };
            const failedKeys = new Set<string>();
            const protectedAfterSave: string[] = [];
            let syncedCount = 0;
            let clearedCount = 0;

            for (const record of candidateRecords) {
                const key = getUtilityRecordKey(record);
                const savedRecord = storedRecordByKey.get(key);
                if (!savedRecord) {
                    failedKeys.add(key);
                    continue;
                }
                try {
                    const storedPlan = storedCandidatePlans.get(key);
                    const teamSettlementConfirmed = storedPlan && [
                        ...storedPlan.nextDocuments,
                        ...storedPlan.relatedDocuments,
                    ].some((document) => teamSettlementProtectionService.isConfirmedTarget(
                        postSaveConfirmedSettlementKeys,
                        { teamId: document.teamId, teamName: document.teamName }
                    ));
                    if (teamSettlementConfirmed) {
                        if (alreadySynchronizedProtectedKeys.has(key)) {
                            await accommodationService.saveUtilityRecord({
                                ...savedRecord,
                                billingSyncPending: false,
                            });
                            forcedBillingRecordKeysRef.current.delete(key);
                            pendingBillingRecordKeysRef.current.delete(key);
                            continue;
                        }
                        if (reconcileAllFallback) {
                            pendingBillingRecordKeysRef.current.delete(key);
                            continue;
                        }
                        const previous = previousSavedByKey.get(key);
                        if (previous) await accommodationService.replaceUtilityRecord(previous);
                        else await accommodationService.deleteUtilityRecord(savedRecord.id);
                        forcedBillingRecordKeysRef.current.delete(key);
                        pendingBillingRecordKeysRef.current.delete(key);
                        protectedAfterSave.push(savedRecord.accommodationName);
                        continue;
                    }
                    const result = await reconcileSavedRecordBilling(savedRecord, workingDocuments);
                    if (result === 'protected' || result === 'missing-target') {
                        if (result === 'protected' && alreadySynchronizedProtectedKeys.has(key)) {
                            await accommodationService.saveUtilityRecord({
                                ...savedRecord,
                                billingSyncPending: false,
                            });
                            forcedBillingRecordKeysRef.current.delete(key);
                            pendingBillingRecordKeysRef.current.delete(key);
                            continue;
                        }
                        if (reconcileAllFallback) {
                            pendingBillingRecordKeysRef.current.delete(key);
                            continue;
                        }
                        const previous = previousSavedByKey.get(key);
                        if (previous) await accommodationService.replaceUtilityRecord(previous);
                        else await accommodationService.deleteUtilityRecord(savedRecord.id);
                        forcedBillingRecordKeysRef.current.delete(key);
                        pendingBillingRecordKeysRef.current.delete(key);
                        protectedAfterSave.push(savedRecord.accommodationName);
                        continue;
                    }
                    if (result === 'cleared') clearedCount += 1;
                    else syncedCount += 1;
                    if (savedRecord.billingSyncPending) {
                        await accommodationService.saveUtilityRecord({
                            ...savedRecord,
                            billingSyncPending: false,
                        });
                    }
                    forcedBillingRecordKeysRef.current.delete(key);
                    pendingBillingRecordKeysRef.current.delete(key);
                } catch (billingError) {
                    console.error('[UtilityLedger] automatic billing sync failed:', billingError);
                    try {
                        await accommodationService.saveUtilityRecord({
                            ...savedRecord,
                            billingSyncPending: true,
                        });
                    } catch (markerError) {
                        console.error('[UtilityLedger] billing retry marker save failed:', markerError);
                    }
                    failedKeys.add(key);
                }
            }

            failedKeys.forEach((key) => pendingBillingRecordKeysRef.current.add(key));
            setBillingSyncRetryCount(pendingBillingRecordKeysRef.current.size);

            // Reload after billing so the screen always reflects the actually stored ledger.
            await loadLedger();
            setIsDirty(pendingBillingRecordKeysRef.current.size > 0);

            if (protectedAfterSave.length > 0) {
                alert(`저장 중 확정·정산 상태로 변경된 ${protectedAfterSave.length}건은 기존 대장 금액으로 복구했습니다. 팀정산을 확인해 주세요.`);
                return;
            }
            if (failedKeys.size > 0) {
                alert(`대장은 저장되었지만 팀별 경비 ${failedKeys.size}건 반영에 실패했습니다. 저장을 다시 누르면 중복 없이 재시도합니다.`);
                return;
            }

            const details = [
                syncedCount > 0 ? `경비 반영 ${syncedCount}건` : '',
                clearedCount > 0 ? `0원 경비 정리 ${clearedCount}건` : '',
            ].filter(Boolean).join(', ');
            alert(details ? `저장하고 팀별 경비에 자동 반영했습니다. (${details})` : '저장되었습니다.');
        } catch (error) {
            console.error(error);
            if (pendingBillingRecordKeysRef.current.size > 0) {
                setBillingSyncRetryCount(pendingBillingRecordKeysRef.current.size);
                setIsDirty(true);
            }
            alert('저장에 실패했습니다. 대장과 팀별 경비를 확인한 뒤 다시 저장해 주세요.');
        } finally {
            setSaving(false);
        }
    };

    const handleApplyUtilityBills = (items: AccommodationUtilityBillApplyItem[]) => {
        const { accepted, duplicateCount } = filterNewAccommodationUtilityBillItems(records, items);
        if (accepted.length === 0) {
            setUtilityBillImport(null);
            alert('이미 대장에 반영된 동일 청구서 파일입니다. 중복 반영하지 않았습니다.');
            return;
        }
        const itemByRecordId = new Map(accepted.map((item) => [item.recordId, item]));
        const itemByAccommodationId = new Map(accepted.map((item) => [item.accommodationId, item]));
        setRecords((current) => current.map((record) => {
            const item = itemByRecordId.get(record.id) || itemByAccommodationId.get(record.accommodationId);
            if (!item) return record;
            dirtyLedgerRecordKeysRef.current.add(getUtilityRecordKey(record));
            const importedAmount = item.utilityType === 'gas'
                ? item.gasAmount
                : item.utilityType === 'water'
                    ? item.waterAmount
                    : item.electricityAmount;
            const costs = {
                ...record.costs,
                [item.utilityType]: importedAmount,
            };
            costs.total = (costs.rent || 0)
                + (costs.electricity || 0)
                + (costs.gas || 0)
                + (costs.water || 0)
                + (costs.internet || 0)
                + (costs.maintenance || 0)
                + (costs.other || 0);
            if (item.utilityType === 'gas') {
                return removeAutomaticOverchargeMemoFromRecord({ ...record, costs, gasBillImport: item.meta });
            }
            if (item.utilityType === 'water') {
                return removeAutomaticOverchargeMemoFromRecord({ ...record, costs, waterBillImport: item.meta });
            }
            return removeAutomaticOverchargeMemoFromRecord({ ...record, costs, electricityBillImport: item.meta });
        }));
        setIsDirty(true);
        const label = getUtilityImportLabel(accepted[0]?.utilityType || 'electricity');
        setUtilityBillImport(null);
        const duplicateNotice = duplicateCount > 0 ? ` 동일 파일 ${duplicateCount}건은 제외했습니다.` : '';
        alert(`${label} ${accepted.length}건을 대장에 반영했습니다.${duplicateNotice} 변경사항 저장을 눌러 최종 저장해 주세요.`);
    };

    // Helper to check profile type for visual styling
    const getProfileType = (rec: UtilityRecord, field: keyof UtilityRecord['costs']) => {
        const acc = resolveAccommodation({ id: rec.accommodationId, name: rec.accommodationName });
        if (!acc) return 'variable'; // default

        if (field === 'electricity') return acc.costProfile.electricity;
        if (field === 'gas') return acc.costProfile.gas;
        if (field === 'water') return acc.costProfile.water;
        if (field === 'internet') return acc.costProfile.internet;
        if (field === 'maintenance') return acc.costProfile.maintenance;

        return 'variable';
    };

    type TeamBadge = {
        key: string;
        name: string;
        color: string;
        icon?: string | null;
        targetType?: AccommodationBillingTarget['targetType'];
        targetLabel?: string;
        subLabel?: string;
    };

    const monthRange = useMemo(() => {
        const [y, m] = yearMonth.split('-').map(Number);
        if (!Number.isFinite(y) || !Number.isFinite(m)) return null;
        return {
            monthStart: new Date(y, m - 1, 1),
            monthEnd: new Date(y, m, 0)
        };
    }, [yearMonth]);

    const resolveTeamBadge = (assignment: AccommodationAssignment): TeamBadge | null => {
        const team = assignment.teamId
            ? teamByAnyId.get(String(assignment.teamId))
            : (assignment.teamName ? teamByName.get(String(assignment.teamName).trim()) : undefined);
        const teamName =
            team?.name ||
            normalizeKey(assignment.teamName) ||
            (normalizeKey(assignment.teamId) ? `팀ID:${normalizeKey(assignment.teamId).slice(0, 8)}` : '');
        if (!teamName) return null;

        return {
            key: `team:${normalizeKey(team?.id ?? assignment.teamId ?? teamName)}`,
            name: teamName,
            color: team?.color || '#94a3b8',
            icon: team?.icon || team?.iconKey || null
        };
    };

    const resolveTeamBadgeFromTarget = (teamId?: string, teamName?: string): TeamBadge | null => {
        const rawTeamId = normalizeKey(teamId);
        const rawTeamName = normalizeKey(teamName);
        const team = rawTeamId
            ? teamByAnyId.get(rawTeamId)
            : (rawTeamName ? teamByName.get(rawTeamName) : undefined);
        const resolvedTeamName =
            normalizeKey(team?.name) ||
            rawTeamName ||
            (rawTeamId ? `팀ID:${rawTeamId.slice(0, 8)}` : '');
        if (!resolvedTeamName) return null;

        return {
            key: `team:${normalizeKey((team?.id ?? rawTeamId) || resolvedTeamName)}`,
            name: resolvedTeamName,
            color: team?.color || '#94a3b8',
            icon: team?.icon || team?.iconKey || null
        };
    };

    const billingTargetByAccommodationId = useMemo(() => {
        const map = new Map<string, AccommodationBillingTarget>();
        billingTargets.forEach((target) => {
            const rawAccommodationId = normalizeKey(target.accommodationId);
            if (!rawAccommodationId) return;
            const matchedById = accommodationByAnyId.get(rawAccommodationId);
            const canonicalId = normalizeKey(matchedById?.id ?? rawAccommodationId);
            if (!canonicalId || map.has(canonicalId)) return;
            map.set(canonicalId, target);
        });
        return map;
    }, [billingTargets, accommodationByAnyId]);

    const billingTargetByAccommodationName = useMemo(() => {
        const map = new Map<string, AccommodationBillingTarget>();
        billingTargets.forEach((target) => {
            const targetName = normalizeKey(target.accommodationName);
            if (targetName && !map.has(targetName)) {
                map.set(targetName, target);
            }

            const rawAccommodationId = normalizeKey(target.accommodationId);
            if (!rawAccommodationId) return;
            const matchedById = accommodationByAnyId.get(rawAccommodationId);
            const nameFromAccommodation = normalizeKey(matchedById?.name);
            if (nameFromAccommodation && !map.has(nameFromAccommodation)) {
                map.set(nameFromAccommodation, target);
            }
        });
        return map;
    }, [billingTargets, accommodationByAnyId]);

    const parseBillingTargetDate = (value?: string | null): Date | null => {
        if (!value) return null;
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return null;
        date.setHours(0, 0, 0, 0);
        return date;
    };

    const parseBillingTargetStartDate = (value?: string | null): Date | null => (
        parseBillingTargetDate(value || DEFAULT_SUPPORT_BILLING_START_DATE)
    );

    const toTimestampMillis = (value?: unknown): number => {
        if (!value) return 0;
        if (typeof (value as { toMillis?: unknown }).toMillis === 'function') {
            return (value as { toMillis: () => number }).toMillis();
        }
        if (typeof (value as { toDate?: unknown }).toDate === 'function') {
            const date = (value as { toDate: () => Date }).toDate();
            return Number.isNaN(date.getTime()) ? 0 : date.getTime();
        }
        const parsed = new Date(String(value));
        return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
    };

    const compareBillingTargetsOldestFirst = (
        left: AccommodationBillingTarget,
        right: AccommodationBillingTarget
    ): number => {
        const leftStart = normalizeKey(left.startDate) || DEFAULT_SUPPORT_BILLING_START_DATE;
        const rightStart = normalizeKey(right.startDate) || DEFAULT_SUPPORT_BILLING_START_DATE;
        const startDiff = leftStart.localeCompare(rightStart);
        if (startDiff !== 0) return startDiff;

        const updatedDiff = toTimestampMillis(left.updatedAt) - toTimestampMillis(right.updatedAt);
        if (updatedDiff !== 0) return updatedDiff;

        const createdDiff = toTimestampMillis(left.createdAt) - toTimestampMillis(right.createdAt);
        if (createdDiff !== 0) return createdDiff;

        return String(left.id ?? '').localeCompare(String(right.id ?? ''));
    };

    const getBillingTargetsForAccommodation = (
        canonicalAccommodationId: string,
        canonicalAccommodationName: string
    ): AccommodationBillingTarget[] => {
        const targets = billingTargets.filter((target) => {
            const rawTargetAccommodationId = normalizeKey(target.accommodationId);
            const matchedAccommodation = rawTargetAccommodationId ? accommodationByAnyId.get(rawTargetAccommodationId) : undefined;
            const targetCanonicalId = normalizeKey(matchedAccommodation?.id ?? rawTargetAccommodationId);
            const targetCanonicalName = normalizeKey(matchedAccommodation?.name ?? target.accommodationName);
            return Boolean(
                (canonicalAccommodationId && targetCanonicalId && canonicalAccommodationId === targetCanonicalId) ||
                (canonicalAccommodationName && targetCanonicalName && canonicalAccommodationName === targetCanonicalName)
            );
        });

        return targets.sort(compareBillingTargetsOldestFirst);
    };

    const resolveBillingTarget = (canonicalAccommodationId: string, canonicalAccommodationName: string): AccommodationBillingTarget | undefined => {
        if (monthRange) {
            const targetRanges = getBillingTargetsForAccommodation(canonicalAccommodationId, canonicalAccommodationName)
                .map((target) => ({
                    target,
                    startDate: parseBillingTargetStartDate(target.startDate),
                    endDate: parseBillingTargetDate(target.endDate)
                }))
                .filter((entry) => {
                    if (!entry.startDate) return false;
                    if (entry.startDate.getTime() > monthRange.monthEnd.getTime()) return false;
                    if (entry.endDate && entry.endDate.getTime() < monthRange.monthStart.getTime()) return false;
                    return true;
                });

            if (targetRanges.length > 0) {
                const activeAtMonthStart = targetRanges
                    .filter((entry) => (
                        Boolean(entry.startDate) &&
                        entry.startDate!.getTime() <= monthRange.monthStart.getTime() &&
                        (!entry.endDate || entry.endDate.getTime() >= monthRange.monthStart.getTime())
                    ))
                    .at(-1);
                const latestChangeInMonth = targetRanges
                    .filter((entry) => (
                        Boolean(entry.startDate) &&
                        entry.startDate!.getTime() > monthRange.monthStart.getTime() &&
                        entry.startDate!.getTime() <= monthRange.monthEnd.getTime()
                    ))
                    .at(-1);
                return (latestChangeInMonth ?? activeAtMonthStart ?? targetRanges.at(-1))?.target;
            }
        }

        if (canonicalAccommodationId) {
            const byId = billingTargetByAccommodationId.get(canonicalAccommodationId);
            if (byId) return byId;
        }
        if (canonicalAccommodationName) {
            const byName = billingTargetByAccommodationName.get(canonicalAccommodationName);
            if (byName) return byName;
        }
        return undefined;
    };

    const getAssignmentSummary = (record: UtilityRecord) => {
        if (!monthRange) return null;

        const matchedAccommodation = resolveAccommodation({ id: record.accommodationId, name: record.accommodationName });
        const canonicalAccommodationId = normalizeKey(matchedAccommodation?.id ?? record.accommodationId);
        const canonicalAccommodationName = normalizeKey(matchedAccommodation?.name ?? record.accommodationName);

        const candidates = assignments.filter((assignment) => {
            if (!isMatchingAccommodationAssignment(assignment, canonicalAccommodationId, canonicalAccommodationName)) return false;
            if ((assignment.status ?? 'active') === 'ended') return false;

            const start = assignment.startDate ? new Date(assignment.startDate) : null;
            const end = assignment.endDate ? new Date(assignment.endDate) : null;
            const hasValidStart = Boolean(start && !Number.isNaN(start.getTime()));
            const hasValidEnd = Boolean(end && !Number.isNaN(end.getTime()));

            if (hasValidStart && (start as Date) > monthRange.monthEnd) return false;
            if (hasValidEnd && (end as Date) < monthRange.monthStart) return false;
            return true;
        });

        const displayCandidates = candidates;

        const assignedTeamMap = new Map<string, TeamBadge>();
        const billingTeamMap = new Map<string, TeamBadge>();
        const assignedWorkerMap = new Map<string, string>();

        displayCandidates.forEach((assignment) => {
            const teamBadge = resolveTeamBadge(assignment);
            if (teamBadge && !assignedTeamMap.has(teamBadge.key)) {
                assignedTeamMap.set(teamBadge.key, teamBadge);
            }

            const workerName = normalizeKey(assignment.workerName);
            const workerId = normalizeKey(assignment.workerId);
            const workerLabel = workerName || (workerId ? `ID:${workerId.slice(0, 8)}` : '');
            const workerKey = workerId || workerLabel;
            if (workerLabel && workerKey) assignedWorkerMap.set(workerKey, workerLabel);
        });

        const separatedBillingTarget = resolveBillingTarget(canonicalAccommodationId, canonicalAccommodationName);
        if (separatedBillingTarget) {
            if (separatedBillingTarget.targetType === 'worker') {
                const worker = resolveWorkerIdentity(separatedBillingTarget.workerId, separatedBillingTarget.workerName);
                const targetTeamBadge = resolveTeamBadgeFromTarget(worker.teamId, worker.teamName);
                const workerName = worker.workerName || normalizeKey(separatedBillingTarget.workerName);
                if (workerName) {
                    billingTeamMap.set(`worker:${worker.workerId || workerName}`, {
                        key: `worker:${worker.workerId || workerName}`,
                        name: workerName,
                        color: targetTeamBadge?.color || '#10b981',
                        targetType: 'worker',
                        targetLabel: '작업자',
                        subLabel: targetTeamBadge?.name
                    });
                }
            } else if (separatedBillingTarget.targetType === 'office') {
                billingTeamMap.set(`office:${OFFICE_TARGET_ID}`, {
                    key: `office:${OFFICE_TARGET_ID}`,
                    name: separatedBillingTarget.teamName || OFFICE_TARGET_NAME,
                    color: '#475569',
                    targetType: 'office',
                    targetLabel: '사무실',
                    subLabel: separatedBillingTarget.startDate || separatedBillingTarget.endDate
                        ? `${separatedBillingTarget.startDate || '?'}~${separatedBillingTarget.endDate || '계속'}`
                        : undefined
                });
            } else if (separatedBillingTarget.targetType === 'office_staff') {
                const staffName = normalizeKey(separatedBillingTarget.workerName) || '사무실직원';
                billingTeamMap.set(`office-staff:${normalizeKey(separatedBillingTarget.workerId) || staffName}`, {
                    key: `office-staff:${normalizeKey(separatedBillingTarget.workerId) || staffName}`,
                    name: staffName,
                    color: '#0891b2',
                    targetType: 'office_staff',
                    targetLabel: '사무실직원',
                    subLabel: separatedBillingTarget.startDate || separatedBillingTarget.endDate
                        ? `${OFFICE_TARGET_NAME} · ${separatedBillingTarget.startDate || '?'}~${separatedBillingTarget.endDate || '계속'}`
                        : OFFICE_TARGET_NAME
                });
            } else {
                const targetTeamBadge = resolveTeamBadgeFromTarget(
                    separatedBillingTarget.teamId,
                    separatedBillingTarget.teamName
                );
                if (targetTeamBadge) {
                    billingTeamMap.set(targetTeamBadge.key, {
                        ...targetTeamBadge,
                        targetType: 'team',
                        targetLabel: '팀',
                        subLabel: separatedBillingTarget.startDate || separatedBillingTarget.endDate
                            ? `${separatedBillingTarget.startDate || '?'}~${separatedBillingTarget.endDate || '계속'}`
                            : undefined
                    });
                }
            }
        } else {
            // 분리 저장 도입 전(source 기반) 레거시 데이터 fallback
            displayCandidates.forEach((assignment) => {
                const teamBadge = resolveTeamBadge(assignment);
                if (teamBadge && !billingTeamMap.has(teamBadge.key)) {
                    billingTeamMap.set(teamBadge.key, teamBadge);
                }
            });

            if (billingTeamMap.size === 0 && assignedTeamMap.size > 0) {
                assignedTeamMap.forEach((badge) => billingTeamMap.set(badge.key, badge));
            }
        }

        const assignedTeams = Array.from(assignedTeamMap.values());
        const assignedWorkers = Array.from(assignedWorkerMap.values());
        const billingTeams = Array.from(billingTeamMap.values());
        const billingWorkers: string[] = [];

        if (
            assignedTeams.length === 0 &&
            assignedWorkers.length === 0 &&
            billingTeams.length === 0 &&
            billingWorkers.length === 0
        ) {
            return null;
        }

        return {
            assignedTeams,
            assignedWorkers,
            billingTeams,
            billingWorkers,
            primaryColor: assignedTeams[0]?.color || billingTeams[0]?.color || '#94a3b8'
        };
    };

    const toKeySet = (values: Array<unknown>): Set<string> => {
        return new Set(values.map((value) => normalizeKey(value)).filter(Boolean));
    };

    const intersects = (left: Set<string>, right: Set<string>): boolean => {
        for (const value of left) {
            if (right.has(value)) return true;
        }
        return false;
    };

    const getCanonicalAccommodationForRecord = (record: UtilityRecord) => {
        const matchedAccommodation = resolveAccommodation({ id: record.accommodationId, name: record.accommodationName });
        return {
            accommodation: matchedAccommodation,
            accommodationId: normalizeKey(matchedAccommodation?.id ?? record.accommodationId),
            accommodationName: normalizeKey(matchedAccommodation?.name ?? record.accommodationName)
        };
    };

    const resolveTeamIdentity = (teamId?: string, teamName?: string) => {
        const rawTeamId = normalizeKey(teamId);
        const rawTeamName = normalizeKey(teamName);
        const team = rawTeamId ? teamByAnyId.get(rawTeamId) : (rawTeamName ? teamByName.get(rawTeamName) : undefined);
        return {
            teamId: normalizeKey(team?.id ?? rawTeamId),
            teamName: normalizeKey(team?.name ?? rawTeamName),
            teamIds: toKeySet([rawTeamId, team?.id, team?.legacyId]),
            teamNames: toKeySet([rawTeamName, team?.name])
        };
    };

    const resolveWorkerIdentity = (workerId?: string, workerName?: string) => {
        const rawWorkerId = normalizeKey(workerId);
        const rawWorkerName = normalizeKey(workerName);
        const worker = rawWorkerId ? workerByAnyId.get(rawWorkerId) : (rawWorkerName ? workerByName.get(rawWorkerName) : undefined);
        return {
            workerId: normalizeKey(worker?.id ?? rawWorkerId),
            workerName: normalizeKey(worker?.name ?? rawWorkerName),
            teamId: normalizeKey(worker?.teamId),
            teamName: normalizeKey(worker?.teamName),
            workerIds: toKeySet([rawWorkerId, worker?.id, worker?.legacyId]),
            workerNames: toKeySet([rawWorkerName, worker?.name])
        };
    };

    const resolveAssignmentTeamIdentity = (assignment?: AccommodationAssignment) => {
        if (!assignment) return { teamId: '', teamName: '', teamIds: new Set<string>(), teamNames: new Set<string>() };

        const directTeam = resolveTeamIdentity(assignment.teamId, assignment.teamName);
        if (directTeam.teamId || directTeam.teamName) return directTeam;

        const worker = resolveWorkerIdentity(assignment.workerId, assignment.workerName);
        return resolveTeamIdentity(worker.teamId, worker.teamName);
    };

    const getActiveAssignmentsForRecord = (record: UtilityRecord): AccommodationAssignment[] => {
        const { accommodation } = getCanonicalAccommodationForRecord(record);
        return accommodation ? getActiveAssignmentsForAccommodation(accommodation) : [];
    };

    const getAccommodationTargetIdentityKey = (target: AccommodationBillingTarget): string => {
        if (target.targetType === 'team') {
            return `team:${normalizeKey(target.teamId) || normalizeKey(target.teamName)}`;
        }
        if (target.targetType === 'office') {
            return `office:${OFFICE_TARGET_ID}`;
        }
        if (target.targetType === 'office_staff') {
            return `office_staff:${normalizeKey(target.workerId) || normalizeKey(target.workerName)}`;
        }
        return `worker:${normalizeKey(target.workerId) || normalizeKey(target.workerName)}`;
    };

    const resolveAccommodationBillingIdentityForTarget = (
        record: UtilityRecord,
        target?: AccommodationBillingTarget
    ): AccommodationBillingIdentity | null => {
        const activeAssignments = getActiveAssignmentsForRecord(record);
        const fallbackTeam = resolveAssignmentTeamIdentity(activeAssignments[0]);

        if (target?.targetType === 'team') {
            const team = resolveTeamIdentity(target.teamId, target.teamName);
            if (!team.teamId && !team.teamName) return null;
            return {
                issuedToType: 'team',
                teamId: team.teamId,
                teamName: team.teamName,
                workerId: '',
                workerName: '',
                teamIds: team.teamIds,
                teamNames: team.teamNames,
                workerIds: new Set<string>(),
                workerNames: new Set<string>()
            };
        }

        if (target?.targetType === 'office') {
            return {
                issuedToType: 'team',
                teamId: OFFICE_TARGET_ID,
                teamName: OFFICE_TARGET_NAME,
                workerId: '',
                workerName: '',
                teamIds: toKeySet([OFFICE_TARGET_ID, target.teamId]),
                teamNames: toKeySet([OFFICE_TARGET_NAME, target.teamName]),
                workerIds: new Set<string>(),
                workerNames: new Set<string>()
            };
        }

        if (target?.targetType === 'office_staff') {
            const workerId = normalizeKey(target.workerId);
            const workerName = normalizeKey(target.workerName);
            if (!workerId && !workerName) return null;
            return {
                issuedToType: 'worker',
                teamId: OFFICE_TARGET_ID,
                teamName: OFFICE_TARGET_NAME,
                workerId,
                workerName,
                teamIds: toKeySet([OFFICE_TARGET_ID]),
                teamNames: toKeySet([OFFICE_TARGET_NAME]),
                workerIds: toKeySet([workerId]),
                workerNames: toKeySet([workerName])
            };
        }

        if (target?.targetType === 'worker') {
            const worker = resolveWorkerIdentity(target.workerId, target.workerName);
            const team = resolveTeamIdentity(worker.teamId || fallbackTeam.teamId, worker.teamName || fallbackTeam.teamName);
            if (!team.teamId && !team.teamName) return null;
            return {
                issuedToType: 'worker',
                teamId: team.teamId,
                teamName: team.teamName,
                workerId: worker.workerId,
                workerName: worker.workerName,
                teamIds: team.teamIds,
                teamNames: team.teamNames,
                workerIds: worker.workerIds,
                workerNames: worker.workerNames
            };
        }

        const teamBillingAssignment = activeAssignments.find((assignment) => (
            normalizeKey(assignment.teamId).length > 0 || normalizeKey(assignment.teamName).length > 0
        ));
        const team = resolveAssignmentTeamIdentity(teamBillingAssignment ?? activeAssignments[0]);
        if (!team.teamId && !team.teamName) return null;

        return {
            issuedToType: 'team',
            teamId: team.teamId,
            teamName: team.teamName,
            workerId: '',
            workerName: '',
            teamIds: team.teamIds,
            teamNames: team.teamNames,
            workerIds: new Set<string>(),
            workerNames: new Set<string>()
        };
    };

    const resolveAccommodationBillingIdentity = (record: UtilityRecord): AccommodationBillingIdentity | null => {
        const { accommodationId, accommodationName } = getCanonicalAccommodationForRecord(record);
        return resolveAccommodationBillingIdentityForTarget(record, resolveBillingTarget(accommodationId, accommodationName));
    };

    const recordMatchesSelectedTeam = (record: UtilityRecord): boolean => {
        const normalizedSelectedTeamId = normalizeKey(selectedTeamId);
        if (!normalizedSelectedTeamId) return true;

        const selectedTeam = resolveTeamIdentity(normalizedSelectedTeamId);
        const matchesTeam = (teamId?: string, teamName?: string): boolean => {
            if (officeAssignmentReferencesMatch(
                normalizedSelectedTeamId,
                selectedTeam.teamName,
                teamId,
                teamName
            )) return true;

            const candidate = resolveTeamIdentity(teamId, teamName);
            return intersects(selectedTeam.teamIds, candidate.teamIds) ||
                intersects(selectedTeam.teamNames, candidate.teamNames);
        };

        if (getActiveAssignmentsForRecord(record).some((assignment) => {
            const team = resolveAssignmentTeamIdentity(assignment);
            return matchesTeam(team.teamId, team.teamName);
        })) {
            return true;
        }

        const { accommodationId, accommodationName } = getCanonicalAccommodationForRecord(record);
        const billingTarget = resolveBillingTarget(accommodationId, accommodationName);
        if (billingTarget && isOfficeBillingTargetForSelectedTeam(
            normalizedSelectedTeamId,
            selectedTeam.teamName,
            billingTarget.targetType
        )) return true;
        return billingTarget?.targetType === 'team' && matchesTeam(billingTarget.teamId, billingTarget.teamName);
    };

    const recordMatchesSearchText = (record: UtilityRecord): boolean => {
        const query = normalizeKey(searchText).replace(/\s+/g, '').toLocaleLowerCase();
        if (!query) return true;

        const { accommodation, accommodationId, accommodationName } = getCanonicalAccommodationForRecord(record);
        const billingTarget = resolveBillingTarget(accommodationId, accommodationName);
        const assignmentsForRecord = getActiveAssignmentsForRecord(record);
        const values = [
            record.accommodationName,
            accommodation?.name,
            accommodation?.address,
            accommodation?.memo,
            record.memo,
            billingTarget?.teamName,
            billingTarget?.workerName,
            ...assignmentsForRecord.flatMap((assignment) => [
                assignment.teamName,
                assignment.workerName
            ])
        ];

        return values.some((value) => normalizeKey(value).replace(/\s+/g, '').toLocaleLowerCase().includes(query));
    };

    const matchesAccommodationTargetDocument = (
        document: AccommodationBillingDocument,
        record: UtilityRecord,
        identity: AccommodationBillingIdentity | null = resolveAccommodationBillingIdentity(record)
    ): boolean => {
        if (!identity) return false;
        if (normalizeKey(document.yearMonth) !== normalizeKey(yearMonth)) return false;
        if (normalizeKey(document.issuedToType) !== normalizeKey(identity.issuedToType)) return false;

        if (identity.issuedToType === 'worker') {
            const docWorkerIds = toKeySet([document.issuedToWorkerId]);
            const docWorkerNames = toKeySet([document.issuedToWorkerName]);
            const workerMatches = intersects(identity.workerIds, docWorkerIds) || intersects(identity.workerNames, docWorkerNames);
            if (!workerMatches) return false;
        } else {
            const docTeamIds = toKeySet([document.teamId]);
            const docTeamNames = toKeySet([document.teamName]);
            const teamMatches = intersects(identity.teamIds, docTeamIds) || intersects(identity.teamNames, docTeamNames);
            if (!teamMatches) return false;
        }

        return true;
    };

    const matchesAccommodationRecordLineItem = (lineItem: AccommodationBillingLineItem, record: UtilityRecord): boolean => {
        const { accommodationId, accommodationName } = getCanonicalAccommodationForRecord(record);
        return matchesAccommodationUtilityBillingLineItem(lineItem, {
            recordId: normalizeKey(record.id),
            accommodationId: accommodationId || normalizeKey(record.accommodationId),
            accommodationName: accommodationName || normalizeKey(record.accommodationName),
        });
    };

    const getTargetDocumentsForRecord = (
        record: UtilityRecord,
        identity: AccommodationBillingIdentity | null = resolveAccommodationBillingIdentity(record),
        documents: AccommodationBillingDocument[] = billingDocuments
    ): AccommodationBillingDocument[] => {
        return documents.filter((document) => matchesAccommodationTargetDocument(document, record, identity));
    };

    const getLineItemDocumentsForRecord = (
        record: UtilityRecord,
        documents: AccommodationBillingDocument[] = billingDocuments
    ): AccommodationBillingDocument[] => {
        return documents.filter((document) =>
            normalizeKey(document.yearMonth) === normalizeKey(yearMonth) &&
            (document.lineItems ?? []).some((lineItem) => matchesAccommodationRecordLineItem(lineItem, record))
        );
    };

    const getRowBillingState = (record: UtilityRecord): {
        status: 'unbilled' | 'draft' | 'protected' | 'blocked';
        documents: AccommodationBillingDocument[];
        protectedDocuments: AccommodationBillingDocument[];
        reason?: string;
    } => {
        const identity = resolveAccommodationBillingIdentity(record);
        const lineItemDocuments = getLineItemDocumentsForRecord(record);
        const relatedDocuments = new Map<string, AccommodationBillingDocument>();
        lineItemDocuments.forEach((document) => relatedDocuments.set(document.id, document));
        if (identity) {
            getTargetDocumentsForRecord(record, identity).forEach((document) => (
                relatedDocuments.set(document.id, document)
            ));
        }
        const protectedDocuments = Array.from(relatedDocuments.values()).filter((document) => (
            isProtectedAccommodationBillingStatus(document.status)
        ));
        if (protectedDocuments.length > 0) {
            return { status: 'protected', documents: lineItemDocuments, protectedDocuments };
        }
        if (!identity) return { status: 'blocked', documents: lineItemDocuments, protectedDocuments: [], reason: '청구대상 없음' };
        if ((record.costs.total ?? 0) <= 0) return { status: 'blocked', documents: lineItemDocuments, protectedDocuments: [], reason: '금액 없음' };
        return lineItemDocuments.length > 0
            ? { status: 'draft', documents: lineItemDocuments, protectedDocuments: [] }
            : { status: 'unbilled', documents: [], protectedDocuments: [] };
    };

    const getBillingTargetSortInfo = (record: UtilityRecord) => {
        const identity = resolveAccommodationBillingIdentity(record);
        const isPersonalTarget = identity?.issuedToType === 'worker';
        const targetName = normalizeKey(isPersonalTarget ? identity?.workerName : identity?.teamName);

        return {
            group: identity ? (isPersonalTarget ? 1 : 0) : 2,
            name: targetName || 'ZZZ',
            accommodationName: normalizeKey(record.accommodationName)
        };
    };

    const compareBillingRowsByTarget = (
        left: { record: UtilityRecord },
        right: { record: UtilityRecord }
    ): number => {
        const a = getBillingTargetSortInfo(left.record);
        const b = getBillingTargetSortInfo(right.record);

        if (a.group !== b.group) return a.group - b.group;

        const targetCmp = a.name.localeCompare(b.name, 'ko-KR', { numeric: true, sensitivity: 'base' });
        if (targetCmp !== 0) return targetCmp;

        return a.accommodationName.localeCompare(b.accommodationName, 'ko-KR', { numeric: true, sensitivity: 'base' });
    };

    const visibleRows = useMemo(() => {
        return records
            .map((record, index) => ({ record, index }))
            .filter(({ record }) => recordMatchesSelectedTeam(record))
            .filter(({ record }) => recordMatchesSearchText(record))
            .sort(compareBillingRowsByTarget);
    }, [records, billingTargets, assignments, teams, workers, accommodations, yearMonth, selectedTeamId, searchText]);

    const overchargeTargets = useMemo(() => (
        records
            .filter((record) => recordMatchesSelectedTeam(record))
            .filter((record) => recordMatchesSearchText(record))
            .map((record) => {
                const accommodation = resolveAccommodation({
                    id: record.accommodationId,
                    name: record.accommodationName
                });
                const summary = getAccommodationOvercharge(record, accommodation);
                return summary ? { record, accommodation, summary } : null;
            })
            .filter((entry): entry is {
                record: UtilityRecord;
                accommodation: Accommodation | undefined;
                summary: NonNullable<ReturnType<typeof getAccommodationOvercharge>>;
            } => Boolean(entry))
            .sort((left, right) => (
                right.summary.exceededAmount - left.summary.exceededAmount
                || left.record.accommodationName.localeCompare(right.record.accommodationName, 'ko-KR', { numeric: true })
            ))
    ), [records, selectedTeamId, searchText, billingTargets, assignments, teams, workers, accommodations, yearMonth, resolveAccommodation]);

    const overchargeByRecordId = useMemo(
        () => new Map(overchargeTargets.map((entry) => [entry.record.id, entry.summary])),
        [overchargeTargets]
    );

    const blockedAccommodationIdsForElectricityImport = useMemo(() => new Set(
        records
            .filter((record) => getLineItemDocumentsForRecord(record).some((document) => (
                isProtectedAccommodationBillingStatus(document.status)
            )))
            .map((record) => String(record.accommodationId || ''))
            .filter(Boolean)
    ), [records, billingDocuments, billingTargets, assignments, teams, workers, accommodations, yearMonth]);

    const hexToRgba = (hex: string, alpha: number) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r},${g},${b},${alpha})`;
    };

    // Render Logic for Cells — EditableCell 사용
    const renderInputCell = (rec: UtilityRecord, index: number, field: keyof UtilityRecord['costs']) => {
        const type = getProfileType(rec, field);
        const storedValue = rec.costs[field as keyof typeof rec.costs];

        const isIncluded = type === 'included';
        const isFixed = type === 'fixed';

        return (
            <EditableCell
                value={storedValue}
                onCommit={(numValue) => handleCellCommit(index, field as string, numValue)}
                isIncluded={isIncluded}
                tdClassName={`p-1 border-r border-indigo-50/50 ${isIncluded ? 'bg-slate-50' : 'bg-white'}`}
                className={`w-full text-right p-2 focus:outline-none transition rounded-lg text-sm
                    ${isFixed ? 'text-emerald-600 font-bold bg-emerald-50/30' : 'text-slate-700 bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-100'}
                    ${storedValue > 100000 && field !== 'rent' ? 'text-red-500 font-extrabold' : ''}
                `}
            />
        );
    };

    const buildLineItemsForRecord = (record: UtilityRecord): AccommodationBillingLineItem[] => {
        const { accommodationId } = getCanonicalAccommodationForRecord(record);
        const fields = Object.keys(UTILITY_FIELD_LABELS) as Array<Exclude<keyof UtilityRecord['costs'], 'total'>>;
        return fields
            .map((field) => {
                const amount = Number(record.costs[field] ?? 0);
                if (!Number.isFinite(amount) || amount <= 0) return null;
                return {
                    id: `utility-${record.id}-${field}`,
                    label: `${record.accommodationName} ${UTILITY_FIELD_LABELS[field]}`,
                    amount,
                    targetField: UTILITY_FIELD_TO_TARGET[field],
                    sourceType: 'utility_ledger' as const,
                    sourceAccommodationId: accommodationId || record.accommodationId,
                    sourceUtilityRecordId: record.id
                } as AccommodationBillingLineItem;
            })
            .filter((item): item is AccommodationBillingLineItem => Boolean(item));
    };

    const getSplitBillingRangesForRecord = (record: UtilityRecord): AccommodationSplitBillingRange[] => {
        if (!monthRange) return [];

        const { accommodationId, accommodationName } = getCanonicalAccommodationForRecord(record);
        const targetRanges = getBillingTargetsForAccommodation(accommodationId, accommodationName)
            .map((target) => ({
                target,
                startDate: parseBillingTargetStartDate(target.startDate),
                endDate: parseBillingTargetDate(target.endDate),
                identityKey: getAccommodationTargetIdentityKey(target)
            }))
            .filter((entry) => {
                if (!entry.startDate) return false;
                if (entry.startDate.getTime() > monthRange.monthEnd.getTime()) return false;
                if (entry.endDate && entry.endDate.getTime() < monthRange.monthStart.getTime()) return false;
                return true;
            });

        if (targetRanges.length === 0) return [];

        const activeAtMonthStart = targetRanges
            .filter((entry) => (
                Boolean(entry.startDate) &&
                entry.startDate!.getTime() <= monthRange.monthStart.getTime() &&
                (!entry.endDate || entry.endDate.getTime() >= monthRange.monthStart.getTime())
            ))
            .at(-1);
        const changesInMonth = targetRanges.filter((entry) => (
            Boolean(entry.startDate) &&
                entry.startDate!.getTime() > monthRange.monthStart.getTime() &&
                entry.startDate!.getTime() <= monthRange.monthEnd.getTime()
        ));
        const getBillingIdentityKey = (identity: AccommodationBillingIdentity): string => (
            identity.issuedToType === 'worker'
                ? `worker:${normalizeKey(identity.workerId) || normalizeKey(identity.workerName)}`
                : `team:${normalizeKey(identity.teamId) || normalizeKey(identity.teamName)}`
        );
        const firstChangeInMonth = changesInMonth[0];
        const fallbackIdentity = !activeAtMonthStart && firstChangeInMonth?.startDate
            ? resolveAccommodationBillingIdentityForTarget(record, undefined)
            : null;
        const fallbackEntry = fallbackIdentity && firstChangeInMonth?.startDate
            ? {
                target: undefined,
                startDate: monthRange.monthStart,
                endDate: addDays(firstChangeInMonth.startDate, -1),
                identityKey: getBillingIdentityKey(fallbackIdentity)
            }
            : null;
        const timelineEntries = [
            ...(activeAtMonthStart ? [activeAtMonthStart] : []),
            ...(fallbackEntry ? [fallbackEntry] : []),
            ...changesInMonth
        ].filter((entry, index, entries) => (
            index === 0 || entry.identityKey !== entries[index - 1].identityKey
        ));

        if (new Set(timelineEntries.map((entry) => entry.identityKey)).size <= 1) {
            return [];
        }

        return timelineEntries
            .map((entry, index): AccommodationSplitBillingRange | null => {
                const nextStartDate = timelineEntries[index + 1]?.startDate ?? null;
                const explicitEndDate = entry.endDate ?? monthRange.monthEnd;
                const handoffEndDate = nextStartDate ? addDays(nextStartDate, -1) : monthRange.monthEnd;
                const segmentStart = index === 0
                    ? monthRange.monthStart
                    : maxDate(entry.startDate ?? monthRange.monthStart, monthRange.monthStart);
                const segmentEnd = minDate(explicitEndDate, handoffEndDate, monthRange.monthEnd);
                const overlapDays = inclusiveDays(segmentStart, segmentEnd);
                if (overlapDays <= 0) return null;

                return {
                    target: entry.target,
                    startDate: segmentStart,
                    endDate: segmentEnd,
                    startLabel: formatYmdDate(segmentStart),
                    endLabel: formatYmdDate(segmentEnd),
                    overlapDays,
                    identityKey: entry.identityKey
                };
            })
            .filter((range): range is AccommodationSplitBillingRange => Boolean(range));
    };

    const buildSplitLineItemGroupsForRecord = (
        record: UtilityRecord,
        ranges: AccommodationSplitBillingRange[]
    ): Array<{ range: AccommodationSplitBillingRange; lineItems: AccommodationBillingLineItem[] }> => {
        const { accommodationId } = getCanonicalAccommodationForRecord(record);
        const fields = Object.keys(UTILITY_FIELD_LABELS) as Array<Exclude<keyof UtilityRecord['costs'], 'total'>>;
        const groups = ranges.map((range) => ({ range, lineItems: [] as AccommodationBillingLineItem[] }));

        fields.forEach((field) => {
            const amount = Number(record.costs[field] ?? 0);
            if (!Number.isFinite(amount) || amount <= 0) return;

            const shares = FIXED_SPLIT_FIELDS.has(field)
                ? allocateAmountEvenly(amount, ranges.length)
                : allocateAmountByDays(amount, ranges.map((range) => range.overlapDays));
            shares.forEach((share, index) => {
                if (share <= 0) return;
                const range = ranges[index];
                groups[index].lineItems.push({
                    id: `utility-${sanitizeBillingIdPart(record.id)}-${field}-split-${index}`,
                    label: `${record.accommodationName} ${UTILITY_FIELD_LABELS[field]} ${range.startLabel}~${range.endLabel}`,
                    amount: share,
                    targetField: UTILITY_FIELD_TO_TARGET[field],
                    sourceType: 'utility_ledger',
                    sourceAccommodationId: accommodationId || record.accommodationId,
                    sourceUtilityRecordId: record.id
                });
            });
        });

        return groups.filter((group) => group.lineItems.length > 0);
    };

    const buildDocumentForRecord = (
        record: UtilityRecord,
        lineItems: AccommodationBillingLineItem[],
        existing?: AccommodationBillingDocument,
        identity: AccommodationBillingIdentity | null = resolveAccommodationBillingIdentity(record)
    ): AccommodationBillingDocument | null => {
        if (!identity) return null;
        const documentId = accommodationBillingService.buildBillingDocumentId({
            teamId: identity.teamId,
            issuedToType: identity.issuedToType,
            workerId: identity.issuedToType === 'worker' ? identity.workerId : undefined,
            yearMonth
        });

        const preservedLineItems = (existing?.lineItems ?? []).filter((lineItem) =>
            !matchesAccommodationRecordLineItem(lineItem, record)
        );

        return {
            id: documentId,
            yearMonth,
            teamId: identity.teamId,
            teamName: identity.teamName,
            issuedToType: identity.issuedToType,
            issuedToWorkerId: identity.issuedToType === 'worker' ? identity.workerId : '',
            issuedToWorkerName: identity.issuedToType === 'worker' ? identity.workerName : identity.teamName,
            status: 'draft',
            memo: existing?.memo ?? '',
            lineItems: [...preservedLineItems, ...lineItems],
            confirmedAt: undefined,
            postedAdvancePaymentId: undefined
        };
    };

    const mergeDraftSourceDocuments = (
        documents: AccommodationBillingDocument[],
        deterministicId: string
    ): AccommodationBillingDocument | undefined => {
        const draftDocuments = documents.filter((document) => isDraftAccommodationBillingStatus(document.status));
        if (draftDocuments.length === 0) return undefined;
        const canonical = draftDocuments.find((document) => document.id === deterministicId);
        const base = canonical || draftDocuments[0];
        const mergedLineItems = new Map<string, AccommodationBillingLineItem>();
        [...draftDocuments.filter((document) => document.id !== canonical?.id), ...(canonical ? [canonical] : [])]
            .forEach((document) => {
                (document.lineItems ?? []).forEach((lineItem) => mergedLineItems.set(lineItem.id, lineItem));
            });
        return {
            ...base,
            lineItems: Array.from(mergedLineItems.values())
        };
    };

    const getDraftSourceDocuments = (
        record: UtilityRecord,
        identity: AccommodationBillingIdentity,
        documents: AccommodationBillingDocument[] = billingDocuments
    ): AccommodationBillingDocument[] => (
        getTargetDocumentsForRecord(record, identity, documents)
            .filter((document) => isDraftAccommodationBillingStatus(document.status))
    );

    const getDraftSourceDocument = (
        record: UtilityRecord,
        identity: AccommodationBillingIdentity,
        documents: AccommodationBillingDocument[] = billingDocuments
    ): AccommodationBillingDocument | undefined => {
        const deterministicId = accommodationBillingService.buildBillingDocumentId({
            teamId: identity.teamId,
            issuedToType: identity.issuedToType,
            workerId: identity.issuedToType === 'worker' ? identity.workerId : undefined,
            yearMonth
        });
        return mergeDraftSourceDocuments(getDraftSourceDocuments(record, identity, documents), deterministicId);
    };

    const getSavedRecordForBilling = async (screenRecord: UtilityRecord): Promise<UtilityRecord | null> => {
        const savedRecord = await accommodationService.getSavedUtilityRecord(
            screenRecord.accommodationId,
            screenRecord.yearMonth
        );
        if (!savedRecord || !hasSameAccommodationUtilityBillingSnapshot(screenRecord, savedRecord)) return null;
        return savedRecord;
    };

    const removeRecordFromDraftDocuments = async (
        record: UtilityRecord,
        documents: AccommodationBillingDocument[],
        workingDocuments?: Map<string, AccommodationBillingDocument>
    ): Promise<number> => {
        const uniqueDocuments = new Map(documents.map((document) => [document.id, document]));
        const groups = new Map<string, AccommodationBillingDocument[]>();
        uniqueDocuments.forEach((document) => {
            if (isProtectedAccommodationBillingStatus(document.status)) return;
            const deterministicId = accommodationBillingService.buildBillingDocumentId({
                teamId: document.teamId,
                issuedToType: document.issuedToType === 'team_leader' ? 'team' : document.issuedToType,
                workerId: document.issuedToType === 'worker' ? document.issuedToWorkerId : undefined,
                yearMonth: document.yearMonth
            });
            const group = groups.get(deterministicId) ?? [];
            group.push(document);
            groups.set(deterministicId, group);
        });

        let skipped = 0;
        for (const [deterministicId, group] of groups.entries()) {
            const canonical = group.find((document) => document.id === deterministicId);
            const base = canonical || group[0];
            const remainingLineItems = new Map<string, AccommodationBillingLineItem>();
            [...group.filter((document) => document.id !== canonical?.id), ...(canonical ? [canonical] : [])]
                .forEach((document) => {
                    (document.lineItems ?? [])
                        .filter((lineItem) => !matchesAccommodationRecordLineItem(lineItem, record))
                        .forEach((lineItem) => remainingLineItems.set(lineItem.id, lineItem));
                });

            if (remainingLineItems.size > 0) {
                const next: AccommodationBillingDocument = {
                    ...base,
                    id: deterministicId,
                    status: 'draft',
                    lineItems: Array.from(remainingLineItems.values()),
                    confirmedAt: undefined,
                    postedAdvancePaymentId: undefined
                };
                const result = await accommodationBillingService.upsertDraftBillingDocument(next);
                if (result.action === 'skipped-protected') {
                    skipped += 1;
                    continue;
                }
                workingDocuments?.set(result.id, { ...next, id: result.id });
            }

            for (const source of group) {
                if (remainingLineItems.size > 0 && source.id === deterministicId) continue;
                try {
                    await accommodationBillingService.deleteBillingDocument(source.id);
                    workingDocuments?.delete(source.id);
                } catch (error) {
                    if (String(error).includes('accommodation-billing-protected-')) {
                        skipped += 1;
                        continue;
                    }
                    throw error;
                }
            }
        }
        return skipped;
    };

    const buildAutomaticBillingPlan = (
        record: UtilityRecord,
        documents: AccommodationBillingDocument[]
    ): {
        nextDocuments: AccommodationBillingDocument[];
        relatedDocuments: AccommodationBillingDocument[];
        sourceDocumentsByNextId: Map<string, AccommodationBillingDocument[]>;
        protectedDocuments: AccommodationBillingDocument[];
        missingTarget: boolean;
    } => {
        const relatedDocumentMap = new Map<string, AccommodationBillingDocument>();
        getLineItemDocumentsForRecord(record, documents).forEach((document) => {
            relatedDocumentMap.set(document.id, document);
        });

        if (Number(record.costs.total ?? 0) <= 0) {
            const relatedDocuments = Array.from(relatedDocumentMap.values());
            return {
                nextDocuments: [],
                relatedDocuments,
                sourceDocumentsByNextId: new Map(),
                protectedDocuments: relatedDocuments.filter((document) => (
                    isProtectedAccommodationBillingStatus(document.status)
                )),
                missingTarget: false,
            };
        }

        const documentGroups = new Map<string, {
            identity: AccommodationBillingIdentity;
            lineItems: AccommodationBillingLineItem[];
        }>();
        const splitRanges = getSplitBillingRangesForRecord(record);
        let missingTarget = false;

        if (splitRanges.length > 1) {
            buildSplitLineItemGroupsForRecord(record, splitRanges).forEach((group) => {
                const identity = resolveAccommodationBillingIdentityForTarget(record, group.range.target);
                if (!identity) {
                    missingTarget = true;
                    return;
                }
                const documentId = accommodationBillingService.buildBillingDocumentId({
                    teamId: identity.teamId,
                    issuedToType: identity.issuedToType,
                    workerId: identity.issuedToType === 'worker' ? identity.workerId : undefined,
                    yearMonth: record.yearMonth
                });
                const current = documentGroups.get(documentId);
                if (current) current.lineItems.push(...group.lineItems);
                else documentGroups.set(documentId, { identity, lineItems: [...group.lineItems] });
            });
        } else {
            const identity = resolveAccommodationBillingIdentity(record);
            const lineItems = buildLineItemsForRecord(record);
            if (!identity || lineItems.length === 0) {
                missingTarget = !identity;
            } else {
                const documentId = accommodationBillingService.buildBillingDocumentId({
                    teamId: identity.teamId,
                    issuedToType: identity.issuedToType,
                    workerId: identity.issuedToType === 'worker' ? identity.workerId : undefined,
                    yearMonth: record.yearMonth
                });
                documentGroups.set(documentId, { identity, lineItems });
            }
        }

        const nextDocuments: AccommodationBillingDocument[] = [];
        const sourceDocumentsByNextId = new Map<string, AccommodationBillingDocument[]>();
        documentGroups.forEach((group) => {
            const targetDocuments = getTargetDocumentsForRecord(record, group.identity, documents);
            targetDocuments.forEach((document) => relatedDocumentMap.set(document.id, document));
            const sourceDocuments = targetDocuments.filter((document) => (
                isDraftAccommodationBillingStatus(document.status)
            ));
            const existing = getDraftSourceDocument(record, group.identity, documents);
            const next = buildDocumentForRecord(record, group.lineItems, existing, group.identity);
            if (!next) {
                missingTarget = true;
                return;
            }
            nextDocuments.push(next);
            sourceDocumentsByNextId.set(next.id, sourceDocuments);
        });

        const relatedDocuments = Array.from(relatedDocumentMap.values());
        return {
            nextDocuments,
            relatedDocuments,
            sourceDocumentsByNextId,
            protectedDocuments: relatedDocuments.filter((document) => (
                isProtectedAccommodationBillingStatus(document.status)
            )),
            missingTarget: missingTarget || nextDocuments.length === 0,
        };
    };

    const reconcileSavedRecordBilling = async (
        savedRecord: UtilityRecord,
        workingDocuments: Map<string, AccommodationBillingDocument>
    ): Promise<'synced' | 'cleared' | 'protected' | 'missing-target'> => {
        const currentDocuments = Array.from(workingDocuments.values());
        const plan = buildAutomaticBillingPlan(savedRecord, currentDocuments);
        if (plan.protectedDocuments.length > 0) return 'protected';
        if (plan.missingTarget) return 'missing-target';
        const { accommodationId, accommodationName } = getCanonicalAccommodationForRecord(savedRecord);

        try {
            const result = await accommodationUtilityBillingAtomicService.reconcileRecord({
                yearMonth: savedRecord.yearMonth,
                record: {
                    recordId: normalizeKey(savedRecord.id),
                    accommodationId: accommodationId || normalizeKey(savedRecord.accommodationId),
                    accommodationName: accommodationName || normalizeKey(savedRecord.accommodationName),
                },
                desiredDocuments: plan.nextDocuments,
                relatedDocuments: plan.relatedDocuments,
                sourceDocumentsByDesiredId: Array.from(plan.sourceDocumentsByNextId.entries()).map(([
                    desiredDocumentId,
                    sourceDocuments,
                ]) => ({
                    desiredDocumentId,
                    sourceDocumentIds: sourceDocuments.map((document) => document.id),
                })),
            });

            result.deletedDocumentIds.forEach((documentId) => workingDocuments.delete(documentId));
            plan.nextDocuments.forEach((document) => workingDocuments.set(document.id, document));
            return result.action;
        } catch (error) {
            if (isAccommodationUtilityBillingAtomicProtectionError(error)) return 'protected';
            throw error;
        }
    };

    const handleCreateOrRecalculateBilling = async (record: UtilityRecord, mode: 'create' | 'recalculate') => {
        if (isDirty) {
            alert('저장하지 않은 화면값으로는 청구할 수 없습니다. 먼저 변경사항 저장을 눌러 주세요.');
            return;
        }
        const state = getRowBillingState(record);
        if (state.status === 'protected') {
            alert('확정·정산된 청구서는 보호됩니다. 재청구하지 않았습니다.');
            return;
        }
        if (state.status === 'blocked') {
            alert(state.reason || '청구할 수 없는 행입니다.');
            return;
        }

        setBillingProcessingId(record.id);
        try {
            const savedRecord = await getSavedRecordForBilling(record);
            if (!savedRecord) return;
            const savedState = getRowBillingState(savedRecord);
            if (savedState.status === 'protected') {
                alert('확정·정산된 청구서는 보호됩니다. 재청구하지 않았습니다.');
                return;
            }

            const identity = resolveAccommodationBillingIdentity(savedRecord);
            if (!identity) {
                alert('청구대상을 확인할 수 없습니다.');
                return;
            }
            const targetSourceDocuments = getDraftSourceDocuments(savedRecord, identity);
            const targetDocument = getDraftSourceDocument(savedRecord, identity);
            const lineItems = buildLineItemsForRecord(savedRecord);
            if (lineItems.length === 0) {
                alert('청구할 금액 항목이 없습니다.');
                return;
            }

            const next = buildDocumentForRecord(savedRecord, lineItems, targetDocument, identity);
            if (!next) {
                alert('청구대상을 확인할 수 없습니다.');
                return;
            }

            const upsertResult = await accommodationBillingService.upsertDraftBillingDocument(next, {
                operationId: `accommodation-billing-${mode}:${yearMonth}:${savedRecord.id}`
            });
            if (upsertResult.action === 'skipped-protected') {
                alert('확정·정산된 청구서는 보호됩니다. 재청구하지 않았습니다.');
                return;
            }

            const staleDocumentMap = new Map(
                getLineItemDocumentsForRecord(savedRecord).map((document) => [document.id, document])
            );
            targetSourceDocuments.forEach((document) => {
                if (document.id !== next.id) staleDocumentMap.set(document.id, document);
            });
            staleDocumentMap.delete(next.id);
            const staleDocuments = Array.from(staleDocumentMap.values());
            const previousTargetDocuments: AccommodationBillingDocument[] = [];
            for (const document of staleDocuments) {
                if (isProtectedAccommodationBillingStatus(document.status)) continue;
                if (matchesAccommodationTargetDocument(document, savedRecord, identity)) {
                    await accommodationBillingService.deleteBillingDocument(document.id);
                    continue;
                }
                previousTargetDocuments.push(document);
            }
            await removeRecordFromDraftDocuments(savedRecord, previousTargetDocuments);

            await loadLedger();
            alert(mode === 'recalculate'
                ? '저장된 대장 금액으로 기존 초안을 교체했습니다.'
                : '저장된 대장 금액으로 청구 초안을 생성했습니다.');
        } catch (error) {
            console.error(error);
            alert('청구 처리에 실패했습니다.');
        } finally {
            setBillingProcessingId('');
        }
    };

    const handleCreateSplitBilling = async (record: UtilityRecord) => {
        if (isDirty) {
            alert('저장하지 않은 화면값으로는 청구할 수 없습니다. 먼저 변경사항 저장을 눌러 주세요.');
            return;
        }

        setBillingProcessingId(record.id);
        try {
            const savedRecord = await getSavedRecordForBilling(record);
            if (!savedRecord) return;
            const ranges = getSplitBillingRangesForRecord(savedRecord);
            if (ranges.length <= 1) {
                alert('분할청구할 기간이 없습니다.');
                return;
            }
            if ((savedRecord.costs.total ?? 0) <= 0) {
                alert('청구할 금액 항목이 없습니다.');
                return;
            }

            const lineItemGroups = buildSplitLineItemGroupsForRecord(savedRecord, ranges);
            const documentGroups = new Map<string, {
                identity: AccommodationBillingIdentity;
                lineItems: AccommodationBillingLineItem[];
            }>();

            lineItemGroups.forEach((group) => {
                const identity = resolveAccommodationBillingIdentityForTarget(savedRecord, group.range.target);
                if (!identity) return;
                const current = documentGroups.get(group.range.identityKey);
                if (current) {
                    current.lineItems.push(...group.lineItems);
                } else {
                    documentGroups.set(group.range.identityKey, {
                        identity,
                        lineItems: [...group.lineItems]
                    });
                }
            });

            const nextDocuments: AccommodationBillingDocument[] = [];
            const sourceDocumentsByNextId = new Map<string, AccommodationBillingDocument[]>();
            const protectedDocuments = new Map<string, AccommodationBillingDocument>();
            documentGroups.forEach((group) => {
                getTargetDocumentsForRecord(savedRecord, group.identity).forEach((document) => {
                    if (isProtectedAccommodationBillingStatus(document.status)) {
                        protectedDocuments.set(document.id, document);
                    }
                });
                const sourceDocuments = getDraftSourceDocuments(savedRecord, group.identity);
                const existing = getDraftSourceDocument(savedRecord, group.identity);
                const next = buildDocumentForRecord(savedRecord, group.lineItems, existing, group.identity);
                if (next) {
                    nextDocuments.push(next);
                    sourceDocumentsByNextId.set(next.id, sourceDocuments);
                }
            });

            getLineItemDocumentsForRecord(savedRecord).forEach((document) => {
                if (isProtectedAccommodationBillingStatus(document.status)) {
                    protectedDocuments.set(document.id, document);
                }
            });

            if (protectedDocuments.size > 0) {
                alert('확정·정산된 청구서는 보호됩니다. 분할 재청구하지 않았습니다.');
                return;
            }

            if (nextDocuments.length === 0) {
                alert('청구대상을 확인할 수 없습니다.');
                return;
            }

            const upsertResults = await Promise.all(nextDocuments.map((document) => (
                accommodationBillingService.upsertDraftBillingDocument(document, {
                    operationId: `accommodation-billing-split:${yearMonth}:${savedRecord.id}:${document.id}`
                })
            )));
            if (upsertResults.some((result) => result.action === 'skipped-protected')) {
                await loadLedger();
                alert('확정·정산 상태로 변경된 청구서는 보호하고 건너뛰었습니다.');
                return;
            }

            const keepDocumentIds = new Set(nextDocuments.map((document) => document.id));
            const staleDocumentMap = new Map(
                getLineItemDocumentsForRecord(savedRecord).map((document) => [document.id, document])
            );
            sourceDocumentsByNextId.forEach((sourceDocuments, nextId) => {
                sourceDocuments.forEach((sourceDocument) => {
                    if (sourceDocument.id !== nextId) staleDocumentMap.set(sourceDocument.id, sourceDocument);
                });
            });
            keepDocumentIds.forEach((id) => staleDocumentMap.delete(id));
            const migratedSourceIds = new Set(
                Array.from(sourceDocumentsByNextId.entries())
                    .flatMap(([nextId, sources]) => sources
                        .filter((source) => nextId !== source.id)
                        .map((source) => source.id))
            );
            const staleDocuments = Array.from(staleDocumentMap.values());
            const previousTargetDocuments: AccommodationBillingDocument[] = [];
            for (const document of staleDocuments) {
                if (isProtectedAccommodationBillingStatus(document.status)) continue;
                if (migratedSourceIds.has(document.id)) {
                    await accommodationBillingService.deleteBillingDocument(document.id);
                    continue;
                }
                previousTargetDocuments.push(document);
            }
            await removeRecordFromDraftDocuments(savedRecord, previousTargetDocuments);

            await loadLedger();
            alert(`저장된 대장 금액으로 분할 청구 초안을 교체했습니다. (${nextDocuments.length}건)`);
        } catch (error) {
            console.error(error);
            alert('분할청구 처리에 실패했습니다.');
        } finally {
            setBillingProcessingId('');
        }
    };

    const openBillingEditor = (record: UtilityRecord, document: AccommodationBillingDocument) => {
        const lineItems = (document.lineItems ?? []).filter((lineItem) =>
            matchesAccommodationRecordLineItem(lineItem, record)
        );
        setBillingEditor({ record, document, lineItems });
    };

    const handleSaveBillingEditor = async (
        lineItems: AccommodationBillingLineItem[],
        memo: string,
        status: AccommodationBillingDocument['status'] = billingEditor?.document.status ?? 'draft'
    ) => {
        if (!billingEditor) return;
        setBillingProcessingId(billingEditor.record.id);
        try {
            const preserved = (billingEditor.document.lineItems ?? []).filter((lineItem) =>
                !matchesAccommodationRecordLineItem(lineItem, billingEditor.record)
            );
            const next: AccommodationBillingDocument = {
                ...billingEditor.document,
                memo,
                status,
                lineItems: [...preserved, ...lineItems]
            };

            await accommodationBillingService.upsertBillingDocument(status === 'confirmed'
                ? { ...next, status: 'draft', confirmedAt: undefined, postedAdvancePaymentId: undefined }
                : next);
            if (status === 'confirmed') {
                await accommodationBillingService.confirmAndPostToAdvancePayment(next.id);
            }
            await loadLedger();
            setBillingEditor(null);
            alert(status === 'confirmed' ? '청구서가 확정되었습니다.' : '청구서가 저장되었습니다.');
        } catch (error) {
            console.error(error);
            alert('청구서 저장에 실패했습니다.');
        } finally {
            setBillingProcessingId('');
        }
    };

    const handleCancelBillingConfirmation = async () => {
        if (!billingEditor || String(billingEditor.document.status ?? '').trim().toUpperCase() !== 'CONFIRMED') return;
        if (!window.confirm('숙소 청구서 확정을 취소하고 가불/공제 반영분도 되돌릴까요?')) return;

        setBillingProcessingId(billingEditor.record.id);
        try {
            await accommodationBillingService.cancelConfirmation(billingEditor.document.id);
            await loadLedger();
            setBillingEditor(null);
            alert('청구서 확정이 취소되었습니다.');
        } catch (error) {
            console.error(error);
            alert('청구서 확정 취소에 실패했습니다.');
        } finally {
            setBillingProcessingId('');
        }
    };

    const handleCancelBilling = async (record: UtilityRecord, document?: AccommodationBillingDocument) => {
        if (isDirty) {
            alert('저장하지 않은 화면 변경사항이 있습니다. 먼저 변경사항 저장을 눌러 주세요.');
            return;
        }
        const documents = document ? [document] : getRowBillingState(record).documents;
        if (documents.length === 0) return;
        if (documents.some((item) => isProtectedAccommodationBillingStatus(item.status))) {
            alert('확정·정산된 청구서는 미청구로 되돌릴 수 없습니다. 보호 상태를 유지했습니다.');
            return;
        }
        if (!window.confirm('청구 상태를 미청구로 변경할까요?')) return;

        setBillingProcessingId(record.id);
        try {
            await removeRecordFromDraftDocuments(record, documents);

            await loadLedger();
            alert('미청구 처리되었습니다.');
        } catch (error) {
            console.error(error);
            alert('미청구 처리에 실패했습니다.');
        } finally {
            setBillingProcessingId('');
        }
    };

    const handleBulkBilling = async (action: 'bill' | 'unbill') => {
        if (isDirty) {
            alert('저장하지 않은 화면값으로는 청구할 수 없습니다. 먼저 변경사항 저장을 눌러 주세요.');
            return;
        }

        const billingRows = visibleRows.map(({ record, index }) => ({
            record,
            index,
            billingState: getRowBillingState(record),
        }));
        const protectedTargetCount = billingRows.filter(({ billingState }) => billingState.status === 'protected').length;
        const targets = billingRows.filter(({ billingState }) => (
            action === 'bill'
                ? billingState.status === 'unbilled' || billingState.status === 'draft'
                : billingState.status === 'draft'
        ));

        if (targets.length === 0) {
            const protectedNotice = protectedTargetCount > 0
                ? ` 확정·정산 상태 ${protectedTargetCount}건은 보호되어 제외됩니다.`
                : '';
            alert(`${action === 'bill' ? '일괄 청구할 행이 없습니다.' : '일괄 미청구 처리할 행이 없습니다.'}${protectedNotice}`);
            return;
        }

        const actionLabel = action === 'bill' ? '청구/재청구' : '미청구';
        if (!window.confirm(`현재 필터 목록의 ${targets.length}건을 일괄 ${actionLabel} 처리합니다.\n청구는 저장된 대장 금액만 사용하며 확정·정산 상태는 건너뜁니다.\n계속할까요?`)) return;

        setBulkBillingAction(action);
        setBillingProcessingId('__bulk__');
        let processed = 0;
        let skipped = protectedTargetCount;
        const workingDocuments = new Map(billingDocuments.map((document) => [document.id, document]));

        try {
            const savedRecords = action === 'bill'
                ? await accommodationService.listAllUtilityRecords(yearMonth)
                : [];
            const savedRecordByAccommodationId = new Map(
                savedRecords.map((savedRecord) => [normalizeKey(savedRecord.accommodationId), savedRecord])
            );

            for (const { record, billingState } of targets) {
                try {
                    if (action === 'bill') {
                        const savedRecord = savedRecordByAccommodationId.get(normalizeKey(record.accommodationId));
                        if (!savedRecord || !hasSameAccommodationUtilityBillingSnapshot(record, savedRecord)) {
                            skipped += 1;
                            continue;
                        }
                        const lineItems = buildLineItemsForRecord(savedRecord);
                        const identity = resolveAccommodationBillingIdentity(savedRecord);
                        if (!identity) {
                            skipped += 1;
                            continue;
                        }
                        const relatedDocuments = Array.from(workingDocuments.values()).filter((document) => (
                            matchesAccommodationTargetDocument(document, savedRecord, identity)
                            || (
                                normalizeKey(document.yearMonth) === normalizeKey(yearMonth)
                                && (document.lineItems ?? []).some((lineItem) => matchesAccommodationRecordLineItem(lineItem, savedRecord))
                            )
                        ));
                        if (relatedDocuments.some((document) => isProtectedAccommodationBillingStatus(document.status))) {
                            skipped += 1;
                            continue;
                        }
                        const deterministicId = accommodationBillingService.buildBillingDocumentId({
                            teamId: identity.teamId,
                            issuedToType: identity.issuedToType,
                            workerId: identity.issuedToType === 'worker' ? identity.workerId : undefined,
                            yearMonth
                        });
                        const targetDocuments = relatedDocuments.filter((document) => (
                            matchesAccommodationTargetDocument(document, savedRecord, identity)
                        ));
                        const targetSourceDocuments = targetDocuments
                            .filter((document) => isDraftAccommodationBillingStatus(document.status));
                        const targetDocument = mergeDraftSourceDocuments(targetSourceDocuments, deterministicId);
                        const next = buildDocumentForRecord(savedRecord, lineItems, targetDocument, identity);
                        if (!next || lineItems.length === 0) {
                            skipped += 1;
                            continue;
                        }
                        const result = await accommodationBillingService.upsertDraftBillingDocument(next, {
                            operationId: `accommodation-billing-bulk:${yearMonth}:${savedRecord.id}`
                        });
                        if (result.action === 'skipped-protected') {
                            skipped += 1;
                            continue;
                        }
                        workingDocuments.set(next.id, next);

                        const staleDocumentMap = new Map(
                            relatedDocuments
                                .filter((document) => document.id !== next.id)
                                .map((document) => [document.id, document])
                        );
                        targetSourceDocuments.forEach((document) => {
                            if (document.id !== next.id) staleDocumentMap.set(document.id, document);
                        });
                        const staleDocuments = Array.from(staleDocumentMap.values());
                        const previousTargetDocuments: AccommodationBillingDocument[] = [];
                        for (const document of staleDocuments) {
                            if (matchesAccommodationTargetDocument(document, savedRecord, identity)) {
                                await accommodationBillingService.deleteBillingDocument(document.id);
                                workingDocuments.delete(document.id);
                                continue;
                            }
                            previousTargetDocuments.push(document);
                        }
                        skipped += await removeRecordFromDraftDocuments(
                            savedRecord,
                            previousTargetDocuments,
                            workingDocuments
                        );
                    } else {
                        if (billingState.documents.length === 0) {
                            skipped += 1;
                            continue;
                        }
                        const currentDocuments = billingState.documents
                            .map((item) => workingDocuments.get(item.id))
                            .filter((item): item is AccommodationBillingDocument => Boolean(item));
                        if (currentDocuments.some((item) => isProtectedAccommodationBillingStatus(item.status))) {
                            skipped += 1;
                            continue;
                        }
                        skipped += await removeRecordFromDraftDocuments(record, currentDocuments, workingDocuments);
                    }
                    processed += 1;
                } catch (error) {
                    console.error(error);
                    skipped += 1;
                }
            }

            await loadLedger();
            alert(`${actionLabel} 처리 ${processed}건 완료${skipped > 0 ? `, ${skipped}건 제외` : ''}`);
        } finally {
            setBulkBillingAction('');
            setBillingProcessingId('');
        }
    };

    return (
        <div className="flex flex-col h-full space-y-5 min-w-0">
            {/* Toolbar */}
            <div className="flex flex-col 2xl:flex-row 2xl:flex-wrap 2xl:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-indigo-100 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 min-w-0">
                    <div className="flex items-center bg-slate-100 rounded-full p-1">
                        <button onClick={() => handleMonthChange(-1)} className="w-8 h-8 flex items-center justify-center hover:bg-white hover:shadow-sm rounded-full transition text-slate-500">
                            <FontAwesomeIcon icon={faChevronLeft} />
                        </button>
                        <span className="px-4 font-bold text-slate-700 font-mono text-lg">{yearMonth}</span>
                        <button onClick={() => handleMonthChange(1)} className="w-8 h-8 flex items-center justify-center hover:bg-white hover:shadow-sm rounded-full transition text-slate-500">
                            <FontAwesomeIcon icon={faChevronRight} />
                        </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 min-w-0">
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 whitespace-nowrap">
                            <FontAwesomeIcon icon={faFileInvoiceDollar} className="text-indigo-500" />
                            월별 공과금 대장
                        </h2>
                        {isDirty && (
                            <span className="px-3 py-1 bg-orange-100 text-orange-700 text-xs font-bold rounded-full animate-pulse border border-orange-200">
                                ● 수정사항 있음
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap gap-2 sm:gap-3 items-center justify-start 2xl:justify-end">
                    <div className="flex w-full items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm sm:w-auto" aria-label="공과금 청구서 AI 등록">
                        <span className="hidden items-center gap-1.5 whitespace-nowrap px-2 text-[11px] font-extrabold text-slate-500 xl:inline-flex">
                            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                            AI 청구서
                        </span>
                        {UTILITY_IMPORT_OPTIONS.map((option) => {
                            const UtilityIcon = option.Icon;
                            return (
                                <button
                                    key={option.type}
                                    type="button"
                                    onClick={() => setUtilityBillImport({ utilityType: option.type, files: [] })}
                                    disabled={loading || saving}
                                    title={`${option.fullLabel} 이미지/PDF 일괄 분석`}
                                    aria-label={`${option.fullLabel} AI 등록`}
                                    className={`inline-flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border bg-white px-2.5 text-xs font-extrabold transition sm:flex-none ${option.className} disabled:cursor-not-allowed disabled:border-slate-100 disabled:bg-slate-50 disabled:text-slate-300`}
                                >
                                    <UtilityIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                                    {option.label}
                                </button>
                            );
                        })}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
                        <span className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 rounded-md border border-emerald-100 text-emerald-700">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full"></div> 고정(Fixed)
                        </span>
                        <span className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 rounded-md border border-slate-100 text-slate-500">
                            <div className="w-2 h-2 bg-slate-300 rounded-full"></div> 포함(Included)
                        </span>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-2 rounded-xl border border-indigo-100 hover:bg-gray-50 shadow-sm whitespace-nowrap">
                        <input
                            type="checkbox"
                            checked={isStickyHeader}
                            onChange={(e) => setIsStickyHeader(e.target.checked)}
                            className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                        />
                        <span className="text-sm font-bold text-slate-600">목록 고정</span>
                    </label>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className={`px-5 py-2.5 rounded-xl font-bold text-white shadow-lg shadow-indigo-200 transition-all active:scale-95 flex items-center gap-2 whitespace-nowrap
                            ${saving ? 'bg-indigo-400 cursor-wait' : 'bg-indigo-600 hover:bg-indigo-700 hover:-translate-y-0.5'}
                        `}
                    >
                        <FontAwesomeIcon icon={faSave} />
                        {saving ? '저장·경비 반영 중...' : '저장'}
                    </button>
                </div>
                {billingSyncRetryCount > 0 && (
                    <div className="w-full text-xs font-extrabold text-rose-600">
                        경비 반영 재시도 필요 {billingSyncRetryCount}건
                    </div>
                )}
            </div>

            {!loading && (
                overchargeTargets.length > 0 ? (
                    <div
                        role="alert"
                        className="rounded-2xl border border-rose-200 bg-rose-50 p-4 shadow-sm"
                    >
                        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                            <div className="flex items-start gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                                    <FontAwesomeIcon icon={faExclamationTriangle} />
                                </div>
                                <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h3 className="text-sm font-extrabold text-rose-800">
                                            과청구 대상 {overchargeTargets.length}건
                                        </h3>
                                        <span className="rounded-full border border-rose-200 bg-white px-2 py-0.5 text-[10px] font-bold text-rose-600">
                                            전기 + 가스 + 수도 합계
                                        </span>
                                    </div>
                                    <p className="mt-1 text-xs font-medium text-rose-700">
                                        전기세·가스비·수도세 합계가 숙소 등록·수정에서 설정한 기준금액을 초과한 숙소입니다. 초과한 차액만 표시합니다.
                                    </p>
                                </div>
                            </div>
                            <div className="flex max-h-28 flex-wrap gap-2 overflow-y-auto xl:max-w-[58%] xl:justify-end">
                                {overchargeTargets.map(({ record, summary }) => (
                                    <span
                                        key={record.id}
                                        className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 shadow-sm"
                                        title={`${summary.typeLabel} 전기+가스+수도 ${summary.utilityTotal.toLocaleString('ko-KR')}원 / 기준 ${summary.threshold.toLocaleString('ko-KR')}원`}
                                    >
                                        <span className="max-w-[180px] truncate">{record.accommodationName}</span>
                                        <span className="text-rose-600">
                                            초과 {summary.exceededAmount.toLocaleString('ko-KR')}원
                                        </span>
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-700">
                        과청구 대상 없음 · 전기+가스+수도 합계가 숙소별 설정 기준 이내입니다. (기본: 투룸 20만 원 / 쓰리룸 30만 원)
                    </div>
                )
            )}

            {/* Grid */}
            <div className="bg-white border border-indigo-100 shadow-xl shadow-indigo-50/50 rounded-2xl overflow-hidden flex-1 flex flex-col">
                <div className={`custom-scrollbar ${isStickyHeader ? 'overflow-auto h-[calc(100vh-400px)] min-h-[400px] border-b border-indigo-100' : 'overflow-auto h-[calc(100vh-420px)] min-h-[460px]'}`}>
                    {loading ? (
                        <div className="h-96 flex flex-col items-center justify-center text-slate-400 gap-3">
                            <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                            <p>데이터를 불러오는 중입니다...</p>
                        </div>
                    ) : (
                        <table className="support-compact-table support-compact-ledger w-full min-w-[1320px] table-fixed text-[11px] lg:text-xs">
                            <colgroup>
                                <col style={{ width: '8%' }} />
                                <col style={{ width: '6%' }} />
                                <col style={{ width: '8%' }} />
                                <col style={{ width: '17%' }} />
                                <col style={{ width: '3.7%' }} />
                                <col style={{ width: '3.7%' }} />
                                <col style={{ width: '3.7%' }} />
                                <col style={{ width: '3.7%' }} />
                                <col style={{ width: '3.7%' }} />
                                <col style={{ width: '3.7%' }} />
                                <col style={{ width: '3.7%' }} />
                                <col style={{ width: '5.1%' }} />
                                <col style={{ width: '4.5%' }} />
                                <col style={{ width: '10%' }} />
                            </colgroup>
                            <thead className={`bg-indigo-600 text-white font-bold text-xs uppercase shadow-md ${isStickyHeader ? 'sticky top-0 z-20' : ''}`}>
                                <tr>
                                    <th className="px-4 py-4 text-left w-52 tracking-wider bg-indigo-700 border-r border-indigo-500">배정팀</th>
                                    <th className="px-4 py-4 text-left w-40 tracking-wider bg-indigo-700 border-r border-indigo-500">배정 인원</th>
                                    <th className="px-4 py-4 text-left w-52 tracking-wider bg-indigo-700 border-r border-indigo-500">청구대상</th>
                                    <th className="px-4 py-4 text-left w-52 tracking-wider bg-indigo-700">숙소명</th>
                                    <th className="px-2 py-4 text-center w-28 border-l border-indigo-500">월세</th>
                                    <th className="px-2 py-4 text-center w-28 border-l border-indigo-500">전기세</th>
                                    <th className="px-2 py-4 text-center w-28 border-l border-indigo-500">가스비</th>
                                    <th className="px-2 py-4 text-center w-28 border-l border-indigo-500">수도세</th>
                                    <th className="px-2 py-4 text-center w-28 border-l border-indigo-500">인터넷</th>
                                    <th className="px-2 py-4 text-center w-28 border-l border-indigo-500">관리비</th>
                                    <th className="px-2 py-4 text-center w-28 border-l border-indigo-500">기타</th>
                                    <th className="px-2 py-4 text-center w-32 border-l border-indigo-400 bg-indigo-500">합계</th>
                                    <th className="px-2 py-4 text-center border-l border-indigo-500">초과액</th>
                                    <th className="px-4 py-4 text-left border-l border-indigo-500">메모</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-indigo-50">
                                {visibleRows.map(({ record: rec, index: idx }) => {
                                    const assignmentSummary = getAssignmentSummary(rec);
                                    const matchedAccommodation = resolveAccommodation({ id: rec.accommodationId, name: rec.accommodationName });
                                    const assignedWorkers = assignmentSummary?.assignedWorkers ?? [];
                                    const visibleAssignedWorkers = assignedWorkers.slice(0, 3);
                                    const overchargeSummary = overchargeByRecordId.get(rec.id);

                                    return (
                                        <tr
                                            key={`${rec.accommodationId}-${idx}`}
                                            className={`group transition-colors ${
                                                overchargeSummary
                                                    ? 'bg-rose-50/40 hover:bg-rose-50/70'
                                                    : 'hover:bg-blue-50/40'
                                            }`}
                                        >

                                            {/* Assigned Team */}
                                            <td className="px-4 py-3 border-r border-indigo-50 bg-white"
                                                style={assignmentSummary?.primaryColor ? {
                                                    borderLeft: `4px solid ${assignmentSummary.primaryColor}`,
                                                    backgroundColor: hexToRgba(assignmentSummary.primaryColor, 0.05)
                                                } : undefined}>
                                                {assignmentSummary && assignmentSummary.assignedTeams.length > 0 ? (
                                                    <div className="flex flex-col gap-1.5">
                                                        {assignmentSummary.assignedTeams.map((team) => (
                                                            <div key={team.key} className="flex items-center gap-2 min-w-0">
                                                                 <span className="w-6 h-6 rounded-md flex items-center justify-center text-white text-[10px] shrink-0"
                                                                     style={{ backgroundColor: team.color, color: getContrastingTextColor(team.color) }}>
                                                                    <FontAwesomeIcon icon={
                                                                        team.targetType === 'worker' || team.targetType === 'office_staff'
                                                                            ? faUser
                                                                            : team.targetType === 'office'
                                                                                ? faBuilding
                                                                                : iconMap[team.icon || ''] || faUsers
                                                                    } />
                                                                </span>
                                                                <span className="font-bold text-slate-700 truncate max-w-[160px]" title={team.name}>
                                                                    {team.name}
                                                                    {(team.targetLabel || team.subLabel) && (
                                                                        <span className="block text-[10px] font-semibold text-slate-400">
                                                                            {team.targetLabel ? `${team.targetLabel} · ` : ''}{team.subLabel || ''}
                                                                        </span>
                                                                    )}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-300 text-xs">-</span>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenQuickAssignFromRecord(rec)}
                                                    className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-100 transition-colors"
                                                    title="팀 배정/청구대상 수정"
                                                >
                                                    <FontAwesomeIcon icon={faUsers} className="text-[10px]" />
                                                    배정/청구 설정
                                                </button>
                                            </td>

                                            <td className="px-4 py-3 border-r border-indigo-50 bg-white">
                                                {assignmentSummary ? (
                                                    <div className="space-y-1">
                                                        {visibleAssignedWorkers.length > 0 ? (
                                                            <>
                                                                {visibleAssignedWorkers.map((workerName, workerIdx) => (
                                                                    <div key={`assigned-worker-${workerName}-${workerIdx}`} className="flex items-center gap-2 min-w-0">
                                                                        <span className="w-6 h-6 rounded-md flex items-center justify-center text-white text-[10px] shrink-0 bg-emerald-500">
                                                                            <FontAwesomeIcon icon={faUser} />
                                                                        </span>
                                                                        <span className="font-bold text-slate-700 text-xs leading-tight truncate max-w-[145px]" title={workerName}>
                                                                            {workerName}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                                {assignedWorkers.length > visibleAssignedWorkers.length && (
                                                                    <div className="text-[11px] text-slate-500 pl-8">
                                                                        +{assignedWorkers.length - visibleAssignedWorkers.length}명
                                                                    </div>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <span className="text-slate-300 text-xs">-</span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-300 text-xs">-</span>
                                                )}
                                            </td>

                                            <td className="px-4 py-3 border-r border-indigo-50 bg-white">
                                                {assignmentSummary && assignmentSummary.billingTeams.length > 0 ? (
                                                    <div className="flex flex-col gap-1.5">
                                                        {assignmentSummary.billingTeams.map((team) => (
                                                            <div key={`billing-${team.key}`} className="flex items-center gap-2 min-w-0">
                                                                 <span
                                                                     className="w-6 h-6 rounded-md flex items-center justify-center text-white text-[10px] shrink-0"
                                                                     style={{ backgroundColor: team.color, color: getContrastingTextColor(team.color) }}
                                                                 >
                                                                    <FontAwesomeIcon icon={iconMap[team.icon || ''] || faUsers} />
                                                                </span>
                                                                <span className="font-bold text-slate-700 truncate max-w-[160px]" title={team.name}>
                                                                    {team.name}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-300 text-xs">-</span>
                                                )}
                                            </td>

                                            <td className="px-4 py-3 border-r border-indigo-50 font-bold text-slate-700 bg-white group-hover:bg-blue-50/40">
                                                <div className="flex min-w-0 items-center gap-1.5 whitespace-nowrap">
                                                    <span
                                                        className="min-w-0 flex-1 truncate whitespace-nowrap"
                                                        title={rec.accommodationName}
                                                    >
                                                        {rec.accommodationName}
                                                    </span>
                                                    {matchedAccommodation?.contract?.isAutoTransfer && (
                                                        <span className="shrink-0 whitespace-nowrap px-1.5 py-0.5 rounded bg-indigo-100/80 text-indigo-700 text-[10px] font-extrabold border border-indigo-200 select-none cursor-help"
                                                            title="이 숙소는 공과금이 자동이체로 설정되어 있습니다.">
                                                            자동이체
                                                        </span>
                                                    )}
                                                    {rec.electricityBillImport && (
                                                        <span
                                                            className="shrink-0 whitespace-nowrap rounded border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[10px] font-extrabold text-sky-700"
                                                            title={`${rec.electricityBillImport.sourceFileName} · 고객번호 ${rec.electricityBillImport.customerNumber || '-'} · ${rec.electricityBillImport.usageKwh || 0}kWh`}
                                                        >
                                                            AI 전기
                                                        </span>
                                                    )}
                                                    {rec.gasBillImport && (
                                                        <span
                                                            className="shrink-0 whitespace-nowrap rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-800"
                                                            title={`${rec.gasBillImport.sourceFileName} · 납부자번호 ${rec.gasBillImport.payerNumber || '-'} · ${rec.gasBillImport.usageCubicMeters || 0}m³`}
                                                        >
                                                            AI 가스
                                                        </span>
                                                    )}
                                                    {rec.waterBillImport && (
                                                        <span
                                                            className="shrink-0 whitespace-nowrap rounded border border-cyan-200 bg-cyan-50 px-1.5 py-0.5 text-[10px] font-extrabold text-cyan-700"
                                                            title={`${rec.waterBillImport.sourceFileName} · 수용가번호 ${rec.waterBillImport.consumerNumber || '-'} · ${rec.waterBillImport.usageCubicMeters || 0}m³`}
                                                        >
                                                            AI 수도
                                                        </span>
                                                    )}
                                                    {rec.paymentStatus === 'paid' && <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500 shadow-sm" title="완납"></span>}
                                                    {rec.paymentStatus === 'unpaid' && <span className="h-2 w-2 shrink-0 rounded-full bg-rose-500 shadow-sm animate-pulse" title="미납"></span>}
                                                </div>
                                            </td>

                                            {/* Rent */}
                                            <EditableCell
                                                value={rec.costs.rent}
                                                onCommit={(numValue) => handleCellCommit(idx, 'rent', numValue)}
                                                tdClassName="p-1 border-r border-indigo-50 bg-amber-50/30 group-hover:bg-amber-50/50"
                                                className="w-full text-right p-2 bg-transparent focus:outline-none focus:bg-white focus:ring-2 focus:ring-amber-200 rounded-lg text-slate-800 font-bold"
                                            />

                                            {/* Utilities */}
                                            {renderInputCell(rec, idx, 'electricity')}
                                            {renderInputCell(rec, idx, 'gas')}
                                            {renderInputCell(rec, idx, 'water')}
                                            {renderInputCell(rec, idx, 'internet')}
                                            {renderInputCell(rec, idx, 'maintenance')}

                                            {/* Other */}
                                            <EditableCell
                                                value={rec.costs.other}
                                                onCommit={(numValue) => handleCellCommit(idx, 'other', numValue)}
                                                tdClassName="p-1 border-r border-indigo-50"
                                                className="w-full text-right p-2 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100 rounded-lg text-slate-600 bg-transparent hover:bg-white"
                                                placeholder="0"
                                            />

                                            {/* Total */}
                                            <td className={`px-4 py-3 border-r border-indigo-50 text-right font-extrabold font-mono text-base ${
                                                overchargeSummary
                                                    ? 'bg-rose-100/70 text-rose-700'
                                                    : 'bg-indigo-50/30 text-indigo-700 group-hover:bg-indigo-50/60'
                                            }`}>
                                                {rec.costs.total.toLocaleString()}
                                            </td>

                                            {/* Overcharge */}
                                            <td className={`px-2 py-3 border-r border-indigo-50 text-center ${
                                                overchargeSummary ? 'bg-rose-50/70' : 'bg-white'
                                            }`}>
                                                {overchargeSummary ? (
                                                    <div
                                                        className="rounded bg-rose-100 px-1.5 py-1 text-[10px] font-extrabold text-rose-700"
                                                        title={`전기+가스+수도 ${overchargeSummary.utilityTotal.toLocaleString('ko-KR')}원 / 기준 ${overchargeSummary.threshold.toLocaleString('ko-KR')}원`}
                                                    >
                                                        {overchargeSummary.exceededAmount.toLocaleString('ko-KR')}원
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-300">-</span>
                                                )}
                                            </td>

                                            {/* Memo */}
                                            <td className="p-1">
                                                <input
                                                    type="text"
                                                    value={rec.memo || ''}
                                                    title={rec.memo || undefined}
                                                    onChange={(e) => {
                                                        const newRecords = [...records];
                                                        newRecords[idx] = { ...newRecords[idx], memo: e.target.value };
                                                        dirtyLedgerRecordKeysRef.current.add(getUtilityRecordKey(newRecords[idx]));
                                                        setRecords(newRecords);
                                                        setIsDirty(true);
                                                    }}
                                                    className="w-full p-2 focus:outline-none focus:bg-indigo-50 focus:ring-1 focus:ring-indigo-200 rounded-lg text-xs font-medium text-slate-700 bg-transparent"
                                                    placeholder=""
                                                />
                                            </td>
                                        </tr>
                                    )
                                })}
                                {visibleRows.length === 0 && (
                                    <tr>
                                        <td colSpan={14} className="p-20 text-center text-slate-400 bg-slate-50/50">
                                            <div className="flex flex-col items-center gap-3">
                                                <FontAwesomeIcon icon={faFileInvoiceDollar} className="text-4xl text-slate-300" />
                                                <p>조건에 맞는 숙소 대장 행이 없습니다.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                            <tfoot className="bg-slate-800 text-white font-bold text-sm tracking-wide sticky bottom-0 z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                                <tr>
                                    <td colSpan={4} className="p-4 border-r border-slate-600 text-center">합계</td>
                                    <td className="p-4 border-r border-slate-600 text-right font-mono text-amber-300">{records.reduce((sum, r) => sum + (r.costs.rent || 0), 0).toLocaleString()}</td>
                                    <td className="p-4 border-r border-slate-600 text-right font-mono">{records.reduce((sum, r) => sum + (r.costs.electricity || 0), 0).toLocaleString()}</td>
                                    <td className="p-4 border-r border-slate-600 text-right font-mono">{records.reduce((sum, r) => sum + (r.costs.gas || 0), 0).toLocaleString()}</td>
                                    <td className="p-4 border-r border-slate-600 text-right font-mono">{records.reduce((sum, r) => sum + (r.costs.water || 0), 0).toLocaleString()}</td>
                                    <td className="p-4 border-r border-slate-600 text-right font-mono">{records.reduce((sum, r) => sum + (r.costs.internet || 0), 0).toLocaleString()}</td>
                                    <td className="p-4 border-r border-slate-600 text-right font-mono">{records.reduce((sum, r) => sum + (r.costs.maintenance || 0), 0).toLocaleString()}</td>
                                    <td className="p-4 border-r border-slate-600 text-right font-mono">{records.reduce((sum, r) => sum + (r.costs.other || 0), 0).toLocaleString()}</td>
                                    <td className="p-4 border-r border-slate-600 text-right font-mono text-indigo-300 text-lg">{records.reduce((sum, r) => sum + (r.costs.total || 0), 0).toLocaleString()}</td>
                                    <td colSpan={2} className="bg-slate-900 border-l border-slate-700"></td>
                                </tr>
                            </tfoot>
                        </table>
                    )}
                </div>
            </div>

            <div className="flex items-start gap-4 p-4 bg-amber-50 rounded-xl border border-amber-200 shadow-sm">
                <div className="bg-amber-100 p-2 rounded-full text-amber-600">
                    <FontAwesomeIcon icon={faExclamationTriangle} />
                </div>
                <div>
                    <h4 className="font-bold text-amber-800 text-sm mb-1">입력 가이드</h4>
                    <p className="text-xs text-amber-700 leading-relaxed">
                        * <strong>[저장]</strong>을 누르면 대장을 저장한 뒤 DB에 실제 저장된 금액을 팀별 경비에 자동 반영합니다.<br />
                        * 같은 내용을 반복 저장해도 기존 초안을 교체하므로 금액이 두 배로 늘지 않습니다. 0원은 해당 숙소의 작성 중 경비만 정리합니다.<br />
                        * 확정·지급·연체 정산에 포함된 금액은 대장에서 변경할 수 없습니다. 팀정산 상태를 먼저 확인해 주세요.<br />
                        * 전기세·가스비·수도세 합계가 <strong className="text-rose-600">숙소별 설정 기준금액을 초과</strong>하면 초과한 차액만 상단 과청구 대상과 각 행의 초과액 열에 표시됩니다. (기본: 투룸 20만 원 / 쓰리룸 30만 원)<br />
                        * 10만 원을 초과하는 공과금은 <strong className="text-rose-600">빨간색 굵은 글씨</strong>로 표시됩니다.<br />
                        * <strong>고정(Fixed)</strong> 항목은 자동으로 입력되지만, 필요 시 수정할 수 있습니다.<br />
                        * 숙소 청구는 선택한 청구대상에게 매월 1일부터 말일까지 월 전체 기준으로 청구합니다.<br />
                        * 모든 변경사항은 <strong>[저장]</strong> 버튼을 눌러야 반영됩니다.
                    </p>
                </div>
            </div>

            {quickAssignAccommodation && (
                <AccommodationQuickAssignmentModal
                    accommodation={quickAssignAccommodation}
                    activeAssignments={getActiveAssignmentsForAccommodation(quickAssignAccommodation)}
                    assignmentHistory={getAssignmentsForAccommodation(quickAssignAccommodation)}
                    isOpen={!!quickAssignAccommodation}
                    initialBillingSplitMode={quickAssignSplitMode}
                    onClose={() => {
                        setQuickAssignAccommodation(null);
                        setQuickAssignSplitMode(false);
                    }}
                    onSuccess={async () => {
                        const affectedRecord = records.find((record) => {
                            const matched = resolveAccommodation({
                                id: record.accommodationId,
                                name: record.accommodationName
                            });
                            return normalizeKey(matched?.id ?? record.accommodationId) === normalizeKey(quickAssignAccommodation.id);
                        });
                        if (affectedRecord) {
                            forcedBillingRecordKeysRef.current.add(getUtilityRecordKey(affectedRecord));
                        }
                        await loadLedger();
                        setIsDirty(true);
                        setQuickAssignAccommodation(null);
                        setQuickAssignSplitMode(false);
                    }}
                />
            )}

            {utilityBillImport && (
                <AccommodationUtilityBillImportModal
                    utilityType={utilityBillImport.utilityType}
                    yearMonth={yearMonth}
                    files={utilityBillImport.files}
                    accommodations={accommodations}
                    records={records}
                    blockedAccommodationIds={blockedAccommodationIdsForElectricityImport}
                    onClose={() => setUtilityBillImport(null)}
                    onApply={handleApplyUtilityBills}
                />
            )}
        </div>
    );
};

export default UtilityLedger;
