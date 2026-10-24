import { usePagePrimaryAccount, ensurePagePrimaryAccountReady } from '../../hooks/usePagePrimaryAccount';
import PagePrimaryAccountCard from '../../components/accounts/PagePrimaryAccountCard';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronRight, faCircleCheck, faCopy, faDownload, faFileInvoice, faFileInvoiceDollar, faPlus, faReceipt, faShareNodes, faSave, faSpinner, faTrash, faTriangleExclamation, faUsers, faXmark } from '@fortawesome/free-solid-svg-icons';
import { saveAs } from 'file-saver';
import { MAX_DAY_COLUMNS, DAY_LABELS_FIRST, DAY_LABELS_SECOND, generateLaborStatementExcel, type SupportLaborStatementExcelBlock } from '../../utils/excel/SupportPaymentExcelGenerator';
import { resolveIcon } from '../../constants/iconMap';
import { Company, companyService } from '../../services/companyService';
import { SettlementTarget, SettlementTargetType } from '../../services/settlementTargetService';
import { SupportClientAllocationLine } from '../../services/supportClientSiteAllocationService';
import { estimateService, Estimate } from '../../services/estimateService';
import { statementOutputService } from '../../services/statementOutputService';
import materialService from '../../services/materialService';
import type { StatementOutputRecord, StatementOutputSource } from '../../types/statementOutput';
import type { Material } from '../../types/materials';
import { hexToRgba, normalizeHexColor } from '../../utils/color';
import { loadStatementIssueOptionPreset, saveLaborStatementPresetDefaults, saveStatementIssueOptionPreset, STATEMENT_ISSUE_OPTION_PRESETS, type StatementIssueOptionPreset } from '../../utils/payrollLaborStatementDefaults';
import { DocumentType, EstimateDraft, LOGO_FALLBACK } from '../../utils/estimateUtils';
import { AmountBarComponent, InfoTableComponent, TitleComponent } from '../../components/estimate/EstimateSharedComponents';
import { TransactionTable } from '../../components/estimate/TransactionTable';
import { RentalTransactionTable } from '../../components/estimate/RentalTransactionTable';
import { downloadEstimateExcel } from '../../utils/estimateExcelUtils';
import { calculateRentalLineAmount, generateRentalTransactionItems, isRentalRateInWorkType, mergeRentalRatesWithMaterials, RentalAmountBasis, RentalGenerationResult, RentalMaterialRate, RentalWorkType } from '../../utils/rentalTransactionGenerator';
import type { SupportClientAllocationModalTarget, SupportClientLaborSitePreview, SupportClientLaborStatementOptions, SupportClientLaborStatementRow, SupportClientLaborStatementViewOptions, SupportDirection, SupportStatementPayType, SupportStatementTarget, SupportTeamBadge, SupportTransactionStatementDraft, SupportTransactionStatementMode, SupportTransactionStatementOptionDefaults } from './SupportClientSiteModel';
import { ALLOCATION_LINE_STATUS_OPTIONS, DEFAULT_STATEMENT_LOGO_URL, DIRECTION_META, OWN_SITE_OUTPUT_LABEL, SETTLEMENT_TARGET_TYPE_OPTIONS, SUPPORT_DIRECTION_ORDER, SUPPORT_RENTAL_WORK_TYPE_LABELS, applySupportTransactionStatementOptions, buildSupportClientLaborPreviews, buildSupportClientLaborStatementColumns, buildSupportClientLaborStatementText, buildSupportTransactionDraft, buildSupportTransactionDraftFromEstimate, buildSupportWorkerPayTypesFromDefaults, captureElementToPngBlob, copyElementHtmlToClipboard, copyElementToPngClipboard, copyPngBlobToClipboard, createAllocationLineId, formatCurrencyText, formatFullIdNumber, formatManDay, formatManDayText, formatNumber, formatStatementDayManDay, getExpenseClaimAmount, getExpenseClaimKey, getExpenseClaimStatusLabel, getExpenseClaimsTotal, getSupportLaborStatementWorkerKey, getSupportTransactionLinkFields, getSupportTransactionTargetAmount, isEstimateTransactionMode, loadSupportClientLaborStatementDefaults, loadSupportTransactionStatementOptions, normalizeAllocationLineAmountInput, normalizeAllocationTargetType, normalizeCurrencyAmountInput, parseCurrencyAmount, parseSupportMoneyInput, readStoredSupportRentalRates, resolveStatementLogoUrl, sanitizeFileNamePart, saveSupportTransactionStatementOptions, sortExpenseClaims, writeStoredSupportRentalRates } from './SupportClientSiteModel';

export const DirectionBadge: React.FC<{ direction: SupportDirection }> = ({ direction }) => (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-black ${DIRECTION_META[direction].badgeClass}`}>
        {DIRECTION_META[direction].label}
    </span>
);

export const OwnSiteOutputBadge: React.FC = () => (
    <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-black text-emerald-700">
        {OWN_SITE_OUTPUT_LABEL}
    </span>
);

export const OutputTypeBadge: React.FC<{ label: string }> = ({ label }) => {
    if (label === OWN_SITE_OUTPUT_LABEL) return <OwnSiteOutputBadge />;

    const direction = SUPPORT_DIRECTION_ORDER.find((candidate) =>
        candidate === label || DIRECTION_META[candidate].label === label
    );

    return <DirectionBadge direction={direction ?? '외부지원간곳'} />;
};

export const AccordionChevron: React.FC<{ expanded: boolean; className?: string }> = ({ expanded, className = '' }) => (
    <FontAwesomeIcon
        icon={faChevronRight}
        className={`shrink-0 transition-transform duration-300 ${expanded ? 'rotate-90' : ''} ${className}`}
    />
);

export const ResponsibleTeamChips: React.FC<{ teams: SupportTeamBadge[]; size?: 'sm' | 'lg' }> = ({ teams, size = 'sm' }) => {
    if (teams.length === 0) {
        return <span className="text-[11px] font-bold text-slate-400">미지정</span>;
    }

    const isLarge = size === 'lg';

    return (
        <span className={`inline-flex min-w-0 flex-wrap items-center ${isLarge ? 'gap-2' : 'gap-1.5'}`}>
            {teams.map((team) => {
                const color = normalizeHexColor(team.color);
                return (
                    <span
                        key={team.key}
                        className={`inline-flex max-w-full items-center rounded-full border font-black ${
                            isLarge ? 'gap-2 px-3 py-1.5 text-sm' : 'gap-1.5 px-2 py-1 text-[11px]'
                        }`}
                        style={{
                            borderColor: hexToRgba(color, 0.28),
                            backgroundColor: hexToRgba(color, 0.08),
                            color
                        }}
                        title={team.name}
                    >
                        <span
                            className={`flex shrink-0 items-center justify-center rounded-full text-white shadow-sm ${
                                isLarge ? 'h-6 w-6' : 'h-5 w-5'
                            }`}
                            style={{ backgroundColor: color }}
                        >
                            <FontAwesomeIcon icon={resolveIcon(team.icon, faUsers)} className={isLarge ? 'text-xs' : 'text-[10px]'} />
                        </span>
                        <span className="truncate">{team.name}</span>
                    </span>
                );
            })}
        </span>
    );
};

export const SiteMetaBadge: React.FC<{ label: string; value: string; tone: 'violet' | 'sky' }> = ({ label, value, tone }) => {
    if (!value || value === '-') return null;

    const toneClass = tone === 'violet'
        ? 'border-violet-200 bg-violet-50 text-violet-700'
        : 'border-sky-200 bg-sky-50 text-sky-700';

    return (
        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black ${toneClass}`}>
            <span className="text-slate-400">{label}</span>
            <span>{value}</span>
        </span>
    );
};

export const StatementActionButtons: React.FC<{
    target: SupportStatementTarget;
    onOpenLabor: (target: SupportStatementTarget) => void;
    onOpenTransaction: (target: SupportStatementTarget) => void;
    onOpenRentalTransaction: (target: SupportStatementTarget) => void;
    onOpenExpense: (target: SupportStatementTarget) => void;
    laborOpen?: boolean;
    transactionOpen?: boolean;
    rentalTransactionOpen?: boolean;
    transactionCount?: number;
    rentalTransactionCount?: number;
}> = ({
    target,
    onOpenLabor,
    onOpenTransaction,
    onOpenRentalTransaction,
    onOpenExpense,
    laborOpen = false,
    transactionOpen = false,
    rentalTransactionOpen = false,
    transactionCount = 0,
    rentalTransactionCount = 0,
}) => {
    const expenseAmount = getExpenseClaimsTotal(target.expenseClaims);
    const columnClass = expenseAmount > 0 ? 'grid-cols-2' : 'grid-cols-3';

    return (
        <div className={`grid gap-1 ${columnClass}`}>
            <button
                type="button"
                aria-label={`${target.title} 노임명세서`}
                title="노임명세서"
                aria-expanded={laborOpen}
                onClick={(event) => {
                    event.stopPropagation();
                    onOpenLabor(target);
                }}
                className={`inline-flex h-7 items-center justify-center gap-1 whitespace-nowrap rounded px-2 text-[10px] font-black text-white shadow-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
                    laborOpen ? 'bg-emerald-800 ring-2 ring-emerald-300' : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
            >
                <FontAwesomeIcon icon={faFileInvoiceDollar} />
                <span>노임명세</span>
            </button>
            <button
                type="button"
                aria-label={`${target.title} 거래명세서`}
                title="거래명세서"
                aria-expanded={transactionOpen}
                onClick={(event) => {
                    event.stopPropagation();
                    onOpenTransaction(target);
                }}
                className={`relative inline-flex h-7 items-center justify-center gap-1 whitespace-nowrap rounded px-2 text-[10px] font-black text-white shadow-sm transition focus:outline-none focus:ring-2 focus:ring-teal-400 ${
                    transactionOpen ? 'bg-teal-800 ring-2 ring-teal-300' : 'bg-teal-600 hover:bg-teal-700'
                }`}
            >
                <FontAwesomeIcon icon={faFileInvoice} />
                <span>거래명세</span>
                {transactionCount > 0 && (
                    <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-white px-1 text-[9px] font-black leading-4 text-teal-700 shadow">
                        {transactionCount}
                    </span>
                )}
            </button>
            <button
                type="button"
                aria-label={`${target.title} 임대거래명세서 열기`}
                title="임대거래명세서"
                aria-expanded={rentalTransactionOpen}
                onClick={(event) => {
                    event.stopPropagation();
                    onOpenRentalTransaction(target);
                }}
                className={`relative inline-flex h-7 items-center justify-center gap-1 whitespace-nowrap rounded px-2 text-[10px] font-black text-white shadow-sm transition focus:outline-none focus:ring-2 focus:ring-amber-400 ${
                    rentalTransactionOpen ? 'bg-amber-800 ring-2 ring-amber-300' : 'bg-amber-600 hover:bg-amber-700'
                }`}
            >
                <FontAwesomeIcon icon={faFileInvoice} />
                <span>임대거래</span>
                {rentalTransactionCount > 0 && (
                    <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-white px-1 text-[9px] font-black leading-4 text-amber-700 shadow">
                        {rentalTransactionCount}
                    </span>
                )}
            </button>
            {expenseAmount > 0 && (
                <button
                    type="button"
                    aria-label={`${target.title} 경비내역서`}
                    title="경비내역서"
                    onClick={(event) => {
                        event.stopPropagation();
                        onOpenExpense(target);
                    }}
                    className="inline-flex h-7 items-center justify-center gap-1 whitespace-nowrap rounded bg-teal-600 px-2 text-[10px] font-black text-white shadow-sm transition hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-400"
                >
                    <FontAwesomeIcon icon={faReceipt} />
                    <span>경비내역</span>
                </button>
            )}
        </div>
    );
};

export const SupportClientStatementModalShell: React.FC<{
    title: string;
    onClose: () => void;
    children: React.ReactNode;
}> = ({ title, onClose, children }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
        <div className="flex max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <h2 className="text-base font-black text-slate-900">{title}</h2>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="닫기"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                >
                    <FontAwesomeIcon icon={faXmark} />
                </button>
            </div>
            <div className="min-h-0 overflow-auto p-5">
                {children}
            </div>
        </div>
    </div>
);

export const SupportClientStatementBrand: React.FC<{ logoUrl?: string | null }> = ({ logoUrl }) => {
    const resolvedLogoUrl = resolveStatementLogoUrl(logoUrl);
    const [imageSrc, setImageSrc] = useState(resolvedLogoUrl);

    useEffect(() => {
        setImageSrc(resolvedLogoUrl);
    }, [resolvedLogoUrl]);

    return (
        <div className="flex items-center gap-2 text-slate-900">
            <img
                src={imageSrc}
                alt="ERP logo"
                className="h-9 w-9 rounded-md object-contain"
                onError={() => {
                    if (imageSrc !== DEFAULT_STATEMENT_LOGO_URL) {
                        setImageSrc(DEFAULT_STATEMENT_LOGO_URL);
                    }
                }}
            />
            <span className="text-sm font-black">(주) 청연이엔지</span>
        </div>
    );
};

export const SupportClientLaborStatementPreview: React.FC<{
    target: SupportStatementTarget;
    preview: SupportClientLaborSitePreview;
    yearMonth: string;
    viewOptions: SupportClientLaborStatementViewOptions;
}> = ({ target, preview, yearMonth, viewOptions }) => {
    const [yearString, monthString] = yearMonth.split('-');
    const year = parseInt(yearString ?? '', 10);
    const month = parseInt(monthString ?? '0', 10);
    const statementPeriod = Number.isFinite(year)
        ? `${String(year % 100).padStart(2, '0')}년 ${month || ''}월분`
        : `${month || ''}월분`;
    const dayTotals = Array.from({ length: MAX_DAY_COLUMNS }, () => 0);
    preview.rows.forEach((row) => {
        row.days.forEach((value, index) => {
            dayTotals[index] += value;
        });
    });
    const avgPrice = preview.totalManDay > 0 ? Math.round(preview.totalAmount / preview.totalManDay) : 0;
    const allDayLabels = Array.from({ length: MAX_DAY_COLUMNS }, (_, index) => index + 1);
    const primaryDayLabels = viewOptions.isSplitView ? DAY_LABELS_FIRST : allDayLabels;
    const statementColumns = buildSupportClientLaborStatementColumns(viewOptions);
    const statementTableMinWidth = statementColumns.reduce((sum, column) => sum + column.width, 0);
    const statementSheetMinWidth = statementTableMinWidth + 82;
    const footerRowSpan = viewOptions.isSplitView ? 2 : 1;
    const getPaymentLabel = (payType: SupportStatementPayType) => payType === 'delegate' ? '위임' : '직불';
    const formatBankInfo = (row: SupportClientLaborStatementRow) =>
        [row.bankName, row.accountHolder, row.accountNumber].filter(Boolean).join(' / ');
    const getAddressContent = (row: SupportClientLaborStatementRow) => {
        const parts = [row.address || '-'];
        if (viewOptions.showBankUnderAddress) {
            const bankInfo = formatBankInfo(row);
            parts.push(bankInfo ? `${bankInfo} (${getPaymentLabel(row.payType)})` : getPaymentLabel(row.payType));
        }
        return parts;
    };

    return (
        <div className="w-full min-w-full border border-slate-200 bg-white p-10 shadow-2xl" style={{ minWidth: statementSheetMinWidth }}>
            <h2 className="mb-8 text-center text-3xl font-black tracking-widest text-slate-800 underline decoration-4 underline-offset-8 decoration-amber-500">
                노 무 비 지 급 명 세 서 ({statementPeriod})
            </h2>
            <div className="mb-4 flex items-end justify-between gap-4 px-2">
                <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-600">
                        현장명: <span className="border-b-2 border-slate-300 px-2 text-slate-900">{preview.siteName}</span>
                    </p>
                </div>
                <SupportClientStatementBrand />
            </div>
            <table className="w-full table-fixed border-collapse border-2 border-slate-800 text-[11px] leading-snug" style={{ minWidth: statementTableMinWidth }}>
                <colgroup>
                    {statementColumns.map((column) => (
                        <col key={column.key} style={{ width: column.width }} />
                    ))}
                </colgroup>
                <thead>
                <tr className="bg-slate-100 font-black text-slate-800">
                    <th className="border-2 border-slate-800 p-2" rowSpan={viewOptions.isSplitView ? 2 : 1}>NO</th>
                    <th className="border-2 border-slate-800 p-2" rowSpan={viewOptions.isSplitView ? 2 : 1}>성명</th>
                    <th className="border-2 border-slate-800 p-2">주민번호</th>
                    <th className="border-2 border-slate-800 p-2" rowSpan={viewOptions.isSplitView ? 2 : 1}>주 소</th>
                    {primaryDayLabels.map((day) => (
                        <th key={day} className="border-2 border-slate-800 bg-sky-50 text-sky-700">{String(day).padStart(2, '0')}</th>
                    ))}
                    <th className="border-2 border-slate-800 p-2" rowSpan={viewOptions.isSplitView ? 2 : 1}>출역</th>
                    {viewOptions.showBillingColumns && (
                        <th className="border-2 border-slate-800 bg-emerald-100 p-2 text-emerald-950">청구단가</th>
                    )}
                    {viewOptions.showBillingColumns && !viewOptions.isSplitView && (
                        <th className="border-2 border-slate-800 bg-emerald-100 p-2 text-emerald-950">청구금액</th>
                    )}
                    {viewOptions.showBankColumn && (
                        <th className="border-2 border-slate-800 bg-yellow-100 p-2 text-yellow-950" rowSpan={viewOptions.isSplitView ? 2 : 1}>계좌번호 / 지급구분</th>
                    )}
                </tr>
                {viewOptions.isSplitView && (
                    <tr className="bg-slate-100 font-black text-slate-800">
                        <th className="border-2 border-slate-800 p-2">전화번호</th>
                        {DAY_LABELS_SECOND.map((day) => (
                            <th key={day} className="border-2 border-slate-800 bg-rose-50 text-rose-700">{String(day).padStart(2, '0')}</th>
                        ))}
                        <th aria-label="날짜 빈 칸" className="border-2 border-slate-800 bg-slate-50" />
                        {viewOptions.showBillingColumns && (
                            <th className="border-2 border-slate-800 bg-emerald-100 p-2 text-emerald-950">청구금액</th>
                        )}
                    </tr>
                )}
                </thead>
                <tbody>
                {preview.rows.map((row, index) => (
                    <React.Fragment key={row.key || row.workerId || `${row.workerName}:${index}`}>
                        <tr className="font-bold">
                            <td rowSpan={viewOptions.isSplitView ? 2 : 1} className="border-2 border-slate-800 bg-slate-50 py-1.5 text-center">{index + 1}</td>
                            <td rowSpan={viewOptions.isSplitView ? 2 : 1} className="border-2 border-slate-800 py-1.5 text-center text-[13px]">
                                <div>{row.workerName}</div>
                                {viewOptions.showTeamUnderName && row.teamNames.length > 0 && (
                                    <div className="mt-1 text-[9px] font-semibold text-slate-500">{row.teamNames.join(', ')}</div>
                                )}
                            </td>
                            <td className="border-2 border-slate-800 py-1.5 text-center font-mono">{formatFullIdNumber(row.idNumber)}</td>
                            <td rowSpan={viewOptions.isSplitView ? 2 : 1} className={`break-words border-2 border-slate-800 px-1.5 py-1.5 text-[10px] leading-snug ${row.payType === 'delegate' && viewOptions.showBankUnderAddress ? 'bg-yellow-100' : ''}`}>
                                {getAddressContent(row).map((line, lineIndex) => (
                                    <div key={`${row.key}:address:${lineIndex}`} className={lineIndex > 0 ? 'mt-1 border-t border-slate-300 pt-1 font-semibold text-yellow-800' : ''}>{line}</div>
                                ))}
                            </td>
                            {primaryDayLabels.map((day) => (
                                <td key={day} className="border-2 border-slate-800 bg-sky-50/30 py-1.5 text-center">{formatStatementDayManDay(row.days[day - 1])}</td>
                            ))}
                            <td rowSpan={viewOptions.isSplitView ? 2 : 1} className="border-2 border-slate-800 bg-slate-50 py-1.5 text-center font-mono text-[13px]">{formatManDay(row.totalManDay)}</td>
                            {viewOptions.showBillingColumns && (
                                <td className="border-2 border-slate-800 bg-emerald-50 px-2 py-1.5 text-right font-mono text-emerald-700">{formatNumber(row.unitPrice)}</td>
                            )}
                            {viewOptions.showBillingColumns && !viewOptions.isSplitView && (
                                <td className="border-2 border-slate-800 bg-emerald-50 px-2 py-1.5 text-right font-mono text-emerald-800">{formatNumber(row.totalAmount)}</td>
                            )}
                            {viewOptions.showBankColumn && (
                                <td rowSpan={viewOptions.isSplitView ? 2 : 1} className={`break-words border-2 border-slate-800 px-1.5 py-1.5 text-[10px] leading-snug ${row.payType === 'delegate' ? 'bg-yellow-100 text-yellow-900' : 'bg-white text-slate-700'}`}>
                                    <div className="font-black">{getPaymentLabel(row.payType)}</div>
                                    <div className="mt-1 font-semibold">{formatBankInfo(row) || '-'}</div>
                                </td>
                            )}
                        </tr>
                        {viewOptions.isSplitView && (
                            <tr className="font-bold">
                                <td className="border-2 border-slate-800 py-1.5 text-center font-mono text-slate-500">{row.contact || '-'}</td>
                                {DAY_LABELS_SECOND.map((day) => (
                                    <td key={day} className="border-2 border-slate-800 bg-rose-50/30 py-1.5 text-center">{formatStatementDayManDay(row.days[day - 1])}</td>
                                ))}
                                <td aria-label="날짜 빈 칸" className="border-2 border-slate-800 bg-slate-50 py-1.5" />
                                {viewOptions.showBillingColumns && (
                                    <td className="border-2 border-slate-800 bg-emerald-50 px-2 py-1.5 text-right font-mono text-emerald-800">{formatNumber(row.totalAmount)}</td>
                                )}
                            </tr>
                        )}
                    </React.Fragment>
                ))}
                <tr className="bg-slate-200 text-[13px] font-black">
                    <td colSpan={4} className="border-2 border-slate-800 py-2.5 text-center">합 계</td>
                    {primaryDayLabels.map((day) => (
                        <td key={day} className="border-2 border-slate-800 bg-sky-100 py-2.5 text-center text-sky-900">{formatStatementDayManDay(dayTotals[day - 1])}</td>
                    ))}
                    <td rowSpan={footerRowSpan} className="border-2 border-slate-800 py-2.5 text-center font-mono">{formatManDay(preview.totalManDay)}</td>
                    {viewOptions.showBillingColumns && (
                        <td className="border-2 border-slate-800 bg-emerald-100 px-2 py-2.5 text-right font-mono text-emerald-800">{formatNumber(avgPrice)}</td>
                    )}
                    {viewOptions.showBillingColumns && !viewOptions.isSplitView && (
                        <td className="border-2 border-slate-800 bg-emerald-100 px-2 py-2.5 text-right font-mono text-emerald-900">{formatNumber(preview.totalAmount)}</td>
                    )}
                    {viewOptions.showBankColumn && <td rowSpan={footerRowSpan} className="border-2 border-slate-800 bg-yellow-100 py-2.5"></td>}
                </tr>
                {viewOptions.isSplitView && (
                    <tr className="bg-slate-200 text-[13px] font-black">
                        <td colSpan={4} className="border-2 border-slate-800 py-2.5 text-center">{viewOptions.showBillingColumns ? '청구금액' : '합 계'}</td>
                        {DAY_LABELS_SECOND.map((day) => (
                            <td key={day} className="border-2 border-slate-800 bg-rose-100 py-2.5 text-center text-rose-900">{formatStatementDayManDay(dayTotals[day - 1])}</td>
                        ))}
                        <td aria-label="날짜 빈 칸" className="border-2 border-slate-800 bg-slate-50 py-2.5" />
                        {viewOptions.showBillingColumns && (
                            <td className="border-2 border-slate-800 bg-emerald-100 px-2 py-2.5 text-right font-mono text-emerald-900">{formatNumber(preview.totalAmount)}</td>
                        )}
                    </tr>
                )}
                </tbody>
            </table>
        </div>
    );
};

export const SupportClientLaborStatementPanel: React.FC<{
    target: SupportStatementTarget;
    yearMonth: string;
    statementKey?: string;
    outputSource?: StatementOutputSource;
    onOutputSaved?: () => Promise<void> | void;
    onClose: () => void;
}> = ({ target, yearMonth, statementKey, outputSource = 'support-client-site', onOutputSaved, onClose }) => {
    const [statementOptionPreset, setStatementOptionPreset] = useState<StatementIssueOptionPreset>(() => loadStatementIssueOptionPreset());
    const [showBankColumn, setShowBankColumn] = useState(() => loadSupportClientLaborStatementDefaults(statementOptionPreset).showBankColumn);
    const [showBillingColumns, setShowBillingColumns] = useState(() => loadSupportClientLaborStatementDefaults(statementOptionPreset).showBillingColumns);
    const [isSplitView, setIsSplitView] = useState(() => loadSupportClientLaborStatementDefaults(statementOptionPreset).isSplitView);
    const [showBankUnderAddress, setShowBankUnderAddress] = useState(() => loadSupportClientLaborStatementDefaults(statementOptionPreset).showBankUnderAddress);
    const [showTeamUnderName, setShowTeamUnderName] = useState(() => loadSupportClientLaborStatementDefaults(statementOptionPreset).showTeamUnderName);
    const [bulkUnitPriceInput, setBulkUnitPriceInput] = useState(() => {
        const unitPrice = loadSupportClientLaborStatementDefaults(statementOptionPreset).unitPriceOverride;
        return unitPrice > 0 ? String(unitPrice) : '';
    });
    const [appliedBulkUnitPrice, setAppliedBulkUnitPrice] = useState(() => loadSupportClientLaborStatementDefaults(statementOptionPreset).unitPriceOverride);
    const [useWorkerMasterPayType, setUseWorkerMasterPayType] = useState(() => loadSupportClientLaborStatementDefaults(statementOptionPreset).useWorkerMasterPayType);
    const [workerPayTypes, setWorkerPayTypes] = useState<Record<string, SupportStatementPayType>>(() =>
        buildSupportWorkerPayTypesFromDefaults(
            target.rows,
            loadSupportClientLaborStatementDefaults(statementOptionPreset).useWorkerMasterPayType,
            loadSupportClientLaborStatementDefaults(statementOptionPreset)
        )
    );
    const [legacyDelegateBankName, setDelegateBankName] = useState(() => loadSupportClientLaborStatementDefaults(statementOptionPreset).delegateBankName);
    const [legacyDelegateAccountHolder, setDelegateAccountHolder] = useState(() => loadSupportClientLaborStatementDefaults(statementOptionPreset).delegateAccountHolder);
    const [legacyDelegateAccountNumber, setDelegateAccountNumber] = useState(() => loadSupportClientLaborStatementDefaults(statementOptionPreset).delegateAccountNumber);
    const pagePrimaryAccount = usePagePrimaryAccount(outputSource === 'progress-claims' ? 'progress-claims' : 'support-client-site');
    const delegateBankName = pagePrimaryAccount.account?.bankName ?? legacyDelegateBankName;
    const delegateAccountHolder = pagePrimaryAccount.account?.accountHolder ?? legacyDelegateAccountHolder;
    const delegateAccountNumber = pagePrimaryAccount.account?.accountNumber ?? legacyDelegateAccountNumber;
    const statementOptions = useMemo<SupportClientLaborStatementOptions>(() => ({
        unitPriceOverride: appliedBulkUnitPrice,
        defaultPayType: 'direct',
        workerPayTypes,
        delegateBankName,
        delegateAccountHolder,
        delegateAccountNumber
    }), [appliedBulkUnitPrice, workerPayTypes, delegateBankName, delegateAccountHolder, delegateAccountNumber]);
    const statementViewOptions = useMemo<SupportClientLaborStatementViewOptions>(() => ({
        showBankColumn,
        showBillingColumns,
        isSplitView,
        showBankUnderAddress,
        showTeamUnderName
    }), [showBankColumn, showBillingColumns, isSplitView, showBankUnderAddress, showTeamUnderName]);
    const previews = useMemo(
        () => buildSupportClientLaborPreviews(target.rows, target.billingRateBySiteKey, target.billingRateByRowId, statementOptions),
        [target.rows, target.billingRateBySiteKey, target.billingRateByRowId, statementOptions]
    );
    const [statusMessage, setStatusMessage] = useState('');
    const [busyAction, setBusyAction] = useState<'copy' | 'send' | 'excel' | null>(null);
    const [activePreviewIndex, setActivePreviewIndex] = useState(0);
    const statementSheetRef = useRef<HTMLDivElement | null>(null);
    const activePreview = previews[activePreviewIndex] ?? previews[0] ?? null;
    const totalManDay = previews.reduce((sum, preview) => sum + preview.totalManDay, 0);
    const totalAmount = previews.reduce((sum, preview) => sum + preview.totalAmount, 0);
    const payTypeAutoWarningNames = useMemo(() => {
        if (!useWorkerMasterPayType) return [];
        const missingByKey = new Map<string, string>();
        target.rows.forEach((row) => {
            if (row.workerLaborStatementPayType) return;
            const key = getSupportLaborStatementWorkerKey(row);
            if (!key || missingByKey.has(key)) return;
            missingByKey.set(key, row.workerName || row.workerId || '이름 없음');
        });
        return Array.from(missingByKey.values());
    }, [target.rows, useWorkerMasterPayType]);
    const statementText = useMemo(
        () => buildSupportClientLaborStatementText(target, previews, yearMonth),
        [target, previews, yearMonth]
    );
    const shareTitle = `노무비 지급 명세서_${yearMonth}_${target.title}`;
    const imageFileName = `${sanitizeFileNamePart(shareTitle)}.png`;
    const outputStatementKey = statementKey || `support-client-site::${yearMonth}::${target.title}`;

    const buildLaborStatementOutput = useCallback((): StatementOutputRecord => {
        const firstRow = target.rows[0];
        const firstPreview = previews[0];

        return {
            source: outputSource,
            statementKey: outputStatementKey,
            kind: 'labor',
            status: statementOptionPreset,
            yearMonth,
            targetTitle: target.title,
            targetSubtitle: target.subtitle,
            siteId: firstRow?.siteId,
            siteName: firstPreview?.siteName || firstRow?.siteName || target.title,
            clientCompanyName: firstRow?.clientCompanyName || firstRow?.constructorCompanyName || target.title,
            teamName: firstRow?.responsibleTeamName || firstRow?.sourceTeamName,
            documentTitle: shareTitle,
            amountSummary: {
                manDay: totalManDay,
                supplyAmount: totalAmount,
                totalAmount,
            },
            optionPreset: statementOptionPreset,
            optionSnapshot: {
                ...statementViewOptions,
                unitPriceOverride: statementOptions.unitPriceOverride,
                useWorkerMasterPayType,
                delegateBankName,
                delegateAccountHolder,
                delegateAccountNumber,
                workerPayTypes,
            },
            snapshot: {
                previewCount: previews.length,
                workerCount: target.rows.length,
                previews: previews.map((preview) => ({
                    key: preview.key,
                    siteName: preview.siteName,
                    totalManDay: preview.totalManDay,
                    totalAmount: preview.totalAmount,
                    workerCount: preview.rows.length,
                })),
            },
        };
    }, [
        delegateAccountHolder,
        delegateAccountNumber,
        delegateBankName,
        outputSource,
        outputStatementKey,
        previews,
        shareTitle,
        statementOptionPreset,
        statementOptions.unitPriceOverride,
        statementViewOptions,
        target.rows,
        target.subtitle,
        target.title,
        totalAmount,
        totalManDay,
        useWorkerMasterPayType,
        workerPayTypes,
        yearMonth,
    ]);

    useEffect(() => {
        setActivePreviewIndex(0);
    }, [target.title, previews.length]);

    const applyLaborStatementDefaults = useCallback((preset: StatementIssueOptionPreset) => {
        const defaults = loadSupportClientLaborStatementDefaults(preset);
        setShowBankColumn(defaults.showBankColumn);
        setShowBillingColumns(defaults.showBillingColumns);
        setIsSplitView(defaults.isSplitView);
        setShowBankUnderAddress(defaults.showBankUnderAddress);
        setShowTeamUnderName(defaults.showTeamUnderName);
        setUseWorkerMasterPayType(defaults.useWorkerMasterPayType);
        setWorkerPayTypes(buildSupportWorkerPayTypesFromDefaults(target.rows, defaults.useWorkerMasterPayType, defaults));
        setBulkUnitPriceInput(defaults.unitPriceOverride > 0 ? String(defaults.unitPriceOverride) : '');
        setAppliedBulkUnitPrice(defaults.unitPriceOverride);
        setDelegateBankName(defaults.delegateBankName);
        setDelegateAccountHolder(defaults.delegateAccountHolder);
        setDelegateAccountNumber(defaults.delegateAccountNumber);
    }, [target.rows]);

    useEffect(() => {
        applyLaborStatementDefaults(statementOptionPreset);
    }, [applyLaborStatementDefaults, statementOptionPreset]);

    useEffect(() => {
        let mounted = true;
        const companyName = String(
            target.rows.find((row) => row.constructorCompanyName)?.constructorCompanyName ||
            target.title ||
            ''
        ).trim();

        const loadDelegateAccount = async () => {
            if (!companyName) return;
            const defaults = loadSupportClientLaborStatementDefaults(statementOptionPreset);
            const hasStoredDelegateAccount = Boolean(
                defaults.delegateBankName ||
                defaults.delegateAccountHolder ||
                defaults.delegateAccountNumber
            );
            if (hasStoredDelegateAccount) return;

            try {
                const company = await companyService.getCompanyByName(companyName);
                if (!mounted || !company) return;
                setDelegateBankName(company.bankName || '');
                setDelegateAccountHolder(company.accountHolder || '');
                setDelegateAccountNumber(company.accountNumber || '');
            } catch (delegateAccountError) {
                console.warn('[SupportClientSitePage] delegate account load failed:', delegateAccountError);
            }
        };

        void loadDelegateAccount();

        return () => {
            mounted = false;
        };
    }, [statementOptionPreset, target.rows, target.title]);

    const handleApplyBulkUnitPrice = useCallback(() => {
        const nextUnitPrice = parseCurrencyAmount(bulkUnitPriceInput);
        if (!nextUnitPrice) {
            window.alert('적용할 단가를 입력하세요.');
            return;
        }
        setAppliedBulkUnitPrice(nextUnitPrice);
    }, [bulkUnitPriceInput]);

    const handleClearBulkUnitPrice = useCallback(() => {
        setAppliedBulkUnitPrice(0);
        setBulkUnitPriceInput('');
    }, []);

    const handleUseWorkerMasterPayTypeChange = useCallback((checked: boolean) => {
        setUseWorkerMasterPayType(checked);
        setWorkerPayTypes(buildSupportWorkerPayTypesFromDefaults(
            target.rows,
            checked,
            loadSupportClientLaborStatementDefaults(statementOptionPreset)
        ));
    }, [statementOptionPreset, target.rows]);

    const handleStatementOptionPresetChange = useCallback((value: StatementIssueOptionPreset) => {
        setStatementOptionPreset(value);
        saveStatementIssueOptionPreset(value);
        setStatusMessage(`${STATEMENT_ISSUE_OPTION_PRESETS.find((option) => option.value === value)?.label ?? ''} 옵션을 불러왔습니다.`);
    }, []);

    const handleSaveStatementOptions = useCallback(async () => {
        if (!ensurePagePrimaryAccountReady(pagePrimaryAccount)) return;
        saveLaborStatementPresetDefaults(statementOptionPreset, {
            showBankColumn,
            showBillingColumns,
            isSplitView,
            showBankUnderAddress,
            showTeamUnderName,
            unitPriceOverride: appliedBulkUnitPrice,
            useWorkerMasterPayType,
            workerPayTypes,
        });
        const label = STATEMENT_ISSUE_OPTION_PRESETS.find((option) => option.value === statementOptionPreset)?.label ?? '선택';
        try {
            await statementOutputService.upsertOutput(buildLaborStatementOutput());
            await onOutputSaved?.();
            setStatusMessage(`${label} 노임명세 옵션을 저장하고 문서대장에 반영했습니다.`);
        } catch (error) {
            console.error('[SupportClientSitePage] labor statement output save failed:', error);
            setStatusMessage(`${label} 노임명세 옵션은 저장했지만 문서대장 반영에 실패했습니다.`);
        }
    }, [
        pagePrimaryAccount,
        appliedBulkUnitPrice,
        buildLaborStatementOutput,
        isSplitView,
        onOutputSaved,
        showBankColumn,
        showBankUnderAddress,
        showBillingColumns,
        showTeamUnderName,
        statementOptionPreset,
        useWorkerMasterPayType,
        workerPayTypes,
    ]);

    const captureStatementImage = async (): Promise<Blob> => {
        if (!statementSheetRef.current) {
            throw new Error('노무비 지급 명세서 표 영역을 찾지 못했습니다.');
        }
        return captureElementToPngBlob(statementSheetRef.current);
    };

    const handleCopy = async () => {
        if (!ensurePagePrimaryAccountReady(pagePrimaryAccount)) return;
        try {
            setBusyAction('copy');
            const blob = await captureStatementImage();
            await copyPngBlobToClipboard(blob, '노무비 지급 명세서');
            setStatusMessage('노무비 지급 명세서 표 이미지를 복사했습니다.');
        } catch (error) {
            console.error('노무비 지급 명세서 이미지 복사 실패:', error);
            setStatusMessage('이 브라우저에서 이미지 복사를 지원하지 않습니다. 공유 버튼을 사용해 주세요.');
        } finally {
            setBusyAction(null);
        }
    };

    const handleSend = async () => {
        if (!ensurePagePrimaryAccountReady(pagePrimaryAccount)) return;
        const shareNavigator = navigator as Navigator & {
            canShare?: (data: { files?: File[] }) => boolean;
            share?: (data: { title?: string; text?: string; files?: File[] }) => Promise<void>;
        };

        try {
            setBusyAction('send');
            const blob = await captureStatementImage();
            const file = new File([blob], imageFileName, { type: 'image/png' });

            if (!shareNavigator.share || (shareNavigator.canShare && !shareNavigator.canShare({ files: [file] }))) {
                saveAs(blob, imageFileName);
                setStatusMessage('이미지 공유를 지원하지 않아 PNG 파일로 저장했습니다.');
                return;
            }

            await shareNavigator.share({
                title: shareTitle,
                text: '노무비 지급 명세서',
                files: [file]
            });
            setStatusMessage('노무비 지급 명세서 이미지를 보낼 수 있도록 공유를 열었습니다.');
        } catch (error) {
            if ((error as DOMException)?.name !== 'AbortError') {
                console.error('노무비 지급 명세서 이미지 공유 실패:', error);
                setStatusMessage('이미지 공유를 열지 못했습니다.');
            }
        } finally {
            setBusyAction(null);
        }
    };

    const handleExcelDownload = async () => {
        if (!ensurePagePrimaryAccountReady(pagePrimaryAccount)) return;
        if (previews.length === 0) {
            setStatusMessage('엑셀로 저장할 노임명세 데이터가 없습니다.');
            return;
        }

        const excelBlocks: SupportLaborStatementExcelBlock[] = previews.map((preview) => ({
            sheetName: `${preview.siteName}_${target.title}`,
            siteName: preview.siteName,
            settlementName: target.title,
            direction: target.subtitle || '현장별 노임명세',
            delegateBankName,
            delegateAccountHolder,
            delegateAccountNumber,
            rows: preview.rows.map((row) => ({
                workerId: row.workerId,
                workerName: row.workerName,
                idNumber: row.idNumber,
                contact: row.contact,
                address: row.address,
                bankName: row.bankName,
                accountNumber: row.accountNumber,
                accountHolder: row.accountHolder,
                payType: row.payType,
                days: row.days,
                totalManDay: row.totalManDay,
                unitPrice: row.unitPrice,
                totalAmount: row.totalAmount,
                billingUnitPrice: row.unitPrice,
                billingAmount: row.totalAmount,
                vatAmount: 0,
                issuedAmount: row.totalAmount,
            })),
        }));

        try {
            setBusyAction('excel');
            await generateLaborStatementExcel(excelBlocks, yearMonth, {
                fileName: `노무내역서_${sanitizeFileNamePart(yearMonth)}_${sanitizeFileNamePart(target.title)}.xlsx`,
                showBankColumn,
            });
            setStatusMessage('현재 노임명세 설정을 적용한 엑셀 파일을 저장했습니다.');
        } catch (error) {
            console.error('[SupportClientSitePage] labor statement excel download failed:', error);
            setStatusMessage('노임명세 엑셀 파일을 생성하지 못했습니다.');
        } finally {
            setBusyAction(null);
        }
    };

    return (
        <div className="space-y-5 rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm" onClick={(event) => event.stopPropagation()}>
            <div className="flex flex-col gap-3 border-b border-emerald-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h3 className="flex items-center gap-2 text-base font-black text-slate-900">
                        <FontAwesomeIcon icon={faFileInvoiceDollar} className="text-emerald-600" />
                        노임명세서
                    </h3>
                    <p className="mt-1 text-xs font-bold text-slate-500">
                        {target.title}{target.subtitle ? ` · ${target.subtitle}` : ''}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="노임명세서 닫기"
                    title="닫기"
                    className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 transition hover:bg-slate-50"
                >
                    <FontAwesomeIcon icon={faXmark} />
                    닫기
                </button>
            </div>
            <div className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-[11px] font-black text-slate-500">대상</div>
                        <div className="mt-1 text-sm font-black text-slate-900">{target.title}</div>
                        {target.subtitle && <div className="mt-1 text-[11px] font-bold text-slate-500">{target.subtitle}</div>}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-[11px] font-black text-slate-500">총공수</div>
                        <div className="mt-1 text-sm font-black text-slate-900">{formatManDayText(totalManDay)}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-emerald-50 p-4">
                        <div className="text-[11px] font-black text-emerald-700">청구합계</div>
                        <div className="mt-1 text-sm font-black text-emerald-800">{formatCurrencyText(totalAmount)}</div>
                    </div>
                </div>

                {payTypeAutoWarningNames.length > 0 && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
                        <div className="flex items-center gap-2">
                            <FontAwesomeIcon icon={faTriangleExclamation} />
                            <span>직불/위임 자동선택 경고</span>
                        </div>
                        <div className="mt-1 leading-5 text-amber-700">
                            작업자 DB의 직불여부가 없거나 작업자 매칭이 되지 않아 기본 지급구분으로 적용했습니다:
                            {' '}
                            {payTypeAutoWarningNames.slice(0, 6).join(', ')}
                            {payTypeAutoWarningNames.length > 6 ? ` 외 ${payTypeAutoWarningNames.length - 6}명` : ''}
                        </div>
                    </div>
                )}

                {previews.length > 1 && (
                    <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-3">
                        {previews.map((preview, index) => (
                            <button
                                key={`${preview.key}:tab`}
                                type="button"
                                onClick={() => setActivePreviewIndex(index)}
                                className={`rounded-lg px-3 py-1.5 text-xs font-black transition ${
                                    activePreviewIndex === index
                                        ? 'bg-emerald-600 text-white shadow-sm'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                {preview.siteName}
                            </button>
                        ))}
                    </div>
                )}

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 text-xs font-black text-slate-500">
                            <FontAwesomeIcon icon={faFileInvoiceDollar} />
                            보기 설정
                        </span>
                        <label className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-700">
                            <input type="checkbox" checked={showBankColumn} onChange={(event) => setShowBankColumn(event.target.checked)} className="accent-emerald-600" />
                            계좌/지급구분
                        </label>
                        <label className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-700">
                            <input
                                type="checkbox"
                                data-testid="support-labor-statement-billing-columns-toggle"
                                aria-label="청구단가/청구금액 표시"
                                checked={showBillingColumns}
                                onChange={(event) => setShowBillingColumns(event.target.checked)}
                                className="accent-emerald-600"
                            />
                            청구단가/청구금액
                        </label>
                        <label className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-700">
                            <input type="checkbox" checked={isSplitView} onChange={(event) => setIsSplitView(event.target.checked)} className="accent-emerald-600" />
                            2줄 보기
                        </label>
                        <label className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-700">
                            <input type="checkbox" checked={showBankUnderAddress} onChange={(event) => setShowBankUnderAddress(event.target.checked)} className="accent-emerald-600" />
                            주소 하단 계좌
                        </label>
                        <label className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-700">
                            <input type="checkbox" checked={showTeamUnderName} onChange={(event) => setShowTeamUnderName(event.target.checked)} className="accent-emerald-600" />
                            이름 하단 팀명
                        </label>
                        <label className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-black ${
                            useWorkerMasterPayType
                                ? 'border-blue-200 bg-blue-50 text-blue-700'
                                : 'border-slate-200 bg-white text-slate-600'
                        }`}>
                            <input
                                type="checkbox"
                                checked={useWorkerMasterPayType}
                                onChange={(event) => handleUseWorkerMasterPayTypeChange(event.target.checked)}
                                className="accent-blue-600"
                            />
                            DB 직불여부 적용
                        </label>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3">
                        <span className="text-xs font-black text-slate-500">옵션 저장</span>
                        <div className="inline-flex overflow-hidden rounded-md border border-slate-200 bg-white">
                            {STATEMENT_ISSUE_OPTION_PRESETS.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => handleStatementOptionPresetChange(option.value)}
                                    className={`h-8 px-3 text-xs font-black transition ${
                                        statementOptionPreset === option.value
                                            ? 'bg-emerald-600 text-white'
                                            : 'bg-white text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
                                    }`}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                        <button
                            type="button"
                            onClick={handleSaveStatementOptions}
                            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-3 text-xs font-black text-emerald-700 transition hover:bg-emerald-100"
                        >
                            <FontAwesomeIcon icon={faSave} />
                            옵션 저장
                        </button>
                    </div>

                    <div className="mt-3 grid gap-2 xl:grid-cols-[minmax(280px,0.9fr)_minmax(360px,1.1fr)]">
                        <div className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2">
                            <span className="shrink-0 text-xs font-black text-slate-500">단가 일괄</span>
                            <input
                                type="text"
                                value={bulkUnitPriceInput}
                                onChange={(event) => setBulkUnitPriceInput(normalizeCurrencyAmountInput(event.target.value))}
                                placeholder="예: 230000"
                                className="h-8 min-w-0 flex-1 rounded-md border border-slate-200 bg-slate-50 px-2 text-right text-sm font-bold outline-none focus:border-emerald-500"
                            />
                            <button
                                type="button"
                                onClick={handleApplyBulkUnitPrice}
                                className="inline-flex h-8 items-center rounded-md bg-orange-100 px-2 text-xs font-black text-orange-700 transition hover:bg-orange-200"
                            >
                                적용
                            </button>
                            {appliedBulkUnitPrice > 0 && (
                                <button
                                    type="button"
                                    onClick={handleClearBulkUnitPrice}
                                    className="h-8 rounded-md px-2 text-xs font-black text-slate-500 transition hover:bg-slate-100"
                                >
                                    해제
                                </button>
                            )}
                        </div>
                        <PagePrimaryAccountCard state={pagePrimaryAccount} fallbackAccount={{ bankName: delegateBankName, accountHolder: delegateAccountHolder, accountNumber: delegateAccountNumber }} />
                    </div>
                </div>

                <div className="max-h-[58vh] overflow-auto rounded-2xl border border-slate-200 bg-slate-100 p-4">
                    {activePreview ? (
                        <div ref={statementSheetRef} data-statement-capture="true" className={`w-full ${isSplitView ? 'min-w-[1180px]' : 'min-w-[1680px]'} bg-white`}>
                            <SupportClientLaborStatementPreview
                                target={target}
                                preview={activePreview}
                                yearMonth={yearMonth}
                                viewOptions={statementViewOptions}
                            />
                        </div>
                    ) : (
                        <div ref={statementSheetRef} data-statement-capture="true" className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm font-bold text-slate-500">
                            표시할 노임명세 표가 없습니다.
                        </div>
                    )}
                </div>

                <details className="rounded-xl border border-slate-200 bg-white">
                    <summary className="cursor-pointer px-4 py-3 text-sm font-black text-slate-700">
                        텍스트 보조본 보기
                    </summary>
                    <div className="border-t border-slate-100 p-4">
                        <textarea
                            readOnly
                            value={statementText}
                            onFocus={(event) => event.currentTarget.select()}
                            className="min-h-[220px] w-full resize-y rounded-xl border border-slate-200 bg-white p-4 font-mono text-[13px] leading-6 text-slate-800 outline-none focus:ring-2 focus:ring-emerald-400"
                        />
                    </div>
                </details>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-h-[20px] text-sm font-bold text-emerald-700">{statusMessage}</div>
                    <div className="flex flex-wrap justify-end gap-2">
                        <button
                            type="button"
                            aria-label="노무비 지급 명세서 엑셀 다운로드"
                            title="현재 설정으로 엑셀 다운로드"
                            onClick={handleExcelDownload}
                            disabled={busyAction !== null}
                            className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-700 shadow-sm transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <FontAwesomeIcon icon={busyAction === 'excel' ? faSpinner : faDownload} spin={busyAction === 'excel'} />
                            엑셀 다운로드
                        </button>
                        <button
                            type="button"
                            aria-label="노무비 지급 명세서 표 복사"
                            title="노무비 지급 명세서 표 복사"
                            onClick={handleCopy}
                            disabled={busyAction !== null}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <FontAwesomeIcon icon={busyAction === 'copy' ? faSpinner : faCopy} spin={busyAction === 'copy'} />
                            복사
                        </button>
                        <button
                            type="button"
                            aria-label="노무비 지급 명세서 표 보내기"
                            title="노무비 지급 명세서 표 보내기"
                            onClick={handleSend}
                            disabled={busyAction !== null}
                            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <FontAwesomeIcon icon={busyAction === 'send' ? faSpinner : faShareNodes} spin={busyAction === 'send'} />
                            보내기
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const SupportClientTransactionStatementPanel: React.FC<{
    panelKey: string;
    target: SupportStatementTarget;
    yearMonth: string;
    mode: SupportTransactionStatementMode;
    linkedStatements: Estimate[];
    allStatements: Estimate[];
    loading: boolean;
    onSaved: () => Promise<void> | void;
    outputSource?: StatementOutputSource;
    onOutputSaved?: () => Promise<void> | void;
    onClose: () => void;
}> = ({ panelKey, target, yearMonth, mode, linkedStatements, allStatements, loading, onSaved, outputSource = 'support-client-site', onOutputSaved, onClose }) => {
    const [statementOptionPreset, setStatementOptionPreset] = useState<StatementIssueOptionPreset>(() => loadStatementIssueOptionPreset());
    const linkedStatement = linkedStatements[0];
    const currentPreset = useRef(statementOptionPreset);
    currentPreset.current = statementOptionPreset;
    const getInitialDraft = useCallback((preset: StatementIssueOptionPreset) => {
        const initialDraft = linkedStatement
            ? buildSupportTransactionDraftFromEstimate(linkedStatement, target, yearMonth, panelKey)
            : buildSupportTransactionDraft(target, yearMonth, panelKey, mode);
        return linkedStatement
            ? initialDraft
            : applySupportTransactionStatementOptions(initialDraft, loadSupportTransactionStatementOptions(mode, preset));
    }, [linkedStatement, mode, panelKey, target, yearMonth]);
    const [draft, setDraft] = useState<SupportTransactionStatementDraft>(() => getInitialDraft(statementOptionPreset));
    const [saving, setSaving] = useState(false);
    const [linking, setLinking] = useState(false);
    const [selectedExistingStatementId, setSelectedExistingStatementId] = useState('');
    const [statusMessage, setStatusMessage] = useState('');
    const [rentalMaterials, setRentalMaterials] = useState<Material[]>([]);
    const [rentalRates, setRentalRates] = useState<RentalMaterialRate[]>([]);
    const [rentalSettingsOpen, setRentalSettingsOpen] = useState(false);
    const [rentalRateSearch, setRentalRateSearch] = useState('');
    const [rentalWorkType, setRentalWorkType] = useState<RentalWorkType>(() =>
        loadSupportTransactionStatementOptions(mode, statementOptionPreset).rentalWorkType ?? 'shoring'
    );
    const [rentalTargetAmount, setRentalTargetAmount] = useState(() => {
        const amount = getSupportTransactionTargetAmount(target, yearMonth);
        return amount > 0 ? formatNumber(amount) : '';
    });
    const [rentalAmountBasis, setRentalAmountBasis] = useState<RentalAmountBasis>(() =>
        loadSupportTransactionStatementOptions(mode, statementOptionPreset).rentalAmountBasis ?? 'supply'
    );
    const [rentalUsageDays, setRentalUsageDays] = useState(() =>
        loadSupportTransactionStatementOptions(mode, statementOptionPreset).rentalUsageDays ?? 26
    );
    const [rentalRowCount, setRentalRowCount] = useState(() =>
        loadSupportTransactionStatementOptions(mode, statementOptionPreset).rentalRowCount ?? 10
    );
    const [lastRentalGeneration, setLastRentalGeneration] = useState<RentalGenerationResult | null>(null);
    const linkableStatements = useMemo(() =>
        allStatements.filter((statement) =>
            statement.id &&
            statement.documentType === 'transaction' &&
            isEstimateTransactionMode(statement, mode) &&
            !statement.supportStatementKey
        ),
    [allStatements, mode]);

    const applyTransactionOptionControls = useCallback((options: SupportTransactionStatementOptionDefaults) => {
        if (options.rentalAmountBasis) setRentalAmountBasis(options.rentalAmountBasis);
        if (options.rentalUsageDays) setRentalUsageDays(options.rentalUsageDays);
        if (options.rentalRowCount) setRentalRowCount(options.rentalRowCount);
        if (options.rentalWorkType) setRentalWorkType(options.rentalWorkType);
    }, []);

    useEffect(() => {
        // Preset changes apply options in the change handler without discarding edited items.
        const options = loadSupportTransactionStatementOptions(mode, currentPreset.current);
        setDraft(getInitialDraft(currentPreset.current));
        applyTransactionOptionControls(options);
        setStatusMessage('');
        setLastRentalGeneration(null);
        if (mode === 'rental') {
            const amount = getSupportTransactionTargetAmount(target, yearMonth);
            setRentalTargetAmount(amount > 0 ? formatNumber(amount) : '');
        }
    }, [applyTransactionOptionControls, getInitialDraft, mode, target, yearMonth]);

    const loadRentalMaterials = useCallback(async () => {
        try {
            const materials = await materialService.getUniqueMaterialsForSelection();
            const mergedRates = mergeRentalRatesWithMaterials(materials, readStoredSupportRentalRates());
            setRentalMaterials(materials);
            setRentalRates(mergedRates);
        } catch (error) {
            console.error('[SupportClientSitePage] rental materials load failed:', error);
            setStatusMessage('임대 자재 정보를 불러오는 중 문제가 발생했습니다.');
        }
    }, []);

    useEffect(() => {
        if (mode === 'rental') {
            loadRentalMaterials();
        }
    }, [loadRentalMaterials, mode]);

    useEffect(() => {
        if (rentalRates.length > 0) {
            writeStoredSupportRentalRates(rentalRates);
        }
    }, [rentalRates]);

    const isRentalTransaction = draft.estimateMode === 'rental';
    const statementTitle = isRentalTransaction ? '임대 거래명세서' : '거래명세서';

    const itemsWithCalc = useMemo(() => draft.items.map((item) => {
        if (isRentalTransaction) {
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
    }), [draft.items, isRentalTransaction]);

    const { subtotal, tax, total } = useMemo(() => {
        const baseSubtotal = itemsWithCalc.reduce((sum, item) => sum + (item.amount || 0), 0);
        const taxableSubtotal = Math.max(0, baseSubtotal - (draft.discount || 0));
        const taxAmount = draft.includeVat ? Math.round(taxableSubtotal * ((draft.vatRate || 10) / 100)) : 0;
        return {
            subtotal: baseSubtotal,
            tax: taxAmount,
            total: taxableSubtotal + taxAmount
        };
    }, [draft.discount, draft.includeVat, draft.vatRate, itemsWithCalc]);

    const buildTransactionStatementOutput = useCallback((
        documentId = draft.id,
        sourceDraft: SupportTransactionStatementDraft = draft
    ): StatementOutputRecord => {
        const outputItems = (sourceDraft.items || []).map((item) => {
            if (sourceDraft.estimateMode === 'rental') {
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
        });
        const outputSubtotal = outputItems.reduce((sum, item) => sum + (item.amount || 0), 0);
        const taxableSubtotal = Math.max(0, outputSubtotal - (sourceDraft.discount || 0));
        const outputTax = sourceDraft.includeVat !== false
            ? Math.round(taxableSubtotal * ((sourceDraft.vatRate || 10) / 100))
            : 0;
        const outputTotal = taxableSubtotal + outputTax;
        const firstRow = target.rows[0];
        const outputKind = sourceDraft.estimateMode === 'rental' ? 'rental' : 'transaction';

        return {
            source: outputSource,
            statementKey: panelKey,
            kind: outputKind,
            status: statementOptionPreset,
            yearMonth,
            targetTitle: target.title,
            targetSubtitle: target.subtitle,
            siteId: firstRow?.siteId,
            siteName: firstRow?.siteName || sourceDraft.projectName || target.title,
            clientCompanyName: sourceDraft.clientCompany || firstRow?.clientCompanyName || firstRow?.constructorCompanyName,
            teamName: firstRow?.responsibleTeamName || firstRow?.sourceTeamName,
            documentId,
            documentNo: sourceDraft.estimateNo,
            documentTitle: sourceDraft.title || (outputKind === 'rental' ? '임대명세서' : '거래명세서'),
            amountSummary: {
                supplyAmount: outputSubtotal,
                vatAmount: outputTax,
                totalAmount: outputTotal,
            },
            optionPreset: statementOptionPreset,
            optionSnapshot: {
                includeVat: sourceDraft.includeVat !== false,
                vatRate: sourceDraft.vatRate || 10,
                paymentTerms: sourceDraft.paymentTerms || '',
                notes: sourceDraft.notes || '',
                rentalAmountBasis,
                rentalUsageDays,
                rentalRowCount,
                rentalWorkType,
            },
            snapshot: {
                itemCount: outputItems.length,
                discount: sourceDraft.discount || 0,
                issueDate: sourceDraft.issueDate || '',
                items: outputItems.map((item) => ({
                    id: item.id,
                    label: item.label,
                    section: item.section,
                    quantity: item.quantity,
                    unit: item.unit,
                    unitPrice: item.finalUnitPrice || item.unitPrice || 0,
                    amount: item.amount || 0,
                })),
                rentalGeneration: lastRentalGeneration ? {
                    targetSupply: lastRentalGeneration.targetSupply,
                    subtotal: lastRentalGeneration.subtotal,
                    difference: lastRentalGeneration.difference,
                    itemCount: lastRentalGeneration.items.length,
                } : undefined,
            },
        };
    }, [
        draft,
        lastRentalGeneration,
        outputSource,
        panelKey,
        rentalAmountBasis,
        rentalRowCount,
        rentalUsageDays,
        rentalWorkType,
        statementOptionPreset,
        target.rows,
        target.subtitle,
        target.title,
        yearMonth,
    ]);

    const updateDraft = useCallback((field: keyof EstimateDraft, value: any) => {
        setDraft((prev) => ({ ...prev, [field]: value }));
    }, []);

    const updateItem = useCallback((itemId: string, field: string, value: any) => {
        setDraft((prev) => ({
            ...prev,
            items: prev.items.map((item) => {
                if (item.id !== itemId) return item;
                const nextItem = { ...item, [field]: value };
                if (field === 'finalUnitPrice') nextItem.unitPrice = value;
                return nextItem;
            })
        }));
    }, []);

    const rentalRatesForSelectedWorkType = useMemo(() => (
        rentalRates.filter((rate) => isRentalRateInWorkType(rate, rentalWorkType))
    ), [rentalRates, rentalWorkType]);

    const filteredRentalRates = useMemo(() => {
        const keyword = rentalRateSearch.trim().toLowerCase();
        if (!keyword) return rentalRatesForSelectedWorkType;
        return rentalRatesForSelectedWorkType.filter((rate) => (
            `${rate.category} ${rate.itemName} ${rate.spec} ${rate.unit}`.toLowerCase().includes(keyword)
        ));
    }, [rentalRateSearch, rentalRatesForSelectedWorkType]);

    const rentalActiveCount = rentalRatesForSelectedWorkType.filter((rate) => rate.active !== false).length;

    const updateRentalRate = useCallback((materialId: string, field: keyof RentalMaterialRate, value: any) => {
        setRentalRates((prev) => prev.map((rate) => (
            rate.materialId === materialId ? { ...rate, [field]: value } : rate
        )));
        setLastRentalGeneration(null);
    }, []);

    const resetRentalRatesFromMaster = useCallback(() => {
        setRentalRates(mergeRentalRatesWithMaterials(rentalMaterials, []));
        setLastRentalGeneration(null);
    }, [rentalMaterials]);

    const applyRentalGeneration = useCallback(() => {
        const targetAmount = parseSupportMoneyInput(rentalTargetAmount);
        if (targetAmount <= 0) {
            setStatusMessage('자동 생성할 목표 금액을 입력해주세요.');
            return;
        }
        if (rentalActiveCount === 0) {
            setStatusMessage(`${SUPPORT_RENTAL_WORK_TYPE_LABELS[rentalWorkType]} 자재를 1개 이상 선택해주세요.`);
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
            setStatusMessage('조건에 맞는 임대 자재 품목을 생성하지 못했습니다. 단가 설정을 확인해주세요.');
            return;
        }

        setDraft((prev) => ({
            ...prev,
            estimateMode: 'rental',
            title: '임대 거래명세서',
            notes: '',
            items: result.items,
        }));
        setLastRentalGeneration(result);
        setStatusMessage(`임대 품목 ${result.items.length}개를 공급가 ${formatNumber(result.subtotal)}원 기준으로 생성했습니다.`);
    }, [
        draft.includeVat,
        draft.issueDate,
        draft.vatRate,
        rentalActiveCount,
        rentalAmountBasis,
        rentalRates,
        rentalRowCount,
        rentalTargetAmount,
        rentalUsageDays,
        rentalWorkType,
    ]);

    const handleExcelDownload = useCallback(async () => {
        try {
            await downloadEstimateExcel(draft, itemsWithCalc, subtotal, tax, total, 'transaction', { freezePanes: false });
            setStatusMessage(`${statementTitle} 엑셀 파일을 생성했습니다.`);
        } catch (error) {
            console.error('[SupportClientSitePage] transaction statement excel download failed:', error);
            setStatusMessage('엑셀 파일 생성 중 문제가 발생했습니다.');
        }
    }, [draft, itemsWithCalc, statementTitle, subtotal, tax, total]);

    const handleNewStatement = useCallback(() => {
        const options = loadSupportTransactionStatementOptions(mode, statementOptionPreset);
        setDraft(applySupportTransactionStatementOptions(
            buildSupportTransactionDraft(target, yearMonth, panelKey, mode),
            options
        ));
        applyTransactionOptionControls(options);
        setLastRentalGeneration(null);
        setStatusMessage(`새 ${statementTitle}를 작성 중입니다.`);
    }, [applyTransactionOptionControls, mode, panelKey, statementOptionPreset, statementTitle, target, yearMonth]);

    const handleLoadStatement = useCallback((statement: Estimate) => {
        setDraft(buildSupportTransactionDraftFromEstimate(statement, target, yearMonth, panelKey));
        setLastRentalGeneration(null);
        setStatusMessage(`연동된 ${statementTitle}를 불러왔습니다.`);
    }, [panelKey, statementTitle, target, yearMonth]);

    const handleLinkExistingStatement = async () => {
        const statement = linkableStatements.find((candidate) => candidate.id === selectedExistingStatementId);
        if (!statement?.id) {
            setStatusMessage(`연결할 ${statementTitle}를 선택해주세요.`);
            return;
        }

        try {
            setLinking(true);
            await estimateService.updateEstimate(statement.id, getSupportTransactionLinkFields(panelKey, target, yearMonth, outputSource));
            const linkedDraft = buildSupportTransactionDraftFromEstimate(statement, target, yearMonth, panelKey);
            setDraft(linkedDraft);
            await statementOutputService.upsertOutput(buildTransactionStatementOutput(statement.id, linkedDraft));
            setSelectedExistingStatementId('');
            setStatusMessage(`기존 ${statementTitle}를 이 행에 연결했습니다.`);
            await onSaved();
            await onOutputSaved?.();
        } catch (error) {
            console.error('[SupportClientSitePage] transaction statement link failed:', error);
            setStatusMessage(`기존 ${statementTitle} 연결 중 문제가 발생했습니다.`);
        } finally {
            setLinking(false);
        }
    };

    const handleStatementOptionPresetChange = useCallback((value: StatementIssueOptionPreset) => {
        setStatementOptionPreset(value);
        saveStatementIssueOptionPreset(value);
        const options = loadSupportTransactionStatementOptions(mode, value);
        setDraft((prev) => applySupportTransactionStatementOptions(prev, options));
        applyTransactionOptionControls(options);
        const label = STATEMENT_ISSUE_OPTION_PRESETS.find((option) => option.value === value)?.label ?? '선택';
        setStatusMessage(`${label} ${statementTitle} 옵션을 불러왔습니다.`);
    }, [applyTransactionOptionControls, mode, statementTitle]);

    const handleSaveStatementOptions = useCallback(async () => {
        saveSupportTransactionStatementOptions(mode, statementOptionPreset, {
            includeVat: draft.includeVat !== false,
            vatRate: draft.vatRate || 10,
            paymentTerms: draft.paymentTerms || '',
            notes: draft.notes || '',
            rentalAmountBasis,
            rentalUsageDays,
            rentalRowCount,
            rentalWorkType,
        });
        const label = STATEMENT_ISSUE_OPTION_PRESETS.find((option) => option.value === statementOptionPreset)?.label ?? '선택';
        try {
            await statementOutputService.upsertOutput(buildTransactionStatementOutput());
            await onOutputSaved?.();
            setStatusMessage(`${label} ${statementTitle} 옵션을 저장하고 문서대장에 반영했습니다.`);
        } catch (error) {
            console.error('[SupportClientSitePage] transaction statement output option save failed:', error);
            setStatusMessage(`${label} ${statementTitle} 옵션은 저장했지만 문서대장 반영에 실패했습니다.`);
        }
    }, [
        buildTransactionStatementOutput,
        draft.includeVat,
        draft.notes,
        draft.paymentTerms,
        draft.vatRate,
        mode,
        onOutputSaved,
        rentalAmountBasis,
        rentalRowCount,
        rentalUsageDays,
        rentalWorkType,
        statementOptionPreset,
        statementTitle,
    ]);

    const handleSave = async () => {
        const title = String(draft.title || '').trim();
        const clientCompany = String(draft.clientCompany || '').trim();
        const projectName = String(draft.projectName || '').trim();
        if (!title || !clientCompany || !projectName) {
            setStatusMessage('업체명, 현장명, 제목을 입력해주세요.');
            return;
        }

        try {
            setSaving(true);
            const payload = {
                ...draft,
                ...getSupportTransactionLinkFields(panelKey, target, yearMonth, outputSource),
                documentType: 'transaction' as DocumentType,
                estimateMode: isRentalTransaction ? 'rental' as const : 'standard' as const,
                title,
                clientCompany,
                projectName,
                items: itemsWithCalc,
                subtotal,
                tax,
                total
            };
            const { id, ...savePayload } = payload;
            let savedId = id;

            if (id) {
                await estimateService.updateEstimate(id, savePayload as Partial<Estimate>);
                setStatusMessage(`${statementTitle}가 수정되었습니다.`);
            } else {
                const newId = await estimateService.addEstimate(savePayload as Omit<Estimate, 'id' | 'createdAt' | 'updatedAt'>);
                savedId = newId;
                setDraft((prev) => ({ ...prev, id: newId }));
                setStatusMessage(`새 ${statementTitle}가 저장되고 이 행에 연결되었습니다.`);
            }

            await statementOutputService.upsertOutput(buildTransactionStatementOutput(
                savedId,
                { ...payload, id: savedId } as SupportTransactionStatementDraft
            ));
            await onSaved();
            await onOutputSaved?.();
        } catch (error) {
            console.error('[SupportClientSitePage] transaction statement save failed:', error);
            setStatusMessage('저장 중 문제가 발생했습니다. 다시 시도해주세요.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-4 rounded-2xl border border-teal-200 bg-white p-4 shadow-sm" onClick={(event) => event.stopPropagation()}>
            <div className="flex flex-col gap-3 border-b border-teal-100 pb-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <h3 className="flex items-center gap-2 text-base font-black text-slate-900">
                        <FontAwesomeIcon icon={faFileInvoice} className={isRentalTransaction ? 'text-amber-600' : 'text-teal-600'} />
                        {statementTitle}
                    </h3>
                    <p className="mt-1 text-xs font-bold text-slate-500">
                        {target.title}{target.subtitle ? ` · ${target.subtitle}` : ''}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={handleNewStatement}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-3 text-xs font-black text-teal-700 transition hover:bg-teal-100"
                    >
                        <FontAwesomeIcon icon={faPlus} />
                        {mode === 'rental' ? '새 임대명세' : '새 거래명세'}
                    </button>
                    <button
                        type="button"
                        onClick={handleExcelDownload}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-black text-emerald-700 transition hover:bg-emerald-100"
                    >
                        <FontAwesomeIcon icon={faDownload} />
                        엑셀
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label={`${statementTitle} 닫기`}
                        title="닫기"
                        className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 transition hover:bg-slate-50"
                    >
                        <FontAwesomeIcon icon={faXmark} />
                        닫기
                    </button>
                </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.2fr)]">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                        <div className="text-xs font-black text-slate-600">연동된 {statementTitle}</div>
                        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-black text-teal-700">
                            {linkedStatements.length}건
                        </span>
                    </div>
                    <div className="mt-3 max-h-40 space-y-2 overflow-auto">
                        {loading ? (
                            <div className="rounded-lg border border-slate-200 bg-white px-3 py-3 text-xs font-bold text-slate-400">
                                불러오는 중...
                            </div>
                        ) : linkedStatements.length > 0 ? linkedStatements.map((statement) => (
                            <button
                                key={statement.id}
                                type="button"
                                onClick={() => handleLoadStatement(statement)}
                                className={`block w-full rounded-lg border px-3 py-2 text-left transition ${
                                    draft.id === statement.id
                                        ? 'border-teal-400 bg-teal-50 text-teal-900'
                                        : 'border-slate-200 bg-white text-slate-700 hover:border-teal-200 hover:bg-teal-50/50'
                                }`}
                            >
                                <div className="truncate text-xs font-black">{statement.projectName || statement.title || '거래명세표'}</div>
                                <div className="mt-1 flex items-center justify-between gap-2 text-[11px] font-bold text-slate-500">
                                    <span className="truncate">{statement.clientCompany || '업체명 미입력'}</span>
                                    <span className="shrink-0 font-mono">{formatNumber(statement.total || 0)}원</span>
                                </div>
                                <div className="mt-0.5 text-[10px] font-bold text-slate-400">{statement.issueDate || '-'}</div>
                            </button>
                        )) : (
                            <div className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-4 text-xs font-bold text-slate-400">
                                아직 연결된 {statementTitle}가 없습니다.
                            </div>
                        )}
                    </div>
                    <div className="mt-3 rounded-lg border border-teal-100 bg-white p-2">
                        <div className="mb-1 text-[11px] font-black text-slate-500">기존 {statementTitle} 연결</div>
                        <div className="flex gap-1.5">
                            <select
                                value={selectedExistingStatementId}
                                onChange={(event) => setSelectedExistingStatementId(event.target.value)}
                                disabled={loading || linking || linkableStatements.length === 0}
                                className="h-8 min-w-0 flex-1 rounded-md border border-slate-200 bg-slate-50 px-2 text-xs font-bold text-slate-700 outline-none focus:border-teal-500 disabled:text-slate-400"
                            >
                                <option value="">
                                    {linkableStatements.length > 0 ? `${statementTitle} 선택` : `연결 가능한 ${statementTitle} 없음`}
                                </option>
                                {linkableStatements.map((statement) => (
                                    <option key={statement.id} value={statement.id}>
                                        {[statement.projectName || statement.title || '거래명세표', statement.clientCompany, statement.issueDate]
                                            .filter(Boolean)
                                            .join(' / ')}
                                    </option>
                                ))}
                            </select>
                            <button
                                type="button"
                                onClick={handleLinkExistingStatement}
                                disabled={loading || linking || !selectedExistingStatementId}
                                className="inline-flex h-8 items-center rounded-md bg-teal-600 px-2 text-xs font-black text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {linking ? '연결 중' : '연결'}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="grid gap-2 md:grid-cols-6">
                        <label className="block">
                            <span className="text-[11px] font-black text-slate-500">업체명</span>
                            <input
                                type="text"
                                value={draft.clientCompany || ''}
                                onChange={(event) => updateDraft('clientCompany', event.target.value)}
                                className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-bold outline-none focus:border-teal-500 focus:bg-white"
                                placeholder="수기 입력"
                            />
                        </label>
                        <label className="block">
                            <span className="text-[11px] font-black text-slate-500">현장명</span>
                            <input
                                type="text"
                                value={draft.projectName || ''}
                                onChange={(event) => updateDraft('projectName', event.target.value)}
                                className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-bold outline-none focus:border-teal-500 focus:bg-white"
                                placeholder="수기 입력"
                            />
                        </label>
                        <label className="block">
                            <span className="text-[11px] font-black text-slate-500">작성일</span>
                            <input
                                type="date"
                                value={draft.issueDate || ''}
                                onChange={(event) => updateDraft('issueDate', event.target.value)}
                                className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-bold outline-none focus:border-teal-500 focus:bg-white"
                            />
                        </label>
                        <label className="block">
                            <span className="text-[11px] font-black text-slate-500">제목</span>
                            <input
                                type="text"
                                value={draft.title || ''}
                                onChange={(event) => updateDraft('title', event.target.value)}
                                className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-bold outline-none focus:border-teal-500 focus:bg-white"
                            />
                        </label>
                        <label className="block">
                            <span className="text-[11px] font-black text-slate-500">VAT</span>
                            <select
                                value={draft.includeVat === false ? 'excluded' : 'included'}
                                onChange={(event) => updateDraft('includeVat', event.target.value === 'included')}
                                className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-bold outline-none focus:border-teal-500 focus:bg-white"
                            >
                                <option value="included">VAT 포함</option>
                                <option value="excluded">VAT 제외</option>
                            </select>
                        </label>
                        <label className="block">
                            <span className="text-[11px] font-black text-slate-500">부가세율</span>
                            <input
                                type="number"
                                min={0}
                                step={1}
                                value={draft.vatRate || 10}
                                onChange={(event) => updateDraft('vatRate', Math.max(0, Number(event.target.value) || 0))}
                                className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-right text-sm font-bold outline-none focus:border-teal-500 focus:bg-white"
                            />
                        </label>
                    </div>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-black text-slate-500">옵션 저장</span>
                                <div className="inline-flex overflow-hidden rounded-md border border-slate-200 bg-white">
                                    {STATEMENT_ISSUE_OPTION_PRESETS.map((option) => (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => handleStatementOptionPresetChange(option.value)}
                                            className={`h-8 px-3 text-xs font-black transition ${
                                                statementOptionPreset === option.value
                                                    ? 'bg-teal-600 text-white'
                                                    : 'bg-white text-slate-600 hover:bg-teal-50 hover:text-teal-700'
                                            }`}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    type="button"
                                    onClick={handleSaveStatementOptions}
                                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-teal-200 bg-teal-50 px-3 text-xs font-black text-teal-700 transition hover:bg-teal-100"
                                >
                                    <FontAwesomeIcon icon={faSave} />
                                    옵션 저장
                                </button>
                            </div>
                            <div className="min-h-[20px] text-xs font-bold text-teal-700">{statusMessage}</div>
                        </div>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving}
                            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-black text-white shadow-sm transition hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <FontAwesomeIcon icon={saving ? faSpinner : faSave} spin={saving} />
                            {saving ? '저장 중...' : (draft.id ? `${statementTitle} 수정` : `${statementTitle} 저장`)}
                        </button>
                    </div>
                </div>
            </div>

            {isRentalTransaction && (
                <section className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <h4 className="text-sm font-black text-slate-900">임대 금액 자동 생성</h4>
                                <span className="rounded-lg bg-white px-2 py-1 text-[11px] font-black text-amber-700">
                                    사용 {rentalActiveCount} / 선택 {rentalRatesForSelectedWorkType.length}
                                </span>
                            </div>
                            {lastRentalGeneration && (
                                <div className="mt-2 flex flex-wrap gap-2 text-[12px] font-bold text-slate-600">
                                    <span>목표 공급가 {formatNumber(lastRentalGeneration.targetSupply)}원</span>
                                    <span>생성 공급가 {formatNumber(lastRentalGeneration.subtotal)}원</span>
                                    <span className={lastRentalGeneration.difference === 0 ? 'text-emerald-600' : 'text-rose-600'}>
                                        차이 {formatNumber(lastRentalGeneration.difference)}원
                                    </span>
                                </div>
                            )}
                        </div>

                        <div className="grid w-full grid-cols-2 gap-2 md:grid-cols-6 xl:w-auto xl:min-w-[920px]">
                            <label className="col-span-2 md:col-span-1">
                                <span className="mb-1 block text-[11px] font-black text-slate-500">임대 항목</span>
                                <select
                                    value={rentalWorkType}
                                    onChange={(event) => {
                                        setRentalWorkType(event.target.value as RentalWorkType);
                                        setLastRentalGeneration(null);
                                    }}
                                    className="h-10 w-full rounded-lg border border-amber-200 bg-white px-3 text-sm font-bold outline-none focus:border-amber-500"
                                >
                                    <option value="shoring">시스템 동바리</option>
                                    <option value="scaffold">시스템 비계</option>
                                </select>
                            </label>
                            <label className="col-span-2 md:col-span-1">
                                <span className="mb-1 block text-[11px] font-black text-slate-500">목표 금액</span>
                                <input
                                    value={rentalTargetAmount}
                                    onChange={(event) => setRentalTargetAmount(event.target.value)}
                                    onBlur={() => setRentalTargetAmount(rentalTargetAmount ? formatNumber(parseSupportMoneyInput(rentalTargetAmount)) : '')}
                                    inputMode="numeric"
                                    className="h-10 w-full rounded-lg border border-amber-200 bg-white px-3 text-right text-sm font-black outline-none focus:border-amber-500"
                                    placeholder="0"
                                />
                            </label>
                            <label>
                                <span className="mb-1 block text-[11px] font-black text-slate-500">금액 기준</span>
                                <select
                                    value={rentalAmountBasis}
                                    onChange={(event) => setRentalAmountBasis(event.target.value as RentalAmountBasis)}
                                    className="h-10 w-full rounded-lg border border-amber-200 bg-white px-3 text-sm font-bold outline-none focus:border-amber-500"
                                >
                                    <option value="supply">공급가</option>
                                    <option value="total">VAT 포함</option>
                                </select>
                            </label>
                            <label>
                                <span className="mb-1 block text-[11px] font-black text-slate-500">사용일수</span>
                                <input
                                    type="number"
                                    min={1}
                                    value={rentalUsageDays}
                                    onChange={(event) => setRentalUsageDays(Math.max(1, Number(event.target.value) || 1))}
                                    className="h-10 w-full rounded-lg border border-amber-200 bg-white px-3 text-right text-sm font-bold outline-none focus:border-amber-500"
                                />
                            </label>
                            <label>
                                <span className="mb-1 block text-[11px] font-black text-slate-500">자재 수</span>
                                <input
                                    type="number"
                                    min={1}
                                    max={30}
                                    value={rentalRowCount}
                                    onChange={(event) => setRentalRowCount(Math.max(1, Math.min(30, Number(event.target.value) || 1)))}
                                    className="h-10 w-full rounded-lg border border-amber-200 bg-white px-3 text-right text-sm font-bold outline-none focus:border-amber-500"
                                />
                            </label>
                            <div className="flex items-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setRentalSettingsOpen((open) => !open)}
                                    className="h-10 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-black text-slate-600 transition hover:border-amber-400 hover:text-amber-700"
                                >
                                    단가 설정
                                </button>
                                <button
                                    type="button"
                                    onClick={applyRentalGeneration}
                                    className="h-10 flex-1 rounded-lg bg-amber-600 px-3 text-[12px] font-black text-white shadow-sm transition hover:bg-amber-700"
                                >
                                    적용
                                </button>
                            </div>
                        </div>
                    </div>

                    {rentalSettingsOpen && (
                        <div className="mt-4 border-t border-amber-100 pt-4">
                            <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                <input
                                    value={rentalRateSearch}
                                    onChange={(event) => setRentalRateSearch(event.target.value)}
                                    className="h-9 w-full rounded-lg border border-amber-200 bg-white px-3 text-sm font-bold outline-none focus:border-amber-500 md:max-w-sm"
                                    placeholder="분류, 품목, 규격 검색"
                                />
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={loadRentalMaterials}
                                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-black text-slate-600 hover:border-slate-300"
                                    >
                                        자재 새로고침
                                    </button>
                                    <button
                                        type="button"
                                        onClick={resetRentalRatesFromMaster}
                                        className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-[12px] font-black text-amber-700 hover:bg-amber-100"
                                    >
                                        단가 초기화
                                    </button>
                                </div>
                            </div>
                            <div className="max-h-[300px] overflow-auto rounded-xl border border-amber-100 bg-white">
                                <table className="w-full min-w-[900px] text-sm">
                                    <thead className="sticky top-0 z-10 bg-slate-100 text-[12px] text-slate-600">
                                        <tr>
                                            <th className="w-16 px-3 py-2 text-center font-black">사용</th>
                                            <th className="px-3 py-2 text-left font-black">분류</th>
                                            <th className="px-3 py-2 text-left font-black">품목</th>
                                            <th className="px-3 py-2 text-left font-black">규격</th>
                                            <th className="w-20 px-3 py-2 text-center font-black">단위</th>
                                            <th className="w-28 px-3 py-2 text-right font-black">기본료</th>
                                            <th className="w-28 px-3 py-2 text-right font-black">일 임대료</th>
                                            <th className="w-28 px-3 py-2 text-right font-black">최대수량</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredRentalRates.map((rate) => (
                                            <tr key={rate.materialId} className="hover:bg-amber-50/60">
                                                <td className="px-3 py-2 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={rate.active !== false}
                                                        onChange={(event) => updateRentalRate(rate.materialId, 'active', event.target.checked)}
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
                                                        onChange={(event) => updateRentalRate(rate.materialId, 'baseFee', Math.max(0, Number(event.target.value) || 0))}
                                                        className="h-8 w-full rounded-md border border-slate-200 px-2 text-right font-bold outline-none focus:border-amber-500"
                                                    />
                                                </td>
                                                <td className="px-3 py-2">
                                                    <input
                                                        type="number"
                                                        value={rate.dailyFee}
                                                        onChange={(event) => updateRentalRate(rate.materialId, 'dailyFee', Math.max(0, Number(event.target.value) || 0))}
                                                        className="h-8 w-full rounded-md border border-slate-200 px-2 text-right font-bold outline-none focus:border-amber-500"
                                                    />
                                                </td>
                                                <td className="px-3 py-2">
                                                    <input
                                                        type="number"
                                                        value={rate.maxQuantity}
                                                        onChange={(event) => updateRentalRate(rate.materialId, 'maxQuantity', Math.max(1, Number(event.target.value) || 1))}
                                                        className="h-8 w-full rounded-md border border-slate-200 px-2 text-right font-bold outline-none focus:border-amber-500"
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                        {filteredRentalRates.length === 0 && (
                                            <tr>
                                                <td colSpan={8} className="px-3 py-10 text-center text-sm font-bold text-slate-400">
                                                    표시할 자재가 없습니다.
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

            <div className="max-h-[64vh] overflow-auto rounded-2xl border border-slate-200 bg-slate-100 p-4">
                <div className={`inline-block ${isRentalTransaction ? 'min-w-[1240px]' : 'min-w-[1120px]'} bg-white p-8 shadow-sm`}>
                    <TitleComponent text={isRentalTransaction ? '임 대 거 래 명 세 표' : '거 래 명 세 표'} logoUrl={LOGO_FALLBACK} />
                    <InfoTableComponent draft={draft} isEdit={true} updateDraft={updateDraft} />
                    <AmountBarComponent subtotal={subtotal} totalAmt={total} taxAmt={tax} isTransaction={true} draft={draft} />
                    {isRentalTransaction ? (
                        <RentalTransactionTable draft={draft} itemsWithCalc={itemsWithCalc} isEdit={true} updateItem={updateItem} setDraft={setDraft} />
                    ) : (
                        <TransactionTable draft={draft} itemsWithCalc={itemsWithCalc} isEdit={true} updateItem={updateItem} setDraft={setDraft} />
                    )}
                    <div className="mt-4 rounded-xl border-2 border-dashed border-slate-200 p-4 text-center text-sm font-black tracking-widest text-slate-400">
                        위 금액을 정히 영수(청구)함
                    </div>
                </div>
            </div>
        </div>
    );
};

export const SupportClientExpenseStatementModal: React.FC<{
    target: SupportStatementTarget;
    yearMonth: string;
    onClose: () => void;
}> = ({ target, yearMonth, onClose }) => {
    const [statusMessage, setStatusMessage] = useState('');
    const [busyAction, setBusyAction] = useState<'copy' | 'send' | null>(null);
    const statementSheetRef = useRef<HTMLDivElement | null>(null);
    const sortedClaims = useMemo(() => sortExpenseClaims(target.expenseClaims), [target.expenseClaims]);
    const totalAmount = getExpenseClaimsTotal(sortedClaims);
    const shareTitle = `후청구 경비내역_${yearMonth}_${target.title}`;
    const imageFileName = `${sanitizeFileNamePart(shareTitle)}.png`;

    const captureStatementImage = async (): Promise<Blob> => {
        if (!statementSheetRef.current) {
            throw new Error('후청구 경비내역 표 영역을 찾지 못했습니다.');
        }
        return captureElementToPngBlob(statementSheetRef.current);
    };

    const handleCopy = async () => {
        let htmlCopied = false;
        try {
            setBusyAction('copy');
            if (!statementSheetRef.current) {
                throw new Error('후청구 경비내역 표 영역을 찾지 못했습니다.');
            }
            htmlCopied = copyElementHtmlToClipboard(statementSheetRef.current);
            await copyElementToPngClipboard(statementSheetRef.current, '후청구 경비내역');
            setStatusMessage('후청구 경비내역 표 이미지를 복사했습니다.');
        } catch (error) {
            console.error('후청구 경비내역 이미지 복사 실패:', error);
            setStatusMessage(
                htmlCopied
                    ? '이미지 복사가 제한되어 후청구 경비내역 표 형식으로 복사했습니다.'
                    : '이 브라우저에서 이미지 복사를 지원하지 않습니다. 공유 버튼을 사용해 주세요.'
            );
        } finally {
            setBusyAction(null);
        }
    };

    const handleSend = async () => {
        const shareNavigator = navigator as Navigator & {
            canShare?: (data: { files?: File[] }) => boolean;
            share?: (data: { title?: string; text?: string; files?: File[] }) => Promise<void>;
        };

        try {
            setBusyAction('send');
            const blob = await captureStatementImage();
            const file = new File([blob], imageFileName, { type: 'image/png' });

            if (!shareNavigator.share || (shareNavigator.canShare && !shareNavigator.canShare({ files: [file] }))) {
                saveAs(blob, imageFileName);
                setStatusMessage('이미지 공유를 지원하지 않아 PNG 파일로 저장했습니다.');
                return;
            }

            await shareNavigator.share({
                title: shareTitle,
                text: '후청구 경비내역',
                files: [file]
            });
            setStatusMessage('후청구 경비내역 이미지를 보낼 수 있도록 공유를 열었습니다.');
        } catch (error) {
            if ((error as DOMException)?.name !== 'AbortError') {
                console.error('후청구 경비내역 이미지 공유 실패:', error);
                setStatusMessage('이미지 공유를 열지 못했습니다.');
            }
        } finally {
            setBusyAction(null);
        }
    };

    return (
        <SupportClientStatementModalShell title="경비내역서" onClose={onClose}>
            <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-[11px] font-black text-slate-500">대상</div>
                        <div className="mt-1 text-sm font-black text-slate-900">{target.title}</div>
                        {target.subtitle && <div className="mt-1 text-[11px] font-bold text-slate-500">{target.subtitle}</div>}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-[11px] font-black text-slate-500">후청구 건수</div>
                        <div className="mt-1 text-sm font-black text-slate-900">{formatNumber(sortedClaims.length)}건</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-teal-50 p-4">
                        <div className="text-[11px] font-black text-teal-700">후청구 합계</div>
                        <div className="mt-1 text-sm font-black text-teal-800">{formatNumber(totalAmount)}원</div>
                    </div>
                </div>

                <div className="overflow-auto rounded-xl border border-slate-900 bg-white">
                    <div ref={statementSheetRef} data-statement-capture="true" className="inline-block min-w-[1120px] bg-white">
                        <table className="w-full border-collapse text-xs">
                            <thead className="bg-slate-100 text-slate-700">
                            <tr>
                                <th className="border border-slate-900 px-3 py-2 text-left">일자</th>
                                <th className="border border-slate-900 px-3 py-2 text-left">현장</th>
                                <th className="border border-slate-900 px-3 py-2 text-left">사용팀</th>
                                <th className="border border-slate-900 px-3 py-2 text-left">청구대상</th>
                                <th className="border border-slate-900 px-3 py-2 text-left">구분</th>
                                <th className="border border-slate-900 px-3 py-2 text-left">내용</th>
                                <th className="border border-slate-900 px-3 py-2 text-left">상태</th>
                                <th className="border border-slate-900 px-3 py-2 text-right">금액</th>
                                <th className="border border-slate-900 px-3 py-2 text-left">메모</th>
                            </tr>
                            </thead>
                            <tbody>
                            {sortedClaims.length > 0 ? sortedClaims.map((claim) => (
                                <tr key={getExpenseClaimKey(claim)}>
                                    <td className="border border-slate-900 px-3 py-2 font-mono text-slate-500">{claim.date}</td>
                                    <td className="border border-slate-900 px-3 py-2 font-bold text-slate-700">{claim.siteName || '-'}</td>
                                    <td className="border border-slate-900 px-3 py-2">{claim.payerTeamName || '-'}</td>
                                    <td className="border border-slate-900 px-3 py-2">{claim.chargeToTeamName || '-'}</td>
                                    <td className="border border-slate-900 px-3 py-2">{claim.category || '-'}</td>
                                    <td className="border border-slate-900 px-3 py-2 font-bold text-slate-700">{claim.description || '-'}</td>
                                    <td className="border border-slate-900 px-3 py-2">{getExpenseClaimStatusLabel(claim.status)}</td>
                                    <td className="border border-slate-900 px-3 py-2 text-right font-mono font-black">{formatNumber(getExpenseClaimAmount(claim))}</td>
                                    <td className="border border-slate-900 px-3 py-2 text-slate-500">{claim.memo || '-'}</td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={9} className="border border-slate-900 px-3 py-10 text-center font-bold text-slate-400">
                                        등록된 후청구 경비내역이 없습니다.
                                    </td>
                                </tr>
                            )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-h-[20px] text-sm font-bold text-emerald-700">{statusMessage}</div>
                    <div className="flex flex-wrap justify-end gap-2">
                        <button
                            type="button"
                            aria-label="후청구 경비내역 표 복사"
                            title="후청구 경비내역 표 복사"
                            onClick={handleCopy}
                            disabled={busyAction !== null}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <FontAwesomeIcon icon={busyAction === 'copy' ? faSpinner : faCopy} spin={busyAction === 'copy'} />
                            복사
                        </button>
                        <button
                            type="button"
                            aria-label="후청구 경비내역 표 보내기"
                            title="후청구 경비내역 표 보내기"
                            onClick={handleSend}
                            disabled={busyAction !== null}
                            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <FontAwesomeIcon icon={busyAction === 'send' ? faSpinner : faShareNodes} spin={busyAction === 'send'} />
                            보내기
                        </button>
                    </div>
                </div>
            </div>
        </SupportClientStatementModalShell>
    );
};

export const SummaryCard: React.FC<{
    label: string;
    value: React.ReactNode;
    icon: any;
    tone: 'emerald' | 'sky' | 'orange' | 'violet';
    compact?: boolean;
}> = ({ label, value, icon, tone, compact = false }) => {
    const toneMap = {
        emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-500', text: 'text-emerald-700' },
        sky: { bg: 'bg-sky-50', icon: 'text-sky-500', text: 'text-sky-700' },
        orange: { bg: 'bg-orange-50', icon: 'text-orange-500', text: 'text-orange-700' },
        violet: { bg: 'bg-violet-50', icon: 'text-violet-500', text: 'text-violet-700' }
    } as const;

    return (
        <div className={`min-w-0 rounded-xl border border-slate-100 bg-white ${compact ? 'px-3 py-2' : 'p-3'} shadow-sm`}>
            <div className={compact ? 'flex items-center gap-1.5' : `mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg ${toneMap[tone].bg}`}>
                <FontAwesomeIcon icon={icon} className={`text-sm ${toneMap[tone].icon}`} />
                {compact && <p className="text-sm font-bold text-slate-500">{label}</p>}
            </div>
            {!compact && <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">{label}</p>}
            <p className={`${compact ? '' : 'mt-0.5'} break-words text-lg font-black leading-tight ${toneMap[tone].text}`}>{value}</p>
        </div>
    );
};

export const SupportClientAllocationModal: React.FC<{
    target: SupportClientAllocationModalTarget;
    settlementTargets: SettlementTarget[];
    companies: Company[];
    saving: boolean;
    onClose: () => void;
    onSave: (lines: SupportClientAllocationLine[]) => Promise<void>;
}> = ({ target, settlementTargets, companies, saving, onClose, onSave }) => {
    const [lines, setLines] = useState<SupportClientAllocationLine[]>(() => (
        target.allocation?.lines?.length
            ? target.allocation.lines.map((line) => ({ ...line, amount: Number(line.amount || 0) }))
            : []
    ));
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setLines(target.allocation?.lines?.length
            ? target.allocation.lines.map((line) => ({ ...line, amount: Number(line.amount || 0) }))
            : []);
        setError(null);
    }, [target]);

    const activeTargets = useMemo(
        () => settlementTargets.filter((item) => item.status !== 'inactive'),
        [settlementTargets]
    );

    const contactTargets = useMemo(
        () => activeTargets
            .filter((item) => item.targetType === 'client_contact')
            .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ko')),
        [activeTargets]
    );

    const otherTargets = useMemo(
        () => activeTargets
            .filter((item) => item.targetType === 'other')
            .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ko')),
        [activeTargets]
    );

    const rentalCompanyOptions = useMemo(
        () => companies
            .filter((company) => company.type === '임대사')
            .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ko')),
        [companies]
    );

    const clientCompanyOptions = useMemo(
        () => companies
            .filter((company) => company.type === '건설사')
            .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ko')),
        [companies]
    );

    const allocatedAmount = useMemo(
        () => lines.reduce((sum, line) => sum + Number(line.amount || 0), 0),
        [lines]
    );
    const unallocatedAmount = target.distributableAmount - allocatedAmount;

    const updateLine = (lineId: string, updates: Partial<SupportClientAllocationLine>) => {
        setLines((prev) => prev.map((line) => line.id === lineId ? { ...line, ...updates } : line));
    };

    const addLine = () => {
        setLines((prev) => [
            ...prev,
            {
                id: createAllocationLineId(),
                targetId: '',
                targetName: '사무실 수입',
                targetType: 'office_income',
                companyId: '',
                companyName: '',
                amount: 0,
                processType: 'office_income',
                dueDate: '',
                status: 'confirmed',
                memo: '',
            },
        ]);
    };

    const removeLine = (lineId: string) => {
        setLines((prev) => prev.filter((line) => line.id !== lineId));
    };

    const applyLineType = (lineId: string, targetType: SettlementTargetType) => {
        updateLine(lineId, {
            targetId: '',
            targetName: targetType === 'office_income' ? '사무실 수입' : '',
            targetType,
            companyId: '',
            companyName: '',
            processType: targetType === 'office_income' ? 'office_income' : 'payable',
            memo: '',
        });
    };

    const applyTargetToLine = (lineId: string, targetType: SettlementTargetType, targetId: string) => {
        if (targetType === 'office_income') {
            updateLine(lineId, {
                targetId: '',
                targetName: '사무실 수입',
                targetType: 'office_income',
                companyId: '',
                companyName: '',
                processType: 'office_income',
            });
            return;
        }

        if (targetType === 'rental_company' || targetType === 'client_company') {
            const source = targetType === 'rental_company' ? rentalCompanyOptions : clientCompanyOptions;
            const selected = source.find((item) => (item.id || item.name) === targetId);
            if (!selected) {
                updateLine(lineId, { targetId: '', targetName: '', companyId: '', companyName: '' });
                return;
            }
            updateLine(lineId, {
                targetId: selected.id || '',
                targetName: selected.name,
                targetType,
                companyId: selected.id || '',
                companyName: selected.name,
                processType: 'payable',
            });
            return;
        }

        const source = targetType === 'client_contact' ? contactTargets : otherTargets;
        const selected = source.find((item) => item.id === targetId);
        if (!selected) {
            updateLine(lineId, { targetId: '', targetName: '', companyId: '', companyName: '' });
            return;
        }

        updateLine(lineId, {
            targetId: selected.id || '',
            targetName: selected.name,
            targetType,
            companyId: selected.companyId || '',
            companyName: selected.companyName || '',
            processType: 'payable',
            memo: selected.evidenceRequired ? '증빙 필요' : '',
        });
    };

    const handleSave = async () => {
        const normalizedLines = lines
            .map((line) => ({
                ...line,
                targetType: normalizeAllocationTargetType(line.targetType),
                targetName: String(line.targetName || '').trim(),
                companyName: String(line.companyName || '').trim(),
                amount: Number(line.amount || 0),
                processType: normalizeAllocationTargetType(line.targetType) === 'office_income' ? 'office_income' as const : 'payable' as const,
                status: (line.status === 'draft' || line.status === 'paid' ? 'confirmed' : line.status) as SupportClientAllocationLine['status'],
                memo: String(line.memo || '').trim(),
            }))
            .filter((line) => line.targetName && line.amount > 0);
        const total = normalizedLines.reduce((sum, line) => sum + Number(line.amount || 0), 0);

        if (total > target.distributableAmount) {
            setError(`배분합계가 차액보다 큽니다. 초과금액 ${formatNumber(total - target.distributableAmount)}원`);
            return;
        }

        setError(null);
        await onSave(normalizedLines);
    };

    const metricClassName = unallocatedAmount < 0 ? 'text-rose-700' : unallocatedAmount === 0 ? 'text-emerald-700' : 'text-amber-700';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
            <div className="max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-xl bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
                    <div>
                        <h2 className="text-lg font-black text-slate-900">차액 배분 관리</h2>
                        <p className="mt-1 text-xs font-bold text-slate-500">
                            {target.site.clientCompanyName} / {target.site.siteName}
                        </p>
                    </div>
                    <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <FontAwesomeIcon icon={faXmark} />
                    </button>
                </div>

                <div className="max-h-[72vh] overflow-y-auto p-6">
                    <div className="grid gap-3 md:grid-cols-6">
                        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                            <div className="text-xs font-black text-slate-400">부가세</div>
                            <div className="mt-1 text-lg font-black tabular-nums text-amber-700">{formatNumber(target.vatAmount)}원</div>
                        </div>
                        {[
                            ['발행금액', target.issuedAmount, 'text-sky-700'],
                            ['정산금액', target.settlementAmount, 'text-emerald-700'],
                            ['차액', target.distributableAmount, 'text-slate-900'],
                            ['배분합계', allocatedAmount, 'text-indigo-700'],
                            ['미배분', unallocatedAmount, metricClassName],
                        ].map(([label, amount, className]) => (
                            <div key={String(label)} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                                <div className="text-xs font-black text-slate-400">{label}</div>
                                <div className={`mt-1 text-lg font-black tabular-nums ${className}`}>{formatNumber(Number(amount))}원</div>
                            </div>
                        ))}
                    </div>

                    {error && (
                        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
                            {error}
                        </div>
                    )}

                    <div className="mt-4 flex items-center justify-between gap-3">
                        <div className="text-xs font-bold text-slate-400">
                            여러 대상자에게 동시에 배분할 수 있습니다.
                        </div>
                        <button
                            type="button"
                            onClick={addLine}
                            className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-black text-indigo-700 hover:bg-indigo-100"
                        >
                            <FontAwesomeIcon icon={faPlus} />
                            배분 라인 추가
                        </button>
                    </div>

                    <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
                        <table className="w-full min-w-[900px] text-sm">
                            <thead className="bg-slate-50 text-xs font-black text-slate-500">
                                <tr>
                                    <th className="px-3 py-2 text-left">구분</th>
                                    <th className="px-3 py-2 text-left">대상자명</th>
                                    <th className="px-3 py-2 text-right">금액</th>
                                    <th className="px-3 py-2 text-left">상태</th>
                                    <th className="px-3 py-2 text-left">예정일</th>
                                    <th className="px-3 py-2 text-left">메모</th>
                                    <th className="px-3 py-2 text-center">삭제</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {lines.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-4 py-10 text-center text-sm font-bold text-slate-400">
                                            등록된 배분 라인이 없습니다.
                                        </td>
                                    </tr>
                                ) : (
                                    lines.map((line) => {
                                        const lineType = normalizeAllocationTargetType(line.targetType);
                                        const companyOptions = lineType === 'rental_company'
                                            ? rentalCompanyOptions
                                            : lineType === 'client_company'
                                                ? clientCompanyOptions
                                                : [];
                                        const isCompanySelect = lineType === 'rental_company' || lineType === 'client_company';
                                        const isContactSelect = lineType === 'client_contact';

                                        return (
                                            <tr key={line.id} className="align-middle">
                                                <td className="px-3 py-2">
                                                    <select
                                                        value={lineType}
                                                        onChange={(event) => applyLineType(line.id, event.target.value as SettlementTargetType)}
                                                        className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs font-bold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                                    >
                                                        {SETTLEMENT_TARGET_TYPE_OPTIONS.map((option) => (
                                                            <option key={option.value} value={option.value}>{option.label}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="px-3 py-2">
                                                    {lineType === 'office_income' ? (
                                                        <div className="rounded border border-emerald-100 bg-emerald-50 px-2 py-1.5 text-sm font-black text-emerald-700">
                                                            사무실 수입
                                                        </div>
                                                    ) : isCompanySelect ? (
                                                        <select
                                                            value={line.targetId || ''}
                                                            onChange={(event) => applyTargetToLine(line.id, lineType, event.target.value)}
                                                            className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs font-bold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                                        >
                                                            <option value="">{lineType === 'rental_company' ? '임대사 선택' : '발주사 선택'}</option>
                                                            {companyOptions.map((company) => (
                                                                <option key={company.id || company.name} value={company.id || company.name}>
                                                                    {company.name}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    ) : isContactSelect ? (
                                                        <select
                                                            value={line.targetId || ''}
                                                            onChange={(event) => applyTargetToLine(line.id, lineType, event.target.value)}
                                                            className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs font-bold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                                        >
                                                            <option value="">관계자 선택</option>
                                                            {contactTargets.map((item) => (
                                                                <option key={item.id || item.name} value={item.id || ''}>
                                                                    {item.name}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    ) : (
                                                        <>
                                                            <input
                                                                value={line.targetName || ''}
                                                                onChange={(event) => updateLine(line.id, { targetName: event.target.value, targetId: '' })}
                                                                list={`allocation-other-targets-${line.id}`}
                                                                className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                                                placeholder="대상자명"
                                                            />
                                                            {otherTargets.length > 0 && (
                                                                <datalist id={`allocation-other-targets-${line.id}`}>
                                                                    {otherTargets.map((item) => (
                                                                        <option key={item.id || item.name} value={item.name} />
                                                                    ))}
                                                                </datalist>
                                                            )}
                                                        </>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2">
                                                    <input
                                                        value={line.amount ? String(line.amount) : ''}
                                                        onChange={(event) => updateLine(line.id, { amount: parseCurrencyAmount(normalizeAllocationLineAmountInput(event.target.value)) })}
                                                        className="w-full rounded border border-slate-200 px-2 py-1.5 text-right font-mono text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                                        inputMode="numeric"
                                                        placeholder="0"
                                                    />
                                                </td>
                                                <td className="px-3 py-2">
                                                    <select
                                                        value={(line.status === 'draft' || line.status === 'paid') ? 'confirmed' : line.status || 'confirmed'}
                                                        onChange={(event) => updateLine(line.id, { status: event.target.value as SupportClientAllocationLine['status'] })}
                                                        className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs font-bold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                                    >
                                                        {ALLOCATION_LINE_STATUS_OPTIONS.map((option) => (
                                                            <option key={option.value} value={option.value}>{option.label}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="px-3 py-2">
                                                    <input
                                                        type="date"
                                                        value={line.dueDate || ''}
                                                        onChange={(event) => updateLine(line.id, { dueDate: event.target.value })}
                                                        className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs font-bold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                                    />
                                                </td>
                                                <td className="px-3 py-2">
                                                    <input
                                                        value={line.memo || ''}
                                                        onChange={(event) => updateLine(line.id, { memo: event.target.value })}
                                                        className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                                        placeholder="메모"
                                                    />
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => removeLine(line.id)}
                                                        className="inline-flex h-8 w-8 items-center justify-center rounded border border-rose-200 text-rose-600 hover:bg-rose-50"
                                                        title="삭제"
                                                    >
                                                        <FontAwesomeIcon icon={faTrash} />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50"
                    >
                        취소
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60"
                    >
                        <FontAwesomeIcon icon={saving ? faSpinner : faCircleCheck} spin={saving} className="mr-2" />
                        저장
                    </button>
                </div>
            </div>
        </div>
    );
};
