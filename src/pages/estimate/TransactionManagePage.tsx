import React, { useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faPlus, faSave, faSpinner, faTrash, faMagnifyingGlass, faClipboardList,
    faChevronRight, faCalendarDays, faBuilding, faCheckCircle, faClock,
    faPaperPlane, faTimesCircle, faFileExcel
} from '@fortawesome/free-solid-svg-icons';
import { estimateService, Estimate, EstimateStatus } from '../../services/estimateService';
import { companyFirestoreService } from '../../services/companyFirestoreService';
import { CompanyZod } from '../../types/zod/companySchema';
import Swal from 'sweetalert2';
import materialService from '../../services/materialService';
import { Material } from '../../types/materials';

import { 
    getEmptyDraft, PRINT_STYLES, LOGO_FALLBACK,
    EstimateDraft, DocumentType, formatCurrency
} from '../../utils/estimateUtils';
import { 
    TitleComponent, InfoTableComponent, AmountBarComponent 
} from '../../components/estimate/EstimateSharedComponents';
import { TransactionTable } from '../../components/estimate/TransactionTable';
import { RentalTransactionTable } from '../../components/estimate/RentalTransactionTable';
import { downloadEstimateExcel } from '../../utils/estimateExcelUtils';
import {
    calculateRentalLineAmount,
    generateRentalTransactionItems,
    isRentalRateInWorkType,
    mergeRentalRatesWithMaterials,
    RentalAmountBasis,
    RentalGenerationResult,
    RentalMaterialRate,
    RentalWorkType
} from '../../utils/rentalTransactionGenerator';

// 상태별 설정
const STATUS_CONFIG: Record<EstimateStatus, { label: string; color: string; bg: string; icon: any }> = {
    draft: { label: '대기', color: 'text-slate-600', bg: 'bg-slate-100', icon: faClock },
    sent: { label: '발송', color: 'text-teal-600', bg: 'bg-teal-100', icon: faPaperPlane },
    approved: { label: '확정', color: 'text-emerald-600', bg: 'bg-emerald-100', icon: faCheckCircle },
    rejected: { label: '반려', color: 'text-rose-600', bg: 'bg-rose-100', icon: faTimesCircle }
};

const RENTAL_RATE_STORAGE_KEY = 'cy-transaction-rental-material-rates-v1';
const RENTAL_WORK_TYPE_LABELS: Record<RentalWorkType, string> = {
    shoring: '시스템동바리',
    scaffold: '시스템비계',
};

const readStoredRentalRates = (): RentalMaterialRate[] => {
    if (typeof window === 'undefined') return [];
    try {
        const raw = window.localStorage.getItem(RENTAL_RATE_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.warn('[TransactionManagePage] rental rate settings load failed:', error);
        return [];
    }
};

const writeStoredRentalRates = (rates: RentalMaterialRate[]) => {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(RENTAL_RATE_STORAGE_KEY, JSON.stringify(rates));
    } catch (error) {
        console.warn('[TransactionManagePage] rental rate settings save failed:', error);
    }
};

const parseMoneyInput = (value: string): number => {
    const parsed = Number(value.replace(/,/g, '').trim());
    return Number.isFinite(parsed) ? parsed : 0;
};

const TransactionManagePage: React.FC = () => {
    const [draft, setDraft] = useState<EstimateDraft>(() => getEmptyDraft('transaction'));
    const [estimates, setEstimates] = useState<Estimate[]>([]);
    const [myCompany, setMyCompany] = useState<CompanyZod | null>(null);

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | EstimateStatus>('all');
    const [logoUrl, setLogoUrl] = useState<string>('');
    const [rentalMaterials, setRentalMaterials] = useState<Material[]>([]);
    const [rentalRates, setRentalRates] = useState<RentalMaterialRate[]>([]);
    const [rentalSettingsOpen, setRentalSettingsOpen] = useState(false);
    const [rentalRateSearch, setRentalRateSearch] = useState('');
    const [rentalWorkType, setRentalWorkType] = useState<RentalWorkType>('shoring');
    const [rentalTargetAmount, setRentalTargetAmount] = useState('');
    const [rentalAmountBasis, setRentalAmountBasis] = useState<RentalAmountBasis>('supply');
    const [rentalUsageDays, setRentalUsageDays] = useState(26);
    const [rentalRowCount, setRentalRowCount] = useState(10);
    const [lastRentalGeneration, setLastRentalGeneration] = useState<RentalGenerationResult | null>(null);

    // 엑셀 다운로드 핸들러
    const handleExcelDownload = async () => {
        try {
            await downloadEstimateExcel(draft, itemsWithCalc, subtotal, tax, total, 'transaction', { freezePanes: false });
            Swal.fire({
                icon: 'success',
                title: '엑셀 변환 완료',
                text: '거래명세표 서식이 적용된 엑셀 파일이 생성되었습니다.',
                toast: true, position: 'top-end', showConfirmButton: false, timer: 3000
            });
        } catch (e) {
            console.error(e);
            Swal.fire('오류', '엑셀 생성 중 문제가 발생했습니다.', 'error');
        }
    };

    // 로고 고정
    useEffect(() => { setLogoUrl(LOGO_FALLBACK); }, []);

    // 데이터 로드
    const loadData = async () => {
        setLoading(true);
        try {
            const [fetchedEstimates, fetchedCompanies] = await Promise.all([
                estimateService.getEstimates(),
                companyFirestoreService.getCompanies()
            ]);
            setEstimates(fetchedEstimates.filter(e => e.documentType === 'transaction'));
            
            // 지능형 공급자(청연) 찾기 로직 강화
            const main = fetchedCompanies.find(c => {
                const n = (c.name || '').replace(/\s/g, '');
                return n.includes('청연이엔지') || n.includes('청연ENG');
            }) || fetchedCompanies.find(c => c.name.includes('청연')) 
               || fetchedCompanies.find(c => c.isMyCompany) 
               || fetchedCompanies[0];
            
            if (main) {
                setMyCompany(main);
                // 새 문서라면 즉시 공급자 정보 적용
                setDraft(prev => {
                    if (!prev.id) {
                        return {
                            ...prev,
                            supplierCompany: main.name,
                            supplierBizNo: main.businessNumber || '',
                            supplierName: main.ceoName || '',
                            supplierAddress: main.address || '',
                            supplierContact: main.phone || '',
                            supplierAccount: main.bankName && main.accountNumber ? `${main.bankName} ${main.accountNumber}` : '',
                            supplierFax: main.fax || '031-509-7693',
                            supplierManager: prev.supplierManager,
                            supplierManagerContact: prev.supplierManagerContact
                        };
                    }
                    return prev;
                });
            }
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => { loadData(); }, []);

    const loadRentalMaterials = async () => {
        try {
            const materials = await materialService.getUniqueMaterialsForSelection();
            const mergedRates = mergeRentalRatesWithMaterials(materials, readStoredRentalRates());
            setRentalMaterials(materials);
            setRentalRates(mergedRates);
        } catch (error) {
            console.error('Failed to load rental materials:', error);
        }
    };

    useEffect(() => { loadRentalMaterials(); }, []);

    useEffect(() => {
        if (rentalRates.length > 0) {
            writeStoredRentalRates(rentalRates);
        }
    }, [rentalRates]);

    // 계산 로직
    const itemsWithCalc = useMemo(() => draft.items.map(item => {
        if (draft.documentType === 'transaction' && draft.estimateMode === 'rental') {
            const amount = calculateRentalLineAmount(item);
            return {
                ...item,
                amount,
                rentalAmount: amount,
                unitPrice: item.finalUnitPrice || 0,
            };
        }
        const amount = (item.finalUnitPrice || 0) * (item.quantity || 0);
        return { ...item, amount };
    }), [draft.items, draft.documentType, draft.estimateMode]);

    const { subtotal, tax, total } = useMemo(() => {
        const baseSub = itemsWithCalc.reduce((sum, item) => sum + (item.amount || 0), 0);
        const taxableSub = Math.max(0, baseSub - (draft.discount || 0));
        const taxAmt = draft.includeVat ? Math.round(taxableSub * (draft.vatRate / 100)) : 0;
        return { subtotal: baseSub, tax: taxAmt, total: taxableSub + taxAmt };
    }, [itemsWithCalc, draft.includeVat, draft.vatRate, draft.discount]);

    const updateDraft = (field: keyof EstimateDraft, value: any) => setDraft(prev => ({ ...prev, [field]: value }));
    const updateItem = (itemId: string, field: string, val: any) => {
        setDraft(d => {
            const n = [...d.items];
            const idx = n.findIndex(i => i.id === itemId);
            if (idx === -1) return d;
            const updated = { ...n[idx], [field]: val };
            if (field === 'finalUnitPrice') updated.unitPrice = val;
            n[idx] = updated;
            return { ...d, items: n };
        });
    };

    const resetPage = (mode: 'standard' | 'rental' = 'standard') => {
        const empty = getEmptyDraft('transaction');
        empty.estimateMode = mode;
        if (mode === 'rental') {
            empty.title = '임 대 거 래 명 세 표';
            empty.notes = '';
            empty.paymentTerms = '정기 결제';
            empty.includeVat = true;
        }
        if (myCompany) {
            Object.assign(empty, {
                supplierCompany: myCompany.name, supplierBizNo: myCompany.businessNumber || '',
                supplierName: myCompany.ceoName || '', supplierAddress: myCompany.address || '',
                supplierContact: myCompany.phone || '',
                supplierAccount: myCompany.bankName && myCompany.accountNumber ? `${myCompany.bankName} ${myCompany.accountNumber}` : '',
                supplierFax: myCompany.fax || '031-509-7693',
                supplierManager: empty.supplierManager,
                supplierManagerContact: empty.supplierManagerContact
            });
        }
        setDraft(empty);
        setLastRentalGeneration(null);
    };

    const saveTransaction = async () => {
        if (!draft.title || !draft.clientCompany) {
            Swal.fire('알림', '필수 항목(제목, 업체명)을 입력해주세요.', 'warning');
            return;
        }
        try {
            setSaving(true);
            const payload = { ...draft, documentType: 'transaction' as DocumentType, items: itemsWithCalc, subtotal, tax, total };
            if (draft.id) {
                await estimateService.updateEstimate(draft.id, payload);
                Swal.fire('성공', '거래명세표가 수정되었습니다.', 'success');
            } else {
                const newId = await estimateService.addEstimate(payload);
                setDraft(prev => ({ ...prev, id: newId }));
                Swal.fire('성공', '새 거래명세표가 저장되었습니다.', 'success');
            }
            loadData();
        } catch (e) {
            console.error(e);
            Swal.fire('오류', '저장 중 문제가 발생했습니다.', 'error');
        } finally { setSaving(false); }
    };

    const deleteTransaction = async (id: string, ev: React.MouseEvent) => {
        ev.stopPropagation();
        const result = await Swal.fire({
            title: '정말 삭제할까요?',
            text: "삭제된 데이터는 복구할 수 없습니다.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#64748b',
            confirmButtonText: '삭제',
            cancelButtonText: '취소'
        });
        if (result.isConfirmed) {
            try {
                await estimateService.deleteEstimate(id);
                Swal.fire('삭제됨', '거래명세표가 삭제되었습니다.', 'success');
                loadData();
                if (draft.id === id) resetPage();
            } catch (e) { Swal.fire('오류', '삭제 중 문제가 발생했습니다.', 'error'); }
        }
    };

    const changeStatus = async (id: string, currentStatus: EstimateStatus, ev: React.MouseEvent) => {
        ev.stopPropagation();
        const statuses: EstimateStatus[] = ['draft', 'sent', 'approved', 'rejected'];
        const nextIdx = (statuses.indexOf(currentStatus) + 1) % statuses.length;
        const nextStatus = statuses[nextIdx];
        
        try {
            await estimateService.updateEstimate(id, { status: nextStatus });
            loadData();
            if (draft.id === id) setDraft(prev => ({ ...prev, status: nextStatus }));
        } catch (e) { console.error(e); }
    };

    const filteredTransactions = useMemo(() => {
        const low = searchText.toLowerCase();
        return estimates.filter(e => {
            const matchesText = (e.title || '').toLowerCase().includes(low) || 
                               (e.projectName || '').toLowerCase().includes(low) ||
                               (e.clientCompany || '').toLowerCase().includes(low);
            const matchesStatus = statusFilter === 'all' || e.status === statusFilter;
            return matchesText && matchesStatus;
        });
    }, [estimates, searchText, statusFilter]);

    const isRentalTransaction = draft.estimateMode === 'rental';

    const rentalRatesForSelectedWorkType = useMemo(() => (
        rentalRates.filter((rate) => isRentalRateInWorkType(rate, rentalWorkType))
    ), [rentalRates, rentalWorkType]);

    const filteredRentalRates = useMemo(() => {
        const keyword = rentalRateSearch.trim().toLowerCase();
        if (!keyword) return rentalRatesForSelectedWorkType;
        return rentalRatesForSelectedWorkType.filter((rate) => (
            `${rate.category} ${rate.itemName} ${rate.spec} ${rate.unit}`.toLowerCase().includes(keyword)
        ));
    }, [rentalRatesForSelectedWorkType, rentalRateSearch]);

    const rentalActiveCount = rentalRatesForSelectedWorkType.filter((rate) => rate.active !== false).length;

    const updateRentalRate = (materialId: string, field: keyof RentalMaterialRate, value: any) => {
        setRentalRates((prev) => prev.map((rate) => (
            rate.materialId === materialId ? { ...rate, [field]: value } : rate
        )));
    };

    const resetRentalRatesFromMaster = () => {
        const next = mergeRentalRatesWithMaterials(rentalMaterials, []);
        setRentalRates(next);
        setLastRentalGeneration(null);
    };

    const setTransactionMode = (mode: 'standard' | 'rental') => {
        setDraft((prev) => ({
            ...prev,
            estimateMode: mode,
            title: mode === 'rental' ? '임 대 거 래 명 세 표' : '거 래 명 세 표',
            notes: mode === 'rental' ? '' : prev.notes,
        }));
        setLastRentalGeneration(null);
    };

    const applyRentalGeneration = async () => {
        const targetAmount = parseMoneyInput(rentalTargetAmount);
        if (targetAmount <= 0) {
            Swal.fire('알림', '자동 생성할 목표 금액을 입력해주세요.', 'warning');
            return;
        }
        if (rentalActiveCount === 0) {
            Swal.fire('알림', `${RENTAL_WORK_TYPE_LABELS[rentalWorkType]} 자재를 1개 이상 선택해주세요.`, 'warning');
            return;
        }

        const result = generateRentalTransactionItems(rentalRates, {
            targetAmount,
            amountBasis: rentalAmountBasis,
            usageDays: rentalUsageDays,
            rowCount: rentalRowCount,
            vatRate: draft.vatRate || 10,
            includeVat: draft.includeVat !== false,
            issueDate: draft.issueDate || new Date().toISOString().split('T')[0],
            workType: rentalWorkType,
        });

        if (result.items.length === 0) {
            Swal.fire('알림', '조건에 맞는 임대 자재를 생성하지 못했습니다. 단가 설정을 확인해주세요.', 'warning');
            return;
        }

        setDraft((prev) => ({
            ...prev,
            estimateMode: 'rental',
            title: '임 대 거 래 명 세 표',
            notes: '',
            items: result.items,
        }));
        setLastRentalGeneration(result);

        await Swal.fire({
            icon: 'success',
            title: '임대 거래명세표 적용',
            text: `${RENTAL_WORK_TYPE_LABELS[rentalWorkType]} 자재 ${result.items.length}개가 공급가 ${formatCurrency(result.subtotal)}원 기준으로 생성되었습니다.`,
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 2600,
        });
    };

    return (
        <div className="flex flex-col h-screen overflow-hidden bg-slate-50 font-sans text-slate-900" style={{ '--estimate-font-size-offset': '2pt', '--estimate-table-padding-offset': '1px', '--estimate-table-row-offset': '4px' } as React.CSSProperties}>
            <style>{PRINT_STYLES}</style>
            
            <header className="flex flex-none items-center justify-between border-b bg-white px-6 py-4 shadow-sm z-30 print:hidden">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl shadow-lg bg-teal-600">
                        <FontAwesomeIcon icon={faClipboardList} className="text-lg text-white" />
                    </div>
                    <div>
                        <h1 className="text-[19px] font-black tracking-tight text-slate-900 leading-tight">거래명세표 관리</h1>
                        <p className="text-[13px] font-bold text-slate-400 tracking-wider uppercase">Transaction Management</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="flex overflow-hidden rounded-xl border-2 border-slate-200 bg-white">
                            <button onClick={() => setTransactionMode('standard')} className={`px-3 py-2.5 text-[15px] font-black transition-all ${!isRentalTransaction ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
                                일반
                            </button>
                            <button onClick={() => setTransactionMode('rental')} className={`px-3 py-2.5 text-[15px] font-black transition-all ${isRentalTransaction ? 'bg-amber-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
                                임대
                            </button>
                        </div>
                        <button onClick={() => resetPage('standard')} className="inline-flex items-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-4 py-2.5 text-[15px] font-black text-slate-600 hover:border-teal-500 hover:text-teal-600 transition-all hover:shadow-md">
                            <FontAwesomeIcon icon={faPlus} /> 새 명세표
                        </button>
                        <button onClick={() => resetPage('rental')} className="inline-flex items-center gap-2 rounded-xl border-2 border-amber-200 bg-amber-50 px-4 py-2.5 text-[15px] font-black text-amber-700 hover:bg-amber-600 hover:text-white transition-all hover:shadow-md">
                            <FontAwesomeIcon icon={faPlus} /> 임대 명세표
                        </button>
                        <button onClick={handleExcelDownload} className="inline-flex items-center gap-2 rounded-xl border-2 border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[15px] font-black text-emerald-700 hover:bg-emerald-600 hover:text-white transition-all hover:shadow-md">
                            <FontAwesomeIcon icon={faFileExcel} /> 엑셀 다운로드
                        </button>
                        <button onClick={saveTransaction} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white px-6 py-2.5 text-[15px] font-black hover:bg-teal-600 disabled:opacity-50 shadow-xl transition-all active:scale-95">
                            <FontAwesomeIcon icon={saving ? faSpinner : faSave} spin={saving} /> {saving ? '저장 중...' : (draft.id ? '명세표 수정' : '명세표 저장')}
                        </button>
                    </div>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                <aside className="w-[340px] flex-none bg-white border-r flex flex-col print:hidden shadow-[4px_0_10px_rgba(0,0,0,0.02)]">
                    <div className="p-5 border-b bg-slate-50/50 space-y-4">
                        <div className="relative group">
                            <FontAwesomeIcon icon={faMagnifyingGlass} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-[12px] group-focus-within:text-teal-500 transition-colors" />
                            <input 
                                value={searchText} 
                                onChange={e => setSearchText(e.target.value)} 
                                placeholder="업체명, 제목 검색..." 
                                className="w-full pl-10 pr-4 py-3 text-[16px] bg-white border border-slate-200 rounded-2xl focus:border-teal-500 focus:ring-4 focus:ring-teal-500/5 transition-all font-bold placeholder:text-slate-300 shadow-sm"
                            />
                        </div>

                        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                            <button onClick={() => setStatusFilter('all')} className={`flex-none px-3 py-1.5 rounded-xl text-[14px] font-black transition-all ${statusFilter === 'all' ? 'bg-slate-900 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-300'}`}>전체</button>
                            {(['draft', 'sent', 'approved', 'rejected'] as EstimateStatus[]).map(statusKey => {
                                const cfg = STATUS_CONFIG[statusKey];
                                const isActive = statusFilter === statusKey;
                                return (
                                    <button key={statusKey} onClick={() => setStatusFilter(statusKey)} className={`flex-none px-3 py-1.5 rounded-xl text-[14px] font-black transition-all border ${isActive ? `${cfg.bg} ${cfg.color} border-transparent shadow-sm` : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200'}`}>{cfg.label}</button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center h-40 gap-3 text-slate-300">
                                <FontAwesomeIcon icon={faSpinner} spin className="text-2xl" /><span className="text-[15px] font-bold">불러오는 중...</span>
                            </div>
                        ) : filteredTransactions.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-40 text-slate-300 italic text-[15px]">결과가 없습니다.</div>
                        ) : filteredTransactions.map(e => {
                            const status = STATUS_CONFIG[e.status || 'draft'];
                            return (
                                <div key={e.id} onClick={() => setDraft({ ...getEmptyDraft('transaction'), ...e, items: e.items || [] })} className={`group relative p-4 rounded-2xl border-2 transition-all cursor-pointer hover:shadow-lg active:scale-[0.98] ${draft.id === e.id ? 'bg-teal-50 border-teal-500 shadow-teal-100/50' : 'bg-white border-slate-50 hover:border-slate-200'}`}>
                                    <div className="flex items-start justify-between mb-2">
                                        <h3 className={`text-[17px] font-black leading-tight flex-1 pr-6 ${draft.id === e.id ? 'text-teal-900' : 'text-slate-800'}`}>{e.projectName || e.title || '제목 없음'}</h3>
                                        <button onClick={ev => deleteTransaction(e.id!, ev)} className="opacity-0 group-hover:opacity-100 absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-xl bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white transition-all shadow-sm"><FontAwesomeIcon icon={faTrash} className="text-[11px]" /></button>
                                    </div>
                                    <div className="space-y-1.5">
                                        <div className="flex items-center gap-2">
                                            <span className={`rounded-lg px-2 py-0.5 text-[13px] font-black ${e.estimateMode === 'rental' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                                                {e.estimateMode === 'rental' ? '임대' : '일반'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-[14px] font-bold text-slate-500"><FontAwesomeIcon icon={faBuilding} className="w-3" /><span className="truncate">{e.clientCompany || '업체 미지정'}</span></div>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 text-[14px] font-bold text-slate-400"><FontAwesomeIcon icon={faCalendarDays} className="w-3" /><span>{e.issueDate || '날짜 미지정'}</span></div>
                                            <button onClick={ev => changeStatus(e.id!, e.status || 'draft', ev)} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[13px] font-black transition-all ${status.bg} ${status.color} hover:scale-105 active:scale-95 shadow-sm`}><FontAwesomeIcon icon={status.icon} />{status.label}</button>
                                        </div>
                                    </div>
                                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                                        <span className="text-[16px] font-black text-teal-600">{formatCurrency(e.total)} <span className="text-[13px] font-bold opacity-70">원</span></span>
                                        <FontAwesomeIcon icon={faChevronRight} className={`text-[10px] transition-transform ${draft.id === e.id ? 'translate-x-1 text-teal-500' : 'text-slate-200'}`} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </aside>

                <main className="flex-1 overflow-auto bg-slate-50/50 flex flex-col min-w-0 print:block print:overflow-visible print:bg-white print:p-0 print:m-0 no-scrollbar">
                    <div className="flex-1 flex flex-col items-center p-6 print:p-0">
                        {isRentalTransaction && (
                            <section className="mb-6 w-full max-w-[96rem] rounded-2xl border border-amber-200 bg-white p-5 shadow-sm print:hidden">
                                <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h2 className="text-[18px] font-black text-slate-900">임대 금액 자동 생성</h2>
                                            <span className="rounded-lg bg-amber-100 px-2 py-1 text-[14px] font-black text-amber-700">
                                                사용 {rentalActiveCount} / 선택 {rentalRatesForSelectedWorkType.length}
                                            </span>
                                        </div>
                                        {lastRentalGeneration && (
                                            <div className="mt-2 flex flex-wrap items-center gap-2 text-[15px] font-bold text-slate-500">
                                                <span>목표 공급가 {formatCurrency(lastRentalGeneration.targetSupply)}원</span>
                                                <span>생성 공급가 {formatCurrency(lastRentalGeneration.subtotal)}원</span>
                                                <span className={lastRentalGeneration.difference === 0 ? 'text-emerald-600' : 'text-rose-600'}>
                                                    차이 {formatCurrency(lastRentalGeneration.difference)}원
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="grid w-full grid-cols-2 gap-3 md:grid-cols-6 xl:w-auto xl:min-w-[980px]">
                                        <label className="col-span-2 md:col-span-1">
                                            <span className="mb-1 block text-[14px] font-black text-slate-500">임대 품목</span>
                                            <select
                                                value={rentalWorkType}
                                                onChange={e => {
                                                    setRentalWorkType(e.target.value as RentalWorkType);
                                                    setLastRentalGeneration(null);
                                                }}
                                                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-[17px] font-bold outline-none focus:border-amber-500"
                                            >
                                                <option value="shoring">시스템동바리</option>
                                                <option value="scaffold">시스템비계</option>
                                            </select>
                                        </label>
                                        <label className="col-span-2 md:col-span-1">
                                            <span className="mb-1 block text-[14px] font-black text-slate-500">목표 금액</span>
                                            <input
                                                value={rentalTargetAmount}
                                                onChange={e => setRentalTargetAmount(e.target.value)}
                                                onBlur={() => setRentalTargetAmount(rentalTargetAmount ? formatCurrency(parseMoneyInput(rentalTargetAmount)) : '')}
                                                inputMode="numeric"
                                                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-right text-[17px] font-black outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
                                                placeholder="0"
                                            />
                                        </label>
                                        <label>
                                            <span className="mb-1 block text-[14px] font-black text-slate-500">금액 기준</span>
                                            <select
                                                value={rentalAmountBasis}
                                                onChange={e => setRentalAmountBasis(e.target.value as RentalAmountBasis)}
                                                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-[17px] font-bold outline-none focus:border-amber-500"
                                            >
                                                <option value="supply">공급가</option>
                                                <option value="total">VAT 포함</option>
                                            </select>
                                        </label>
                                        <label>
                                            <span className="mb-1 block text-[14px] font-black text-slate-500">사용일수</span>
                                            <input
                                                type="number"
                                                min={1}
                                                value={rentalUsageDays}
                                                onChange={e => setRentalUsageDays(Math.max(1, Number(e.target.value) || 1))}
                                                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-right text-[17px] font-bold outline-none focus:border-amber-500"
                                            />
                                        </label>
                                        <label>
                                            <span className="mb-1 block text-[14px] font-black text-slate-500">자재 수</span>
                                            <input
                                                type="number"
                                                min={1}
                                                max={30}
                                                value={rentalRowCount}
                                                onChange={e => setRentalRowCount(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
                                                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-right text-[17px] font-bold outline-none focus:border-amber-500"
                                            />
                                        </label>
                                        <div className="flex items-end gap-2">
                                            <button
                                                onClick={() => setRentalSettingsOpen(open => !open)}
                                                className="h-10 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-[15px] font-black text-slate-600 transition hover:border-amber-400 hover:text-amber-700"
                                            >
                                                단가 설정
                                            </button>
                                            <button
                                                onClick={applyRentalGeneration}
                                                className="h-10 flex-1 rounded-lg bg-amber-600 px-3 text-[15px] font-black text-white shadow-sm transition hover:bg-amber-700"
                                            >
                                                적용
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {rentalSettingsOpen && (
                                    <div className="mt-5 border-t border-slate-100 pt-4">
                                        <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                            <input
                                                value={rentalRateSearch}
                                                onChange={e => setRentalRateSearch(e.target.value)}
                                                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-[17px] font-bold outline-none focus:border-amber-500 md:max-w-sm"
                                                placeholder="분류, 품목, 규격 검색"
                                            />
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={loadRentalMaterials}
                                                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[15px] font-black text-slate-600 hover:border-slate-300"
                                                >
                                                    자재 새로고침
                                                </button>
                                                <button
                                                    onClick={resetRentalRatesFromMaster}
                                                    className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[15px] font-black text-amber-700 hover:bg-amber-100"
                                                >
                                                    단가 초기화
                                                </button>
                                            </div>
                                        </div>
                                        <div className="max-h-[320px] overflow-auto rounded-xl border border-slate-200">
                                            <table className="w-full min-w-[940px] text-[17px]">
                                                <thead className="sticky top-0 z-10 bg-slate-100 text-[15px] text-slate-600">
                                                    <tr>
                                                        <th className="w-16 px-3 py-2 text-center font-black">사용</th>
                                                        <th className="px-3 py-2 text-left font-black">분류</th>
                                                        <th className="px-3 py-2 text-left font-black">품목</th>
                                                        <th className="px-3 py-2 text-left font-black">규격</th>
                                                        <th className="w-20 px-3 py-2 text-center font-black">단위</th>
                                                        <th className="w-28 px-3 py-2 text-right font-black">기본료</th>
                                                        <th className="w-28 px-3 py-2 text-right font-black">일 단가</th>
                                                        <th className="w-28 px-3 py-2 text-right font-black">최대수량</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {filteredRentalRates.map((rate) => (
                                                        <tr key={rate.materialId} className="hover:bg-amber-50/50">
                                                            <td className="px-3 py-2 text-center">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={rate.active !== false}
                                                                    onChange={e => updateRentalRate(rate.materialId, 'active', e.target.checked)}
                                                                    className="h-4 w-4 rounded border-slate-300 text-amber-600"
                                                                />
                                                            </td>
                                                            <td className="px-3 py-2 font-bold text-slate-700">{rate.category}</td>
                                                            <td className="px-3 py-2 font-black text-slate-900">{rate.itemName}</td>
                                                            <td className="px-3 py-2 text-slate-600">{rate.spec || '-'}</td>
                                                            <td className="px-3 py-2 text-center font-bold text-slate-600">{rate.unit}</td>
                                                            <td className="px-3 py-2">
                                                                <input
                                                                    type="number"
                                                                    value={rate.baseFee}
                                                                    onChange={e => updateRentalRate(rate.materialId, 'baseFee', Math.max(0, Number(e.target.value) || 0))}
                                                                    className="h-8 w-full rounded-md border border-slate-200 px-2 text-right font-bold outline-none focus:border-amber-500"
                                                                />
                                                            </td>
                                                            <td className="px-3 py-2">
                                                                <input
                                                                    type="number"
                                                                    value={rate.dailyFee}
                                                                    onChange={e => updateRentalRate(rate.materialId, 'dailyFee', Math.max(0, Number(e.target.value) || 0))}
                                                                    className="h-8 w-full rounded-md border border-slate-200 px-2 text-right font-bold outline-none focus:border-amber-500"
                                                                />
                                                            </td>
                                                            <td className="px-3 py-2">
                                                                <input
                                                                    type="number"
                                                                    value={rate.maxQuantity}
                                                                    onChange={e => updateRentalRate(rate.materialId, 'maxQuantity', Math.max(1, Number(e.target.value) || 1))}
                                                                    className="h-8 w-full rounded-md border border-slate-200 px-2 text-right font-bold outline-none focus:border-amber-500"
                                                                />
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {filteredRentalRates.length === 0 && (
                                                        <tr>
                                                            <td colSpan={8} className="px-3 py-10 text-center text-[17px] font-bold text-slate-400">
                                                                자재가 없습니다.
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </section>
                        )}
                        <div className="mx-auto w-full max-w-[96rem] bg-white p-8 shadow-2xl shadow-slate-200/50 border border-slate-200 rounded-[2rem] print:border-none print:shadow-none print:p-0 print:max-w-none print:rounded-none">
                            <TitleComponent text={isRentalTransaction ? '임 대 거 래 명 세 표' : '거 래 명 세 표'} logoUrl={logoUrl} />
                            <InfoTableComponent draft={draft} isEdit={true} updateDraft={updateDraft} />
                            <AmountBarComponent subtotal={subtotal} totalAmt={total} taxAmt={tax} isTransaction={true} draft={draft} />
                            {isRentalTransaction ? (
                                <RentalTransactionTable draft={draft} itemsWithCalc={itemsWithCalc} isEdit={true} updateItem={updateItem} setDraft={setDraft} />
                            ) : (
                                <TransactionTable draft={draft} itemsWithCalc={itemsWithCalc} isEdit={true} updateItem={updateItem} setDraft={setDraft} />
                            )}
                            <div
                                className="mt-6 p-6 border-2 border-dashed border-slate-200 rounded-2xl text-center font-black text-slate-400 text-[19px] tracking-widest uppercase"
                                style={{ textAlign: 'center' }}
                            >
                                위 금액을 정히 영수(청구)함
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default TransactionManagePage;
