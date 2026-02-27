import React, { useEffect, useMemo, useState, useCallback, useRef, memo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faChevronRight, faFileInvoiceDollar, faSave, faExclamationTriangle, faGasPump } from '@fortawesome/free-solid-svg-icons';
import { vehicleService } from '../../services/vehicleService';
import { Vehicle, VehicleExpenseRecord, VehicleExpenseType } from '../../types/vehicle';

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

interface VehicleLedgerRow {
    vehicle: Vehicle;
    rentFee: number;
    leaseFee: number;
    amounts: ExpenseAmounts;
    variableTotal: number;
    total: number;
    note: string;
}

interface VehicleMonthlyLedgerProps {
    vehicles: Vehicle[];
    loadingVehicles: boolean;
    onOpenExpenseLog: (vehicle: Vehicle) => void;
}

export const VehicleMonthlyLedger: React.FC<VehicleMonthlyLedgerProps> = ({
    vehicles,
    loadingVehicles,
    onOpenExpenseLog
}) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [yearMonth, setYearMonth] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [isStickyHeader, setIsStickyHeader] = useState(false); // Sticky header toggle

    const [rows, setRows] = useState<VehicleLedgerRow[]>([]);
    const originalExpensesRef = useRef<VehicleExpenseRecord[]>([]);

    useEffect(() => {
        const y = currentDate.getFullYear();
        const m = String(currentDate.getMonth() + 1).padStart(2, '0');
        setYearMonth(`${y}-${m}`);
    }, [currentDate]);

    const loadData = useCallback(async () => {
        if (!yearMonth) return;
        setLoading(true);
        try {
            const expenses = await vehicleService.getExpensesByMonth(yearMonth);
            originalExpensesRef.current = expenses;

            const amountsMap = new Map<string, ExpenseAmounts>();
            const noteMap = new Map<string, string>();

            expenses.forEach(e => {
                const key = String(e.vehicleId);
                const prev = amountsMap.get(key) ?? emptyExpenseAmounts();
                if (EXPENSE_TYPES.includes(e.type)) {
                    prev[e.type] = (prev[e.type] ?? 0) + e.amount;
                }
                amountsMap.set(key, prev);
                if (e.note) noteMap.set(key, e.note);
            });

            const newRows: VehicleLedgerRow[] = vehicles.map(v => {
                const fixed = v.contract?.monthlyFee ?? 0;
                const rentFee = v.type === 'RENT' ? fixed : 0;
                const leaseFee = v.type === 'LEASE' ? fixed : 0;

                const amounts = amountsMap.get(String(v.id)) ?? emptyExpenseAmounts();
                const variableTotal = EXPENSE_TYPES.reduce((sum, type) => sum + (amounts[type] || 0), 0);

                return {
                    vehicle: v,
                    rentFee,
                    leaseFee,
                    amounts,
                    variableTotal,
                    total: rentFee + leaseFee + variableTotal,
                    note: noteMap.get(String(v.id)) || ''
                };
            });

            // 렌트(RENT) 위쪽, 리스(LEASE) 아래쪽, 그 다음 자가(OWNED)
            const typeOrder = (t: string) => (t === 'RENT' ? 0 : t === 'LEASE' ? 1 : 2);
            newRows.sort((a, b) => {
                const pa = typeOrder(a.vehicle.type || '');
                const pb = typeOrder(b.vehicle.type || '');
                if (pa !== pb) return pa - pb;
                return String(a.vehicle.licensePlate).localeCompare(String(b.vehicle.licensePlate), 'ko-KR');
            });
            setRows(newRows);
            setIsDirty(false);
        } catch (e) {
            console.error(e);
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, [yearMonth, vehicles]);

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
            const monthFirstDay = `${yearMonth}-01`;

            for (const row of rows) {
                for (const type of EXPENSE_TYPES) {
                    const amount = row.amounts[type];
                    if (amount > 0) {
                        createTasks.push(
                            vehicleService.addExpense({
                                vehicleId: row.vehicle.id,
                                vehiclePlate: row.vehicle.licensePlate,
                                date: monthFirstDay,
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
                        <table className="w-full text-sm min-w-[1200px]">
                            <thead className={`bg-indigo-600 text-white font-bold text-xs uppercase shadow-md ${isStickyHeader ? 'sticky top-0 z-20' : ''}`}>
                                <tr>
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
                                {rows.map((row, idx) => (
                                    <tr key={row.vehicle.id} className="group hover:bg-blue-50/40 transition-colors">
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
                                ))}
                                {rows.length === 0 && (
                                    <tr>
                                        <td colSpan={EXPENSE_TYPES.length + 6} className="p-20 text-center text-slate-400 bg-slate-50/50">
                                            <div className="flex flex-col items-center gap-3">
                                                <FontAwesomeIcon icon={faGasPump} className="text-4xl text-slate-300" />
                                                <p>차량 목록이 없거나 불러올 수 없습니다.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                            <tfoot className="bg-slate-800 text-white font-bold text-sm tracking-wide sticky bottom-0 z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                                <tr>
                                    <td colSpan={2} className="p-4 border-r border-slate-600 text-center">합계</td>
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
