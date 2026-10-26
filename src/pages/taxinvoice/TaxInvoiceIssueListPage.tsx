import React, { useState, useEffect, useRef, useMemo, useCallback, useContext } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faFileInvoiceDollar,
    faPlus,
    faRotateRight,
    faDownload,
    faTrash,
    faBuilding,
    faChevronLeft,
    faChevronRight,
    faFilter,
    faSearch,
    faSort,
    faFileExcel,
    faCopy,
    faXmark,
    faFloppyDisk,
    faArrowRotateLeft,
} from '@fortawesome/free-solid-svg-icons';
import { taxInvoiceListService } from '../../services/taxInvoiceListService';
import { TaxInvoiceIssue, IssueStatus, SiteWorkSummary, STATUS_CONFIG } from '../../types/taxInvoiceList';
import { exportIssuesToExcel } from '../../utils/taxInvoiceExcelUtils';
import { reserveImageClipboardWrite } from '../../utils/taxInvoiceClipboard';
import { formatTypedDateInput, normalizeTypedDateInput } from '../../utils/typedDateInput';
import { applySavedIssueUpdates, getIssuePendingChanges, getNextIssueNo, IssueBatchWriteError, IssueDeleteConflictError, IssueSaveConflict, IssueSaveConflictError, parseIssueNumber } from '../../utils/taxInvoiceIssueDraft';
import { useIssueNavigationGuard } from './useIssueNavigationGuard';
import PayrollIssueTopTabs from '../../components/payroll/PayrollIssueTopTabs';
import { showConfirmAlert, toast } from '../../utils/swal';
import html2canvas from 'html2canvas';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const toYearMonth = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const getPreviousYearMonth = (ym: string) => {
    const [rawYear, rawMonth] = ym.split('-').map(Number);
    const year = Number.isFinite(rawYear) ? rawYear : new Date().getFullYear();
    const month = Number.isFinite(rawMonth) ? rawMonth : new Date().getMonth() + 1;
    return toYearMonth(new Date(year, month - 2, 1));
};

const formatYearMonth = (ym: string) => {
    const [y, m] = ym.split('-');
    return `${y}년 ${Number(m)}월`;
};

const getMonthEndDate = (yearMonth: string) => {
    const [rawYear, rawMonth] = yearMonth.split('-').map(Number);
    const year = Number.isFinite(rawYear) ? rawYear : new Date().getFullYear();
    const month = Number.isFinite(rawMonth) ? rawMonth : new Date().getMonth() + 1;
    const lastDay = new Date(year, month, 0).getDate();
    return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
};

const SITE_TYPE_OPTIONS = ['전체', '지원', '도급', '직영'];
const PAYMENT_TYPE_OPTIONS = ['전체', '계산서', '노무'];
const ISSUE_TYPE_OPTIONS = ['입력', '신규', '다원'];
const EMPTY_CELL_FILTER_OPTION = '(빈 셀)';

const EMPTY_ISSUE = (yearMonth: string, no: number): Omit<TaxInvoiceIssue, 'id' | 'createdAt' | 'updatedAt'> => ({
    yearMonth,
    no,
    isNew: '',
    issueDate: getMonthEndDate(yearMonth),
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

type IssueSortMode = 'no' | 'team';
type SaveFeedbackStatus = 'idle' | 'saving' | 'saved' | 'error';

interface SaveFeedback {
    status: SaveFeedbackStatus;
    message: string;
    updatedAt?: number;
}

const COLUMN_FILTER_LABELS: Record<string, string> = {
    no: 'No',
    isNew: '신규',
    issueDate: '발행일',
    recipient: '공급받는자',
    item: '품목',
    supplyAmount: '공급가',
    note: '비고',
    manDays: '공수',
    teamName: '팀',
    siteType: '현장구분',
    paymentType: '결제구분',
    issueStatus: '발행',
    scanCompleted: '노임서류',
    remark: '특이사항',
    yearMonth: '조회 월',
    siteId: '현장 연결',
    siteName: '현장명',
    carriedFromIssueId: '이월 원본 연결',
    carriedFromYearMonth: '이월 원본 월',
};

const getIssueNoSortValue = (value: unknown): number => {
    const no = Number(value);
    return Number.isFinite(no) && no > 0 ? no : Number.MAX_SAFE_INTEGER;
};

const compareIssuesByNo = (a: TaxInvoiceIssue, b: TaxInvoiceIssue): number => {
    const noDiff = getIssueNoSortValue(a.no) - getIssueNoSortValue(b.no);
    if (noDiff !== 0) return noDiff;
    return String(a.id ?? '').localeCompare(String(b.id ?? ''), 'ko-KR');
};

const compareIssuesByTeam = (a: TaxInvoiceIssue, b: TaxInvoiceIssue): number => {
    const leftTeam = String(a.teamName ?? '').trim();
    const rightTeam = String(b.teamName ?? '').trim();
    if (leftTeam && !rightTeam) return -1;
    if (!leftTeam && rightTeam) return 1;

    const teamDiff = leftTeam.localeCompare(rightTeam, 'ko-KR');
    if (teamDiff !== 0) return teamDiff;

    const siteDiff = String(a.siteName || a.note || a.item || '').localeCompare(
        String(b.siteName || b.note || b.item || ''),
        'ko-KR'
    );
    if (siteDiff !== 0) return siteDiff;

    return compareIssuesByNo(a, b);
};

const getIssueTypeLabel = (value: TaxInvoiceIssue['isNew'] | boolean | null | undefined) => {
    if (typeof value === 'boolean') return value ? '입력' : '';
    return String(value ?? '');
};

const canvasToPngBlob = (canvas: HTMLCanvasElement) => new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
        if (blob) {
            resolve(blob);
            return;
        }
        reject(new Error('이미지 변환에 실패했습니다.'));
    }, 'image/png');
});

interface IssueCaptureColumn {
    label: string;
    width: number;
    align?: 'left' | 'center' | 'right';
    getValue: (issue: TaxInvoiceIssue) => string;
}

const ISSUE_CAPTURE_COLUMNS: IssueCaptureColumn[] = [
    { label: 'No', width: 52, align: 'center', getValue: issue => String(issue.no) },
    { label: '신규', width: 64, align: 'center', getValue: issue => getIssueTypeLabel(issue.isNew) || '-' },
    { label: '발행일', width: 112, align: 'center', getValue: issue => issue.issueDate || '-' },
    { label: '공급받는자', width: 160, getValue: issue => issue.recipient || '-' },
    { label: '품목', width: 120, getValue: issue => issue.item || '-' },
    { label: '공급가', width: 112, align: 'right', getValue: issue => fmt(Number(issue.supplyAmount) || 0) },
    { label: '비고', width: 280, getValue: issue => issue.note || '-' },
    { label: '공수', width: 64, align: 'right', getValue: issue => String(Number(issue.manDays) || 0) },
    { label: '팀', width: 110, align: 'center', getValue: issue => issue.teamName || '-' },
    { label: '현장구분', width: 88, align: 'center', getValue: issue => issue.siteType || '-' },
    { label: '결제구분', width: 88, align: 'center', getValue: issue => issue.paymentType || '-' },
    { label: '발행', width: 82, align: 'center', getValue: issue => STATUS_CONFIG[issue.issueStatus]?.label || issue.issueStatus || '-' },
    { label: '노임서류', width: 90, align: 'center', getValue: issue => issue.scanCompleted ? '완료' : '미완료' },
    { label: '특이사항', width: 238, getValue: issue => issue.remark || '-' },
];

const ISSUE_CAPTURE_STATUS_STYLES: Record<IssueStatus, { background: string; accent: string; text: string }> = {
    ready: { background: '#ffffff', accent: '#8b5cf6', text: '#6d28d9' },
    issued: { background: '#bbf7d0', accent: '#10b981', text: '#15803d' },
    pending: { background: '#fde68a', accent: '#fbbf24', text: '#b45309' },
    deferred: { background: '#bfdbfe', accent: '#3b82f6', text: '#1d4ed8' },
};

const ISSUE_CAPTURE_WIDTH = ISSUE_CAPTURE_COLUMNS.reduce((total, column) => total + column.width, 0);

const createIssueCaptureTable = (issues: TaxInvoiceIssue[], scope: 'visible' | 'selected'): HTMLDivElement => {
    const root = document.createElement('div');
    root.dataset.taxInvoiceCaptureRoot = 'true';
    root.setAttribute('aria-hidden', 'true');
    root.style.cssText = [
        'position:fixed',
        'left:0',
        'top:0',
        'z-index:-2147483647',
        'pointer-events:none',
        `width:${ISSUE_CAPTURE_WIDTH}px`,
        'background:#ffffff',
        'color:#334155',
        "font-family:Pretendard,'Noto Sans KR','Malgun Gothic',Arial,sans-serif",
    ].join(';');

    const table = document.createElement('table');
    table.style.cssText = [
        'width:100%',
        'table-layout:fixed',
        'border-collapse:collapse',
        'border:1px solid #cbd5e1',
        'background:#ffffff',
    ].join(';');

    const colgroup = document.createElement('colgroup');
    ISSUE_CAPTURE_COLUMNS.forEach((column) => {
        const col = document.createElement('col');
        col.style.width = `${column.width}px`;
        colgroup.appendChild(col);
    });
    table.appendChild(colgroup);

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    ISSUE_CAPTURE_COLUMNS.forEach((column) => {
        const cell = document.createElement('th');
        cell.textContent = column.label;
        cell.style.cssText = [
            'box-sizing:border-box',
            'padding:12px 10px',
            'border:1px solid #cbd5e1',
            'background:#f1f5f9',
            'color:#475569',
            'font-size:15px',
            'font-weight:800',
            'line-height:1.35',
            `text-align:${column.align || 'left'}`,
            'white-space:normal',
            'overflow-wrap:anywhere',
        ].join(';');
        headerRow.appendChild(cell);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    issues.forEach((issue) => {
        const row = document.createElement('tr');
        const statusStyle = ISSUE_CAPTURE_STATUS_STYLES[issue.issueStatus] || ISSUE_CAPTURE_STATUS_STYLES.ready;
        ISSUE_CAPTURE_COLUMNS.forEach((column, columnIndex) => {
            const cell = document.createElement('td');
            cell.textContent = column.getValue(issue);
            cell.style.cssText = [
                'box-sizing:border-box',
                'padding:12px 10px',
                'border:1px solid #e2e8f0',
                columnIndex === 0 ? `border-left:4px solid ${statusStyle.accent}` : '',
                `background:${statusStyle.background}`,
                `color:${column.label === '발행' ? statusStyle.text : '#334155'}`,
                'font-size:15px',
                `font-weight:${column.label === '공급받는자' || column.label === '발행' ? '700' : '500'}`,
                'line-height:1.5',
                'vertical-align:top',
                `text-align:${column.align || 'left'}`,
                'white-space:normal',
                'word-break:keep-all',
                'overflow-wrap:anywhere',
            ].join(';');
            row.appendChild(cell);
        });
        tbody.appendChild(row);
    });
    table.appendChild(tbody);

    const totalSupply = issues.reduce((total, issue) => total + (Number(issue.supplyAmount) || 0), 0);
    const totalManDays = issues.reduce((total, issue) => total + (Number(issue.manDays) || 0), 0);
    const footerRow = table.createTFoot().insertRow();
    [
        { text: `${scope === 'visible' ? '조회' : '선택'} 합계 (${issues.length}건)`, span: 5, align: 'left' },
        { text: fmt(totalSupply), span: 1, align: 'right' },
        { text: '', span: 1, align: 'left' },
        { text: String(Math.round(totalManDays * 10) / 10), span: 1, align: 'right' },
        { text: '', span: 6, align: 'left' },
    ].forEach(({ text, span, align }) => {
        const cell = footerRow.insertCell();
        cell.textContent = text;
        cell.colSpan = span;
        cell.style.cssText = [
            'box-sizing:border-box',
            'padding:12px 10px',
            'border:1px solid #cbd5e1',
            'border-top:2px solid #cbd5e1',
            'background:#f8fafc',
            'color:#334155',
            'font-size:16px',
            'font-weight:900',
            'line-height:1.5',
            `text-align:${align}`,
            'overflow-wrap:anywhere',
        ].join(';');
    });
    root.appendChild(table);

    return root;
};

const getCarryoverSourceId = (issue: TaxInvoiceIssue) =>
    issue.id || [
        issue.yearMonth,
        issue.siteId,
        issue.siteName,
        issue.note,
        issue.recipient,
        issue.teamName,
    ].map(value => String(value ?? '').trim()).join('|');

const getCarryoverSourceKey = (issue: TaxInvoiceIssue) =>
    `${issue.yearMonth}:${getCarryoverSourceId(issue)}`;

const getCarryoverIssueDate = (source: TaxInvoiceIssue, fallbackDate: string): string =>
    normalizeTypedDateInput(String(source.issueDate ?? '')) || fallbackDate;

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────


// ─────────────────────────────────────────────
// Site Data Import Modal
// ─────────────────────────────────────────────

const getSiteImportKey = (site: SiteWorkSummary) => site.sourceKey || JSON.stringify([
    site.siteId || site.siteName, site.siteName, site.companyName, site.teamName, site.siteType, site.paymentType,
]);

interface SiteImportModalProps {
    sites: SiteWorkSummary[];
    onClose: () => void;
    onImport: (selected: SiteWorkSummary[]) => Promise<string[]>;
    blocked: boolean;
    refreshing: boolean;
    onRefresh: () => void;
}

const SiteImportModal: React.FC<SiteImportModalProps> = ({ sites, onClose, onImport, blocked, refreshing, onRefresh }) => {
    const [checked, setChecked] = useState<Set<string>>(new Set());
    const [completedKeys, setCompletedKeys] = useState<Set<string>>(new Set());
    const [retryMessage, setRetryMessage] = useState('');
    const [filterSiteType, setFilterSiteType] = useState<string>('전체');
    const [filterPaymentType, setFilterPaymentType] = useState<string>('전체');
    const [searchTerm, setSearchTerm] = useState('');
    const [importing, setImporting] = useState(false);

    const rowKey = getSiteImportKey;

    const normalizedSearchTerm = searchTerm.trim().toLowerCase();

    const filtered = sites.filter(s => {
        const matchSiteType = filterSiteType === '전체' || s.siteType === filterSiteType;
        const matchPaymentType = filterPaymentType === '전체' || s.paymentType === filterPaymentType;
        const searchableText = [
            s.siteName,
            s.companyName,
            s.teamName,
            s.siteType,
            s.paymentType,
            s.siteId,
        ].map(value => String(value ?? '').toLowerCase()).join(' ');
        const matchSearch = !normalizedSearchTerm || searchableText.includes(normalizedSearchTerm);
        return matchSiteType && matchPaymentType && matchSearch;
    });

    const toggle = (key: string) => {
        if (importing || blocked || completedKeys.has(key)) return;
        setChecked(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const toggleAll = () => {
        if (importing || blocked) return;
        const filteredKeys = filtered.map(rowKey).filter(key => !completedKeys.has(key));
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

    const selectable = filtered.filter(s => !completedKeys.has(rowKey(s)));
    const filteredCheckedCount = selectable.filter(s => checked.has(rowKey(s))).length;
    const allFilteredChecked = selectable.length > 0 && filteredCheckedCount === selectable.length;

    const selectedSites = sites.filter(s => checked.has(rowKey(s)) && !completedKeys.has(rowKey(s)));

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="site-import-title">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-indigo-600 rounded-xl">
                            <FontAwesomeIcon icon={faBuilding} className="text-white text-sm" />
                        </div>
                        <h2 id="site-import-title" className="text-base font-black text-slate-900">현장 데이터 가져오기</h2>
                    </div>
                    <button
                        onClick={onClose}
                        type="button"
                        aria-label="현장 데이터 가져오기 창 닫기"
                        disabled={importing}
                        className="text-slate-400 hover:text-slate-600 text-xl font-bold w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        ×
                    </button>
                </div>

                {retryMessage && <p role="alert" className="px-5 pt-3 text-sm text-amber-800">{retryMessage}</p>}
                {blocked && <div className="flex items-center justify-between gap-2 px-5 pt-3 text-sm text-red-700">
                    <span>목록을 다시 확인한 뒤 남은 항목을 추가해주세요.</span>
                    <button type="button" onClick={onRefresh} disabled={refreshing || importing} className="rounded border px-2 py-1 disabled:opacity-40">목록 다시 확인</button>
                </div>}
                {/* Filters */}
                <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-4 flex-wrap">
                    <div className="relative min-w-[240px] flex-1">
                        <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
                        <input
                            type="search"
                            aria-label="현장 데이터 검색"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="현장명, 발주사, 담당팀 검색"
                            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-8 pr-3 text-xs font-semibold text-slate-700 outline-none transition-all placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                            autoFocus
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-500">현장구분</span>
                        <div className="flex gap-1">
                            {SITE_TYPE_OPTIONS.map(opt => (
                                <button
                                    key={opt}
                                    type="button"
                                    aria-pressed={filterSiteType === opt}
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
                                    type="button"
                                    aria-pressed={filterPaymentType === opt}
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
                                            aria-label="표시된 현장 전체 선택"
                                            checked={allFilteredChecked}
                                            onChange={toggleAll}
                                            disabled={importing || blocked || selectable.length === 0}
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
                                                    aria-label={`${s.siteName} 선택`}
                                                    checked={checked.has(key)}
                                                    onChange={() => toggle(key)}
                                                    disabled={importing || blocked || completedKeys.has(key)}
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
                                            <td className="px-3 py-2 text-slate-500 truncate">{s.teamName || '-'}{completedKeys.has(key) && <span className="ml-1 text-green-700">추가됨</span>}</td>
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
                        <button type="button" onClick={onClose} disabled={importing} className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-all disabled:cursor-not-allowed disabled:opacity-40">
                            취소
                        </button>
                        <button
                            type="button"
                            onClick={async () => {
                                setImporting(true);
                                try {
                                    const completed = await onImport(selectedSites);
                                    setCompletedKeys(prev => new Set([...prev, ...completed]));
                                    setChecked(prev => new Set([...prev].filter(key => !completed.includes(key))));
                                    const remaining = selectedSites.filter(site => !completed.includes(rowKey(site))).length;
                                    if (remaining === 0) onClose();
                                    else setRetryMessage(`${completed.length}건 추가 완료, ${remaining}건은 추가하지 못했습니다. 실패한 항목만 선택되어 있습니다.`);
                                } catch {
                                    setRetryMessage('추가 결과를 확인하지 못했습니다. 선택한 항목은 유지됩니다.');
                                } finally {
                                    setImporting(false);
                                }
                            }}
                            disabled={selectedSites.length === 0 || importing || blocked}
                            className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {importing ? '추가하는 중...' : `발행리스트에 추가 (${selectedSites.length}건)`}
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

interface CellDraftState {
    rowId?: string;
    field: EditableField;
    inputType: 'text' | 'number' | 'date';
    value: string;
    dirty: boolean;
    invalid: boolean;
    composing: boolean;
    error?: string;
}

const getCellPatch = (saved: TaxInvoiceIssue, field: EditableField, value: string | number | boolean): Partial<TaxInvoiceIssue> =>
    field === 'recipient' ? {
        recipient: String(value),
        recipientManuallyEdited: String(value) === String(saved.recipient ?? '') ? saved.recipientManuallyEdited : true,
    } : { [field]: value };

const formatIssueValue = (field: string, value: unknown): string => {
    if (field === 'issueStatus') return STATUS_CONFIG[value as IssueStatus]?.label ?? String(value ?? '');
    if (field === 'scanCompleted') return value ? '완료' : '미완료';
    if (field === 'recipientManuallyEdited') return value ? '직접 수정' : '자동 입력';
    if (typeof value === 'number') return value.toLocaleString('ko-KR');
    return String(value ?? '') || '(빈 셀)';
};

// Saving and exporting must use the same normalized values, including retained hidden inputs.
const applyCellDrafts = (issues: TaxInvoiceIssue[], savedIssues: TaxInvoiceIssue[], drafts: CellDraftState[]): TaxInvoiceIssue[] | null => {
    const byId = new Map(issues.map(issue => [issue.id, issue]));
    const savedById = new Map(savedIssues.map(issue => [issue.id, issue]));
    for (const draft of drafts) {
        if (draft.invalid || draft.composing) return null;
        const issue = byId.get(draft.rowId);
        const saved = savedById.get(draft.rowId);
        const value = draft.inputType === 'date' ? normalizeTypedDateInput(draft.value)
            : draft.inputType === 'number' ? parseIssueNumber(draft.value) : draft.value;
        if (!issue || !saved || value === null) return null;
        byId.set(draft.rowId, { ...issue, ...getCellPatch(saved, draft.field, value) });
    }
    return issues.map(issue => byId.get(issue.id)!);
};
const IssueEditingContext = React.createContext({
    disabled: false,
    drafts: {} as Record<string, CellDraftState>,
    onDraftChange: (_key: string, _state: CellDraftState | null) => {},
});

interface EditableCellProps {
    value: string | number | boolean;
    field: EditableField;
    rowId: string | undefined;
    type?: 'text' | 'number' | 'date';
    onCommit: (id: string | undefined, field: EditableField, value: string | number | boolean) => void;
    className?: string;
    // Keyboard Navigation
    rowIndex?: number;
    colIndex?: number;
    isFocused?: boolean;
    onNavigate?: (direction: 'up' | 'down' | 'left' | 'right' | 'tab' | 'untab') => void;
}

const EditableCell: React.FC<EditableCellProps> = ({
    value, field, rowId, type = 'text', onCommit, className = '',
    rowIndex, colIndex, isFocused, onNavigate
}) => {
    const { disabled, drafts, onDraftChange } = useContext(IssueEditingContext);
    const draftKey = `${rowId}:${field}`;
    const retainedDraft = drafts[draftKey];
    const [editing, setEditing] = useState(Boolean(retainedDraft));
    const [draft, setDraft] = useState(retainedDraft?.value ?? String(value));
    const [error, setError] = useState(retainedDraft?.error ?? '');
    const inputRef = useRef<HTMLInputElement>(null);
    const focusRequestedRef = useRef(false);
    const composingRef = useRef(false);
    const recordDraft = (nextValue: string, message?: string) => onDraftChange(draftKey, {
        rowId, field, inputType: type, value: nextValue, dirty: nextValue !== String(value),
        invalid: (type === 'date' && normalizeTypedDateInput(nextValue) === null)
            || (type === 'number' && parseIssueNumber(nextValue) === null),
        composing: composingRef.current, error: message,
    });

    // 부모로부터 포커스 명령을 받았을 때 에디팅 모드 진입
    useEffect(() => {
        if (isFocused && !disabled) {
            setDraft(retainedDraft?.value ?? String(value));
            focusRequestedRef.current = true;
            setEditing(true);
        }
    }, [isFocused, disabled]);

    useEffect(() => {
        if (editing && inputRef.current && focusRequestedRef.current) {
            focusRequestedRef.current = false;
            inputRef.current.focus();
            if (type !== 'date') {
                inputRef.current.select();
            }
        }
    }, [editing, type, isFocused]);

    const commit = () => {
        if (disabled || composingRef.current) return false;
        let finalValue: string | number | boolean = draft;
        if (type === 'number') {
            const parsed = parseIssueNumber(draft);
            if (parsed === null) {
                const message = '올바른 숫자를 입력해주세요. 예: -100, 1,000, 1.5 (최대 절댓값 9,007,199,254,740,991)';
                setError(message);
                recordDraft(draft, message);
                return false;
            }
            finalValue = parsed;
        } else if (type === 'date') {
            const normalized = normalizeTypedDateInput(draft);
            if (!normalized) {
                setError('실제 존재하는 날짜를 YYYY-MM-DD 형식으로 입력해주세요.');
                recordDraft(draft, '실제 존재하는 날짜를 YYYY-MM-DD 형식으로 입력해주세요.');
                return false;
            }
            finalValue = normalized;
        }
        onCommit(rowId, field, finalValue);
        onDraftChange(draftKey, null);
        setError('');
        setEditing(false);
        return true;
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (composingRef.current || e.nativeEvent.isComposing || e.keyCode === 229) return;
        const target = e.target as HTMLInputElement;
        const isFirstChar = target.selectionStart === 0 && target.selectionEnd === 0;
        const isLastChar = target.selectionStart === target.value.length && target.selectionEnd === target.value.length;

        if (e.key === 'Enter') {
            e.preventDefault();
            if (commit() && onNavigate) onNavigate('down');
        }
        if (e.key === 'Escape') {
            setDraft(String(value));
            setError('');
            onDraftChange(draftKey, null);
            setEditing(false);
        }
        
        if (onNavigate) {
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (commit()) onNavigate('up');
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (commit()) onNavigate('down');
            } else if (e.key === 'ArrowLeft' && isFirstChar) {
                // 커서가 맨 앞에 있을 때 왼쪽 키 누르면 이동
                e.preventDefault();
                if (commit()) onNavigate('left');
            } else if (e.key === 'ArrowRight' && isLastChar) {
                // 커서가 맨 뒤에 있을 때 오른쪽 키 누르면 이동
                e.preventDefault();
                if (commit()) onNavigate('right');
            } else if (e.key === 'Tab') {
                e.preventDefault();
                if (commit()) onNavigate(e.shiftKey ? 'untab' : 'tab');
            }
        }
    };

    if (editing) {
        return (
            <>
            <input
                ref={inputRef}
                disabled={disabled}
                aria-invalid={Boolean(error)}
                // number 타입은 selectionStart를 지원하지 않아 text로 변경하여 엑셀 스타일 이동 지원
                type="text"
                aria-label={`${COLUMN_FILTER_LABELS[String(field)] ?? String(field)} 값 편집`}
                inputMode={type === 'number' ? 'decimal' : (type === 'date' ? 'numeric' : undefined)}
                maxLength={type === 'date' ? 10 : undefined}
                placeholder={type === 'date' ? 'YYYY-MM-DD' : undefined}
                value={draft}
                onChange={e => {
                    const val = e.target.value;
                    let nextDraft = val;
                    // Keep invalid pasted text visible so it cannot silently reuse an old amount.
                    if (type === 'date') {
                        nextDraft = formatTypedDateInput(val);
                    }
                    setDraft(nextDraft);
                    setError('');
                    recordDraft(nextDraft);
                }}
                onCompositionStart={() => { composingRef.current = true; recordDraft(draft); }}
                onCompositionEnd={event => { composingRef.current = false; setDraft(event.currentTarget.value); recordDraft(event.currentTarget.value); }}
                onBlur={commit}
                onKeyDown={handleKeyDown}
                className={`w-full px-2 py-1 text-sm border border-indigo-400 rounded-lg outline-none bg-indigo-50 focus:ring-2 focus:ring-indigo-200 ${className}`}
            />
            {error && <span role="alert" className="block text-xs text-red-600">{error}</span>}
            </>
        );
    }

    return (
        <span
            onClick={() => { if (!disabled) { focusRequestedRef.current = true; setDraft(String(value)); setEditing(true); } }}
            onKeyDown={(event) => {
                if (!disabled && (event.key === 'Enter' || event.key === 'F2')) {
                    event.preventDefault();
                    focusRequestedRef.current = true;
                    setDraft(String(value));
                    setEditing(true);
                }
            }}
            role="button"
            aria-disabled={disabled}
            tabIndex={disabled ? -1 : 0}
            aria-label={`${COLUMN_FILTER_LABELS[String(field)] ?? String(field)} 값 편집${String(value) ? `, 현재 ${String(value)}` : ''}`}
            className={`block cursor-pointer px-1 py-0.5 rounded hover:bg-indigo-50 hover:text-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors min-h-[1.25rem] min-w-[2rem] truncate ${className}`}
            title={String(value)}
        >
            {type === 'number' 
                ? fmt(Number(value)) 
                : (String(value) || '\u00A0')
            }
        </span>
    );
};

// ─────────────────────────────────────────────
// Column Filter Popover
// ─────────────────────────────────────────────
interface ColumnFilterProps {
    label: string;
    value: string;
    onChange: (val: string) => void;
    options?: string[]; // For select-type filters
}

const ColumnFilter: React.FC<ColumnFilterProps> = ({ label, value, onChange, options }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const popoverRef = useRef<HTMLDivElement>(null);
    const filteredOptions = useMemo(() => {
        if (!options) return [];

        const term = searchTerm.trim().toLowerCase();
        return options.filter(opt => !term || opt.toLowerCase().includes(term));
    }, [options, searchTerm]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) setSearchTerm('');
    }, [isOpen]);

    const clearFilter = () => {
        onChange('');
        setSearchTerm('');
        setIsOpen(false);
    };

    const applyOption = (option: string) => {
        onChange(option);
        setSearchTerm('');
        setIsOpen(false);
    };

    const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        e.stopPropagation();

        if (e.key === 'Escape') {
            setIsOpen(false);
            return;
        }

        if (e.key !== 'Enter') return;

        if (!options) {
            setIsOpen(false);
            return;
        }

        const normalizedTerm = searchTerm.trim().toLowerCase();
        const exactOption = filteredOptions.find(opt => opt.toLowerCase() === normalizedTerm);
        const optionToApply = exactOption ?? (filteredOptions.length === 1 ? filteredOptions[0] : undefined);

        if (optionToApply) {
            applyOption(optionToApply);
        }
    };

    return (
        <div className="relative inline-block ml-1" ref={popoverRef}>
            <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
                aria-label={`${label} 필터${value ? `, 현재 ${value}` : ''}`}
                aria-expanded={isOpen}
                aria-haspopup="dialog"
                title={`${label} 필터`}
                className={`inline-flex h-6 w-6 items-center justify-center rounded-md border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${value ? 'border-emerald-600 bg-emerald-500 text-white shadow-sm hover:bg-emerald-600' : 'border-slate-200 bg-white text-slate-500 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700'}`}
            >
                <FontAwesomeIcon icon={faFilter} className="text-[11px]" />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-200 z-50 p-3 animate-in fade-in slide-in-from-top-1 duration-200">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">{label} 필터</p>
                    
                    {/* 검색창 (목록이 있을 때도 필터링을 위해 항상 표시 또는 조건부 표시) */}
                    <div className="relative mb-2">
                        <input
                            autoFocus
                            type="text"
                            aria-label={`${label} 필터 검색`}
                            value={options ? searchTerm : value}
                            onChange={(e) => {
                                if (options) {
                                    setSearchTerm(e.target.value);
                                } else {
                                    onChange(e.target.value);
                                }
                            }}
                            placeholder="검색..."
                            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-400 outline-none"
                            onKeyDown={handleSearchKeyDown}
                        />
                        <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-2 text-slate-300 text-[10px]" />
                    </div>

                    {options && (
                        <div
                            className="flex max-h-64 w-full flex-col gap-1 overflow-y-auto whitespace-normal border-t border-slate-100 pt-2"
                            role="listbox"
                            aria-label={`${label} 필터 항목`}
                        >
                            <button
                                type="button"
                                onClick={clearFilter}
                                role="option"
                                aria-selected={!value}
                                className={`flex w-full shrink-0 items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs font-bold transition-all ${!value ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600 hover:bg-slate-50'}`}
                            >
                                <span>전체</span>
                                {!value && <span aria-hidden="true">✓</span>}
                            </button>
                            {filteredOptions.length > 0 ? (
                                filteredOptions.map(opt => (
                                    <button
                                        type="button"
                                        key={opt}
                                        onClick={() => applyOption(opt)}
                                        role="option"
                                        aria-selected={value === opt}
                                        className={`flex w-full shrink-0 items-start justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-bold leading-5 transition-all ${value === opt ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600 hover:bg-slate-50'}`}
                                    >
                                        <span className="min-w-0 break-words">{opt}</span>
                                        {value === opt && <span className="shrink-0" aria-hidden="true">✓</span>}
                                    </button>
                                ))
                            ) : (
                                <div className="px-2 py-3 text-center text-xs text-slate-400">
                                    일치하는 항목이 없습니다
                                </div>
                            )}
                        </div>
                    )}
                    
                    {value && (
                        <button 
                            type="button"
                            onClick={clearFilter}
                            className="mt-2 w-full py-1 text-[10px] font-bold text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        >
                            필터 초기화
                        </button>
                    )}
                </div>
            )}
        </div>
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
    allowEmpty?: boolean;
    // Keyboard Navigation
    rowIndex?: number;
    colIndex?: number;
    isFocused?: boolean;
    onNavigate?: (direction: 'up' | 'down' | 'left' | 'right' | 'tab' | 'untab') => void;
}

const SelectCell: React.FC<SelectCellProps> = ({ 
    value, options, field, rowId, onCommit, badgeClass = '',
    rowIndex, colIndex, isFocused, onNavigate, allowEmpty = true
}) => {
    const { disabled } = useContext(IssueEditingContext);
    const selectRef = useRef<HTMLSelectElement>(null);

    useEffect(() => {
        if (isFocused && selectRef.current) {
            selectRef.current.focus();
        }
    }, [isFocused]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLSelectElement>) => {
        if (onNavigate) {
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                onNavigate('up');
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                onNavigate('down');
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                onNavigate('left');
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                onNavigate('right');
            } else if (e.key === 'Tab') {
                e.preventDefault();
                onNavigate(e.shiftKey ? 'untab' : 'tab');
            } else if (e.key === 'Enter') {
                e.preventDefault();
                onNavigate('down');
            }
        }
    };

    return (
        <select
            ref={selectRef}
            disabled={disabled}
            aria-label={`${COLUMN_FILTER_LABELS[String(field)] ?? String(field)} 값 선택`}
            value={value || ''}
            onChange={e => onCommit(rowId, field, e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
                if (onNavigate && (!isFocused)) {
                    // 마우스 클릭 등으로 포커스 되었을 때 부모 상태 동기화
                    onNavigate('none' as any); 
                }
            }}
            className={`text-sm border-0 bg-transparent cursor-pointer outline-none font-bold w-full focus:ring-2 focus:ring-indigo-400 rounded ${badgeClass}`}
        >
            {allowEmpty && <option value="">-</option>}
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
    const [savedIssues, setSavedIssues] = useState<TaxInvoiceIssue[]>([]);
    const [saveConflicts, setSaveConflicts] = useState<IssueSaveConflict[]>([]);
    const hasSaveConflicts = saveConflicts.length > 0;
    const pendingChanges = useMemo(() => getIssuePendingChanges(issues, savedIssues), [issues, savedIssues]);
    const [cellDrafts, setCellDrafts] = useState<Record<string, CellDraftState>>({});
    const [editorReset, setEditorReset] = useState(0);
    const cellDraftsRef = useRef(cellDrafts);
    const onDraftChange = useCallback((key: string, state: CellDraftState | null) => {
        const next = { ...cellDraftsRef.current };
        if (state?.dirty || state?.invalid || state?.composing) next[key] = state;
        else delete next[key];
        cellDraftsRef.current = next;
        setCellDrafts(next);
    }, []);
    const hasCellDrafts = Object.keys(cellDrafts).length > 0;
    const hasInvalidDrafts = Object.values(cellDrafts).some(draft => draft.invalid);
    const hasComposingDrafts = Object.values(cellDrafts).some(draft => draft.composing);
    const pendingSaveRowCount = new Set([
        ...Object.keys(pendingChanges),
        ...Object.values(cellDrafts).filter(draft => draft.dirty).map(draft => draft.rowId).filter(Boolean),
    ]).size;
    const [showPendingChanges, setShowPendingChanges] = useState(false);
    const [loading, setLoading] = useState(false);
    const [loadedMonth, setLoadedMonth] = useState<string | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const writeBlocked = loading || loadedMonth !== yearMonth;
    const [copyingScope, setCopyingScope] = useState<'visible' | 'selected' | null>(null);
    const copyingRef = useRef(false);
    const [isExporting, setIsExporting] = useState(false);
    const exportingRef = useRef(false);
    const [saving, setSaving] = useState<Set<string>>(new Set());
    const [mutation, setMutation] = useState<'save' | 'structure' | null>(null);
    const mutationRef = useRef<'save' | 'structure' | null>(null);
    const mountedRef = useRef(false);
    const yearMonthRef = useRef(yearMonth);
    yearMonthRef.current = yearMonth;
    const loadRequestRef = useRef(0);
    const deferredRequestRef = useRef(0);
    const siteRequestRef = useRef(0);
    const issuesRef = useRef(issues);
    issuesRef.current = issues;
    const beginMutation = (kind: 'save' | 'structure') => {
        if (mutationRef.current || writeBlocked || hasSaveConflicts) return false;
        mutationRef.current = kind;
        setMutation(kind);
        return true;
    };
    const endMutation = () => {
        mutationRef.current = null;
        if (mountedRef.current) setMutation(null);
    };
    const [saveFeedback, setSaveFeedback] = useState<SaveFeedback>({
        status: 'idle',
        message: '변경 후 저장 버튼을 눌러주세요',
    });

    const pendingRowCount = Object.keys(pendingChanges).length;
    const hasPendingChanges = pendingRowCount > 0;
    const canLeave = () => {
        if (mutationRef.current) {
            toast.warning('저장 처리가 끝난 뒤 이동해주세요.');
            return false;
        }
        return window.confirm('저장하지 않은 입력이 있습니다. 변경사항을 버리고 이동할까요?');
    };
    useIssueNavigationGuard(hasPendingChanges || hasCellDrafts || hasSaveConflicts || mutation !== null, canLeave);

    // Site import
    const [siteData, setSiteData] = useState<SiteWorkSummary[]>([]);
    const [previousDeferredIssues, setPreviousDeferredIssues] = useState<TaxInvoiceIssue[]>([]);
    const [showImportModal, setShowImportModal] = useState(false);
    const [loadingSites, setLoadingSites] = useState(false);
    const [loadingDeferredSites, setLoadingDeferredSites] = useState(false);
    const [statusFilter, setStatusFilter] = useState<IssueStatus | 'all'>('all');

    // Column Filters State
    const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
    const [globalSearch, setGlobalSearch] = useState('');
    const [sortMode, setSortMode] = useState<IssueSortMode>('no');

    const updateFilter = (field: string, val: string) => {
        setColumnFilters(prev => ({ ...prev, [field]: val }));
    };

    const markSaving = (message: string) => {
        setSaveFeedback({ status: 'saving', message });
    };

    const markSaved = (message: string) => {
        setSaveFeedback({ status: 'saved', message, updatedAt: Date.now() });
    };

    const markSaveError = (message: string) => {
        setSaveFeedback({ status: 'error', message, updatedAt: Date.now() });
    };

    const clearAllFilters = () => {
        setGlobalSearch('');
        setStatusFilter('all');
        setColumnFilters({});
    };

    // Column Filter Options (Unique Values)
    const uniqueIssueNos = useMemo(() => Array.from(new Set(
        issues.map(i => String(i.no ?? '').trim()).filter(Boolean)
    )).sort((a, b) => Number(a) - Number(b)), [issues]);
    const uniqueIssueDates = useMemo(() => Array.from(new Set(
        issues.map(i => String(i.issueDate ?? '').trim()).filter(Boolean)
    )).sort((a, b) => b.localeCompare(a, 'ko')), [issues]);
    const uniqueRecipients = useMemo(() => Array.from(new Set(issues.map(i => i.recipient))).filter((v): v is string => !!v).sort(), [issues]);
    const uniqueItems = useMemo(() => Array.from(new Set(issues.map(i => i.item))).filter((v): v is string => !!v).sort(), [issues]);
    const uniqueSupplyAmounts = useMemo(() => Array.from(new Set(
        issues.map(i => String(i.supplyAmount ?? '').trim()).filter(Boolean)
    )).sort((a, b) => Number(a) - Number(b)), [issues]);
    const uniqueNotes = useMemo(() => Array.from(new Set(issues.map(i => i.note))).filter((v): v is string => !!v).sort(), [issues]);
    const uniqueManDays = useMemo(() => Array.from(new Set(
        issues.map(i => String(i.manDays ?? '').trim()).filter(Boolean)
    )).sort((a, b) => Number(a) - Number(b)), [issues]);
    const uniqueTeams = useMemo(() => Array.from(new Set(
        issues.map(i => String(i.teamName ?? '').trim()).filter(Boolean)
    )).sort((a, b) => a.localeCompare(b, 'ko')), [issues]);
    const uniqueRemarks = useMemo(() => Array.from(new Set(
        issues.map(i => String(i.remark ?? '').trim()).filter(Boolean)
    )).sort((a, b) => a.localeCompare(b, 'ko')), [issues]);
    const uniqueIssueTypes = useMemo(() => {
        const extraValues = Array.from(new Set(issues.map(i => getIssueTypeLabel(i.isNew).trim())))
            .filter((v): v is string => !!v && !ISSUE_TYPE_OPTIONS.includes(v))
            .sort((a, b) => a.localeCompare(b, 'ko'));

        return [EMPTY_CELL_FILTER_OPTION, ...ISSUE_TYPE_OPTIONS, ...extraValues];
    }, [issues]);
    const importedCarryoverKeys = useMemo(() => new Set(
        issues
            .map(issue => (
                issue.carriedFromIssueId && issue.carriedFromYearMonth
                    ? `${issue.carriedFromYearMonth}:${issue.carriedFromIssueId}`
                    : ''
            ))
            .filter((key): key is string => Boolean(key))
    ), [issues]);

    // Keyboard Navigation State
    const [activeCell, setActiveCell] = useState<{ r: number, c: number } | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const EDITABLE_COLUMNS: EditableField[] = [
        'isNew',
        'issueDate',
        'recipient',
        'item',
        'supplyAmount',
        'note',
        'manDays',
        'teamName',
        'siteType',
        'paymentType',
        'issueStatus',
        'remark'
    ];

    // Keyboard Navigation Handler
    const handleNavigate = (r: number, c: number, direction: 'up' | 'down' | 'left' | 'right' | 'tab' | 'untab') => {
        let nextR = r;
        let nextC = c;

        switch (direction) {
            case 'up': nextR = Math.max(0, r - 1); break;
            case 'down': nextR = Math.min(filteredIssues.length - 1, r + 1); break;
            case 'left': nextC = Math.max(0, c - 1); break;
            case 'right': nextC = Math.min(EDITABLE_COLUMNS.length - 1, c + 1); break;
            case 'tab':
                if (c < EDITABLE_COLUMNS.length - 1) {
                    nextC = c + 1;
                } else if (r < filteredIssues.length - 1) {
                    nextR = r + 1;
                    nextC = 0;
                }
                break;
            case 'untab':
                if (c > 0) {
                    nextC = c - 1;
                } else if (r > 0) {
                    nextR = r - 1;
                    nextC = EDITABLE_COLUMNS.length - 1;
                }
                break;
        }

        setActiveCell({ r: nextR, c: nextC });
    };

    // ── Load issues ──
    const loadIssues = async () => {
        const request = ++loadRequestRef.current;
        const current = () => mountedRef.current && request === loadRequestRef.current && yearMonthRef.current === yearMonth;
        setLoading(true);
        setLoadedMonth(null);
        setLoadError(null);
        setSaveConflicts([]);
        setSelectedIds(new Set());
        setActiveCell(null);
        cellDraftsRef.current = {};
        setCellDrafts({});
        try {
            const data = await taxInvoiceListService.getIssuesByMonth(yearMonth);
            if (!current()) return;
            const sorted = [...data].sort((a, b) => a.no - b.no);
            setIssues(sorted);
            setSavedIssues(sorted);
            setLoadedMonth(yearMonth);
            setShowPendingChanges(false);
            setSaveFeedback({ status: 'idle', message: '변경 후 저장 버튼을 눌러주세요' });
        } catch (e) {
            if (!current()) return;
            console.error('발행리스트 로드 실패:', e);
            setIssues([]);
            setSavedIssues([]);
            setLoadError(`${formatYearMonth(yearMonth)} 목록을 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.`);
            markSaveError(`${formatYearMonth(yearMonth)} 목록을 불러오지 못했습니다.`);
            toast.error(`${formatYearMonth(yearMonth)} 데이터 로드에 실패했습니다.`);
        } finally {
            if (current()) setLoading(false);
        }
    };

    const loadPreviousDeferredSites = async () => {
        const request = ++deferredRequestRef.current;
        const current = () => mountedRef.current && request === deferredRequestRef.current && yearMonthRef.current === yearMonth;
        setLoadingDeferredSites(true);
        try {
            const previousYearMonth = getPreviousYearMonth(yearMonth);
            const data = await taxInvoiceListService.getDeferredIssuesByMonth(previousYearMonth);
            if (!current()) return;
            setPreviousDeferredIssues(data);
        } catch (e) {
            if (!current()) return;
            console.error('전월 이월 현장 로드 실패:', e);
            setPreviousDeferredIssues([]);
            toast.warning('전월 이월 현장을 불러오지 못했습니다.');
        } finally {
            if (current()) setLoadingDeferredSites(false);
        }
    };

    useEffect(() => { 
        mountedRef.current = true;
        setIssues([]); // 월 변경 시 즉시 목록을 비워 순번 꼬임 방지
        setSavedIssues([]);
        setSelectedIds(new Set());
        setActiveCell(null);
        cellDraftsRef.current = {};
        setCellDrafts({});
        setShowImportModal(false);
        setLoadingSites(false);
        setSiteData([]); 
        setPreviousDeferredIssues([]);
        loadIssues(); 
        loadPreviousDeferredSites();
        return () => {
            mountedRef.current = false;
            loadRequestRef.current += 1;
            deferredRequestRef.current += 1;
            siteRequestRef.current += 1;
        };
    }, [yearMonth]);

    // ── Month navigation ──
    const stepMonth = (delta: number) => {
        if (mutationRef.current) return;
        if ((hasPendingChanges || hasSaveConflicts || Object.keys(cellDraftsRef.current).length > 0) && !window.confirm('저장하지 않은 변경사항이 있습니다. 변경사항을 버리고 다른 달로 이동할까요?')) {
            return;
        }
        const [y, m] = yearMonth.split('-').map(Number);
        const d = new Date(y, m - 1 + delta, 1);
        setSelectedIds(new Set());
        setActiveCell(null);
        yearMonthRef.current = toYearMonth(d);
        setYearMonth(toYearMonth(d));
    };

    const handleRefresh = () => {
        if (mutationRef.current || loading) return;
        if ((hasPendingChanges || hasSaveConflicts || Object.keys(cellDraftsRef.current).length > 0) && !window.confirm('저장하지 않은 변경사항이 있습니다. 변경사항을 버리고 목록을 새로고침할까요?')) {
            return;
        }
        loadIssues();
        loadPreviousDeferredSites();
    };

    // ── Add row ──
    const handleAddRow = async () => {
        if (hasPendingChanges || Object.keys(cellDraftsRef.current).length > 0) {
            toast.warning('먼저 변경사항을 저장하거나 되돌려주세요.');
            return;
        }
        if (!beginMutation('structure')) return;
        const nextNo = getNextIssueNo(issues);
        const newIssue = EMPTY_ISSUE(yearMonth, nextNo);
        markSaving('새 행을 추가하는 중입니다.');
        try {
            const id = await taxInvoiceListService.addIssue(newIssue);
            const created = { ...newIssue, id } as TaxInvoiceIssue;
            setIssues(prev => [...prev, created].sort((a, b) => a.no - b.no));
            setSavedIssues(prev => [...prev, created].sort((a, b) => a.no - b.no));
            markSaved('새 행이 저장되었습니다.');
            toast.success('새 행을 추가했습니다.');
        } catch (e) {
            console.error(e);
            markSaveError('새 행을 저장하지 못했습니다.');
            toast.error('새 행 추가에 실패했습니다. 다시 시도해주세요.');
        } finally {
            endMutation();
        }
    };

    // ── Delete row ──
    const removeConfirmedIssues = (ids: string[]) => {
        const removed = new Set(ids);
        setIssues(prev => prev.filter(issue => !removed.has(issue.id ?? '')));
        setSavedIssues(prev => prev.filter(issue => !removed.has(issue.id ?? '')));
        setSelectedIds(prev => new Set([...prev].filter(id => !removed.has(id))));
        setActiveCell(null);
    };

    // A failed follow-up must never undo or misreport an acknowledged write.
    const refreshIssueNumbers = async (): Promise<boolean> => {
        try {
            const renumbered = await taxInvoiceListService.renumberIssuesByMonth(yearMonth);
            setIssues(renumbered);
            setSavedIssues(renumbered);
            setActiveCell(null);
            return true;
        } catch (error) {
            console.error('변경 후 목록 갱신 실패:', error);
            setLoadedMonth(null);
            setLoadError('완료된 변경은 반영됐지만 목록 갱신에 실패했습니다. 새로고침 후 계속해주세요.');
            return false;
        }
    };

    const finishImport = async (added: TaxInvoiceIssue[], failedCount: number, label: string, existingCount = 0) => {
        if (added.length > 0) {
            const merge = (prev: TaxInvoiceIssue[]) => [...new Map([...prev, ...added].map(issue => [issue.id, issue])).values()].sort(compareIssuesByNo);
            setIssues(merge);
            setSavedIssues(merge);
        }
        const refreshed = added.length === 0 || await refreshIssueNumbers();
        const message = `${added.length - existingCount}개 ${label}을 추가했습니다.${existingCount ? ` ${existingCount}건은 이미 등록되어 기존 내용을 유지했습니다.` : ''}${failedCount ? ` ${failedCount}건은 추가하지 못했습니다.` : ''}${refreshed ? '' : ' 목록 갱신은 새로고침으로 다시 시도해주세요.'}`;
        if (failedCount || !refreshed) {
            markSaveError(message);
            toast.warning(message);
        } else {
            markSaved(message);
            toast.success(message);
        }
    };

    const handleDeleteFailure = (error: unknown, ids: string[]) => {
        console.error('항목 삭제 실패:', error);
        const completed = error instanceof IssueBatchWriteError ? error.completedIds : [];
        removeConfirmedIssues(completed);
        const original = error instanceof IssueBatchWriteError ? error.originalError : error;
        const conflicts = original instanceof IssueDeleteConflictError ? original.conflicts : [];
        setSaveConflicts(conflicts);
        const message = conflicts.length
            ? `${completed.length}개 항목 삭제 완료. 다른 창에서 변경된 ${conflicts.length}개 항목의 삭제를 중단했습니다. 최신 내용을 확인해주세요.`
            : `${completed.length}개 항목 삭제 완료, ${ids.length - completed.length}개 항목은 삭제하지 못했습니다. 남은 항목만 다시 시도해주세요.`;
        markSaveError(message);
        if (conflicts.length) toast.warning(message);
        else toast.error(message);
    };

    const handleDelete = async (id: string | undefined) => {
        if (!id || !issues.some(issue => issue.id === id && issue.yearMonth === yearMonth)) return;
        if (hasPendingChanges || Object.keys(cellDraftsRef.current).length > 0) {
            toast.warning('먼저 변경사항을 저장하거나 되돌려주세요.');
            return;
        }
        if (!beginMutation('structure')) return;
        try {
            const confirmation = await showConfirmAlert('항목 삭제', '선택한 항목을 삭제하시겠습니까?', '삭제');
            if (!confirmation.isConfirmed || yearMonthRef.current !== yearMonth) return;
            markSaving('항목을 삭제하는 중입니다.');
            await taxInvoiceListService.deleteIssuesWithConflictCheck([id], savedIssues);
            removeConfirmedIssues([id]);
            const refreshed = await refreshIssueNumbers();
            const message = `항목을 삭제했습니다.${refreshed ? '' : ' 목록 갱신은 새로고침으로 다시 시도해주세요.'}`;
            markSaved(message);
            toast.success(message);
        } catch (e) {
            handleDeleteFailure(e, [id]);
        } finally {
            endMutation();
        }
    };

    const handleBulkDelete = async () => {
        const ids = issues.filter(issue => issue.id && issue.yearMonth === yearMonth && selectedIds.has(issue.id)).map(issue => issue.id as string);
        if (ids.length === 0) return;
        if (hasPendingChanges || Object.keys(cellDraftsRef.current).length > 0) {
            toast.warning('먼저 변경사항을 저장하거나 되돌려주세요.');
            return;
        }
        if (!beginMutation('structure')) return;
        try {
            const confirmation = await showConfirmAlert(
                '선택 항목 삭제',
                `선택한 ${ids.length}개의 항목을 모두 삭제하시겠습니까?`,
                '모두 삭제'
            );
            if (!confirmation.isConfirmed || yearMonthRef.current !== yearMonth) return;
            markSaving(`${ids.length}개 항목을 삭제하는 중입니다.`);
            const deleteCount = ids.length;
            await taxInvoiceListService.deleteIssuesWithConflictCheck(ids, savedIssues);
            removeConfirmedIssues(ids);
            const refreshed = await refreshIssueNumbers();
            const message = `${deleteCount}개 항목을 삭제했습니다.${refreshed ? '' : ' 목록 갱신은 새로고침으로 다시 시도해주세요.'}`;
            markSaved(message);
            toast.success(message);
        } catch (e) {
            handleDeleteFailure(e, ids);
        } finally {
            endMutation();
        }
    };

    const toggleSelectAll = () => {
        const filteredIds = filteredIssues.map(issue => issue.id).filter(Boolean) as string[];
        setSelectedIds(prev => {
            const next = new Set(prev);
            const allVisibleSelected = filteredIds.length > 0 && filteredIds.every(id => next.has(id));
            filteredIds.forEach(id => allVisibleSelected ? next.delete(id) : next.add(id));
            return next;
        });
    };

    const toggleSelection = (id: string | undefined) => {
        if (!id) return;
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const getOutputIssues = (rows: TaxInvoiceIssue[]): TaxInvoiceIssue[] | null => {
        if (writeBlocked || mutationRef.current || hasSaveConflicts) return null;
        const staged = applyCellDrafts(issuesRef.current, savedIssues, Object.values(cellDraftsRef.current));
        if (!staged) {
            toast.warning('입력 오류나 조합 중인 글자를 먼저 확인해주세요.');
            return null;
        }
        const byId = new Map(staged.map(issue => [issue.id, issue]));
        return rows.map(issue => byId.get(issue.id) ?? issue);
    };

    const handleExportExcel = async () => {
        if (exportingRef.current || filteredIssues.length === 0) return;
        const rows = getOutputIssues(filteredIssues);
        if (!rows) return;
        exportingRef.current = true;
        setIsExporting(true);
        try {
            await exportIssuesToExcel(rows, yearMonth);
        } catch (error) {
            console.error('발행리스트 엑셀 생성 실패:', error);
            toast.error('엑셀 파일을 만들지 못했습니다. 다시 시도해주세요.');
        } finally {
            exportingRef.current = false;
            if (mountedRef.current) setIsExporting(false);
        }
    };

    const handleCopyIssues = async (scope: 'visible' | 'selected') => {
        if (copyingRef.current) return;
        const sourceRows = scope === 'visible' ? filteredIssues : selectedIssues;
        if (sourceRows.length === 0) {
            toast.warning(scope === 'visible' ? '현재 화면에 복사할 목록이 없습니다.' : '복사할 항목을 선택해주세요.');
            return;
        }

        const rows = getOutputIssues(sourceRows);
        if (!rows) return;
        const clipboardReservation = reserveImageClipboardWrite();
        if (!clipboardReservation) {
            toast.error('이 브라우저에서는 이미지 클립보드 복사를 지원하지 않습니다.');
            return;
        }

        copyingRef.current = true;
        setCopyingScope(scope);
        let captureRoot: HTMLDivElement | null = null;
        try {
            captureRoot = createIssueCaptureTable(rows, scope);
            document.body.appendChild(captureRoot);
            await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
            if (document.fonts?.ready) await document.fonts.ready;

            const captureWidth = Math.ceil(captureRoot.scrollWidth);
            const captureHeight = Math.ceil(captureRoot.scrollHeight);
            const canvas = await html2canvas(captureRoot, {
                backgroundColor: '#ffffff',
                scale: 2,
                useCORS: true,
                logging: false,
                width: captureWidth,
                height: captureHeight,
                windowWidth: Math.max(document.documentElement.clientWidth, captureWidth),
                windowHeight: Math.max(document.documentElement.clientHeight, captureHeight),
                scrollX: 0,
                scrollY: 0,
                onclone: (clonedDocument: Document) => {
                    const clonedRoot = clonedDocument.querySelector<HTMLElement>('[data-tax-invoice-capture-root="true"]');
                    if (!clonedRoot) return;
                    clonedRoot.style.position = 'absolute';
                    clonedRoot.style.zIndex = '0';
                },
            } as any);

            clipboardReservation.complete(await canvasToPngBlob(canvas));
            const outcome = await clipboardReservation.result;
            if (!outcome.ok) throw outcome.error;
            toast.success(`${scope === 'visible' ? '현재 목록의' : '선택한'} ${rows.length}개 행을 이미지로 클립보드에 복사했습니다.`);
        } catch (error) {
            clipboardReservation.cancel(error);
            await clipboardReservation.result;
            console.error('발행리스트 클립보드 복사 실패:', error);
            toast.error('이미지를 클립보드에 복사하지 못했습니다. 브라우저 권한을 확인해주세요.');
        } finally {
            captureRoot?.remove();
            copyingRef.current = false;
            if (mountedRef.current) setCopyingScope(null);
        }
    };

    // ── Inline edit staging ──
    const handleCellCommit = (
        id: string | undefined,
        field: EditableField,
        value: string | number | boolean
    ) => {
        if (!id || writeBlocked || mutationRef.current === 'structure') return;
        const savedIssue = savedIssues.find(issue => issue.id === id);
        if (!savedIssue) return;

        const update = getCellPatch(savedIssue, field, value);
        const next = issuesRef.current.map(issue => issue.id === id ? { ...issue, ...update } : issue);
        issuesRef.current = next;
        setIssues(next);
        if (!mutationRef.current) setSaveFeedback({ status: 'idle', message: '변경 후 저장 버튼을 눌러주세요' });
    };

    const handleSavePendingChanges = async () => {
        const drafts = Object.values(cellDraftsRef.current);
        if (drafts.some(draft => draft.invalid || draft.composing)) {
            toast.warning('입력 오류나 조합 중인 글자를 먼저 확인해주세요.');
            return;
        }
        if (mutationRef.current || writeBlocked || hasSaveConflicts) return;
        const staged = applyCellDrafts(issuesRef.current, savedIssues, drafts);
        if (!staged) return;
        const updates = Object.entries(getIssuePendingChanges(staged, savedIssues)).map(([id, data]) => ({ id, data }));
        if (updates.length > 0 && !beginMutation('save')) return;
        issuesRef.current = staged;
        setIssues(staged);
        cellDraftsRef.current = {};
        setCellDrafts({});
        setActiveCell(null);
        setEditorReset(prev => prev + 1);
        if (updates.length === 0) return;

        const changedIds = new Set(updates.map(({ id }) => id));
        setSaving(changedIds);
        markSaving(`${updates.length}개 항목의 변경사항을 저장하는 중입니다.`);
        try {
            await taxInvoiceListService.saveIssuesWithConflictCheck(updates, savedIssues);
            if (!mountedRef.current) return;
            const acknowledged = applySavedIssueUpdates(savedIssues, updates);
            setSavedIssues(acknowledged);
            const remaining = Object.keys(getIssuePendingChanges(issuesRef.current, acknowledged)).length;
            if (!remaining) setShowPendingChanges(false);
            markSaved(`${updates.length}개 항목을 저장했습니다.${remaining ? ` 추가 변경 ${remaining}건은 저장 전입니다.` : ''}`);
            toast.success(`${updates.length}개 항목의 변경사항을 저장했습니다.`);
        } catch (e) {
            if (!mountedRef.current) return;
            console.error(e);
            const completed = new Set(e instanceof IssueBatchWriteError ? e.completedIds : []);
            const acknowledged = updates.filter(({ id }) => completed.has(id));
            setSavedIssues(prev => applySavedIssueUpdates(prev, acknowledged));
            const conflictError = e instanceof IssueBatchWriteError ? e.originalError : e;
            const conflicts = conflictError instanceof IssueSaveConflictError ? conflictError.conflicts : [];
            setSaveConflicts(conflicts);
            const message = conflicts.length
                ? `${acknowledged.length}개 항목 저장 완료. 다른 창에서 변경되거나 삭제된 ${conflicts.length}개 항목을 확인해주세요. 내 입력은 유지됩니다.`
                : acknowledged.length
                ? `${acknowledged.length}개 항목 저장 완료, ${updates.length - acknowledged.length}개 항목 저장 실패. 저장 전 변경만 검토 목록에 남겼습니다.`
                : '변경사항을 저장하지 못했습니다. 검토 목록은 유지됩니다.';
            markSaveError(message);
            toast.error(message);
        } finally {
            if (mountedRef.current) setSaving(new Set());
            endMutation();
        }
    };

    const resolveSaveConflict = (conflict: IssueSaveConflict, useLatest: boolean) => {
        if (mutationRef.current) return;
        const latest = conflict.current?.yearMonth === yearMonth ? conflict.current : null;
        const current = issuesRef.current.find(issue => issue.id === conflict.id);
        const saved = savedIssues.find(issue => issue.id === conflict.id);
        const changes = current && saved ? getIssuePendingChanges([current], [saved])[conflict.id] ?? {} : {};
        const discardedFields = new Set<keyof TaxInvoiceIssue>(useLatest ? conflict.fields : []);
        if (discardedFields.has('recipient')) discardedFields.add('recipientManuallyEdited');
        discardedFields.forEach(field => { delete changes[field]; });
        const next = issuesRef.current.flatMap(issue => issue.id === conflict.id ? latest ? [{ ...latest, ...changes }] : [] : [issue]);
        issuesRef.current = next;
        setIssues(next);
        setSavedIssues(prev => prev.flatMap(issue => issue.id === conflict.id ? latest ? [latest] : [] : [issue]));
        const drafts = Object.fromEntries(Object.entries(cellDraftsRef.current).filter(([, draft]) =>
            draft.rowId !== conflict.id || (latest && !discardedFields.has(draft.field))));
        cellDraftsRef.current = drafts;
        setCellDrafts(drafts);
        if (!latest || conflict.operation === 'delete') setSelectedIds(prev => new Set([...prev].filter(id => id !== conflict.id)));
        setSaveConflicts(prev => prev.filter(item => item.id !== conflict.id));
        setActiveCell(null);
        setEditorReset(prev => prev + 1);
        setSaveFeedback({ status: 'idle', message: conflict.operation === 'delete'
            ? '최신 내용을 반영했습니다. 삭제가 필요하면 다시 요청해주세요.'
            : '최신 값과 비교했습니다. 남은 변경사항을 확인한 뒤 저장해주세요.' });
    };

    const handleDiscardPendingChanges = () => {
        if ((!hasPendingChanges && !hasCellDrafts && !hasSaveConflicts) || mutationRef.current) return;
        const conflictsById = new Map(saveConflicts.map(conflict => [conflict.id, conflict.current]));
        const restored = savedIssues.flatMap(issue => {
            if (!issue.id || !conflictsById.has(issue.id)) return [issue];
            const latest = conflictsById.get(issue.id);
            return latest?.yearMonth === yearMonth ? [latest] : [];
        });
        issuesRef.current = restored;
        setIssues(restored);
        setSavedIssues(restored);
        setSaveConflicts([]);
        const restoredIds = new Set(restored.map(issue => issue.id));
        setSelectedIds(prev => new Set([...prev].filter(id => restoredIds.has(id))));
        setActiveCell(null);
        cellDraftsRef.current = {};
        setCellDrafts({});
        setEditorReset(prev => prev + 1);
        setShowPendingChanges(false);
        setSaveFeedback({ status: 'idle', message: '변경사항을 되돌렸습니다.' });
        toast.info('저장 전 변경사항을 되돌렸습니다.');
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

    // ── Load site data ──
    const handleLoadSites = async () => {
        if (mutationRef.current || writeBlocked || loadingSites || hasSaveConflicts) return;
        const request = ++siteRequestRef.current;
        const current = () => mountedRef.current && request === siteRequestRef.current && yearMonthRef.current === yearMonth;
        setLoadingSites(true);
        try {
            const data = await taxInvoiceListService.fetchMonthlySiteData(yearMonth);
            if (!current()) return;
            setSiteData(data);
            setShowImportModal(true);
        } catch (e) {
            if (!current()) return;
            console.error(e);
            toast.error('현장 데이터를 불러오지 못했습니다.');
        } finally {
            if (current()) setLoadingSites(false);
        }
    };

    // ── Import sites as issues ──
    const handleImportSites = async (selected: SiteWorkSummary[]): Promise<string[]> => {
        if (selected.length === 0) return [];
        if (hasPendingChanges || Object.keys(cellDraftsRef.current).length > 0) {
            toast.warning('먼저 변경사항을 저장하거나 되돌려주세요.');
            return [];
        }

        if (!beginMutation('structure')) return [];
        markSaving(`${selected.length}개 현장을 발행리스트에 추가하는 중입니다.`);
        const startNo = getNextIssueNo(issues) - 1;
        const monthEndDate = getMonthEndDate(yearMonth);
        const newIssues: Omit<TaxInvoiceIssue, 'id' | 'createdAt' | 'updatedAt'>[] = selected.map((s, idx) => ({
            yearMonth,
            no: startNo + idx + 1,
            isNew: '',
            issueDate: monthEndDate,
            recipient: s.companyName,    // 상호명 → 공급받는자
            item: '',                    // 품목 (나중에 수정 가능)
            supplyAmount: 0,
            note: s.siteName,            // 현장명 → 비고
            manDays: s.manDays,
            teamName: s.teamName,        // 실제 투입팀
            remark: '',                  // 특이사항 (나중에 입력)
            issueStatus: 'ready' as IssueStatus,
            scanCompleted: false,
            siteId: s.siteId,
            siteName: s.siteName,
            siteType: s.siteType,
            paymentType: s.paymentType,
        }));

        const added: TaxInvoiceIssue[] = [];
        const completedKeys: string[] = [];
        let failedCount = 0;
        for (const [index, issue] of newIssues.entries()) {
            try {
                const id = await taxInvoiceListService.addIssue(issue);
                added.push({ ...issue, id });
                completedKeys.push(getSiteImportKey(selected[index]));
            } catch (e) {
                console.error(e);
                failedCount += 1;
            }
        }

        try {
            await finishImport(added, failedCount, '현장');
            return completedKeys;
        } finally {
            endMutation();
        }
    };

    const handleImportDeferredIssues = async (selected: TaxInvoiceIssue[]) => {
        const importTargets = selected.filter(issue => !importedCarryoverKeys.has(getCarryoverSourceKey(issue)));
        if (importTargets.length === 0) return;
        if (hasPendingChanges || Object.keys(cellDraftsRef.current).length > 0) {
            toast.warning('먼저 변경사항을 저장하거나 되돌려주세요.');
            return;
        }

        if (!beginMutation('structure')) return;
        markSaving(`${importTargets.length}개 이월 현장을 추가하는 중입니다.`);
        const startNo = getNextIssueNo(issues) - 1;
        const monthEndDate = getMonthEndDate(yearMonth);
        const added: TaxInvoiceIssue[] = [];
        let failedCount = 0;
        let existingCount = 0;

        for (const [idx, source] of importTargets.entries()) {
            const sourceId = getCarryoverSourceId(source);
            const siteName = source.siteName || source.note || source.item || '';
            const newIssue: Omit<TaxInvoiceIssue, 'id' | 'createdAt' | 'updatedAt'> = {
                yearMonth,
                no: startNo + idx + 1,
                isNew: getIssueTypeLabel(source.isNew),
                issueDate: getCarryoverIssueDate(source, monthEndDate),
                recipient: source.recipient || '',
                recipientManuallyEdited: source.recipientManuallyEdited === true,
                item: source.item || '',
                supplyAmount: Number(source.supplyAmount) || 0,
                note: source.note || siteName,
                manDays: Number(source.manDays) || 0,
                teamName: source.teamName || '',
                remark: source.remark || '',
                issueStatus: 'ready' as IssueStatus,
                scanCompleted: false,
                siteId: source.siteId || '',
                siteName,
                siteType: source.siteType || '',
                paymentType: source.paymentType || '',
                carriedFromIssueId: sourceId,
                carriedFromYearMonth: source.yearMonth,
            };

            try {
                const result = await taxInvoiceListService.importDeferredIssue(newIssue);
                added.push(result.issue);
                if (!result.created) existingCount += 1;
            } catch (e) {
                console.error('이월 현장 가져오기 실패:', e);
                failedCount += 1;
            }
        }

        try {
            await finishImport(added, failedCount, '이월 현장', existingCount);
        } finally {
            endMutation();
        }
    };

    // ── Derived stats ──
    const stats = {
        ready: issues.filter(i => i.issueStatus === 'ready').length,
        pending: issues.filter(i => i.issueStatus === 'pending').length,
        issued: issues.filter(i => i.issueStatus === 'issued').length,
        deferred: issues.filter(i => i.issueStatus === 'deferred').length,
    };

    // Filtered issues by all criteria
    const filteredIssues = useMemo(() => {
        const searchTokens = globalSearch.trim().toLowerCase().split(/\s+/).filter(Boolean);
        const filtered = issues.filter(issue => {
            // 1. Sidebar Status Filter
            if (statusFilter !== 'all' && issue.issueStatus !== statusFilter) return false;

            // 2. Global Search
            if (searchTokens.length > 0) {
                const searchableText = [
                    issue.no,
                    getIssueTypeLabel(issue.isNew),
                    issue.issueDate,
                    issue.recipient,
                    issue.item,
                    issue.supplyAmount,
                    issue.note,
                    issue.manDays,
                    issue.teamName,
                    issue.siteName,
                    issue.siteType,
                    issue.paymentType,
                    STATUS_CONFIG[issue.issueStatus]?.label ?? issue.issueStatus,
                    issue.remark,
                ].map(value => String(value ?? '').toLowerCase()).join(' ');

                if (!searchTokens.every(token => searchableText.includes(token))) return false;
            }

            // 3. Column Header Filters
            for (const [field, val] of Object.entries(columnFilters)) {
                if (!val) continue;

                const rawIssueVal = field === 'isNew'
                    ? getIssueTypeLabel(issue.isNew)
                    : field === 'issueStatus'
                        ? STATUS_CONFIG[issue.issueStatus]?.label ?? issue.issueStatus
                        : field === 'scanCompleted'
                            ? issue.scanCompleted ? '완료' : '미완료'
                        : String((issue as any)[field] ?? '');
                const issueVal = rawIssueVal.trim().toLowerCase();

                if (field === 'isNew' && val === EMPTY_CELL_FILTER_OPTION) {
                    if (issueVal !== '') return false;
                    continue;
                }

                const searchVal = val.trim().toLowerCase();

                if (issueVal !== searchVal) return false;
            }
            return true;
        });

        return [...filtered].sort(sortMode === 'team' ? compareIssuesByTeam : compareIssuesByNo);
    }, [columnFilters, globalSearch, issues, sortMode, statusFilter]);

    const filteredTotals = useMemo(() => filteredIssues.reduce(
        (totals, issue) => ({
            supply: totals.supply + (issue.supplyAmount || 0),
            manDays: totals.manDays + (issue.manDays || 0),
        }),
        { supply: 0, manDays: 0 }
    ), [filteredIssues]);
    const filteredTotalSupply = filteredTotals.supply;
    const filteredTotalManDaysRounded = Math.round(filteredTotals.manDays * 10) / 10;
    const activeColumnFilters = Object.entries(columnFilters).filter(([, value]) => Boolean(value));
    const activeFilterCount = activeColumnFilters.length
        + (statusFilter === 'all' ? 0 : 1)
        + (globalSearch.trim() ? 1 : 0);
    const allFilteredSelected = filteredIssues.length > 0
        && filteredIssues.every(issue => Boolean(issue.id) && selectedIds.has(issue.id as string));
    const selectedIssues = useMemo(() => (
        issues
            .filter(issue => Boolean(issue.id) && selectedIds.has(issue.id as string))
            .sort(sortMode === 'team' ? compareIssuesByTeam : compareIssuesByNo)
    ), [issues, selectedIds, sortMode]);
    const pendingChangeItems = useMemo(() => {
        return Object.entries(pendingChanges).flatMap(([id, changes]) => {
            const current = issues.find(issue => issue.id === id);
            const saved = savedIssues.find(issue => issue.id === id);
            if (!current || !saved) return [];

            return Object.keys(changes)
                .filter(field => field !== 'recipientManuallyEdited')
                .map(field => {
                    const issueField = field as keyof TaxInvoiceIssue;
                    return {
                        key: `${id}-${field}`,
                        no: current.no,
                        label: COLUMN_FILTER_LABELS[field] ?? field,
                        before: formatIssueValue(field, saved[issueField]),
                        after: formatIssueValue(field, current[issueField]),
                    };
                });
        });
    }, [issues, pendingChanges, savedIssues]);

    const feedbackMessage = saveFeedback.status === 'idle' && hasPendingChanges
        ? `저장 전 변경 ${pendingRowCount}건`
        : saveFeedback.message;
    const saveFeedbackClass = {
        idle: 'border-slate-200 bg-white text-slate-500',
        saving: 'border-indigo-200 bg-indigo-50 text-indigo-700',
        saved: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        error: 'border-red-200 bg-red-50 text-red-700',
    }[saveFeedback.status];
    const saveFeedbackDotClass = {
        idle: 'bg-slate-300',
        saving: 'bg-indigo-500 animate-pulse',
        saved: 'bg-emerald-500',
        error: 'bg-red-500',
    }[saveFeedback.status];
    const savedTimeLabel = saveFeedback.updatedAt
        ? new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit' }).format(saveFeedback.updatedAt)
        : '';

    // Deferred sites from the previous month.
    const deferredSites = previousDeferredIssues
        .map(i => ({
            source: i,
            siteName: i.siteName || i.note || i.item || i.recipient || '-',
            manDays: i.manDays || 0,
            teamName: i.teamName || i.recipient || '',
            note: i.item || i.note,
            imported: importedCarryoverKeys.has(getCarryoverSourceKey(i)),
        }));
    const importableDeferredCount = deferredSites.filter(site => !site.imported).length;

    const renderSaveButton = (position: 'top' | 'bottom') => (
        <button
            type="button"
            aria-label={position === 'bottom' ? `하단 변경사항 저장 (${pendingSaveRowCount})` : undefined}
            onClick={handleSavePendingChanges}
            disabled={pendingSaveRowCount === 0 || mutation !== null || hasInvalidDrafts || hasComposingDrafts || writeBlocked || hasSaveConflicts}
            className={`flex ${position === 'bottom' ? 'min-h-11 w-full justify-center' : 'min-h-10'} items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white shadow-sm transition-all hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300`}
        >
            <FontAwesomeIcon icon={faFloppyDisk} />
            변경사항 저장 ({pendingSaveRowCount})
        </button>
    );

    // ─────────────────────────────────────────────
    return (
        <IssueEditingContext.Provider value={{ disabled: writeBlocked || mutation === 'structure', drafts: cellDrafts, onDraftChange }}>
        <div className="flex min-h-full min-w-0 flex-col gap-2 bg-slate-50 p-2 sm:px-3">
            {/* 숫자 입력창 스핀 버튼 제거 스타일 */}
            <style>
                {`
                    input::-webkit-outer-spin-button,
                    input::-webkit-inner-spin-button {
                        -webkit-appearance: none;
                        margin: 0;
                    }
                    input[type=number] {
                        -moz-appearance: textfield;
                    }
                `}
            </style>
            <PayrollIssueTopTabs />

            {/* ── Header ── */}
            <section className="flex flex-col gap-3" aria-labelledby="tax-invoice-list-title">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-100" aria-hidden="true">
                            <FontAwesomeIcon icon={faFileInvoiceDollar} className="text-white text-xl" />
                        </div>
                        <div>
                            <h1 id="tax-invoice-list-title" className="text-2xl font-black text-slate-900 tracking-tight">세금계산서 발행리스트</h1>
                            <p className="text-sm text-slate-500 font-medium">월별 발행 내역을 관리합니다.</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <div
                            role={saveFeedback.status === 'error' ? 'alert' : 'status'}
                            aria-live="polite"
                            className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-xs font-bold ${saveFeedbackClass}`}
                            title={feedbackMessage}
                        >
                            <span className={`h-2 w-2 rounded-full ${saveFeedbackDotClass}`} aria-hidden="true" />
                            <span>{feedbackMessage}</span>
                            {savedTimeLabel && saveFeedback.status !== 'saving' && <span className="font-medium opacity-70">{savedTimeLabel}</span>}
                        </div>

                        <button
                            type="button"
                            onClick={() => setShowPendingChanges(prev => !prev)}
                            disabled={!hasPendingChanges}
                            aria-expanded={showPendingChanges}
                            className="flex min-h-10 items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-800 transition-all hover:bg-amber-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                        >
                            변경 검토 ({pendingChangeItems.length})
                        </button>

                        <button
                            type="button"
                            onClick={handleDiscardPendingChanges}
                            disabled={(!hasPendingChanges && !hasCellDrafts && !hasSaveConflicts) || mutation !== null}
                            className="flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <FontAwesomeIcon icon={faArrowRotateLeft} />
                            되돌리기
                        </button>

                        {renderSaveButton('top')}

                        <button
                            type="button"
                            onClick={handleLoadSites}
                            disabled={loadingSites || writeBlocked || mutation !== null || hasSaveConflicts}
                            className="flex min-h-10 items-center gap-2 rounded-xl bg-slate-700 px-4 py-2 text-sm font-bold text-white shadow-sm transition-all hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <FontAwesomeIcon icon={faDownload} className={loadingSites ? 'animate-spin' : ''} />
                            현장 데이터 가져오기
                        </button>

                        <button
                            type="button"
                            onClick={handleAddRow}
                            disabled={writeBlocked || mutation !== null || hasSaveConflicts}
                            className="flex min-h-10 items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-indigo-100 transition-all hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 active:scale-95"
                        >
                            <FontAwesomeIcon icon={faPlus} />
                            행 추가
                        </button>

                        <button
                            type="button"
                            onClick={handleExportExcel}
                            disabled={filteredIssues.length === 0 || isExporting || writeBlocked || mutation !== null || hasInvalidDrafts || hasComposingDrafts || hasSaveConflicts}
                            className="flex min-h-10 items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm font-bold text-emerald-700 transition-all hover:bg-emerald-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <FontAwesomeIcon icon={faFileExcel} />
                            {isExporting ? '엑셀 생성 중...' : '엑셀'}
                        </button>

                        <button
                            type="button"
                            onClick={() => handleCopyIssues('visible')}
                            disabled={filteredIssues.length === 0 || copyingScope !== null || writeBlocked || mutation !== null || hasInvalidDrafts || hasComposingDrafts || hasSaveConflicts}
                            title={`검색·필터·정렬이 적용된 현재 목록 ${filteredIssues.length}건만 이미지로 복사합니다.`}
                            className="flex min-h-10 items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-bold text-indigo-700 transition-all hover:bg-indigo-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <FontAwesomeIcon icon={copyingScope === 'visible' ? faRotateRight : faCopy} className={copyingScope === 'visible' ? 'animate-spin' : ''} />
                            {copyingScope === 'visible' ? '화면 복사 중...' : '화면 복사'}
                        </button>

                        {selectedIds.size > 0 && (
                            <button
                                type="button"
                                onClick={() => handleCopyIssues('selected')}
                                disabled={copyingScope !== null || writeBlocked || mutation !== null || hasInvalidDrafts || hasComposingDrafts || hasSaveConflicts}
                                className="flex min-h-10 items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-bold text-indigo-700 transition-all hover:bg-indigo-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 active:scale-95 disabled:cursor-wait disabled:opacity-60"
                            >
                                <FontAwesomeIcon icon={copyingScope === 'selected' ? faRotateRight : faCopy} className={copyingScope === 'selected' ? 'animate-spin' : ''} />
                                {copyingScope === 'selected' ? '이미지 생성 중...' : `선택 이미지 복사 (${selectedIssues.length})`}
                            </button>
                        )}

                        {selectedIds.size > 0 && (
                            <button
                                type="button"
                                onClick={handleBulkDelete}
                                disabled={writeBlocked || mutation !== null || hasSaveConflicts}
                                className="flex min-h-10 items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-600 transition-all hover:bg-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 active:scale-95"
                            >
                                <FontAwesomeIcon icon={faTrash} />
                                선택 삭제 ({selectedIds.size})
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={handleRefresh}
                            disabled={loading || loadingDeferredSites || mutation !== null}
                            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-all hover:border-indigo-200 hover:text-indigo-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
                            title="목록 새로고침"
                            aria-label="목록 새로고침"
                        >
                            <FontAwesomeIcon icon={faRotateRight} className={(loading || loadingDeferredSites) ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>

                {loadError && (
                    <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                        <span>{loadError}</span>
                        <button type="button" onClick={handleRefresh} disabled={loading || mutation !== null} className="shrink-0 rounded-lg border border-red-200 bg-white px-3 py-2 font-bold disabled:opacity-40">목록 다시 불러오기</button>
                    </div>
                )}
                {hasSaveConflicts && (
                    <section aria-label="동시 수정 충돌" className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
                        <h2 className="font-bold">다른 창의 변경사항을 확인해주세요</h2>
                        <p>{saveConflicts.some(conflict => conflict.operation === 'delete')
                            ? '변경된 항목의 삭제를 중단했습니다. 최신 내용을 반영한 뒤 삭제가 필요한 항목만 다시 선택해주세요. 확인 버튼으로 삭제되지는 않습니다.'
                            : '내 입력은 보관되어 있습니다. 항목별로 사용할 값을 선택한 뒤 다시 저장해주세요. 선택만으로 저장되지는 않습니다.'}</p>
                        {saveConflicts.map(conflict => {
                            const local = issues.find(issue => issue.id === conflict.id);
                            const available = conflict.current?.yearMonth === yearMonth;
                            return <div key={conflict.id} className="space-y-2 rounded-lg border border-amber-200 bg-white p-3">
                                <p className="font-bold">{local?.no}번 · {local?.recipient || '(공급받는자 없음)'}</p>
                                {!available && <p>다른 창에서 삭제되었거나 다른 달로 이동된 항목입니다. 아래 내용을 확인한 뒤 현재 목록에서 정리해주세요.</p>}
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead><tr><th className="p-1">항목</th><th className="p-1">{conflict.operation === 'delete' ? '확인했던 값' : '내 입력'}</th><th className="p-1">최신 값</th></tr></thead>
                                        <tbody>{conflict.fields.map(field => {
                                            const draft = cellDrafts[`${conflict.id}:${field}`];
                                            return <tr key={field}>
                                                <td className="p-1">{COLUMN_FILTER_LABELS[field] ?? (field === 'recipientManuallyEdited' ? '공급받는자 입력 방식' : field)}</td>
                                                <td className="whitespace-pre-wrap break-all p-1">{draft ? draft.value || '(빈 셀)' : formatIssueValue(field, local?.[field])}</td>
                                                <td className="whitespace-pre-wrap break-all p-1">{available ? formatIssueValue(field, conflict.current?.[field]) : '(현재 목록에 없음)'}</td>
                                            </tr>;
                                        })}</tbody>
                                    </table>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {available && conflict.operation !== 'delete' && <button type="button" onClick={() => resolveSaveConflict(conflict, false)} className="rounded border border-amber-300 px-3 py-2 font-bold">내 입력 유지</button>}
                                    <button type="button" onClick={() => resolveSaveConflict(conflict, true)} className="rounded border border-slate-300 px-3 py-2 font-bold">{available ? conflict.operation === 'delete' ? '최신 내용 확인' : '충돌 항목은 최신 값 사용' : '현재 목록에서 정리'}</button>
                                </div>
                            </div>;
                        })}
                    </section>
                )}
                {hasCellDrafts && (
                    <div role="status" className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                        <span>{hasInvalidDrafts ? '입력 오류가 있는 셀이 있습니다.' : '입력 중인 정상 값은 저장할 때 함께 반영됩니다.'} 검색으로 숨겨진 입력도 유지됩니다. 내용을 확인하거나 되돌려주세요.</span>
                        <button type="button" onClick={clearAllFilters} className="shrink-0 rounded-lg border border-amber-200 bg-white px-3 py-2 font-bold">입력 중인 셀 보기</button>
                    </div>
                )}

                {showPendingChanges && hasPendingChanges && (
                    <div className="overflow-hidden rounded-2xl border border-amber-200 bg-amber-50 shadow-sm">
                        <div className="flex items-center justify-between border-b border-amber-200 px-4 py-3">
                            <div>
                                <h2 className="text-sm font-black text-amber-950">저장 전 변경사항</h2>
                                <p className="mt-0.5 text-xs font-medium text-amber-800">아래 내용을 확인한 뒤 ‘변경사항 저장’을 눌러야 실제 목록에 반영됩니다.</p>
                            </div>
                            <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-amber-800 ring-1 ring-amber-200">
                                {pendingRowCount}개 항목 · {pendingChangeItems.length}개 셀
                            </span>
                        </div>
                        <div className="max-h-52 overflow-auto bg-white">
                            <table className="w-full text-left text-xs">
                                <thead className="sticky top-0 bg-slate-100 text-slate-600">
                                    <tr>
                                        <th className="px-4 py-2 font-black">No</th>
                                        <th className="px-4 py-2 font-black">항목</th>
                                        <th className="px-4 py-2 font-black">변경 전</th>
                                        <th className="px-4 py-2 font-black">변경 후</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {pendingChangeItems.map(item => (
                                        <tr key={item.key}>
                                            <td className="px-4 py-2 font-black text-slate-700">{item.no}</td>
                                            <td className="px-4 py-2 font-bold text-slate-700">{item.label}</td>
                                            <td className="max-w-xs truncate px-4 py-2 text-slate-500" title={item.before}>{item.before}</td>
                                            <td className="max-w-xs truncate bg-amber-50 px-4 py-2 font-bold text-amber-950" title={item.after}>{item.after}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex min-h-10 items-center gap-1 rounded-xl border border-slate-200 bg-white px-2 shadow-sm" aria-label="조회 월 선택">
                            <button
                                type="button"
                                onClick={() => stepMonth(-1)}
                                disabled={mutation !== null}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-50 hover:text-indigo-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                                aria-label="이전 달 보기"
                                title="이전 달"
                            >
                                <FontAwesomeIcon icon={faChevronLeft} className="text-xs" />
                            </button>
                            <span className="min-w-[92px] px-2 text-center text-sm font-black text-slate-800" aria-live="polite">
                                {formatYearMonth(yearMonth)}
                            </span>
                            <button
                                type="button"
                                onClick={() => stepMonth(1)}
                                disabled={mutation !== null}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-50 hover:text-indigo-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                                aria-label="다음 달 보기"
                                title="다음 달"
                            >
                                <FontAwesomeIcon icon={faChevronRight} className="text-xs" />
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={() => setSortMode(prev => prev === 'team' ? 'no' : 'team')}
                            aria-pressed={sortMode === 'team'}
                            className={`flex min-h-10 items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                                sortMode === 'team'
                                    ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                                    : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-200 hover:text-indigo-700'
                            }`}
                        >
                            <FontAwesomeIcon icon={faSort} />
                            {sortMode === 'team' ? '번호순으로 전환' : '팀별 정렬'}
                        </button>
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center xl:justify-end">
                        <label className="relative block min-w-0 flex-1 xl:max-w-md">
                            <span className="sr-only">발행리스트 통합검색</span>
                            <FontAwesomeIcon icon={faSearch} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400" />
                            <input
                                type="search"
                                value={globalSearch}
                                onChange={event => setGlobalSearch(event.target.value)}
                                placeholder="공급받는자, 현장, 팀, 품목 통합검색"
                                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-10 text-sm font-medium text-slate-700 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                            />
                            {globalSearch && (
                                <button
                                    type="button"
                                    onClick={() => setGlobalSearch('')}
                                    className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                                    aria-label="통합검색어 지우기"
                                >
                                    <FontAwesomeIcon icon={faXmark} />
                                </button>
                            )}
                        </label>
                        <span className="whitespace-nowrap text-xs font-bold text-slate-500" aria-live="polite">
                            {filteredIssues.length} / {issues.length}건 표시
                        </span>
                    </div>
                </div>

            </section>

            {/* ── Main Layout (Sidebar + Table) ── */}
            <div className="flex min-h-0 flex-1 flex-col gap-4 2xl:flex-row 2xl:gap-5">
                {/* ── Sidebar ── */}
                <aside className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:flex 2xl:w-[300px] 2xl:flex-shrink-0 2xl:flex-col" aria-label="발행리스트 요약 및 가져오기">
                    {/* Status Summary Card */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
                        <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-3">상태 요약</h3>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 2xl:flex 2xl:flex-col">
                            <button
                                type="button"
                                onClick={() => setStatusFilter('all')}
                                aria-pressed={statusFilter === 'all'}
                                className={`w-full flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                                    statusFilter === 'all'
                                        ? 'bg-slate-200 border-slate-400 ring-2 ring-slate-400/30'
                                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                                }`}
                            >
                                <span className="text-sm font-bold text-slate-600">전체</span>
                                <span className="text-sm font-black text-slate-700">{issues.length}건</span>
                            </button>
                            {(['ready', 'pending', 'issued', 'deferred'] as IssueStatus[]).map(
                                (key) => {
                                     const cfg = STATUS_CONFIG[key];
                                     return (
                                         <button
                                             type="button"
                                             key={key}
                                             onClick={() => setStatusFilter(prev => prev === key ? 'all' : key as IssueStatus)}
                                             aria-pressed={statusFilter === key}
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
                                     );
                                 }
                            )}
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 2xl:block">
                            <div className="flex justify-between text-xs text-slate-500 2xl:mb-1">
                                <span>조회 합계 공급가</span>
                                <span className="font-black text-slate-800">{fmt(filteredTotalSupply)}원</span>
                            </div>
                            <div className="flex justify-between text-xs text-slate-500">
                                <span>조회 합계 공수</span>
                                <span className="font-black text-slate-800">{filteredTotalManDaysRounded}</span>
                            </div>
                        </div>
                    </div>

                    {/* Deferred Sites */}
                    <div className="flex min-w-0 flex-col gap-3">
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
                            <div className="flex items-center justify-between gap-2 mb-3">
                                <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider">
                                    전월 이월 현장 ({deferredSites.length})
                                </h3>
                                {deferredSites.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => handleImportDeferredIssues(previousDeferredIssues)}
                                        disabled={writeBlocked || mutation !== null || hasSaveConflicts || importableDeferredCount === 0}
                                        className="text-[11px] font-bold text-blue-700 hover:text-blue-900 disabled:text-slate-300 disabled:cursor-not-allowed"
                                    >
                                        전체 가져오기
                                    </button>
                                )}
                            </div>
                            {loadingDeferredSites ? (
                                <p className="text-xs text-slate-400 text-center py-3">이월 현장을 불러오는 중입니다</p>
                            ) : deferredSites.length === 0 ? (
                                <p className="text-xs text-slate-400 text-center py-3">이월 현장이 없습니다</p>
                            ) : (
                                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                                    {deferredSites.map((s, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-blue-50 border border-blue-100">
                                            <div className="min-w-0">
                                                <p className="text-xs font-bold text-blue-800 truncate">{s.siteName}</p>
                                                {s.teamName && <p className="text-[10px] text-blue-500">{s.teamName}</p>}
                                            </div>
                                            <div className="flex items-center gap-1.5 ml-2">
                                                <span className="text-xs font-black text-blue-700">{s.manDays}</span>
                                                {s.imported ? (
                                                    <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-bold text-slate-400">추가됨</span>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleImportDeferredIssues([s.source])}
                                                        disabled={writeBlocked || mutation !== null || hasSaveConflicts}
                                                        className="w-6 h-6 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
                                                        title="현재 월 발행리스트에 추가"
                                                        aria-label={`${s.siteName} 현재 월 발행리스트에 추가`}
                                                    >
                                                        <FontAwesomeIcon icon={faPlus} className="text-[10px]" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {renderSaveButton('bottom')}
                    </div>

                    {/* Site Data (loaded) */}
                    {siteData.length > 0 && (
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider">
                                    노무 현장 ({siteData.length})
                                </h3>
                                <button
                                    type="button"
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
                                            type="button"
                                            onClick={() => handleImportSites([s])}
                                            className="ml-1.5 opacity-0 group-hover:opacity-100 px-1.5 py-0.5 text-[10px] font-bold text-white bg-indigo-500 hover:bg-indigo-600 rounded-md transition-all active:scale-95"
                                            title="발행리스트로 넘기기"
                                            aria-label={`${s.siteName} 발행리스트로 넘기기`}
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
                <div className="flex min-h-[280px] max-h-[calc(100dvh-var(--header-height)-80px)] min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="min-h-0 flex-1 overflow-auto overscroll-auto" tabIndex={0} aria-label="세금계산서 발행 목록 표, 가로와 세로로 스크롤할 수 있습니다">
                        <table className="w-full min-w-[1240px] text-sm">
                            <thead className="sticky top-0 z-20 bg-slate-50 shadow-sm">
                                <tr className="border-b border-slate-200 whitespace-nowrap">
                                    <th scope="col" className="sticky left-0 z-30 w-10 bg-slate-50 px-3 py-2.5 text-center">
                                        <input 
                                            type="checkbox" 
                                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                            checked={allFilteredSelected}
                                            onChange={toggleSelectAll}
                                            aria-label="현재 조회된 항목 전체 선택"
                                        />
                                    </th>
                                    <th scope="col" className="sticky left-10 z-30 w-10 bg-slate-50 px-3 py-2.5 text-left font-black text-slate-500">
                                        No
                                        <ColumnFilter
                                            label="No"
                                            value={columnFilters.no || ''}
                                            onChange={(v) => updateFilter('no', v)}
                                            options={uniqueIssueNos}
                                        />
                                    </th>
                                    <th className="px-2 py-3 text-center font-black text-slate-500 w-12">
                                        신규
                                        <ColumnFilter
                                            label="신규"
                                            value={columnFilters.isNew || ''}
                                            onChange={(v) => updateFilter('isNew', v)}
                                            options={uniqueIssueTypes}
                                        />
                                    </th>
                                    <th className="px-3 py-3 text-left font-black text-slate-500 w-24">
                                        발행일
                                        <ColumnFilter
                                            label="발행일"
                                            value={columnFilters.issueDate || ''}
                                            onChange={(v) => updateFilter('issueDate', v)}
                                            options={uniqueIssueDates}
                                        />
                                    </th>
                                    <th className="px-3 py-3 text-left font-black text-slate-500 w-28">
                                        공급받는자
                                        <ColumnFilter 
                                            label="공급받는자" 
                                            value={columnFilters.recipient || ''} 
                                            onChange={(v) => updateFilter('recipient', v)} 
                                            options={uniqueRecipients}
                                        />
                                    </th>
                                    <th className="px-3 py-3 text-left font-black text-slate-500 w-28">
                                        품목
                                        <ColumnFilter 
                                            label="품목" 
                                            value={columnFilters.item || ''} 
                                            onChange={(v) => updateFilter('item', v)} 
                                            options={uniqueItems}
                                        />
                                    </th>
                                    <th className="px-3 py-3 text-right font-black text-slate-500 w-24">
                                        공급가
                                        <ColumnFilter
                                            label="공급가"
                                            value={columnFilters.supplyAmount || ''}
                                            onChange={(v) => updateFilter('supplyAmount', v)}
                                            options={uniqueSupplyAmounts}
                                        />
                                    </th>
                                    <th className="px-3 py-3 text-left font-black text-slate-500 w-32">
                                        비고
                                        <ColumnFilter 
                                            label="비고" 
                                            value={columnFilters.note || ''} 
                                            onChange={(v) => updateFilter('note', v)} 
                                            options={uniqueNotes}
                                        />
                                    </th>
                                    <th className="px-3 py-3 text-right font-black text-slate-500 w-16">
                                        공수
                                        <ColumnFilter
                                            label="공수"
                                            value={columnFilters.manDays || ''}
                                            onChange={(v) => updateFilter('manDays', v)}
                                            options={uniqueManDays}
                                        />
                                    </th>
                                    <th className="px-3 py-3 text-center font-black text-slate-500 w-20">
                                        팀
                                        <ColumnFilter 
                                            label="팀" 
                                            value={columnFilters.teamName || ''} 
                                            onChange={(v) => updateFilter('teamName', v)} 
                                            options={uniqueTeams}
                                        />
                                    </th>
                                    <th className="px-3 py-3 text-center font-black text-slate-500 w-24">
                                        현장구분
                                        <ColumnFilter 
                                            label="현장구분" 
                                            value={columnFilters.siteType || ''} 
                                            onChange={(v) => updateFilter('siteType', v)} 
                                            options={['지원', '도급', '직영']}
                                        />
                                    </th>
                                    <th className="px-3 py-3 text-center font-black text-slate-500 w-24">
                                        결제구분
                                        <ColumnFilter 
                                            label="결제구분" 
                                            value={columnFilters.paymentType || ''} 
                                            onChange={(v) => updateFilter('paymentType', v)} 
                                            options={['계산서', '노무']}
                                        />
                                    </th>
                                    <th className="px-3 py-3 text-center font-black text-slate-500 w-24">
                                        발행
                                        <ColumnFilter 
                                            label="발행상태" 
                                            value={statusFilter === 'all' ? '' : STATUS_CONFIG[statusFilter].label}
                                            onChange={(value) => {
                                                const nextStatus = (Object.keys(STATUS_CONFIG) as IssueStatus[])
                                                    .find(key => STATUS_CONFIG[key].label === value);
                                                setStatusFilter(nextStatus ?? 'all');
                                            }}
                                            options={Object.values(STATUS_CONFIG).map(c => c.label)}
                                        />
                                    </th>
                                    <th className="px-3 py-3 text-center font-black text-slate-500 whitespace-nowrap w-24">
                                        노임서류
                                        <ColumnFilter
                                            label="노임서류"
                                            value={columnFilters.scanCompleted || ''}
                                            onChange={(v) => updateFilter('scanCompleted', v)}
                                            options={['완료', '미완료']}
                                        />
                                    </th>
                                    <th className="px-3 py-3 text-left font-black text-slate-500 w-56">
                                        특이사항
                                        <ColumnFilter
                                            label="특이사항"
                                            value={columnFilters.remark || ''}
                                            onChange={(v) => updateFilter('remark', v)}
                                            options={uniqueRemarks}
                                        />
                                    </th>
                                    <th className="px-3 py-3 text-center font-black text-slate-500 whitespace-nowrap w-14">삭제</th>
                                </tr>
                            </thead>
                            <tbody key={`${yearMonth}:${editorReset}`} className="divide-y divide-slate-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan={16} className="py-16 text-center text-slate-400">
                                            <FontAwesomeIcon icon={faRotateRight} className="animate-spin mr-2" />
                                            불러오는 중...
                                        </td>
                                    </tr>
                                ) : filteredIssues.length === 0 ? (
                                    <tr>
                                        <td colSpan={16} className="py-16 text-center text-slate-400">
                                            <p className="font-bold">{loadError ? '목록을 확인할 수 없습니다' : issues.length > 0 ? '조건에 맞는 결과가 없습니다' : '데이터가 없습니다'}</p>
                                            <p className="text-sm mt-1">
                                                {loadError ? '목록 다시 불러오기를 눌러주세요.' : issues.length > 0 ? '검색어나 적용된 필터를 확인해주세요.' : '행 추가 또는 현장 데이터 가져오기로 시작하세요.'}
                                            </p>
                                            {issues.length > 0 && activeFilterCount > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={clearAllFilters}
                                                    className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 transition hover:border-indigo-200 hover:text-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                                                >
                                                    필터 전체 초기화
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ) : (
                                    filteredIssues.map((issue, idx) => {
                                        const isSaving = saving.has(issue.id ?? '');
                                        const isSelected = selectedIds.has(issue.id ?? '');
                                        const statusCfg = STATUS_CONFIG[issue.issueStatus] || STATUS_CONFIG.pending;
                                        const issueTypeLabel = getIssueTypeLabel(issue.isNew);
                                        const rowToneClass = isSelected
                                            ? 'bg-indigo-100 ring-2 ring-inset ring-indigo-500'
                                            : issue.issueStatus === 'issued'
                                                ? 'bg-green-200'
                                                : issue.issueStatus === 'pending'
                                                    ? 'bg-amber-200'
                                                    : issue.issueStatus === 'deferred'
                                                        ? 'bg-blue-200'
                                                        : 'bg-white';
                                        const statusAccentClass = issue.issueStatus === 'issued'
                                            ? 'border-l-4 border-l-emerald-500'
                                            : issue.issueStatus === 'pending'
                                                ? 'border-l-4 border-l-amber-400'
                                                : issue.issueStatus === 'deferred'
                                                    ? 'border-l-4 border-l-blue-500'
                                                    : 'border-l-4 border-l-violet-500';
                                        return (
                                            <tr
                                                key={issue.id}
                                                aria-busy={isSaving}
                                                className={`group transition-colors hover:brightness-[0.98] ${rowToneClass} ${isSaving ? 'opacity-60' : ''}`}
                                            >
                                                {/* Checkbox */}
                                                <td className={`sticky left-0 z-10 bg-inherit px-3 py-2 text-center ${statusAccentClass}`}>
                                                    <input 
                                                        type="checkbox" 
                                                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                                        checked={isSelected}
                                                        onChange={() => toggleSelection(issue.id)}
                                                        aria-label={`${issue.no}번 ${issue.recipient || '이름 없는'} 항목 선택`}
                                                    />
                                                </td>

                                                {/* No */}
                                                <td className="sticky left-10 z-10 bg-inherit px-3 py-2 font-bold text-slate-600">{issue.no}</td>

                                                {/* 신규 */}
                                                <td className="px-2 py-2 text-center">
                                                    <SelectCell
                                                        value={issueTypeLabel}
                                                        options={ISSUE_TYPE_OPTIONS}
                                                        field="isNew"
                                                        rowId={issue.id}
                                                        onCommit={handleCellCommit}
                                                        badgeClass={issueTypeLabel === '입력' ? 'text-violet-700' : (issueTypeLabel === '신규' ? 'text-blue-700' : 'text-emerald-700')}
                                                        rowIndex={idx}
                                                        colIndex={0}
                                                        isFocused={activeCell?.r === idx && activeCell?.c === 0}
                                                        onNavigate={(dir) => handleNavigate(idx, 0, dir)}
                                                    />
                                                </td>

                                                {/* 발행일 */}
                                                <td className="px-3 py-2">
                                                    <EditableCell
                                                        value={issue.issueDate}
                                                        field="issueDate"
                                                        rowId={issue.id}
                                                        type="date"
                                                        onCommit={handleCellCommit}
                                                        rowIndex={idx}
                                                        colIndex={1}
                                                        isFocused={activeCell?.r === idx && activeCell?.c === 1}
                                                        onNavigate={(dir) => handleNavigate(idx, 1, dir)}
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
                                                        rowIndex={idx}
                                                        colIndex={2}
                                                        isFocused={activeCell?.r === idx && activeCell?.c === 2}
                                                        onNavigate={(dir) => handleNavigate(idx, 2, dir)}
                                                    />
                                                </td>

                                                {/* 품목 */}
                                                <td className="px-3 py-2">
                                                    <EditableCell
                                                        value={issue.item}
                                                        field="item"
                                                        rowId={issue.id}
                                                        onCommit={handleCellCommit}
                                                        rowIndex={idx}
                                                        colIndex={3}
                                                        isFocused={activeCell?.r === idx && activeCell?.c === 3}
                                                        onNavigate={(dir) => handleNavigate(idx, 3, dir)}
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
                                                        rowIndex={idx}
                                                        colIndex={4}
                                                        isFocused={activeCell?.r === idx && activeCell?.c === 4}
                                                        onNavigate={(dir) => handleNavigate(idx, 4, dir)}
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
                                                        rowIndex={idx}
                                                        colIndex={5}
                                                        isFocused={activeCell?.r === idx && activeCell?.c === 5}
                                                        onNavigate={(dir) => handleNavigate(idx, 5, dir)}
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
                                                        rowIndex={idx}
                                                        colIndex={6}
                                                        isFocused={activeCell?.r === idx && activeCell?.c === 6}
                                                        onNavigate={(dir) => handleNavigate(idx, 6, dir)}
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
                                                        rowIndex={idx}
                                                        colIndex={7}
                                                        isFocused={activeCell?.r === idx && activeCell?.c === 7}
                                                        onNavigate={(dir) => handleNavigate(idx, 7, dir)}
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
                                                        rowIndex={idx}
                                                        colIndex={8}
                                                        isFocused={activeCell?.r === idx && activeCell?.c === 8}
                                                        onNavigate={(dir) => handleNavigate(idx, 8, dir)}
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
                                                        rowIndex={idx}
                                                        colIndex={9}
                                                        isFocused={activeCell?.r === idx && activeCell?.c === 9}
                                                        onNavigate={(dir) => handleNavigate(idx, 9, dir)}
                                                    />
                                                </td>

                                                {/* 발행 상태 */}
                                                <td className="px-3 py-2 text-center">
                                                    <SelectCell
                                                        value={STATUS_CONFIG[issue.issueStatus]?.label || issue.issueStatus}
                                                        options={['ready', 'pending', 'issued', 'deferred'].map(k => STATUS_CONFIG[k as IssueStatus].label)}
                                                        field="issueStatus"
                                                        allowEmpty={false}
                                                        rowId={issue.id}
                                                        onCommit={(id, _f, v) => {
                                                            const key = (Object.entries(STATUS_CONFIG) as [IssueStatus, any][]).find(([_, cfg]) => cfg.label === v)?.[0];
                                                            if (key) handleStatusChange(id, key);
                                                        }}
                                                        rowIndex={idx}
                                                        colIndex={10}
                                                        isFocused={activeCell?.r === idx && activeCell?.c === 10}
                                                        onNavigate={(dir) => handleNavigate(idx, 10, dir)}
                                                    />
                                                </td>

                                                {/* 노임서류 */}
                                                <td className="px-3 py-2 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleScanToggle(issue.id, issue.scanCompleted)}
                                                        disabled={writeBlocked || mutation === 'structure'}
                                                        title={issue.scanCompleted ? '노임서류 완료 해제' : '노임서류 완료 처리'}
                                                        aria-label={`${issue.no}번 노임서류 ${issue.scanCompleted ? '완료 해제' : '완료 처리'}`}
                                                        aria-pressed={issue.scanCompleted}
                                                        className={`w-5 h-5 rounded border-2 transition-colors flex items-center justify-center mx-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 ${
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
                                                        className="text-slate-500 text-sm"
                                                        rowIndex={idx}
                                                        colIndex={11}
                                                        isFocused={activeCell?.r === idx && activeCell?.c === 11}
                                                        onNavigate={(dir) => handleNavigate(idx, 11, dir)}
                                                    />
                                                </td>

                                                {/* 삭제 */}
                                                <td className="px-3 py-2 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDelete(issue.id)}
                                                        disabled={writeBlocked || mutation !== null || hasSaveConflicts}
                                                        className="text-slate-300 hover:text-red-500 transition-colors p-1 rounded-lg hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                                                        aria-label={`${issue.no}번 ${issue.recipient || '이름 없는'} 항목 삭제`}
                                                        title="항목 삭제"
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
                                        <td colSpan={6} className="px-3 py-3 text-base">
                                            조회 합계 ({filteredIssues.length}건)
                                        </td>
                                        <td className="px-3 py-3 text-right text-base">
                                            {fmt(filteredTotalSupply)}
                                        </td>
                                        <td />
                                        <td className="px-3 py-3 text-right text-base">{filteredTotalManDaysRounded}</td>
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
                    blocked={writeBlocked}
                    refreshing={loading}
                    onRefresh={handleRefresh}
                />
            )}
        </div>
        </IssueEditingContext.Provider>
    );
};

export default TaxInvoiceIssueListPage;
