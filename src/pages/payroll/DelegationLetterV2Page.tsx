import React, { useState, useEffect, useMemo, useRef } from 'react';
import html2canvas from 'html2canvas';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faSpinner, faFileAlt, faBuilding, faUsers, faCalendarAlt,
    faCheckSquare, faSquare, faUserTie, faCopy, faEdit, faListAlt, faPrint, faSignature,
    faChevronDown, faChevronLeft, faChevronRight, faSearch
} from '@fortawesome/free-solid-svg-icons';
import { siteService, Site } from '../../services/siteService';
import { teamService, Team } from '../../services/teamService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { dailyReportService, DailyReport } from '../../services/dailyReportService';
import { companyService, Company } from '../../services/companyService';
import { YearMonthPicker } from '../../components/common/YearMonthPicker';
import SignatureGeneratorPage from './SignatureGeneratorPage';
import { DEFAULT_DELEGATION_BODY_TEXT } from '../../constants/delegationLetter';
import { delegationLetterTemplateService } from '../../services/delegationLetterTemplateService';

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

const DELEGATION_BODY_STORAGE_KEY = 'delegationLetterV2:bodyText';

const MAX_WORKERS_PER_PAGE = 24;
const DEFAULT_WORKERS_PER_PAGE = 24;
// The first page includes the mandatary block and the delegation text.  Reserve
// enough room for those sections plus the physical A4 bottom margin. This
// keeps the next worker row entirely on page 2 instead of clipping it at the
// bottom edge of page 1.
const FIRST_PAGE_RESERVED_ROWS = 10;

const clampWorkersPerPage = (value: number): number => {
    if (!Number.isFinite(value) || value <= 0) return 1;
    return Math.min(Math.floor(value), MAX_WORKERS_PER_PAGE);
};

const shiftYearMonth = (yearMonth: string, offset: number): string => {
    const matched = String(yearMonth ?? '').match(/^(\d{4})-(\d{2})$/);
    const baseDate = matched
        ? new Date(Number(matched[1]), Number(matched[2]) - 1 + offset, 1)
        : new Date();

    return `${baseDate.getFullYear()}-${String(baseDate.getMonth() + 1).padStart(2, '0')}`;
};

const DelegationLetterV2Page: React.FC = () => {
    // --- State: Selections ---
    const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));
    const [selectedSiteId, setSelectedSiteId] = useState<string>('');
    const [selectedTeamId, setSelectedTeamId] = useState<string>('');
    const [selectedLeaderId, setSelectedLeaderId] = useState<string>('');
    const [siteSearchQuery, setSiteSearchQuery] = useState<string>('');
    const [isSitePickerOpen, setIsSitePickerOpen] = useState(false);

    // --- State: Document Settings ---
    const [delegationText, setDelegationText] = useState<string>(() => {
        if (typeof window === 'undefined') return DEFAULT_DELEGATION_BODY_TEXT;
        const savedText = window.localStorage.getItem(DELEGATION_BODY_STORAGE_KEY);
        return savedText && savedText.trim().length > 0 ? savedText : DEFAULT_DELEGATION_BODY_TEXT;
    });
    const [documentDate, setDocumentDate] = useState<string>(new Date().toISOString().slice(0, 10));
    const [showManDays, setShowManDays] = useState<boolean>(false);
    const [workersPerPage, setWorkersPerPage] = useState<number>(DEFAULT_WORKERS_PER_PAGE);

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

    // --- State: UI ---
    const printRef = useRef<HTMLDivElement>(null);
    const publicTemplateLoadedRef = useRef(false);
    const sitePickerRef = useRef<HTMLDivElement>(null);
    const siteSearchInputRef = useRef<HTMLInputElement>(null);
    const [activeTab, setActiveTab] = useState<'filter' | 'document' | 'workers' | 'signature'>('filter');

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

    useEffect(() => {
        const unsubscribe = manpowerService.subscribeWorkers((workers) => {
            setAllWorkers(workers);
        });
        return unsubscribe;
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const trimmedText = delegationText.trim();
        if (!trimmedText) {
            window.localStorage.removeItem(DELEGATION_BODY_STORAGE_KEY);
            return;
        }
        window.localStorage.setItem(DELEGATION_BODY_STORAGE_KEY, delegationText);
    }, [delegationText]);

    useEffect(() => {
        let alive = true;
        void delegationLetterTemplateService.getPublicTemplate()
            .then((template) => {
                if (alive && template?.bodyText) setDelegationText(template.bodyText);
            })
            .catch((error) => {
                console.warn('Unable to load the shared delegation template:', error);
            })
            .finally(() => {
                if (alive) publicTemplateLoadedRef.current = true;
            });
        return () => {
            alive = false;
        };
    }, []);

    useEffect(() => {
        if (!publicTemplateLoadedRef.current || !delegationText.trim()) return;
        const timer = window.setTimeout(() => {
            void delegationLetterTemplateService.savePublicTemplate(delegationText)
                .catch((error) => console.warn('Unable to save the shared delegation template:', error));
        }, 600);
        return () => window.clearTimeout(timer);
    }, [delegationText]);

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
        // "외부팀"(siteType이 '외부팀' 또는 partnerName에 '외부' 포함) 제외
        return sites
            .filter(s => {
            if (!siteIdsInReports.has(s.id!)) return false;
            // siteType이 '외부팀'이거나 partnerName에 '외부'가 포함되면 제외
            if (String(s.siteType ?? '').includes('외부팀')) return false;
            if (String(s.partnerName ?? '').includes('외부')) return false;
            return true;
            })
            .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko-KR', { numeric: true, sensitivity: 'base' }));
    }, [allReports, sites]);

    const filteredActiveSites = useMemo(() => {
        const query = siteSearchQuery.trim().toLocaleLowerCase('ko-KR');
        if (!query) return activeSites;

        return activeSites.filter((site) => [site.name, site.partnerName, site.siteType]
            .some((value) => String(value ?? '').toLocaleLowerCase('ko-KR').includes(query)));
    }, [activeSites, siteSearchQuery]);

    useEffect(() => {
        if (!isSitePickerOpen) return;

        const closeSitePicker = (event: MouseEvent) => {
            if (!sitePickerRef.current?.contains(event.target as Node)) {
                setIsSitePickerOpen(false);
                setSiteSearchQuery('');
            }
        };

        document.addEventListener('mousedown', closeSitePicker);
        siteSearchInputRef.current?.focus();

        return () => document.removeEventListener('mousedown', closeSitePicker);
    }, [isSitePickerOpen]);

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

    const selectSite = (siteId: string) => {
        setSelectedSiteId(siteId);
        setSelectedTeamId('');
        setSiteSearchQuery('');
        setIsSitePickerOpen(false);
    };

    const navigateMonth = (offset: number) => {
        setSelectedMonth((currentMonth) => shiftYearMonth(currentMonth, offset));
    };

    const handleSignatureSaved = (workerId: string, newUrl: string) => {
        const savedWorkerId = String(workerId ?? '').trim();
        if (!savedWorkerId) return;

        setAllWorkers(prev => prev.map(worker => {
            const id = String(worker.id ?? '').trim();
            const legacyId = String(worker.legacyId ?? '').trim();
            if (id !== savedWorkerId && legacyId !== savedWorkerId) return worker;
            return { ...worker, signatureUrl: newUrl };
        }));

        setDelegationWorkers(prev => prev.map(worker =>
            worker.workerId === savedWorkerId
                ? { ...worker, signatureUrl: newUrl }
                : worker
        ));
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

    const normalizeCompanyNameKey = (value?: string | null): string =>
        String(value ?? '').replace(/\s+/g, '').toLowerCase();

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

    const constructionCompanies = useMemo(() => {
        return companies
            .filter((company) => String(company.type ?? '').trim() === '시공사')
            .sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? ''), 'ko'));
    }, [companies]);

    const constructionCompanyIdSet = useMemo(() => {
        return new Set(
            constructionCompanies
                .map((company) => String(company.id ?? '').trim())
                .filter(Boolean)
        );
    }, [constructionCompanies]);

    const constructionCompanyNameKeySet = useMemo(() => {
        return new Set(
            constructionCompanies
                .map((company) => normalizeCompanyNameKey(company.name))
                .filter(Boolean)
        );
    }, [constructionCompanies]);

    const mandataryTeams = useMemo(() => {
        return teams
            .filter((team) => {
                const teamCompanyId = String(team.companyId ?? '').trim();
                if (teamCompanyId && constructionCompanyIdSet.has(teamCompanyId)) return true;

                const teamCompanyNameKey = normalizeCompanyNameKey(team.companyName);
                if (teamCompanyNameKey && constructionCompanyNameKeySet.has(teamCompanyNameKey)) return true;

                return false;
            })
            .sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? ''), 'ko'));
    }, [constructionCompanyIdSet, constructionCompanyNameKeySet, teams]);

    const mandataryCompanyOptions = useMemo(() => {
        return constructionCompanies
            .filter((company) => String(company.id ?? '').trim())
            .map((company) => ({
                key: `company__${String(company.id ?? '').trim()}`,
                company
            }));
    }, [constructionCompanies]);

    const mandataryTeamLeaderOptions = useMemo(() => {
        return mandataryTeams
            .map((team) => {
                const teamLeader = team.leaderId ? allWorkers.find((worker) => worker.id === team.leaderId) : undefined;
                const fallbackLeader = allWorkers.find((worker) => worker.teamId === team.id && worker.role === '팀장');
                const leader = teamLeader ?? fallbackLeader;
                if (!leader?.id) return null;

                const companyLabel = String(team.companyName ?? '').trim() || '시공사';
                return {
                    key: leader.id,
                    label: `${companyLabel} · ${team.name} 팀장 (${leader.name})`
                };
            })
            .filter((option): option is { key: string; label: string } => option !== null);
    }, [allWorkers, mandataryTeams]);

    const selectedMandataryCompanyId = useMemo(() => {
        if (selectedLeaderId.startsWith('company__')) {
            return selectedLeaderId.slice('company__'.length).trim();
        }
        return selectedCompanyId;
    }, [selectedCompanyId, selectedLeaderId]);

    const selectedMandataryCompany = useMemo(() => {
        if (!selectedMandataryCompanyId) return null;
        return companies.find((company) => String(company.id ?? '').trim() === selectedMandataryCompanyId) ?? null;
    }, [companies, selectedMandataryCompanyId]);

    const selectedSiteName = useMemo(() => {
        if (!selectedSiteId) return '';
        return sites.find((s) => s.id === selectedSiteId)?.name || '';
    }, [sites, selectedSiteId]);

    const isCompanyMandatarySelected = selectedLeaderId.startsWith('company__');

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

        if (isCompanyMandatarySelected && selectedMandataryCompany) {
            return {
                name: selectedMandataryCompany.ceoName || '',
                idNumber: selectedMandataryCompany.ceoResidentNumber || '',
                address: selectedMandataryCompany.address || '',
                contact: selectedMandataryCompany.phone || '',
                signatureUrl: undefined as string | undefined,
                bankName: selectedMandataryCompany.bankName || '',
                accountNumber: selectedMandataryCompany.accountNumber || '',
                accountHolder: selectedMandataryCompany.accountHolder || selectedMandataryCompany.ceoName || ''
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
    }, [isCompanyMandatarySelected, mandataryWorker, selectedMandataryCompany, selectedLeaderId,
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

    const pagedDelegators = useMemo(() => {
        if (finalDelegators.length === 0) return [] as DelegationWorker[][];

        const cappedWorkersPerPage = clampWorkersPerPage(workersPerPage);
        const mandataryAddress = String(mandataryInfo?.address || '');
        const firstPageReserve = Math.min(
            cappedWorkersPerPage - 1,
            FIRST_PAGE_RESERVED_ROWS +
            (showManDays ? 1 : 0) +
            (mandataryAddress.length > 35 || delegationText.length > 90 ? 2 : 0)
        );
        const firstPageWorkers = Math.max(1, cappedWorkersPerPage - firstPageReserve);

        if (finalDelegators.length <= firstPageWorkers) {
            return [finalDelegators];
        }

        const pages: DelegationWorker[][] = [finalDelegators.slice(0, firstPageWorkers)];
        const rest = finalDelegators.slice(firstPageWorkers);
        pages.push(...chunkArray(rest, cappedWorkersPerPage));
        return pages;
    }, [delegationText, finalDelegators, mandataryInfo, showManDays, workersPerPage]);

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
                    #main-header,
                    #sidebar,
                    #bottom-panel,
                    #submenu-panel,
                    .cheongyeon-header,
                    .cheongyeon-top-nav,
                    .cheongyeon-top-nav-dropdown,
                    .cheongyeon-header-logo,
                    .header-right-group,
                    .profile-menu-container,
                    .mobile-logo-area,
                    .header-left-group,
                    .header-btn {
                        display: none !important;
                        visibility: hidden !important;
                    }
                    .app > #main-header,
                    .app > #sidebar {
                        display: none !important;
                    }
                    #main-content {
                        margin: 0 !important;
                        padding: 0 !important;
                        top: 0 !important;
                        left: 0 !important;
                        width: 100% !important;
                        min-height: auto !important;
                        overflow: visible !important;
                        position: static !important;
                    }
                    .app > * {
                        display: none !important;
                    }
                    .app > #main-content {
                        display: block !important;
                    }
                    #main-content > * {
                        display: none !important;
                    }
                    #main-content .delegation-page-root {
                        display: block !important;
                    }
                    body * {
                        visibility: hidden !important;
                    }
                    .print-only-region,
                    .print-only-region * {
                        visibility: visible !important;
                    }
                    html, body, #root {
                        width: auto !important;
                        min-height: 100% !important;
                        height: auto !important;
                        overflow: visible !important;
                    }
                    .app {
                        display: block !important;
                        min-height: auto !important;
                        overflow: visible !important;
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
                    .delegation-page-root > * {
                        display: none !important;
                    }
                    .delegation-page-root .print-area-wrapper {
                        display: block !important;
                    }
                    .print-area-wrapper {
                        width: 210mm !important;
                        max-width: 210mm !important;
                        padding: 0 !important;
                        margin: 0 auto !important;
                        background: white !important;
                        border: none !important;
                        border-radius: 0 !important;
                        overflow: visible !important;
                    }
                    .print-area-wrapper > div {
                        box-shadow: none !important;
                        margin: 0 auto !important;
                    }

                    .print-only-region {
                        position: static !important;
                        inset: auto !important;
                        width: 210mm !important;
                        max-width: 210mm !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        background: white !important;
                        z-index: auto !important;
                        overflow: visible !important;
                    }

                    .delegation-letter {
                        width: 210mm !important;
                        max-width: 210mm !important;
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
                        padding: 12mm 12mm 10mm !important;
                        margin: 0 !important;
                        overflow: hidden !important;
                        background: white !important;
                        display: flex !important;
                        flex-direction: column !important;
                        justify-content: space-between !important;
                        break-after: page;
                        break-inside: avoid-page;
                        page-break-inside: avoid;
                        page-break-after: always;
                    }

                    .delegation-letter-page:last-child {
                        break-after: auto;
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
                    .delegation-document-date {
                        flex: 0 0 auto;
                        margin: 0 0 3mm;
                        text-align: center;
                        font-size: 12px;
                        font-weight: 700;
                        letter-spacing: 0.2em;
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
                <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-white/10 p-2 grid grid-cols-2 gap-2">
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
                    <button
                        onClick={() => setActiveTab('signature')}
                        className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === 'signature'
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        <FontAwesomeIcon icon={faSignature} className="mr-2" />
                        서명
                    </button>
                </div>

                {/* Content Card */}
                <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-white/10 p-5 shadow-2xl flex-1 min-h-0 overflow-visible flex flex-col">
                    {/* Filter Tab */}
                    {activeTab === 'filter' && (
                        <div className="space-y-5 h-full min-h-0 flex flex-col">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-1.5 h-6 rounded-full bg-blue-500"></div>
                                <h3 className="text-white font-semibold">기간 및 현장 선택</h3>
                            </div>

                            {/* Month */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">근무 월</label>
                                <div className="flex items-center overflow-hidden rounded-xl border border-slate-600/50 bg-slate-700/50 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
                                    <button
                                        type="button"
                                        onClick={() => navigateMonth(-1)}
                                        aria-label="이전 달"
                                        title="이전 달"
                                        className="px-4 py-2.5 text-slate-300 hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-300 transition-colors"
                                    >
                                        <FontAwesomeIcon icon={faChevronLeft} />
                                    </button>
                                    <div className="relative flex-1 min-w-0 border-x border-slate-600/50">
                                        <FontAwesomeIcon icon={faCalendarAlt} className="pointer-events-none absolute left-3 top-3 text-slate-500" />
                                        <YearMonthPicker
                                            value={selectedMonth}
                                            onChange={setSelectedMonth}
                                            ariaLabel="근무 월 선택"
                                            inputClassName="w-full border-0 bg-transparent py-2.5 pl-9 pr-3 text-center font-semibold text-white placeholder-slate-500 outline-none"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => navigateMonth(1)}
                                        aria-label="다음 달"
                                        title="다음 달"
                                        className="px-4 py-2.5 text-slate-300 hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-300 transition-colors"
                                    >
                                        <FontAwesomeIcon icon={faChevronRight} />
                                    </button>
                                </div>
                            </div>

                            {/* Site */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">현장 선택</label>
                                <div ref={sitePickerRef} className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setIsSitePickerOpen((isOpen) => !isOpen)}
                                        disabled={loading || activeSites.length === 0}
                                        aria-haspopup="listbox"
                                        aria-expanded={isSitePickerOpen}
                                        className="flex w-full items-center gap-3 rounded-xl border border-slate-600/50 bg-slate-700/50 px-4 py-2.5 text-left text-white outline-none transition-all hover:border-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        <FontAwesomeIcon icon={faBuilding} className="text-slate-500" />
                                        <span className={`min-w-0 flex-1 truncate ${selectedSiteName ? 'text-white' : 'text-slate-400'}`}>
                                            {selectedSiteName || (loading ? '데이터 조회 중...' : '현장 선택')}
                                        </span>
                                        <FontAwesomeIcon icon={faChevronDown} className={`text-xs text-slate-400 transition-transform ${isSitePickerOpen ? 'rotate-180' : ''}`} />
                                    </button>

                                    {isSitePickerOpen && (
                                        <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-slate-600 bg-slate-800 shadow-2xl">
                                            <div className="border-b border-slate-700 p-2">
                                                <label className="relative block">
                                                    <FontAwesomeIcon icon={faSearch} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                                    <input
                                                        ref={siteSearchInputRef}
                                                        type="search"
                                                        value={siteSearchQuery}
                                                        onChange={(event) => setSiteSearchQuery(event.target.value)}
                                                        onKeyDown={(event) => {
                                                            if (event.key === 'Escape') {
                                                                setIsSitePickerOpen(false);
                                                                setSiteSearchQuery('');
                                                            }
                                                        }}
                                                        placeholder="현장명으로 검색"
                                                        aria-label="현장 검색"
                                                        className="w-full rounded-lg border border-slate-600 bg-slate-900/70 py-2 pl-9 pr-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                                    />
                                                </label>
                                            </div>
                                            <div className="max-h-56 overflow-y-auto p-1.5" role="listbox" aria-label="현장 목록">
                                                {filteredActiveSites.length > 0 ? filteredActiveSites.map((site) => (
                                                    <button
                                                        key={site.id}
                                                        type="button"
                                                        role="option"
                                                        aria-selected={site.id === selectedSiteId}
                                                        onClick={() => selectSite(site.id || '')}
                                                        className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${site.id === selectedSiteId
                                                            ? 'bg-blue-600 text-white'
                                                            : 'text-slate-200 hover:bg-slate-700 hover:text-white'
                                                            }`}
                                                    >
                                                        <FontAwesomeIcon icon={faBuilding} className="text-xs opacity-70" />
                                                        <span className="min-w-0 flex-1 truncate">{site.name}</span>
                                                        {site.partnerName && <span className="truncate text-xs opacity-60">{site.partnerName}</span>}
                                                    </button>
                                                )) : (
                                                    <p className="px-3 py-5 text-center text-sm text-slate-400">검색 결과가 없습니다.</p>
                                                )}
                                            </div>
                                        </div>
                                    )}
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
                                        {mandataryCompanyOptions.length > 0 && (
                                            <optgroup label="회사 대표">
                                                {mandataryCompanyOptions.map(({ key, company }) => (
                                                    <option key={key} value={key}>
                                                        {company.name} 대표 ({company.ceoName || '대표'})
                                                    </option>
                                                ))}
                                            </optgroup>
                                        )}
                                        <optgroup label="시공사 팀장">
                                            {mandataryTeamLeaderOptions.map((option) => (
                                                <option key={option.key} value={option.key}>
                                                    {option.label}
                                                </option>
                                            ))}
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
                                <div className="mt-2 flex-1 min-h-0 flex flex-col">
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
                                    <div className="flex-1 min-h-[260px] overflow-y-auto space-y-1.5 pr-1">
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
                        <div className="space-y-5 h-full overflow-y-auto pr-1">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-1.5 h-6 rounded-full bg-purple-500"></div>
                                <h3 className="text-white font-semibold">위임장 문서 설정</h3>
                            </div>

                            {/* Delegation Text */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    <FontAwesomeIcon icon={faEdit} className="mr-2 text-purple-400" />
                                    위임장 본문 내용
                                </label>
                                <textarea
                                    value={delegationText}
                                    onChange={(e) => setDelegationText(e.target.value)}
                                    rows={7}
                                    className="w-full bg-slate-700/50 border border-slate-600/50 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all resize-none"
                                    placeholder="업체 요구 문구(예: 민/형사상 책임, 이의 제기 불가 등)를 포함해 본문 전체를 입력하세요"
                                />
                                <p className="text-xs text-slate-500 mt-2">
                                    입력한 본문은 자동 저장되며, 수정하기 전까지 계속 동일 문구가 표시됩니다.
                                </p>
                            </div>

                            <div className="bg-slate-700/30 rounded-xl p-4 border border-slate-600/30">
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    <FontAwesomeIcon icon={faCalendarAlt} className="mr-2 text-purple-400" />
                                    작성날짜
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
                                        <p className="text-slate-500 text-xs">2페이지 이후 기준입니다. 첫 페이지는 상단 정보 높이에 맞춰 자동으로 줄어듭니다.</p>
                                    </div>
                                    <input
                                        type="number"
                                        min={1}
                                        max={MAX_WORKERS_PER_PAGE}
                                        value={workersPerPage}
                                        onChange={(e) => {
                                            const next = Number(e.target.value);
                                            setWorkersPerPage(clampWorkersPerPage(next));
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
                                        onClick={() => setDelegationText(DEFAULT_DELEGATION_BODY_TEXT)}
                                        className="px-3 py-1.5 bg-purple-600/30 text-purple-300 text-xs rounded-lg hover:bg-purple-600/50 transition-colors"
                                    >
                                        기본 문구
                                    </button>
                                    <button
                                        onClick={() => setDelegationText('상기 수임인을 대리인으로 정하여 급여 청구 및 수령에 관한 모든 권한을 위임합니다.\n또한 수임인에게 지급된 금액은 위임인에게 직접 지급된 것으로 간주하며, 위임인은 민형사상 이의를 포함한 어떠한 이의도 제기하지 않겠습니다.')}
                                        className="px-3 py-1.5 bg-purple-600/30 text-purple-300 text-xs rounded-lg hover:bg-purple-600/50 transition-colors"
                                    >
                                        급여 수령 + 민형사
                                    </button>
                                    <button
                                        onClick={() => setDelegationText('상기 수임인을 대리인으로 정하여 일용직 노무비 청구 및 수령에 관한 모든 권한을 위임합니다.\n수임인에게 지급된 금액은 위임인에게 직접 지급된 것으로 간주하며, 위임인은 추후 정산, 민형사상 책임 및 기타 분쟁을 사유로 어떠한 이의도 제기하지 않겠습니다.')}
                                        className="px-3 py-1.5 bg-purple-600/30 text-purple-300 text-xs rounded-lg hover:bg-purple-600/50 transition-colors"
                                    >
                                        일용직 + 분쟁 방지
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Workers Tab */}
                    {activeTab === 'workers' && (
                        <div className="space-y-4 h-full min-h-0 flex flex-col">
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
                            <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
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

                    {activeTab === 'signature' && (
                        <div className="space-y-4 h-full min-h-0 flex flex-col">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-1.5 h-6 rounded-full bg-indigo-500"></div>
                                <h3 className="text-white font-semibold">서명 등록</h3>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-slate-700/30 rounded-xl p-4 border border-slate-600/30">
                                    <p className="text-slate-400 text-xs mb-1">전체 서명</p>
                                    <p className="text-white font-bold text-lg">{allWorkers.filter(worker => worker.signatureUrl).length}명</p>
                                </div>
                                <div className="bg-slate-700/30 rounded-xl p-4 border border-slate-600/30">
                                    <p className="text-slate-400 text-xs mb-1">현재 명단</p>
                                    <p className="text-indigo-300 font-bold text-lg">
                                        {delegationWorkers.filter(worker => worker.signatureUrl).length}/{delegationWorkers.length}명
                                    </p>
                                </div>
                            </div>

                            <div className="bg-indigo-600/10 rounded-xl p-4 border border-indigo-500/20">
                                <p className="text-indigo-200 text-sm font-medium">오른쪽 패널에서 서명 등록 페이지를 바로 사용할 수 있습니다.</p>
                                <p className="text-slate-400 text-xs mt-2">저장된 서명은 위임장 미리보기에 즉시 반영됩니다.</p>
                            </div>
                        </div>
                    )}
                </div>

                {activeTab !== 'signature' && (
                    <>
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
                    </>
                )}
            </div>

            {activeTab === 'signature' ? (
                <div className="flex-1 min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 no-print">
                    <SignatureGeneratorPage
                        embedded
                        className="rounded-2xl"
                        onSignatureSaved={handleSignatureSaved}
                    />
                </div>
            ) : (
            <div className="flex-1 bg-[#efebe2] overflow-auto rounded-2xl p-4 lg:p-8 flex justify-center border border-[#d8d1c3] print-area-wrapper">
                <div
                    ref={printRef}
                    className="bg-white shadow-xl mx-auto box-border delegation-letter print-only-region"
                >
                    <style>{`
                        .delegation-letter-page {
                            width: 210mm;
                            height: 297mm;
                            min-height: 297mm;
                            position: relative;
                            background-color: white;
                            padding: 12mm 12mm 10mm;
                            box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
                            margin: 0 auto 20px auto;
                            box-sizing: border-box;
                            overflow: hidden;
                            display: flex;
                            flex-direction: column;
                            justify-content: space-between;
                            break-after: page;
                            page-break-after: always;
                        }

                        .delegation-title {
                            text-align: center;
                            font-size: 30px;
                            font-weight: 700;
                            letter-spacing: 0.55em;
                            margin-bottom: 5mm;
                        }

                        .delegation-meta-table {
                            width: 100%;
                            border-collapse: collapse;
                            border: 1.5px solid #111;
                            margin-bottom: 3.2mm;
                            font-size: 11px;
                        }

                        .delegation-meta-table th,
                        .delegation-meta-table td {
                            border: 1px solid #111;
                            padding: 1.6mm 2mm;
                            vertical-align: middle;
                        }

                        .delegation-meta-table th {
                            width: 18mm;
                            text-align: center;
                            font-weight: 700;
                            background: #f3f2ef;
                        }

                        .delegation-section-title {
                            display: inline-block;
                            border: 1.5px solid #111;
                            padding: 0.7mm 2.8mm;
                            font-size: 11px;
                            font-weight: 700;
                            margin-bottom: 1.6mm;
                            background: #f7f7f5;
                        }

                        .delegation-mandatary-table {
                            width: 100%;
                            border-collapse: collapse;
                            border: 1.5px solid #111;
                            font-size: 11px;
                        }

                        .delegation-mandatary-table tr {
                            height: 11mm;
                        }

                        .delegation-body-paragraph {
                            border: 1.5px solid #111;
                            padding: 3.2mm 3.5mm;
                            margin-bottom: 3mm;
                            text-align: justify;
                            line-height: 1.7;
                            font-size: 11px;
                        }

                        .delegation-underline {
                            border-bottom: 1px solid #111;
                            font-weight: 700;
                            padding: 0 2px;
                            display: inline-block;
                        }

                        .delegation-document-date {
                            flex: 0 0 auto;
                            margin: 0 0 3mm;
                            text-align: center;
                            font-size: 12px;
                            font-weight: 700;
                            letter-spacing: 0.2em;
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
                            height: 10mm;
                            padding: 0 !important;
                            overflow: hidden;
                        }

                        .delegation-signature-cell > div,
                        .delegation-signature-cell img {
                            width: 100%;
                            height: 100%;
                        }

                        @media print {
                            .delegation-letter-page {
                                margin: 0 auto;
                                box-shadow: none;
                            }
                            .delegation-letter-page:last-child {
                                break-after: auto;
                                page-break-after: auto;
                            }
                            .print-gap { display: none !important; }
                        }
                    `}</style>

                    {finalDelegators.length > 0 && pagedDelegators.map((pageWorkers, pageIndex) => {
                        const isLastPage = pageIndex === pagedDelegators.length - 1;
                        let pageGlobalWorkerIdx = pagedDelegators.slice(0, pageIndex).reduce((sum, p) => sum + p.length, 0);

                        return (
                            <React.Fragment key={`page-${pageIndex}`}>
                                <div className="delegation-letter-page flex flex-col justify-between">
                                    <div className="delegation-letter-body">
                                        {pageIndex === 0 && (
                                            <>
                                                <h2 className="delegation-title">위 임 장</h2>

                                                <table className="delegation-meta-table">
                                                    <tbody>
                                                        <tr>
                                                            <th>현장명</th>
                                                            <td className="font-semibold tracking-wide">{selectedSiteName}</td>
                                                            <th>귀속년월</th>
                                                            <td className="text-center font-semibold tracking-wider">20{yearLabel}년 {monthLabel}월</td>
                                                        </tr>
                                                    </tbody>
                                                </table>

                                                {/* Mandatary Info */}
                                                <div className="mb-[3mm]">
                                                    <div className="delegation-section-title">수임인 (노무비를 수령할 자)</div>
                                                    <table className="delegation-mandatary-table">
                                                        <tbody>
                                                            <tr className="border-b border-black">
                                                                <th className="border-r border-black bg-[#f3f2ef] p-1.5 w-20 text-center font-bold">성 명</th>
                                                                <td className="border-r border-black p-1.5 relative w-40 text-center font-bold tracking-[0.2em] text-[13px]">
                                                                    <span className="block text-center pr-7">{mandataryInfo?.name}</span>
                                                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] tracking-normal">(인)</span>
                                                                </td>
                                                                <th className="border-r border-black bg-[#f3f2ef] p-1.5 w-24 text-center font-bold">주민등록번호</th>
                                                                <td className="p-1.5 text-center font-bold tracking-wider text-[13px]">{mandataryInfo?.idNumber}</td>
                                                            </tr>
                                                            <tr className="border-b border-black">
                                                                <th className="border-r border-black bg-[#f3f2ef] p-1.5 text-center">전화번호</th>
                                                                <td className="border-r border-black p-1.5 text-center font-bold text-[13px]">{mandataryInfo?.contact || ''}</td>
                                                                <th className="border-r border-black bg-[#f3f2ef] p-1.5 text-center">은행/계좌번호</th>
                                                                <td className="p-1.5 text-center font-bold text-[13px] leading-tight break-all">
                                                                    {mandataryInfo ? `${mandataryInfo.bankName} ${mandataryInfo.accountNumber}` : ''}
                                                                    {mandataryInfo?.accountHolder && ` (예금주: ${mandataryInfo.accountHolder})`}
                                                                </td>
                                                            </tr>
                                                            <tr>
                                                                <th className="border-r border-black bg-[#f3f2ef] p-1.5 text-center leading-tight">주 소</th>
                                                                <td colSpan={3} className="p-1.5 text-[13px] leading-relaxed break-all font-bold">
                                                                    {mandataryInfo?.address}
                                                                </td>
                                                            </tr>
                                                        </tbody>
                                                    </table>
                                                </div>

                                                {/* Delegation Content */}
                                                <div className="delegation-body-paragraph !mb-[3mm] !text-[11px] whitespace-pre-line">
                                                    {delegationText.trim() || DEFAULT_DELEGATION_BODY_TEXT}
                                                </div>
                                                <div className="delegation-document-date">
                                                    {formatDate(documentDate)}
                                                </div>
                                            </>
                                        )}

                                        <div className="text-[11px] font-bold text-gray-700 mb-1.5 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="delegation-section-title !mb-0">위임인 (노무비를 지급받을 자)</span>
                                            </div>
                                            {pagedDelegators.length > 1 && (
                                                <span className="text-[10px] text-gray-400 font-normal">Page {pageIndex + 1} / {pagedDelegators.length}</span>
                                            )}
                                        </div>

                                        <table className="w-full border-collapse border-[1.5px] border-black text-[10px] delegation-workers-table table-fixed">
                                            <thead>
                                                <tr className="border-b-[1.5px] border-black bg-[#f3f2ef]">
                                                    <th className="border-r border-black p-1 w-6 text-center font-bold">No.</th>
                                                    <th className="border-r border-black p-1 w-[38px] text-center font-bold">성 명</th>
                                                    <th className="border-r border-black p-1 w-[72px] text-center font-bold">주민번호</th>
                                                    {showManDays && <th className="border-r border-black p-1 w-10 text-center font-bold">공수</th>}
                                                    <th className="border-r border-black p-1 w-[200px] text-center font-bold">주 소</th>
                                                    <th className="border-r border-black p-1 w-[41px] text-center font-bold">금 액</th>
                                                    <th className="p-1 w-[67px] text-center font-bold">서 명</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {pageWorkers.map((worker) => {
                                                    pageGlobalWorkerIdx += 1;
                                                    return (
                                                        <tr key={`print-${worker.workerId}`} className="border-b border-black">
                                                            <td className="border-r border-black p-1 text-center font-normal text-black">{pageGlobalWorkerIdx}</td>
                                                            <td className="border-r border-black p-1 font-normal tracking-[0.08em] text-center text-[10px]">{worker.workerName}</td>
                                                            <td className="border-r border-black p-1 text-center font-normal tracking-wider text-[10.5px]">{worker.idNumber}</td>
                                                            {showManDays && <td className="border-r border-black p-1 text-center text-gray-600 font-normal">{worker.manDays.toFixed(1)}</td>}
                                                            <td className="border-r border-black p-1 text-[9px] leading-snug break-all font-normal text-black">
                                                                <div className="line-clamp-2">{worker.address || ''}</div>
                                                            </td>
                                                            <td className="border-r border-black p-1 px-1 text-right font-normal text-[10px] tracking-wide">
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
                                                    <tr className="bg-[#f3f2ef] border-t-[1.5px] border-black">
                                                        <td colSpan={showManDays ? 5 : 4} className="border-r border-black p-1.5 text-center font-bold text-[11px] tracking-[0.3em]">
                                                            합 계 <span className="text-gray-500 font-normal tracking-normal text-[10px] ml-1">(총원 : {finalDelegators.length}명)</span>
                                                        </td>
                                                        <td colSpan={2} className="p-1.5 px-3 text-right font-bold text-[13px] tracking-wider text-black">
                                                            금 {totalAmount.toLocaleString()} 원
                                                        </td>
                                                    </tr>
                                                </tfoot>
                                            )}
                                        </table>
                                    </div>
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
            )}
        </div>
    );
};

export default DelegationLetterV2Page;
