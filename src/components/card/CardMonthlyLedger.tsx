import React, { useEffect, useMemo, useState, useCallback, useRef, memo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faChevronLeft,
    faChevronRight,
    faReceipt,
    faSave,
    faExclamationTriangle,
    faUsers,
    faUser
} from '@fortawesome/free-solid-svg-icons';
import { Card, CardTransactionCategory, CardTransaction } from '../../types/card';
import { cardService } from '../../services/cardService';
import { Team } from '../../services/teamService';
import { Worker, manpowerService } from '../../services/manpowerService';
import { iconMap } from '../../constants/iconMap';

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

// ── 카테고리 목록 & 라벨 ──
const CATEGORIES: CardTransactionCategory[] = ['FUEL', 'TOLL', 'MEAL', 'MATERIAL', 'OTHER'];
const CATEGORY_LABELS: Record<CardTransactionCategory, string> = {
    FUEL: '주유',
    TOLL: '통행',
    MEAL: '식대',
    MATERIAL: '자재',
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
            const txs = await cardService.getTransactionsByMonth(yearMonth);
            originalTxsRef.current = txs;

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

    /** 셀 편집 완료 시 rows state 업데이트 */
    const handleCellCommit = useCallback((index: number, category: CardTransactionCategory, numValue: number) => {
        setRows(prev => {
            const newRows = [...prev];
            const row = { ...newRows[index] };
            const amounts = { ...row.amounts, [category]: numValue };
            const total = CATEGORIES.reduce((sum, cat) => sum + (amounts[cat] || 0), 0);
            row.amounts = amounts;
            row.total = total;
            newRows[index] = row;
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

            // 2) 0이 아닌 카테고리에 대해 새 트랜잭션 생성
            const createTasks: Promise<string>[] = [];
            const monthFirstDay = `${yearMonth}-01`; // 월 1일 기준 날짜

            for (const row of rows) {
                for (const cat of CATEGORIES) {
                    const amount = row.amounts[cat];
                    if (amount > 0) {
                        const label = `${row.card.name}(${row.card.last4})`;
                        createTasks.push(
                            cardService.addTransaction({
                                cardId: row.card.id,
                                cardLabel: label,
                                date: monthFirstDay,
                                merchant: '월별대장',
                                category: cat,
                                amount,
                                memo: row.memo || undefined
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
            console.error('저장 실패:', e);
            alert('저장에 실패했습니다.');
        } finally {
            setSaving(false);
        }
    };

    /** 카테고리별 총합 */
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
                    {(loadingCards || loading) ? (
                        <div className="h-96 flex flex-col items-center justify-center text-slate-400 gap-3">
                            <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                            <p>데이터를 불러오는 중입니다...</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm min-w-[1200px]">
                            <thead className={`bg-indigo-600 text-white font-bold text-xs uppercase shadow-md ${isStickyHeader ? 'sticky top-0 z-20' : ''}`}>
                                <tr>

                                    <th className="px-4 py-4 text-left w-28 tracking-wider bg-indigo-700 border-r border-indigo-500">배정</th>
                                    <th className="px-4 py-4 text-left w-48 tracking-wider bg-indigo-700">카드</th>
                                    {CATEGORIES.map(cat => (
                                        <th key={cat} className="px-2 py-4 text-center w-28 border-l border-indigo-500">
                                            {CATEGORY_LABELS[cat]}
                                        </th>
                                    ))}
                                    <th className="px-2 py-4 text-center w-32 border-l border-indigo-400 bg-indigo-500">합계</th>
                                    <th className="px-4 py-4 text-left border-l border-indigo-500">메모</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-indigo-50">
                                {rows.map((row, idx) => {
                                    // 1. 팀 배정인 경우: teamInfoMap 사용
                                    // 2. 개인 배정인 경우: workerTeamMap 통해 해당 Worker의 팀 정보 사용
                                    const teamInfo = row.card.currentAssigneeType === 'TEAM' && row.card.currentAssigneeName
                                        ? teamInfoMap.get(row.card.currentAssigneeName)
                                        : (row.card.currentAssigneeType !== 'TEAM' && row.card.currentAssigneeName
                                            ? workerTeamMap.get(row.card.currentAssigneeName)
                                            : undefined);

                                    const tc = teamInfo?.color;

                                    return (
                                        <tr key={row.card.id} className="group hover:bg-blue-50/40 transition-colors">
                                            {/* 배정 팀/작업자 */}
                                            <td
                                                className="px-4 py-3 border-r border-indigo-50 bg-white"
                                                style={tc ? {
                                                    borderLeft: `4px solid ${tc}`,
                                                    backgroundColor: hexToRgba(tc, 0.05)
                                                } : undefined}
                                            >
                                                {row.card.currentAssigneeName ? (
                                                    <div className="flex items-center gap-2">
                                                        <span
                                                            className="w-6 h-6 rounded-md flex items-center justify-center text-white text-[10px]"
                                                            style={{ backgroundColor: tc || '#94a3b8' }}
                                                        >
                                                            <FontAwesomeIcon
                                                                icon={row.card.currentAssigneeType === 'TEAM'
                                                                    ? (iconMap[teamInfo?.icon || ''] || faUsers)
                                                                    : faUser}
                                                            />
                                                        </span>
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-slate-700 truncate max-w-[100px]" title={row.card.currentAssigneeName}>
                                                                {row.card.currentAssigneeName}
                                                            </span>
                                                            {/* 개인이지만 팀 정보가 있는 경우 팀명 표시 가능 (옵션) */}
                                                        </div>
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

                                            {/* 카테고리별 금액 입력 */}
                                            {CATEGORIES.map(cat => (
                                                <EditableCell
                                                    key={cat}
                                                    value={row.amounts[cat]}
                                                    onCommit={(numValue) => handleCellCommit(idx, cat, numValue)}
                                                    tdClassName="p-1 border-r border-indigo-50/50 bg-white"
                                                    className={`w-full text-right p-2 focus:outline-none transition rounded-lg text-sm
                                                        text-slate-700 bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-100
                                                        ${row.amounts[cat] > 500000 ? 'text-red-500 font-extrabold' : ''}
                                                    `}
                                                />
                                            ))}

                                            {/* 합계 */}
                                            <td className="px-4 py-3 border-r border-indigo-50 bg-indigo-50/30 group-hover:bg-indigo-50/60 text-right font-extrabold text-indigo-700 font-mono text-base">
                                                {row.total.toLocaleString()}
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
                                {rows.length === 0 && (
                                    <tr>
                                        <td colSpan={CATEGORIES.length + 4} className="p-20 text-center text-slate-400 bg-slate-50/50">
                                            <div className="flex flex-col items-center gap-3">
                                                <FontAwesomeIcon icon={faReceipt} className="text-4xl text-slate-300" />
                                                <p>해당 월의 데이터가 없습니다.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                            <tfoot className="bg-slate-800 text-white font-bold text-sm tracking-wide sticky bottom-0 z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                                <tr>
                                    <td colSpan={2} className="p-4 border-r border-slate-600 text-center">합계</td>
                                    {CATEGORIES.map(cat => (
                                        <td key={cat} className="p-4 border-r border-slate-600 text-right font-mono">
                                            {totals[cat].toLocaleString()}
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
                        * 각 셀을 클릭하여 금액을 직접 입력할 수 있습니다.<br />
                        * 50만 원을 초과하는 금액은 <strong className="text-rose-600">빨간색 굵은 글씨</strong>로 표시됩니다.<br />
                        * 모든 변경사항은 <strong>[전체 저장]</strong> 버튼을 눌러야 반영됩니다.
                    </p>
                </div>
            </div>
        </div>
    );
};
