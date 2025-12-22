import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { dailyReportService } from '../../services/dailyReportService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { teamService, Team } from '../../services/teamService';
import * as XLSX from 'xlsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileExcel, faSearch, faSpinner, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';

interface PaymentData {
    rowKey: string;
    workerId: string;
    workerName: string;
    teamId: string;
    teamName: string;
    date: string;
    manDay: number;
    unitPrice: number;
    totalAmount: number;
    actualPayment: number; // 실지급
    billingAmount: number; // 청구액
    reportAmount: number; // 신고액
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

const DailyWagePaymentPage: React.FC<Props> = ({ hideHeader }) => {
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [paymentData, setPaymentData] = useState<PaymentData[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [totalAmount, setTotalAmount] = useState<number>(0); // 총 청구금액 (공수×단가 합산)
    const [bulkDisplayContent, setBulkDisplayContent] = useState<string>('급여');
    const [errorCount, setErrorCount] = useState<number>(0);
    const [bulkActualPayment, setBulkActualPayment] = useState<number>(150000);
    const [bulkBillingAmount, setBulkBillingAmount] = useState<number>(165000);
    const [bulkReportAmount, setBulkReportAmount] = useState<number>(170000);
    const [bulkTargetReportAmount, setBulkTargetReportAmount] = useState<number>(0); // 청구용 기준 (신고금액)
    const [bulkPaymentTotalAmount, setBulkPaymentTotalAmount] = useState<number>(150000); // 지급용 입금액
    const [bulkUnitPrice, setBulkUnitPrice] = useState<number>(150000); // 지급용 단가
    const [bulkTargetUnitPrice, setBulkTargetUnitPrice] = useState<number>(0); // 조건: 이 단가와 같은 항목만 변경 (0=변경안함)
    const [originalPaymentData, setOriginalPaymentData] = useState<PaymentData[]>([]); // 초기화용 원본 데이터
    const [viewTab, setViewTab] = useState<'payment' | 'billing'>('payment'); // 지급용 vs 청구용
    const [teams, setTeams] = useState<Team[]>([]);
    const [allTeams, setAllTeams] = useState<Team[]>([]);
    const [selectedTeamId, setSelectedTeamId] = useState<string>('');
    const [filtersReady, setFiltersReady] = useState<boolean>(false);

    const filteredPaymentData = useMemo(() => {
        const normalizeTeamName = (value: string): string => {
            return value
                .replace(/\(.*?\)/g, '')
                .replace(/\s+/g, '')
                .trim();
        };

        if (!selectedTeamId) return paymentData;

        const selectedTeamName = allTeams.find(t => t.id === selectedTeamId)?.name ?? '';
        const selectedTeamNameNormalized = normalizeTeamName(selectedTeamName);

        const allowedTeamIds = new Set<string>();
        allowedTeamIds.add(selectedTeamId);

        allTeams.forEach(team => {
            if (!team.id) return;
            if (team.parentTeamId === selectedTeamId) {
                allowedTeamIds.add(team.id);
                return;
            }
            if (selectedTeamNameNormalized) {
                const parentNameNormalized = normalizeTeamName(team.parentTeamName ?? '');
                if (parentNameNormalized && parentNameNormalized === selectedTeamNameNormalized) {
                    allowedTeamIds.add(team.id);
                }
            }
        });

        const allowedTeamNameNormalized = new Set<string>();
        allTeams.forEach(team => {
            if (!team.id) return;
            if (!allowedTeamIds.has(team.id)) return;
            const normalized = normalizeTeamName(team.name ?? '');
            if (normalized) allowedTeamNameNormalized.add(normalized);
        });

        return paymentData.filter(item => {
            if (allowedTeamIds.has(item.teamId)) return true;
            const normalized = normalizeTeamName(item.teamName);
            return normalized ? allowedTeamNameNormalized.has(normalized) : false;
        });
    }, [paymentData, selectedTeamId, allTeams]);

    useEffect(() => {
        const loadTeams = async () => {
            try {
                const allTeams = await teamService.getTeams();
                setAllTeams(allTeams);
                const filtered = allTeams
                    .filter(t => !!t.id)
                    .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
                setTeams(filtered);
            } catch (error) {
                console.error('Failed to load teams:', error);
                alert('팀 목록을 불러오는 중 오류가 발생했습니다.');
            } finally {
                setFiltersReady(true);
            }
        };

        void loadTeams();
        setSelectedTeamId('');
    }, []);

    const validateItem = useCallback((item: Partial<PaymentData>): { isValid: boolean, errors: PaymentData['errors'] } => {
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
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const reports = await dailyReportService.getReports(selectedDate);

            const allWorkers = await manpowerService.getWorkers();
            const workerMap = new Map(allWorkers.map(w => [w.id!, w]));

            const teamMap = new Map<string, Team>();
            allTeams.forEach(t => {
                if (t.id) teamMap.set(t.id, t);
            });

            const normalizeTeamName = (value: string): string => {
                return value
                    .replace(/\(.*?\)/g, '')
                    .replace(/\s+/g, '')
                    .trim();
            };

            const processedData: PaymentData[] = [];
            let sumAmount = 0;
            let errCount = 0;

            reports.forEach(report => {
                const resolvedReportTeamIdFromName = (() => {
                    const normalized = normalizeTeamName(report.teamName ?? '');
                    if (!normalized) return '';
                    const matched = allTeams.find(t => normalizeTeamName(t.name ?? '') === normalized);
                    return matched?.id ?? '';
                })();

                const reportTeamId = report.teamId || resolvedReportTeamIdFromName;
                const reportTeamName = report.teamName || teamMap.get(reportTeamId)?.name || '';

                report.workers.forEach(reportWorker => {
                    const workerDetails = workerMap.get(reportWorker.workerId);

                    if (!workerDetails) return;

                    const snapshotSalaryModel =
                        typeof reportWorker.salaryModel === 'string' && reportWorker.salaryModel.trim().length > 0
                            ? reportWorker.salaryModel
                            : typeof reportWorker.payType === 'string' && reportWorker.payType.trim().length > 0
                                ? reportWorker.payType
                                : workerDetails.salaryModel;

                    if (snapshotSalaryModel && snapshotSalaryModel !== '일급제') return;

                        const unitPrice = reportWorker.unitPrice ?? workerDetails.unitPrice ?? 0;
                        const amount = reportWorker.manDay * unitPrice;
                        const bankName = workerDetails.bankName || '';
                        const bankCode = BANK_CODES[bankName] || '';
                        const accountNumber = workerDetails.accountNumber || '';
                        const accountHolder = workerDetails.accountHolder || '';

                        const validation = validateItem({ bankName, bankCode, accountNumber, accountHolder });
                        if (!validation.isValid) errCount++;

                        const resolvedTeamId = reportTeamId || reportWorker.teamId || '';
                        const resolvedTeamName = reportTeamName;
                        const safeTeamKey = resolvedTeamId || (normalizeTeamName(resolvedTeamName) ? `unresolved:${normalizeTeamName(resolvedTeamName)}` : 'no-team');
                        const reportKey = report.id ?? `${report.date}__${report.siteId}__${safeTeamKey}`;
                        const rowKey = `${reportKey}__${reportWorker.workerId}`;

                        processedData.push({
                            rowKey,
                            workerId: reportWorker.workerId,
                            workerName: reportWorker.name,
                            teamId: safeTeamKey,
                            teamName: resolvedTeamName,
                            date: report.date,
                            manDay: reportWorker.manDay,
                            unitPrice: unitPrice,
                            totalAmount: amount,
                            actualPayment: 150000, // 기본 실지급
                            billingAmount: 165000, // 기본 청구액
                            reportAmount: unitPrice, // 신고액 = 단가
                            bankName: bankName,
                            bankCode: bankCode,
                            accountNumber: accountNumber,
                            accountHolder: accountHolder,
                            displayContent: '급여',
                            isValid: validation.isValid,
                            errors: validation.errors
                        });
                        sumAmount += amount;
                });
            });

            setPaymentData(processedData);
            setOriginalPaymentData(processedData.map(item => ({ ...item }))); // 원본 저장
            setTotalAmount(sumAmount);
            setErrorCount(errCount);

        } catch (error) {
            console.error("Error fetching payment data:", error);
            alert("데이터를 불러오는 중 오류가 발생했습니다.");
        } finally {
            setLoading(false);
        }
    }, [allTeams, selectedDate, validateItem]);

    useEffect(() => {
        if (!filtersReady) return;
        void fetchData();
    }, [fetchData, filtersReady]);

    const handleDisplayContentChange = (rowKey: string, value: string) => {
        setPaymentData(prev => prev.map(item => (item.rowKey === rowKey ? { ...item, displayContent: value } : item)));
    };

    const handleBulkDisplayContentApply = () => {
        const visibleKeys = new Set(filteredPaymentData.map(item => item.rowKey));
        setPaymentData(prev => prev.map(item => {
            if (!visibleKeys.has(item.rowKey)) return item;
            return { ...item, displayContent: bulkDisplayContent };
        }));
    };

    const handleBulkAmountApply = () => {
        const visibleKeys = new Set(filteredPaymentData.map(item => item.rowKey));
        setPaymentData(prev => prev.map(item => {
            if (!visibleKeys.has(item.rowKey)) return item;
            return {
                ...item,
                actualPayment: bulkActualPayment,
                billingAmount: bulkBillingAmount,
                reportAmount: bulkReportAmount
            };
        }));
    };

    const handleActualPaymentChange = (rowKey: string, value: number) => {
        setPaymentData(prev => prev.map(item => (item.rowKey === rowKey ? { ...item, actualPayment: value } : item)));
    };

    const handleBillingAmountChange = (rowKey: string, value: number) => {
        setPaymentData(prev => prev.map(item => (item.rowKey === rowKey ? { ...item, billingAmount: value } : item)));
    };

    const handleReportAmountChange = (rowKey: string, value: number) => {
        setPaymentData(prev => prev.map(item => (item.rowKey === rowKey ? { ...item, reportAmount: value } : item)));
    };

    const handleUnitPriceChange = (rowKey: string, value: number) => {
        setPaymentData(prev => prev.map(item => {
            if (item.rowKey !== rowKey) return item;
            return { ...item, unitPrice: value, totalAmount: value * item.manDay };
        }));
    };

    const handleDownloadExcel = () => {
        if (filteredPaymentData.length === 0) {
            alert("출력할 데이터가 없습니다.");
            return;
        }

        const filteredErrorCount = viewTab === 'payment'
            ? filteredPaymentData.filter(item => !item.isValid).length
            : 0;

        if (filteredErrorCount > 0 && viewTab === 'payment') {
            if (!window.confirm(`${filteredErrorCount}건의 데이터에 누락된 정보가 있습니다. 그래도 다운로드하시겠습니까?`)) {
                return;
            }
        }

        let excelData: Record<string, string | number>[];
        let sheetName: string;
        let colWidths: { wch: number }[];

        const exportRows = filteredPaymentData;

        if (viewTab === 'payment') {
            // 지급용 엑셀 데이터
            excelData = exportRows.map((item, idx) => ({
                '순번': idx + 1,
                '이름': item.workerName,
                '팀명': item.teamName,
                '공수': item.manDay,
                '단가': item.unitPrice,
                '입금액': item.totalAmount,
                '은행코드': item.bankCode,
                '은행명': item.bankName,
                '계좌번호': item.accountNumber,
                '예금주': item.accountHolder,
                '표시내용': item.displayContent,
            }));

            // 합계 행 추가
            excelData.push({
                '순번': '',
                '이름': '합계',
                '팀명': '',
                '공수': exportRows.reduce((sum, item) => sum + item.manDay, 0),
                '단가': '',
                '입금액': exportRows.reduce((sum, item) => sum + item.totalAmount, 0),
                '은행코드': '',
                '은행명': '',
                '계좌번호': '',
                '예금주': '',
                '표시내용': '',
            });

            sheetName = "일급제_지급용";
            colWidths = [
                { wch: 5 },   // 순번
                { wch: 10 },  // 이름
                { wch: 12 },  // 팀명
                { wch: 6 },   // 공수
                { wch: 10 },  // 단가
                { wch: 12 },  // 입금액
                { wch: 6 },   // 은행코드
                { wch: 12 },  // 은행명
                { wch: 18 },  // 계좌번호
                { wch: 10 },  // 예금주
                { wch: 10 },  // 표시내용
            ];
        } else {
            // 청구용 엑셀 데이터
            excelData = exportRows.map((item, idx) => ({
                '순번': idx + 1,
                '이름': item.workerName,
                '팀명': item.teamName,
                '공수': item.manDay,
                '실지급': item.actualPayment,
                '청구액': item.billingAmount,
                '신고액': item.reportAmount,
                '실지급합계': item.actualPayment * item.manDay,
                '청구액합계': item.billingAmount * item.manDay,
                '신고액합계': item.reportAmount * item.manDay,
            }));

            // 합계 행 추가
            excelData.push({
                '순번': '',
                '이름': '합계',
                '팀명': '',
                '공수': exportRows.reduce((sum, item) => sum + item.manDay, 0),
                '실지급': '',
                '청구액': '',
                '신고액': '',
                '실지급합계': exportRows.reduce((sum, item) => sum + (item.actualPayment * item.manDay), 0),
                '청구액합계': exportRows.reduce((sum, item) => sum + (item.billingAmount * item.manDay), 0),
                '신고액합계': exportRows.reduce((sum, item) => sum + (item.reportAmount * item.manDay), 0),
            });

            sheetName = "일급제_청구용";
            colWidths = [
                { wch: 5 },   // 순번
                { wch: 10 },  // 이름
                { wch: 12 },  // 팀명
                { wch: 6 },   // 공수
                { wch: 10 },  // 실지급
                { wch: 10 },  // 청구액
                { wch: 10 },  // 신고액
                { wch: 12 },  // 실지급합계
                { wch: 12 },  // 청구액합계
                { wch: 12 },  // 신고액합계
            ];
        }

        const ws = XLSX.utils.json_to_sheet(excelData);
        ws['!cols'] = colWidths;

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, sheetName);

        const tabSuffix = viewTab === 'payment' ? '지급용' : '청구용';
        const fileName = `일급제_${tabSuffix}_${selectedDate}.xlsx`;
        XLSX.writeFile(wb, fileName);
    };

    return (
        <div className="p-6 max-w-[1600px] w-full mx-auto">
            <div className="flex justify-between items-center mb-4">
                {!hideHeader && <h1 className="text-2xl font-bold text-slate-800">일급제 지급 관리</h1>}
                <div className="flex gap-3">
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                    />
                    <select
                        value={selectedTeamId}
                        onChange={(e) => setSelectedTeamId(e.target.value)}
                        className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                    >
                        <option value="">모든 팀</option>
                        {teams.filter(t => !!t.id).map(team => (
                            <option key={team.id} value={team.id}>{team.name}</option>
                        ))}
                    </select>
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

            {/* Tabs */}
            <div className="flex gap-2 mb-4">
                <button
                    onClick={() => setViewTab('payment')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${viewTab === 'payment'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                >
                    💳 지급용 (계좌정보 포함)
                </button>
                <button
                    onClick={() => setViewTab('billing')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${viewTab === 'billing'
                        ? 'bg-orange-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                >
                    📋 청구용 (공수/금액만)
                </button>
            </div>

            {errorCount > 0 && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2 text-sm">
                    <FontAwesomeIcon icon={faExclamationTriangle} className="text-red-500" />
                    <span><strong>{errorCount}건</strong>의 데이터에 은행명, 계좌번호 또는 예금주 정보가 누락되었습니다. 확인 후 작업자 DB를 수정해주세요.</span>
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {/* 상단 헤더 */}
                <div className="p-4 border-b border-slate-100 bg-slate-50">
                    {/* 1행: 타이틀 + 총 공수 */}
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="font-semibold text-slate-700 text-lg">지급 대상자 목록</h2>
                        <div className="flex items-center gap-2 text-sm">
                            <span className="text-slate-500 font-medium">총 공수:</span>
                            <span className="font-bold text-slate-800 text-lg">
                                {filteredPaymentData.reduce((sum, item) => sum + item.manDay, 0).toFixed(1)}
                            </span>

                            {viewTab === 'payment' && (
                                <>
                                    <span className="w-px h-4 bg-slate-300 mx-3"></span>
                                    <span className="text-brand-600 font-medium">입금액:</span>
                                    <span className="font-bold text-brand-700 text-lg">
                                        {filteredPaymentData.reduce((sum, item) => sum + item.totalAmount, 0).toLocaleString()}원
                                    </span>
                                </>
                            )}

                            {viewTab === 'billing' && (
                                <>
                                    <span className="w-px h-4 bg-slate-300 mx-3"></span>
                                    <span className="text-green-600 font-medium">실급:</span>
                                    <span className="font-bold text-green-700 text-lg mr-2">
                                        {filteredPaymentData.reduce((sum, item) => sum + (item.actualPayment * item.manDay), 0).toLocaleString()}
                                    </span>

                                    <span className="w-px h-4 bg-slate-300 mx-3"></span>
                                    <span className="text-orange-600 font-medium">청구:</span>
                                    <span className="font-bold text-orange-700 text-lg mr-2">
                                        {filteredPaymentData.reduce((sum, item) => sum + (item.billingAmount * item.manDay), 0).toLocaleString()}
                                    </span>

                                    <span className="w-px h-4 bg-slate-300 mx-3"></span>
                                    <span className="text-blue-600 font-medium">신고:</span>
                                    <span className="font-bold text-blue-700 text-lg">
                                        {filteredPaymentData.reduce((sum, item) => sum + (item.reportAmount * item.manDay), 0).toLocaleString()}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>

                    {/* 2행: 지급용일 때 - 단가/입금액/표시내용 일괄입력 + 총액 */}
                    {viewTab === 'payment' && (
                        <div className="flex items-center justify-start gap-4 pt-3 border-t border-slate-200 overflow-x-auto flex-nowrap">
                            {/* 일괄입력 */}
                            <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm flex-shrink-0">
                                <span className="text-xs text-slate-500 font-medium">일괄:</span>
                                <div className="flex items-center gap-1">
                                    <span className="text-xs text-orange-600 font-bold">기준</span>
                                    <input
                                        type="number"
                                        value={bulkTargetUnitPrice}
                                        onChange={(e) => setBulkTargetUnitPrice(Number(e.target.value))}
                                        placeholder="0=전체"
                                        className="border border-orange-300 rounded px-2 py-1 text-xs w-20 bg-orange-50 text-right"
                                    />
                                </div>
                                <span className="text-xs text-slate-400">→</span>
                                <div className="flex items-center gap-1">
                                    <span className="text-xs text-purple-600 font-bold">단가</span>
                                    <input
                                        type="number"
                                        step={5000}
                                        value={bulkUnitPrice}
                                        onChange={(e) => setBulkUnitPrice(Number(e.target.value))}
                                        className="border border-purple-300 rounded px-2 py-1 text-xs w-24 bg-purple-50 text-right"
                                    />
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className="text-xs text-slate-600 font-bold">표시내용</span>
                                    <input
                                        type="text"
                                        value={bulkDisplayContent}
                                        onChange={(e) => setBulkDisplayContent(e.target.value)}
                                        placeholder="급여"
                                        className="border border-slate-300 rounded px-2 py-1 text-xs w-16 bg-slate-50"
                                    />
                                </div>
                                <button
                                    onClick={() => {
                                        const visibleKeys = new Set(filteredPaymentData.map(item => item.rowKey));
                                        setPaymentData(prev => prev.map(item => {
                                            if (!visibleKeys.has(item.rowKey)) return item;
                                            if (bulkTargetUnitPrice !== 0 && item.unitPrice !== bulkTargetUnitPrice) return item;
                                            return {
                                                ...item,
                                                unitPrice: bulkUnitPrice,
                                                totalAmount: bulkUnitPrice * item.manDay,
                                                displayContent: bulkDisplayContent
                                            };
                                        }));
                                    }}
                                    className="bg-purple-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-purple-700"
                                >
                                    적용
                                </button>
                                <button
                                    onClick={() => {
                                        if (originalPaymentData.length > 0) {
                                            setPaymentData([...originalPaymentData]);
                                        } else {
                                            fetchData();
                                        }
                                    }}
                                    className="bg-slate-500 text-white px-3 py-1 rounded text-xs font-bold hover:bg-slate-600"
                                >
                                    초기화
                                </button>
                            </div>
                        </div>
                    )}

                    {/* 3행: 청구용일 때 - 일괄입력 + 총액 카드들 */}
                    {viewTab === 'billing' && (
                        <div className="flex items-center gap-4 pt-3 border-t border-slate-200 overflow-x-auto flex-nowrap">
                            {/* 일괄입력 */}
                            <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm flex-shrink-0">
                                <span className="text-xs text-slate-500 font-medium">일괄:</span>
                                <div className="flex items-center gap-1">
                                    <span className="text-xs text-blue-600 font-bold">기준신고</span>
                                    <input
                                        type="number"
                                        value={bulkTargetReportAmount}
                                        onChange={(e) => setBulkTargetReportAmount(Number(e.target.value))}
                                        placeholder="0=안함"
                                        className="border border-blue-300 rounded px-2 py-1 text-xs w-20 bg-blue-50 text-right"
                                    />
                                </div>
                                <span className="text-xs text-slate-400">→</span>
                                <div className="flex items-center gap-1">
                                    <span className="text-xs text-green-600 font-bold">실급</span>
                                    <input
                                        type="number"
                                        step={5000}
                                        value={bulkActualPayment}
                                        onChange={(e) => setBulkActualPayment(Number(e.target.value))}
                                        className="border border-green-300 rounded px-2 py-1 text-xs w-20 bg-green-50 text-right"
                                    />
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className="text-xs text-orange-600 font-bold">청구</span>
                                    <input
                                        type="number"
                                        step={5000}
                                        value={bulkBillingAmount}
                                        onChange={(e) => setBulkBillingAmount(Number(e.target.value))}
                                        className="border border-orange-300 rounded px-2 py-1 text-xs w-20 bg-orange-50 text-right"
                                    />
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className="text-xs text-blue-600 font-bold">신고</span>
                                    <input
                                        type="number"
                                        step={5000}
                                        value={bulkReportAmount}
                                        onChange={(e) => setBulkReportAmount(Number(e.target.value))}
                                        className="border border-blue-300 rounded px-2 py-1 text-xs w-20 bg-blue-50 text-right"
                                    />
                                </div>
                                <button
                                    onClick={() => {
                                        if (bulkTargetReportAmount === 0) {
                                            alert('기준 신고금액을 입력해주세요. (0은 변경 안함)');
                                            return;
                                        }
                                        const visibleKeys = new Set(filteredPaymentData.map(item => item.rowKey));
                                        setPaymentData(prev => prev.map(item => {
                                            if (!visibleKeys.has(item.rowKey)) return item;
                                            if (item.reportAmount !== bulkTargetReportAmount) return item;
                                            return {
                                                ...item,
                                                actualPayment: bulkActualPayment,
                                                billingAmount: bulkBillingAmount,
                                                reportAmount: bulkReportAmount
                                            };
                                        }));
                                    }}
                                    className="bg-purple-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-purple-700"
                                >
                                    적용
                                </button>
                                <button
                                    onClick={() => {
                                        if (originalPaymentData.length > 0) {
                                            setPaymentData([...originalPaymentData]);
                                        } else {
                                            fetchData();
                                        }
                                    }}
                                    className="bg-slate-500 text-white px-3 py-1 rounded text-xs font-bold hover:bg-slate-600"
                                >
                                    초기화
                                </button>
                            </div>

                        </div>
                    )}
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-3">이름</th>
                                <th className="px-4 py-3">팀명</th>
                                <th className="px-4 py-3">공수</th>
                                {viewTab === 'billing' && (
                                    <th className="px-4 py-3 text-right bg-green-50">실지급</th>
                                )}
                                {viewTab === 'billing' && (
                                    <th className="px-4 py-3 text-right bg-orange-50">청구액</th>
                                )}
                                {viewTab === 'billing' && (
                                    <th className="px-4 py-3 text-right bg-blue-50">신고액</th>
                                )}
                                {viewTab === 'payment' && (
                                    <th className="px-4 py-3 text-right">단가</th>
                                )}
                                <th className="px-4 py-3 text-right">총액</th>
                                {viewTab === 'payment' && (
                                    <>
                                        <th className="px-4 py-3">은행명</th>
                                        <th className="px-4 py-3">계좌번호</th>
                                        <th className="px-4 py-3">예금주</th>
                                        <th className="px-4 py-3">표시내용</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={viewTab === 'payment' ? 9 : 7} className="px-4 py-12 text-center text-slate-500">
                                        <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />
                                        데이터를 불러오는 중입니다...
                                    </td>
                                </tr>
                            ) : filteredPaymentData.length === 0 ? (
                                <tr>
                                    <td colSpan={viewTab === 'payment' ? 9 : 7} className="px-4 py-12 text-center text-slate-500">
                                        해당 날짜에 지급 대상자가 없습니다.
                                    </td>
                                </tr>
                            ) : (
                                <>
                                    {filteredPaymentData.map((item) => (
                                        <tr key={item.rowKey} className={`hover:bg-slate-50 transition ${!item.isValid ? 'bg-red-50' : ''}`}>
                                            <td className="px-4 py-3 font-medium text-slate-800">{item.workerName}</td>
                                            <td className="px-4 py-3 text-slate-600">{item.teamName}</td>
                                            <td className="px-4 py-3 text-slate-600">{item.manDay}</td>
                                            {viewTab === 'billing' && (
                                                <td className="px-4 py-3 bg-green-50 text-right">
                                                    <input
                                                        type="number"
                                                        value={item.actualPayment}
                                                        onChange={(e) => handleActualPaymentChange(item.rowKey, Number(e.target.value))}
                                                        className="border border-green-300 rounded px-2 py-1 text-xs w-24 text-right focus:border-green-500 outline-none"
                                                    />
                                                </td>
                                            )}
                                            {viewTab === 'billing' && (
                                                <td className="px-4 py-3 bg-orange-50 text-right">
                                                    <input
                                                        type="number"
                                                        value={item.billingAmount}
                                                        onChange={(e) => handleBillingAmountChange(item.rowKey, Number(e.target.value))}
                                                        className="border border-orange-300 rounded px-2 py-1 text-xs w-24 text-right focus:border-orange-500 outline-none"
                                                    />
                                                </td>
                                            )}
                                            {viewTab === 'billing' && (
                                                <td className="px-4 py-3 bg-blue-50 text-right">
                                                    <input
                                                        type="number"
                                                        value={item.reportAmount}
                                                        onChange={(e) => handleReportAmountChange(item.rowKey, Number(e.target.value))}
                                                        className="border border-blue-300 rounded px-2 py-1 text-xs w-24 text-right focus:border-blue-500 outline-none"
                                                    />
                                                </td>
                                            )}
                                            {viewTab === 'payment' && (
                                                <td className="px-4 py-3 text-right bg-purple-50">
                                                    <input
                                                        type="number"
                                                        value={item.unitPrice}
                                                        onChange={(e) => handleUnitPriceChange(item.rowKey, Number(e.target.value))}
                                                        className="border border-purple-300 rounded px-2 py-1 text-xs w-24 text-right focus:border-purple-500 outline-none"
                                                    />
                                                </td>
                                            )}
                                            <td className="px-4 py-3 text-right font-bold text-brand-600">{item.totalAmount.toLocaleString()}</td>
                                            {viewTab === 'payment' && (
                                                <>
                                                    <td className={`px-4 py-3 text-slate-600 ${item.errors.bankName ? 'text-red-600 font-bold' : ''}`}>{item.bankName || '(미입력)'}</td>
                                                    <td className={`px-4 py-3 text-slate-600 ${item.errors.accountNumber ? 'text-red-600 font-bold' : ''}`}>{item.accountNumber || '(미입력)'}</td>
                                                    <td className={`px-4 py-3 text-slate-600 ${item.errors.accountHolder ? 'text-red-600 font-bold' : ''}`}>{item.accountHolder || '(미입력)'}</td>
                                                    <td className="px-4 py-3">
                                                        <input
                                                            type="text"
                                                            value={item.displayContent}
                                                            onChange={(e) => handleDisplayContentChange(item.rowKey, e.target.value)}
                                                            className="border border-slate-300 rounded px-2 py-1 text-xs w-full focus:border-brand-500 outline-none"
                                                        />
                                                    </td>
                                                </>
                                            )}
                                        </tr>
                                    ))}
                                </>
                            )}
                        </tbody>
                    </table>
                </div>
            </div >
        </div >
    );
};

export default DailyWagePaymentPage;
