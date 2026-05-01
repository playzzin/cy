import React, { useEffect, useMemo, useState, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faPlus, faSave, faSpinner, faTrash, faMagnifyingGlass, faFileInvoiceDollar,
    faChevronRight, faCalendarDays, faBuilding, faDiagramProject, faCheckCircle,
    faClock, faPaperPlane, faTimesCircle, faCamera, faFileExcel
} from '@fortawesome/free-solid-svg-icons';
import { estimateService, Estimate, EstimateStatus } from '../../services/estimateService';
import { companyFirestoreService } from '../../services/companyFirestoreService';
import { CompanyZod } from '../../types/zod/companySchema';
import { db } from '../../config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import Swal from 'sweetalert2';

import { 
    getEmptyDraft, PRINT_STYLES, LOGO_FALLBACK,
    EstimateDraft, createItem, formatCurrency
} from '../../utils/estimateUtils';
import { 
    TitleComponent, InfoTableComponent, AmountBarComponent 
} from '../../components/estimate/EstimateSharedComponents';
import { EstimateTable } from '../../components/estimate/EstimateTable';
import { downloadEstimateExcel } from '../../utils/estimateExcelUtils';

// 상태별 설정
const STATUS_CONFIG: Record<EstimateStatus, { label: string; color: string; bg: string; icon: any }> = {
    draft: { label: '대기', color: 'text-slate-600', bg: 'bg-slate-100', icon: faClock },
    sent: { label: '발송', color: 'text-indigo-600', bg: 'bg-indigo-100', icon: faPaperPlane },
    approved: { label: '확정', color: 'text-emerald-600', bg: 'bg-emerald-100', icon: faCheckCircle },
    rejected: { label: '반려', color: 'text-rose-600', bg: 'bg-rose-100', icon: faTimesCircle }
};

const EstimateManagePage: React.FC = () => {
    const [draft, setDraft] = useState<EstimateDraft>(() => getEmptyDraft('estimate'));
    const [estimates, setEstimates] = useState<Estimate[]>([]);
    const [myCompany, setMyCompany] = useState<CompanyZod | null>(null);
    const scopeNotesRef = useRef<HTMLTextAreaElement>(null);

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | EstimateStatus>('all');
    const [logoUrl, setLogoUrl] = useState<string>('');

    // 엑셀 다운로드 핸들러
    const handleExcelDownload = async () => {
        try {
            await downloadEstimateExcel(draft, itemsWithCalc, subtotal, tax, total, 'estimate');
            Swal.fire({
                icon: 'success',
                title: '엑셀 변환 완료',
                text: '품목 및 서식이 적용된 엑셀 파일이 생성되었습니다.',
                toast: true, position: 'top-end', showConfirmButton: false, timer: 3000
            });
        } catch (e) {
            console.error(e);
            Swal.fire('오류', '엑셀 생성 중 문제가 발생했습니다.', 'error');
        }
    };


    // 자동 높이 조절
    useEffect(() => {
        const resize = () => {
            if (scopeNotesRef.current) {
                scopeNotesRef.current.style.height = 'auto';
                scopeNotesRef.current.style.height = scopeNotesRef.current.scrollHeight + 'px';
            }
        };
        resize();
        const timer = setTimeout(resize, 100);
        return () => clearTimeout(timer);
    }, [draft.scopeNotes, draft.id]);

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
            setEstimates(
                fetchedEstimates.filter(
                    e => e.documentType !== 'transaction' && e.templateType !== 'detailed'
                )
            );
            
            const main = fetchedCompanies.find(c => {
                const n = (c.name || '').replace(/\s/g, '');
                return n.includes('청연이엔지') || n.includes('청연ENG');
            }) || fetchedCompanies.find(c => c.name.includes('청연')) 
               || fetchedCompanies.find(c => c.isMyCompany) 
               || fetchedCompanies[0];
            
            if (main) {
                setMyCompany(main);
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

    // 계산 로직
    const itemsWithCalc = useMemo(() => draft.items.map(item => {
        const qty = item.quantity || 0;
        const laborPrice = item.laborUnitPrice || (draft.estimateMode === 'rental' ? (item.finalUnitPrice || 0) : 0);
        const rentalPrice = item.rentalUnitPrice || 0;

        let amount = 0;
        let laborAmount = 0;
        let rentalAmount = 0;

        if (draft.estimateMode === 'rental') {
            laborAmount = laborPrice * qty;
            rentalAmount = rentalPrice * qty;
            amount = laborAmount + rentalAmount;
        } else {
            amount = (item.finalUnitPrice || 0) * qty;
        }

        const ratio = (draft.installRatio || 50) / 100;
        return { 
            ...item, 
            amount, 
            laborAmount,
            rentalAmount,
            laborUnitPrice: laborPrice,
            install50: Math.round(amount * ratio), 
            remove50: amount - Math.round(amount * ratio) 
        };
    }), [draft.items, draft.installRatio, draft.estimateMode]);

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
            if (field === 'laborUnitPrice') updated.unitPrice = val; // 일관성 유지
            n[idx] = updated;
            return { ...d, items: n };
        });
    };

    const resetPage = () => {
        const empty = getEmptyDraft('estimate');
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
    };

    const saveEstimate = async () => {
        if (!draft.title || !draft.clientCompany) {
            Swal.fire('알림', '필수 항목(제목, 업체명)을 입력해주세요.', 'warning');
            return;
        }
        try {
            setSaving(true);
            const payload = { ...draft, items: itemsWithCalc, subtotal, total };
            if (draft.id) {
                await estimateService.updateEstimate(draft.id, payload);
                Swal.fire('성공', '견적서가 수정되었습니다.', 'success');
            } else {
                const newId = await estimateService.addEstimate(payload);
                setDraft(prev => ({ ...prev, id: newId }));
                Swal.fire('성공', '새 견적서가 저장되었습니다.', 'success');
            }
            loadData();
        } catch (e) {
            console.error(e);
            Swal.fire('오류', '저장 중 문제가 발생했습니다.', 'error');
        } finally { setSaving(false); }
    };

    const deleteEstimate = async (id: string, ev: React.MouseEvent) => {
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
                Swal.fire('삭제됨', '견적서가 삭제되었습니다.', 'success');
                loadData();
                if (draft.id === id) resetPage();
            } catch (e) { Swal.fire('오류', '삭제 중 문제가 발생했습니다.', 'error'); }
        }
    };

    // 상태 변경 핸들러
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

    const filteredEstimates = useMemo(() => {
        const low = searchText.toLowerCase();
        return estimates.filter(e => {
            const matchesText = (e.title || '').toLowerCase().includes(low) || 
                               (e.projectName || '').toLowerCase().includes(low) ||
                               (e.clientCompany || '').toLowerCase().includes(low);
            const matchesStatus = statusFilter === 'all' || e.status === statusFilter;
            return matchesText && matchesStatus;
        });
    }, [estimates, searchText, statusFilter]);

    return (
        <div className="flex flex-col h-screen overflow-hidden bg-slate-50 font-sans text-slate-900">
            <style>{PRINT_STYLES}</style>
            
            <header className="flex flex-none items-center justify-between border-b bg-white px-6 py-4 shadow-sm z-30 print:hidden">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl shadow-lg bg-indigo-600">
                        <FontAwesomeIcon icon={faFileInvoiceDollar} className="text-lg text-white" />
                    </div>
                    <div>
                        <h1 className="text-[16px] font-black tracking-tight text-slate-900 leading-tight">청연 견적 시스템</h1>
                        <p className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">Estimate Management System</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex p-0.5 bg-slate-100 rounded-xl border border-slate-200">
                        <button 
                            onClick={() => updateDraft('estimateMode', 'standard')} 
                            className={`px-4 py-1.5 text-[11px] font-black rounded-lg transition-all ${draft.estimateMode !== 'rental' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            기본 표준
                        </button>
                        <button 
                            onClick={() => updateDraft('estimateMode', 'rental')} 
                            className={`px-4 py-1.5 text-[11px] font-black rounded-lg transition-all ${draft.estimateMode === 'rental' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            임대료형
                        </button>
                    </div>

                    <div className="h-8 w-px bg-slate-200" />

                    <div className="flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-xl border border-slate-200">
                        <span className="text-[11px] font-bold text-slate-500">인건비 비율</span>
                        <input type="number" value={draft.installRatio} onChange={e => updateDraft('installRatio', Number(e.target.value))} className="w-12 bg-white border border-slate-300 rounded-lg px-1.5 py-0.5 text-[12px] font-black text-center focus:ring-2 focus:ring-indigo-500 outline-none" />
                        <span className="text-[11px] font-bold text-slate-500">% / {100 - (draft.installRatio || 0)}%</span>
                    </div>
                    <div className="h-8 w-px bg-slate-200" />
                    <div className="flex items-center gap-2">
                        <button onClick={resetPage} className="inline-flex items-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-4 py-2.5 text-[12px] font-black text-slate-600 hover:border-indigo-500 hover:text-indigo-600 transition-all hover:shadow-md">
                            <FontAwesomeIcon icon={faPlus} /> 새 견적서
                        </button>
                        <button onClick={handleExcelDownload} className="inline-flex items-center gap-2 rounded-xl border-2 border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[12px] font-black text-emerald-700 hover:bg-emerald-600 hover:text-white transition-all hover:shadow-md">
                            <FontAwesomeIcon icon={faFileExcel} /> 엑셀 다운로드
                        </button>
                        <button onClick={saveEstimate} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white px-6 py-2.5 text-[12px] font-black hover:bg-indigo-600 disabled:opacity-50 shadow-xl transition-all active:scale-95">
                            <FontAwesomeIcon icon={saving ? faSpinner : faSave} spin={saving} /> {saving ? '저장 중...' : (draft.id ? '견적서 수정' : '견적서 저장')}
                        </button>
                    </div>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                <aside className="w-[340px] flex-none bg-white border-r flex flex-col print:hidden shadow-[4px_0_10px_rgba(0,0,0,0.02)]">
                    <div className="p-5 border-b bg-slate-50/50 space-y-4">
                        <div className="relative group">
                            <FontAwesomeIcon icon={faMagnifyingGlass} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-[12px] group-focus-within:text-indigo-500 transition-colors" />
                            <input 
                                value={searchText} 
                                onChange={e => setSearchText(e.target.value)} 
                                placeholder="업체명, 프로젝트 검색..." 
                                className="w-full pl-10 pr-4 py-3 text-[13px] bg-white border border-slate-200 rounded-2xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all font-bold placeholder:text-slate-300 shadow-sm" 
                            />
                        </div>
                        
                        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                            <button onClick={() => setStatusFilter('all')} className={`flex-none px-3 py-1.5 rounded-xl text-[11px] font-black transition-all ${statusFilter === 'all' ? 'bg-slate-900 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-300'}`}>전체</button>
                            {(['draft', 'sent', 'approved', 'rejected'] as EstimateStatus[]).map(statusKey => {
                                const cfg = STATUS_CONFIG[statusKey];
                                const isActive = statusFilter === statusKey;
                                return (
                                    <button key={statusKey} onClick={() => setStatusFilter(statusKey)} className={`flex-none px-3 py-1.5 rounded-xl text-[11px] font-black transition-all border ${isActive ? `${cfg.bg} ${cfg.color} border-transparent shadow-sm` : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200'}`}>{cfg.label}</button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center h-40 gap-3 text-slate-300">
                                <FontAwesomeIcon icon={faSpinner} spin className="text-2xl" /><span className="text-[12px] font-bold">불러오는 중...</span>
                            </div>
                        ) : filteredEstimates.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-40 text-slate-300 italic text-[12px]">결과가 없습니다.</div>
                        ) : filteredEstimates.map(e => {
                            const status = STATUS_CONFIG[e.status || 'draft'];
                            return (
                                <div key={e.id} onClick={() => setDraft({ ...getEmptyDraft('estimate'), ...e, items: e.items || [] })} className={`group relative p-4 rounded-2xl border-2 transition-all cursor-pointer hover:shadow-lg active:scale-[0.98] ${draft.id === e.id ? 'bg-indigo-50 border-indigo-500 shadow-indigo-100/50' : 'bg-white border-slate-50 hover:border-slate-200'}`}>
                                    <div className="flex items-start justify-between mb-2">
                                        <h3 className={`text-[14px] font-black leading-tight flex-1 pr-6 ${draft.id === e.id ? 'text-indigo-900' : 'text-slate-800'}`}>{e.projectName || e.title || '제목 없음'}</h3>
                                        <button onClick={ev => deleteEstimate(e.id!, ev)} className="opacity-0 group-hover:opacity-100 absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-xl bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white transition-all shadow-sm"><FontAwesomeIcon icon={faTrash} className="text-[11px]" /></button>
                                    </div>
                                    <div className="space-y-1.5">
                                        <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500"><FontAwesomeIcon icon={faBuilding} className="w-3" /><span className="truncate">{e.clientCompany || '업체 미지정'}</span></div>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400"><FontAwesomeIcon icon={faCalendarDays} className="w-3" /><span>{e.issueDate || '날짜 미지정'}</span></div>
                                            <button onClick={ev => changeStatus(e.id!, e.status || 'draft', ev)} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black transition-all ${status.bg} ${status.color} hover:scale-105 active:scale-95 shadow-sm`}><FontAwesomeIcon icon={status.icon} />{status.label}</button>
                                        </div>
                                    </div>
                                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                                        <span className="text-[13px] font-black text-indigo-600">{formatCurrency(e.total)} <span className="text-[10px] font-bold opacity-70">원</span></span>
                                        <FontAwesomeIcon icon={faChevronRight} className={`text-[10px] transition-transform ${draft.id === e.id ? 'translate-x-1 text-indigo-500' : 'text-slate-200'}`} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </aside>

                <main className="flex-1 overflow-auto bg-slate-50/50 flex flex-col min-w-0 print:block print:overflow-visible print:bg-white print:p-0 print:m-0 no-scrollbar">
                    <div className="flex-1 flex flex-col items-center p-10 print:p-0">
                        <div className="mx-auto w-full max-w-7xl bg-white p-12 shadow-2xl shadow-slate-200/50 border border-slate-200 rounded-[2rem] print:border-none print:shadow-none print:p-0 print:max-w-none print:rounded-none">
                            <TitleComponent text={draft.title || '견 적 서'} logoUrl={logoUrl} />
                            <InfoTableComponent draft={draft} isEdit={true} updateDraft={updateDraft} />
                            <AmountBarComponent subtotal={subtotal} totalAmt={total} taxAmt={tax} label="" isTransaction={false} draft={draft} />
                            <EstimateTable draft={draft} itemsWithCalc={itemsWithCalc} subtotal={subtotal} isEdit={true} updateItem={updateItem} setDraft={setDraft} />
                            
                            <div className="mt-12 space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="h-6 w-1.5 bg-indigo-500 rounded-full" />
                                    <label className="text-[18px] font-black text-slate-800 uppercase tracking-tight">특약사항 <span className="text-[12px] font-bold text-slate-400 ml-2">Special Terms</span></label>
                                </div>
                                <textarea 
                                    ref={scopeNotesRef} 
                                    value={draft.scopeNotes} 
                                    onChange={e => updateDraft('scopeNotes', e.target.value)} 
                                    spellCheck="false" 
                                    className="w-full p-6 text-[15px] leading-relaxed border-2 border-slate-100 rounded-3xl focus:border-indigo-500 focus:ring-0 transition-all resize-none bg-slate-50/50 overflow-hidden font-medium text-slate-700" 
                                    style={{ minHeight: '400px' }} 
                                />
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default EstimateManagePage;
