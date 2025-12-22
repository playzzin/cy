import React, { useState, useEffect, useRef } from 'react';
import { dailyReportService } from '../../services/dailyReportService';
import { siteService } from '../../services/siteService';
import { manpowerService } from '../../services/manpowerService';
import { payrollService, PayrollData } from '../../services/payrollService';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileExcel, faSpinner, faSearch, faPrint, faChevronDown, faCheck } from '@fortawesome/free-solid-svg-icons';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

interface WorkerData {
    id: string;
    name: string;
    juminId: string;
    address: string;
    category: string;
    bankName: string;
    accountNumber: string;
    phone: string;
}

interface InvoiceItem {
    workerId: string;
    workerName: string;
    juminId: string;
    address: string;
    category: string;
    days: number[]; // 1-31
    totalDays: number;
    unitPrice: number;
    totalAmount: number;
    bankName: string;
    accountNumber: string;
    phone: string;
}

interface Props {
    hideHeader?: boolean;
}

const SiteLaborCostInvoice: React.FC<Props> = ({ hideHeader }) => {
    const [loading, setLoading] = useState(false);
    const [sites, setSites] = useState<{ id: string; name: string }[]>([]);
    const [selectedSiteId, setSelectedSiteId] = useState('');
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

    // Popup states
    const [sitePopupOpen, setSitePopupOpen] = useState(false);
    const [monthPopupOpen, setMonthPopupOpen] = useState(false);
    const sitePopupRef = useRef<HTMLDivElement>(null);
    const monthPopupRef = useRef<HTMLDivElement>(null);

    // Use PayrollData type from service
    const [invoiceData, setInvoiceData] = useState<PayrollData[]>([]);
    const [dailyDetails, setDailyDetails] = useState<{ [key: string]: number[] }>({}); // workerId -> days array
    const [isSearched, setIsSearched] = useState(false);

    // Click outside to close popup
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (sitePopupRef.current && !sitePopupRef.current.contains(e.target as Node)) {
                setSitePopupOpen(false);
            }
            if (monthPopupRef.current && !monthPopupRef.current.contains(e.target as Node)) {
                setMonthPopupOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        loadSites();
    }, []);

    const loadSites = async () => {
        try {
            const siteList = await siteService.getSites();
            const formattedSites = siteList.map(site => ({
                id: site.id || '',
                name: site.name
            }));
            setSites(formattedSites);
            if (formattedSites.length > 0) setSelectedSiteId(formattedSites[0].id);
        } catch (error) {
            console.error("Error loading sites:", error);
        }
    };

    const fetchData = async () => {
        if (!selectedSiteId || !selectedMonth) {
            alert("현장과 월을 선택해주세요.");
            return null;
        }

        setLoading(true);
        try {
            const [yearStr, monthStr] = selectedMonth.split('-');
            const year = parseInt(yearStr);
            const month = parseInt(monthStr);

            // 1. Fetch Payroll Data (Aggregated)
            const payrollList = await payrollService.getPayrollData(year, month, undefined, selectedSiteId);

            // 2. Fetch Daily Details (for the days grid)
            // We need to fetch reports again to get the specific days, or modify payrollService to return them.
            // For now, let's fetch reports separately to get the days, or we can optimize later.
            // To be consistent with payrollService, we should probably fetch reports here too or ask payrollService to return days.
            // Let's just fetch reports here for the days grid to ensure accuracy.
            const startDate = `${yearStr}-${monthStr}-01`;
            const lastDay = new Date(year, month, 0).getDate();
            const endDate = `${yearStr}-${monthStr}-${lastDay}`;
            const reports = await dailyReportService.getReportsByRange(startDate, endDate, undefined, selectedSiteId);

            const details: { [key: string]: number[] } = {};
            reports.forEach(report => {
                const day = new Date(report.date).getDate();
                report.workers.forEach(w => {
                    const workerId = w.workerId || w.name;
                    if (!details[workerId]) details[workerId] = [];
                    if (!details[workerId].includes(day)) details[workerId].push(day);
                });
            });

            // Override Tax to 0 as requested
            const modifiedPayrollList = payrollList.map(item => ({
                ...item,
                tax: { income: 0, resident: 0 },
                netPay: item.grossPay - (item.deductions.advance + item.deductions.other) // Recalculate Net without tax
            }));

            setDailyDetails(details);
            setInvoiceData(modifiedPayrollList);
            setIsSearched(true);

            if (payrollList.length === 0) {
                alert("해당 기간에 데이터가 없습니다.");
            }

            return payrollList;

        } catch (error) {
            console.error("Error fetching data:", error);
            alert("데이터 조회 중 오류가 발생했습니다.");
            return null;
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = () => {
        fetchData();
    };

    const handleDownload = async () => {
        if (invoiceData.length === 0) {
            alert("출력할 데이터가 없습니다.");
            return;
        }

        setLoading(true);
        try {
            const siteName = sites.find(s => s.id === selectedSiteId)?.name || '';
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('일용노무비 지급명세서');

            // Columns  (Removed Tax)
            worksheet.columns = [
                { width: 12 }, // A: Name
                { width: 16 }, // B: JuminID/Phone
                { width: 30 }, // C: Address
                ...Array(16).fill({ width: 3.5 }), // D-S: Days
                { width: 8 },  // T: Total Days
                { width: 12 }, // U: Unit Price
                { width: 15 }, // V: Gross Pay
                // { width: 12 }, // W: Tax (Removed)
                { width: 12 }, // W: Deductions (Shifted)
                { width: 15 }, // X: Net Pay (Shifted)
            ];

            // Title
            worksheet.mergeCells('A1:X1'); // Adjusted merge range
            const titleCell = worksheet.getCell('A1');
            titleCell.value = '일용노무비 지급명세서';
            titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
            titleCell.font = { size: 20, bold: true };
            worksheet.getRow(1).height = 40;

            // Metadata
            worksheet.mergeCells('A2:C2');
            worksheet.getCell('A2').value = `기간: ${selectedMonth}`;

            worksheet.mergeCells('D2:X2'); // Adjusted merge range
            worksheet.getCell('D2').value = `현장명: ${siteName}`;
            worksheet.getCell('D2').alignment = { horizontal: 'right' };

            // Header Rows
            const headerRow1 = worksheet.getRow(3);
            const headerRow2 = worksheet.getRow(4);

            headerRow1.values = ['성명', '주민등록번호', '주소', ...Array.from({ length: 15 }, (_, i) => i + 1), '', '출역일수', '단가', '총액', '공제', '실지급액'];
            headerRow2.values = ['', '전화번호', '', ...Array.from({ length: 16 }, (_, i) => i + 16 <= 31 ? i + 16 : ''), ''];

            // Merge Headers - Re-evaluate columns
            // Cols: A, C, T, U, V, W, X
            // Removed Tax column in between V and X (old W)
            ['A', 'C', 'T', 'U', 'V', 'W', 'X'].forEach(col => {
                worksheet.mergeCells(`${col}3:${col}4`);
            });

            // Style Headers
            [headerRow1, headerRow2].forEach(row => {
                row.eachCell((cell) => {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    cell.font = { bold: true };
                    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                });
            });

            // Data Rows
            let currentRow = 5;
            invoiceData.forEach(item => {
                const row1 = worksheet.getRow(currentRow);
                const row2 = worksheet.getRow(currentRow + 1);
                const days = dailyDetails[item.id] || [];

                // Basic Info
                worksheet.mergeCells(`A${currentRow}:A${currentRow + 1}`);
                worksheet.getCell(`A${currentRow}`).value = item.name;

                row1.getCell(2).value = '******-*******'; // Masked Jumin
                row2.getCell(2).value = '';

                worksheet.mergeCells(`C${currentRow}:C${currentRow + 1}`);
                worksheet.getCell(`C${currentRow}`).value = ''; // Address

                // Days
                for (let i = 1; i <= 15; i++) {
                    if (days.includes(i)) row1.getCell(i + 3).value = 1.0;
                }
                for (let i = 16; i <= 31; i++) {
                    if (days.includes(i)) row2.getCell(i - 16 + 4).value = 1.0;
                }

                // Financials
                worksheet.mergeCells(`T${currentRow}:T${currentRow + 1}`);
                worksheet.getCell(`T${currentRow}`).value = item.gongsu.total;

                worksheet.mergeCells(`U${currentRow}:U${currentRow + 1}`);
                worksheet.getCell(`U${currentRow}`).value = item.unitPrice;
                worksheet.getCell(`U${currentRow}`).numFmt = '#,##0';

                worksheet.mergeCells(`V${currentRow}:V${currentRow + 1}`);
                worksheet.getCell(`V${currentRow}`).value = item.grossPay;
                worksheet.getCell(`V${currentRow}`).numFmt = '#,##0';

                // Tax Removed (Was W)

                worksheet.mergeCells(`W${currentRow}:W${currentRow + 1}`); // Deduction (Shifted to W)
                worksheet.getCell(`W${currentRow}`).value = item.deductions.advance + item.deductions.other;
                worksheet.getCell(`W${currentRow}`).numFmt = '#,##0';

                worksheet.mergeCells(`X${currentRow}:X${currentRow + 1}`); // NetPay (Shifted to X)
                worksheet.getCell(`X${currentRow}`).value = item.netPay;
                worksheet.getCell(`X${currentRow}`).numFmt = '#,##0';

                // Styling
                [row1, row2].forEach(row => {
                    row.eachCell({ includeEmpty: true }, (cell) => {
                        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                        cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    });
                });

                currentRow += 2;
            });

            // Generate
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            saveAs(blob, `일용노무비지급명세서_${siteName}_${selectedMonth}.xlsx`);

        } catch (error) {
            console.error("Error generating Excel:", error);
            alert("엑셀 생성 중 오류가 발생했습니다.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4 md:p-8 max-w-[1400px] mx-auto bg-white rounded-xl shadow-lg mt-10 min-h-screen">
            {!hideHeader && <h1 className="text-2xl font-bold text-slate-800 mb-6 border-b pb-4">일용노무비 지급명세서 (현장별)</h1>}

            <div className="space-y-6">
                {/* Control Panel */}
                <div className="flex flex-col md:flex-row gap-4 items-end bg-slate-50 p-4 rounded-lg border border-slate-200">
                    {/* 현장 선택 팝업 */}
                    <div className="relative" ref={sitePopupRef}>
                        <label className="block text-sm font-bold text-slate-600 mb-2">현장 선택</label>
                        <button
                            onClick={() => { setSitePopupOpen(!sitePopupOpen); setMonthPopupOpen(false); }}
                            className="w-full md:w-64 bg-white border border-slate-300 rounded-lg px-4 py-2.5 text-left flex items-center justify-between shadow-sm hover:border-brand-500 transition"
                        >
                            <span className="truncate">{sites.find(s => s.id === selectedSiteId)?.name || '현장을 선택하세요'}</span>
                            <FontAwesomeIcon icon={faChevronDown} className={`ml-2 text-slate-400 transition-transform ${sitePopupOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {sitePopupOpen && (
                            <div className="absolute top-full left-0 mt-1 w-full md:w-72 bg-white border border-slate-200 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto">
                                {sites.map(site => (
                                    <button
                                        key={site.id}
                                        onClick={() => { setSelectedSiteId(site.id); setSitePopupOpen(false); }}
                                        className={`w-full px-4 py-2.5 text-left hover:bg-brand-50 flex items-center justify-between transition ${selectedSiteId === site.id ? 'bg-brand-50 text-brand-700 font-bold' : 'text-slate-700'}`}
                                    >
                                        <span className="truncate">{site.name}</span>
                                        {selectedSiteId === site.id && <FontAwesomeIcon icon={faCheck} className="text-brand-600" />}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* 월 선택 팝업 */}
                    <div className="relative" ref={monthPopupRef}>
                        <label className="block text-sm font-bold text-slate-600 mb-2">월 선택</label>
                        <button
                            onClick={() => { setMonthPopupOpen(!monthPopupOpen); setSitePopupOpen(false); }}
                            className="w-full md:w-40 bg-white border border-slate-300 rounded-lg px-4 py-2.5 text-left flex items-center justify-between shadow-sm hover:border-brand-500 transition"
                        >
                            <span>{selectedMonth}</span>
                            <FontAwesomeIcon icon={faChevronDown} className={`ml-2 text-slate-400 transition-transform ${monthPopupOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {monthPopupOpen && (
                            <div className="absolute top-full left-0 mt-1 w-full md:w-48 bg-white border border-slate-200 rounded-lg shadow-xl z-50 p-3">
                                <input
                                    type="month"
                                    value={selectedMonth}
                                    onChange={(e) => { setSelectedMonth(e.target.value); setMonthPopupOpen(false); }}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:border-brand-500 focus:ring-brand-500"
                                />
                                <div className="mt-2 grid grid-cols-3 gap-1">
                                    {Array.from({ length: 6 }, (_, i) => {
                                        const d = new Date();
                                        d.setMonth(d.getMonth() - i);
                                        const val = d.toISOString().slice(0, 7);
                                        const label = `${d.getMonth() + 1}월`;
                                        return (
                                            <button
                                                key={val}
                                                onClick={() => { setSelectedMonth(val); setMonthPopupOpen(false); }}
                                                className={`px-2 py-1.5 text-xs rounded transition ${selectedMonth === val ? 'bg-brand-600 text-white font-bold' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}
                                            >
                                                {label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="flex gap-2 ml-auto">
                        <button
                            onClick={handleSearch}
                            disabled={loading}
                            className="bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 font-bold shadow-sm flex items-center gap-2 transition"
                        >
                            {loading && !isSearched ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSearch} />}
                            조회
                        </button>
                        <button
                            onClick={handleDownload}
                            disabled={loading}
                            className="bg-green-600 text-white px-6 py-2.5 rounded-lg hover:bg-green-700 font-bold shadow-sm flex items-center gap-2 transition"
                        >
                            {loading && isSearched ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faFileExcel} />}
                            엑셀 다운로드
                        </button>
                    </div>
                </div >

                {/* Web View Table */}
                {
                    isSearched && invoiceData.length > 0 && (
                        <div className="overflow-x-auto border border-slate-300 rounded-lg shadow-inner bg-white p-4">
                            <table className="w-full border-collapse text-xs md:text-sm whitespace-nowrap">
                                <thead>
                                    <tr>
                                        <th colSpan={25} className="border border-slate-400 p-4 text-center text-2xl font-bold bg-white text-slate-900">
                                            일용노무비 지급명세서
                                        </th>
                                    </tr>
                                    <tr className="bg-white">
                                        <td colSpan={3} className="border border-slate-400 p-2 text-left font-bold">
                                            기간: {selectedMonth}-01 ~ {new Date(new Date(selectedMonth).getFullYear(), new Date(selectedMonth).getMonth() + 1, 0).toISOString().slice(0, 10)}
                                        </td>
                                        <td colSpan={22} className="border border-slate-400 p-2 text-right font-bold">
                                            현장명: {sites.find(s => s.id === selectedSiteId)?.name}
                                        </td>
                                    </tr>

                                    <tr className="bg-[#fff2cc] text-slate-800">
                                        <th rowSpan={2} className="border border-slate-400 p-2 text-center w-24">성명</th>
                                        <th className="border border-slate-400 p-2 text-center w-32">주민등록번호</th>
                                        <th rowSpan={2} className="border border-slate-400 p-2 text-center min-w-[100px]">주소</th>

                                        {/* Days 1-15 */}
                                        {Array.from({ length: 15 }, (_, i) => i + 1).map(day => (
                                            <th key={`h1-${day}`} className="border border-slate-400 p-1 text-center w-6 bg-[#0070c0] text-white">
                                                {day}
                                            </th>
                                        ))}
                                        <th className="border border-slate-400 p-1 text-center w-6 bg-[#0070c0] text-white"></th>

                                        <th rowSpan={2} className="border border-slate-400 p-2 text-center w-16">출역일수</th>
                                        <th rowSpan={2} className="border border-slate-400 p-2 text-center w-20">단가</th>
                                        <th rowSpan={2} className="border border-slate-400 p-2 text-center w-24">총액</th>
                                        {/* Tax Header Removed */}
                                        <th rowSpan={2} className="border border-slate-400 p-2 text-center w-20">공제</th>
                                        <th rowSpan={2} className="border border-slate-400 p-2 text-center w-24 bg-yellow-100">실지급액</th>
                                    </tr>
                                    <tr className="bg-[#fff2cc] text-slate-800">
                                        <th className="border border-slate-400 p-2 text-center">전화번호</th>
                                        {/* Days 16-31 */}
                                        {Array.from({ length: 16 }, (_, i) => i + 16).map(day => (
                                            <th key={`h2-${day}`} className="border border-slate-400 p-1 text-center w-6 bg-[#c00000] text-white">
                                                {day <= 31 ? day : ''}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {invoiceData.map((item, idx) => {
                                        const days = dailyDetails[item.id] || [];
                                        return (
                                            <React.Fragment key={item.id}>
                                                <tr className="hover:bg-slate-50">
                                                    <td rowSpan={2} className="border border-slate-300 p-2 text-center font-bold">{item.name}</td>
                                                    <td className="border border-slate-300 p-2 text-center">******-*******</td>
                                                    <td rowSpan={2} className="border border-slate-300 p-2 text-left truncate max-w-xs"></td>

                                                    {Array.from({ length: 15 }, (_, i) => i + 1).map(day => (
                                                        <td key={`d1-${day}`} className="border border-slate-300 p-1 text-center text-[10px]">
                                                            {days.includes(day) ? '1.0' : ''}
                                                        </td>
                                                    ))}
                                                    <td className="border border-slate-300 p-1 text-center bg-slate-100"></td>

                                                    <td rowSpan={2} className="border border-slate-300 p-2 text-center font-bold">{item.gongsu.total.toFixed(1)}</td>
                                                    <td rowSpan={2} className="border border-slate-300 p-2 text-right">{item.unitPrice.toLocaleString()}</td>
                                                    <td rowSpan={2} className="border border-slate-300 p-2 text-right font-bold">{item.grossPay.toLocaleString()}</td>
                                                    {/* Tax Removed */}
                                                    <td rowSpan={2} className="border border-slate-300 p-2 text-right text-red-600">{(item.deductions.advance + item.deductions.other).toLocaleString()}</td>
                                                    <td rowSpan={2} className="border border-slate-300 p-2 text-right font-bold text-blue-600 bg-blue-50">{item.netPay.toLocaleString()}</td>
                                                </tr>
                                                <tr className="hover:bg-slate-50">
                                                    <td className="border border-slate-300 p-2 text-center text-xs text-slate-500"></td>
                                                    {Array.from({ length: 16 }, (_, i) => i + 16).map(day => (
                                                        <td key={`d2-${day}`} className="border border-slate-300 p-1 text-center text-[10px]">
                                                            {day <= 31 && days.includes(day) ? '1.0' : ''}
                                                        </td>
                                                    ))}
                                                </tr>
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                                <tfoot className="bg-[#f8cbad] font-bold">
                                    <tr>
                                        <td colSpan={3} className="border border-slate-400 p-3 text-center text-lg">합 계</td>
                                        <td colSpan={16} className="border border-slate-400 p-2"></td>
                                        <td className="border border-slate-400 p-2 text-center">
                                            {invoiceData.reduce((sum, item) => sum + item.gongsu.total, 0).toFixed(1)}
                                        </td>
                                        <td className="border border-slate-400 p-2"></td>
                                        <td className="border border-slate-400 p-2 text-right">
                                            {invoiceData.reduce((sum, item) => sum + item.grossPay, 0).toLocaleString()}
                                        </td>
                                        {/* Tax Removed */}
                                        <td className="border border-slate-400 p-2 text-right">
                                            {invoiceData.reduce((sum, item) => sum + (item.deductions.advance + item.deductions.other), 0).toLocaleString()}
                                        </td>
                                        <td className="border border-slate-400 p-2 text-right text-blue-700">
                                            {invoiceData.reduce((sum, item) => sum + item.netPay, 0).toLocaleString()}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )
                }

                {
                    isSearched && invoiceData.length === 0 && (
                        <div className="text-center py-20 text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                            <p className="text-xl mb-2">데이터가 없습니다.</p>
                            <p>선택한 기간에 출역 기록이 없습니다.</p>
                        </div>
                    )
                }

                {
                    !isSearched && (
                        <div className="text-center py-20 text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                            <p className="text-xl mb-2">조회 버튼을 눌러주세요.</p>
                            <p>현장과 월을 선택하고 조회하면 명세서가 표시됩니다.</p>
                        </div>
                    )
                }
            </div >
        </div >
    );
};

export default SiteLaborCostInvoice;
