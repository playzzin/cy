import React, { useState, useEffect } from 'react';
import { dailyReportService } from '../../services/dailyReportService';
import { manpowerService } from '../../services/manpowerService';
import { signatureService } from '../../services/signatureService';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileExcel, faSpinner, faSearch, faPenNib, faXmark } from '@fortawesome/free-solid-svg-icons';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import Swal from 'sweetalert2';
import SignatureGeneratorModal from '../../components/signatures/SignatureGeneratorModal';

interface WorkerData {
    id: string;
    name: string;
    juminId: string;
    address: string;
    category: string;
    bankName: string;
    accountNumber: string;
    phone: string;
    signatureUrl?: string;
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

const SignManagementPage: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [workers, setWorkers] = useState<WorkerData[]>([]);
    const [selectedWorkerId, setSelectedWorkerId] = useState('');
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    const [workRecords, setWorkRecords] = useState<WorkRecord[]>([]);
    const [workerInfo, setWorkerInfo] = useState<WorkerData | null>(null);
    const [isSearched, setIsSearched] = useState(false);
    const [isSignMode, setIsSignMode] = useState(false);
    const [signatureImage, setSignatureImage] = useState<string | null>(null);
    const [signatureSaving, setSignatureSaving] = useState(false);

    // Totals
    const [totals, setTotals] = useState({
        manDay: 0,
        grossPay: 0,
        tax: 0,
        deductions: 0,
        netPay: 0
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
                juminId: w.idNumber || '',
                address: w.address || '',
                category: w.role || '',
                bankName: w.bankName || '',
                accountNumber: w.accountNumber || '',
                phone: w.contact || '',
                signatureUrl: w.signatureUrl || ''
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
            return;
        }

        setLoading(true);
        try {
            const [year, month] = selectedMonth.split('-');
            const startDate = `${year}-${month}-01`;
            const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
            const endDate = `${year}-${month}-${lastDay}`;

            const reports = await dailyReportService.getReportsByRange(startDate, endDate);
            const records: WorkRecord[] = [];

            reports.forEach(report => {
                const workerEntry = report.workers.find(w => w.workerId === selectedWorkerId || w.name === workers.find(wk => wk.id === selectedWorkerId)?.name);

                if (workerEntry) {
                    records.push({
                        date: report.date,
                        siteName: report.siteName || '',
                        teamName: report.teamName || '',
                        category: workerEntry.role || '',
                        manDay: workerEntry.manDay,
                        unitPrice: workerEntry.unitPrice || 0,
                        amount: (workerEntry.unitPrice || 0) * workerEntry.manDay
                    });
                }
            });

            records.sort((a, b) => a.date.localeCompare(b.date));

            const totalManDay = records.reduce((sum, r) => sum + r.manDay, 0);
            const totalGross = records.reduce((sum, r) => sum + r.amount, 0);
            const incomeTax = Math.floor(totalGross * 0.03);
            const residentTax = Math.floor(incomeTax * 0.1);
            const totalTax = incomeTax + residentTax;
            const totalDeductions = 0;
            const netPay = totalGross - totalTax - totalDeductions;

            setTotals({
                manDay: totalManDay,
                grossPay: totalGross,
                tax: totalTax,
                deductions: totalDeductions,
                netPay: netPay
            });

            setWorkRecords(records);
            const selectedWorker = workers.find(w => w.id === selectedWorkerId) || null;
            setWorkerInfo(selectedWorker);
            setIsSearched(true);
            setSignatureImage(selectedWorker?.signatureUrl ? String(selectedWorker.signatureUrl) : null);

            if (records.length === 0) {
                alert("해당 기간에 출역 기록이 없습니다.");
            }

        } catch (error) {
            console.error("Error fetching data:", error);
            alert("데이터 조회 중 오류가 발생했습니다.");
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = () => {
        fetchData();
    };

    // Signature Functions
    const handleSignatureSaved = (downloadUrl: string) => {
        setSignatureImage(downloadUrl);
        setWorkers(prev => prev.map(w => w.id === selectedWorkerId ? { ...w, signatureUrl: downloadUrl } : w));
        setWorkerInfo(prev => prev && prev.id === selectedWorkerId ? { ...prev, signatureUrl: downloadUrl } : prev);
        setIsSignMode(false);
    };

    const deleteSavedSignature = async () => {
        if (!selectedWorkerId) return;
        if (!signatureImage) return;

        const res = await Swal.fire({
            title: '서명을 삭제할까요?',
            text: '저장된 서명이 삭제됩니다.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: '삭제',
            cancelButtonText: '취소'
        });
        if (!res.isConfirmed) return;

        setSignatureSaving(true);
        try {
            await signatureService.deleteSignature(selectedWorkerId, signatureImage);
            setSignatureImage(null);
            setWorkers(prev => prev.map(w => w.id === selectedWorkerId ? { ...w, signatureUrl: '' } : w));
            setWorkerInfo(prev => prev && prev.id === selectedWorkerId ? { ...prev, signatureUrl: '' } : prev);
            Swal.fire('완료', '서명이 삭제되었습니다.', 'success');
        } catch (error: unknown) {
            console.error(error);
            const msg = (error as { message?: unknown } | null | undefined)?.message;
            Swal.fire('오류', typeof msg === 'string' ? msg : '서명 삭제에 실패했습니다.', 'error');
        } finally {
            setSignatureSaving(false);
        }
    };

    const cancelSignMode = () => {
        setIsSignMode(false);
    };

    const handleDownload = async () => {
        if (workRecords.length === 0) {
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

            const summaryLabels = ['총 공수', '총액(세전)', '세금(3.3%)', '공제액', '실지급액'];
            const summaryValues = [
                totals.manDay.toFixed(1),
                totals.grossPay,
                totals.tax,
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

                if (i === 4) { // Net Pay
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


    return (
        <div className="flex flex-col h-full bg-[#f1f5f9]">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-6 py-4">
                <div className="flex items-center gap-3 mb-4">
                    <div className="bg-blue-100 p-2 rounded-lg">
                        <FontAwesomeIcon icon={faPenNib} className="text-blue-600 text-xl" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">싸인 관리</h1>
                        <p className="text-sm text-slate-500">근로자별 명세서를 확인하고 서명을 진행합니다.</p>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-auto p-4 md:p-8">
                <div className="max-w-[1000px] mx-auto bg-white rounded-xl shadow-lg min-h-screen relative">
                    <h1 className="text-2xl font-bold text-slate-800 mb-6 border-b pb-4 px-8 pt-8">작업자별 명세서 서명</h1>

                    <div className="space-y-6 px-8 pb-8">
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
                                    disabled={loading}
                                    className="bg-green-600 text-white px-6 py-2.5 rounded-lg hover:bg-green-700 font-bold shadow-sm flex items-center gap-2 transition"
                                >
                                    {loading && isSearched ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faFileExcel} />}
                                    엑셀 다운로드
                                </button>
                            </div>
                        </div>

                        {/* Web View - Salary Statement Style */}
                        {isSearched && workerInfo && (
                            <div className="border border-slate-400 bg-white p-8 shadow-sm relative">
                                {/* Floating Sign Button */}
                                {!signatureImage && (
                                    <button
                                        onClick={() => setIsSignMode(true)}
                                        className="absolute top-4 right-4 bg-indigo-600 text-white px-4 py-2 rounded-full shadow-lg hover:bg-indigo-700 transition flex items-center gap-2 z-10"
                                    >
                                        <FontAwesomeIcon icon={faPenNib} />
                                        싸인하기
                                    </button>
                                )}

                                <div className="text-center mb-8">
                                    <h2 className="text-3xl font-bold underline underline-offset-8 decoration-double">급여명세서</h2>
                                    <p className="mt-4 text-slate-600 font-bold text-lg">{selectedMonth}</p>
                                </div>

                                {/* Worker Info Grid */}
                                <div className="grid grid-cols-2 gap-4 mb-8 border-t border-b border-slate-300 py-4">
                                    <div className="flex">
                                        <span className="w-24 font-bold text-slate-600">성 명:</span>
                                        <span>{workerInfo.name}</span>
                                    </div>
                                    <div className="flex">
                                        <span className="w-24 font-bold text-slate-600">생년월일:</span>
                                        <span>{workerInfo.juminId ? workerInfo.juminId.substring(0, 6) : '-'}</span>
                                    </div>
                                    <div className="flex">
                                        <span className="w-24 font-bold text-slate-600">연락처:</span>
                                        <span>{workerInfo.phone}</span>
                                    </div>
                                    <div className="flex">
                                        <span className="w-24 font-bold text-slate-600">계좌번호:</span>
                                        <span>{workerInfo.bankName} {workerInfo.accountNumber}</span>
                                    </div>
                                </div>

                                {/* Details Table */}
                                <div className="overflow-x-auto mb-8">
                                    <table className="w-full border-collapse border border-slate-400">
                                        <thead>
                                            <tr className="bg-slate-100">
                                                <th className="border border-slate-400 p-2 text-center">날짜</th>
                                                <th className="border border-slate-400 p-2 text-center">현장명</th>
                                                <th className="border border-slate-400 p-2 text-center">소속팀</th>
                                                <th className="border border-slate-400 p-2 text-center">공종</th>
                                                <th className="border border-slate-400 p-2 text-center">공수</th>
                                                <th className="border border-slate-400 p-2 text-center">단가</th>
                                                <th className="border border-slate-400 p-2 text-center">금액</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {workRecords.map((record, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50">
                                                    <td className="border border-slate-400 p-2 text-center">{record.date}</td>
                                                    <td className="border border-slate-400 p-2 text-center">{record.siteName}</td>
                                                    <td className="border border-slate-400 p-2 text-center">{record.teamName}</td>
                                                    <td className="border border-slate-400 p-2 text-center">{record.category}</td>
                                                    <td className="border border-slate-400 p-2 text-center font-bold">{record.manDay}</td>
                                                    <td className="border border-slate-400 p-2 text-right">{record.unitPrice.toLocaleString()}</td>
                                                    <td className="border border-slate-400 p-2 text-right font-bold">{record.amount.toLocaleString()}</td>
                                                </tr>
                                            ))}
                                            {workRecords.length === 0 && (
                                                <tr>
                                                    <td colSpan={7} className="border border-slate-400 p-8 text-center text-slate-500">
                                                        출역 기록이 없습니다.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                        <tfoot>
                                            <tr className="bg-slate-100">
                                                <td colSpan={4} className="border border-slate-400 p-2 text-right font-bold">소 계</td>
                                                <td className="border border-slate-400 p-2 text-center font-bold">{totals.manDay.toFixed(1)}</td>
                                                <td className="border border-slate-400 p-2"></td>
                                                <td className="border border-slate-400 p-2 text-right font-bold">{totals.grossPay.toLocaleString()}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>

                                {/* Summary Table & Signature */}
                                <div className="flex flex-col md:flex-row justify-between items-start gap-8">
                                    <div className="w-full md:w-1/2">
                                        <div className="text-center text-sm text-slate-500 mt-8 mb-4">
                                            <p>위와 같이 급여를 청구합니다.</p>
                                            <p className="mt-2">{new Date().toLocaleDateString()}</p>
                                            <p className="mt-8 text-lg font-bold">{workerInfo.name} (인)</p>
                                        </div>
                                        {/* Signature Image Display */}
                                        {signatureImage && (
                                            <div className="mt-4 border border-slate-300 p-4 rounded-lg bg-slate-50 relative">
                                                <p className="text-xs text-slate-400 absolute top-2 left-2">서명 확인</p>
                                                <img src={signatureImage} alt="서명" className="mx-auto h-24 object-contain" />
                                                <button
                                                    onClick={deleteSavedSignature}
                                                    disabled={signatureSaving}
                                                    className="absolute top-2 right-2 text-red-400 hover:text-red-600"
                                                    title="서명 삭제"
                                                >
                                                    <FontAwesomeIcon icon={faXmark} />
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    <div className="w-full md:w-1/2">
                                        <table className="w-full border-collapse border border-slate-400">
                                            <tbody>
                                                <tr>
                                                    <th className="border border-slate-400 p-2 bg-slate-100 text-left w-1/2">총액 (세전)</th>
                                                    <td className="border border-slate-400 p-2 text-right font-bold">{totals.grossPay.toLocaleString()}</td>
                                                </tr>
                                                <tr>
                                                    <th className="border border-slate-400 p-2 bg-slate-100 text-left">세금 (3.3%)</th>
                                                    <td className="border border-slate-400 p-2 text-right text-red-600">-{totals.tax.toLocaleString()}</td>
                                                </tr>
                                                <tr>
                                                    <th className="border border-slate-400 p-2 bg-slate-100 text-left">공제액</th>
                                                    <td className="border border-slate-400 p-2 text-right text-red-600">-{totals.deductions.toLocaleString()}</td>
                                                </tr>
                                                <tr className="bg-blue-50">
                                                    <th className="border border-slate-400 p-3 text-left text-lg">실지급액</th>
                                                    <td className="border border-slate-400 p-3 text-right text-xl font-bold text-blue-700">{totals.netPay.toLocaleString()}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}

                        {!isSearched && (
                            <div className="text-center py-20 text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                                <p className="text-xl mb-2">조회 버튼을 눌러주세요.</p>
                                <p>작업자와 월을 선택하고 조회하면 급여명세서가 표시되며 서명할 수 있습니다.</p>
                            </div>
                        )}
                    </div>

                    {/* Sign Logic Button Sheet / Modal Overaly */}
                    {isSignMode && (
                        <SignatureGeneratorModal
                            isOpen={isSignMode}
                            onClose={cancelSignMode}
                            workerId={selectedWorkerId}
                            workerName={workerInfo?.name ?? workers.find(w => w.id === selectedWorkerId)?.name ?? ''}
                            onSaveComplete={handleSignatureSaved}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default SignManagementPage;