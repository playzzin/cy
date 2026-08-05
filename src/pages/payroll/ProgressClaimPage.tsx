import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import {
    faCalculator,
    faChartLine,
    faCheckCircle,
    faClipboardList,
    faDownload,
    faFileInvoice,
    faFileInvoiceDollar,
    faPenToSquare,
    faPaperclip,
    faPlus,
    faRotate,
    faSave,
    faSpinner,
    faTrash,
    faTruck,
} from '@fortawesome/free-solid-svg-icons';
import * as XLSX from 'xlsx';
import {
    Bar,
    BarChart,
    CartesianGrid,
    ComposedChart,
    Legend,
    Line,
    Tooltip as RechartsTooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { useMasterData } from '../../contexts/MasterDataContext';
import { dailyReportService } from '../../services/dailyReportService';
import type { DailyReportWorkerRow } from '../../services/dailyReportService';
import { estimateService, type Estimate } from '../../services/estimateService';
import { manpowerService, type Worker } from '../../services/manpowerService';
import { progressClaimService } from '../../services/progressClaimService';
import { fileTransferAuditService } from '../../services/fileTransferAuditService';
import { settlementTargetService, SettlementTarget } from '../../services/settlementTargetService';
import type { Company } from '../../services/companyService';
import type { Site } from '../../services/siteService';
import FieldBuybackWorkbookPage from './FieldBuybackWorkbookPage';
import {
    type ProgressBuybackWorkbookRow,
} from './components/ProgressBuybackWorkbookLedger';
import {
    buildProgressBuybackSiteRows,
    type ProgressBuybackSiteSource,
} from './components/ProgressBuybackSiteBoard';
import {
    SupportClientLaborStatementPanel,
    SupportClientTransactionStatementPanel,
    type SupportClientSiteWorkerRow,
    type SupportStatementTarget,
    type SupportTransactionStatementMode,
} from './SupportClientSitePage';
import type {
    ProgressAllocation,
    ProgressAllocationCalculatedRow,
    ProgressAttachment,
    ProgressAttachmentScope,
    ProgressClaim,
    ProgressClaimLine,
    ProgressClaimSummary,
    ProgressDailyManDaySummary,
    ProgressClaimStatus,
    ProgressContract,
    ProgressContractItem,
    ProgressItemCalculatedRow,
    ProgressTeamPositionMode,
    ProgressVatMode,
} from '../../types/progressClaim';
import {
    DEFAULT_PROGRESS_VAT_RATE,
    PROGRESS_ALLOCATION_METHOD_LABELS,
    PROGRESS_STATUS_LABELS,
    PROGRESS_VAT_MODE_LABELS,
    buildProgressSiteSnapshot,
} from '../../types/progressClaim';
import {
    calculateAllocations,
    calculateProgressClaimSummary,
    formatProgressMoney,
    formatProgressQuantity,
    getContractItemAmount,
    getCurrentYearMonth,
    getLineQuantity,
    getMonthDateRange,
    makeProgressId,
    roundMoney,
    summarizeDailyRowsForProgress,
    toProgressNumber,
} from '../../utils/progressClaimCalculations';
import {
    DEFAULT_BUYBACK_AFTER_TAX_RATE,
    calculateBuybackSettlement,
    normalizeBuybackAfterTaxRate,
} from '../../utils/buybackSettlement';
import { getWorkerMasterLaborStatementPayType } from '../../utils/payrollLaborStatementDefaults';
import { LOGO_FALLBACK } from '../../utils/estimateUtils';
import { toast } from '../../utils/swal';

type TabKey = 'overview' | 'entry' | 'buyback' | 'ledger' | 'transaction-ledger' | 'attachments' | 'invoice';
type EntryFilterKey = 'all' | 'included' | 'missing' | 'warning' | 'extra';
type ProgressTabTone = 'blue' | 'indigo' | 'violet' | 'slate' | 'sky' | 'emerald' | 'teal' | 'amber';
type TransactionStatementPanelState = {
    key: string;
    target: SupportStatementTarget;
    mode: SupportTransactionStatementMode;
    yearMonth: string;
};

const PROGRESS_TAB_META: Record<TabKey, { icon: IconDefinition; tone: ProgressTabTone }> = {
    overview: { icon: faChartLine, tone: 'blue' },
    entry: { icon: faPenToSquare, tone: 'indigo' },
    buyback: { icon: faRotate, tone: 'violet' },
    ledger: { icon: faClipboardList, tone: 'slate' },
    'transaction-ledger': { icon: faFileInvoice, tone: 'teal' },
    attachments: { icon: faPaperclip, tone: 'sky' },
    invoice: { icon: faFileInvoiceDollar, tone: 'emerald' },
};

const PROGRESS_STATEMENT_TAB_META: Record<SupportTransactionStatementMode | 'labor', { icon: IconDefinition; tone: ProgressTabTone; label: string }> = {
    labor: { icon: faFileInvoiceDollar, tone: 'emerald', label: '노임명세' },
    standard: { icon: faFileInvoice, tone: 'teal', label: '거래명세' },
    rental: { icon: faTruck, tone: 'amber', label: '임대거래' },
};

const PROGRESS_TAB_TONE_CLASS: Record<ProgressTabTone, { active: string; idle: string; icon: string; badge: string }> = {
    blue: {
        active: 'border-blue-600 bg-blue-600 text-white shadow-sm',
        idle: 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100',
        icon: 'text-blue-500',
        badge: 'text-blue-700',
    },
    indigo: {
        active: 'border-indigo-600 bg-indigo-600 text-white shadow-sm',
        idle: 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100',
        icon: 'text-indigo-500',
        badge: 'text-indigo-700',
    },
    violet: {
        active: 'border-violet-600 bg-violet-600 text-white shadow-sm',
        idle: 'border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100',
        icon: 'text-violet-500',
        badge: 'text-violet-700',
    },
    slate: {
        active: 'border-slate-700 bg-slate-700 text-white shadow-sm',
        idle: 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100',
        icon: 'text-slate-500',
        badge: 'text-slate-700',
    },
    sky: {
        active: 'border-sky-600 bg-sky-600 text-white shadow-sm',
        idle: 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100',
        icon: 'text-sky-500',
        badge: 'text-sky-700',
    },
    emerald: {
        active: 'border-emerald-600 bg-emerald-600 text-white shadow-sm',
        idle: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
        icon: 'text-emerald-500',
        badge: 'text-emerald-700',
    },
    teal: {
        active: 'border-teal-600 bg-teal-600 text-white shadow-sm',
        idle: 'border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100',
        icon: 'text-teal-500',
        badge: 'text-teal-700',
    },
    amber: {
        active: 'border-amber-600 bg-amber-600 text-white shadow-sm',
        idle: 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100',
        icon: 'text-amber-500',
        badge: 'text-amber-700',
    },
};

const progressTabButtonClass = (tone: ProgressTabTone, active: boolean): string =>
    `inline-flex h-9 min-w-[92px] items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-black leading-none transition focus:outline-none focus:ring-2 focus:ring-offset-1 ${
        active ? PROGRESS_TAB_TONE_CLASS[tone].active : PROGRESS_TAB_TONE_CLASS[tone].idle
    }`;

const TAB_ITEMS: Array<{ key: TabKey; label: string }> = [
    { key: 'overview', label: '월별 기성현황' },
    { key: 'entry', label: '계약/기성입력' },
    { key: 'buyback', label: '바이백' },
    { key: 'ledger', label: '현장별 대장' },
    { key: 'transaction-ledger', label: '거래명세 대장' },
    { key: 'attachments', label: '첨부' },
    { key: 'invoice', label: '기성청구서' },
];

const VISIBLE_TAB_ITEMS = TAB_ITEMS.filter((tab) => tab.key !== 'buyback');

const LEGACY_TAB_ALIASES: Record<string, TabKey> = {
    contract: 'entry',
    progress: 'entry',
    sukumi: 'buyback',
    allocations: 'buyback',
    statements: 'overview',
    transaction: 'transaction-ledger',
    transactions: 'transaction-ledger',
    rental: 'transaction-ledger',
};

const isTabKey = (value: string | null): value is TabKey =>
    !!value && VISIBLE_TAB_ITEMS.some((tab) => tab.key === value);

const normalizeTabKey = (value: string | null): TabKey | null => {
    const normalized = String(value ?? '').trim().toLowerCase();
    if (isTabKey(normalized)) return normalized;
    if (LEGACY_TAB_ALIASES[normalized]) return LEGACY_TAB_ALIASES[normalized];

    const embeddedTabs = VISIBLE_TAB_ITEMS
        .map((tab) => ({ key: tab.key, index: normalized.indexOf(tab.key) }))
        .filter((tab) => tab.index >= 0)
        .sort((a, b) => a.index - b.index);

    if (embeddedTabs[0]) return embeddedTabs[0].key;
    return null;
};

const normalizeProgressYearMonthParam = (value: string | null): string | null => {
    const text = String(value ?? '').trim();
    if (!/^\d{4}-\d{2}$/.test(text)) return null;
    const month = Number(text.slice(5, 7));
    return month >= 1 && month <= 12 ? text : null;
};

const getProgressYearMonthFromSearchParams = (params: URLSearchParams): string | null =>
    normalizeProgressYearMonthParam(params.get('month')) ||
    normalizeProgressYearMonthParam(params.get('yearMonth'));

const STATUS_CLASS: Record<ProgressClaimStatus, string> = {
    draft: 'bg-slate-100 text-slate-700 border-slate-200',
    review: 'bg-amber-50 text-amber-700 border-amber-200',
    confirmed: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    billed: 'bg-blue-50 text-blue-700 border-blue-200',
    paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};
const EMPTY_ATTACHMENTS: ProgressAttachment[] = [];
const OFFICE_INCOME_TARGET_ID = 'office_income';
const OFFICE_INCOME_TARGET_NAME = '사무실 수입';

const normalizeSiteId = (value: unknown): string => String(value ?? '').trim();
const normalizeProgressIdentityKey = (value: unknown): string =>
    String(value ?? '').replace(/\s+/g, '').trim().toLocaleLowerCase('ko-KR');

const makeDefaultContract = (site: Site | undefined): ProgressContract => ({
    siteId: normalizeSiteId(site?.id),
    siteName: String(site?.name ?? '').trim(),
    memo: '',
    items: [],
    commonAttachments: [],
});

const makeDefaultClaim = (site: Site | undefined, yearMonth: string): ProgressClaim => ({
    siteId: normalizeSiteId(site?.id),
    siteName: String(site?.name ?? '').trim(),
    yearMonth,
    status: 'draft',
    siteSnapshot: buildProgressSiteSnapshot(site),
    progressLines: [],
    allocations: [],
    claimAttachments: [],
    vatMode: 'none',
    vatRate: DEFAULT_PROGRESS_VAT_RATE,
    showAllocationsOnInvoice: false,
    showAttachmentsOnInvoice: true,
    distributionBaseAmount: undefined,
    sukumiMemo: '',
    teamPositionMode: 'currentAmount',
    teamPositionManualAmount: undefined,
    buybackMemo: '',
    memo: '',
});

const siteMatchesProgressScope = (site: Site): boolean => {
    const kind = String(site.siteType ?? '').trim().replace(/\s+/g, '').toLowerCase();
    return kind.includes('도급') || kind.includes('직영');
};

const getStatusLabel = (status?: ProgressClaimStatus): string =>
    PROGRESS_STATUS_LABELS[status || 'draft'];

const getTeamPositionModeLabel = (mode?: ProgressTeamPositionMode): string =>
    mode === 'manual' ? '설정금액' : '금회기성 전체';

const getBuybackPaymentStatusLabel = (status?: ProgressAllocation['paymentStatus']): string => ({
    pending: '미입금',
    needs_review: '정리 필요',
    calculating: '계산 중',
    retention: '보존 대기',
    scheduled: '입금 예정',
    in_progress: '입금 중',
    partial: '부분입금',
    paid: '입금 완료',
    hold: '보류',
    overpaid: '과입금',
    no_buyback: '바이백 없음',
    cancelled: '취소',
}[status || 'pending']);

const getProgressDisplayText = (...values: unknown[]): string => {
    for (const value of values) {
        const text = String(value ?? '').trim();
        if (text) return text;
    }
    return '-';
};

const PROGRESS_CHART_COLORS = [
    '#2563eb',
    '#059669',
    '#f59e0b',
    '#dc2626',
    '#7c3aed',
    '#0891b2',
    '#475569',
];

const PROGRESS_ITEM_BUCKET_PRIORITY = ['설치', '해체', '직영품'];

type ProgressDashboardChartRow = {
    month: string;
    label: string;
    contractAmount: number;
    currentAmount: number;
    cumulativeAmount: number;
    remainingAmount: number;
    progressRate: number;
    manDay: number;
    [key: string]: string | number;
};

const formatCompactProgressMoney = (value: unknown): string => {
    const amount = roundMoney(value);
    const abs = Math.abs(amount);
    if (abs >= 100000000) return `${(amount / 100000000).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}억`;
    if (abs >= 10000) return `${Math.round(amount / 10000).toLocaleString('ko-KR')}만`;
    return amount.toLocaleString('ko-KR');
};

const formatProgressChartMoney = (value: unknown): string => `${formatProgressMoney(value)}원`;

const formatProgressRate = (value: unknown): string =>
    `${toProgressNumber(value).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}%`;

const formatProgressDecimalInput = (value: unknown, maximumFractionDigits = 3): string =>
    toProgressNumber(value).toLocaleString('ko-KR', { maximumFractionDigits });

const PROGRESS_INVOICE_ELEMENT_ID = 'progress-invoice-document';
const PROGRESS_INVOICE_PRINT_WIDTH = 1120;
const PROGRESS_PDF_PAGE_WIDTH = 841.89;
const PROGRESS_PDF_PAGE_HEIGHT = 595.28;
const PROGRESS_PDF_PAGE_MARGIN = 18;
const PROGRESS_PDF_IMAGE_QUALITY = 0.98;
const PROGRESS_PDF_MIN_SLICE_RATIO = 0.58;

const sanitizeProgressFilenamePart = (value: unknown): string => {
    const text = String(value ?? '').trim().replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ');
    return text || '기성청구서';
};

const downloadProgressBlob = (blob: Blob, filename: string): void => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
};

const dataUrlToUint8Array = (dataUrl: string): Uint8Array => {
    const base64 = dataUrl.split(',')[1] || '';
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
};

type ProgressPdfImagePage = {
    width: number;
    height: number;
    displayHeight: number;
    data: Uint8Array;
};

const buildProgressInvoicePdf = (pages: ProgressPdfImagePage[]): Blob => {
    const encoder = new TextEncoder();
    const chunks: Uint8Array[] = [];
    const offsets: number[] = [];
    let position = 0;

    const pushText = (text: string) => {
        const bytes = encoder.encode(text);
        chunks.push(bytes);
        position += bytes.length;
    };
    const pushBytes = (bytes: Uint8Array) => {
        chunks.push(bytes);
        position += bytes.length;
    };
    const addObject = (id: number, parts: Array<string | Uint8Array>) => {
        offsets[id] = position;
        pushText(`${id} 0 obj\n`);
        parts.forEach((part) => typeof part === 'string' ? pushText(part) : pushBytes(part));
        pushText('\nendobj\n');
    };

    const pageObjectIds = pages.map((_, index) => 3 + index * 3);
    const objectCount = 2 + pages.length * 3;
    pushText('%PDF-1.4\n');
    addObject(1, ['<< /Type /Catalog /Pages 2 0 R >>']);
    addObject(2, [`<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`]);

    pages.forEach((page, index) => {
        const pageId = 3 + index * 3;
        const contentId = pageId + 1;
        const imageId = pageId + 2;
        const imageName = `Im${index + 1}`;
        const displayWidth = PROGRESS_PDF_PAGE_WIDTH - PROGRESS_PDF_PAGE_MARGIN * 2;
        const y = PROGRESS_PDF_PAGE_HEIGHT - PROGRESS_PDF_PAGE_MARGIN - page.displayHeight;
        const content = [
            'q',
            `${displayWidth.toFixed(2)} 0 0 ${page.displayHeight.toFixed(2)} ${PROGRESS_PDF_PAGE_MARGIN.toFixed(2)} ${y.toFixed(2)} cm`,
            `/${imageName} Do`,
            'Q',
        ].join('\n');
        const contentBytes = encoder.encode(content);

        addObject(pageId, [
            `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PROGRESS_PDF_PAGE_WIDTH} ${PROGRESS_PDF_PAGE_HEIGHT}] /Resources << /ProcSet [/PDF /ImageC] /XObject << /${imageName} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`,
        ]);
        addObject(contentId, [
            `<< /Length ${contentBytes.length} >>\nstream\n`,
            contentBytes,
            '\nendstream',
        ]);
        addObject(imageId, [
            `<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Interpolate true /Filter /DCTDecode /Length ${page.data.length} >>\nstream\n`,
            page.data,
            '\nendstream',
        ]);
    });

    const xrefOffset = position;
    pushText(`xref\n0 ${objectCount + 1}\n0000000000 65535 f \n`);
    for (let id = 1; id <= objectCount; id += 1) {
        pushText(`${String(offsets[id] || 0).padStart(10, '0')} 00000 n \n`);
    }
    pushText(`trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

    return new Blob(chunks as unknown as BlobPart[], { type: 'application/pdf' });
};

const makeProgressInvoicePdfBlob = (canvas: HTMLCanvasElement, pageBreakPixels: number[] = []): Blob => {
    const contentWidth = PROGRESS_PDF_PAGE_WIDTH - PROGRESS_PDF_PAGE_MARGIN * 2;
    const contentHeight = PROGRESS_PDF_PAGE_HEIGHT - PROGRESS_PDF_PAGE_MARGIN * 2;
    const pixelsPerPoint = canvas.width / contentWidth;
    const maxSliceHeight = Math.max(1, Math.floor(contentHeight * pixelsPerPoint));
    const sortedBreaks = Array.from(new Set(pageBreakPixels
        .map((value) => Math.round(value))
        .filter((value) => value > 0 && value < canvas.height)))
        .sort((a, b) => a - b);
    const pages: ProgressPdfImagePage[] = [];

    for (let y = 0; y < canvas.height;) {
        const remainingHeight = canvas.height - y;
        const targetBottom = Math.min(canvas.height, y + maxSliceHeight);
        const minimumBottom = y + Math.floor(maxSliceHeight * PROGRESS_PDF_MIN_SLICE_RATIO);
        const preferredBreak = targetBottom >= canvas.height
            ? canvas.height
            : [...sortedBreaks].reverse().find((value) => value > minimumBottom && value <= targetBottom);
        const sliceHeight = Math.max(1, (preferredBreak ?? targetBottom) - y);
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = Math.min(sliceHeight, remainingHeight);
        const context = sliceCanvas.getContext('2d');
        if (!context) throw new Error('PDF canvas context is not available.');
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
        context.drawImage(canvas, 0, y, canvas.width, sliceCanvas.height, 0, 0, canvas.width, sliceCanvas.height);
        pages.push({
            width: sliceCanvas.width,
            height: sliceCanvas.height,
            displayHeight: sliceCanvas.height / pixelsPerPoint,
            data: dataUrlToUint8Array(sliceCanvas.toDataURL('image/jpeg', PROGRESS_PDF_IMAGE_QUALITY)),
        });
        y += sliceCanvas.height;
    }

    return buildProgressInvoicePdf(pages);
};

const getProgressInvoiceCaptureScale = (elementWidth: number): number => {
    const targetPixelWidth = 3400;
    return Math.min(3.5, Math.max(2.5, targetPixelWidth / Math.max(elementWidth, 1)));
};

const getProgressInvoicePageBreaks = (invoiceElement: HTMLElement, canvas: HTMLCanvasElement): number[] => {
    const rootRect = invoiceElement.getBoundingClientRect();
    const scaleY = canvas.height / Math.max(rootRect.height, 1);
    const breakSelectors = [
        '.progress-invoice__hero',
        '.progress-invoice__parties',
        '.progress-invoice__site',
        '.progress-invoice-table tbody tr',
        '.progress-invoice__summary',
        '.progress-invoice__optional-section',
        '.progress-invoice__footer',
    ];

    return breakSelectors.flatMap((selector) =>
        Array.from(invoiceElement.querySelectorAll<HTMLElement>(selector)).map((element) => {
            const rect = element.getBoundingClientRect();
            return (rect.bottom - rootRect.top) * scaleY;
        })
    );
};

const formatProgressDateTime = (value: unknown): string => {
    if (!value) return '-';
    const date = typeof value === 'object' && value !== null && 'toDate' in value
        ? (value as { toDate: () => Date }).toDate()
        : typeof value === 'object' && value !== null && 'seconds' in value
            ? new Date(Number((value as { seconds: number }).seconds) * 1000)
            : new Date(String(value));
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('ko-KR', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
};

const getProgressTimeValue = (value: unknown): number => {
    if (!value) return 0;
    const date = typeof value === 'object' && value !== null && 'toDate' in value
        ? (value as { toDate: () => Date }).toDate()
        : typeof value === 'object' && value !== null && 'seconds' in value
            ? new Date(Number((value as { seconds: number }).seconds) * 1000)
            : new Date(String(value));
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
};

const getProgressItemBucket = (
    workType?: unknown,
    category?: unknown,
    workName?: unknown
): string => {
    const raw = getProgressDisplayText(workType, category, workName, '기타');
    const compact = raw.replace(/\s+/g, '');

    if (compact.includes('설치')) return '설치';
    if (compact.includes('해체') || compact.includes('해채')) return '해체';
    if (compact.includes('직영품') || compact.includes('직영')) return '직영품';

    return raw.length > 12 ? `${raw.slice(0, 12)}...` : raw;
};

const getProgressClientName = (site: Site): string =>
    getProgressDisplayText(site.clientCompanyName, site.companyName, site.constructorCompanyName, site.partnerName, '발주사 미지정');

const getProgressClientKey = (site: Site): string =>
    normalizeSiteId(site.clientCompanyId) || `client:${getProgressClientName(site)}`;

const makeSiteFromProgressClaim = (claim: ProgressClaim): Site => {
    const snapshot = claim.siteSnapshot;
    const siteId = normalizeSiteId(claim.siteId || snapshot?.siteId);
    const siteName = getProgressDisplayText(claim.siteName, snapshot?.siteName, '현장 미지정');

    return {
        id: siteId,
        code: siteId || siteName,
        name: siteName,
        address: snapshot?.siteAddress || '',
        status: 'active',
        responsibleTeamId: snapshot?.responsibleTeamId || undefined,
        responsibleTeamName: snapshot?.responsibleTeamName || undefined,
        siteManagerId: snapshot?.siteManagerId || undefined,
        siteManagerName: snapshot?.siteManagerName || undefined,
        companyId: snapshot?.constructorCompanyId || undefined,
        companyName: snapshot?.constructorCompanyName || undefined,
        constructorCompanyId: snapshot?.constructorCompanyId || undefined,
        constructorCompanyName: snapshot?.constructorCompanyName || undefined,
        clientCompanyId: snapshot?.clientCompanyId || undefined,
        clientCompanyName: snapshot?.clientCompanyName || undefined,
        partnerId: snapshot?.partnerId || undefined,
        partnerName: snapshot?.partnerName || undefined,
        siteType: snapshot?.siteType || '도급',
        paymentMethod: snapshot?.paymentMethod || undefined,
        totalManDay: 0,
        photos: [],
    };
};


const numberInputClass = 'w-full min-w-[88px] rounded border border-slate-200 px-2 py-1 text-right text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100';
const textInputClass = 'w-full rounded border border-slate-200 px-2 py-1 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100';
const selectInputClass = 'w-full rounded border border-slate-200 bg-white px-2 py-1 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100';

type ProgressMetricTone = 'default' | 'accent' | 'danger' | 'success' | 'muted';
type ProgressMetricSurface = 'white' | 'muted' | 'accent';

const PROGRESS_METRIC_TONE_CLASS: Record<ProgressMetricTone, string> = {
    default: 'text-slate-900',
    accent: 'text-indigo-700',
    danger: 'text-rose-600',
    success: 'text-emerald-700',
    muted: 'text-slate-500',
};

const PROGRESS_METRIC_SURFACE_CLASS: Record<ProgressMetricSurface, string> = {
    white: 'border-slate-200 bg-white shadow-sm',
    muted: 'border-slate-100 bg-slate-50',
    accent: 'border-indigo-100 bg-indigo-50',
};

const ProgressStatusBadge: React.FC<{ status?: ProgressClaimStatus }> = ({ status }) => (
    <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-black ${STATUS_CLASS[status || 'draft']}`}>
        {getStatusLabel(status)}
    </span>
);

const ProgressMetricCard: React.FC<{
    label: string;
    value: React.ReactNode;
    tone?: ProgressMetricTone;
    surface?: ProgressMetricSurface;
    className?: string;
}> = ({ label, value, tone = 'default', surface = 'muted', className = '' }) => (
    <div className={`rounded-lg border p-3 ${PROGRESS_METRIC_SURFACE_CLASS[surface]} ${className}`}>
        <div className="text-xs font-bold text-slate-500">{label}</div>
        <div className={`mt-1 text-lg font-black ${PROGRESS_METRIC_TONE_CLASS[tone]}`}>{value}</div>
    </div>
);

const ProgressSection: React.FC<{
    id?: string;
    title: string;
    description?: string;
    action?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
}> = ({ id, title, description, action, children, className = '' }) => (
    <section id={id} className={`rounded-lg border border-slate-200 bg-white shadow-sm ${className}`}>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
                <h2 className="text-lg font-black text-slate-900">{title}</h2>
                {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
            </div>
            {action && <div className="flex flex-wrap gap-2">{action}</div>}
        </div>
        {children}
    </section>
);

const serializeContractDraft = (contract: ProgressContract | undefined | null): string => JSON.stringify({
    siteId: contract?.siteId || '',
    siteName: contract?.siteName || '',
    memo: contract?.memo || '',
    items: (contract?.items || []).map((item) => ({
        category: item.category || '',
        workName: item.workName || '',
        workType: item.workType || '',
        contractQuantity: toProgressNumber(item.contractQuantity),
        unit: item.unit || '',
        unitPrice: toProgressNumber(item.unitPrice),
        remark: item.remark || '',
        active: item.active !== false,
    })),
    commonAttachments: (contract?.commonAttachments || []).map((item) => ({
        name: item.name,
        fullPath: item.fullPath,
        url: item.url || '',
    })),
});

const serializeClaimDraft = (claim: ProgressClaim | undefined | null): string => JSON.stringify({
    siteId: claim?.siteId || '',
    siteName: claim?.siteName || '',
    yearMonth: claim?.yearMonth || '',
    status: claim?.status || 'draft',
    progressLines: (claim?.progressLines || [])
        .filter((line) => line.itemId)
        .map((line) => ({
            itemId: line.itemId,
            source: line.source || 'contract',
            category: line.category || '',
            workName: line.workName || '',
            workType: line.workType || '',
            contractQuantity: line.contractQuantity === undefined ? null : toProgressNumber(line.contractQuantity),
            unit: line.unit || '',
            unitPrice: line.unitPrice === undefined ? null : toProgressNumber(line.unitPrice),
            currentQuantity: toProgressNumber(line.currentQuantity),
            memo: line.memo || '',
        })),
    allocations: (claim?.allocations || []).map((allocation) => ({
        settlementTargetId: allocation.settlementTargetId || '',
        targetId: allocation.targetId || '',
        targetName: allocation.targetName || '',
        targetType: allocation.targetType || '',
        companyName: allocation.companyName || '',
        method: allocation.method,
        fixedAmount: toProgressNumber(allocation.fixedAmount),
        percent: toProgressNumber(allocation.percent),
        amountPerManDay: toProgressNumber(allocation.amountPerManDay),
        manualAmount: toProgressNumber(allocation.manualAmount),
        memo: allocation.memo || '',
        settlementMode: allocation.settlementMode || 'rate',
        afterTaxRate: allocation.afterTaxRate === undefined ? null : toProgressNumber(allocation.afterTaxRate),
        manualAfterTaxAmount: allocation.manualAfterTaxAmount === undefined ? null : toProgressNumber(allocation.manualAfterTaxAmount),
        paymentStatus: allocation.paymentStatus || 'pending',
        paidAmount: allocation.paidAmount === undefined ? null : toProgressNumber(allocation.paidAmount),
        paymentDueDate: allocation.paymentDueDate || '',
        paidAt: allocation.paidAt || '',
        evidenceRequired: Boolean(allocation.evidenceRequired),
        evidenceStatus: allocation.evidenceStatus || 'not_required',
        paymentMemo: allocation.paymentMemo || '',
    })),
    claimAttachments: (claim?.claimAttachments || []).map((item) => ({
        name: item.name,
        fullPath: item.fullPath,
        url: item.url || '',
    })),
    vatMode: claim?.vatMode || 'none',
    vatRate: toProgressNumber(claim?.vatRate ?? DEFAULT_PROGRESS_VAT_RATE),
    showAllocationsOnInvoice: Boolean(claim?.showAllocationsOnInvoice),
    showAttachmentsOnInvoice: claim?.showAttachmentsOnInvoice !== false,
    distributionBaseAmount: claim?.distributionBaseAmount === undefined ? null : toProgressNumber(claim.distributionBaseAmount),
    sukumiMemo: claim?.sukumiMemo || '',
    teamPositionMode: claim?.teamPositionMode || 'currentAmount',
    teamPositionManualAmount: claim?.teamPositionManualAmount === undefined ? null : toProgressNumber(claim.teamPositionManualAmount),
    buybackMemo: claim?.buybackMemo || '',
    memo: claim?.memo || '',
});

const getEditableProgressAllocations = (claim: ProgressClaim): ProgressAllocation[] => {
    const isFinanciallyFinal = claim.status === 'confirmed' || claim.status === 'billed' || claim.status === 'paid';
    const snapshotAllocations = claim.confirmedSnapshot?.allocations;
    if (!isFinanciallyFinal || !Array.isArray(snapshotAllocations)) return [...claim.allocations];

    const liveById = new Map(claim.allocations.map((allocation) => [allocation.id, allocation]));
    return snapshotAllocations.map((snapshotAllocation) => {
        const liveAllocation = liveById.get(snapshotAllocation.id);
        if (!liveAllocation) return { ...snapshotAllocation };
        return {
            ...snapshotAllocation,
            settlementTargetId: liveAllocation.settlementTargetId,
            targetId: liveAllocation.targetId,
            targetName: liveAllocation.targetName,
            targetType: liveAllocation.targetType,
            companyName: liveAllocation.companyName,
            paymentStatus: liveAllocation.paymentStatus,
            paidAmount: liveAllocation.paidAmount,
            paymentDueDate: liveAllocation.paymentDueDate,
            paidAt: liveAllocation.paidAt,
            evidenceStatus: liveAllocation.evidenceStatus,
            paymentMemo: liveAllocation.paymentMemo,
        };
    });
};

const getContractItemLabel = (item: Partial<ProgressContractItem>, index?: number): string =>
    String(item.workName || item.category || (index !== undefined ? `계약 항목 ${index + 1}` : '계약 항목')).trim();

const getProgressLineLabel = (item: Partial<ProgressContractItem>, line?: Partial<ProgressClaimLine>): string =>
    String(line?.workName || item.workName || item.category || '기성 항목').trim();

const getAllocationLabel = (allocation: Partial<ProgressAllocation>, index?: number): string =>
    String(allocation.targetName || allocation.companyName || (index !== undefined ? `관계자 ${index + 1}` : '관계자')).trim();

type ProgressInvoiceParty = {
    businessNumber: string;
    name: string;
    ceoName: string;
    address: string;
    type: string;
    phone: string;
    manager: string;
};

type ProgressInvoiceWorkbookComputed = {
    itemRows: ProgressItemCalculatedRow[];
    summary: ProgressClaimSummary;
    allocationRows: ProgressAllocationCalculatedRow[];
};

type ProgressInvoiceWorkbookOptions = {
    site: Site;
    claim: ProgressClaim;
    computed: ProgressInvoiceWorkbookComputed;
    recipient: ProgressInvoiceParty;
    supplier: ProgressInvoiceParty;
    yearMonth: string;
};

type ProgressExcelLogoExtension = 'png' | 'jpeg';
type ProgressInvoiceDisplayRow = {
    category: string;
    workName: string;
    workType: string;
    contractQuantity: number;
    unit: string;
    contractAmount: number;
    previousQuantity: number;
    previousAmount: number;
    currentQuantity: number;
    currentAmount: number;
    cumulativeQuantity: number;
    cumulativeAmount: number;
    remainingQuantity: number;
    remainingAmount: number;
    remark: string;
};

type ProgressExcelTone = 'meta' | 'contract' | 'previous' | 'current' | 'cumulative' | 'remaining' | 'action';

const PROGRESS_EXCEL_COLS = {
    first: 1,
    last: 15,
    lastLetter: 'O',
};

const PROGRESS_EXCEL_TONES: Record<ProgressExcelTone, { header: string; soft: string; text: string }> = {
    meta: { header: 'FF111827', soft: 'FFF8FAFC', text: 'FF111827' },
    contract: { header: 'FF2563EB', soft: 'FFEFF6FF', text: 'FF1D4ED8' },
    previous: { header: 'FFD97706', soft: 'FFFFFBEB', text: 'FF92400E' },
    current: { header: 'FF4F46E5', soft: 'FFEEF2FF', text: 'FF4338CA' },
    cumulative: { header: 'FF059669', soft: 'FFECFDF5', text: 'FF047857' },
    remaining: { header: 'FFE11D48', soft: 'FFFFF1F2', text: 'FFBE123C' },
    action: { header: 'FF475569', soft: 'FFF8FAFC', text: 'FF475569' },
};

const progressExcelFill = (argb: string): ExcelJS.Fill => ({
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb },
});

const getProgressExcelLogoData = async (): Promise<{ base64: string; extension: ProgressExcelLogoExtension } | null> => {
    try {
        const response = await fetch(LOGO_FALLBACK);
        if (!response.ok) return null;
        const contentType = response.headers.get('content-type') || '';
        const blob = await response.blob();
        const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
        });

        return {
            base64,
            extension: contentType.includes('jpeg') || base64.startsWith('data:image/jpeg') ? 'jpeg' : 'png',
        };
    } catch (error) {
        console.warn('[ProgressClaimPage] progress invoice logo load failed:', error);
        return null;
    }
};

const addProgressExcelLogo = async (workbook: ExcelJS.Workbook, worksheet: ExcelJS.Worksheet) => {
    const logo = await getProgressExcelLogoData();
    if (!logo) return;

    const imageId = workbook.addImage({ base64: logo.base64, extension: logo.extension });
    worksheet.addImage(imageId, {
        tl: { col: 0.35, row: 0.15 },
        ext: { width: 118, height: 48 },
    } as ExcelJS.ImagePosition);
};

const getProgressRawText = (value: unknown): string => String(value ?? '').trim();

const isProgressNonNumericText = (value: unknown): boolean => {
    const text = getProgressRawText(value);
    return Boolean(text) && toProgressNumber(text) === 0 && !/^0+(?:\.0+)?$/.test(text);
};

const joinProgressInvoiceText = (...values: unknown[]): string => {
    const seen = new Set<string>();
    return values
        .map((value) => getProgressRawText(value))
        .filter((text) => {
            if (!text || seen.has(text)) return false;
            seen.add(text);
            return true;
        })
        .join(' / ');
};

const normalizeProgressInvoicePair = (quantity: unknown, amount: unknown): { quantity: number; amount: number } => {
    const left = toProgressNumber(quantity);
    const right = roundMoney(amount);
    const looksLikeAmountInQuantityColumn =
        Math.abs(left) >= 100000 &&
        (
            Math.abs(right) === 0 ||
            (
                Math.abs(right) < 100000 &&
                Math.abs(left) > Math.abs(right) * 10
            )
        );

    return looksLikeAmountInQuantityColumn
        ? { quantity: right, amount: left }
        : { quantity: left, amount: right };
};

const normalizeProgressInvoiceDisplayRow = (row: ProgressItemCalculatedRow): ProgressInvoiceDisplayRow => {
    const item = row.item;
    const rawContractQuantity = getProgressRawText(item.contractQuantity);
    const rawUnit = getProgressRawText(item.unit);
    const rawUnitPrice = getProgressRawText(item.unitPrice);
    const rawRemark = getProgressRawText(item.remark);
    const shiftedContractFields =
        isProgressNonNumericText(item.contractQuantity) &&
        toProgressNumber(item.unit) > 0 &&
        isProgressNonNumericText(item.unitPrice);
    const contractAmountFromCalculated = roundMoney(row.contractAmount);
    const contractAmountFromRemark = roundMoney(item.remark);

    const category = getProgressDisplayText(item.category);
    const workName = getProgressDisplayText(item.workName);
    const workType = shiftedContractFields
        ? joinProgressInvoiceText(item.workType, rawContractQuantity)
        : getProgressDisplayText(item.workType);
    const contractQuantity = shiftedContractFields
        ? toProgressNumber(item.unit)
        : toProgressNumber(item.contractQuantity);
    const unit = shiftedContractFields
        ? rawUnitPrice
        : rawUnit;
    const contractAmount = shiftedContractFields
        ? contractAmountFromCalculated || contractAmountFromRemark
        : contractAmountFromCalculated;

    const previous = normalizeProgressInvoicePair(row.previousQuantity, row.previousAmount);
    const current = normalizeProgressInvoicePair(row.currentQuantity, row.currentAmount);
    const cumulative = normalizeProgressInvoicePair(row.cumulativeQuantity, row.cumulativeAmount);
    const remaining = normalizeProgressInvoicePair(row.remainingQuantity, row.remainingAmount);

    return {
        category,
        workName,
        workType,
        contractQuantity,
        unit,
        contractAmount,
        previousQuantity: previous.quantity,
        previousAmount: previous.amount,
        currentQuantity: current.quantity,
        currentAmount: current.amount,
        cumulativeQuantity: cumulative.quantity,
        cumulativeAmount: cumulative.amount,
        remainingQuantity: remaining.quantity,
        remainingAmount: remaining.amount,
        remark: shiftedContractFields && contractAmountFromRemark !== 0 ? '' : rawRemark,
    };
};

const sumProgressInvoiceDisplayRows = (rows: ProgressInvoiceDisplayRow[]) => ({
    contractAmount: rows.reduce((sum, row) => sum + row.contractAmount, 0),
    previousAmount: rows.reduce((sum, row) => sum + row.previousAmount, 0),
    currentAmount: rows.reduce((sum, row) => sum + row.currentAmount, 0),
    cumulativeAmount: rows.reduce((sum, row) => sum + row.cumulativeAmount, 0),
    remainingAmount: rows.reduce((sum, row) => sum + row.remainingAmount, 0),
});

const progressExcelBorder = (
    style: ExcelJS.BorderStyle = 'thin',
    color = 'FFCBD5E1'
): Partial<ExcelJS.Borders> => ({
    top: { style, color: { argb: color } },
    left: { style, color: { argb: color } },
    bottom: { style, color: { argb: color } },
    right: { style, color: { argb: color } },
});

const progressExcelSectionBorder = (): Partial<ExcelJS.Borders> => ({
    top: { style: 'medium', color: { argb: 'FF111827' } },
    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
});

const setProgressExcelRange = (
    worksheet: ExcelJS.Worksheet,
    startRow: number,
    startCol: number,
    endRow: number,
    endCol: number,
    apply: (cell: ExcelJS.Cell, row: number, col: number) => void
) => {
    for (let row = startRow; row <= endRow; row += 1) {
        for (let col = startCol; col <= endCol; col += 1) {
            apply(worksheet.getCell(row, col), row, col);
        }
    }
};

const setProgressExcelText = (
    cell: ExcelJS.Cell,
    value: unknown,
    options: Partial<ExcelJS.Style> = {}
) => {
    cell.value = String(value ?? '').trim() || '-';
    cell.numFmt = '@';
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true, ...(options.alignment || {}) };
    cell.font = { name: '맑은 고딕', size: 10, color: { argb: 'FF111827' }, ...(options.font || {}) };
    if (options.fill) cell.fill = options.fill;
    if (options.border) cell.border = options.border;
};

const setProgressExcelNumber = (
    cell: ExcelJS.Cell,
    value: unknown,
    format = '#,##0',
    options: Partial<ExcelJS.Style> = {}
) => {
    cell.value = toProgressNumber(value);
    cell.numFmt = format;
    cell.alignment = { vertical: 'middle', horizontal: 'right', indent: 1, ...(options.alignment || {}) };
    cell.font = { name: '맑은 고딕', size: 10, color: { argb: 'FF111827' }, ...(options.font || {}) };
    if (options.fill) cell.fill = options.fill;
    if (options.border) cell.border = options.border;
};

const styleProgressExcelSectionTitle = (worksheet: ExcelJS.Worksheet, row: number, title: string) => {
    worksheet.mergeCells(`A${row}:${PROGRESS_EXCEL_COLS.lastLetter}${row}`);
    const cell = worksheet.getCell(row, 1);
    cell.value = title;
    cell.font = { name: '맑은 고딕', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = progressExcelFill('FF111827');
    cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    cell.border = progressExcelSectionBorder();
    worksheet.getRow(row).height = 23;
};

const styleProgressExcelBox = (
    worksheet: ExcelJS.Worksheet,
    startRow: number,
    endRow: number,
    startCol: number,
    endCol: number
) => {
    setProgressExcelRange(worksheet, startRow, startCol, endRow, endCol, (cell, row, col) => {
        const isOuterTop = row === startRow;
        const isOuterBottom = row === endRow;
        const isOuterLeft = col === startCol;
        const isOuterRight = col === endCol;
        cell.border = {
            top: { style: isOuterTop ? 'medium' : 'thin', color: { argb: isOuterTop ? 'FF111827' : 'FFE2E8F0' } },
            left: { style: isOuterLeft ? 'medium' : 'thin', color: { argb: isOuterLeft ? 'FF111827' : 'FFE2E8F0' } },
            bottom: { style: isOuterBottom ? 'medium' : 'thin', color: { argb: isOuterBottom ? 'FF111827' : 'FFE2E8F0' } },
            right: { style: isOuterRight ? 'medium' : 'thin', color: { argb: isOuterRight ? 'FF111827' : 'FFE2E8F0' } },
        };
    });
};

const writeProgressExcelPartyBox = (
    worksheet: ExcelJS.Worksheet,
    range: { startCol: number; endCol: number; labelCol: string; valueStartCol: string; valueEndCol: string; subLabelCol: string; subValueStartCol: string; subValueEndCol: string },
    startRow: number,
    title: string,
    party: ProgressInvoiceParty,
    tone: ProgressExcelTone,
    _claimStatus: ProgressClaimStatus,
    yearMonth: string
) => {
    const headerRange = `${range.labelCol}${startRow}:${range.subValueEndCol}${startRow}`;
    worksheet.mergeCells(headerRange);
    const header = worksheet.getCell(startRow, range.startCol);
    header.value = title;
    header.font = { name: '맑은 고딕', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = progressExcelFill(PROGRESS_EXCEL_TONES[tone].header);
    header.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    worksheet.getRow(startRow).height = 24;

    const rows: Array<[string, unknown, string, unknown]> = [
        ['등록번호', party.businessNumber, '구분', party.type],
        ['상호', party.name, '대표자', party.ceoName],
        ['주소', party.address, '', ''],
        ['청구월', yearMonth, '연락처', party.phone],
    ];

    rows.forEach(([label, value, subLabel, subValue], index) => {
        const row = startRow + index + 1;
        worksheet.getRow(row).height = index === 2 ? 30 : 23;

        const labelCell = worksheet.getCell(`${range.labelCol}${row}`);
        setProgressExcelText(labelCell, label, {
            font: { bold: true, color: { argb: 'FF475569' } },
            fill: progressExcelFill('FFF8FAFC'),
            alignment: { horizontal: 'center', wrapText: false },
        });

        if (index === 2) {
            worksheet.mergeCells(`${range.valueStartCol}${row}:${range.subValueEndCol}${row}`);
            setProgressExcelText(worksheet.getCell(`${range.valueStartCol}${row}`), value);
            return;
        }

        worksheet.mergeCells(`${range.valueStartCol}${row}:${range.valueEndCol}${row}`);
        setProgressExcelText(worksheet.getCell(`${range.valueStartCol}${row}`), value, {
            font: label === '상호' ? { bold: true } : undefined,
        });

        const subLabelCell = worksheet.getCell(`${range.subLabelCol}${row}`);
        setProgressExcelText(subLabelCell, subLabel, {
            font: { bold: true, color: { argb: 'FF475569' } },
            fill: progressExcelFill('FFF8FAFC'),
            alignment: { horizontal: 'center', wrapText: false },
        });
        worksheet.mergeCells(`${range.subValueStartCol}${row}:${range.subValueEndCol}${row}`);
        setProgressExcelText(worksheet.getCell(`${range.subValueStartCol}${row}`), subValue, {
            font: subLabel === '상태' ? { bold: true, color: { argb: PROGRESS_EXCEL_TONES[tone].text } } : undefined,
        });
    });

    styleProgressExcelBox(worksheet, startRow, startRow + rows.length, range.startCol, range.endCol);
};

const styleProgressExcelHeaderCell = (cell: ExcelJS.Cell, tone: ProgressExcelTone, dark = true) => {
    cell.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: dark ? 'FFFFFFFF' : PROGRESS_EXCEL_TONES[tone].text } };
    cell.fill = progressExcelFill(dark ? PROGRESS_EXCEL_TONES[tone].header : PROGRESS_EXCEL_TONES[tone].soft);
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = progressExcelBorder('thin', dark ? 'FF111827' : 'FFCBD5E1');
};

const styleProgressExcelBodyCell = (
    cell: ExcelJS.Cell,
    tone: ProgressExcelTone,
    alignment: Partial<ExcelJS.Alignment> = {}
) => {
    cell.font = { name: '맑은 고딕', size: 9.5, color: { argb: PROGRESS_EXCEL_TONES[tone].text } };
    cell.fill = progressExcelFill(PROGRESS_EXCEL_TONES[tone].soft);
    cell.alignment = { vertical: 'middle', wrapText: true, ...alignment };
    cell.border = progressExcelBorder('thin', 'FFE2E8F0');
};

const buildProgressInvoiceWorkbook = async ({
    site,
    claim,
    computed,
    recipient,
    supplier,
    yearMonth,
}: ProgressInvoiceWorkbookOptions): Promise<ExcelJS.Workbook> => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'CY ERP';
    workbook.created = new Date();
    workbook.modified = new Date();

    const worksheet = workbook.addWorksheet('기성청구서');
    worksheet.properties.defaultRowHeight = 21;
    worksheet.views = [{ state: 'frozen', ySplit: 14, showGridLines: false }];
    worksheet.pageSetup = {
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        paperSize: 9,
        horizontalCentered: true,
        margins: {
            left: 0.25,
            right: 0.25,
            top: 0.35,
            bottom: 0.35,
            header: 0.15,
            footer: 0.15,
        },
    };

    worksheet.columns = [
        { width: 15 }, { width: 26 }, { width: 13 }, { width: 14 }, { width: 9 },
        { width: 19 }, { width: 14 }, { width: 19 }, { width: 14 }, { width: 19 },
        { width: 14 }, { width: 19 }, { width: 14 }, { width: 19 }, { width: 16 },
    ];
    await addProgressExcelLogo(workbook, worksheet);

    worksheet.mergeCells('A1:O1');
    const title = worksheet.getCell('A1');
    title.value = `${yearMonth} 기성청구서`;
    title.font = { name: '맑은 고딕', size: 22, bold: true, color: { argb: 'FF111827' } };
    title.alignment = { horizontal: 'center', vertical: 'middle' };
    title.border = { bottom: { style: 'medium', color: { argb: 'FF111827' } } };
    worksheet.getRow(1).height = 38;

    const exportedAt = new Date().toLocaleDateString('ko-KR');
    [
        ['A2:D2', `청구월: ${yearMonth}`],
        ['E2:K2', `현장: ${site.name || claim.siteName || '-'}`],
        ['L2:O2', `작성일: ${exportedAt}`],
    ].forEach(([range, value]) => {
        worksheet.mergeCells(range);
        const cell = worksheet.getCell(String(range).split(':')[0]);
        cell.value = value;
        cell.font = { name: '맑은 고딕', size: 9.5, bold: true, color: { argb: 'FF475569' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.fill = progressExcelFill('FFF8FAFC');
        cell.border = progressExcelBorder('thin', 'FFE2E8F0');
    });
    worksheet.getRow(2).height = 22;
    worksheet.getRow(3).height = 8;

    writeProgressExcelPartyBox(
        worksheet,
        { startCol: 1, endCol: 7, labelCol: 'A', valueStartCol: 'B', valueEndCol: 'D', subLabelCol: 'E', subValueStartCol: 'F', subValueEndCol: 'G' },
        4,
        '공급받는자',
        recipient,
        'meta',
        claim.status,
        yearMonth
    );
    writeProgressExcelPartyBox(
        worksheet,
        { startCol: 8, endCol: 15, labelCol: 'H', valueStartCol: 'I', valueEndCol: 'K', subLabelCol: 'L', subValueStartCol: 'M', subValueEndCol: 'O' },
        4,
        '공급자',
        supplier,
        'current',
        claim.status,
        yearMonth
    );

    worksheet.getRow(9).height = 8;

    styleProgressExcelSectionTitle(worksheet, 10, '현장 정보');
    worksheet.getRow(11).height = 27;
    worksheet.getCell('A11').value = '현장명';
    worksheet.mergeCells('B11:E11');
    worksheet.getCell('B11').value = site.name || claim.siteName || '-';
    worksheet.getCell('F11').value = '현장주소';
    worksheet.mergeCells('G11:O11');
    worksheet.getCell('G11').value = site.address || '-';
    setProgressExcelRange(worksheet, 11, 1, 11, PROGRESS_EXCEL_COLS.last, (cell, _row, col) => {
        const isLabel = [1, 6].includes(col);
        cell.font = { name: '맑은 고딕', size: 10, bold: isLabel, color: { argb: isLabel ? 'FF475569' : 'FF111827' } };
        cell.fill = progressExcelFill(isLabel ? 'FFF8FAFC' : 'FFFFFFFF');
        cell.alignment = { horizontal: isLabel ? 'center' : 'left', vertical: 'middle', wrapText: true };
        cell.border = progressExcelBorder('thin', 'FFE2E8F0');
    });

    worksheet.getRow(12).height = 8;

    const headerTopRow = 13;
    const headerBottomRow = 14;
    [
        ['A13:A14', '분류', 'meta'],
        ['B13:B14', '공종명', 'meta'],
        ['C13:C14', '구분', 'meta'],
        ['D13:F13', '계약', 'contract'],
        ['G13:H13', '전회', 'previous'],
        ['I13:J13', '금회', 'current'],
        ['K13:L13', '누계', 'cumulative'],
        ['M13:N13', '잔여기성', 'remaining'],
        ['O13:O14', '비고', 'action'],
    ].forEach(([range, label, tone]) => {
        worksheet.mergeCells(String(range));
        const cell = worksheet.getCell(String(range).split(':')[0]);
        cell.value = label;
        styleProgressExcelHeaderCell(cell, tone as ProgressExcelTone, true);
    });
    [
        ['D14', '수량', 'contract'],
        ['E14', '단위', 'contract'],
        ['F14', '금액', 'contract'],
        ['G14', '수량', 'previous'],
        ['H14', '금액', 'previous'],
        ['I14', '수량', 'current'],
        ['J14', '금액', 'current'],
        ['K14', '수량', 'cumulative'],
        ['L14', '금액', 'cumulative'],
        ['M14', '수량', 'remaining'],
        ['N14', '금액', 'remaining'],
    ].forEach(([address, label, tone]) => {
        const cell = worksheet.getCell(address);
        cell.value = label;
        styleProgressExcelHeaderCell(cell, tone as ProgressExcelTone, false);
    });
    worksheet.getRow(headerTopRow).height = 23;
    worksheet.getRow(headerBottomRow).height = 23;

    const displayRows = computed.itemRows.map(normalizeProgressInvoiceDisplayRow);
    const displayTotals = sumProgressInvoiceDisplayRows(displayRows);
    const firstDataRow = 15;
    let currentRow = firstDataRow;

    if (displayRows.length === 0) {
        worksheet.mergeCells(`A${currentRow}:O${currentRow}`);
        const emptyCell = worksheet.getCell(currentRow, 1);
        emptyCell.value = '청구 품목이 없습니다.';
        emptyCell.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: 'FF94A3B8' } };
        emptyCell.alignment = { horizontal: 'center', vertical: 'middle' };
        emptyCell.fill = progressExcelFill('FFF8FAFC');
        emptyCell.border = progressExcelBorder('thin', 'FFE2E8F0');
        worksheet.getRow(currentRow).height = 28;
        currentRow += 1;
    } else {
        displayRows.forEach((row) => {
            const values = [
                row.category,
                row.workName,
                row.workType,
                row.contractQuantity,
                row.unit,
                row.contractAmount,
                row.previousQuantity,
                row.previousAmount,
                row.currentQuantity,
                row.currentAmount,
                row.cumulativeQuantity,
                row.cumulativeAmount,
                row.remainingQuantity,
                row.remainingAmount,
                row.remark,
            ];
            worksheet.getRow(currentRow).values = [undefined, ...values];
            worksheet.getRow(currentRow).height = Math.max(24, Math.ceil(String(row.workName || '').length / 18) * 13 + 10);

            setProgressExcelRange(worksheet, currentRow, 1, currentRow, PROGRESS_EXCEL_COLS.last, (cell, _row, col) => {
                const tone: ProgressExcelTone =
                    col <= 3 ? 'meta' :
                    col <= 6 ? 'contract' :
                    col <= 8 ? 'previous' :
                    col <= 10 ? 'current' :
                    col <= 12 ? 'cumulative' :
                    col <= 14 ? 'remaining' : 'action';
                const isMoney = [6, 8, 10, 12, 14].includes(col);
                const isQuantity = [4, 7, 9, 11, 13].includes(col);
                const isCenter = [1, 3, 5].includes(col);
                styleProgressExcelBodyCell(cell, tone, {
                    horizontal: isMoney || isQuantity ? 'right' : isCenter ? 'center' : 'left',
                    indent: isMoney || isQuantity ? 1 : 0,
                    wrapText: !(isMoney || isQuantity),
                });
                if (isMoney) cell.numFmt = '#,##0;[Red]-#,##0;0';
                if (isQuantity) cell.numFmt = '#,##0.###';
                if (col === 10) cell.font = { ...cell.font, bold: true };
                if (col === 14 && toProgressNumber(cell.value) < 0) {
                    cell.font = { ...cell.font, bold: true, color: { argb: 'FFE11D48' } };
                }
            });
            currentRow += 1;
        });
    }

    const totalRow = currentRow;
    worksheet.mergeCells(`A${totalRow}:E${totalRow}`);
    worksheet.getCell(`A${totalRow}`).value = '합계';
    worksheet.getRow(totalRow).height = 26;
    [
        ['F', displayTotals.contractAmount, 'contract'],
        ['H', displayTotals.previousAmount, 'previous'],
        ['J', displayTotals.currentAmount, 'current'],
        ['L', displayTotals.cumulativeAmount, 'cumulative'],
        ['N', displayTotals.remainingAmount, 'remaining'],
    ].forEach(([col, value, tone]) => {
        const cell = worksheet.getCell(`${col}${totalRow}`);
        setProgressExcelNumber(cell, value, '#,##0;[Red]-#,##0;0', {
            font: { bold: true, color: { argb: PROGRESS_EXCEL_TONES[tone as ProgressExcelTone].text } },
            fill: progressExcelFill(PROGRESS_EXCEL_TONES[tone as ProgressExcelTone].soft),
            border: progressExcelBorder('thin', 'FF94A3B8'),
        });
    });
    setProgressExcelRange(worksheet, totalRow, 1, totalRow, PROGRESS_EXCEL_COLS.last, (cell, _row, col) => {
        cell.border = progressExcelBorder('thin', 'FF94A3B8');
        if (col <= 5 || !['F', 'H', 'J', 'L', 'N'].includes(cell.address.replace(/\d+/g, ''))) {
            cell.fill = progressExcelFill('FFE2E8F0');
            cell.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: 'FF111827' } };
            cell.alignment = { horizontal: col <= 5 ? 'center' : 'right', vertical: 'middle' };
        }
    });

    let sectionRow = totalRow + 2;
    styleProgressExcelSectionTitle(worksheet, sectionRow, '청구 요약');
    const summaryRows: Array<[string, unknown, string, boolean]> = [
        ...(claim.vatMode !== 'none'
            ? [
                ['공급가액', computed.summary.supplyAmount, '#,##0;[Red]-#,##0;0', false] as [string, unknown, string, boolean],
                ['부가세', computed.summary.vatAmount, '#,##0;[Red]-#,##0;0', false] as [string, unknown, string, boolean],
            ]
            : []),
        ['잔여기성', computed.summary.remainingAmount, '#,##0;[Red]-#,##0;0', false],
        ['청구금액', computed.summary.billingAmount, '#,##0;[Red]-#,##0;0', true],
    ];
    summaryRows.forEach(([label, value, format, highlight], index) => {
        const row = sectionRow + index + 1;
        worksheet.mergeCells(`A${row}:C${row}`);
        worksheet.mergeCells(`D${row}:F${row}`);
        const labelCell = worksheet.getCell(`A${row}`);
        setProgressExcelText(labelCell, label, {
            font: { bold: true, color: { argb: highlight ? 'FFFFFFFF' : 'FF475569' } },
            fill: progressExcelFill(highlight ? 'FF111827' : 'FFF8FAFC'),
            alignment: { horizontal: 'left', indent: 1, wrapText: false },
            border: progressExcelBorder('thin', 'FFE2E8F0'),
        });
        const valueCell = worksheet.getCell(`D${row}`);
        setProgressExcelNumber(valueCell, value, format, {
            font: { bold: true, size: highlight ? 13 : 10.5, color: { argb: highlight ? 'FFFFFFFF' : 'FF111827' } },
            fill: progressExcelFill(highlight ? 'FF111827' : 'FFFFFFFF'),
            border: progressExcelBorder('thin', 'FFE2E8F0'),
        });
        worksheet.getRow(row).height = highlight ? 30 : 24;
    });

    worksheet.mergeCells(`I${sectionRow + 1}:O${sectionRow + summaryRows.length}`);
    const amountPanel = worksheet.getCell(`I${sectionRow + 1}`);
    amountPanel.value = {
        richText: [
            { text: '최종 청구금액\n', font: { name: '맑은 고딕', size: 12, bold: true, color: { argb: 'FFFFFFFF' } } },
            { text: `${formatProgressMoney(computed.summary.billingAmount)} 원`, font: { name: '맑은 고딕', size: 24, bold: true, color: { argb: 'FFFFFFFF' } } },
        ],
    };
    amountPanel.fill = progressExcelFill('FF111827');
    amountPanel.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    amountPanel.border = progressExcelBorder('medium', 'FF111827');

    sectionRow += summaryRows.length + 2;

    if (computed.summary.buybackPoolAmount !== 0 || claim.showAllocationsOnInvoice) {
        styleProgressExcelSectionTitle(worksheet, sectionRow, '바이백 및 팀포지션 요약');
        const headerRow = sectionRow + 1;
        const dataRow = sectionRow + 2;
        [['A', '팀포지션 기준'], ['D', '팀포지션 금액'], ['G', '바이백 가능금액']].forEach(([col, label]) => {
            worksheet.mergeCells(`${col}${headerRow}:${String.fromCharCode(col.charCodeAt(0) + 2)}${headerRow}`);
            const cell = worksheet.getCell(`${col}${headerRow}`);
            cell.value = label;
            styleProgressExcelHeaderCell(cell, 'current', true);
        });
        worksheet.mergeCells(`A${dataRow}:C${dataRow}`);
        worksheet.mergeCells(`D${dataRow}:F${dataRow}`);
        worksheet.mergeCells(`G${dataRow}:I${dataRow}`);
        setProgressExcelText(worksheet.getCell(`A${dataRow}`), getTeamPositionModeLabel(computed.summary.teamPositionMode), {
            border: progressExcelBorder('thin', 'FFE2E8F0'),
            alignment: { horizontal: 'center' },
        });
        setProgressExcelNumber(worksheet.getCell(`D${dataRow}`), computed.summary.teamPositionAmount, '#,##0', {
            border: progressExcelBorder('thin', 'FFE2E8F0'),
        });
        setProgressExcelNumber(worksheet.getCell(`G${dataRow}`), computed.summary.buybackPoolAmount, '#,##0', {
            font: { bold: true, color: { argb: 'FF4F46E5' } },
            fill: progressExcelFill('FFEEF2FF'),
            border: progressExcelBorder('thin', 'FFE2E8F0'),
        });
        sectionRow = dataRow + 2;
    }

    if (claim.showAllocationsOnInvoice) {
        styleProgressExcelSectionTitle(worksheet, sectionRow, '관계자 배분');
        const headerRow = sectionRow + 1;
        const headers = ['관계자', '방식', '세전', '세후', '세금', '입금', '비고'];
        const widths = [['A', 'C'], ['D', 'E'], ['F', 'G'], ['H', 'I'], ['J', 'K'], ['L', 'M'], ['N', 'O']];
        headers.forEach((label, index) => {
            const [start, end] = widths[index];
            worksheet.mergeCells(`${start}${headerRow}:${end}${headerRow}`);
            const cell = worksheet.getCell(`${start}${headerRow}`);
            cell.value = label;
            styleProgressExcelHeaderCell(cell, 'meta', true);
        });
        const allocationRows = computed.allocationRows.length ? computed.allocationRows : [];
        if (allocationRows.length === 0) {
            worksheet.mergeCells(`A${headerRow + 1}:O${headerRow + 1}`);
            setProgressExcelText(worksheet.getCell(`A${headerRow + 1}`), '배분 내역이 없습니다.', {
                alignment: { horizontal: 'center' },
                fill: progressExcelFill('FFF8FAFC'),
                border: progressExcelBorder('thin', 'FFE2E8F0'),
            });
            sectionRow = headerRow + 3;
        } else {
            allocationRows.forEach((row, index) => {
                const rowNumber = headerRow + index + 1;
                const settlement = calculateBuybackSettlement(row.amount, row.allocation);
                worksheet.mergeCells(`A${rowNumber}:C${rowNumber}`);
                worksheet.mergeCells(`D${rowNumber}:E${rowNumber}`);
                worksheet.mergeCells(`F${rowNumber}:G${rowNumber}`);
                worksheet.mergeCells(`H${rowNumber}:I${rowNumber}`);
                worksheet.mergeCells(`J${rowNumber}:K${rowNumber}`);
                worksheet.mergeCells(`L${rowNumber}:M${rowNumber}`);
                worksheet.mergeCells(`N${rowNumber}:O${rowNumber}`);
                setProgressExcelText(worksheet.getCell(`A${rowNumber}`), row.allocation.targetName, { border: progressExcelBorder('thin', 'FFE2E8F0') });
                setProgressExcelText(worksheet.getCell(`D${rowNumber}`), PROGRESS_ALLOCATION_METHOD_LABELS[row.allocation.method], {
                    alignment: { horizontal: 'center' },
                    border: progressExcelBorder('thin', 'FFE2E8F0'),
                });
                setProgressExcelNumber(worksheet.getCell(`F${rowNumber}`), settlement.grossAmount, '#,##0', { border: progressExcelBorder('thin', 'FFE2E8F0') });
                setProgressExcelNumber(worksheet.getCell(`H${rowNumber}`), settlement.afterTaxAmount, '#,##0', { border: progressExcelBorder('thin', 'FFE2E8F0') });
                setProgressExcelNumber(worksheet.getCell(`J${rowNumber}`), settlement.taxAmount, '#,##0', { border: progressExcelBorder('thin', 'FFE2E8F0') });
                const storedPaidAmount = Math.max(0, toProgressNumber(row.allocation.paidAmount));
                const paidAmount = row.allocation.paymentStatus === 'paid'
                    ? (row.allocation.paidAmount === undefined ? settlement.afterTaxAmount : storedPaidAmount)
                    : row.allocation.paymentStatus === 'partial' || row.allocation.paymentStatus === 'overpaid'
                        ? storedPaidAmount
                        : 0;
                const remainingAmount = Math.max(0, settlement.afterTaxAmount - paidAmount);
                setProgressExcelText(worksheet.getCell(`L${rowNumber}`), [
                    getBuybackPaymentStatusLabel(row.allocation.paymentStatus),
                    `입금 ${formatProgressMoney(paidAmount)}`,
                    `잔액 ${formatProgressMoney(remainingAmount)}`,
                ].join(' / '), {
                    alignment: { horizontal: 'center' },
                    border: progressExcelBorder('thin', 'FFE2E8F0'),
                });
                setProgressExcelText(worksheet.getCell(`N${rowNumber}`), [row.allocation.memo, row.allocation.paymentMemo].filter(Boolean).join(' / '), { border: progressExcelBorder('thin', 'FFE2E8F0') });
            });
            sectionRow = headerRow + allocationRows.length + 2;
        }
    }

    worksheet.mergeCells(`A${sectionRow}:O${sectionRow}`);
    const footer = worksheet.getCell(`A${sectionRow}`);
    footer.value = '본 문서는 시스템에서 생성된 기성청구서 Excel 양식입니다.';
    footer.font = { name: '맑은 고딕', size: 9, color: { argb: 'FF64748B' } };
    footer.alignment = { horizontal: 'right', vertical: 'middle' };
    footer.fill = progressExcelFill('FFFFFFFF');
    worksheet.getRow(sectionRow).height = 20;

    return workbook;
};

const MeasuredChartFrame: React.FC<{
    height: number;
    children: (size: { width: number; height: number }) => React.ReactNode;
}> = ({ height, children }) => {
    const ref = React.useRef<HTMLDivElement | null>(null);
    const [width, setWidth] = useState(0);

    useEffect(() => {
        const node = ref.current;
        if (!node) return undefined;

        const updateWidth = () => {
            const nextWidth = Math.floor(node.getBoundingClientRect().width);
            setWidth(nextWidth > 0 ? nextWidth : 0);
        };

        updateWidth();
        const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateWidth) : null;
        observer?.observe(node);
        window.addEventListener('resize', updateWidth);
        return () => {
            observer?.disconnect();
            window.removeEventListener('resize', updateWidth);
        };
    }, []);

    return (
        <div ref={ref} className="h-full w-full min-w-0" style={{ height }}>
            {width > 0 ? children({ width, height }) : null}
        </div>
    );
};

interface ProgressClaimPageProps {
    mode?: 'full' | 'invoice';
}

const ProgressClaimPage: React.FC<ProgressClaimPageProps> = ({ mode = 'full' }) => {
    const { companies, sites, loading: masterLoading } = useMasterData();
    const [searchParams, setSearchParams] = useSearchParams();
    const isInvoiceOnlyPage = mode === 'invoice';
    const [activeTab, setActiveTabState] = useState<TabKey>(() => {
        if (isInvoiceOnlyPage) return 'invoice';
        const tab = searchParams.get('tab');
        return normalizeTabKey(tab) || 'overview';
    });
    const [yearMonth, setYearMonth] = useState(() =>
        getProgressYearMonthFromSearchParams(searchParams) || getCurrentYearMonth()
    );
    const [contracts, setContracts] = useState<ProgressContract[]>([]);
    const [claims, setClaims] = useState<ProgressClaim[]>([]);
    const [targets, setTargets] = useState<SettlementTarget[]>([]);
    const [dailyRows, setDailyRows] = useState<DailyReportWorkerRow[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [transactionStatements, setTransactionStatements] = useState<Estimate[]>([]);
    const [transactionStatementsLoading, setTransactionStatementsLoading] = useState(false);
    const [laborStatementPanel, setLaborStatementPanel] = useState<{ key: string; target: SupportStatementTarget } | null>(null);
    const [transactionStatementPanel, setTransactionStatementPanel] = useState<TransactionStatementPanelState | null>(null);
    const [selectedSiteId, setSelectedSiteId] = useState(() =>
        normalizeSiteId(searchParams.get('siteId') || searchParams.get('site') || '')
    );
    const [contractDraft, setContractDraft] = useState<ProgressContract | null>(null);
    const [claimDraft, setClaimDraft] = useState<ProgressClaim | null>(null);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');
    const [entryFilter, setEntryFilter] = useState<EntryFilterKey>('all');
    const [selectedOverviewClientKey, setSelectedOverviewClientKey] = useState('');

    const tabParam = searchParams.get('tab');
    const normalizedTabParam = isInvoiceOnlyPage ? 'invoice' : normalizeTabKey(tabParam);
    const queryYearMonth = getProgressYearMonthFromSearchParams(searchParams);
    const querySiteId = normalizeSiteId(searchParams.get('siteId') || searchParams.get('site') || '');
    const rawMonthParam = searchParams.get('month');
    const rawYearMonthParam = searchParams.get('yearMonth');

    useEffect(() => {
        if (isInvoiceOnlyPage) {
            if (activeTab !== 'invoice') setActiveTabState('invoice');
            return;
        }
        if (!normalizedTabParam) return;
        if (normalizedTabParam !== activeTab) {
            setActiveTabState(normalizedTabParam);
        }
        if (tabParam !== normalizedTabParam) {
            const next = new URLSearchParams(window.location.search);
            next.set('tab', normalizedTabParam);
            setSearchParams(next, { replace: true });
        }
    }, [activeTab, isInvoiceOnlyPage, normalizedTabParam, setSearchParams, tabParam]);

    useEffect(() => {
        if (!queryYearMonth || queryYearMonth === yearMonth) return;
        setYearMonth(queryYearMonth);
    }, [queryYearMonth, yearMonth]);

    useEffect(() => {
        const hasInvalidMonth = Boolean(rawMonthParam && !normalizeProgressYearMonthParam(rawMonthParam));
        const hasInvalidYearMonth = Boolean(rawYearMonthParam && !normalizeProgressYearMonthParam(rawYearMonthParam));
        if (!hasInvalidMonth && !hasInvalidYearMonth) return;

        const next = new URLSearchParams(searchParams);
        if (hasInvalidMonth) next.delete('month');
        if (hasInvalidYearMonth) next.delete('yearMonth');
        if (next.toString() !== searchParams.toString()) {
            setSearchParams(next, { replace: true });
        }
    }, [rawMonthParam, rawYearMonthParam, searchParams, setSearchParams]);

    useEffect(() => {
        if (!querySiteId || querySiteId === selectedSiteId) return;
        setSelectedSiteId(querySiteId);
    }, [querySiteId, selectedSiteId]);

    const setActiveTab = useCallback((tab: TabKey) => {
        setLaborStatementPanel(null);
        setTransactionStatementPanel(null);
        setActiveTabState(tab);
        const next = new URLSearchParams(searchParams);
        next.set('tab', tab);
        setSearchParams(next, { replace: true });
    }, [searchParams, setSearchParams]);

    const setProgressPageSearchParam = useCallback((key: 'month' | 'siteId', value: string) => {
        const next = new URLSearchParams(searchParams);
        if (value) {
            next.set(key, value);
        } else {
            next.delete(key);
        }
        if (next.toString() !== searchParams.toString()) {
            setSearchParams(next, { replace: true });
        }
    }, [searchParams, setSearchParams]);

    const scrollToProgressSection = (sectionId: string) => {
        document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const loadData = async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const range = getMonthDateRange(yearMonth);
            const [contractRows, claimRows, targetRows, outputRows, workerRows, estimateRows] = await Promise.all([
                progressClaimService.getContracts(),
                progressClaimService.getClaims(),
                settlementTargetService.getTargets(true),
                dailyReportService.getReportWorkerRowsByRange(range),
                manpowerService.getWorkers(),
                estimateService.getEstimates(),
            ]);
            setContracts(contractRows);
            setClaims(claimRows);
            setTargets(targetRows);
            setDailyRows(outputRows);
            setWorkers(workerRows);
            setTransactionStatements(estimateRows.filter((statement) => statement.documentType === 'transaction'));
        } catch (error) {
            console.error('[ProgressClaimPage] load failed:', error);
            const message = '기성관리 데이터를 불러오지 못했습니다. 네트워크와 권한을 확인한 뒤 다시 시도하세요.';
            setLoadError(message);
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [yearMonth]);

    const fetchTransactionStatements = useCallback(async () => {
        setTransactionStatementsLoading(true);
        try {
            const statements = await estimateService.getEstimates();
            setTransactionStatements(statements.filter((statement) => statement.documentType === 'transaction'));
        } catch (error) {
            console.error('[ProgressClaimPage] transaction statements load failed:', error);
            setTransactionStatements([]);
        } finally {
            setTransactionStatementsLoading(false);
        }
    }, []);

    const contractBySiteId = useMemo(() => {
        const map = new Map<string, ProgressContract>();
        contracts.forEach((contract) => {
            if (contract.siteId) map.set(contract.siteId, contract);
        });
        return map;
    }, [contracts]);

    const claimBySiteMonth = useMemo(() => {
        const map = new Map<string, ProgressClaim>();
        claims.forEach((claim) => {
            if (claim.siteId && claim.yearMonth) map.set(`${claim.siteId}__${claim.yearMonth}`, claim);
        });
        return map;
    }, [claims]);

    const dailySummaries = useMemo(() =>
        summarizeDailyRowsForProgress(dailyRows, sites),
        [dailyRows, sites]
    );

    const dailySummaryBySiteId = useMemo(() => {
        const map = new Map<string, ReturnType<typeof summarizeDailyRowsForProgress>[number]>();
        dailySummaries.forEach((summary) => {
            if (summary.siteId) map.set(summary.siteId, summary);
        });
        return map;
    }, [dailySummaries]);

    const progressScopeSiteRows = useMemo(() => {
        const siteById = new Map<string, Site>();
        const masterSiteIds = new Set<string>();
        sites.forEach((site) => {
            const id = normalizeSiteId(site.id);
            if (id) {
                masterSiteIds.add(id);
                siteById.set(id, site);
            }
        });

        claims.forEach((claim) => {
            const siteId = normalizeSiteId(claim.siteId || claim.siteSnapshot?.siteId);
            if (siteId && !siteById.has(siteId)) siteById.set(siteId, makeSiteFromProgressClaim(claim));
        });

        const ids = new Set<string>();
        contracts.forEach((contract) => contract.siteId && ids.add(contract.siteId));
        dailySummaries.forEach((summary) => summary.siteId && ids.add(summary.siteId));

        const claimsBySiteId = new Map<string, ProgressClaim[]>();
        claims.forEach((claim) => {
            const siteId = normalizeSiteId(claim.siteId || claim.siteSnapshot?.siteId);
            if (!siteId) return;
            const siteClaims = claimsBySiteId.get(siteId) || [];
            siteClaims.push(claim);
            claimsBySiteId.set(siteId, siteClaims);
        });

        claimsBySiteId.forEach((siteClaims, siteId) => {
            const site = siteById.get(siteId) || makeSiteFromProgressClaim(siteClaims[0]);
            const claim = claimBySiteMonth.get(`${siteId}__${yearMonth}`) || makeDefaultClaim(site, yearMonth);
            const computed = calculateProgressClaimSummary(
                contractBySiteId.get(siteId),
                claims,
                claim,
                dailySummaryBySiteId.get(siteId),
                yearMonth
            );
            const hasCurrentClaim = siteClaims.some((item) => item.yearMonth === yearMonth);
            const hasPastClaim = siteClaims.some((item) => {
                const claimMonth = String(item.yearMonth || '');
                return Boolean(claimMonth) && claimMonth <= yearMonth;
            });
            const hasRemainingProgress = roundMoney(computed.summary.remainingAmount) !== 0;

            if (hasCurrentClaim || (hasPastClaim && hasRemainingProgress)) {
                ids.add(siteId);
                if (!siteById.has(siteId)) siteById.set(siteId, site);
            }
        });

        return Array.from(siteById.values())
            .filter((site) => {
                const id = normalizeSiteId(site.id);
                return (id && masterSiteIds.has(id) && siteMatchesProgressScope(site)) || (id && ids.has(id));
            })
            .sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? ''), 'ko'));
    }, [claimBySiteMonth, claims, contractBySiteId, contracts, dailySummaries, dailySummaryBySiteId, sites, yearMonth]);

    const siteRows = useMemo(() => {
        const query = searchTerm.trim().toLowerCase();
        if (!query) return progressScopeSiteRows;
        return progressScopeSiteRows.filter((site) => [
            site.name,
            site.address,
            site.responsibleTeamName,
            site.siteManagerName,
            site.clientCompanyName,
            site.companyName,
            site.constructorCompanyName,
            site.partnerName,
        ].join(' ').toLowerCase().includes(query));
    }, [progressScopeSiteRows, searchTerm]);

    const siteClientGroups = useMemo(() => {
        const map = new Map<string, { key: string; clientName: string; sites: Site[] }>();
        progressScopeSiteRows.forEach((site) => {
            const key = getProgressClientKey(site);
            const clientName = getProgressClientName(site);
            const group = map.get(key) || { key, clientName, sites: [] };
            group.sites.push(site);
            map.set(key, group);
        });

        return Array.from(map.values())
            .map((group) => ({
                ...group,
                sites: [...group.sites].sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? ''), 'ko')),
            }))
            .sort((a, b) => a.clientName.localeCompare(b.clientName, 'ko'));
    }, [progressScopeSiteRows]);

    const selectedSite = useMemo(
        () => progressScopeSiteRows.find((site) => normalizeSiteId(site.id) === selectedSiteId) || progressScopeSiteRows[0],
        [progressScopeSiteRows, selectedSiteId]
    );

    useEffect(() => {
        const fallbackSiteId = normalizeSiteId(progressScopeSiteRows[0]?.id);
        if (!fallbackSiteId) return;
        const selectedSiteExists = progressScopeSiteRows.some((site) => normalizeSiteId(site.id) === selectedSiteId);
        if (!selectedSiteId || !selectedSiteExists) {
            setSelectedSiteId(fallbackSiteId);
            setProgressPageSearchParam('siteId', fallbackSiteId);
        }
    }, [progressScopeSiteRows, selectedSiteId, setProgressPageSearchParam]);

    const selectedClientGroup = useMemo(() => {
        const selectedClientKey = selectedSite ? getProgressClientKey(selectedSite) : '';
        return siteClientGroups.find((group) => group.key === selectedClientKey) || siteClientGroups[0];
    }, [selectedSite, siteClientGroups]);

    const selectedClientSites = selectedClientGroup?.sites || progressScopeSiteRows;

    const activeAllocationTargets = useMemo(
        () => targets
            .filter((target) => target.status !== 'inactive' && target.targetType !== 'office_income')
            .sort((a, b) => {
                const rank = (target: SettlementTarget) => target.targetType === 'salesperson' ? 0 : target.targetType === 'client_contact' ? 1 : 2;
                return rank(a) - rank(b) || String(a.name || '').localeCompare(String(b.name || ''), 'ko');
            }),
        [targets]
    );

    useEffect(() => {
        if (!selectedSite) {
            setContractDraft(null);
            setClaimDraft(null);
            return;
        }

        const siteId = normalizeSiteId(selectedSite.id);
        const contract = contractBySiteId.get(siteId);
        const claim = claimBySiteMonth.get(`${siteId}__${yearMonth}`);

        setContractDraft(contract ? { ...contract, items: [...contract.items], commonAttachments: [...(contract.commonAttachments || [])] } : makeDefaultContract(selectedSite));
        setClaimDraft(claim
            ? {
                ...claim,
                progressLines: [...claim.progressLines],
                allocations: getEditableProgressAllocations(claim),
                claimAttachments: [...(claim.claimAttachments || [])],
            }
            : makeDefaultClaim(selectedSite, yearMonth));
    }, [claimBySiteMonth, contractBySiteId, selectedSite, yearMonth]);

    const selectedContract = contractDraft || (selectedSite ? makeDefaultContract(selectedSite) : undefined);
    const selectedClaim = claimDraft || (selectedSite ? makeDefaultClaim(selectedSite, yearMonth) : undefined);
    const buybackFinancialsLocked = selectedClaim?.status === 'confirmed' || selectedClaim?.status === 'billed' || selectedClaim?.status === 'paid';
    const selectedDailySummary = selectedSite?.id ? dailySummaryBySiteId.get(String(selectedSite.id)) : undefined;

    const dashboardClaims = useMemo(() => {
        const map = new Map<string, ProgressClaim>();
        claims.forEach((claim) => {
            if (claim.siteId && claim.yearMonth) map.set(`${claim.siteId}__${claim.yearMonth}`, claim);
        });
        if (selectedClaim?.siteId && selectedClaim.yearMonth) {
            map.set(`${selectedClaim.siteId}__${selectedClaim.yearMonth}`, selectedClaim);
        }
        return Array.from(map.values());
    }, [claims, selectedClaim]);

    const dashboardClaimBySiteMonth = useMemo(() => {
        const map = new Map<string, ProgressClaim>();
        dashboardClaims.forEach((claim) => {
            if (claim.siteId && claim.yearMonth) map.set(`${claim.siteId}__${claim.yearMonth}`, claim);
        });
        return map;
    }, [dashboardClaims]);

    const selectedComputed = useMemo(() => {
        if (!selectedContract || !selectedClaim) return null;
        return calculateProgressClaimSummary(
            selectedContract,
            claims,
            selectedClaim,
            selectedDailySummary,
            yearMonth
        );
    }, [claims, selectedClaim, selectedContract, selectedDailySummary, yearMonth]);

    const selectedBuybackSummary = useMemo<ProgressClaimSummary | null>(() => {
        const summary = selectedComputed?.summary;
        const snapshot = selectedClaim?.confirmedSnapshot;
        if (!summary || !buybackFinancialsLocked || !snapshot) return summary || null;
        return {
            ...summary,
            siteId: snapshot.site.siteId || summary.siteId,
            siteName: snapshot.site.siteName || summary.siteName,
            contractAmount: snapshot.contractAmount,
            previousAmount: snapshot.previousAmount,
            currentAmount: snapshot.currentAmount,
            cumulativeAmount: snapshot.cumulativeAmount,
            remainingAmount: snapshot.remainingAmount,
            totalManDay: snapshot.totalManDay,
            dailyAmount: snapshot.dailyAmount ?? summary.dailyAmount,
            dailyRowCount: snapshot.dailyRowCount ?? summary.dailyRowCount,
            sukumiUnitPrice: snapshot.sukumiUnitPrice,
            teamPositionMode: snapshot.teamPositionMode ?? summary.teamPositionMode,
            teamPositionManualAmount: snapshot.teamPositionManualAmount ?? summary.teamPositionManualAmount,
            buybackUnit: snapshot.buybackUnit ?? summary.buybackUnit,
            buybackTotalAmount: snapshot.buybackTotalAmount ?? summary.buybackTotalAmount,
            teamPositionUnit: snapshot.teamPositionUnit ?? summary.teamPositionUnit,
            teamPositionAmount: snapshot.teamPositionAmount ?? summary.teamPositionAmount,
            buybackPoolAmount: snapshot.buybackPoolAmount ?? summary.buybackPoolAmount,
            allocationBaseAmount: snapshot.allocationBaseAmount ?? summary.allocationBaseAmount,
            allocationAmount: snapshot.allocationAmount,
            allocationRemainAmount: snapshot.allocationRemainAmount ?? summary.allocationRemainAmount,
            supplyAmount: snapshot.supplyAmount,
            vatAmount: snapshot.vatAmount,
            billingAmount: snapshot.billingAmount,
        };
    }, [buybackFinancialsLocked, selectedClaim, selectedComputed]);

    const selectedBuybackAllocationRows = useMemo(() => {
        if (!selectedClaim) return [];
        if (!buybackFinancialsLocked || !selectedClaim.confirmedSnapshot) {
            return selectedComputed?.allocationRows || [];
        }
        const snapshot = selectedClaim.confirmedSnapshot;
        return calculateAllocations(
            getEditableProgressAllocations(selectedClaim),
            snapshot.allocationBaseAmount ?? selectedBuybackSummary?.allocationBaseAmount ?? 0,
            snapshot.totalManDay
        );
    }, [buybackFinancialsLocked, selectedBuybackSummary?.allocationBaseAmount, selectedClaim, selectedComputed]);

    const selectedBuybackSettlementTotals = useMemo(() => {
        const rows = selectedBuybackAllocationRows;
        return rows.reduce((totals, row) => {
            if (row.allocation.targetType === 'office_income') return totals;
            const target = targets.find((item) => item.id === (row.allocation.settlementTargetId || row.allocation.targetId));
            const settlement = calculateBuybackSettlement(row.amount, {
                settlementMode: row.allocation.settlementMode,
                afterTaxRate: row.allocation.afterTaxRate ?? (buybackFinancialsLocked ? DEFAULT_BUYBACK_AFTER_TAX_RATE : target?.defaultAfterTaxRate),
                manualAfterTaxAmount: row.allocation.manualAfterTaxAmount,
            });
            return {
                afterTax: totals.afterTax + settlement.afterTaxAmount,
                tax: totals.tax + settlement.taxAmount,
            };
        }, { afterTax: 0, tax: 0 });
    }, [buybackFinancialsLocked, selectedBuybackAllocationRows, targets]);

    const buybackSiteSources = useMemo<ProgressBuybackSiteSource[]>(() => {
        const currentSiteId = normalizeSiteId(selectedSite?.id || selectedSiteId);

        return selectedClientSites.map((site) => {
            const siteId = normalizeSiteId(site.id);
            const persistedClaim = claimBySiteMonth.get(`${siteId}__${yearMonth}`);
            const isSelectedSite = siteId === currentSiteId;
            const claim = isSelectedSite && selectedClaim
                ? selectedClaim
                : persistedClaim || makeDefaultClaim(site, yearMonth);
            const contract = contractBySiteId.get(siteId) || makeDefaultContract(site);
            const computed = isSelectedSite && selectedComputed
                ? selectedComputed
                : calculateProgressClaimSummary(
                    contract,
                    claims,
                    claim,
                    dailySummaryBySiteId.get(siteId),
                    yearMonth
                );
            const financialsLocked = claim.status === 'confirmed' || claim.status === 'billed' || claim.status === 'paid';
            const snapshot = financialsLocked ? claim.confirmedSnapshot : undefined;
            const totalManDay = snapshot?.totalManDay ?? computed.summary.totalManDay;
            const allocationBaseAmount = snapshot?.allocationBaseAmount ?? computed.summary.allocationBaseAmount;
            const allocationRows = calculateAllocations(
                getEditableProgressAllocations(claim),
                allocationBaseAmount,
                totalManDay
            );

            return {
                siteId,
                siteName: String(site.name || claim.siteName || '현장 미지정'),
                clientName: getProgressClientName(site),
                yearMonth,
                hasClaim: Boolean(persistedClaim),
                claimStatus: claim.status,
                financialsLocked,
                totalManDay,
                currentAmount: snapshot?.currentAmount ?? computed.summary.currentAmount,
                teamPositionAmount: snapshot?.teamPositionAmount ?? computed.summary.teamPositionAmount,
                buybackPoolAmount: snapshot?.buybackPoolAmount ?? computed.summary.buybackPoolAmount,
                allocationBaseAmount,
                allocationAmount: snapshot?.allocationAmount ?? computed.summary.allocationAmount,
                allocationRemainAmount: snapshot?.allocationRemainAmount ?? computed.summary.allocationRemainAmount,
                allocationRows,
            };
        });
    }, [
        claimBySiteMonth,
        claims,
        contractBySiteId,
        dailySummaryBySiteId,
        selectedClaim,
        selectedClientSites,
        selectedComputed,
        selectedSite,
        selectedSiteId,
        yearMonth,
    ]);

    const buybackSiteRows = useMemo(
        () => buildProgressBuybackSiteRows(buybackSiteSources, targets),
        [buybackSiteSources, targets]
    );

    const workerById = useMemo(() => {
        const map = new Map<string, Worker>();
        workers.forEach((worker) => {
            [worker.id, worker.legacyId].forEach((id) => {
                const key = normalizeSiteId(id);
                if (key && !map.has(key)) map.set(key, worker);
            });
        });
        return map;
    }, [workers]);

    const workerByName = useMemo(() => {
        const map = new Map<string, Worker>();
        workers.forEach((worker) => {
            const key = normalizeProgressIdentityKey(worker.name);
            if (key && !map.has(key)) map.set(key, worker);
        });
        return map;
    }, [workers]);

    const getProgressStatementPanelKey = useCallback((site: Site, statementYearMonth = yearMonth): string => {
        const siteKey = normalizeSiteId(site.id) || normalizeProgressIdentityKey(site.name) || 'unknown-site';
        return `progress-claims::${statementYearMonth}::site::${siteKey}`;
    }, [yearMonth]);

    const getProgressDailyRowsForSite = useCallback((site: Site): DailyReportWorkerRow[] => {
        const siteId = normalizeSiteId(site.id);
        const siteNameKey = normalizeProgressIdentityKey(site.name);

        return dailyRows.filter((row) => {
            if (row.isEmptyReport || toProgressNumber(row.manDay) <= 0) return false;
            const rowSiteId = normalizeSiteId(row.siteId);
            if (siteId && rowSiteId) return rowSiteId === siteId;
            return normalizeProgressIdentityKey(row.siteName) === siteNameKey;
        });
    }, [dailyRows]);

    const resolveProgressWorkerProfile = useCallback((row: DailyReportWorkerRow): Worker | undefined => {
        const workerId = normalizeSiteId(row.workerId);
        if (workerId && workerById.has(workerId)) return workerById.get(workerId);
        return workerByName.get(normalizeProgressIdentityKey(row.workerName || row.name));
    }, [workerById, workerByName]);

    const buildProgressSupportRows = useCallback((
        site: Site,
        summary: ProgressClaimSummary
    ): SupportClientSiteWorkerRow[] => {
        const siteId = normalizeSiteId(site.id);
        const clientCompanyName = getProgressClientName(site);
        const constructorCompanyId = normalizeSiteId(site.constructorCompanyId || site.companyId);
        const constructorCompanyName = getProgressDisplayText(site.constructorCompanyName, site.companyName, site.partnerName);
        const responsibleTeamId = normalizeSiteId(site.responsibleTeamId);
        const responsibleTeamName = getProgressDisplayText(site.responsibleTeamName, site.siteManagerName);

        return getProgressDailyRowsForSite(site).map((row, index) => {
            const workerProfile = resolveProgressWorkerProfile(row);
            const workerName = getProgressDisplayText(row.workerName, row.name, workerProfile?.name);
            const unitPrice = toProgressNumber(row.unitPrice || workerProfile?.unitPrice || summary.sukumiUnitPrice);
            const manDay = toProgressNumber(row.manDay);
            const amount = toProgressNumber(row.amount || manDay * unitPrice);
            const sourceTeamId = normalizeSiteId(row.workerTeamId || row.teamId || workerProfile?.teamId);
            const sourceTeamName = getProgressDisplayText(row.workerTeamName, row.teamName, workerProfile?.teamName);

            return {
                rowId: `progress-claim::${row.reportId || 'report'}::${row.workerIndex ?? index}::${row.workerId || workerName}`,
                reportId: row.reportId || '',
                date: row.date || `${yearMonth}-01`,
                direction: '본인현장출력',
                workerId: normalizeSiteId(row.workerId || workerProfile?.id || workerName),
                workerName,
                workerIdNumber: String(workerProfile?.idNumber || '').trim(),
                workerAddress: String(workerProfile?.address || row.siteAddress || site.address || '').trim(),
                workerContact: String(workerProfile?.contact || '').trim(),
                workerBankName: String(workerProfile?.bankName || '').trim(),
                workerAccountNumber: String(workerProfile?.accountNumber || '').trim(),
                workerAccountHolder: String(workerProfile?.accountHolder || '').trim(),
                workerLaborStatementPayType: getWorkerMasterLaborStatementPayType(workerProfile),
                role: row.role,
                manDay,
                unitPrice,
                amount,
                siteId: siteId || normalizeSiteId(row.siteId),
                siteName: getProgressDisplayText(site.name, row.siteName),
                siteAddress: String(site.address || row.siteAddress || '').trim(),
                siteType: getProgressDisplayText(row.siteType, site.siteType),
                paymentType: getProgressDisplayText(row.paymentType, site.paymentMethod),
                clientCompanyId: normalizeSiteId(site.clientCompanyId),
                clientCompanyName,
                constructorCompanyId,
                constructorCompanyName,
                sourceTeamId,
                sourceTeamName,
                workerTeamId: sourceTeamId,
                workerTeamName: sourceTeamName,
                responsibleTeamId,
                responsibleTeamName,
                responsibleTeamColor: '#475569',
                responsibleTeamIcon: 'fa-users',
                settlementName: clientCompanyName,
                counterpartyName: clientCompanyName,
                evidenceNote: '현장별 기성관리에서 생성',
            };
        });
    }, [getProgressDailyRowsForSite, resolveProgressWorkerProfile, yearMonth]);

    const buildProgressStatementTarget = useCallback((
        site: Site,
        summary: ProgressClaimSummary,
        claim: ProgressClaim,
        statementYearMonth = yearMonth
    ): SupportStatementTarget => {
        const rows = buildProgressSupportRows(site, summary);
        const vatRate = toProgressNumber(claim.vatRate || DEFAULT_PROGRESS_VAT_RATE);
        const estimateVatRate = vatRate > 1 ? vatRate : vatRate * 100;
        const supportAmount = rows.reduce((sum, row) => sum + toProgressNumber(row.amount), 0);
        const supplyAmount = Math.max(0, roundMoney(
            summary.supplyAmount ||
            summary.currentAmount ||
            summary.teamPositionAmount ||
            supportAmount ||
            summary.dailyAmount
        ));

        return {
            title: getProgressDisplayText(site.name, summary.siteName),
            subtitle: `${statementYearMonth} 기성청구 · ${getProgressClientName(site)}`,
            rows,
            expenseClaims: [],
            transactionAmountOverride: supplyAmount,
            transactionItemLabel: `${getProgressDisplayText(site.name, summary.siteName)} 기성청구`,
            transactionItemNote: [
                `${statementYearMonth} 기성청구`,
                `금회 ${formatProgressMoney(summary.currentAmount)}`,
                `청구 ${formatProgressMoney(summary.billingAmount)}`
            ].join(' / '),
            transactionIncludeVat: claim.vatMode !== 'none',
            transactionVatRate: estimateVatRate,
        };
    }, [buildProgressSupportRows, yearMonth]);

    const toggleLaborStatementPanel = useCallback((key: string, target: SupportStatementTarget) => {
        setTransactionStatementPanel(null);
        setLaborStatementPanel((prev) => prev ? null : { key, target });
    }, []);

    const closeLaborStatementPanel = useCallback(() => {
        setLaborStatementPanel(null);
    }, []);

    const toggleCombinedTransactionStatementPanel = useCallback((key: string, target: SupportStatementTarget, mode: SupportTransactionStatementMode = 'standard') => {
        setLaborStatementPanel(null);
        setTransactionStatementPanel((prev) => prev?.key === key ? null : { key, target, mode, yearMonth });
    }, [yearMonth]);

    const switchTransactionStatementMode = useCallback((mode: SupportTransactionStatementMode) => {
        setTransactionStatementPanel((prev) => prev ? { ...prev, mode } : prev);
    }, []);

    const closeTransactionStatementPanel = useCallback(() => {
        setTransactionStatementPanel(null);
    }, []);

    const getLinkedTransactionStatements = useCallback((
        key: string,
        mode?: SupportTransactionStatementMode,
        statementYearMonth = yearMonth
    ): Estimate[] =>
        transactionStatements.filter((statement) =>
            statement.documentType === 'transaction' &&
            statement.supportStatementKey === key &&
            statement.supportStatementYearMonth === statementYearMonth &&
            (!mode || (statement.estimateMode === 'rental' ? 'rental' : 'standard') === mode)
        ),
    [transactionStatements, yearMonth]);

    const entryAudit = useMemo(() => {
        const rows = selectedComputed?.itemRows || [];
        const lineById = new Map((claimDraft?.progressLines || []).map((line) => [line.itemId, line]));
        const issues: Array<{ itemId: string; label: string; message: string; severity: 'warning' | 'danger' }> = [];

        rows.forEach((row) => {
            const line = lineById.get(row.item.id) || row.line;
            const isExtra = row.source === 'extra';
            const included = isExtra || Boolean(lineById.get(row.item.id));
            const label = row.item.workName || row.item.category || '기성 항목';

            if (included && row.currentQuantity <= 0) {
                issues.push({ itemId: row.item.id, label, message: '금회수량이 0입니다.', severity: 'warning' });
            }
            if (included && row.item.unitPrice <= 0) {
                issues.push({ itemId: row.item.id, label, message: '단가가 0원입니다.', severity: 'danger' });
            }
            if (row.remainingAmount < 0) {
                issues.push({ itemId: row.item.id, label, message: '누계가 계약금액을 초과했습니다.', severity: 'danger' });
            }
            if (isExtra && !String(line?.workName || '').trim()) {
                issues.push({ itemId: row.item.id, label: '추가 기성', message: '추가 공종명이 비어 있습니다.', severity: 'warning' });
            }
        });

        const extraCount = rows.filter((row) => row.source === 'extra').length;
        const includedCount = rows.filter((row) => row.source === 'extra' || lineById.has(row.item.id)).length;
        const missingCount = rows.filter((row) => row.source !== 'extra' && !lineById.has(row.item.id)).length;
        const dangerCount = issues.filter((issue) => issue.severity === 'danger').length;

        return {
            extraCount,
            includedCount,
            missingCount,
            warningCount: issues.length,
            dangerCount,
            issues,
        };
    }, [claimDraft?.progressLines, selectedComputed]);

    const persistedContractForSelected = useMemo(() => {
        if (!selectedSite) return null;
        return contractBySiteId.get(normalizeSiteId(selectedSite.id)) || makeDefaultContract(selectedSite);
    }, [contractBySiteId, selectedSite]);

    const persistedClaimForSelected = useMemo(() => {
        if (!selectedSite) return null;
        const siteId = normalizeSiteId(selectedSite.id);
        return claimBySiteMonth.get(`${siteId}__${yearMonth}`) || makeDefaultClaim(selectedSite, yearMonth);
    }, [claimBySiteMonth, selectedSite, yearMonth]);

    const hasUnsavedContractChanges = useMemo(() => {
        if (!contractDraft || !persistedContractForSelected) return false;
        if (contractDraft.siteId !== persistedContractForSelected.siteId) return false;
        return serializeContractDraft(contractDraft) !== serializeContractDraft(persistedContractForSelected);
    }, [contractDraft, persistedContractForSelected]);

    const hasUnsavedClaimChanges = useMemo(() => {
        if (!claimDraft || !persistedClaimForSelected) return false;
        if (claimDraft.siteId !== persistedClaimForSelected.siteId || claimDraft.yearMonth !== persistedClaimForSelected.yearMonth) return false;
        const comparablePersistedClaim = {
            ...persistedClaimForSelected,
            allocations: getEditableProgressAllocations(persistedClaimForSelected),
        };
        return serializeClaimDraft(claimDraft) !== serializeClaimDraft(comparablePersistedClaim);
    }, [claimDraft, persistedClaimForSelected]);

    const hasUnsavedChanges = hasUnsavedContractChanges || hasUnsavedClaimChanges;

    useEffect(() => {
        if (!hasUnsavedChanges) return undefined;
        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = '';
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [hasUnsavedChanges]);

    const confirmDiscardDraft = useCallback((): boolean => {
        if (!hasUnsavedChanges) return true;
        return window.confirm('저장하지 않은 기성관리 입력값이 있습니다. 저장하지 않고 이동하시겠습니까?');
    }, [hasUnsavedChanges]);

    const requestSiteChange = useCallback((nextSiteId: string): boolean => {
        if (nextSiteId === selectedSiteId) return true;
        if (!confirmDiscardDraft()) return false;
        setSelectedSiteId(nextSiteId);
        setProgressPageSearchParam('siteId', nextSiteId);
        return true;
    }, [confirmDiscardDraft, selectedSiteId, setProgressPageSearchParam]);

    const requestClientChange = useCallback((nextClientKey: string): boolean => {
        const group = siteClientGroups.find((item) => item.key === nextClientKey);
        const nextSiteId = normalizeSiteId(group?.sites[0]?.id);
        if (!nextSiteId || nextSiteId === selectedSiteId) return true;
        if (!confirmDiscardDraft()) return false;
        setSelectedSiteId(nextSiteId);
        setProgressPageSearchParam('siteId', nextSiteId);
        return true;
    }, [confirmDiscardDraft, selectedSiteId, setProgressPageSearchParam, siteClientGroups]);

    const requestYearMonthChange = useCallback((nextYearMonth: string): boolean => {
        const normalizedYearMonth = normalizeProgressYearMonthParam(nextYearMonth);
        if (!normalizedYearMonth || normalizedYearMonth === yearMonth) return true;
        if (!confirmDiscardDraft()) return false;
        setYearMonth(normalizedYearMonth);
        setProgressPageSearchParam('month', normalizedYearMonth);
        return true;
    }, [confirmDiscardDraft, setProgressPageSearchParam, yearMonth]);

    const openBuybackWorkbookRow = useCallback((row: ProgressBuybackWorkbookRow) => {
        const nextSiteId = normalizeSiteId(row.siteId);
        const nextYearMonth = normalizeProgressYearMonthParam(row.yearMonth);
        if (!nextSiteId || !nextYearMonth) {
            toast.error('연결된 현장 또는 귀속월을 확인할 수 없습니다.');
            return;
        }
        if (!confirmDiscardDraft()) return;

        setSelectedSiteId(nextSiteId);
        setYearMonth(nextYearMonth);
        const next = new URLSearchParams(searchParams);
        next.set('tab', 'buyback');
        next.set('siteId', nextSiteId);
        next.set('month', nextYearMonth);
        setSearchParams(next, { replace: true });

        window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
                document.getElementById('progress-allocation-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        });
    }, [confirmDiscardDraft, searchParams, setSearchParams]);

    const reloadData = useCallback(() => {
        if (!confirmDiscardDraft()) return;
        void loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [confirmDiscardDraft]);

    const selectedSiteClaims = useMemo(() => {
        if (!selectedSite) return [];
        const siteId = normalizeSiteId(selectedSite.id);
        const map = new Map<string, ProgressClaim>();

        claims
            .filter((claim) => claim.siteId === siteId)
            .forEach((claim) => {
                if (claim.yearMonth) map.set(claim.yearMonth, claim);
            });

        if (selectedClaim?.siteId === siteId && selectedClaim.yearMonth) {
            map.set(selectedClaim.yearMonth, selectedClaim);
        }

        return Array.from(map.values()).sort((a, b) => String(a.yearMonth).localeCompare(String(b.yearMonth)));
    }, [claims, selectedClaim, selectedSite]);

    const selectedLedgerRows = useMemo(() => {
        if (!selectedContract) return [];
        return selectedSiteClaims.map((claim) => {
            const dailyFromSnapshot: ProgressDailyManDaySummary | undefined = claim.confirmedSnapshot
                ? {
                    siteId: claim.siteId,
                    siteName: claim.siteName,
                    siteType: claim.siteSnapshot?.siteType || '',
                    manDay: claim.confirmedSnapshot.totalManDay,
                    amount: claim.confirmedSnapshot.currentAmount,
                    rowCount: 0,
                }
                : undefined;
            const daily = claim.yearMonth === yearMonth ? selectedDailySummary : dailyFromSnapshot;
            const computed = calculateProgressClaimSummary(selectedContract, selectedSiteClaims, claim, daily, claim.yearMonth);
            return { claim, ...computed };
        });
    }, [selectedContract, selectedDailySummary, selectedSiteClaims, yearMonth]);

    const selectedTransactionLedgerRows = useMemo(() => {
        if (!selectedSite) return [];

        return selectedLedgerRows.map((row) => {
            const statementYearMonth = row.claim.yearMonth;
            const panelKey = getProgressStatementPanelKey(selectedSite, statementYearMonth);
            const target = buildProgressStatementTarget(selectedSite, row.summary, row.claim, statementYearMonth);
            const standardStatements = getLinkedTransactionStatements(panelKey, 'standard', statementYearMonth);
            const rentalStatements = getLinkedTransactionStatements(panelKey, 'rental', statementYearMonth);
            const allStatementsForMonth = [...standardStatements, ...rentalStatements].sort((a, b) =>
                getProgressTimeValue(b.updatedAt || b.issueDate) - getProgressTimeValue(a.updatedAt || a.issueDate)
            );
            const sumStatements = (statements: Estimate[], field: 'subtotal' | 'tax' | 'total') =>
                statements.reduce((sum, statement) => sum + roundMoney(statement[field] || 0), 0);

            return {
                ...row,
                yearMonth: statementYearMonth,
                panelKey,
                target,
                standardStatements,
                rentalStatements,
                standardSupplyAmount: sumStatements(standardStatements, 'subtotal'),
                standardTaxAmount: sumStatements(standardStatements, 'tax'),
                standardTotalAmount: sumStatements(standardStatements, 'total'),
                rentalSupplyAmount: sumStatements(rentalStatements, 'subtotal'),
                rentalTaxAmount: sumStatements(rentalStatements, 'tax'),
                rentalTotalAmount: sumStatements(rentalStatements, 'total'),
                latestStatement: allStatementsForMonth[0],
            };
        });
    }, [
        buildProgressStatementTarget,
        getLinkedTransactionStatements,
        getProgressStatementPanelKey,
        selectedLedgerRows,
        selectedSite,
    ]);

    const openTransactionLedgerStatement = useCallback((
        row: (typeof selectedTransactionLedgerRows)[number],
        mode: SupportTransactionStatementMode
    ) => {
        if (!selectedSite || !confirmDiscardDraft()) return;
        setSelectedSiteId(normalizeSiteId(selectedSite.id));
        setYearMonth(row.yearMonth);
        setLaborStatementPanel(null);
        setTransactionStatementPanel({
            key: row.panelKey,
            target: row.target,
            mode,
            yearMonth: row.yearMonth,
        });
    }, [confirmDiscardDraft, selectedSite]);

    const overviewRows = useMemo(() => {
        return siteRows.map((site) => {
            const siteId = normalizeSiteId(site.id);
            const contract = contractBySiteId.get(siteId) || makeDefaultContract(site);
            const claim = claimBySiteMonth.get(`${siteId}__${yearMonth}`) || makeDefaultClaim(site, yearMonth);
            const daily = dailySummaryBySiteId.get(siteId);
            const computed = calculateProgressClaimSummary(contract, claims, claim, daily, yearMonth);
            return { site, contract, claim, ...computed };
        });
    }, [claimBySiteMonth, claims, contractBySiteId, dailySummaryBySiteId, siteRows, yearMonth]);

    const overviewClientGroups = useMemo(() => {
        const map = new Map<string, {
            key: string;
            clientName: string;
            rows: typeof overviewRows;
            totals: {
                contractAmount: number;
                previousAmount: number;
                currentAmount: number;
                cumulativeAmount: number;
                remainingAmount: number;
                manDay: number;
            };
        }>();

        overviewRows.forEach((row) => {
            const key = getProgressClientKey(row.site);
            const clientName = getProgressClientName(row.site);
            const group = map.get(key) || {
                key,
                clientName,
                rows: [],
                totals: {
                    contractAmount: 0,
                    previousAmount: 0,
                    currentAmount: 0,
                    cumulativeAmount: 0,
                    remainingAmount: 0,
                    manDay: 0,
                },
            };

            group.rows.push(row);
            group.totals.contractAmount += row.summary.contractAmount;
            group.totals.previousAmount += row.summary.previousAmount;
            group.totals.currentAmount += row.summary.currentAmount;
            group.totals.cumulativeAmount += row.summary.cumulativeAmount;
            group.totals.remainingAmount += row.summary.remainingAmount;
            group.totals.manDay += row.summary.totalManDay;
            map.set(key, group);
        });

        return Array.from(map.values())
            .map((group) => ({
                ...group,
                rows: [...group.rows].sort((a, b) => String(a.site.name ?? '').localeCompare(String(b.site.name ?? ''), 'ko')),
            }))
            .sort((a, b) => a.clientName.localeCompare(b.clientName, 'ko'));
    }, [overviewRows]);

    useEffect(() => {
        if (overviewClientGroups.length === 0) {
            if (selectedOverviewClientKey) setSelectedOverviewClientKey('');
            return;
        }
        if (!overviewClientGroups.some((group) => group.key === selectedOverviewClientKey)) {
            setSelectedOverviewClientKey(overviewClientGroups[0].key);
        }
    }, [overviewClientGroups, selectedOverviewClientKey]);

    const selectedOverviewClientGroup = useMemo(
        () => overviewClientGroups.find((group) => group.key === selectedOverviewClientKey) || overviewClientGroups[0],
        [overviewClientGroups, selectedOverviewClientKey]
    );

    const totals = useMemo(() => ({
        contractAmount: overviewRows.reduce((sum, row) => sum + row.summary.contractAmount, 0),
        previousAmount: overviewRows.reduce((sum, row) => sum + row.summary.previousAmount, 0),
        currentAmount: overviewRows.reduce((sum, row) => sum + row.summary.currentAmount, 0),
        cumulativeAmount: overviewRows.reduce((sum, row) => sum + row.summary.cumulativeAmount, 0),
        remainingAmount: overviewRows.reduce((sum, row) => sum + row.summary.remainingAmount, 0),
        manDay: overviewRows.reduce((sum, row) => sum + row.summary.totalManDay, 0),
    }), [overviewRows]);

    const dashboardMonths = useMemo(() => {
        const selectedYear = /^\d{4}-\d{2}$/.test(yearMonth)
            ? Number(yearMonth.slice(0, 4))
            : new Date().getFullYear();

        return Array.from({ length: 12 }, (_, index) => {
            const month = String(index + 1).padStart(2, '0');
            return `${selectedYear}-${month}`;
        });
    }, [yearMonth]);

    const progressDashboard = useMemo(() => {
        const bucketTotals = new Map<string, number>();
        const monthBuckets = new Map<string, Map<string, number>>();

        const monthlyRows: ProgressDashboardChartRow[] = dashboardMonths.map((month) => {
            const row: ProgressDashboardChartRow = {
                month,
                label: `${Number(month.slice(5, 7))}월`,
                contractAmount: 0,
                currentAmount: 0,
                cumulativeAmount: 0,
                remainingAmount: 0,
                progressRate: 0,
                manDay: 0,
            };
            const buckets = new Map<string, number>();

            progressScopeSiteRows.forEach((site) => {
                const siteId = normalizeSiteId(site.id);
                if (!siteId) return;

                const claim = dashboardClaimBySiteMonth.get(`${siteId}__${month}`) || makeDefaultClaim(site, month);
                const contract = contractBySiteId.get(siteId) || makeDefaultContract(site);
                const dailyFromSnapshot: ProgressDailyManDaySummary | undefined = claim.confirmedSnapshot
                    ? {
                        siteId: claim.siteId,
                        siteName: claim.siteName,
                        siteType: claim.siteSnapshot?.siteType || '',
                        manDay: claim.confirmedSnapshot.totalManDay,
                        amount: claim.confirmedSnapshot.currentAmount,
                        rowCount: 0,
                    }
                    : undefined;
                const daily = month === yearMonth ? dailySummaryBySiteId.get(siteId) : dailyFromSnapshot;
                const computed = calculateProgressClaimSummary(contract, dashboardClaims, claim, daily, month);

                row.contractAmount += computed.summary.contractAmount;
                row.currentAmount += computed.summary.currentAmount;
                row.cumulativeAmount += computed.summary.cumulativeAmount;
                row.remainingAmount += computed.summary.remainingAmount;
                row.manDay += computed.summary.totalManDay;

                computed.itemRows.forEach((itemRow) => {
                    if (itemRow.currentAmount === 0) return;
                    const bucket = getProgressItemBucket(itemRow.item.workType, itemRow.item.category, itemRow.item.workName);
                    buckets.set(bucket, (buckets.get(bucket) || 0) + itemRow.currentAmount);
                    bucketTotals.set(bucket, (bucketTotals.get(bucket) || 0) + itemRow.currentAmount);
                });
            });

            row.progressRate = row.contractAmount > 0
                ? Math.round((row.cumulativeAmount / row.contractAmount * 100) * 10) / 10
                : 0;
            monthBuckets.set(month, buckets);
            return row;
        });

        const bucketKeys = Array.from(bucketTotals.keys());
        const priorityKeys = PROGRESS_ITEM_BUCKET_PRIORITY.filter((key) => bucketTotals.has(key));
        const extraKeys = bucketKeys
            .filter((key) => !priorityKeys.includes(key))
            .sort((a, b) => (bucketTotals.get(b) || 0) - (bucketTotals.get(a) || 0));
        const mainItemKeys = [...priorityKeys, ...extraKeys].slice(0, 6);
        const overflowKeys = bucketKeys.filter((key) => !mainItemKeys.includes(key));
        const itemKeys = overflowKeys.length > 0 ? [...mainItemKeys, '기타'] : mainItemKeys;

        monthlyRows.forEach((row) => {
            const buckets = monthBuckets.get(row.month) || new Map<string, number>();
            mainItemKeys.forEach((key) => {
                row[key] = buckets.get(key) || 0;
            });
            if (overflowKeys.length > 0) {
                row['기타'] = overflowKeys.reduce((sum, key) => sum + (buckets.get(key) || 0), 0);
            }
        });

        return { monthlyRows, itemKeys };
    }, [
        contractBySiteId,
        dailySummaryBySiteId,
        dashboardClaimBySiteMonth,
        dashboardClaims,
        dashboardMonths,
        progressScopeSiteRows,
        yearMonth,
    ]);

    const selectedClientSiteChartRows = useMemo(() => {
        const rows = selectedOverviewClientGroup?.rows || overviewRows;
        return rows
            .map((row) => ({
                name: String(row.site.name || row.summary.siteName || '-'),
                금회기성: row.summary.currentAmount,
                누계기성: row.summary.cumulativeAmount,
                잔여기성: row.summary.remainingAmount,
                기성률: row.summary.contractAmount > 0
                    ? Math.round((row.summary.cumulativeAmount / row.summary.contractAmount) * 1000) / 10
                    : 0,
            }))
            .sort((a, b) => b.금회기성 - a.금회기성)
            .slice(0, 8);
    }, [overviewRows, selectedOverviewClientGroup]);

    const selectedSiteDashboardRows = useMemo(() => {
        if (!selectedSite) return [];
        const siteId = normalizeSiteId(selectedSite.id);
        if (!siteId) return [];
        const contract = contractBySiteId.get(siteId) || makeDefaultContract(selectedSite);

        return dashboardMonths.map((month) => {
            const claim = dashboardClaimBySiteMonth.get(`${siteId}__${month}`) || makeDefaultClaim(selectedSite, month);
            const dailyFromSnapshot: ProgressDailyManDaySummary | undefined = claim.confirmedSnapshot
                ? {
                    siteId: claim.siteId,
                    siteName: claim.siteName,
                    siteType: claim.siteSnapshot?.siteType || '',
                    manDay: claim.confirmedSnapshot.totalManDay,
                    amount: claim.confirmedSnapshot.currentAmount,
                    rowCount: 0,
                }
                : undefined;
            const daily = month === yearMonth ? dailySummaryBySiteId.get(siteId) : dailyFromSnapshot;
            const computed = calculateProgressClaimSummary(contract, dashboardClaims, claim, daily, month);
            const progressRate = computed.summary.contractAmount > 0
                ? computed.summary.cumulativeAmount / computed.summary.contractAmount * 100
                : 0;

            return {
                month,
                label: `${Number(month.slice(5, 7))}월`,
                currentAmount: computed.summary.currentAmount,
                cumulativeAmount: computed.summary.cumulativeAmount,
                remainingAmount: computed.summary.remainingAmount,
                progressRate: Math.round(progressRate * 10) / 10,
            };
        });
    }, [
        contractBySiteId,
        dailySummaryBySiteId,
        dashboardClaimBySiteMonth,
        dashboardClaims,
        dashboardMonths,
        selectedSite,
        yearMonth,
    ]);

    const selectedSiteProgressSummary = useMemo(() => {
        const siteId = normalizeSiteId(selectedSite?.id);
        if (!siteId) return null;
        const row = overviewRows.find((item) => normalizeSiteId(item.site.id) === siteId);
        if (!row) return null;
        const progressRate = row.summary.contractAmount > 0
            ? row.summary.cumulativeAmount / row.summary.contractAmount * 100
            : 0;
        return { row, progressRate };
    }, [overviewRows, selectedSite]);

    const selectedClientSiteMonthlyRows = useMemo(() => {
        const rows = selectedOverviewClientGroup?.rows || [];

        return rows.flatMap((overviewRow) => {
            const site = overviewRow.site;
            const siteId = normalizeSiteId(site.id);
            if (!siteId) return [];
            const contract = contractBySiteId.get(siteId) || makeDefaultContract(site);

            return dashboardMonths.map((month) => {
                const claim = dashboardClaimBySiteMonth.get(`${siteId}__${month}`) || makeDefaultClaim(site, month);
                const dailyFromSnapshot: ProgressDailyManDaySummary | undefined = claim.confirmedSnapshot
                    ? {
                        siteId: claim.siteId,
                        siteName: claim.siteName,
                        siteType: claim.siteSnapshot?.siteType || '',
                        manDay: claim.confirmedSnapshot.totalManDay,
                        amount: claim.confirmedSnapshot.currentAmount,
                        rowCount: 0,
                    }
                    : undefined;
                const daily = month === yearMonth ? dailySummaryBySiteId.get(siteId) : dailyFromSnapshot;
                const computed = calculateProgressClaimSummary(contract, dashboardClaims, claim, daily, month);
                const progressRate = computed.summary.contractAmount > 0
                    ? computed.summary.cumulativeAmount / computed.summary.contractAmount * 100
                    : 0;

                return {
                    siteId,
                    siteName: String(site.name || computed.summary.siteName || '-'),
                    month,
                    label: `${Number(month.slice(5, 7))}월`,
                    contractAmount: computed.summary.contractAmount,
                    currentAmount: computed.summary.currentAmount,
                    cumulativeAmount: computed.summary.cumulativeAmount,
                    remainingAmount: computed.summary.remainingAmount,
                    progressRate: Math.round(progressRate * 10) / 10,
                    status: claim.status,
                };
            });
        });
    }, [
        contractBySiteId,
        dailySummaryBySiteId,
        dashboardClaimBySiteMonth,
        dashboardClaims,
        dashboardMonths,
        selectedOverviewClientGroup,
        yearMonth,
    ]);

    const setContractItem = (index: number, patch: Partial<ProgressContractItem>) => {
        setContractDraft((current) => {
            if (!current) return current;
            const items = current.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item);
            return { ...current, items };
        });
    };

    const addContractItem = () => {
        setContractDraft((current) => {
            if (!current) return current;
            const next: ProgressContractItem = {
                id: makeProgressId('item'),
                category: '',
                workName: '',
                workType: '',
                contractQuantity: 0,
                unit: '㎡',
                unitPrice: 0,
                remark: '',
                active: true,
            };
            return { ...current, items: [...current.items, next] };
        });
    };

    const removeContractItem = (id: string) => {
        const siteId = selectedContract?.siteId || (selectedSite ? normalizeSiteId(selectedSite.id) : '');
        const hasProgressHistory =
            claims.some((claim) => claim.siteId === siteId && getLineQuantity(claim.progressLines, id) !== 0) ||
            getLineQuantity(claimDraft?.progressLines, id) !== 0;

        if (hasProgressHistory) {
            if (!window.confirm('이미 기성수량 이력이 있는 계약내역입니다. 과거 대장 보존을 위해 삭제 대신 비활성화하시겠습니까?')) return;
            setContractDraft((current) => current
                ? { ...current, items: current.items.map((item) => item.id === id ? { ...item, active: false } : item) }
                : current
            );
            return;
        }

        if (!window.confirm('계약내역 행을 삭제하시겠습니까?')) return;
        setContractDraft((current) => current ? { ...current, items: current.items.filter((item) => item.id !== id) } : current);
    };

    const setProgressLineIncluded = (itemId: string, included: boolean) => {
        setClaimDraft((current) => {
            if (!current) return current;
            const nextLines = current.progressLines.filter((line) => line.itemId !== itemId);
            if (!included) return { ...current, progressLines: nextLines };
            const existing = current.progressLines.find((line) => line.itemId === itemId);
            if (existing) return current;
            return {
                ...current,
                progressLines: [...nextLines, { itemId, source: 'contract' as const, currentQuantity: 0 }],
            };
        });
    };

    const updateProgressLine = (itemId: string, value: string) => {
        setClaimDraft((current) => {
            if (!current) return current;
            const quantity = toProgressNumber(value);
            const existing = current.progressLines.find((line) => line.itemId === itemId);
            const nextLines = existing
                ? current.progressLines.map((line) => line.itemId === itemId ? { ...line, currentQuantity: quantity } : line)
                : [...current.progressLines, { itemId, source: 'contract' as const, currentQuantity: quantity }];
            return { ...current, progressLines: nextLines };
        });
    };

    const addExtraProgressLine = () => {
        setClaimDraft((current) => {
            if (!current) return current;
            const next: ProgressClaimLine = {
                itemId: makeProgressId('extra'),
                source: 'extra',
                category: '추가',
                workName: '',
                workType: '추가',
                contractQuantity: 0,
                unit: '식',
                unitPrice: 0,
                currentQuantity: 0,
                memo: '',
            };
            return { ...current, progressLines: [...current.progressLines, next] };
        });
    };

    const addExtraProgressLineAndOpen = () => {
        addExtraProgressLine();
        setEntryFilter('extra');
        window.setTimeout(() => scrollToProgressSection('progress-monthly-section'), 0);
    };

    const updateExtraProgressLine = (itemId: string, patch: Partial<ProgressClaimLine>) => {
        const sourceRow = selectedComputed?.itemRows.find((row) => row.source === 'extra' && row.item.id === itemId);
        const sourceLine = sourceRow?.line;
        const fallbackLine: ProgressClaimLine = {
            itemId,
            source: 'extra',
            category: sourceLine?.category ?? sourceRow?.item.category ?? '추가',
            workName: sourceLine?.workName ?? sourceRow?.item.workName ?? '',
            workType: sourceLine?.workType ?? sourceRow?.item.workType ?? '추가',
            contractQuantity: sourceLine?.contractQuantity ?? sourceRow?.item.contractQuantity ?? 0,
            unit: sourceLine?.unit ?? sourceRow?.item.unit ?? '식',
            unitPrice: sourceLine?.unitPrice ?? sourceRow?.item.unitPrice ?? 0,
            currentQuantity: 0,
            memo: sourceLine?.memo ?? sourceRow?.item.remark ?? '',
        };

        setClaimDraft((current) => {
            if (!current) return current;
            const existing = current.progressLines.find((line) => line.itemId === itemId);
            if (existing) {
                return {
                    ...current,
                    progressLines: current.progressLines.map((line) =>
                        line.itemId === itemId
                            ? { ...fallbackLine, ...line, source: 'extra', ...patch }
                            : line
                    ),
                };
            }
            return {
                ...current,
                progressLines: [
                    ...current.progressLines,
                    {
                        ...fallbackLine,
                        ...patch,
                    },
                ],
            };
        });
    };

    const removeExtraProgressLine = (itemId: string) => {
        if (!window.confirm('추가 기성 행을 삭제하시겠습니까?')) return;
        setClaimDraft((current) => current
            ? { ...current, progressLines: current.progressLines.filter((line) => line.itemId !== itemId) }
            : current
        );
    };

    const saveContract = async (silent = false): Promise<ProgressContract | null> => {
        if (!contractDraft || !selectedSite) return null;
        setSaving(true);
        try {
            const payload: ProgressContract = {
                ...contractDraft,
                siteId: normalizeSiteId(selectedSite.id),
                siteName: String(selectedSite.name ?? '').trim(),
                items: contractDraft.items.map((item) => ({
                    ...item,
                    contractQuantity: toProgressNumber(item.contractQuantity),
                    unitPrice: toProgressNumber(item.unitPrice),
                    active: item.active !== false,
                })),
            };
            const id = await progressClaimService.saveContract(payload);
            const saved = { ...payload, id };
            setContractDraft(saved);
            setContracts((current) => {
                const exists = current.some((item) => item.id === id || item.siteId === saved.siteId);
                return exists ? current.map((item) => (item.id === id || item.siteId === saved.siteId ? saved : item)) : [...current, saved];
            });
            if (!silent) toast.success('계약내역을 저장했습니다.');
            return saved;
        } catch (error) {
            console.error('[ProgressClaimPage] contract save failed:', error);
            toast.error('계약내역 저장 중 오류가 발생했습니다.');
            return null;
        } finally {
            setSaving(false);
        }
    };

    const materializeBuybackAllocations = (allocations: ProgressAllocation[]): ProgressAllocation[] =>
        allocations.map((allocation) => {
            const isOfficeIncome = allocation.targetType === 'office_income' || allocation.targetId === OFFICE_INCOME_TARGET_ID;
            const target = isOfficeIncome
                ? undefined
                : targets.find((item) => item.id === (allocation.settlementTargetId || allocation.targetId));
            return {
                ...allocation,
                ...(target ? {
                    settlementTargetId: target.id,
                    targetId: target.id,
                    targetName: target.name,
                    targetType: target.targetType,
                    companyName: target.companyName || allocation.companyName,
                } : {}),
                settlementMode: allocation.settlementMode || 'rate',
                afterTaxRate: normalizeBuybackAfterTaxRate(
                    allocation.afterTaxRate ?? (isOfficeIncome
                        ? 1
                        : buybackFinancialsLocked
                            ? DEFAULT_BUYBACK_AFTER_TAX_RATE
                            : target?.defaultAfterTaxRate)
                ),
                paymentStatus: allocation.paymentStatus || 'pending',
                evidenceRequired: allocation.evidenceRequired ?? (buybackFinancialsLocked ? false : Boolean(target?.evidenceRequired)),
                evidenceStatus: (allocation.evidenceRequired || (!buybackFinancialsLocked && target?.evidenceRequired)) && allocation.evidenceStatus === 'not_required'
                    ? 'pending'
                    : allocation.evidenceStatus || (buybackFinancialsLocked
                        ? 'not_required'
                        : target?.evidenceRequired ? 'pending' : 'not_required'),
            };
        });

    const validateBuybackIntegrity = (): boolean => {
        const allocations = claimDraft?.allocations || [];
        const directoryTargetIds = new Set(
            targets.map((target) => target.id).filter((id): id is string => Boolean(id))
        );
        const unlinked = allocations.filter((allocation) => {
            const isOfficeIncome = allocation.targetType === 'office_income' || allocation.targetId === OFFICE_INCOME_TARGET_ID;
            if (isOfficeIncome) return false;
            const targetId = allocation.settlementTargetId || allocation.targetId;
            return !targetId || !directoryTargetIds.has(targetId);
        });
        const financialRows = buybackFinancialsLocked ? [] : selectedComputed?.allocationRows || [];
        const negative = financialRows.filter((row) => row.amount < 0);
        const invalidManualAfterTax = financialRows.filter((row) => {
            if ((row.allocation.settlementMode || 'rate') !== 'manual') return false;
            const manualAmount = toProgressNumber(row.allocation.manualAfterTaxAmount);
            return manualAmount < 0 || manualAmount > row.amount;
        });
        const remainAmount = buybackFinancialsLocked ? 0 : selectedComputed?.summary.allocationRemainAmount || 0;
        const missingOverrideReason = buybackFinancialsLocked ? [] : allocations.filter((allocation) => {
            const isOfficeIncome = allocation.targetType === 'office_income' || allocation.targetId === OFFICE_INCOME_TARGET_ID;
            if (isOfficeIncome) return false;
            const target = targets.find((item) => item.id === (allocation.settlementTargetId || allocation.targetId));
            const defaultRate = target?.defaultAfterTaxRate ?? DEFAULT_BUYBACK_AFTER_TAX_RATE;
            const effectiveMode = allocation.settlementMode || 'rate';
            const isOverride = effectiveMode !== 'rate' || Math.abs((allocation.afterTaxRate ?? defaultRate) - defaultRate) > 0.000001;
            return isOverride && !String(allocation.memo || '').trim();
        });
        const missingRequiredEvidence = allocations.filter((allocation) => {
            const target = targets.find((item) => item.id === (allocation.settlementTargetId || allocation.targetId));
            const evidenceRequired = allocation.evidenceRequired ?? (buybackFinancialsLocked ? false : Boolean(target?.evidenceRequired));
            const hasRecordedPayment = allocation.paymentStatus === 'partial' || allocation.paymentStatus === 'paid' || allocation.paymentStatus === 'overpaid';
            return evidenceRequired && hasRecordedPayment && allocation.evidenceStatus !== 'received';
        });
        const invalidPaymentAmounts = selectedBuybackAllocationRows.filter((row) => {
            if (row.allocation.targetType === 'office_income' || row.allocation.targetId === OFFICE_INCOME_TARGET_ID) return false;
            const target = targets.find((item) => item.id === (row.allocation.settlementTargetId || row.allocation.targetId));
            const settlement = calculateBuybackSettlement(row.amount, {
                settlementMode: row.allocation.settlementMode,
                afterTaxRate: row.allocation.afterTaxRate ?? (buybackFinancialsLocked ? DEFAULT_BUYBACK_AFTER_TAX_RATE : target?.defaultAfterTaxRate),
                manualAfterTaxAmount: row.allocation.manualAfterTaxAmount,
            });
            const paidAmount = row.allocation.paidAmount ?? (row.allocation.paymentStatus === 'paid' ? settlement.afterTaxAmount : 0);
            if (row.allocation.paymentStatus === 'partial') {
                return paidAmount <= 0 || paidAmount >= settlement.afterTaxAmount;
            }
            if (row.allocation.paymentStatus === 'overpaid') {
                return paidAmount <= settlement.afterTaxAmount;
            }
            if (row.allocation.paymentStatus === 'paid') {
                return paidAmount !== settlement.afterTaxAmount;
            }
            return paidAmount !== 0;
        });

        if (unlinked.length > 0) {
            toast.error(`정산대상자 원본과 연결되지 않은 배분 ${unlinked.length}건을 확인해 주세요.`);
            return false;
        }
        if (negative.length > 0) {
            toast.error('바이백 배분금액은 음수로 저장할 수 없습니다. 조정·이관 내역은 별도 조정 원장으로 등록해 주세요.');
            return false;
        }
        if (invalidManualAfterTax.length > 0) {
            toast.error(`세후 직접입력 금액이 세전 범위를 벗어난 배분 ${invalidManualAfterTax.length}건을 확인해 주세요.`);
            return false;
        }
        if (remainAmount < 0) {
            toast.error(`배분합계가 기준금액을 ${formatProgressMoney(Math.abs(remainAmount))}원 초과했습니다.`);
            return false;
        }
        if (missingOverrideReason.length > 0) {
            toast.error(`기본 세후율과 다른 정산 ${missingOverrideReason.length}건은 비고/수기공식에 변경 사유를 입력해 주세요.`);
            return false;
        }
        if (missingRequiredEvidence.length > 0) {
            toast.error(`증빙 필수 대상 중 입금 처리 전에 증빙 확인이 필요한 배분 ${missingRequiredEvidence.length}건이 있습니다.`);
            return false;
        }
        if (invalidPaymentAmounts.length > 0) {
            toast.error(`부분입금·입금완료·과입금 상태와 실입금액이 맞지 않는 배분 ${invalidPaymentAmounts.length}건을 확인해 주세요.`);
            return false;
        }
        return true;
    };

    const saveClaim = async (patch?: Partial<ProgressClaim>, silent = false): Promise<ProgressClaim | null> => {
        if (!claimDraft || !selectedSite) return null;
        const nextStatus = patch?.status ?? claimDraft.status;
        const nextSnapshot = patch?.confirmedSnapshot ?? claimDraft.confirmedSnapshot;
        if ((nextStatus === 'billed' || nextStatus === 'paid') && !nextSnapshot) {
            toast.error('발행후·입금완료 상태로 변경하려면 먼저 기성청구서를 확정해 주세요.');
            return null;
        }
        if ((nextStatus === 'confirmed' || nextStatus === 'billed' || nextStatus === 'paid') && !validateBuybackIntegrity()) {
            return null;
        }
        setSaving(true);
        try {
            const payload: ProgressClaim = {
                ...claimDraft,
                ...patch,
                siteId: normalizeSiteId(selectedSite.id),
                siteName: String(selectedSite.name ?? '').trim(),
                yearMonth,
                siteSnapshot: buildProgressSiteSnapshot(selectedSite, claimDraft.siteSnapshot),
                distributionBaseAmount: patch?.distributionBaseAmount ?? claimDraft.distributionBaseAmount ?? selectedComputed?.summary.allocationBaseAmount ?? 0,
            };
            const id = await progressClaimService.saveClaim(payload);
            const saved = { ...payload, id };
            setClaimDraft(saved);
            setClaims((current) => {
                const exists = current.some((item) => item.id === id || (item.siteId === saved.siteId && item.yearMonth === saved.yearMonth));
                return exists
                    ? current.map((item) => (item.id === id || (item.siteId === saved.siteId && item.yearMonth === saved.yearMonth) ? saved : item))
                    : [...current, saved];
            });
            if (!silent) toast.success('월별 기성자료를 저장했습니다.');
            return saved;
        } catch (error) {
            console.error('[ProgressClaimPage] claim save failed:', error);
            toast.error('월별 기성자료 저장 중 오류가 발생했습니다.');
            return null;
        } finally {
            setSaving(false);
        }
    };

    const saveEntryDrafts = async () => {
        if (!hasUnsavedContractChanges && !hasUnsavedClaimChanges) {
            toast.info('저장할 변경사항이 없습니다.');
            return;
        }
        const savedContract = hasUnsavedContractChanges ? await saveContract(true) : selectedContract || null;
        if (hasUnsavedContractChanges && !savedContract) return;
        const savedClaim = hasUnsavedClaimChanges ? await saveClaim(undefined, true) : selectedClaim || null;
        if (hasUnsavedClaimChanges && !savedClaim) return;
        toast.success('계약/기성 입력값을 저장했습니다.');
    };

    const resetEntryDrafts = () => {
        if (!window.confirm('저장하지 않은 변경사항을 되돌리시겠습니까?')) return;
        if (persistedContractForSelected) {
            setContractDraft({
                ...persistedContractForSelected,
                items: [...persistedContractForSelected.items],
                commonAttachments: [...(persistedContractForSelected.commonAttachments || [])],
            });
        }
        if (persistedClaimForSelected) {
            setClaimDraft({
                ...persistedClaimForSelected,
                progressLines: [...persistedClaimForSelected.progressLines],
                allocations: getEditableProgressAllocations(persistedClaimForSelected),
                claimAttachments: [...(persistedClaimForSelected.claimAttachments || [])],
            });
        }
    };

    const confirmClaim = async () => {
        if (buybackFinancialsLocked) {
            toast.info('이미 확정된 기성입니다. 확정 금액을 변경하려면 별도 정정 절차가 필요합니다.');
            return;
        }
        if (!validateBuybackIntegrity()) return;
        const savedContract = await saveContract(true);
        if (!selectedClaim || !selectedSite || !selectedComputed) return;
        if (!savedContract && (selectedContract?.items.length || 0) > 0) {
            toast.error('계약내역 저장을 먼저 완료해야 확정할 수 있습니다.');
            return;
        }
        const contractForSnapshot = savedContract || selectedContract;
        const computedForSnapshot = calculateProgressClaimSummary(
            contractForSnapshot,
            claims,
            selectedClaim,
            selectedDailySummary,
            yearMonth
        );

        const materializedAllocations = materializeBuybackAllocations(selectedClaim.allocations);
        const snapshot = {
            site: buildProgressSiteSnapshot(selectedSite, selectedClaim.siteSnapshot),
            contractItems: contractForSnapshot?.items || [],
            progressLines: selectedClaim.progressLines,
            allocations: materializedAllocations.map((allocation) => ({ ...allocation })),
            totalManDay: computedForSnapshot.summary.totalManDay,
            dailyAmount: computedForSnapshot.summary.dailyAmount,
            dailyRowCount: computedForSnapshot.summary.dailyRowCount,
            contractAmount: computedForSnapshot.summary.contractAmount,
            previousAmount: computedForSnapshot.summary.previousAmount,
            currentAmount: computedForSnapshot.summary.currentAmount,
            cumulativeAmount: computedForSnapshot.summary.cumulativeAmount,
            remainingAmount: computedForSnapshot.summary.remainingAmount,
            sukumiUnitPrice: computedForSnapshot.summary.sukumiUnitPrice,
            teamPositionMode: computedForSnapshot.summary.teamPositionMode,
            teamPositionManualAmount: computedForSnapshot.summary.teamPositionManualAmount,
            buybackUnit: computedForSnapshot.summary.buybackUnit,
            buybackTotalAmount: computedForSnapshot.summary.buybackTotalAmount,
            teamPositionUnit: computedForSnapshot.summary.teamPositionUnit,
            teamPositionAmount: computedForSnapshot.summary.teamPositionAmount,
            buybackPoolAmount: computedForSnapshot.summary.buybackPoolAmount,
            allocationBaseAmount: computedForSnapshot.summary.allocationBaseAmount,
            allocationRemainAmount: computedForSnapshot.summary.allocationRemainAmount,
            supplyAmount: computedForSnapshot.summary.supplyAmount,
            vatAmount: computedForSnapshot.summary.vatAmount,
            billingAmount: computedForSnapshot.summary.billingAmount,
            allocationAmount: computedForSnapshot.summary.allocationAmount,
            vatMode: selectedClaim.vatMode,
            vatRate: selectedClaim.vatRate,
            confirmedAt: new Date().toISOString(),
        };

        const savedClaim = await saveClaim({
            allocations: materializedAllocations,
            status: 'confirmed',
            confirmedSnapshot: snapshot,
        }, true);
        if (savedClaim) toast.success('기성청구서를 확정했습니다.');
    };

    const changeClaimStatus = async (status: ProgressClaimStatus) => {
        await saveClaim({ status });
    };

    const updateAllocation = (id: string, patch: Partial<ProgressAllocation>) => {
        setClaimDraft((current) => {
            if (!current) return current;
            return {
                ...current,
                allocations: current.allocations.map((allocation) => allocation.id === id ? { ...allocation, ...patch } : allocation),
            };
        });
    };

    const updateAllocationTarget = (id: string, targetId: string) => {
        if (buybackFinancialsLocked) {
            if (targetId === OFFICE_INCOME_TARGET_ID) return;
            const target = targets.find((item) => item.id === targetId);
            if (!target || target.targetType === 'office_income') return;
            updateAllocation(id, {
                settlementTargetId: target.id,
                targetId: target.id,
                targetName: target.name,
                targetType: target.targetType,
                companyName: target.companyName,
            });
            return;
        }
        if (targetId === OFFICE_INCOME_TARGET_ID) {
            updateAllocation(id, {
                settlementTargetId: undefined,
                targetId: OFFICE_INCOME_TARGET_ID,
                targetName: OFFICE_INCOME_TARGET_NAME,
                targetType: 'office_income',
                companyName: '',
                settlementMode: 'rate',
                afterTaxRate: 1,
                paymentStatus: 'pending',
                paidAmount: 0,
                evidenceRequired: false,
                evidenceStatus: 'not_required',
            });
            return;
        }
        const target = targets.find((item) => item.id === targetId);
        updateAllocation(id, {
            settlementTargetId: target?.id,
            targetId: target?.id,
            targetName: target?.name || '',
            targetType: target?.targetType,
            companyName: target?.companyName,
            settlementMode: 'rate',
            afterTaxRate: target?.defaultAfterTaxRate ?? DEFAULT_BUYBACK_AFTER_TAX_RATE,
            paymentStatus: 'pending',
            paidAmount: 0,
            evidenceRequired: Boolean(target?.evidenceRequired),
            evidenceStatus: target?.evidenceRequired ? 'pending' : 'not_required',
        });
    };

    const addAllocation = () => {
        setClaimDraft((current) => {
            if (!current) return current;
            const next: ProgressAllocation = {
                id: makeProgressId('alloc'),
                targetId: OFFICE_INCOME_TARGET_ID,
                targetName: OFFICE_INCOME_TARGET_NAME,
                targetType: 'office_income',
                companyName: '',
                method: 'fixed',
                fixedAmount: 0,
                percent: 0,
                amountPerManDay: 0,
                manualAmount: 0,
                memo: '',
                settlementMode: 'rate',
                afterTaxRate: 1,
                paymentStatus: 'pending',
                paidAmount: 0,
                evidenceRequired: false,
                evidenceStatus: 'not_required',
                paymentMemo: '',
            };
            return { ...current, allocations: [...current.allocations, next] };
        });
    };

    const removeAllocation = (id: string) => {
        setClaimDraft((current) => current ? { ...current, allocations: current.allocations.filter((item) => item.id !== id) } : current);
    };

    const saveBuybackDraft = async () => {
        if (!validateBuybackIntegrity()) return;
        await saveClaim();
    };

    const handleAttachmentUpload = async (scope: ProgressAttachmentScope, fileList: File[] | FileList | null) => {
        const files = fileList ? Array.from(fileList) : [];
        if (!selectedSite || files.length === 0) return;
        setUploading(true);
        setUploadProgress(0);
        try {
            const uploaded: ProgressAttachment[] = [];
            for (const file of files) {
                const attachment = await progressClaimService.uploadAttachment({
                    file,
                    scope,
                    siteId: normalizeSiteId(selectedSite.id),
                    yearMonth,
                    claimId: claimDraft?.id,
                    onProgress: setUploadProgress,
                });
                uploaded.push(attachment);
            }

            if (scope === 'site') {
                const next = contractDraft
                    ? { ...contractDraft, commonAttachments: [...(contractDraft.commonAttachments || []), ...uploaded] }
                    : null;
                if (next) {
                    const id = await progressClaimService.saveContract(next);
                    const saved = { ...next, id };
                    setContractDraft(saved);
                    setContracts((current) => {
                        const exists = current.some((item) => item.id === id || item.siteId === saved.siteId);
                        return exists
                            ? current.map((item) => (item.id === id || item.siteId === saved.siteId ? saved : item))
                            : [...current, saved];
                    });
                }
            } else {
                const next = claimDraft
                    ? { ...claimDraft, claimAttachments: [...(claimDraft.claimAttachments || []), ...uploaded] }
                    : null;
                if (next) {
                    setClaimDraft(next);
                    await saveClaim(next, true);
                }
            }
            toast.success('첨부파일을 업로드했습니다.');
        } catch (error) {
            console.error('[ProgressClaimPage] attachment upload failed:', error);
            toast.error('첨부파일 업로드 중 오류가 발생했습니다.');
        } finally {
            setUploading(false);
            setUploadProgress(0);
        }
    };

    const removeAttachment = async (scope: ProgressAttachmentScope, id: string) => {
        if (!window.confirm('첨부파일 연결을 삭제하시겠습니까? 저장소 파일은 유지됩니다.')) return;
        setSaving(true);
        try {
            if (scope === 'site') {
                const next = contractDraft
                    ? { ...contractDraft, commonAttachments: (contractDraft.commonAttachments || []).filter((item) => item.id !== id) }
                    : null;
                if (next) {
                    const savedId = await progressClaimService.saveContract(next);
                    const saved = { ...next, id: savedId };
                    setContractDraft(saved);
                    setContracts((current) => {
                        const exists = current.some((item) => item.id === savedId || item.siteId === saved.siteId);
                        return exists
                            ? current.map((item) => (item.id === savedId || item.siteId === saved.siteId ? saved : item))
                            : [...current, saved];
                    });
                    toast.success('첨부파일 연결을 삭제했습니다.');
                }
                return;
            }

            const next = claimDraft
                ? { ...claimDraft, claimAttachments: (claimDraft.claimAttachments || []).filter((item) => item.id !== id) }
                : null;
            if (next) {
                setClaimDraft(next);
                const savedClaim = await saveClaim(next, true);
                if (savedClaim) toast.success('첨부파일 연결을 삭제했습니다.');
            }
        } catch (error) {
            console.error('[ProgressClaimPage] attachment remove failed:', error);
            toast.error('첨부파일 연결 삭제 중 오류가 발생했습니다.');
        } finally {
            setSaving(false);
        }
    };

    const findInvoiceCompany = (id?: string | null, name?: string | null): Company | undefined => {
        const normalizedId = String(id ?? '').trim();
        const normalizedName = String(name ?? '').trim();
        return companies.find((company) => {
            const companyId = String(company.id ?? '').trim();
            const legacyId = String(company.legacyId ?? '').trim();
            const companyName = String(company.name ?? '').trim();
            return Boolean(
                (normalizedId && (companyId === normalizedId || legacyId === normalizedId)) ||
                (normalizedName && companyName === normalizedName)
            );
        });
    };

    const getInvoiceParties = (site: Site) => {
        const recipientCompany = findInvoiceCompany(site.clientCompanyId, site.clientCompanyName)
            || findInvoiceCompany(site.constructorCompanyId || site.companyId, site.constructorCompanyName || site.companyName);
        const supplierCompany = companies.find((company) => company.isMyCompany)
            || findInvoiceCompany(site.partnerId, site.partnerName);

        return {
            recipient: {
                businessNumber: getProgressDisplayText(recipientCompany?.businessNumber, recipientCompany?.corpNum),
                name: getProgressDisplayText(recipientCompany?.name, site.clientCompanyName, site.companyName, site.constructorCompanyName),
                ceoName: getProgressDisplayText(recipientCompany?.ceoName),
                address: getProgressDisplayText(recipientCompany?.address, site.address),
                type: getProgressDisplayText(recipientCompany?.type, site.siteType),
                phone: getProgressDisplayText(recipientCompany?.phone),
                manager: getProgressDisplayText(site.siteManagerName, site.responsibleTeamName),
            },
            supplier: {
                businessNumber: getProgressDisplayText(supplierCompany?.businessNumber, supplierCompany?.corpNum),
                name: getProgressDisplayText(supplierCompany?.name, site.partnerName, '청연ENG'),
                ceoName: getProgressDisplayText(supplierCompany?.ceoName),
                address: getProgressDisplayText(supplierCompany?.address),
                type: getProgressDisplayText(supplierCompany?.type),
                phone: getProgressDisplayText(supplierCompany?.phone),
                manager: getProgressDisplayText(site.responsibleTeamName, site.siteManagerName),
            },
        };
    };

    const downloadInvoicePdf = async () => {
        if (!selectedSite || !selectedClaim || !selectedComputed) {
            toast.error('PDF로 저장할 기성청구서가 없습니다.');
            return;
        }

        const invoiceElement = document.getElementById(PROGRESS_INVOICE_ELEMENT_ID);
        if (!invoiceElement) {
            toast.error('기성청구서 영역을 찾지 못했습니다.');
            return;
        }

        const scrollContainers = Array.from(invoiceElement.querySelectorAll<HTMLElement>('.progress-table-scroll'));
        const previousElementWidth = invoiceElement.style.width;
        const previousElementMaxWidth = invoiceElement.style.maxWidth;
        const previousContainerStyles = scrollContainers.map((element) => ({
            element,
            overflow: element.style.overflow,
            overflowX: element.style.overflowX,
        }));

        try {
            const { default: html2canvas } = await import('html2canvas');
            const captureWidth = Math.max(invoiceElement.scrollWidth, invoiceElement.offsetWidth, PROGRESS_INVOICE_PRINT_WIDTH);
            invoiceElement.classList.add('progress-invoice--pdf');
            invoiceElement.style.width = `${captureWidth}px`;
            invoiceElement.style.maxWidth = `${captureWidth}px`;
            scrollContainers.forEach((element) => {
                element.style.overflow = 'visible';
                element.style.overflowX = 'visible';
            });

            const canvas = await html2canvas(invoiceElement, {
                background: '#ffffff',
                logging: false,
                scale: getProgressInvoiceCaptureScale(captureWidth),
                useCORS: true,
                windowWidth: Math.max(document.documentElement.scrollWidth, invoiceElement.scrollWidth, PROGRESS_INVOICE_PRINT_WIDTH),
            } as any);
            const pageBreaks = getProgressInvoicePageBreaks(invoiceElement, canvas);
            const pdfBlob = makeProgressInvoicePdfBlob(canvas, pageBreaks);
            const filename = `${sanitizeProgressFilenamePart(selectedSite.name || selectedClaim.siteName)}_${yearMonth}_기성청구서.pdf`;
            downloadProgressBlob(pdfBlob, filename);
            void fileTransferAuditService.log({
                kind: 'pdf',
                direction: 'download',
                status: 'success',
                source: '기성청구 관리',
                operation: 'invoice_download',
                fileName: filename,
                fileSize: pdfBlob.size,
                recordCount: 1,
                details: { siteId: selectedSite.id, claimId: selectedClaim.id, yearMonth },
            });
            toast.success('기성청구서 PDF를 다운로드했습니다.');
        } catch (error) {
            console.error('[ProgressClaimPage] invoice PDF download failed:', error);
            void fileTransferAuditService.log({
                kind: 'pdf',
                direction: 'download',
                status: 'failure',
                source: '기성청구 관리',
                operation: 'invoice_download',
                error,
                details: { siteId: selectedSite.id, claimId: selectedClaim.id, yearMonth },
            });
            toast.error('기성청구서 PDF 다운로드 중 오류가 발생했습니다.');
        } finally {
            invoiceElement.classList.remove('progress-invoice--pdf');
            invoiceElement.style.width = previousElementWidth;
            invoiceElement.style.maxWidth = previousElementMaxWidth;
            previousContainerStyles.forEach(({ element, overflow, overflowX }) => {
                element.style.overflow = overflow;
                element.style.overflowX = overflowX;
            });
        }
    };

    const downloadInvoiceExcel = async () => {
        if (!selectedSite || !selectedContract || !selectedClaim || !selectedComputed) {
            toast.error('엑셀로 저장할 기성청구서가 없습니다.');
            return;
        }

        try {
            const { recipient, supplier } = getInvoiceParties(selectedSite);
            const workbook = await buildProgressInvoiceWorkbook({
                site: selectedSite,
                claim: selectedClaim,
                computed: selectedComputed,
                recipient,
                supplier,
                yearMonth,
            });
            const buffer = await workbook.xlsx.writeBuffer();
            const fileName = `${sanitizeProgressFilenamePart(selectedSite.name || selectedClaim.siteName)}_${yearMonth}_기성청구서.xlsx`;
            const workbookBlob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            saveAs(workbookBlob, fileName);
            void fileTransferAuditService.log({
                kind: 'excel',
                direction: 'download',
                status: 'success',
                source: 'Progress claim invoice',
                operation: 'invoice_download',
                fileName,
                fileSize: workbookBlob.size,
                recordCount: 1,
                details: { siteId: selectedSite.id, claimId: selectedClaim.id, yearMonth },
            });
            toast.success('기성청구서 엑셀을 다운로드했습니다.');
        } catch (error) {
            console.error('[ProgressClaimPage] invoice Excel download failed:', error);
            void fileTransferAuditService.log({
                kind: 'excel',
                direction: 'download',
                status: 'failure',
                source: 'Progress claim invoice',
                operation: 'invoice_download',
                error,
                details: { siteId: selectedSite.id, claimId: selectedClaim.id, yearMonth },
            });
            toast.error('기성청구서 엑셀 다운로드 중 오류가 발생했습니다.');
        }
    };

    const exportExcel = () => {
        const workbook = XLSX.utils.book_new();
        const overview = overviewRows.map((row) => ({
            현장명: row.site.name || row.summary.siteName,
            현장구분: row.site.siteType || '',
            담당팀: row.site.responsibleTeamName || '',
            현장책임자: row.site.siteManagerName || '',
            계약금액: row.summary.contractAmount,
            전회기성: row.summary.previousAmount,
            금회기성: row.summary.currentAmount,
            누계기성: row.summary.cumulativeAmount,
            잔여기성: row.summary.remainingAmount,
            공수: row.summary.totalManDay,
            스꾸미단가: row.summary.sukumiUnitPrice,
            상태: getStatusLabel(row.claim.status),
        }));
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(overview), '월별기성현황');

        const contractRows = contracts.flatMap((contract) => contract.items.map((item) => ({
            현장명: contract.siteName,
            분류: item.category,
            공종명: item.workName,
            구분: item.workType,
            계약수량: item.contractQuantity,
            단위: item.unit,
            계약단가: item.unitPrice,
            계약금액: getContractItemAmount(item),
            비고: item.remark || '',
        })));
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(contractRows), '계약내역');

        const exportClaimMap = new Map<string, ProgressClaim>();
        claims.forEach((claim) => exportClaimMap.set(`${claim.siteId}__${claim.yearMonth}`, claim));
        if (selectedClaim) {
            exportClaimMap.set(`${selectedClaim.siteId}__${selectedClaim.yearMonth}`, selectedClaim);
        }
        const exportClaims = Array.from(exportClaimMap.values()).sort((a, b) =>
            `${a.siteName}_${a.yearMonth}`.localeCompare(`${b.siteName}_${b.yearMonth}`, 'ko')
        );

        const getExportDaily = (claim: ProgressClaim): ProgressDailyManDaySummary | undefined => {
            if (claim.yearMonth === yearMonth) return dailySummaryBySiteId.get(claim.siteId);
            if (!claim.confirmedSnapshot) return undefined;
            return {
                siteId: claim.siteId,
                siteName: claim.siteName,
                siteType: claim.siteSnapshot?.siteType || '',
                manDay: claim.confirmedSnapshot.totalManDay,
                amount: claim.confirmedSnapshot.currentAmount,
                rowCount: 0,
            };
        };

        const allocationRows = exportClaims.flatMap((claim) => {
            const contract = claim.siteId === selectedContract?.siteId ? selectedContract : contractBySiteId.get(claim.siteId);
            const computed = calculateProgressClaimSummary(contract, exportClaims, claim, getExportDaily(claim), claim.yearMonth);
            return computed.allocationRows.map((row) => ({
                현장명: claim.siteName,
                청구월: claim.yearMonth,
                관계자: row.allocation.targetName,
                방식: PROGRESS_ALLOCATION_METHOD_LABELS[row.allocation.method],
                배분기준금액: computed.summary.allocationBaseAmount,
                계산금액: row.amount,
                배분잔액: computed.summary.allocationRemainAmount,
                메모: row.allocation.memo || '',
            }));
        });
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(allocationRows), '관계자배분');

        const siteMonthlyLedger = exportClaims.map((claim) => {
            const contract = claim.siteId === selectedContract?.siteId ? selectedContract : contractBySiteId.get(claim.siteId);
            const computed = calculateProgressClaimSummary(contract, exportClaims, claim, getExportDaily(claim), claim.yearMonth);
            return {
                현장명: claim.siteName,
                청구월: claim.yearMonth,
                상태: getStatusLabel(claim.status),
                계약금액: computed.summary.contractAmount,
                전회기성: computed.summary.previousAmount,
                금회기성: computed.summary.currentAmount,
                누계기성: computed.summary.cumulativeAmount,
                잔여기성: computed.summary.remainingAmount,
                공수: computed.summary.totalManDay,
                스꾸미단가: computed.summary.sukumiUnitPrice,
                팀포지션기준: getTeamPositionModeLabel(computed.summary.teamPositionMode),
                팀포지션금액: computed.summary.teamPositionAmount,
                바이백가능금액: computed.summary.buybackPoolAmount,
                배분기준금액: computed.summary.allocationBaseAmount,
                배분합계: computed.summary.allocationAmount,
                청구금액: computed.summary.billingAmount,
                메모: claim.memo || '',
            };
        });
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(siteMonthlyLedger), '현장별월별대장');

        const progressLedger = exportClaims.flatMap((claim) => {
            const contract = claim.siteId === selectedContract?.siteId ? selectedContract : contractBySiteId.get(claim.siteId);
            const computed = calculateProgressClaimSummary(contract, exportClaims, claim, getExportDaily(claim), claim.yearMonth);
            return computed.itemRows.map((row) => ({
                현장명: claim.siteName,
                청구월: claim.yearMonth,
                분류: row.item.category,
                공종명: row.item.workName,
                구분: row.item.workType,
                계약수량: row.item.contractQuantity,
                단위: row.item.unit,
                계약단가: row.item.unitPrice,
                계약금액: row.contractAmount,
                전회수량: row.previousQuantity,
                전회금액: row.previousAmount,
                금회수량: row.currentQuantity,
                금회금액: row.currentAmount,
                누계수량: row.cumulativeQuantity,
                누계금액: row.cumulativeAmount,
                잔여수량: row.remainingQuantity,
                잔여기성: row.remainingAmount,
                기성률: row.progressRate,
                비고: row.item.remark || '',
            }));
        });
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(progressLedger), '기성관리대장');

        XLSX.writeFile(workbook, `기성관리_${yearMonth}.xlsx`);
    };

    const renderSummaryCards = () => {
        const overallProgressRate = totals.contractAmount > 0
            ? totals.cumulativeAmount / totals.contractAmount * 100
            : 0;
        const cards = [
            { label: '계약금액', value: totals.contractAmount },
            { label: '전회기성', value: totals.previousAmount },
            { label: '금회기성', value: totals.currentAmount },
            { label: '누계기성', value: totals.cumulativeAmount },
            { label: '잔여기성', value: totals.remainingAmount },
            { label: '전체 공정률', value: overallProgressRate, percent: true },
            { label: '출력일보 공수', value: totals.manDay, quantity: true },
        ];

        return (
            <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-7">
                {cards.map((card) => (
                    <ProgressMetricCard
                        key={card.label}
                        label={card.label}
                        value={card.percent
                            ? formatProgressRate(card.value)
                            : card.quantity
                                ? formatProgressQuantity(card.value)
                                : formatProgressMoney(card.value)}
                        tone={card.percent ? 'accent' : 'default'}
                        surface="white"
                        className="p-4"
                    />
                ))}
            </div>
        );
    };

    const renderStatementActions = (panelKey: string, target: SupportStatementTarget) => {
        const renderStatementTabButton = (
            statementKey: SupportTransactionStatementMode | 'labor',
            active: boolean,
            count: number,
            onClick: () => void
        ) => {
            const meta = PROGRESS_STATEMENT_TAB_META[statementKey];
            return (
                <button
                    key={statementKey}
                    type="button"
                    aria-label={`${target.title} ${meta.label}`}
                    title={meta.label}
                    aria-expanded={active}
                    onClick={(event) => {
                        event.stopPropagation();
                        onClick();
                    }}
                    className={`${progressTabButtonClass(meta.tone, active)} relative`}
                >
                    <FontAwesomeIcon
                        icon={meta.icon}
                        className={active ? 'text-white' : PROGRESS_TAB_TONE_CLASS[meta.tone].icon}
                    />
                    <span>{meta.label}</span>
                    {count > 0 && (
                        <span className={`absolute -right-1 -top-1 min-w-4 rounded-full bg-white px-1 text-[9px] font-black leading-4 shadow ${PROGRESS_TAB_TONE_CLASS[meta.tone].badge}`}>
                            {count}
                        </span>
                    )}
                </button>
            );
        };

        const standardCount = getLinkedTransactionStatements(panelKey, 'standard').length;
        const rentalCount = getLinkedTransactionStatements(panelKey, 'rental').length;
        const defaultTransactionMode: SupportTransactionStatementMode = standardCount > 0 || rentalCount === 0 ? 'standard' : 'rental';
        const transactionMeta = PROGRESS_STATEMENT_TAB_META.standard;
        const transactionPanelActive = Boolean(transactionStatementPanel?.key === panelKey);

        return (
            <>
                {renderStatementTabButton('labor', Boolean(laborStatementPanel), 0, () => toggleLaborStatementPanel(panelKey, target))}
                <button
                    type="button"
                    aria-label={`${target.title} ${transactionMeta.label}`}
                    title={transactionMeta.label}
                    aria-expanded={transactionPanelActive}
                    onClick={(event) => {
                        event.stopPropagation();
                        toggleCombinedTransactionStatementPanel(panelKey, target, defaultTransactionMode);
                    }}
                    className={`${progressTabButtonClass(transactionMeta.tone, transactionPanelActive)} relative`}
                >
                    <FontAwesomeIcon
                        icon={transactionMeta.icon}
                        className={transactionPanelActive ? 'text-white' : PROGRESS_TAB_TONE_CLASS[transactionMeta.tone].icon}
                    />
                    <span>{transactionMeta.label}</span>
                    {standardCount + rentalCount > 0 && (
                        <span className={`absolute -right-1 -top-1 min-w-4 rounded-full bg-white px-1 text-[9px] font-black leading-4 shadow ${PROGRESS_TAB_TONE_CLASS[transactionMeta.tone].badge}`}>
                            {standardCount + rentalCount}
                        </span>
                    )}
                </button>
            </>
        );
    };

    const renderTransactionModeSelector = (
        panelKey: string,
        target: SupportStatementTarget,
        activeMode: SupportTransactionStatementMode,
        statementYearMonth = yearMonth
    ) => {
        const options: Array<{ mode: SupportTransactionStatementMode; count: number }> = [
            { mode: 'standard', count: getLinkedTransactionStatements(panelKey, 'standard', statementYearMonth).length },
            { mode: 'rental', count: getLinkedTransactionStatements(panelKey, 'rental', statementYearMonth).length },
        ];

        return (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                <span className="text-xs font-black text-slate-500">거래명세 유형</span>
                <div className="inline-flex overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                    {options.map(({ mode, count }) => {
                        const meta = PROGRESS_STATEMENT_TAB_META[mode];
                        const active = activeMode === mode;
                        return (
                            <button
                                key={mode}
                                type="button"
                                aria-label={`${target.title} ${meta.label}`}
                                title={meta.label}
                                onClick={() => switchTransactionStatementMode(mode)}
                                className={`inline-flex h-9 min-w-[108px] items-center justify-center gap-1.5 px-3 text-xs font-black transition ${
                                    active
                                        ? `${PROGRESS_TAB_TONE_CLASS[meta.tone].active} border-0`
                                        : 'text-slate-600 hover:bg-white'
                                }`}
                            >
                                <FontAwesomeIcon
                                    icon={meta.icon}
                                    className={active ? 'text-white' : PROGRESS_TAB_TONE_CLASS[meta.tone].icon}
                                />
                                <span>{meta.label}</span>
                                {count > 0 && (
                                    <span className={`rounded-full bg-white px-1.5 text-[10px] leading-4 ${active ? PROGRESS_TAB_TONE_CLASS[meta.tone].badge : 'text-slate-500'}`}>
                                        {count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderTabStatementActions = () => {
        if (!selectedSite || !selectedClaim || !selectedComputed) return null;

        const panelKey = getProgressStatementPanelKey(selectedSite);
        const target = buildProgressStatementTarget(selectedSite, selectedComputed.summary, selectedClaim);

        return renderStatementActions(panelKey, target);
    };

    const renderSelectedSiteStatementPage = () => {
        if (!selectedSite || !selectedClaim || !selectedComputed) return null;
        if (!laborStatementPanel && !transactionStatementPanel) return null;

        const panelKey = getProgressStatementPanelKey(selectedSite);
        const target = buildProgressStatementTarget(selectedSite, selectedComputed.summary, selectedClaim);
        const transactionMode = transactionStatementPanel?.mode;
        const transactionPanelKey = transactionStatementPanel?.key || panelKey;
        const transactionTarget = transactionStatementPanel?.target || target;
        const transactionYearMonth = transactionStatementPanel?.yearMonth || yearMonth;

        return (
            <div className="space-y-4">
                {renderSiteSelector()}
                {laborStatementPanel && (
                    <SupportClientLaborStatementPanel
                        target={target}
                        yearMonth={yearMonth}
                        statementKey={panelKey}
                        outputSource="progress-claims"
                        onClose={closeLaborStatementPanel}
                    />
                )}
                {transactionMode && (
                    <>
                        {renderTransactionModeSelector(transactionPanelKey, transactionTarget, transactionMode, transactionYearMonth)}
                        <SupportClientTransactionStatementPanel
                            panelKey={transactionPanelKey}
                            target={transactionTarget}
                            yearMonth={transactionYearMonth}
                            mode={transactionMode}
                            linkedStatements={getLinkedTransactionStatements(transactionPanelKey, transactionMode, transactionYearMonth)}
                            allStatements={transactionStatements}
                            loading={transactionStatementsLoading}
                            onSaved={fetchTransactionStatements}
                            outputSource="progress-claims"
                            onClose={closeTransactionStatementPanel}
                        />
                    </>
                )}
            </div>
        );
    };

    const renderSiteSelector = () => {
        const selectedSiteSelectValue = normalizeSiteId(selectedSite?.id) || selectedSiteId;

        return (
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid gap-3 md:grid-cols-[180px_260px_minmax(240px,1fr)_auto] md:items-end">
                <label>
                    <span className="text-xs font-black text-slate-500">청구월</span>
                    <input
                        aria-label="청구월"
                        type="month"
                        value={yearMonth}
                        onInput={(event) => requestYearMonthChange(event.currentTarget.value)}
                        onChange={(event) => requestYearMonthChange(event.target.value)}
                        className={`${textInputClass} mt-1`}
                    />
                </label>
                <label>
                    <span className="text-xs font-black text-slate-500">발주사 선택</span>
                    <select
                        aria-label="발주사 선택"
                        value={selectedClientGroup?.key || ''}
                        onChange={(event) => requestClientChange(event.target.value)}
                        className={`${selectInputClass} mt-1`}
                        disabled={siteClientGroups.length === 0}
                    >
                        {siteClientGroups.map((group) => (
                            <option key={group.key} value={group.key}>
                                {group.clientName} ({group.sites.length}개)
                            </option>
                        ))}
                        {siteClientGroups.length === 0 && <option value="">발주사 없음</option>}
                    </select>
                </label>
                <label>
                    <span className="text-xs font-black text-slate-500">현장 선택</span>
                    <select
                        aria-label="현장 선택"
                        value={selectedSiteSelectValue}
                        onChange={(event) => requestSiteChange(event.target.value)}
                        className={`${selectInputClass} mt-1`}
                        disabled={selectedClientSites.length === 0}
                    >
                        {selectedClientSites.map((site) => (
                            <option key={site.id || site.name} value={site.id || ''}>
                                {site.name} {site.siteType ? `(${site.siteType})` : ''}
                            </option>
                        ))}
                        {selectedClientSites.length === 0 && <option value="">현장 없음</option>}
                    </select>
                </label>
                <button
                    type="button"
                    onClick={reloadData}
                    disabled={loading}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {loading ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faCalculator} />}
                    다시 계산
                </button>
            </div>
            </div>
        );
    };

    const renderCompactMetric = (
        label: string,
        value: React.ReactNode,
        tone: ProgressMetricTone = 'default'
    ) => <ProgressMetricCard label={label} value={value} tone={tone} />;

    const renderProgressDashboardCharts = () => {
        const dashboardYear = dashboardMonths[0]?.slice(0, 4) || yearMonth.slice(0, 4);
        const currentDashboardMonthRow = progressDashboard.monthlyRows.find((row) => row.month === yearMonth)
            || progressDashboard.monthlyRows.find((row) => row.currentAmount !== 0 || row.cumulativeAmount !== 0 || row.contractAmount !== 0)
            || progressDashboard.monthlyRows[0];

        return (
            <div className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <h3 className="text-base font-black text-slate-950">{dashboardYear} 항목별 월별 기성</h3>
                            <p className="mt-1 text-sm text-slate-500">설치·해체·직영품과 주요 항목의 금회기성 합계</p>
                        </div>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black text-slate-600">
                            {progressDashboard.itemKeys.length}개 항목
                        </span>
                    </div>
                    <div className="mt-4 h-[320px] min-w-0">
                        {progressDashboard.itemKeys.length > 0 ? (
                            <MeasuredChartFrame height={320}>
                                {({ width, height }) => (
                                <BarChart width={width} height={height} data={progressDashboard.monthlyRows} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => formatCompactProgressMoney(value)} />
                                    <RechartsTooltip
                                        formatter={(value, name) => [formatProgressChartMoney(value), String(name)]}
                                        labelFormatter={(label) => `${dashboardYear}년 ${label}`}
                                    />
                                    <Legend wrapperStyle={{ fontSize: 12 }} />
                                    {progressDashboard.itemKeys.map((key, index) => (
                                        <Bar
                                            key={key}
                                            dataKey={key}
                                            stackId="progress-item"
                                            fill={PROGRESS_CHART_COLORS[index % PROGRESS_CHART_COLORS.length]}
                                            radius={index === progressDashboard.itemKeys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                                        />
                                    ))}
                                </BarChart>
                                )}
                            </MeasuredChartFrame>
                        ) : (
                            <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm font-bold text-slate-400">
                                표시할 항목별 기성자료가 없습니다.
                            </div>
                        )}
                    </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <h3 className="text-base font-black text-slate-950">{dashboardYear} 월별 금회·누계·잔여기성·공정률</h3>
                            <p className="mt-1 text-sm text-slate-500">전체 도급·직영 현장의 월별 기성·공정률 흐름</p>
                        </div>
                        <span className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-700">
                            현재 {yearMonth}
                        </span>
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-4">
                        <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                            <div className="text-xs font-black text-slate-500">계약금액</div>
                            <div className="mt-1 text-sm font-black text-slate-950">{formatProgressMoney(currentDashboardMonthRow?.contractAmount || 0)}</div>
                        </div>
                        <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2">
                            <div className="text-xs font-black text-emerald-700">누계기성</div>
                            <div className="mt-1 text-sm font-black text-emerald-800">{formatProgressMoney(currentDashboardMonthRow?.cumulativeAmount || 0)}</div>
                        </div>
                        <div className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2">
                            <div className="text-xs font-black text-rose-700">잔여기성</div>
                            <div className="mt-1 text-sm font-black text-rose-800">{formatProgressMoney(currentDashboardMonthRow?.remainingAmount || 0)}</div>
                        </div>
                        <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2">
                            <div className="text-xs font-black text-indigo-700">공정률</div>
                            <div className="mt-1 text-sm font-black text-indigo-800">{formatProgressRate(currentDashboardMonthRow?.progressRate || 0)}</div>
                        </div>
                    </div>
                    <div className="mt-4 h-[320px] min-w-0">
                        <MeasuredChartFrame height={320}>
                            {({ width, height }) => (
                            <ComposedChart width={width} height={height} data={progressDashboard.monthlyRows} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                                <YAxis yAxisId="money" tick={{ fontSize: 11 }} tickFormatter={(value) => formatCompactProgressMoney(value)} />
                                <YAxis yAxisId="rate" orientation="right" domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={(value) => formatProgressRate(value)} />
                                <RechartsTooltip
                                    formatter={(value, name) => String(name).includes('공정률')
                                        ? [formatProgressRate(value), String(name)]
                                        : [formatProgressChartMoney(value), String(name)]}
                                    labelFormatter={(label) => `${dashboardYear}년 ${label}`}
                                />
                                <Legend wrapperStyle={{ fontSize: 12 }} />
                                <Bar yAxisId="money" dataKey="currentAmount" name="금회기성" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={22} />
                                <Line yAxisId="money" type="monotone" dataKey="cumulativeAmount" name="누계기성" stroke="#059669" strokeWidth={3} dot={{ r: 3 }} />
                                <Line yAxisId="money" type="monotone" dataKey="remainingAmount" name="잔여기성" stroke="#e11d48" strokeWidth={3} dot={{ r: 3 }} />
                                <Line yAxisId="rate" type="monotone" dataKey="progressRate" name="공정률" stroke="#f59e0b" strokeWidth={3} dot={{ r: 3 }} />
                            </ComposedChart>
                            )}
                        </MeasuredChartFrame>
                    </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <h3 className="text-base font-black text-slate-950">현장별 월별 기성·공정률</h3>
                            <p className="mt-1 text-sm text-slate-500">{selectedSite?.name || '현장 미선택'}</p>
                        </div>
                        <select
                            aria-label="현장별 월별 기성 현장 선택"
                            value={normalizeSiteId(selectedSite?.id)}
                            onChange={(event) => requestSiteChange(event.target.value)}
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 sm:w-64"
                        >
                            {progressScopeSiteRows.map((site) => (
                                <option key={site.id || site.name} value={site.id || ''}>
                                    {site.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-4">
                        <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                            <div className="text-xs font-black text-slate-500">계약금액</div>
                            <div className="mt-1 text-sm font-black text-slate-950">{formatProgressMoney(selectedSiteProgressSummary?.row.summary.contractAmount || 0)}</div>
                        </div>
                        <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2">
                            <div className="text-xs font-black text-emerald-700">누계기성</div>
                            <div className="mt-1 text-sm font-black text-emerald-800">{formatProgressMoney(selectedSiteProgressSummary?.row.summary.cumulativeAmount || 0)}</div>
                        </div>
                        <div className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2">
                            <div className="text-xs font-black text-rose-700">잔여기성</div>
                            <div className="mt-1 text-sm font-black text-rose-800">{formatProgressMoney(selectedSiteProgressSummary?.row.summary.remainingAmount || 0)}</div>
                        </div>
                        <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2">
                            <div className="text-xs font-black text-indigo-700">공정률</div>
                            <div className="mt-1 text-sm font-black text-indigo-800">{formatProgressRate(selectedSiteProgressSummary?.progressRate || 0)}</div>
                        </div>
                    </div>
                    <div className="mt-4 h-[320px] min-w-0">
                        {selectedSiteDashboardRows.length > 0 ? (
                            <MeasuredChartFrame height={320}>
                                {({ width, height }) => (
                                <ComposedChart width={width} height={height} data={selectedSiteDashboardRows} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                                    <YAxis yAxisId="money" tick={{ fontSize: 11 }} tickFormatter={(value) => formatCompactProgressMoney(value)} />
                                    <YAxis yAxisId="rate" orientation="right" domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={(value) => formatProgressRate(value)} />
                                    <RechartsTooltip
                                        formatter={(value, name) => String(name).includes('공정률')
                                            ? [formatProgressRate(value), String(name)]
                                            : [formatProgressChartMoney(value), String(name)]}
                                        labelFormatter={(label) => `${dashboardYear}년 ${label}`}
                                    />
                                    <Legend wrapperStyle={{ fontSize: 12 }} />
                                    <Bar yAxisId="money" dataKey="currentAmount" name="금회기성" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={22} />
                                    <Line yAxisId="money" type="monotone" dataKey="cumulativeAmount" name="누계기성" stroke="#059669" strokeWidth={3} dot={{ r: 3 }} />
                                    <Line yAxisId="money" type="monotone" dataKey="remainingAmount" name="잔여기성" stroke="#e11d48" strokeWidth={3} dot={{ r: 3 }} />
                                    <Line yAxisId="rate" type="monotone" dataKey="progressRate" name="공정률" stroke="#f59e0b" strokeWidth={3} dot={{ r: 3 }} />
                                </ComposedChart>
                                )}
                            </MeasuredChartFrame>
                        ) : (
                            <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm font-bold text-slate-400">
                                표시할 현장별 월별 기성자료가 없습니다.
                            </div>
                        )}
                    </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <h3 className="text-base font-black text-slate-950">선택 발주사 현장별 기성 비교</h3>
                            <p className="mt-1 text-sm text-slate-500">{selectedOverviewClientGroup?.clientName || '전체 발주사'} · 금회기성 상위 현장</p>
                        </div>
                        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                            <select
                                aria-label="현장별 기성 비교 발주사 선택"
                                value={selectedOverviewClientGroup?.key || ''}
                                onChange={(event) => setSelectedOverviewClientKey(event.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 sm:w-64"
                                disabled={overviewClientGroups.length === 0}
                            >
                                {overviewClientGroups.map((group) => (
                                    <option key={group.key} value={group.key}>
                                        {group.clientName}
                                    </option>
                                ))}
                                {overviewClientGroups.length === 0 && <option value="">발주사 없음</option>}
                            </select>
                            <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                                {selectedClientSiteChartRows.length}개 현장
                            </span>
                        </div>
                    </div>
                    <div className="mt-4 h-[300px] min-w-0">
                        {selectedClientSiteChartRows.length > 0 ? (
                            <MeasuredChartFrame height={300}>
                                {({ width, height }) => (
                                <BarChart
                                    width={width}
                                    height={height}
                                    data={selectedClientSiteChartRows}
                                    layout="vertical"
                                    margin={{ top: 8, right: 16, left: 24, bottom: 8 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(value) => formatCompactProgressMoney(value)} />
                                    <YAxis
                                        type="category"
                                        dataKey="name"
                                        width={120}
                                        tick={{ fontSize: 11 }}
                                        tickFormatter={(value) => {
                                            const text = String(value);
                                            return text.length > 12 ? `${text.slice(0, 12)}...` : text;
                                        }}
                                    />
                                    <RechartsTooltip formatter={(value, name) => [formatProgressChartMoney(value), String(name)]} />
                                    <Legend wrapperStyle={{ fontSize: 12 }} />
                                    <Bar dataKey="금회기성" fill="#4f46e5" radius={[0, 4, 4, 0]} />
                                    <Bar dataKey="잔여기성" fill="#e11d48" radius={[0, 4, 4, 0]} />
                                </BarChart>
                                )}
                            </MeasuredChartFrame>
                        ) : (
                            <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm font-bold text-slate-400">
                                표시할 현장별 기성자료가 없습니다.
                            </div>
                        )}
                    </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white shadow-sm xl:col-span-2">
                    <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <h3 className="text-base font-black text-slate-950">발주사 현장별 월별 기성현황</h3>
                            <p className="mt-1 text-sm text-slate-500">
                                {selectedOverviewClientGroup?.clientName || '발주사 미선택'} · 현장별 월별 금회·누계·잔여기성·공정률
                            </p>
                        </div>
                        <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto lg:items-center">
                            <select
                                aria-label="발주사 현장별 월별 기성현황 발주사 선택"
                                value={selectedOverviewClientGroup?.key || ''}
                                onChange={(event) => setSelectedOverviewClientKey(event.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 sm:w-72"
                                disabled={overviewClientGroups.length === 0}
                            >
                                {overviewClientGroups.map((group) => (
                                    <option key={group.key} value={group.key}>
                                        {group.clientName} ({group.rows.length}개 현장)
                                    </option>
                                ))}
                                {overviewClientGroups.length === 0 && <option value="">발주사 없음</option>}
                            </select>
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-600">
                                {selectedClientSiteMonthlyRows.length}행
                            </span>
                        </div>
                    </div>
                    <div className="progress-table-scroll overflow-x-auto">
                        <table className="progress-table min-w-[1280px] w-full text-sm">
                            <thead className="bg-slate-900 text-xs font-black text-white">
                                <tr>
                                    <th className="px-3 py-3 text-left">현장</th>
                                    <th className="px-3 py-3 text-center">청구월</th>
                                    <th className="px-3 py-3 text-right">계약금액</th>
                                    <th className="bg-indigo-600 px-3 py-3 text-right">금회기성</th>
                                    <th className="bg-emerald-600 px-3 py-3 text-right">누계기성</th>
                                    <th className="bg-rose-600 px-3 py-3 text-right">잔여기성</th>
                                    <th className="bg-violet-600 px-3 py-3 text-right">공정률</th>
                                    <th className="px-3 py-3 text-center">상태</th>
                                    <th className="px-3 py-3 text-center">현장</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {selectedClientSiteMonthlyRows.map((row) => (
                                    <tr
                                        key={`${row.siteId}_${row.month}`}
                                        className={row.month === yearMonth ? 'bg-indigo-50' : 'hover:bg-slate-50'}
                                    >
                                        <td className="px-3 py-3">
                                            <div className="font-black text-slate-900">{row.siteName}</div>
                                        </td>
                                        <td className="px-3 py-3 text-center font-black text-slate-700">{row.month}</td>
                                        <td className="progress-cell-contract px-3 py-3 text-right">{formatProgressMoney(row.contractAmount)}</td>
                                        <td className="progress-cell-current px-3 py-3 text-right font-black text-indigo-700">{formatProgressMoney(row.currentAmount)}</td>
                                        <td className="progress-cell-cumulative px-3 py-3 text-right">{formatProgressMoney(row.cumulativeAmount)}</td>
                                        <td className={`progress-cell-remaining px-3 py-3 text-right ${row.remainingAmount < 0 ? 'font-bold text-rose-700' : ''}`}>{formatProgressMoney(row.remainingAmount)}</td>
                                        <td className="px-3 py-3 text-right">
                                            <div className="font-black text-violet-700">{formatProgressRate(row.progressRate)}</div>
                                            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                                                <div
                                                    className="h-full rounded-full bg-violet-500"
                                                    style={{ width: `${Math.max(0, Math.min(100, row.progressRate))}%` }}
                                                />
                                            </div>
                                        </td>
                                        <td className="px-3 py-3 text-center">
                                            <ProgressStatusBadge status={row.status} />
                                        </td>
                                        <td className="px-3 py-3 text-center">
                                            <button
                                                type="button"
                                                onClick={() => requestSiteChange(row.siteId)}
                                                className="rounded border border-slate-200 px-3 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100"
                                            >
                                                보기
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {selectedClientSiteMonthlyRows.length === 0 && (
                                    <tr>
                                        <td colSpan={9} className="px-4 py-10 text-center font-bold text-slate-400">
                                            선택한 발주사의 월별 현장 기성자료가 없습니다.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    const renderOverview = () => {
        const activeGroup = selectedOverviewClientGroup;
        const activeGroupProgressRate = activeGroup && activeGroup.totals.contractAmount > 0
            ? activeGroup.totals.cumulativeAmount / activeGroup.totals.contractAmount * 100
            : 0;

        return (
            <div className="space-y-4">
                {renderSummaryCards()}
                {renderProgressDashboardCharts()}
                <ProgressSection
                    title="월별 기성현황"
                    description="발주사를 좌측 메뉴에서 선택하고, 계약·전회·금회·누계·잔여·공수를 우측 테이블로 확인합니다."
                    action={(
                        <>
                            <input
                                value={searchTerm}
                                onChange={(event) => setSearchTerm(event.target.value)}
                                placeholder="발주사, 현장, 담당팀 검색"
                                className="w-72 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100"
                            />
                            <button
                                type="button"
                                onClick={exportExcel}
                                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800"
                            >
                                <FontAwesomeIcon icon={faDownload} />
                                엑셀
                            </button>
                        </>
                    )}
                >
                    <div className="grid gap-4 p-4 xl:grid-cols-[320px_minmax(0,1fr)]">
                        <aside className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                            <div className="border-b border-slate-200 bg-slate-900 px-4 py-3 text-white">
                                <div className="text-sm font-black">발주사</div>
                                <div className="mt-1 text-xs text-slate-300">{overviewClientGroups.length}개 그룹</div>
                            </div>
                            <div className="max-h-[680px] space-y-2 overflow-y-auto p-2">
                                {overviewClientGroups.map((group) => {
                                    const selected = activeGroup?.key === group.key;
                                    return (
                                        <button
                                            key={group.key}
                                            type="button"
                                            onClick={() => setSelectedOverviewClientKey(group.key)}
                                            className={`w-full rounded-lg border px-3 py-3 text-left transition ${selected
                                                ? 'border-indigo-300 bg-indigo-50 text-indigo-900 shadow-sm'
                                                : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50'
                                                }`}
                                        >
                                            <span className="block truncate text-sm font-black">{group.clientName}</span>
                                            <span className="mt-1 block text-xs font-bold text-slate-500">
                                                현장 {group.rows.length}개 · 금회 {formatProgressMoney(group.totals.currentAmount)}
                                            </span>
                                            <span className={`mt-0.5 block text-xs font-bold ${group.totals.remainingAmount < 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                                                잔여기성 {formatProgressMoney(group.totals.remainingAmount)}
                                            </span>
                                        </button>
                                    );
                                })}
                                {overviewClientGroups.length === 0 && (
                                    <div className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-10 text-center text-sm font-bold text-slate-400">
                                        표시할 발주사가 없습니다.
                                    </div>
                                )}
                            </div>
                        </aside>

                        <div className="min-w-0 space-y-4">
                            {activeGroup ? (
                                <>
                                    <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
                                        <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-3 md:flex-row md:items-center md:justify-between">
                                            <div>
                                                <h3 className="text-lg font-black text-slate-950">{activeGroup.clientName}</h3>
                                                <p className="mt-1 text-sm text-slate-500">발주사 합계와 현장별 기성 흐름입니다.</p>
                                            </div>
                                            <span className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-700">
                                                현장 {activeGroup.rows.length}개
                                            </span>
                                        </div>
                                        <div className="progress-table-scroll overflow-x-auto p-4">
                                            <table className="min-w-[880px] w-full border-separate border-spacing-0 overflow-hidden rounded-lg text-sm">
                                                <thead className="text-xs font-black text-white">
                                                    <tr>
                                                        <th className="border border-slate-700 bg-slate-800 px-3 py-3 text-center">계약</th>
                                                        <th className="border border-amber-600 bg-amber-600 px-3 py-3 text-center">전회</th>
                                                        <th className="border border-indigo-600 bg-indigo-600 px-3 py-3 text-center">금회</th>
                                                        <th className="border border-emerald-600 bg-emerald-600 px-3 py-3 text-center">누계</th>
                                                        <th className="border border-rose-600 bg-rose-600 px-3 py-3 text-center">잔여기성</th>
                                                        <th className="border border-violet-600 bg-violet-600 px-3 py-3 text-center">공정률</th>
                                                        <th className="border border-cyan-700 bg-cyan-700 px-3 py-3 text-center">공수</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    <tr className="text-base font-black">
                                                        <td className="border border-slate-200 bg-slate-50 px-3 py-4 text-right text-slate-950">{formatProgressMoney(activeGroup.totals.contractAmount)}</td>
                                                        <td className="border border-amber-100 bg-amber-50 px-3 py-4 text-right text-amber-800">{formatProgressMoney(activeGroup.totals.previousAmount)}</td>
                                                        <td className="border border-indigo-100 bg-indigo-50 px-3 py-4 text-right text-indigo-700">{formatProgressMoney(activeGroup.totals.currentAmount)}</td>
                                                        <td className="border border-emerald-100 bg-emerald-50 px-3 py-4 text-right text-emerald-700">{formatProgressMoney(activeGroup.totals.cumulativeAmount)}</td>
                                                        <td className={`border border-rose-100 bg-rose-50 px-3 py-4 text-right ${activeGroup.totals.remainingAmount < 0 ? 'text-rose-700' : 'text-rose-600'}`}>{formatProgressMoney(activeGroup.totals.remainingAmount)}</td>
                                                        <td className="border border-violet-100 bg-violet-50 px-3 py-4 text-right text-violet-700">{formatProgressRate(activeGroupProgressRate)}</td>
                                                        <td className="border border-cyan-100 bg-cyan-50 px-3 py-4 text-right text-cyan-800">{formatProgressQuantity(activeGroup.totals.manDay)}</td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
                                        <div className="border-b border-slate-100 px-4 py-3">
                                            <h3 className="text-base font-black text-slate-950">현장별 기성 테이블</h3>
                                        </div>
                                        <div className="progress-table-scroll overflow-x-auto">
                                            <table className="progress-table min-w-[1420px] w-full text-sm">
                                                <thead className="text-xs font-black text-white">
                                                    <tr>
                                                        <th className="bg-slate-900 px-3 py-3 text-left">현장</th>
                                                        <th className="bg-slate-900 px-3 py-3 text-left">담당</th>
                                                        <th className="bg-slate-900 px-3 py-3 text-center">구분</th>
                                                        <th className="bg-slate-800 px-3 py-3 text-right">계약</th>
                                                        <th className="bg-amber-600 px-3 py-3 text-right">전회</th>
                                                        <th className="bg-indigo-600 px-3 py-3 text-right">금회</th>
                                                        <th className="bg-emerald-600 px-3 py-3 text-right">누계</th>
                                                        <th className="bg-rose-600 px-3 py-3 text-right">잔여기성</th>
                                                        <th className="bg-violet-600 px-3 py-3 text-right">공정률</th>
                                                        <th className="bg-cyan-700 px-3 py-3 text-right">공수</th>
                                                        <th className="bg-slate-900 px-3 py-3 text-right">스꾸미단가</th>
                                                        <th className="bg-slate-900 px-3 py-3 text-center">상태</th>
                                                        <th className="bg-slate-900 px-3 py-3 text-center">관리</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {activeGroup.rows.map((row) => {
                                                        const siteId = normalizeSiteId(row.site.id);
                                                        const rowProgressRate = row.summary.contractAmount > 0
                                                            ? row.summary.cumulativeAmount / row.summary.contractAmount * 100
                                                            : 0;
                                                        return (
                                                            <React.Fragment key={siteId || row.site.name}>
                                                            <tr className={selectedSiteId === siteId ? 'bg-indigo-50' : 'hover:bg-slate-50'}>
                                                                <td className="px-3 py-3">
                                                                    <div className="font-black text-slate-900">{row.site.name}</div>
                                                                    <div className="text-xs text-slate-500">{row.site.address || '-'}</div>
                                                                </td>
                                                                <td className="px-3 py-3 text-slate-600">
                                                                    <div>{row.site.responsibleTeamName || '-'}</div>
                                                                    <div className="text-xs text-slate-400">{row.site.siteManagerName || '-'}</div>
                                                                </td>
                                                                <td className="px-3 py-3 text-center">{row.site.siteType || '-'}</td>
                                                                <td className="progress-cell-contract px-3 py-3 text-right font-semibold">{formatProgressMoney(row.summary.contractAmount)}</td>
                                                                <td className="progress-cell-previous px-3 py-3 text-right">{formatProgressMoney(row.summary.previousAmount)}</td>
                                                                <td className="progress-cell-current px-3 py-3 text-right font-black">{formatProgressMoney(row.summary.currentAmount)}</td>
                                                                <td className="progress-cell-cumulative px-3 py-3 text-right">{formatProgressMoney(row.summary.cumulativeAmount)}</td>
                                                                <td className={`progress-cell-remaining px-3 py-3 text-right ${row.summary.remainingAmount < 0 ? 'font-bold' : ''}`}>{formatProgressMoney(row.summary.remainingAmount)}</td>
                                                                <td className="px-3 py-3 text-right">
                                                                    <div className="font-black text-violet-700">{formatProgressRate(rowProgressRate)}</div>
                                                                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                                                                        <div
                                                                            className="h-full rounded-full bg-violet-500"
                                                                            style={{ width: `${Math.max(0, Math.min(100, rowProgressRate))}%` }}
                                                                        />
                                                                    </div>
                                                                </td>
                                                                <td className="progress-cell-manday px-3 py-3 text-right">{formatProgressQuantity(row.summary.totalManDay)}</td>
                                                                <td className="px-3 py-3 text-right">{formatProgressMoney(row.summary.sukumiUnitPrice)}</td>
                                                                <td className="px-3 py-3 text-center">
                                                                    <ProgressStatusBadge status={row.claim.status} />
                                                                </td>
                                                                <td className="px-3 py-3 text-center">
                                                                    <div className="min-w-[250px] space-y-2">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                if (requestSiteChange(siteId)) {
                                                                                    setActiveTab('entry');
                                                                                }
                                                                            }}
                                                                            className="w-full rounded border border-slate-200 px-3 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100"
                                                                        >
                                                                            입력
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                            </React.Fragment>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-12 text-center font-bold text-slate-400">
                                    표시할 도급·직영 현장이 없습니다.
                                </div>
                            )}
                        </div>
                    </div>
                </ProgressSection>
            </div>
        );
    };

    const renderContract = (includeSiteSelector = true) => (
        <div className="space-y-4">
            {includeSiteSelector && renderSiteSelector()}
            <ProgressSection
                id="progress-contract-section"
                title="현장별 계약내역"
                description="기성청구 금액은 이 계약내역의 금회 수량 × 계약단가로 계산합니다."
                action={(
                    <>
                        <button type="button" onClick={addExtraProgressLineAndOpen} className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-100">
                            <FontAwesomeIcon icon={faPlus} />
                            계약 없이 기성
                        </button>
                        <button type="button" onClick={addContractItem} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
                            <FontAwesomeIcon icon={faPlus} />
                            행 추가
                        </button>
                        <button type="button" disabled={saving} onClick={() => void saveContract()} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60">
                            <FontAwesomeIcon icon={saving ? faSpinner : faSave} spin={saving} />
                            계약내역 저장
                        </button>
                    </>
                )}
            >
                <div className="progress-table-scroll overflow-x-auto">
                    <table className="progress-table min-w-[1120px] w-full text-sm">
                        <thead className="bg-slate-50 text-xs font-black text-slate-500">
                            <tr>
                                <th className="progress-head-meta px-3 py-2 text-left">분류</th>
                                <th className="progress-head-meta px-3 py-2 text-left">공종명</th>
                                <th className="progress-head-meta px-3 py-2 text-left">구분</th>
                                <th className="progress-head-contract px-3 py-2 text-right">계약수량</th>
                                <th className="progress-head-contract px-3 py-2 text-center">단위</th>
                                <th className="progress-head-contract px-3 py-2 text-right">계약단가</th>
                                <th className="progress-head-contract px-3 py-2 text-right">계약금액</th>
                                <th className="progress-head-action px-3 py-2 text-left">비고</th>
                                <th className="progress-head-success px-3 py-2 text-center">사용</th>
                                <th className="progress-head-danger px-3 py-2 text-center">삭제</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {(contractDraft?.items || []).map((item, index) => {
                                const itemLabel = getContractItemLabel(item, index);
                                return (
                                    <tr key={item.id}>
                                        <td className="progress-cell-meta px-3 py-2"><input aria-label={`${itemLabel} 분류`} value={item.category} onChange={(event) => setContractItem(index, { category: event.target.value })} className={textInputClass} placeholder="시스템동바리/시스템비계" /></td>
                                        <td className="progress-cell-meta px-3 py-2"><input aria-label={`${itemLabel} 공종명`} value={item.workName} onChange={(event) => setContractItem(index, { workName: event.target.value })} className={textInputClass} placeholder="A구간/B구역" /></td>
                                        <td className="progress-cell-meta px-3 py-2"><input aria-label={`${itemLabel} 구분`} value={item.workType} onChange={(event) => setContractItem(index, { workType: event.target.value })} className={textInputClass} placeholder="설치/해체/직영" /></td>
                                        <td className="progress-cell-contract px-3 py-2"><input aria-label={`${itemLabel} 계약수량`} type="text" inputMode="decimal" value={formatProgressQuantity(item.contractQuantity)} onChange={(event) => setContractItem(index, { contractQuantity: toProgressNumber(event.target.value) })} className={numberInputClass} /></td>
                                        <td className="progress-cell-contract px-3 py-2"><input aria-label={`${itemLabel} 단위`} value={item.unit} onChange={(event) => setContractItem(index, { unit: event.target.value })} className={`${textInputClass} text-center`} /></td>
                                        <td className="progress-cell-contract px-3 py-2"><input aria-label={`${itemLabel} 계약단가`} type="text" inputMode="numeric" value={formatProgressMoney(item.unitPrice)} onChange={(event) => setContractItem(index, { unitPrice: toProgressNumber(event.target.value) })} className={numberInputClass} /></td>
                                        <td className="progress-cell-contract px-3 py-2 text-right font-black">{formatProgressMoney(getContractItemAmount(item))}</td>
                                        <td className="progress-cell-action px-3 py-2"><input aria-label={`${itemLabel} 비고`} value={item.remark || ''} onChange={(event) => setContractItem(index, { remark: event.target.value })} className={textInputClass} /></td>
                                        <td className="progress-cell-success px-3 py-2 text-center"><input aria-label={`${itemLabel} 사용 여부`} type="checkbox" checked={item.active !== false} onChange={(event) => setContractItem(index, { active: event.target.checked })} /></td>
                                        <td className="progress-cell-danger px-3 py-2 text-center">
                                            <button type="button" aria-label={`${itemLabel} 계약내역 삭제`} onClick={() => removeContractItem(item.id)} className="inline-flex h-8 w-8 items-center justify-center rounded border border-rose-200 text-rose-600 hover:bg-rose-50">
                                                <FontAwesomeIcon icon={faTrash} />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                            {(contractDraft?.items || []).length === 0 && (
                                <tr><td colSpan={10} className="px-4 py-10 text-center font-bold text-slate-400">계약내역을 추가하세요.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="border-t border-slate-100 p-4">
                    <label>
                        <span className="text-xs font-black text-slate-500">계약 메모</span>
                        <textarea
                            aria-label="계약 메모"
                            value={contractDraft?.memo || ''}
                            onChange={(event) => setContractDraft((current) => current ? { ...current, memo: event.target.value } : current)}
                            className={`${textInputClass} mt-1 min-h-[70px]`}
                        />
                    </label>
                </div>
            </ProgressSection>
        </div>
    );

    const renderProgressInput = (includeSiteSelector = true, showSummary = true) => {
        const computed = selectedComputed;
        const currentLineById = new Map((claimDraft?.progressLines || []).map((line) => [line.itemId, line]));
        const itemRows = computed?.itemRows || [];
        const warningItemIds = new Set(entryAudit.issues.map((issue) => issue.itemId));
        const filteredItemRows = itemRows.filter((row) => {
            const isExtra = row.source === 'extra';
            const included = isExtra || currentLineById.has(row.item.id);
            if (entryFilter === 'included') return included;
            if (entryFilter === 'missing') return !isExtra && !included;
            if (entryFilter === 'warning') return warningItemIds.has(row.item.id);
            if (entryFilter === 'extra') return isExtra;
            return true;
        });
        const filterItems: Array<{ key: EntryFilterKey; label: string; count: number }> = [
            { key: 'all', label: '전체', count: itemRows.length },
            { key: 'included', label: '금회 포함', count: entryAudit.includedCount },
            { key: 'missing', label: '미포함', count: entryAudit.missingCount },
            { key: 'warning', label: '확인 필요', count: warningItemIds.size },
            { key: 'extra', label: '추가항목', count: entryAudit.extraCount },
        ];
        return (
            <div className="space-y-4">
                {includeSiteSelector && renderSiteSelector()}
                {showSummary && computed && (
                    <div className="grid gap-3 md:grid-cols-5">
                        {[
                            ['계약금액', computed.summary.contractAmount],
                            ['전회기성', computed.summary.previousAmount],
                            ['금회기성', computed.summary.currentAmount],
                            ['누계기성', computed.summary.cumulativeAmount],
                            ['잔여기성', computed.summary.remainingAmount],
                        ].map(([label, value]) => (
                            <ProgressMetricCard
                                key={String(label)}
                                label={String(label)}
                                value={formatProgressMoney(value)}
                                tone={label === '금회기성' ? 'accent' : 'default'}
                                surface="white"
                                className="p-4"
                            />
                        ))}
                    </div>
                )}
                <ProgressSection
                    id="progress-monthly-section"
                    title="월별 기성입력"
                    description="계약 항목은 금회 포함 여부를 선택하고, 계약 외 항목은 추가 기성 행으로 입력합니다."
                    action={(
                        <>
                            {filterItems.map((filter) => (
                                <button
                                    key={filter.key}
                                    type="button"
                                    onClick={() => setEntryFilter(filter.key)}
                                    className={`rounded-lg border px-3 py-2 text-sm font-black transition ${entryFilter === filter.key
                                        ? 'border-slate-900 bg-slate-900 text-white'
                                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                        }`}
                                >
                                    {filter.label} <span className="ml-1 text-xs opacity-75">{filter.count}</span>
                                </button>
                            ))}
                            <button type="button" onClick={addExtraProgressLine} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
                                <FontAwesomeIcon icon={faPlus} />
                                추가 기성 행
                            </button>
                            <button type="button" disabled={saving} onClick={() => void saveClaim()} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60">
                                <FontAwesomeIcon icon={saving ? faSpinner : faSave} spin={saving} />
                                월별 기성 저장
                            </button>
                        </>
                    )}
                >
                    <div className="progress-table-scroll overflow-x-auto">
                        <table className="progress-table min-w-[1580px] w-full text-sm">
                            <thead className="bg-slate-50 text-xs font-black text-slate-500">
                                <tr>
                                    <th className="progress-head-current px-3 py-2 text-center">금회</th>
                                    <th className="progress-head-meta px-3 py-2 text-center">유형</th>
                                    <th className="progress-head-meta px-3 py-2 text-left">분류</th>
                                    <th className="progress-head-meta px-3 py-2 text-left">공종명</th>
                                    <th className="progress-head-meta px-3 py-2 text-left">구분</th>
                                    <th className="progress-head-contract px-3 py-2 text-right">계약수량</th>
                                    <th className="progress-head-contract px-3 py-2 text-center">단위</th>
                                    <th className="progress-head-contract px-3 py-2 text-right">단가</th>
                                    <th className="progress-head-previous px-3 py-2 text-right">전회수량</th>
                                    <th className="progress-head-current px-3 py-2 text-right">금회수량</th>
                                    <th className="progress-head-cumulative px-3 py-2 text-right">누계수량</th>
                                    <th className="progress-head-current px-3 py-2 text-right">금회금액</th>
                                    <th className="progress-head-cumulative px-3 py-2 text-right">누계금액</th>
                                    <th className="progress-head-remaining px-3 py-2 text-right">잔여기성</th>
                                    <th className="progress-head-action px-3 py-2 text-left">비고</th>
                                    <th className="progress-head-danger px-3 py-2 text-center">삭제</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredItemRows.map((row) => {
                                    const currentLine = currentLineById.get(row.item.id);
                                    const line = currentLine || row.line;
                                    const isExtra = row.source === 'extra';
                                    const included = isExtra || Boolean(currentLine);
                                    const rowLabel = getProgressLineLabel(row.item, line);
                                    const rowIssues = entryAudit.issues.filter((issue) => issue.itemId === row.item.id);
                                    return (
                                        <tr key={`${row.source}_${row.item.id}`} className={rowIssues.some((issue) => issue.severity === 'danger') ? 'progress-row-danger' : rowIssues.length > 0 ? 'progress-row-warning' : !included ? 'progress-row-muted text-slate-400' : isExtra ? 'progress-row-extra' : undefined}>
                                            <td className="progress-cell-current px-3 py-2 text-center">
                                                {isExtra ? (
                                                    <span className="inline-flex rounded-full bg-emerald-50 px-2 py-1 text-xs font-black text-emerald-700">추가</span>
                                                ) : (
                                                    <input
                                                        type="checkbox"
                                                        checked={included}
                                                        onChange={(event) => setProgressLineIncluded(row.item.id, event.target.checked)}
                                                        aria-label={`${row.item.workName || '계약항목'} 금회 포함`}
                                                    />
                                                )}
                                            </td>
                                            <td className="progress-cell-meta px-3 py-2 text-center">
                                                <span className={`inline-flex rounded-full px-2 py-1 text-xs font-black ${isExtra ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                                    {isExtra ? '추가' : '계약'}
                                                </span>
                                            </td>
                                            <td className="progress-cell-meta px-3 py-2">
                                                {isExtra ? (
                                                    <input aria-label={`${rowLabel} 추가 기성 분류`} value={line?.category ?? row.item.category} onChange={(event) => updateExtraProgressLine(row.item.id, { category: event.target.value })} className={textInputClass} placeholder="시스템동바리/시스템비계" />
                                                ) : row.item.category || '-'}
                                            </td>
                                            <td className="progress-cell-meta px-3 py-2 font-semibold text-slate-900">
                                                {isExtra ? (
                                                    <input aria-label={`${rowLabel} 추가 기성 공종명`} value={line?.workName ?? ''} onChange={(event) => updateExtraProgressLine(row.item.id, { workName: event.target.value })} className={textInputClass} placeholder="A구간/B구역" />
                                                ) : row.item.workName || '-'}
                                                {rowIssues.length > 0 && (
                                                    <div className={`mt-1 text-xs font-bold ${rowIssues.some((issue) => issue.severity === 'danger') ? 'text-rose-600' : 'text-amber-700'}`}>
                                                        {rowIssues.map((issue) => issue.message).join(' · ')}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="progress-cell-meta px-3 py-2">
                                                {isExtra ? (
                                                    <input aria-label={`${rowLabel} 추가 기성 구분`} value={line?.workType ?? row.item.workType} onChange={(event) => updateExtraProgressLine(row.item.id, { workType: event.target.value })} className={textInputClass} placeholder="설치/해체/직영" />
                                                ) : row.item.workType || '-'}
                                            </td>
                                            <td className="progress-cell-contract px-3 py-2">
                                                {isExtra ? (
                                                    <input aria-label={`${rowLabel} 추가 기성 계약수량`} type="text" inputMode="decimal" value={formatProgressQuantity(line?.contractQuantity ?? row.item.contractQuantity)} onChange={(event) => updateExtraProgressLine(row.item.id, { contractQuantity: toProgressNumber(event.target.value) })} className={numberInputClass} />
                                                ) : (
                                                    <div className="text-right">{formatProgressQuantity(row.item.contractQuantity)}</div>
                                                )}
                                            </td>
                                            <td className="progress-cell-contract px-3 py-2">
                                                {isExtra ? (
                                                    <input aria-label={`${rowLabel} 추가 기성 단위`} value={line?.unit ?? row.item.unit} onChange={(event) => updateExtraProgressLine(row.item.id, { unit: event.target.value })} className={`${textInputClass} text-center`} />
                                                ) : (
                                                    <div className="text-center">{row.item.unit}</div>
                                                )}
                                            </td>
                                            <td className="progress-cell-contract px-3 py-2">
                                                {isExtra ? (
                                                    <input aria-label={`${rowLabel} 추가 기성 단가`} type="text" inputMode="numeric" value={formatProgressMoney(line?.unitPrice ?? row.item.unitPrice)} onChange={(event) => updateExtraProgressLine(row.item.id, { unitPrice: toProgressNumber(event.target.value) })} className={numberInputClass} />
                                                ) : (
                                                    <div className="text-right">{formatProgressMoney(row.item.unitPrice)}</div>
                                                )}
                                            </td>
                                            <td className="progress-cell-previous px-3 py-2 text-right">{formatProgressQuantity(row.previousQuantity)}</td>
                                            <td className="progress-cell-current px-3 py-2">
                                                <input
                                                    aria-label={`${rowLabel} 금회수량`}
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={formatProgressQuantity(row.currentQuantity)}
                                                    onChange={(event) => isExtra
                                                        ? updateExtraProgressLine(row.item.id, { currentQuantity: toProgressNumber(event.target.value) })
                                                        : updateProgressLine(row.item.id, event.target.value)}
                                                    disabled={!included}
                                                    className={`${numberInputClass} disabled:bg-slate-100 disabled:text-slate-400`}
                                                />
                                            </td>
                                            <td className="progress-cell-cumulative px-3 py-2 text-right">{formatProgressQuantity(row.cumulativeQuantity)}</td>
                                            <td className="progress-cell-current px-3 py-2 text-right font-black text-indigo-700">{formatProgressMoney(row.currentAmount)}</td>
                                            <td className="progress-cell-cumulative px-3 py-2 text-right">{formatProgressMoney(row.cumulativeAmount)}</td>
                                            <td className={`progress-cell-remaining px-3 py-2 text-right ${row.remainingAmount < 0 ? 'font-bold text-rose-600' : ''}`}>{formatProgressMoney(row.remainingAmount)}</td>
                                            <td className="progress-cell-action px-3 py-2">
                                                {isExtra ? (
                                                    <input aria-label={`${rowLabel} 추가 기성 비고`} value={line?.memo ?? ''} onChange={(event) => updateExtraProgressLine(row.item.id, { memo: event.target.value })} className={textInputClass} />
                                                ) : row.item.remark || '-'}
                                            </td>
                                            <td className="progress-cell-danger px-3 py-2 text-center">
                                                {isExtra && currentLine ? (
                                                    <button type="button" aria-label={`${rowLabel} 추가 기성 삭제`} onClick={() => removeExtraProgressLine(row.item.id)} className="inline-flex h-8 w-8 items-center justify-center rounded border border-rose-200 text-rose-600 hover:bg-rose-50">
                                                        <FontAwesomeIcon icon={faTrash} />
                                                    </button>
                                                ) : '-'}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filteredItemRows.length === 0 && (
                                    <tr><td colSpan={16} className="px-4 py-10 text-center font-bold text-slate-400">{itemRows.length === 0 ? '계약내역을 등록하거나 추가 기성 행을 추가하세요.' : '현재 필터에 해당하는 행이 없습니다.'}</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </ProgressSection>
            </div>
        );
    };



    const renderEntry = () => {
        const summary = selectedComputed?.summary;
        const activeItemCount = (contractDraft?.items || []).filter((item) => item.active !== false).length;
        const progressInputCount = (claimDraft?.progressLines || []).filter((line) => toProgressNumber(line.currentQuantity) > 0).length;
        const extraProgressCount = entryAudit.extraCount;
        const entryHasDanger = entryAudit.dangerCount > 0;

        return (
            <div className="space-y-4 pb-20">
                {renderSiteSelector()}
                <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <h2 className="text-lg font-black text-slate-900">계약/기성입력</h2>
                            <p className="mt-1 text-sm text-slate-500">계약내역과 금회 기성을 같은 화면에서 입력하고, 누락·초과·단가 오류를 바로 점검합니다.</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={() => scrollToProgressSection('progress-contract-section')} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 hover:bg-slate-50">
                                계약내역
                            </button>
                            <button type="button" onClick={() => scrollToProgressSection('progress-monthly-section')} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 hover:bg-slate-50">
                                금회수량
                            </button>
                        </div>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                        {renderCompactMetric('계약 항목', `${activeItemCount}개`)}
                        {renderCompactMetric('추가 기성', `${extraProgressCount}건`)}
                        {renderCompactMetric('금회 포함', `${entryAudit.includedCount}건`)}
                        {renderCompactMetric('계약금액', formatProgressMoney(summary?.contractAmount || 0))}
                        {renderCompactMetric('금회기성', formatProgressMoney(summary?.currentAmount || 0), 'accent')}
                        {renderCompactMetric('검증', entryAudit.warningCount > 0 ? `${entryAudit.warningCount}건` : '정상', entryHasDanger ? 'danger' : entryAudit.warningCount > 0 ? 'accent' : 'success')}
                    </div>
                    <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_360px]">
                        <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                            <span className="font-black text-slate-900">{selectedSite?.name || '현장 미선택'}</span>
                            <span className="mx-2 text-slate-300">|</span>
                            입력된 금회수량 {progressInputCount}건
                            <span className="mx-2 text-slate-300">|</span>
                            미포함 계약항목 {entryAudit.missingCount}건
                            <span className="mx-2 text-slate-300">|</span>
                            저장상태 {hasUnsavedChanges ? '변경 있음' : '저장됨'}
                        </div>
                        <div className={`rounded-lg border px-4 py-3 text-sm ${entryAudit.warningCount > 0 ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
                            <div className="font-black">{entryAudit.warningCount > 0 ? '확인 필요' : '검증 통과'}</div>
                            <div className="mt-1 text-xs">
                                {entryAudit.issues[0]
                                    ? `${entryAudit.issues[0].label}: ${entryAudit.issues[0].message}`
                                    : '현재 입력값에서 즉시 확인할 오류가 없습니다.'}
                            </div>
                        </div>
                    </div>
                </section>
                {renderContract(false)}
                {renderProgressInput(false, false)}
                {hasUnsavedChanges && (
                    <div className="fixed bottom-4 left-4 right-4 z-30 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-lg md:left-auto md:right-6 md:w-[560px]">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div>
                                <div className="text-sm font-black text-slate-900">저장하지 않은 변경사항이 있습니다.</div>
                                <div className="mt-1 text-xs text-slate-500">
                                    계약 {hasUnsavedContractChanges ? '변경됨' : '변경 없음'} · 월별 기성 {hasUnsavedClaimChanges ? '변경됨' : '변경 없음'}
                                </div>
                            </div>
                            <div className="flex justify-end gap-2">
                                <button type="button" onClick={resetEntryDrafts} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 hover:bg-slate-50">
                                    되돌리기
                                </button>
                                <button type="button" onClick={() => void saveEntryDrafts()} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-black text-white hover:bg-indigo-700 disabled:opacity-60">
                                    <FontAwesomeIcon icon={saving ? faSpinner : faSave} spin={saving} />
                                    전체 저장
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderBuyback = () => {
        return <FieldBuybackWorkbookPage />;
    };

    const renderLedger = () => {
        const detailRows = selectedLedgerRows.flatMap((ledgerRow) =>
            ledgerRow.itemRows.map((itemRow) => ({ claim: ledgerRow.claim, itemRow }))
        );
        const currentLedgerRow = selectedLedgerRows.find((row) => row.claim.yearMonth === yearMonth)
            || selectedLedgerRows[selectedLedgerRows.length - 1];
        const ledgerManDayTotal = selectedLedgerRows.reduce((sum, row) => sum + row.summary.totalManDay, 0);

        return (
            <div className="space-y-4">
                {renderSiteSelector()}
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <ProgressMetricCard label="관리월" value={`${selectedLedgerRows.length}개월`} surface="white" className="p-4" />
                    <ProgressMetricCard label="계약금액" value={formatProgressMoney(currentLedgerRow?.summary.contractAmount || 0)} surface="white" className="p-4" />
                    <ProgressMetricCard label="누계기성" value={formatProgressMoney(currentLedgerRow?.summary.cumulativeAmount || 0)} tone="accent" surface="white" className="p-4" />
                    <ProgressMetricCard label="잔여기성" value={formatProgressMoney(currentLedgerRow?.summary.remainingAmount || 0)} tone={(currentLedgerRow?.summary.remainingAmount || 0) < 0 ? 'danger' : 'default'} surface="white" className="p-4" />
                    <ProgressMetricCard label="누적 공수" value={formatProgressQuantity(ledgerManDayTotal)} surface="white" className="p-4" />
                </div>
                <ProgressSection
                    title="현장별 월별 기성관리대장"
                    description="선택 현장의 월별 기성, 공수, 스꾸미, 바이백, 관계자 배분 흐름을 누계로 확인합니다."
                    action={(
                        <span className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-700">
                            {selectedSite?.name || '현장 미선택'}
                        </span>
                    )}
                >
                    <div className="progress-table-scroll overflow-x-auto">
                        <table className="progress-table min-w-[1500px] w-full text-sm">
                            <thead className="bg-slate-900 text-xs font-black text-white">
                                <tr>
                                    <th className="progress-head-meta px-3 py-3 text-center">청구월</th>
                                    <th className="progress-head-meta px-3 py-3 text-center">상태</th>
                                    <th className="progress-head-contract px-3 py-3 text-right">계약금액</th>
                                    <th className="progress-head-previous px-3 py-3 text-right">전회기성</th>
                                    <th className="progress-head-current px-3 py-3 text-right">금회기성</th>
                                    <th className="progress-head-cumulative px-3 py-3 text-right">누계기성</th>
                                    <th className="progress-head-remaining px-3 py-3 text-right">잔여기성</th>
                                    <th className="progress-head-cumulative px-3 py-3 text-right">기성률</th>
                                    <th className="progress-head-manday px-3 py-3 text-right">공수</th>
                                    <th className="progress-head-manday px-3 py-3 text-right">스꾸미 단가</th>
                                    <th className="progress-head-buyback px-3 py-3 text-right">바이백 가능금액</th>
                                    <th className="progress-head-buyback px-3 py-3 text-right">배분기준</th>
                                    <th className="progress-head-buyback px-3 py-3 text-right">배분합계</th>
                                    <th className="progress-head-current px-3 py-3 text-right">청구금액</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {selectedLedgerRows.map((row) => {
                                    const progressRate = row.summary.contractAmount > 0
                                        ? row.summary.cumulativeAmount / row.summary.contractAmount * 100
                                        : 0;
                                    return (
                                        <tr key={row.claim.yearMonth} className={row.claim.yearMonth === yearMonth ? 'bg-indigo-50' : 'hover:bg-slate-50'}>
                                            <td className="progress-cell-meta px-3 py-3 text-center font-black">{row.claim.yearMonth}</td>
                                            <td className="progress-cell-meta px-3 py-3 text-center">
                                                <ProgressStatusBadge status={row.claim.status} />
                                            </td>
                                            <td className="progress-cell-contract px-3 py-3 text-right">{formatProgressMoney(row.summary.contractAmount)}</td>
                                            <td className="progress-cell-previous px-3 py-3 text-right">{formatProgressMoney(row.summary.previousAmount)}</td>
                                            <td className="progress-cell-current px-3 py-3 text-right font-black text-indigo-700">{formatProgressMoney(row.summary.currentAmount)}</td>
                                            <td className="progress-cell-cumulative px-3 py-3 text-right">{formatProgressMoney(row.summary.cumulativeAmount)}</td>
                                            <td className={`progress-cell-remaining px-3 py-3 text-right ${row.summary.remainingAmount < 0 ? 'font-bold text-rose-600' : ''}`}>{formatProgressMoney(row.summary.remainingAmount)}</td>
                                            <td className="progress-cell-cumulative px-3 py-3 text-right">{progressRate.toFixed(1)}%</td>
                                            <td className="progress-cell-manday px-3 py-3 text-right">{formatProgressQuantity(row.summary.totalManDay)}</td>
                                            <td className="progress-cell-manday px-3 py-3 text-right">{formatProgressMoney(row.summary.sukumiUnitPrice)}</td>
                                            <td className="progress-cell-buyback px-3 py-3 text-right">{formatProgressMoney(row.summary.buybackPoolAmount)}</td>
                                            <td className="progress-cell-buyback px-3 py-3 text-right">{formatProgressMoney(row.summary.allocationBaseAmount)}</td>
                                            <td className="progress-cell-buyback px-3 py-3 text-right">{formatProgressMoney(row.summary.allocationAmount)}</td>
                                            <td className="progress-cell-current px-3 py-3 text-right font-black">{formatProgressMoney(row.summary.billingAmount)}</td>
                                        </tr>
                                    );
                                })}
                                {selectedLedgerRows.length === 0 && (
                                    <tr><td colSpan={14} className="px-4 py-10 text-center font-bold text-slate-400">선택 현장의 기성 이력이 없습니다.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </ProgressSection>

                <ProgressSection
                    title="계약내역별 기성관리대장"
                    description="첫 청구월부터 선택월까지 계약 행별 수량과 금액 누계를 확인합니다."
                >
                    <div className="progress-table-scroll overflow-x-auto">
                        <table className="progress-table min-w-[1500px] w-full text-sm">
                            <thead className="bg-slate-50 text-xs font-black text-slate-500">
                                <tr>
                                    <th className="progress-head-meta px-3 py-2 text-center">청구월</th>
                                    <th className="progress-head-meta px-3 py-2 text-left">분류</th>
                                    <th className="progress-head-meta px-3 py-2 text-left">공종명</th>
                                    <th className="progress-head-meta px-3 py-2 text-left">구분</th>
                                    <th className="progress-head-contract px-3 py-2 text-right">계약수량</th>
                                    <th className="progress-head-contract px-3 py-2 text-center">단위</th>
                                    <th className="progress-head-contract px-3 py-2 text-right">단가</th>
                                    <th className="progress-head-contract px-3 py-2 text-right">계약금액</th>
                                    <th className="progress-head-previous px-3 py-2 text-right">전회수량</th>
                                    <th className="progress-head-current px-3 py-2 text-right">금회수량</th>
                                    <th className="progress-head-cumulative px-3 py-2 text-right">누계수량</th>
                                    <th className="progress-head-current px-3 py-2 text-right">금회금액</th>
                                    <th className="progress-head-cumulative px-3 py-2 text-right">누계금액</th>
                                    <th className="progress-head-remaining px-3 py-2 text-right">잔여기성</th>
                                    <th className="progress-head-cumulative px-3 py-2 text-right">기성률</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {detailRows.map(({ claim, itemRow }) => (
                                    <tr key={`${claim.yearMonth}_${itemRow.item.id}`}>
                                        <td className="progress-cell-meta px-3 py-2 text-center font-semibold">{claim.yearMonth}</td>
                                        <td className="progress-cell-meta px-3 py-2">{itemRow.item.category || '-'}</td>
                                        <td className="progress-cell-meta px-3 py-2 font-semibold text-slate-900">{itemRow.item.workName || '-'}</td>
                                        <td className="progress-cell-meta px-3 py-2">{itemRow.item.workType || '-'}</td>
                                        <td className="progress-cell-contract px-3 py-2 text-right">{formatProgressQuantity(itemRow.item.contractQuantity)}</td>
                                        <td className="progress-cell-contract px-3 py-2 text-center">{itemRow.item.unit}</td>
                                        <td className="progress-cell-contract px-3 py-2 text-right">{formatProgressMoney(itemRow.item.unitPrice)}</td>
                                        <td className="progress-cell-contract px-3 py-2 text-right">{formatProgressMoney(itemRow.contractAmount)}</td>
                                        <td className="progress-cell-previous px-3 py-2 text-right">{formatProgressQuantity(itemRow.previousQuantity)}</td>
                                        <td className="progress-cell-current px-3 py-2 text-right font-black text-indigo-700">{formatProgressQuantity(itemRow.currentQuantity)}</td>
                                        <td className="progress-cell-cumulative px-3 py-2 text-right">{formatProgressQuantity(itemRow.cumulativeQuantity)}</td>
                                        <td className="progress-cell-current px-3 py-2 text-right font-black text-indigo-700">{formatProgressMoney(itemRow.currentAmount)}</td>
                                        <td className="progress-cell-cumulative px-3 py-2 text-right">{formatProgressMoney(itemRow.cumulativeAmount)}</td>
                                        <td className={`progress-cell-remaining px-3 py-2 text-right ${itemRow.remainingAmount < 0 ? 'font-bold text-rose-600' : ''}`}>{formatProgressMoney(itemRow.remainingAmount)}</td>
                                        <td className="progress-cell-cumulative px-3 py-2 text-right">{(itemRow.progressRate * 100).toFixed(1)}%</td>
                                    </tr>
                                ))}
                                {detailRows.length === 0 && (
                                    <tr><td colSpan={15} className="px-4 py-10 text-center font-bold text-slate-400">계약내역 또는 월별 기성자료가 없습니다.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </ProgressSection>
            </div>
        );
    };

    const renderTransactionLedger = () => {
        const currentLedgerRow = selectedTransactionLedgerRows.find((row) => row.yearMonth === yearMonth)
            || selectedTransactionLedgerRows[selectedTransactionLedgerRows.length - 1];
        const standardCountTotal = selectedTransactionLedgerRows.reduce((sum, row) => sum + row.standardStatements.length, 0);
        const rentalCountTotal = selectedTransactionLedgerRows.reduce((sum, row) => sum + row.rentalStatements.length, 0);
        const supplyTotal = selectedTransactionLedgerRows.reduce((sum, row) => sum + row.standardSupplyAmount + row.rentalSupplyAmount, 0);
        const totalAmount = selectedTransactionLedgerRows.reduce((sum, row) => sum + row.standardTotalAmount + row.rentalTotalAmount, 0);
        const detailRows = selectedTransactionLedgerRows.flatMap((ledgerRow) => {
            const statementGroups = [
                ...ledgerRow.standardStatements.map((statement) => ({ mode: 'standard' as const, statement })),
                ...ledgerRow.rentalStatements.map((statement) => ({ mode: 'rental' as const, statement })),
            ];

            return statementGroups.flatMap(({ mode, statement }) => (
                (statement.items || []).map((item, itemIndex) => ({
                    ledgerRow,
                    mode,
                    statement,
                    item,
                    itemIndex,
                }))
            ));
        });

        const renderStatementList = (statements: Estimate[], emptyText: string) => (
            <div className="space-y-1">
                {statements.map((statement) => (
                    <div key={statement.id || statement.estimateNo || statement.title} className="rounded border border-slate-200 bg-white px-2 py-1">
                        <div className="truncate font-bold text-slate-800">{statement.title || statement.projectName || '-'}</div>
                        <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] font-bold text-slate-500">
                            <span>{statement.estimateNo || '문서번호 없음'}</span>
                            <span>{statement.issueDate || '-'}</span>
                            <span>{formatProgressMoney(statement.total || 0)}</span>
                        </div>
                    </div>
                ))}
                {statements.length === 0 && <div className="text-xs font-bold text-slate-400">{emptyText}</div>}
            </div>
        );

        return (
            <div className="space-y-4">
                {renderSiteSelector()}
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <ProgressMetricCard label="관리월" value={`${selectedTransactionLedgerRows.length}개월`} surface="white" className="p-4" />
                    <ProgressMetricCard label="거래명세" value={`${standardCountTotal}건`} surface="white" className="p-4" />
                    <ProgressMetricCard label="임대거래" value={`${rentalCountTotal}건`} surface="white" className="p-4" />
                    <ProgressMetricCard label="공급가 합계" value={formatProgressMoney(supplyTotal)} tone="accent" surface="white" className="p-4" />
                    <ProgressMetricCard label="총 합계" value={formatProgressMoney(totalAmount)} tone="accent" surface="white" className="p-4" />
                </div>

                <ProgressSection
                    title="현장별 월별 거래명세 대장"
                    description="선택 현장의 월별 거래명세와 임대거래 발행 현황을 기성 월별 대장과 같은 방식으로 관리합니다."
                    action={(
                        <span className="rounded-full border border-teal-100 bg-teal-50 px-3 py-1 text-xs font-black text-teal-700">
                            {selectedSite?.name || '현장 미선택'}
                        </span>
                    )}
                >
                    <div className="progress-table-scroll overflow-x-auto">
                        <table className="progress-table min-w-[1500px] w-full text-sm">
                            <thead className="bg-slate-900 text-xs font-black text-white">
                                <tr>
                                    <th className="progress-head-meta px-3 py-3 text-center">청구월</th>
                                    <th className="progress-head-meta px-3 py-3 text-center">기성상태</th>
                                    <th className="progress-head-current px-3 py-3 text-center">거래명세</th>
                                    <th className="progress-head-buyback px-3 py-3 text-center">임대거래</th>
                                    <th className="progress-head-current px-3 py-3 text-right">공급가</th>
                                    <th className="progress-head-current px-3 py-3 text-right">VAT</th>
                                    <th className="progress-head-cumulative px-3 py-3 text-right">합계</th>
                                    <th className="progress-head-contract px-3 py-3 text-right">기성청구금액</th>
                                    <th className="progress-head-remaining px-3 py-3 text-right">차액</th>
                                    <th className="progress-head-meta px-3 py-3 text-center">최근수정</th>
                                    <th className="progress-head-meta px-3 py-3 text-left">문서</th>
                                    <th className="progress-head-action px-3 py-3 text-center">관리</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {selectedTransactionLedgerRows.map((row) => {
                                    const rowSupply = row.standardSupplyAmount + row.rentalSupplyAmount;
                                    const rowTax = row.standardTaxAmount + row.rentalTaxAmount;
                                    const rowTotal = row.standardTotalAmount + row.rentalTotalAmount;
                                    const diffAmount = rowTotal - row.summary.billingAmount;
                                    const isCurrent = row.yearMonth === yearMonth;

                                    return (
                                        <tr key={row.yearMonth} className={isCurrent ? 'bg-indigo-50' : 'hover:bg-slate-50'}>
                                            <td className="progress-cell-meta px-3 py-3 text-center font-black">{row.yearMonth}</td>
                                            <td className="progress-cell-meta px-3 py-3 text-center">
                                                <ProgressStatusBadge status={row.claim.status} />
                                            </td>
                                            <td className="progress-cell-current px-3 py-3 text-center font-black">{row.standardStatements.length}건</td>
                                            <td className="progress-cell-buyback px-3 py-3 text-center font-black">{row.rentalStatements.length}건</td>
                                            <td className="progress-cell-current px-3 py-3 text-right">{formatProgressMoney(rowSupply)}</td>
                                            <td className="progress-cell-current px-3 py-3 text-right">{formatProgressMoney(rowTax)}</td>
                                            <td className="progress-cell-cumulative px-3 py-3 text-right font-black">{formatProgressMoney(rowTotal)}</td>
                                            <td className="progress-cell-contract px-3 py-3 text-right">{formatProgressMoney(row.summary.billingAmount)}</td>
                                            <td className={`progress-cell-remaining px-3 py-3 text-right ${diffAmount !== 0 ? 'font-black text-rose-600' : 'font-bold text-emerald-700'}`}>
                                                {formatProgressMoney(diffAmount)}
                                            </td>
                                            <td className="progress-cell-meta px-3 py-3 text-center text-xs font-bold text-slate-500">
                                                {formatProgressDateTime(row.latestStatement?.updatedAt || row.latestStatement?.issueDate)}
                                            </td>
                                            <td className="progress-cell-meta px-3 py-3">
                                                <div className="grid gap-2 xl:grid-cols-2">
                                                    {renderStatementList(row.standardStatements, '거래명세 없음')}
                                                    {renderStatementList(row.rentalStatements, '임대거래 없음')}
                                                </div>
                                            </td>
                                            <td className="progress-cell-action px-3 py-3">
                                                <div className="flex flex-wrap justify-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => openTransactionLedgerStatement(row, 'standard')}
                                                        className="inline-flex h-8 items-center justify-center rounded-md border border-teal-200 bg-white px-3 text-xs font-black text-teal-700 transition hover:bg-teal-50"
                                                    >
                                                        거래명세
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => openTransactionLedgerStatement(row, 'rental')}
                                                        className="inline-flex h-8 items-center justify-center rounded-md border border-amber-200 bg-white px-3 text-xs font-black text-amber-700 transition hover:bg-amber-50"
                                                    >
                                                        임대거래
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {selectedTransactionLedgerRows.length === 0 && (
                                    <tr><td colSpan={12} className="px-4 py-10 text-center font-bold text-slate-400">선택 현장의 거래명세 관리 이력이 없습니다.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </ProgressSection>

                <ProgressSection
                    title="거래명세 품목별 대장"
                    description="연결된 거래명세와 임대거래의 품목을 월별로 펼쳐서 확인합니다."
                    action={currentLedgerRow ? (
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black text-slate-600">
                            현재 {currentLedgerRow.yearMonth}
                        </span>
                    ) : undefined}
                >
                    <div className="progress-table-scroll overflow-x-auto">
                        <table className="progress-table min-w-[1500px] w-full text-sm">
                            <thead className="bg-slate-50 text-xs font-black text-slate-500">
                                <tr>
                                    <th className="progress-head-meta px-3 py-2 text-center">청구월</th>
                                    <th className="progress-head-meta px-3 py-2 text-center">종류</th>
                                    <th className="progress-head-meta px-3 py-2 text-left">문서번호</th>
                                    <th className="progress-head-meta px-3 py-2 text-left">문서명</th>
                                    <th className="progress-head-meta px-3 py-2 text-left">거래처</th>
                                    <th className="progress-head-meta px-3 py-2 text-center">작성일</th>
                                    <th className="progress-head-current px-3 py-2 text-left">품목</th>
                                    <th className="progress-head-current px-3 py-2 text-left">구분/규격</th>
                                    <th className="progress-head-current px-3 py-2 text-right">수량</th>
                                    <th className="progress-head-current px-3 py-2 text-center">단위</th>
                                    <th className="progress-head-current px-3 py-2 text-right">단가</th>
                                    <th className="progress-head-cumulative px-3 py-2 text-right">공급가</th>
                                    <th className="progress-head-meta px-3 py-2 text-left">비고</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {detailRows.map(({ ledgerRow, mode, statement, item, itemIndex }) => {
                                    const unitPrice = roundMoney(item.finalUnitPrice || item.unitPrice || 0);
                                    const amount = roundMoney(item.amount || unitPrice * toProgressNumber(item.quantity));
                                    const typeLabel = mode === 'rental' ? '임대거래' : '거래명세';

                                    return (
                                        <tr key={`${ledgerRow.yearMonth}_${statement.id || statement.estimateNo}_${item.id || itemIndex}`}>
                                            <td className="progress-cell-meta px-3 py-2 text-center font-semibold">{ledgerRow.yearMonth}</td>
                                            <td className={`px-3 py-2 text-center font-black ${mode === 'rental' ? 'progress-cell-buyback text-amber-700' : 'progress-cell-current text-teal-700'}`}>{typeLabel}</td>
                                            <td className="progress-cell-meta px-3 py-2">{statement.estimateNo || '-'}</td>
                                            <td className="progress-cell-meta px-3 py-2 font-semibold text-slate-900">{statement.title || statement.projectName || '-'}</td>
                                            <td className="progress-cell-meta px-3 py-2">{statement.clientCompany || statement.clientName || '-'}</td>
                                            <td className="progress-cell-meta px-3 py-2 text-center">{statement.issueDate || '-'}</td>
                                            <td className="progress-cell-current px-3 py-2 font-semibold">{item.label || item.section || '-'}</td>
                                            <td className="progress-cell-current px-3 py-2">{[item.category, item.section, item.workType].filter(Boolean).join(' / ') || '-'}</td>
                                            <td className="progress-cell-current px-3 py-2 text-right">{formatProgressQuantity(item.quantity || 0)}</td>
                                            <td className="progress-cell-current px-3 py-2 text-center">{item.unit || '-'}</td>
                                            <td className="progress-cell-current px-3 py-2 text-right">{formatProgressMoney(unitPrice)}</td>
                                            <td className="progress-cell-cumulative px-3 py-2 text-right font-black">{formatProgressMoney(amount)}</td>
                                            <td className="progress-cell-meta px-3 py-2">{item.note || item.remarks || item.etc || '-'}</td>
                                        </tr>
                                    );
                                })}
                                {detailRows.length === 0 && (
                                    <tr><td colSpan={13} className="px-4 py-10 text-center font-bold text-slate-400">연결된 거래명세 품목이 없습니다.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </ProgressSection>
            </div>
        );
    };

    const renderAttachmentList = (items: ProgressAttachment[], scope: ProgressAttachmentScope) => (
        <div className="progress-attachment-list rounded-lg border border-slate-200 bg-white">
            {items.length === 0 && <div className="p-6 text-center text-sm font-bold text-slate-400">첨부파일이 없습니다.</div>}
            {items.map((item) => (
                <div key={item.id} className="progress-attachment-row flex items-center justify-between gap-3 border-b border-slate-100 p-3 last:border-b-0">
                    <div className="min-w-0">
                        <a href={item.url} target="_blank" rel="noreferrer" className="truncate font-bold text-indigo-700 hover:underline">{item.name}</a>
                        <div className="mt-1 text-xs text-slate-400">{item.uploadedAt?.slice(0, 10)} · {item.size ? `${Math.round(item.size / 1024).toLocaleString('ko-KR')}KB` : '-'}</div>
                    </div>
                    <button type="button" aria-label={`${item.name} 첨부 삭제`} onClick={() => void removeAttachment(scope, item.id)} className="inline-flex h-8 w-8 items-center justify-center rounded border border-rose-200 text-rose-600 hover:bg-rose-50">
                        <FontAwesomeIcon icon={faTrash} />
                    </button>
                </div>
            ))}
        </div>
    );

    const renderAttachments = () => (
        <div className="space-y-4">
            {renderSiteSelector()}
            {selectedSite && (
                <ProgressSection title="선택 현장 기본정보">
                    <div className="grid gap-3 p-4 text-sm md:grid-cols-3">
                        <div><span className="font-bold text-slate-500">현장명</span><div className="mt-1 font-black text-slate-900">{selectedSite.name || '-'}</div></div>
                        <div><span className="font-bold text-slate-500">발주사/수신</span><div className="mt-1 font-black text-slate-900">{selectedSite.clientCompanyName || '-'}</div></div>
                        <div><span className="font-bold text-slate-500">시공사</span><div className="mt-1 font-black text-slate-900">{selectedSite.companyName || selectedSite.constructorCompanyName || '-'}</div></div>
                        <div><span className="font-bold text-slate-500">담당팀</span><div className="mt-1 font-black text-slate-900">{selectedSite.responsibleTeamName || '-'}</div></div>
                        <div><span className="font-bold text-slate-500">현장책임자</span><div className="mt-1 font-black text-slate-900">{selectedSite.siteManagerName || '-'}</div></div>
                        <div><span className="font-bold text-slate-500">현장구분</span><div className="mt-1 font-black text-slate-900">{selectedSite.siteType || '-'}</div></div>
                        <div className="md:col-span-3"><span className="font-bold text-slate-500">주소</span><div className="mt-1 font-black text-slate-900">{selectedSite.address || '-'}</div></div>
                    </div>
                </ProgressSection>
            )}
            {uploading && (
                <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-sm font-bold text-indigo-700">
                    첨부 업로드 중... {Math.round(uploadProgress)}%
                </div>
            )}
            <div className="grid gap-4 lg:grid-cols-2">
                <ProgressSection
                    title="현장 공통 첨부"
                    description="계약서, 견적서, 사업자등록증 등 현장 전체에 적용되는 파일입니다."
                    action={(
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-bold text-white hover:bg-indigo-700">
                            <FontAwesomeIcon icon={faPaperclip} />
                            업로드
                            <input
                                type="file"
                                multiple
                                aria-label="현장 공통 첨부 업로드"
                                className="hidden"
                                onChange={(event) => {
                                    const files = Array.from(event.currentTarget.files || []);
                                    event.currentTarget.value = '';
                                    void handleAttachmentUpload('site', files);
                                }}
                            />
                        </label>
                    )}
                >
                    <div className="p-4">{renderAttachmentList(contractDraft?.commonAttachments || EMPTY_ATTACHMENTS, 'site')}</div>
                </ProgressSection>
                <ProgressSection
                    title="월별 청구 첨부"
                    description="해당 월 사진, 거래명세, 확인서, 청구 증빙 파일입니다."
                    action={(
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-bold text-white hover:bg-indigo-700">
                            <FontAwesomeIcon icon={faPaperclip} />
                            업로드
                            <input
                                type="file"
                                multiple
                                aria-label="월별 청구 첨부 업로드"
                                className="hidden"
                                onChange={(event) => {
                                    const files = Array.from(event.currentTarget.files || []);
                                    event.currentTarget.value = '';
                                    void handleAttachmentUpload('claim', files);
                                }}
                            />
                        </label>
                    )}
                >
                    <div className="p-4">{renderAttachmentList(claimDraft?.claimAttachments || EMPTY_ATTACHMENTS, 'claim')}</div>
                </ProgressSection>
            </div>
        </div>
    );

    const renderInvoice = () => {
        const computed = selectedComputed;
        if (!selectedSite || !selectedContract || !selectedClaim || !computed) {
            return <div className="rounded-lg border border-slate-200 bg-white p-10 text-center font-bold text-slate-400">청구서를 출력할 현장을 선택하세요.</div>;
        }

            const { recipient, supplier } = getInvoiceParties(selectedSite);
            const issuedDate = new Date().toLocaleDateString('ko-KR');
            const invoiceNumber = `${yearMonth.replace('-', '')}-${String(selectedSite.id || selectedClaim.siteId || 'SITE').slice(-6).toUpperCase()}`;

            const renderInvoicePartyTable = (
            title: string,
            party: typeof recipient,
            titleClassName: string
        ) => (
            <table className="progress-invoice-party-table w-full border-collapse text-xs">
                <thead>
                    <tr>
                        <th colSpan={4} className={`border px-3 py-2 text-left text-sm font-black ${titleClassName}`}>{title}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <th className="w-24 border px-2 py-2 text-left">등록번호</th>
                        <td colSpan={3} className="border px-2 py-2 font-bold">{party.businessNumber}</td>
                    </tr>
                    <tr>
                        <th className="border px-2 py-2 text-left">상호</th>
                        <td className="border px-2 py-2 font-bold">{party.name}</td>
                        <th className="w-20 border px-2 py-2 text-left">대표자</th>
                        <td className="border px-2 py-2">{party.ceoName}</td>
                    </tr>
                    <tr>
                        <th className="border px-2 py-2 text-left">주소</th>
                        <td colSpan={3} className="border px-2 py-2">{party.address}</td>
                    </tr>
                    <tr>
                        <th className="border px-2 py-2 text-left">구분</th>
                        <td className="border px-2 py-2">{party.type}</td>
                        <th className="border px-2 py-2 text-left">연락처</th>
                        <td className="border px-2 py-2">{party.phone}</td>
                    </tr>
                    <tr>
                        <th className="border px-2 py-2 text-left">담당</th>
                        <td className="border px-2 py-2">{party.manager}</td>
                        <th className="border px-2 py-2 text-left">청구월</th>
                        <td className="border px-2 py-2 font-bold">{yearMonth}</td>
                    </tr>
                </tbody>
            </table>
        );

        return (
            <div className="space-y-4">
                {renderSiteSelector()}
                <ProgressSection
                    title="청구서 옵션"
                    description="부가세, 표시 항목, 상태를 조정하고 출력용 청구서를 확인합니다."
                    className="no-print"
                >
                        <div className="grid gap-3 p-4 md:grid-cols-3">
                        <label>
                            <span className="text-xs font-black text-slate-500">부가세 표시</span>
                            <select aria-label="부가세 표시" value={selectedClaim.vatMode} onChange={(event) => setClaimDraft((current) => current ? { ...current, vatMode: event.target.value as ProgressVatMode } : current)} className={`${selectInputClass} mt-1`}>
                                {Object.entries(PROGRESS_VAT_MODE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                            </select>
                        </label>
                        <label>
                            <span className="text-xs font-black text-slate-500">부가세율</span>
                            <input aria-label="부가세율" type="text" inputMode="decimal" value={formatProgressDecimalInput(Number((selectedClaim.vatRate * 100).toFixed(2)), 2)} onChange={(event) => setClaimDraft((current) => current ? { ...current, vatRate: toProgressNumber(event.target.value) / 100 } : current)} className={`${numberInputClass} mt-1`} />
                        </label>
                        <label className="flex items-center gap-2 pt-6 text-sm font-bold text-slate-700">
                            <input aria-label="관계자 배분 표시" type="checkbox" checked={selectedClaim.showAllocationsOnInvoice} onChange={(event) => setClaimDraft((current) => current ? { ...current, showAllocationsOnInvoice: event.target.checked } : current)} />
                            관계자 배분 표시
                        </label>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 p-4">
                        <button type="button" onClick={() => void saveClaim()} disabled={saving} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
                            <FontAwesomeIcon icon={saving ? faSpinner : faSave} spin={saving} />
                            옵션 저장
                        </button>
                        <button type="button" onClick={confirmClaim} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
                            <FontAwesomeIcon icon={faCheckCircle} />
                            발행전
                        </button>
                        <button type="button" onClick={() => void changeClaimStatus('billed')} disabled={saving} className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-bold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50">
                            발행후
                        </button>
                        <button type="button" onClick={() => void downloadInvoicePdf()} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-bold text-white hover:bg-slate-800">
                            <FontAwesomeIcon icon={faDownload} />
                            PDF 다운로드
                        </button>
                        <button type="button" onClick={downloadInvoiceExcel} className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-100">
                            <FontAwesomeIcon icon={faDownload} />
                            엑셀 다운로드
                        </button>
                    </div>
                </ProgressSection>
                <section id={PROGRESS_INVOICE_ELEMENT_ID} className="progress-invoice progress-invoice-sheet rounded-lg border border-slate-300 bg-white p-8 shadow-sm">
                    <div className="progress-invoice__hero mb-5 grid gap-5 md:grid-cols-[1fr_340px]">
                        <div>
                            <div className="mb-2 inline-flex rounded-full border border-slate-200 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-slate-500">
                                Progress Claim Invoice
                            </div>
                            <h1 className="text-[28px] font-black leading-tight tracking-normal text-slate-950">{yearMonth} 기성청구서</h1>
                            <div className="mt-3 grid gap-2 text-xs font-bold text-slate-600 sm:grid-cols-2">
                                <div><span className="text-slate-400">문서번호</span><div className="mt-1 text-slate-900">{invoiceNumber}</div></div>
                                <div><span className="text-slate-400">작성일</span><div className="mt-1 text-slate-900">{issuedDate}</div></div>
                            </div>
                        </div>
                        <div className="progress-invoice-amount-panel rounded-lg border border-slate-900 bg-slate-950 p-4 text-white">
                            <div className="text-xs font-black text-slate-300">최종 청구금액</div>
                            <div className="mt-2 text-right text-[26px] font-black leading-none">{formatProgressMoney(computed.summary.billingAmount)}</div>
                            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                                <div className="rounded border border-white/10 bg-white/5 px-3 py-2">
                                    <span className="text-slate-300">금회기성</span>
                                    <div className="mt-1 text-right font-black">{formatProgressMoney(computed.summary.currentAmount)}</div>
                                </div>
                                <div className="rounded border border-white/10 bg-white/5 px-3 py-2">
                                    <span className="text-slate-300">잔여기성</span>
                                    <div className="mt-1 text-right font-black">{formatProgressMoney(computed.summary.remainingAmount)}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="progress-invoice__parties mb-4 grid gap-4 md:grid-cols-2">
                        {renderInvoicePartyTable('공급받는자', recipient, 'bg-slate-900 text-white')}
                        {renderInvoicePartyTable('공급자', supplier, 'bg-indigo-700 text-white')}
                    </div>
                    <table className="progress-invoice__site mb-5 w-full border-collapse text-xs">
                        <tbody>
                            <tr>
                                <th className="w-24 border px-2 py-2 text-left">현장명</th>
                                <td className="border px-2 py-2 font-bold">{selectedSite.name}</td>
                                <th className="w-24 border px-2 py-2 text-left">현장주소</th>
                                <td className="border px-2 py-2">{selectedSite.address || '-'}</td>
                                <th className="w-24 border px-2 py-2 text-left">결제구분</th>
                                <td className="border px-2 py-2">{selectedSite.paymentMethod || '-'}</td>
                            </tr>
                        </tbody>
                    </table>
                    <div className="progress-invoice-section-title">기성 상세 내역</div>
                    <div className="progress-table-scroll overflow-x-auto">
                        <table className="progress-invoice-table w-full min-w-[1040px] table-fixed border-collapse text-xs">
                            <colgroup>
                                <col style={{ width: '6%' }} />
                                <col style={{ width: '15%' }} />
                                <col style={{ width: '5%' }} />
                                <col style={{ width: '5%' }} />
                                <col style={{ width: '3.5%' }} />
                                <col style={{ width: '8.5%' }} />
                                <col style={{ width: '5%' }} />
                                <col style={{ width: '8%' }} />
                                <col style={{ width: '5%' }} />
                                <col style={{ width: '8.5%' }} />
                                <col style={{ width: '5%' }} />
                                <col style={{ width: '8.5%' }} />
                                <col style={{ width: '5%' }} />
                                <col style={{ width: '8.5%' }} />
                                <col style={{ width: '3.5%' }} />
                            </colgroup>
                            <thead>
                                <tr className="bg-slate-900 text-white">
                                    <th className="invoice-head-meta border border-slate-700 px-2 py-2" rowSpan={2}>분류</th>
                                    <th className="invoice-head-meta border border-slate-700 px-2 py-2" rowSpan={2}>공종명</th>
                                    <th className="invoice-head-meta border border-slate-700 px-2 py-2" rowSpan={2}>구분</th>
                                    <th className="invoice-head-contract border border-slate-700 px-2 py-2" colSpan={3}>계약</th>
                                    <th className="invoice-head-previous border border-slate-700 px-2 py-2" colSpan={2}>전회</th>
                                    <th className="invoice-head-current border border-slate-700 px-2 py-2" colSpan={2}>금회</th>
                                    <th className="invoice-head-cumulative border border-slate-700 px-2 py-2" colSpan={2}>누계</th>
                                    <th className="invoice-head-remaining border border-slate-700 px-2 py-2" colSpan={2}>잔여기성</th>
                                    <th className="invoice-head-action border border-slate-700 px-2 py-2" rowSpan={2}>비고</th>
                                </tr>
                                <tr className="bg-slate-100 text-slate-700">
                                    <th className="invoice-head-contract border px-2 py-2">수량</th>
                                    <th className="invoice-head-contract border px-2 py-2">단위</th>
                                    <th className="invoice-head-contract border px-2 py-2">금액</th>
                                    <th className="invoice-head-previous border px-2 py-2">수량</th>
                                    <th className="invoice-head-previous border px-2 py-2">금액</th>
                                    <th className="invoice-head-current border px-2 py-2">수량</th>
                                    <th className="invoice-head-current border px-2 py-2">금액</th>
                                    <th className="invoice-head-cumulative border px-2 py-2">수량</th>
                                    <th className="invoice-head-cumulative border px-2 py-2">금액</th>
                                    <th className="invoice-head-remaining border px-2 py-2">수량</th>
                                    <th className="invoice-head-remaining border px-2 py-2">금액</th>
                                </tr>
                            </thead>
                            <tbody>
                                {computed.itemRows.map((row) => (
                                    <tr key={row.item.id}>
                                        <td className="invoice-cell-meta border px-2 py-1 text-center">{row.item.category}</td>
                                        <td className="invoice-cell-meta border px-2 py-1">{row.item.workName}</td>
                                        <td className="invoice-cell-meta border px-2 py-1 text-center">{row.item.workType}</td>
                                        <td className="invoice-cell-contract border px-2 py-1 text-right">{formatProgressQuantity(row.item.contractQuantity)}</td>
                                        <td className="invoice-cell-contract border px-2 py-1 text-center">{row.item.unit}</td>
                                        <td className="invoice-cell-contract border px-2 py-1 text-right">{formatProgressMoney(row.contractAmount)}</td>
                                        <td className="invoice-cell-previous border px-2 py-1 text-right">{formatProgressQuantity(row.previousQuantity)}</td>
                                        <td className="invoice-cell-previous border px-2 py-1 text-right">{formatProgressMoney(row.previousAmount)}</td>
                                        <td className="invoice-cell-current border px-2 py-1 text-right">{formatProgressQuantity(row.currentQuantity)}</td>
                                        <td className="invoice-cell-current border px-2 py-1 text-right font-bold">{formatProgressMoney(row.currentAmount)}</td>
                                        <td className="invoice-cell-cumulative border px-2 py-1 text-right">{formatProgressQuantity(row.cumulativeQuantity)}</td>
                                        <td className="invoice-cell-cumulative border px-2 py-1 text-right">{formatProgressMoney(row.cumulativeAmount)}</td>
                                        <td className={`invoice-cell-remaining border px-2 py-1 text-right ${row.remainingAmount < 0 ? 'font-bold text-rose-700' : ''}`}>{formatProgressQuantity(row.remainingQuantity)}</td>
                                        <td className={`invoice-cell-remaining border px-2 py-1 text-right ${row.remainingAmount < 0 ? 'font-bold text-rose-700' : ''}`}>{formatProgressMoney(row.remainingAmount)}</td>
                                        <td className="invoice-cell-action border px-2 py-1">{row.item.remark || ''}</td>
                                    </tr>
                                ))}
                                {computed.itemRows.length === 0 && (
                                    <tr>
                                        <td colSpan={15} className="border px-4 py-8 text-center font-bold text-slate-400">청구 품목이 없습니다.</td>
                                    </tr>
                                )}
                                <tr className="invoice-total-row bg-slate-50 font-black">
                                    <td colSpan={5} className="border px-2 py-2 text-center">합계</td>
                                    <td className="invoice-cell-contract border px-2 py-2 text-right">{formatProgressMoney(computed.summary.contractAmount)}</td>
                                    <td className="border px-2 py-2"></td>
                                    <td className="invoice-cell-previous border px-2 py-2 text-right">{formatProgressMoney(computed.summary.previousAmount)}</td>
                                    <td className="border px-2 py-2"></td>
                                    <td className="invoice-cell-current border px-2 py-2 text-right">{formatProgressMoney(computed.summary.currentAmount)}</td>
                                    <td className="border px-2 py-2"></td>
                                    <td className="invoice-cell-cumulative border px-2 py-2 text-right">{formatProgressMoney(computed.summary.cumulativeAmount)}</td>
                                    <td className="border px-2 py-2"></td>
                                    <td className={`invoice-cell-remaining border px-2 py-2 text-right ${computed.summary.remainingAmount < 0 ? 'text-rose-700' : ''}`}>{formatProgressMoney(computed.summary.remainingAmount)}</td>
                                    <td className="border px-2 py-2"></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <div className="progress-invoice__summary mt-5 grid gap-4 md:grid-cols-[1fr_1.35fr]">
                        <table className="progress-invoice-summary-table w-full border-collapse text-sm">
                            <tbody>
                                <tr><th className="border bg-slate-50 px-3 py-2 text-left">출력일보 공수</th><td className="border px-3 py-2 text-right font-bold">{formatProgressQuantity(computed.summary.totalManDay)}</td></tr>
                            </tbody>
                        </table>
                        <table className="progress-invoice-summary-table w-full border-collapse text-sm">
                            <tbody>
                                {selectedClaim.vatMode !== 'none' && (
                                    <>
                                        <tr><th className="border bg-slate-50 px-3 py-2 text-left">공급가액</th><td className="border px-3 py-2 text-right font-bold">{formatProgressMoney(computed.summary.supplyAmount)}</td></tr>
                                        <tr><th className="border bg-slate-50 px-3 py-2 text-left">부가세</th><td className="border px-3 py-2 text-right font-bold">{formatProgressMoney(computed.summary.vatAmount)}</td></tr>
                                    </>
                                )}
                                <tr><th className="border bg-rose-50 px-3 py-2 text-left text-rose-700">잔여기성</th><td className={`border px-3 py-2 text-right font-bold ${computed.summary.remainingAmount < 0 ? 'text-rose-700' : 'text-rose-600'}`}>{formatProgressMoney(computed.summary.remainingAmount)}</td></tr>
                                <tr><th className="border bg-slate-900 px-3 py-2 text-left text-white">청구금액</th><td className="border bg-slate-900 px-3 py-2 text-right text-lg font-black text-white">{formatProgressMoney(computed.summary.billingAmount)}</td></tr>
                            </tbody>
                        </table>
                    </div>
                    {(computed.summary.buybackPoolAmount !== 0 || selectedClaim.showAllocationsOnInvoice) && (
                        <div className="progress-invoice__optional-section mt-5">
                            <h3 className="progress-invoice-section-title">바이백/팀포지션 요약</h3>
                            <table className="progress-invoice-buyback-table w-full border-collapse text-xs">
                                <thead className="bg-slate-100">
                                    <tr>
                                        <th className="border px-2 py-2">팀포지션 기준</th>
                                        <th className="border px-2 py-2">팀포지션 금액</th>
                                        <th className="border px-2 py-2">바이백 가능금액</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td className="border px-2 py-1 text-center">{getTeamPositionModeLabel(computed.summary.teamPositionMode)}</td>
                                        <td className="border px-2 py-1 text-right">{formatProgressMoney(computed.summary.teamPositionAmount)}</td>
                                        <td className="border px-2 py-1 text-right font-bold">{formatProgressMoney(computed.summary.buybackPoolAmount)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    )}
                    {selectedClaim.showAllocationsOnInvoice && (
                        <div className="progress-invoice__optional-section mt-5">
                            <h3 className="progress-invoice-section-title">관계자 배분</h3>
                            <table className="progress-invoice-allocation-table w-full border-collapse text-xs">
                                <thead className="bg-slate-100"><tr><th className="border px-2 py-2">관계자</th><th className="border px-2 py-2">방식</th><th className="border px-2 py-2">금액</th><th className="border px-2 py-2">메모</th></tr></thead>
                                <tbody>
                                    {computed.allocationRows.map((row) => (
                                        <tr key={row.allocation.id}><td className="border px-2 py-1">{row.allocation.targetName}</td><td className="border px-2 py-1 text-center">{PROGRESS_ALLOCATION_METHOD_LABELS[row.allocation.method]}</td><td className="border px-2 py-1 text-right">{formatProgressMoney(row.amount)}</td><td className="border px-2 py-1">{row.allocation.memo || ''}</td></tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    <div className="progress-invoice__footer mt-6 border-t border-slate-200 pt-3 text-right text-[11px] font-bold text-slate-400">
                        본 문서는 CY ERP에서 생성된 기성청구서입니다.
                    </div>
                </section>
            </div>
        );
    };

    const renderActiveTab = () => {
        if (isInvoiceOnlyPage) return renderInvoice();
        if (activeTab === 'overview') return renderOverview();
        if (activeTab === 'entry') return renderEntry();
        if (activeTab === 'buyback') return renderBuyback();
        if (activeTab === 'ledger') return renderLedger();
        if (activeTab === 'transaction-ledger') return renderTransactionLedger();
        if (activeTab === 'attachments') return renderAttachments();
        return renderInvoice();
    };

    const hasStatementPageOpen = Boolean(laborStatementPanel || transactionStatementPanel);
    const pageTitle = isInvoiceOnlyPage ? '기성청구서' : '기성관리';
    const pageEyebrow = isInvoiceOnlyPage ? 'Progress Invoice' : 'Progress Billing';
    const pageDescription = isInvoiceOnlyPage
        ? '현장과 청구월을 선택해 기성청구서를 독립 문서로 저장하고 출력합니다.'
        : '계약내역 기준 기성청구서와 출력일보 공수 기반 관계자 배분을 함께 관리합니다.';

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-6" aria-busy={loading || masterLoading}>
            <style>
                {`
                .progress-buyback-excel {
                  font-family: "Malgun Gothic", "Apple SD Gothic Neo", Arial, sans-serif;
                }
                .progress-buyback-excel > section,
                .progress-buyback-excel section {
                  border-radius: 0 !important;
                  box-shadow: none !important;
                }
                .progress-buyback-excel button,
                .progress-buyback-excel input,
                .progress-buyback-excel select,
                .progress-buyback-excel textarea {
                  border-radius: 0 !important;
                }
                .progress-buyback-excel #progress-buyback-section,
                .progress-buyback-excel #progress-allocation-section {
                  border-color: #475569 !important;
                  border-width: 2px !important;
                }
                .progress-buyback-excel #progress-buyback-section > .grid,
                .progress-buyback-excel #progress-allocation-section > .grid {
                  gap: 0 !important;
                  border-top: 1px solid #64748b;
                  border-left: 1px solid #64748b;
                }
                .progress-buyback-excel #progress-buyback-section > .grid > *,
                .progress-buyback-excel #progress-allocation-section > .grid > * {
                  min-height: 74px;
                  border-right: 1px solid #64748b !important;
                  border-bottom: 1px solid #64748b !important;
                  border-radius: 0 !important;
                  background: #ffffff !important;
                  box-shadow: none !important;
                }
                .progress-buyback-excel #progress-buyback-section > .grid > div > div:first-child,
                .progress-buyback-excel #progress-allocation-section > .grid > div > div:first-child,
                .progress-buyback-excel #progress-allocation-section > .grid > label > span {
                  color: #334155;
                  font-weight: 900;
                }
                .progress-buyback-excel #progress-buyback-section > .grid > div > div:last-child,
                .progress-buyback-excel #progress-allocation-section > .grid > div > div:last-child {
                  color: #111827;
                  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                }
                .progress-buyback-excel #progress-buyback-section > .grid > div:nth-child(2),
                .progress-buyback-excel #progress-allocation-section > .grid > div:nth-child(2),
                .progress-buyback-excel #progress-allocation-section > .grid > div:nth-child(3),
                .progress-buyback-excel #progress-allocation-section > .grid > div:nth-child(4) {
                  background: #fff200 !important;
                }
                .progress-buyback-excel #progress-buyback-section > .grid > div:nth-child(4) {
                  background: #e2f0d9 !important;
                }
                .progress-buyback-excel #progress-buyback-section > .flex,
                .progress-buyback-excel #progress-allocation-section > .flex {
                  border-color: #64748b !important;
                  background: #f2f2f2 !important;
                }
                .progress-buyback-excel .progress-table {
                  border-collapse: collapse;
                  border: 1px solid #475569;
                  border-radius: 0;
                }
                .progress-buyback-excel .progress-table thead th {
                  position: static;
                  border: 1px solid #475569;
                  background: #f2f2f2 !important;
                  color: #111827 !important;
                  box-shadow: none;
                }
                .progress-buyback-excel .progress-table th,
                .progress-buyback-excel .progress-table td {
                  border: 1px solid #94a3b8;
                }
                .progress-buyback-excel .progress-table tbody tr:nth-child(even) td,
                .progress-buyback-excel .progress-table td.progress-cell-meta,
                .progress-buyback-excel .progress-table td.progress-cell-contract,
                .progress-buyback-excel .progress-table td.progress-cell-previous,
                .progress-buyback-excel .progress-table td.progress-cell-current,
                .progress-buyback-excel .progress-table td.progress-cell-cumulative,
                .progress-buyback-excel .progress-table td.progress-cell-remaining,
                .progress-buyback-excel .progress-table td.progress-cell-manday,
                .progress-buyback-excel .progress-table td.progress-cell-buyback,
                .progress-buyback-excel .progress-table td.progress-cell-success,
                .progress-buyback-excel .progress-table td.progress-cell-action,
                .progress-buyback-excel .progress-table td.progress-cell-danger {
                  background: #ffffff;
                  color: #111827;
                }
                .progress-buyback-excel .progress-table tbody tr:hover td {
                  box-shadow: none;
                  background: #d9eaf7;
                }
                .progress-buyback-excel .buyback-workbook-table {
                  border: 1px solid #475569;
                }
                .progress-buyback-excel .buyback-workbook-table th {
                  border: 1px solid #475569;
                  background: #f2f2f2 !important;
                  color: #111827 !important;
                }
                .progress-buyback-excel .buyback-workbook-table td {
                  border: 1px solid #94a3b8;
                  background: #ffffff;
                  color: #111827;
                }
                .progress-buyback-excel .buyback-workbook-table tbody tr:nth-child(even) td {
                  background: #ffffff;
                }
                .progress-buyback-excel .buyback-workbook-table tbody tr.bg-violet-50 td,
                .progress-buyback-excel .buyback-workbook-table tbody tr:hover td {
                  background: #d9eaf7 !important;
                }
                .progress-buyback-excel .buyback-workbook-table td.bg-violet-50\\/60,
                .progress-buyback-excel .buyback-workbook-table td.bg-emerald-50\\/60,
                .progress-buyback-excel .buyback-workbook-table td.bg-amber-50\\/60 {
                  background: #ffffff !important;
                }
                .progress-buyback-excel .buyback-workbook-table td:nth-child(9) {
                  background: #fff200 !important;
                }
                .progress-buyback-excel .buyback-workbook-table .rounded-full {
                  border-radius: 0 !important;
                  box-shadow: none;
                }
                .progress-table {
                  border-collapse: separate;
                  border-spacing: 0;
                  overflow: hidden;
                  border: 1px solid #dbe3ef;
                  border-radius: 8px;
                  background: #ffffff;
                }
                .progress-table thead th {
                  position: sticky;
                  top: 0;
                  z-index: 5;
                  white-space: nowrap;
                  border-bottom: 1px solid #cbd5e1;
                  box-shadow: inset 0 -1px 0 rgba(255, 255, 255, 0.16);
                }
                .progress-table thead th.progress-head-meta { background: #1e293b; color: #fff; }
                .progress-table thead th.progress-head-contract { background: #2563eb; color: #fff; }
                .progress-table thead th.progress-head-previous { background: #d97706; color: #fff; }
                .progress-table thead th.progress-head-current { background: #4f46e5; color: #fff; }
                .progress-table thead th.progress-head-cumulative { background: #059669; color: #fff; }
                .progress-table thead th.progress-head-remaining { background: #e11d48; color: #fff; }
                .progress-table thead th.progress-head-manday { background: #0891b2; color: #fff; }
                .progress-table thead th.progress-head-buyback { background: #7c3aed; color: #fff; }
                .progress-table thead th.progress-head-success { background: #16a34a; color: #fff; }
                .progress-table thead th.progress-head-action { background: #475569; color: #fff; }
                .progress-table thead th.progress-head-danger { background: #dc2626; color: #fff; }
                .progress-table thead th:first-child {
                  border-top-left-radius: 8px;
                }
                .progress-table thead th:last-child {
                  border-top-right-radius: 8px;
                }
                .progress-table th,
                .progress-table td {
                  border-right: 1px solid #e2e8f0;
                  border-bottom: 1px solid #e2e8f0;
                  vertical-align: middle;
                }
                .progress-table th:last-child,
                .progress-table td:last-child {
                  border-right: 0;
                }
                .progress-table tbody tr:nth-child(even) td {
                  background-color: #f8fafc;
                }
                .progress-table tbody tr:hover td {
                  box-shadow: inset 0 0 0 9999px rgba(15, 23, 42, 0.035);
                }
                .progress-table tbody tr.bg-indigo-50 td {
                  box-shadow: inset 0 0 0 9999px rgba(79, 70, 229, 0.08);
                }
                .progress-table tbody tr.bg-slate-50 td {
                  background-color: #f8fafc;
                }
                .progress-table tbody tr.bg-amber-50 td {
                  background-color: #fffbeb;
                }
                .progress-table tbody tr.bg-rose-50 td {
                  background-color: #fff1f2;
                }
                .progress-table tbody tr.progress-row-muted td {
                  background-color: #f8fafc;
                  color: #94a3b8;
                }
                .progress-table tbody tr.progress-row-warning td:first-child {
                  border-left: 4px solid #f59e0b;
                }
                .progress-table tbody tr.progress-row-warning td {
                  background-color: #fffbeb;
                }
                .progress-table tbody tr.progress-row-danger td:first-child {
                  border-left: 4px solid #e11d48;
                }
                .progress-table tbody tr.progress-row-danger td {
                  background-color: #fff1f2;
                }
                .progress-table tbody tr.progress-row-extra td:first-child {
                  border-left: 4px solid #10b981;
                }
                .progress-table td.progress-cell-meta {
                  background-color: #f8fafc;
                  color: #334155;
                }
                .progress-table td.progress-cell-contract {
                  background-color: #eff6ff;
                  color: #1d4ed8;
                }
                .progress-table td.progress-cell-previous {
                  background-color: #fffbeb;
                  color: #92400e;
                }
                .progress-table td.progress-cell-current {
                  background-color: #eef2ff;
                  color: #4338ca;
                }
                .progress-table td.progress-cell-cumulative {
                  background-color: #ecfdf5;
                  color: #047857;
                }
                .progress-table td.progress-cell-remaining {
                  background-color: #fff1f2;
                  color: #e11d48;
                }
                .progress-table td.progress-cell-manday {
                  background-color: #ecfeff;
                  color: #0e7490;
                }
                .progress-table td.progress-cell-buyback {
                  background-color: #f5f3ff;
                  color: #6d28d9;
                }
                .progress-table td.progress-cell-success {
                  background-color: #f0fdf4;
                  color: #15803d;
                }
                .progress-table td.progress-cell-action {
                  background-color: #f8fafc;
                  color: #475569;
                }
                .progress-table td.progress-cell-danger {
                  background-color: #fff1f2;
                  color: #e11d48;
                }
                .progress-table input,
                .progress-table select {
                  background-color: #fff;
                }
                .progress-table-scroll {
                  scrollbar-width: thin;
                  scrollbar-color: #cbd5e1 #f8fafc;
                }
                .progress-attachment-list {
                  overflow: hidden;
                }
                .progress-attachment-row {
                  border-left: 4px solid transparent;
                  transition: background-color 120ms ease, border-color 120ms ease;
                }
                .progress-attachment-row:hover {
                  border-left-color: #4f46e5;
                  background-color: #f8fafc;
                }
                .progress-invoice {
                  width: 100%;
                  max-width: ${PROGRESS_INVOICE_PRINT_WIDTH}px;
                  margin: 0 auto;
                  color: #0f172a;
                  font-family: "Malgun Gothic", "Apple SD Gothic Neo", Arial, sans-serif;
                  line-height: 1.35;
                }
                .progress-invoice--pdf {
                  border: 0 !important;
                  border-radius: 0 !important;
                  box-shadow: none !important;
                  padding: 22px !important;
                }
                .progress-invoice table {
                  border-color: #cbd5e1;
                  table-layout: fixed;
                }
                .progress-invoice th,
                .progress-invoice td {
                  border-color: #cbd5e1;
                  vertical-align: middle;
                  word-break: keep-all;
                  overflow-wrap: anywhere;
                }
                .progress-invoice th {
                  background-color: #f8fafc;
                  color: #475569;
                  font-weight: 900;
                }
                .progress-invoice td {
                  color: #111827;
                }
                .progress-invoice-party-table th,
                .progress-invoice__site th {
                  background-color: #f8fafc;
                  color: #475569;
                }
                .progress-invoice-section-title {
                  margin-bottom: 8px;
                  border-left: 4px solid #4f46e5;
                  padding-left: 10px;
                  font-size: 13px;
                  font-weight: 900;
                  color: #0f172a;
                }
                .progress-invoice-table th,
                .progress-invoice-table td {
                  padding-left: 5px !important;
                  padding-right: 5px !important;
                  font-size: 11.5px;
                  line-height: 1.25;
                }
                .progress-invoice-table td.invoice-cell-contract,
                .progress-invoice-table td.invoice-cell-previous,
                .progress-invoice-table td.invoice-cell-current,
                .progress-invoice-table td.invoice-cell-cumulative,
                .progress-invoice-table td.invoice-cell-remaining {
                  white-space: nowrap;
                }
                .progress-invoice-table td.invoice-cell-meta,
                .progress-invoice-table td.invoice-cell-action {
                  overflow-wrap: break-word;
                }
                .progress-invoice-table tbody tr:nth-child(even) td {
                  background-color: #fcfdff;
                }
                .progress-invoice .invoice-head-meta { background: #111827; color: #fff; }
                .progress-invoice .invoice-head-contract { background: #1d4ed8; color: #fff; }
                .progress-invoice .invoice-head-previous { background: #b45309; color: #fff; }
                .progress-invoice .invoice-head-current { background: #4338ca; color: #fff; }
                .progress-invoice .invoice-head-cumulative { background: #047857; color: #fff; }
                .progress-invoice .invoice-head-remaining { background: #be123c; color: #fff; }
                .progress-invoice .invoice-head-action { background: #334155; color: #fff; }
                .progress-invoice .invoice-cell-meta { background-color: #f8fafc; color: #334155; }
                .progress-invoice .invoice-cell-contract { background-color: #eff6ff; color: #1d4ed8; }
                .progress-invoice .invoice-cell-previous { background-color: #fffbeb; color: #92400e; }
                .progress-invoice .invoice-cell-current { background-color: #eef2ff; color: #3730a3; }
                .progress-invoice .invoice-cell-cumulative { background-color: #ecfdf5; color: #047857; }
                .progress-invoice .invoice-cell-remaining { background-color: #fff1f2; color: #be123c; }
                .progress-invoice .invoice-cell-action { background-color: #f8fafc; color: #475569; }
                .progress-invoice .invoice-total-row td {
                  border-top: 2px solid #0f172a;
                  background-color: #f1f5f9;
                }
                .progress-invoice-summary-table th,
                .progress-invoice-buyback-table th,
                .progress-invoice-allocation-table th {
                  background-color: #f1f5f9;
                  color: #0f172a;
                }
                .progress-invoice-summary-table td,
                .progress-invoice-buyback-table td,
                .progress-invoice-allocation-table td {
                  background-color: #ffffff;
                }
                @media (max-width: 640px) {
                  .progress-invoice {
                    padding: 16px !important;
                  }
                  .progress-invoice th,
                  .progress-invoice td {
                    padding-left: 6px !important;
                    padding-right: 6px !important;
                    font-size: 11px;
                  }
                  .progress-invoice-party-table th,
                  .progress-invoice__site th {
                    width: auto !important;
                  }
                  .progress-invoice-amount-panel {
                    padding: 12px !important;
                  }
                }
                @media print {
                  body { background: white !important; }
                  aside, header, nav, .no-print, .progress-tabs, .progress-page-header { display: none !important; }
                  .progress-invoice { border: 0 !important; box-shadow: none !important; border-radius: 0 !important; padding: 0 !important; }
                  .progress-invoice table { page-break-inside: auto; }
                  .progress-invoice tr { page-break-inside: avoid; page-break-after: auto; }
                  .progress-table thead th { position: static; }
                  main, .main-content, .content { padding: 0 !important; margin: 0 !important; }
                }
                `}
            </style>
            <div className="progress-page-header mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <div className="text-xs font-black uppercase tracking-wide text-indigo-600">{pageEyebrow}</div>
                    <h1 className="mt-1 flex items-center gap-2 text-2xl font-black text-slate-950">
                        <FontAwesomeIcon icon={faFileInvoiceDollar} className="text-indigo-600" />
                        {pageTitle}
                    </h1>
                    <p className="mt-1 text-sm text-slate-500">{pageDescription}</p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                    {hasUnsavedChanges && (
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">
                            저장 안 됨
                        </span>
                    )}
                    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600">
                        {(loading || masterLoading) && <FontAwesomeIcon icon={faSpinner} spin />}
                        {yearMonth}
                    </div>
                </div>
            </div>

            {loadError && (
                <div role="alert" className="mb-4 flex flex-col gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 shadow-sm md:flex-row md:items-center md:justify-between">
                    <div>
                        <div className="font-black">기성관리 데이터를 불러오지 못했습니다.</div>
                        <p className="mt-1 text-rose-700">{loadError}</p>
                    </div>
                    <button
                        type="button"
                        onClick={reloadData}
                        disabled={loading}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-200 bg-white px-4 py-2 font-black text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <FontAwesomeIcon icon={loading ? faSpinner : faRotate} spin={loading} />
                        다시 시도
                    </button>
                </div>
            )}

            {!isInvoiceOnlyPage && <div className="mb-4 space-y-3">
                <div className="progress-tabs flex flex-wrap items-center gap-2">
                    {VISIBLE_TAB_ITEMS.map((tab) => {
                        const meta = PROGRESS_TAB_META[tab.key];
                        const active = !hasStatementPageOpen && activeTab === tab.key;
                        return (
                            <React.Fragment key={tab.key}>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab(tab.key)}
                                    className={progressTabButtonClass(meta.tone, active)}
                                >
                                    <FontAwesomeIcon
                                        icon={meta.icon}
                                        className={active ? 'text-white' : PROGRESS_TAB_TONE_CLASS[meta.tone].icon}
                                    />
                                    <span className="whitespace-nowrap">{tab.label}</span>
                                </button>
                                {tab.key === 'invoice' && renderTabStatementActions()}
                            </React.Fragment>
                        );
                    })}
                </div>
            </div>}

            {renderSelectedSiteStatementPage() ?? renderActiveTab()}
        </div>
    );
};

export default ProgressClaimPage;
