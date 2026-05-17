import React, { useState, useEffect, useCallback, useRef, memo, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSave, faChevronLeft, faChevronRight, faExclamationTriangle, faFileInvoiceDollar, faUsers, faUser, faPen, faRotateRight, faEye, faBan } from '@fortawesome/free-solid-svg-icons';
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

type BillingFilter = 'all' | 'unbilled' | 'draft' | 'confirmed' | 'blocked';
type BillingRowStatus = 'unbilled' | 'draft' | 'confirmed' | 'partial' | 'blocked';

const BILLING_FILTERS: Array<{ value: BillingFilter; label: string }> = [
    { value: 'all', label: '전체' },
    { value: 'unbilled', label: '미청구' },
    { value: 'draft', label: '작성중' },
    { value: 'confirmed', label: '확정' },
    { value: 'blocked', label: '청구불가' }
];

const getBillingStatusBadge = (status: BillingRowStatus) => {
    switch (status) {
        case 'confirmed':
            return { label: '확정', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
        case 'draft':
            return { label: '작성중', className: 'bg-amber-50 text-amber-700 border-amber-200' };
        case 'partial':
            return { label: '일부청구', className: 'bg-sky-50 text-sky-700 border-sky-200' };
        case 'blocked':
            return { label: '청구불가', className: 'bg-slate-100 text-slate-500 border-slate-200' };
        default:
            return { label: '미청구', className: 'bg-rose-50 text-rose-700 border-rose-200' };
    }
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

    const handleOpenQuickAssignFromRecord = useCallback((record: UtilityRecord) => {
        const accommodation = resolveAccommodation({ id: record.accommodationId, name: record.accommodationName });
        if (!accommodation) return;
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

    type TeamBadge = { key: string; name: string; color: string; icon?: string | null };

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

    const resolveBillingTarget = (canonicalAccommodationId: string, canonicalAccommodationName: string): AccommodationBillingTarget | undefined => {
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
        const billingWorkerMap = new Map<string, string>();

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
                const workerName = normalizeKey(separatedBillingTarget.workerName);
                const workerId = normalizeKey(separatedBillingTarget.workerId);
                const workerLabel = workerName || (workerId ? `ID:${workerId.slice(0, 8)}` : '');
                const workerKey = workerId || workerLabel;
                if (workerLabel && workerKey) {
                    billingWorkerMap.set(workerKey, workerLabel);
                }
            } else {
                const targetTeamBadge = resolveTeamBadgeFromTarget(
                    separatedBillingTarget.teamId,
                    separatedBillingTarget.teamName
                );
                if (targetTeamBadge) billingTeamMap.set(targetTeamBadge.key, targetTeamBadge);
            }
        } else {
            // 분리 저장 도입 전(source 기반) 레거시 데이터 fallback
            displayCandidates.forEach((assignment) => {
                const teamBadge = resolveTeamBadge(assignment);
                const workerName = normalizeKey(assignment.workerName);
                const workerId = normalizeKey(assignment.workerId);
                const workerLabel = workerName || (workerId ? `ID:${workerId.slice(0, 8)}` : '');
                const workerKey = workerId || workerLabel;

                const hasTeamIdentity = normalizeKey(assignment.teamId).length > 0 || normalizeKey(assignment.teamName).length > 0;
                const isWorkerBillingTarget = assignment.source === 'worker' || (!assignment.source && !hasTeamIdentity);
                if (isWorkerBillingTarget) {
                    if (workerLabel && workerKey) billingWorkerMap.set(workerKey, workerLabel);
                    return;
                }

                if (teamBadge && !billingTeamMap.has(teamBadge.key)) {
                    billingTeamMap.set(teamBadge.key, teamBadge);
                }
            });

            if (billingTeamMap.size === 0 && billingWorkerMap.size === 0 && assignedTeamMap.size > 0) {
                assignedTeamMap.forEach((badge) => billingTeamMap.set(badge.key, badge));
            }
        }

        const assignedTeams = Array.from(assignedTeamMap.values());
        const assignedWorkers = Array.from(assignedWorkerMap.values());
        const billingTeams = Array.from(billingTeamMap.values());
        const billingWorkers = Array.from(billingWorkerMap.values());

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

    const resolveAccommodationBillingIdentity = (record: UtilityRecord): {
        issuedToType: AccommodationBillingDocument['issuedToType'];
        teamId: string;
        teamName: string;
        workerId: string;
        workerName: string;
        teamIds: Set<string>;
        teamNames: Set<string>;
        workerIds: Set<string>;
        workerNames: Set<string>;
    } | null => {
        const { accommodationId, accommodationName } = getCanonicalAccommodationForRecord(record);
        const target = resolveBillingTarget(accommodationId, accommodationName);
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

        if (target?.targetType === 'worker') {
            const worker = resolveWorkerIdentity(target.workerId, target.workerName);
            const team = resolveTeamIdentity(worker.teamId || fallbackTeam.teamId, worker.teamName || fallbackTeam.teamName);
            if (!worker.workerId || (!team.teamId && !team.teamName)) return null;
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

        const workerBillingAssignment = activeAssignments.find((assignment) => {
            const hasTeamIdentity = normalizeKey(assignment.teamId).length > 0 || normalizeKey(assignment.teamName).length > 0;
            return assignment.source === 'worker' || (!assignment.source && !hasTeamIdentity);
        });

        if (workerBillingAssignment) {
            const worker = resolveWorkerIdentity(workerBillingAssignment.workerId, workerBillingAssignment.workerName);
            const fallback = resolveAssignmentTeamIdentity(workerBillingAssignment);
            const team = resolveTeamIdentity(worker.teamId || fallback.teamId, worker.teamName || fallback.teamName);
            if (worker.workerId && (team.teamId || team.teamName)) {
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

    const matchesAccommodationTargetDocument = (document: AccommodationBillingDocument, record: UtilityRecord): boolean => {
        const identity = resolveAccommodationBillingIdentity(record);
        if (!identity) return false;
        if (normalizeKey(document.yearMonth) !== normalizeKey(yearMonth)) return false;
        if (normalizeKey(document.issuedToType) !== normalizeKey(identity.issuedToType)) return false;

        const docTeamIds = toKeySet([document.teamId]);
        const docTeamNames = toKeySet([document.teamName]);
        const teamMatches = intersects(identity.teamIds, docTeamIds) || intersects(identity.teamNames, docTeamNames);
        if (!teamMatches) return false;

        if (identity.issuedToType === 'worker') {
            const docWorkerIds = toKeySet([document.issuedToWorkerId]);
            const docWorkerNames = toKeySet([document.issuedToWorkerName]);
            return intersects(identity.workerIds, docWorkerIds) || intersects(identity.workerNames, docWorkerNames);
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

    const getTargetDocumentsForRecord = (record: UtilityRecord): AccommodationBillingDocument[] => {
        return billingDocuments.filter((document) => matchesAccommodationTargetDocument(document, record));
    };

    const getLineItemDocumentsForRecord = (record: UtilityRecord): AccommodationBillingDocument[] => {
        return getTargetDocumentsForRecord(record).filter((document) =>
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

        const targetDocuments = getTargetDocumentsForRecord(record);
        const lineItemDocuments = getLineItemDocumentsForRecord(record);
        if (lineItemDocuments.length === 0) {
            if (targetDocuments.some((document) => document.status === 'confirmed')) {
                return { status: 'blocked', documents: targetDocuments, reason: '대상 확정됨' };
            }
            return { status: 'unbilled', documents: [] };
        }

        const confirmedCount = lineItemDocuments.filter((document) => document.status === 'confirmed').length;
        if (confirmedCount === lineItemDocuments.length) return { status: 'confirmed', documents: lineItemDocuments };
        if (confirmedCount > 0) return { status: 'partial', documents: lineItemDocuments };
        return { status: 'draft', documents: lineItemDocuments };
    };

    const billingRows = useMemo(() => {
        return records
            .map((record, index) => ({ record, index, billingState: getRowBillingState(record) }))
            .filter(({ billingState }) => {
                if (billingFilter === 'all') return true;
                if (billingFilter === 'draft') return billingState.status === 'draft' || billingState.status === 'partial';
                return billingState.status === billingFilter;
            });
    }, [records, billingDocuments, billingFilter, billingTargets, assignments, teams, workers, yearMonth]);

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

    const buildDocumentForRecord = (
        record: UtilityRecord,
        lineItems: AccommodationBillingLineItem[],
        existing?: AccommodationBillingDocument
    ): AccommodationBillingDocument | null => {
        const identity = resolveAccommodationBillingIdentity(record);
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

        const targetDocument = state.documents[0] ?? getTargetDocumentsForRecord(record)[0];
        if (targetDocument?.status === 'confirmed') {
            alert('확정된 청구서는 대장에서 재계산할 수 없습니다.');
            return;
        }

        setBillingProcessingId(record.id);
        try {
            await accommodationService.saveUtilityRecord(record);
            const lineItems = buildLineItemsForRecord(record);
            if (lineItems.length === 0) {
                alert('청구할 금액 항목이 없습니다.');
                return;
            }

            const next = buildDocumentForRecord(record, lineItems, targetDocument);
            if (!next) {
                alert('청구대상을 확인할 수 없습니다.');
                return;
            }

            await accommodationBillingService.upsertBillingDocument(next);
            await loadLedger();
            alert(mode === 'recalculate' ? '청구서가 재계산되었습니다.' : '청구서가 생성되었습니다.');
        } catch (error) {
            console.error(error);
            alert('청구 처리에 실패했습니다.');
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
        if (!document) return;
        if (document.status === 'confirmed') {
            alert('확정된 청구서는 취소할 수 없습니다.');
            return;
        }
        if (!window.confirm('작성중 청구서를 취소할까요?')) return;

        setBillingProcessingId(record.id);
        try {
            const preserved = (document.lineItems ?? []).filter((lineItem) =>
                !matchesAccommodationRecordLineItem(lineItem, record)
            );

            if (preserved.length > 0) {
                await accommodationBillingService.upsertBillingDocument({
                    ...document,
                    status: 'draft',
                    lineItems: preserved
                });
            } else {
                await accommodationBillingService.deleteBillingDocument(document.id);
            }

            await loadLedger();
            alert('청구가 취소되었습니다.');
        } catch (error) {
            console.error(error);
            alert('청구 취소에 실패했습니다.');
        } finally {
            setBillingProcessingId('');
        }
    };

    return (
        <div className="flex flex-col h-full space-y-5 min-w-0">
            {/* Toolbar */}
            <div className="flex flex-col 2xl:flex-row 2xl:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-indigo-100 shadow-sm">
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
                        {saving ? '저장 중...' : '전체 저장'}
                    </button>
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
                                <col style={{ width: '6%' }} />
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
                                <col style={{ width: '5.5%' }} />
                                <col style={{ width: '11%' }} />
                            </colgroup>
                            <thead className={`bg-indigo-600 text-white font-bold text-xs uppercase shadow-md ${isStickyHeader ? 'sticky top-0 z-20' : ''}`}>
                                <tr>
                                    <th className="px-4 py-4 text-left w-52 tracking-wider bg-indigo-700 border-r border-indigo-500">배정팀</th>
                                    <th className="px-4 py-4 text-left w-40 tracking-wider bg-indigo-700 border-r border-indigo-500">배정 인원</th>
                                    <th className="px-4 py-4 text-left w-52 tracking-wider bg-indigo-700 border-r border-indigo-500">청구대상 팀</th>
                                    <th className="px-4 py-4 text-left w-52 tracking-wider bg-indigo-700 border-r border-indigo-500">청구대상 개인</th>
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
                                    const firstBillingDocument = billingState.documents.find((document) => document.status !== 'confirmed') ?? billingState.documents[0];
                                    const isProcessing = billingProcessingId === rec.id;

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

                                            <td className="px-4 py-3 border-r border-indigo-50 bg-white">
                                                {assignmentSummary && assignmentSummary.billingWorkers.length > 0 ? (
                                                    <div className="flex flex-col gap-1.5">
                                                        {assignmentSummary.billingWorkers.map((workerName, workerIdx) => (
                                                            <div key={`billing-worker-${workerName}-${workerIdx}`} className="flex items-center gap-2 min-w-0">
                                                                <span className="w-6 h-6 rounded-md flex items-center justify-center text-white text-[10px] shrink-0 bg-slate-500">
                                                                    <FontAwesomeIcon icon={faUser} />
                                                                </span>
                                                                <span className="font-bold text-slate-700 text-xs leading-tight break-all">
                                                                    {workerName}
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
                                                        <span className="text-[11px] font-bold text-slate-400">{billingState.reason}</span>
                                                    ) : billingState.status === 'unbilled' ? (
                                                        <button
                                                            type="button"
                                                            disabled={isProcessing}
                                                            onClick={() => handleCreateOrRecalculateBilling(rec, 'create')}
                                                            className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:bg-indigo-300"
                                                        >
                                                            {isProcessing ? '처리중' : '청구'}
                                                        </button>
                                                    ) : (
                                                        <>
                                                            <button
                                                                type="button"
                                                                disabled={!firstBillingDocument}
                                                                onClick={() => firstBillingDocument && openBillingEditor(rec, firstBillingDocument)}
                                                                className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:text-slate-300"
                                                                title={firstBillingDocument?.status === 'confirmed' ? '청구서 보기' : '청구서 수정'}
                                                            >
                                                                <FontAwesomeIcon icon={firstBillingDocument?.status === 'confirmed' ? faEye : faPen} />
                                                            </button>
                                                            {firstBillingDocument?.status !== 'confirmed' && (
                                                                <>
                                                                <button
                                                                    type="button"
                                                                    disabled={isProcessing}
                                                                    onClick={() => handleCreateOrRecalculateBilling(rec, 'recalculate')}
                                                                    className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:text-amber-300"
                                                                    title="대장 기준 재계산"
                                                                >
                                                                    <FontAwesomeIcon icon={faRotateRight} />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    disabled={isProcessing}
                                                                    onClick={() => handleCancelBilling(rec, firstBillingDocument)}
                                                                    className="w-8 h-8 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:text-rose-300"
                                                                    title="청구 취소"
                                                                >
                                                                    <FontAwesomeIcon icon={faBan} />
                                                                </button>
                                                                </>
                                                            )}
                                                        </>
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
                        * 모든 변경사항은 <strong>[전체 저장]</strong> 버튼을 눌러야 반영됩니다.
                    </p>
                </div>
            </div>

            {quickAssignAccommodation && (
                <AccommodationQuickAssignmentModal
                    accommodation={quickAssignAccommodation}
                    activeAssignments={getActiveAssignmentsForAccommodation(quickAssignAccommodation)}
                    isOpen={!!quickAssignAccommodation}
                    onClose={() => setQuickAssignAccommodation(null)}
                    onSuccess={async () => {
                        await loadLedger();
                        setQuickAssignAccommodation(null);
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
