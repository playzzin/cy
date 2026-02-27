import React, { useState, useEffect, useMemo, useRef } from 'react';
import html2canvas from 'html2canvas';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faCopy, faPrint, faGripVertical, faPlus, faTrash, faCheckSquare, faSquare, faCalendarAlt, faFileAlt, faUserTie, faCog, faUsers, faCloudUploadAlt, faArrowsRotate } from '@fortawesome/free-solid-svg-icons';
import { manpowerService, Worker } from '../../services/manpowerService';
import { siteService, Site } from '../../services/siteService';
import { dailyReportService } from '../../services/dailyReportService';
import { toast } from '../../utils/swal';
import { YearMonthPicker } from '../../components/common/YearMonthPicker';
import { Building2 } from 'lucide-react';

// --- Types ---
interface TrusteeInfo {
    name: string;
    idNumber: string;
    address: string;
    contact: string;
    signature: string;
    bankName: string;
    accountNumber: string;
    accountHolder: string;
}

interface DelegatorItem {
    id: string; // matches Worker ID
    name: string;
    idNumber: string;
    address: string;
    unitPrice: number;
    workDays: number;
    claimAmount: number;
    signature: string;
    phoneNumber?: string;
}

type BlockType = 'header' | 'trustee' | 'content' | 'bank' | 'delegators';

interface Block {
    id: string;
    type: BlockType;
    content?: string; // For 'content' blocks
    settings?: {
        minHeight?: number;
        widths?: { [key: string]: number };
    };
    contentOverrides?: { [key: string]: string };
}

// --- Helper Components ---

// Simple Display Text Component (Read-only - always displays value)
const DisplayText: React.FC<{
    value: string;
    placeholder?: string;
    className?: string;
}> = ({ value, placeholder, className }) => {
    return <span className={className || ''}>{value || placeholder}</span>;
};

// EditableText - now just displays value (read-only mode)
const EditableText: React.FC<{
    value: string;
    onChange?: (val: string) => void;
    isEditMode?: boolean;
    placeholder?: string;
    className?: string;
}> = ({ value, placeholder, className }) => {
    return <span className={className || ''}>{value || placeholder}</span>;
};

// Sortable Block Wrapper (simplified - no DnD)
const SortableBlock: React.FC<{
    block: Block;
    isEditMode?: boolean;
    onRemove?: (id: string) => void;
    children: React.ReactNode;
}> = ({ children }) => {
    return <div className="relative">{children}</div>;
};


// --- Main Page Component ---

// Print specific styles
const PrintStyle = () => (
    <style>{`
        @media print {
            @page {
                size: A4;
                margin: 0;
            }
            body {
                background: white;
            }
            .print\\:hidden {
                display: none !important;
            }
            /* Ensure background graphics are printed if needed */
            * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
        }
    `}</style>
);

const DelegationLetterV2Page: React.FC = () => {
    // --- State: Global ---
    const [loading, setLoading] = useState(true);
    const [allWorkers, setAllWorkers] = useState<Worker[]>([]);

    // --- State: Settings ---
    const [year, setYear] = useState<number>(() => {
        const saved = localStorage.getItem('delegation_v2_year');
        return saved ? Number(saved) : new Date().getFullYear();
    });
    const [month, setMonth] = useState<number>(() => {
        const saved = localStorage.getItem('delegation_v2_month');
        return saved ? Number(saved) : new Date().getMonth() + 1;
    });
    const [trustee, setTrustee] = useState<TrusteeInfo>(() => {
        const saved = localStorage.getItem('delegation_v2_trustee');
        return saved ? JSON.parse(saved) : {
            name: '', idNumber: '', address: '', contact: '', signature: '',
            bankName: '', accountNumber: '', accountHolder: ''
        };
    });

    // --- State: Layout & Content ---
    const [blocks, setBlocks] = useState<Block[]>(() => {
        const saved = localStorage.getItem('delegation_v2_blocks');
        return saved ? JSON.parse(saved) : [
            { id: 'header', type: 'header' },
            { id: 'trustee', type: 'trustee' },
            {
                id: 'content',
                type: 'content',
                content: '상기 위임인은 귀사(귀하)의 공사현장에서 ' + new Date().getFullYear() + '년 ' + (new Date().getMonth() + 1) + '월분 노무비(임금, 식대 및 기타 경비 포함)를 청구 및 수령하는 권한 일체를 수임인에게 위임하며, 수임인에게 지급된 노무비는 위임인에게 직접 지급된 것으로 간주하여, 추후 이에 대한 어떠한 이의도 제기하지 않을 것을 서명 또는 날인으로 각 서약합니다.'
            },
            {
                id: 'bank',
                type: 'bank',
                settings: {
                    widths: {
                        label_bank: 15, label_account: 15, label_holder: 15
                    }
                }
            },
            { id: 'delegators', type: 'delegators' }
        ];
    });

    // --- Persistence Effects ---
    useEffect(() => localStorage.setItem('delegation_v2_year', String(year)), [year]);
    useEffect(() => localStorage.setItem('delegation_v2_month', String(month)), [month]);
    useEffect(() => localStorage.setItem('delegation_v2_trustee', JSON.stringify(trustee)), [trustee]);
    useEffect(() => localStorage.setItem('delegation_v2_blocks', JSON.stringify(blocks)), [blocks]);

    // --- State: Workers & Selection ---
    const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>(() => {
        const saved = localStorage.getItem('delegation_v2_selected_ids');
        return saved ? JSON.parse(saved) : [];
    });
    const [delegators, setDelegators] = useState<DelegatorItem[]>(() => {
        const saved = localStorage.getItem('delegation_v2_delegators');
        return saved ? JSON.parse(saved) : [];
    });

    useEffect(() => localStorage.setItem('delegation_v2_delegators', JSON.stringify(delegators)), [delegators]);
    const [searchTerm, setSearchTerm] = useState('');
    const [batchUnitPrice, setBatchUnitPrice] = useState<number>(0);
    const [batchWorkDays, setBatchWorkDays] = useState<number>(0);

    const [sites, setSites] = useState<Site[]>([]);
    const [selectedSiteId, setSelectedSiteId] = useState<string>(() => {
        return localStorage.getItem('delegation_v2_site_id') || '';
    });

    useEffect(() => localStorage.setItem('delegation_v2_site_id', selectedSiteId), [selectedSiteId]);

    const [showManDays, setShowManDays] = useState<boolean>(true);
    const [activeTab, setActiveTab] = useState<'settings' | 'workers'>('settings');
    const [copying, setCopying] = useState(false);
    const printRef = useRef<HTMLDivElement>(null);

    // --- Effects ---
    useEffect(() => {
        const fetchInitialData = async () => {
            setLoading(true);
            try {
                const [workersData, sitesData] = await Promise.all([
                    manpowerService.getWorkers(),
                    siteService.getSites()
                ]);
                setAllWorkers(workersData);
                setSites(sitesData);
            } catch (error) {
                console.error('Failed to load data', error);
                toast.error('데이터 로드 실패: 정보를 불러오는 중 오류가 발생했습니다.');
            } finally {
                setLoading(false);
            }
        };
        fetchInitialData();
    }, []);

    // Load Workers from Site Logic
    const handleLoadSiteWorkers = async () => {
        if (!selectedSiteId) {
            toast.error('현장을 선택해주세요.');
            return;
        }

        if (!window.confirm(`${year}년 ${month}월 [${sites.find(s => s.id === selectedSiteId)?.name}] 현장 근무자를 불러오시겠습니까?\n기존 입력된 위임인 목록은 초기화됩니다.`)) {
            return;
        }

        setLoading(true);
        try {
            // Calculate date range
            const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
            const endDate = new Date(year, month, 0).toISOString().split('T')[0];

            // Fetch reports
            const reports = await dailyReportService.getReportsByRange(startDate, endDate);

            // Filter by site and aggregate workers
            const workerStats = new Map<string, { days: number }>();

            reports.forEach(report => {
                if (report.siteId !== selectedSiteId) return;

                report.workers.forEach(w => {
                    const wid = w.workerId;
                    if (!wid || wid.startsWith('unknown')) return; // Skip unknown workers
                    if (w.manDay <= 0) return; // Skip if no manday

                    const current = workerStats.get(wid) || { days: 0 };
                    current.days += w.manDay;
                    workerStats.set(wid, current);
                });
            });

            if (workerStats.size === 0) {
                toast.info('해당 기간/현장에 근무 기록이 없습니다.');
                setLoading(false);
                return;
            }

            // Map to Delegator Items
            const newDelegators: DelegatorItem[] = [];
            const newSelectedIds: string[] = [];

            for (const [wid, stats] of workerStats.entries()) {
                const worker = allWorkers.find(w => w.id === wid);
                if (worker) {
                    newSelectedIds.push(wid);
                    newDelegators.push({
                        id: wid,
                        name: worker.name,
                        idNumber: worker.idNumber || '',
                        address: worker.address || '',
                        unitPrice: worker.unitPrice || 150000,
                        workDays: stats.days,
                        claimAmount: (worker.unitPrice || 150000) * stats.days,
                        signature: worker.signatureUrl || '',
                        phoneNumber: worker.contact || ''
                    });
                }
            }

            // Sort by Name
            newDelegators.sort((a, b) => a.name.localeCompare(b.name));

            setSelectedWorkerIds(newSelectedIds);
            setDelegators(newDelegators);
            toast.success(`${newDelegators.length}명의 근무자를 불러왔습니다.`);

        } catch (error) {
            console.error(error);
            toast.error('근무자 불러오기 실패');
        } finally {
            setLoading(false);
        }
    };

    // Sync Delegators with Selected IDs
    useEffect(() => {
        // Add new selections
        const newDelegators = [...delegators];
        let hasChanges = false;

        // Add missing
        selectedWorkerIds.forEach(id => {
            if (!newDelegators.find(d => d.id === id)) {
                const worker = allWorkers.find(w => w.id === id);
                if (worker) {
                    newDelegators.push({
                        id: worker.id!,
                        name: worker.name,
                        idNumber: worker.idNumber || '',
                        address: worker.address || '',
                        unitPrice: worker.unitPrice || 150000,
                        workDays: 1,
                        claimAmount: (worker.unitPrice || 150000) * 1,
                        signature: worker.signatureUrl || '',
                        phoneNumber: worker.contact || ''
                    });
                    hasChanges = true;
                }
            }
        });

        // Remove unselected
        const filtered = newDelegators.filter(d => selectedWorkerIds.includes(d.id));
        if (filtered.length !== newDelegators.length) hasChanges = true;

        if (hasChanges) {
            setDelegators(filtered);
        }
    }, [selectedWorkerIds, allWorkers]);

    // --- Derived ---
    const filteredWorkers = useMemo(() => {
        if (!searchTerm) return allWorkers;
        return allWorkers.filter(w =>
            w.name.includes(searchTerm) ||
            (w.idNumber && w.idNumber.includes(searchTerm))
        );
    }, [allWorkers, searchTerm]);

    const totalAmount = useMemo(() => delegators.reduce((sum, d) => sum + d.claimAmount, 0), [delegators]);

    const selectedYearMonth = useMemo(() => {
        const safeYear = Number(year);
        const safeMonth = Number(month);
        const mm = String(Number.isFinite(safeMonth) ? safeMonth : 1).padStart(2, '0');
        return `${Number.isFinite(safeYear) ? safeYear : new Date().getFullYear()}-${mm}`;
    }, [year, month]);

    // --- Handlers ---

    // Block Settings & Overrides
    const updateBlockSettings = (blockId: string, settings: any) => {
        setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, settings: { ...b.settings, ...settings } } : b));
    };

    const updateBlockOverride = (blockId: string, key: string, value: string) => {
        setBlocks(prev => prev.map(b => b.id === blockId ? {
            ...b,
            contentOverrides: { ...b.contentOverrides, [key]: value }
        } : b));
    };

    const updateBlockContent = (blockId: string, content: string) => {
        setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, content } : b));
    };

    const addContentBlock = () => {
        const newBlock: Block = {
            id: `content-${Date.now()}`,
            type: 'content',
            content: '',
            settings: { minHeight: 100 }
        };
        setBlocks(prev => {
            const bankIdx = prev.findIndex(b => b.type === 'bank');
            if (bankIdx >= 0) {
                const newBlocks = [...prev];
                newBlocks.splice(bankIdx, 0, newBlock);
                return newBlocks;
            }
            return [...prev, newBlock];
        });
    };

    const removeBlock = (id: string) => {
        if (!window.confirm('삭제하시겠습니까?')) return;
        setBlocks(prev => prev.filter(b => b.id !== id));
    };

    // Trustee Info
    const updateTrusteeField = (key: keyof TrusteeInfo, value: string) => {
        setTrustee(prev => ({ ...prev, [key]: value }));
    };

    // Worker Selection
    const toggleWorker = (id: string) => {
        setSelectedWorkerIds(prev =>
            prev.includes(id) ? prev.filter(wid => wid !== id) : [...prev, id]
        );
    };

    const toggleAll = () => {
        if (selectedWorkerIds.length === filteredWorkers.length) {
            setSelectedWorkerIds([]);
        } else {
            setSelectedWorkerIds(filteredWorkers.map(w => w.id!));
        }
    };

    const updateDelegator = (id: string, field: 'unitPrice' | 'workDays', value: number) => {
        setDelegators(prev => prev.map(d => {
            if (d.id === id) {
                const updates = { [field]: value };
                const newUnitPrice = field === 'unitPrice' ? value : d.unitPrice;
                const newWorkDays = field === 'workDays' ? value : d.workDays;
                return { ...d, ...updates, claimAmount: newUnitPrice * newWorkDays };
            }
            return d;
        }));
    };

    const applyBatchChange = (field: 'unitPrice' | 'workDays') => {
        const val = field === 'unitPrice' ? batchUnitPrice : batchWorkDays;
        if (!val) return;

        setDelegators(prev => prev.map(d => {
            const newUnitPrice = field === 'unitPrice' ? val : d.unitPrice;
            const newWorkDays = field === 'workDays' ? val : d.workDays;
            return {
                ...d,
                unitPrice: newUnitPrice,
                workDays: newWorkDays,
                claimAmount: newUnitPrice * newWorkDays
            };
        }));

        toast.success('일괄 적용 완료: ' + selectedWorkerIds.length + '명의 데이터가 수정되었습니다.');
    };

    // Export
    const handleCopyToClipboard = async () => {
        if (!printRef.current) return;
        setCopying(true);
        try {
            const canvas = await (html2canvas as any)(printRef.current, {
                scale: 2,
                backgroundColor: '#ffffff',
                logging: false,
                useCORS: true
            });

            canvas.toBlob(async (blob: Blob | null) => {
                if (!blob) throw new Error('Blob creation failed');

                // Clipboard API
                const item = new ClipboardItem({ 'image/png': blob });
                await navigator.clipboard.write([item]);
                toast.success('복사 완료: 위임장 이미지가 클립보드에 복사되었습니다.');
            });
        } catch (err) {
            console.error('Copy failed', err);
            toast.error('복사 실패: 이미지 생성 중 오류가 발생했습니다.');
        } finally {
            setCopying(false);
        }
    };

    // --- Render Helpers (Inside Component Scope) ---

    // 1. Header
    const renderHeader = () => (
        <h1 className="text-center text-3xl font-bold border-b-2 border-slate-800 pb-4 mb-4 select-none">위 임 장</h1>
    );

    // 2. Trustee (New Table Layout)
    const renderTrustee = (block: Block) => {
        const getText = (key: string, defaultText: string) => block.contentOverrides?.[key] ?? defaultText;
        const setText = (key: string, val: string) => updateBlockOverride(block.id, key, val);

        return (
            <div className="mb-4 text-sm relative group/trustee">
                <div className="mb-2 flex justify-between items-end">
                    <span className="font-bold text-sm">수임인</span>
                    <span className="font-bold text-sm">{year}년 {month}월분</span>
                </div>

                <table className="w-full border-collapse border border-slate-800">
                    <colgroup>
                        <col className="w-[15%]" />
                        <col className="w-[35%]" />
                        <col className="w-[15%]" />
                        <col className="w-[35%]" />
                    </colgroup>
                    <tbody>
                        {/* Row 1: Name / ID */}
                        <tr className="border-b border-slate-800">
                            <td className="bg-slate-50 border-r border-slate-800 px-3 py-2 font-medium text-center">
                                <EditableText value={getText('lbl_name', '성 명')} />
                            </td>
                            <td className="bg-white border-r border-slate-800 px-3 py-2">
                                <span className="text-center block w-full">{trustee.name}</span>
                            </td>
                            <td className="bg-slate-50 border-r border-slate-800 px-3 py-2 font-medium text-center">
                                <EditableText value={getText('lbl_id', '주민등록번호')} />
                            </td>
                            <td className="bg-white px-3 py-2">
                                <span className="text-center block w-full">{trustee.idNumber}</span>
                            </td>
                        </tr>

                        {/* Row 2: Contact (Merged) */}
                        <tr className="border-b border-slate-800">
                            <td className="bg-slate-50 border-r border-slate-800 px-3 py-2 font-medium text-center">
                                <EditableText value={getText('lbl_contact', '연락처')} />
                            </td>
                            <td className="bg-white px-3 py-2" colSpan={3}>
                                <span className="text-center block w-full">{trustee.contact}</span>
                            </td>
                        </tr>

                        {/* Row 3: Address (Merged) */}
                        <tr className="">
                            <td className="bg-slate-50 border-r border-slate-800 px-3 py-2 font-medium text-center border-b border-slate-800">
                                <EditableText value={getText('lbl_addr', '주 소')} />
                            </td>
                            <td className="bg-white border-r border-slate-800 px-3 py-2 border-b border-slate-800" colSpan={2}>
                                <span className="text-center block w-full">{trustee.address}</span>
                            </td>
                            <td className="bg-white px-3 py-2 border-b border-slate-800 text-center align-middle p-0 relative" style={{ height: '40px' }}>
                                {trustee.signature ? (
                                    <img src={trustee.signature} alt="서명" className="h-full max-h-[40px] mx-auto object-contain" />
                                ) : (
                                    <span className="text-slate-300 text-xs">서명</span>
                                )}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        );
    };


    // 3. Content
    const renderContent = (block: Block) => (
        <div className="mb-4">
            {block.content ? (
                <div className="text-sm leading-relaxed whitespace-pre-wrap">
                    {block.content}
                </div>
            ) : null}
        </div>
    );

    // 4. Bank
    const renderBank = (block: Block) => {
        return (
            <div className="mb-4">
                <div className="border border-slate-800 text-sm bg-white">
                    <div className="flex">
                        {/* Bank */}
                        <div className="bg-slate-50 font-medium px-3 py-2 border-r border-slate-800 flex items-center justify-center" style={{ width: '15%' }}>
                            은행
                        </div>
                        <div className="px-3 py-2 border-r border-slate-800 flex-1 flex items-center">
                            <span className="w-full text-center">{trustee.bankName}</span>
                        </div>

                        {/* Account */}
                        <div className="bg-slate-50 font-medium px-3 py-2 border-r border-slate-800 flex items-center justify-center" style={{ width: '15%' }}>
                            계좌번호
                        </div>
                        <div className="px-3 py-2 border-r border-slate-800 flex-[1.5] flex items-center">
                            <span className="w-full text-center">{trustee.accountNumber}</span>
                        </div>

                        {/* Holder */}
                        <div className="bg-slate-50 font-medium px-3 py-2 border-r border-slate-800 flex items-center justify-center" style={{ width: '15%' }}>
                            예금주
                        </div>
                        <div className="px-3 py-2 flex-1 flex items-center">
                            <span className="w-full text-center">{trustee.accountHolder}</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // 5. Delegators
    const renderDelegators = () => (
        delegators.length > 0 ? (
            <div className="mb-4">
                <div className="font-bold mb-2 text-sm">- 아 래 -</div>
                <table className="w-full border-collapse border border-slate-800 text-xs">
                    <thead>
                        <tr className="bg-slate-100">
                            <th className="border border-slate-800 px-2 py-1">번호</th>
                            <th className="border border-slate-800 px-2 py-1">위임인</th>
                            <th className="border border-slate-800 px-2 py-1">주민번호</th>
                            <th className="border border-slate-800 px-2 py-1">주소</th>
                            {showManDays && <th className="border border-slate-800 px-2 py-1">공수</th>}
                            <th className="border border-slate-800 px-2 py-1">청구금액</th>
                            <th className="border border-slate-800 px-2 py-1">서명 또는 인</th>
                        </tr>
                    </thead>
                    <tbody>
                        {delegators.map((delegator, idx) => (
                            <tr key={delegator.id} className="break-inside-avoid">
                                <td className="border border-slate-800 px-2 py-1 text-center">{idx + 1}</td>
                                <td className="border border-slate-800 px-2 py-1">{delegator.name}</td>
                                <td className="border border-slate-800 px-2 py-1 text-xs">{delegator.idNumber}</td>
                                <td className="border border-slate-800 px-2 py-1 text-xs">{delegator.address}</td>
                                {showManDays && <td className="border border-slate-800 px-2 py-1 text-center">{delegator.workDays}</td>}
                                <td className="border border-slate-800 px-2 py-1 text-right">{delegator.claimAmount.toLocaleString()}</td>
                                <td className="border border-slate-800 px-2 py-1 text-center h-10 align-middle">
                                    {delegator.signature && <img src={delegator.signature} alt="서명" className="max-h-8 mx-auto" />}
                                </td>
                            </tr>
                        ))}
                        <tr className="font-bold bg-slate-50 break-inside-avoid">
                            <td colSpan={showManDays ? 5 : 4} className="border border-slate-800 px-2 py-1 text-center">합계</td>
                            <td className="border border-slate-800 px-2 py-1 text-right">{totalAmount.toLocaleString()}</td>
                            <td className="border border-slate-800 px-2 py-1"></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        ) : <div className="text-center text-slate-400 py-4 border border-dashed rounded">위임인(작업자)을 선택해주세요.</div>
    );

    const renderBlock = (block: Block) => {
        switch (block.type) {
            case 'header': return renderHeader();
            case 'trustee': return renderTrustee(block);
            case 'content': return renderContent(block);
            case 'bank': return renderBank(block);
            case 'delegators': return renderDelegators();
            default: return null;
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
                <div className="text-lg text-slate-300 flex items-center gap-3">
                    <svg className="animate-spin h-5 w-5 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                    </svg>
                    데이터 로딩 중...
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 flex flex-col md:flex-row gap-6">
            <PrintStyle />

            {/* Settings Panel */}
            <div className="w-full md:w-[420px] shrink-0 space-y-4 print:hidden">
                <div className="bg-slate-800/60 backdrop-blur-xl rounded-2xl shadow-2xl p-5 border border-slate-700/50">
                    {/* Header */}
                    <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <FontAwesomeIcon icon={faFileAlt} className="text-indigo-400" />
                        위임장 V2 설정
                    </h2>

                    {/* Tabs */}
                    <div className="flex gap-1 p-1 bg-slate-700/50 rounded-xl mb-4">
                        <button
                            onClick={() => setActiveTab('settings')}
                            className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${activeTab === 'settings' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                            <FontAwesomeIcon icon={faCog} /> 기본 설정
                        </button>
                        <button
                            onClick={() => setActiveTab('workers')}
                            className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${activeTab === 'workers' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                            <FontAwesomeIcon icon={faUsers} /> 작업자 ({selectedWorkerIds.length})
                        </button>
                    </div>

                    {activeTab === 'settings' && (
                        <>
                            {/* Year/Month */}
                            <div className="mb-4">
                                <label className="text-xs font-semibold text-slate-400">근무 년월</label>
                                <div className="relative mt-1">
                                    <FontAwesomeIcon icon={faCalendarAlt} className="absolute left-3 top-2.5 text-slate-500 z-10" />
                                    <YearMonthPicker
                                        value={selectedYearMonth}
                                        onChange={(next) => {
                                            const [yStr, mStr] = String(next).split('-');
                                            const y = Number(yStr);
                                            const m = Number(mStr);
                                            if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return;
                                            setYear(y);
                                            setMonth(m);
                                        }}
                                        inputClassName="w-full pl-9 px-3 py-2 text-sm bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    />
                                </div>
                            </div>

                            {/* Site Selection */}
                            <div className="mb-4">
                                <label className="text-xs font-semibold text-slate-400">현장 선택 (데이터 불러오기)</label>
                                <div className="mt-1 flex gap-2">
                                    <div className="relative flex-1">
                                        <Building2 className="absolute left-3 top-2.5 w-4 h-4 text-slate-500 z-10" />
                                        <select
                                            className="w-full pl-9 px-3 py-2 text-sm bg-slate-700/50 border border-slate-600 rounded-lg text-white appearance-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                            value={selectedSiteId}
                                            onChange={(e) => setSelectedSiteId(e.target.value)}
                                        >
                                            <option value="">현장 선택...</option>
                                            {sites.map(site => (
                                                <option key={site.id} value={site.id}>{site.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <button
                                        onClick={handleLoadSiteWorkers}
                                        disabled={!selectedSiteId || loading}
                                        className={`px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all flex items-center justify-center gap-2 ${!selectedSiteId || loading
                                            ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                            : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/30'
                                            }`}
                                    >
                                        <FontAwesomeIcon icon={faArrowsRotate} className={loading ? 'animate-spin' : ''} />
                                        <span>불러오기</span>
                                    </button>
                                </div>
                                <p className="text-[11px] text-slate-500 mt-1">
                                    * 선택한 현장/년월의 출력일보 데이터를 기반으로 위임인(작업자) 목록을 자동으로 구성합니다.
                                </p>
                            </div>

                            {/* Show ManDays Toggle */}
                            <div className="mb-4 p-3 bg-slate-700/30 rounded-xl border border-slate-600/50">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <span className="text-sm font-medium text-white">공수 항목 표시</span>
                                        <p className="text-xs text-slate-400 mt-0.5">위임장에 공수 칼럼 포함</p>
                                    </div>
                                    <button
                                        onClick={() => setShowManDays(!showManDays)}
                                        className={`w-12 h-6 rounded-full transition-all duration-300 ${showManDays ? 'bg-indigo-600' : 'bg-slate-600'} relative`}
                                    >
                                        <span className={`absolute w-5 h-5 bg-white rounded-full top-0.5 transition-all duration-300 shadow ${showManDays ? 'left-6' : 'left-0.5'}`} />
                                    </button>
                                </div>
                            </div>

                            {/* Trustee Inputs (NEW STRUCTURED FORM) */}
                            <div className="space-y-4 border-t border-slate-700 pt-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <FontAwesomeIcon icon={faUserTie} className="text-slate-400" />
                                    <span className="text-sm font-bold text-slate-200">수임인 정보 입력</span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-xs text-slate-400">이름</label>
                                        <input className="w-full px-3 py-2 text-sm bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:border-indigo-500 transition-colors" placeholder="이름 입력" value={trustee.name} onChange={e => updateTrusteeField('name', e.target.value)} />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs text-slate-400">주민등록번호</label>
                                        <input className="w-full px-3 py-2 text-sm bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:border-indigo-500 transition-colors" placeholder="000000-0000000" value={trustee.idNumber} onChange={e => updateTrusteeField('idNumber', e.target.value)} />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs text-slate-400">주소</label>
                                    <input className="w-full px-3 py-2 text-sm bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:border-indigo-500 transition-colors" placeholder="전체 주소 입력" value={trustee.address} onChange={e => updateTrusteeField('address', e.target.value)} />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-xs text-slate-400">연락처</label>
                                        <input className="w-full px-3 py-2 text-sm bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:border-indigo-500 transition-colors" placeholder="010-0000-0000" value={trustee.contact} onChange={e => updateTrusteeField('contact', e.target.value)} />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs text-slate-400">서명 이미지</label>
                                        <div className="flex gap-2">
                                            {trustee.signature ? (
                                                <div className="relative group/sig">
                                                    <img src={trustee.signature} alt="서명" className="h-[38px] w-auto rounded border border-slate-600 bg-white" />
                                                    <button onClick={() => updateTrusteeField('signature', '')} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] opacity-0 group-hover/sig:opacity-100 transition-all">×</button>
                                                </div>
                                            ) : (
                                                <div className="flex-1 h-[38px] border border-dashed border-slate-600 rounded-lg flex items-center justify-center text-xs text-slate-500">
                                                    이미지 없음
                                                </div>
                                            )}
                                            <label className="cursor-pointer px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg hover:bg-slate-600 transition-colors text-white text-xs flex items-center justify-center">
                                                <FontAwesomeIcon icon={faCloudUploadAlt} />
                                                <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) {
                                                        const reader = new FileReader();
                                                        reader.onloadend = () => {
                                                            updateTrusteeField('signature', reader.result as string);
                                                        };
                                                        reader.readAsDataURL(file);
                                                    }
                                                }} />
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-xs text-slate-400">은행명</label>
                                        <input className="w-full px-3 py-2 text-sm bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:border-indigo-500 transition-colors" placeholder="은행" value={trustee.bankName} onChange={e => updateTrusteeField('bankName', e.target.value)} />
                                    </div>
                                    <div className="space-y-1 sm:col-span-2">
                                        <label className="text-xs text-slate-400">계좌번호 (예금주: {trustee.accountHolder || '미입력'})</label>
                                        <div className="flex gap-2">
                                            <input className="flex-1 px-3 py-2 text-sm bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:border-indigo-500 transition-colors" placeholder="계좌번호" value={trustee.accountNumber} onChange={e => updateTrusteeField('accountNumber', e.target.value)} />
                                            <input className="w-1/3 px-3 py-2 text-sm bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:border-indigo-500 transition-colors" placeholder="예금주" value={trustee.accountHolder} onChange={e => updateTrusteeField('accountHolder', e.target.value)} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Content Blocks */}
                            <div className="flex justify-between items-center mt-6 border-t border-slate-700 pt-4">
                                <label className="text-xs font-semibold text-slate-400">본문 블록</label>
                                <button onClick={addContentBlock} className="text-xs text-indigo-400 bg-indigo-500/20 px-2 py-1 rounded-lg hover:bg-indigo-500/30 border border-indigo-500/30">
                                    <FontAwesomeIcon icon={faPlus} /> 추가
                                </button>
                            </div>
                            <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                                {blocks.filter(b => b.type === 'content').map((b, idx) => (
                                    <textarea key={b.id} className="w-full px-3 py-2 text-sm bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 min-h-[80px]" value={b.content} onChange={e => updateBlockContent(b.id, e.target.value)} placeholder={`본문 ${idx + 1}`} />
                                ))}
                            </div>
                        </>
                    )}

                    {/* Workers Tab Content */}
                    {activeTab === 'workers' && (
                        <div className="space-y-3 max-h-[500px] overflow-y-auto">
                            <div className="relative">
                                <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-2.5 text-slate-500 text-sm" />
                                <input className="w-full pl-9 px-3 py-2 text-sm bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400" placeholder="이름 검색..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                            </div>

                            <div className="flex gap-2">
                                <div className="flex-1 flex gap-1">
                                    <input type="number" className="flex-1 bg-slate-700/50 border border-slate-600 rounded-lg px-2 py-1 text-xs text-white placeholder-slate-400" placeholder="일괄 단가" value={batchUnitPrice || ''} onChange={e => setBatchUnitPrice(Number(e.target.value))} />
                                    <button onClick={() => applyBatchChange('unitPrice')} className="text-xs bg-indigo-500/20 text-indigo-400 px-2 rounded-lg hover:bg-indigo-500/30 border border-indigo-500/30">적용</button>
                                </div>
                                <div className="flex-1 flex gap-1">
                                    <input type="number" className="flex-1 bg-slate-700/50 border border-slate-600 rounded-lg px-2 py-1 text-xs text-white placeholder-slate-400" placeholder="일괄 공수" value={batchWorkDays || ''} onChange={e => setBatchWorkDays(Number(e.target.value))} />
                                    <button onClick={() => applyBatchChange('workDays')} className="text-xs bg-indigo-500/20 text-indigo-400 px-2 rounded-lg hover:bg-indigo-500/30 border border-indigo-500/30">적용</button>
                                </div>
                            </div>

                            <div className="flex justify-between items-center text-xs text-slate-400">
                                <span>{selectedWorkerIds.length}명 선택됨</span>
                                <button onClick={toggleAll} className="text-indigo-400 hover:text-indigo-300">
                                    {selectedWorkerIds.length === filteredWorkers.length ? '전체 해제' : '전체 선택'}
                                </button>
                            </div>

                            <div className="space-y-1.5">
                                {filteredWorkers.map(worker => {
                                    const isSelected = selectedWorkerIds.includes(worker.id!);
                                    const delegator = delegators.find(d => d.id === worker.id);
                                    return (
                                        <div key={worker.id} onClick={() => toggleWorker(worker.id!)} className={`p-2.5 rounded-xl border cursor-pointer transition-all ${isSelected ? 'bg-indigo-500/20 border-indigo-500/40' : 'bg-slate-700/30 border-slate-600/50 hover:bg-slate-700/50'}`}>
                                            <div className="flex justify-between items-center">
                                                <div className="flex items-center gap-2">
                                                    <FontAwesomeIcon icon={isSelected ? faCheckSquare : faSquare} className={isSelected ? 'text-indigo-400' : 'text-slate-500'} />
                                                    <span className="text-sm font-medium text-white">{worker.name}</span>
                                                </div>
                                                {isSelected && delegator && <span className="text-xs font-bold text-indigo-300">{delegator.claimAmount.toLocaleString()}원</span>}
                                            </div>
                                            {isSelected && delegator && (
                                                <div className="mt-2 grid grid-cols-2 gap-2" onClick={e => e.stopPropagation()}>
                                                    <input type="number" className="text-xs bg-slate-700 border border-slate-600 rounded-lg px-2 py-1 text-white" value={delegator.unitPrice} onChange={e => updateDelegator(worker.id!, 'unitPrice', Number(e.target.value))} placeholder="단가" />
                                                    <input type="number" className="text-xs bg-slate-700 border border-slate-600 rounded-lg px-2 py-1 text-white" value={delegator.workDays} onChange={e => updateDelegator(worker.id!, 'workDays', Number(e.target.value))} placeholder="공수" />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Preview Panel */}
            <div className="flex-1 flex flex-col h-full overflow-hidden">
                <div className="bg-slate-800/60 backdrop-blur-xl rounded-2xl shadow-2xl p-4 mb-4 flex justify-between items-center print:hidden border border-slate-700/50">
                    <div className="flex items-center gap-4">
                        <span className="text-white font-semibold">미리보기</span>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleCopyToClipboard} disabled={copying || delegators.length === 0} className="px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-xl hover:bg-slate-700 text-sm font-medium flex gap-2 items-center text-slate-200 disabled:opacity-50">
                            <FontAwesomeIcon icon={faCopy} spin={copying} /> 이미지 복사
                        </button>
                        <button onClick={() => window.print()} disabled={delegators.length === 0} className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 text-sm font-medium flex gap-2 items-center shadow-lg disabled:opacity-50">
                            <FontAwesomeIcon icon={faPrint} /> 출력
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-auto bg-slate-900/50 flex justify-center items-start p-8 rounded-2xl">
                    <div
                        ref={printRef}
                        className="bg-white shadow-2xl p-10 md:p-14 w-[210mm] min-h-[297mm] mx-auto print:shadow-none print:w-full print:p-0"
                    >
                        {blocks.map(block => (
                            <div key={block.id} className="relative">
                                <SortableBlock block={block}>
                                    {renderBlock(block)}
                                </SortableBlock>
                            </div>
                        ))}

                        {/* Footer (Static Date) */}
                        <div className="text-center font-bold text-base mt-8 mb-4">
                            {year}. {month}. {new Date().getDate()}.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DelegationLetterV2Page;
