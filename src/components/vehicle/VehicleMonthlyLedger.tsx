import React, { useEffect, useMemo, useState, useCallback, useRef, memo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCar, faChevronLeft, faChevronRight, faFileInvoiceDollar, faSave, faExclamationTriangle, faUsers, faUser } from '@fortawesome/free-solid-svg-icons';
import { vehicleService } from '../../services/vehicleService';
import { Vehicle, VehicleAssigneeType, VehicleAssignmentRecord, VehicleExpenseRecord, VehicleExpenseType } from '../../types/vehicle';
import { Team } from '../../services/teamService';
import { Worker, manpowerService } from '../../services/manpowerService';
import { iconMap } from '../../constants/iconMap';

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

        if (vehicle.currentAssigneeName && vehicle.currentAssigneeType) {
            const fallbackAssignment = {
                assigneeId: vehicle.currentAssigneeId || '',
                assigneeType: vehicle.currentAssigneeType,
                assigneeName: vehicle.currentAssigneeName
            };
            const team = resolveAssigneeTeam(fallbackAssignment);
            return [{
                id: `current-${vehicle.id}`,
                assigneeId: normalizeKey(vehicle.currentAssigneeId),
                assigneeType: vehicle.currentAssigneeType,
                assigneeName: normalizeKey(vehicle.currentAssigneeName),
                teamId: team.teamId,
                teamName: team.teamName,
                startDate: formatYmdDate(monthRange.monthStart),
                endDate: formatYmdDate(monthRange.monthEnd),
                overlapDays: monthRange.daysInMonth
            }];
        }

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
            const [expenses, assignmentList] = await Promise.all([
                vehicleService.getExpensesByMonth(yearMonth),
                vehicleService.listAllVehicleAssignments().catch(() => [] as VehicleAssignmentRecord[])
            ]);
            originalExpensesRef.current = expenses;

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
        const periodLabel = segment.startDate === segment.endDate
            ? segment.startDate
            : `${segment.startDate} ~ ${segment.endDate}`;
        return {
            assignedTeams,
            assignedWorkers,
            billingTeams: assignedTeams,
            billingWorkers: assignedWorkers,
            primaryColor: assignedTeams[0]?.color || '#94a3b8',
            periodLabel,
            overlapDays: segment.overlapDays
        };
    };

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
        <div className="flex flex-col h-full space-y-5">
            {/* Toolbar */}
            <div className="flex justify-between items-center bg-white p-5 rounded-2xl border border-indigo-100 shadow-sm">
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

                <div className="flex gap-4 items-center">
                    <div className="text-right mr-4">
                        <div className="text-xs text-slate-500 font-bold uppercase">총 합계</div>
                        <div className="text-2xl font-extrabold text-indigo-700 font-mono">{totals.total.toLocaleString()}</div>
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
                        <table className="w-full text-sm min-w-[1750px]">
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
                                    <th className="px-4 py-4 text-center w-40 border-l border-indigo-500">비고 (메모)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-indigo-50">
                                {rows.map((row, idx) => {
                                    const assignmentSummary = getAssignmentSummary(row);
                                    const visibleAssignedWorkers = assignmentSummary.assignedWorkers.slice(0, 3);

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
                                {rows.length === 0 && (
                                    <tr>
                                        <td colSpan={EXPENSE_TYPES.length + 10} className="p-20 text-center text-slate-400 bg-slate-50/50">
                                            <div className="flex flex-col items-center gap-3">
                                                <FontAwesomeIcon icon={faCar} className="text-4xl text-slate-300" />
                                                <p>차량 목록이 없거나 불러올 수 없습니다.</p>
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
                                    <td className="bg-slate-900 border-l border-slate-700"></td>
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
        </div>
    );
};
