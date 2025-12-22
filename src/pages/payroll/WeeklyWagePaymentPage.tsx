import React, { useState, useEffect } from 'react';
import { dailyReportService, DailyReport } from '../../services/dailyReportService';
import { manpowerService, Worker } from '../../services/manpowerService';
import * as XLSX from 'xlsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileExcel, faSearch, faSpinner, faExclamationTriangle, faCalendarAlt } from '@fortawesome/free-solid-svg-icons';

interface PaymentData {
    workerId: string;
    workerName: string;
    teamName: string;
    startDate: string;
    endDate: string;
    totalManDay: number;
    unitPrice: number;
    totalAmount: number;
    bankName: string;
    bankCode: string;
    accountNumber: string;
    accountHolder: string;
    displayContent: string;
    isValid: boolean;
    errors: {
        bankName?: boolean;
        bankCode?: boolean;
        accountNumber?: boolean;
        accountHolder?: boolean;
    };
}

const BANK_CODES: { [key: string]: string } = {
    'KB국민은행': '004', '국민은행': '004', '국민': '004',
    'SC제일은행': '023', '제일은행': '023', 'SC': '023',
    '경남은행': '039', '경남': '039',
    '광주은행': '034', '광주': '034',
    '기업은행': '003', '기업': '003', 'IBK': '003',
    '농협은행': '011', '농협': '011', 'NH': '011',
    '대구은행': '031', '대구': '031',
    '부산은행': '032', '부산': '032',
    '산업은행': '002', '산업': '002',
    '수협은행': '007', '수협': '007',
    '신한은행': '088', '신한': '088',
    '우리은행': '020', '우리': '020',
    '우체국': '071',
    '전북은행': '037', '전북': '037',
    '제주은행': '035', '제주': '035',
    '카카오뱅크': '090', '카카오': '090',
    '케이뱅크': '089', '케이': '089',
    '토스뱅크': '092', '토스': '092',
    '하나은행': '081', '하나': '081',
    '한국씨티은행': '027', '씨티': '027',
};

interface Props {
    hideHeader?: boolean;
}

const WeeklyWagePaymentPage: React.FC<Props> = ({ hideHeader }) => {
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [paymentData, setPaymentData] = useState<PaymentData[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [totalAmount, setTotalAmount] = useState<number>(0);
    const [bulkDisplayContent, setBulkDisplayContent] = useState<string>('주급');
    const [errorCount, setErrorCount] = useState<number>(0);
    const [weekRange, setWeekRange] = useState<{ start: string, end: string }>({ start: '', end: '' });

    useEffect(() => {
        calculateWeekRange(selectedDate);
    }, [selectedDate]);

    const calculateWeekRange = (dateStr: string) => {
        const date = new Date(dateStr);
        const day = date.getDay(); // 0 (Sun) - 6 (Sat)

        // Calculate Monday of the week
        const diff = date.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
        const monday = new Date(date.setDate(diff));
        const sunday = new Date(date.setDate(monday.getDate() + 6));

        setWeekRange({
            start: monday.toISOString().split('T')[0],
            end: sunday.toISOString().split('T')[0]
        });
    };

    const validateItem = (item: Partial<PaymentData>): { isValid: boolean, errors: PaymentData['errors'] } => {
        const errors: PaymentData['errors'] = {};
        let isValid = true;

        if (!item.bankName) {
            errors.bankName = true;
            isValid = false;
        }
        if (!item.bankCode && item.bankName) {
            if (!BANK_CODES[item.bankName]) {
                errors.bankCode = true;
                isValid = false;
            }
        }
        if (!item.accountNumber) {
            errors.accountNumber = true;
            isValid = false;
        }
        if (!item.accountHolder) {
            errors.accountHolder = true;
            isValid = false;
        }

        return { isValid, errors };
    };

    const fetchData = async () => {
        if (!weekRange.start || !weekRange.end) return;

        setLoading(true);
        try {
            // Fetch reports for the entire week
            // Since getReports fetches by day, we might need to fetch all reports and filter, 
            // or fetch day by day. For efficiency, let's fetch all reports and filter by date range locally
            // assuming getAllReports exists and is reasonably performant, or loop getReports.
            // dailyReportService.getAllReports() is available.

            const allReports = await dailyReportService.getAllReports();
            const allWorkers = await manpowerService.getWorkers();
            const workerMap = new Map(allWorkers.map(w => [w.id!, w]));

            const weeklyReports = allReports.filter(r => r.date >= weekRange.start && r.date <= weekRange.end);

            const workerAggregates: { [key: string]: { manDay: number, teamName: string, totalAmount: number, unitPrices: number[] } } = {};

            weeklyReports.forEach(report => {
                report.workers.forEach(reportWorker => {
                    const workerDetails = workerMap.get(reportWorker.workerId);

                    // Filter for '주급제'
                    if (workerDetails && workerDetails.salaryModel === '주급제') {
                        if (!workerAggregates[reportWorker.workerId]) {
                            workerAggregates[reportWorker.workerId] = { manDay: 0, teamName: report.teamName, totalAmount: 0, unitPrices: [] };
                        }
                        const snapshotUnitPrice = reportWorker.unitPrice ?? workerDetails.unitPrice ?? 0;
                        workerAggregates[reportWorker.workerId].manDay += reportWorker.manDay;
                        workerAggregates[reportWorker.workerId].totalAmount += reportWorker.manDay * snapshotUnitPrice;
                        if (!workerAggregates[reportWorker.workerId].unitPrices.includes(snapshotUnitPrice)) {
                            workerAggregates[reportWorker.workerId].unitPrices.push(snapshotUnitPrice);
                        }
                        // Update team name to latest if needed, or keep first found
                    }
                });
            });

            const processedData: PaymentData[] = [];
            let sumAmount = 0;
            let errCount = 0;

            Object.keys(workerAggregates).forEach(workerId => {
                const agg = workerAggregates[workerId];
                const workerDetails = workerMap.get(workerId);

                if (workerDetails) {
                    const amount = agg.totalAmount;
                    const unitPrice = agg.unitPrices.length === 1
                        ? agg.unitPrices[0]
                        : (agg.manDay > 0 ? Math.round(amount / agg.manDay) : (workerDetails.unitPrice || 0));
                    const bankName = workerDetails.bankName || '';
                    const bankCode = BANK_CODES[bankName] || '';
                    const accountNumber = workerDetails.accountNumber || '';
                    const accountHolder = workerDetails.accountHolder || '';

                    const validation = validateItem({ bankName, bankCode, accountNumber, accountHolder });
                    if (!validation.isValid) errCount++;

                    processedData.push({
                        workerId: workerId,
                        workerName: workerDetails.name,
                        teamName: agg.teamName,
                        startDate: weekRange.start,
                        endDate: weekRange.end,
                        totalManDay: agg.manDay,
                        unitPrice: unitPrice,
                        totalAmount: amount,
                        bankName: bankName,
                        bankCode: bankCode,
                        accountNumber: accountNumber,
                        accountHolder: accountHolder,
                        displayContent: '주급',
                        isValid: validation.isValid,
                        errors: validation.errors
                    });
                    sumAmount += amount;
                }
            });

            setPaymentData(processedData);
            setTotalAmount(sumAmount);
            setErrorCount(errCount);

        } catch (error) {
            console.error("Error fetching payment data:", error);
            alert("데이터를 불러오는 중 오류가 발생했습니다.");
        } finally {
            setLoading(false);
        }
    };

    const handleDisplayContentChange = (index: number, value: string) => {
        const newData = [...paymentData];
        newData[index].displayContent = value;
        setPaymentData(newData);
    };

    const handleBulkDisplayContentApply = () => {
        const newData = paymentData.map(item => ({
            ...item,
            displayContent: bulkDisplayContent
        }));
        setPaymentData(newData);
    };

    const handleDownloadExcel = () => {
        if (paymentData.length === 0) {
            alert("출력할 데이터가 없습니다.");
            return;
        }

        if (errorCount > 0) {
            if (!window.confirm(`${errorCount}건의 데이터에 누락된 정보가 있습니다. 그래도 다운로드하시겠습니까?`)) {
                return;
            }
        }

        const excelData = paymentData.map(item => ({
            '항목': item.bankCode,
            '은행명': item.bankName,
            '계좌번호': item.accountNumber,
            '예금주': item.accountHolder,
            '입금액': item.totalAmount,
            '표시내용': item.displayContent,
            '기간': `${item.startDate} ~ ${item.endDate}`,
            '총공수': item.totalManDay
        }));

        const ws = XLSX.utils.json_to_sheet(excelData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "주급제지급");

        const fileName = `주급제지급_${weekRange.start}_${weekRange.end}.xlsx`;
        XLSX.writeFile(wb, fileName);
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                {!hideHeader && <h1 className="text-2xl font-bold text-slate-800">주급제 지급 관리</h1>}
                <div className="flex gap-3 items-center">
                    <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-lg px-3 py-2">
                        <FontAwesomeIcon icon={faCalendarAlt} className="text-slate-400" />
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="text-sm outline-none"
                        />
                        <span className="text-xs text-slate-500 border-l pl-2 ml-2">
                            {weekRange.start} ~ {weekRange.end}
                        </span>
                    </div>
                    <button
                        onClick={fetchData}
                        className="bg-slate-100 text-slate-600 hover:bg-slate-200 px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2"
                    >
                        <FontAwesomeIcon icon={faSearch} />
                        <span>조회</span>
                    </button>
                    <button
                        onClick={handleDownloadExcel}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 shadow-sm ${errorCount > 0 ? 'bg-orange-500 hover:bg-orange-600 text-white' : 'bg-green-600 hover:bg-green-700 text-white'}`}
                    >
                        <FontAwesomeIcon icon={faFileExcel} />
                        <span>엑셀 다운로드</span>
                    </button>
                </div>
            </div>

            {errorCount > 0 && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2 text-sm">
                    <FontAwesomeIcon icon={faExclamationTriangle} className="text-red-500" />
                    <span><strong>{errorCount}건</strong>의 데이터에 은행명, 계좌번호 또는 예금주 정보가 누락되었습니다. 확인 후 작업자 DB를 수정해주세요.</span>
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <h2 className="font-semibold text-slate-700">지급 대상자 목록 (주급제)</h2>
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={bulkDisplayContent}
                                onChange={(e) => setBulkDisplayContent(e.target.value)}
                                placeholder="표시내용 일괄입력"
                                className="border border-slate-300 rounded px-2 py-1 text-xs w-32"
                            />
                            <button
                                onClick={handleBulkDisplayContentApply}
                                className="bg-slate-600 text-white px-2 py-1 rounded text-xs hover:bg-slate-700"
                            >
                                일괄적용
                            </button>
                        </div>
                    </div>
                    <div className="text-sm">
                        <span className="text-slate-500 mr-2">총 지급액:</span>
                        <span className="font-bold text-brand-600 text-lg">{totalAmount.toLocaleString()}원</span>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-3">이름</th>
                                <th className="px-4 py-3">팀명</th>
                                <th className="px-4 py-3">총 공수</th>
                                <th className="px-4 py-3 text-right">단가</th>
                                <th className="px-4 py-3 text-right">지급액</th>
                                <th className="px-4 py-3">항목</th>
                                <th className="px-4 py-3">은행명</th>
                                <th className="px-4 py-3">계좌번호</th>
                                <th className="px-4 py-3">예금주</th>
                                <th className="px-4 py-3">표시내용</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={10} className="px-4 py-12 text-center text-slate-500">
                                        <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />
                                        데이터를 불러오는 중입니다...
                                    </td>
                                </tr>
                            ) : paymentData.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="px-4 py-12 text-center text-slate-500">
                                        해당 기간에 지급 대상자가 없습니다.
                                    </td>
                                </tr>
                            ) : (
                                paymentData.map((item, index) => (
                                    <tr key={`${item.workerId}-${index}`} className={`hover:bg-slate-50 transition ${!item.isValid ? 'bg-red-50' : ''}`}>
                                        <td className="px-4 py-3 font-medium text-slate-800">{item.workerName}</td>
                                        <td className="px-4 py-3 text-slate-600">{item.teamName}</td>
                                        <td className="px-4 py-3 text-slate-600">{item.totalManDay}</td>
                                        <td className="px-4 py-3 text-right text-slate-600">{item.unitPrice.toLocaleString()}</td>
                                        <td className="px-4 py-3 text-right font-bold text-brand-600">{item.totalAmount.toLocaleString()}</td>
                                        <td className={`px-4 py-3 text-slate-600 ${item.errors.bankCode ? 'text-red-600 font-bold' : ''}`}>{item.bankCode}</td>
                                        <td className={`px-4 py-3 text-slate-600 ${item.errors.bankName ? 'text-red-600 font-bold' : ''}`}>{item.bankName || '(미입력)'}</td>
                                        <td className={`px-4 py-3 text-slate-600 ${item.errors.accountNumber ? 'text-red-600 font-bold' : ''}`}>{item.accountNumber || '(미입력)'}</td>
                                        <td className={`px-4 py-3 text-slate-600 ${item.errors.accountHolder ? 'text-red-600 font-bold' : ''}`}>{item.accountHolder || '(미입력)'}</td>
                                        <td className="px-4 py-3">
                                            <input
                                                type="text"
                                                value={item.displayContent}
                                                onChange={(e) => handleDisplayContentChange(index, e.target.value)}
                                                className="border border-slate-300 rounded px-2 py-1 text-xs w-full focus:border-brand-500 outline-none"
                                            />
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default WeeklyWagePaymentPage;
