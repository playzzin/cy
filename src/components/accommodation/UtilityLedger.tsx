import React, { useState, useEffect, useCallback, useRef, memo, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBuilding, faSave, faChevronLeft, faChevronRight, faExclamationTriangle, faFileInvoiceDollar, faUsers, faUser } from '@fortawesome/free-solid-svg-icons';
import { accommodationService } from '../../services/accommodationService';
import { accommodationAssignmentService } from '../../services/accommodationAssignmentService';
import { accommodationBillingTargetService } from '../../services/accommodationBillingTargetService';
import { accommodationBillingService } from '../../services/accommodationBillingService';
import { teamService, Team } from '../../services/teamService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { Accommodation, UtilityRecord } from '../../types/accommodation';
import { AccommodationAssignment } from '../../types/accommodationAssignment';
import { AccommodationBillingTarget } from '../../types/accommodationBillingTarget';
import { AccommodationBillingDocument, AccommodationBillingLineItem, AccommodationBillingTargetField } from '../../types/accommodationBilling';
import { iconMap } from '../../constants/iconMap';
import AccommodationQuickAssignmentModal from './QuickAssignmentModal';
import LedgerBillingEditorModal from '../support/LedgerBillingEditorModal';

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

type BillingFilter = 'all' | 'billed' | 'unbilled';
type BillingRowStatus = 'unbilled' | 'billed' | 'blocked';

const BILLING_FILTERS: Array<{ value: BillingFilter; label: string }> = [
    { value: 'all', label: '전체' },
    { value: 'billed', label: '청구' },
    { value: 'unbilled', label: '미청구' }
];

const getBillingStatusBadge = (status: BillingRowStatus) => {
    if (status === 'billed') {
        return { label: '청구', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    }
    return { label: '미청구', className: 'bg-rose-50 text-rose-700 border-rose-200' };
};

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

const UtilityLedger: React.FC = () => {
    // State for Year-Month
    const [currentDate, setCurrentDate] = useState(new Date());
    const [yearMonth, setYearMonth] = useState('');

    // Data State
    const [records, setRecords] = useState<UtilityRecord[]>([]);
    const [accommodations, setAccommodations] = useState<Accommodation[]>([]); // needed for profile checks
    const [teams, setTeams] = useState<Team[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [assignments, setAssignments] = useState<AccommodationAssignment[]>([]);
    const [billingTargets, setBillingTargets] = useState<AccommodationBillingTarget[]>([]);
    const [billingDocuments, setBillingDocuments] = useState<AccommodationBillingDocument[]>([]);
    const [billingFilter, setBillingFilter] = useState<BillingFilter>('all');
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
    const [isStickyHeader, setIsStickyHeader] = useState(false); // Sticky header toggle
    const [quickAssignAccommodation, setQuickAssignAccommodation] = useState<Accommodation | null>(null);
    const [quickAssignSplitMode, setQuickAssignSplitMode] = useState(false);

    const normalizeKey = (value: unknown): string => String(value ?? '').trim();

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

    const resolveAccommodation = (params: { id?: string; name?: string }): Accommodation | undefined => {
        const id = normalizeKey(params.id);
        if (id) {
            const byId = accommodationByAnyId.get(id);
            if (byId) return byId;
        }

        const name = normalizeKey(params.name);
        if (!name) return undefined;
        return accommodationByName.get(name);
    };

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
        const [y, m] = yearMonth.split('-').map(Number);
        const monthStart = Number.isFinite(y) && Number.isFinite(m) ? new Date(y, m - 1, 1) : new Date();
        const monthEnd = Number.isFinite(y) && Number.isFinite(m) ? new Date(y, m, 0) : new Date();

        const isActiveInSelectedMonth = (assignment: AccommodationAssignment): boolean => {
            if ((assignment.status ?? 'active') === 'ended') return false;
            const startDate = assignment.startDate ? new Date(assignment.startDate) : null;
            if (startDate && !Number.isNaN(startDate.getTime()) && startDate > monthEnd) return false;

            if (!assignment.endDate) return true;
            const endDate = new Date(assignment.endDate);
            if (Number.isNaN(endDate.getTime())) return true;
            return endDate >= monthStart;
        };

        return assignments.filter(
            (assignment) =>
                isMatchingAccommodationAssignment(assignment, canonicalAccommodationId, canonicalAccommodationName) &&
                isActiveInSelectedMonth(assignment)
        );
    }, [assignments, isMatchingAccommodationAssignment, yearMonth]);

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
        setYearMonth(`${y}-${m}`);
    }, [currentDate]);

    useEffect(() => {
        if (yearMonth) {
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

            // Sort by accommodation name
            ledger.sort((a, b) => a.accommodationName.localeCompare(b.accommodationName, undefined, { numeric: true }));

            setRecords(ledger);
            setIsDirty(false);
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
            newRecords[index] = record;
            return newRecords;
        });
        setIsDirty(true);
    }, []);

    const handleStatusChange = (index: number, status: 'paid' | 'unpaid' | 'pending') => {
        const newRecords = [...records];
        newRecords[index] = { ...newRecords[index], paymentStatus: status };
        setRecords(newRecords);
        setIsDirty(true);
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            await accommodationService.saveUtilityRecords(records);
            setIsDirty(false);

            // Reload to get real IDs for new records
            await loadLedger();
            alert("저장되었습니다.");
        } catch (error) {
            console.error(error);
            alert("저장 실패");
        } finally {
            setSaving(false);
        }
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

        return targets.sort((a, b) => {
            const startDiff = String(a.startDate ?? '').localeCompare(String(b.startDate ?? ''));
            if (startDiff !== 0) return startDiff;
            return String(a.id ?? '').localeCompare(String(b.id ?? ''));
        });
    };

    const resolveBillingTarget = (canonicalAccommodationId: string, canonicalAccommodationName: string): AccommodationBillingTarget | undefined => {
        if (monthRange) {
            const targetRanges = getBillingTargetsForAccommodation(canonicalAccommodationId, canonicalAccommodationName)
                .map((target) => ({
                    target,
                    startDate: parseBillingTargetDate(target.startDate),
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

            const start = assignment.startDate ? new Date(assignment.startDate) : null;
            const end = assignment.endDate ? new Date(assignment.endDate) : null;
            const hasValidStart = Boolean(start && !Number.isNaN(start.getTime()));
            const hasValidEnd = Boolean(end && !Number.isNaN(end.getTime()));

            if (hasValidStart && (start as Date) > monthRange.monthEnd) return false;
            if (hasValidEnd && (end as Date) < monthRange.monthStart) return false;
            return true;
        });

        const isActiveAssignment = (assignment: AccommodationAssignment): boolean => {
            if ((assignment.status ?? 'active') === 'ended') return false;
            if (!assignment.endDate) return true;
            const endDate = new Date(assignment.endDate);
            if (Number.isNaN(endDate.getTime())) return true;
            return endDate >= monthRange.monthStart;
        };

        const activeCandidates = candidates.filter(isActiveAssignment);
        const displayCandidates = activeCandidates.length > 0 ? activeCandidates : candidates;
        if (displayCandidates.length === 0) return null;

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
        const sourceUtilityRecordId = normalizeKey(lineItem.sourceUtilityRecordId);
        const sourceAccommodationId = normalizeKey(lineItem.sourceAccommodationId);
        if (sourceUtilityRecordId && sourceUtilityRecordId === normalizeKey(record.id)) return true;
        if (sourceAccommodationId && sourceAccommodationId === accommodationId) return true;

        const label = normalizeKey(lineItem.label);
        return Boolean(accommodationName && label.includes(accommodationName));
    };

    const getTargetDocumentsForRecord = (
        record: UtilityRecord,
        identity: AccommodationBillingIdentity | null = resolveAccommodationBillingIdentity(record)
    ): AccommodationBillingDocument[] => {
        return billingDocuments.filter((document) => matchesAccommodationTargetDocument(document, record, identity));
    };

    const getLineItemDocumentsForRecord = (record: UtilityRecord): AccommodationBillingDocument[] => {
        return billingDocuments.filter((document) =>
            normalizeKey(document.yearMonth) === normalizeKey(yearMonth) &&
            (document.lineItems ?? []).some((lineItem) => matchesAccommodationRecordLineItem(lineItem, record))
        );
    };

    const getRowBillingState = (record: UtilityRecord): {
        status: BillingRowStatus;
        documents: AccommodationBillingDocument[];
        reason?: string;
    } => {
        const identity = resolveAccommodationBillingIdentity(record);
        if (!identity) return { status: 'blocked', documents: [], reason: '청구대상 없음' };
        if ((record.costs.total ?? 0) <= 0) return { status: 'blocked', documents: [], reason: '금액 없음' };

        const lineItemDocuments = getLineItemDocumentsForRecord(record);
        if (lineItemDocuments.length === 0) {
            return { status: 'unbilled', documents: [] };
        }

        return { status: 'billed', documents: lineItemDocuments };
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

    const billingRows = useMemo(() => {
        return records
            .map((record, index) => ({ record, index, billingState: getRowBillingState(record) }))
            .filter(({ billingState }) => {
                if (billingFilter === 'all') return true;
                if (billingFilter === 'unbilled') return billingState.status === 'unbilled' || billingState.status === 'blocked';
                return billingState.status === billingFilter;
            })
            .sort(compareBillingRowsByTarget);
    }, [records, billingDocuments, billingFilter, billingTargets, assignments, teams, workers, accommodations, yearMonth]);

    const bulkBillableCount = useMemo(
        () => billingRows.filter(({ billingState }) => billingState.status === 'unbilled').length,
        [billingRows]
    );

    const bulkUnbillableCount = useMemo(
        () => billingRows.filter(({ billingState }) => billingState.status === 'billed').length,
        [billingRows]
    );

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
                startDate: parseBillingTargetDate(target.startDate),
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

            const shares = allocateAmountByDays(amount, ranges.map((range) => range.overlapDays));
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

    const removeRecordLineItemsFromDocument = (
        document: AccommodationBillingDocument,
        record: UtilityRecord
    ): AccommodationBillingDocument | null => {
        const preserved = (document.lineItems ?? []).filter((lineItem) =>
            !matchesAccommodationRecordLineItem(lineItem, record)
        );
        if (preserved.length === 0) return null;
        return {
            ...document,
            status: 'draft',
            lineItems: preserved
        };
    };

    const buildDocumentForRecord = (
        record: UtilityRecord,
        lineItems: AccommodationBillingLineItem[],
        existing?: AccommodationBillingDocument,
        identity: AccommodationBillingIdentity | null = resolveAccommodationBillingIdentity(record)
    ): AccommodationBillingDocument | null => {
        if (!identity) return null;
        const documentId = existing?.id ?? accommodationBillingService.buildBillingDocumentId({
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
            status: existing?.status ?? 'draft',
            memo: existing?.memo ?? '',
            lineItems: [...preservedLineItems, ...lineItems],
            confirmedAt: existing?.confirmedAt,
            postedAdvancePaymentId: existing?.postedAdvancePaymentId
        };
    };

    const handleCreateOrRecalculateBilling = async (record: UtilityRecord, mode: 'create' | 'recalculate') => {
        const state = getRowBillingState(record);
        if (isDirty) {
            alert('청구 전 변경사항을 먼저 전체 저장해주세요.');
            return;
        }
        if (state.status === 'blocked') {
            alert(state.reason || '청구할 수 없는 행입니다.');
            return;
        }

        const identity = resolveAccommodationBillingIdentity(record);
        const targetDocument = getTargetDocumentsForRecord(record, identity)[0];

        setBillingProcessingId(record.id);
        try {
            await accommodationService.saveUtilityRecord(record);
            const lineItems = buildLineItemsForRecord(record);
            if (lineItems.length === 0) {
                alert('청구할 금액 항목이 없습니다.');
                return;
            }

            const next = buildDocumentForRecord(record, lineItems, targetDocument, identity);
            if (!next) {
                alert('청구대상을 확인할 수 없습니다.');
                return;
            }

            const staleDocuments = getLineItemDocumentsForRecord(record).filter((document) => document.id !== next.id);
            for (const document of staleDocuments) {
                const cleaned = removeRecordLineItemsFromDocument(document, record);
                if (cleaned) {
                    await accommodationBillingService.upsertBillingDocument(cleaned);
                } else {
                    await accommodationBillingService.deleteBillingDocument(document.id);
                }
            }

            await accommodationBillingService.upsertBillingDocument(next);
            await loadLedger();
            alert(mode === 'recalculate' ? '청구가 다시 처리되었습니다.' : '청구 처리되었습니다.');
        } catch (error) {
            console.error(error);
            alert('청구 처리에 실패했습니다.');
        } finally {
            setBillingProcessingId('');
        }
    };

    const handleCreateSplitBilling = async (record: UtilityRecord) => {
        if (isDirty) {
            alert('청구 전 변경사항을 먼저 전체 저장해주세요.');
            return;
        }

        const ranges = getSplitBillingRangesForRecord(record);
        if (ranges.length <= 1) {
            alert('분할청구할 기간이 없습니다.');
            return;
        }
        if ((record.costs.total ?? 0) <= 0) {
            alert('청구할 금액 항목이 없습니다.');
            return;
        }

        setBillingProcessingId(record.id);
        try {
            await accommodationService.saveUtilityRecord(record);
            const lineItemGroups = buildSplitLineItemGroupsForRecord(record, ranges);
            const documentGroups = new Map<string, {
                identity: AccommodationBillingIdentity;
                lineItems: AccommodationBillingLineItem[];
            }>();

            lineItemGroups.forEach((group) => {
                const identity = resolveAccommodationBillingIdentityForTarget(record, group.range.target);
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
            documentGroups.forEach((group) => {
                const existing = getTargetDocumentsForRecord(record, group.identity)[0];
                const next = buildDocumentForRecord(record, group.lineItems, existing, group.identity);
                if (next) nextDocuments.push(next);
            });

            if (nextDocuments.length === 0) {
                alert('청구대상을 확인할 수 없습니다.');
                return;
            }

            const keepDocumentIds = new Set(nextDocuments.map((document) => document.id));
            const staleDocuments = getLineItemDocumentsForRecord(record).filter((document) => !keepDocumentIds.has(document.id));
            for (const document of staleDocuments) {
                const cleaned = removeRecordLineItemsFromDocument(document, record);
                if (cleaned) {
                    await accommodationBillingService.upsertBillingDocument(cleaned);
                } else {
                    await accommodationBillingService.deleteBillingDocument(document.id);
                }
            }

            await Promise.all(nextDocuments.map((document) => accommodationBillingService.upsertBillingDocument(document)));
            await loadLedger();
            alert(`분할청구 처리되었습니다. (${nextDocuments.length}건)`);
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

            await accommodationBillingService.upsertBillingDocument(next);
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

    const handleCancelBilling = async (record: UtilityRecord, document?: AccommodationBillingDocument) => {
        const documents = document ? [document] : getRowBillingState(record).documents;
        if (documents.length === 0) return;
        if (!window.confirm('청구 상태를 미청구로 변경할까요?')) return;

        setBillingProcessingId(record.id);
        try {
            for (const item of documents) {
                const preserved = (item.lineItems ?? []).filter((lineItem) =>
                    !matchesAccommodationRecordLineItem(lineItem, record)
                );

                if (preserved.length > 0) {
                    await accommodationBillingService.upsertBillingDocument({
                        ...item,
                        status: 'draft',
                        lineItems: preserved
                    });
                } else {
                    await accommodationBillingService.deleteBillingDocument(item.id);
                }
            }

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
            alert('청구 전 변경사항을 먼저 전체 저장해주세요.');
            return;
        }

        const targets = billingRows.filter(({ billingState }) => (
            action === 'bill'
                ? billingState.status === 'unbilled'
                : billingState.status === 'billed'
        ));

        if (targets.length === 0) {
            alert(action === 'bill' ? '일괄 청구할 행이 없습니다.' : '일괄 미청구 처리할 행이 없습니다.');
            return;
        }

        const actionLabel = action === 'bill' ? '청구' : '미청구';
        if (!window.confirm(`현재 필터 목록의 ${targets.length}건을 일괄 ${actionLabel} 처리합니다.\n저장하지 않은 셀 변경사항은 반영되지 않습니다.\n계속할까요?`)) return;

        setBulkBillingAction(action);
        setBillingProcessingId('__bulk__');
        let processed = 0;
        let skipped = 0;
        const workingDocuments = new Map(billingDocuments.map((document) => [document.id, document]));

        try {
            for (const { record, billingState } of targets) {
                try {
                    if (action === 'bill') {
                        await accommodationService.saveUtilityRecord(record);
                        const lineItems = buildLineItemsForRecord(record);
                        const identity = resolveAccommodationBillingIdentity(record);
                        const targetDocument = Array.from(workingDocuments.values())
                            .find((document) => matchesAccommodationTargetDocument(document, record, identity));
                        const next = buildDocumentForRecord(record, lineItems, targetDocument, identity);
                        if (!next || lineItems.length === 0) {
                            skipped += 1;
                            continue;
                        }
                        const staleDocuments = Array.from(workingDocuments.values()).filter((document) => (
                            document.id !== next.id &&
                            normalizeKey(document.yearMonth) === normalizeKey(yearMonth) &&
                            (document.lineItems ?? []).some((lineItem) => matchesAccommodationRecordLineItem(lineItem, record))
                        ));
                        for (const document of staleDocuments) {
                            const cleaned = removeRecordLineItemsFromDocument(document, record);
                            if (cleaned) {
                                await accommodationBillingService.upsertBillingDocument(cleaned);
                                workingDocuments.set(cleaned.id, cleaned);
                            } else {
                                await accommodationBillingService.deleteBillingDocument(document.id);
                                workingDocuments.delete(document.id);
                            }
                        }
                        await accommodationBillingService.upsertBillingDocument(next);
                        workingDocuments.set(next.id, next);
                    } else {
                        if (billingState.documents.length === 0) {
                            skipped += 1;
                            continue;
                        }
                        for (const item of billingState.documents) {
                            const current = workingDocuments.get(item.id);
                            if (!current) continue;

                            const preserved = (current.lineItems ?? []).filter((lineItem) =>
                                !matchesAccommodationRecordLineItem(lineItem, record)
                            );

                            if (preserved.length > 0) {
                                const next: AccommodationBillingDocument = {
                                    ...current,
                                    status: 'draft',
                                    lineItems: preserved
                                };
                                await accommodationBillingService.upsertBillingDocument(next);
                                workingDocuments.set(next.id, next);
                            } else {
                                await accommodationBillingService.deleteBillingDocument(current.id);
                                workingDocuments.delete(current.id);
                            }
                        }
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
                    <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
                        <span className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 rounded-md border border-emerald-100 text-emerald-700">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full"></div> 고정(Fixed)
                        </span>
                        <span className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 rounded-md border border-slate-100 text-slate-500">
                            <div className="w-2 h-2 bg-slate-300 rounded-full"></div> 포함(Included)
                        </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1 rounded-xl bg-slate-100 p-1">
                        {BILLING_FILTERS.map((filter) => (
                            <button
                                key={filter.value}
                                type="button"
                                onClick={() => setBillingFilter(filter.value)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition ${
                                    billingFilter === filter.value
                                        ? 'bg-white text-indigo-700 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                {filter.label}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => handleBulkBilling('bill')}
                            disabled={isDirty || bulkBillingAction !== '' || bulkBillableCount === 0}
                            title="현재 필터 목록의 미청구 행을 청구 처리"
                            className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-extrabold shadow-sm hover:bg-indigo-700 disabled:bg-indigo-200 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                            {bulkBillingAction === 'bill' ? '처리중...' : `일괄 청구 (${bulkBillableCount})`}
                        </button>
                        <button
                            type="button"
                            onClick={() => handleBulkBilling('unbill')}
                            disabled={isDirty || bulkBillingAction !== '' || bulkUnbillableCount === 0}
                            title="현재 필터 목록의 청구 행을 미청구 처리"
                            className="px-4 py-2 rounded-xl bg-rose-50 text-rose-700 text-xs font-extrabold border border-rose-100 hover:bg-rose-100 disabled:bg-slate-50 disabled:text-slate-300 disabled:border-slate-100 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                            {bulkBillingAction === 'unbill' ? '처리중...' : `일괄 미청구 (${bulkUnbillableCount})`}
                        </button>
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
                        {saving ? '저장 중...' : isDirty ? '변경사항 저장' : '전체 저장'}
                    </button>
                </div>
                <div className="w-full text-xs font-medium text-slate-400">
                    변경한 셀은 <span className="font-bold text-slate-600">변경사항 저장</span> 후 청구할 수 있습니다. 일괄 작업은 현재 필터 목록에만 적용됩니다.
                </div>
            </div>

            {/* Grid */}
            <div className="bg-white border border-indigo-100 shadow-xl shadow-indigo-50/50 rounded-2xl overflow-hidden flex-1 flex flex-col">
                <div className={`custom-scrollbar ${isStickyHeader ? 'overflow-auto h-[calc(100vh-400px)] min-h-[400px] border-b border-indigo-100' : 'overflow-auto h-[calc(100vh-420px)] min-h-[460px]'}`}>
                    {loading ? (
                        <div className="h-96 flex flex-col items-center justify-center text-slate-400 gap-3">
                            <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                            <p>데이터를 불러오는 중입니다...</p>
                        </div>
                    ) : (
                        <table className="support-compact-table support-compact-ledger w-full table-fixed text-[11px] lg:text-xs">
                            <colgroup>
                                <col style={{ width: '8%' }} />
                                <col style={{ width: '6%' }} />
                                <col style={{ width: '8%' }} />
                                <col style={{ width: '8.5%' }} />
                                <col style={{ width: '4.1%' }} />
                                <col style={{ width: '4.1%' }} />
                                <col style={{ width: '4.1%' }} />
                                <col style={{ width: '4.1%' }} />
                                <col style={{ width: '4.1%' }} />
                                <col style={{ width: '4.1%' }} />
                                <col style={{ width: '4.1%' }} />
                                <col style={{ width: '5.3%' }} />
                                <col style={{ width: '6%' }} />
                                <col style={{ width: '7%' }} />
                                <col style={{ width: '8%' }} />
                                <col style={{ width: '8.5%' }} />
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
                                    <th className="px-2 py-4 text-center w-28 border-l border-indigo-500">청구상태</th>
                                    <th className="px-2 py-4 text-center w-44 border-l border-indigo-500">청구작업</th>
                                    <th className="px-2 py-4 text-center w-28 border-l border-indigo-500">상태</th>
                                    <th className="px-4 py-4 text-left border-l border-indigo-500">메모</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-indigo-50">
                                {billingRows.map(({ record: rec, index: idx, billingState }) => {
                                    const assignmentSummary = getAssignmentSummary(rec);
                                    const matchedAccommodation = resolveAccommodation({ id: rec.accommodationId, name: rec.accommodationName });
                                    const assignedWorkers = assignmentSummary?.assignedWorkers ?? [];
                                    const visibleAssignedWorkers = assignedWorkers.slice(0, 3);
                                    const billingBadge = getBillingStatusBadge(billingState.status);
                                    const isProcessing = billingProcessingId === rec.id || bulkBillingAction !== '';
                                    const canSplitBill = getSplitBillingRangesForRecord(rec).length > 1;

                                    return (
                                        <tr key={`${rec.accommodationId}-${idx}`} className="group hover:bg-blue-50/40 transition-colors">

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
                                                                    style={{ backgroundColor: team.color }}>
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
                                                                    style={{ backgroundColor: team.color }}
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
                                                <div className='flex items-center'>
                                                    <span>{rec.accommodationName}</span>
                                                    {matchedAccommodation?.contract?.isAutoTransfer && (
                                                        <span className="ml-2 px-1.5 py-0.5 rounded bg-indigo-100/80 text-indigo-700 text-[10px] font-extrabold border border-indigo-200 select-none cursor-help"
                                                            title="이 숙소는 공과금이 자동이체로 설정되어 있습니다.">
                                                            자동이체
                                                        </span>
                                                    )}
                                                    <div className="flex-1"></div>
                                                    {rec.paymentStatus === 'paid' && <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm" title="완납"></span>}
                                                    {rec.paymentStatus === 'unpaid' && <span className="w-2 h-2 rounded-full bg-rose-500 shadow-sm animate-pulse" title="미납"></span>}
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
                                            <td className="px-4 py-3 border-r border-indigo-50 bg-indigo-50/30 group-hover:bg-indigo-50/60 text-right font-extrabold text-indigo-700 font-mono text-base">
                                                {rec.costs.total.toLocaleString()}
                                            </td>

                                            <td className="px-2 py-3 border-l border-indigo-50 bg-white text-center">
                                                <span className={`inline-flex items-center justify-center min-w-[72px] rounded-lg border px-2 py-1 text-[11px] font-extrabold ${billingBadge.className}`}>
                                                    {billingBadge.label}
                                                </span>
                                                {billingState.documents.length > 1 && (
                                                    <div className="mt-1 text-[10px] font-bold text-slate-400">{billingState.documents.length}건</div>
                                                )}
                                            </td>

                                            <td className="px-2 py-3 border-l border-indigo-50 bg-white">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    {billingState.status === 'blocked' ? (
                                                        <>
                                                            <span className="text-[11px] font-bold text-slate-400">{billingState.reason}</span>
                                                            <button
                                                                type="button"
                                                                disabled={isProcessing}
                                                                onClick={() => handleOpenQuickAssignFromRecord(rec, true)}
                                                                className="px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-700 text-xs font-bold border border-amber-200 hover:bg-amber-100 disabled:text-amber-300 disabled:bg-amber-50 whitespace-nowrap"
                                                                title="분할청구 대상 기간 만들기"
                                                            >
                                                                분할청구
                                                            </button>
                                                        </>
                                                    ) : billingState.status === 'unbilled' ? (
                                                        <>
                                                            <button
                                                                type="button"
                                                                disabled={isProcessing}
                                                                onClick={() => handleCreateOrRecalculateBilling(rec, 'create')}
                                                                className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:bg-indigo-300 whitespace-nowrap"
                                                            >
                                                                {isProcessing ? '처리중' : '청구'}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                disabled={isProcessing}
                                                                onClick={() => canSplitBill ? handleCreateSplitBilling(rec) : handleOpenQuickAssignFromRecord(rec, true)}
                                                                className="px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-700 text-xs font-bold border border-amber-200 hover:bg-amber-100 disabled:text-amber-300 disabled:bg-amber-50 whitespace-nowrap"
                                                                title={canSplitBill ? '분할된 청구대상 기간으로 금액을 나누어 청구' : '분할청구 대상 기간 만들기'}
                                                            >
                                                                분할청구
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            disabled={isProcessing}
                                                            onClick={() => handleCancelBilling(rec)}
                                                            className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 text-xs font-bold hover:bg-rose-100 disabled:text-rose-300"
                                                            title="미청구"
                                                        >
                                                            미청구
                                                        </button>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Status */}
                                            <td className="p-1 border-r border-indigo-50 text-center">
                                                <select
                                                    value={rec.paymentStatus}
                                                    onChange={(e) => {
                                                        const v = e.target.value;
                                                        if (v === 'paid' || v === 'unpaid' || v === 'pending') {
                                                            handleStatusChange(idx, v);
                                                        }
                                                    }}
                                                    className={`text-xs font-bold rounded-lg px-2 py-1.5 border-0 cursor-pointer focus:ring-2 focus:ring-indigo-500 outline-none transition-colors w-full text-center
                                                    ${rec.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' :
                                                            rec.paymentStatus === 'pending' ? 'bg-orange-100 text-orange-700 hover:bg-orange-200' : 'bg-rose-100 text-rose-700 hover:bg-rose-200'}
                                                `}
                                                >
                                                    <option value="unpaid">미납</option>
                                                    <option value="pending">보류</option>
                                                    <option value="paid">완납</option>
                                                </select>
                                            </td>

                                            {/* Memo */}
                                            <td className="p-1">
                                                <input
                                                    type="text"
                                                    value={rec.memo || ''}
                                                    onChange={(e) => {
                                                        const newRecords = [...records];
                                                        newRecords[idx] = { ...newRecords[idx], memo: e.target.value };
                                                        setRecords(newRecords);
                                                        setIsDirty(true);
                                                    }}
                                                    className="w-full p-2 focus:outline-none focus:bg-indigo-50 focus:ring-1 focus:ring-indigo-200 rounded-lg text-xs text-slate-600 bg-transparent"
                                                    placeholder="메모를 입력하세요..."
                                                />
                                            </td>
                                        </tr>
                                    )
                                })}
                                {billingRows.length === 0 && (
                                    <tr>
                                        <td colSpan={17} className="p-20 text-center text-slate-400 bg-slate-50/50">
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
                                    <td colSpan={5} className="p-4 border-r border-slate-600 text-center">합계</td>
                                    <td className="p-4 border-r border-slate-600 text-right font-mono text-amber-300">{records.reduce((sum, r) => sum + (r.costs.rent || 0), 0).toLocaleString()}</td>
                                    <td className="p-4 border-r border-slate-600 text-right font-mono">{records.reduce((sum, r) => sum + (r.costs.electricity || 0), 0).toLocaleString()}</td>
                                    <td className="p-4 border-r border-slate-600 text-right font-mono">{records.reduce((sum, r) => sum + (r.costs.gas || 0), 0).toLocaleString()}</td>
                                    <td className="p-4 border-r border-slate-600 text-right font-mono">{records.reduce((sum, r) => sum + (r.costs.water || 0), 0).toLocaleString()}</td>
                                    <td className="p-4 border-r border-slate-600 text-right font-mono">{records.reduce((sum, r) => sum + (r.costs.internet || 0), 0).toLocaleString()}</td>
                                    <td className="p-4 border-r border-slate-600 text-right font-mono">{records.reduce((sum, r) => sum + (r.costs.maintenance || 0), 0).toLocaleString()}</td>
                                    <td className="p-4 border-r border-slate-600 text-right font-mono">{records.reduce((sum, r) => sum + (r.costs.other || 0), 0).toLocaleString()}</td>
                                    <td className="p-4 border-r border-slate-600 text-right font-mono text-indigo-300 text-lg">{records.reduce((sum, r) => sum + (r.costs.total || 0), 0).toLocaleString()}</td>
                                    <td colSpan={4} className="bg-slate-900 border-l border-slate-700"></td>
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
                        * 10만 원을 초과하는 공과금은 <strong className="text-rose-600">빨간색 굵은 글씨</strong>로 표시됩니다.<br />
                        * <strong>고정(Fixed)</strong> 항목은 자동으로 입력되지만, 필요 시 수정할 수 있습니다.<br />
                        * 같은 달에 청구대상이 나뉜 숙소는 <strong>[분할청구]</strong>로 금액을 기간별 일할 배분합니다.<br />
                        * 모든 변경사항은 <strong>[전체 저장]</strong> 버튼을 눌러야 반영됩니다.
                    </p>
                </div>
            </div>

            {quickAssignAccommodation && (
                <AccommodationQuickAssignmentModal
                    accommodation={quickAssignAccommodation}
                    activeAssignments={getActiveAssignmentsForAccommodation(quickAssignAccommodation)}
                    isOpen={!!quickAssignAccommodation}
                    initialBillingSplitMode={quickAssignSplitMode}
                    onClose={() => {
                        setQuickAssignAccommodation(null);
                        setQuickAssignSplitMode(false);
                    }}
                    onSuccess={async () => {
                        await loadLedger();
                        setQuickAssignAccommodation(null);
                        setQuickAssignSplitMode(false);
                    }}
                />
            )}

            {billingEditor && (
                <LedgerBillingEditorModal<AccommodationBillingLineItem>
                    title={`${billingEditor.record.accommodationName} 숙소 청구서`}
                    subtitle={`${billingEditor.document.yearMonth} · ${billingEditor.document.teamName || billingEditor.document.issuedToWorkerName || '청구대상'}`}
                    statusLabel={billingEditor.document.status === 'confirmed' ? '확정' : '작성중'}
                    readOnly={billingEditor.document.status === 'confirmed'}
                    lineItems={billingEditor.lineItems}
                    memo={billingEditor.document.memo ?? ''}
                    saving={billingProcessingId === billingEditor.record.id}
                    onClose={() => setBillingEditor(null)}
                    onSave={(lineItems, memo) => handleSaveBillingEditor(lineItems, memo)}
                    onConfirm={(lineItems, memo) => handleSaveBillingEditor(lineItems, memo, 'confirmed')}
                />
            )}
        </div>
    );
};

export default UtilityLedger;
