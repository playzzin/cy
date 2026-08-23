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
    faUser,
    faUpload
} from '@fortawesome/free-solid-svg-icons';
import { FileText, Sparkles } from 'lucide-react';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
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
import { cardMonthlyLedgerMutationService } from '../../services/cardMonthlyLedgerMutationService';
import {
    assignCardLedgerOrphanDrafts,
    cardMonthlyLedgerAutoBillingService,
    excludeProtectedOrphanCardRows,
    getCardIdsWithProtectedOrphanBillings,
    mergeCardLedgerWithPreservedManualLineItems
} from '../../services/cardMonthlyLedgerAutoBillingService';
import { teamSettlementProtectionService } from '../../services/teamSettlementProtectionService';
import { Team } from '../../services/teamService';
import { Worker, manpowerService } from '../../services/manpowerService';
import { OfficeStaff, officeStaffService } from '../../services/officeStaffService';
import { iconMap } from '../../constants/iconMap';
import { Timestamp } from '../../types/timestamp';
import { storage } from '../../config/firebase';
import CardStatementImportModal from './CardStatementImportModal';
import SupportSaveFeedback, { SupportSaveFeedbackState } from '../support/SupportSaveFeedback';
import { OFFICE_ASSIGNMENT_TEAM_ID, OFFICE_ASSIGNMENT_TEAM_NAME, isOfficeStaffAssignmentReference } from '../../utils/supportAssignmentTargets';
import { DEFAULT_SUPPORT_BILLING_START_DATE, isSupportBillingMonthEnabled, maxIsoDate, minIsoDate } from '../../utils/supportBillingPeriod';
import { getContrastingTextColor } from '../../utils/color';
import {
    getSupportManagementMonthDate,
    rememberSupportManagementYearMonth,
    subscribeSupportManagementYearMonth,
} from '../../utils/supportManagementState';
import { SUPPORT_WRITE_RETRY_USER_MESSAGE } from '../../utils/supportWriteErrorReporting';
import {
    dedupeImportedStatementTransactions,
    dedupeStatementPaths,
    isLegacyCardStatementImportBillingDocument
} from '../../utils/cardStatementDeduplication';

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
const isPostedCardBillingDocument = (document: CardBillingDocument): boolean => (
    ['CONFIRMED', 'PAID', 'OVERDUE'].includes(normalizeKey(document.status).toUpperCase())
);
const isPdfImportMemo = (value: unknown): boolean => /\bpdf\b.*(?:import|가져)/i.test(normalizeKey(value));
const getTransactionStatementPaths = (transaction: CardTransaction): string[] => dedupeStatementPaths([
    transaction.evidenceUrl,
    ...(transaction.statementAttachmentPaths ?? [])
]);
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
    statementAttachmentPaths: string[];
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

const getCardLedgerStructureFingerprint = (row: CardLedgerRow): string => JSON.stringify({
    id: normalizeKey(row.id),
    cardId: normalizeKey(row.card.id),
    segmentId: normalizeKey(row.segment.id),
    startDate: normalizeKey(row.segment.startDate),
    endDate: normalizeKey(row.segment.endDate),
    assigneeId: normalizeKey(row.segment.assigneeId),
    assigneeType: normalizeKey(row.segment.assigneeType),
    teamId: normalizeKey(row.segment.teamId),
    billingTargetId: normalizeKey(row.segment.billingTargetId),
    billingTargetType: normalizeKey(row.segment.billingTargetType),
    billingTeamId: normalizeKey(row.segment.billingTeamId)
});

interface CardMonthlyLedgerProps {
    cards: Card[];
    teams?: Team[];
    loadingCards: boolean;
    onOpenSetup?: (card: Card) => void;
    onOpenBillingTarget?: (card: Card) => void;
}

const hexToRgba = (hex: string, alpha: number) => {
    const normalized = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : '#94a3b8';
    const r = parseInt(normalized.slice(1, 3), 16);
    const g = parseInt(normalized.slice(3, 5), 16);
    const b = parseInt(normalized.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
};

export const CardMonthlyLedger: React.FC<CardMonthlyLedgerProps> = ({ cards, teams = [], loadingCards, onOpenSetup, onOpenBillingTarget }) => {
    const [currentDate, setCurrentDate] = useState(getSupportManagementMonthDate);
    const [yearMonth, setYearMonth] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [saveFeedback, setSaveFeedback] = useState<SupportSaveFeedbackState | null>(null);
    const [isStickyHeader, setIsStickyHeader] = useState(false);

    const [rows, setRows] = useState<CardLedgerRow[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [officeStaffRows, setOfficeStaffRows] = useState<OfficeStaff[]>([]);
    const [billingDocuments, setBillingDocuments] = useState<CardBillingDocument[]>([]);
    const [statementUploadingRowId, setStatementUploadingRowId] = useState('');
    const [isStatementImportOpen, setIsStatementImportOpen] = useState(false);
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

        type AssignmentTimelineEntry = {
            assignment: CardAssignmentRecord;
            startDate: Date | null;
            endDate: Date | null;
            rawEndDate: string;
        };

        const activeAssignments: AssignmentTimelineEntry[] = assignmentList
            .filter((assignment) => normalizeKey(assignment.cardId) === cardId)
            .map((assignment) => ({
                assignment,
                startDate: parseYmdDate(assignment.startDate),
                endDate: parseYmdDate(assignment.endDate),
                rawEndDate: normalizeKey(assignment.endDate)
            }))
            .filter((entry) => {
                if (!entry.startDate) return false;
                if (entry.rawEndDate && !entry.endDate) return false;
                if (entry.endDate && entry.endDate.getTime() < entry.startDate.getTime()) return false;
                if (entry.startDate.getTime() > monthRange.monthEnd.getTime()) return false;
                if (entry.endDate && entry.endDate.getTime() < monthRange.monthStart.getTime()) return false;
                return true;
            })
            .sort((a, b) => {
                const startDiff = (a.startDate?.getTime() ?? 0) - (b.startDate?.getTime() ?? 0);
                if (startDiff !== 0) return startDiff;
                return String(a.assignment.id ?? '').localeCompare(String(b.assignment.id ?? ''));
            });

        const findAssignmentForRange = (segmentStart: Date, segmentEnd: Date): AssignmentTimelineEntry | undefined => {
            const overlapping = activeAssignments.filter((entry) => {
                if (!entry.startDate) return false;
                const assignmentEnd = entry.endDate ?? monthRange.monthEnd;
                return entry.startDate.getTime() <= segmentEnd.getTime() && assignmentEnd.getTime() >= segmentStart.getTime();
            });
            if (overlapping.length > 0) return overlapping[overlapping.length - 1];

            const currentAssigneeId = normalizeKey(card.currentAssigneeId);
            const currentAssigneeName = normalizeKey(card.currentAssigneeName);
            if (currentAssigneeId && card.currentAssigneeType && currentAssigneeName) {
                const snapshotAssignment: CardAssignmentRecord = {
                    id: `snapshot-${card.id}`,
                    cardId: card.id,
                    cardLabel: `${card.name} (${card.last4})`,
                    assigneeId: currentAssigneeId,
                    assigneeType: card.currentAssigneeType,
                    assigneeName: currentAssigneeName,
                    startDate: formatYmdDate(monthRange.monthStart)
                };

                return {
                    assignment: snapshotAssignment,
                    startDate: monthRange.monthStart,
                    endDate: null,
                    rawEndDate: ''
                };
            }
            return undefined;
        };

        const buildSegmentFromAssignment = (
            entry: AssignmentTimelineEntry | undefined,
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
                endDate: parseYmdDate(target.endDate),
                rawEndDate: normalizeKey(target.endDate)
            }))
            .filter((entry) => {
                if (!entry.startDate) return false;
                if (entry.rawEndDate && !entry.endDate) return false;
                if (entry.endDate && entry.endDate.getTime() < entry.startDate.getTime()) return false;
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
                const segmentStart = maxDate(entry.startDate ?? monthRange.monthStart, monthRange.monthStart);
                const segmentEnd = minDate(entry.endDate ?? monthRange.monthEnd, monthRange.monthEnd);
                if (segmentEnd.getTime() < segmentStart.getTime()) return [];

                const assignment = findAssignmentForRange(segmentStart, segmentEnd);
                const segment = buildSegmentFromAssignment(assignment, segmentStart, segmentEnd, 0, {
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

        // 분실/정지·해지 카드는 실제 배정 또는 청구 기간이 겹치는 달에만
        // 표시한다. 이후 달에는 빈 행을 만들지 않는다.
        if (card.status === 'SUSPENDED' || card.status === 'CLOSED') return [];

        return [{
            id: `unassigned-${card.id}`,
            startDate: formatYmdDate(monthRange.monthStart),
            endDate: formatYmdDate(monthRange.monthEnd),
            overlapDays: monthRange.daysInMonth
        }];
    }, [monthRange, resolveAssigneeTeam, teamByAnyId, teamByName, workerByAnyId, workerByName, yearMonth]);

    const loadData = useCallback(async (options?: {
        strictBillingRead?: boolean;
    }): Promise<{
        rows: CardLedgerRow[];
        billings: CardBillingDocument[];
    } | null> => {
        if (!yearMonth) return null;
        setLoading(true);
        try {
            const billingPromise = options?.strictBillingRead
                ? cardBillingService.getBillingsByMonth(yearMonth)
                : cardBillingService.getBillingsByMonth(yearMonth).catch(() => [] as CardBillingDocument[]);
            const [txs, assignmentList, billingTargetList, billings] = await Promise.all([
                cardService.getTransactionsByMonth(yearMonth),
                cardService.listAllCardAssignments(),
                cardService.listAllCardBillingTargets(),
                billingPromise
            ]);
            const dedupedTransactions = dedupeImportedStatementTransactions(txs);
            // Keep every physical document for the next save/cancel pass. Only the
            // displayed totals are deduplicated; otherwise a hidden duplicate can
            // survive forever because its document id is no longer available here.
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
                    memo: '',
                    statementAttachmentPaths: []
                }));
            });

            dedupedTransactions.forEach((tx) => {
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
                const transactionMemo = normalizeKey(tx.memo);
                if (transactionMemo && (
                    !row.memo ||
                    isPdfImportMemo(row.memo) ||
                    !isPdfImportMemo(transactionMemo)
                )) {
                    row.memo = transactionMemo;
                }
                row.statementAttachmentPaths = dedupeStatementPaths([
                    ...row.statementAttachmentPaths,
                    ...getTransactionStatementPaths(tx)
                ]);
            });

            newRows.forEach((row) => {
                row.total = CATEGORIES.reduce((sum, category) => sum + (row.amounts[category] || 0), 0);
            });

            newRows.sort(compareCardLedgerRowsByBillingTarget);
            setRows(newRows);
            setIsDirty(false);
            return { rows: newRows, billings };
        } catch (e) {
            console.error('카드 월별대장 로드 실패:', e);
            if (!options?.strictBillingRead) setRows([]);
            return null;
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

        // Posted legacy documents may predate deterministic row markers and
        // may carry an older amount. Protect the whole matching card/target
        // scope rather than allowing an edited ledger row to bypass them.
        if (isPostedCardBillingDocument(doc)) return true;

        const hasLedgerMarkers = normalizeKey(doc.id).includes('__row_') || (doc.lineItems ?? []).some((item) => (
            item.sourceType === 'card_ledger' ||
            Boolean(item.sourceLedgerRowId) ||
            Boolean(item.sourceSegmentId)
        ));

        if (hasLedgerMarkers) {
            if (hasCardLedgerRowMarker(doc, row)) return true;

            // Older PDF imports wrote a base cardBillings document whose
            // sourceLedgerRowId was the imported transaction id, not this
            // ledger row id. Treat the matching amount as already billed so
            // bulk billing cannot create a second __row_ document.
            return isLegacyCardStatementImportBillingDocument(doc);
        }

        // A deterministic base id or amount equality is not an ownership
        // marker. The manual billing editor uses the same base envelope, so an
        // unmarked DRAFT must be preserved instead of being replaced by Save.
        return false;
    }, [resolveCardBillingIdentity, yearMonth, hasCardLedgerRowMarker]);

    const getBillingDocumentsForRow = useCallback((
        row: CardLedgerRow,
        documents: CardBillingDocument[] = billingDocuments
    ) => {
        return documents.filter((doc) => matchesCardBillingDocument(doc, row));
    }, [billingDocuments, matchesCardBillingDocument]);

    const getMarkedBillingDocumentsForRow = useCallback((
        row: CardLedgerRow,
        documents: CardBillingDocument[] = billingDocuments
    ) => {
        return documents.filter((doc) => (
            normalizeKey(doc.cardId) === normalizeKey(row.card.id) &&
            normalizeKey(doc.yearMonth) === normalizeKey(yearMonth) &&
            hasCardLedgerRowMarker(doc, row)
        ));
    }, [billingDocuments, hasCardLedgerRowMarker, yearMonth]);

    const getAllBillingDocumentsForRow = useCallback((
        row: CardLedgerRow,
        documents: CardBillingDocument[] = billingDocuments
    ) => {
        const candidates = [
            ...getBillingDocumentsForRow(row, documents),
            ...getMarkedBillingDocumentsForRow(row, documents)
        ];
        return candidates.filter((doc, index, list) => (
            Boolean(doc.id) && list.findIndex((item) => item.id === doc.id) === index
        ));
    }, [billingDocuments, getBillingDocumentsForRow, getMarkedBillingDocumentsForRow]);

    const cardRowCountById = useMemo(() => {
        const map = new Map<string, number>();
        rows.forEach((row) => {
            const key = normalizeKey(row.card.id);
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
        setSaveFeedback(null);
    }, []);

    const handleMemoChange = useCallback((index: number, memo: string) => {
        setRows(prev => {
            const newRows = [...prev];
            newRows[index] = { ...newRows[index], memo };
            return newRows;
        });
        setIsDirty(true);
        setSaveFeedback(null);
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            // Saving is safety-sensitive: unlike the normal screen load, this
            // read must never degrade to an empty billing list. A failed read
            // aborts before any ledger transaction is written.
            const [freshBillingDocuments, confirmedSettlementKeys] = await Promise.all([
                cardBillingService.getBillingsByMonth(yearMonth),
                teamSettlementProtectionService.getConfirmedTeamSettlementKeys(yearMonth)
            ]);
            // A positive row without a resolvable billing target must not be
            // persisted by itself: that would make the ledger and team expense
            // disagree. Zero rows remain eligible so their saved transactions
            // and associated DRAFT billing can be cleared.
            const resolvedTargetsByRowId = new Map(
                rows.map((row) => [row.id, resolveCardBillingTarget(row)] as const)
            );
            const missingTargetRows = rows.filter((row) => (
                row.total > 0 && !resolvedTargetsByRowId.get(row.id)
            ));
            const missingTargetRowIds = new Set(missingTargetRows.map((row) => row.id));
            const settlementProtectedRows = rows.filter((row) => {
                const target = resolvedTargetsByRowId.get(row.id);
                return Boolean(target && teamSettlementProtectionService.isConfirmedTarget(
                    confirmedSettlementKeys,
                    { teamId: target.teamId, teamName: target.teamName }
                ));
            });
            const settlementProtectedRowIds = new Set(settlementProtectedRows.map((row) => row.id));
            const postedBillingProtectedRows = rows.filter((row) => (
                getAllBillingDocumentsForRow(row, freshBillingDocuments)
                    .some(isPostedCardBillingDocument)
            ));
            const postedBillingProtectedRowIds = new Set(
                postedBillingProtectedRows.map((row) => row.id)
            );
            const preflightClaimedBillingIds = new Set(
                rows.flatMap((row) => (
                    getAllBillingDocumentsForRow(row, freshBillingDocuments)
                        .map((document) => document.id)
                        .filter(Boolean)
                ))
            );
            const protectedOrphanCardIds = getCardIdsWithProtectedOrphanBillings({
                yearMonth,
                billings: freshBillingDocuments,
                claimedBillingIds: preflightClaimedBillingIds,
                currentCardIds: new Set(rows.map((row) => normalizeKey(row.card.id)).filter(Boolean)),
                isProtectedTarget: (document) => teamSettlementProtectionService.isConfirmedTarget(
                    confirmedSettlementKeys,
                    { teamId: document.teamId, teamName: document.teamName }
                )
            });
            const rowsWithoutDirectProtection = rows.filter((row) => (
                !missingTargetRowIds.has(row.id) &&
                !settlementProtectedRowIds.has(row.id) &&
                !postedBillingProtectedRowIds.has(row.id)
            ));
            const eligibleRows = excludeProtectedOrphanCardRows(
                rowsWithoutDirectProtection,
                protectedOrphanCardIds,
                (row) => row.card.id
            );
            const eligibleRowIds = new Set(eligibleRows.map((row) => row.id));
            const eligibleRowsByCardId = new Map<string, CardLedgerRow[]>();
            eligibleRows.forEach((row) => {
                const cardId = normalizeKey(row.card.id);
                const cardRows = eligibleRowsByCardId.get(cardId) ?? [];
                cardRows.push(row);
                eligibleRowsByCardId.set(cardId, cardRows);
            });
            const sourceFullyEligibleCardIds = new Set<string>();
            const allRowsByCardId = new Map<string, CardLedgerRow[]>();
            rows.forEach((row) => {
                const cardId = normalizeKey(row.card.id);
                const cardRows = allRowsByCardId.get(cardId) ?? [];
                cardRows.push(row);
                allRowsByCardId.set(cardId, cardRows);
            });
            allRowsByCardId.forEach((cardRows, cardId) => {
                if (cardRows.length === (eligibleRowsByCardId.get(cardId)?.length ?? 0)) {
                    sourceFullyEligibleCardIds.add(cardId);
                }
            });

            const result = await cardMonthlyLedgerMutationService.saveMonthlyLedger({
                yearMonth,
                visibleRows: eligibleRows.map((row) => ({ row })),
                originalTransactions: originalTxsRef.current,
                categories: CATEGORIES,
                getBillingDocumentsForRow: (row) => (
                    getAllBillingDocumentsForRow(row, freshBillingDocuments)
                )
            });

            setIsDirty(false);
            const persistedSnapshot = await loadData({ strictBillingRead: true });
            if (!persistedSnapshot) {
                setSaveFeedback({
                    status: 'warning',
                    title: '대장은 저장됐지만 자동 반영을 확인하지 못했습니다.',
                    message: '저장된 데이터를 다시 불러오지 못해 팀별 경비 자동 반영을 중단했습니다. 잠시 후 저장을 다시 누르면 중복 없이 재시도됩니다.',
                    operationId: result.operationId
                });
                return;
            }

            const postSaveRowsByCardId = new Map<string, CardLedgerRow[]>();
            persistedSnapshot.rows.forEach((row) => {
                const cardId = normalizeKey(row.card.id);
                const cardRows = postSaveRowsByCardId.get(cardId) ?? [];
                cardRows.push(row);
                postSaveRowsByCardId.set(cardId, cardRows);
            });
            const postSaveStructureChangedCardIds = new Set<string>();
            sourceFullyEligibleCardIds.forEach((cardId) => {
                const beforeFingerprints = (allRowsByCardId.get(cardId) ?? [])
                    .map(getCardLedgerStructureFingerprint)
                    .sort();
                const afterFingerprints = (postSaveRowsByCardId.get(cardId) ?? [])
                    .map(getCardLedgerStructureFingerprint)
                    .sort();
                if (JSON.stringify(beforeFingerprints) !== JSON.stringify(afterFingerprints)) {
                    postSaveStructureChangedCardIds.add(cardId);
                }
            });
            const persistedEligibleRows = persistedSnapshot.rows.filter((row) => (
                eligibleRowIds.has(row.id) &&
                !postSaveStructureChangedCardIds.has(normalizeKey(row.card.id))
            ));
            let postSaveConfirmedSettlementKeys: Awaited<ReturnType<
                typeof teamSettlementProtectionService.getConfirmedTeamSettlementKeys
            >>;
            try {
                // Re-read immediately after the ledger commit. If a team was
                // confirmed between preflight and commit, do not create a new
                // DRAFT billing for that now-protected settlement.
                postSaveConfirmedSettlementKeys = await teamSettlementProtectionService
                    .getConfirmedTeamSettlementKeys(yearMonth);
            } catch (error) {
                console.error('[CardMonthlyLedger] post-save settlement protection read failed', { yearMonth }, error);
                setSaveFeedback({
                    status: 'warning',
                    title: '대장은 저장됐지만 팀별 경비 반영을 중단했습니다.',
                    message: '팀정산 확정 상태를 다시 확인하지 못해 새 경비를 만들지 않았습니다. 상태를 확인한 뒤 저장을 다시 눌러주세요.',
                    operationId: result.operationId
                });
                return;
            }
            const postSaveSettlementProtectedRowIds = new Set(
                persistedEligibleRows
                    .filter((row) => {
                        const target = resolveCardBillingTarget(row);
                        return Boolean(target && teamSettlementProtectionService.isConfirmedTarget(
                            postSaveConfirmedSettlementKeys,
                            { teamId: target.teamId, teamName: target.teamName }
                        ));
                    })
                    .map((row) => row.id)
            );
            const candidateAutoBillingRows = persistedEligibleRows.filter((row) => (
                !postSaveSettlementProtectedRowIds.has(row.id)
            ));
            const claimedBillingIds = new Set(
                persistedSnapshot.rows.flatMap((row) => (
                    getAllBillingDocumentsForRow(row, persistedSnapshot.billings)
                        .map((document) => document.id)
                        .filter(Boolean)
                ))
            );
            const postSaveProtectedOrphanCardIds = getCardIdsWithProtectedOrphanBillings({
                yearMonth,
                billings: persistedSnapshot.billings,
                claimedBillingIds,
                currentCardIds: new Set(
                    candidateAutoBillingRows.map((row) => normalizeKey(row.card.id)).filter(Boolean)
                ),
                isProtectedTarget: (document) => teamSettlementProtectionService.isConfirmedTarget(
                    postSaveConfirmedSettlementKeys,
                    { teamId: document.teamId, teamName: document.teamName }
                )
            });
            const autoBillingRows = candidateAutoBillingRows.filter((row) => (
                !postSaveProtectedOrphanCardIds.has(normalizeKey(row.card.id))
            ));
            const autoBillingRowIds = new Set(autoBillingRows.map((row) => row.id));
            const persistedRowsByCardId = new Map<string, CardLedgerRow[]>();
            persistedSnapshot.rows.forEach((row) => {
                const cardId = normalizeKey(row.card.id);
                const cardRows = persistedRowsByCardId.get(cardId) ?? [];
                cardRows.push(row);
                persistedRowsByCardId.set(cardId, cardRows);
            });
            const fullyEligibleCardIds = new Set<string>();
            persistedRowsByCardId.forEach((cardRows, cardId) => {
                if (cardRows.length > 0 && cardRows.every((row) => autoBillingRowIds.has(row.id))) {
                    fullyEligibleCardIds.add(cardId);
                }
            });
            const orphanDraftsByOwnerRowId = assignCardLedgerOrphanDrafts({
                yearMonth,
                rows: autoBillingRows.map((row) => ({
                    id: row.id,
                    cardId: row.card.id,
                    total: row.total
                })),
                billings: persistedSnapshot.billings,
                claimedBillingIds,
                fullyEligibleCardIds,
                isProtectedTarget: (document) => teamSettlementProtectionService.isConfirmedTarget(
                    postSaveConfirmedSettlementKeys,
                    { teamId: document.teamId, teamName: document.teamName }
                )
            });
            const autoBillingResult = await cardMonthlyLedgerAutoBillingService.reconcileSavedBillings(
                autoBillingRows,
                {
                    getAtomicScopeKey: (row) => normalizeKey(row.card.id),
                    getBillingDocumentsForRow: (row) => {
                        const documents = [
                            ...getAllBillingDocumentsForRow(row, persistedSnapshot.billings),
                            ...(orphanDraftsByOwnerRowId.get(row.id) ?? [])
                        ];
                        return documents.filter((document, index, list) => (
                            Boolean(document.id) && list.findIndex((item) => item.id === document.id) === index
                        ));
                    },
                    buildBillingDocumentForRow
                }
            );

            // Reflect the billing documents actually committed by reconciliation.
            const finalSnapshot = await loadData({ strictBillingRead: true });
            const protectedCount = Math.max(
                result.skippedBillingCount,
                autoBillingResult.protectedCount,
                postedBillingProtectedRows.length
            );
            const missingTargetCount = Math.max(
                missingTargetRows.length,
                autoBillingResult.missingTargetCount
            );
            const atomicSettlementRaceCount = autoBillingResult.failures.filter((failure) => (
                failure.message === 'team-settlement-confirmed-card-billing-blocked'
            )).length;
            const failedCount = autoBillingResult.failures.length - atomicSettlementRaceCount;
            const settlementProtectedCount = settlementProtectedRows.length;
            const protectedOrphanCardCount = protectedOrphanCardIds.size;
            const postSaveSettlementProtectedCount = postSaveSettlementProtectedRowIds.size;
            const postSaveProtectedOrphanCardCount = postSaveProtectedOrphanCardIds.size;
            const postSaveStructureChangedCardCount = postSaveStructureChangedCardIds.size;
            const hasWarning = !finalSnapshot || protectedCount > 0 || settlementProtectedCount > 0 || protectedOrphanCardCount > 0 || postSaveSettlementProtectedCount > 0 || postSaveProtectedOrphanCardCount > 0 || postSaveStructureChangedCardCount > 0 || atomicSettlementRaceCount > 0 || missingTargetCount > 0 || failedCount > 0;
            const messages = [
                `팀별 경비 자동 반영 ${autoBillingResult.upsertedCount}건`,
                autoBillingResult.deletedCount > 0 ? `0원 경비 정리 ${autoBillingResult.deletedCount}건` : '',
                protectedCount > 0 ? `확정된 원본 경비 보호로 변경하지 않은 행 ${protectedCount}건` : '',
                settlementProtectedCount > 0 ? `팀정산 확정 보호로 저장하지 않은 행 ${settlementProtectedCount}건` : '',
                protectedOrphanCardCount > 0 ? `이전 대상의 확정 경비가 남아 저장하지 않은 카드 ${protectedOrphanCardCount}개(이전 팀 확정 취소 후 다시 저장 필요)` : '',
                postSaveSettlementProtectedCount > 0 ? `저장 중 팀정산 확정 감지로 경비 반영을 중단한 행 ${postSaveSettlementProtectedCount}건(확정 취소 후 다시 저장 필요)` : '',
                postSaveProtectedOrphanCardCount > 0 ? `저장 중 이전 대상 경비 확정 감지로 새 경비 반영을 중단한 카드 ${postSaveProtectedOrphanCardCount}개(대장은 저장됨)` : '',
                postSaveStructureChangedCardCount > 0 ? `저장 중 대상/분할 변경 감지로 경비 반영을 중단한 카드 ${postSaveStructureChangedCardCount}개(새 목록 확인 후 다시 저장)` : '',
                atomicSettlementRaceCount > 0 ? `경비 반영 직전 팀정산 확정 감지 ${atomicSettlementRaceCount}건(대장은 저장됨 · 확정 취소 후 다시 저장 필요)` : '',
                missingTargetCount > 0 ? `청구대상이 없어 저장하지 않은 행 ${missingTargetCount}건` : '',
                failedCount > 0 ? `자동 반영 실패 ${failedCount}건(저장을 다시 누르면 중복 없이 재시도)` : '',
                !finalSnapshot ? '최종 저장 결과를 다시 불러오지 못함(저장 재시도로 중복 없이 확인 가능)' : ''
            ].filter(Boolean);
            setSaveFeedback({
                status: hasWarning ? 'warning' : 'success',
                title: hasWarning ? '저장 완료 · 일부 행 확인 필요' : '저장 및 팀별 경비 반영 완료',
                message: messages.join(' · '),
                operationId: result.operationId
            });
        } catch (e) {
            console.error('[CardMonthlyLedger] save failed', { yearMonth }, e);
            setSaveFeedback({
                status: 'error',
                title: '저장 실패',
                message: SUPPORT_WRITE_RETRY_USER_MESSAGE,
                operationId: `card-monthly-ledger:${yearMonth}`
            });
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

        const lineItems = mergeCardLedgerWithPreservedManualLineItems(
            buildLineItemsForRow(row),
            existing?.lineItems ?? []
        );
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
            statementAttachmentPaths: dedupeStatementPaths([
                ...(existing?.statementAttachmentPaths ?? []),
                ...row.statementAttachmentPaths
            ]),
            memo: row.memo || undefined,
            createdAt: existing?.createdAt ?? Timestamp.now(),
            updatedAt: Timestamp.now(),
            confirmedAt: existing?.confirmedAt
        };
    };

    const sanitizeStatementFileName = (name: string): string => {
        const value = String(name || '').trim();
        if (!value) return 'statement.pdf';
        return value.replace(/[\\/\n\r\t]/g, '_');
    };

    const getStatementPathsForDocuments = (documents: CardBillingDocument[]): string[] => {
        const paths = documents.flatMap((document) => document.statementAttachmentPaths ?? []);
        return dedupeStatementPaths(paths);
    };

    const handleUploadStatement = async (
        row: CardLedgerRow,
        rowBillingDocuments: CardBillingDocument[],
        file: File
    ) => {
        if (!file) return;
        if (isDirty) {
            alert('청구서 첨부 전 변경사항을 먼저 전체 저장해주세요.');
            return;
        }

        setStatementUploadingRowId(row.id);
        try {
            const rowStart = parseYmdDate(row.segment.startDate);
            const rowEnd = parseYmdDate(row.segment.endDate);
            const rowTransactions = originalTxsRef.current.filter((transaction) => {
                if (transaction.status === 'CANCELLED') return false;
                if (normalizeKey(transaction.cardId) !== normalizeKey(row.card.id)) return false;
                const transactionDate = parseYmdDate(transaction.date);
                if (!transactionDate || !rowStart || !rowEnd) return true;
                return transactionDate.getTime() >= rowStart.getTime() && transactionDate.getTime() <= rowEnd.getTime();
            });
            if (rowTransactions.length === 0) {
                throw new Error('파일을 연결할 카드 금액을 먼저 저장해주세요.');
            }

            const safeName = sanitizeStatementFileName(file.name);
            const objectPath = `card-ledger-statements/${yearMonth}/${sanitizeBillingIdPart(row.card.id)}/${sanitizeBillingIdPart(row.id)}/${Date.now()}_${safeName}`;
            await uploadBytes(storageRef(storage, objectPath), file, file.type ? { contentType: file.type } : undefined);

            const operationId = `card-statement-attachment:${yearMonth}:${row.id}:${Date.now()}`;
            await cardService.applyCardTransactionChanges({
                operationId,
                upserts: rowTransactions.map((transaction) => {
                    const nextPaths = dedupeStatementPaths([
                        ...getTransactionStatementPaths(transaction),
                        objectPath
                    ]);
                    return {
                        ...transaction,
                        id: transaction.id,
                        evidenceUrl: transaction.evidenceUrl || objectPath,
                        statementAttachmentPaths: nextPaths,
                        lastOperationId: operationId,
                        updatedAt: Timestamp.now()
                    };
                })
            });

            await Promise.all(rowBillingDocuments.map((document) => cardBillingService.saveBilling({
                ...document,
                statementAttachmentPaths: dedupeStatementPaths([
                    ...(document.statementAttachmentPaths ?? []),
                    objectPath
                ]),
                updatedAt: Timestamp.now()
            })));

            await loadData();
            alert('PDF 파일이 카드 금액과 팀별 경비 자료에 연결되었습니다.');
        } catch (error) {
            console.error(error);
            alert(error instanceof Error ? error.message : '청구서 파일 등록에 실패했습니다.');
        } finally {
            setStatementUploadingRowId('');
        }
    };

    const handleOpenStatement = async (path: string) => {
        if (!path) return;
        try {
            const url = await getDownloadURL(storageRef(storage, path));
            window.open(url, '_blank', 'noopener,noreferrer');
        } catch (error) {
            console.error(error);
            alert('청구서 파일을 열 수 없습니다.');
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
                            type="button"
                            onClick={() => handleMonthChange(-1)}
                            aria-label="이전 달"
                            title="이전 달"
                            className="w-8 h-8 flex items-center justify-center hover:bg-white hover:shadow-sm rounded-full transition text-slate-500"
                        >
                            <FontAwesomeIcon icon={faChevronLeft} />
                        </button>
                        <span className="px-4 font-bold text-slate-700 font-mono text-lg">{yearMonth}</span>
                        <button
                            type="button"
                            onClick={() => handleMonthChange(1)}
                            aria-label="다음 달"
                            title="다음 달"
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
                    <div className="flex w-full items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm sm:w-auto" aria-label="카드 PDF AI 등록">
                        <span className="hidden items-center gap-1.5 whitespace-nowrap px-2 text-[11px] font-extrabold text-slate-500 xl:inline-flex">
                            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                            AI 명세서
                        </span>
                        <button
                            type="button"
                            onClick={() => setIsStatementImportOpen(true)}
                            disabled={isDirty || saving || loading}
                            title={isDirty ? '변경사항을 먼저 저장한 뒤 PDF를 일괄등록하세요.' : '국민은행 카드 청구 PDF 여러 장을 한 번에 분석'}
                            aria-label="카드 PDF AI 등록"
                            className="inline-flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-indigo-200 bg-white px-2.5 text-xs font-extrabold text-indigo-700 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:border-slate-100 disabled:bg-slate-50 disabled:text-slate-300 sm:flex-none"
                        >
                            <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
                            카드 PDF
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
                        {saving ? '저장 및 반영 중...' : '저장'}
                    </button>
                </div>
            </div>

            {saveFeedback && (
                <SupportSaveFeedback
                    feedback={saveFeedback}
                    retryDisabled={saving}
                    onRetry={saveFeedback.status !== 'success' ? () => void handleSave() : undefined}
                    onDismiss={() => setSaveFeedback(null)}
                />
            )}

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
                                <col style={{ width: '15%' }} />
                                <col style={{ width: '12%' }} />
                                <col style={{ width: '16%' }} />
                                <col style={{ width: '17%' }} />
                                <col style={{ width: '13%' }} />
                                <col style={{ width: '12%' }} />
                                <col style={{ width: '15%' }} />
                            </colgroup>
                            <thead className={`bg-indigo-600 text-white font-bold text-xs uppercase shadow-md ${isStickyHeader ? 'sticky top-0 z-20' : ''}`}>
                                <tr>
                                    <th className="px-4 py-4 text-left w-52 tracking-wider bg-indigo-700 border-r border-indigo-500">배정팀</th>
                                    <th className="px-4 py-4 text-left w-40 tracking-wider bg-indigo-700 border-r border-indigo-500">배정 인원</th>
                                    <th className="px-4 py-4 text-left w-52 tracking-wider bg-indigo-700 border-r border-indigo-500">청구대상</th>
                                    <th className="px-4 py-4 text-left w-48 tracking-wider bg-indigo-700">카드</th>
                                    <th className="px-2 py-4 text-center w-40 border-l border-indigo-400 bg-indigo-500">총금액</th>
                                    <th className="px-2 py-4 text-center w-40 border-l border-indigo-500">사용내역서</th>
                                    <th className="px-4 py-4 text-left border-l border-indigo-500">메모</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-indigo-50">
                                {rows.map((row, idx) => {
                                    const assignmentSummary = getAssignmentSummary(row);
                                    const visibleAssignedWorkers = assignmentSummary.assignedWorkers.slice(0, 3);
                                    const rowBillingDocuments = getAllBillingDocumentsForRow(row);
                                    const hasSplitRows = (cardRowCountById.get(normalizeKey(row.card.id)) ?? 0) > 1;
                                    const hasPartialMonthPeriod = row.segment.overlapDays < (monthRange?.daysInMonth ?? row.segment.overlapDays);
                                    const shouldShowPeriod = hasSplitRows || hasPartialMonthPeriod;
                                    const statementPaths = dedupeStatementPaths([
                                        ...row.statementAttachmentPaths,
                                        ...getStatementPathsForDocuments(rowBillingDocuments)
                                    ]);
                                    const latestStatementPath = statementPaths[statementPaths.length - 1] ?? '';
                                    const isUploadingStatement = statementUploadingRowId === row.id;

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
                                                    <div className="flex flex-col items-start gap-1.5">
                                                        <span className="text-rose-500 text-[11px] font-bold">대상 설정 필요</span>
                                                        {onOpenBillingTarget && (
                                                            <button
                                                                type="button"
                                                                onClick={() => onOpenBillingTarget(row.card)}
                                                                className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-700 hover:bg-amber-100"
                                                                title="팀별 경비에 반영할 대상을 설정"
                                                            >
                                                                대상 설정
                                                            </button>
                                                        )}
                                                    </div>
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
                                                <div className="flex items-center justify-center gap-1">
                                                    <label
                                                        className={`inline-flex h-8 items-center justify-center gap-1 rounded-lg px-2 text-[11px] font-bold text-white transition-colors ${
                                                            isUploadingStatement
                                                                ? 'bg-indigo-300 cursor-wait'
                                                                : 'bg-indigo-600 hover:bg-indigo-700 cursor-pointer'
                                                        }`}
                                                        title="카드 사용내역서 PDF/이미지 업로드"
                                                    >
                                                        <FontAwesomeIcon icon={faUpload} className="text-[10px]" />
                                                        {isUploadingStatement ? '업로드중' : '업로드'}
                                                        <input
                                                            type="file"
                                                            className="hidden"
                                                            accept="application/pdf,image/*"
                                                            disabled={isUploadingStatement}
                                                            onChange={(event) => {
                                                                const file = event.target.files?.[0] ?? null;
                                                                event.target.value = '';
                                                                if (file) void handleUploadStatement(row, rowBillingDocuments, file);
                                                            }}
                                                        />
                                                    </label>
                                                    <button
                                                        type="button"
                                                        disabled={!latestStatementPath || isUploadingStatement}
                                                        onClick={() => void handleOpenStatement(latestStatementPath)}
                                                        className={`h-8 rounded-lg border px-2 text-[11px] font-bold ${
                                                            latestStatementPath && !isUploadingStatement
                                                                ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                                                : 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed'
                                                        }`}
                                                        title="카드 사용내역서 파일 열기"
                                                    >
                                                        열기
                                                    </button>
                                                </div>
                                                {statementPaths.length > 0 && (
                                                    <div className="mt-1 text-[10px] font-bold text-slate-400">{statementPaths.length}개</div>
                                                )}
                                            </td>

                                            <td className="p-1">
                                                <input
                                                    type="text"
                                                    value={row.memo}
                                                    onChange={(e) => handleMemoChange(idx, e.target.value)}
                                                    className={`w-full rounded-lg p-2 text-xs focus:outline-none focus:ring-2 ${
                                                        isPdfImportMemo(row.memo)
                                                            ? 'bg-blue-50/80 text-blue-700 font-extrabold focus:bg-blue-50 focus:ring-blue-200'
                                                            : row.memo
                                                                ? 'bg-amber-50 text-rose-700 font-black ring-1 ring-amber-200 focus:bg-amber-50 focus:ring-rose-200'
                                                                : 'bg-transparent text-slate-600 focus:bg-indigo-50 focus:ring-indigo-200'
                                                    }`}
                                                    placeholder=""
                                                />
                                            </td>
                                        </tr>
                                    );
                                })}
                                {rows.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="p-20 text-center text-slate-400 bg-slate-50/50">
                                            <div className="flex flex-col items-center gap-3">
                                                <FontAwesomeIcon icon={faReceipt} className="text-4xl text-slate-300" />
                                                <p>카드 대장 행이 없습니다.</p>
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
                        * 카드 금액은 청구대상 기간별 행에 입력합니다.<br />
                        * 같은 달에 청구대상이 바뀌면 거래일 또는 입력 행의 시작일 기준으로 기간별 저장됩니다.<br />
                        * <strong>[저장]</strong>하면 DB에 저장된 금액으로 팀별 경비가 바로 갱신됩니다.<br />
                        * 반복 저장은 기존 초안을 교체하며, 0원은 관련 초안만 정리합니다.<br />
                        * 확정·정산된 경비는 자동 변경하지 않고 결과에서 안내합니다.
                    </p>
                </div>
            </div>

            <CardStatementImportModal
                isOpen={isStatementImportOpen}
                yearMonth={yearMonth}
                cards={cards}
                onClose={() => setIsStatementImportOpen(false)}
                onCompleted={() => void loadData()}
            />
        </div>
    );
};
