import React, { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import html2canvas from 'html2canvas';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faSpinner, faFileAlt, faBuilding, faUsers, faCalendarAlt,
    faCheckSquare, faSquare, faUserTie, faCopy, faEdit, faListAlt, faPrint
} from '@fortawesome/free-solid-svg-icons';
import { siteService, Site } from '../../services/siteService';
import { teamService, Team } from '../../services/teamService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { dailyReportService, DailyReport } from '../../services/dailyReportService';
import { companyService, Company } from '../../services/companyService';
import { YearMonthPicker } from '../../components/common/YearMonthPicker';

// --- Types ---
interface DelegationWorker {
    workerId: string;
    workerName: string;
    idNumber: string;
    address: string;
    manDays: number;
    unitPrice: number;
    amount: number;
    signatureUrl?: string;
}

const DelegationLetterV2Page: React.FC = () => {
    // --- State: Selections ---
    const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));
    const [selectedSiteId, setSelectedSiteId] = useState<string>('');
    const [selectedTeamId, setSelectedTeamId] = useState<string>('');
    const [selectedLeaderId, setSelectedLeaderId] = useState<string>('');

    // --- State: Document Settings ---
    const [delegationText, setDelegationText] = useState<string>('노무비 청구 및 수령에 대한 권한 일체');
    const [documentDate, setDocumentDate] = useState<string>(new Date().toISOString().slice(0, 10));
    const [showManDays, setShowManDays] = useState<boolean>(false);
    const [workersPerPage, setWorkersPerPage] = useState<number>(15);

    // --- State: Data ---
    const [allReports, setAllReports] = useState<DailyReport[]>([]);
    const [allWorkers, setAllWorkers] = useState<Worker[]>([]);
    const [sites, setSites] = useState<Site[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);

    // --- State: Logic ---
    const [loading, setLoading] = useState(false);
    const [delegationWorkers, setDelegationWorkers] = useState<DelegationWorker[]>([]);
    const [selectedDelegatorIds, setSelectedDelegatorIds] = useState<string[]>([]);
    const [batchUnitPrice, setBatchUnitPrice] = useState<string>('');
    const [copying, setCopying] = useState(false);
    const [measureTick, setMeasureTick] = useState(0);

    // --- State: UI ---
    const printRef = useRef<HTMLDivElement>(null);
    const measureRef = useRef<HTMLDivElement>(null);
    const [activeTab, setActiveTab] = useState<'filter' | 'document' | 'workers'>('filter');

    // --- State: Custom Mandatary ---
    const [customMandataryName, setCustomMandataryName] = useState('');
    const [customMandataryIdNumber, setCustomMandataryIdNumber] = useState('');
    const [customMandataryAddress, setCustomMandataryAddress] = useState('');
    const [customMandataryContact, setCustomMandataryContact] = useState('');
    const [customMandataryBankName, setCustomMandataryBankName] = useState('');
    const [customMandataryAccountNumber, setCustomMandataryAccountNumber] = useState('');
    const [customMandataryAccountHolder, setCustomMandataryAccountHolder] = useState('');

    // --- 1. Initial Load (Static Data) ---
    useEffect(() => {
        const loadStaticData = async () => {
            try {
                const [fetchedSites, fetchedTeams, fetchedWorkers, fetchedCompanies] = await Promise.all([
                    siteService.getSites(),
                    teamService.getTeams(),
                    manpowerService.getWorkers(),
                    companyService.getCompanies()
                ]);
                setSites(fetchedSites);
                setTeams(fetchedTeams);
                setAllWorkers(fetchedWorkers);
                setCompanies(fetchedCompanies);
            } catch (error) {
                console.error("Failed to load static data:", error);
            }
        };
        loadStaticData();
    }, []);

    // --- 2. Cascade Step 1: Month Selection -> Fetch Reports ---
    useEffect(() => {
        const fetchReportsForMonth = async () => {
            if (!selectedMonth) return;
            setLoading(true);
            try {
                const [yearStr, monthStr] = selectedMonth.split('-');
                const year = Number(yearStr);
                const month = Number(monthStr);
                const startDate = `${selectedMonth}-01`;
                const lastDay = new Date(year, month, 0).getDate();
                const endDate = `${selectedMonth}-${String(lastDay).padStart(2, '0')}`;

                const reports = await dailyReportService.getReportsByRange(startDate, endDate);
                setAllReports(reports);

                setSelectedSiteId('');
                setSelectedTeamId('');
                setSelectedLeaderId('');
                setDelegationWorkers([]);
            } catch (error) {
                console.error("Failed to fetch reports:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchReportsForMonth();
    }, [selectedMonth]);

    // --- 3. Derived Logic: Active Sites ---
    const activeSites = useMemo(() => {
        const siteIdsInReports = new Set(allReports.map(r => r.siteId));
        return sites.filter(s => siteIdsInReports.has(s.id!));
    }, [allReports, sites]);

    // --- 4. Derived Logic: Active Teams (Dependent on Site) ---
    const activeTeams = useMemo(() => {
        if (!selectedSiteId) return [];
        const siteReports = allReports.filter(r => r.siteId === selectedSiteId);
        const teamIdsInReports = new Set(siteReports.map(r => String(r.teamId ?? '').trim()).filter(Boolean));
        return teams
            .filter(t => Boolean(t.id) && teamIdsInReports.has(String(t.id).trim()))
            .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));
    }, [selectedSiteId, allReports, teams]);

    // --- 5. Logic: Fetch & Process Workers (Dependent on Team) ---
    useEffect(() => {
        if (!selectedSiteId) {
            setDelegationWorkers([]);
            setSelectedDelegatorIds([]);
            setSelectedLeaderId('');
            return;
        }

        const siteReports = allReports.filter(r => r.siteId === selectedSiteId);
        const filteredReports = selectedTeamId
            ? siteReports.filter(r => String(r.teamId ?? '').trim() === String(selectedTeamId).trim())
            : siteReports;
        const workerStats: Record<string, number> = {};

        filteredReports.forEach((report) => {
            report.workers.forEach((w) => {
                const workerId = w.workerId ? String(w.workerId).trim() : '';
                if (!workerId) return;
                if (w.manDay <= 0) return;
                workerStats[workerId] = (workerStats[workerId] || 0) + w.manDay;
            });
        });

        const workers: DelegationWorker[] = [];
        Object.entries(workerStats).forEach(([workerId, manDays]) => {
            const workerInfo = allWorkers.find(w => w.id === workerId);
            if (workerInfo) {
                workers.push({
                    workerId: workerInfo.id!,
                    workerName: workerInfo.name,
                    idNumber: workerInfo.idNumber || '',
                    address: workerInfo.address || '',
                    signatureUrl: workerInfo.signatureUrl,
                    manDays: manDays,
                    unitPrice: workerInfo.unitPrice || 0,
                    amount: manDays * (workerInfo.unitPrice || 0)
                });
            }
        });

        setDelegationWorkers(workers);
        setSelectedDelegatorIds(workers.map(w => w.workerId));

        if (!selectedTeamId) {
            return;
        }

        const currentTeam = teams.find(t => t.id === selectedTeamId);
        const teamLeader = currentTeam?.leaderId ? allWorkers.find(w => w.id === currentTeam.leaderId) : undefined;
        const fallbackTeamLeader = allWorkers.find(w => w.teamId === selectedTeamId && w.role === '팀장');
        const leaderCandidateId = teamLeader?.id || fallbackTeamLeader?.id || '';
        if (leaderCandidateId && !selectedLeaderId) setSelectedLeaderId(leaderCandidateId);
    }, [selectedTeamId, selectedSiteId, allReports, allWorkers, teams, selectedLeaderId]);

    // --- 6. Handlers ---
    const handleUnitPriceChange = (workerId: string, newPrice: number) => {
        setDelegationWorkers(prev => prev.map(w => {
            if (w.workerId === workerId) {
                return { ...w, unitPrice: newPrice, amount: w.manDays * newPrice };
            }
            return w;
        }));
    };

    const handleBatchUnitPriceApply = () => {
        const price = parseInt(batchUnitPrice.replace(/,/g, ''), 10);
        if (isNaN(price)) return;

        setDelegationWorkers(prev => prev.map(w => ({
            ...w,
            unitPrice: price,
            amount: w.manDays * price
        })));
    };

    const toggleDelegator = (workerId: string) => {
        if (workerId === selectedLeaderId) return;
        setSelectedDelegatorIds(prev =>
            prev.includes(workerId)
                ? prev.filter(id => id !== workerId)
                : [...prev, workerId]
        );
    };

    // --- 7. Copy to Clipboard Logic ---
    const handleCopyToClipboard = async () => {
        if (!printRef.current) return;
        setCopying(true);

        try {
            const options = {
                scale: 1.5,
                backgroundColor: '#ffffff',
                logging: false,
                useCORS: true
            } as unknown as Parameters<typeof html2canvas>[1];

            const canvas = await html2canvas(printRef.current, options);

            canvas.toBlob(async (blob: Blob | null) => {
                if (!blob) {
                    alert('이미지 생성에 실패했습니다.');
                    setCopying(false);
                    return;
                }

                try {
                    const win = window as unknown as { ClipboardItem?: new (items: Record<string, Blob>) => unknown };
                    const clipboard = navigator.clipboard as unknown as { write?: (items: unknown[]) => Promise<void> };
                    if (!win.ClipboardItem || !clipboard.write) {
                        alert('이 브라우저는 이미지 복사를 지원하지 않습니다.');
                        setCopying(false);
                        return;
                    }

                    await clipboard.write([
                        new win.ClipboardItem({
                            'image/png': blob
                        })
                    ]);
                    alert('위임장이 이미지로 복사되었습니다.\nCtrl+V로 붙여넣으세요.');
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

    const formatDate = (dateText: string) => {
        const [yearText, monthText, dayText] = dateText.split('-');
        const year = Number(yearText);
        const month = Number(monthText);
        const day = Number(dayText);
        if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
            return '';
        }
        return `${year}. ${month}. ${day}`;
    };

    const chunkArray = <T,>(items: T[], chunkSize: number) => {
        const safeSize = Number.isFinite(chunkSize) && chunkSize > 0 ? Math.floor(chunkSize) : 1;
        const chunks: T[][] = [];
        for (let i = 0; i < items.length; i += safeSize) {
            chunks.push(items.slice(i, i + safeSize));
        }
        return chunks;
    };

    // --- 8. Final Preparation for View ---
    const selectedMonthParts = selectedMonth.split('-');
    const yearLabel = selectedMonthParts[0].slice(2);
    const monthLabel = Number(selectedMonthParts[1]);

    const selectedCompanyId = useMemo(() => {
        const currentTeam = teams.find((t) => t.id === selectedTeamId);
        const raw = currentTeam?.companyId ? String(currentTeam.companyId).trim() : '';
        return raw;
    }, [selectedTeamId, teams]);

    const selectedCompany = useMemo(() => {
        if (!selectedCompanyId) return null;
        return companies.find((c) => String(c.id ?? '').trim() === selectedCompanyId) ?? null;
    }, [companies, selectedCompanyId]);

    const companyMandataryKey = selectedCompany?.id ? `company__${String(selectedCompany.id)}` : '';
    const isCompanyMandatarySelected = Boolean(companyMandataryKey) && selectedLeaderId === companyMandataryKey;

    const mandataryWorker = useMemo(() => {
        if (!selectedLeaderId) return null;
        if (selectedLeaderId === '__custom__') return null;
        if (selectedLeaderId.startsWith('company__')) return null;
        return allWorkers.find(w => w.id === selectedLeaderId) ?? null;
    }, [allWorkers, selectedLeaderId]);

    const mandataryInfo = useMemo(() => {
        if (!selectedLeaderId) return null;

        if (selectedLeaderId === '__custom__') {
            return {
                name: customMandataryName,
                idNumber: customMandataryIdNumber,
                address: customMandataryAddress,
                contact: customMandataryContact,
                signatureUrl: undefined as string | undefined,
                bankName: customMandataryBankName,
                accountNumber: customMandataryAccountNumber,
                accountHolder: customMandataryAccountHolder || customMandataryName
            };
        }

        if (isCompanyMandatarySelected && selectedCompany) {
            return {
                name: selectedCompany.ceoName || '',
                idNumber: selectedCompany.ceoResidentNumber || '',
                address: selectedCompany.address || '',
                contact: selectedCompany.phone || '',
                signatureUrl: undefined as string | undefined,
                bankName: selectedCompany.bankName || '',
                accountNumber: selectedCompany.accountNumber || '',
                accountHolder: selectedCompany.accountHolder || selectedCompany.ceoName || ''
            };
        }

        if (!mandataryWorker) return null;
        return {
            name: mandataryWorker.name || '',
            idNumber: mandataryWorker.idNumber || '',
            address: mandataryWorker.address || '',
            contact: mandataryWorker.contact || '',
            signatureUrl: mandataryWorker.signatureUrl,
            bankName: mandataryWorker.bankName || '',
            accountNumber: mandataryWorker.accountNumber || '',
            accountHolder: mandataryWorker.accountHolder || mandataryWorker.name || ''
        };
    }, [isCompanyMandatarySelected, mandataryWorker, selectedCompany, selectedLeaderId,
        customMandataryName, customMandataryIdNumber, customMandataryAddress, customMandataryContact,
        customMandataryBankName, customMandataryAccountNumber, customMandataryAccountHolder]);

    const finalDelegators = useMemo(() => {
        if (delegationWorkers.length === 0) return [] as DelegationWorker[];
        if (selectedDelegatorIds.length === 0) return [] as DelegationWorker[];

        const selectedSet = new Set(selectedDelegatorIds);
        return delegationWorkers.filter((w) => selectedSet.has(w.workerId) && w.workerId !== selectedLeaderId);
    }, [delegationWorkers, selectedDelegatorIds, selectedLeaderId]);

    const totalAmount = finalDelegators.reduce((sum, w) => sum + w.amount, 0);
    const totalManDays = finalDelegators.reduce((sum, w) => sum + w.manDays, 0);

    const areNumberArraysEqual = (a: number[], b: number[]) => {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i += 1) {
            if (a[i] !== b[i]) return false;
        }
        return true;
    };

    const [autoPageSizes, setAutoPageSizes] = useState<number[]>([]);

    useLayoutEffect(() => {
        if (finalDelegators.length === 0) {
            setAutoPageSizes((prev) => (prev.length === 0 ? prev : []));
            return;
        }

        const pageEl = measureRef.current;
        if (!pageEl) return;

        const raf = window.requestAnimationFrame(() => {
            const tbodyEl = pageEl.querySelector<HTMLTableSectionElement>('tbody[data-measure="workers"]');
            const rowEls = Array.from(pageEl.querySelectorAll<HTMLTableRowElement>('tr[data-measure-row="worker"]'));
            const totalRowEl = pageEl.querySelector<HTMLTableRowElement>('tr[data-measure-row="total"]');

            if (!tbodyEl) return;
            if (rowEls.length !== finalDelegators.length) return;

            const pageRect = pageEl.getBoundingClientRect();
            const tbodyRect = tbodyEl.getBoundingClientRect();

            const safetyPx = 2;
            const availableHeight = Math.max(0, Math.floor(pageRect.bottom - tbodyRect.top - safetyPx));
            if (availableHeight <= 0) return;

            const totalRowHeight = totalRowEl ? Math.ceil(totalRowEl.getBoundingClientRect().height) : 0;
            const lastPageCapacity = Math.max(0, availableHeight - totalRowHeight - safetyPx);

            const rowHeights = rowEls.map((el) => Math.ceil(el.getBoundingClientRect().height));

            const sizes: number[] = [];
            let currentSize = 0;
            let currentHeight = 0;

            for (let i = 0; i < finalDelegators.length; i += 1) {
                const rowHeight = rowHeights[i] ?? 0;
                if (currentSize > 0 && currentHeight + rowHeight > availableHeight) {
                    sizes.push(currentSize);
                    currentSize = 0;
                    currentHeight = 0;
                }
                currentSize += 1;
                currentHeight += rowHeight;
            }
            if (currentSize > 0) sizes.push(currentSize);

            if (sizes.length > 0 && totalRowHeight > 0) {
                const lastSize = sizes[sizes.length - 1] ?? 0;
                const lastHeights = rowHeights.slice(finalDelegators.length - lastSize);
                const lastTotalHeight = lastHeights.reduce((sum, h) => sum + h, 0);

                if (lastSize > 1 && lastTotalHeight > lastPageCapacity) {
                    let tailHeight = 0;
                    let keepFromIndex = lastSize;
                    for (let i = lastSize - 1; i >= 0; i -= 1) {
                        const h = lastHeights[i] ?? 0;
                        if (tailHeight + h > lastPageCapacity && i < lastSize - 1) break;
                        if (tailHeight + h > lastPageCapacity && i === lastSize - 1) {
                            keepFromIndex = i;
                            break;
                        }
                        tailHeight += h;
                        keepFromIndex = i;
                    }

                    if (keepFromIndex > 0 && keepFromIndex < lastSize) {
                        const headSize = keepFromIndex;
                        const tailSize = lastSize - keepFromIndex;
                        sizes.splice(sizes.length - 1, 1, headSize, tailSize);
                    }
                }
            }

            setAutoPageSizes((prev) => (areNumberArraysEqual(prev, sizes) ? prev : sizes));
        });

        return () => {
            window.cancelAnimationFrame(raf);
        };
    }, [
        finalDelegators,
        delegationText,
        showManDays,
        measureTick,
        selectedSiteId,
        selectedLeaderId,
        customMandataryName,
        customMandataryIdNumber,
        customMandataryAddress,
        customMandataryContact,
        customMandataryBankName,
        customMandataryAccountNumber,
        customMandataryAccountHolder
    ]);

    const pagedDelegators = useMemo(() => {
        if (finalDelegators.length === 0) return [] as DelegationWorker[][];
        if (autoPageSizes.length > 0) {
            const totalSized = autoPageSizes.reduce((sum, size) => sum + size, 0);
            if (totalSized === finalDelegators.length) {
                const pages: DelegationWorker[][] = [];
                let cursor = 0;
                for (const size of autoPageSizes) {
                    pages.push(finalDelegators.slice(cursor, cursor + size));
                    cursor += size;
                }
                return pages;
            }
        }
        return chunkArray(finalDelegators, workersPerPage);
    }, [autoPageSizes, finalDelegators, workersPerPage]);

    const allSitesLoaded = sites.length > 0;

    // --- Render ---
    if (loading && !allSitesLoaded) {
        return (
            <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-900 to-slate-800">
                <div className="text-center">
                    <FontAwesomeIcon icon={faSpinner} spin className="text-5xl text-blue-400 mb-4" />
                    <p className="text-slate-300 font-medium">데이터를 불러오는 중...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 lg:p-6 flex flex-col lg:flex-row gap-6 delegation-page-root">
            {/* Print-only styles */}
            <style>{`
                @media print {
                    @page { size: A4 portrait; margin: 0; }
                    html, body, #root {
                        width: 100% !important;
                        min-height: 100% !important;
                        height: auto !important;
                    }
                    body {
                        margin: 0;
                        padding: 0;
                        background: white !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .no-print { display: none !important; }
                    .measure-only { display: none !important; }
                    .delegation-page-root {
                        display: block !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        background: white !important;
                        min-height: auto !important;
                    }
                    .print-area-wrapper {
                        width: 100% !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        background: white !important;
                        border: none !important;
                        border-radius: 0 !important;
                        overflow: visible !important;
                    }
                    .print-area-wrapper > div {
                        box-shadow: none !important;
                        margin: 0 auto !important;
                    }

                    .delegation-letter {
                        width: 210mm !important;
                        min-height: auto !important;
                        padding: 0 !important;
                        margin: 0 auto !important;
                        background: white !important;
                        box-shadow: none !important;
                        box-sizing: border-box !important;
                    }

                    .delegation-letter-page {
                        box-sizing: border-box;
                        width: 210mm !important;
                        height: 297mm !important;
                        min-height: 297mm !important;
                        padding: 14mm 14mm 12mm !important;
                        overflow: hidden !important;
                        background: white !important;
                        display: flex !important;
                        flex-direction: column !important;
                        justify-content: space-between !important;
                        break-inside: avoid-page;
                        page-break-inside: avoid;
                        page-break-after: always;
                    }

                    .delegation-letter-page:last-child {
                        page-break-after: auto;
                    }

                    .delegation-letter-body {
                        flex: 1 1 auto;
                        min-height: 0;
                        display: flex;
                        flex-direction: column;
                    }

                    .delegation-workers-table {
                        width: 100%;
                        table-layout: fixed;
                        border-collapse: collapse;
                        page-break-inside: auto;
                    }
                    .delegation-workers-table thead { display: table-header-group; }
                    .delegation-workers-table tfoot { display: table-footer-group; }
                    .delegation-workers-table tr {
                        break-inside: avoid-page;
                        page-break-inside: avoid;
                    }
                    .delegation-workers-table th,
                    .delegation-workers-table td {
                        vertical-align: middle !important;
                        line-height: 1.28 !important;
                        word-break: break-word !important;
                        overflow-wrap: anywhere !important;
                    }
                    .delegation-signature-cell {
                        position: relative;
                        height: 10mm !important;
                        padding: 0 !important;
                        overflow: hidden !important;
                    }
                    .delegation-signature-cell > div,
                    .delegation-signature-cell img {
                        width: 100%;
                        height: 100%;
                    }
                    .delegation-footer-date {
                        margin-top: auto !important;
                        padding-top: 6mm !important;
                    }
                    .delegation-letter-page img {
                        max-width: 100% !important;
                        max-height: 100% !important;
                        object-fit: contain !important;
                    }
                }
            `}</style>
            {/* --- Left Panel: Settings --- */}
            <div className="w-full lg:w-[420px] flex flex-col gap-4 no-print">
                {/* Header Card */}
                <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 backdrop-blur-xl rounded-2xl border border-white/10 p-5 shadow-2xl">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                            <FontAwesomeIcon icon={faFileAlt} className="text-white text-xl" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-white">위임장 생성기 V2</h1>
                            <p className="text-slate-400 text-sm">Delegation Letter Generator V2</p>
                        </div>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-white/10 p-2 flex gap-2">
                    <button
                        onClick={() => setActiveTab('filter')}
                        className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === 'filter'
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        <FontAwesomeIcon icon={faCalendarAlt} className="mr-2" />
                        필터
                    </button>
                    <button
                        onClick={() => setActiveTab('document')}
                        className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === 'document'
                            ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        <FontAwesomeIcon icon={faEdit} className="mr-2" />
                        문서 설정
                    </button>
                    <button
                        onClick={() => setActiveTab('workers')}
                        className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === 'workers'
                            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        <FontAwesomeIcon icon={faUsers} className="mr-2" />
                        작업자
                    </button>
                </div>

                {/* Content Card */}
                <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-white/10 p-5 shadow-2xl flex-1 overflow-auto">
                    {/* Filter Tab */}
                    {activeTab === 'filter' && (
                        <div className="space-y-5">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-1.5 h-6 rounded-full bg-blue-500"></div>
                                <h3 className="text-white font-semibold">기간 및 현장 선택</h3>
                            </div>

                            {/* Month */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">근무 월</label>
                                <div className="relative">
                                    <FontAwesomeIcon icon={faCalendarAlt} className="absolute left-4 top-3 text-slate-500" />
                                    <YearMonthPicker
                                        value={selectedMonth}
                                        onChange={setSelectedMonth}
                                        inputClassName="w-full pl-11 bg-slate-700/50 border border-slate-600/50 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                                    />
                                </div>
                            </div>

                            {/* Site */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">현장 선택</label>
                                <div className="relative">
                                    <FontAwesomeIcon icon={faBuilding} className="absolute left-4 top-3 text-slate-500" />
                                    <select
                                        value={selectedSiteId}
                                        onChange={(e) => {
                                            setSelectedSiteId(e.target.value);
                                            setSelectedTeamId('');
                                        }}
                                        disabled={loading || activeSites.length === 0}
                                        className="w-full pl-11 bg-slate-700/50 border border-slate-600/50 rounded-xl px-4 py-2.5 text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all disabled:opacity-50 appearance-none cursor-pointer"
                                    >
                                        <option value="">{loading ? '데이터 조회 중...' : '현장 선택'}</option>
                                        {activeSites.map(site => (
                                            <option key={site.id} value={site.id}>{site.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Team */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">팀 선택 (선택 시 해당 팀 근무자만 표시)</label>
                                <div className="relative">
                                    <FontAwesomeIcon icon={faUsers} className="absolute left-4 top-3 text-slate-500" />
                                    <select
                                        value={selectedTeamId}
                                        onChange={(e) => setSelectedTeamId(e.target.value)}
                                        disabled={!selectedSiteId || activeTeams.length === 0}
                                        className="w-full pl-11 bg-slate-700/50 border border-slate-600/50 rounded-xl px-4 py-2.5 text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all disabled:opacity-50 appearance-none cursor-pointer"
                                    >
                                        <option value="">팀 선택</option>
                                        {activeTeams.map(team => (
                                            <option key={team.id} value={team.id}>{team.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Mandatary */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    수임인 설정
                                    <span className="text-blue-400 text-xs ml-2">* 위임자 목록에서 제외</span>
                                </label>
                                <div className="relative">
                                    <FontAwesomeIcon icon={faUserTie} className="absolute left-4 top-3 text-slate-500" />
                                    <select
                                        value={selectedLeaderId}
                                        onChange={(e) => {
                                            setSelectedLeaderId(e.target.value);
                                            if (e.target.value !== '__custom__') {
                                                setCustomMandataryName('');
                                                setCustomMandataryIdNumber('');
                                                setCustomMandataryAddress('');
                                                setCustomMandataryContact('');
                                                setCustomMandataryBankName('');
                                                setCustomMandataryAccountNumber('');
                                                setCustomMandataryAccountHolder('');
                                            }
                                        }}
                                        className="w-full pl-11 bg-slate-700/50 border border-slate-600/50 rounded-xl px-4 py-2.5 text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all appearance-none cursor-pointer"
                                    >
                                        <option value="">수임인 선택</option>
                                        <option value="__custom__">✏️ 직접 입력</option>
                                        {selectedCompany && companyMandataryKey && (
                                            <optgroup label="회사 대표">
                                                <option key={companyMandataryKey} value={companyMandataryKey}>
                                                    {selectedCompany.name} 대표 ({selectedCompany.ceoName})
                                                </option>
                                            </optgroup>
                                        )}
                                        <optgroup label="현장 팀장">
                                            {activeTeams
                                                .map((team) => {
                                                    const teamLeader = team.leaderId ? allWorkers.find((w) => w.id === team.leaderId) : undefined;
                                                    const fallbackLeader = allWorkers.find((w) => w.teamId === team.id && w.role === '팀장');
                                                    const leader = teamLeader ?? fallbackLeader;
                                                    if (!leader?.id) return null;
                                                    return (
                                                        <option key={leader.id} value={leader.id}>
                                                            {team.name} 팀장 ({leader.name})
                                                        </option>
                                                    );
                                                })
                                                .filter(Boolean)}
                                        </optgroup>
                                        <optgroup label="전체 작업자">
                                            {delegationWorkers.map(w => (
                                                <option key={w.workerId} value={w.workerId}>
                                                    {w.workerName} ({w.manDays}공수)
                                                </option>
                                            ))}
                                        </optgroup>
                                    </select>
                                </div>
                            </div>

                            {/* Custom Mandatary Input */}
                            {selectedLeaderId === '__custom__' && (
                                <div className="bg-slate-700/30 rounded-xl p-3 border border-amber-500/30 space-y-2">
                                    <p className="text-amber-400 text-xs font-bold mb-2">수임인 직접 입력</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        <input type="text" placeholder="성명" value={customMandataryName} onChange={e => setCustomMandataryName(e.target.value)}
                                            className="px-3 py-2 text-xs bg-slate-700/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-500 focus:border-amber-500 outline-none" />
                                        <input type="text" placeholder="주민등록번호" value={customMandataryIdNumber} onChange={e => setCustomMandataryIdNumber(e.target.value)}
                                            className="px-3 py-2 text-xs bg-slate-700/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-500 focus:border-amber-500 outline-none" />
                                    </div>
                                    <input type="text" placeholder="주소" value={customMandataryAddress} onChange={e => setCustomMandataryAddress(e.target.value)}
                                        className="w-full px-3 py-2 text-xs bg-slate-700/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-500 focus:border-amber-500 outline-none" />
                                    <input type="text" placeholder="연락처" value={customMandataryContact} onChange={e => setCustomMandataryContact(e.target.value)}
                                        className="w-full px-3 py-2 text-xs bg-slate-700/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-500 focus:border-amber-500 outline-none" />
                                    <div className="grid grid-cols-3 gap-2">
                                        <input type="text" placeholder="은행" value={customMandataryBankName} onChange={e => setCustomMandataryBankName(e.target.value)}
                                            className="px-3 py-2 text-xs bg-slate-700/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-500 focus:border-amber-500 outline-none" />
                                        <input type="text" placeholder="계좌번호" value={customMandataryAccountNumber} onChange={e => setCustomMandataryAccountNumber(e.target.value)}
                                            className="px-3 py-2 text-xs bg-slate-700/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-500 focus:border-amber-500 outline-none" />
                                        <input type="text" placeholder="예금주" value={customMandataryAccountHolder} onChange={e => setCustomMandataryAccountHolder(e.target.value)}
                                            className="px-3 py-2 text-xs bg-slate-700/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-500 focus:border-amber-500 outline-none" />
                                    </div>
                                </div>
                            )}

                            {/* Workers & Unit Price (inline in filter tab) */}
                            {delegationWorkers.length > 0 && (
                                <div className="mt-2">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-5 rounded-full bg-emerald-500"></div>
                                            <h4 className="text-white font-semibold text-sm">작업자 및 단가</h4>
                                        </div>
                                        <span className="text-emerald-400 text-xs font-medium">{finalDelegators.length}명 선택</span>
                                    </div>

                                    {/* Batch Unit Price */}
                                    <div className="flex gap-2 p-2.5 bg-slate-700/30 rounded-xl border border-slate-600/30 mb-3">
                                        <input
                                            type="text"
                                            placeholder="단가 일괄 입력"
                                            value={batchUnitPrice}
                                            onChange={(e) => setBatchUnitPrice(e.target.value)}
                                            className="flex-1 px-3 py-1.5 text-xs bg-slate-700/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-500 focus:border-emerald-500 outline-none"
                                        />
                                        <button
                                            onClick={handleBatchUnitPriceApply}
                                            className="px-3 py-1.5 bg-emerald-600 text-white text-xs rounded-lg hover:bg-emerald-700 font-medium transition-colors shadow-lg shadow-emerald-600/30"
                                        >
                                            일괄 적용
                                        </button>
                                    </div>

                                    {/* Workers List */}
                                    <div className="max-h-[300px] overflow-y-auto space-y-1.5 pr-1">
                                        {delegationWorkers.map(worker => {
                                            const isMandatary = worker.workerId === selectedLeaderId;
                                            const isSelected = selectedDelegatorIds.includes(worker.workerId);
                                            return (
                                                <div
                                                    key={worker.workerId}
                                                    className={`p-2.5 rounded-xl border transition-all ${isMandatary
                                                        ? 'bg-amber-500/10 border-amber-500/30'
                                                        : isSelected
                                                            ? 'bg-emerald-500/10 border-emerald-500/30'
                                                            : 'bg-slate-700/30 border-slate-600/30'
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => !isMandatary && toggleDelegator(worker.workerId)}
                                                            disabled={isMandatary}
                                                            className={`text-base transition-colors ${isMandatary
                                                                ? 'text-amber-500'
                                                                : isSelected
                                                                    ? 'text-emerald-500'
                                                                    : 'text-slate-500 hover:text-slate-400'
                                                                }`}
                                                        >
                                                            <FontAwesomeIcon icon={isSelected || isMandatary ? faCheckSquare : faSquare} />
                                                        </button>
                                                        <span className={`text-xs font-medium ${isMandatary ? 'text-amber-400' : 'text-white'}`}>
                                                            {worker.workerName}
                                                            {isMandatary && <span className="text-[10px] text-amber-500 ml-1">(수임인)</span>}
                                                        </span>
                                                        <span className="ml-auto px-1.5 py-0.5 bg-slate-600/50 text-slate-300 text-[10px] rounded">
                                                            {Number(worker.manDays).toFixed(1)}공수
                                                        </span>
                                                    </div>
                                                    {!isMandatary && isSelected && (
                                                        <div className="flex items-center gap-2 mt-1.5 pl-6">
                                                            <span className="text-[10px] text-slate-400">단가:</span>
                                                            <input
                                                                type="number"
                                                                value={worker.unitPrice}
                                                                onChange={(e) => handleUnitPriceChange(worker.workerId, Number(e.target.value))}
                                                                className="w-20 px-2 py-1 text-[11px] bg-slate-700/50 border border-slate-600/50 rounded text-white text-right focus:border-emerald-500 outline-none"
                                                            />
                                                            <span className="text-[10px] text-emerald-400 font-medium">= {worker.amount.toLocaleString()}원</span>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Document Tab */}
                    {activeTab === 'document' && (
                        <div className="space-y-5">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-1.5 h-6 rounded-full bg-purple-500"></div>
                                <h3 className="text-white font-semibold">위임장 문서 설정</h3>
                            </div>

                            {/* Delegation Text */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    <FontAwesomeIcon icon={faEdit} className="mr-2 text-purple-400" />
                                    위임사항 내용
                                </label>
                                <textarea
                                    value={delegationText}
                                    onChange={(e) => setDelegationText(e.target.value)}
                                    rows={3}
                                    className="w-full bg-slate-700/50 border border-slate-600/50 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all resize-none"
                                    placeholder="위임사항 내용을 입력하세요"
                                />
                                <p className="text-xs text-slate-500 mt-2">
                                    기본: "노무비 청구 및 수령에 대한 권한 일체"
                                </p>
                            </div>

                            <div className="bg-slate-700/30 rounded-xl p-4 border border-slate-600/30">
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    <FontAwesomeIcon icon={faCalendarAlt} className="mr-2 text-purple-400" />
                                    작성날자
                                </label>
                                <input
                                    type="date"
                                    value={documentDate}
                                    onChange={(e) => setDocumentDate(e.target.value)}
                                    className="w-full bg-slate-700/50 border border-slate-600/50 rounded-xl px-4 py-3 text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
                                />
                            </div>

                            {/* Show ManDays Toggle */}
                            <div className="bg-slate-700/30 rounded-xl p-4 border border-slate-600/30">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <FontAwesomeIcon icon={faListAlt} className="text-purple-400" />
                                        <div>
                                            <p className="text-white font-medium text-sm">공수 항목 표시</p>
                                            <p className="text-slate-500 text-xs">위임인 목록에 공수(일수) 열 추가</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setShowManDays(!showManDays)}
                                        className={`w-14 h-7 rounded-full transition-all relative ${showManDays
                                            ? 'bg-purple-600'
                                            : 'bg-slate-600'
                                            }`}
                                    >
                                        <div className={`w-5 h-5 bg-white rounded-full absolute top-1 transition-all shadow-md ${showManDays ? 'left-8' : 'left-1'
                                            }`}></div>
                                    </button>
                                </div>
                            </div>

                            <div className="bg-slate-700/30 rounded-xl p-4 border border-slate-600/30">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-white font-medium text-sm">페이지당 작업자 수</p>
                                        <p className="text-slate-500 text-xs">A4 한 장에 들어갈 작업자 수(상단 포함). 인쇄 결과에 맞춰 조절하세요.</p>
                                    </div>
                                    <input
                                        type="number"
                                        min={1}
                                        value={workersPerPage}
                                        onChange={(e) => {
                                            const next = Number(e.target.value);
                                            setWorkersPerPage(Number.isFinite(next) && next > 0 ? Math.floor(next) : 1);
                                        }}
                                        className="w-24 px-3 py-2 text-sm bg-slate-700/50 border border-slate-600/50 rounded-lg text-white text-right focus:border-purple-500 outline-none"
                                    />
                                </div>
                            </div>

                            {/* Quick Actions */}
                            <div className="bg-gradient-to-r from-purple-600/10 to-pink-600/10 rounded-xl p-4 border border-purple-500/20">
                                <p className="text-purple-300 text-sm font-medium mb-3">빠른 설정</p>
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        onClick={() => setDelegationText('노무비 청구 및 수령에 대한 권한 일체')}
                                        className="px-3 py-1.5 bg-purple-600/30 text-purple-300 text-xs rounded-lg hover:bg-purple-600/50 transition-colors"
                                    >
                                        노무비 수령 권한
                                    </button>
                                    <button
                                        onClick={() => setDelegationText('급여 청구 및 수령에 대한 권한 일체')}
                                        className="px-3 py-1.5 bg-purple-600/30 text-purple-300 text-xs rounded-lg hover:bg-purple-600/50 transition-colors"
                                    >
                                        급여 수령 권한
                                    </button>
                                    <button
                                        onClick={() => setDelegationText('일용직 노무비 청구 및 수령에 대한 권한 일체')}
                                        className="px-3 py-1.5 bg-purple-600/30 text-purple-300 text-xs rounded-lg hover:bg-purple-600/50 transition-colors"
                                    >
                                        일용직 노무비
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Workers Tab */}
                    {activeTab === 'workers' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-6 rounded-full bg-emerald-500"></div>
                                    <h3 className="text-white font-semibold">작업자 및 단가 설정</h3>
                                </div>
                                <span className="text-emerald-400 text-sm font-medium">
                                    {finalDelegators.length}명 선택
                                </span>
                            </div>

                            {/* Batch Unit Price */}
                            <div className="flex gap-2 p-3 bg-slate-700/30 rounded-xl border border-slate-600/30">
                                <input
                                    type="text"
                                    placeholder="단가 일괄 입력"
                                    value={batchUnitPrice}
                                    onChange={(e) => setBatchUnitPrice(e.target.value)}
                                    className="flex-1 px-3 py-2 text-sm bg-slate-700/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-500 focus:border-emerald-500 outline-none"
                                />
                                <button
                                    onClick={handleBatchUnitPriceApply}
                                    className="px-4 py-2 bg-emerald-600 text-white text-xs rounded-lg hover:bg-emerald-700 font-medium transition-colors shadow-lg shadow-emerald-600/30"
                                >
                                    일괄 적용
                                </button>
                            </div>

                            {/* Workers List */}
                            <div className="max-h-[400px] overflow-y-auto space-y-2 pr-1">
                                {delegationWorkers.length === 0 ? (
                                    <div className="text-center py-12">
                                        <FontAwesomeIcon icon={faUsers} className="text-4xl text-slate-600 mb-3" />
                                        <p className="text-slate-500 text-sm">
                                            {!selectedSiteId ? '현장을 선택해주세요.' : '해당 기간/현장에 근무 이력이 없습니다.'}
                                        </p>
                                    </div>
                                ) : (
                                    delegationWorkers.map(worker => {
                                        const isMandatary = worker.workerId === selectedLeaderId;
                                        const isSelected = selectedDelegatorIds.includes(worker.workerId);
                                        return (
                                            <div
                                                key={worker.workerId}
                                                className={`p-3 rounded-xl border transition-all ${isMandatary
                                                    ? 'bg-amber-500/10 border-amber-500/30'
                                                    : isSelected
                                                        ? 'bg-emerald-500/10 border-emerald-500/30'
                                                        : 'bg-slate-700/30 border-slate-600/30'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <button
                                                        onClick={() => !isMandatary && toggleDelegator(worker.workerId)}
                                                        disabled={isMandatary}
                                                        className={`text-lg transition-colors ${isMandatary
                                                            ? 'text-amber-500'
                                                            : isSelected
                                                                ? 'text-emerald-500'
                                                                : 'text-slate-500 hover:text-slate-400'
                                                            }`}
                                                    >
                                                        <FontAwesomeIcon icon={isSelected || isMandatary ? faCheckSquare : faSquare} />
                                                    </button>
                                                    <span className={`text-sm font-medium ${isMandatary ? 'text-amber-400' : 'text-white'}`}>
                                                        {worker.workerName}
                                                        {isMandatary && <span className="text-xs text-amber-500 ml-1">(수임인)</span>}
                                                    </span>
                                                    <span className="ml-auto px-2 py-0.5 bg-slate-600/50 text-slate-300 text-xs rounded-md">
                                                        {Number(worker.manDays).toFixed(1)}공수
                                                    </span>
                                                </div>

                                                {!isMandatary && isSelected && (
                                                    <div className="flex items-center gap-3 mt-2 pl-8">
                                                        <span className="text-xs text-slate-400">단가:</span>
                                                        <input
                                                            type="number"
                                                            value={worker.unitPrice}
                                                            onChange={(e) => handleUnitPriceChange(worker.workerId, Number(e.target.value))}
                                                            className="w-24 px-2 py-1 text-xs bg-slate-700/50 border border-slate-600/50 rounded text-white text-right focus:border-emerald-500 outline-none"
                                                        />
                                                        <span className="text-xs text-emerald-400 font-medium">= {(worker.amount).toLocaleString()}원</span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                    <button
                        onClick={handleCopyToClipboard}
                        disabled={finalDelegators.length === 0 || copying}
                        className={`flex-1 px-6 py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-lg ${copying
                            ? 'bg-blue-600/50 text-white cursor-wait'
                            : 'bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-500 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-blue-600/30'
                            }`}
                    >
                        <FontAwesomeIcon icon={copying ? faSpinner : faCopy} spin={copying} />
                        {copying ? '생성 중...' : '이미지 복사'}
                    </button>
                    <button
                        onClick={() => window.print()}
                        disabled={finalDelegators.length === 0}
                        className="px-6 py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all bg-slate-700 text-white hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed border border-slate-600"
                    >
                        <FontAwesomeIcon icon={faPrint} />
                        인쇄
                    </button>
                </div>

                {/* Summary Card */}
                {finalDelegators.length > 0 && (
                    <div className="bg-gradient-to-r from-emerald-600/20 to-teal-600/20 backdrop-blur-xl rounded-2xl border border-emerald-500/20 p-4">
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div>
                                <p className="text-slate-400 text-xs mb-1">선택 인원</p>
                                <p className="text-white font-bold text-lg">{finalDelegators.length}명</p>
                            </div>
                            <div>
                                <p className="text-slate-400 text-xs mb-1">총 공수</p>
                                <p className="text-white font-bold text-lg">{Number(totalManDays).toFixed(1)}일</p>
                            </div>
                            <div>
                                <p className="text-slate-400 text-xs mb-1">총 금액</p>
                                <p className="text-emerald-400 font-bold text-lg">{totalAmount.toLocaleString()}원</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* --- Right Panel: Preview --- */}
            <div className="flex-1 bg-slate-800/30 backdrop-blur-sm overflow-auto rounded-2xl p-4 lg:p-8 flex justify-center border border-white/5 print-area-wrapper">
                <div
                    ref={printRef}
                    className="bg-white shadow-2xl mx-auto box-border delegation-letter"
                >
                    <style>{`
                        .delegation-letter-page {
                            width: 210mm;
                            height: 297mm;
                            min-height: 297mm;
                            position: relative;
                            background-color: white;
                            padding: 14mm 14mm 12mm;
                            box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
                            margin: 0 auto 20px auto;
                            box-sizing: border-box;
                            overflow: hidden;
                            display: flex;
                            flex-direction: column;
                            justify-content: space-between;
                            page-break-after: always;
                        }

                        .delegation-letter-body {
                            flex: 1 1 auto;
                            min-height: 0;
                            display: flex;
                            flex-direction: column;
                        }

                        .delegation-workers-table {
                            width: 100%;
                            table-layout: fixed;
                            border-collapse: collapse;
                        }

                        .delegation-workers-table th,
                        .delegation-workers-table td {
                            vertical-align: middle;
                            word-break: break-word;
                            overflow-wrap: anywhere;
                        }

                        .delegation-signature-cell {
                            position: relative;
                            height: 38px;
                            padding: 0 !important;
                            overflow: hidden;
                        }

                        .delegation-signature-cell > div,
                        .delegation-signature-cell img {
                            width: 100%;
                            height: 100%;
                        }

                        .delegation-footer-date {
                            margin-top: auto;
                            padding-top: 6mm;
                        }

                        @media print {
                            .delegation-letter-page {
                                margin: 0 auto;
                                box-shadow: none;
                            }
                            .print-gap { display: none !important; }
                        }
                    `}</style>

                    <div ref={measureRef} className="measure-only delegation-letter-page h-auto min-h-0 m-0 p-[15mm]" style={{ position: 'absolute', top: -9999, left: -9999, visibility: 'hidden', height: 'auto', display: 'block' }}>
                        {/* Title Header */}
                        <div className="flex justify-center items-start mb-6">
                            <h2 className="text-[32px] font-bold tracking-[0.2em]">위 임 장</h2>
                        </div>

                        {/* Top Context Info */}
                        <div className="flex justify-between items-end mb-4 border-b-2 border-black pb-2 px-1">
                            <div className="text-sm font-semibold">
                                현 장 명 : {sites.find(s => s.id === selectedSiteId)?.name || ''}
                            </div>
                            <div className="text-sm font-semibold tracking-wider">
                                {yearLabel}년 {monthLabel}월 귀속
                            </div>
                        </div>

                        {/* Mandatary Info */}
                        <div className="mb-4">
                            <div className="flex items-center gap-2 mb-2 font-bold text-sm">
                                <span className="bg-black text-white px-2 py-0.5 text-xs">수임인</span>
                                (노무비를 수령할 자)
                            </div>
                            <table className="w-full border-collapse border border-black text-xs">
                                <tbody>
                                    <tr className="border-b border-black">
                                        <th className="border-r border-black bg-gray-50 p-2 w-24 text-center font-bold">성 명</th>
                                        <td className="border-r border-black p-2 relative h-12 w-48 text-center font-bold tracking-widest text-sm">
                                            <span className="block text-center pr-8">{mandataryInfo?.name}</span>
                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 tracking-normal">(인)</span>
                                        </td>
                                        <th className="border-r border-black bg-gray-50 p-2 w-28 text-center font-bold">주민등록번호</th>
                                        <td className="p-2 text-center tracking-wider">{mandataryInfo?.idNumber}</td>
                                    </tr>
                                    <tr className="border-b border-black">
                                        <th className="border-r border-black bg-gray-50 p-1.5 text-center">전화번호</th>
                                        <td className="border-r border-black p-1.5 text-center">{mandataryInfo?.contact || ''}</td>
                                        <th className="border-r border-black bg-gray-50 p-1.5 text-center">은행 / 계좌번호</th>
                                        <td className="p-1.5 text-center font-bold text-[11px]">
                                            {mandataryInfo ? `${mandataryInfo.bankName} ${mandataryInfo.accountNumber}` : ''}
                                            {mandataryInfo?.accountHolder && ` (예금주: ${mandataryInfo.accountHolder})`}
                                        </td>
                                    </tr>
                                    <tr>
                                        <th className="border-r border-black bg-gray-50 p-1.5 text-center">주 소</th>
                                        <td colSpan={3} className="p-1.5 text-[11px] leading-tight break-all">
                                            {mandataryInfo?.address}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* Delegation Content */}
                        <div className="mb-4 border border-black p-3 text-sm leading-relaxed text-center break-all">
                            위 사람을 대리인으로 정하여 <span className="font-bold underline underline-offset-4 mx-1">[{delegationText}]</span>을 위임합니다.
                        </div>

                        <div className="text-[11px] font-bold text-gray-600 mb-1 flex items-center justify-between">
                            <div><span className="bg-black text-white px-2 py-[1px] text-[10px] mr-2">위임인</span>(노무비를 지급받을 자)</div>
                        </div>

                        <table className="w-full border-collapse border border-black text-[11px] delegation-workers-table table-fixed">
                            <thead>
                                <tr className="border-b border-black bg-gray-50">
                                    <th className="border-r border-black p-1 w-8 text-center">No.</th>
                                    <th className="border-r border-black p-1 w-16 text-center">성 명</th>
                                    <th className="border-r border-black p-1 w-28 text-center">주민번호</th>
                                    {showManDays && <th className="border-r border-black p-1 w-12 text-center">공수</th>}
                                    <th className="border-r border-black p-1 w-24 text-center">주 소</th>
                                    <th className="border-r border-black p-1 w-20 text-center">금 액</th>
                                    <th className="p-1 w-24 text-center">서 명</th>
                                </tr>
                            </thead>
                            <tbody data-measure="workers">
                                {finalDelegators.map((worker, index) => (
                                    <tr key={worker.workerId} className="border-b border-black" data-measure-row="worker">
                                        <td className="border-r border-black p-1 text-center font-medium opacity-50">{index + 1}</td>
                                        <td className="border-r border-black p-1 font-bold tracking-widest text-center text-[12px]">{worker.workerName}</td>
                                        <td className="border-r border-black p-1 text-center tracking-wider">{worker.idNumber}</td>
                                        {showManDays && <td className="border-r border-black p-1 text-center">{worker.manDays.toFixed(1)}</td>}
                                        <td className="border-r border-black p-1 text-[8.5px] leading-snug break-all">
                                            <div className="line-clamp-2">{worker.address || ''}</div>
                                        </td>
                                        <td className="border-r border-black p-1 px-2 text-right font-bold text-[12px]">{worker.amount.toLocaleString()}</td>
                                        <td className="delegation-signature-cell"></td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="bg-gray-100 border-t-2 border-black" data-measure-row="total">
                                    <td colSpan={showManDays ? 5 : 4} className="border-r border-black p-1.5 text-center font-bold text-xs tracking-[0.5em]">
                                        합 계 가 준 (총원 : {finalDelegators.length} 명)
                                    </td>
                                    <td colSpan={2} className="p-1.5 px-3 text-right font-bold text-sm tracking-wider">
                                        ₩ {totalAmount.toLocaleString()}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>

                        <div className="text-center font-bold text-sm tracking-widest mt-8 flex flex-col items-center">
                            <span>{formatDate(documentDate)}</span>
                        </div>
                    </div>

                    {finalDelegators.length > 0 && pagedDelegators.map((pageWorkers, pageIndex) => {
                        const isLastPage = pageIndex === pagedDelegators.length - 1;
                        let pageGlobalWorkerIdx = pagedDelegators.slice(0, pageIndex).reduce((sum, p) => sum + p.length, 0);

                        return (
                            <React.Fragment key={`page-${pageIndex}`}>
                                <div className="delegation-letter-page flex flex-col justify-between" onClick={() => setMeasureTick(t => t + 1)}>
                                    <div className="delegation-letter-body">
                                        {pageIndex === 0 && (
                                            <>
                                                {/* Title Header */}
                                                <div className="flex justify-center items-start mb-[4mm]">
                                                    <h2 className="text-[28px] font-bold tracking-[0.2em]">위 임 장</h2>
                                                </div>

                                                {/* Top Context Info */}
                                                <div className="flex justify-between items-end mb-[3mm] border-b-[1.5px] border-black pb-1.5 px-1">
                                                    <div className="text-[12px] font-semibold tracking-wide">
                                                        <span className="text-gray-600 mr-2">현장명:</span>
                                                        {sites.find(s => s.id === selectedSiteId)?.name || ''}
                                                    </div>
                                                    <div className="text-[12px] font-bold tracking-wider">
                                                        {yearLabel}년 {monthLabel}월 귀속
                                                    </div>
                                                </div>

                                                {/* Mandatary Info */}
                                                <div className="mb-[3mm]">
                                                    <div className="flex items-center gap-2 mb-1.5 font-bold text-[11px]">
                                                        <span className="bg-black text-white px-2 py-0.5 text-[10px] rounded-sm shadow-sm">수임인</span>
                                                        <span className="text-gray-600 font-normal">(노무비를 수령할 자)</span>
                                                    </div>
                                                    <table className="w-full border-collapse border-[1.5px] border-black text-[11px]">
                                                        <tbody>
                                                            <tr className="border-b border-black">
                                                                <th className="border-r border-black bg-gray-100 p-1.5 w-20 text-center font-bold">성 명</th>
                                                                <td className="border-r border-black p-1.5 relative h-10 w-40 text-center font-bold tracking-[0.2em] text-[13px]">
                                                                    <span className="block text-center pr-7">{mandataryInfo?.name}</span>
                                                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] tracking-normal">(인)</span>
                                                                </td>
                                                                <th className="border-r border-black bg-gray-100 p-1.5 w-24 text-center font-bold">주민등록번호</th>
                                                                <td className="p-1.5 text-center tracking-wider bg-yellow-50/10">{mandataryInfo?.idNumber}</td>
                                                            </tr>
                                                            <tr className="border-b border-black">
                                                                <th className="border-r border-black bg-gray-100 p-1.5 text-center">전화번호</th>
                                                                <td className="border-r border-black p-1.5 text-center">{mandataryInfo?.contact || ''}</td>
                                                                <th className="border-r border-black bg-gray-100 p-1.5 text-center">은행/계좌번호</th>
                                                                <td className="p-1.5 text-center font-bold text-[10px] bg-blue-50/10">
                                                                    {mandataryInfo ? `${mandataryInfo.bankName} ${mandataryInfo.accountNumber}` : ''}
                                                                    {mandataryInfo?.accountHolder && ` (예금주: ${mandataryInfo.accountHolder})`}
                                                                </td>
                                                            </tr>
                                                            <tr>
                                                                <th className="border-r border-black bg-gray-100 p-1.5 text-center leading-tight">주 소</th>
                                                                <td colSpan={3} className="p-1.5 text-[10px] leading-relaxed break-all">
                                                                    {mandataryInfo?.address}
                                                                </td>
                                                            </tr>
                                                        </tbody>
                                                    </table>
                                                </div>

                                                {/* Delegation Content */}
                                                <div className="mb-[3mm] border-[1.5px] border-black p-2.5 text-[12px] leading-relaxed text-center break-all bg-gray-50/50 shadow-inner">
                                                    위 사람을 대리인으로 정하여 <span className="font-bold underline underline-offset-[3px] decoration-gray-400 mx-1 px-1 bg-yellow-100/30">[{delegationText}]</span>을 위임합니다.
                                                </div>
                                            </>
                                        )}

                                        <div className="text-[11px] font-bold text-gray-700 mb-1.5 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="bg-black text-white px-2 py-0.5 text-[10px] rounded-sm shadow-sm">위임인</span>
                                                <span className="text-gray-500 font-normal">(노무비를 지급받을 자)</span>
                                            </div>
                                            {pagedDelegators.length > 1 && (
                                                <span className="text-[10px] text-gray-400 font-normal">Page {pageIndex + 1} / {pagedDelegators.length}</span>
                                            )}
                                        </div>

                                        <table className="w-full border-collapse border-[1.5px] border-black text-[10px] delegation-workers-table table-fixed">
                                            <thead>
                                                <tr className="border-b-[1.5px] border-black bg-gray-100">
                                                    <th className="border-r border-black p-1 w-7 text-center font-bold">No.</th>
                                                    <th className="border-r border-black p-1 w-[52px] text-center font-bold">성 명</th>
                                                    <th className="border-r border-black p-1 w-[100px] text-center font-bold">주민번호</th>
                                                    {showManDays && <th className="border-r border-black p-1 w-10 text-center font-bold">공수</th>}
                                                    <th className="border-r border-black p-1 w-[76px] text-center font-bold">주 소</th>
                                                    <th className="border-r border-black p-1 w-[72px] text-center font-bold">금 액</th>
                                                    <th className="p-1 w-[84px] text-center font-bold">서 명</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {pageWorkers.map((worker) => {
                                                    pageGlobalWorkerIdx += 1;
                                                    return (
                                                        <tr key={`print-${worker.workerId}`} className="border-b border-black hover:bg-gray-50/50 transition-colors">
                                                            <td className="border-r border-black p-1 text-center text-gray-400 font-medium">{pageGlobalWorkerIdx}</td>
                                                            <td className="border-r border-black p-1 font-bold tracking-[0.1em] text-center text-[11px]">{worker.workerName}</td>
                                                            <td className="border-r border-black p-1 text-center font-medium tracking-wider text-[10.5px]">{worker.idNumber}</td>
                                                            {showManDays && <td className="border-r border-black p-1 text-center text-gray-600 font-medium">{worker.manDays.toFixed(1)}</td>}
                                                            <td className="border-r border-black p-1 text-[8px] leading-snug break-all text-gray-700">
                                                                <div className="line-clamp-2">{worker.address || ''}</div>
                                                            </td>
                                                            <td className="border-r border-black p-1 px-1.5 text-right font-bold text-[11px] tracking-wide">
                                                                {worker.amount.toLocaleString()}
                                                            </td>
                                                            <td className="delegation-signature-cell align-middle">
                                                                {worker.signatureUrl ? (
                                                                    <div className="absolute inset-0 flex items-center justify-center p-1">
                                                                        <img src={worker.signatureUrl} alt={`Sign ${worker.workerName}`} className="max-h-full max-w-full object-contain pointer-events-none opacity-90 mix-blend-multiply" />
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex items-center justify-center h-full">
                                                                        <span className="text-[10px] tracking-widest text-gray-400 leading-none mr-2">(인)</span>
                                                                    </div>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                            {isLastPage && (
                                                <tfoot>
                                                    <tr className="bg-gray-100 border-t-[1.5px] border-black">
                                                        <td colSpan={showManDays ? 5 : 4} className="border-r border-black p-1.5 text-center font-bold text-[11px] tracking-[0.3em]">
                                                            합 계 가 준 <span className="text-gray-500 font-normal tracking-normal text-[10px] ml-1">(총원 : {finalDelegators.length}명)</span>
                                                        </td>
                                                        <td colSpan={2} className="p-1.5 px-3 text-right font-bold text-[13px] tracking-wider text-blue-900">
                                                            ₩ {totalAmount.toLocaleString()}
                                                        </td>
                                                    </tr>
                                                </tfoot>
                                            )}
                                        </table>
                                    </div>

                                    {isLastPage && (
                                        <div className="delegation-footer-date text-center">
                                            <span className="font-bold text-[13px] tracking-[0.2em]">{formatDate(documentDate)}</span>
                                        </div>
                                    )}
                                </div>
                                {!isLastPage && <div className="h-[20px] w-full print-gap no-print" />}
                            </React.Fragment>
                        );
                    })}

                    {finalDelegators.length === 0 && (
                        <div className="delegation-letter-page h-[297mm] flex flex-col justify-center items-center border-2 border-dashed border-gray-300 rounded-2xl bg-gray-50/50">
                            <div className="text-center opacity-40">
                                <FontAwesomeIcon icon={faFileAlt} className="text-6xl mb-4" />
                                <p className="text-lg font-bold">표시할 작업자가 없습니다.</p>
                                <p className="text-sm mt-2">왼쪽 패널에서 생성 조건을 설정하세요.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DelegationLetterV2Page;
