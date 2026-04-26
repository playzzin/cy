import React, { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faFileInvoiceDollar,
    faPlus,
    faRotateRight,
    faDownload,
    faTrash,
    faCheckCircle,
    faClock,
    faForward,
    faBan,
    faBuilding,
    faChevronLeft,
    faChevronRight,
} from '@fortawesome/free-solid-svg-icons';
import { taxInvoiceListService } from '../../services/taxInvoiceListService';
import { TaxInvoiceIssue, IssueStatus, SiteWorkSummary } from '../../types/taxInvoiceList';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const toYearMonth = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const formatYearMonth = (ym: string) => {
    const [y, m] = ym.split('-');
    return `${y}년 ${Number(m)}월`;
};

const STATUS_CONFIG: Record<IssueStatus, { label: string; color: string; icon: any; bg: string; border: string }> = {
    issued: {
        label: '발행완료', color: 'text-green-700', icon: faCheckCircle,
        bg: 'bg-green-50', border: 'border-green-200',
    },
    pending: {
        label: '발행대기', color: 'text-amber-700', icon: faClock,
        bg: 'bg-amber-50', border: 'border-amber-200',
    },
    deferred: {
        label: '발행이월', color: 'text-blue-700', icon: faForward,
        bg: 'bg-blue-50', border: 'border-blue-200',
    },
    cancelled: {
        label: '발행취소', color: 'text-red-700', icon: faBan,
        bg: 'bg-red-50', border: 'border-red-200',
    },
};

const SITE_TYPE_OPTIONS = ['전체', '지원', '도급', '직영'];
const PAYMENT_TYPE_OPTIONS = ['전체', '계산서', '노무'];

const EMPTY_ISSUE = (yearMonth: string, no: number): Omit<TaxInvoiceIssue, 'id' | 'createdAt' | 'updatedAt'> => ({
    yearMonth,
    no,
    isNew: true,
    issueDate: `${yearMonth}-01`,
    recipient: '',
    item: '',
    supplyAmount: 0,
    note: '',
    manDays: 0,
    teamName: '',
    remark: '',
    issueStatus: 'pending',
    scanCompleted: false,
    siteId: '',
    siteName: '',
    siteType: '',
    paymentType: '',
});

const fmt = (n: number) => n.toLocaleString('ko-KR');

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

const StatusBadge: React.FC<{ status: IssueStatus }> = ({ status }) => {
    const cfg = STATUS_CONFIG[status];
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
            <FontAwesomeIcon icon={cfg.icon} className="text-[10px]" />
            {cfg.label}
        </span>
    );
};

// ─────────────────────────────────────────────
// Site Data Import Modal
// ─────────────────────────────────────────────

interface SiteImportModalProps {
    sites: SiteWorkSummary[];
    onClose: () => void;
    onImport: (selected: SiteWorkSummary[]) => void;
}

const SiteImportModal: React.FC<SiteImportModalProps> = ({ sites, onClose, onImport }) => {
    const [checked, setChecked] = useState<Set<string>>(new Set());
    const [filterSiteType, setFilterSiteType] = useState<string>('전체');
    const [filterPaymentType, setFilterPaymentType] = useState<string>('전체');

    // unique key per row: siteName|siteType|paymentType
    const rowKey = (s: SiteWorkSummary) => `${s.siteName}|${s.siteType}|${s.paymentType}`;

    const filtered = sites.filter(s => {
        const matchSiteType = filterSiteType === '전체' || s.siteType === filterSiteType;
        const matchPaymentType = filterPaymentType === '전체' || s.paymentType === filterPaymentType;
        return matchSiteType && matchPaymentType;
    });

    const toggle = (key: string) => {
        setChecked(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const toggleAll = () => {
        const filteredKeys = filtered.map(rowKey);
        const allChecked = filteredKeys.every(k => checked.has(k));
        if (allChecked && filteredKeys.length > 0) {
            setChecked(prev => {
                const next = new Set(prev);
                filteredKeys.forEach(k => next.delete(k));
                return next;
            });
        } else {
            setChecked(prev => {
                const next = new Set(prev);
                filteredKeys.forEach(k => next.add(k));
                return next;
            });
        }
    };

    const filteredCheckedCount = filtered.filter(s => checked.has(rowKey(s))).length;
    const allFilteredChecked = filtered.length > 0 && filteredCheckedCount === filtered.length;

    const selectedSites = sites.filter(s => checked.has(rowKey(s)));

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-indigo-600 rounded-xl">
                            <FontAwesomeIcon icon={faBuilding} className="text-white text-sm" />
                        </div>
                        <h2 className="text-base font-black text-slate-900">현장 데이터 가져오기</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 text-xl font-bold w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100"
                    >
                        ×
                    </button>
                </div>

                {/* Filters */}
                <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-500">현장구분</span>
                        <div className="flex gap-1">
                            {SITE_TYPE_OPTIONS.map(opt => (
                                <button
                                    key={opt}
                                    onClick={() => setFilterSiteType(opt)}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                                        filterSiteType === opt
                                            ? 'bg-indigo-600 text-white'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    {opt}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-500">결제구분</span>
                        <div className="flex gap-1">
                            {PAYMENT_TYPE_OPTIONS.map(opt => (
                                <button
                                    key={opt}
                                    onClick={() => setFilterPaymentType(opt)}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                                        filterPaymentType === opt
                                            ? 'bg-indigo-600 text-white'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    {opt}
                                </button>
                            ))}
                        </div>
                    </div>
                    <span className="ml-auto text-xs text-slate-400">{filtered.length}건 표시</span>
                </div>

                <div className="p-5 max-h-[420px] overflow-y-auto">
                    {filtered.length === 0 ? (
                        <p className="text-slate-500 text-sm text-center py-6">해당 조건의 현장 데이터가 없습니다.</p>
                    ) : (
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="px-2 py-2 w-8">
                                        <input
                                            type="checkbox"
                                            checked={allFilteredChecked}
                                            onChange={toggleAll}
                                            className="w-4 h-4 rounded accent-indigo-600"
                                        />
                                    </th>
                                    <th className="px-3 py-2 text-left font-black text-slate-500">현장명</th>
                                    <th className="px-3 py-2 text-left font-black text-slate-500 w-28">발주사(공급받는자)</th>
                                    <th className="px-3 py-2 text-center font-black text-slate-500 w-16">현장구분</th>
                                    <th className="px-3 py-2 text-center font-black text-slate-500 w-16">결제구분</th>
                                    <th className="px-3 py-2 text-left font-black text-slate-500 w-20">현장담당팀</th>
                                    <th className="px-3 py-2 text-right font-black text-slate-500 w-14">공수</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filtered.map(s => {
                                    const key = rowKey(s);
                                    return (
                                        <tr
                                            key={key}
                                            onClick={() => toggle(key)}
                                            className={`cursor-pointer transition-colors ${
                                                checked.has(key) ? 'bg-indigo-50' : 'hover:bg-slate-50'
                                            }`}
                                        >
                                            <td className="px-2 py-2 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={checked.has(key)}
                                                    onChange={() => toggle(key)}
                                                    onClick={e => e.stopPropagation()}
                                                    className="w-4 h-4 rounded accent-indigo-600"
                                                />
                                            </td>
                                            <td className="px-3 py-2 font-bold text-slate-800">{s.siteName}</td>
                                            <td className="px-3 py-2 text-slate-600 max-w-[110px] truncate" title={s.companyName}>
                                                {s.companyName || <span className="text-slate-300">-</span>}
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                {s.siteType ? (
                                                    <span className="px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 font-bold text-[10px]">{s.siteType}</span>
                                                ) : <span className="text-slate-300">-</span>}
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                {s.paymentType ? (
                                                    <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-bold text-[10px]">{s.paymentType}</span>
                                                ) : <span className="text-slate-300">-</span>}
                                            </td>
                                            <td className="px-3 py-2 text-slate-500 truncate">{s.teamName || '-'}</td>
                                            <td className="px-3 py-2 text-right font-semibold text-indigo-600">{s.manDays}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="p-5 border-t border-slate-100 flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-500">
                        {selectedSites.length > 0 ? `${selectedSites.length}건 선택됨` : '선택 없음'}
                    </span>
                    <div className="flex gap-2">
                        <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-all">
                            취소
                        </button>
                        <button
                            onClick={() => {
                                onImport(selectedSites);
                                onClose();
                            }}
                            disabled={selectedSites.length === 0}
                            className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            발행리스트에 추가 ({selectedSites.length}건)
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────
// Editable Cell
// ─────────────────────────────────────────────

type EditableField = keyof TaxInvoiceIssue;

interface EditableCellProps {
    value: string | number | boolean;
    field: EditableField;
    rowId: string | undefined;
    type?: 'text' | 'number' | 'date';
    onCommit: (id: string | undefined, field: EditableField, value: string | number | boolean) => void;
    className?: string;
}

const EditableCell: React.FC<EditableCellProps> = ({
    value, field, rowId, type = 'text', onCommit, className = ''
}) => {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(String(value));
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (editing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [editing]);

    const commit = () => {
        let finalValue: string | number | boolean = draft;
        if (type === 'number') {
            finalValue = Number(draft.replace(/,/g, '')) || 0;
        }
        onCommit(rowId, field, finalValue);
        setEditing(false);
    };

    if (editing) {
        return (
            <input
                ref={inputRef}
                type={type === 'number' ? 'number' : type}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={e => {
                    if (e.key === 'Enter') commit();
                    if (e.key === 'Escape') { setDraft(String(value)); setEditing(false); }
                }}
                className={`w-full px-2 py-1 text-xs border border-indigo-400 rounded-lg outline-none bg-indigo-50 focus:ring-2 focus:ring-indigo-200 ${className}`}
            />
        );
    }

    return (
        <span
            onClick={() => { setDraft(String(value)); setEditing(true); }}
            className={`block cursor-pointer px-1 py-0.5 rounded hover:bg-indigo-50 hover:text-indigo-700 transition-colors min-w-0 truncate ${className}`}
            title={String(value)}
        >
            {type === 'number' ? fmt(Number(value)) : String(value)}
        </span>
    );
};

// Inline dropdown cell for siteType / paymentType
interface SelectCellProps {
    value: string;
    options: string[];
    field: EditableField;
    rowId: string | undefined;
    onCommit: (id: string | undefined, field: EditableField, value: string | number | boolean) => void;
    badgeClass?: string;
}

const SelectCell: React.FC<SelectCellProps> = ({ value, options, field, rowId, onCommit, badgeClass = '' }) => {
    return (
        <select
            value={value || ''}
            onChange={e => onCommit(rowId, field, e.target.value)}
            className={`text-xs border-0 bg-transparent cursor-pointer outline-none font-bold w-full ${badgeClass}`}
        >
            <option value="">-</option>
            {options.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
            ))}
        </select>
    );
};

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────

const TaxInvoiceIssueListPage: React.FC = () => {
    const [yearMonth, setYearMonth] = useState<string>(toYearMonth(new Date()));
    const [issues, setIssues] = useState<TaxInvoiceIssue[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState<Set<string>>(new Set());

    // Site import
    const [siteData, setSiteData] = useState<SiteWorkSummary[]>([]);
    const [showImportModal, setShowImportModal] = useState(false);
    const [loadingSites, setLoadingSites] = useState(false);
    const [statusFilter, setStatusFilter] = useState<IssueStatus | 'all'>('all');

    // ── Load issues ──
    const loadIssues = async () => {
        setLoading(true);
        try {
            const data = await taxInvoiceListService.getIssuesByMonth(yearMonth);
            setIssues(data.sort((a, b) => a.no - b.no));
        } catch (e) {
            console.error('발행리스트 로드 실패:', e);
            setIssues([]);
            alert(`${yearMonth} 데이터 로드에 실패했습니다. 콘솔을 확인해주세요.`);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadIssues(); setSiteData([]); }, [yearMonth]);

    // ── Month navigation ──
    const stepMonth = (delta: number) => {
        const [y, m] = yearMonth.split('-').map(Number);
        const d = new Date(y, m - 1 + delta, 1);
        setYearMonth(toYearMonth(d));
    };

    // ── Add row ──
    const handleAddRow = async () => {
        const nextNo = issues.length > 0 ? Math.max(...issues.map(i => i.no)) + 1 : 1;
        const newIssue = EMPTY_ISSUE(yearMonth, nextNo);
        try {
            const id = await taxInvoiceListService.addIssue(newIssue);
            setIssues(prev => [...prev, { ...newIssue, id }]);
        } catch (e) {
            console.error(e);
        }
    };

    // ── Delete row ──
    const handleDelete = async (id: string | undefined) => {
        if (!id) return;
        if (!window.confirm('이 항목을 삭제하시겠습니까?')) return;
        try {
            await taxInvoiceListService.deleteIssue(id);
            setIssues(prev => prev.filter(i => i.id !== id));
        } catch (e) {
            console.error(e);
        }
    };

    // ── Inline edit commit ──
    const handleCellCommit = async (
        id: string | undefined,
        field: EditableField,
        value: string | number | boolean
    ) => {
        if (!id) return;
        setSaving(prev => new Set(prev).add(id));
        try {
            const update: Partial<TaxInvoiceIssue> = { [field]: value };
            await taxInvoiceListService.updateIssue(id, update);
            setIssues(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
        } catch (e) {
            console.error(e);
        } finally {
            setSaving(prev => { const n = new Set(prev); n.delete(id); return n; });
        }
    };

    // ── Status toggle ──
    const handleStatusChange = async (id: string | undefined, status: IssueStatus) => {
        if (!id) return;
        await handleCellCommit(id, 'issueStatus', status);
    };

    // ── Scan toggle ──
    const handleScanToggle = async (id: string | undefined, current: boolean) => {
        if (!id) return;
        await handleCellCommit(id, 'scanCompleted', !current);
    };

    // ── isNew toggle ──
    const handleNewToggle = async (id: string | undefined, current: boolean) => {
        if (!id) return;
        await handleCellCommit(id, 'isNew', !current);
    };

    // ── Load site data ──
    const handleLoadSites = async () => {
        setLoadingSites(true);
        try {
            const data = await taxInvoiceListService.fetchMonthlySiteData(yearMonth);
            setSiteData(data);
            setShowImportModal(true);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingSites(false);
        }
    };

    // ── Import sites as issues ──
    const handleImportSites = async (selected: SiteWorkSummary[]) => {
        const maxNo = issues.length > 0 ? Math.max(...issues.map(i => i.no)) : 0;
        const newIssues: Omit<TaxInvoiceIssue, 'id' | 'createdAt' | 'updatedAt'>[] = selected.map((s, idx) => ({
            yearMonth,
            no: maxNo + idx + 1,
            isNew: true,
            issueDate: `${yearMonth}-01`,
            recipient: s.companyName,    // 발주사 → 공급받는자
            item: '',                    // 품목 (나중에 수정 가능)
            supplyAmount: 0,
            note: s.siteName,            // 현장명 → 비고
            manDays: s.manDays,
            teamName: s.teamName,        // 현장담당팀
            remark: '',                  // 특이사항 (나중에 입력)
            issueStatus: 'pending' as IssueStatus,
            scanCompleted: false,
            siteId: s.siteId,
            siteName: s.siteName,
            siteType: s.siteType,
            paymentType: s.paymentType,
        }));

        const added: TaxInvoiceIssue[] = [];
        for (const issue of newIssues) {
            try {
                const id = await taxInvoiceListService.addIssue(issue);
                added.push({ ...issue, id });
            } catch (e) {
                console.error(e);
            }
        }
        setIssues(prev => [...prev, ...added]);
    };

    // ── Derived stats ──
    const stats = {
        issued: issues.filter(i => i.issueStatus === 'issued').length,
        pending: issues.filter(i => i.issueStatus === 'pending').length,
        deferred: issues.filter(i => i.issueStatus === 'deferred').length,
        cancelled: issues.filter(i => i.issueStatus === 'cancelled').length,
    };

    const totalSupply = issues
        .filter(i => i.issueStatus !== 'cancelled')
        .reduce((acc, i) => acc + (i.supplyAmount || 0), 0);

    const totalManDays = issues
        .filter(i => i.issueStatus !== 'cancelled')
        .reduce((acc, i) => acc + (i.manDays || 0), 0);
    const totalManDaysRounded = Math.round(totalManDays * 10) / 10;

    // Filtered issues by status
    const filteredIssues = statusFilter === 'all'
        ? issues
        : issues.filter(i => i.issueStatus === statusFilter);

    // Deferred sites (status === 'deferred')
    const deferredSites = issues
        .filter(i => i.issueStatus === 'deferred')
        .map(i => ({
            siteName: i.note || i.item,
            manDays: i.manDays,
            teamName: '',
            note: i.item,
        }));

    // ─────────────────────────────────────────────
    return (
        <div className="flex flex-col p-6 gap-5 bg-slate-50 min-h-full">
            {/* ── Header ── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-100">
                        <FontAwesomeIcon icon={faFileInvoiceDollar} className="text-white text-xl" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight">세금계산서 발행리스트</h1>
                        <p className="text-sm text-slate-500 font-medium">월별 발행 내역을 관리합니다.</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {/* Month Selector */}
                    <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-2 py-1 shadow-sm">
                        <button
                            onClick={() => stepMonth(-1)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-50 transition-all"
                        >
                            <FontAwesomeIcon icon={faChevronLeft} className="text-xs" />
                        </button>
                        <span className="px-3 text-sm font-black text-slate-800 min-w-[80px] text-center">
                            {formatYearMonth(yearMonth)}
                        </span>
                        <button
                            onClick={() => stepMonth(1)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-50 transition-all"
                        >
                            <FontAwesomeIcon icon={faChevronRight} className="text-xs" />
                        </button>
                    </div>

                    <button
                        onClick={handleLoadSites}
                        disabled={loadingSites}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-all shadow-sm disabled:opacity-60"
                    >
                        <FontAwesomeIcon icon={faDownload} className={loadingSites ? 'animate-spin' : ''} />
                        현장 데이터 가져오기
                    </button>

                    <button
                        onClick={handleAddRow}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95"
                    >
                        <FontAwesomeIcon icon={faPlus} />
                        행 추가
                    </button>

                    <button
                        onClick={loadIssues}
                        disabled={loading}
                        className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-xl transition-all border border-transparent hover:border-slate-200"
                        title="새로고침"
                    >
                        <FontAwesomeIcon icon={faRotateRight} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* ── Main Layout (Sidebar + Table) ── */}
            <div className="flex gap-5 flex-1 min-h-0">
                {/* ── Sidebar ── */}
                <aside className="w-[300px] flex-shrink-0 flex flex-col gap-4">
                    {/* Status Summary Card */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
                        <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-3">상태 요약</h3>
                        <div className="space-y-2">
                            <button
                                onClick={() => setStatusFilter('all')}
                                className={`w-full flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                                    statusFilter === 'all'
                                        ? 'bg-slate-200 border-slate-400 ring-2 ring-slate-400/30'
                                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                                }`}
                            >
                                <span className="text-sm font-bold text-slate-600">전체</span>
                                <span className="text-sm font-black text-slate-700">{issues.length}건</span>
                            </button>
                            {(Object.entries(STATUS_CONFIG) as [IssueStatus, typeof STATUS_CONFIG[IssueStatus]][]).map(
                                ([key, cfg]) => (
                                    <button
                                        key={key}
                                        onClick={() => setStatusFilter(prev => prev === key ? 'all' : key as IssueStatus)}
                                        className={`w-full flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                                            statusFilter === key
                                                ? `${cfg.bg} ${cfg.border} ring-2 ring-offset-1 ring-current ${cfg.color}`
                                                : `${cfg.bg} ${cfg.border} hover:brightness-95`
                                        }`}
                                    >
                                        <div className={`flex items-center gap-2 text-sm font-bold ${cfg.color}`}>
                                            <FontAwesomeIcon icon={cfg.icon} className="text-xs" />
                                            {cfg.label}
                                        </div>
                                        <span className={`text-sm font-black ${cfg.color}`}>
                                            {stats[key]}건
                                        </span>
                                    </button>
                                )
                            )}
                        </div>
                        <div className="mt-3 pt-3 border-t border-slate-100">
                            <div className="flex justify-between text-xs text-slate-500 mb-1">
                                <span>합계 공급가</span>
                                <span className="font-black text-slate-800">{fmt(totalSupply)}원</span>
                            </div>
                            <div className="flex justify-between text-xs text-slate-500">
                                <span>합계 공수</span>
                                <span className="font-black text-slate-800">{totalManDaysRounded}</span>
                            </div>
                        </div>
                    </div>

                    {/* Deferred Sites */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
                        <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-3">
                            이월 현장 ({deferredSites.length})
                        </h3>
                        {deferredSites.length === 0 ? (
                            <p className="text-xs text-slate-400 text-center py-3">이월 현장이 없습니다</p>
                        ) : (
                            <div className="space-y-1.5 max-h-40 overflow-y-auto">
                                {deferredSites.map((s, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-blue-50 border border-blue-100">
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold text-blue-800 truncate">{s.siteName}</p>
                                            {s.teamName && <p className="text-[10px] text-blue-500">{s.teamName}</p>}
                                        </div>
                                        <span className="text-xs font-black text-blue-700 ml-2">{s.manDays}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Site Data (loaded) */}
                    {siteData.length > 0 && (
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider">
                                    노무 현장 ({siteData.length})
                                </h3>
                                <button
                                    onClick={() => setShowImportModal(true)}
                                    className="text-xs text-indigo-600 font-bold hover:underline"
                                >
                                    가져오기
                                </button>
                            </div>
                            <div className="space-y-1.5 max-h-52 overflow-y-auto">
                                {siteData.map((s, idx) => (
                                    <div key={idx} className="group flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/40 transition-all">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs font-bold text-slate-700 truncate">{s.siteName}</p>
                                            <p className="text-[10px] text-slate-400">
                                                {s.companyName && <span>{s.companyName}</span>}
                                                {s.siteType && <span> · {s.siteType}</span>}
                                                {s.paymentType && <span> · {s.paymentType}</span>}
                                            </p>
                                        </div>
                                        <span className="text-xs font-black text-slate-600 ml-1">{s.manDays}</span>
                                        <button
                                            onClick={() => handleImportSites([s])}
                                            className="ml-1.5 opacity-0 group-hover:opacity-100 px-1.5 py-0.5 text-[10px] font-bold text-white bg-indigo-500 hover:bg-indigo-600 rounded-md transition-all active:scale-95"
                                            title="발행리스트로 넘기기"
                                        >
                                            →
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </aside>

                {/* ── Main Table ── */}
                <div className="flex-1 min-w-0 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
                    <div className="overflow-auto flex-1">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                                    <th className="px-3 py-3 text-left font-black text-slate-500 w-10">No</th>
                                    <th className="px-2 py-3 text-center font-black text-slate-500 w-12">신규</th>
                                    <th className="px-3 py-3 text-left font-black text-slate-500 w-24">발행일</th>
                                    <th className="px-3 py-3 text-left font-black text-slate-500 w-28">공급받는자</th>
                                    <th className="px-3 py-3 text-left font-black text-slate-500 w-28">품목</th>
                                    <th className="px-3 py-3 text-right font-black text-slate-500 w-24">공급가</th>
                                    <th className="px-3 py-3 text-left font-black text-slate-500">비고</th>
                                    <th className="px-3 py-3 text-right font-black text-slate-500 w-16">공수</th>
                                    <th className="px-3 py-3 text-center font-black text-slate-500 w-20">팀</th>
                                    <th className="px-3 py-3 text-center font-black text-slate-500 w-20">현장구분</th>
                                    <th className="px-3 py-3 text-center font-black text-slate-500 w-20">결제구분</th>
                                    <th className="px-3 py-3 text-center font-black text-slate-500 w-24">발행</th>
                                    <th className="px-3 py-3 text-center font-black text-slate-500 w-14">스캔</th>
                                    <th className="px-3 py-3 text-left font-black text-slate-500 w-32">특이사항</th>
                                    <th className="px-3 py-3 text-center font-black text-slate-500 w-10">삭제</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan={15} className="py-16 text-center text-slate-400">
                                            <FontAwesomeIcon icon={faRotateRight} className="animate-spin mr-2" />
                                            불러오는 중...
                                        </td>
                                    </tr>
                                ) : filteredIssues.length === 0 ? (
                                    <tr>
                                        <td colSpan={15} className="py-16 text-center text-slate-400">
                                            <p className="font-bold">데이터가 없습니다</p>
                                            <p className="text-xs mt-1">행 추가 또는 현장 데이터 가져오기로 시작하세요.</p>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredIssues.map(issue => {
                                        const isSaving = saving.has(issue.id ?? '');
                                        const statusCfg = STATUS_CONFIG[issue.issueStatus] || STATUS_CONFIG.pending;
                                        return (
                                            <tr
                                                key={issue.id}
                                                style={{
                                                    backgroundColor:
                                                        issue.issueStatus === 'issued' ? '#bbf7d0' :
                                                        issue.issueStatus === 'pending' ? '#fde68a' :
                                                        issue.issueStatus === 'deferred' ? '#bfdbfe' :
                                                        issue.issueStatus === 'cancelled' ? '#fecaca' :
                                                        undefined,
                                                }}
                                                className={`hover:brightness-95 transition-colors ${isSaving ? 'opacity-60' : ''} ${
                                                    issue.issueStatus === 'cancelled' ? 'line-through text-slate-400' : ''
                                                }`}
                                            >
                                                {/* No */}
                                                <td className="px-3 py-2 font-bold text-slate-600">{issue.no}</td>

                                                {/* 신규 */}
                                                <td className="px-2 py-2 text-center">
                                                    <button
                                                        onClick={() => handleNewToggle(issue.id, issue.isNew)}
                                                        className={`px-1.5 py-0.5 rounded text-[10px] font-black transition-colors ${
                                                            issue.isNew
                                                                ? 'bg-violet-100 text-violet-700'
                                                                : 'bg-slate-100 text-slate-400'
                                                        }`}
                                                    >
                                                        {issue.isNew ? '입력' : '-'}
                                                    </button>
                                                </td>

                                                {/* 발행일 */}
                                                <td className="px-3 py-2">
                                                    <EditableCell
                                                        value={issue.issueDate}
                                                        field="issueDate"
                                                        rowId={issue.id}
                                                        type="date"
                                                        onCommit={handleCellCommit}
                                                    />
                                                </td>

                                                {/* 공급받는자 */}
                                                <td className="px-3 py-2">
                                                    <EditableCell
                                                        value={issue.recipient}
                                                        field="recipient"
                                                        rowId={issue.id}
                                                        onCommit={handleCellCommit}
                                                        className="font-bold"
                                                    />
                                                </td>

                                                {/* 품목 */}
                                                <td className="px-3 py-2">
                                                    <EditableCell
                                                        value={issue.item}
                                                        field="item"
                                                        rowId={issue.id}
                                                        onCommit={handleCellCommit}
                                                    />
                                                </td>

                                                {/* 공급가 */}
                                                <td className="px-3 py-2 text-right">
                                                    <EditableCell
                                                        value={issue.supplyAmount}
                                                        field="supplyAmount"
                                                        rowId={issue.id}
                                                        type="number"
                                                        onCommit={handleCellCommit}
                                                        className={`text-right ${issue.supplyAmount < 0 ? 'text-red-600' : 'text-slate-800'}`}
                                                    />
                                                </td>

                                                {/* 비고 */}
                                                <td className="px-3 py-2 max-w-[160px]">
                                                    <EditableCell
                                                        value={issue.note}
                                                        field="note"
                                                        rowId={issue.id}
                                                        onCommit={handleCellCommit}
                                                        className="text-slate-500"
                                                    />
                                                </td>

                                                {/* 공수 */}
                                                <td className="px-3 py-2 text-right">
                                                    <EditableCell
                                                        value={issue.manDays}
                                                        field="manDays"
                                                        rowId={issue.id}
                                                        type="number"
                                                        onCommit={handleCellCommit}
                                                        className="text-right font-semibold text-slate-700"
                                                    />
                                                </td>

                                                {/* 팀 */}
                                                <td className="px-3 py-2 text-center">
                                                    <EditableCell
                                                        value={issue.teamName ?? ''}
                                                        field="teamName"
                                                        rowId={issue.id}
                                                        onCommit={handleCellCommit}
                                                        className="text-center text-slate-600"
                                                    />
                                                </td>

                                                {/* 현장구분 */}
                                                <td className="px-3 py-2 text-center">
                                                    <SelectCell
                                                        value={issue.siteType ?? ''}
                                                        options={['지원', '도급', '직영']}
                                                        field="siteType"
                                                        rowId={issue.id}
                                                        onCommit={handleCellCommit}
                                                        badgeClass="text-violet-700"
                                                    />
                                                </td>

                                                {/* 결제구분 */}
                                                <td className="px-3 py-2 text-center">
                                                    <SelectCell
                                                        value={issue.paymentType ?? ''}
                                                        options={['계산서', '노무']}
                                                        field="paymentType"
                                                        rowId={issue.id}
                                                        onCommit={handleCellCommit}
                                                        badgeClass="text-amber-700"
                                                    />
                                                </td>

                                                {/* 발행 상태 */}
                                                <td className="px-3 py-2 text-center">
                                                    <select
                                                        value={issue.issueStatus}
                                                        onChange={e => handleStatusChange(issue.id, e.target.value as IssueStatus)}
                                                        className="text-xs border-0 bg-transparent cursor-pointer outline-none font-bold w-full"
                                                    >
                                                        {(Object.entries(STATUS_CONFIG) as [IssueStatus, typeof STATUS_CONFIG[IssueStatus]][]).map(
                                                            ([k, cfg]) => (
                                                                <option key={k} value={k}>{cfg.label}</option>
                                                            )
                                                        )}
                                                    </select>
                                                </td>

                                                {/* 스캔 */}
                                                <td className="px-3 py-2 text-center">
                                                    <button
                                                        onClick={() => handleScanToggle(issue.id, issue.scanCompleted)}
                                                        className={`w-5 h-5 rounded border-2 transition-colors flex items-center justify-center mx-auto ${
                                                            issue.scanCompleted
                                                                ? 'bg-green-500 border-green-500 text-white'
                                                                : 'border-slate-300 hover:border-green-400'
                                                        }`}
                                                    >
                                                        {issue.scanCompleted && (
                                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                            </svg>
                                                        )}
                                                    </button>
                                                </td>

                                                {/* 특이사항 */}
                                                <td className="px-3 py-2">
                                                    <EditableCell
                                                        value={issue.remark ?? ''}
                                                        field="remark"
                                                        rowId={issue.id}
                                                        onCommit={handleCellCommit}
                                                        className="text-slate-500 text-xs"
                                                    />
                                                </td>

                                                {/* 삭제 */}
                                                <td className="px-3 py-2 text-center">
                                                    <button
                                                        onClick={() => handleDelete(issue.id)}
                                                        className="text-slate-300 hover:text-red-500 transition-colors p-1 rounded-lg hover:bg-red-50"
                                                    >
                                                        <FontAwesomeIcon icon={faTrash} className="text-xs" />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>

                            {/* Footer / Totals */}
                            {issues.length > 0 && (
                                <tfoot>
                                    <tr className="bg-slate-50 border-t-2 border-slate-200 font-black text-slate-700">
                                        <td colSpan={5} className="px-3 py-3 text-sm">
                                            합계 ({issues.filter(i => i.issueStatus !== 'cancelled').length}건)
                                        </td>
                                        <td className="px-3 py-3 text-right text-sm">
                                            {fmt(totalSupply)}
                                        </td>
                                        <td />
                                        <td className="px-3 py-3 text-right text-sm">{totalManDaysRounded}</td>
                                        <td colSpan={7} />
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>
            </div>

            {/* ── Import Modal ── */}
            {showImportModal && (
                <SiteImportModal
                    sites={siteData}
                    onClose={() => setShowImportModal(false)}
                    onImport={handleImportSites}
                />
            )}
        </div>
    );
};

export default TaxInvoiceIssueListPage;
