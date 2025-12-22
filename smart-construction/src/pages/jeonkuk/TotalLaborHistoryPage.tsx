import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faFileInvoiceDollar, faSpinner, faExclamationTriangle, faCalendarAlt, faSearch
} from '@fortawesome/free-solid-svg-icons';
import { settlementService } from '../../services/settlementService';
import { SettlementEntry } from '../../types/settlement';

const TotalLaborHistoryPage: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [entries, setEntries] = useState<SettlementEntry[]>([]);
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        loadData();
    }, [selectedMonth]);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await settlementService.getAllSettlements(selectedMonth);
            setEntries(data);
        } catch (error) {
            console.error(error);
            alert("데이터를 불러오는 중 오류가 발생했습니다.");
        } finally {
            setLoading(false);
        }
    };

    const handleExportExcel = () => {
        if (entries.length === 0) {
            alert("내보낼 데이터가 없습니다.");
            return;
        }

        const excelData = entries.map((entry, index) => ({
            'No': index + 1,
            '이름': entry.workerName,
            '주민번호': entry.workerId ? '******-*******' : '-', // Masked for privacy in demo
            '직책': entry.role,
            '소속팀': entry.teamId, // Should ideally map to team name if available in entry
            '신고 현장': entry.reportedSite,
            '신고 공수': entry.reportedDays,
            '신고 급여': entry.reportedGrossPay,
            '세금(3.3%)': entry.taxAmount,
            '실지급액': entry.netPay,
            '상태': entry.status === 'paid' ? '지급완료' : '대기'
        }));

        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, '전체인원내역');
        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });
        saveAs(data, `전체인원내역_${selectedMonth}.xlsx`);
    };

    const filteredEntries = entries.filter(entry =>
        entry.workerName.includes(searchTerm) ||
        (entry.reportedSite && entry.reportedSite.includes(searchTerm))
    );

    // Calculate Totals
    const totalReportedDays = filteredEntries.reduce((sum, e) => sum + e.reportedDays, 0);
    const totalReportedGross = filteredEntries.reduce((sum, e) => sum + e.reportedGrossPay, 0);
    const totalTax = filteredEntries.reduce((sum, e) => sum + e.taxAmount, 0);
    const totalNetPay = filteredEntries.reduce((sum, e) => sum + e.netPay, 0);

    return (
        <div className="p-6 max-w-[1800px] mx-auto">
            <div className="mb-6 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <FontAwesomeIcon icon={faFileInvoiceDollar} className="text-indigo-600" />
                        인원 전체 내역 조회 (Total Labor History)
                    </h1>
                    <p className="text-slate-500 text-sm">전체 현장/팀의 노무 신고용 데이터 통합 조회</p>
                </div>
                <button
                    onClick={handleExportExcel}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                >
                    <FontAwesomeIcon icon={faFileInvoiceDollar} />
                    전체 엑셀 다운로드
                </button>
            </div>

            {/* Controls */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
                    <FontAwesomeIcon icon={faCalendarAlt} className="text-slate-400" />
                    <input
                        type="month"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="bg-transparent border-none text-slate-700 font-bold focus:ring-0"
                    />
                </div>

                <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 flex-1 max-w-md">
                    <FontAwesomeIcon icon={faSearch} className="text-slate-400" />
                    <input
                        type="text"
                        placeholder="이름 또는 현장 검색..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="bg-transparent border-none text-slate-700 w-full focus:ring-0"
                    />
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="text-slate-500 text-xs mb-1">총 인원</div>
                    <div className="text-2xl font-bold text-slate-800">{filteredEntries.length}명</div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="text-slate-500 text-xs mb-1">총 신고 공수</div>
                    <div className="text-2xl font-bold text-blue-600">{totalReportedDays.toLocaleString()}공수</div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="text-slate-500 text-xs mb-1">총 신고 급여</div>
                    <div className="text-2xl font-bold text-slate-800">{totalReportedGross.toLocaleString()}원</div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="text-slate-500 text-xs mb-1">총 세금 (3.3%)</div>
                    <div className="text-2xl font-bold text-red-600">{totalTax.toLocaleString()}원</div>
                </div>
            </div>

            {/* Main Table */}
            <div className="bg-white rounded-xl shadow-lg border border-slate-300 overflow-hidden overflow-x-auto">
                {loading ? (
                    <div className="p-20 text-center text-slate-500">
                        <FontAwesomeIcon icon={faSpinner} spin className="text-3xl mb-4 text-indigo-500" />
                        <p>전체 데이터를 집계 중입니다...</p>
                    </div>
                ) : filteredEntries.length === 0 ? (
                    <div className="p-20 text-center text-slate-400">
                        <FontAwesomeIcon icon={faExclamationTriangle} className="text-3xl mb-4 opacity-50" />
                        <p>데이터가 없습니다.</p>
                    </div>
                ) : (
                    <table className="w-full text-sm border-collapse min-w-[1000px]">
                        <thead>
                            <tr className="bg-slate-100 text-slate-700 text-xs uppercase font-bold text-center border-b border-slate-300">
                                <th className="p-3 border-r border-slate-300 w-12">No</th>
                                <th className="p-3 border-r border-slate-300 w-24">이름</th>
                                <th className="p-3 border-r border-slate-300 w-24">직책</th>
                                <th className="p-3 border-r border-slate-300 w-40 bg-indigo-50">신고 현장</th>
                                <th className="p-3 border-r border-slate-300 w-24 bg-blue-50">신고 공수</th>
                                <th className="p-3 border-r border-slate-300 w-32">신고 급여 (총액)</th>
                                <th className="p-3 border-r border-slate-300 w-24 text-red-600">세금 (3.3%)</th>
                                <th className="p-3 border-r border-slate-300 w-32 bg-indigo-50 text-indigo-900">실지급액</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {filteredEntries.map((entry, idx) => (
                                <tr key={entry.id} className="hover:bg-slate-50">
                                    <td className="p-3 text-center text-slate-500">{idx + 1}</td>
                                    <td className="p-3 text-center font-bold text-slate-700">{entry.workerName}</td>
                                    <td className="p-3 text-center text-slate-500 text-xs">{entry.role}</td>
                                    <td className="p-3 text-center text-slate-600 font-medium bg-indigo-50/10">
                                        {entry.reportedSite || '-'}
                                    </td>
                                    <td className="p-3 text-center font-bold text-blue-600 bg-blue-50/10">
                                        {entry.reportedDays}
                                    </td>
                                    <td className="p-3 text-right font-bold text-slate-800">
                                        {entry.reportedGrossPay.toLocaleString()}
                                    </td>
                                    <td className="p-3 text-right text-red-600">
                                        {entry.taxAmount.toLocaleString()}
                                    </td>
                                    <td className="p-3 text-right font-bold text-indigo-700 bg-indigo-50/30">
                                        {entry.netPay.toLocaleString()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default TotalLaborHistoryPage;
