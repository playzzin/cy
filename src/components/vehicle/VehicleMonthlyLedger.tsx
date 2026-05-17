import React, { useEffect, useMemo, useState, useCallback, useRef, memo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCar, faChevronLeft, faChevronRight, faFileInvoiceDollar, faSave, faExclamationTriangle, faUsers, faUser, faPen, faRotateRight, faEye, faBan } from '@fortawesome/free-solid-svg-icons';
import { vehicleService } from '../../services/vehicleService';
import { vehicleBillingService } from '../../services/vehicleBillingService';
import { Vehicle, VehicleAssigneeType, VehicleAssignmentRecord, VehicleExpenseRecord, VehicleExpenseType } from '../../types/vehicle';
import { VehicleBillingCostItem, VehicleBillingDocument } from '../../types/vehicleBilling';
import { Team } from '../../services/teamService';
import { Worker, manpowerService } from '../../services/manpowerService';
import { iconMap } from '../../constants/iconMap';
import { Timestamp } from 'firebase/firestore';
import LedgerBillingEditorModal from '../support/LedgerBillingEditorModal';

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

interface VehicleLedgerSegment {
    id: string;
    assigneeId?: string;
    assigneeType?: VehicleAssigneeType;
    assigneeName?: string;
    teamId?: string;
    teamName?: string;
    startDate: string;
    endDate: string;
    overlapDays: number;
}

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
    variableTotal: number;
    total: number;
    note: string;
}

interface VehicleMonthlyLedgerProps {
    vehicles: Vehicle[];
    teams?: Team[];
    teamFilterId?: string;
    loadingVehicles: boolean;
}

type BillingFilter = 'all' | 'unbilled' | 'draft' | 'confirmed' | 'blocked';
type BillingRowStatus = 'unbilled' | 'draft' | 'confirmed' | 'partial' | 'blocked';

const sanitizeBillingIdPart = (value: unknown): string => {
    const text = String(value ?? '').trim();
    return ['/', '#', '[', ']', '?'].reduce((safe, char) => safe.split(char).join('_'), text || 'row');
};

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

export const VehicleMonthlyLedger: React.FC<VehicleMonthlyLedgerProps> = ({
    vehicles,
    teams = [],
    teamFilterId = '',
    loadingVehicles
}) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [yearMonth, setYearMonth] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [isStickyHeader, setIsStickyHeader] = useState(false); // Sticky header toggle

    const [rows, setRows] = useState<VehicleLedgerRow[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [billingDocuments, setBillingDocuments] = useState<VehicleBillingDocument[]>([]);
    const [billingFilter, setBillingFilter] = useState<BillingFilter>('all');
    const [billingProcessingId, setBillingProcessingId] = useState('');
    const [billingEditor, setBillingEditor] = useState<{ row: VehicleLedgerRow; document: VehicleBillingDocument } | null>(null);
    const originalExpensesRef = useRef<VehicleExpenseRecord[]>([]);

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
        manpowerService.getWorkers()
            .then((data) => {
                if (mounted) setWorkers(data);
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
        return {
            teamId: normalizeKey(worker?.teamId),
            teamName: normalizeKey(worker?.teamName)
        };
    }, [teamByAnyId, teamByName, workerByAnyId, workerByName]);

    const buildSegmentsForVehicle = useCallback((
        vehicle: Vehicle,
        assignmentList: VehicleAssignmentRecord[]
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

        const rows = activeAssignments.flatMap((entry, index): VehicleLedgerSegment[] => {
            const nextStartDate = activeAssignments[index + 1]?.startDate ?? null;
            const explicitEndDate = entry.endDate ?? monthRange.monthEnd;
            const handoffEndDate = nextStartDate ? addDays(nextStartDate, -1) : monthRange.monthEnd;
            const segmentStart = maxDate(entry.startDate ?? monthRange.monthStart, monthRange.monthStart);
            const segmentEnd = minDate(explicitEndDate, handoffEndDate, monthRange.monthEnd);
            const overlapDays = inclusiveDays(segmentStart, segmentEnd);
            if (overlapDays <= 0) return [];

            const team = resolveAssigneeTeam(entry.assignment);
            return [{
                id: normalizeKey(entry.assignment.id) || `${vehicle.id}:${index}`,
                assigneeId: normalizeKey(entry.assignment.assigneeId),
                assigneeType: entry.assignment.assigneeType,
                assigneeName: normalizeKey(entry.assignment.assigneeName),
                teamId: team.teamId,
                teamName: team.teamName,
                startDate: formatYmdDate(segmentStart),
                endDate: formatYmdDate(segmentEnd),
                overlapDays
            }];
        });

        if (rows.length > 0) return rows;

        return [{
            id: `unassigned-${vehicle.id}`,
            startDate: formatYmdDate(monthRange.monthStart),
            endDate: formatYmdDate(monthRange.monthEnd),
            overlapDays: monthRange.daysInMonth
        }];
    }, [monthRange, resolveAssigneeTeam]);

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
            row.segment.teamId,
            row.segment.assigneeType === 'TEAM' ? row.segment.assigneeId : ''
        ].map((value) => normalizeKey(value)).filter(Boolean);

        const candidateNames = [
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
            const [expenses, assignmentList, billings] = await Promise.all([
                vehicleService.getExpensesByMonth(yearMonth),
                vehicleService.listAllVehicleAssignments().catch(() => [] as VehicleAssignmentRecord[]),
                vehicleBillingService.getBillingsByMonth(yearMonth).catch(() => [] as VehicleBillingDocument[])
            ]);
            originalExpensesRef.current = expenses;
            setBillingDocuments(billings);

            const newRows: VehicleLedgerRow[] = vehicles.flatMap(v => {
                const fixed = v.contract?.monthlyFee ?? 0;
                const segments = buildSegmentsForVehicle(v, assignmentList);
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
            const typeOrder = (t: string) => (t === 'RENT' ? 0 : t === 'LEASE' ? 1 : 2);
            visibleRows.sort((a, b) => {
                const pa = typeOrder(a.vehicle.type || '');
                const pb = typeOrder(b.vehicle.type || '');
                if (pa !== pb) return pa - pb;
                const plateCmp = String(a.vehicle.licensePlate).localeCompare(String(b.vehicle.licensePlate), 'ko-KR');
                if (plateCmp !== 0) return plateCmp;
                return String(a.segment.startDate).localeCompare(String(b.segment.startDate));
            });
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
            icon: team?.icon || team?.iconKey || null
        };
    };

    const getAssignmentSummary = (row: VehicleLedgerRow) => {
        const teamMap = new Map<string, NonNullable<ReturnType<typeof resolveSegmentTeamBadge>>>();
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
        const buildTeamBadge = (teamId?: string | null, teamName?: string | null) => {
            const rawTeamId = normalizeKey(teamId);
            const rawTeamName = normalizeKey(teamName);
            const team = rawTeamId ? teamByAnyId.get(rawTeamId) : teamByName.get(rawTeamName);
            const name = normalizeKey(team?.name ?? rawTeamName);
            if (!name) return null;
            return {
                key: `team:${normalizeKey(team?.id ?? rawTeamId ?? name)}`,
                name,
                color: team?.color || '#94a3b8',
                icon: team?.icon || team?.iconKey || null
            };
        };

        let billingTeams = assignedTeams;
        let billingWorkers = assignedWorkers;
        if (row.vehicle.billingTargetType === 'TEAM') {
            const badge = buildTeamBadge(row.vehicle.billingTargetId, row.vehicle.billingTargetName);
            billingTeams = badge ? [badge] : [];
            billingWorkers = [];
        } else if (row.vehicle.billingTargetType === 'WORKER') {
            const targetId = normalizeKey(row.vehicle.billingTargetId);
            const targetName = normalizeKey(row.vehicle.billingTargetName);
            const worker = targetId ? workerByAnyId.get(targetId) : workerByName.get(targetName);
            const workerName = normalizeKey(worker?.name ?? targetName);
            const badge = buildTeamBadge(worker?.teamId ?? segment.teamId, worker?.teamName ?? segment.teamName);
            billingTeams = badge ? [badge] : [];
            billingWorkers = workerName ? [workerName] : [];
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
        const targetType = row.vehicle.billingTargetType || row.segment.assigneeType;
        const targetId = normalizeKey(row.vehicle.billingTargetType ? row.vehicle.billingTargetId : row.segment.assigneeId);
        const targetName = normalizeKey(row.vehicle.billingTargetType ? row.vehicle.billingTargetName : row.segment.assigneeName);

        if (targetType === 'TEAM') {
            const team = targetId ? teamByAnyId.get(targetId) : teamByName.get(targetName);
            return {
                issuedToType: 'team' as const,
                teamIds: toKeySet([targetId, row.segment.teamId, team?.id, team?.legacyId]),
                teamNames: toKeySet([targetName, row.segment.teamName, team?.name]),
                workerIds: new Set<string>(),
                workerNames: new Set<string>()
            };
        }

        if (targetType === 'WORKER') {
            const worker = targetId ? workerByAnyId.get(targetId) : workerByName.get(targetName);
            return {
                issuedToType: 'worker' as const,
                teamIds: toKeySet([worker?.teamId, row.segment.teamId]),
                teamNames: toKeySet([worker?.teamName, row.segment.teamName]),
                workerIds: toKeySet([targetId, worker?.id, worker?.legacyId]),
                workerNames: toKeySet([targetName, worker?.name])
            };
        }

        return null;
    }, [teamByAnyId, teamByName, workerByAnyId, workerByName]);

    const resolveVehicleBillingTarget = useCallback((row: VehicleLedgerRow) => {
        const targetType = row.vehicle.billingTargetType || row.segment.assigneeType;
        const targetId = normalizeKey(row.vehicle.billingTargetType ? row.vehicle.billingTargetId : row.segment.assigneeId);
        const targetName = normalizeKey(row.vehicle.billingTargetType ? row.vehicle.billingTargetName : row.segment.assigneeName);

        if (targetType === 'TEAM') {
            const team = targetId ? teamByAnyId.get(targetId) : teamByName.get(targetName);
            const teamId = normalizeKey(team?.id ?? targetId ?? row.segment.teamId);
            const teamName = normalizeKey(team?.name ?? targetName ?? row.segment.teamName);
            if (!teamId) return null;
            return {
                issuedToType: 'team' as const,
                teamId,
                teamName,
                assignedTeamId: normalizeKey(row.segment.teamId),
                assignedTeamName: normalizeKey(row.segment.teamName),
                issuedToWorkerId: undefined,
                issuedToWorkerName: undefined
            };
        }

        if (targetType === 'WORKER') {
            const worker = targetId ? workerByAnyId.get(targetId) : workerByName.get(targetName);
            const workerId = normalizeKey(worker?.id ?? targetId);
            const workerName = normalizeKey(worker?.name ?? targetName);
            const team = worker?.teamId
                ? teamByAnyId.get(String(worker.teamId))
                : (row.segment.teamId ? teamByAnyId.get(String(row.segment.teamId)) : teamByName.get(normalizeKey(row.segment.teamName)));
            const teamId = normalizeKey(team?.id ?? worker?.teamId ?? row.segment.teamId);
            const teamName = normalizeKey(team?.name ?? worker?.teamName ?? row.segment.teamName);
            if (!workerId || !teamId) return null;
            return {
                issuedToType: 'worker' as const,
                teamId,
                teamName,
                assignedTeamId: normalizeKey(row.segment.teamId),
                assignedTeamName: normalizeKey(row.segment.teamName),
                issuedToWorkerId: workerId,
                issuedToWorkerName: workerName
            };
        }

        return null;
    }, [teamByAnyId, teamByName, workerByAnyId, workerByName]);

    const getVehicleLedgerRowDocumentSuffix = useCallback((row: VehicleLedgerRow): string => {
        return `__row_${sanitizeBillingIdPart(row.segment.id || row.id)}`;
    }, []);

    const hasVehicleLedgerRowMarker = useCallback((doc: VehicleBillingDocument, row: VehicleLedgerRow): boolean => {
        const suffix = getVehicleLedgerRowDocumentSuffix(row);
        if (normalizeKey(doc.id).endsWith(suffix)) return true;
        return (doc.lineItems ?? []).some((item) => (
            normalizeKey(item.sourceLedgerRowId) === normalizeKey(row.id) ||
            normalizeKey(item.sourceSegmentId) === normalizeKey(row.segment.id)
        ));
    }, [getVehicleLedgerRowDocumentSuffix]);

    const matchesVehicleBillingDocument = useCallback((doc: VehicleBillingDocument, row: VehicleLedgerRow) => {
        if (normalizeKey(doc.vehicleId) !== normalizeKey(row.vehicle.id)) return false;
        if (normalizeKey(doc.yearMonth) !== normalizeKey(yearMonth)) return false;

        const identity = resolveVehicleBillingIdentity(row);
        if (!identity) return false;
        if (normalizeKey(doc.issuedToType) !== identity.issuedToType) return false;

        const docTeamIds = toKeySet([doc.teamId, doc.assignedTeamId]);
        const docTeamNames = toKeySet([doc.teamName, doc.assignedTeamName]);
        const teamMatches = intersects(identity.teamIds, docTeamIds) || intersects(identity.teamNames, docTeamNames);
        if (!teamMatches) return false;

        if (identity.issuedToType === 'worker') {
            const docWorkerIds = toKeySet([doc.issuedToWorkerId]);
            const docWorkerNames = toKeySet([doc.issuedToWorkerName]);
            if (!(intersects(identity.workerIds, docWorkerIds) || intersects(identity.workerNames, docWorkerNames))) return false;
        }

        const hasLedgerMarkers = normalizeKey(doc.id).includes('__row_') || (doc.lineItems ?? []).some((item) => (
            item.sourceType === 'vehicle_ledger' ||
            Boolean(item.sourceLedgerRowId) ||
            Boolean(item.sourceSegmentId)
        ));

        if (hasLedgerMarkers) {
            return hasVehicleLedgerRowMarker(doc, row);
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
        const identity = resolveVehicleBillingIdentity(row);
        if (!identity || (identity.teamIds.size === 0 && identity.teamNames.size === 0)) {
            return { status: 'blocked', documents: [], reason: '청구대상 없음' };
        }
        if (row.total <= 0) {
            return { status: 'blocked', documents: [], reason: '금액 없음' };
        }

        const documents = getBillingDocumentsForRow(row);
        if (documents.length === 0) return { status: 'unbilled', documents };

        const confirmedCount = documents.filter((doc) => doc.status === 'CONFIRMED').length;
        if (confirmedCount === documents.length) return { status: 'confirmed', documents };
        if (confirmedCount > 0) return { status: 'partial', documents };
        return { status: 'draft', documents };
    }, [getBillingDocumentsForRow, resolveVehicleBillingIdentity]);

    const billingRows = useMemo(() => {
        return rows
            .map((row, index) => ({ row, index, billingState: getRowBillingState(row) }))
            .filter(({ billingState }) => {
                if (billingFilter === 'all') return true;
                if (billingFilter === 'draft') return billingState.status === 'draft' || billingState.status === 'partial';
                return billingState.status === billingFilter;
            });
    }, [rows, billingFilter, getRowBillingState]);

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

    const buildLineItemsForRow = (row: VehicleLedgerRow): VehicleBillingCostItem[] => {
        const source = {
            sourceType: 'vehicle_ledger' as const,
            sourceLedgerRowId: row.id,
            sourceSegmentId: row.segment.id,
            sourceStartDate: row.segment.startDate,
            sourceEndDate: row.segment.endDate
        };
        const lineItems: VehicleBillingCostItem[] = [];

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

    const buildBillingDocumentForRow = (
        row: VehicleLedgerRow,
        existing?: VehicleBillingDocument
    ): VehicleBillingDocument | null => {
        const target = resolveVehicleBillingTarget(row);
        if (!target) return null;

        const lineItems = buildLineItemsForRow(row);
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
            id: existing?.id ?? `${baseId}${getVehicleLedgerRowDocumentSuffix(row)}`,
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

    const handleCreateOrRecalculateBilling = async (row: VehicleLedgerRow, mode: 'create' | 'recalculate') => {
        const state = getRowBillingState(row);
        const existing = state.documents[0];
        if (isDirty) {
            alert('청구 전 변경사항을 먼저 전체 저장해주세요.');
            return;
        }
        if (state.status === 'blocked') {
            alert(state.reason || '청구할 수 없는 행입니다.');
            return;
        }
        if (existing?.status === 'CONFIRMED') {
            alert('확정된 청구서는 대장에서 재계산할 수 없습니다.');
            return;
        }

        setBillingProcessingId(row.id);
        try {
            const next = buildBillingDocumentForRow(row, existing);
            if (!next) {
                alert('배정 이력과 금액 기준으로 생성할 청구 문서를 찾지 못했습니다.');
                return;
            }

            await vehicleBillingService.saveBilling(next);
            await loadData();
            alert(mode === 'recalculate' ? '청구서가 재계산되었습니다.' : '청구서가 생성되었습니다.');
        } catch (error) {
            console.error(error);
            alert('청구 처리에 실패했습니다.');
        } finally {
            setBillingProcessingId('');
        }
    };

    const handleCancelBilling = async (row: VehicleLedgerRow, document?: VehicleBillingDocument) => {
        if (!document) return;
        if (document.status === 'CONFIRMED') {
            alert('확정된 청구서는 취소할 수 없습니다.');
            return;
        }
        if (!window.confirm('작성중 청구서를 취소할까요?')) return;

        setBillingProcessingId(row.id);
        try {
            await vehicleBillingService.deleteBilling(document.id);
            await loadData();
            alert('청구가 취소되었습니다.');
        } catch (error) {
            console.error(error);
            alert('청구 취소에 실패했습니다.');
        } finally {
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
            <div className="flex flex-wrap justify-between items-center gap-4 bg-white p-5 rounded-2xl border border-indigo-100 shadow-sm">
                <div className="flex items-center gap-6">
                    <div className="flex items-center bg-slate-100 rounded-full p-1">
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

                    <div className="flex items-center gap-3">
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
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

                <div className="flex flex-wrap gap-3 items-center justify-start lg:justify-end">
                    <div className="text-right mr-4">
                        <div className="text-xs text-slate-500 font-bold uppercase">총 합계</div>
                        <div className="text-2xl font-extrabold text-indigo-700 font-mono">{totals.total.toLocaleString()}</div>
                    </div>
                    <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
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
                    <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-2 rounded-xl border border-indigo-100 hover:bg-gray-50 h-[46px] shadow-sm">
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
                        className={`px-6 py-2.5 rounded-xl font-bold text-white shadow-lg shadow-indigo-200 transition-all active:scale-95 flex items-center gap-2
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
                                <col style={{ width: '6%' }} />
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
                                    <th className="px-4 py-4 text-left w-40 tracking-wider bg-indigo-700 border-r border-indigo-500">배정 인원</th>
                                    <th className="px-4 py-4 text-left w-52 tracking-wider bg-indigo-700 border-r border-indigo-500">청구대상 팀</th>
                                    <th className="px-4 py-4 text-left w-52 tracking-wider bg-indigo-700 border-r border-indigo-500">청구대상 개인</th>
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
                                    const firstBillingDocument = billingState.documents[0];
                                    const isProcessing = billingProcessingId === row.id;

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
                                                                <span className="block text-[10px] font-semibold text-slate-400">
                                                                    {assignmentSummary.periodLabel} · {assignmentSummary.overlapDays}일
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
                                                                <span className="block text-[10px] font-semibold text-slate-400">
                                                                    {assignmentSummary.periodLabel} · {assignmentSummary.overlapDays}일
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
                                            {assignmentSummary.billingWorkers.length > 0 ? (
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

                                        <td className="px-4 py-3 font-bold text-slate-700 group-hover:text-indigo-700 bg-white">
                                            {row.vehicle.licensePlate}
                                            <div className="text-[10px] text-slate-400 font-normal mt-0.5">{row.vehicle.type}</div>
                                            <div className="text-[10px] text-indigo-400 font-semibold mt-0.5">{assignmentSummary.periodLabel}</div>
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
                                                    <button
                                                        type="button"
                                                        disabled={isProcessing}
                                                        onClick={() => handleCreateOrRecalculateBilling(row, 'create')}
                                                        className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:bg-indigo-300"
                                                    >
                                                        {isProcessing ? '처리중' : '청구'}
                                                    </button>
                                                ) : (
                                                    <>
                                                        <button
                                                            type="button"
                                                            disabled={!firstBillingDocument}
                                                            onClick={() => firstBillingDocument && setBillingEditor({ row, document: firstBillingDocument })}
                                                            className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:text-slate-300"
                                                            title={firstBillingDocument?.status === 'CONFIRMED' ? '청구서 보기' : '청구서 수정'}
                                                        >
                                                            <FontAwesomeIcon icon={firstBillingDocument?.status === 'CONFIRMED' ? faEye : faPen} />
                                                        </button>
                                                        {firstBillingDocument?.status !== 'CONFIRMED' && (
                                                            <>
                                                            <button
                                                                type="button"
                                                                disabled={isProcessing}
                                                                onClick={() => handleCreateOrRecalculateBilling(row, 'recalculate')}
                                                                className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:text-amber-300"
                                                                title="대장 기준 재계산"
                                                            >
                                                                <FontAwesomeIcon icon={faRotateRight} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                disabled={isProcessing}
                                                                onClick={() => handleCancelBilling(row, firstBillingDocument)}
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
