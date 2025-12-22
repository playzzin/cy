import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faFileInvoiceDollar, faCalculator, faLayerGroup, faPrint, faFileExcel, faSave,
    faFilter, faCalendarAlt, faWonSign
} from '@fortawesome/free-solid-svg-icons';

import { PayrollData } from '../../services/payrollService';

const PayrollDesignViewer: React.FC = () => {
    const [selectedTeam, setSelectedTeam] = useState('이재욱팀');
    const [selectedMonth, setSelectedMonth] = useState('2025-08');
    const [isSplitMode, setIsSplitMode] = useState(false);
    const [splitThreshold, setSplitThreshold] = useState(8);

    const [payrollData, setPayrollData] = useState<PayrollData[]>([]);
    const [loading, setLoading] = useState(false);

    // Fetch Data
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [yearStr, monthStr] = selectedMonth.split('-');
                const year = parseInt(yearStr);
                const month = parseInt(monthStr);

                // Import service dynamically to avoid circular dependencies if any, or just standard import
                const { payrollService } = await import('../../services/payrollService');
                const data = await payrollService.getPayrollData(year, month, selectedTeam); // Note: selectedTeam needs to be ID in real app

                if (data.length > 0) {
                    setPayrollData(data);
                } else {
                    // Fallback to mock data if no real data found (for demo purposes)
                    setPayrollData(mockData);
                }
            } catch (error) {
                console.error("Failed to fetch payroll data", error);
                setPayrollData(mockData); // Fallback
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [selectedMonth, selectedTeam]);

    // Mock Data (Fallback)
    const mockData: PayrollData[] = [
        {
            id: '1',
            name: '남궁현1',
            role: '팀장',
            gongsu: { total: 23.5, reported: 23.5, labor: 23.5 },
            unitPrice: 230000,
            grossPay: 5405000,
            tax: { income: 178365, resident: 17830 },
            deductions: { advance: 0, accommodation: 0, other: 0 },
            netPay: 5226635
        },
        {
            id: '2',
            name: '변오양2',
            role: '기능공',
            gongsu: { total: 15.5, reported: 15.5, labor: 15.5 },
            unitPrice: 230000,
            grossPay: 3565000,
            tax: { income: 117645, resident: 11760 },
            deductions: { advance: 0, accommodation: 0, other: 0 },
            netPay: 3447355
        },
        {
            id: '3',
            name: '노수신4',
            role: '기능공',
            gongsu: { total: 16.5, reported: 16.5, labor: 16.5 },
            unitPrice: 230000,
            grossPay: 3795000,
            tax: { income: 125235, resident: 12520 },
            deductions: { advance: 0, accommodation: 0, other: 0 },
            netPay: 3669765
        }
    ];

    // Calculate split data
    const processedData: PayrollData[] = payrollData.map(row => {
        if (isSplitMode) {
            const reportedDays = Math.min(row.gongsu.total, splitThreshold);
            const remainingDays = row.gongsu.total - reportedDays;

            const reportedGross = reportedDays * row.unitPrice;
            const taxIncome = Math.floor(reportedGross * 0.03); // 3%
            const taxResident = Math.floor(taxIncome * 0.1);    // 0.3%

            return {
                ...row,
                gongsu: {
                    ...row.gongsu,
                    reported: reportedDays,
                    remaining: remainingDays
                },
                tax: {
                    income: taxIncome,
                    resident: taxResident,
                    nationalPension: 0, healthInsurance: 0, careInsurance: 0, employmentInsurance: 0
                },
                grossPay: row.gongsu.total * row.unitPrice, // Total gross remains same for internal record
                reportedGrossPay: reportedGross // For tax calculation
            };
        }
        return row;
    });

    return (
        <div className="p-6 max-w-[1800px] mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
                    <FontAwesomeIcon icon={faFileInvoiceDollar} className="text-indigo-600" />
                    급여 정산 시스템 설계도 (Payroll Design)
                </h1>
                <p className="text-slate-500 mt-2">
                    팀별 가불 및 급여 정산 대장 UI/UX 시뮬레이션
                </p>
            </div>

            {/* Control Bar */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-slate-100 px-3 py-2 rounded-lg border border-slate-200">
                        <FontAwesomeIcon icon={faCalendarAlt} className="text-slate-500" />
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="bg-transparent border-none font-bold text-slate-700 focus:ring-0 cursor-pointer"
                        >
                            <option value="2025-08">2025년 08월</option>
                            <option value="2025-09">2025년 09월</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-2 bg-slate-100 px-3 py-2 rounded-lg border border-slate-200">
                        <FontAwesomeIcon icon={faLayerGroup} className="text-slate-500" />
                        <select
                            value={selectedTeam}
                            onChange={(e) => setSelectedTeam(e.target.value)}
                            className="bg-transparent border-none font-bold text-slate-700 focus:ring-0 cursor-pointer"
                        >
                            <option value="이재욱팀">이재욱팀</option>
                            <option value="김철수팀">김철수팀</option>
                        </select>
                    </div>

                    {/* Split Reporting Toggle */}
                    <div className={`flex items-center gap-3 px-4 py-2 rounded-lg border transition-colors ${isSplitMode ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'}`}>
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="splitMode"
                                checked={isSplitMode}
                                onChange={(e) => setIsSplitMode(e.target.checked)}
                                className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500 cursor-pointer"
                            />
                            <label htmlFor="splitMode" className={`font-bold cursor-pointer ${isSplitMode ? 'text-amber-700' : 'text-slate-600'}`}>
                                분리 신고 적용 (Split Reporting)
                            </label>
                        </div>
                        {isSplitMode && (
                            <div className="flex items-center gap-2 ml-2 border-l border-amber-200 pl-3">
                                <span className="text-xs text-amber-600 font-medium">기준일수:</span>
                                <input
                                    type="number"
                                    value={splitThreshold}
                                    onChange={(e) => setSplitThreshold(Number(e.target.value))}
                                    className="w-16 px-2 py-1 text-sm border border-amber-300 rounded text-center font-bold text-amber-800 focus:ring-amber-500 focus:border-amber-500"
                                />
                                <span className="text-xs text-amber-600">일</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 flex items-center gap-2 text-sm font-medium transition-colors">
                        <FontAwesomeIcon icon={faFileExcel} className="text-green-600" />
                        엑셀 다운로드
                    </button>
                    <button className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 flex items-center gap-2 text-sm font-medium transition-colors">
                        <FontAwesomeIcon icon={faPrint} className="text-slate-600" />
                        인쇄
                    </button>
                    <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2 text-sm font-medium shadow-sm transition-colors">
                        <FontAwesomeIcon icon={faSave} />
                        저장하기
                    </button>
                </div>
            </div>

            {/* Main Ledger Grid */}
            <div className="bg-white rounded-xl shadow-lg border border-slate-300 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="bg-slate-100 text-slate-700 text-xs uppercase font-bold text-center border-b border-slate-300">
                                <th className="p-2 border-r border-slate-300 w-12" rowSpan={2}>No</th>
                                <th className="p-2 border-r border-slate-300 w-24" rowSpan={2}>이름</th>
                                <th className="p-2 border-r border-slate-300 w-40" colSpan={isSplitMode ? 3 : 2}>
                                    {isSplitMode ? '공수 분리 (Split Days)' : '공수 (Days)'}
                                </th>
                                <th className="p-2 border-r border-slate-300 w-24" rowSpan={2}>단가</th>
                                <th className="p-2 border-r border-slate-300 w-32" rowSpan={2}>총액 (Gross)</th>
                                <th className="p-2 border-r border-slate-300 w-24" rowSpan={2}>세금 (3.3%)</th>
                                <th className="p-2 border-r border-slate-300" colSpan={4}>4대 보험 (Insurance)</th>
                                <th className="p-2 border-r border-slate-300" colSpan={3}>공제 (Deductions)</th>
                                <th className="p-2 w-32 bg-indigo-50 text-indigo-900" rowSpan={2}>실지급액 (Net)</th>
                            </tr>
                            <tr className="bg-slate-50 text-slate-600 text-[11px] font-semibold text-center border-b border-slate-300">
                                <th className="p-1 border-r border-slate-300 text-blue-600">
                                    {isSplitMode ? `신고 (Max ${splitThreshold})` : '신고 (Report)'}
                                </th>
                                {isSplitMode && (
                                    <th className="p-1 border-r border-slate-300 text-amber-600 bg-amber-50">미신고 (Excess)</th>
                                )}
                                <th className="p-1 border-r border-slate-300 text-slate-500">실제 (Total)</th>

                                <th className="p-1 border-r border-slate-300">국민</th>
                                <th className="p-1 border-r border-slate-300">건강</th>
                                <th className="p-1 border-r border-slate-300">고용</th>
                                <th className="p-1 border-r border-slate-300">산재</th>

                                <th className="p-1 border-r border-slate-300 text-red-500">가불금</th>
                                <th className="p-1 border-r border-slate-300">숙소비</th>
                                <th className="p-1 border-r border-slate-300">기타</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {processedData.map((row, index) => (
                                <tr key={row.id} className="hover:bg-blue-50/30 transition-colors">
                                    <td className="p-2 text-center border-r border-slate-200 bg-slate-50 font-medium text-slate-500">
                                        {index + 1}
                                    </td>
                                    <td className="p-2 text-center border-r border-slate-200 font-bold text-slate-700">
                                        {row.name}
                                        <div className="text-[10px] font-normal text-slate-400">{row.role}</div>
                                    </td>

                                    {/* Gongsu Split */}
                                    <td className="p-0 border-r border-slate-200 align-middle">
                                        <div className="flex flex-col h-full">
                                            <div className="flex-1 p-1 text-center text-blue-600 font-bold border-b border-slate-100 bg-blue-50/20">
                                                {row.gongsu.reported}
                                            </div>
                                        </div>
                                    </td>
                                    {isSplitMode && (
                                        <td className="p-0 border-r border-slate-200 align-middle bg-amber-50/30">
                                            <div className="flex flex-col h-full">
                                                <div className="flex-1 p-1 text-center text-amber-600 font-bold">
                                                    {row.gongsu.remaining}
                                                </div>
                                            </div>
                                        </td>
                                    )}
                                    <td className="p-0 border-r border-slate-200 align-middle">
                                        <div className="flex flex-col h-full">
                                            <div className="flex-1 p-1 text-center text-slate-600 font-medium">
                                                {row.gongsu.total}
                                            </div>
                                        </div>
                                    </td>

                                    <td className="p-2 text-right border-r border-slate-200 text-slate-600">
                                        {row.unitPrice.toLocaleString()}
                                    </td>
                                    <td className="p-2 text-right border-r border-slate-200 font-bold text-slate-800 bg-slate-50/50">
                                        {row.grossPay.toLocaleString()}
                                        {isSplitMode && (
                                            <div className="text-[10px] text-blue-400 font-normal">
                                                (신고: {(row.reportedGrossPay || 0).toLocaleString()})
                                            </div>
                                        )}
                                    </td>

                                    {/* Tax */}
                                    <td className="p-2 text-right border-r border-slate-200 text-slate-500 text-xs">
                                        {row.tax.income.toLocaleString()}
                                        <div className="text-[9px] text-slate-400">
                                            {isSplitMode ? '(신고분)' : '(전체)'}
                                        </div>
                                    </td>

                                    {/* Insurance (Empty for mock) */}
                                    <td className="p-2 text-right border-r border-slate-200 text-slate-400 text-xs">-</td>
                                    <td className="p-2 text-right border-r border-slate-200 text-slate-400 text-xs">-</td>
                                    <td className="p-2 text-right border-r border-slate-200 text-slate-400 text-xs">-</td>
                                    <td className="p-2 text-right border-r border-slate-200 text-slate-400 text-xs">-</td>

                                    {/* Deductions */}
                                    <td className="p-2 text-right border-r border-slate-200 text-red-500 font-medium bg-red-50/10">
                                        {row.deductions.advance > 0 ? row.deductions.advance.toLocaleString() : '-'}
                                    </td>
                                    <td className="p-2 text-right border-r border-slate-200 text-slate-500">
                                        {row.deductions.accommodation > 0 ? row.deductions.accommodation.toLocaleString() : '-'}
                                    </td>
                                    <td className="p-2 text-right border-r border-slate-200 text-slate-500">
                                        -
                                    </td>

                                    {/* Net Pay */}
                                    <td className="p-2 text-right font-bold text-indigo-700 bg-indigo-50">
                                        {row.netPay.toLocaleString()}
                                    </td>
                                </tr>
                            ))}

                            {/* Summary Row */}
                            <tr className="bg-slate-800 text-white font-bold border-t-2 border-slate-600">
                                <td colSpan={2} className="p-3 text-center">합계 (Total)</td>
                                <td className="p-3 text-center text-blue-300">55.5</td>
                                {isSplitMode && <td className="p-3 text-center text-amber-300">-</td>}
                                <td className="p-3 text-center text-slate-300">55.5</td>
                                <td className="p-3 text-right text-slate-400">-</td>
                                <td className="p-3 text-right text-amber-300">12,765,000</td>
                                <td className="p-3 text-right text-slate-300">421,245</td>
                                <td colSpan={4} className="p-3 text-center text-slate-500">-</td>
                                <td className="p-3 text-right text-red-300">-</td>
                                <td className="p-3 text-right text-slate-400">-</td>
                                <td className="p-3 text-right text-slate-400">-</td>
                                <td className="p-3 text-right text-emerald-300 text-lg">12,343,755</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Explanation Section */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-blue-50 p-6 rounded-xl border border-blue-100">
                    <h3 className="font-bold text-blue-800 mb-3 flex items-center gap-2">
                        <FontAwesomeIcon icon={faCalculator} />
                        자동 계산 로직 (Logic)
                    </h3>
                    <ul className="space-y-2 text-sm text-blue-700">
                        <li className="flex items-start gap-2">
                            <span className="font-bold">• 총액 (Gross):</span>
                            <span>신고공수 × 단가 (또는 노무공수 × 단가, 설정 가능)</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="font-bold">• 세금 (Tax):</span>
                            <span>총액의 3.3% (주민세 포함) 자동 공제</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="font-bold">• 4대 보험:</span>
                            <span>국민연금, 건강보험 등 요율에 따라 자동 계산 (On/Off 가능)</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="font-bold">• 실지급액 (Net):</span>
                            <span>총액 - (세금 + 보험 + 가불금 + 기타공제)</span>
                        </li>
                    </ul>
                </div>

                <div className="bg-amber-50 p-6 rounded-xl border border-amber-100">
                    <h3 className="font-bold text-amber-800 mb-3 flex items-center gap-2">
                        <FontAwesomeIcon icon={faFilter} />
                        공수 구분 (Gongsu Types)
                    </h3>
                    <ul className="space-y-2 text-sm text-amber-700">
                        <li className="flex items-start gap-2">
                            <span className="font-bold text-blue-600">[신고 공수]:</span>
                            <span>세무 신고용 공수 (4대보험 가입 요건 등에 따라 조정 가능)</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="font-bold text-slate-600">[노무 공수]:</span>
                            <span>실제 현장 투입 공수 (작업자가 인지하는 실제 일한 날짜)</span>
                        </li>
                        <li className="mt-2 text-xs bg-white p-2 rounded border border-amber-200">
                            * 일반적으로 <strong>신고 공수</strong>를 기준으로 급여 명세서가 발행되며,
                            차액은 별도 정산하거나 비과세 항목으로 처리될 수 있습니다.
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default PayrollDesignViewer;
