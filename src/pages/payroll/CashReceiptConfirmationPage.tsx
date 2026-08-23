import React, { useEffect, useMemo, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faBuilding,
    faCalendarAlt,
    faChevronLeft,
    faChevronRight,
    faCopy,
    faFileInvoiceDollar,
    faPrint,
    faSignature,
    faSpinner,
    faUser,
} from '@fortawesome/free-solid-svg-icons';
import SingleSelectPopover from '../../components/common/SingleSelectPopover';
import { YearMonthPicker } from '../../components/common/YearMonthPicker';
import { companyService, Company } from '../../services/companyService';
import { dailyReportService, DailyReport } from '../../services/dailyReportService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { siteService, Site } from '../../services/siteService';
import { storageService } from '../../services/storageService';

interface ReceiptWorkerSummary {
    worker: Worker;
    firstWorkDate: string;
    lastWorkDate: string;
    manDays: number;
    grossAmount: number;
}

const pad2 = (value: number): string => String(value).padStart(2, '0');

const toLocalDateText = (date: Date): string =>
    `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const shiftYearMonth = (yearMonth: string, offset: number): string => {
    const matched = String(yearMonth ?? '').match(/^(\d{4})-(\d{2})$/);
    const date = matched
        ? new Date(Number(matched[1]), Number(matched[2]) - 1 + offset, 1)
        : new Date();
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
};

const formatKoreanDate = (dateText: string): string => {
    const [year, month, day] = String(dateText ?? '').split('-').map(Number);
    if (!year || !month || !day) return '';
    return `${year}년 ${month}월 ${day}일`;
};

const formatDottedDate = (dateText: string): string => {
    const [year, month, day] = String(dateText ?? '').split('-').map(Number);
    if (!year || !month || !day) return '';
    return `${year}.  ${month}.  ${day}.`;
};

const formatAmount = (amount: number): string =>
    Math.max(0, Math.round(Number(amount) || 0)).toLocaleString('ko-KR');

const CashReceiptConfirmationPage: React.FC = () => {
    const today = useMemo(() => new Date(), []);
    const [selectedMonth, setSelectedMonth] = useState(() => `${today.getFullYear()}-${pad2(today.getMonth() + 1)}`);
    const [selectedSiteId, setSelectedSiteId] = useState('');
    const [selectedWorkerId, setSelectedWorkerId] = useState('');
    const [selectedPayerCompanyId, setSelectedPayerCompanyId] = useState('');
    const [selectedPayerSignerId, setSelectedPayerSignerId] = useState('');
    const [issueDate, setIssueDate] = useState(() => toLocalDateText(today));
    const [workStartDate, setWorkStartDate] = useState('');
    const [workEndDate, setWorkEndDate] = useState('');
    const [receiptAmount, setReceiptAmount] = useState(0);

    const [sites, setSites] = useState<Site[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [reports, setReports] = useState<DailyReport[]>([]);
    const [companySealUrl, setCompanySealUrl] = useState('');
    const [loadingStatic, setLoadingStatic] = useState(true);
    const [loadingReports, setLoadingReports] = useState(false);
    const [copying, setCopying] = useState(false);

    const printRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let alive = true;
        const loadStaticData = async () => {
            setLoadingStatic(true);
            try {
                const [siteRows, workerRows, companyRows] = await Promise.all([
                    siteService.getSites(),
                    manpowerService.getWorkers(),
                    companyService.getCompanies(),
                ]);
                if (!alive) return;
                setSites(siteRows);
                setWorkers(workerRows);
                setCompanies(companyRows);

                const defaultCompany = companyRows.find((company) => company.isMyCompany)
                    ?? companyRows.find((company) => String(company.name ?? '').includes('청연'))
                    ?? companyRows[0];
                if (defaultCompany?.id) setSelectedPayerCompanyId(defaultCompany.id);
            } catch (error) {
                console.error('현금수령 확인서 기본 데이터 조회 실패:', error);
            } finally {
                if (alive) setLoadingStatic(false);
            }
        };

        void loadStaticData();
        return () => {
            alive = false;
        };
    }, []);

    useEffect(() => {
        const unsubscribe = manpowerService.subscribeWorkers((workerRows) => {
            setWorkers(workerRows);
        });
        return unsubscribe;
    }, []);

    useEffect(() => {
        let alive = true;
        const loadReports = async () => {
            setLoadingReports(true);
            try {
                const [yearText, monthText] = selectedMonth.split('-');
                const lastDay = new Date(Number(yearText), Number(monthText), 0).getDate();
                const monthReports = await dailyReportService.getReportsByRange(
                    `${selectedMonth}-01`,
                    `${selectedMonth}-${pad2(lastDay)}`
                );
                if (!alive) return;
                setReports(monthReports);
                setSelectedSiteId('');
                setSelectedWorkerId('');
            } catch (error) {
                console.error('현금수령 확인서 일보 조회 실패:', error);
                if (alive) setReports([]);
            } finally {
                if (alive) setLoadingReports(false);
            }
        };

        void loadReports();
        return () => {
            alive = false;
        };
    }, [selectedMonth]);

    const activeSites = useMemo(() => {
        const reportSiteIds = new Set(reports.map((report) => String(report.siteId ?? '').trim()).filter(Boolean));
        return sites
            .filter((site) => site.id && reportSiteIds.has(site.id))
            .sort((left, right) => String(left.name ?? '').localeCompare(String(right.name ?? ''), 'ko-KR', { numeric: true }));
    }, [reports, sites]);

    const receiptWorkers = useMemo<ReceiptWorkerSummary[]>(() => {
        if (!selectedSiteId) return [];

        const masterById = new Map<string, Worker>();
        const masterByName = new Map<string, Worker>();
        workers.forEach((worker) => {
            const workerId = String(worker.id ?? '').trim();
            const legacyId = String(worker.legacyId ?? '').trim();
            const workerName = String(worker.name ?? '').replace(/\s+/g, '').trim();
            if (workerId) masterById.set(workerId, worker);
            if (legacyId) masterById.set(legacyId, worker);
            if (workerName && !masterByName.has(workerName)) masterByName.set(workerName, worker);
        });
        const summaryByWorkerId = new Map<string, {
            dates: string[];
            manDays: number;
            grossAmount: number;
        }>();

        reports
            .filter((report) => String(report.siteId ?? '') === selectedSiteId)
            .forEach((report) => {
                report.workers.forEach((reportWorker) => {
                    const workerId = String(reportWorker.workerId ?? '').trim();
                    const manDays = Number(reportWorker.manDay ?? 0);
                    if (!workerId || manDays <= 0) return;

                    const reportWorkerName = String(reportWorker.name ?? '').replace(/\s+/g, '').trim();
                    const master = masterById.get(workerId) || masterByName.get(reportWorkerName);
                    if (!master) return;
                    const unitPrice = Number(reportWorker.unitPrice ?? master.unitPrice ?? 0);
                    const current = summaryByWorkerId.get(workerId) ?? { dates: [], manDays: 0, grossAmount: 0 };
                    current.dates.push(report.date);
                    current.manDays += manDays;
                    current.grossAmount += manDays * unitPrice;
                    summaryByWorkerId.set(workerId, current);
                });
            });

        return Array.from(summaryByWorkerId.entries())
            .map(([workerId, summary]) => {
                const worker = masterById.get(workerId)!;
                const dates = [...summary.dates].sort();
                return {
                    worker,
                    firstWorkDate: dates[0] ?? '',
                    lastWorkDate: dates[dates.length - 1] ?? '',
                    manDays: summary.manDays,
                    grossAmount: summary.grossAmount,
                };
            })
            .sort((left, right) => String(left.worker.name ?? '').localeCompare(String(right.worker.name ?? ''), 'ko-KR'));
    }, [reports, selectedSiteId, workers]);

    const selectedSite = useMemo(
        () => sites.find((site) => String(site.id ?? '') === selectedSiteId) ?? null,
        [selectedSiteId, sites]
    );

    const selectedReceiptWorker = useMemo(
        () => receiptWorkers.find((summary) => String(summary.worker.id ?? '') === selectedWorkerId) ?? null,
        [receiptWorkers, selectedWorkerId]
    );

    const selectedPayerCompany = useMemo(
        () => companies.find((company) => String(company.id ?? '') === selectedPayerCompanyId) ?? null,
        [companies, selectedPayerCompanyId]
    );

    const selectedPayerSigner = useMemo(
        () => workers.find((worker) => String(worker.id ?? '') === selectedPayerSignerId) ?? null,
        [selectedPayerSignerId, workers]
    );

    useEffect(() => {
        if (!selectedReceiptWorker) {
            setWorkStartDate('');
            setWorkEndDate('');
            setReceiptAmount(0);
            return;
        }

        setWorkStartDate(selectedReceiptWorker.firstWorkDate);
        setWorkEndDate(selectedReceiptWorker.lastWorkDate);
        setReceiptAmount(Math.round(selectedReceiptWorker.grossAmount));
    }, [selectedReceiptWorker]);

    useEffect(() => {
        if (!selectedPayerCompany) {
            setSelectedPayerSignerId('');
            return;
        }

        const companyId = String(selectedPayerCompany.id ?? '');
        const companyName = String(selectedPayerCompany.name ?? '').replace(/\s+/g, '');
        const ceoName = String(selectedPayerCompany.ceoName ?? '').trim();
        const exactCeo = workers.find((worker) => ceoName && String(worker.name ?? '').trim() === ceoName);
        const companyRepresentative = workers.find((worker) => {
            const sameCompany = String(worker.companyId ?? '') === companyId
                || String(worker.companyName ?? '').replace(/\s+/g, '') === companyName;
            return sameCompany && /대표|사장/.test(String(worker.role ?? ''));
        });
        const nextSigner = exactCeo ?? companyRepresentative;
        setSelectedPayerSignerId(nextSigner?.id ? String(nextSigner.id) : '');
    }, [selectedPayerCompany, workers]);

    useEffect(() => {
        let alive = true;
        const loadSeal = async () => {
            const companyName = String(selectedPayerCompany?.name ?? '');
            const fileName = companyName.includes('청연')
                ? '청연도장.jpg'
                : companyName.includes('다원')
                    ? '다원도장.png'
                    : '';

            if (!fileName) {
                setCompanySealUrl('');
                return;
            }

            try {
                const url = await storageService.getDownloadUrl(fileName);
                if (alive) setCompanySealUrl(url);
            } catch {
                if (!alive) return;
                setCompanySealUrl(companyName.includes('청연') ? '/assets/estimate/cheongyeon-stamp-round.png' : '');
            }
        };

        void loadSeal();
        return () => {
            alive = false;
        };
    }, [selectedPayerCompany?.name]);

    const payerSignatureUrl = String(selectedPayerSigner?.signatureUrl ?? '').trim() || companySealUrl;
    const receiverSignatureUrl = String(selectedReceiptWorker?.worker.signatureUrl ?? '').trim();

    const siteOptions = useMemo(
        () => activeSites.map((site) => ({ id: String(site.id), name: String(site.name ?? '') })),
        [activeSites]
    );
    const workerOptions = useMemo(
        () => receiptWorkers.map((summary) => ({
            id: String(summary.worker.id),
            name: `${summary.worker.name} · ${summary.manDays.toFixed(1)}공수 · ${formatAmount(summary.grossAmount)}원`,
        })),
        [receiptWorkers]
    );
    const companyOptions = useMemo(
        () => companies
            .filter((company) => company.id && company.status !== 'archived')
            .map((company) => ({ id: String(company.id), name: String(company.name ?? '') }))
            .sort((left, right) => left.name.localeCompare(right.name, 'ko-KR')),
        [companies]
    );
    const payerSignerOptions = useMemo(
        () => workers
            .filter((worker) => worker.id && worker.signatureUrl)
            .map((worker) => ({
                id: String(worker.id),
                name: `${worker.name}${worker.companyName ? ` · ${worker.companyName}` : ''}${worker.role ? ` · ${worker.role}` : ''}`,
            }))
            .sort((left, right) => left.name.localeCompare(right.name, 'ko-KR')),
        [workers]
    );

    const canPrint = Boolean(selectedSite && selectedReceiptWorker && receiptAmount > 0);

    const handleCopy = async () => {
        if (!printRef.current || !canPrint) return;
        setCopying(true);
        try {
            const canvas = await html2canvas(printRef.current, {
                scale: 1.5,
                backgroundColor: '#ffffff',
                logging: false,
                useCORS: true,
            } as unknown as Parameters<typeof html2canvas>[1]);
            const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
            if (!blob || typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
                alert('이 브라우저에서는 이미지 복사를 사용할 수 없습니다.');
                return;
            }
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
            alert('현금수령 확인서가 이미지로 복사되었습니다.');
        } catch (error) {
            console.error('현금수령 확인서 이미지 복사 실패:', error);
            alert('이미지 복사 중 오류가 발생했습니다.');
        } finally {
            setCopying(false);
        }
    };

    if (loadingStatic) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
                <div className="text-center">
                    <FontAwesomeIcon icon={faSpinner} spin className="mb-3 text-3xl text-emerald-400" />
                    <p className="font-semibold">확인서 데이터를 불러오는 중입니다.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="cash-receipt-page-root flex min-h-screen flex-col gap-6 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 lg:flex-row lg:p-6">
            <style>{`
                @page { size: A4 portrait; margin: 0; }
                .cash-receipt-preview-container { container-type: inline-size; }
                .cash-receipt-preview-container .cash-receipt-print-root { zoom: 0.52; }
                @container (min-width: 650px) {
                    .cash-receipt-preview-container .cash-receipt-print-root { zoom: 0.78; }
                }
                @container (min-width: 860px) {
                    .cash-receipt-preview-container .cash-receipt-print-root { zoom: 1; }
                }
                @media print {
                    #main-header,
                    #sidebar,
                    #bottom-panel,
                    #submenu-panel {
                        display: none !important;
                    }
                    body * { visibility: hidden !important; }
                    html, body, #root {
                        width: 210mm !important;
                        min-height: auto !important;
                        height: auto !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        overflow: visible !important;
                        background: white !important;
                    }
                    .app {
                        display: block !important;
                        min-height: auto !important;
                        overflow: visible !important;
                    }
                    .app > * { display: none !important; }
                    .app > #main-content { display: block !important; }
                    #main-content {
                        display: block !important;
                        position: static !important;
                        width: 210mm !important;
                        max-width: 210mm !important;
                        min-height: auto !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        overflow: visible !important;
                    }
                    #main-content > * { display: none !important; }
                    #main-content > .cash-receipt-page-root { display: block !important; }
                    .cash-receipt-page-root {
                        width: 210mm !important;
                        min-height: auto !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        background: white !important;
                    }
                    .cash-receipt-page-root > * { display: none !important; }
                    .cash-receipt-page-root > .cash-receipt-preview-container {
                        display: block !important;
                        width: 210mm !important;
                        max-width: 210mm !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        overflow: visible !important;
                        border: 0 !important;
                        border-radius: 0 !important;
                        background: white !important;
                    }
                    .cash-receipt-print-root, .cash-receipt-print-root * { visibility: visible !important; }
                    .cash-receipt-print-root {
                        position: static !important;
                        inset: auto !important;
                        width: 210mm !important;
                        margin: 0 !important;
                        box-shadow: none !important;
                        zoom: 1 !important;
                    }
                    .cash-receipt-document {
                        width: 210mm !important;
                        height: 297mm !important;
                        min-height: 297mm !important;
                        margin: 0 !important;
                        box-shadow: none !important;
                        background: white !important;
                        color: black !important;
                        break-before: auto;
                        break-after: auto;
                        break-inside: avoid-page;
                        page-break-before: auto;
                        page-break-after: auto;
                        page-break-inside: avoid;
                    }
                    .no-print { display: none !important; }
                }
            `}</style>

            <aside className="no-print flex w-full shrink-0 flex-col gap-4 lg:w-[420px]">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur-xl">
                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-xl text-white shadow-lg">
                            <FontAwesomeIcon icon={faFileInvoiceDollar} />
                        </div>
                        <div>
                            <h1 className="text-xl font-extrabold text-white">현금수령 확인서</h1>
                            <p className="text-sm text-slate-400">Cash Receipt Confirmation</p>
                        </div>
                    </div>
                </div>

                <div className="space-y-5 rounded-2xl border border-white/10 bg-slate-800/70 p-5 shadow-2xl backdrop-blur-xl">
                    <div className="flex items-center gap-2">
                        <div className="h-6 w-1.5 rounded-full bg-emerald-500" />
                        <h2 className="font-bold text-white">발급 조건</h2>
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-semibold text-slate-300">근무 월</label>
                        <div className="flex items-center overflow-hidden rounded-xl border border-slate-600 bg-slate-900/50">
                            <button type="button" onClick={() => setSelectedMonth((month) => shiftYearMonth(month, -1))} aria-label="이전 달" className="px-4 py-2.5 text-slate-300 hover:bg-white/10 hover:text-white">
                                <FontAwesomeIcon icon={faChevronLeft} />
                            </button>
                            <div className="relative min-w-0 flex-1 border-x border-slate-600">
                                <FontAwesomeIcon icon={faCalendarAlt} className="pointer-events-none absolute left-3 top-3 text-slate-500" />
                                <YearMonthPicker
                                    value={selectedMonth}
                                    onChange={setSelectedMonth}
                                    ariaLabel="현금수령 확인서 근무 월"
                                    inputClassName="w-full border-0 bg-transparent py-2.5 pl-9 pr-3 text-center font-bold text-white outline-none"
                                />
                            </div>
                            <button type="button" onClick={() => setSelectedMonth((month) => shiftYearMonth(month, 1))} aria-label="다음 달" className="px-4 py-2.5 text-slate-300 hover:bg-white/10 hover:text-white">
                                <FontAwesomeIcon icon={faChevronRight} />
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-semibold text-slate-300">
                            <FontAwesomeIcon icon={faBuilding} className="mr-2 text-emerald-400" />현장명
                        </label>
                        <SingleSelectPopover
                            options={siteOptions}
                            selectedId={selectedSiteId || null}
                            onSelect={(siteId) => {
                                setSelectedSiteId(siteId);
                                setSelectedWorkerId('');
                            }}
                            placeholder={loadingReports ? '일보 조회 중...' : '현장명 검색 및 선택'}
                            disabled={loadingReports || siteOptions.length === 0}
                        />
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-semibold text-slate-300">
                            <FontAwesomeIcon icon={faUser} className="mr-2 text-sky-400" />수령한 자
                        </label>
                        <SingleSelectPopover
                            options={workerOptions}
                            selectedId={selectedWorkerId || null}
                            onSelect={setSelectedWorkerId}
                            placeholder={selectedSiteId ? '작업자 검색 및 선택' : '현장을 먼저 선택하세요'}
                            disabled={!selectedSiteId || workerOptions.length === 0}
                        />
                        {selectedReceiptWorker && (
                            <p className={`mt-2 text-xs font-semibold ${receiverSignatureUrl ? 'text-emerald-400' : 'text-amber-400'}`}>
                                <FontAwesomeIcon icon={faSignature} className="mr-1.5" />
                                {receiverSignatureUrl ? '저장된 작업자 서명이 확인서에 표시됩니다.' : '저장된 작업자 서명이 없습니다.'}
                            </p>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="mb-2 block text-xs font-semibold text-slate-400">근로 시작일</label>
                            <input type="date" value={workStartDate} onChange={(event) => setWorkStartDate(event.target.value)} className="w-full rounded-lg border border-slate-600 bg-slate-900/50 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500" />
                        </div>
                        <div>
                            <label className="mb-2 block text-xs font-semibold text-slate-400">근로 종료일</label>
                            <input type="date" value={workEndDate} onChange={(event) => setWorkEndDate(event.target.value)} className="w-full rounded-lg border border-slate-600 bg-slate-900/50 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500" />
                        </div>
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-semibold text-slate-300">수령금액 · 세전</label>
                        <div className="relative">
                            <input
                                type="number"
                                min={0}
                                step={1000}
                                value={receiptAmount || ''}
                                onChange={(event) => setReceiptAmount(Math.max(0, Number(event.target.value) || 0))}
                                className="w-full rounded-xl border border-slate-600 bg-slate-900/50 px-4 py-2.5 pr-10 text-right font-bold text-white outline-none focus:border-emerald-500"
                                placeholder="0"
                            />
                            <span className="absolute right-4 top-2.5 text-sm text-slate-400">원</span>
                        </div>
                    </div>

                    <div className="border-t border-slate-700 pt-4">
                        <label className="mb-2 block text-sm font-semibold text-slate-300">지급한 회사</label>
                        <SingleSelectPopover options={companyOptions} selectedId={selectedPayerCompanyId || null} onSelect={setSelectedPayerCompanyId} placeholder="지급 회사 검색 및 선택" />
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-semibold text-slate-300">지급인 서명</label>
                        <SingleSelectPopover options={payerSignerOptions} selectedId={selectedPayerSignerId || null} onSelect={setSelectedPayerSignerId} placeholder="대표 서명 선택 · 미선택 시 회사 직인" />
                        <p className={`mt-2 text-xs font-semibold ${payerSignatureUrl ? 'text-emerald-400' : 'text-amber-400'}`}>
                            <FontAwesomeIcon icon={faSignature} className="mr-1.5" />
                            {selectedPayerSigner?.signatureUrl ? `${selectedPayerSigner.name}님의 저장 서명이 표시됩니다.` : companySealUrl ? '등록된 회사 직인이 표시됩니다.' : '표시할 지급인 서명 또는 직인이 없습니다.'}
                        </p>
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-semibold text-slate-300">확인일</label>
                        <input type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} className="w-full rounded-xl border border-slate-600 bg-slate-900/50 px-4 py-2.5 text-white outline-none focus:border-emerald-500" />
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1">
                        <button type="button" onClick={() => void handleCopy()} disabled={!canPrint || copying} className="rounded-xl bg-sky-600 px-4 py-3 font-bold text-white shadow-lg transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-40">
                            <FontAwesomeIcon icon={copying ? faSpinner : faCopy} spin={copying} className="mr-2" />이미지 복사
                        </button>
                        <button type="button" onClick={() => window.print()} disabled={!canPrint} className="rounded-xl bg-emerald-600 px-4 py-3 font-bold text-white shadow-lg transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40">
                            <FontAwesomeIcon icon={faPrint} className="mr-2" />인쇄
                        </button>
                    </div>
                </div>
            </aside>

            <main className="cash-receipt-preview-container min-w-0 flex-1 overflow-auto rounded-2xl border border-[#d8d1c3] bg-[#efebe2] p-4 lg:p-8">
                <div ref={printRef} className="cash-receipt-print-root mx-auto w-[210mm]">
                    <article className="cash-receipt-document box-border flex h-[297mm] min-h-[297mm] w-[210mm] flex-col bg-white px-[18mm] py-[20mm] text-black shadow-2xl">
                        <div className="flex h-full flex-col border border-dotted border-slate-500 px-[12mm] py-[16mm]">
                            <h2 className="mb-[16mm] text-center text-[24px] font-extrabold tracking-[-0.02em] underline decoration-1 underline-offset-4">현금수령 확인서</h2>

                            <div className="space-y-[5mm] text-[15px] leading-[1.75]">
                                <div className="flex gap-2"><span className="w-5 shrink-0">1.</span><span className="w-[22mm] shrink-0 tracking-[0.15em]">현 장 명</span><span>:&nbsp; {selectedSite?.name || ''}</span></div>
                                <div className="flex gap-2"><span className="w-5 shrink-0">2.</span><span className="w-[22mm] shrink-0 tracking-[0.15em]">근로기간</span><span>:&nbsp; {formatKoreanDate(workStartDate)} &nbsp;~&nbsp; {formatKoreanDate(workEndDate)}</span></div>
                                <div className="h-[2mm]" />
                                <div className="flex gap-2"><span className="w-5 shrink-0">3.</span><span className="w-[22mm] shrink-0 tracking-[0.15em]">수령금액</span><span>:&nbsp; 일금&nbsp; {formatAmount(receiptAmount)}원 <span className="text-[13px]">(세전금액)</span></span></div>
                                <div className="flex gap-2"><span className="w-5 shrink-0">4.</span><span className="w-[22mm] shrink-0 tracking-[0.15em]">수령한 자</span><span>:&nbsp; {selectedReceiptWorker?.worker.name || ''} <span className="text-[13px]">(주민번호 : {selectedReceiptWorker?.worker.idNumber || ''})</span></span></div>
                                <div className="h-[2mm]" />
                                <div className="flex gap-2"><span className="w-5 shrink-0">5.</span><span className="w-[22mm] shrink-0 tracking-[0.15em]">지급한 자</span><span>:&nbsp; {selectedPayerCompany?.name || ''} <span className="text-[13px]">({selectedPayerCompany?.businessNumber || selectedPayerCompany?.corpNum || ''})</span></span></div>
                            </div>

                            <div className="mt-[24mm] text-center text-[15px] tracking-[0.28em]">{formatDottedDate(issueDate)}</div>
                            <p className="mt-[12mm] text-center text-[16px] tracking-[0.02em]">위와 같이 현금으로 지급받았음을 확인합니다.</p>

                            <div className="mt-[22mm] ml-auto w-[105mm] space-y-[11mm] text-[15px] leading-8">
                                <div>
                                    <p className="mb-1 font-bold tracking-[0.12em]">수령한 자(확인자)</p>
                                    <div className="flex items-center">
                                        <span className="w-[20mm] tracking-[0.35em]">성 명</span>
                                        <span className="mr-2">:</span>
                                        <span className="min-w-[38mm] border-b border-dotted border-black px-2 text-center font-semibold">{selectedReceiptWorker?.worker.name || ''}</span>
                                        <span className="relative ml-3 inline-flex h-[12mm] w-[23mm] items-center justify-center">
                                            <span>(인)</span>
                                            {receiverSignatureUrl && <img src={receiverSignatureUrl} alt="수령인 서명" className="absolute left-1/2 top-1/2 z-10 h-[13mm] w-[28mm] -translate-x-1/2 -translate-y-1/2 object-contain opacity-90 mix-blend-multiply" />}
                                        </span>
                                    </div>
                                </div>

                                <div>
                                    <p className="mb-1 font-bold tracking-[0.12em]">지급한 자</p>
                                    <div className="flex items-center">
                                        <span className="w-[20mm] tracking-[0.35em]">성 명</span>
                                        <span className="mr-2">:</span>
                                        <span className="min-w-[52mm] border-b border-dotted border-black px-2 text-center font-semibold">{selectedPayerCompany?.name || ''}</span>
                                        <span className="relative ml-3 inline-flex h-[12mm] w-[23mm] items-center justify-center">
                                            <span>(인)</span>
                                            {payerSignatureUrl && <img src={payerSignatureUrl} alt="지급인 서명 또는 직인" className={`absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 object-contain opacity-90 mix-blend-multiply ${selectedPayerSigner?.signatureUrl ? 'h-[13mm] w-[28mm]' : 'h-[20mm] w-[20mm]'}`} />}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {!canPrint && (
                                <div className="mt-auto rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-center font-sans text-sm text-slate-400 no-print">
                                    현장과 수령자를 선택하면 확인서가 완성됩니다.
                                </div>
                            )}
                        </div>
                    </article>
                </div>
            </main>
        </div>
    );
};

export default CashReceiptConfirmationPage;
