import React, { useEffect, useMemo, useState, useCallback, useRef, memo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faChevronLeft,
    faChevronRight,
    faReceipt,
    faSave,
    faExclamationTriangle,
    faUsers,
    faUser,
    faPen,
    faRotateRight,
    faEye,
    faBan
} from '@fortawesome/free-solid-svg-icons';
import { Card, CardAssignmentRecord, CardTransactionCategory, CardTransaction } from '../../types/card';
import { CardBillingCostItem, CardBillingDocument } from '../../types/cardBilling';
import { cardService } from '../../services/cardService';
import { cardBillingService } from '../../services/cardBillingService';
import { Team } from '../../services/teamService';
import { Worker, manpowerService } from '../../services/manpowerService';
import { iconMap } from '../../constants/iconMap';
import { Timestamp } from '../../types/timestamp';
import LedgerBillingEditorModal from '../support/LedgerBillingEditorModal';

// ── 독립 EditableCell 컴포넌트 (Ref 기반 비제어 방식) ──────────
// typing 중 React 리렌더 0회 → 커서 이탈 완전 방지
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

    // 부모 value prop이 바뀌면 비편집 중일 때만 display 갱신
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

// ── 기존 카테고리 거래 합산용 목록 ──
const CATEGORIES: CardTransactionCategory[] = ['FUEL', 'TOLL', 'MEAL', 'MATERIAL', 'OTHER'];

type CategoryAmounts = Record<CardTransactionCategory, number>;

const emptyCategoryAmounts = (): CategoryAmounts => ({
    FUEL: 0,
    TOLL: 0,
    MEAL: 0,
    MATERIAL: 0,
    OTHER: 0
});

/** 카드별 월별 레코드 (편집용) */
interface CardLedgerRow {
    card: Card;
    amounts: CategoryAmounts;
    total: number;
    memo: string;
}

interface CardMonthlyLedgerProps {
    cards: Card[];
    teams?: Team[];
    loadingCards: boolean;
}

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

const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
};

export const CardMonthlyLedger: React.FC<CardMonthlyLedgerProps> = ({ cards, teams = [], loadingCards }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [yearMonth, setYearMonth] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [isStickyHeader, setIsStickyHeader] = useState(false); // Sticky header toggle

    const [rows, setRows] = useState<CardLedgerRow[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [assignments, setAssignments] = useState<CardAssignmentRecord[]>([]);
    const [billingDocuments, setBillingDocuments] = useState<CardBillingDocument[]>([]);
    const [billingFilter, setBillingFilter] = useState<BillingFilter>('all');
    const [billingProcessingId, setBillingProcessingId] = useState('');
    const [billingEditor, setBillingEditor] = useState<{ row: CardLedgerRow; document: CardBillingDocument } | null>(null);
    /** 원본 트랜잭션 (저장 시 기존 데이터 삭제용) */
    const originalTxsRef = useRef<CardTransaction[]>([]);

    // 팀 정보 맵
    const teamInfoMap = useMemo(() => {
        const map = new Map<string, { color: string; icon?: string }>();
        teams.forEach(t => {
            if (t.color && t.name) map.set(t.name, { color: t.color, icon: t.icon || t.iconKey });
        });
        return map;
    }, [teams]);

    // Worker 데이터 로드
    useEffect(() => {
        const loadWorkers = async () => {
            try {
                const data = await manpowerService.getWorkers();
                setWorkers(data);
            } catch (e) {
                console.error('Failed to load workers:', e);
            }
        };
        loadWorkers();
    }, []);

    // Worker -> Team 정보 매핑
    const workerTeamMap = useMemo(() => {
        const map = new Map<string, { color: string; icon?: string }>();
        workers.forEach(w => {
            if (w.name && w.teamName) {
                const tInfo = teamInfoMap.get(w.teamName);
                if (tInfo) map.set(w.name, tInfo);
            }
        });
        return map;
    }, [workers, teamInfoMap]);

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
        const y = currentDate.getFullYear();
        const m = String(currentDate.getMonth() + 1).padStart(2, '0');
        setYearMonth(`${y}-${m}`);
    }, [currentDate]);

    /** 월별 데이터 로드 */
    const loadData = useCallback(async () => {
        if (!yearMonth || cards.length === 0) return;
        setLoading(true);
        try {
            const [txs, assignmentList, billings] = await Promise.all([
                cardService.getTransactionsByMonth(yearMonth),
                cardService.listAllCardAssignments().catch(() => [] as CardAssignmentRecord[]),
                cardBillingService.getBillingsByMonth(yearMonth).catch(() => [] as CardBillingDocument[])
            ]);
            originalTxsRef.current = txs;
            setAssignments(assignmentList);
            setBillingDocuments(billings);

            // 카드별 카테고리 합산
            const amountsMap = new Map<string, CategoryAmounts>();
            const memoMap = new Map<string, string>();
            txs.forEach(tx => {
                const key = String(tx.cardId);
                const prev = amountsMap.get(key) ?? emptyCategoryAmounts();
                const cat = tx.category as CardTransactionCategory;
                if (CATEGORIES.includes(cat)) {
                    prev[cat] = (prev[cat] ?? 0) + tx.amount;
                }
                amountsMap.set(key, prev);

                // 메모 수집 (마지막 것 사용)
                if (tx.memo) memoMap.set(key, tx.memo);
            });

            const newRows: CardLedgerRow[] = cards.map(c => {
                const amounts = amountsMap.get(String(c.id)) ?? emptyCategoryAmounts();
                const total = CATEGORIES.reduce((sum, cat) => sum + (amounts[cat] || 0), 0);
                return {
                    card: c,
                    amounts,
                    total,
                    memo: memoMap.get(String(c.id)) || ''
                };
            });

            newRows.sort((a, b) => {
                // 1순위: 체크카드 우선, 신용카드 나중
                if (a.card.cardType !== b.card.cardType) {
                    // CHECK가 '체크', CREDIT이 '신용'이라고 가정 (또는 타입 정의 따름)
                    // cardType이 'CHECK'이면 앞으로 (-1)
                    if (a.card.cardType === 'CHECK') return -1;
                    if (b.card.cardType === 'CHECK') return 1;
                }
                // 2순위: 이름 정렬
                return a.card.name.localeCompare(b.card.name, 'ko-KR');
            });
            setRows(newRows);
            setIsDirty(false);
        } catch (e) {
            console.error('카드 월별대장 로드 실패:', e);
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, [yearMonth, cards]);

    const monthRange = useMemo(() => {
        const [y, m] = yearMonth.split('-').map(Number);
        if (!Number.isFinite(y) || !Number.isFinite(m)) return null;
        return {
            monthStart: new Date(y, m - 1, 1),
            monthEnd: new Date(y, m, 0)
        };
    }, [yearMonth]);

    const isAssignmentActiveInMonth = (assignment: CardAssignmentRecord): boolean => {
        if (!monthRange) return false;
        const start = assignment.startDate ? new Date(assignment.startDate) : null;
        const end = assignment.endDate ? new Date(assignment.endDate) : null;
        if (start && !Number.isNaN(start.getTime()) && start > monthRange.monthEnd) return false;
        if (end && !Number.isNaN(end.getTime()) && end < monthRange.monthStart) return false;
        return true;
    };

    const resolveTeamBadge = (assignment: CardAssignmentRecord) => {
        const team = assignment.assigneeId
            ? teamByAnyId.get(String(assignment.assigneeId))
            : teamByName.get(normalizeKey(assignment.assigneeName));
        const name = normalizeKey(team?.name) || normalizeKey(assignment.assigneeName);
        if (!name) return null;
        return {
            key: `team:${normalizeKey(team?.id ?? assignment.assigneeId ?? name)}`,
            name,
            color: team?.color || '#94a3b8',
            icon: team?.icon || team?.iconKey || null
        };
    };

    const getAssignmentSummary = (card: Card) => {
        const cardId = normalizeKey(card.id);
        const activeAssignments = assignments.filter((assignment) =>
            normalizeKey(assignment.cardId) === cardId && isAssignmentActiveInMonth(assignment)
        );

        const fallbackAssignments: CardAssignmentRecord[] = activeAssignments;

        const teamMap = new Map<string, NonNullable<ReturnType<typeof resolveTeamBadge>>>();
        const workerMap = new Map<string, string>();

        fallbackAssignments.forEach((assignment) => {
            if (assignment.assigneeType === 'TEAM') {
                const badge = resolveTeamBadge(assignment);
                if (badge) teamMap.set(badge.key, badge);
                return;
            }
            const workerName = normalizeKey(assignment.assigneeName);
            if (workerName) workerMap.set(workerName, workerName);
        });

        const assignedTeams = Array.from(teamMap.values());
        const assignedWorkers = Array.from(workerMap.values());
        return {
            assignedTeams,
            assignedWorkers,
            billingTeams: assignedTeams,
            billingWorkers: assignedWorkers,
            primaryColor: assignedTeams[0]?.color || '#94a3b8'
        };
    };

    const getCardBillingDocuments = useCallback((card: Card) => {
        return billingDocuments.filter((doc) => (
            normalizeKey(doc.cardId) === normalizeKey(card.id) &&
            normalizeKey(doc.yearMonth) === normalizeKey(yearMonth)
        ));
    }, [billingDocuments, yearMonth]);

    const hasCardBillingTarget = useCallback((card: Card): boolean => {
        if (card.billingTargetType && card.billingTargetId) return true;
        const cardId = normalizeKey(card.id);
        return assignments.some((assignment) =>
            normalizeKey(assignment.cardId) === cardId &&
            isAssignmentActiveInMonth(assignment)
        );
    }, [assignments, monthRange]);

    const getRowBillingState = useCallback((row: CardLedgerRow): {
        status: BillingRowStatus;
        documents: CardBillingDocument[];
        reason?: string;
    } => {
        if (row.total <= 0) return { status: 'blocked', documents: [], reason: '금액 없음' };
        if (!hasCardBillingTarget(row.card)) return { status: 'blocked', documents: [], reason: '청구대상 없음' };

        const documents = getCardBillingDocuments(row.card);
        if (documents.length === 0) return { status: 'unbilled', documents };

        const confirmedCount = documents.filter((doc) => doc.status === 'CONFIRMED').length;
        if (confirmedCount === documents.length) return { status: 'confirmed', documents };
        if (confirmedCount > 0) return { status: 'partial', documents };
        return { status: 'draft', documents };
    }, [getCardBillingDocuments, hasCardBillingTarget]);

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
        if (yearMonth && cards.length > 0) {
            loadData();
        }
    }, [yearMonth, cards, loadData]);

    const handleMonthChange = (delta: number) => {
        if (isDirty) {
            if (!window.confirm('저장하지 않은 변경사항이 있습니다. 이동하시겠습니까?')) return;
        }
        const next = new Date(currentDate);
        next.setMonth(next.getMonth() + delta);
        setCurrentDate(next);
    };

    /** 총금액 편집 완료 시 rows state 업데이트 */
    const handleTotalCommit = useCallback((index: number, numValue: number) => {
        setRows(prev => {
            const newRows = [...prev];
            newRows[index] = { ...newRows[index], total: numValue };
            return newRows;
        });
        setIsDirty(true);
    }, []);

    /** 메모 변경 */
    const handleMemoChange = useCallback((index: number, memo: string) => {
        setRows(prev => {
            const newRows = [...prev];
            newRows[index] = { ...newRows[index], memo };
            return newRows;
        });
        setIsDirty(true);
    }, []);

    /** 전체 저장: 기존 트랜잭션 삭제 → 새 트랜잭션 생성 */
    const handleSave = async () => {
        setSaving(true);
        try {
            // 1) 기존 월별 트랜잭션 모두 삭제
            const deleteTasks = originalTxsRef.current.map(tx =>
                cardService.deleteTransaction(tx.id).catch(e => {
                    console.warn('트랜잭션 삭제 실패:', tx.id, e);
                })
            );
            await Promise.all(deleteTasks);

            // 2) 카드별 총금액만 새 트랜잭션 생성
            const createTasks: Promise<string>[] = [];
            const monthFirstDay = `${yearMonth}-01`; // 월 1일 기준 날짜

            for (const row of rows) {
                const amount = row.total;
                    if (amount > 0) {
                        const label = `${row.card.name}(${row.card.last4})`;
                        createTasks.push(
                            cardService.addTransaction({
                                cardId: row.card.id,
                                cardLabel: label,
                                date: monthFirstDay,
                                merchant: '월별대장',
                                category: 'OTHER',
                                amount,
                                memo: row.memo || undefined
                            })
                        );
                    }
            }
            await Promise.all(createTasks);

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

    const handleCreateOrRecalculateBilling = async (row: CardLedgerRow, mode: 'create' | 'recalculate') => {
        const state = getRowBillingState(row);
        if (isDirty) {
            alert('청구 전 변경사항을 먼저 전체 저장해주세요.');
            return;
        }
        if (state.status === 'blocked') {
            alert(state.reason || '청구할 수 없는 행입니다.');
            return;
        }

        setBillingProcessingId(row.card.id);
        try {
            const generated = await cardBillingService.generateAssignmentBillings(row.card, yearMonth);
            if (generated.length === 0) {
                alert('배정 이력과 사용 금액 기준으로 생성할 청구 문서를 찾지 못했습니다.');
                return;
            }

            const confirmedIds = new Set(
                state.documents
                    .filter((doc) => doc.status === 'CONFIRMED')
                    .map((doc) => doc.id)
            );
            let saved = 0;
            for (const doc of generated) {
                const existing = state.documents.find((item) => item.id === doc.id);
                if (confirmedIds.has(existing?.id ?? doc.id)) continue;
                await cardBillingService.saveBilling({
                    ...doc,
                    id: existing?.id ?? doc.id,
                    status: 'DRAFT',
                    memo: existing?.memo ?? doc.memo
                });
                saved += 1;
            }

            await loadData();
            alert(mode === 'recalculate'
                ? `청구서가 재계산되었습니다. (${saved}건)`
                : `청구서가 생성되었습니다. (${saved}건)`);
        } catch (error) {
            console.error(error);
            alert('청구 처리에 실패했습니다.');
        } finally {
            setBillingProcessingId('');
        }
    };

    const buildCardDocumentWithItems = (
        document: CardBillingDocument,
        lineItems: CardBillingCostItem[],
        memo: string,
        status: CardBillingDocument['status']
    ): CardBillingDocument => {
        const totalAmount = lineItems.reduce((sum, item) => sum + (Number.isFinite(item.amount) ? item.amount : 0), 0);
        return {
            ...document,
            lineItems,
            memo,
            status,
            variableCost: totalAmount,
            totalAmount,
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
        setBillingProcessingId(billingEditor.row.card.id);
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

    /** 총금액 합계 */
    const handleCancelBilling = async (row: CardLedgerRow, document?: CardBillingDocument) => {
        if (!document) return;
        if (document.status === 'CONFIRMED') {
            alert('확정된 청구서는 취소할 수 없습니다.');
            return;
        }
        if (!window.confirm('작성중 청구서를 취소할까요?')) return;

        setBillingProcessingId(row.card.id);
        try {
            await cardBillingService.deleteBilling(document.id);
            await loadData();
            alert('청구가 취소되었습니다.');
        } catch (error) {
            console.error(error);
            alert('청구 취소에 실패했습니다.');
        } finally {
            setBillingProcessingId('');
        }
    };

    const totals = useMemo(() => {
        const result = { ...emptyCategoryAmounts(), total: 0 };
        rows.forEach(r => {
            CATEGORIES.forEach(cat => {
                result[cat] += r.amounts[cat] || 0;
            });
            result.total += r.total;
        });
        return result;
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
                                <col style={{ width: '10%' }} />
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
                                    <th className="px-4 py-4 text-left w-52 tracking-wider bg-indigo-700 border-r border-indigo-500">청구대상 팀</th>
                                    <th className="px-4 py-4 text-left w-52 tracking-wider bg-indigo-700 border-r border-indigo-500">청구대상 개인</th>
                                    <th className="px-4 py-4 text-left w-48 tracking-wider bg-indigo-700">카드</th>
                                    <th className="px-2 py-4 text-center w-40 border-l border-indigo-400 bg-indigo-500">총금액</th>
                                    <th className="px-2 py-4 text-center w-28 border-l border-indigo-500">청구상태</th>
                                    <th className="px-2 py-4 text-center w-44 border-l border-indigo-500">청구작업</th>
                                    <th className="px-4 py-4 text-left border-l border-indigo-500">메모</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-indigo-50">
                                {billingRows.map(({ row, index: idx, billingState }) => {
                                    const assignmentSummary = getAssignmentSummary(row.card);
                                    const visibleAssignedWorkers = assignmentSummary.assignedWorkers.slice(0, 3);
                                    const billingBadge = getBillingStatusBadge(billingState.status);
                                    const firstBillingDocument = billingState.documents.find((doc) => doc.status !== 'CONFIRMED') ?? billingState.documents[0];
                                    const isProcessing = billingProcessingId === row.card.id;

                                    return (
                                        <tr key={row.card.id} className="group hover:bg-blue-50/40 transition-colors">
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

                                            {/* 카드명 */}
                                            <td className="px-4 py-3 border-r border-indigo-50 font-bold text-slate-700 bg-white group-hover:bg-blue-50/40">
                                                <div>
                                                    {row.card.name} ({row.card.last4})
                                                    <div className="text-[10px] text-slate-400 font-normal mt-0.5 font-mono">
                                                        {row.card.issuer} · {row.card.cardType === 'CREDIT' ? '신용' : '체크'}
                                                    </div>
                                                </div>
                                            </td>

                                            {/* 총금액 입력 */}
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
                                            <td className="p-1">
                                                <input
                                                    type="text"
                                                    value={row.memo}
                                                    onChange={(e) => handleMemoChange(idx, e.target.value)}
                                                    className="w-full p-2 focus:outline-none focus:bg-indigo-50 focus:ring-1 focus:ring-indigo-200 rounded-lg text-xs text-slate-600 bg-transparent"
                                                    placeholder="메모를 입력하세요..."
                                                />
                                            </td>
                                        </tr>
                                    );
                                })}
                                {billingRows.length === 0 && (
                                    <tr>
                                        <td colSpan={9} className="p-20 text-center text-slate-400 bg-slate-50/50">
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
                                    <td colSpan={5} className="p-4 border-r border-slate-600 text-center">합계</td>
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
                        * 총금액 셀을 클릭하여 카드별 월 사용 금액을 직접 입력할 수 있습니다.<br />
                        * 50만 원을 초과하는 금액은 <strong className="text-rose-600">빨간색 굵은 글씨</strong>로 표시됩니다.<br />
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
                    saving={billingProcessingId === billingEditor.row.card.id}
                    onClose={() => setBillingEditor(null)}
                    onSave={(lineItems, memo) => handleSaveBillingEditor(lineItems, memo)}
                    onConfirm={(lineItems, memo) => handleSaveBillingEditor(lineItems, memo, 'CONFIRMED')}
                />
            )}
        </div>
    );
};
