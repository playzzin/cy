import React, { useEffect, useMemo, useState, useCallback, useRef, memo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faBuilding,
    faChevronLeft,
    faChevronRight,
    faReceipt,
    faSave,
    faExclamationTriangle,
    faUsers,
    faUser
} from '@fortawesome/free-solid-svg-icons';
import {
    Card,
    CardAssignmentRecord,
    CardBillingTargetRecord,
    CardBillingTargetType,
    CardTransaction,
    CardTransactionCategory
} from '../../types/card';
import { CardBillingCostItem, CardBillingDocument } from '../../types/cardBilling';
import { cardService } from '../../services/cardService';
import { cardBillingService } from '../../services/cardBillingService';
import { Team } from '../../services/teamService';
import { Worker, manpowerService } from '../../services/manpowerService';
import { OfficeStaff, officeStaffService } from '../../services/officeStaffService';
import { iconMap } from '../../constants/iconMap';
import { Timestamp } from '../../types/timestamp';
import LedgerBillingEditorModal from '../support/LedgerBillingEditorModal';
import { OFFICE_ASSIGNMENT_TEAM_ID, OFFICE_ASSIGNMENT_TEAM_NAME, isOfficeStaffAssignmentReference } from '../../utils/supportAssignmentTargets';
import { DEFAULT_SUPPORT_BILLING_START_DATE, isSupportBillingMonthEnabled, maxIsoDate, minIsoDate } from '../../utils/supportBillingPeriod';
import { getContrastingTextColor } from '../../utils/color';

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

const CATEGORIES: CardTransactionCategory[] = ['FUEL', 'TOLL', 'MEAL', 'MATERIAL', 'OTHER'];
const CATEGORY_LABELS: Record<CardTransactionCategory, string> = {
    FUEL: '유류비',
    TOLL: '통행료',
    MEAL: '식대',
    MATERIAL: '자재비',
    OTHER: '기타'
};

type CategoryAmounts = Record<CardTransactionCategory, number>;

const emptyCategoryAmounts = (): CategoryAmounts => ({
    FUEL: 0,
    TOLL: 0,
    MEAL: 0,
    MATERIAL: 0,
    OTHER: 0
});

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const OFFICE_TARGET_ID = '__office__';
const OFFICE_TARGET_NAME = '사무실';

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
const normalizeKey = (value: unknown): string => String(value ?? '').trim();

const sanitizeBillingIdPart = (value: unknown): string => {
    const text = String(value ?? '').trim();
    return ['/', '#', '[', ']', '?'].reduce((safe, char) => safe.split(char).join('_'), text || 'row');
};

interface LedgerBadge {
    key: string;
    name: string;
    color: string;
    icon?: string | null;
    targetType?: CardBillingTargetType;
    targetLabel?: string;
    subLabel?: string;
}

interface CardLedgerSegment {
    id: string;
    sourceSegmentIds?: string[];
    assigneeId?: string;
    assigneeType?: 'TEAM' | 'WORKER';
    assigneeName?: string;
    teamId?: string;
    teamName?: string;
    billingTargetId?: string;
    billingTargetType?: CardBillingTargetType;
    billingTargetName?: string;
    billingTeamId?: string;
    billingTeamName?: string;
    startDate: string;
    endDate: string;
    overlapDays: number;
}

const getCardSegmentBillingKey = (segment: CardLedgerSegment): string => {
    const type = normalizeKey(segment.billingTargetType || segment.assigneeType || 'UNASSIGNED');
    const id = normalizeKey(segment.billingTargetId || segment.assigneeId || segment.billingTeamId || segment.teamId);
    const name = normalizeKey(segment.billingTargetName || segment.assigneeName || segment.billingTeamName || segment.teamName);
    return `${type}:${id || name}`;
};

const getCardSegmentSourceIds = (segment: CardLedgerSegment): string[] => {
    const ids = [segment.id, ...(segment.sourceSegmentIds ?? [])].map((value) => normalizeKey(value)).filter(Boolean);
    return Array.from(new Set(ids));
};

const mergeAdjacentCardSegments = (segments: CardLedgerSegment[]): CardLedgerSegment[] => {
    return segments.reduce<CardLedgerSegment[]>((merged, segment) => {
        const prev = merged[merged.length - 1];
        if (!prev || getCardSegmentBillingKey(prev) !== getCardSegmentBillingKey(segment)) {
            merged.push({
                ...segment,
                sourceSegmentIds: getCardSegmentSourceIds(segment)
            });
            return merged;
        }

        const prevEnd = parseYmdDate(prev.endDate);
        const nextStart = parseYmdDate(segment.startDate);
        const canMerge = prevEnd && nextStart && nextStart.getTime() <= addDays(prevEnd, 1).getTime();
        if (!canMerge) {
            merged.push({
                ...segment,
                sourceSegmentIds: getCardSegmentSourceIds(segment)
            });
            return merged;
        }

        const segmentEnd = parseYmdDate(segment.endDate);
        const prevEndTime = prevEnd?.getTime() ?? 0;
        prev.endDate = segmentEnd && segmentEnd.getTime() > prevEndTime ? segment.endDate : prev.endDate;
        prev.overlapDays += segment.overlapDays;
        prev.sourceSegmentIds = Array.from(new Set([
            ...getCardSegmentSourceIds(prev),
            ...getCardSegmentSourceIds(segment)
        ]));
        return merged;
    }, []);
};

interface CardLedgerRow {
    id: string;
    card: Card;
    segment: CardLedgerSegment;
    amounts: CategoryAmounts;
    total: number;
    memo: string;
}

const getCardBillingTargetSortInfo = (row: CardLedgerRow) => {
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

const compareCardLedgerRowsByBillingTarget = (a: CardLedgerRow, b: CardLedgerRow): number => {
    const left = getCardBillingTargetSortInfo(a);
    const right = getCardBillingTargetSortInfo(b);

    if (left.group !== right.group) return left.group - right.group;

    const targetCmp = left.name.localeCompare(right.name, 'ko-KR', { numeric: true, sensitivity: 'base' });
    if (targetCmp !== 0) return targetCmp;

    const cardCmp = String(a.card.name).localeCompare(String(b.card.name), 'ko-KR', { numeric: true, sensitivity: 'base' });
    if (cardCmp !== 0) return cardCmp;

    return left.startDate.localeCompare(right.startDate);
};

interface CardMonthlyLedgerProps {
    cards: Card[];
    teams?: Team[];
    loadingCards: boolean;
    onOpenSetup?: (card: Card) => void;
    onOpenBillingTarget?: (card: Card) => void;
}

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

const hexToRgba = (hex: string, alpha: number) => {
    const normalized = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : '#94a3b8';
    const r = parseInt(normalized.slice(1, 3), 16);
    const g = parseInt(normalized.slice(3, 5), 16);
    const b = parseInt(normalized.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
};

export const CardMonthlyLedger: React.FC<CardMonthlyLedgerProps> = ({ cards, teams = [], loadingCards, onOpenSetup, onOpenBillingTarget }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [yearMonth, setYearMonth] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [isStickyHeader, setIsStickyHeader] = useState(false);

    const [rows, setRows] = useState<CardLedgerRow[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [officeStaffRows, setOfficeStaffRows] = useState<OfficeStaff[]>([]);
    const [billingDocuments, setBillingDocuments] = useState<CardBillingDocument[]>([]);
    const [billingFilter, setBillingFilter] = useState<BillingFilter>('all');
    const [billingProcessingId, setBillingProcessingId] = useState('');
    const [bulkBillingAction, setBulkBillingAction] = useState<'bill' | 'unbill' | ''>('');
    const [billingEditor, setBillingEditor] = useState<{ row: CardLedgerRow; document: CardBillingDocument } | null>(null);
    const originalTxsRef = useRef<CardTransaction[]>([]);

    const teamInfoMap = useMemo(() => {
        const map = new Map<string, { color: string; icon?: string }>();
        teams.forEach(t => {
            if (t.color && t.name) map.set(t.name, { color: t.color, icon: t.icon || t.iconKey });
        });
        return map;
    }, [teams]);

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

    const resolveAssigneeTeam = useCallback((assignment: Pick<CardAssignmentRecord, 'assigneeId' | 'assigneeName' | 'assigneeType'>) => {
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

    const buildSegmentsForCard = useCallback((
        card: Card,
        assignmentList: CardAssignmentRecord[],
        billingTargetList: CardBillingTargetRecord[]
    ): CardLedgerSegment[] => {
        if (!monthRange) return [];

        const cardId = normalizeKey(card.id);
        const firstBillingTargetStart = minIsoDate(
            ...billingTargetList
                .filter((target) => normalizeKey(target.cardId) === cardId)
                .map((target) => target.startDate)
        );
        const billingStartDate = maxIsoDate(DEFAULT_SUPPORT_BILLING_START_DATE, firstBillingTargetStart);
        if (!isSupportBillingMonthEnabled(yearMonth, billingStartDate)) return [];

        const activeAssignments = assignmentList
            .filter((assignment) => normalizeKey(assignment.cardId) === cardId)
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
            if (card.currentAssigneeId && card.currentAssigneeType && card.currentAssigneeName) {
                return {
                    assignment: {
                        id: `snapshot-${card.id}`,
                        cardId: card.id,
                        cardLabel: `${card.name} (${card.last4})`,
                        assigneeId: card.currentAssigneeId,
                        assigneeType: card.currentAssigneeType,
                        assigneeName: card.currentAssigneeName,
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
                targetType: CardBillingTargetType;
                targetName: string;
            }
        ): CardLedgerSegment | null => {
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
                id: billingTarget?.id || normalizeKey(assignment?.id) || `${card.id}:${index}`,
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
            .filter((target) => normalizeKey(target.cardId) === cardId)
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
                target: CardBillingTargetRecord | null;
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
                    id: normalizeKey(entry.target.id) || `${card.id}:billing:0`,
                    targetId: normalizeKey(entry.target.targetId),
                    targetType: entry.target.targetType,
                    targetName: normalizeKey(entry.target.targetName)
                });
                return segment ? [segment] : [];
            }

            const splitEntries = timelineEntries.length > 0 ? timelineEntries : targetRanges;
            const segments = splitEntries.flatMap((entry, index): CardLedgerSegment[] => {
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
                        id: normalizeKey(entry.target.id) || `${card.id}:billing:${index}`,
                        targetId: normalizeKey(entry.target.targetId),
                        targetType: entry.target.targetType,
                        targetName: normalizeKey(entry.target.targetName)
                    })
                    : buildSegmentFromAssignment(assignment, segmentStart, segmentEnd, index);
                return segment ? [segment] : [];
            });
            return mergeAdjacentCardSegments(segments);
        }

        const rows = activeAssignments.flatMap((entry, index): CardLedgerSegment[] => {
            const nextStartDate = activeAssignments[index + 1]?.startDate ?? null;
            const explicitEndDate = entry.endDate ?? monthRange.monthEnd;
            const handoffEndDate = nextStartDate ? addDays(nextStartDate, -1) : monthRange.monthEnd;
            const segmentStart = maxDate(entry.startDate ?? monthRange.monthStart, monthRange.monthStart);
            const segmentEnd = minDate(explicitEndDate, handoffEndDate, monthRange.monthEnd);
            const segment = buildSegmentFromAssignment(entry, segmentStart, segmentEnd, index);
            return segment ? [segment] : [];
        });

        if (rows.length > 0) return mergeAdjacentCardSegments(rows);

        return [{
            id: `unassigned-${card.id}`,
            startDate: formatYmdDate(monthRange.monthStart),
            endDate: formatYmdDate(monthRange.monthEnd),
            overlapDays: monthRange.daysInMonth
        }];
    }, [monthRange, resolveAssigneeTeam, teamByAnyId, teamByName, workerByAnyId, workerByName, yearMonth]);

    const loadData = useCallback(async () => {
        if (!yearMonth) return;
        setLoading(true);
        try {
            const [txs, assignmentList, billingTargetList, billings] = await Promise.all([
                cardService.getTransactionsByMonth(yearMonth),
                cardService.listAllCardAssignments().catch(() => [] as CardAssignmentRecord[]),
                cardService.listAllCardBillingTargets().catch(() => [] as CardBillingTargetRecord[]),
                cardBillingService.getBillingsByMonth(yearMonth).catch(() => [] as CardBillingDocument[])
            ]);
            originalTxsRef.current = txs;
            setBillingDocuments(billings);

            const newRows: CardLedgerRow[] = cards.flatMap((card) => {
                const segments = buildSegmentsForCard(card, assignmentList, billingTargetList);
                return segments.map((segment) => ({
                    id: `${card.id}:${segment.id}`,
                    card,
                    segment,
                    amounts: emptyCategoryAmounts(),
                    total: 0,
                    memo: ''
                }));
            });

            txs.forEach((tx) => {
                const cardRows = newRows.filter((row) => normalizeKey(row.card.id) === normalizeKey(tx.cardId));
                if (cardRows.length === 0 || !CATEGORIES.includes(tx.category as CardTransactionCategory)) return;

                const txDate = parseYmdDate(tx.date);
                const targetRow = txDate
                    ? cardRows.find((row) => {
                        const start = parseYmdDate(row.segment.startDate);
                        const end = parseYmdDate(row.segment.endDate);
                        return start && end && txDate.getTime() >= start.getTime() && txDate.getTime() <= end.getTime();
                    })
                    : undefined;
                const row = targetRow ?? cardRows[0];
                const category = tx.category as CardTransactionCategory;
                row.amounts = {
                    ...row.amounts,
                    [category]: (row.amounts[category] ?? 0) + tx.amount
                };
                if (tx.memo) row.memo = tx.memo;
            });

            newRows.forEach((row) => {
                row.total = CATEGORIES.reduce((sum, category) => sum + (row.amounts[category] || 0), 0);
            });

            newRows.sort(compareCardLedgerRowsByBillingTarget);
            setRows(newRows);
            setIsDirty(false);
        } catch (e) {
            console.error('카드 월별대장 로드 실패:', e);
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, [yearMonth, cards, buildSegmentsForCard]);

    const resolveSegmentTeamBadge = (segment: CardLedgerSegment) => {
        const team = segment.teamId
            ? teamByAnyId.get(String(segment.teamId))
            : teamByName.get(normalizeKey(segment.teamName));
        const name = normalizeKey(team?.name) || normalizeKey(segment.teamName) || (
            segment.assigneeType === 'TEAM' ? normalizeKey(segment.assigneeName) : ''
        );
        if (!name) return null;
        const teamInfo = teamInfoMap.get(name);
        return {
            key: `team:${normalizeKey(team?.id ?? segment.teamId ?? segment.assigneeId ?? name)}`,
            name,
            color: team?.color || teamInfo?.color || '#94a3b8',
            icon: team?.icon || team?.iconKey || teamInfo?.icon || null,
            targetType: 'TEAM' as const
        } satisfies LedgerBadge;
    };

    const getAssignmentSummary = (row: CardLedgerRow) => {
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
            const teamInfo = teamInfoMap.get(name);
            return {
                key: `team:${normalizeKey(team?.id ?? rawTeamId ?? name)}`,
                name,
                color: team?.color || teamInfo?.color || '#94a3b8',
                icon: team?.icon || team?.iconKey || teamInfo?.icon || null,
                targetType: 'TEAM'
            };
        };

        const buildBillingTargetBadge = (
            type?: CardBillingTargetType | null,
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

        let billingTargets: LedgerBadge[] = assignedTeams;
        const explicitTargetBadge = buildBillingTargetBadge(
            segment.billingTargetType,
            segment.billingTargetId,
            segment.billingTargetName
        );
        if (explicitTargetBadge) {
            billingTargets = [explicitTargetBadge];
        } else if (segment.billingTeamId || segment.billingTeamName) {
            const badge = buildTeamBadge(segment.billingTeamId, segment.billingTeamName);
            billingTargets = badge ? [badge] : [];
        } else if (billingTargets.length === 0 && segment.assigneeType === 'WORKER') {
            const badge = buildTeamBadge(segment.teamId, segment.teamName);
            billingTargets = badge ? [badge] : [];
        }

        const periodLabel = segment.startDate === segment.endDate
            ? segment.startDate
            : `${segment.startDate} ~ ${segment.endDate}`;
        return {
            assignedTeams,
            assignedWorkers,
            billingTargets,
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

    const resolveCardBillingIdentity = useCallback((row: CardLedgerRow) => {
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

        const worker = targetType === 'WORKER'
            ? (targetId ? workerByAnyId.get(targetId) : workerByName.get(targetName))
            : null;
        const team = targetType === 'TEAM'
            ? (targetId ? teamByAnyId.get(targetId) : teamByName.get(targetName))
            : (worker?.teamId
                ? teamByAnyId.get(String(worker.teamId))
                : (row.segment.billingTeamId
                    ? teamByAnyId.get(String(row.segment.billingTeamId))
                    : (row.segment.teamId ? teamByAnyId.get(String(row.segment.teamId)) : teamByName.get(normalizeKey(row.segment.billingTeamName || row.segment.teamName)))));

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

    const resolveCardBillingTarget = useCallback((row: CardLedgerRow) => {
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

        const worker = targetType === 'WORKER'
            ? (targetId ? workerByAnyId.get(targetId) : workerByName.get(targetName))
            : null;
        const team = targetType === 'TEAM'
            ? (targetId ? teamByAnyId.get(targetId) : teamByName.get(targetName))
            : (worker?.teamId
                ? teamByAnyId.get(String(worker.teamId))
                : (row.segment.billingTeamId
                    ? teamByAnyId.get(String(row.segment.billingTeamId))
                    : (row.segment.teamId ? teamByAnyId.get(String(row.segment.teamId)) : teamByName.get(normalizeKey(row.segment.billingTeamName || row.segment.teamName)))));

        const teamId = normalizeKey(team?.id ?? row.segment.billingTeamId ?? (targetType === 'TEAM' ? targetId : row.segment.teamId));
        const teamName = normalizeKey(team?.name ?? row.segment.billingTeamName ?? (targetType === 'TEAM' ? targetName : row.segment.teamName));
        if (!teamId) return null;

        if (isPersonTarget) {
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

    const getCardLedgerRowDocumentSuffix = useCallback((row: CardLedgerRow): string => {
        return `__row_${sanitizeBillingIdPart(row.segment.id || row.id)}`;
    }, []);

    const hasCardLedgerRowMarker = useCallback((doc: CardBillingDocument, row: CardLedgerRow): boolean => {
        const segmentIds = getCardSegmentSourceIds(row.segment);
        const suffixes = segmentIds.map((id) => `__row_${sanitizeBillingIdPart(id)}`);
        if (suffixes.some((suffix) => normalizeKey(doc.id).endsWith(suffix))) return true;
        const ledgerRowIds = new Set([
            normalizeKey(row.id),
            ...segmentIds.map((id) => normalizeKey(`${row.card.id}:${id}`))
        ].filter(Boolean));
        const segmentIdSet = new Set(segmentIds.map((id) => normalizeKey(id)).filter(Boolean));
        return (doc.lineItems ?? []).some((item) => (
            ledgerRowIds.has(normalizeKey(item.sourceLedgerRowId)) ||
            segmentIdSet.has(normalizeKey(item.sourceSegmentId))
        ));
    }, [getCardLedgerRowDocumentSuffix]);

    const matchesCardBillingDocument = useCallback((doc: CardBillingDocument, row: CardLedgerRow) => {
        if (normalizeKey(doc.cardId) !== normalizeKey(row.card.id)) return false;
        if (normalizeKey(doc.yearMonth) !== normalizeKey(yearMonth)) return false;

        const identity = resolveCardBillingIdentity(row);
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

        const hasLedgerMarkers = normalizeKey(doc.id).includes('__row_') || (doc.lineItems ?? []).some((item) => (
            item.sourceType === 'card_ledger' ||
            Boolean(item.sourceLedgerRowId) ||
            Boolean(item.sourceSegmentId)
        ));

        if (hasLedgerMarkers) {
            return hasCardLedgerRowMarker(doc, row);
        }

        return Number(doc.totalAmount ?? 0) === Number(row.total ?? 0);
    }, [resolveCardBillingIdentity, yearMonth, hasCardLedgerRowMarker]);

    const getBillingDocumentsForRow = useCallback((row: CardLedgerRow) => {
        return billingDocuments.filter((doc) => matchesCardBillingDocument(doc, row));
    }, [billingDocuments, matchesCardBillingDocument]);

    const getMarkedBillingDocumentsForRow = useCallback((row: CardLedgerRow) => {
        return billingDocuments.filter((doc) => (
            normalizeKey(doc.cardId) === normalizeKey(row.card.id) &&
            normalizeKey(doc.yearMonth) === normalizeKey(yearMonth) &&
            hasCardLedgerRowMarker(doc, row)
        ));
    }, [billingDocuments, hasCardLedgerRowMarker, yearMonth]);

    const getAllBillingDocumentsForRow = useCallback((row: CardLedgerRow) => {
        const documents = [
            ...getBillingDocumentsForRow(row),
            ...getMarkedBillingDocumentsForRow(row)
        ];
        return documents.filter((doc, index, list) => (
            Boolean(doc.id) && list.findIndex((item) => item.id === doc.id) === index
        ));
    }, [getBillingDocumentsForRow, getMarkedBillingDocumentsForRow]);

    const getRowBillingState = useCallback((row: CardLedgerRow): {
        status: BillingRowStatus;
        documents: CardBillingDocument[];
        reason?: string;
    } => {
        const identity = resolveCardBillingIdentity(row);
        if (!identity || (
            identity.teamIds.size === 0 &&
            identity.teamNames.size === 0 &&
            identity.workerIds.size === 0 &&
            identity.workerNames.size === 0
        )) {
            return { status: 'blocked', documents: [], reason: '청구대상 없음' };
        }
        if (row.total <= 0) return { status: 'blocked', documents: [], reason: '금액 없음' };

        const documents = getAllBillingDocumentsForRow(row);
        if (documents.length === 0) return { status: 'unbilled', documents };
        return { status: 'billed', documents };
    }, [getAllBillingDocumentsForRow, resolveCardBillingIdentity]);

    const billingRows = useMemo(() => {
        return rows
            .map((row, index) => ({ row, index, billingState: getRowBillingState(row) }))
            .filter(({ billingState }) => {
                if (billingFilter === 'all') return true;
                if (billingFilter === 'unbilled') return billingState.status === 'unbilled' || billingState.status === 'blocked';
                return billingState.status === billingFilter;
            });
    }, [rows, billingFilter, getRowBillingState]);

    const cardRowCountById = useMemo(() => {
        const map = new Map<string, number>();
        rows.forEach((row) => {
            const key = normalizeKey(row.card.id);
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
        () => billingRows.filter(({ billingState }) => billingState.documents.length > 0).length,
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

    const handleTotalCommit = useCallback((index: number, numValue: number) => {
        setRows(prev => {
            const newRows = [...prev];
            const row = { ...newRows[index] };
            row.amounts = {
                ...emptyCategoryAmounts(),
                OTHER: numValue
            };
            row.total = numValue;
            newRows[index] = row;
            return newRows;
        });
        setIsDirty(true);
    }, []);

    const handleMemoChange = useCallback((index: number, memo: string) => {
        setRows(prev => {
            const newRows = [...prev];
            newRows[index] = { ...newRows[index], memo };
            return newRows;
        });
        setIsDirty(true);
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            const deleteTasks = originalTxsRef.current.map(tx =>
                cardService.deleteTransaction(tx.id).catch(e => {
                    console.warn('카드 거래 삭제 실패:', tx.id, e);
                })
            );
            await Promise.all(deleteTasks);

            const createTasks: Promise<string>[] = [];
            for (const row of rows) {
                const memoText = row.memo.trim();
                let hasAmount = false;
                for (const category of CATEGORIES) {
                    const amount = row.amounts[category] ?? 0;
                    if (amount > 0) {
                        hasAmount = true;
                        createTasks.push(
                            cardService.addTransaction({
                                cardId: row.card.id,
                                cardLabel: `${row.card.name}(${row.card.last4})`,
                                date: row.segment.startDate || `${yearMonth}-01`,
                                merchant: '월별대장',
                                category,
                                amount,
                                memo: memoText || undefined
                            })
                        );
                    }
                }
                if (!hasAmount && memoText) {
                    createTasks.push(
                        cardService.addTransaction({
                            cardId: row.card.id,
                            cardLabel: `${row.card.name}(${row.card.last4})`,
                            date: row.segment.startDate || `${yearMonth}-01`,
                            merchant: '월별대장',
                            category: 'OTHER',
                            amount: 0,
                            memo: memoText
                        })
                    );
                }
            }
            await Promise.all(createTasks);

            const billingSyncTasks: Promise<void>[] = [];
            rows.forEach((row) => {
                const documents = [
                    ...getBillingDocumentsForRow(row),
                    ...getMarkedBillingDocumentsForRow(row)
                ].filter((doc, index, list) => (
                    Boolean(doc.id) && list.findIndex((item) => item.id === doc.id) === index
                ));
                if (documents.length === 0) return;

                const next = buildBillingDocumentForRow(row, documents[0]);
                if (!next) {
                    const documentIds = Array.from(new Set(documents.map((doc) => doc.id).filter(Boolean)));
                    billingSyncTasks.push(...documentIds.map((id) => cardBillingService.deleteBilling(id)));
                    return;
                }

                billingSyncTasks.push(saveCardLedgerBillingDocument(row, next, documents[0]));
            });
            await Promise.all(billingSyncTasks);

            setIsDirty(false);
            await loadData();
            alert('저장되었습니다.');
        } catch (e) {
            console.error('저장 실패:', e);
            alert('저장에 실패했습니다.');
        } finally {
            setSaving(false);
        }
    };

    const buildLineItemsForRow = (row: CardLedgerRow): CardBillingCostItem[] => {
        const source = {
            sourceType: 'card_ledger' as const,
            sourceLedgerRowId: row.id,
            sourceSegmentId: row.segment.id,
            sourceStartDate: row.segment.startDate,
            sourceEndDate: row.segment.endDate
        };
        const lineItems: CardBillingCostItem[] = [];

        CATEGORIES.forEach((category) => {
            const amount = row.amounts[category] ?? 0;
            if (amount <= 0) return;
            lineItems.push({
                id: `${category.toLowerCase()}-${sanitizeBillingIdPart(row.id)}`,
                label: `${CATEGORY_LABELS[category]} ${row.segment.startDate}~${row.segment.endDate}`,
                amount,
                type: 'VARIABLE',
                category,
                ...source
            });
        });

        return lineItems;
    };

    const buildBillingDocumentForRow = (
        row: CardLedgerRow,
        existing?: CardBillingDocument
    ): CardBillingDocument | null => {
        const target = resolveCardBillingTarget(row);
        if (!target) return null;

        const lineItems = buildLineItemsForRow(row);
        if (lineItems.length === 0) return null;

        const variableCost = lineItems.reduce((sum, item) => sum + item.amount, 0);
        const baseId = cardBillingService.buildBillingDocumentId({
            cardId: row.card.id,
            teamId: target.teamId,
            issuedToType: target.issuedToType,
            workerId: target.issuedToType === 'worker' ? target.issuedToWorkerId : undefined,
            yearMonth
        });
        const nextId = `${baseId}${getCardLedgerRowDocumentSuffix(row)}`;

        return {
            id: nextId,
            yearMonth,
            cardId: row.card.id,
            cardLabel: `${row.card.name} (${row.card.last4})`,
            assignedTeamId: target.assignedTeamId || undefined,
            assignedTeamName: target.assignedTeamName || undefined,
            teamId: target.teamId,
            teamName: target.teamName,
            issuedToType: target.issuedToType,
            issuedToWorkerId: target.issuedToType === 'worker' ? target.issuedToWorkerId : undefined,
            issuedToWorkerName: target.issuedToType === 'worker' ? target.issuedToWorkerName : target.teamName,
            variableCost,
            totalAmount: variableCost,
            status: existing?.status ?? 'DRAFT',
            lineItems,
            statementAttachmentPaths: existing?.statementAttachmentPaths ?? [],
            memo: row.memo || undefined,
            createdAt: existing?.createdAt ?? Timestamp.now(),
            updatedAt: Timestamp.now(),
            confirmedAt: existing?.confirmedAt
        };
    };

    const saveCardLedgerBillingDocument = async (
        row: CardLedgerRow,
        next: CardBillingDocument,
        existing?: CardBillingDocument
    ) => {
        const staleDocumentIds = new Set<string>();
        if (existing?.id && existing.id !== next.id) staleDocumentIds.add(existing.id);
        getMarkedBillingDocumentsForRow(row).forEach((doc) => {
            if (doc.id && doc.id !== next.id) staleDocumentIds.add(doc.id);
        });

        await cardBillingService.saveBilling(next);
        await Promise.all(Array.from(staleDocumentIds).map((id) => cardBillingService.deleteBilling(id)));
    };

    const handleCreateOrRecalculateBilling = async (row: CardLedgerRow, mode: 'create' | 'recalculate') => {
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

        setBillingProcessingId(row.id);
        try {
            const next = buildBillingDocumentForRow(row, existing);
            if (!next) {
                alert('배정 이력과 금액 기준으로 생성할 청구 문서를 찾지 못했습니다.');
                return;
            }

            await saveCardLedgerBillingDocument(row, next, existing);
            await loadData();
            alert(mode === 'recalculate' ? '청구가 다시 처리되었습니다.' : '청구 처리되었습니다.');
        } catch (error) {
            console.error(error);
            alert('청구 처리에 실패했습니다.');
        } finally {
            setBillingProcessingId('');
        }
    };

    const handleCreateSplitBilling = async (row: CardLedgerRow) => {
        if (isDirty) {
            alert('청구 전 변경사항을 먼저 전체 저장해주세요.');
            return;
        }

        const targetRows = rows.filter((item) => normalizeKey(item.card.id) === normalizeKey(row.card.id));
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
                    const next = buildBillingDocumentForRow(target.row, target.billingState.documents[0]);
                    if (!next) {
                        skipped += 1;
                        continue;
                    }

                    await saveCardLedgerBillingDocument(target.row, next, target.billingState.documents[0]);
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

    const handleSplitBillingClick = (row: CardLedgerRow, hasSplitRows: boolean) => {
        if (hasSplitRows) {
            void handleCreateSplitBilling(row);
            return;
        }

        if (onOpenBillingTarget) {
            onOpenBillingTarget(row.card);
            return;
        }

        alert('분할청구 대상 기간을 먼저 카드 청구대상 설정에서 추가해주세요.');
    };

    const buildCardDocumentWithItems = (
        document: CardBillingDocument,
        lineItems: CardBillingCostItem[],
        memo: string,
        status: CardBillingDocument['status']
    ): CardBillingDocument => {
        const variableCost = lineItems.reduce((sum, item) => sum + (Number.isFinite(item.amount) ? item.amount : 0), 0);
        return {
            ...document,
            lineItems,
            memo,
            status,
            variableCost,
            totalAmount: variableCost,
            updatedAt: Timestamp.now(),
            confirmedAt: status === 'CONFIRMED' ? Timestamp.now() : document.confirmedAt
        };
    };

    const handleSaveBillingEditor = async (
        lineItems: CardBillingCostItem[],
        memo: string,
        status: CardBillingDocument['status'] = billingEditor?.document.status ?? 'DRAFT'
    ) => {
        if (!billingEditor) return;
        setBillingProcessingId(billingEditor.row.id);
        try {
            const next = buildCardDocumentWithItems(billingEditor.document, lineItems, memo, status);
            await cardBillingService.saveBilling(next);
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

    const handleCancelBillingConfirmation = async () => {
        if (!billingEditor || billingEditor.document.status !== 'CONFIRMED') return;
        if (!window.confirm('카드 청구서 확정을 취소하고 다시 수정 가능하게 변경할까요?')) return;

        setBillingProcessingId(billingEditor.row.id);
        try {
            await cardBillingService.saveBilling({
                ...billingEditor.document,
                status: 'DRAFT',
                confirmedAt: null as unknown as Timestamp,
                updatedAt: Timestamp.now()
            });
            await loadData();
            setBillingEditor(null);
            alert('청구서 확정이 취소되었습니다.');
        } catch (error) {
            console.error(error);
            alert('청구서 확정 취소에 실패했습니다.');
        } finally {
            setBillingProcessingId('');
        }
    };

    const handleCancelBilling = async (row: CardLedgerRow, document?: CardBillingDocument) => {
        const documents = document ? [document] : getRowBillingState(row).documents;
        const documentIds = Array.from(new Set(documents.map((item) => item.id).filter(Boolean)));
        if (documentIds.length === 0) return;
        if (!window.confirm('청구 상태를 미청구로 변경할까요?')) return;

        setBillingProcessingId(row.id);
        try {
            await Promise.all(documentIds.map((id) => cardBillingService.deleteBilling(id)));
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
                : billingState.documents.length > 0
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
                        const next = buildBillingDocumentForRow(row);
                        if (!next) {
                            skipped += 1;
                            continue;
                        }
                        await saveCardLedgerBillingDocument(row, next, billingState.documents[0]);
                    } else {
                        const documentIds = Array.from(new Set(
                            billingState.documents.map((item) => item.id).filter(Boolean)
                        ));
                        if (documentIds.length === 0) {
                            skipped += 1;
                            continue;
                        }
                        await Promise.all(documentIds.map((id) => cardBillingService.deleteBilling(id)));
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

    const totals = useMemo(() => {
        const result = { ...emptyCategoryAmounts(), total: 0 };
        rows.forEach(r => {
            CATEGORIES.forEach(category => {
                result[category] += r.amounts[category] || 0;
            });
            result.total += r.total;
        });
        return result;
    }, [rows]);

    return (
        <div className="flex flex-col h-full w-full min-w-0 space-y-5">
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
                            <FontAwesomeIcon icon={faReceipt} className="text-indigo-500" />
                            월별 카드 사용 대장
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

            <div className="bg-white border border-indigo-100 shadow-xl shadow-indigo-50/50 rounded-2xl overflow-hidden flex-1 flex flex-col">
                <div className={`custom-scrollbar ${isStickyHeader ? 'overflow-auto h-[calc(100vh-400px)] min-h-[400px] border-b border-indigo-100' : 'overflow-x-auto flex-1'}`}>
                    {(loadingCards || loading) ? (
                        <div className="h-96 flex flex-col items-center justify-center text-slate-400 gap-3">
                            <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                            <p>데이터를 불러오는 중입니다...</p>
                        </div>
                    ) : (
                        <table className="support-compact-table support-compact-ledger w-full table-fixed text-[11px] lg:text-xs">
                            <colgroup>
                                <col style={{ width: '12%' }} />
                                <col style={{ width: '10%' }} />
                                <col style={{ width: '12%' }} />
                                <col style={{ width: '15%' }} />
                                <col style={{ width: '11%' }} />
                                <col style={{ width: '8%' }} />
                                <col style={{ width: '8%' }} />
                                <col style={{ width: '14%' }} />
                            </colgroup>
                            <thead className={`bg-indigo-600 text-white font-bold text-xs uppercase shadow-md ${isStickyHeader ? 'sticky top-0 z-20' : ''}`}>
                                <tr>
                                    <th className="px-4 py-4 text-left w-52 tracking-wider bg-indigo-700 border-r border-indigo-500">배정팀</th>
                                    <th className="px-4 py-4 text-left w-40 tracking-wider bg-indigo-700 border-r border-indigo-500">배정 인원</th>
                                    <th className="px-4 py-4 text-left w-52 tracking-wider bg-indigo-700 border-r border-indigo-500">청구대상</th>
                                    <th className="px-4 py-4 text-left w-48 tracking-wider bg-indigo-700">카드</th>
                                    <th className="px-2 py-4 text-center w-40 border-l border-indigo-400 bg-indigo-500">총금액</th>
                                    <th className="px-2 py-4 text-center w-28 border-l border-indigo-500">청구상태</th>
                                    <th className="px-2 py-4 text-center w-44 border-l border-indigo-500">청구작업</th>
                                    <th className="px-4 py-4 text-left border-l border-indigo-500">메모</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-indigo-50">
                                {billingRows.map(({ row, index: idx, billingState }) => {
                                    const assignmentSummary = getAssignmentSummary(row);
                                    const visibleAssignedWorkers = assignmentSummary.assignedWorkers.slice(0, 3);
                                    const billingBadge = getBillingStatusBadge(billingState.status);
                                    const isProcessing = billingProcessingId === row.id || bulkBillingAction !== '';
                                    const shouldShowPeriod = (cardRowCountById.get(normalizeKey(row.card.id)) ?? 0) > 1;

                                    return (
                                        <tr key={row.id} className="group hover:bg-blue-50/40 transition-colors">
                                            <td
                                                className="px-4 py-3 border-r border-indigo-50 bg-white"
                                                style={assignmentSummary.primaryColor ? {
                                                    borderLeft: `4px solid ${assignmentSummary.primaryColor}`,
                                                    backgroundColor: hexToRgba(assignmentSummary.primaryColor, 0.05)
                                                } : undefined}
                                            >
                                                {assignmentSummary.assignedTeams.length > 0 ? (
                                                    <div className="flex flex-col gap-1.5">
                                                        {assignmentSummary.assignedTeams.map((team) => (
                                                            <div key={`assigned-${team.key}`} className="flex items-center gap-2 min-w-0">
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
                                                {onOpenSetup && (
                                                    <button
                                                        type="button"
                                                        onClick={() => onOpenSetup(row.card)}
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
                                                            <div key={`assigned-worker-${workerName}-${workerIdx}`} className="flex items-center gap-2 min-w-0">
                                                                <span className="w-6 h-6 rounded-md flex items-center justify-center text-white text-[10px] shrink-0 bg-emerald-500">
                                                                    <FontAwesomeIcon icon={faUser} />
                                                                </span>
                                                                <span className="font-bold text-slate-700 text-xs leading-tight truncate max-w-[145px]" title={workerName}>
                                                                    {workerName}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-300 text-xs">-</span>
                                                )}
                                            </td>

                                            <td className="px-4 py-3 border-r border-indigo-50 bg-white">
                                                {assignmentSummary.billingTargets.length > 0 ? (
                                                    <div className="flex flex-col gap-1.5">
                                                        {assignmentSummary.billingTargets.map((target) => (
                                                            <div key={`billing-${target.key}`} className="flex items-center gap-2 min-w-0">
                                                                 <span
                                                                     className="w-6 h-6 rounded-md flex items-center justify-center text-white text-[10px] shrink-0"
                                                                     style={{ backgroundColor: target.color, color: getContrastingTextColor(target.color) }}
                                                                 >
                                                                    <FontAwesomeIcon icon={
                                                                        target.targetType === 'WORKER' || target.targetType === 'OFFICE_STAFF'
                                                                            ? faUser
                                                                            : target.targetType === 'OFFICE'
                                                                                ? faBuilding
                                                                                : iconMap[target.icon || ''] || faUsers
                                                                    } />
                                                                </span>
                                                                <span className="font-bold text-slate-700 truncate max-w-[160px]" title={target.name}>
                                                                    {target.name}
                                                                    {(target.targetLabel || target.subLabel) && (
                                                                        <span className="block text-[10px] font-semibold text-slate-400">
                                                                            {target.targetLabel ? `${target.targetLabel} · ` : ''}
                                                                            {target.subLabel || ''}
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

                                            <td className="px-4 py-3 border-r border-indigo-50 font-bold text-slate-700 bg-white group-hover:bg-blue-50/40">
                                                <div>
                                                    {row.card.name} ({row.card.last4})
                                                    <div className="text-[10px] text-slate-400 font-normal mt-0.5 font-mono">
                                                        {row.card.issuer} · {row.card.cardType === 'CREDIT' ? '신용' : '체크'}
                                                    </div>
                                                    {shouldShowPeriod && (
                                                        <div className="text-[10px] text-indigo-400 font-semibold mt-0.5">{assignmentSummary.periodLabel}</div>
                                                    )}
                                                </div>
                                            </td>

                                            <EditableCell
                                                value={row.total}
                                                onCommit={(numValue) => handleTotalCommit(idx, numValue)}
                                                tdClassName="p-1 border-r border-indigo-50/50 bg-indigo-50/30 group-hover:bg-indigo-50/60"
                                                className={`w-full text-right p-2 focus:outline-none transition rounded-lg text-base font-extrabold font-mono
                                                    text-indigo-700 bg-transparent hover:bg-white focus:bg-white focus:ring-2 focus:ring-indigo-100
                                                    ${row.total > 500000 ? 'text-red-500' : ''}
                                                `}
                                            />

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
                                                                onClick={() => handleSplitBillingClick(row, false)}
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
                                                                onClick={() => handleCreateOrRecalculateBilling(row, 'create')}
                                                                className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:bg-indigo-300 whitespace-nowrap"
                                                            >
                                                                {isProcessing ? '처리중' : '청구'}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                disabled={isProcessing}
                                                                onClick={() => handleSplitBillingClick(row, shouldShowPeriod)}
                                                                className="px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-700 text-xs font-bold border border-amber-200 hover:bg-amber-100 disabled:text-amber-300 disabled:bg-amber-50 whitespace-nowrap"
                                                                title={shouldShowPeriod ? '분할된 미청구 기간을 한 번에 청구' : '분할청구 대상 기간 만들기'}
                                                            >
                                                                분할청구
                                                            </button>
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

                                            <td className="p-1">
                                                <input
                                                    type="text"
                                                    value={row.memo}
                                                    onChange={(e) => handleMemoChange(idx, e.target.value)}
                                                    className={`w-full p-2 focus:outline-none focus:bg-indigo-50 focus:ring-1 focus:ring-indigo-200 rounded-lg text-xs bg-transparent ${row.memo ? 'text-red-600 font-extrabold' : 'text-slate-600'}`}
                                                    placeholder=""
                                                />
                                            </td>
                                        </tr>
                                    );
                                })}
                                {billingRows.length === 0 && (
                                    <tr>
                                        <td colSpan={8} className="p-20 text-center text-slate-400 bg-slate-50/50">
                                            <div className="flex flex-col items-center gap-3">
                                                <FontAwesomeIcon icon={faReceipt} className="text-4xl text-slate-300" />
                                                <p>조건에 맞는 카드 대장 행이 없습니다.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                            <tfoot className="bg-slate-800 text-white font-bold text-sm tracking-wide sticky bottom-0 z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                                <tr>
                                    <td colSpan={4} className="p-4 border-r border-slate-600 text-center">합계</td>
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

            <div className="flex items-start gap-4 p-4 bg-amber-50 rounded-xl border border-amber-200 shadow-sm">
                <div className="bg-amber-100 p-2 rounded-full text-amber-600">
                    <FontAwesomeIcon icon={faExclamationTriangle} />
                </div>
                <div>
                    <h4 className="font-bold text-amber-800 text-sm mb-1">입력 가이드</h4>
                    <p className="text-xs text-amber-700 leading-relaxed">
                        * 카드 금액은 청구대상 기간별 행에 입력합니다.<br />
                        * 같은 달에 청구대상이 바뀌면 거래일 또는 입력 행의 시작일 기준으로 나뉘어 청구됩니다.<br />
                        * 분할된 카드는 <strong>[분할청구]</strong>로 미청구 기간을 한 번에 처리합니다.<br />
                        * 모든 변경사항은 <strong>[전체 저장]</strong> 버튼을 눌러야 반영됩니다.
                    </p>
                </div>
            </div>

            {billingEditor && (
                <LedgerBillingEditorModal<CardBillingCostItem>
                    title={`${billingEditor.document.cardLabel} 카드 청구서`}
                    subtitle={`${billingEditor.document.yearMonth} · ${billingEditor.document.teamName || billingEditor.document.issuedToWorkerName || '청구대상'}`}
                    statusLabel={billingEditor.document.status === 'CONFIRMED' ? '확정' : '작성중'}
                    readOnly={billingEditor.document.status === 'CONFIRMED'}
                    lineItems={billingEditor.document.lineItems ?? []}
                    memo={billingEditor.document.memo ?? ''}
                    saving={billingProcessingId === billingEditor.row.id}
                    onClose={() => setBillingEditor(null)}
                    onSave={(lineItems, memo) => handleSaveBillingEditor(lineItems, memo)}
                    onConfirm={(lineItems, memo) => handleSaveBillingEditor(lineItems, memo, 'CONFIRMED')}
                    onCancelConfirm={handleCancelBillingConfirmation}
                />
            )}
        </div>
    );
};
