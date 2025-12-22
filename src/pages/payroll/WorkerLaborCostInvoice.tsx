import React, { useState, useEffect, useRef } from 'react';
import { dailyReportService, DailyReport } from '../../services/dailyReportService';
import { manpowerService } from '../../services/manpowerService';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileExcel, faSpinner, faSearch, faPrint, faCopy } from '@fortawesome/free-solid-svg-icons';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import html2canvas from 'html2canvas';

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

interface WorkRecord {
    date: string;
    siteName: string;
    teamName: string;
    category: string;
    manDay: number;
    unitPrice: number;
    amount: number;
}

interface Props {
    hideHeader?: boolean;
}

const WorkerLaborCostInvoice: React.FC<Props> = ({ hideHeader }) => {
    const [loading, setLoading] = useState(false);
    const [workers, setWorkers] = useState<WorkerData[]>([]);
    const [selectedWorkerId, setSelectedWorkerId] = useState('');
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    const [workRecords, setWorkRecords] = useState<WorkRecord[]>([]);
    const [workerInfo, setWorkerInfo] = useState<WorkerData | null>(null);
    const [isSearched, setIsSearched] = useState(false);

    // Copy to Clipboard State
    const [copying, setCopying] = useState(false);
    const printRef = useRef<HTMLDivElement>(null);

    // Totals
    const [totals, setTotals] = useState({
        manDay: 0,
        grossPay: 0,
        tax: 0,
        deductions: 0,
        netPay: 0,
        unitPrice: 0
    });

    // Deduction items
    const [deductions, setDeductions] = useState({
        carryOver: 0,       // 전월 이월
        penalty: 0,         // 결손 벌금
        lodging: 0,         // 숙소비
        gloves: 0,          // 장갑
        deposit: 0,         // 보증금
        fine: 0,            // 과태료
        electricity: 0,     // 전기료
        gas: 0,             // 도시가스
        internet: 0,        // 인터넷
        water: 0,           // 수도세
        advance: 0,         // 가불
        incomeTax: 0        // 사업소득세 (3.3%)
    });

    useEffect(() => {
        loadWorkers();
    }, []);

    const loadWorkers = async () => {
        try {
            const workerList = await manpowerService.getWorkers();
            const formattedWorkers = workerList.map(w => ({
                id: w.id || '',
                name: w.name,
                juminId: w.idNumber,
                address: w.address || '',
                category: w.role || '',
                bankName: w.bankName || '',
                accountNumber: w.accountNumber || '',
                phone: w.contact || ''
            }));
            setWorkers(formattedWorkers);
            if (formattedWorkers.length > 0) setSelectedWorkerId(formattedWorkers[0].id);
        } catch (error) {
            console.error("Error loading workers:", error);
        }
    };

    const fetchData = async () => {
        if (!selectedWorkerId || !selectedMonth) {
            alert("작업자와 월을 선택해주세요.");
            return null;
        }

        setLoading(true);
        try {
            const [year, month] = selectedMonth.split('-');
            const startDate = `${year}-${month}-01`;
            const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
            const endDate = `${year}-${month}-${lastDay}`;

            // 1. Fetch All Reports for the range
            const reports = await dailyReportService.getReportsByRange(startDate, endDate);

            // 2. Filter for selected worker
            const records: WorkRecord[] = [];

            reports.forEach(report => {
                const workerEntry = report.workers.find(w => w.workerId === selectedWorkerId || w.name === workers.find(wk => wk.id === selectedWorkerId)?.name);

                if (workerEntry) {
                    records.push({
                        date: report.date,
                        siteName: report.siteName,
                        teamName: report.teamName,
                        category: workerEntry.role,
                        manDay: workerEntry.manDay,
                        unitPrice: workerEntry.unitPrice || 0,
                        amount: (workerEntry.unitPrice || 0) * workerEntry.manDay
                    });
                }
            });

            // Sort by date
            records.sort((a, b) => a.date.localeCompare(b.date));

            // Calculate Totals
            const totalManDay = records.reduce((sum, r) => sum + r.manDay, 0);
            const totalGross = records.reduce((sum, r) => sum + r.amount, 0);

            // Calculate average unit price
            const avgUnitPrice = records.length > 0
                ? Math.round(totalGross / totalManDay)
                : 0;

            // Calculate 3.3% income tax
            const incomeTax = Math.floor(totalGross * 0.033);

            // Update deductions with calculated income tax
            setDeductions(prev => ({ ...prev, incomeTax }));

            // Total deductions (using current deductions state + new tax)
            const totalDeductions = incomeTax; // Will be updated with other deductions if user edits them

            const netPay = totalGross - totalDeductions;

            setTotals({
                manDay: totalManDay,
                grossPay: totalGross,
                tax: incomeTax,
                deductions: totalDeductions,
                netPay: netPay,
                unitPrice: avgUnitPrice
            });

            setWorkRecords(records);
            setWorkerInfo(workers.find(w => w.id === selectedWorkerId) || null);
            setIsSearched(true);

            if (records.length === 0) {
                alert("해당 기간에 출역 기록이 없습니다.");
            }

            return records;

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
        if (workRecords.length === 0 && !isSearched) {
            const fetched = await fetchData();
            if (!fetched || fetched.length === 0) return;
        } else if (workRecords.length === 0) {
            alert("출력할 데이터가 없습니다.");
            return;
        }

        setLoading(true);
        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('급여명세서');

            // Column Setup
            worksheet.columns = [
                { width: 15 }, // A: Date
                { width: 20 }, // B: Site
                { width: 15 }, // C: Team
                { width: 15 }, // D: Category
                { width: 10 }, // E: ManDay
                { width: 15 }, // F: Unit Price
                { width: 15 }, // G: Amount
            ];

            // Title
            worksheet.mergeCells('A1:G1');
            const titleCell = worksheet.getCell('A1');
            titleCell.value = '급여명세서';
            titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
            titleCell.font = { size: 20, bold: true };
            worksheet.getRow(1).height = 40;

            // Worker Info
            const currentWorker = workerInfo || workers.find(w => w.id === selectedWorkerId);

            worksheet.mergeCells('A2:G2');
            worksheet.getCell('A2').value = `기간: ${selectedMonth}`;
            worksheet.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };

            worksheet.mergeCells('A3:B3');
            worksheet.getCell('A3').value = `성명: ${currentWorker?.name}`;

            worksheet.mergeCells('C3:D3');
            worksheet.getCell('C3').value = `생년월일: ${currentWorker?.juminId ? currentWorker.juminId.substring(0, 6) : ''}`;

            worksheet.mergeCells('E3:G3');
            worksheet.getCell('E3').value = `연락처: ${currentWorker?.phone}`;

            worksheet.mergeCells('A4:G4');
            worksheet.getCell('A4').value = `계좌번호: ${currentWorker?.bankName} ${currentWorker?.accountNumber}`;

            // Header
            const headerRow = worksheet.getRow(6);
            headerRow.values = ['날짜', '현장명', '소속팀', '공종', '공수', '단가', '금액'];
            headerRow.eachCell((cell) => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEEE' } };
                cell.font = { bold: true };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            });

            // Data
            let currentRow = 7;
            workRecords.forEach(record => {
                const row = worksheet.getRow(currentRow);
                row.values = [
                    record.date,
                    record.siteName,
                    record.teamName,
                    record.category,
                    record.manDay,
                    record.unitPrice,
                    record.amount
                ];

                row.getCell(5).numFmt = '0.0'; // ManDay
                row.getCell(6).numFmt = '#,##0'; // Unit Price
                row.getCell(7).numFmt = '#,##0'; // Amount

                row.eachCell((cell) => {
                    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                });
                currentRow++;
            });

            // Summary Section
            currentRow += 2;

            // Removed Tax from labels
            const summaryLabels = ['총 공수', '총액(세전)', '공제액', '실지급액'];
            const summaryValues = [
                totals.manDay.toFixed(1),
                totals.grossPay,
                // totals.tax, // Removed
                totals.deductions,
                totals.netPay
            ];

            for (let i = 0; i < summaryLabels.length; i++) {
                const r = worksheet.getRow(currentRow + i);
                r.getCell(5).value = summaryLabels[i]; // Column E
                r.getCell(5).font = { bold: true };
                r.getCell(5).alignment = { horizontal: 'right' };

                r.getCell(7).value = i === 0 ? parseFloat(summaryValues[i] as string) : summaryValues[i]; // Column G
                r.getCell(7).numFmt = i === 0 ? '0.0' : '#,##0';
                r.getCell(7).font = { bold: true };

                if (i === 3) { // Net Pay (Index adjusted)
                    r.getCell(7).font = { bold: true, color: { argb: 'FF0000FF' }, size: 12 };
                }
            }

            // Generate
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            saveAs(blob, `급여명세서_${currentWorker?.name}_${selectedMonth}.xlsx`);

        } catch (error) {
            console.error("Error generating Excel:", error);
            alert("엑셀 생성 중 오류가 발생했습니다.");
        } finally {
            setLoading(false);
        }
    };

    const handleCopyToClipboard = async () => {
        if (!printRef.current) {
            alert("미리보기 화면이 없습니다. 조회 후 시도해주세요.");
            return;
        }
        setCopying(true);

        try {
            // Force white background for the capture
            // Cast html2canvas to any because of version mismatch with @types/html2canvas (0.5.x vs 1.4.x)
            const canvas = await (html2canvas as any)(printRef.current, {
                scale: 1.5, // Reasonable scale for clipboard
                backgroundColor: '#ffffff',
                logging: false,
                useCORS: true
            });

            canvas.toBlob(async (blob: Blob | null) => {
                if (!blob) {
                    alert('이미지 생성에 실패했습니다.');
                    setCopying(false);
                    return;
                }

                try {
                    // Safe ClipboardItem usage
                    const ClipboardItem = (window as any).ClipboardItem;
                    if (!ClipboardItem) {
                        alert('이 브라우저는 이미지 복사를 지원하지 않습니다.');
                        setCopying(false);
                        return;
                    }

                    await navigator.clipboard.write([
                        new ClipboardItem({
                            'image/png': blob
                        })
                    ]);
                    alert('노임명세서가 이미지로 복사되었습니다.\nCtrl+V로 붙여넣으세요.');
                } catch (err) {
                    console.error('Clipboard write failed:', err);
                    alert('클립보드 복사에 실패했습니다. 권한을 확인해주세요.');
                }
                setCopying(false);
            }, 'image/png');

        } catch (error) {
            console.error('Capture failed:', error);
            alert('이미지 생성 중 오류가 발생했습니다.');
            setCopying(false);
        }
    };

    return (
        <div className="p-4 md:p-8 max-w-[1000px] mx-auto bg-white rounded-xl shadow-lg mt-10 min-h-screen">
            {!hideHeader && <h1 className="text-2xl font-bold text-slate-800 mb-6 border-b pb-4">작업자별 노무비청구서 (급여명세서)</h1>}

            <div className="space-y-6">
                {/* Control Panel */}
                <div className="flex flex-col md:flex-row gap-4 items-end bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <div className="flex-1">
                        <label className="block text-sm font-bold text-slate-600 mb-2">작업자 선택</label>
                        <select
                            value={selectedWorkerId}
                            onChange={(e) => setSelectedWorkerId(e.target.value)}
                            className="w-full border-slate-300 rounded-lg shadow-sm focus:border-brand-500 focus:ring-brand-500"
                        >
                            {workers.map(worker => (
                                <option key={worker.id} value={worker.id}>{worker.name} ({worker.category})</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-600 mb-2">월 선택</label>
                        <input
                            type="month"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="w-full border-slate-300 rounded-lg shadow-sm focus:border-brand-500 focus:ring-brand-500"
                        />
                    </div>
                    <div className="flex gap-2">
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
                            disabled={loading || !isSearched}
                            className="bg-green-600 text-white px-6 py-2.5 rounded-lg hover:bg-green-700 font-bold shadow-sm flex items-center gap-2 transition disabled:opacity-50"
                        >
                            {loading && isSearched ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faFileExcel} />}
                            엑셀 다운로드
                        </button>
                        <button
                            onClick={handleCopyToClipboard}
                            disabled={loading || !isSearched || copying}
                            className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg hover:bg-indigo-700 font-bold shadow-sm flex items-center gap-2 transition disabled:opacity-50"
                        >
                            {copying ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faCopy} />}
                            이미지 복사
                        </button>
                    </div>
                </div>

                {/* Web View - Salary Statement Style Matching User's Format */}
                {isSearched && workerInfo && (
                    <div ref={printRef} className="border-2 border-slate-400 bg-white shadow-sm print:shadow-none print:border-none">
                        {/* Title */}
                        <div className="bg-yellow-300 text-center py-3 border-b-2 border-slate-400">
                            <h2 className="text-2xl font-bold text-slate-800">
                                {selectedMonth.split('-')[0]}년 {parseInt(selectedMonth.split('-')[1])}월 노임명세서
                            </h2>
                        </div>

                        {/* 사원 정보 */}
                        <div className="bg-slate-100 text-center py-2 border-b border-slate-300">
                            <span className="font-bold text-slate-700">사원 정보</span>
                        </div>
                        <div className="grid grid-cols-4 border-b border-slate-300">
                            <div className="border-r border-slate-300 p-2 text-center font-semibold bg-slate-50">직 위</div>
                            <div className="border-r border-slate-300 p-2 text-center"></div>
                            <div className="border-r border-slate-300 p-2 text-center font-semibold bg-slate-50">성명</div>
                            <div className="p-2 text-center font-bold">{workerInfo.name}</div>
                        </div>

                        {/* 노임 및 공제내역 Header */}
                        <div className="bg-yellow-300 text-center py-2 border-b border-slate-300">
                            <span className="font-bold text-slate-800">노임 및 공제내역</span>
                        </div>

                        {/* 근무내역 / 공제내역 Two Column */}
                        <div className="grid grid-cols-2">
                            {/* Left: 근무내역 */}
                            <div className="border-r border-slate-300">
                                <div className="grid grid-cols-2 border-b border-slate-300">
                                    <div className="p-2 text-center font-semibold bg-slate-50 border-r border-slate-300">근무내역</div>
                                    <div className="p-2 text-center bg-slate-50"></div>
                                </div>
                                <div className="grid grid-cols-2 border-b border-slate-300">
                                    <div className="p-2 text-center border-r border-slate-300 bg-slate-50">공수</div>
                                    <div className="p-2 text-center font-semibold">{totals.manDay.toFixed(1)}</div>
                                </div>
                                <div className="grid grid-cols-2 border-b border-slate-300">
                                    <div className="p-2 text-center border-r border-slate-300 bg-slate-50">단 가</div>
                                    <div className="p-2 text-center">{totals.unitPrice.toLocaleString()}</div>
                                </div>
                                <div className="grid grid-cols-2 border-b border-slate-300">
                                    <div className="p-2 text-center border-r border-slate-300 bg-yellow-100 font-bold">본 봉</div>
                                    <div className="p-2 text-center font-bold bg-yellow-100">{totals.grossPay.toLocaleString()}</div>
                                </div>
                            </div>

                            {/* Right: 공제내역 */}
                            <div>
                                <div className="grid grid-cols-2 border-b border-slate-300">
                                    <div className="p-2 text-center font-semibold bg-slate-50 border-r border-slate-300">공제내역</div>
                                    <div className="p-2 text-center bg-slate-50"></div>
                                </div>
                                {[
                                    { label: '전월 이월', value: deductions.carryOver },
                                    { label: '결손 벌금', value: deductions.penalty },
                                    { label: '숙 소 비', value: deductions.lodging },
                                    { label: '장   갑', value: deductions.gloves },
                                    { label: '보 증 금', value: deductions.deposit },
                                    { label: '과 태 료', value: deductions.fine },
                                    { label: '전 기 료', value: deductions.electricity },
                                    { label: '도시가스', value: deductions.gas },
                                    { label: '인 터 넷', value: deductions.internet },
                                    { label: '수 도 세', value: deductions.water },
                                    { label: '가   불', value: deductions.advance },
                                    { label: '사업소득세 (3.3%)', value: deductions.incomeTax }
                                ].map((item, idx) => (
                                    <div key={idx} className="grid grid-cols-2 border-b border-slate-300">
                                        <div className="p-2 text-center border-r border-slate-300 bg-slate-50 text-sm">{item.label}</div>
                                        <div className="p-2 text-right pr-4 text-sm">{item.value > 0 ? item.value.toLocaleString() : '-'}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Summary Section */}
                        <div className="border-t-2 border-slate-400">
                            <div className="grid grid-cols-2 border-b border-slate-300">
                                <div className="p-3 text-center font-bold bg-slate-100">총 공제금</div>
                                <div className="p-3 text-right pr-6 font-bold">{deductions.incomeTax.toLocaleString()}</div>
                            </div>
                            <div className="grid grid-cols-2 border-b border-slate-300">
                                <div className="p-3 text-center font-bold bg-slate-100">세후본봉(본봉-총공제금)</div>
                                <div className="p-3 text-right pr-6 font-bold">{(totals.grossPay - deductions.incomeTax).toLocaleString()}</div>
                            </div>
                            <div className="grid grid-cols-2 bg-white">
                                <div className="p-4 text-center font-bold text-lg bg-slate-100">실 지급액</div>
                                <div className="p-4 text-right pr-6 font-bold text-xl text-red-600">{(totals.grossPay - deductions.incomeTax).toLocaleString()}</div>
                            </div>
                        </div>
                    </div>
                )}

                {!isSearched && (
                    <div className="text-center py-20 text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                        <p className="text-xl mb-2">조회 버튼을 눌러주세요.</p>
                        <p>작업자와 월을 선택하고 조회하면 급여명세서가 표시됩니다.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WorkerLaborCostInvoice;
