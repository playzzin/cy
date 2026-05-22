import React, { useEffect, useMemo, useState, useCallback, useRef, memo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBuilding, faCar, faChevronLeft, faChevronRight, faFileInvoiceDollar, faSave, faExclamationTriangle, faUsers, faUser } from '@fortawesome/free-solid-svg-icons';
import { vehicleService } from '../../services/vehicleService';
import { vehicleBillingService } from '../../services/vehicleBillingService';
import { Vehicle, VehicleAssigneeType, VehicleAssignmentRecord, VehicleBillingTargetRecord, VehicleBillingTargetType, VehicleExpenseRecord, VehicleExpenseType, VehicleFineChargeTarget } from '../../types/vehicle';
import { VehicleBillingCostItem, VehicleBillingDocument } from '../../types/vehicleBilling';
import { Team } from '../../services/teamService';
import { Worker, manpowerService } from '../../services/manpowerService';
import { OfficeStaff, officeStaffService } from '../../services/officeStaffService';
import { iconMap } from '../../constants/iconMap';
import { Timestamp } from 'firebase/firestore';
import LedgerBillingEditorModal from '../support/LedgerBillingEditorModal';
import { OFFICE_ASSIGNMENT_TEAM_ID, OFFICE_ASSIGNMENT_TEAM_NAME, isOfficeStaffAssignmentReference } from '../../utils/supportAssignmentTargets';

// ── 독립 EditableCell 컴포넌트 ──
interface EditableCellProps {
    value: number;
    onCommit: (numValue: number) => void;
    className?: string;
    placeholder?: string;
    tdClassName?: string;
}

const EditableCell = memo<EditableCellProps>(({ value, onCommit, className, placeholder = '0', tdClassName }) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const isFocusedRef = useRef(false);

    useEffect(() => {
        const el = inputRef.current;
        if (el && !isFocusedRef.current) {
            el.value = value === 0 ? '' : value.toLocaleString();
        }
    }, [value]);

    const handleFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
        isFocusedRef.current = true;
        e.target.value = value === 0 ? '' : String(value);
        e.target.select();
    }, [value]);

    const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
        isFocusedRef.current = false;
        const cleaned = e.target.value.replace(/[^0-9]/g, '');
        const numValue = parseInt(cleaned, 10) || 0;
        e.target.value = numValue === 0 ? '' : numValue.toLocaleString();
        onCommit(numValue);
    }, [onCommit]);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        const cleaned = raw.replace(/[^0-9]/g, '');
        if (raw !== cleaned) {
            const cursorPos = e.target.selectionStart || 0;
            const diff = raw.length - cleaned.length;
            e.target.value = cleaned;
            const newPos = Math.max(0, cursorPos - diff);
            e.target.setSelectionRange(newPos, newPos);
        }
    }, []);

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

// ── 카테고리 정의 ──
const EXPENSE_TYPES: VehicleExpenseType[] = ['FUEL', 'REPAIR', 'TOLL', 'FINE', 'OTHER'];
const EXPENSE_LABELS: Record<VehicleExpenseType, string> = {
    FUEL: '주유비',
    REPAIR: '수리비',
    TOLL: '통행료',
    FINE: '과태료',
    OTHER: '기타'
};

type ExpenseAmounts = Record<VehicleExpenseType, number>;

const emptyExpenseAmounts = (): ExpenseAmounts => ({
    FUEL: 0,
    REPAIR: 0,
    TOLL: 0,
    FINE: 0,
    OTHER: 0
});

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const parseYmdDate = (value?: string | null): Date | null => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? '').trim());
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
    return date;
};

const formatYmdDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const addDays = (date: Date, days: number): Date => {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
};

const inclusiveDays = (start: Date, end: Date): number => {
    if (end.getTime() < start.getTime()) return 0;
    return Math.floor((end.getTime() - start.getTime()) / ONE_DAY_MS) + 1;
};

const minDate = (...dates: Date[]): Date => dates.reduce((min, date) => date.getTime() < min.getTime() ? date : min);
const maxDate = (...dates: Date[]): Date => dates.reduce((max, date) => date.getTime() > max.getTime() ? date : max);
const OFFICE_TARGET_ID = '__office__';
const OFFICE_TARGET_NAME = '사무실';
const normalizeKey = (value: unknown): string => String(value ?? '').trim();

interface LedgerBadge {
    key: string;
    name: string;
    color: string;
    icon?: string | null;
    targetType?: VehicleBillingTargetType;
    targetLabel?: string;
    subLabel?: string;
}

interface VehicleLedgerSegment {
    id: string;
    sourceSegmentIds?: string[];
    assigneeId?: string;
    assigneeType?: VehicleAssigneeType;
    assigneeName?: string;
    teamId?: string;
    teamName?: string;
    billingTargetId?: string;
    billingTargetType?: VehicleBillingTargetType;
    billingTargetName?: string;
    billingTeamId?: string;
    billingTeamName?: string;
    startDate: string;
    endDate: string;
    overlapDays: number;
}

const getVehicleSegmentBillingKey = (segment: VehicleLedgerSegment): string => {
    const type = normalizeKey(segment.billingTargetType || segment.assigneeType || 'UNASSIGNED');
    const id = normalizeKey(segment.billingTargetId || segment.assigneeId || segment.billingTeamId || segment.teamId);
    const name = normalizeKey(segment.billingTargetName || segment.assigneeName || segment.billingTeamName || segment.teamName);
    return `${type}:${id || name}`;
};

const getVehicleSegmentSourceIds = (segment: VehicleLedgerSegment): string[] => {
    const ids = [segment.id, ...(segment.sourceSegmentIds ?? [])].map((value) => normalizeKey(value)).filter(Boolean);
    return Array.from(new Set(ids));
};

const mergeAdjacentVehicleSegments = (segments: VehicleLedgerSegment[]): VehicleLedgerSegment[] => {
    return segments.reduce<VehicleLedgerSegment[]>((merged, segment) => {
        const prev = merged[merged.length - 1];
        if (!prev || getVehicleSegmentBillingKey(prev) !== getVehicleSegmentBillingKey(segment)) {
            merged.push({
                ...segment,
                sourceSegmentIds: getVehicleSegmentSourceIds(segment)
            });
            return merged;
        }

        const prevEnd = parseYmdDate(prev.endDate);
        const nextStart = parseYmdDate(segment.startDate);
        const canMerge = prevEnd && nextStart && nextStart.getTime() <= addDays(prevEnd, 1).getTime();
        if (!canMerge) {
            merged.push({
                ...segment,
                sourceSegmentIds: getVehicleSegmentSourceIds(segment)
            });
            return merged;
        }

        const segmentEnd = parseYmdDate(segment.endDate);
        const prevEndTime = prevEnd?.getTime() ?? 0;
        prev.endDate = segmentEnd && segmentEnd.getTime() > prevEndTime ? segment.endDate : prev.endDate;
        prev.overlapDays += segment.overlapDays;
        prev.sourceSegmentIds = Array.from(new Set([
            ...getVehicleSegmentSourceIds(prev),
            ...getVehicleSegmentSourceIds(segment)
        ]));
        return merged;
    }, []);
};

const allocateFixedCostByDays = (fixedCost: number, segments: VehicleLedgerSegment[]): number[] => {
    if (fixedCost <= 0 || segments.length === 0) return segments.map(() => 0);
    const totalDays = segments.reduce((sum, segment) => sum + Math.max(0, segment.overlapDays), 0);
    if (totalDays <= 0) return segments.map(() => 0);

    let allocated = 0;
    return segments.map((segment, index) => {
        if (index === segments.length - 1) {
            return fixedCost - allocated;
        }
        const share = Math.round(fixedCost * (segment.overlapDays / totalDays));
        allocated += share;
        return share;
    });
};

interface VehicleLedgerRow {
    id: string;
    vehicle: Vehicle;
    segment: VehicleLedgerSegment;
    rentFee: number;
    leaseFee: number;
    amounts: ExpenseAmounts;
    fineChargeTarget: VehicleFineChargeTarget;
    variableTotal: number;
    total: number;
    note: string;
}

interface ResolvedVehicleBillingTarget {
    issuedToType: 'team' | 'worker';
    teamId: string;
    teamName: string;
    assignedTeamId: string;
    assignedTeamName: string;
    issuedToWorkerId?: string;
    issuedToWorkerName?: string;
}

const canChargeFineToDriver = (row: VehicleLedgerRow): boolean => (
    row.segment.assigneeType === 'WORKER' &&
    Boolean(normalizeKey(row.segment.assigneeId) || normalizeKey(row.segment.assigneeName))
);

const getVehicleBillingTargetSortInfo = (row: VehicleLedgerRow) => {
    const targetType = row.segment.billingTargetType || row.segment.assigneeType;
    const isPersonalTarget = targetType === 'WORKER' || targetType === 'OFFICE_STAFF';
    const targetName = normalizeKey(
        row.segment.billingTargetName ||
        (isPersonalTarget ? row.segment.assigneeName : '') ||
        row.segment.billingTeamName ||
        row.segment.teamName ||
        row.segment.assigneeName
    );

    return {
        group: isPersonalTarget ? 1 : targetType ? 0 : 2,
        name: targetName || 'ZZZ',
        startDate: normalizeKey(row.segment.startDate)
    };
};

const compareVehicleLedgerRowsByBillingTarget = (a: VehicleLedgerRow, b: VehicleLedgerRow): number => {
    const left = getVehicleBillingTargetSortInfo(a);
    const right = getVehicleBillingTargetSortInfo(b);

    if (left.group !== right.group) return left.group - right.group;

    const targetCmp = left.name.localeCompare(right.name, 'ko-KR', { numeric: true, sensitivity: 'base' });
    if (targetCmp !== 0) return targetCmp;

    const plateCmp = String(a.vehicle.licensePlate).localeCompare(String(b.vehicle.licensePlate), 'ko-KR', { numeric: true, sensitivity: 'base' });
    if (plateCmp !== 0) return plateCmp;

    return left.startDate.localeCompare(right.startDate);
};

interface VehicleMonthlyLedgerProps {
    vehicles: Vehicle[];
    teams?: Team[];
    teamFilterId?: string;
    loadingVehicles: boolean;
    onOpenSetup?: (vehicle: Vehicle) => void;
}

type BillingFilter = 'all' | 'billed' | 'unbilled';
type BillingRowStatus = 'unbilled' | 'billed' | 'blocked';

const sanitizeBillingIdPart = (value: unknown): string => {
    const text = String(value ?? '').trim();
    return ['/', '#', '[', ']', '?'].reduce((safe, char) => safe.split(char).join('_'), text || 'row');
};

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

export const VehicleMonthlyLedger: React.FC<VehicleMonthlyLedgerProps> = ({
    vehicles,
    teams = [],
    teamFilterId = '',
    loadingVehicles,
    onOpenSetup
}) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [yearMonth, setYearMonth] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [isStickyHeader, setIsStickyHeader] = useState(false); // Sticky header toggle

    const [rows, setRows] = useState<VehicleLedgerRow[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [officeStaffRows, setOfficeStaffRows] = useState<OfficeStaff[]>([]);
    const [billingDocuments, setBillingDocuments] = useState<VehicleBillingDocument[]>([]);
    const [billingTargets, setBillingTargets] = useState<VehicleBillingTargetRecord[]>([]);
    const [billingFilter, setBillingFilter] = useState<BillingFilter>('all');
    const [billingProcessingId, setBillingProcessingId] = useState('');
    const [bulkBillingAction, setBulkBillingAction] = useState<'bill' | 'unbill' | ''>('');
    const [billingEditor, setBillingEditor] = useState<{ row: VehicleLedgerRow; document: VehicleBillingDocument } | null>(null);
    const originalExpensesRef = useRef<VehicleExpenseRecord[]>([]);

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
            const name = normalizeKey(team.name);
            if (name && !map.has(name)) map.set(name, team);
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

    useEffect(() => {
        let mounted = true;
        Promise.all([
            manpowerService.getWorkers(),
            officeStaffService.getOfficeStaff().catch(() => [] as OfficeStaff[])
        ])
            .then(([data, officeStaffList]) => {
                if (!mounted) return;
                setWorkers(data);
                setOfficeStaffRows(officeStaffList);
            })
            .catch((error) => {
                console.error('Failed to load workers:', error);
            });
        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        const y = currentDate.getFullYear();
        const m = String(currentDate.getMonth() + 1).padStart(2, '0');
        setYearMonth(`${y}-${m}`);
    }, [currentDate]);

    const monthRange = useMemo(() => {
        const [y, m] = yearMonth.split('-').map(Number);
        if (!Number.isFinite(y) || !Number.isFinite(m)) return null;
        return {
            monthStart: new Date(y, m - 1, 1),
            monthEnd: new Date(y, m, 0),
            daysInMonth: new Date(y, m, 0).getDate()
        };
    }, [yearMonth]);

    const resolveAssigneeTeam = useCallback((assignment: Pick<VehicleAssignmentRecord, 'assigneeId' | 'assigneeName' | 'assigneeType'>) => {
        if (assignment.assigneeType === 'TEAM') {
            const team = assignment.assigneeId
                ? teamByAnyId.get(String(assignment.assigneeId))
                : teamByName.get(normalizeKey(assignment.assigneeName));
            return {
                teamId: normalizeKey(team?.id ?? assignment.assigneeId),
                teamName: normalizeKey(team?.name ?? assignment.assigneeName)
            };
        }

        const worker = assignment.assigneeId
            ? workerByAnyId.get(String(assignment.assigneeId))
            : workerByName.get(normalizeKey(assignment.assigneeName));
        if (!worker && isOfficeStaffAssignmentReference(officeStaffRows, assignment.assigneeId, assignment.assigneeName)) {
            return {
                teamId: OFFICE_ASSIGNMENT_TEAM_ID,
                teamName: OFFICE_ASSIGNMENT_TEAM_NAME
            };
        }
        return {
            teamId: normalizeKey(worker?.teamId),
            teamName: normalizeKey(worker?.teamName)
        };
    }, [teamByAnyId, teamByName, workerByAnyId, workerByName, officeStaffRows]);

    const buildSegmentsForVehicle = useCallback((
        vehicle: Vehicle,
        assignmentList: VehicleAssignmentRecord[],
        billingTargetList: VehicleBillingTargetRecord[]
    ): VehicleLedgerSegment[] => {
        if (!monthRange) return [];

        const vehicleId = normalizeKey(vehicle.id);
        const activeAssignments = assignmentList
            .filter((assignment) => normalizeKey(assignment.vehicleId) === vehicleId)
            .map((assignment) => ({
                assignment,
                startDate: parseYmdDate(assignment.startDate),
                endDate: parseYmdDate(assignment.endDate)
            }))
            .filter((entry) => {
                if (!entry.startDate) return false;
                if (entry.startDate.getTime() > monthRange.monthEnd.getTime()) return false;
                if (entry.endDate && entry.endDate.getTime() < monthRange.monthStart.getTime()) return false;
                return true;
            })
            .sort((a, b) => {
                const startDiff = (a.startDate?.getTime() ?? 0) - (b.startDate?.getTime() ?? 0);
                if (startDiff !== 0) return startDiff;
                return String(a.assignment.id ?? '').localeCompare(String(b.assignment.id ?? ''));
            });

        const findAssignmentForRange = (segmentStart: Date, segmentEnd: Date) => {
            const overlapping = activeAssignments.filter((entry) => {
                if (!entry.startDate) return false;
                const assignmentEnd = entry.endDate ?? monthRange.monthEnd;
                return entry.startDate.getTime() <= segmentEnd.getTime() && assignmentEnd.getTime() >= segmentStart.getTime();
            });
            if (overlapping.length > 0) return overlapping[overlapping.length - 1];
            if (vehicle.currentAssigneeId && vehicle.currentAssigneeType && vehicle.currentAssigneeName) {
                return {
                    assignment: {
                        id: `snapshot-${vehicle.id}`,
                        vehicleId: vehicle.id,
                        vehiclePlate: vehicle.licensePlate,
                        assigneeId: vehicle.currentAssigneeId,
                        assigneeType: vehicle.currentAssigneeType,
                        assigneeName: vehicle.currentAssigneeName,
                        startDate: formatYmdDate(monthRange.monthStart)
                    },
                    startDate: monthRange.monthStart,
                    endDate: null
                };
            }
            return undefined;
        };

        const buildSegmentFromAssignment = (
            entry: typeof activeAssignments[number] | undefined,
            segmentStart: Date,
            segmentEnd: Date,
            index: number,
            billingTarget?: {
                id: string;
                targetId: string;
                targetType: VehicleBillingTargetType;
                targetName: string;
            }
        ): VehicleLedgerSegment | null => {
            const overlapDays = inclusiveDays(segmentStart, segmentEnd);
            if (overlapDays <= 0) return null;

            const assignment = entry?.assignment;
            const assignedTeam = assignment ? resolveAssigneeTeam(assignment) : { teamId: '', teamName: '' };
            const billingTeam = billingTarget
                ? (() => {
                    if (billingTarget.targetType === 'TEAM') {
                        return {
                            teamId: normalizeKey(teamByAnyId.get(billingTarget.targetId)?.id ?? billingTarget.targetId),
                            teamName: normalizeKey(teamByAnyId.get(billingTarget.targetId)?.name ?? teamByName.get(billingTarget.targetName)?.name ?? billingTarget.targetName)
                        };
                    }
                    if (billingTarget.targetType === 'WORKER') {
                        const worker = workerByAnyId.get(billingTarget.targetId) ?? workerByName.get(billingTarget.targetName);
                        return {
                            teamId: normalizeKey(worker?.teamId ?? assignedTeam.teamId),
                            teamName: normalizeKey(worker?.teamName ?? assignedTeam.teamName)
                        };
                    }
                    return {
                        teamId: OFFICE_TARGET_ID,
                        teamName: OFFICE_TARGET_NAME
                    };
                })()
                : { teamId: assignedTeam.teamId, teamName: assignedTeam.teamName };

            return {
                id: billingTarget?.id || normalizeKey(assignment?.id) || `${vehicle.id}:${index}`,
                assigneeId: normalizeKey(assignment?.assigneeId),
                assigneeType: assignment?.assigneeType,
                assigneeName: normalizeKey(assignment?.assigneeName),
                teamId: assignedTeam.teamId,
                teamName: assignedTeam.teamName,
                billingTargetId: normalizeKey(billingTarget?.targetId),
                billingTargetType: billingTarget?.targetType,
                billingTargetName: normalizeKey(billingTarget?.targetName),
                billingTeamId: billingTeam.teamId,
                billingTeamName: billingTeam.teamName,
                startDate: formatYmdDate(segmentStart),
                endDate: formatYmdDate(segmentEnd),
                overlapDays
            };
        };

        const targetRanges = billingTargetList
            .filter((target) => normalizeKey(target.vehicleId) === vehicleId)
            .map((target) => ({
                target,
                startDate: parseYmdDate(target.startDate),
                endDate: parseYmdDate(target.endDate)
            }))
            .filter((entry) => {
                if (!entry.startDate) return false;
                if (entry.startDate.getTime() > monthRange.monthEnd.getTime()) return false;
                if (entry.endDate && entry.endDate.getTime() < monthRange.monthStart.getTime()) return false;
                return true;
            })
            .sort((a, b) => {
                const startDiff = (a.startDate?.getTime() ?? 0) - (b.startDate?.getTime() ?? 0);
                if (startDiff !== 0) return startDiff;
                return String(a.target.id ?? '').localeCompare(String(b.target.id ?? ''));
            });

        if (targetRanges.length > 0) {
            type BillingTimelineEntry = {
                target: VehicleBillingTargetRecord | null;
                startDate: Date | null;
                endDate: Date | null;
            };
            const targetIdentityKey = (entry: BillingTimelineEntry) => {
                if (!entry.target) {
                    const assignment = findAssignmentForRange(
                        monthRange.monthStart,
                        entry.endDate ?? monthRange.monthEnd
                    )?.assignment;
                    return [
                        assignment?.assigneeType || 'UNASSIGNED',
                        normalizeKey(assignment?.assigneeId) || normalizeKey(assignment?.assigneeName)
                    ].join(':');
                }
                return [
                    entry.target.targetType,
                    normalizeKey(entry.target.targetId) || normalizeKey(entry.target.targetName)
                ].join(':');
            };
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
            const firstChangeInMonth = changesInMonth[0];
            const fallbackEntry: BillingTimelineEntry | null = !activeAtMonthStart && firstChangeInMonth?.startDate
                ? {
                    target: null,
                    startDate: monthRange.monthStart,
                    endDate: addDays(firstChangeInMonth.startDate, -1)
                }
                : null;
            const timelineEntries = [
                ...(activeAtMonthStart ? [{ ...activeAtMonthStart, target: activeAtMonthStart.target } as BillingTimelineEntry] : []),
                ...(fallbackEntry ? [fallbackEntry] : []),
                ...changesInMonth.map((entry) => ({ ...entry, target: entry.target } as BillingTimelineEntry))
            ].filter((entry, index, entries) => (
                index === 0 || targetIdentityKey(entry) !== targetIdentityKey(entries[index - 1])
            ));
            const shouldSplitByBillingTarget = new Set(timelineEntries.map(targetIdentityKey)).size > 1;

            if (!shouldSplitByBillingTarget) {
                const entry = (changesInMonth.at(-1) ?? activeAtMonthStart ?? targetRanges.at(-1))!;
                const assignment = findAssignmentForRange(monthRange.monthStart, monthRange.monthEnd);
                const segment = buildSegmentFromAssignment(assignment, monthRange.monthStart, monthRange.monthEnd, 0, {
                    id: normalizeKey(entry.target.id) || `${vehicle.id}:billing:0`,
                    targetId: normalizeKey(entry.target.targetId),
                    targetType: entry.target.targetType,
                    targetName: normalizeKey(entry.target.targetName)
                });
                return segment ? [segment] : [];
            }

            const splitEntries = timelineEntries.length > 0 ? timelineEntries : targetRanges;
            const segments = splitEntries.flatMap((entry, index): VehicleLedgerSegment[] => {
                const nextStartDate = splitEntries[index + 1]?.startDate ?? null;
                const explicitEndDate = entry.endDate ?? monthRange.monthEnd;
                const handoffEndDate = nextStartDate ? addDays(nextStartDate, -1) : monthRange.monthEnd;
                const segmentStart = index === 0
                    ? monthRange.monthStart
                    : maxDate(entry.startDate ?? monthRange.monthStart, monthRange.monthStart);
                const segmentEnd = minDate(explicitEndDate, handoffEndDate, monthRange.monthEnd);
                const assignment = findAssignmentForRange(segmentStart, segmentEnd);
                const segment = entry.target
                    ? buildSegmentFromAssignment(assignment, segmentStart, segmentEnd, index, {
                        id: normalizeKey(entry.target.id) || `${vehicle.id}:billing:${index}`,
                        targetId: normalizeKey(entry.target.targetId),
                        targetType: entry.target.targetType,
                        targetName: normalizeKey(entry.target.targetName)
                    })
                    : buildSegmentFromAssignment(assignment, segmentStart, segmentEnd, index);
                return segment ? [segment] : [];
            });
            return mergeAdjacentVehicleSegments(segments);
        }

        const assignment = findAssignmentForRange(monthRange.monthStart, monthRange.monthEnd);
        const fullMonthSegment = buildSegmentFromAssignment(assignment, monthRange.monthStart, monthRange.monthEnd, 0);
        if (fullMonthSegment) return [fullMonthSegment];

        return [{
            id: `unassigned-${vehicle.id}`,
            startDate: formatYmdDate(monthRange.monthStart),
            endDate: formatYmdDate(monthRange.monthEnd),
            overlapDays: monthRange.daysInMonth
        }];
    }, [monthRange, resolveAssigneeTeam, teamByAnyId, teamByName, workerByAnyId, workerByName]);

    const rowMatchesTeamFilter = useCallback((row: VehicleLedgerRow, filterId: string): boolean => {
        const selectedId = normalizeKey(filterId);
        if (!selectedId) return true;

        const selectedTeam = teamByAnyId.get(selectedId);
        const selectedIds = new Set(
            [selectedId, selectedTeam?.id, selectedTeam?.legacyId]
                .map((value) => normalizeKey(value))
                .filter(Boolean)
        );
        const selectedNames = new Set(
            [selectedTeam?.name]
                .map((value) => normalizeKey(value))
                .filter(Boolean)
        );

        const candidateIds = [
            row.segment.billingTeamId,
            row.segment.billingTargetType === 'TEAM' ? row.segment.billingTargetId : '',
            row.segment.teamId,
            row.segment.assigneeType === 'TEAM' ? row.segment.assigneeId : ''
        ].map((value) => normalizeKey(value)).filter(Boolean);

        const candidateNames = [
            row.segment.billingTeamName,
            row.segment.billingTargetType === 'TEAM' ? row.segment.billingTargetName : '',
            row.segment.teamName,
            row.segment.assigneeType === 'TEAM' ? row.segment.assigneeName : ''
        ].map((value) => normalizeKey(value)).filter(Boolean);

        return (
            candidateIds.some((id) => selectedIds.has(id)) ||
            candidateNames.some((name) => selectedNames.has(name))
        );
    }, [teamByAnyId]);

    const loadData = useCallback(async () => {
        if (!yearMonth) return;
        setLoading(true);
        try {
            const [expenses, assignmentList, billingTargetList, billings] = await Promise.all([
                vehicleService.getExpensesByMonth(yearMonth),
                vehicleService.listAllVehicleAssignments().catch(() => [] as VehicleAssignmentRecord[]),
                vehicleService.listAllVehicleBillingTargets().catch(() => [] as VehicleBillingTargetRecord[]),
                vehicleBillingService.getBillingsByMonth(yearMonth).catch(() => [] as VehicleBillingDocument[])
            ]);
            originalExpensesRef.current = expenses;
            setBillingTargets(billingTargetList);
            setBillingDocuments(billings);

            const newRows: VehicleLedgerRow[] = vehicles.flatMap(v => {
                const fixed = v.contract?.monthlyFee ?? 0;
                const segments = buildSegmentsForVehicle(v, assignmentList, billingTargetList);
                const fixedShares = allocateFixedCostByDays(fixed, segments);

                return segments.map((segment, segmentIndex) => {
                    const fixedShare = fixedShares[segmentIndex] ?? 0;
                    const rentFee = v.type === 'RENT' ? fixedShare : 0;
                    const leaseFee = v.type === 'LEASE' ? fixedShare : 0;

                    return {
                        id: `${v.id}:${segment.id}`,
                        vehicle: v,
                        segment,
                        rentFee,
                        leaseFee,
                        amounts: emptyExpenseAmounts(),
                        fineChargeTarget: v.fineChargeTarget ?? 'BILLING_TARGET',
                        variableTotal: 0,
                        total: rentFee + leaseFee,
                        note: ''
                    };
                });
            });

            expenses.forEach((expense) => {
                const vehicleRows = newRows.filter((row) => normalizeKey(row.vehicle.id) === normalizeKey(expense.vehicleId));
                if (vehicleRows.length === 0 || !EXPENSE_TYPES.includes(expense.type)) return;

                const expenseDate = parseYmdDate(expense.date);
                const targetRow = expenseDate
                    ? vehicleRows.find((row) => {
                        const start = parseYmdDate(row.segment.startDate);
                        const end = parseYmdDate(row.segment.endDate);
                        return start && end && expenseDate.getTime() >= start.getTime() && expenseDate.getTime() <= end.getTime();
                    })
                    : undefined;
                const row = targetRow ?? vehicleRows[0];
                row.amounts = {
                    ...row.amounts,
                    [expense.type]: (row.amounts[expense.type] ?? 0) + expense.amount
                };
                if (expense.type === 'FINE' && !row.vehicle.fineChargeTarget && expense.fineChargeTarget === 'DRIVER') {
                    row.fineChargeTarget = 'DRIVER';
                }
                if (expense.note) row.note = expense.note;
            });

            newRows.forEach((row) => {
                row.variableTotal = EXPENSE_TYPES.reduce((sum, type) => sum + (row.amounts[type] || 0), 0);
                row.total = row.rentFee + row.leaseFee + row.variableTotal;
            });

            const visibleRows = teamFilterId
                ? newRows.filter((row) => rowMatchesTeamFilter(row, teamFilterId))
                : newRows;

            // 렌트(RENT) 위쪽, 리스(LEASE) 아래쪽, 그 다음 자가(OWNED)
            visibleRows.sort(compareVehicleLedgerRowsByBillingTarget);
            setRows(visibleRows);
            setIsDirty(false);
        } catch (e) {
            console.error(e);
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, [yearMonth, vehicles, monthRange, buildSegmentsForVehicle, teamFilterId, rowMatchesTeamFilter]);

    const resolveSegmentTeamBadge = (segment: VehicleLedgerSegment) => {
        const team = segment.teamId
            ? teamByAnyId.get(String(segment.teamId))
            : teamByName.get(normalizeKey(segment.teamName));
        const name = normalizeKey(team?.name) || normalizeKey(segment.teamName) || (
            segment.assigneeType === 'TEAM' ? normalizeKey(segment.assigneeName) : ''
        );
        if (!name) return null;
        return {
            key: `team:${normalizeKey(team?.id ?? segment.teamId ?? segment.assigneeId ?? name)}`,
            name,
            color: team?.color || '#94a3b8',
            icon: team?.icon || team?.iconKey || null,
            targetType: 'TEAM' as const
        } satisfies LedgerBadge;
    };

    const getAssignmentSummary = (row: VehicleLedgerRow) => {
        const teamMap = new Map<string, LedgerBadge>();
        const workerMap = new Map<string, string>();
        const segment = row.segment;

        if (segment.assigneeType === 'TEAM') {
            const badge = resolveSegmentTeamBadge(segment);
            if (badge) teamMap.set(badge.key, badge);
        } else if (segment.assigneeType === 'WORKER') {
            const badge = resolveSegmentTeamBadge(segment);
            if (badge) teamMap.set(badge.key, badge);
            const workerName = normalizeKey(segment.assigneeName);
            if (workerName) workerMap.set(workerName, workerName);
        }

        const assignedTeams = Array.from(teamMap.values());
        const assignedWorkers = Array.from(workerMap.values());
        const buildTeamBadge = (teamId?: string | null, teamName?: string | null): LedgerBadge | null => {
            const rawTeamId = normalizeKey(teamId);
            const rawTeamName = normalizeKey(teamName);
            const team = rawTeamId ? teamByAnyId.get(rawTeamId) : teamByName.get(rawTeamName);
            const name = normalizeKey(team?.name ?? rawTeamName);
            if (!name) return null;
            return {
                key: `team:${normalizeKey(team?.id ?? rawTeamId ?? name)}`,
                name,
                color: team?.color || '#94a3b8',
                icon: team?.icon || team?.iconKey || null,
                targetType: 'TEAM',
                targetLabel: '팀'
            };
        };

        const buildBillingTargetBadge = (
            type?: VehicleBillingTargetType | null,
            id?: string | null,
            name?: string | null
        ): LedgerBadge | null => {
            const targetType = type ?? undefined;
            const targetId = normalizeKey(id);
            const targetName = normalizeKey(name);
            if (!targetType) return null;

            if (targetType === 'TEAM') {
                return buildTeamBadge(targetId, targetName);
            }

            if (targetType === 'WORKER') {
                const worker = targetId ? workerByAnyId.get(targetId) : workerByName.get(targetName);
                const teamBadge = buildTeamBadge(worker?.teamId ?? segment.billingTeamId ?? segment.teamId, worker?.teamName ?? segment.billingTeamName ?? segment.teamName);
                const displayName = normalizeKey(worker?.name ?? targetName);
                if (!displayName) return null;
                return {
                    key: `worker:${normalizeKey(worker?.id ?? targetId ?? displayName)}`,
                    name: displayName,
                    color: teamBadge?.color || '#10b981',
                    targetType,
                    targetLabel: '작업자',
                    subLabel: teamBadge?.name
                };
            }

            if (targetType === 'OFFICE') {
                return {
                    key: `office:${targetId || OFFICE_TARGET_ID}`,
                    name: targetName || OFFICE_TARGET_NAME,
                    color: '#475569',
                    targetType,
                    targetLabel: '사무실'
                };
            }

            const displayName = targetName || '사무실직원';
            return {
                key: `office-staff:${targetId || displayName}`,
                name: displayName,
                color: '#0891b2',
                targetType,
                targetLabel: '사무실직원',
                subLabel: OFFICE_TARGET_NAME
            };
        };

        let billingTeams: LedgerBadge[] = assignedTeams;
        let billingWorkers: string[] = [];
        const explicitTargetBadge = buildBillingTargetBadge(
            segment.billingTargetType,
            segment.billingTargetId,
            segment.billingTargetName
        );
        if (explicitTargetBadge) {
            billingTeams = [explicitTargetBadge];
        } else if (segment.billingTeamId || segment.billingTeamName) {
            const badge = buildTeamBadge(segment.billingTeamId, segment.billingTeamName);
            billingTeams = badge ? [badge] : [];
        } else if (billingTeams.length === 0 && segment.assigneeType === 'WORKER') {
            const badge = buildTeamBadge(segment.teamId, segment.teamName);
            billingTeams = badge ? [badge] : [];
        }

        const periodLabel = segment.startDate === segment.endDate
            ? segment.startDate
            : `${segment.startDate} ~ ${segment.endDate}`;
        return {
            assignedTeams,
            assignedWorkers,
            billingTeams,
            billingWorkers,
            primaryColor: assignedTeams[0]?.color || '#94a3b8',
            periodLabel,
            overlapDays: segment.overlapDays
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

    const resolveVehicleBillingIdentity = useCallback((row: VehicleLedgerRow) => {
        const hasExplicitTarget = Boolean(row.segment.billingTargetType);
        const targetType = row.segment.billingTargetType || row.segment.assigneeType;
        const targetId = normalizeKey(
            row.segment.billingTargetType
                ? row.segment.billingTargetId
                : row.segment.assigneeId
        );
        const targetName = normalizeKey(
            row.segment.billingTargetType
                ? row.segment.billingTargetName
                : row.segment.assigneeName
        );
        const isPersonTarget = hasExplicitTarget && (targetType === 'WORKER' || targetType === 'OFFICE_STAFF');

        if (targetType === 'OFFICE') {
            return {
                issuedToType: 'team' as const,
                teamIds: toKeySet([OFFICE_TARGET_ID, targetId]),
                teamNames: toKeySet([OFFICE_TARGET_NAME, targetName]),
                workerIds: new Set<string>(),
                workerNames: new Set<string>()
            };
        }

        if (targetType === 'OFFICE_STAFF') {
            return {
                issuedToType: 'worker' as const,
                teamIds: toKeySet([OFFICE_TARGET_ID]),
                teamNames: toKeySet([OFFICE_TARGET_NAME]),
                workerIds: toKeySet([targetId]),
                workerNames: toKeySet([targetName])
            };
        }

        const team = targetType === 'TEAM'
            ? (targetId ? teamByAnyId.get(targetId) : teamByName.get(targetName))
            : (() => {
                const worker = targetId ? workerByAnyId.get(targetId) : workerByName.get(targetName);
                return worker?.teamId
                    ? teamByAnyId.get(String(worker.teamId))
                    : (row.segment.billingTeamId
                        ? teamByAnyId.get(String(row.segment.billingTeamId))
                        : (row.segment.teamId ? teamByAnyId.get(String(row.segment.teamId)) : teamByName.get(normalizeKey(row.segment.billingTeamName || row.segment.teamName))));
            })();

        const teamId = normalizeKey(
            team?.id ??
            row.segment.billingTeamId ??
            (targetType === 'TEAM' ? targetId : row.segment.teamId)
        );
        const teamName = normalizeKey(
            team?.name ??
            row.segment.billingTeamName ??
            (targetType === 'TEAM' ? targetName : row.segment.teamName)
        );

        const worker = targetType === 'WORKER'
            ? (targetId ? workerByAnyId.get(targetId) : workerByName.get(targetName))
            : null;

        if (isPersonTarget) {
            const workerId = normalizeKey(worker?.id ?? targetId);
            const workerName = normalizeKey(worker?.name ?? targetName);
            if (!workerId && !workerName) return null;
            return {
                issuedToType: 'worker' as const,
                teamIds: toKeySet([teamId, team?.id, team?.legacyId, worker?.teamId]),
                teamNames: toKeySet([teamName, team?.name, worker?.teamName]),
                workerIds: toKeySet([workerId, worker?.id, worker?.legacyId]),
                workerNames: toKeySet([workerName, worker?.name])
            };
        }

        if (!teamId && !teamName) return null;

        return {
            issuedToType: 'team' as const,
            teamIds: toKeySet([teamId, team?.id, team?.legacyId]),
            teamNames: toKeySet([teamName, team?.name]),
            workerIds: new Set<string>(),
            workerNames: new Set<string>()
        };
    }, [teamByAnyId, teamByName, workerByAnyId, workerByName]);

    const resolveVehicleBillingTarget = useCallback((row: VehicleLedgerRow) => {
        const hasExplicitTarget = Boolean(row.segment.billingTargetType);
        const targetType = row.segment.billingTargetType || row.segment.assigneeType;
        const targetId = normalizeKey(
            row.segment.billingTargetType
                ? row.segment.billingTargetId
                : row.segment.assigneeId
        );
        const targetName = normalizeKey(
            row.segment.billingTargetType
                ? row.segment.billingTargetName
                : row.segment.assigneeName
        );
        const isPersonTarget = hasExplicitTarget && (targetType === 'WORKER' || targetType === 'OFFICE_STAFF');

        if (targetType === 'OFFICE') {
            return {
                issuedToType: 'team' as const,
                teamId: OFFICE_TARGET_ID,
                teamName: OFFICE_TARGET_NAME,
                assignedTeamId: normalizeKey(row.segment.teamId),
                assignedTeamName: normalizeKey(row.segment.teamName),
                issuedToWorkerId: undefined,
                issuedToWorkerName: undefined
            };
        }

        if (targetType === 'OFFICE_STAFF') {
            return {
                issuedToType: 'worker' as const,
                teamId: OFFICE_TARGET_ID,
                teamName: OFFICE_TARGET_NAME,
                assignedTeamId: normalizeKey(row.segment.teamId),
                assignedTeamName: normalizeKey(row.segment.teamName),
                issuedToWorkerId: targetId || undefined,
                issuedToWorkerName: targetName || undefined
            };
        }

        const team = targetType === 'TEAM'
            ? (targetId ? teamByAnyId.get(targetId) : teamByName.get(targetName))
            : (() => {
                const worker = targetId ? workerByAnyId.get(targetId) : workerByName.get(targetName);
                return worker?.teamId
                    ? teamByAnyId.get(String(worker.teamId))
                    : (row.segment.billingTeamId
                        ? teamByAnyId.get(String(row.segment.billingTeamId))
                        : (row.segment.teamId ? teamByAnyId.get(String(row.segment.teamId)) : teamByName.get(normalizeKey(row.segment.billingTeamName || row.segment.teamName))));
            })();

        const teamId = normalizeKey(team?.id ?? row.segment.billingTeamId ?? (targetType === 'TEAM' ? targetId : row.segment.teamId));
        const teamName = normalizeKey(team?.name ?? row.segment.billingTeamName ?? (targetType === 'TEAM' ? targetName : row.segment.teamName));
        if (!teamId) return null;

        if (isPersonTarget) {
            const worker = targetId ? workerByAnyId.get(targetId) : workerByName.get(targetName);
            return {
                issuedToType: 'worker' as const,
                teamId,
                teamName,
                assignedTeamId: normalizeKey(row.segment.teamId),
                assignedTeamName: normalizeKey(row.segment.teamName),
                issuedToWorkerId: normalizeKey(worker?.id ?? targetId) || undefined,
                issuedToWorkerName: normalizeKey(worker?.name ?? targetName) || undefined
            };
        }

        return {
            issuedToType: 'team' as const,
            teamId,
            teamName,
            assignedTeamId: normalizeKey(row.segment.teamId),
            assignedTeamName: normalizeKey(row.segment.teamName),
            issuedToWorkerId: undefined,
            issuedToWorkerName: undefined
        };
    }, [teamByAnyId, teamByName, workerByAnyId, workerByName]);

    const resolveFineDriverBillingTarget = useCallback((row: VehicleLedgerRow): ResolvedVehicleBillingTarget | null => {
        if (!canChargeFineToDriver(row)) return null;

        const driverId = normalizeKey(row.segment.assigneeId);
        const driverName = normalizeKey(row.segment.assigneeName);
        const worker = driverId ? workerByAnyId.get(driverId) : workerByName.get(driverName);
        const team = worker?.teamId ? teamByAnyId.get(String(worker.teamId)) : null;
        const teamId = normalizeKey(team?.id ?? worker?.teamId ?? row.segment.teamId ?? row.segment.billingTeamId ?? OFFICE_TARGET_ID);
        const teamName = normalizeKey(team?.name ?? worker?.teamName ?? row.segment.teamName ?? row.segment.billingTeamName ?? OFFICE_TARGET_NAME);
        const issuedToWorkerId = normalizeKey(worker?.id ?? driverId);
        const issuedToWorkerName = normalizeKey(worker?.name ?? driverName);

        if (!issuedToWorkerId && !issuedToWorkerName) return null;

        return {
            issuedToType: 'worker',
            teamId,
            teamName,
            assignedTeamId: normalizeKey(row.segment.teamId),
            assignedTeamName: normalizeKey(row.segment.teamName),
            issuedToWorkerId: issuedToWorkerId || undefined,
            issuedToWorkerName: issuedToWorkerName || undefined
        };
    }, [canChargeFineToDriver, teamByAnyId, workerByAnyId, workerByName]);

    const getVehicleLedgerRowDocumentSuffix = useCallback((row: VehicleLedgerRow): string => {
        return `__row_${sanitizeBillingIdPart(row.segment.id || row.id)}`;
    }, []);

    const hasVehicleLedgerRowMarker = useCallback((doc: VehicleBillingDocument, row: VehicleLedgerRow): boolean => {
        const segmentIds = getVehicleSegmentSourceIds(row.segment);
        const suffixes = segmentIds.map((id) => `__row_${sanitizeBillingIdPart(id)}`);
        if (suffixes.some((suffix) => normalizeKey(doc.id).endsWith(suffix))) return true;
        const ledgerRowIds = new Set([
            normalizeKey(row.id),
            ...segmentIds.map((id) => normalizeKey(`${row.vehicle.id}:${id}`))
        ].filter(Boolean));
        const segmentIdSet = new Set(segmentIds.map((id) => normalizeKey(id)).filter(Boolean));
        return (doc.lineItems ?? []).some((item) => (
            ledgerRowIds.has(normalizeKey(item.sourceLedgerRowId)) ||
            segmentIdSet.has(normalizeKey(item.sourceSegmentId))
        ));
    }, [getVehicleLedgerRowDocumentSuffix]);

    const matchesVehicleBillingDocument = useCallback((doc: VehicleBillingDocument, row: VehicleLedgerRow) => {
        if (normalizeKey(doc.vehicleId) !== normalizeKey(row.vehicle.id)) return false;
        if (normalizeKey(doc.yearMonth) !== normalizeKey(yearMonth)) return false;

        const hasLedgerMarkers = normalizeKey(doc.id).includes('__row_') || (doc.lineItems ?? []).some((item) => (
            item.sourceType === 'vehicle_ledger' ||
            Boolean(item.sourceLedgerRowId) ||
            Boolean(item.sourceSegmentId)
        ));

        if (hasLedgerMarkers && hasVehicleLedgerRowMarker(doc, row)) return true;

        const identity = resolveVehicleBillingIdentity(row);
        if (!identity) return false;
        if (normalizeKey(doc.issuedToType) !== identity.issuedToType) return false;

        if (identity.issuedToType === 'worker') {
            const docWorkerIds = toKeySet([doc.issuedToWorkerId]);
            const docWorkerNames = toKeySet([doc.issuedToWorkerName]);
            const workerMatches = intersects(identity.workerIds, docWorkerIds) || intersects(identity.workerNames, docWorkerNames);
            if (!workerMatches) return false;
        } else {
            const docTeamIds = toKeySet([doc.teamId, doc.assignedTeamId]);
            const docTeamNames = toKeySet([doc.teamName, doc.assignedTeamName]);
            const teamMatches = intersects(identity.teamIds, docTeamIds) || intersects(identity.teamNames, docTeamNames);
            if (!teamMatches) return false;
        }

        return Number(doc.totalAmount ?? 0) === Number(row.total ?? 0);
    }, [resolveVehicleBillingIdentity, yearMonth, hasVehicleLedgerRowMarker]);

    const getBillingDocumentsForRow = useCallback((row: VehicleLedgerRow) => {
        return billingDocuments.filter((doc) => matchesVehicleBillingDocument(doc, row));
    }, [billingDocuments, matchesVehicleBillingDocument]);

    const getRowBillingState = useCallback((row: VehicleLedgerRow): {
        status: BillingRowStatus;
        documents: VehicleBillingDocument[];
        reason?: string;
    } => {
        const defaultVariableTotal = EXPENSE_TYPES.reduce((sum, type) => {
            if (type === 'FINE' && row.fineChargeTarget === 'DRIVER') return sum;
            return sum + (row.amounts[type] || 0);
        }, 0);
        const defaultTargetAmount = row.rentFee + row.leaseFee + defaultVariableTotal;
        const shouldBillFineToDriver = row.fineChargeTarget === 'DRIVER' && (row.amounts.FINE ?? 0) > 0;
        const fineDriverTarget = shouldBillFineToDriver ? resolveFineDriverBillingTarget(row) : null;

        if (shouldBillFineToDriver && !fineDriverTarget) {
            return { status: 'blocked', documents: [], reason: '운전자 없음' };
        }

        const identity = resolveVehicleBillingIdentity(row);
        if (defaultTargetAmount > 0 && (!identity || (
            identity.teamIds.size === 0 &&
            identity.teamNames.size === 0 &&
            identity.workerIds.size === 0 &&
            identity.workerNames.size === 0
        ))) {
            return { status: 'blocked', documents: [], reason: '청구대상 없음' };
        }
        if (row.total <= 0) {
            return { status: 'blocked', documents: [], reason: '금액 없음' };
        }

        const documents = getBillingDocumentsForRow(row);
        const expectedDocumentCount = (defaultTargetAmount > 0 ? 1 : 0) + (fineDriverTarget ? 1 : 0);
        if (expectedDocumentCount === 0) return { status: 'blocked', documents, reason: '금액 없음' };
        if (documents.length < expectedDocumentCount) return { status: 'unbilled', documents };
        if (documents.length === 0) return { status: 'unbilled', documents };
        return { status: 'billed', documents };
    }, [getBillingDocumentsForRow, resolveFineDriverBillingTarget, resolveVehicleBillingIdentity]);

    const billingRows = useMemo(() => {
        return rows
            .map((row, index) => ({ row, index, billingState: getRowBillingState(row) }))
            .filter(({ billingState }) => {
                if (billingFilter === 'all') return true;
                if (billingFilter === 'unbilled') return billingState.status === 'unbilled' || billingState.status === 'blocked';
                return billingState.status === billingFilter;
            });
    }, [rows, billingFilter, getRowBillingState]);

    const vehicleRowCountById = useMemo(() => {
        const map = new Map<string, number>();
        rows.forEach((row) => {
            const key = normalizeKey(row.vehicle.id);
            if (!key) return;
            map.set(key, (map.get(key) ?? 0) + 1);
        });
        return map;
    }, [rows]);

    const bulkBillableCount = useMemo(
        () => billingRows.filter(({ billingState }) => billingState.status === 'unbilled').length,
        [billingRows]
    );

    const bulkUnbillableCount = useMemo(
        () => billingRows.filter(({ billingState }) => billingState.status === 'billed').length,
        [billingRows]
    );

    useEffect(() => {
        if (yearMonth) loadData();
    }, [yearMonth, loadData]);

    const handleMonthChange = (delta: number) => {
        if (isDirty) {
            if (!window.confirm('저장하지 않은 변경사항이 있습니다. 이동하시겠습니까?')) return;
        }
        const next = new Date(currentDate);
        next.setMonth(next.getMonth() + delta);
        setCurrentDate(next);
    };

    const handleCellCommit = useCallback((index: number, type: VehicleExpenseType, numValue: number) => {
        setRows(prev => {
            const newRows = [...prev];
            const row = { ...newRows[index] };
            const amounts = { ...row.amounts, [type]: numValue };
            const variableTotal = EXPENSE_TYPES.reduce((sum, t) => sum + (amounts[t] || 0), 0);

            row.amounts = amounts;
            row.variableTotal = variableTotal;
            row.total = row.rentFee + row.leaseFee + variableTotal;

            newRows[index] = row;
            return newRows;
        });
        setIsDirty(true);
    }, []);

    const handleNoteChange = useCallback((index: number, note: string) => {
        setRows(prev => {
            const newRows = [...prev];
            newRows[index] = { ...newRows[index], note };
            return newRows;
        });
        setIsDirty(true);
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            // 1. 기존 데이터 삭제
            const deleteTasks = originalExpensesRef.current.map(e =>
                vehicleService.deleteExpense(e.id).catch(err => {
                    console.warn(`Failed to delete expense ${e.id}`, err);
                })
            );
            await Promise.all(deleteTasks);

            // 2. 신규 데이터 생성
            const createTasks: Promise<string>[] = [];
            for (const row of rows) {
                for (const type of EXPENSE_TYPES) {
                    const amount = row.amounts[type];
                    if (amount > 0) {
                        createTasks.push(
                            vehicleService.addExpense({
                                vehicleId: row.vehicle.id,
                                vehiclePlate: row.vehicle.licensePlate,
                                date: row.segment.startDate || `${yearMonth}-01`,
                                type,
                                amount,
                                payer: 'COMPANY',
                                fineChargeTarget: type === 'FINE' ? row.fineChargeTarget : undefined,
                                note: row.note || undefined
                            })
                        );
                    }
                }
            }
            await Promise.all(createTasks);

            setIsDirty(false);
            await loadData();
            alert('저장되었습니다.');
        } catch (e) {
            console.error('Save failed:', e);
            alert('저장에 실패했습니다.');
        } finally {
            setSaving(false);
        }
    };

    const buildLineItemsForRow = (
        row: VehicleLedgerRow,
        target: 'billingTarget' | 'driverFine' = 'billingTarget'
    ): VehicleBillingCostItem[] => {
        const source = {
            sourceType: 'vehicle_ledger' as const,
            sourceLedgerRowId: row.id,
            sourceSegmentId: row.segment.id,
            sourceStartDate: row.segment.startDate,
            sourceEndDate: row.segment.endDate
        };
        const lineItems: VehicleBillingCostItem[] = [];

        if (target === 'driverFine') {
            const fineAmount = row.amounts.FINE ?? 0;
            if (row.fineChargeTarget !== 'DRIVER' || fineAmount <= 0) return [];
            return [{
                id: `fine-driver-${sanitizeBillingIdPart(row.id)}`,
                label: `${EXPENSE_LABELS.FINE} ${row.segment.startDate}~${row.segment.endDate} (운전자 부과)`,
                amount: fineAmount,
                type: 'VARIABLE',
                category: 'FINE',
                ...source
            }];
        }

        if (row.rentFee > 0) {
            lineItems.push({
                id: `rent-${sanitizeBillingIdPart(row.id)}`,
                label: `렌트비 ${row.segment.startDate}~${row.segment.endDate}`,
                amount: row.rentFee,
                type: 'FIXED',
                category: 'RENT',
                ...source
            });
        }

        if (row.leaseFee > 0) {
            lineItems.push({
                id: `lease-${sanitizeBillingIdPart(row.id)}`,
                label: `리스비 ${row.segment.startDate}~${row.segment.endDate}`,
                amount: row.leaseFee,
                type: 'FIXED',
                category: 'LEASE',
                ...source
            });
        }

        EXPENSE_TYPES.forEach((type) => {
            const amount = row.amounts[type] ?? 0;
            if (amount <= 0) return;
            if (type === 'FINE' && row.fineChargeTarget === 'DRIVER') return;
            lineItems.push({
                id: `${type.toLowerCase()}-${sanitizeBillingIdPart(row.id)}`,
                label: `${EXPENSE_LABELS[type]} ${row.segment.startDate}~${row.segment.endDate}`,
                amount,
                type: 'VARIABLE',
                category: type,
                ...source
            });
        });

        return lineItems;
    };

    const documentMatchesTarget = (
        doc: VehicleBillingDocument,
        target: ResolvedVehicleBillingTarget
    ): boolean => {
        if (normalizeKey(doc.issuedToType) !== target.issuedToType) return false;
        if (target.issuedToType === 'worker') {
            return (
                normalizeKey(doc.issuedToWorkerId) === normalizeKey(target.issuedToWorkerId) ||
                normalizeKey(doc.issuedToWorkerName) === normalizeKey(target.issuedToWorkerName)
            );
        }
        return (
            normalizeKey(doc.teamId) === normalizeKey(target.teamId) ||
            normalizeKey(doc.teamName) === normalizeKey(target.teamName)
        );
    };

    const buildBillingDocument = (
        row: VehicleLedgerRow,
        target: ResolvedVehicleBillingTarget,
        lineItems: VehicleBillingCostItem[],
        existing?: VehicleBillingDocument,
        suffix = getVehicleLedgerRowDocumentSuffix(row)
    ): VehicleBillingDocument | null => {
        if (lineItems.length === 0) return null;

        const fixedCost = lineItems
            .filter((item) => item.type === 'FIXED')
            .reduce((sum, item) => sum + item.amount, 0);
        const variableCost = lineItems
            .filter((item) => item.type !== 'FIXED')
            .reduce((sum, item) => sum + item.amount, 0);
        const baseId = vehicleBillingService.buildBillingDocumentId({
            vehicleId: row.vehicle.id,
            teamId: target.teamId,
            issuedToType: target.issuedToType,
            workerId: target.issuedToType === 'worker' ? target.issuedToWorkerId : undefined,
            yearMonth
        });

        return {
            id: existing?.id ?? `${baseId}${suffix}`,
            yearMonth,
            vehicleId: row.vehicle.id,
            vehiclePlate: row.vehicle.licensePlate,
            assignedTeamId: target.assignedTeamId || undefined,
            assignedTeamName: target.assignedTeamName || undefined,
            teamId: target.teamId,
            teamName: target.teamName,
            issuedToType: target.issuedToType,
            issuedToWorkerId: target.issuedToType === 'worker' ? target.issuedToWorkerId : undefined,
            issuedToWorkerName: target.issuedToType === 'worker' ? target.issuedToWorkerName : target.teamName,
            fixedCost,
            variableCost,
            totalAmount: fixedCost + variableCost,
            status: 'DRAFT',
            lineItems,
            memo: existing?.memo ?? row.note,
            createdAt: existing?.createdAt ?? Timestamp.now(),
            updatedAt: Timestamp.now(),
            confirmedAt: existing?.confirmedAt
        };
    };

    const buildBillingDocumentsForRow = (
        row: VehicleLedgerRow,
        existingDocuments: VehicleBillingDocument[] = []
    ): VehicleBillingDocument[] => {
        const documents: VehicleBillingDocument[] = [];
        const defaultTarget = resolveVehicleBillingTarget(row);
        if (defaultTarget) {
            const defaultItems = buildLineItemsForRow(row, 'billingTarget');
            const existing = existingDocuments.find((doc) => documentMatchesTarget(doc, defaultTarget));
            const document = buildBillingDocument(row, defaultTarget, defaultItems, existing);
            if (document) documents.push(document);
        }

        if (row.fineChargeTarget === 'DRIVER' && (row.amounts.FINE ?? 0) > 0) {
            const driverTarget = resolveFineDriverBillingTarget(row);
            if (driverTarget) {
                const driverItems = buildLineItemsForRow(row, 'driverFine');
                const existing = existingDocuments.find((doc) => documentMatchesTarget(doc, driverTarget));
                const document = buildBillingDocument(
                    row,
                    driverTarget,
                    driverItems,
                    existing,
                    `${getVehicleLedgerRowDocumentSuffix(row)}__fine_driver`
                );
                if (document) documents.push(document);
            }
        }

        return documents;
    };

    const handleCreateOrRecalculateBilling = async (row: VehicleLedgerRow, mode: 'create' | 'recalculate') => {
        const state = getRowBillingState(row);
        if (isDirty) {
            alert('청구 전 변경사항을 먼저 전체 저장해주세요.');
            return;
        }
        if (state.status === 'blocked') {
            alert(state.reason || '청구할 수 없는 행입니다.');
            return;
        }

        setBillingProcessingId(row.id);
        try {
            const nextDocuments = buildBillingDocumentsForRow(row, state.documents);
            if (nextDocuments.length === 0) {
                alert('배정 이력과 금액 기준으로 생성할 청구 문서를 찾지 못했습니다.');
                return;
            }

            if (state.documents.length > 0) {
                await Promise.all(state.documents.map((document) => vehicleBillingService.deleteBilling(document.id)));
            }
            await Promise.all(nextDocuments.map((document) => vehicleBillingService.saveBilling(document)));
            await loadData();
            alert(mode === 'recalculate' ? '청구가 다시 처리되었습니다.' : '청구 처리되었습니다.');
        } catch (error) {
            console.error(error);
            alert('청구 처리에 실패했습니다.');
        } finally {
            setBillingProcessingId('');
        }
    };

    const handleCreateSplitBilling = async (row: VehicleLedgerRow) => {
        if (isDirty) {
            alert('청구 전 변경사항을 먼저 전체 저장해주세요.');
            return;
        }

        const targetRows = rows.filter((item) => normalizeKey(item.vehicle.id) === normalizeKey(row.vehicle.id));
        if (targetRows.length <= 1) {
            alert('분할청구할 기간이 없습니다.');
            return;
        }

        const targets = targetRows
            .map((item) => ({ row: item, billingState: getRowBillingState(item) }))
            .filter(({ billingState }) => billingState.status === 'unbilled');

        if (targets.length === 0) {
            alert('분할청구할 미청구 행이 없습니다.');
            return;
        }

        setBillingProcessingId(row.id);
        let processed = 0;
        let skipped = 0;

        try {
            for (const target of targets) {
                try {
                    const nextDocuments = buildBillingDocumentsForRow(target.row, target.billingState.documents);
                    if (nextDocuments.length === 0) {
                        skipped += 1;
                        continue;
                    }

                    if (target.billingState.documents.length > 0) {
                        await Promise.all(target.billingState.documents.map((document) => vehicleBillingService.deleteBilling(document.id)));
                    }
                    await Promise.all(nextDocuments.map((document) => vehicleBillingService.saveBilling(document)));
                    processed += 1;
                } catch (error) {
                    console.error(error);
                    skipped += 1;
                }
            }

            await loadData();
            alert(`분할청구 처리 ${processed}건 완료${skipped > 0 ? `, ${skipped}건 제외` : ''}`);
        } finally {
            setBillingProcessingId('');
        }
    };

    const handleCancelBilling = async (row: VehicleLedgerRow, document?: VehicleBillingDocument) => {
        const documents = document ? [document] : getRowBillingState(row).documents;
        const documentIds = Array.from(new Set(documents.map((item) => item.id).filter(Boolean)));
        if (documentIds.length === 0) return;
        if (!window.confirm('청구 상태를 미청구로 변경할까요?')) return;

        setBillingProcessingId(row.id);
        try {
            await Promise.all(documentIds.map((id) => vehicleBillingService.deleteBilling(id)));
            await loadData();
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

        try {
            for (const { row, billingState } of targets) {
                try {
                    if (action === 'bill') {
                        const nextDocuments = buildBillingDocumentsForRow(row);
                        if (nextDocuments.length === 0) {
                            skipped += 1;
                            continue;
                        }
                        await Promise.all(nextDocuments.map((document) => vehicleBillingService.saveBilling(document)));
                    } else {
                        const documentIds = Array.from(new Set(
                            billingState.documents.map((item) => item.id).filter(Boolean)
                        ));
                        if (documentIds.length === 0) {
                            skipped += 1;
                            continue;
                        }
                        await Promise.all(documentIds.map((id) => vehicleBillingService.deleteBilling(id)));
                    }
                    processed += 1;
                } catch (error) {
                    console.error(error);
                    skipped += 1;
                }
            }

            await loadData();
            alert(`${actionLabel} 처리 ${processed}건 완료${skipped > 0 ? `, ${skipped}건 제외` : ''}`);
        } finally {
            setBulkBillingAction('');
            setBillingProcessingId('');
        }
    };

    const buildVehicleDocumentWithItems = (
        document: VehicleBillingDocument,
        lineItems: VehicleBillingCostItem[],
        memo: string,
        status: VehicleBillingDocument['status']
    ): VehicleBillingDocument => {
        const fixedCost = lineItems
            .filter((item) => item.type === 'FIXED')
            .reduce((sum, item) => sum + (Number.isFinite(item.amount) ? item.amount : 0), 0);
        const variableCost = lineItems
            .filter((item) => item.type !== 'FIXED')
            .reduce((sum, item) => sum + (Number.isFinite(item.amount) ? item.amount : 0), 0);

        return {
            ...document,
            lineItems,
            memo,
            status,
            fixedCost,
            variableCost,
            totalAmount: fixedCost + variableCost,
            updatedAt: Timestamp.now(),
            confirmedAt: status === 'CONFIRMED' ? Timestamp.now() : document.confirmedAt
        };
    };

    const handleSaveBillingEditor = async (
        lineItems: VehicleBillingCostItem[],
        memo: string,
        status: VehicleBillingDocument['status'] = billingEditor?.document.status ?? 'DRAFT'
    ) => {
        if (!billingEditor) return;
        setBillingProcessingId(billingEditor.row.id);
        try {
            const next = buildVehicleDocumentWithItems(billingEditor.document, lineItems, memo, status);
            await vehicleBillingService.saveBilling(next);
            await loadData();
            setBillingEditor(null);
            alert(status === 'CONFIRMED' ? '청구서가 확정되었습니다.' : '청구서가 저장되었습니다.');
        } catch (error) {
            console.error(error);
            alert('청구서 저장에 실패했습니다.');
        } finally {
            setBillingProcessingId('');
        }
    };

    const totals = useMemo(() => {
        const acc = {
            rentFee: 0,
            leaseFee: 0,
            ...emptyExpenseAmounts(),
            total: 0
        };
        rows.forEach(r => {
            acc.rentFee += r.rentFee;
            acc.leaseFee += r.leaseFee;
            EXPENSE_TYPES.forEach(type => {
                acc[type] += r.amounts[type] || 0;
            });
            acc.total += r.total;
        });
        return acc;
    }, [rows]);

    return (
        <div className="flex flex-col h-full w-full min-w-0 space-y-5">
            {/* Toolbar */}
            <div className="flex flex-col 2xl:flex-row 2xl:flex-wrap 2xl:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-indigo-100 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 min-w-0">
                    <div className="flex w-fit items-center bg-slate-100 rounded-full p-1">
                        <button
                            onClick={() => handleMonthChange(-1)}
                            className="w-8 h-8 flex items-center justify-center hover:bg-white hover:shadow-sm rounded-full transition text-slate-500"
                        >
                            <FontAwesomeIcon icon={faChevronLeft} />
                        </button>
                        <span className="px-4 font-bold text-slate-700 font-mono text-lg">{yearMonth}</span>
                        <button
                            onClick={() => handleMonthChange(1)}
                            className="w-8 h-8 flex items-center justify-center hover:bg-white hover:shadow-sm rounded-full transition text-slate-500"
                        >
                            <FontAwesomeIcon icon={faChevronRight} />
                        </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 min-w-0">
                        <h2 className="text-lg sm:text-xl font-bold text-slate-800 flex items-center gap-2">
                            <FontAwesomeIcon icon={faFileInvoiceDollar} className="text-indigo-500" />
                            월별 공과금(운영비) 대장
                        </h2>
                        {isDirty && (
                            <span className="px-3 py-1 bg-orange-100 text-orange-700 text-xs font-bold rounded-full animate-pulse border border-orange-200">
                                ● 수정사항 있음
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex w-full flex-wrap gap-2 sm:gap-3 items-center justify-start 2xl:w-auto 2xl:justify-end">
                    <div className="mr-0 min-w-[110px] text-left sm:text-right">
                        <div className="text-xs text-slate-500 font-bold uppercase">총 합계</div>
                        <div className="text-2xl font-extrabold text-indigo-700 font-mono">{totals.total.toLocaleString()}</div>
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
                    <div className="flex flex-wrap items-center gap-2">
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
                    <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-2 rounded-xl border border-indigo-100 hover:bg-gray-50 h-[46px] shadow-sm whitespace-nowrap">
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
                        className={`px-5 sm:px-6 py-2.5 rounded-xl font-bold text-white shadow-lg shadow-indigo-200 transition-all active:scale-95 flex items-center gap-2 whitespace-nowrap
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
                <div className={`custom-scrollbar ${isStickyHeader ? 'overflow-auto h-[calc(100vh-400px)] min-h-[400px] border-b border-indigo-100' : 'overflow-x-auto flex-1'}`}>
                    {(loadingVehicles || loading) ? (
                        <div className="h-96 flex flex-col items-center justify-center text-slate-400 gap-3">
                            <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                            <p>데이터를 불러오는 중입니다...</p>
                        </div>
                    ) : (
                        <table className="support-compact-table support-compact-ledger w-full table-fixed text-[11px] lg:text-xs">
                            <colgroup>
                                <col style={{ width: '8%' }} />
                                <col style={{ width: '6.5%' }} />
                                <col style={{ width: '8%' }} />
                                <col style={{ width: '7%' }} />
                                <col style={{ width: '6.5%' }} />
                                <col style={{ width: '5%' }} />
                                <col style={{ width: '5%' }} />
                                {EXPENSE_TYPES.map((type) => (
                                    <col key={`vehicle-expense-col-${type}`} style={{ width: '4.2%' }} />
                                ))}
                                <col style={{ width: '5.5%' }} />
                                <col style={{ width: '6.5%' }} />
                                <col style={{ width: '7%' }} />
                                <col style={{ width: '8%' }} />
                            </colgroup>
                            <thead className={`bg-indigo-600 text-white font-bold text-xs uppercase shadow-md ${isStickyHeader ? 'sticky top-0 z-20' : ''}`}>
                                <tr>
                                    <th className="px-4 py-4 text-left w-52 tracking-wider bg-indigo-700 border-r border-indigo-500">배정팀</th>
                                    <th className="px-4 py-4 text-left w-40 tracking-wider bg-indigo-700 border-r border-indigo-500">운전자</th>
                                    <th className="px-4 py-4 text-left w-52 tracking-wider bg-indigo-700 border-r border-indigo-500">청구대상</th>
                                    <th className="px-4 py-4 text-left w-44 tracking-wider bg-indigo-700">차량번호</th>
                                    <th className="px-4 py-4 text-left w-40 border-l border-indigo-500">차종/모델</th>
                                    <th className="px-2 py-4 text-right w-28 border-l border-indigo-500 bg-indigo-800/30">렌트비</th>
                                    <th className="px-2 py-4 text-right w-28 border-l border-indigo-500 bg-indigo-800/30">리스비</th>
                                    {EXPENSE_TYPES.map(type => (
                                        <th key={type} className="px-2 py-4 text-center w-28 border-l border-indigo-500">
                                            {EXPENSE_LABELS[type]}
                                        </th>
                                    ))}
                                    <th className="px-2 py-4 text-center w-32 border-l border-indigo-400 bg-indigo-500">합계</th>
                                    <th className="px-2 py-4 text-center w-28 border-l border-indigo-500">청구상태</th>
                                    <th className="px-2 py-4 text-center w-44 border-l border-indigo-500">청구작업</th>
                                    <th className="px-4 py-4 text-center w-40 border-l border-indigo-500">비고 (메모)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-indigo-50">
                                {billingRows.map(({ row, index: idx, billingState }) => {
                                    const assignmentSummary = getAssignmentSummary(row);
                                    const visibleAssignedWorkers = assignmentSummary.assignedWorkers.slice(0, 3);
                                    const billingBadge = getBillingStatusBadge(billingState.status);
                                    const isProcessing = billingProcessingId === row.id || bulkBillingAction !== '';
                                    const shouldShowPeriod = (vehicleRowCountById.get(normalizeKey(row.vehicle.id)) ?? 0) > 1;

                                    return (
                                    <tr key={row.id} className="group hover:bg-blue-50/40 transition-colors">
                                        <td
                                            className="px-4 py-3 border-r border-indigo-50 bg-white"
                                            style={assignmentSummary.primaryColor ? {
                                                borderLeft: `4px solid ${assignmentSummary.primaryColor}`,
                                                backgroundColor: `${assignmentSummary.primaryColor}0D`
                                            } : undefined}
                                        >
                                            {assignmentSummary.assignedTeams.length > 0 ? (
                                                <div className="flex flex-col gap-1.5">
                                                    {assignmentSummary.assignedTeams.map((team) => (
                                                        <div key={`assigned-${team.key}`} className="flex items-start gap-2 min-w-0">
                                                            <span
                                                                className="w-6 h-6 rounded-md flex items-center justify-center text-white text-[10px] shrink-0 mt-0.5"
                                                                style={{ backgroundColor: team.color }}
                                                            >
                                                                <FontAwesomeIcon icon={iconMap[team.icon || ''] || faUsers} />
                                                            </span>
                                                            <span className="min-w-0">
                                                                <span className="block font-bold text-slate-700 truncate max-w-[160px]" title={team.name}>
                                                                    {team.name}
                                                                </span>
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="text-slate-300 text-xs">-</span>
                                            )}
                                            {onOpenSetup && (
                                                <button
                                                    type="button"
                                                    onClick={() => onOpenSetup(row.vehicle)}
                                                    className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-100 transition-colors"
                                                    title="차량 배정/청구대상 수정"
                                                >
                                                    <FontAwesomeIcon icon={faUsers} className="text-[10px]" />
                                                    배정/청구 설정
                                                </button>
                                            )}
                                        </td>

                                        <td className="px-4 py-3 border-r border-indigo-50 bg-white">
                                            {visibleAssignedWorkers.length > 0 ? (
                                                <div className="space-y-1">
                                                    {visibleAssignedWorkers.map((workerName, workerIdx) => (
                                                        <div key={`assigned-worker-${workerName}-${workerIdx}`} className="flex items-start gap-2 min-w-0">
                                                            <span className="w-6 h-6 rounded-md flex items-center justify-center text-white text-[10px] shrink-0 bg-emerald-500 mt-0.5">
                                                                <FontAwesomeIcon icon={faUser} />
                                                            </span>
                                                            <span className="min-w-0">
                                                                <span className="block font-bold text-slate-700 text-xs leading-tight truncate max-w-[145px]" title={workerName}>
                                                                    {workerName}
                                                                </span>
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="text-slate-300 text-xs">-</span>
                                            )}
                                        </td>

                                        <td className="px-4 py-3 border-r border-indigo-50 bg-white">
                                            {assignmentSummary.billingTeams.length > 0 ? (
                                                <div className="flex flex-col gap-1.5">
                                                    {assignmentSummary.billingTeams.map((team) => (
                                                        <div key={`billing-${team.key}`} className="flex items-center gap-2 min-w-0">
                                                            <span
                                                                className="w-6 h-6 rounded-md flex items-center justify-center text-white text-[10px] shrink-0"
                                                                style={{ backgroundColor: team.color }}
                                                            >
                                                                <FontAwesomeIcon icon={
                                                                    team.targetType === 'WORKER' || team.targetType === 'OFFICE_STAFF'
                                                                        ? faUser
                                                                        : team.targetType === 'OFFICE'
                                                                            ? faBuilding
                                                                            : iconMap[team.icon || ''] || faUsers
                                                                } />
                                                            </span>
                                                            <span className="font-bold text-slate-700 truncate max-w-[160px]" title={team.name}>
                                                                {team.name}
                                                                <span className="block text-[10px] font-semibold text-slate-400">
                                                                    {team.targetLabel ? `${team.targetLabel} · ` : ''}
                                                                    {team.subLabel ? `${team.subLabel} · ` : ''}
                                                                    {shouldShowPeriod ? `${assignmentSummary.periodLabel} · ${assignmentSummary.overlapDays}일` : ''}
                                                                </span>
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="text-slate-300 text-xs">-</span>
                                            )}
                                        </td>

                                        <td className="px-4 py-3 font-bold text-slate-700 group-hover:text-indigo-700 bg-white">
                                            {row.vehicle.licensePlate}
                                            <div className="text-[10px] text-slate-400 font-normal mt-0.5">{row.vehicle.type}</div>
                                        </td>
                                        <td className="px-4 py-3 border-l border-indigo-50 text-slate-600 bg-white">{row.vehicle.model}</td>

                                        {/* 고정비 (읽기 전용) */}
                                        <td className="px-2 py-3 border-l border-indigo-50 text-right font-mono text-slate-500 bg-slate-50">
                                            {row.rentFee.toLocaleString()}
                                        </td>
                                        <td className="px-2 py-3 border-l border-indigo-50 text-right font-mono text-slate-500 bg-slate-50">
                                            {row.leaseFee.toLocaleString()}
                                        </td>

                                        {/* 변동비 (편집 가능) */}
                                        {EXPENSE_TYPES.map(type => (
                                            <EditableCell
                                                key={type}
                                                value={row.amounts[type]}
                                                onCommit={(val) => handleCellCommit(idx, type, val)}
                                                tdClassName="p-1 border-l border-indigo-50 bg-white"
                                                className={`w-full text-right p-2 focus:outline-none transition rounded-lg text-sm
                                                    text-slate-700 bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-100
                                                    ${row.amounts[type] > 500000 ? 'text-red-500 font-extrabold' : ''}
                                                `}
                                            />
                                        ))}

                                        {/* 합계 */}
                                        <td className="px-2 py-3 border-l border-indigo-50 text-right font-mono font-extrabold text-indigo-700 bg-indigo-50/30">
                                            {row.total.toLocaleString()}
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
                                                    <>
                                                        <button
                                                            type="button"
                                                            disabled={isProcessing}
                                                            onClick={() => handleCreateOrRecalculateBilling(row, 'create')}
                                                            className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:bg-indigo-300 whitespace-nowrap"
                                                        >
                                                            {isProcessing ? '처리중' : '청구'}
                                                        </button>
                                                        {shouldShowPeriod && (
                                                            <button
                                                                type="button"
                                                                disabled={isProcessing}
                                                                onClick={() => handleCreateSplitBilling(row)}
                                                                className="px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-700 text-xs font-bold border border-amber-200 hover:bg-amber-100 disabled:text-amber-300 disabled:bg-amber-50 whitespace-nowrap"
                                                            >
                                                                분할청구
                                                            </button>
                                                        )}
                                                    </>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        disabled={isProcessing}
                                                        onClick={() => handleCancelBilling(row)}
                                                        className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 text-xs font-bold hover:bg-rose-100 disabled:text-rose-300"
                                                        title="미청구"
                                                    >
                                                        미청구
                                                    </button>
                                                )}
                                            </div>
                                        </td>

                                        {/* 메모 */}
                                        <td className="p-1 border-l border-indigo-50 bg-white">
                                            <input
                                                type="text"
                                                value={row.note}
                                                onChange={(e) => handleNoteChange(idx, e.target.value)}
                                                className="w-full p-2 focus:outline-none focus:bg-indigo-50 focus:ring-1 focus:ring-indigo-200 rounded-lg text-xs text-slate-600 bg-transparent text-center"
                                                placeholder="입력..."
                                            />
                                        </td>
                                    </tr>
                                    );
                                })}
                                {billingRows.length === 0 && (
                                    <tr>
                                        <td colSpan={EXPENSE_TYPES.length + 12} className="p-20 text-center text-slate-400 bg-slate-50/50">
                                            <div className="flex flex-col items-center gap-3">
                                                <FontAwesomeIcon icon={faCar} className="text-4xl text-slate-300" />
                                                <p>조건에 맞는 차량 대장 행이 없습니다.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                            <tfoot className="bg-slate-800 text-white font-bold text-sm tracking-wide sticky bottom-0 z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                                <tr>
                                    <td colSpan={6} className="p-4 border-r border-slate-600 text-center">합계</td>
                                    <td className="p-4 border-r border-slate-600 text-right font-mono text-amber-200/70">{totals.rentFee.toLocaleString()}</td>
                                    <td className="p-4 border-r border-slate-600 text-right font-mono text-amber-200/70">{totals.leaseFee.toLocaleString()}</td>
                                    {EXPENSE_TYPES.map(type => (
                                        <td key={type} className="p-4 border-r border-slate-600 text-right font-mono">
                                            {totals[type].toLocaleString()}
                                        </td>
                                    ))}
                                    <td className="p-4 border-r border-slate-600 text-right font-mono text-amber-300 text-lg">
                                        {totals.total.toLocaleString()}
                                    </td>
                                    <td colSpan={3} className="bg-slate-900 border-l border-slate-700"></td>
                                </tr>
                            </tfoot>
                        </table>
                    )}
                </div>
            </div>

            {/* 입력 가이드 */}
            <div className="flex items-start gap-4 p-4 bg-amber-50 rounded-xl border border-amber-200 shadow-sm">
                <div className="bg-amber-100 p-2 rounded-full text-amber-600">
                    <FontAwesomeIcon icon={faExclamationTriangle} />
                </div>
                <div>
                    <h4 className="font-bold text-amber-800 text-sm mb-1">입력 가이드</h4>
                    <p className="text-xs text-amber-700 leading-relaxed">
                        * <strong>렌트비/리스비</strong>는 차량 계약 정보에 따라 자동 계산되므로 수정할 수 없습니다.<br />
                        * 그 외 <strong>주유비, 수리비, 과태료</strong> 등은 직접 입력 가능합니다.<br />
                        * 같은 달에 청구대상이 나뉜 차량은 <strong>[분할청구]</strong>로 미청구 기간을 한 번에 처리합니다.<br />
                        * 변경 후 반드시 <strong>[전체 저장]</strong> 버튼을 눌러주세요.
                    </p>
                </div>
            </div>

            {billingEditor && (
                <LedgerBillingEditorModal<VehicleBillingCostItem>
                    title={`${billingEditor.document.vehiclePlate} 차량 청구서`}
                    subtitle={`${billingEditor.document.yearMonth} · ${billingEditor.document.teamName || billingEditor.document.issuedToWorkerName || '청구대상'}`}
                    statusLabel={billingEditor.document.status === 'CONFIRMED' ? '확정' : '작성중'}
                    readOnly={billingEditor.document.status === 'CONFIRMED'}
                    lineItems={billingEditor.document.lineItems ?? []}
                    memo={billingEditor.document.memo ?? ''}
                    saving={billingProcessingId === billingEditor.row.id}
                    onClose={() => setBillingEditor(null)}
                    onSave={(lineItems, memo) => handleSaveBillingEditor(lineItems, memo)}
                    onConfirm={(lineItems, memo) => handleSaveBillingEditor(lineItems, memo, 'CONFIRMED')}
                />
            )}
        </div>
    );
};
