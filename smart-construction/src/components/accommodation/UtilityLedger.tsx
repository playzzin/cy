import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSave, faChevronLeft, faChevronRight, faCalculator, faCheckDouble, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
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
            <td className={`p-1 border-r border-slate-200 ${isIncluded ? 'bg-slate-100' : ''}`}>
                {isIncluded ? (
                    <div className="text-center text-xs text-slate-400 select-none py-2">-</div>
                ) : (
                    <input
                        type="text"
                        value={value === 0 ? '' : value.toLocaleString()}
                        onChange={(e) => handleInputChange(index, field as string, e.target.value)}
                        className={`w-full text-right p-1.5 focus:outline-none focus:bg-blue-50 transition rounded
                            ${isFixed ? 'text-green-600 font-medium' : 'text-slate-800'}
                            ${value > 100000 && field !== 'rent' ? 'text-red-500 font-bold' : ''} 
                        `}
                        placeholder="0"
                    />
                )}
            </td>
        );
    };

    return (
        <div className="flex flex-col h-full">
            {/* Toolbar */}
            <div className="flex justify-between items-center mb-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-4">
                    <button onClick={() => handleMonthChange(-1)} className="p-2 hover:bg-slate-100 rounded-full transition">
                        <FontAwesomeIcon icon={faChevronLeft} />
                    </button>
                    <h2 className="text-2xl font-bold text-slate-800 font-mono tracking-tight">{yearMonth}</h2>
                    <button onClick={() => handleMonthChange(1)} className="p-2 hover:bg-slate-100 rounded-full transition">
                        <FontAwesomeIcon icon={faChevronRight} />
                    </button>

                    {isDirty && <span className="text-orange-500 text-sm font-bold animate-pulse">● 수정사항 있음</span>}
                </div>

                <div className="flex gap-2">
                    <div className="flex items-center gap-2 mr-4 text-xs text-slate-500">
                        <span className="flex items-center gap-1"><div className="w-2 h-2 bg-green-500 rounded-full"></div> 고정(Fixed)</span>
                        <span className="flex items-center gap-1"><div className="w-2 h-2 bg-slate-300 rounded-full"></div> 포함(Included)</span>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className={`px-6 py-2 rounded-lg font-bold text-white shadow-md transition flex items-center gap-2
                            ${saving ? 'bg-indigo-400 cursor-wait' : 'bg-indigo-600 hover:bg-indigo-700'}
                        `}
                    >
                        <FontAwesomeIcon icon={faSave} />
                        {saving ? '저장 중...' : '전체 저장'}
                    </button>
                </div>
            </div>

            {/* Grid */}
            <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-x-auto flex-1">
                {loading ? (
                    <div className="h-64 flex items-center justify-center text-slate-400">데이터를 불러오는 중...</div>
                ) : (
                    <table className="w-full text-sm min-w-[1200px]">
                        <thead className="bg-slate-50 text-slate-500 font-bold text-xs uppercase border-b border-slate-200 sticky top-0 z-10">
                            <tr>
                                <th className="p-3 text-left w-32 border-r border-slate-200">숙소명</th>
                                <th className="p-3 text-center w-24 border-r border-slate-200 bg-yellow-50/50 text-indigo-900">월세</th>
                                <th className="p-3 text-center w-24 border-r border-slate-200">전기세</th>
                                <th className="p-3 text-center w-24 border-r border-slate-200">가스비</th>
                                <th className="p-3 text-center w-24 border-r border-slate-200">수도세</th>
                                <th className="p-3 text-center w-24 border-r border-slate-200">인터넷</th>
                                <th className="p-3 text-center w-24 border-r border-slate-200">관리비</th>
                                <th className="p-3 text-center w-24 border-r border-slate-200">기타</th>
                                <th className="p-3 text-center w-28 border-r border-slate-200 bg-blue-50/50 text-blue-900">합계</th>
                                <th className="p-3 text-center w-24 border-r border-slate-200">납부 상태</th>
                                <th className="p-3 text-left">메모</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {records.map((rec, idx) => (
                                <tr key={`${rec.accommodationId}-${idx}`} className="hover:bg-indigo-50/10 transition-colors">
                                    <td className="p-3 border-r border-slate-200 font-bold text-slate-700">
                                        {rec.accommodationName}
                                        {/* Status Dot based on payment */}
                                        {rec.paymentStatus === 'paid' && <span className="ml-2 text-green-500 text-[10px]">●</span>}
                                        {rec.paymentStatus === 'unpaid' && <span className="ml-2 text-red-500 text-[10px]">●</span>}
                                    </td>

                                    {/* Rent */}
                                    <td className="p-1 border-r border-slate-200 bg-yellow-50/20">
                                        <input
                                            type="text"
                                            value={rec.costs.rent.toLocaleString()}
                                            onChange={(e) => handleInputChange(idx, 'rent', e.target.value)}
                                            className="w-full text-right p-1.5 bg-transparent focus:outline-none focus:bg-white text-slate-800 font-medium"
                                        />
                                    </td>

                                    {/* Utilities */}
                                    {renderInputCell(rec, idx, 'electricity')}
                                    {renderInputCell(rec, idx, 'gas')}
                                    {renderInputCell(rec, idx, 'water')}
                                    {renderInputCell(rec, idx, 'internet')}
                                    {renderInputCell(rec, idx, 'maintenance')}

                                    {/* Other */}
                                    <td className="p-1 border-r border-slate-200">
                                        <input
                                            type="text"
                                            value={rec.costs.other === 0 ? '' : rec.costs.other.toLocaleString()}
                                            onChange={(e) => handleInputChange(idx, 'other', e.target.value)}
                                            className="w-full text-right p-1.5 focus:outline-none focus:bg-blue-50 rounded text-slate-600"
                                            placeholder="0"
                                        />
                                    </td>

                                    {/* Total */}
                                    <td className="p-3 border-r border-slate-200 bg-blue-50/20 text-right font-bold text-blue-800 font-mono">
                                        {rec.costs.total.toLocaleString()}
                                    </td>

                                    {/* Status */}
                                    <td className="p-1 border-r border-slate-200 text-center">
                                        <select
                                            value={rec.paymentStatus}
                                            onChange={(e) => {
                                                const v = e.target.value;
                                                if (v === 'paid' || v === 'unpaid' || v === 'pending') {
                                                    handleStatusChange(idx, v);
                                                }
                                            }}
                                            className={`text-xs font-bold rounded px-1 py-1 border-0 cursor-pointer focus:ring-1 focus:ring-indigo-500
                                                ${rec.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' :
                                                    rec.paymentStatus === 'pending' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'}
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
                                            className="w-full p-1.5 focus:outline-none focus:bg-blue-50 rounded text-xs text-slate-600"
                                            placeholder="메모..."
                                        />
                                    </td>
                                </tr>
                            ))}
                            {records.length === 0 && (
                                <tr>
                                    <td colSpan={11} className="p-10 text-center text-slate-400">
                                        데이터가 없습니다.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        <tfoot className="bg-slate-100 font-bold border-t border-slate-300">
                            <tr>
                                <td className="p-3 border-r text-center">합계</td>
                                <td className="p-3 border-r text-right font-mono">{records.reduce((sum, r) => sum + (r.costs.rent || 0), 0).toLocaleString()}</td>
                                <td className="p-3 border-r text-right font-mono">{records.reduce((sum, r) => sum + (r.costs.electricity || 0), 0).toLocaleString()}</td>
                                <td className="p-3 border-r text-right font-mono">{records.reduce((sum, r) => sum + (r.costs.gas || 0), 0).toLocaleString()}</td>
                                <td className="p-3 border-r text-right font-mono">{records.reduce((sum, r) => sum + (r.costs.water || 0), 0).toLocaleString()}</td>
                                <td className="p-3 border-r text-right font-mono">{records.reduce((sum, r) => sum + (r.costs.internet || 0), 0).toLocaleString()}</td>
                                <td className="p-3 border-r text-right font-mono">{records.reduce((sum, r) => sum + (r.costs.maintenance || 0), 0).toLocaleString()}</td>
                                <td className="p-3 border-r text-right font-mono">{records.reduce((sum, r) => sum + (r.costs.other || 0), 0).toLocaleString()}</td>
                                <td className="p-3 border-r text-right font-mono text-blue-800">{records.reduce((sum, r) => sum + (r.costs.total || 0), 0).toLocaleString()}</td>
                                <td colSpan={2}></td>
                            </tr>
                        </tfoot>
                    </table>
                )}
            </div>

            <div className="mt-4 text-xs text-slate-500 bg-yellow-50 p-2 rounded border border-yellow-200 flex items-center gap-2">
                <FontAwesomeIcon icon={faExclamationTriangle} className="text-yellow-600" />
                <span>팁: 10만 원을 초과하는 공과금은 <strong>빨간색 굵은 글씨</strong>로 표시됩니다. 입력 시 주의 깊게 확인해주세요.</span>
            </div>
        </div>
    );
};

export default UtilityLedger;
