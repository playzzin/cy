import React, { useEffect, useMemo, useState, useCallback, useRef, memo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBuilding, faCar, faChevronLeft, faChevronRight, faFileInvoiceDollar, faSave, faExclamationTriangle, faUsers, faUser } from '@fortawesome/free-solid-svg-icons';
import { Route, Sparkles, TriangleAlert } from 'lucide-react';
import { vehicleService } from '../../services/vehicleService';
import { isPostedVehicleBillingStatus, vehicleBillingService } from '../../services/vehicleBillingService';
import { vehicleMonthlyLedgerMutationService } from '../../services/vehicleMonthlyLedgerMutationService';
import { vehicleMonthlyLedgerBillingService } from '../../services/vehicleMonthlyLedgerBillingService';
import { teamSettlementProtectionService, type ConfirmedTeamSettlementKeys } from '../../services/teamSettlementProtectionService';
import { Vehicle, VehicleAssigneeType, VehicleAssignmentRecord, VehicleBillingTargetRecord, VehicleBillingTargetType, VehicleExpenseRecord, VehicleExpenseType, VehicleFineChargeTarget, VehicleFineDriverBillingTarget } from '../../types/vehicle';
import { VehicleBillingCostItem, VehicleBillingDocument } from '../../types/vehicleBilling';
import { Team } from '../../services/teamService';
import { Worker, manpowerService } from '../../services/manpowerService';
import { OfficeStaff, officeStaffService } from '../../services/officeStaffService';
import { iconMap } from '../../constants/iconMap';
import { Timestamp } from 'firebase/firestore';
import SupportSaveFeedback, { SupportSaveFeedbackState } from '../support/SupportSaveFeedback';
import VehicleFineImportModal from './VehicleFineImportModal';
import VehicleTollImportModal from './VehicleTollImportModal';
import { OFFICE_ASSIGNMENT_TEAM_ID, OFFICE_ASSIGNMENT_TEAM_NAME, isOfficeStaffAssignmentReference } from '../../utils/supportAssignmentTargets';
import { DEFAULT_SUPPORT_BILLING_START_DATE, isSupportBillingMonthEnabled, maxIsoDate, minIsoDate } from '../../utils/supportBillingPeriod';
import { getContrastingTextColor } from '../../utils/color';
import {
    getSupportManagementMonthDate,
    rememberSupportManagementYearMonth,
    subscribeSupportManagementYearMonth,
} from '../../utils/supportManagementState';
import { normalizeVehicleExpenseType } from '../../utils/vehicleExpenseType';
import { SUPPORT_WRITE_RETRY_USER_MESSAGE } from '../../utils/supportWriteErrorReporting';

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
const normalizeLedgerSearchText = (value: unknown): string => normalizeKey(value).replace(/\s+/g, '').toLowerCase();

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

const allocateFixedCostByBillingTargets = (fixedCost: number, segments: VehicleLedgerSegment[]): number[] => {
    if (fixedCost <= 0 || segments.length === 0) return segments.map(() => 0);

    const baseAmount = Math.floor(fixedCost / segments.length);
    const remainder = fixedCost - (baseAmount * segments.length);
    let allocated = 0;
    return segments.map((_, index) => {
        if (index === segments.length - 1) {
            return fixedCost - allocated;
        }
        const share = baseAmount + (index < remainder ? 1 : 0);
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
    fineDriverBillingTarget?: VehicleFineDriverBillingTarget;
    variableTotal: number;
    total: number;
    note: string;
}

interface FineDriverEditorState {
    row: VehicleLedgerRow;
    selectedWorkerId: string;
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

const getFineChargeTargetForPeriod = (vehicle: Vehicle, segment: Pick<VehicleLedgerSegment, 'endDate'>): VehicleFineChargeTarget => {
    const defaultTarget = vehicle.fineChargeTarget ?? 'BILLING_TARGET';
    const effectiveDate = normalizeKey(vehicle.fineChargeTargetEffectiveDate);
    // New defaults are forward-only. Historical months need an explicit
    // monthly correction instead of being recalculated from today's setting.
    if (effectiveDate && normalizeKey(segment.endDate) < effectiveDate) return 'BILLING_TARGET';
    return defaultTarget;
};

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
    fineImportVehicles?: Vehicle[];
    teams?: Team[];
    teamFilterId?: string;
    searchText?: string;
    loadingVehicles: boolean;
    onOpenSetup?: (vehicle: Vehicle) => void;
}

const sanitizeBillingIdPart = (value: unknown): string => {
    const text = String(value ?? '').trim();
    return ['/', '#', '[', ']', '?'].reduce((safe, char) => safe.split(char).join('_'), text || 'row');
};

export const VehicleMonthlyLedger: React.FC<VehicleMonthlyLedgerProps> = ({
    vehicles,
    fineImportVehicles = vehicles,
    teams = [],
    teamFilterId = '',
    searchText = '',
    loadingVehicles,
    onOpenSetup
}) => {
    const [currentDate, setCurrentDate] = useState(getSupportManagementMonthDate);
    const [yearMonth, setYearMonth] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [saveFeedback, setSaveFeedback] = useState<SupportSaveFeedbackState | null>(null);
    const [fineImportOpen, setFineImportOpen] = useState(false);
    const [tollImportOpen, setTollImportOpen] = useState(false);
    const [isStickyHeader, setIsStickyHeader] = useState(false); // Sticky header toggle

    const [rows, setRows] = useState<VehicleLedgerRow[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [officeStaffRows, setOfficeStaffRows] = useState<OfficeStaff[]>([]);
    const [billingDocuments, setBillingDocuments] = useState<VehicleBillingDocument[]>([]);
    const [billingProcessingId, setBillingProcessingId] = useState('');
    const [fineDriverEditor, setFineDriverEditor] = useState<FineDriverEditorState | null>(null);
    const [dirtyRowIds, setDirtyRowIds] = useState<Set<string>>(() => new Set());
    const [billingRetryRowIds, setBillingRetryRowIds] = useState<Set<string>>(() => new Set());
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

    const fineDriverOptions = useMemo(() => workers
        .filter((worker) => Boolean(normalizeKey(worker.id)) && Boolean(normalizeKey(worker.name)))
        .map((worker) => {
            const team = normalizeKey(worker.teamId)
                ? teamByAnyId.get(normalizeKey(worker.teamId))
                : teamByName.get(normalizeKey(worker.teamName));
            return {
                workerId: normalizeKey(worker.id),
                workerName: normalizeKey(worker.name),
                teamId: normalizeKey(team?.id ?? worker.teamId),
                teamName: normalizeKey(team?.name ?? worker.teamName)
            } satisfies VehicleFineDriverBillingTarget;
        })
        .sort((left, right) => (
            `${left.teamName ?? ''} ${left.workerName}`.localeCompare(
                `${right.teamName ?? ''} ${right.workerName}`,
                'ko-KR'
            )
        )), [teamByAnyId, teamByName, workers]);

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
        setBillingRetryRowIds(new Set());
    }, [yearMonth]);

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
        const firstBillingTargetStart = minIsoDate(
            ...billingTargetList
                .filter((target) => normalizeKey(target.vehicleId) === vehicleId)
                .map((target) => target.startDate)
        );
        const billingStartDate = maxIsoDate(
            DEFAULT_SUPPORT_BILLING_START_DATE,
            vehicle.contract?.startDate,
            firstBillingTargetStart
        );
        if (!isSupportBillingMonthEnabled(yearMonth, billingStartDate)) return [];

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
    }, [monthRange, resolveAssigneeTeam, teamByAnyId, teamByName, workerByAnyId, workerByName, yearMonth]);

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

    const rowMatchesSearchText = useCallback((row: VehicleLedgerRow, rawSearchText: string): boolean => {
        const query = normalizeLedgerSearchText(rawSearchText);
        if (!query) return true;

        return [
            row.vehicle.licensePlate,
            row.vehicle.model,
            row.vehicle.currentAssigneeName,
            row.vehicle.contract?.financeCompany?.name,
            row.vehicle.insurance?.company,
            row.vehicle.memo,
            row.segment.assigneeName,
            row.segment.teamName,
            row.segment.billingTargetName,
            row.segment.billingTeamName
        ].some((value) => normalizeLedgerSearchText(value).includes(query));
    }, []);

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
            setBillingDocuments(billings);

            const activeVehicles = vehicles.filter((vehicle) => (vehicle.status || 'AVAILABLE') !== 'DISPOSED');
            const newRows: VehicleLedgerRow[] = activeVehicles.flatMap(v => {
                const fixed = v.contract?.monthlyFee ?? 0;
                const segments = buildSegmentsForVehicle(v, assignmentList, billingTargetList);
                const fixedShares = allocateFixedCostByBillingTargets(fixed, segments);

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
                        fineChargeTarget: getFineChargeTargetForPeriod(v, segment),
                        variableTotal: 0,
                        total: rentFee + leaseFee,
                        note: ''
                    };
                });
            });

            expenses.forEach((expense) => {
                const vehicleRows = newRows.filter((row) => normalizeKey(row.vehicle.id) === normalizeKey(expense.vehicleId));
                if (vehicleRows.length === 0) return;
                const expenseType = normalizeVehicleExpenseType(expense.type, expense.note, expense.id);
                const amount = Number(expense.amount ?? 0);
                if (!Number.isFinite(amount)) return;

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
                    [expenseType]: (row.amounts[expenseType] ?? 0) + amount
                };
                if (expenseType === 'FINE' && expense.fineChargeTarget === 'DRIVER') {
                    row.fineChargeTarget = 'DRIVER';
                    if (expense.fineDriverBillingTarget) {
                        row.fineDriverBillingTarget = expense.fineDriverBillingTarget;
                    }
                }
                if (expense.note) row.note = expense.note;
            });

            newRows.forEach((row) => {
                row.variableTotal = EXPENSE_TYPES.reduce((sum, type) => sum + (row.amounts[type] || 0), 0);
                row.total = row.rentFee + row.leaseFee + row.variableTotal;
            });

            // 렌트(RENT) 위쪽, 리스(LEASE) 아래쪽, 그 다음 자가(OWNED)
            newRows.sort(compareVehicleLedgerRowsByBillingTarget);
            setRows(newRows);
            setIsDirty(false);
            setDirtyRowIds(new Set());
        } catch (e) {
            console.error(e);
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, [yearMonth, vehicles, monthRange, buildSegmentsForVehicle]);

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
        const correctedTarget = row.fineDriverBillingTarget;
        if (correctedTarget) {
            return {
                issuedToType: 'worker',
                teamId: normalizeKey(correctedTarget.teamId) || OFFICE_TARGET_ID,
                teamName: normalizeKey(correctedTarget.teamName) || OFFICE_TARGET_NAME,
                assignedTeamId: normalizeKey(row.segment.teamId),
                assignedTeamName: normalizeKey(row.segment.teamName),
                issuedToWorkerId: normalizeKey(correctedTarget.workerId) || undefined,
                issuedToWorkerName: normalizeKey(correctedTarget.workerName) || undefined
            };
        }

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

    const openFineDriverEditor = useCallback((row: VehicleLedgerRow) => {
        const currentTarget = resolveFineDriverBillingTarget(row);
        const selectedWorkerId = normalizeKey(
            row.fineDriverBillingTarget?.workerId ||
            currentTarget?.issuedToWorkerId ||
            (row.segment.assigneeType === 'WORKER' ? row.segment.assigneeId : '')
        );
        setFineDriverEditor({ row, selectedWorkerId });
    }, [resolveFineDriverBillingTarget]);

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

    const matchesVehicleBillingIdentity = useCallback((doc: VehicleBillingDocument, row: VehicleLedgerRow): boolean => {
        return vehicleMonthlyLedgerBillingService.matchesBillingIdentity(doc, row.vehicle);
    }, []);

    const matchesVehicleBillingDocument = useCallback((doc: VehicleBillingDocument, row: VehicleLedgerRow) => {
        if (!matchesVehicleBillingIdentity(doc, row)) return false;
        if (normalizeKey(doc.yearMonth) !== normalizeKey(yearMonth)) return false;

        const hasLedgerMarkers = normalizeKey(doc.id).includes('__row_') || (doc.lineItems ?? []).some((item) => (
            item.sourceType === 'vehicle_ledger' ||
            Boolean(item.sourceLedgerRowId) ||
            Boolean(item.sourceSegmentId)
        ));

        if (!vehicleMonthlyLedgerBillingService.isManagedDocument(doc)) return false;
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

        return true;
    }, [resolveVehicleBillingIdentity, yearMonth, hasVehicleLedgerRowMarker, matchesVehicleBillingIdentity]);

    const getBillingDocumentsForRow = useCallback((
        row: VehicleLedgerRow,
        documents: VehicleBillingDocument[] = billingDocuments
    ) => {
        return documents.filter((doc) => matchesVehicleBillingDocument(doc, row));
    }, [billingDocuments, matchesVehicleBillingDocument]);

    const isVehicleLedgerBillingDocument = useCallback((doc: VehicleBillingDocument): boolean => (
        normalizeKey(doc.id).includes('__row_') ||
        (doc.lineItems ?? []).some((item) => (
            item.sourceType === 'vehicle_ledger' ||
            Boolean(item.sourceLedgerRowId) ||
            Boolean(item.sourceSegmentId) ||
            Boolean(item.sourceStartDate) ||
            Boolean(item.sourceEndDate)
        ))
    ), []);

    const getMarkedBillingDocumentsForRow = useCallback((
        row: VehicleLedgerRow,
        documents: VehicleBillingDocument[] = billingDocuments
    ) => {
        return documents.filter((doc) => (
            matchesVehicleBillingIdentity(doc, row) &&
            normalizeKey(doc.yearMonth) === normalizeKey(yearMonth) &&
            vehicleMonthlyLedgerBillingService.isManagedDocument(doc) &&
            hasVehicleLedgerRowMarker(doc, row)
        ));
    }, [billingDocuments, hasVehicleLedgerRowMarker, matchesVehicleBillingIdentity, yearMonth]);

    const doesBillingDocumentOverlapRow = useCallback((doc: VehicleBillingDocument, row: VehicleLedgerRow): boolean => {
        if (!matchesVehicleBillingIdentity(doc, row)) return false;
        if (normalizeKey(doc.yearMonth) !== normalizeKey(yearMonth)) return false;
        if (hasVehicleLedgerRowMarker(doc, row)) return true;

        const rowStart = parseYmdDate(row.segment.startDate);
        const rowEnd = parseYmdDate(row.segment.endDate);
        const rowSegmentIds = new Set(getVehicleSegmentSourceIds(row.segment).map((id) => normalizeKey(id)).filter(Boolean));

        return (doc.lineItems ?? []).some((item) => {
            const sourceSegmentId = normalizeKey(item.sourceSegmentId);
            if (sourceSegmentId && rowSegmentIds.has(sourceSegmentId)) return true;

            const itemStart = parseYmdDate(item.sourceStartDate);
            const itemEnd = parseYmdDate(item.sourceEndDate) ?? itemStart;
            if (!rowStart || !rowEnd || !itemStart || !itemEnd) return false;
            return itemStart.getTime() <= rowEnd.getTime() && itemEnd.getTime() >= rowStart.getTime();
        });
    }, [hasVehicleLedgerRowMarker, matchesVehicleBillingIdentity, yearMonth]);

    const getStaleBillingDocumentsForRow = useCallback((
        row: VehicleLedgerRow,
        documents: VehicleBillingDocument[] = billingDocuments
    ) => {
        const alreadyMatchedIds = new Set([
            ...getBillingDocumentsForRow(row, documents),
            ...getMarkedBillingDocumentsForRow(row, documents)
        ].map((doc) => doc.id).filter(Boolean));

        return documents.filter((doc) => (
            Boolean(doc.id) &&
            !alreadyMatchedIds.has(doc.id) &&
            isVehicleLedgerBillingDocument(doc) &&
            vehicleMonthlyLedgerBillingService.isManagedDocument(doc) &&
            doesBillingDocumentOverlapRow(doc, row)
        ));
    }, [billingDocuments, doesBillingDocumentOverlapRow, getBillingDocumentsForRow, getMarkedBillingDocumentsForRow, isVehicleLedgerBillingDocument]);

    const getAllBillingDocumentsForRow = useCallback((
        row: VehicleLedgerRow,
        sourceDocuments: VehicleBillingDocument[] = billingDocuments
    ) => {
        const matchedDocuments = [
            ...getBillingDocumentsForRow(row, sourceDocuments),
            ...getMarkedBillingDocumentsForRow(row, sourceDocuments),
            ...getStaleBillingDocumentsForRow(row, sourceDocuments),
            // Old deterministic ledger billings can predate row/period source
            // markers. Source-less manual DRAFTs are intentionally excluded:
            // automatic reconciliation must never claim or delete them.
            ...sourceDocuments.filter((document) => (
                matchesVehicleBillingIdentity(document, row) &&
                normalizeKey(document.yearMonth) === normalizeKey(yearMonth) &&
                !vehicleMonthlyLedgerBillingService.hasRowScope(document) &&
                vehicleMonthlyLedgerBillingService.isManagedDocument(document)
            ))
        ];
        return matchedDocuments.filter((doc, index, list) => (
            Boolean(doc.id) && list.findIndex((item) => item.id === doc.id) === index
        ));
    }, [getBillingDocumentsForRow, getMarkedBillingDocumentsForRow, getStaleBillingDocumentsForRow, matchesVehicleBillingIdentity, yearMonth]);

    const getDefaultTargetAmount = useCallback((row: VehicleLedgerRow) => {
        const variableTotal = EXPENSE_TYPES.reduce((sum, type) => {
            if (type === 'FINE' && row.fineChargeTarget === 'DRIVER') return sum;
            return sum + (row.amounts[type] || 0);
        }, 0);
        return row.rentFee + row.leaseFee + variableTotal;
    }, []);

    const visibleLedgerRows = useMemo(() => {
        return rows
            .map((row, index) => ({ row, index }))
            .filter(({ row }) => rowMatchesTeamFilter(row, teamFilterId))
            .filter(({ row }) => rowMatchesSearchText(row, searchText));
    }, [rows, rowMatchesSearchText, rowMatchesTeamFilter, searchText, teamFilterId]);

    const vehicleRowCountById = useMemo(() => {
        const map = new Map<string, number>();
        rows.forEach((row) => {
            const key = normalizeKey(row.vehicle.id);
            if (!key) return;
            map.set(key, (map.get(key) ?? 0) + 1);
        });
        return map;
    }, [rows]);

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

    const handleFineImportOpen = () => {
        if (isDirty) {
            window.alert('과태료를 등록하기 전에 변경사항을 먼저 저장해 주세요.');
            return;
        }
        setSaveFeedback(null);
        setFineImportOpen(true);
    };

    const handleTollImportOpen = () => {
        if (isDirty) {
            window.alert('통행료를 등록하기 전에 변경사항을 먼저 저장해 주세요.');
            return;
        }
        setSaveFeedback(null);
        setTollImportOpen(true);
    };

    const handleCellCommit = useCallback((index: number, rowId: string, type: VehicleExpenseType, numValue: number) => {
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
        setDirtyRowIds((current) => new Set(current).add(rowId));
        setSaveFeedback(null);
    }, []);

    const handleNoteChange = useCallback((index: number, rowId: string, note: string) => {
        setRows(prev => {
            const newRows = [...prev];
            newRows[index] = { ...newRows[index], note };
            return newRows;
        });
        setIsDirty(true);
        setDirtyRowIds((current) => new Set(current).add(rowId));
        setSaveFeedback(null);
    }, []);

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
            // Rebilling always converges on the canonical ledger identity.
            // A legacy/random DRAFT remains in existingDocuments and is
            // removed only after this deterministic replacement is saved.
            id: `${baseId}${suffix}`,
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
            confirmedAt: undefined
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

    const getBlockingUnmanagedDocumentsForRow = (
        row: VehicleLedgerRow,
        sourceDocuments: VehicleBillingDocument[]
    ): VehicleBillingDocument[] => {
        const vehicleMonthDocuments = sourceDocuments.filter((document) => (
            matchesVehicleBillingIdentity(document, row) &&
            normalizeKey(document.yearMonth) === normalizeKey(yearMonth)
        ));
        const managedDocuments = getAllBillingDocumentsForRow(row, sourceDocuments);
        const desiredDocuments = buildBillingDocumentsForRow(row, managedDocuments);
        return vehicleMonthlyLedgerBillingService.getBlockingUnmanagedDocuments(
            vehicleMonthDocuments,
            desiredDocuments
        );
    };

    const loadStoredBillingRow = async (
        row: VehicleLedgerRow,
        storedExpenses?: VehicleExpenseRecord[]
    ): Promise<VehicleLedgerRow> => {
        const expenses = storedExpenses ?? await vehicleService.getExpensesByVehicle(row.vehicle.id, yearMonth);
        return vehicleMonthlyLedgerBillingService.buildRowFromStoredExpenses(row, expenses, EXPENSE_TYPES);
    };

    const applyDraftBillingForStoredRow = async (
        row: VehicleLedgerRow,
        existingDocuments: VehicleBillingDocument[]
    ) => {
        const nextDocuments = buildBillingDocumentsForRow(row, existingDocuments);
        const result = await vehicleMonthlyLedgerBillingService.upsertDrafts({
            existingDocuments,
            desiredDocuments: nextDocuments
        });
        return { ...result, desiredDocuments: nextDocuments };
    };

    const getAutoBillingValidationMessage = (row: VehicleLedgerRow): string | null => {
        const defaultAmount = getDefaultTargetAmount(row);
        if (defaultAmount > 0 && !resolveVehicleBillingTarget(row)) {
            return `${row.vehicle.licensePlate}: 청구대상을 먼저 지정해 주세요.`;
        }

        const driverFineAmount = row.fineChargeTarget === 'DRIVER' ? (row.amounts.FINE ?? 0) : 0;
        if (driverFineAmount > 0 && !resolveFineDriverBillingTarget(row)) {
            return `${row.vehicle.licensePlate}: 과태료 운전자를 먼저 지정해 주세요.`;
        }

        const expectedTotal = defaultAmount + driverFineAmount;
        if (expectedTotal !== row.total) {
            return `${row.vehicle.licensePlate}: 저장 금액의 청구대상을 모두 확인해 주세요.`;
        }
        return null;
    };

    const isRowTeamSettlementConfirmed = (
        row: VehicleLedgerRow,
        documents: VehicleBillingDocument[],
        confirmedKeys: ConfirmedTeamSettlementKeys
    ): boolean => {
        const settlementTargets = [
            resolveVehicleBillingTarget(row),
            row.fineChargeTarget === 'DRIVER' && (row.amounts.FINE ?? 0) > 0
                ? resolveFineDriverBillingTarget(row)
                : null,
            ...documents.map((document) => ({
                issuedToType: document.issuedToType === 'worker' ? 'worker' as const : 'team' as const,
                teamId: normalizeKey(document.teamId),
                teamName: normalizeKey(document.teamName),
                assignedTeamId: normalizeKey(document.assignedTeamId),
                assignedTeamName: normalizeKey(document.assignedTeamName),
                issuedToWorkerId: document.issuedToWorkerId,
                issuedToWorkerName: document.issuedToWorkerName
            }))
        ].filter((target): target is ResolvedVehicleBillingTarget => Boolean(target));

        return settlementTargets.some((target) => (
            teamSettlementProtectionService.isConfirmedTarget(confirmedKeys, {
                teamId: target.teamId,
                teamName: target.teamName
            })
        ));
    };

    const handleSave = async () => {
        if (!yearMonth || saving) return;

        setSaving(true);
        setSaveFeedback(null);
        let ledgerSaved = false;
        let operationId = `vehicle-monthly-ledger:${yearMonth}`;
        let attemptedRowIds: string[] = [];

        try {
            const dirtyScope = dirtyRowIds.size > 0;
            const candidateRows = vehicleMonthlyLedgerBillingService.selectRowsForSave({
                allRows: rows.map((row, index) => ({ row, index })),
                visibleRows: visibleLedgerRows,
                dirtyRowIds,
                retryRowIds: billingRetryRowIds
            });

            if (candidateRows.length === 0) {
                setSaveFeedback({
                    status: 'warning',
                    title: '저장할 차량이 없습니다.',
                    message: '현재 조회 조건에 맞는 차량 대장 행이 없습니다.',
                    operationId
                });
                return;
            }

            // A strict billing read is required before writing the source
            // ledger. Treating a failed read as an empty result could rewrite
            // an already confirmed settlement.
            const [latestDocuments, confirmedSettlementKeys] = await Promise.all([
                vehicleBillingService.getBillingsByMonth(yearMonth, { throwOnError: true }),
                teamSettlementProtectionService.getConfirmedTeamSettlementKeys(yearMonth)
            ]);
            const blockedRows = candidateRows.flatMap(({ row }) => {
                const documents = getAllBillingDocumentsForRow(row, latestDocuments);
                const protectedDocuments = vehicleMonthlyLedgerBillingService.getProtectedDocuments(documents);
                const validationMessage = getAutoBillingValidationMessage(row);
                const settlementConfirmed = isRowTeamSettlementConfirmed(row, documents, confirmedSettlementKeys);
                const blockingUnmanagedDocuments = getBlockingUnmanagedDocumentsForRow(row, latestDocuments);
                if (
                    protectedDocuments.length === 0 &&
                    !settlementConfirmed &&
                    !validationMessage &&
                    blockingUnmanagedDocuments.length === 0
                ) return [];
                return [{
                    row,
                    validationMessage,
                    settlementConfirmed,
                    blockingUnmanagedDocuments,
                    protectedStatuses: Array.from(new Set(protectedDocuments.map((document) => normalizeKey(document.status)).filter(Boolean)))
                }];
            });

            if (dirtyScope && blockedRows.length > 0) {
                const first = blockedRows[0];
                const reason = first.settlementConfirmed
                    ? `${first.row.vehicle.licensePlate}: 해당 팀의 ${yearMonth} 정산이 이미 확정되어 변경할 수 없습니다.`
                    : first.protectedStatuses.length > 0
                    ? `${first.row.vehicle.licensePlate}: 이미 확정·지급·연체된 팀 경비가 있어 변경할 수 없습니다.`
                    : first.blockingUnmanagedDocuments.length > 0
                    ? `${first.row.vehicle.licensePlate}: 수기 또는 혼합 작성된 차량 경비가 있어 자동 변경할 수 없습니다.`
                    : first.validationMessage || '청구대상을 확인해 주세요.';
                const resolution = first.blockingUnmanagedDocuments.length > 0
                    ? '해당 차량 경비 문서를 검토·정리한 뒤 다시 저장해 주세요.'
                    : '팀정산 확정을 취소하거나 청구대상을 지정한 뒤 다시 저장해 주세요.';
                setSaveFeedback({
                    status: 'warning',
                    title: '저장을 중단했습니다.',
                    message: `${reason} ${resolution}`,
                    operationId
                });
                return;
            }

            const blockedIds = new Set(blockedRows.map(({ row }) => row.id));
            const rowsToSave = candidateRows.filter(({ row }) => !blockedIds.has(row.id));
            if (rowsToSave.length === 0) {
                setSaveFeedback({
                    status: 'warning',
                    title: '변경 가능한 차량이 없습니다.',
                    message: '확정된 정산은 보호되며, 금액이 있는 차량은 청구대상이 지정되어야 저장할 수 있습니다.',
                    operationId
                });
                return;
            }
            attemptedRowIds = rowsToSave.map(({ row }) => row.id);

            const result = await vehicleMonthlyLedgerMutationService.saveMonthlyLedger({
                yearMonth,
                visibleRows: rowsToSave,
                originalExpenses: originalExpensesRef.current,
                expenseTypes: EXPENSE_TYPES
            });
            operationId = result.operationId;
            ledgerSaved = true;

            // Billing must be derived from the records that actually reached
            // persistence, never from the editable screen snapshot.
            const [storedExpenses, storedBillingDocuments, refreshedSettlementKeys] = await Promise.all([
                vehicleService.getExpensesByMonth(yearMonth),
                vehicleBillingService.getBillingsByMonth(yearMonth, { throwOnError: true }),
                teamSettlementProtectionService.getConfirmedTeamSettlementKeys(yearMonth)
            ]);

            let workingDocuments = storedBillingDocuments;
            let syncedCount = 0;
            let zeroAmountCount = 0;
            const failedRowIds: string[] = [];
            const newlyProtectedRowIds: string[] = [];

            for (const { row } of rowsToSave) {
                try {
                    const storedRow = await loadStoredBillingRow(row, storedExpenses);
                    const validationMessage = getAutoBillingValidationMessage(storedRow);
                    if (validationMessage) throw new Error(validationMessage);

                    const existingDocuments = getAllBillingDocumentsForRow(storedRow, workingDocuments);
                    if (getBlockingUnmanagedDocumentsForRow(storedRow, workingDocuments).length > 0) {
                        newlyProtectedRowIds.push(row.id);
                        continue;
                    }
                    if (isRowTeamSettlementConfirmed(storedRow, existingDocuments, refreshedSettlementKeys)) {
                        newlyProtectedRowIds.push(row.id);
                        continue;
                    }
                    const syncResult = await applyDraftBillingForStoredRow(storedRow, existingDocuments);
                    if (syncResult.status === 'skipped-posted') {
                        newlyProtectedRowIds.push(row.id);
                        continue;
                    }

                    syncedCount += 1;
                    if (storedRow.total <= 0) zeroAmountCount += 1;

                    const removedIds = new Set(syncResult.deletedDraftIds);
                    const savedDocuments = syncResult.desiredDocuments.map((document, index) => ({
                        ...document,
                        id: syncResult.savedIds[index] || document.id,
                        status: 'DRAFT' as const,
                        confirmedAt: undefined
                    }));
                    const savedIds = new Set(savedDocuments.map((document) => document.id));
                    workingDocuments = [
                        ...workingDocuments.filter((document) => !removedIds.has(document.id) && !savedIds.has(document.id)),
                        ...savedDocuments
                    ];
                } catch (error) {
                    console.error('[VehicleMonthlyLedger] automatic billing sync failed', {
                        yearMonth,
                        rowId: row.id,
                        vehicleId: row.vehicle.id
                    }, error);
                    failedRowIds.push(row.id);
                }
            }

            const retryIds = new Set([...failedRowIds, ...newlyProtectedRowIds]);
            const attemptedIds = new Set(rowsToSave.map(({ row }) => row.id));
            setBillingRetryRowIds((current) => {
                const next = new Set(current);
                attemptedIds.forEach((id) => next.delete(id));
                retryIds.forEach((id) => next.add(id));
                return next;
            });
            setIsDirty(false);
            setDirtyRowIds(new Set());
            await loadData();

            if (failedRowIds.length > 0 || newlyProtectedRowIds.length > 0) {
                const details = [
                    failedRowIds.length > 0 ? `반영 실패 ${failedRowIds.length}대` : '',
                    newlyProtectedRowIds.length > 0 ? `보호·수기 확인 ${newlyProtectedRowIds.length}대` : ''
                ].filter(Boolean).join(', ');
                setSaveFeedback({
                    status: 'error',
                    title: '대장은 저장됐지만 팀 경비 확인이 필요합니다.',
                    message: newlyProtectedRowIds.length > 0
                        ? `${details}. 저장 도중 정산 확정 상태 또는 수기 차량 경비가 확인되어 새 팀 경비는 만들지 않았습니다. 해당 문서를 확인한 뒤 저장을 다시 눌러 주세요.`
                        : `${details}. 중복 없이 다시 시도할 수 있으니 문제를 확인한 뒤 저장을 다시 눌러 주세요.`,
                    operationId
                });
                return;
            }

            const skippedMessage = blockedRows.length > 0
                ? ` 확정된 정산·수기 문서 또는 미지정 대상 ${blockedRows.length}대는 변경하지 않았습니다.`
                : '';
            setSaveFeedback({
                status: blockedRows.length > 0 ? 'warning' : 'success',
                title: '저장 및 팀 경비 반영 완료',
                message: `${syncedCount}대의 저장된 금액을 팀별 경비에 반영했습니다.${zeroAmountCount > 0 ? ` 0원 ${zeroAmountCount}대의 작성 중 경비는 제거했습니다.` : ''}${skippedMessage}`,
                operationId
            });
        } catch (error) {
            console.error('[VehicleMonthlyLedger] save failed', { yearMonth, ledgerSaved }, error);
            if (ledgerSaved) {
                if (attemptedRowIds.length > 0) {
                    setBillingRetryRowIds((current) => new Set([...current, ...attemptedRowIds]));
                }
                setIsDirty(false);
                setDirtyRowIds(new Set());
                await loadData().catch(() => undefined);
            }
            setSaveFeedback({
                status: 'error',
                title: ledgerSaved ? '대장은 저장됐지만 팀 경비 반영에 실패했습니다.' : '저장 실패',
                message: ledgerSaved
                    ? '대장 금액은 저장되어 있습니다. 중복되지 않으니 저장을 다시 눌러 팀별 경비 반영을 재시도해 주세요.'
                    : SUPPORT_WRITE_RETRY_USER_MESSAGE,
                operationId
            });
        } finally {
            setSaving(false);
        }
    };

    const getFineExpensesForRow = (
        row: VehicleLedgerRow,
        expenses: VehicleExpenseRecord[] = originalExpensesRef.current
    ): VehicleExpenseRecord[] => {
        const start = parseYmdDate(row.segment.startDate);
        const end = parseYmdDate(row.segment.endDate);
        return expenses.filter((expense) => {
            if (expense.status === 'CANCELLED') return false;
            if (normalizeKey(expense.vehicleId) !== normalizeKey(row.vehicle.id)) return false;
            if (normalizeVehicleExpenseType(expense.type, expense.note, expense.id) !== 'FINE') return false;
            const date = parseYmdDate(expense.date);
            if (!date || !start || !end) return false;
            return date.getTime() >= start.getTime() && date.getTime() <= end.getTime();
        });
    };

    const handleSaveFineDriverTarget = async () => {
        if (!fineDriverEditor) return;
        if (isDirty) {
            window.alert('과태료 청구대상을 정정하기 전에 대장 변경사항을 먼저 저장해 주세요.');
            return;
        }

        const selectedTarget = fineDriverOptions.find((option) => option.workerId === fineDriverEditor.selectedWorkerId);
        if (!selectedTarget) {
            window.alert('과태료를 청구할 운전자를 선택해 주세요.');
            return;
        }

        const row = fineDriverEditor.row;

        setBillingProcessingId(row.id);
        let targetStored = false;
        try {
            const [storedExpenses, latestDocuments, confirmedSettlementKeys] = await Promise.all([
                vehicleService.getExpensesByVehicle(row.vehicle.id, yearMonth),
                vehicleBillingService.getBillingsByMonth(yearMonth, { throwOnError: true }),
                teamSettlementProtectionService.getConfirmedTeamSettlementKeys(yearMonth)
            ]);
            const currentDocuments = getAllBillingDocumentsForRow(row, latestDocuments);
            const protectedDocuments = currentDocuments.filter((document) => isPostedVehicleBillingStatus(document.status));
            if (protectedDocuments.length > 0) {
                window.alert('확정·지급·연체 청구서는 자동 정정하지 않습니다. 먼저 해당 청구서의 확정을 명시적으로 취소해 주세요.');
                return;
            }

            const correctedPreviewRow: VehicleLedgerRow = {
                ...row,
                fineChargeTarget: 'DRIVER',
                fineDriverBillingTarget: selectedTarget
            };
            if (getBlockingUnmanagedDocumentsForRow(correctedPreviewRow, latestDocuments).length > 0) {
                window.alert('수기 또는 혼합 작성된 차량 경비가 있어 자동 정정할 수 없습니다. 해당 경비 문서를 먼저 확인해 주세요.');
                return;
            }
            if (isRowTeamSettlementConfirmed(correctedPreviewRow, currentDocuments, confirmedSettlementKeys)) {
                window.alert('해당 팀의 월 정산이 이미 확정되어 과태료 대상을 변경할 수 없습니다. 먼저 팀정산 확정을 취소해 주세요.');
                return;
            }

            const fineExpenses = getFineExpensesForRow(row, storedExpenses);
            if (fineExpenses.length === 0) {
                window.alert('저장된 과태료가 없습니다. 대장 금액을 먼저 저장해 주세요.');
                return;
            }

            // This is a period-specific correction.  It never changes the
            // vehicle assignment or the default target used by other months.
            await vehicleService.applyVehicleExpenseChanges({
                operationId: `vehicle-fine-target-correction:${yearMonth}:${row.vehicle.id}`,
                upserts: fineExpenses.map((expense) => ({
                    ...expense,
                    fineChargeTarget: 'DRIVER' as const,
                    fineDriverBillingTarget: selectedTarget
                }))
            });
            targetStored = true;

            const correctedExpenses = storedExpenses.map((expense) => (
                fineExpenses.some((fine) => fine.id === expense.id)
                    ? { ...expense, fineChargeTarget: 'DRIVER' as const, fineDriverBillingTarget: selectedTarget }
                    : expense
            ));
            const correctedRow = await loadStoredBillingRow({
                ...correctedPreviewRow
            }, correctedExpenses);
            const refreshedSettlementKeys = await teamSettlementProtectionService.getConfirmedTeamSettlementKeys(yearMonth);
            if (isRowTeamSettlementConfirmed(correctedRow, currentDocuments, refreshedSettlementKeys)) {
                setBillingRetryRowIds((current) => new Set(current).add(row.id));
                await loadData();
                setFineDriverEditor(null);
                window.alert('과태료 대상은 저장됐지만 저장 도중 팀정산 확정이 확인되어 팀 경비는 변경하지 않았습니다. 확정을 취소한 뒤 저장을 다시 눌러 주세요.');
                return;
            }
            const syncResult = await applyDraftBillingForStoredRow(correctedRow, currentDocuments);
            if (syncResult.status === 'skipped-posted') {
                setBillingRetryRowIds((current) => new Set(current).add(row.id));
                await loadData();
                setFineDriverEditor(null);
                window.alert('과태료 대상은 저장됐지만 확정·지급·연체된 팀 경비가 확인되어 자동 반영하지 않았습니다. 확정을 취소한 뒤 [저장]을 다시 눌러 주세요.');
                return;
            }

            setBillingRetryRowIds((current) => {
                const next = new Set(current);
                next.delete(row.id);
                return next;
            });
            await loadData();
            setFineDriverEditor(null);
            window.alert('과태료 청구대상을 정정하고 저장 금액 기준 DRAFT 청구서를 갱신했습니다.');
        } catch (error) {
            console.error('[VehicleMonthlyLedger] fine target correction failed', error);
            if (targetStored) {
                setBillingRetryRowIds((current) => new Set(current).add(row.id));
                await loadData().catch(() => undefined);
                setFineDriverEditor(null);
                window.alert('과태료 대상은 저장됐지만 팀 경비 반영에 실패했습니다. 중복되지 않으니 [저장]을 다시 눌러 주세요.');
            } else {
                window.alert('과태료 청구대상 정정에 실패했습니다. 잠시 후 다시 시도해 주세요.');
            }
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
        visibleLedgerRows.forEach(({ row: r }) => {
            acc.rentFee += r.rentFee;
            acc.leaseFee += r.leaseFee;
            EXPENSE_TYPES.forEach(type => {
                acc[type] += r.amounts[type] || 0;
            });
            acc.total += r.total;
        });
        return acc;
    }, [visibleLedgerRows]);

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
                        {billingRetryRowIds.size > 0 && (
                            <span className="px-3 py-1 bg-rose-100 text-rose-700 text-xs font-bold rounded-full border border-rose-200">
                                팀 경비 재시도 {billingRetryRowIds.size}건
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex w-full flex-wrap gap-2 sm:gap-3 items-center justify-start 2xl:w-auto 2xl:justify-end">
                    <div className="mr-0 min-w-[110px] text-left sm:text-right">
                        <div className="text-xs text-slate-500 font-bold uppercase">총 합계</div>
                        <div className="text-2xl font-extrabold text-indigo-700 font-mono">{totals.total.toLocaleString()}</div>
                    </div>
                    <div className="flex w-full items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm sm:w-auto" aria-label="차량 PDF AI 등록">
                        <span className="hidden items-center gap-1.5 whitespace-nowrap px-2 text-[11px] font-extrabold text-slate-500 xl:inline-flex">
                            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                            AI 고지서
                        </span>
                        <button
                            type="button"
                            onClick={handleTollImportOpen}
                            disabled={!yearMonth || loading || saving}
                            title={`${yearMonth || '선택 월'} 차량 통행료 PDF/이미지 일괄 분석`}
                            aria-label="통행료 AI 등록"
                            className="inline-flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-indigo-200 bg-white px-2.5 text-xs font-extrabold text-indigo-700 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:border-slate-100 disabled:bg-slate-50 disabled:text-slate-300 sm:flex-none"
                        >
                            <Route className="h-4 w-4 shrink-0" aria-hidden="true" />
                            통행료
                        </button>
                        <button
                            type="button"
                            onClick={handleFineImportOpen}
                            disabled={!yearMonth || loading || saving}
                            title={`${yearMonth || '선택 월'} 차량 과태료 PDF/이미지 일괄 분석`}
                            aria-label="과태료 AI 등록"
                            className="inline-flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-rose-200 bg-white px-2.5 text-xs font-extrabold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-slate-100 disabled:bg-slate-50 disabled:text-slate-300 sm:flex-none"
                        >
                            <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
                            과태료
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
                        {saving ? '저장 중...' : '저장'}
                    </button>
                </div>
            </div>

            {saveFeedback && (
                <SupportSaveFeedback
                    feedback={saveFeedback}
                    retryDisabled={saving}
                    onRetry={saveFeedback.status === 'error' ? () => void handleSave() : undefined}
                    onDismiss={() => setSaveFeedback(null)}
                />
            )}

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
                                <col style={{ width: '7%' }} />
                                <col style={{ width: '9%' }} />
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
                                    <th className="px-2 py-4 text-center w-36 border-l border-indigo-500">과태료 대상</th>
                                    <th className="px-4 py-4 text-center w-40 border-l border-indigo-500">비고 (메모)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-indigo-50">
                                {visibleLedgerRows.map(({ row, index: idx }) => {
                                    const assignmentSummary = getAssignmentSummary(row);
                                    const visibleAssignedWorkers = assignmentSummary.assignedWorkers.slice(0, 3);
                                    const isProcessing = billingProcessingId === row.id;
                                    const shouldShowPeriod = (vehicleRowCountById.get(normalizeKey(row.vehicle.id)) ?? 0) > 1;
                                    const hasPostedBilling = vehicleMonthlyLedgerBillingService
                                        .getProtectedDocuments(getAllBillingDocumentsForRow(row))
                                        .length > 0;

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
                                                                 style={{ backgroundColor: team.color, color: getContrastingTextColor(team.color) }}
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
                                                    title="배정/청구를 수정해 관리대장에 반영"
                                                >
                                                    <FontAwesomeIcon icon={faUsers} className="text-[10px]" />
                                                    대장 반영
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
                                                                 style={{ backgroundColor: team.color, color: getContrastingTextColor(team.color) }}
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
                                                                {(team.targetLabel || team.subLabel) && (
                                                                    <span className="block text-[10px] font-semibold text-slate-400">
                                                                        {team.targetLabel ? `${team.targetLabel} · ` : ''}
                                                                        {team.subLabel || ''}
                                                                    </span>
                                                                )}
                                                                {shouldShowPeriod && (
                                                                    <span className="mt-1 inline-flex max-w-full items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-700">
                                                                        <span className="shrink-0">분할기간</span>
                                                                        <span className="truncate">{assignmentSummary.periodLabel}</span>
                                                                        <span className="shrink-0 rounded bg-white/80 px-1">{assignmentSummary.overlapDays}일</span>
                                                                    </span>
                                                                )}
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
                                                onCommit={(val) => handleCellCommit(idx, row.id, type, val)}
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

                                        <td className="px-2 py-3 border-l border-indigo-50 bg-white">
                                            <div className="flex items-center justify-center gap-1.5">
                                                {row.amounts.FINE > 0 ? (
                                                    <button
                                                        type="button"
                                                        disabled={isProcessing || hasPostedBilling}
                                                        onClick={() => openFineDriverEditor(row)}
                                                        className="px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-800 text-xs font-bold border border-amber-200 hover:bg-amber-100 disabled:text-amber-300 disabled:bg-amber-50 whitespace-nowrap"
                                                        title={hasPostedBilling ? '확정된 정산은 변경할 수 없습니다.' : '이 월의 과태료 부과 운전자 지정'}
                                                    >
                                                        {hasPostedBilling ? '정산 보호' : '운전자 지정'}
                                                    </button>
                                                ) : (
                                                    <span className="text-slate-300">-</span>
                                                )}
                                            </div>
                                        </td>

                                        {/* 메모 */}
                                        <td className="p-1 border-l border-indigo-50 bg-white">
                                            <input
                                                type="text"
                                                value={row.note}
                                                onChange={(e) => handleNoteChange(idx, row.id, e.target.value)}
                                                className={`w-full p-2 focus:outline-none focus:bg-indigo-50 focus:ring-1 focus:ring-indigo-200 rounded-lg text-xs bg-transparent text-center ${row.note ? 'text-red-600 font-extrabold' : 'text-slate-600'}`}
                                                placeholder=""
                                            />
                                        </td>
                                    </tr>
                                    );
                                })}
                                {visibleLedgerRows.length === 0 && (
                                    <tr>
                                        <td colSpan={EXPENSE_TYPES.length + 10} className="p-20 text-center text-slate-400 bg-slate-50/50">
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
                                    <td colSpan={5} className="p-4 border-r border-slate-600 text-center">합계</td>
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
                                    <td colSpan={2} className="bg-slate-900 border-l border-slate-700"></td>
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
                        * 같은 달에 청구대상이 나뉜 차량은 고정비를 청구대상 수로 균등 배분하고, 유동비는 발생일 기준으로 청구합니다.<br />
                        * <strong>[저장]</strong>을 누르면 저장된 금액이 팀별 경비에 바로 반영됩니다.
                    </p>
                </div>
            </div>

            {fineDriverEditor && (
                <div className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="vehicle-fine-driver-title">
                    <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
                        <h2 id="vehicle-fine-driver-title" className="text-lg font-extrabold text-slate-900">과태료 운전자 청구대상 정정</h2>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                            {fineDriverEditor.row.vehicle.licensePlate} 차량의 {yearMonth} 과태료만 선택한 운전자에게 청구합니다.
                            차량 배정 이력과 다른 월의 청구대상은 변경하지 않습니다.
                        </p>
                        <label className="mt-5 block text-xs font-extrabold text-slate-600">
                            운전자
                            <select
                                value={fineDriverEditor.selectedWorkerId}
                                onChange={(event) => setFineDriverEditor((current) => current ? {
                                    ...current,
                                    selectedWorkerId: event.target.value
                                } : null)}
                                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                            >
                                <option value="">운전자를 선택하세요</option>
                                {fineDriverOptions.map((option) => (
                                    <option key={option.workerId} value={option.workerId}>
                                        {option.teamName ? `${option.teamName} · ` : ''}{option.workerName}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-800">
                            확정·지급·연체 청구서는 자동 정정하지 않습니다. 필요한 경우 청구서에서 먼저 확정을 명시적으로 취소해 주세요.
                        </p>
                        <div className="mt-6 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setFineDriverEditor(null)}
                                disabled={billingProcessingId === fineDriverEditor.row.id}
                                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 disabled:text-slate-400"
                            >
                                취소
                            </button>
                            <button
                                type="button"
                                onClick={() => void handleSaveFineDriverTarget()}
                                disabled={billingProcessingId === fineDriverEditor.row.id || !fineDriverEditor.selectedWorkerId}
                                className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:bg-indigo-300"
                            >
                                {billingProcessingId === fineDriverEditor.row.id ? '저장 중...' : '정정 저장'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {fineImportOpen && (
                <VehicleFineImportModal
                    yearMonth={yearMonth}
                    files={[]}
                    vehicles={fineImportVehicles}
                    onClose={() => setFineImportOpen(false)}
                    onCommitted={(result) => {
                        setFineImportOpen(false);
                        void loadData();
                        setSaveFeedback({
                            status: result.duplicateCount > 0 ? 'warning' : 'success',
                            title: '과태료 등록 완료',
                            message: result.duplicateCount > 0
                                ? `${yearMonth} 대장에 ${result.createdCount}건을 등록했고, 중복 ${result.duplicateCount}건은 제외했습니다.`
                                : `${yearMonth} 차량 통합관리대장에 ${result.createdCount}건을 등록했습니다.`,
                            operationId: result.operationId
                        });
                    }}
                />
            )}

            {tollImportOpen && (
                <VehicleTollImportModal
                    yearMonth={yearMonth}
                    files={[]}
                    vehicles={fineImportVehicles}
                    onClose={() => setTollImportOpen(false)}
                    onCommitted={(result) => {
                        setTollImportOpen(false);
                        void loadData();
                        setSaveFeedback({
                            status: result.duplicateCount > 0 ? 'warning' : 'success',
                            title: '통행료 등록 완료',
                            message: result.duplicateCount > 0
                                ? `${yearMonth} 대장에 ${result.createdCount}건을 등록했고, 중복 ${result.duplicateCount}건은 제외했습니다.`
                                : `${yearMonth} 차량 통합관리대장에 ${result.createdCount}건을 등록했습니다.`,
                            operationId: result.operationId
                        });
                    }}
                />
            )}
        </div>
    );
};
