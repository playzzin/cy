import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSave, faChevronLeft, faChevronRight, faExclamationTriangle, faFileInvoiceDollar } from '@fortawesome/free-solid-svg-icons';
import { accommodationService } from '../../services/accommodationService';
import { Accommodation, UtilityRecord } from '../../types/accommodation';

const UtilityLedger: React.FC = () => {
    // State for Year-Month
    const [currentDate, setCurrentDate] = useState(new Date());
    const [yearMonth, setYearMonth] = useState('');

    // Data State
    const [records, setRecords] = useState<UtilityRecord[]>([]);
    const [accommodations, setAccommodations] = useState<Accommodation[]>([]); // needed for profile checks
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);

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
            const accList = await accommodationService.getAccommodations();
            setAccommodations(accList);

            // Load Ledger (Service merges drafts)
            const ledger = await accommodationService.getMonthlyLedger(yearMonth);

            // Sort by accommodation name (simple logic, maybe improve later for numeric sort 101, 102...)
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

    const handleInputChange = (index: number, field: string, value: string) => {
        const numValue = parseInt(value.replace(/,/g, ''), 10) || 0;

        const newRecords = [...records];
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

        setRecords(newRecords);
        setIsDirty(true);
    };

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
        const acc = accommodations.find(a => a.id === rec.accommodationId);
        if (!acc) return 'variable'; // default

        if (field === 'electricity') return acc.costProfile.electricity;
        if (field === 'gas') return acc.costProfile.gas;
        if (field === 'water') return acc.costProfile.water;
        if (field === 'internet') return acc.costProfile.internet;
        if (field === 'maintenance') return acc.costProfile.maintenance;

        return 'variable';
    };

    // Render Logic for Cells
    const renderInputCell = (rec: UtilityRecord, index: number, field: keyof UtilityRecord['costs']) => {
        const type = getProfileType(rec, field);
        const value = rec.costs[field as keyof typeof rec.costs];

        const isIncluded = type === 'included';
        const isFixed = type === 'fixed';

        return (
            <td className={`p-1 border-r border-indigo-50/50 ${isIncluded ? 'bg-slate-50' : 'bg-white'}`}>
                {isIncluded ? (
                    <div className="text-center text-xs text-slate-300 select-none py-2">-</div>
                ) : (
                    <input
                        type="text"
                        value={value === 0 ? '' : value.toLocaleString()}
                        onChange={(e) => handleInputChange(index, field as string, e.target.value)}
                        className={`w-full text-right p-2 focus:outline-none transition rounded-lg text-sm
                            ${isFixed ? 'text-emerald-600 font-bold bg-emerald-50/30' : 'text-slate-700 bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-100'}
                            ${value > 100000 && field !== 'rent' ? 'text-red-500 font-extrabold' : ''} 
                        `}
                        placeholder="0"
                    />
                )}
            </td>
        );
    };

    return (
        <div className="flex flex-col h-full space-y-5">
            {/* Toolbar */}
            <div className="flex justify-between items-center bg-white p-5 rounded-2xl border border-indigo-100 shadow-sm">
                <div className="flex items-center gap-6">
                    <div className="flex items-center bg-slate-100 rounded-full p-1">
                        <button onClick={() => handleMonthChange(-1)} className="w-8 h-8 flex items-center justify-center hover:bg-white hover:shadow-sm rounded-full transition text-slate-500">
                            <FontAwesomeIcon icon={faChevronLeft} />
                        </button>
                        <span className="px-4 font-bold text-slate-700 font-mono text-lg">{yearMonth}</span>
                        <button onClick={() => handleMonthChange(1)} className="w-8 h-8 flex items-center justify-center hover:bg-white hover:shadow-sm rounded-full transition text-slate-500">
                            <FontAwesomeIcon icon={faChevronRight} />
                        </button>
                    </div>

                    <div className="flex items-center gap-3">
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
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

                <div className="flex gap-4 items-center">
                    <div className="flex items-center gap-3 mr-2 text-xs font-medium text-slate-500">
                        <span className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 rounded-md border border-emerald-100 text-emerald-700">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full"></div> 고정(Fixed)
                        </span>
                        <span className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 rounded-md border border-slate-100 text-slate-500">
                            <div className="w-2 h-2 bg-slate-300 rounded-full"></div> 포함(Included)
                        </span>
                    </div>
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
                <div className="overflow-x-auto custom-scrollbar flex-1">
                    {loading ? (
                        <div className="h-96 flex flex-col items-center justify-center text-slate-400 gap-3">
                            <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                            <p>데이터를 불러오는 중입니다...</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm min-w-[1400px]">
                            <thead className="bg-indigo-600 text-white font-bold text-xs uppercase sticky top-0 z-20 shadow-md">
                                <tr>
                                    <th className="px-4 py-4 text-left w-48 tracking-wider bg-indigo-700">숙소명</th>
                                    <th className="px-2 py-4 text-center w-28 border-l border-indigo-500">월세</th>
                                    <th className="px-2 py-4 text-center w-28 border-l border-indigo-500">전기세</th>
                                    <th className="px-2 py-4 text-center w-28 border-l border-indigo-500">가스비</th>
                                    <th className="px-2 py-4 text-center w-28 border-l border-indigo-500">수도세</th>
                                    <th className="px-2 py-4 text-center w-28 border-l border-indigo-500">인터넷</th>
                                    <th className="px-2 py-4 text-center w-28 border-l border-indigo-500">관리비</th>
                                    <th className="px-2 py-4 text-center w-28 border-l border-indigo-500">기타</th>
                                    <th className="px-2 py-4 text-center w-32 border-l border-indigo-400 bg-indigo-500">합계</th>
                                    <th className="px-2 py-4 text-center w-28 border-l border-indigo-500">상태</th>
                                    <th className="px-4 py-4 text-left border-l border-indigo-500">메모</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-indigo-50">
                                {records.map((rec, idx) => (
                                    <tr key={`${rec.accommodationId}-${idx}`} className="group hover:bg-blue-50/40 transition-colors">
                                        <td className="px-4 py-3 border-r border-indigo-50 font-bold text-slate-700 bg-white group-hover:bg-blue-50/40 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                            <div className='flex items-center justify-between'>
                                                <span>{rec.accommodationName}</span>
                                                {rec.paymentStatus === 'paid' && <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm" title="완납"></span>}
                                                {rec.paymentStatus === 'unpaid' && <span className="w-2 h-2 rounded-full bg-rose-500 shadow-sm animate-pulse" title="미납"></span>}
                                            </div>
                                        </td>

                                        {/* Rent */}
                                        <td className="p-1 border-r border-indigo-50 bg-amber-50/30 group-hover:bg-amber-50/50">
                                            <input
                                                type="text"
                                                value={rec.costs.rent.toLocaleString()}
                                                onChange={(e) => handleInputChange(idx, 'rent', e.target.value)}
                                                className="w-full text-right p-2 bg-transparent focus:outline-none focus:bg-white focus:ring-2 focus:ring-amber-200 rounded-lg text-slate-800 font-bold"
                                            />
                                        </td>

                                        {/* Utilities */}
                                        {renderInputCell(rec, idx, 'electricity')}
                                        {renderInputCell(rec, idx, 'gas')}
                                        {renderInputCell(rec, idx, 'water')}
                                        {renderInputCell(rec, idx, 'internet')}
                                        {renderInputCell(rec, idx, 'maintenance')}

                                        {/* Other */}
                                        <td className="p-1 border-r border-indigo-50">
                                            <input
                                                type="text"
                                                value={rec.costs.other === 0 ? '' : rec.costs.other.toLocaleString()}
                                                onChange={(e) => handleInputChange(idx, 'other', e.target.value)}
                                                className="w-full text-right p-2 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100 rounded-lg text-slate-600 bg-transparent hover:bg-white"
                                                placeholder="0"
                                            />
                                        </td>

                                        {/* Total */}
                                        <td className="px-4 py-3 border-r border-indigo-50 bg-indigo-50/30 group-hover:bg-indigo-50/60 text-right font-extrabold text-indigo-700 font-mono text-base">
                                            {rec.costs.total.toLocaleString()}
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
                                ))}
                                {records.length === 0 && (
                                    <tr>
                                        <td colSpan={11} className="p-20 text-center text-slate-400 bg-slate-50/50">
                                            <div className="flex flex-col items-center gap-3">
                                                <FontAwesomeIcon icon={faFileInvoiceDollar} className="text-4xl text-slate-300" />
                                                <p>해당 월의 데이터가 없습니다.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                            <tfoot className="bg-slate-800 text-white font-bold text-sm tracking-wide sticky bottom-0 z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                                <tr>
                                    <td className="p-4 border-r border-slate-600 text-center">합계</td>
                                    <td className="p-4 border-r border-slate-600 text-right font-mono text-amber-300">{records.reduce((sum, r) => sum + (r.costs.rent || 0), 0).toLocaleString()}</td>
                                    <td className="p-4 border-r border-slate-600 text-right font-mono">{records.reduce((sum, r) => sum + (r.costs.electricity || 0), 0).toLocaleString()}</td>
                                    <td className="p-4 border-r border-slate-600 text-right font-mono">{records.reduce((sum, r) => sum + (r.costs.gas || 0), 0).toLocaleString()}</td>
                                    <td className="p-4 border-r border-slate-600 text-right font-mono">{records.reduce((sum, r) => sum + (r.costs.water || 0), 0).toLocaleString()}</td>
                                    <td className="p-4 border-r border-slate-600 text-right font-mono">{records.reduce((sum, r) => sum + (r.costs.internet || 0), 0).toLocaleString()}</td>
                                    <td className="p-4 border-r border-slate-600 text-right font-mono">{records.reduce((sum, r) => sum + (r.costs.maintenance || 0), 0).toLocaleString()}</td>
                                    <td className="p-4 border-r border-slate-600 text-right font-mono">{records.reduce((sum, r) => sum + (r.costs.other || 0), 0).toLocaleString()}</td>
                                    <td className="p-4 border-r border-slate-600 text-right font-mono text-indigo-300 text-lg">{records.reduce((sum, r) => sum + (r.costs.total || 0), 0).toLocaleString()}</td>
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
                        * 10만 원을 초과하는 공과금은 <strong className="text-rose-600">빨간색 굵은 글씨</strong>로 표시됩니다.<br />
                        * <strong>고정(Fixed)</strong> 항목은 자동으로 입력되지만, 필요 시 수정할 수 있습니다.<br />
                        * 모든 변경사항은 <strong>[전체 저장]</strong> 버튼을 눌러야 반영됩니다.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default UtilityLedger;
