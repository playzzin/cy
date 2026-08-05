import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import { manpowerService, Worker } from '../../services/manpowerService';
import { teamService, Team } from '../../services/teamService';
import { companyService, Company } from '../../services/companyService';
import { siteService, Site } from '../../services/siteService';
import { AdvancePayment } from '../../services/advancePaymentService';
import { statementOutputService } from '../../services/statementOutputService';
import type { StatementOutputRecord } from '../../types/statementOutput';
import { useAuth } from '../../contexts/AuthContext';
import {
    isFinalizedMonthlyPayrollRun,
    monthlyPayrollSettlementService,
    type MonthlyPayrollSavedManualInput,
    type MonthlyPayrollSettlement,
    type MonthlyPayrollSettlementSaveInput,
    type MonthlyPayrollRunStatus,
} from '../../services/monthlyPayrollSettlementService';
import {
    payrollConfigService,
    PayrollConfig,
    PayrollDeductionItem,
    PayrollInsuranceConfig,
    DEFAULT_ADVANCE_ITEM_LABELS,
} from '../../services/payrollConfigService';
import * as XLSX from 'xlsx-js-style';
import html2canvas from 'html2canvas';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileExcel, faFilePdf, faSpinner, faExclamationTriangle, faCopy, faChevronUp, faChevronDown, faDownload, faCheckCircle } from '@fortawesome/free-solid-svg-icons';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { PayslipTemplate } from './components/PayslipTemplate';
import MonthlyAdvanceLedger from './components/MonthlyAdvanceLedger';
import {
    SimplePayrollClosingTable,
    type SimplePayrollClosingRow,
} from './components/SimplePayrollClosingTable';
import type {
    MonthlyAdvanceLedgerComputedAmount,
    MonthlyAdvanceLedgerHandle,
} from './components/MonthlyAdvanceLedger';
import { PayrollToolbar } from './components/SimplePayrollToolbar';
import {
    appendPayslipWorkbooksToZip,
    buildPayslipWorkbook,
    getPayslipWorkbookFileName,
} from './utils/payslipWorkbook';
import {
    filterKBPaymentRows,
    formatKBTransferMemo,
    getKBAmountTypeLabel,
    getKBSalaryModelFilterLabel,
    getKBValidationErrorLabel,
    summarizeKBTransferRows,
    validateKBTransferRow,
    type KBAmountType,
    type KBSalaryModelFilter,
    type KBTransferValidationError,
} from './utils/kbTransferExport';
import {
    PAYSLIP_ISSUE_RULE_VERSION,
    buildMonthlyPayslipSnapshot,
    getPayslipIssueLabel,
    validateMonthlyPayslipRows,
    type PayslipIssueSummary,
} from './utils/payslipIssue';
import { filterRowsByWorkerName } from './utils/workerNameSearch';

import { usePayrollData } from './hooks/usePayrollData';
import { PaymentData, MonthlyAdvanceLedgerRow, MonthlyAdvanceLedgerWorkEntry, LedgerManualInput, DeductionBreakdown, WorkerWorkEntry, DeductionLine, TaxRateSnapshot, LedgerUtilityInputLike, InsuranceAppliedSummary, InsuranceAppliedSiteSummary, InsuranceAppliedReason, WithholdingAppliedSummary, WithholdingAppliedSiteSummary, BusinessIncomeAppliedSummary, BusinessIncomeAppliedSiteSummary } from './types/payroll';
import { BANK_CODES, STANDARD_DEDUCTION_FIELDS, WITHHOLDING_MAX_MAN_DAY } from './constants/payroll.constants';

// --- Premium UI Styled Components ---
const ToolbarContainer = styled.section`
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 8px;
    padding: 7px;
    border-radius: 14px;
    border: 1px solid #e2e8f0;
    background:
        radial-gradient(circle at top left, rgba(59, 130, 246, 0.12), transparent 26%),
        radial-gradient(circle at bottom right, rgba(14, 165, 233, 0.12), transparent 30%),
        linear-gradient(135deg, #f8fbff 0%, #f8fafc 52%, #ffffff 100%);
    box-shadow: 0 18px 32px -24px rgba(15, 23, 42, 0.22);
    overflow: hidden;

    &::before {
        content: '';
        position: absolute;
        inset: 0;
        pointer-events: none;
        background: linear-gradient(120deg, rgba(255, 255, 255, 0.8), transparent 42%);
    }
`;

const ToolbarLead = styled.div`
    position: relative;
    z-index: 1;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
`;

const ToolbarLeadMeta = styled.div`
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    flex-wrap: wrap;
`;

const ToolbarBadge = styled.span`
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-height: 28px;
    padding: 0 9px;
    border-radius: 999px;
    border: 1px solid #dbe4f0;
    background: rgba(255, 255, 255, 0.96);
    font-size: 14px;
    font-weight: 700;
    color: #334155;
    backdrop-filter: blur(8px);
`;

const ToolbarGrid = styled.div`
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-columns: repeat(12, minmax(0, 1fr));
    gap: 5px;

    @media (max-width: 1280px) {
        grid-template-columns: repeat(6, minmax(0, 1fr));
    }

    @media (max-width: 768px) {
        grid-template-columns: repeat(1, minmax(0, 1fr));
    }
`;

const ToolbarCard = styled.section<{ $span?: number }>`
    position: relative;
    grid-column: span ${props => props.$span ?? 4};
    display: flex;
    flex-direction: column;
    gap: 5px;
    min-height: 100%;
    padding: 7px;
    border-radius: 9px;
    border: 1px solid #e2e8f0;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 250, 252, 0.96) 100%);
    box-shadow: 0 14px 30px -24px rgba(15, 23, 42, 0.2);
    backdrop-filter: blur(14px);

    @media (max-width: 1280px) {
        grid-column: span 3;
    }

    @media (max-width: 768px) {
        grid-column: span 1;
    }
`;

const ToolbarCardHeader = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 6px;
`;

const ToolbarCardTitle = styled.h3`
    margin: 0;
    font-size: 15px;
    font-weight: 800;
    color: #0f172a;
`;

const ToolbarCardDescription = styled.p`
    margin: 2px 0 0;
    font-size: 12px;
    line-height: 1.5;
    color: #94a3b8;
    display: none;
`;

const ToolbarCardBody = styled.div`
    display: flex;
    flex-direction: column;
    gap: 4px;
`;

const ToolbarInline = styled.div`
    display: flex;
    align-items: center;
    gap: 5px;
    flex-wrap: wrap;
`;

const ToolbarSectionDivider = styled.div`
    width: 1px;
    align-self: stretch;
    background: linear-gradient(180deg, rgba(148, 163, 184, 0), rgba(148, 163, 184, 0.2), rgba(148, 163, 184, 0));
`;

const YearNavigator = styled.div`
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 2px;
    border-radius: 10px;
    background: #f8fafc;
    border: 1px solid #dbe4f0;
`;

const YearButton = styled.button`
    width: 22px;
    height: 22px;
    border: none;
    border-radius: 7px;
    background: transparent;
    color: #475569;
    cursor: pointer;
    transition: background 0.2s ease, color 0.2s ease, transform 0.2s ease;

    &:hover {
        background: #ffffff;
        color: #0f172a;
        transform: translateY(-1px);
    }
`;

const YearText = styled.span`
    min-width: 56px;
    padding: 0 4px;
    text-align: center;
    font-size: 14px;
    font-weight: 800;
    color: #0f172a;
`;

const MonthGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(12, minmax(36px, 1fr));
    gap: 3px;
    width: 100%;
`;

const MonthButton = styled.button<{ $active: boolean; $inRange: boolean }>`
    height: 26px;
    border: 1px solid ${props => (props.$active ? 'transparent' : props.$inRange ? '#bfdbfe' : '#e2e8f0')};
    border-radius: 6px;
    font-size: 12px;
    font-weight: 700;
    color: ${props => (props.$active ? '#ffffff' : props.$inRange ? '#1e3a8a' : '#64748b')};
    background: ${props => (props.$active
        ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)'
        : props.$inRange
            ? '#eff6ff'
            : '#ffffff')};
    box-shadow: ${props => (props.$active ? '0 12px 24px -16px rgba(37, 99, 235, 0.7)' : 'none')};
    cursor: pointer;
    transition: transform 0.2s ease, background 0.2s ease, border-color 0.2s ease, color 0.2s ease;

    &:hover {
        transform: translateY(-1px);
        border-color: #93c5fd;
    }
`;

const QuickRangeGroup = styled.div`
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px;
    border-radius: 9px;
    background: #fff7ed;
    border: 1px solid rgba(251, 191, 36, 0.36);
`;

const QuickRangeButton = styled.button`
    min-height: 28px;
    padding: 0 8px;
    border: none;
    border-radius: 7px;
    background: transparent;
    font-size: 13px;
    font-weight: 800;
    color: #9a3412;
    cursor: pointer;
    transition: background 0.2s ease, color 0.2s ease;

    &:hover {
        background: rgba(255, 255, 255, 0.88);
        color: #7c2d12;
    }
`;

const SegmentedGroup = styled.div`
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 3px;
    border-radius: 10px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    flex-wrap: wrap;
`;

const SegmentedButton = styled.button<{ $active: boolean }>`
    min-height: 32px;
    padding: 0 10px;
    border: 1px solid transparent;
    border-radius: 7px;
    background: ${props => (props.$active ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' : 'transparent')};
    color: ${props => (props.$active ? '#ffffff' : '#64748b')};
    font-size: 15px;
    font-weight: 800;
    cursor: pointer;
    transition: background 0.2s ease, color 0.2s ease, transform 0.2s ease;

    &:hover {
        transform: translateY(-1px);
        color: ${props => (props.$active ? '#ffffff' : '#0f172a')};
    }
`;

const SelectField = styled.select`
    min-width: 120px;
    min-height: 30px;
    padding: 0 8px;
    border-radius: 8px;
    border: 1px solid #dbe3ee;
    background: rgba(255, 255, 255, 0.95);
    color: #0f172a;
    font-size: 14px;
    font-weight: 700;
    outline: none;
    cursor: pointer;
`;

const SearchField = styled.input`
    min-width: 100px;
    min-height: 30px;
    padding: 0 8px;
    border-radius: 8px;
    border: 1px solid #dbe3ee;
    background: rgba(255, 255, 255, 0.95);
    color: #0f172a;
    font-size: 14px;
    font-weight: 600;
    outline: none;

    &::placeholder {
        color: #94a3b8;
    }
`;

const FieldCard = styled.div`
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 7px;
    border-radius: 9px;
    border: 1px solid rgba(226, 232, 240, 0.95);
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 250, 252, 0.94) 100%);
`;

const FieldLabel = styled.span`
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.10em;
    text-transform: uppercase;
    color: #94a3b8;
`;

const ToggleChipGroup = styled.div`
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
`;

const ToggleChipButton = styled.button<{ $active: boolean }>`
    min-height: 32px;
    padding: 0 8px;
    border-radius: 999px;
    border: 1px solid ${props => (props.$active ? 'rgba(37, 99, 235, 0.3)' : 'rgba(203, 213, 225, 0.95)')};
    background: ${props => (props.$active ? 'rgba(59, 130, 246, 0.12)' : 'rgba(255, 255, 255, 0.92)')};
    color: ${props => (props.$active ? '#1d4ed8' : '#475569')};
    font-size: 15px;
    font-weight: 800;
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
        transform: translateY(-1px);
    }
`;
void [
    ToolbarContainer,
    ToolbarLead,
    ToolbarLeadMeta,
    ToolbarBadge,
    ToolbarGrid,
    ToolbarCard,
    ToolbarCardHeader,
    ToolbarCardTitle,
    ToolbarCardDescription,
    ToolbarCardBody,
    ToolbarInline,
    ToolbarSectionDivider,
    YearNavigator,
    YearButton,
    YearText,
    MonthGrid,
    MonthButton,
    QuickRangeGroup,
    QuickRangeButton,
    SegmentedGroup,
    SegmentedButton,
    SelectField,
    SearchField,
    FieldCard,
    FieldLabel,
    ToggleChipGroup,
    ToggleChipButton,
];

const ActionCluster = styled.div`
    display: flex;
    align-items: center;
    gap: 5px;
    flex-wrap: wrap;
`;

const ActionButton = styled.button<{ $variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'warning' | 'accent' | 'outline' }>`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    min-height: 36px;
    padding: 0 10px;
    border-radius: 8px;
    border: 1px solid transparent;
    font-size: 15px;
    font-weight: 800;
    cursor: pointer;
    transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease, border-color 0.2s ease;

    ${props => props.$variant === 'primary' && `
        background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
        color: white;
        box-shadow: 0 16px 30px -22px rgba(37, 99, 235, 0.6);
    `}
    ${props => props.$variant === 'secondary' && `
        background: linear-gradient(135deg, #334155 0%, #475569 100%);
        color: white;
        box-shadow: 0 16px 28px -22px rgba(15, 23, 42, 0.7);
    `}
    ${props => props.$variant === 'danger' && `
        background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%);
        color: white;
    `}
    ${props => props.$variant === 'success' && `
        background: linear-gradient(135deg, #059669 0%, #047857 100%);
        color: white;
        box-shadow: 0 16px 30px -22px rgba(5, 150, 105, 0.7);
    `}
    ${props => props.$variant === 'warning' && `
        background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
        color: white;
        box-shadow: 0 16px 30px -22px rgba(245, 158, 11, 0.72);
    `}
    ${props => props.$variant === 'accent' && `
        background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
        color: white;
        box-shadow: 0 16px 30px -22px rgba(249, 115, 22, 0.72);
    `}
    ${props => props.$variant === 'outline' && `
        background: rgba(255, 255, 255, 0.96);
        border-color: rgba(203, 213, 225, 0.95);
        color: #334155;
    `}

    &:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 16px 36px -24px rgba(15, 23, 42, 0.35);
    }

    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        box-shadow: none;
    }
`;

const KBPreviewOverlay = styled.div`
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    background: rgba(2, 6, 23, 0.68);
    backdrop-filter: blur(8px);
`;

const KBPreviewDialog = styled.div`
    width: 100%;
    max-width: 1180px;
    max-height: 88vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-radius: 28px;
    border: 1px solid rgba(71, 85, 105, 0.68);
    background: linear-gradient(180deg, #020617 0%, #111827 100%);
    box-shadow: 0 36px 80px -34px rgba(2, 6, 23, 0.92);
`;

const KBPreviewHeader = styled.div`
    display: flex;
    flex-direction: column;
    gap: 18px;
    padding: 22px;
    border-bottom: 1px solid rgba(71, 85, 105, 0.42);
    background:
        radial-gradient(circle at top right, rgba(245, 158, 11, 0.16), transparent 24%),
        linear-gradient(135deg, rgba(15, 23, 42, 0.98) 0%, rgba(17, 24, 39, 0.94) 100%);
`;

const KBPreviewTitleRow = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
`;

const KBPreviewTitleBlock = styled.div`
    display: flex;
    flex-direction: column;
    gap: 6px;
`;

const KBPreviewEyebrow = styled.span`
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: #f59e0b;
`;

const KBPreviewTitle = styled.h3`
    margin: 0;
    font-size: 22px;
    font-weight: 800;
    color: #f8fafc;
`;

const KBPreviewDescription = styled.p`
    margin: 0;
    font-size: 13px;
    color: #94a3b8;
`;

const KBPreviewCloseButton = styled.button`
    width: 42px;
    height: 42px;
    border: 1px solid rgba(71, 85, 105, 0.82);
    border-radius: 14px;
    background: rgba(15, 23, 42, 0.92);
    color: #cbd5e1;
    font-size: 24px;
    cursor: pointer;
    transition: background 0.2s ease, color 0.2s ease, transform 0.2s ease;

    &:hover {
        background: rgba(30, 41, 59, 0.96);
        color: #ffffff;
        transform: translateY(-1px);
    }
`;

const KBPreviewControlsGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 14px;

    @media (max-width: 960px) {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    @media (max-width: 640px) {
        grid-template-columns: repeat(1, minmax(0, 1fr));
    }
`;

const KBPreviewFieldCard = styled.div`
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px;
    border-radius: 20px;
    border: 1px solid rgba(51, 65, 85, 0.86);
    background: linear-gradient(180deg, rgba(15, 23, 42, 0.96) 0%, rgba(30, 41, 59, 0.92) 100%);
`;

const KBPreviewFieldLabel = styled.label`
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #64748b;
`;

const KBPreviewFieldHint = styled.span`
    font-size: 12px;
    line-height: 1.45;
    color: #94a3b8;
`;

const KBPreviewInput = styled.input`
    width: 100%;
    min-height: 46px;
    padding: 0 14px;
    border-radius: 14px;
    border: 1px solid rgba(71, 85, 105, 0.88);
    background: rgba(2, 6, 23, 0.72);
    color: #f8fafc;
    font-size: 14px;
    font-weight: 700;
    outline: none;

    &::placeholder {
        color: #64748b;
    }
`;

const KBPreviewSelect = styled.select`
    width: 100%;
    min-height: 46px;
    padding: 0 14px;
    border-radius: 14px;
    border: 1px solid rgba(71, 85, 105, 0.88);
    background: rgba(2, 6, 23, 0.72);
    color: #f8fafc;
    font-size: 14px;
    font-weight: 700;
    outline: none;
`;

const KBPreviewTableArea = styled.div`
    flex: 1;
    overflow: auto;
    padding: 20px 22px;
    background: rgba(15, 23, 42, 0.78);
`;

const KBPreviewTable = styled.table`
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
    color: #e2e8f0;
`;

const KBPreviewFooter = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
    padding: 18px 22px 22px;
    border-top: 1px solid rgba(71, 85, 105, 0.42);
    background: linear-gradient(180deg, rgba(15, 23, 42, 0.96) 0%, rgba(2, 6, 23, 0.96) 100%);
`;

const KBPreviewSummary = styled.span`
    font-size: 14px;
    color: #cbd5e1;
`;

const buildStandardDeductionLabelMap = (): Record<string, string> =>
    STANDARD_DEDUCTION_FIELDS.reduce<Record<string, string>>((acc, { key, label }) => {
        acc[key] = label;
        return acc;
    }, {});

const buildDeductionLabelMapFromConfig = (items?: PayrollDeductionItem[]): Record<string, string> => {
    const base = buildStandardDeductionLabelMap();
    (items ?? []).forEach((item) => {
        const safeId = item.id?.trim();
        if (!safeId) return;
        const safeLabel = item.label?.trim();
        base[safeId] = safeLabel && safeLabel.length > 0 ? safeLabel : safeId;
    });
    return base;
};

const normalizeLineLabel = (value: string): string => String(value ?? '').replace(/\s+/g, '').trim();

const buildAdvanceLabelSet = (config?: PayrollConfig | null): Set<string> => {
    const labels = {
        ...DEFAULT_ADVANCE_ITEM_LABELS,
        ...(config?.advanceItemLabels ?? {}),
    };

    const set = new Set<string>([
        normalizeLineLabel(labels.corporateAdvance1),
        normalizeLineLabel(labels.corporateAdvance2),
        normalizeLineLabel(labels.corporateAdvance3),
        normalizeLineLabel(labels.corporateAdvance4),
        normalizeLineLabel(labels.laborAdvance1),
        normalizeLineLabel(labels.laborAdvance2),
        normalizeLineLabel(labels.laborAdvance3),
        normalizeLineLabel(labels.laborAdvance4),
        'corporateAdvance1',
        'corporateAdvance2',
        'corporateAdvance3',
        'corporateAdvance4',
        'laborAdvance1',
        'laborAdvance2',
        'laborAdvance3',
        'laborAdvance4',
        'carrySecond',
        'currentAdvance',
        'currentAdvanceSecond',
    ]);

    set.delete('');
    return set;
};

const createEmptyDeductionBreakdown = (): DeductionBreakdown => ({
    standardLines: [],
    additionalLines: [],
    totalStandard: 0,
    totalAdditional: 0,
    total: 0,
    hasData: false,
});

const rebuildDeductionBreakdown = (params: { standardLines: DeductionLine[]; additionalLines: DeductionLine[] }): DeductionBreakdown => {
    const totalStandard = (params.standardLines ?? []).reduce((sum, line) => sum + toNumber(line?.amount), 0);
    const totalAdditional = (params.additionalLines ?? []).reduce((sum, line) => sum + toNumber(line?.amount), 0);
    const total = totalStandard + totalAdditional;
    return {
        standardLines: params.standardLines ?? [],
        additionalLines: params.additionalLines ?? [],
        totalStandard,
        totalAdditional,
        total,
        hasData: total > 0,
    };
};

const TEMP_INSURANCE_PREFIX = '[4대보험]';
const TEMP_BUSINESS_PREFIX = '[3.3%]';
const TEMP_TAX_PREFIX = '[원천세]';
const LEGACY_TAX_PREFIX = '[세금]';
const TEMP_DAILY_FEE_PREFIX = '[수수료]';
const DAILY_FEE_LABEL = `${TEMP_DAILY_FEE_PREFIX} 일급제 공수당`;

const stripTemporaryDeductionLines = (breakdown: DeductionBreakdown): DeductionBreakdown => {
    const safe = breakdown ?? createEmptyDeductionBreakdown();
    const shouldKeepLine = (line: DeductionLine): boolean => {
        const label = (line?.label ?? '').trim();
        if (!label) return false;
        return !(
            label.startsWith(TEMP_INSURANCE_PREFIX)
            || label.startsWith(TEMP_BUSINESS_PREFIX)
            || label.startsWith(TEMP_TAX_PREFIX)
            || label.startsWith(LEGACY_TAX_PREFIX)
            || label.startsWith(TEMP_DAILY_FEE_PREFIX)
            || label.startsWith('[3.0%]')
            || label.startsWith('[0.3%]')
        );
    };
    const standardLines = (safe.standardLines ?? []).filter(shouldKeepLine);
    const additionalLines = (safe.additionalLines ?? []).filter(shouldKeepLine);
    return rebuildDeductionBreakdown({ standardLines, additionalLines });
};

const stripTemporaryTaxLines = (breakdown: DeductionBreakdown | undefined): DeductionBreakdown => {
    const safe = breakdown ?? createEmptyDeductionBreakdown();
    const additionalLines = (safe.additionalLines ?? []).filter((line: DeductionLine) => {
        const label = (line?.label ?? '').trim();
        if (!label) return false;
        return !(label.startsWith(TEMP_TAX_PREFIX) || label.startsWith(LEGACY_TAX_PREFIX) || label.startsWith(TEMP_BUSINESS_PREFIX) || label.startsWith(TEMP_INSURANCE_PREFIX) || label.startsWith('[3.0%]') || label.startsWith('[0.3%]'));
    });
    return rebuildDeductionBreakdown({ standardLines: [], additionalLines });
};

const floorWon = (value: number): number => Math.floor(toNumber(value));

const toNumber = (value: unknown): number => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const normalized = value.replace(/,/g, '').trim();
        if (!normalized) return 0;
        const parsed = Number(normalized);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
};

const APPLIED_UTILITY_FIELDS: Array<{ key: keyof LedgerUtilityInputLike['invoice']; label: string }> = [
    { key: 'lodging', label: '숙소비' },
    { key: 'electricity', label: '전기세' },
    { key: 'gas', label: '도시가스' },
    { key: 'water', label: '수도세' },
    { key: 'internet', label: '인터넷' },
    { key: 'management', label: '관리비' },
    { key: 'fine', label: '과태료' },
    { key: 'other', label: '기타' },
];

// These are standard fields in 가불 및 공제 관리, but the integrated-payroll
// ledger has no individual columns for them.  They are loaded into the ledger's
// "기타" bucket, so remove the original source lines when applying ledger
// deductions to prevent the same amount from being counted twice.
const LEDGER_OTHER_SOURCE_LABELS = new Set(['개인방', '장갑', '보증금']);

const LEDGER_DEFAULT_ASSIGNMENT: 'corporate' | 'labor' = 'corporate';

const APPLIED_UTILITY_LABEL_SET = new Set(APPLIED_UTILITY_FIELDS.map((field) => field.label));

const isAppliedUtilityOrFeeLabel = (labelRaw: string): boolean => {
    const label = String(labelRaw ?? '').trim();
    if (!label) return false;
    return APPLIED_UTILITY_LABEL_SET.has(label)
        || LEDGER_OTHER_SOURCE_LABELS.has(label)
        || label.startsWith(TEMP_DAILY_FEE_PREFIX);
};

const isDailyWagePaymentItem = (item: Pick<PaymentData, 'id'>): boolean => String(item.id ?? '').endsWith('__일급제');

const buildDailyFeeDeductionLines = (params: {
    item: Pick<PaymentData, 'id' | 'totalManDay'>;
    applyDailyFee: boolean;
    dailyFeePerManDay: number;
}): DeductionLine[] => {
    if (!params.applyDailyFee) return [];
    if (!isDailyWagePaymentItem(params.item)) return [];

    const feePerManDay = Math.max(0, Math.floor(toNumber(params.dailyFeePerManDay)));
    if (feePerManDay <= 0) return [];

    const totalManDay = Math.max(0, toNumber(params.item.totalManDay));
    if (totalManDay <= 0) return [];

    return [{
        label: DAILY_FEE_LABEL,
        amount: floorWon(totalManDay * feePerManDay),
    }];
};

const buildUtilityDeductionLines = (manual?: LedgerUtilityInputLike): DeductionLine[] => {
    if (!manual) return [];

    return APPLIED_UTILITY_FIELDS.reduce<DeductionLine[]>((acc, field) => {
        const assignmentType = manual.assignmentType || LEDGER_DEFAULT_ASSIGNMENT;
        const itemAssignments = manual.itemAssignments || {};

        // 개별 항목 분류가 있으면 우선 적용하고, 없으면 행 기본 분류를 따른다.
        const resolvedAssignment = itemAssignments[field.key] ?? assignmentType;
        const shouldInclude = resolvedAssignment === 'labor';

        if (!shouldInclude) return acc;

        const amount = toNumber(manual?.invoice?.[field.key]) + toNumber(manual?.labor?.[field.key]);
        if (amount <= 0) return acc;
        
        acc.push({ label: field.label, amount });
        return acc;
    }, []);
};

const buildVisibleUtilityDeductionLines = (manual?: LedgerUtilityInputLike): DeductionLine[] => {
    if (!manual) return [];

    return APPLIED_UTILITY_FIELDS.reduce<DeductionLine[]>((acc, field) => {
        const amount = toNumber(manual?.invoice?.[field.key]) + toNumber(manual?.labor?.[field.key]);
        if (amount <= 0) return acc;

        acc.push({ label: field.label, amount });
        return acc;
    }, []);
};

const mergeDeductionBreakdownWithLines = (
    breakdown: DeductionBreakdown | undefined,
    lines: DeductionLine[]
): DeductionBreakdown => {
    const safe = breakdown ?? createEmptyDeductionBreakdown();
    const standardLines = [...(safe.standardLines ?? [])].map((line) => ({
        label: String(line.label ?? '').trim(),
        amount: toNumber(line.amount),
    }));
    const additionalLines = [...(safe.additionalLines ?? [])].map((line) => ({
        label: String(line.label ?? '').trim(),
        amount: toNumber(line.amount),
    }));

    lines.forEach((line) => {
        const label = String(line.label ?? '').trim();
        const amount = toNumber(line.amount);
        if (!label || amount <= 0) return;

        const standardIndex = standardLines.findIndex((existing) => existing.label === label);
        if (standardIndex >= 0) {
            standardLines[standardIndex] = {
                ...standardLines[standardIndex],
                amount: standardLines[standardIndex].amount + amount,
            };
            return;
        }

        const additionalIndex = additionalLines.findIndex((existing) => existing.label === label);
        if (additionalIndex >= 0) {
            additionalLines[additionalIndex] = {
                ...additionalLines[additionalIndex],
                amount: additionalLines[additionalIndex].amount + amount,
            };
            return;
        }

        standardLines.push({ label, amount });
    });

    return rebuildDeductionBreakdown({ standardLines, additionalLines });
};

const buildAdvanceDeductionLines = (
    manual: LedgerUtilityInputLike | undefined,
    config?: PayrollConfig | null
): DeductionLine[] => {
    if (!manual) return [];

    const labels = {
        ...DEFAULT_ADVANCE_ITEM_LABELS,
        ...(config?.advanceItemLabels ?? {}),
    };

    const mapped: Array<{ label: string; amount: number }> = [
        { label: labels.corporateAdvance1, amount: toNumber(manual.invoice?.carry) },
        { label: labels.corporateAdvance2, amount: toNumber(manual.invoice?.carrySecond) },
        { label: labels.corporateAdvance3, amount: toNumber(manual.invoice?.currentAdvance) },
        { label: labels.corporateAdvance4, amount: toNumber(manual.invoice?.currentAdvanceSecond) },
        { label: labels.laborAdvance1, amount: toNumber(manual.labor?.carry) },
        { label: labels.laborAdvance2, amount: toNumber(manual.labor?.carrySecond) },
        { label: labels.laborAdvance3, amount: toNumber(manual.labor?.currentAdvance) },
        { label: labels.laborAdvance4, amount: toNumber(manual.labor?.currentAdvanceSecond) },
    ];

    return mapped
        .filter((item) => String(item.label ?? '').trim().length > 0 && item.amount > 0)
        .map((item) => ({ label: String(item.label).trim(), amount: item.amount }));
};

const ensureAdvanceLinesInBreakdown = (
    breakdown: DeductionBreakdown,
    manual: LedgerUtilityInputLike | undefined,
    config?: PayrollConfig | null
): DeductionBreakdown => {
    const source = breakdown ?? createEmptyDeductionBreakdown();
    const sourceLines = [
        ...(source.standardLines ?? []),
        ...(source.additionalLines ?? []),
    ];
    const advanceLabelSet = buildAdvanceLabelSet(config);
    const hasAdvanceLines = sourceLines.some((line) => advanceLabelSet.has(normalizeLineLabel(String(line?.label ?? ''))));
    if (hasAdvanceLines) return source;

    const manualAdvanceLines = buildAdvanceDeductionLines(manual, config);
    if (manualAdvanceLines.length === 0) return source;

    return mergeDeductionBreakdownWithLines(source, manualAdvanceLines);
};

const TAX_LINE_BUSINESS_INCOME_PREFIX = '[3.0%]';
const TAX_LINE_BUSINESS_RESIDENT_PREFIX = '[0.3%]';
const BUSINESS_INCOME_TAX_RATE = 0.03;
const BUSINESS_RESIDENT_TAX_RATE = 0.003;

const formatRatePercent = (rate: number, maxFractionDigits: number = 3): string => {
    if (!Number.isFinite(rate)) return '-';
    const percent = rate * 100;
    const text = percent.toLocaleString('ko-KR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: maxFractionDigits,
    });
    return `${text}%`;
};

const resolveTaxLineRateText = (lineLabel: string, snapshot?: TaxRateSnapshot): string => {
    const label = String(lineLabel ?? '').trim();
    if (!label) return '-';

    const prefixed = label.match(/^\[(\d+(?:\.\d+)?)%\]/);
    if (prefixed) return `${prefixed[1]}%`;

    if (!snapshot) return '-';

    if (label.startsWith(TEMP_INSURANCE_PREFIX)) {
        if (label.includes('국민연금')) return formatRatePercent(snapshot.pensionRate, 2);
        if (label.includes('건강보험')) return formatRatePercent(snapshot.healthRate, 3);
        if (label.includes('장기요양')) return formatRatePercent(snapshot.careRateOfHealth ?? 0, 2);
        if (label.includes('고용보험')) return formatRatePercent(snapshot.employmentRate, 3);
    }

    if (label.startsWith(TEMP_TAX_PREFIX) || label.startsWith(LEGACY_TAX_PREFIX)) {
        const incomeRate = formatRatePercent(snapshot.incomeTaxRate, 2);
        const residentRate = formatRatePercent(snapshot.residentTaxRate, 2);
        if (label.includes('근로소득세') || label.includes('갑근세')) {
            return incomeRate;
        }
        if (label.includes('지방소득세') || label.includes('지방세')) {
            return residentRate;
        }
    }

    if (label.includes('사업소득세')) return formatRatePercent(snapshot.businessIncomeTaxRate ?? BUSINESS_INCOME_TAX_RATE, 1);
    if (label.includes('소득세')) return formatRatePercent(snapshot.businessResidentTaxRate ?? BUSINESS_RESIDENT_TAX_RATE, 1);

    return '-';
};

const resolveWithholdingDetailText = (snapshot?: TaxRateSnapshot): string => {
    const deduction = Math.max(0, Math.floor(toNumber(snapshot?.withholdingBaseDeduction ?? 150000))).toLocaleString('ko-KR');
    const incomeRate = formatRatePercent(toNumber(snapshot?.incomeTaxRate ?? 0.06), 2);
    const taxCredit = formatRatePercent(toNumber(snapshot?.withholdingIncomeBaseMultiplier ?? 0.55), 2);
    const residentRate = formatRatePercent(toNumber(snapshot?.residentTaxRate ?? 0.1), 2);
    return `상세: (단가-${deduction})×${incomeRate}×(1-${taxCredit}), 지방세=갑근세×${residentRate}`;
};

const getTaxLinesForItem = (item: PaymentData): DeductionLine[] => [
    ...(item.taxBreakdown?.standardLines ?? []),
    ...(item.taxBreakdown?.additionalLines ?? []),
];

const isInsuranceSectionTaxLabel = (labelRaw: string): boolean => {
    const label = String(labelRaw ?? '').trim();
    if (!label) return false;
    return label.startsWith(TEMP_INSURANCE_PREFIX);
};

const isWithholdingSectionTaxLabel = (labelRaw: string): boolean => {
    const label = String(labelRaw ?? '').trim();
    if (!label) return false;
    return label.startsWith(TEMP_TAX_PREFIX) || label.startsWith(LEGACY_TAX_PREFIX);
};

const isBusinessSectionTaxLabel = (labelRaw: string): boolean => {
    const label = String(labelRaw ?? '').trim();
    if (!label) return false;
    return label.startsWith(TAX_LINE_BUSINESS_INCOME_PREFIX) || label.startsWith(TAX_LINE_BUSINESS_RESIDENT_PREFIX);
};

const sumInsuranceSectionTax = (item: PaymentData): number => {
    const lines = getTaxLinesForItem(item);
    return lines.reduce((sum, line) => {
        return sum + (isInsuranceSectionTaxLabel(line.label) ? toNumber(line.amount) : 0);
    }, 0);
};

const sumWithholdingSectionTax = (item: PaymentData): number => {
    const lines = getTaxLinesForItem(item);
    return lines.reduce((sum, line) => {
        return sum + (isWithholdingSectionTaxLabel(line.label) ? toNumber(line.amount) : 0);
    }, 0);
};

const sumBusinessSectionTax = (item: PaymentData): number => {
    const lines = getTaxLinesForItem(item);
    return lines.reduce((sum, line) => {
        return sum + (isBusinessSectionTaxLabel(line.label) ? toNumber(line.amount) : 0);
    }, 0);
};

const extractLedgerTaxAmountsFromItem = (
    item: PaymentData
): NonNullable<MonthlyAdvanceLedgerRow['statementTaxAmounts']> => {
    const lines = getTaxLinesForItem(item);
    const deductionLines: DeductionLine[] = [
        ...(item.deductionBreakdown?.standardLines ?? []),
        ...(item.deductionBreakdown?.additionalLines ?? []),
    ];

    let pension = 0;
    let health = 0;
    let care = 0;
    let employment = 0;
    let incomeTax = 0;
    let residentTax = 0;
    let businessIncomeTax = 0;
    let businessResidentTax = 0;
    let dailyFee = 0;

    lines.forEach((line) => {
        const label = String(line.label ?? '').trim();
        const amount = toNumber(line.amount);
        if (amount <= 0) return;

        if (isInsuranceSectionTaxLabel(label)) {
            if (label.includes('국민연금')) pension += amount;
            else if (label.includes('건강보험')) health += amount;
            else if (label.includes('장기요양')) care += amount;
            else if (label.includes('고용보험')) employment += amount;
            return;
        }

        if (isWithholdingSectionTaxLabel(label)) {
            if (label.includes('지방세') || label.includes('지방소득세')) residentTax += amount;
            else incomeTax += amount;
            return;
        }

        if (isBusinessSectionTaxLabel(label)) {
            if (label.includes('사업소득세')) businessIncomeTax += amount;
            else businessResidentTax += amount;
        }
    });

    deductionLines.forEach((line) => {
        const label = String(line.label ?? '').trim();
        if (!label.startsWith(TEMP_DAILY_FEE_PREFIX)) return;
        dailyFee += toNumber(line.amount);
    });

    return {
        pension,
        health,
        care,
        employment,
        incomeTax,
        residentTax,
        businessIncomeTax,
        businessResidentTax,
        dailyFee,
        isWithholdingTarget:
            (item.withholdingAppliedSummary?.appliedAmount ?? 0) > 0 || incomeTax + residentTax > 0,
    };
};

interface WorkEntryTaxCalculationResult {
    statementTaxAmounts: NonNullable<MonthlyAdvanceLedgerRow['statementTaxAmounts']>;
    taxAdditionalLines: DeductionLine[];
    taxRateSnapshot: TaxRateSnapshot;
    insuranceAppliedSummary?: InsuranceAppliedSummary;
    withholdingAppliedSummary?: WithholdingAppliedSummary;
    businessIncomeAppliedSummary?: BusinessIncomeAppliedSummary;
}

const buildWorkEntriesForLedgerRow = (row: MonthlyAdvanceLedgerRow): WorkerWorkEntry[] => {
    const normalizedEntries = (row.workEntries ?? [])
        .map((entry: MonthlyAdvanceLedgerWorkEntry) => ({
            date: (entry.date ?? row.month).trim() || row.month,
            siteName: (entry.siteName ?? '').trim() || '-',
            siteId: entry.siteId,
            clientCompanyId: entry.clientCompanyId,
            isLaborSite: Boolean(entry.isLaborSite),
            manDay: toNumber(entry.manDay),
            unitPrice: toNumber(entry.unitPrice),
            paymentMethod: entry.paymentMethod,
            amount:
                toNumber(entry.amount) > 0
                    ? toNumber(entry.amount)
                    : floorWon(toNumber(entry.manDay) * toNumber(entry.unitPrice)),
        }))
        .filter((entry: WorkerWorkEntry) => toNumber(entry.manDay) > 0 || toNumber(entry.amount) > 0);

    if (normalizedEntries.length > 0) return normalizedEntries;

    const fallbackEntries: WorkerWorkEntry[] = [];
    if (toNumber(row.invoiceManDay) > 0 || toNumber(row.invoiceGrossAmount) > 0) {
        fallbackEntries.push({
            date: row.month,
            siteName: '계산서',
            siteId: '__invoice',
            clientCompanyId: '',
            isLaborSite: false,
            manDay: toNumber(row.invoiceManDay),
            unitPrice: toNumber(row.unitPrice),
            paymentMethod: '계산서',
            amount: floorWon(toNumber(row.invoiceGrossAmount)),
        });
    }
    if (toNumber(row.laborManDay) > 0 || toNumber(row.laborGrossAmount) > 0) {
        fallbackEntries.push({
            date: row.month,
            siteName: '노무',
            siteId: '__labor',
            clientCompanyId: '',
            isLaborSite: true,
            manDay: toNumber(row.laborManDay),
            unitPrice: toNumber(row.unitPrice),
            paymentMethod: '노무',
            amount: floorWon(toNumber(row.laborGrossAmount)),
        });
    }

    return fallbackEntries;
};

const calculateWorkEntryTaxBreakdown = (params: {
    workEntries?: WorkerWorkEntry[];
    payrollConfig: Pick<PayrollConfig, 'insuranceConfig' | 'incomeTaxRate' | 'residentTaxRate'>;
    applyInsurance: boolean;
    applyBusinessIncome: boolean;
    normalizeSiteName: (value: string | undefined) => string;
    withholdingThreshold: number;
    isInsuranceEligibleEntry?: (entry: WorkerWorkEntry) => boolean;
}): WorkEntryTaxCalculationResult => {
    const insuranceConfig = params.payrollConfig.insuranceConfig;
    const threshold = Math.max(0, Math.floor(toNumber(insuranceConfig?.thresholdDays)));
    const withholdingBaseDeduction = Math.max(0, Math.floor(toNumber(insuranceConfig?.withholdingBaseDeduction ?? 150000)));
    const withholdingTaxCreditRate = Math.min(1, Math.max(0, toNumber(insuranceConfig?.withholdingIncomeBaseMultiplier ?? 0.55)));
    const withholdingIncomeTaxRate = Math.max(
        0,
        toNumber(insuranceConfig?.withholdingIncomeTaxRate ?? params.payrollConfig.incomeTaxRate ?? 0.06)
    );
    const withholdingResidentTaxRate = Math.max(
        0,
        toNumber(insuranceConfig?.withholdingResidentTaxRate ?? params.payrollConfig.residentTaxRate ?? 0.1)
    );
    const withholdingApplyAllLabor =
        typeof insuranceConfig?.withholdingApplyAllLabor === 'boolean' ? insuranceConfig.withholdingApplyAllLabor : true;
    const employmentApplyBelowThreshold =
        typeof insuranceConfig?.employmentApplyBelowThreshold === 'boolean' ? insuranceConfig.employmentApplyBelowThreshold : true;

    const allEntries = (params.workEntries ?? []).filter((entry) => {
        if (!entry) return false;
        const hasManDay = toNumber(entry.manDay) > 0;
        const hasAmount = toNumber(entry.amount) > 0;
        return hasManDay || hasAmount;
    });

    const getSiteKey = (entry: WorkerWorkEntry): string => {
        const siteId = (entry.siteId ?? '').trim();
        if (siteId) return siteId;
        const normalized = params.normalizeSiteName(entry.siteName ?? '');
        if (normalized) return `unresolved-site:${normalized}`;
        return 'no-site';
    };

    const isLaborEntry = (entry: WorkerWorkEntry): boolean => {
        if (entry.isLaborSite) return true;
        return (entry.paymentMethod ?? '').trim() === '노무';
    };

    const isInsuranceEligibleEntry = params.isInsuranceEligibleEntry ?? (() => true);

    const getLaborGroupKey = (entry: WorkerWorkEntry): string => {
        const siteKey = getSiteKey(entry);
        const clientCompanyId = (entry.clientCompanyId ?? '').trim();
        const clientKey = clientCompanyId || '__no_client__';
        return `${siteKey}::${clientKey}`;
    };

    const laborGroupAgg = new Map<
        string,
        {
            siteId: string;
            siteName: string;
            clientCompanyId: string;
            manDay: number;
            amount: number;
        }
    >();
    const insuranceEligibleGroupAgg = new Map<
        string,
        {
            siteId: string;
            siteName: string;
            clientCompanyId: string;
            manDay: number;
            amount: number;
        }
    >();
    const businessSiteAgg = new Map<string, { manDay: number; amount: number }>();
    const siteNameById = new Map<string, string>();

    allEntries.forEach((entry) => {
        const siteKey = getSiteKey(entry);

        if (!siteNameById.has(siteKey)) {
            siteNameById.set(siteKey, (entry.siteName ?? '').trim() || '-');
        }

        const amount = toNumber(entry.amount);
        const manDay = toNumber(entry.manDay);

        if (!isLaborEntry(entry)) return;
        const groupKey = getLaborGroupKey(entry);
        const clientCompanyId = (entry.clientCompanyId ?? '').trim();
        const prevGroup =
            laborGroupAgg.get(groupKey) ??
            {
                siteId: siteKey,
                siteName: siteNameById.get(siteKey) ?? '-',
                clientCompanyId,
                manDay: 0,
                amount: 0,
            };
        laborGroupAgg.set(groupKey, {
            siteId: prevGroup.siteId || siteKey,
            siteName: prevGroup.siteName || siteNameById.get(siteKey) || '-',
            clientCompanyId: clientCompanyId || prevGroup.clientCompanyId,
            manDay: prevGroup.manDay + manDay,
            amount: prevGroup.amount + amount,
        });

        if (!isInsuranceEligibleEntry(entry)) return;

        const prevInsuranceGroup =
            insuranceEligibleGroupAgg.get(groupKey) ??
            {
                siteId: siteKey,
                siteName: siteNameById.get(siteKey) ?? '-',
                clientCompanyId,
                manDay: 0,
                amount: 0,
            };

        insuranceEligibleGroupAgg.set(groupKey, {
            siteId: prevInsuranceGroup.siteId || siteKey,
            siteName: prevInsuranceGroup.siteName || siteNameById.get(siteKey) || '-',
            clientCompanyId: clientCompanyId || prevInsuranceGroup.clientCompanyId,
            manDay: prevInsuranceGroup.manDay + manDay,
            amount: prevInsuranceGroup.amount + amount,
        });
    });

    const insuranceGroupKeys = new Set<string>();

    if (params.applyInsurance && threshold > 0) {
        insuranceEligibleGroupAgg.forEach((agg, groupKey) => {
            if (agg.manDay >= threshold) insuranceGroupKeys.add(groupKey);
        });
    }

    const insuranceBaseAmount = params.applyInsurance
        ? Array.from(insuranceEligibleGroupAgg.entries()).reduce((sum, [groupKey, agg]) => sum + (insuranceGroupKeys.has(groupKey) ? agg.amount : 0), 0)
        : 0;

    const withholdingGroupKeys = new Set<string>();
    if (params.applyInsurance) {
        laborGroupAgg.forEach((agg, groupKey) => {
            if (agg.manDay <= 0) return;
            if (withholdingApplyAllLabor) {
                withholdingGroupKeys.add(groupKey);
                return;
            }
            if (insuranceGroupKeys.has(groupKey)) return;
            if (agg.manDay > 0 && agg.manDay <= params.withholdingThreshold) {
                withholdingGroupKeys.add(groupKey);
            }
        });
    }

    const withholdingBaseAmount = params.applyInsurance
        ? allEntries.reduce((sum, entry) => {
            if (!isLaborEntry(entry)) return sum;
            const groupKey = getLaborGroupKey(entry);
            if (!withholdingGroupKeys.has(groupKey)) return sum;

            const manDay = toNumber(entry.manDay);
            if (manDay <= 0) return sum;

            let unitPrice = toNumber(entry.unitPrice);
            if (unitPrice <= 0) {
                const amount = toNumber(entry.amount);
                if (amount > 0) unitPrice = amount / manDay;
            }
            const taxableUnitPrice = Math.max(0, unitPrice - withholdingBaseDeduction);
            if (taxableUnitPrice <= 0) return sum;

            return sum + taxableUnitPrice * manDay;
        }, 0)
        : 0;

    const employmentBaseAmount = params.applyInsurance
        ? Array.from(laborGroupAgg.entries()).reduce((sum, [groupKey, agg]) => {
            if (insuranceGroupKeys.has(groupKey)) return sum + agg.amount;
            if (withholdingGroupKeys.has(groupKey)) return sum + agg.amount;
            if (employmentApplyBelowThreshold) return sum + agg.amount;
            return sum;
        }, 0)
        : 0;

    const businessBaseAmount = params.applyBusinessIncome
        ? allEntries.reduce((sum, entry) => {
            const amount = toNumber(entry.amount);
            if (amount <= 0) return sum;
            if (isLaborEntry(entry)) {
                const groupKey = getLaborGroupKey(entry);
                if (insuranceGroupKeys.has(groupKey)) return sum;
                if (withholdingGroupKeys.has(groupKey)) return sum;
            }
            const siteKey = getSiteKey(entry);
            const prev = businessSiteAgg.get(siteKey) ?? { manDay: 0, amount: 0 };
            businessSiteAgg.set(siteKey, {
                manDay: prev.manDay + toNumber(entry.manDay),
                amount: prev.amount + amount,
            });
            return sum + amount;
        }, 0)
        : 0;

    const taxAdditionalLines: DeductionLine[] = [];

    const pension = params.applyInsurance ? floorWon(insuranceBaseAmount * toNumber(insuranceConfig?.pensionRate)) : 0;
    const health = params.applyInsurance ? floorWon(insuranceBaseAmount * toNumber(insuranceConfig?.healthRate)) : 0;
    const care = params.applyInsurance ? floorWon(health * toNumber(insuranceConfig?.careRateOfHealth)) : 0;
    const employment = params.applyInsurance ? floorWon(employmentBaseAmount * toNumber(insuranceConfig?.employmentRate)) : 0;

    if (pension > 0) taxAdditionalLines.push({ label: `${TEMP_INSURANCE_PREFIX} 국민연금`, amount: pension });
    if (health > 0) taxAdditionalLines.push({ label: `${TEMP_INSURANCE_PREFIX} 건강보험`, amount: health });
    if (care > 0) taxAdditionalLines.push({ label: `${TEMP_INSURANCE_PREFIX} 장기요양`, amount: care });
    if (employment > 0) taxAdditionalLines.push({ label: `${TEMP_INSURANCE_PREFIX} 고용보험`, amount: employment });

    const isWithholdingTarget = params.applyInsurance && withholdingBaseAmount > 0;
    const withholdingTaxBeforeCredit = isWithholdingTarget ? floorWon(withholdingBaseAmount * withholdingIncomeTaxRate) : 0;
    const incomeTax = isWithholdingTarget ? floorWon(withholdingTaxBeforeCredit * (1 - withholdingTaxCreditRate)) : 0;
    const residentTax = isWithholdingTarget ? floorWon(incomeTax * withholdingResidentTaxRate) : 0;
    if (incomeTax > 0) taxAdditionalLines.push({ label: `${TEMP_TAX_PREFIX} 갑근세`, amount: incomeTax });
    if (residentTax > 0) taxAdditionalLines.push({ label: `${TEMP_TAX_PREFIX} 지방세`, amount: residentTax });

    const businessIncomeTax = params.applyBusinessIncome ? floorWon(businessBaseAmount * BUSINESS_INCOME_TAX_RATE) : 0;
    const businessResidentTax = params.applyBusinessIncome ? floorWon(businessBaseAmount * BUSINESS_RESIDENT_TAX_RATE) : 0;
    if (businessIncomeTax > 0) taxAdditionalLines.push({ label: '[3.0%] 사업소득세', amount: businessIncomeTax });
    if (businessResidentTax > 0) taxAdditionalLines.push({ label: '[0.3%] 소득세', amount: businessResidentTax });

    let insuranceAppliedSummary: InsuranceAppliedSummary | undefined;
    let withholdingAppliedSummary: WithholdingAppliedSummary | undefined;
    let businessIncomeAppliedSummary: BusinessIncomeAppliedSummary | undefined;

    if (params.applyInsurance && insuranceBaseAmount > 0) {
        const appliedSites: InsuranceAppliedSiteSummary[] = Array.from(insuranceGroupKeys)
            .map((groupKey) => {
                const agg = insuranceEligibleGroupAgg.get(groupKey);
                const siteId = agg?.siteId ?? groupKey.split('::')[0];
                const reason: InsuranceAppliedReason = (agg?.clientCompanyId ?? '').trim() ? 'client' : 'site';
                return {
                    siteId: siteId || 'no-site',
                    siteName: agg?.siteName ?? siteNameById.get(siteId) ?? '-',
                    clientCompanyId: (agg?.clientCompanyId ?? '').trim(),
                    manDay: toNumber(agg?.manDay),
                    amount: toNumber(agg?.amount),
                    reason,
                };
            })
            .sort((a, b) => b.manDay - a.manDay);

        const appliedManDay = appliedSites.reduce((sum, s) => sum + toNumber(s.manDay), 0);

        insuranceAppliedSummary = {
            thresholdManDay: threshold,
            appliedManDay,
            appliedAmount: insuranceBaseAmount,
            appliedSites,
        };
    }

    if (params.applyInsurance && withholdingBaseAmount > 0) {
        const appliedSites: WithholdingAppliedSiteSummary[] = Array.from(withholdingGroupKeys)
            .map((groupKey) => {
                const agg = laborGroupAgg.get(groupKey);
                const siteId = agg?.siteId ?? groupKey.split('::')[0];
                const reason: WithholdingAppliedSiteSummary['reason'] = withholdingApplyAllLabor ? '노무전체' : '노무7이하';
                return {
                    siteId: siteId || 'no-site',
                    siteName: agg?.siteName ?? siteNameById.get(siteId) ?? '-',
                    manDay: toNumber(agg?.manDay),
                    amount: toNumber(agg?.amount),
                    reason,
                };
            })
            .sort((a, b) => b.manDay - a.manDay);

        const appliedManDay = appliedSites.reduce((sum, s) => sum + toNumber(s.manDay), 0);
        const grossAmount = appliedSites.reduce((sum, s) => sum + toNumber(s.amount), 0);

        withholdingAppliedSummary = {
            thresholdDays: withholdingApplyAllLabor ? 0 : params.withholdingThreshold,
            thresholdManDay: withholdingApplyAllLabor ? 0 : params.withholdingThreshold,
            appliedManDay,
            appliedAmount: withholdingBaseAmount,
            grossAmount,
            appliedSites,
        };
    }

    if (params.applyBusinessIncome && businessBaseAmount > 0) {
        const appliedSites: BusinessIncomeAppliedSiteSummary[] = Array.from(businessSiteAgg.entries())
            .map((siteId) => {
                const [safeSiteId, agg] = siteId;
                return {
                    siteId: safeSiteId,
                    siteName: siteNameById.get(safeSiteId) ?? '-',
                    manDay: toNumber(agg?.manDay),
                    amount: toNumber(agg?.amount),
                    reason: '4대보험_제외' as const,
                };
            })
            .sort((a, b) => b.manDay - a.manDay);

        const appliedManDay = appliedSites.reduce((sum, s) => sum + toNumber(s.manDay), 0);

        businessIncomeAppliedSummary = {
            appliedManDay,
            appliedAmount: businessBaseAmount,
            rate: BUSINESS_INCOME_TAX_RATE + BUSINESS_RESIDENT_TAX_RATE,
            appliedSites,
        };
    }

    return {
        statementTaxAmounts: {
            pension,
            health,
            care,
            employment,
            incomeTax,
            residentTax,
            businessIncomeTax,
            businessResidentTax,
            isWithholdingTarget,
        },
        taxAdditionalLines,
        taxRateSnapshot: {
            pensionRate: toNumber(insuranceConfig?.pensionRate),
            healthRate: toNumber(insuranceConfig?.healthRate),
            longtermRate: toNumber(insuranceConfig?.careRateOfHealth),
            careRateOfHealth: toNumber(insuranceConfig?.careRateOfHealth),
            employmentRate: toNumber(insuranceConfig?.employmentRate),
            incomeTaxRate: withholdingIncomeTaxRate,
            residentTaxRate: withholdingResidentTaxRate,
            withholdingBaseDeduction,
            withholdingIncomeBaseMultiplier: withholdingTaxCreditRate,
            businessIncomeTaxRate: BUSINESS_INCOME_TAX_RATE,
            businessResidentTaxRate: BUSINESS_RESIDENT_TAX_RATE,
        },
        insuranceAppliedSummary,
        withholdingAppliedSummary,
        businessIncomeAppliedSummary,
    };
};

const deduplicateAdvanceRecords = (records: AdvancePayment[]): AdvancePayment[] => {
    const map = new Map<string, AdvancePayment>();
    records.forEach((record) => {
        const teamKey = (record.teamId ?? '').trim() || '__no_team__';
        const currentScore = toNumber(record.totalDeduction);
        const prev = map.get(teamKey);
        const prevScore = toNumber(prev?.totalDeduction);
        if (!prev || currentScore >= prevScore) {
            map.set(teamKey, record);
        }
    });
    return Array.from(map.values());
};

const buildDeductionBreakdownFromRecords = (
    records: AdvancePayment[],
    deductionLabelMap: Record<string, string> = {}
): DeductionBreakdown => {
    if (!records || records.length === 0) {
        return createEmptyDeductionBreakdown();
    }

    const deduped = deduplicateAdvanceRecords(records);

    const standardLines: DeductionLine[] = [];
    STANDARD_DEDUCTION_FIELDS.forEach(({ key, label }) => {
        const sum = deduped.reduce((acc, record) => acc + toNumber(record[key]), 0);
        if (sum > 0) {
            standardLines.push({ label, amount: sum });
        }
    });

    const additionalTotals = new Map<string, number>();
    deduped.forEach((record) => {
        Object.entries(record.items ?? {}).forEach(([itemLabel, rawAmount]) => {
            const amount = toNumber(rawAmount);
            if (amount <= 0) return;
            additionalTotals.set(itemLabel, (additionalTotals.get(itemLabel) ?? 0) + amount);
        });
    });

    const additionalLines: DeductionLine[] = Array.from(additionalTotals.entries())
        .map(([labelKey, amount]) => {
            const friendlyLabel = deductionLabelMap[labelKey] ?? labelKey;
            return { label: friendlyLabel, amount };
        })
        .sort((a, b) => b.amount - a.amount);

    const totalStandard = standardLines.reduce((sum, line) => sum + line.amount, 0);
    const totalAdditional = additionalLines.reduce((sum, line) => sum + line.amount, 0);
    const total = totalStandard + totalAdditional;

    return {
        standardLines,
        additionalLines,
        totalStandard,
        totalAdditional,
        total,
        hasData: total > 0,
    };
};

interface Props {
    hideHeader?: boolean;
}

type KBPreviewSourceRow = {
    sourceRowId: string;
    month: string;
    teamName: string;
    workerName: string;
    salaryLabel: string;
    bankCode: string;
    bankName: string;
    accountNumber: string;
    accountHolder: string;
    totalAmount: number;
    invoiceNetAmount: number;
    laborNetAmount: number;
    invoiceAdvance: number;
    laborAdvance: number;
    corporateAdvance1: number;
    corporateAdvance2: number;
    corporateAdvance3: number;
    corporateAdvance4: number;
    laborAdvance1: number;
    laborAdvance2: number;
    laborAdvance3: number;
    laborAdvance4: number;
};

type KBTransferRow = {
    sourceRowId: string;
    month: string;
    teamName: string;
    workerName: string;
    salaryLabel: string;
    bankCode: string;
    bankCodeDisplay: string;
    bankCodeUnmapped: boolean;
    bankCodeNeedsFix: boolean;
    bankCodeReason: string;
    bankCodeCandidates: string;
    bankName: string;
    accountNumber: string;
    accountHolder: string;
    amount: number;
    receiverDisplay: string;
    senderMemo: string;
    validationErrors: KBTransferValidationError[];
};

type KBExcludedTransferRow = {
    sourceRowId: string;
    month: string;
    teamName: string;
    workerName: string;
    salaryLabel: string;
    amount: number;
    reason: string;
};

type KBPreviewCriteria = {
    generatedAt: string;
    rangeLabel: string;
    teamLabel: string;
    targetLabel: string;
    salaryFilterLabel: string;
    deductionStatusLabel: string;
    amountTypeLabel: string;
    sourceCount: number;
    exportCount: number;
    excludedCount: number;
    totalAmount: number;
};

type KBPreviewSnapshot = {
    createdAtIso: string;
    sourceRows: KBPreviewSourceRow[];
    rows: KBTransferRow[];
    excludedRows: KBExcludedTransferRow[];
    criteria: KBPreviewCriteria;
};

const DEFAULT_PAYSLIP_CONTRACTOR_NAME = '(주)청연이엔지';
const DEFAULT_PAYSLIP_CONTRACTOR_OPTIONS = [
    DEFAULT_PAYSLIP_CONTRACTOR_NAME,
    '(주)다원',
] as const;
const CUSTOM_PAYSLIP_CONTRACTOR_VALUE = '__custom_contractor__';

const MonthlyWagePaymentPage: React.FC<Props> = ({ hideHeader }) => {
    const { currentUser } = useAuth();
    const [startMonth, setStartMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [endMonth, setEndMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [yearCursor, setYearCursor] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [monthSelectionMode, setMonthSelectionMode] = useState<'single' | 'range'>('single');
    const [rangeAnchorMonth, setRangeAnchorMonth] = useState<string>('');
    const [selectedTeamId, setSelectedTeamId] = useState<string>('');
    const [teamDropdownOpen, setTeamDropdownOpen] = useState<boolean>(false);
    const [selectedWorkerId, setSelectedWorkerId] = useState<string>('');
    
    // usePayrollData 훅 통합
    const { 
        loading, 
        paymentData, 
        basePaymentData,
        setPaymentData,
        ledgerRowsData, 
        errorCount, 
        refetch: fetchData 
    } = usePayrollData(startMonth, endMonth, { 
        selectedTeamId: selectedTeamId || undefined, 
        selectedWorkerId: selectedWorkerId || undefined 
    });

    const [bulkDisplayContent, setBulkDisplayContent] = useState<string>('월급');
    const [showKBPreview, setShowKBPreview] = useState<boolean>(false); // 국민은행용 미리보기
    const [showPayslipModal, setShowPayslipModal] = useState<boolean>(false);
    const [selectedPayslipRowKey, setSelectedPayslipRowKey] = useState<string>(''); // 
    const [payslipContractorOption, setPayslipContractorOption] = useState<string>(DEFAULT_PAYSLIP_CONTRACTOR_NAME);
    const [customPayslipContractorName, setCustomPayslipContractorName] = useState<string>('');
    const [showBankCodes, setShowBankCodes] = useState<boolean>(false); // 은행코드표
    const [showAccountColumns, setShowAccountColumns] = useState<boolean>(false);
    const [teams, setTeams] = useState<Team[]>([]);
    const [allTeams, setAllTeams] = useState<Team[]>([]);
    const [allWorkers, setAllWorkers] = useState<Worker[]>([]);
    const [allSites, setAllSites] = useState<Site[]>([]);
    const [showCalculationLabor, setShowCalculationLabor] = useState<boolean>(false);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [workerSearchText, setWorkerSearchText] = useState<string>('');
    const [filterMode, setFilterMode] = useState<'team' | 'worker'>('team');
    const [pageViewMode, setPageViewMode] = useState<'simple' | 'standard' | 'ledger'>('ledger');
    const [ledgerSalaryModelFilter, setLedgerSalaryModelFilter] = useState<KBSalaryModelFilter>('all');
    const [toolbarExpanded, setToolbarExpanded] = useState<boolean>(false);
    const [ledgerVisibleSections, setLedgerVisibleSections] = useState({
        utilities: false,
        advances: true,
        taxes: false,
    });

    const [, setFiltersReady] = useState<boolean>(false);
    const [, setDeductionLabelMap] = useState<Record<string, string>>(buildStandardDeductionLabelMap());
    const [payrollConfig, setPayrollConfig] = useState<PayrollConfig | null>(null);
    const advanceLabelSet = useMemo(() => buildAdvanceLabelSet(payrollConfig), [payrollConfig]);
    const [showInsuranceSettings, setShowInsuranceSettings] = useState<boolean>(false);
    const [insuranceConfigSaving, setInsuranceConfigSaving] = useState<boolean>(false);

    const [insuranceThresholdManDayInput, setInsuranceThresholdManDayInput] = useState<string>('');
    const [pensionRatePercentInput, setPensionRatePercentInput] = useState<string>('');
    const [healthRatePercentInput, setHealthRatePercentInput] = useState<string>('');
    const [careRateOfHealthPercentInput, setCareRateOfHealthPercentInput] = useState<string>('');
    const [employmentRatePercentInput, setEmploymentRatePercentInput] = useState<string>('');
    const [dailyWorkerFeePerManDayInput, setDailyWorkerFeePerManDayInput] = useState<string>('');
    const [incomeTaxRatePercentInput, setIncomeTaxRatePercentInput] = useState<string>('');
    const [residentTaxRatePercentInput, setResidentTaxRatePercentInput] = useState<string>('');
    const [withholdingBaseDeductionInput, setWithholdingBaseDeductionInput] = useState<string>('');
    const [withholdingIncomeBaseMultiplierPercentInput, setWithholdingIncomeBaseMultiplierPercentInput] = useState<string>('');
    const [withholdingApplyAllLaborInput, setWithholdingApplyAllLaborInput] = useState<boolean>(true);
    const [employmentApplyBelowThresholdInput, setEmploymentApplyBelowThresholdInput] = useState<boolean>(true);

    const [deductionApplyInProgress, setDeductionApplyInProgress] = useState(false);

    const [insuranceApplied, setInsuranceApplied] = useState<boolean>(false);
    const [insuranceTeamSiteOnly, setInsuranceTeamSiteOnly] = useState<boolean>(false);
    const [businessIncomeApplied, setBusinessIncomeApplied] = useState<boolean>(false);
    const [utilitiesApplied, setUtilitiesApplied] = useState<boolean>(true);
    const [dailyFeeApplied, setDailyFeeApplied] = useState<boolean>(false);
    const [copying, setCopying] = useState(false);
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [ledgerInputs, setLedgerInputs] = useState<Record<string, LedgerManualInput>>({});
    const [ledgerComputedAmounts, setLedgerComputedAmounts] = useState<MonthlyAdvanceLedgerComputedAmount[]>([]);
    const [savedPayrollSettlements, setSavedPayrollSettlements] = useState<MonthlyPayrollSettlement[]>([]);
    const [payrollSettlementSaving, setPayrollSettlementSaving] = useState<boolean>(false);
    const [payrollSettlementLoading, setPayrollSettlementLoading] = useState<boolean>(false);
    const [payrollSettlementFeedback, setPayrollSettlementFeedback] = useState<string>('');
    const advanceLedgerRef = useRef<MonthlyAdvanceLedgerHandle>(null);
    const [kbReceiverDisplay, setKbReceiverDisplay] = useState<string>('㈜다원');
    const [kbMemoSuffix, setKbMemoSuffix] = useState<string>('{이름} 가불');
    const [kbAmountType, setKbAmountType] = useState<KBAmountType>('totalAmount');
    const [kbPreviewSnapshot, setKbPreviewSnapshot] = useState<KBPreviewSnapshot | null>(null);
    const [payslipOutputIds, setPayslipOutputIds] = useState<Record<string, string>>({});
    const [issuingPayslip, setIssuingPayslip] = useState<boolean>(false);
    const [payslipIssueMessage, setPayslipIssueMessage] = useState<string>('');
    const applyRunSeqRef = React.useRef(0);
    const applyWatchdogRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    const companyNameById = useMemo<Record<string, string>>(() => {
        const map: Record<string, string> = {};
        companies.forEach((company) => {
            const id = String(company.id ?? '').trim();
            if (!id) return;
            map[id] = String(company.name ?? '').trim() || id;
        });
        return map;
    }, [companies]);

    const workerTeamByWorkerId = useMemo(() => {
        const map = new Map<string, { teamId: string; teamName: string }>();
        allWorkers.forEach((worker) => {
            const workerId = String(worker.id ?? '').trim();
            if (!workerId) return;
            map.set(workerId, {
                teamId: String(worker.teamId ?? '').trim(),
                teamName: String(worker.teamName ?? '').trim(),
            });
        });
        return map;
    }, [allWorkers]);

    const normalizePersistedTeamId = useCallback((value: string | undefined): string => {
        const safe = String(value ?? '').trim();
        if (!safe) return '';
        if (safe === 'no-team' || safe === '__no_team__' || safe.startsWith('unresolved:')) return '';
        return safe;
    }, []);

    const normalizeTeamText = useCallback((value: string | undefined): string => {
        return (value ?? '')
            .toLowerCase()
            .replace(/\(.*?\)/g, '')
            .replace(/[^0-9a-z\u3131-\u318e\uac00-\ud7a3]/g, '')
            .trim();
    }, []);

    const teamIdAliasIndex = useMemo(() => {
        const aliasToCanonical = new Map<string, string>();

        allTeams.forEach((team) => {
            const id = normalizePersistedTeamId(String(team.id ?? ''));
            const legacyId = normalizePersistedTeamId(String(team.legacyId ?? ''));
            const canonical = id || legacyId;
            if (!canonical) return;

            aliasToCanonical.set(canonical, canonical);
            if (id) aliasToCanonical.set(id, canonical);
            if (legacyId) aliasToCanonical.set(legacyId, canonical);
        });

        return aliasToCanonical;
    }, [allTeams, normalizePersistedTeamId]);

    const resolveCanonicalTeamId = useCallback(
        (value: string | undefined): string => {
            const normalized = normalizePersistedTeamId(value);
            if (!normalized) return '';
            return teamIdAliasIndex.get(normalized) ?? normalized;
        },
        [normalizePersistedTeamId, teamIdAliasIndex]
    );

    const siteTeamOwnershipIndex = useMemo(() => {
        const bySiteId = new Map<string, { teamId: string; teamNameKey: string }>();
        const bySiteName = new Map<string, { teamId: string; teamNameKey: string }>();

        allSites.forEach((site) => {
            const teamId = resolveCanonicalTeamId(String(site.responsibleTeamId ?? ''));
            const teamNameKey = normalizeTeamText(site.responsibleTeamName ?? '');
            if (!teamId && !teamNameKey) return;

            const payload = { teamId, teamNameKey };

            const siteId = String(site.id ?? '').trim();
            if (siteId && !bySiteId.has(siteId)) {
                bySiteId.set(siteId, payload);
            }

            const legacyId = String(site.legacyId ?? '').trim();
            if (legacyId && !bySiteId.has(legacyId)) {
                bySiteId.set(legacyId, payload);
            }

            const siteNameKey = normalizeTeamText(site.name);
            if (siteNameKey && !bySiteName.has(siteNameKey)) {
                bySiteName.set(siteNameKey, payload);
            }
        });

        return { bySiteId, bySiteName };
    }, [allSites, normalizeTeamText, resolveCanonicalTeamId]);

    const isEntryInWorkerTeamSite = useCallback(
        (entry: WorkerWorkEntry, workerTeamId: string | undefined, workerTeamName: string | undefined): boolean => {
            const targetTeamId = resolveCanonicalTeamId(workerTeamId);
            const targetTeamNameKey = normalizeTeamText(workerTeamName);
            if (!targetTeamId && !targetTeamNameKey) return false;

            const siteId = String(entry.siteId ?? '').trim();
            const siteNameKey = normalizeTeamText(entry.siteName);
            const owner =
                (siteId ? siteTeamOwnershipIndex.bySiteId.get(siteId) : undefined) ??
                (siteNameKey ? siteTeamOwnershipIndex.bySiteName.get(siteNameKey) : undefined);

            if (!owner) return false;
            if (targetTeamId && owner.teamId && owner.teamId === targetTeamId) return true;
            if (targetTeamNameKey && owner.teamNameKey && owner.teamNameKey === targetTeamNameKey) return true;
            return false;
        },
        [normalizeTeamText, resolveCanonicalTeamId, siteTeamOwnershipIndex]
    );

    // Full-bleed: remove #main-content padding and lock overflow for internal scrolling
    useEffect(() => {
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            const originalOverflow = mainContent.style.overflow;
            mainContent.style.overflow = 'hidden';
            mainContent.classList.add('page-full-bleed');
            return () => {
                mainContent.style.overflow = originalOverflow;
                mainContent.classList.remove('page-full-bleed');
            };
        }
    }, []);
    const printRef = useRef<HTMLDivElement>(null);
    const [payslipPrintRows, setPayslipPrintRows] = useState<PaymentData[]>([]);
    const [preparingPayslipPrint, setPreparingPayslipPrint] = useState<boolean>(false);
    const [batchExcelDownloading, setBatchExcelDownloading] = useState<boolean>(false);
    const teamDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!teamDropdownOpen) return;

        const handleOutsideClick = (event: MouseEvent) => {
            if (!teamDropdownRef.current) return;
            const targetNode = event.target as Node;
            if (!teamDropdownRef.current.contains(targetNode)) {
                setTeamDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, [teamDropdownOpen]);

    // --- Copy Logic ---
    const handleCopyToClipboard = async () => {
        if (!printRef.current) return;
        if (resolvedPayslipTarget && !ensurePayslipIssueReady([resolvedPayslipTarget], '이미지 복사')) return;
        setCopying(true);

        try {
            // Force white background for the capture
            // Cast html2canvas to any because of version mismatch with @types/html2canvas (0.5.x vs 1.4.x)
            const canvas = await (html2canvas as any)(printRef.current, {
                scale: 1.5, // Reasonable scale for clipboard
                backgroundColor: '#ffffff',
                logging: false,
                useCORS: true
            });

            canvas.toBlob(async (blob: Blob | null) => {
                if (!blob) {
                    alert('이미지 생성에 실패했습니다.');
                    setCopying(false);
                    return;
                }

                try {
                    // Safe ClipboardItem usage
                    const ClipboardItem = (window as any).ClipboardItem;
                    if (!ClipboardItem) {
                        alert('이 브라우저는 이미지 복사를 지원하지 않습니다.');
                        setCopying(false);
                        return;
                    }

                    await navigator.clipboard.write([
                        new ClipboardItem({
                            'image/png': blob
                        })
                    ]);
                    alert('명세서가 이미지로 복사되었습니다.\nCtrl+V로 붙여넣으세요.');
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

    const normalizeValue = useCallback((value: string | undefined): string => {
        return (value ?? '').replace(/\s+/g, '').trim();
    }, []);

    const normalizeTeamName = useCallback((value: string | undefined): string => {
        return (value ?? '')
            .replace(/\(.*?\)/g, '')
            .replace(/\s+/g, '')
            .trim();
    }, []);

    const getYearMonthFromDate = useCallback((date: Date): string => {
        const yyyy = String(date.getFullYear());
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        return `${yyyy}-${mm}`;
    }, []);

    const compareYearMonth = useCallback((a: string, b: string): number => {
        const left = (a ?? '').trim();
        const right = (b ?? '').trim();
        if (left === right) return 0;
        return left < right ? -1 : 1;
    }, []);

    const shiftYearMonth = useCallback(
        (yearMonth: string, diffMonths: number): string => {
            const [yStr, mStr] = yearMonth.split('-');
            const y = Number(yStr);
            const m = Number(mStr);
            const safe = new Date(Number.isFinite(y) ? y : new Date().getFullYear(), (Number.isFinite(m) ? m : 1) - 1, 1);
            safe.setMonth(safe.getMonth() + diffMonths);
            return getYearMonthFromDate(safe);
        },
        [getYearMonthFromDate]
    );

    const buildMonthRange = useCallback(
        (rangeStart: string, rangeEnd: string): string[] => {
            const safeStart = (rangeStart ?? '').trim();
            const safeEnd = (rangeEnd ?? '').trim();
            if (!safeStart || !safeEnd) return [];

            const from = compareYearMonth(safeStart, safeEnd) <= 0 ? safeStart : safeEnd;
            const to = compareYearMonth(safeStart, safeEnd) <= 0 ? safeEnd : safeStart;

            const result: string[] = [];
            let cursor = from;
            for (let i = 0; i < 240; i += 1) {
                result.push(cursor);
                if (cursor === to) break;
                cursor = shiftYearMonth(cursor, 1);
            }
            return result;
        },
        [compareYearMonth, shiftYearMonth]
    );

    const currentYearMonth = useMemo(() => getYearMonthFromDate(new Date()), [getYearMonthFromDate]);
    const prevYearMonth = useMemo(() => shiftYearMonth(currentYearMonth, -1), [currentYearMonth, shiftYearMonth]);

    const handleSelectSingleMonth = useCallback((yearMonth: string) => {
        const safe = (yearMonth ?? '').trim();
        if (!safe) return;
        setStartMonth(safe);
        setEndMonth(safe);
        setYearCursor(safe);
        setRangeAnchorMonth('');
    }, []);

    const handleSelectPrevMonth = useCallback(() => {
        handleSelectSingleMonth(prevYearMonth);
    }, [handleSelectSingleMonth, prevYearMonth]);

    const handleSelectCurrentMonth = useCallback(() => {
        handleSelectSingleMonth(currentYearMonth);
    }, [currentYearMonth, handleSelectSingleMonth]);

    const handleMonthModeChange = useCallback(
        (nextMode: 'single' | 'range') => {
            setMonthSelectionMode(nextMode);
            setRangeAnchorMonth('');
            if (nextMode === 'single') {
                const safe = (endMonth || startMonth || currentYearMonth).trim();
                if (safe) {
                    setStartMonth(safe);
                    setEndMonth(safe);
                    setYearCursor(safe);
                }
            }
        },
        [currentYearMonth, endMonth, startMonth]
    );

    const handleMonthButtonSelect = useCallback(
        (yearMonth: string) => {
            const safe = (yearMonth ?? '').trim();
            if (!safe) return;
            setYearCursor(safe);

            if (monthSelectionMode === 'single') {
                handleSelectSingleMonth(safe);
                return;
            }

            if (!rangeAnchorMonth) {
                setRangeAnchorMonth('');
                setStartMonth(safe);
                setEndMonth(safe);
                return;
            }

            const from = compareYearMonth(rangeAnchorMonth, safe) <= 0 ? rangeAnchorMonth : safe;
            const to = compareYearMonth(rangeAnchorMonth, safe) <= 0 ? safe : rangeAnchorMonth;
            setStartMonth(from);
            setEndMonth(to);
            setRangeAnchorMonth('');
        },
        [compareYearMonth, handleSelectSingleMonth, monthSelectionMode, rangeAnchorMonth]
    );

    const monthRange = useMemo(() => buildMonthRange(startMonth, endMonth), [buildMonthRange, endMonth, startMonth]);
    const monthRangeSet = useMemo(() => new Set(monthRange), [monthRange]);

    useEffect(() => {
        let alive = true;
        const years = Array.from(new Set(
            monthRange
                .map((yearMonth) => Number(yearMonth.slice(0, 4)))
                .filter((year) => Number.isFinite(year) && year > 0)
        ));

        if (years.length === 0) {
            setSavedPayrollSettlements([]);
            return () => {
                alive = false;
            };
        }

        setPayrollSettlementLoading(true);
        Promise.all(years.map((year) => monthlyPayrollSettlementService.getSettlementsByYear(year)))
            .then((results) => {
                if (!alive) return;
                setSavedPayrollSettlements(
                    results
                        .flat()
                        .filter((settlement) => monthRangeSet.has(settlement.yearMonth))
                );
            })
            .catch((error) => {
                console.error('[MonthlyWageDraftPage] saved settlement load failed:', error);
                if (!alive) return;
                setSavedPayrollSettlements([]);
                setPayrollSettlementFeedback('저장된 정산을 불러오지 못했습니다.');
            })
            .finally(() => {
                if (alive) setPayrollSettlementLoading(false);
            });

        return () => {
            alive = false;
        };
    }, [monthRange, monthRangeSet]);

    const selectedTeamLabel = useMemo(() => {
        if (!selectedTeamId) return '팀전체';
        const found = teams.find((team) => String(team.id ?? '').trim() === selectedTeamId);
        return (found?.name ?? '팀전체').trim() || '팀전체';
    }, [selectedTeamId, teams]);

    useEffect(() => {
        let alive = true;
        if (monthRange.length === 0) {
            setPayslipOutputIds({});
            return;
        }

        Promise.all(monthRange.map((month) =>
            statementOutputService.getOutputsByMonth(month).catch((error) => {
                console.error('[MonthlyWageDraftPage] payslip output load failed:', error);
                return [] as StatementOutputRecord[];
            })
        )).then((groups) => {
            if (!alive) return;
            const next: Record<string, string> = {};
            groups.flat()
                .filter((item) => item.source === 'monthly-wage' && item.kind === 'labor' && item.status === 'afterIssue')
                .forEach((item) => {
                    if (item.statementKey && item.id) next[item.statementKey] = item.id;
                });
            setPayslipOutputIds(next);
        });

        return () => {
            alive = false;
        };
    }, [monthRange]);

    const rangeLabel = useMemo(() => {
        if (!startMonth || !endMonth) return '';
        const from = compareYearMonth(startMonth, endMonth) <= 0 ? startMonth : endMonth;
        const to = compareYearMonth(startMonth, endMonth) <= 0 ? endMonth : startMonth;
        return from === to ? from : `${from}~${to}`;
    }, [compareYearMonth, endMonth, startMonth]);

        const formatYearMonthParts = useCallback((value: string) => {
            const [year = '-', month = '-'] = (value ?? '').split('-');
            return {
                year,
                month,
            };
        }, []);

    const tableColSpan = showAccountColumns ? 15 : 11;
    const filteredPaymentSourceData = useMemo(() => {
        const rows = paymentData;

        const sortRows = (list: PaymentData[]) => {
            const salaryRank = (item: PaymentData) => (item.id.endsWith('__월급제') ? 0 : 1);
            return [...list].sort((a, b) => {
                const monthCmp = String(a.month ?? '').localeCompare(String(b.month ?? ''));
                if (monthCmp !== 0) return monthCmp;

                const rankCmp = salaryRank(a) - salaryRank(b);
                if (rankCmp !== 0) return rankCmp;

                const workerCmp = String(a.workerName ?? '').localeCompare(String(b.workerName ?? ''));
                if (workerCmp !== 0) return workerCmp;

                const teamCmp = String(a.teamName ?? '').localeCompare(String(b.teamName ?? ''));
                if (teamCmp !== 0) return teamCmp;

                return String(a.id ?? '').localeCompare(String(b.id ?? ''));
            });
        };

        if (filterMode === 'team') {
            return sortRows(rows);
        }

        if (selectedWorkerId) {
            return sortRows(rows.filter((item) => item.workerId === selectedWorkerId));
        }
        return sortRows(filterRowsByWorkerName(rows, workerSearchText));
    }, [filterMode, paymentData, selectedWorkerId, workerSearchText]);

    // 확정/지급완료된 월·팀은 원천자료가 이후 변경되어도 당시 저장한
    // 급여 행을 사용한다. 기존 상세 화면과 출력 기능은 같은 목록을 보므로
    // 화면마다 다른 급여가 보이는 문제도 막을 수 있다.
    const finalizedSnapshotByPaymentId = useMemo(() => {
        const snapshots = new Map<string, {
            payment: PaymentData;
            row: MonthlyPayrollSettlement['rows'][number];
            settlementId: string;
        }>();

        savedPayrollSettlements
            .filter((settlement) => (
                monthRangeSet.has(settlement.yearMonth)
                && isFinalizedMonthlyPayrollRun(settlement.runStatus)
            ))
            .forEach((settlement) => {
                settlement.rows.forEach((row) => {
                    const snapshot = row.paymentSnapshot as PaymentData | undefined;
                    const paymentId = String(snapshot?.id ?? '').trim();
                    if (!snapshot || !paymentId) return;
                    snapshots.set(paymentId, {
                        payment: snapshot,
                        row,
                        settlementId: settlement.id || '',
                    });
                });
            });

        return snapshots;
    }, [monthRangeSet, savedPayrollSettlements]);

    const filteredPaymentData = useMemo(() => {
        const applyFinalizedSnapshot = (
            source: PaymentData | undefined,
            finalized: NonNullable<typeof finalizedSnapshotByPaymentId extends Map<string, infer T> ? T : never>
        ): PaymentData => ({
            ...(source ?? finalized.payment),
            ...finalized.payment,
            totalDeduction: toNumber(finalized.row.totalDeduction ?? finalized.payment.totalDeduction),
            totalAmount: toNumber(finalized.row.netAmount ?? finalized.payment.totalAmount),
            deductionBreakdown: finalized.payment.deductionBreakdown ?? source?.deductionBreakdown ?? createEmptyDeductionBreakdown(),
            taxBreakdown: finalized.payment.taxBreakdown ?? source?.taxBreakdown ?? createEmptyDeductionBreakdown(),
        });

        const sourceIds = new Set(filteredPaymentSourceData.map((item) => item.id));
        const rows = filteredPaymentSourceData.map((source) => {
            const finalized = finalizedSnapshotByPaymentId.get(source.id);
            return finalized ? applyFinalizedSnapshot(source, finalized) : source;
        });

        const workerSearch = workerSearchText.trim().toLowerCase();
        finalizedSnapshotByPaymentId.forEach((finalized, paymentId) => {
            if (sourceIds.has(paymentId)) return;
            const payment = finalized.payment;
            if (selectedTeamId && payment.teamId !== selectedTeamId) return;
            if (filterMode !== 'worker') {
                rows.push(applyFinalizedSnapshot(undefined, finalized));
                return;
            }
            if (selectedWorkerId) {
                if (payment.workerId === selectedWorkerId) rows.push(applyFinalizedSnapshot(undefined, finalized));
                return;
            }
            if (!workerSearch || payment.workerName.toLowerCase().includes(workerSearch)) {
                rows.push(applyFinalizedSnapshot(undefined, finalized));
            }
        });

        return rows.sort((a, b) => (
            String(a.month ?? '').localeCompare(String(b.month ?? ''))
            || String(a.workerName ?? '').localeCompare(String(b.workerName ?? ''))
            || String(a.teamName ?? '').localeCompare(String(b.teamName ?? ''))
            || String(a.id ?? '').localeCompare(String(b.id ?? ''))
        ));
    }, [
        filterMode,
        filteredPaymentSourceData,
        finalizedSnapshotByPaymentId,
        selectedTeamId,
        selectedWorkerId,
        workerSearchText,
    ]);

    const kbSourcePaymentData = useMemo(() => {
        return filterKBPaymentRows(filteredPaymentData, {
            pageViewMode: pageViewMode === 'ledger' ? 'ledger' : 'standard',
            ledgerSalaryModelFilter,
        });
    }, [filteredPaymentData, ledgerSalaryModelFilter, pageViewMode]);

    const filteredLedgerRows = useMemo<MonthlyAdvanceLedgerRow[]>(() => {
        const matchesSalaryModelFilter = (row: MonthlyAdvanceLedgerRow): boolean => {
            if (ledgerSalaryModelFilter === 'all') return true;
            const normalized = (row.salaryModel ?? '').trim();
            const filterValue = normalized === '일급제'
                ? 'daily'
                : normalized === '용역팀'
                    ? 'service'
                    : 'monthly';
            return filterValue === ledgerSalaryModelFilter;
        };

        const rows = ledgerRowsData.filter(matchesSalaryModelFilter);
        if (filterMode === 'team') return rows;
        if (selectedWorkerId) {
            return rows.filter((item) => item.workerId === selectedWorkerId);
        }
        return filterRowsByWorkerName(rows, workerSearchText);
    }, [filterMode, ledgerRowsData, ledgerSalaryModelFilter, selectedWorkerId, workerSearchText]);

    const paymentDataByLedgerKey = useMemo(() => {
        const map = new Map<string, PaymentData>();
        paymentData.forEach((item) => {
            const salaryModel = item.id.endsWith('__일급제') ? '일급제' : item.id.endsWith('__용역팀') ? '용역팀' : '월급제';
            map.set(`${item.month}__${item.workerId}__${item.teamId}__${salaryModel}`, item);
        });
        return map;
    }, [paymentData]);

    const paymentDataByWorkerMonthKey = useMemo(() => {
        const map = new Map<string, PaymentData[]>();
        paymentData.forEach((item) => {
            const key = `${item.month}__${item.workerId}`;
            const prev = map.get(key) ?? [];
            prev.push(item);
            map.set(key, prev);
        });
        return map;
    }, [paymentData]);

    const ledgerRows = useMemo<MonthlyAdvanceLedgerRow[]>(
        () =>
            filteredLedgerRows.map((row) => {
                const _rawModel = (row.salaryModel ?? '').trim();
                const rowSalaryModel = _rawModel === '일급제' ? '일급제' : _rawModel === '용역팀' ? '용역팀' : '월급제';
                const key = `${row.month}__${row.workerId}__${row.teamId}__${rowSalaryModel}`;
                let statementItem = paymentDataByLedgerKey.get(key);

                if (!statementItem) {
                    const looseKey = `${row.month}__${row.workerId}`;
                    const workerTeam = workerTeamByWorkerId.get(String(row.workerId ?? '').trim());
                    const normalizedRowTeam = normalizeTeamName(workerTeam?.teamName || row.teamName);
                    const targetCanonicalTeamId = resolveCanonicalTeamId(workerTeam?.teamId || row.teamId);
                    const candidates = (paymentDataByWorkerMonthKey.get(looseKey) ?? []).filter((candidate) => {
                        const candidateSalaryModel = candidate.id.endsWith('__일급제') ? '일급제' : candidate.id.endsWith('__용역팀') ? '용역팀' : '월급제';
                        return candidateSalaryModel === rowSalaryModel;
                    });

                    statementItem =
                        candidates.find((candidate) => {
                            if (!targetCanonicalTeamId) return false;
                            return resolveCanonicalTeamId(candidate.teamId) === targetCanonicalTeamId;
                        }) ??
                        candidates.find((candidate) => normalizeTeamName(candidate.teamName) === normalizedRowTeam) ??
                        (candidates.length === 1 ? candidates[0] : undefined);
                }

                if (statementItem) {
                    return {
                        ...row,
                        teamId: statementItem.teamId,
                        teamName: statementItem.teamName,
                        invoiceManDay: statementItem.invoiceManDay,
                        laborManDay: statementItem.laborManDay,
                        unitPrice: statementItem.unitPrice,
                        invoiceGrossAmount: statementItem.invoiceGrossAmount,
                        laborGrossAmount: statementItem.laborGrossAmount,
                        workEntries: [...(statementItem.workEntries ?? [])],
                        statementTaxAmounts: extractLedgerTaxAmountsFromItem(statementItem),
                    };
                }

                if (!payrollConfig) return row;

                const workerTeam = workerTeamByWorkerId.get(String(row.workerId ?? '').trim());
                const workerTeamIdForMatch = workerTeam?.teamId || row.teamId;
                const workerTeamNameForMatch = workerTeam?.teamName || row.teamName;

                const workEntriesForTax = buildWorkEntriesForLedgerRow(row);
                const calculatedTax = calculateWorkEntryTaxBreakdown({
                    workEntries: workEntriesForTax,
                    payrollConfig,
                    applyInsurance: insuranceApplied,
                    applyBusinessIncome: businessIncomeApplied,
                    normalizeSiteName: normalizeTeamName,
                    withholdingThreshold: WITHHOLDING_MAX_MAN_DAY,
                    isInsuranceEligibleEntry: insuranceTeamSiteOnly
                    ? (entry) => isEntryInWorkerTeamSite(entry, workerTeamIdForMatch, workerTeamNameForMatch)
                        : undefined,
                });

                const fallbackDailyFeePerManDay = Math.max(
                    0,
                    Math.floor(toNumber(payrollConfig?.insuranceConfig?.dailyWorkerFeePerManDay ?? 0))
                );
                const fallbackDailyFeeManDay = workEntriesForTax.reduce((sum, entry) => sum + toNumber(entry.manDay), 0);
                const fallbackDailyFee = rowSalaryModel === '일급제' && fallbackDailyFeePerManDay > 0
                    ? floorWon(fallbackDailyFeeManDay * fallbackDailyFeePerManDay)
                    : 0;

                return {
                    ...row,
                    statementTaxAmounts: {
                        ...calculatedTax.statementTaxAmounts,
                        dailyFee: fallbackDailyFee,
                    },
                };
            }),
        [
            businessIncomeApplied,
            filteredLedgerRows,
            insuranceApplied,
            insuranceTeamSiteOnly,
            isEntryInWorkerTeamSite,
            normalizeTeamName,
            paymentDataByLedgerKey,
            paymentDataByWorkerMonthKey,
            payrollConfig,
            resolveCanonicalTeamId,
            workerTeamByWorkerId,
        ]
    );

    const ledgerComputedAmountByRowKey = useMemo(() => {
        const map = new Map<string, MonthlyAdvanceLedgerComputedAmount>();
        ledgerComputedAmounts.forEach((row) => {
            const rowKey = String(row.rowKey ?? '').trim();
            if (rowKey) map.set(rowKey, row);
        });
        return map;
    }, [ledgerComputedAmounts]);

    const loadedLedgerInputsFromAdvance = useMemo<Record<string, LedgerManualInput>>(() => {
        const next: Record<string, LedgerManualInput> = {};
        ledgerRows.forEach((row) => {
            const key = String(row.rowKey || row.id || '').trim();
            if (!key || !row.manual) return;
            next[key] = row.manual;
        });
        return next;
    }, [ledgerRows]);

    const loadedLedgerInputsFromSettlement = useMemo<Record<string, LedgerManualInput>>(() => {
        const next: Record<string, LedgerManualInput> = {};
        savedPayrollSettlements.forEach((settlement) => {
            settlement.rows.forEach((row) => {
                const rowKey = String(row.rowKey ?? '').trim();
                if (!rowKey || !row.manualInput) return;
                next[rowKey] = row.manualInput as LedgerManualInput;
            });
        });
        return next;
    }, [savedPayrollSettlements]);

    const initialLedgerInputs = useMemo<Record<string, LedgerManualInput>>(
        () => ({
            ...loadedLedgerInputsFromAdvance,
            ...loadedLedgerInputsFromSettlement,
        }),
        [loadedLedgerInputsFromAdvance, loadedLedgerInputsFromSettlement]
    );

    const activeLedgerRowKeySet = useMemo<Set<string>>(() => {
        const set = new Set<string>();
        ledgerRows.forEach((row) => {
            const key = String(row.rowKey || row.id || '').trim();
            if (key) set.add(key);
        });
        return set;
    }, [ledgerRows]);

    const ledgerSideFieldNames: Array<keyof LedgerManualInput['invoice']> = useMemo(
        () => [
            'carry',
            'carrySecond',
            'currentAdvance',
            'currentAdvanceSecond',
            'lodging',
            'electricity',
            'gas',
            'water',
            'internet',
            'management',
            'fine',
            'other',
        ],
        []
    );

    const isLedgerManualInputEffectivelyEmpty = useCallback(
        (input: LedgerManualInput | undefined, baselineInput?: LedgerManualInput): boolean => {
            if (!input) return true;

            const resolveAssignmentType = (
                assignmentType: LedgerManualInput['assignmentType'] | undefined,
                fallback: 'corporate' | 'labor' = 'corporate'
            ): 'corporate' | 'labor' => {
                if (assignmentType === 'labor') return 'labor';
                if (assignmentType === 'corporate') return 'corporate';
                return fallback;
            };

            const isSideEmpty = (side: LedgerManualInput['invoice'] | undefined): boolean => {
                const safeSide = side ?? ({} as LedgerManualInput['invoice']);
                return ledgerSideFieldNames.every((field) => toNumber(safeSide[field]) === 0);
            };

            const memo = String(input.personalMemo ?? '').trim();
            const assignments = input.itemAssignments ?? {};
            const hasAssignment = Object.keys(assignments).some((key) => {
                const value = assignments[key];
                return (value === 'corporate' || value === 'labor') && String(key).trim().length > 0;
            });

            const baselineAllocationMode = baselineInput?.allocationMode ?? 'split';
            const currentAllocationMode = input.allocationMode ?? 'split';
            const hasCustomAllocationMode = currentAllocationMode !== baselineAllocationMode;
            const hasAnyValue = !isSideEmpty(input.invoice)
                || !isSideEmpty(input.labor)
                || memo.length > 0
                || hasAssignment
                || hasCustomAllocationMode;
            if (!hasAnyValue) return true;

            const baselineAssignment = resolveAssignmentType(baselineInput?.assignmentType, 'corporate');
            const currentAssignment = resolveAssignmentType(input.assignmentType, baselineAssignment);
            const hasCustomAssignment = currentAssignment !== baselineAssignment;

            return isSideEmpty(input.invoice)
                && isSideEmpty(input.labor)
                && memo.length === 0
                && !hasAssignment
                && !hasCustomAssignment
                && !hasCustomAllocationMode;
        },
        [ledgerSideFieldNames]
    );

    useEffect(() => {
        setLedgerInputs((prev) => {
            const next: Record<string, LedgerManualInput> = {};

            activeLedgerRowKeySet.forEach((key) => {
                const prevInput = prev[key];
                const loadedInput = initialLedgerInputs[key];

                if (loadedInput && (!prevInput || isLedgerManualInputEffectivelyEmpty(prevInput, loadedInput))) {
                    next[key] = loadedInput;
                    return;
                }

                if (prevInput) {
                    next[key] = prevInput;
                    return;
                }

                if (loadedInput) {
                    next[key] = loadedInput;
                }
            });

            const prevKeys = Object.keys(prev);
            const nextKeys = Object.keys(next);
            if (prevKeys.length !== nextKeys.length) return next;

            const hasChanged = nextKeys.some((key) => prev[key] !== next[key]);
            return hasChanged ? next : prev;
        });
    }, [activeLedgerRowKeySet, initialLedgerInputs, isLedgerManualInputEffectivelyEmpty]);

    const utilityInputByPaymentRowKey = useMemo(() => {
        const map = new Map<string, LedgerUtilityInputLike>();
        const paymentRows = basePaymentData.length > 0 ? basePaymentData : paymentData;

        const upsertUtilityInput = (paymentRowKey: string, input: LedgerUtilityInputLike) => {
            const existing = map.get(paymentRowKey);
            if (!existing) {
                map.set(paymentRowKey, input);
                return;
            }

            const mergeSide = (side: 'invoice' | 'labor') => {
                const prevSide = existing[side];
                const nextSide = input[side];
                return {
                    ...prevSide,
                    ...nextSide,
                    lodging: toNumber(prevSide?.lodging) + toNumber(nextSide?.lodging),
                    electricity: toNumber(prevSide?.electricity) + toNumber(nextSide?.electricity),
                    gas: toNumber(prevSide?.gas) + toNumber(nextSide?.gas),
                    water: toNumber(prevSide?.water) + toNumber(nextSide?.water),
                    internet: toNumber(prevSide?.internet) + toNumber(nextSide?.internet),
                    management: toNumber(prevSide?.management) + toNumber(nextSide?.management),
                    fine: toNumber(prevSide?.fine) + toNumber(nextSide?.fine),
                    other: toNumber(prevSide?.other) + toNumber(nextSide?.other),
                };
            };

            map.set(paymentRowKey, {
                ...existing,
                ...input,
                invoice: mergeSide('invoice'),
                labor: mergeSide('labor'),
            });
        };

        Object.entries(ledgerInputs).forEach(([ledgerRowKey, manual]) => {
            const salaryModel = ledgerRowKey.endsWith('__일급제') ? '일급제' : ledgerRowKey.endsWith('__용역팀') ? '용역팀' : (ledgerRowKey.endsWith('__월급제') ? '월급제' : '');
            if (!salaryModel) return;

            const input = manual as LedgerUtilityInputLike;
            const parts = ledgerRowKey.split('__');
            if (parts.length < 4) return;
            const [month, workerId, teamId] = parts;

            const directPaymentKey = `${month}__${workerId}__${teamId}__${salaryModel}`;
            if (paymentRows.some((item) => item.id === directPaymentKey)) {
                upsertUtilityInput(directPaymentKey, input);
                return;
            }

            const candidates = paymentRows.filter((item) => item.month === month && item.workerId === workerId && item.id.endsWith(`__${salaryModel}`));
            if (candidates.length === 0) return;

            const ledgerRow = ledgerRowsData.find((row) => row.rowKey === ledgerRowKey);
            if (ledgerRow) {
                const normalizedLedgerTeam = normalizeTeamName(ledgerRow.teamName);
                const matched = candidates.find((candidate) => normalizeTeamName(candidate.teamName) === normalizedLedgerTeam);
                if (matched) {
                    upsertUtilityInput(matched.id, input);
                    return;
                }
            }

            if (candidates.length === 1) {
                upsertUtilityInput(candidates[0].id, input);
            }
        });

        return map;
    }, [basePaymentData, ledgerInputs, ledgerRowsData, normalizeTeamName, paymentData]);

    const utilityInputByWorkerMonthSingle = useMemo(() => {
        const grouped = new Map<string, LedgerUtilityInputLike[]>();

        Object.entries(ledgerInputs).forEach(([ledgerRowKey, manual]) => {
            const salaryModel = ledgerRowKey.endsWith('__일급제') ? '일급제' : ledgerRowKey.endsWith('__용역팀') ? '용역팀' : (ledgerRowKey.endsWith('__월급제') ? '월급제' : '');
            if (!salaryModel) return;
            const parts = ledgerRowKey.split('__');
            if (parts.length < 4) return;
            const [month, workerId] = parts;
            const key = `${month}__${workerId}__${salaryModel}`;
            const list = grouped.get(key) ?? [];
            list.push(manual as LedgerUtilityInputLike);
            grouped.set(key, list);
        });

        const singleMap = new Map<string, LedgerUtilityInputLike>();
        grouped.forEach((list, key) => {
            if (list.length === 1) {
                singleMap.set(key, list[0]);
            }
        });

        return singleMap;
    }, [ledgerInputs]);

    const mergeUtilityInput = useCallback((left: LedgerUtilityInputLike, right: LedgerUtilityInputLike): LedgerUtilityInputLike => {
        const mergeSide = (side: 'invoice' | 'labor') => ({
            ...left[side],
            ...right[side],
            lodging: toNumber(left[side]?.lodging) + toNumber(right[side]?.lodging),
            electricity: toNumber(left[side]?.electricity) + toNumber(right[side]?.electricity),
            gas: toNumber(left[side]?.gas) + toNumber(right[side]?.gas),
            water: toNumber(left[side]?.water) + toNumber(right[side]?.water),
            internet: toNumber(left[side]?.internet) + toNumber(right[side]?.internet),
            management: toNumber(left[side]?.management) + toNumber(right[side]?.management),
            fine: toNumber(left[side]?.fine) + toNumber(right[side]?.fine),
            other: toNumber(left[side]?.other) + toNumber(right[side]?.other),
        });

        return {
            ...left,
            ...right,
            invoice: mergeSide('invoice'),
            labor: mergeSide('labor'),
        };
    }, []);

    const resolveUtilityInputForPaymentItem = useCallback((item: PaymentData): LedgerUtilityInputLike | undefined => {
        const itemSalaryModel = item.id.endsWith('__일급제') ? '일급제' : item.id.endsWith('__용역팀') ? '용역팀' : '월급제';
        const itemRowKey = item.id;
        const direct = itemRowKey ? (ledgerInputsRef.current[itemRowKey] as LedgerUtilityInputLike | undefined) : undefined;
        const mapped = itemRowKey ? utilityInputByPaymentRowKeyRef.current.get(itemRowKey) : undefined;

        // 동일 행의 direct 입력이 있으면 우선 사용 (mapped와 합치면 2배 합산이 발생할 수 있음)
        if (direct) return direct;
        if (mapped) return mapped;

        const itemTeamNormalized = normalizeTeamNameRef.current(item.teamName);
        const monthWorkerKey = `${item.month}__${item.workerId}__${itemSalaryModel}`;
        const singleFallback = utilityInputByWorkerMonthSingleRef.current.get(monthWorkerKey);

        const monthWorkerEntries = Object.entries(ledgerInputsRef.current)
            .filter(([ledgerRowKey]) => ledgerRowKey.endsWith(`__${itemSalaryModel}`))
            .filter(([ledgerRowKey]) => {
                const parts = ledgerRowKey.split('__');
                if (parts.length < 4) return false;
                const [month, workerId] = parts;
                return month === item.month && workerId === item.workerId;
            })
            .map(([ledgerRowKey, manual]) => {
                const ledgerRow = ledgerRowsDataRef.current.find((row) => row.rowKey === ledgerRowKey);
                return {
                    team: normalizeTeamNameRef.current(ledgerRow?.teamName),
                    input: manual as LedgerUtilityInputLike,
                };
            });

        const teamMatchedInputs = monthWorkerEntries
            .filter((entry) => !itemTeamNormalized || !entry.team || entry.team === itemTeamNormalized)
            .map((entry) => entry.input);

        if (teamMatchedInputs.length > 1) {
            return teamMatchedInputs.reduce((acc, cur) => mergeUtilityInputRef.current(acc, cur));
        }

        if (teamMatchedInputs.length === 1) {
            return teamMatchedInputs[0];
        }

        if (singleFallback) {
            return singleFallback;
        }

        const paymentRows = (basePaymentDataRef.current.length > 0 ? basePaymentDataRef.current : paymentDataRef.current)
            .filter((row) => row.month === item.month && row.workerId === item.workerId);

        if (paymentRows.length === 1 && monthWorkerEntries.length > 0) {
            return monthWorkerEntries
                .map((entry) => entry.input)
                .reduce((acc, cur) => mergeUtilityInputRef.current(acc, cur));
        }

        return undefined;
    }, []);

    const payslipTarget = useMemo(() => {
        if (filteredPaymentData.length === 0) return null;
        const defaultTarget = filteredPaymentData.find((item) => item.id.endsWith('__월급제')) ?? filteredPaymentData[0];
        const targetKey = selectedPayslipRowKey || defaultTarget.id;
        const target = filteredPaymentData.find((item) => item.id === targetKey) ?? defaultTarget;
        return target;
    }, [filteredPaymentData, selectedPayslipRowKey]);

    useEffect(() => {
        let mounted = true;
        const fetchInitialData = async () => {
            try {
                const [fetchedTeams, fetchedWorkers, fetchedCompanies, fetchedSites] = await Promise.all([
                    teamService.getTeams(),
                    manpowerService.getWorkers(),
                    companyService.getCompanies(),
                    siteService.getSites(),
                ]);
                if (!mounted) return;
                setAllTeams(fetchedTeams);
                setAllWorkers(fetchedWorkers);
                setCompanies(fetchedCompanies);
                setAllSites(fetchedSites);
            } catch (error) {
                if (!mounted) return;
                console.error('Failed to load initial data:', error);
                alert('초기 데이터를 불러오는 중 오류가 발생했습니다.');
            } finally {
                if (mounted) {
                    setFiltersReady(true);
                }
            }
        };

        void fetchInitialData();
        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        let mounted = true;
        const loadPayrollConfig = async () => {
            try {
                const config = await payrollConfigService.getConfig();
                if (!mounted) return;
                setDeductionLabelMap(buildDeductionLabelMapFromConfig(config?.deductionItems));
                setPayrollConfig(config);
            } catch (error) {
                console.error('Failed to load payroll deduction config:', error);
            }
        };

        void loadPayrollConfig();
        return () => {
            mounted = false;
        };
    }, []);

    const openInsuranceSettings = useCallback(() => {
        const config = payrollConfig;
        const insurance = config?.insuranceConfig;

        setInsuranceThresholdManDayInput(String(insurance?.thresholdDays ?? 8));
        setPensionRatePercentInput(String(Math.round(((insurance?.pensionRate ?? 0.045) * 10000)) / 100));
        setHealthRatePercentInput(String(Math.round(((insurance?.healthRate ?? 0.03545) * 100000)) / 1000));
        setCareRateOfHealthPercentInput(String(Math.round(((insurance?.careRateOfHealth ?? 0.1295) * 100000)) / 1000));
        setEmploymentRatePercentInput(String(Math.round(((insurance?.employmentRate ?? 0.009) * 100000)) / 1000));
        setDailyWorkerFeePerManDayInput(String(Math.floor(toNumber(insurance?.dailyWorkerFeePerManDay ?? 0))));
        setWithholdingBaseDeductionInput(String(Math.floor(toNumber(insurance?.withholdingBaseDeduction ?? 150000))));
        setWithholdingIncomeBaseMultiplierPercentInput(
            String(Math.round((toNumber(insurance?.withholdingIncomeBaseMultiplier ?? 0.55) * 10000)) / 100)
        );
        setIncomeTaxRatePercentInput(
            String(Math.round((toNumber(insurance?.withholdingIncomeTaxRate ?? config?.incomeTaxRate ?? 0.06) * 10000)) / 100)
        );
        setResidentTaxRatePercentInput(
            String(Math.round((toNumber(insurance?.withholdingResidentTaxRate ?? config?.residentTaxRate ?? 0.1) * 10000)) / 100)
        );
        setWithholdingApplyAllLaborInput(
            typeof insurance?.withholdingApplyAllLabor === 'boolean' ? insurance.withholdingApplyAllLabor : true
        );
        setEmploymentApplyBelowThresholdInput(
            typeof insurance?.employmentApplyBelowThreshold === 'boolean' ? insurance.employmentApplyBelowThreshold : true
        );

        setShowInsuranceSettings(true);
    }, [payrollConfig]);

    // useRef로 최신 상태 액세스 - 의존성 없이 항상 최신값 사용
    const basePaymentDataRef = React.useRef(basePaymentData);
    const paymentDataRef = React.useRef(paymentData);
    // 세금 계산 결과 영속 캐시 - basePaymentData 교체 시 초기화
    const persistentTaxCacheRef = React.useRef<Map<string, any>>(new Map());
    // 연속 토글 디바운스 타이머
    const applyDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const payrollConfigRef = React.useRef(payrollConfig);
    const normalizeTeamNameRef = React.useRef(normalizeTeamName);
    const buildUtilityDeductionLinesRef = React.useRef(buildVisibleUtilityDeductionLines);
    const mergeDeductionBreakdownWithLinesRef = React.useRef(mergeDeductionBreakdownWithLines);
    const calculateWorkEntryTaxBreakdownRef = React.useRef(calculateWorkEntryTaxBreakdown);
    const rebuildDeductionBreakdownRef = React.useRef(rebuildDeductionBreakdown);
    const stripTemporaryDeductionLinesRef = React.useRef(stripTemporaryDeductionLines);
    const stripTemporaryTaxLinesRef = React.useRef(stripTemporaryTaxLines);
    const ledgerInputsRef = React.useRef(ledgerInputs);
    const ledgerRowsDataRef = React.useRef(ledgerRowsData);
    const utilityInputByPaymentRowKeyRef = React.useRef(utilityInputByPaymentRowKey);
    const utilityInputByWorkerMonthSingleRef = React.useRef(utilityInputByWorkerMonthSingle);
    const mergeUtilityInputRef = React.useRef(mergeUtilityInput);

    const clearApplyWatchdog = useCallback(() => {
        if (applyWatchdogRef.current !== null) {
            clearTimeout(applyWatchdogRef.current);
            applyWatchdogRef.current = null;
        }
    }, []);

    const markApplyStarted = useCallback((seq: number) => {
        setDeductionApplyInProgress(true);
        clearApplyWatchdog();
        // 비정상 루프가 생겨도 오버레이가 영구 고정되지 않도록 최대 표시시간을 둔다.
        applyWatchdogRef.current = setTimeout(() => {
            if (applyRunSeqRef.current === seq) {
                setDeductionApplyInProgress(false);
            }
            applyWatchdogRef.current = null;
        }, 15000);
    }, [clearApplyWatchdog]);

    const markApplyFinished = useCallback((seq: number) => {
        if (applyRunSeqRef.current !== seq) return;
        clearApplyWatchdog();
        setDeductionApplyInProgress(false);
    }, [clearApplyWatchdog]);

    React.useEffect(() => {
        // basePaymentData 참조가 달라지면(새 조회) 세금 캐시를 초기화한다
        if (basePaymentDataRef.current !== basePaymentData) {
            persistentTaxCacheRef.current.clear();
        }
        basePaymentDataRef.current = basePaymentData;
        paymentDataRef.current = paymentData;
        payrollConfigRef.current = payrollConfig;
        normalizeTeamNameRef.current = normalizeTeamName;
        buildUtilityDeductionLinesRef.current = buildVisibleUtilityDeductionLines;
        mergeDeductionBreakdownWithLinesRef.current = mergeDeductionBreakdownWithLines;
        calculateWorkEntryTaxBreakdownRef.current = calculateWorkEntryTaxBreakdown;
        rebuildDeductionBreakdownRef.current = rebuildDeductionBreakdown;
        stripTemporaryDeductionLinesRef.current = stripTemporaryDeductionLines;
        stripTemporaryTaxLinesRef.current = stripTemporaryTaxLines;
        ledgerInputsRef.current = ledgerInputs;
        ledgerRowsDataRef.current = ledgerRowsData;
        utilityInputByPaymentRowKeyRef.current = utilityInputByPaymentRowKey;
        utilityInputByWorkerMonthSingleRef.current = utilityInputByWorkerMonthSingle;
        mergeUtilityInputRef.current = mergeUtilityInput;
    }, [basePaymentData, paymentData, payrollConfig, normalizeTeamName, ledgerInputs, ledgerRowsData, utilityInputByPaymentRowKey, utilityInputByWorkerMonthSingle, mergeUtilityInput]);

    React.useEffect(() => {
        return () => {
            if (applyDebounceRef.current !== null) {
                clearTimeout(applyDebounceRef.current);
                applyDebounceRef.current = null;
            }
            clearApplyWatchdog();
        };
    }, [clearApplyWatchdog]);

    const applyCalculatedDeductions = useCallback((params: {
        applyInsurance: boolean;
        applyBusinessIncome: boolean;
        applyUtilities: boolean;
        applyDailyFee: boolean;
        applyInsuranceTeamSiteOnly: boolean;
        immediate?: boolean;
    }) => {
        const effectiveApplyUtilities = true;
        const config = payrollConfigRef.current;
        if ((params.applyInsurance || params.applyBusinessIncome || params.applyDailyFee) && !config) {
            alert('설정(4대보험/세율)을 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
            return;
        }

        const runSeq = applyRunSeqRef.current + 1;
        applyRunSeqRef.current = runSeq;
        markApplyStarted(runSeq);

        if (applyDebounceRef.current !== null) {
            clearTimeout(applyDebounceRef.current);
            applyDebounceRef.current = null;
        }

        const delay = params.immediate ? 0 : 150;
        applyDebounceRef.current = setTimeout(() => {
            if (runSeq !== applyRunSeqRef.current) return;
            applyDebounceRef.current = null;

            try {
                const basePD = basePaymentDataRef.current.length > 0 ? basePaymentDataRef.current : paymentDataRef.current;
                const ledgerInputsMap = ledgerInputsRef.current;
                const dailyFeePerManDay = Math.max(0, Math.floor(toNumber(config?.insuranceConfig?.dailyWorkerFeePerManDay ?? 0)));

                const ledgerEntriesMergedByMonthWorker = new Map<string, { team: string | undefined, input: any }[]>();
                Object.entries(ledgerInputsMap).forEach(([ledgerRowKey, manual]) => {
                    const parts = ledgerRowKey.split('__');
                    if (parts.length < 4) return;
                    const [month, workerId, , salaryModelStr] = parts;
                    const ledgerRow = ledgerRowsDataRef.current.find((row) => row.rowKey === ledgerRowKey);
                    const team = normalizeTeamNameRef.current(ledgerRow?.teamName);

                    const groupKey = `${month}__${workerId}__${salaryModelStr}`;
                    let group = ledgerEntriesMergedByMonthWorker.get(groupKey);
                    if (!group) {
                        group = [];
                        ledgerEntriesMergedByMonthWorker.set(groupKey, group);
                    }
                    group.push({ team, input: manual });
                });

                const paymentRowsCountByMonthWorker = new Map<string, number>();
                basePD.forEach((row) => {
                    const key = `${row.month}__${row.workerId}`;
                    paymentRowsCountByMonthWorker.set(key, (paymentRowsCountByMonthWorker.get(key) || 0) + 1);
                });

                const taxCache = persistentTaxCacheRef.current;

                const newPaymentData = basePD.map((item) => {
                    const sourceDeductionBreakdownRaw = stripTemporaryDeductionLinesRef.current(item.deductionBreakdown);
                    const baseTaxBreakdown = stripTemporaryTaxLinesRef.current(item.taxBreakdown);

                    const itemRowKey = item.id;
                    const direct = itemRowKey ? (ledgerInputsMap[itemRowKey] as any) : undefined;
                    const mapped = itemRowKey ? utilityInputByPaymentRowKeyRef.current.get(itemRowKey) : undefined;

                    let utilityInput: any = undefined;
                    if (direct) {
                        utilityInput = direct;
                    } else if (mapped) {
                        utilityInput = mapped;
                    } else {
                        const itemSalaryModel = item.id.endsWith('__일급제') ? '일급제' : '월급제';
                        const itemTeamNormalized = normalizeTeamNameRef.current(item.teamName);
                        const monthWorkerKey = `${item.month}__${item.workerId}__${itemSalaryModel}`;
                        const singleFallback = utilityInputByWorkerMonthSingleRef.current.get(monthWorkerKey);

                        const monthWorkerEntries = ledgerEntriesMergedByMonthWorker.get(monthWorkerKey) || [];

                        const teamMatchedInputs = monthWorkerEntries
                            .filter((entry) => !itemTeamNormalized || !entry.team || entry.team === itemTeamNormalized)
                            .map((entry) => entry.input);

                        if (teamMatchedInputs.length > 1) {
                            utilityInput = teamMatchedInputs.reduce((acc, cur) => mergeUtilityInputRef.current(acc, cur));
                        } else if (teamMatchedInputs.length === 1) {
                            utilityInput = teamMatchedInputs[0];
                        } else if (singleFallback) {
                            utilityInput = singleFallback;
                        } else {
                            const pRowsCount = paymentRowsCountByMonthWorker.get(`${item.month}__${item.workerId}`) || 0;
                            if (pRowsCount === 1 && monthWorkerEntries.length > 0) {
                                utilityInput = monthWorkerEntries
                                    .map((entry) => entry.input)
                                    .reduce((acc, cur) => mergeUtilityInputRef.current(acc, cur));
                            }
                        }
                    }

                    const utilityLines = effectiveApplyUtilities && utilityInput
                        ? buildUtilityDeductionLinesRef.current(utilityInput)
                        : [];
                    const dailyFeeLines = buildDailyFeeDeductionLines({
                        item,
                        applyDailyFee: params.applyDailyFee,
                        dailyFeePerManDay,
                    });
                    const deductionAppliedLines = [...utilityLines, ...dailyFeeLines];
                    const sourceDeductionBreakdown = ensureAdvanceLinesInBreakdown(
                        sourceDeductionBreakdownRaw,
                        utilityInput,
                        config
                    );
                    const rebasedDeductionBreakdown = rebuildDeductionBreakdownRef.current({
                        standardLines: (sourceDeductionBreakdown.standardLines ?? []).filter((line: DeductionLine) => !isAppliedUtilityOrFeeLabel(String(line.label ?? '').trim())),
                        additionalLines: (sourceDeductionBreakdown.additionalLines ?? []).filter((line: DeductionLine) => !isAppliedUtilityOrFeeLabel(String(line.label ?? '').trim())),
                    });

                    const nextDeductionBreakdown = (effectiveApplyUtilities || params.applyDailyFee)
                        ? mergeDeductionBreakdownWithLinesRef.current(rebasedDeductionBreakdown, deductionAppliedLines)
                        : sourceDeductionBreakdown;

                    let nextTaxBreakdown = rebuildDeductionBreakdownRef.current({
                        standardLines: [],
                        additionalLines: [...(baseTaxBreakdown.additionalLines ?? [])],
                    });
                    let taxRateSnapshot: any = undefined;
                    let insuranceAppliedSummary: any = undefined;
                    let withholdingAppliedSummary: any = undefined;
                    let businessIncomeAppliedSummary: any = undefined;

                    if (config && (params.applyInsurance || params.applyBusinessIncome)) {
                        const entriesLen = item.workEntries?.length ?? 0;
                        const cacheKey = `${item.workerId}__${item.month}__${entriesLen}__${params.applyInsurance}__${params.applyBusinessIncome}__${params.applyInsuranceTeamSiteOnly}__${params.applyInsuranceTeamSiteOnly ? (item.teamId ?? '') : ''}`;

                        let calculatedTax = taxCache.get(cacheKey);
                        if (!calculatedTax) {
                            calculatedTax = calculateWorkEntryTaxBreakdownRef.current({
                                workEntries: item.workEntries ?? [],
                                payrollConfig: config,
                                applyInsurance: params.applyInsurance,
                                applyBusinessIncome: params.applyBusinessIncome,
                                normalizeSiteName: normalizeTeamNameRef.current,
                                withholdingThreshold: WITHHOLDING_MAX_MAN_DAY,
                                isInsuranceEligibleEntry: params.applyInsuranceTeamSiteOnly
                                    ? (entry) => isEntryInWorkerTeamSite(entry, item.teamId, item.teamName)
                                    : undefined,
                            });
                            taxCache.set(cacheKey, calculatedTax);
                        }

                        nextTaxBreakdown = rebuildDeductionBreakdownRef.current({
                            standardLines: [],
                            additionalLines: [...(baseTaxBreakdown.additionalLines ?? []), ...calculatedTax.taxAdditionalLines],
                        });
                        taxRateSnapshot = calculatedTax.taxRateSnapshot;
                        insuranceAppliedSummary = calculatedTax.insuranceAppliedSummary;
                        withholdingAppliedSummary = calculatedTax.withholdingAppliedSummary;
                        businessIncomeAppliedSummary = calculatedTax.businessIncomeAppliedSummary;
                    }

                    const nextTotalDeduction = nextDeductionBreakdown.total + nextTaxBreakdown.total;
                    const nextTotalAmount = item.grossAmount - nextTotalDeduction;

                    if (
                        item.totalDeduction === nextTotalDeduction &&
                        item.totalAmount === nextTotalAmount &&
                        item.deductionBreakdown === nextDeductionBreakdown &&
                        item.taxBreakdown === nextTaxBreakdown &&
                        item.taxRateSnapshot === taxRateSnapshot &&
                        item.insuranceAppliedSummary === insuranceAppliedSummary &&
                        item.withholdingAppliedSummary === withholdingAppliedSummary &&
                        item.businessIncomeAppliedSummary === businessIncomeAppliedSummary
                    ) {
                        return item;
                    }

                    return {
                        ...item,
                        deductionBreakdown: nextDeductionBreakdown,
                        taxBreakdown: nextTaxBreakdown,
                        taxRateSnapshot,
                        insuranceAppliedSummary,
                        withholdingAppliedSummary,
                        businessIncomeAppliedSummary,
                        totalDeduction: nextTotalDeduction,
                        totalAmount: nextTotalAmount,
                    };
                });

                if (runSeq !== applyRunSeqRef.current) return;

                setPaymentData(newPaymentData);
                setInsuranceApplied(params.applyInsurance);
                setInsuranceTeamSiteOnly(params.applyInsuranceTeamSiteOnly);
                setBusinessIncomeApplied(params.applyBusinessIncome);
                setUtilitiesApplied(effectiveApplyUtilities);
                setDailyFeeApplied(params.applyDailyFee);

                requestAnimationFrame(() => {
                    setTimeout(() => {
                        markApplyFinished(runSeq);
                    }, 0);
                });
            } catch (error) {
                console.error('Failed to apply calculated deductions:', error);
                markApplyFinished(runSeq);
            }
        }, delay);
    }, [
        isEntryInWorkerTeamSite,
        markApplyFinished,
        markApplyStarted,
        setPaymentData,
    ]);

    const payslipContractorOptions = useMemo(() => {
        const names = new Set<string>(DEFAULT_PAYSLIP_CONTRACTOR_OPTIONS);
        companies.forEach((company) => {
            if (normalizeValue(company.type) !== '시공사') return;
            const name = String(company.name ?? '').trim();
            if (name) names.add(name);
        });
        return Array.from(names);
    }, [companies, normalizeValue]);

    const resolvedPayslipContractorName = useMemo(() => {
        if (payslipContractorOption === CUSTOM_PAYSLIP_CONTRACTOR_VALUE) {
            return customPayslipContractorName.trim() || DEFAULT_PAYSLIP_CONTRACTOR_NAME;
        }
        return payslipContractorOption.trim() || DEFAULT_PAYSLIP_CONTRACTOR_NAME;
    }, [customPayslipContractorName, payslipContractorOption]);

    const openPayslipPreview = useCallback(() => {
        if (filteredPaymentData.length === 0) return;

        // 명세서 모달 오픈 직전 최신 공제/세금 상태를 강제로 반영해 미리보기 표시와 계산값을 동기화한다.
        if (filteredPaymentData.length === 0) return;

        // 명세서 모달 오픈 직전 최신 공제/세금 상태를 강제로 반영해 미리보기 표시와 계산값을 동기화한다.
        if (insuranceApplied || businessIncomeApplied || utilitiesApplied || dailyFeeApplied) {
            applyCalculatedDeductions({
                applyInsurance: insuranceApplied,
                applyBusinessIncome: businessIncomeApplied,
                applyUtilities: utilitiesApplied,
                applyDailyFee: dailyFeeApplied,
                applyInsuranceTeamSiteOnly: insuranceTeamSiteOnly,
                immediate: true, // 모달 오픈 전 즉시 반영
            });
        }

        const defaultTarget = filteredPaymentData.find((item) => item.id.endsWith('__월급제')) ?? filteredPaymentData[0];
        setSelectedPayslipRowKey(defaultTarget.id);
        setShowPayslipModal(true);
    }, [
        applyCalculatedDeductions,
        businessIncomeApplied,
        dailyFeeApplied,
        filteredPaymentData,
        insuranceApplied,
        insuranceTeamSiteOnly,
        utilitiesApplied,
    ]);

    const resolvedPayslipTarget = useMemo(() => {
        if (!payslipTarget) return null;
        // 확정본은 현재 공제 옵션을 다시 적용하지 않는다.
        if (finalizedSnapshotByPaymentId.has(payslipTarget.id)) return payslipTarget;
        if (!utilitiesApplied && !dailyFeeApplied) return payslipTarget;

        const baseRows = basePaymentData.length > 0 ? basePaymentData : paymentData;
        const payslipRowKey = payslipTarget.id;
        const baseItem = payslipRowKey
            ? baseRows.find((item) => item.id === payslipRowKey)
            : baseRows.find((item) => (
                item.month === payslipTarget.month
                && item.workerId === payslipTarget.workerId
                && normalizeTeamName(item.teamName) === normalizeTeamName(payslipTarget.teamName)
            ));

        // 기준 원본 행을 찾지 못하면 현재 계산값을 그대로 사용해 중복 병합을 방지한다.
        if (!baseItem) {
            return payslipTarget;
        }

        const utilityInput = resolveUtilityInputForPaymentItem(payslipTarget);

        const utilityLines = utilitiesApplied ? buildVisibleUtilityDeductionLines(utilityInput) : [];
        const dailyFeePerManDay = Math.max(0, Math.floor(toNumber(payrollConfig?.insuranceConfig?.dailyWorkerFeePerManDay ?? 0)));
        const dailyFeeLines = buildDailyFeeDeductionLines({
            item: payslipTarget,
            applyDailyFee: dailyFeeApplied,
            dailyFeePerManDay,
        });
        const deductionAppliedLines = [...utilityLines, ...dailyFeeLines];
            const sourceDeductionBreakdownRaw = stripTemporaryDeductionLines(baseItem.deductionBreakdown);
            const sourceDeductionBreakdown = ensureAdvanceLinesInBreakdown(
                sourceDeductionBreakdownRaw,
                utilityInput,
                payrollConfig
            );
            const baseDeductionBreakdown = rebuildDeductionBreakdown({
                standardLines: (sourceDeductionBreakdown.standardLines ?? []).filter((line: DeductionLine) => !isAppliedUtilityOrFeeLabel(String(line.label ?? '').trim())),
                additionalLines: (sourceDeductionBreakdown.additionalLines ?? []).filter((line: DeductionLine) => !isAppliedUtilityOrFeeLabel(String(line.label ?? '').trim())),
        });
        const nextDeductionBreakdown = mergeDeductionBreakdownWithLines(baseDeductionBreakdown, deductionAppliedLines);
        const nextTaxBreakdown = rebuildDeductionBreakdown({
            standardLines: [...(payslipTarget.taxBreakdown?.standardLines ?? [])],
            additionalLines: [...(payslipTarget.taxBreakdown?.additionalLines ?? [])],
        });
        const nextTotalDeduction = nextDeductionBreakdown.total + nextTaxBreakdown.total;
        const nextTotalAmount = payslipTarget.grossAmount - nextTotalDeduction;

        return {
            ...payslipTarget,
            deductionBreakdown: nextDeductionBreakdown,
            taxBreakdown: nextTaxBreakdown,
            totalDeduction: nextTotalDeduction,
            totalAmount: nextTotalAmount,
        };
    }, [
        basePaymentData,
        dailyFeeApplied,
        finalizedSnapshotByPaymentId,
        normalizeTeamName,
        paymentData,
        payrollConfig,
        payslipTarget,
        resolveUtilityInputForPaymentItem,
        utilitiesApplied,
    ]);

    const payslipIssueSummary = useMemo<PayslipIssueSummary>(
        () => validateMonthlyPayslipRows(filteredPaymentData),
        [filteredPaymentData]
    );

    const selectedPayslipIssueSummary = useMemo<PayslipIssueSummary>(
        () => validateMonthlyPayslipRows(resolvedPayslipTarget ? [resolvedPayslipTarget] : []),
        [resolvedPayslipTarget]
    );

    const selectedPayslipOutputId = resolvedPayslipTarget ? (payslipOutputIds[resolvedPayslipTarget.id] ?? '') : '';

    const ensurePayslipIssueReady = useCallback((rows: PaymentData[], actionLabel: string): boolean => {
        const summary = validateMonthlyPayslipRows(rows);
        const topIssues = summary.issues.slice(0, 8).map(getPayslipIssueLabel).join('\n');

        if (summary.errorCount > 0) {
            alert([
                `${actionLabel} 전에 오류 ${summary.errorCount}건을 먼저 수정해야 합니다.`,
                topIssues,
            ].filter(Boolean).join('\n\n'));
            return false;
        }

        if (summary.warningCount > 0) {
            return window.confirm([
                `${actionLabel} 전 확인이 필요한 항목 ${summary.warningCount}건이 있습니다. 계속 진행할까요?`,
                topIssues,
            ].filter(Boolean).join('\n\n'));
        }

        return true;
    }, []);

    const buildPayslipOutputRecord = useCallback((
        item: PaymentData,
        deliveryMethod: 'confirm' | 'reissue' | 'image' | 'excel' | 'batch' | 'print'
    ): StatementOutputRecord => {
        const outputItem = {
            ...item,
            companyName: resolvedPayslipContractorName,
        };
        const validationSummary = validateMonthlyPayslipRows([outputItem]);
        const snapshot = buildMonthlyPayslipSnapshot(outputItem, {
            deliveryMethod,
            validationSummary,
            context: {
                rangeLabel,
                teamLabel: selectedTeamLabel,
                insuranceApplied,
                insuranceTeamSiteOnly,
                businessIncomeApplied,
                utilitiesApplied,
                dailyFeeApplied,
            },
        });

        return {
            source: 'monthly-wage',
            kind: 'labor',
            status: 'afterIssue',
            yearMonth: item.month,
            statementKey: item.id,
            targetTitle: item.workerName || '작업자',
            targetSubtitle: `${item.teamName || '-'} · ${item.month || '-'}`,
            clientCompanyName: resolvedPayslipContractorName || undefined,
            teamName: item.teamName || undefined,
            documentTitle: '월급제 노임명세서',
            payrollRunId: finalizedSnapshotByPaymentId.get(item.id)?.settlementId || undefined,
            amountSummary: {
                manDay: item.totalManDay,
                supplyAmount: item.grossAmount,
                totalAmount: item.totalAmount,
            },
            optionPreset: 'afterIssue',
            optionSnapshot: {
                ruleVersion: PAYSLIP_ISSUE_RULE_VERSION,
                deliveryMethod,
                insuranceApplied,
                insuranceTeamSiteOnly,
                businessIncomeApplied,
                utilitiesApplied,
                dailyFeeApplied,
            },
            snapshot,
            issuedAt: new Date().toISOString(),
        };
    }, [
        businessIncomeApplied,
        dailyFeeApplied,
        finalizedSnapshotByPaymentId,
        insuranceApplied,
        insuranceTeamSiteOnly,
        rangeLabel,
        resolvedPayslipContractorName,
        selectedTeamLabel,
        utilitiesApplied,
    ]);

    const recordPayslipOutput = useCallback(async (
        item: PaymentData,
        deliveryMethod: 'confirm' | 'reissue' | 'image' | 'excel' | 'batch' | 'print'
    ) => {
        const id = await statementOutputService.upsertOutput(buildPayslipOutputRecord(item, deliveryMethod));
        setPayslipOutputIds((prev) => ({ ...prev, [item.id]: id }));
        setPayslipIssueMessage(`${item.workerName || '작업자'} 명세서 발행 이력을 문서대장에 기록했습니다.`);
        return id;
    }, [buildPayslipOutputRecord]);

    const handleIssueCurrentPayslip = useCallback(async () => {
        if (!resolvedPayslipTarget) return;
        const method = selectedPayslipOutputId ? 'reissue' : 'confirm';
        const actionLabel = selectedPayslipOutputId ? '재발행 기록' : '발행 확정';
        if (!ensurePayslipIssueReady([resolvedPayslipTarget], actionLabel)) return;

        setIssuingPayslip(true);
        try {
            await recordPayslipOutput(resolvedPayslipTarget, method);
        } catch (error) {
            console.error('[MonthlyWageDraftPage] payslip output save failed:', error);
            alert('명세서 발행 이력 저장 중 오류가 발생했습니다.');
        } finally {
            setIssuingPayslip(false);
        }
    }, [
        ensurePayslipIssueReady,
        recordPayslipOutput,
        resolvedPayslipTarget,
        selectedPayslipOutputId,
    ]);

    const printPayslipRows = useCallback(async (rows: PaymentData[], actionLabel: string, fileName: string) => {
        if (rows.length === 0 || preparingPayslipPrint) return;
        if (!ensurePayslipIssueReady(rows, actionLabel)) return;

        setPreparingPayslipPrint(true);
        setPayslipPrintRows(rows);

        const originalTitle = document.title;
        try {
            // 인쇄 전용 React 트리와 웹폰트가 실제 DOM에 반영된 다음 인쇄 대화상자를 연다.
            await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
            if (document.fonts?.ready) {
                await document.fonts.ready;
            }
            document.title = fileName;
            window.print();
        } finally {
            document.title = originalTitle;
            setPayslipPrintRows([]);
            setPreparingPayslipPrint(false);
        }
    }, [ensurePayslipIssueReady, preparingPayslipPrint]);

    const handlePrintPayslip = useCallback(() => {
        if (!resolvedPayslipTarget) return;
        const safeWorkerName = (resolvedPayslipTarget.workerName || '작업자').replace(/[\\/:*?"<>|]/g, '_');
        void printPayslipRows(
            [resolvedPayslipTarget],
            '개별 PDF',
            `노임명세서_${safeWorkerName}_${resolvedPayslipTarget.month}`
        );
    }, [printPayslipRows, resolvedPayslipTarget]);

    const handleBatchPrintPayslips = useCallback(() => {
        if (filteredPaymentData.length === 0) {
            alert('인쇄할 명세서가 없습니다.');
            return;
        }
        if (
            filteredPaymentData.length > 50
            && !window.confirm(`총 ${filteredPaymentData.length}명의 명세서를 인쇄합니다. 계속 진행하시겠습니까?`)
        ) {
            return;
        }

        void printPayslipRows(
            filteredPaymentData,
            '일괄 PDF',
            `노임명세서_일괄_${rangeLabel || currentYearMonth}`
        );
    }, [currentYearMonth, filteredPaymentData, printPayslipRows, rangeLabel]);

    const handleSaveInsuranceSettings = useCallback(async () => {
        const config = payrollConfig;
        if (!config) return;

        const thresholdDays = Math.floor(Number(insuranceThresholdManDayInput));
        if (!Number.isFinite(thresholdDays) || thresholdDays <= 0) {
            alert('보험 적용 기준 공수는 1 이상의 숫자여야 합니다.');
            return;
        }

        const pensionPercent = Number(pensionRatePercentInput);
        const healthPercent = Number(healthRatePercentInput);
        const carePercent = Number(careRateOfHealthPercentInput);
        const employmentPercent = Number(employmentRatePercentInput);
        const dailyWorkerFeePerManDay = Math.floor(Number(dailyWorkerFeePerManDayInput));
        const incomeTaxPercent = Number(incomeTaxRatePercentInput);
        const residentTaxPercent = Number(residentTaxRatePercentInput);
        const withholdingBaseDeductionWon = Math.floor(Number(withholdingBaseDeductionInput));
        const withholdingIncomeBaseMultiplierPercent = Number(withholdingIncomeBaseMultiplierPercentInput);

        const percentValues = [
            pensionPercent,
            healthPercent,
            carePercent,
            employmentPercent,
            incomeTaxPercent,
            residentTaxPercent,
            withholdingIncomeBaseMultiplierPercent,
        ];
        if (percentValues.some((v) => !Number.isFinite(v) || v < 0)) {
            alert('요율은 0 이상의 숫자여야 합니다.');
            return;
        }
        if (!Number.isFinite(withholdingBaseDeductionWon) || withholdingBaseDeductionWon < 0) {
            alert('갑근세 단가 공제기준은 0 이상의 숫자여야 합니다.');
            return;
        }
        if (!Number.isFinite(dailyWorkerFeePerManDay) || dailyWorkerFeePerManDay < 0) {
            alert('일급제 수수료 공수당 금액은 0 이상의 숫자여야 합니다.');
            return;
        }

        const nextInsurance: PayrollInsuranceConfig = {
            thresholdDays,
            pensionRate: pensionPercent / 100,
            healthRate: healthPercent / 100,
            careRateOfHealth: carePercent / 100,
            employmentRate: employmentPercent / 100,
            dailyWorkerFeePerManDay,
            withholdingBaseDeduction: withholdingBaseDeductionWon,
            withholdingIncomeBaseMultiplier: withholdingIncomeBaseMultiplierPercent / 100,
            withholdingIncomeTaxRate: incomeTaxPercent / 100,
            withholdingResidentTaxRate: residentTaxPercent / 100,
            withholdingApplyAllLabor: withholdingApplyAllLaborInput,
            employmentApplyBelowThreshold: employmentApplyBelowThresholdInput,
        };

        setInsuranceConfigSaving(true);
        try {
            await payrollConfigService.saveConfig({
                ...config,
                insuranceConfig: nextInsurance,
            });
            const latest = await payrollConfigService.getConfigFromServer();
            setPayrollConfig(latest);
            setDeductionLabelMap(buildDeductionLabelMapFromConfig(latest?.deductionItems));
            setShowInsuranceSettings(false);

            if (insuranceApplied || businessIncomeApplied || utilitiesApplied || dailyFeeApplied) {
                applyCalculatedDeductions({
                    applyInsurance: insuranceApplied,
                    applyBusinessIncome: businessIncomeApplied,
                    applyUtilities: utilitiesApplied,
                    applyDailyFee: dailyFeeApplied,
                    applyInsuranceTeamSiteOnly: insuranceTeamSiteOnly,
                    immediate: true, // 설정 저장 후 즉시 반영
                });
            }
        } catch (error) {
            console.error('Failed to save insurance settings:', error);
            alert('설정 저장 중 오류가 발생했습니다.');
        } finally {
            setInsuranceConfigSaving(false);
        }
    }, [
        applyCalculatedDeductions,
        businessIncomeApplied,
        careRateOfHealthPercentInput,
        dailyFeeApplied,
        dailyWorkerFeePerManDayInput,
        employmentApplyBelowThresholdInput,
        employmentRatePercentInput,
        healthRatePercentInput,
        incomeTaxRatePercentInput,
        insuranceApplied,
        insuranceTeamSiteOnly,
        insuranceThresholdManDayInput,
        payrollConfig,
        pensionRatePercentInput,
        residentTaxRatePercentInput,
        utilitiesApplied,
        withholdingApplyAllLaborInput,
        withholdingBaseDeductionInput,
        withholdingIncomeBaseMultiplierPercentInput,
    ]);

    const constructionCompanyIds = useMemo(() => {
        const ids = new Set<string>();
        companies.forEach((company) => {
            const id = (company.id ?? '').trim();
            if (!id) return;
            if (normalizeValue(company.type) !== '시공사') return;
            ids.add(id);
        });
        return ids;
    }, [companies, normalizeValue]);

    useEffect(() => {
        const companyIdByNameNormalized = new Map<string, string>();
        companies.forEach((company) => {
            const id = (company.id ?? '').trim();
            if (!id) return;
            const key = normalizeTeamName(company.name);
            if (!key) return;
            if (!companyIdByNameNormalized.has(key)) {
                companyIdByNameNormalized.set(key, id);
            }
        });

        const filtered = allTeams
            .filter((t): t is Team & { id: string } => typeof t.id === 'string' && t.id.trim().length > 0)
            .filter((team) => {
                const companyIdRaw = (team.companyId ?? '').trim();
                const companyNameKey = normalizeTeamName(team.companyName);
                const companyId = companyIdRaw || (companyNameKey ? (companyIdByNameNormalized.get(companyNameKey) ?? '') : '');
                if (!companyId) return false;
                return constructionCompanyIds.has(companyId);
            })
            .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'ko'));

        setTeams(filtered);

        if (selectedTeamId && !filtered.some((t) => t.id === selectedTeamId)) {
            setSelectedTeamId('');
        }
    }, [allTeams, companies, constructionCompanyIds, normalizeTeamName, selectedTeamId]);

    useEffect(() => {
        if (filterMode !== 'team') return;
        if (!selectedTeamId) {
            setSelectedWorkerId('');
            return;
        }

        const belongsToSelected = allWorkers.some((w) => (w.id ?? '').trim() === selectedWorkerId);
        if (!belongsToSelected) {
            setSelectedWorkerId('');
        }
    }, [allWorkers, filterMode, selectedTeamId, selectedWorkerId]);

    useEffect(() => {
        if (filterMode === 'team') {
            setSelectedWorkerId('');
            setWorkerSearchText('');
            return;
        }

        setSelectedTeamId('');
    }, [filterMode]);

    const handleResetFilters = useCallback(() => {
        if (filterMode === 'team') {
            setSelectedTeamId('');
        } else {
            setSelectedWorkerId('');
            setWorkerSearchText('');
        }
        setTeamDropdownOpen(false);
        setExpandedRows(new Set());
    }, [filterMode]);

    const isLedgerInsuranceEligibleEntry = useCallback(
        (
            entry: MonthlyAdvanceLedgerWorkEntry,
            ledgerRow: Pick<MonthlyAdvanceLedgerRow, 'workerId' | 'teamId' | 'teamName' | 'month'>
        ): boolean => {
            const workerTeam = workerTeamByWorkerId.get(String(ledgerRow.workerId ?? '').trim());
            const workerTeamIdForMatch = workerTeam?.teamId || ledgerRow.teamId;
            const workerTeamNameForMatch = workerTeam?.teamName || ledgerRow.teamName;
            const normalizedEntry: WorkerWorkEntry = {
                date: String(entry.date ?? ledgerRow.month ?? '').trim() || ledgerRow.month,
                siteId: entry.siteId,
                siteName: String(entry.siteName ?? '').trim(),
                clientCompanyId: entry.clientCompanyId,
                isLaborSite: Boolean(entry.isLaborSite),
                paymentMethod: entry.paymentMethod,
                manDay: toNumber(entry.manDay),
                unitPrice: toNumber(entry.unitPrice),
                amount:
                    toNumber(entry.amount) > 0
                        ? toNumber(entry.amount)
                        : floorWon(toNumber(entry.manDay) * toNumber(entry.unitPrice)),
            };

            return isEntryInWorkerTeamSite(normalizedEntry, workerTeamIdForMatch, workerTeamNameForMatch);
        },
        [isEntryInWorkerTeamSite, workerTeamByWorkerId]
    );

    const allowedTeamIdsForWorkerFilter = useMemo(() => {
        if (!selectedTeamId) return null;

        const selectedTeamName = allTeams.find(t => t.id === selectedTeamId)?.name ?? '';
        const selectedTeamNameNormalized = normalizeTeamName(selectedTeamName);

        const ids = new Set<string>();
        ids.add(selectedTeamId);

        allTeams.forEach(team => {
            if (!team.id) return;
            if (team.parentTeamId === selectedTeamId) {
                ids.add(team.id);
                return;
            }
            if (selectedTeamNameNormalized) {
                const parentNameNormalized = normalizeTeamName(team.parentTeamName ?? '');
                if (parentNameNormalized && parentNameNormalized === selectedTeamNameNormalized) {
                    ids.add(team.id);
                }
            }
        });

        return ids;
    }, [allTeams, normalizeTeamName, selectedTeamId]);

    const workerOptions = useMemo(() => {
        const text = workerSearchText.trim().toLowerCase();
        const shouldIncludeDailyWage = pageViewMode !== 'standard';
        const rows = allWorkers
            .filter((w): w is Worker & { id: string } => typeof w.id === 'string' && w.id.trim().length > 0)
            .filter((w) => {
                const model = (w.payType ?? '').trim(); // salaryModel 완전 제거
                if (model === '월급제') return true;
                if (model === '용역팀') return true;
                if (shouldIncludeDailyWage && model === '일급제') return true;
                return false;
            })
            .filter((w) => {
                if (!allowedTeamIdsForWorkerFilter) return true;
                const workerTeamId = (w.teamId ?? '').trim();
                if (!workerTeamId) return false;
                return allowedTeamIdsForWorkerFilter.has(workerTeamId);
            })
            .filter((w) => {
                if (!text) return true;
                const name = (w.name ?? '').toLowerCase();
                return name.includes(text);
            })
            .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'ko'));

        return rows;
    }, [allWorkers, allowedTeamIdsForWorkerFilter, pageViewMode, workerSearchText]);

    // ★ 행별 표시 데이터 캐시 - 렌더 루프 안에서 매번 재계산하던 수십 개의 계산값을
    //    여기서 한 번만 처리한다. expandedRows 토글 같은 무관한 상태 변경 시 완전히 건너뜀.
    const rowDisplayCache = useMemo(() => {
        const cache = new Map<string, {
            deductionBreakdownForDisplay: DeductionBreakdown;
            advanceLinesForDisplay: DeductionLine[];
            nonAdvanceDeductionLinesForDisplay: DeductionLine[];
            advanceTotalForDisplay: number;
            nonAdvanceDeductionTotalForDisplay: number;
            hasNonAdvanceDeductionLines: boolean;
            hasAdvanceLines: boolean;
            taxLinesForItem: DeductionLine[];
            taxTotalForDisplay: number;
            totalDeductionForDisplay: number;
            totalAmountForDisplay: number;
            insuranceTaxLines: DeductionLine[];
            withholdingTaxLines: DeductionLine[];
            businessTaxLines: DeductionLine[];
            otherTaxLines: DeductionLine[];
            insuranceSectionTaxTotal: number;
            withholdingSectionTaxTotal: number;
            businessSectionTaxTotal: number;
            otherTaxTotal: number;
            insuranceAfterTaxAmount: number;
            withholdingGrossAmount: number;
            withholdingAfterTaxAmount: number;
            businessAfterTaxAmount: number;
            showInsuranceSection: boolean;
            hasInsuranceTargetSummary: boolean;
            withholdingDetailText: string;
        }>();

        const baseRows = basePaymentData.length > 0 ? basePaymentData : paymentData;
        const baseRowsById = new Map<string, PaymentData>();
        baseRows.forEach((row) => {
            baseRowsById.set(row.id, row);
        });

        const dailyFeePerManDay = Math.max(0, Math.floor(toNumber(payrollConfig?.insuranceConfig?.dailyWorkerFeePerManDay ?? 0)));

        filteredPaymentData.forEach((item) => {
            const isFinalizedSnapshot = finalizedSnapshotByPaymentId.has(item.id);
            const baseItemForDisplay = isFinalizedSnapshot
                ? item
                : baseRowsById.get(item.id) ?? item;

            // utility input 해결 (state 값 직접 사용)
            const directUtility = ledgerInputs[item.id] as LedgerUtilityInputLike | undefined;
            const mappedUtility = utilityInputByPaymentRowKey.get(item.id);
            let utilityInputForDisplay: LedgerUtilityInputLike | undefined = directUtility ?? mappedUtility;
            if (!utilityInputForDisplay) {
                const itemSalaryModel = item.id.endsWith('__일급제') ? '일급제' : '월급제';
                const monthWorkerKey = `${item.month}__${item.workerId}__${itemSalaryModel}`;
                utilityInputForDisplay = utilityInputByWorkerMonthSingle.get(monthWorkerKey);
            }

            const utilityLinesForDisplay = !isFinalizedSnapshot && utilitiesApplied
                ? buildVisibleUtilityDeductionLines(utilityInputForDisplay)
                : [];
            const dailyFeeLinesForDisplay = buildDailyFeeDeductionLines({
                item,
                applyDailyFee: !isFinalizedSnapshot && dailyFeeApplied,
                dailyFeePerManDay,
            });
            const deductionAppliedLines = [...utilityLinesForDisplay, ...dailyFeeLinesForDisplay];

            const sourceDeduction = isFinalizedSnapshot
                ? (baseItemForDisplay.deductionBreakdown ?? createEmptyDeductionBreakdown())
                : ensureAdvanceLinesInBreakdown(
                    stripTemporaryDeductionLines(baseItemForDisplay.deductionBreakdown),
                    utilityInputForDisplay,
                    payrollConfig
                );
            const baseDeduction = rebuildDeductionBreakdown({
                standardLines: (sourceDeduction.standardLines ?? []).filter((line: DeductionLine) => !isAppliedUtilityOrFeeLabel(String(line.label ?? '').trim())),
                additionalLines: (sourceDeduction.additionalLines ?? []).filter((line: DeductionLine) => !isAppliedUtilityOrFeeLabel(String(line.label ?? '').trim())),
            });
            const deductionBreakdownForDisplay = isFinalizedSnapshot
                ? sourceDeduction
                : (utilitiesApplied || dailyFeeApplied)
                ? mergeDeductionBreakdownWithLines(baseDeduction, deductionAppliedLines)
                : sourceDeduction;

            const deductionLines = [
                ...(deductionBreakdownForDisplay.standardLines ?? []),
                ...(deductionBreakdownForDisplay.additionalLines ?? []),
            ];
            const advanceLinesForDisplay = deductionLines.filter((line) =>
                advanceLabelSet.has(normalizeLineLabel(String(line?.label ?? '')))
            );
            const nonAdvanceDeductionLinesForDisplay = deductionLines.filter((line) =>
                !advanceLabelSet.has(normalizeLineLabel(String(line?.label ?? '')))
            );
            const advanceTotalForDisplay = advanceLinesForDisplay.reduce((sum, l) => sum + toNumber(l.amount), 0);
            const nonAdvanceDeductionTotalForDisplay = nonAdvanceDeductionLinesForDisplay.reduce((sum, l) => sum + toNumber(l.amount), 0);

            const taxLinesForItem = isFinalizedSnapshot
                ? [
                    ...(item.taxBreakdown?.standardLines ?? []),
                    ...(item.taxBreakdown?.additionalLines ?? []),
                ]
                : getTaxLinesForItem(item);
            const taxTotalForDisplay = taxLinesForItem.reduce((sum, l) => sum + toNumber(l.amount), 0);
            const totalDeductionForDisplay = isFinalizedSnapshot
                ? toNumber(item.totalDeduction)
                : deductionBreakdownForDisplay.total + taxTotalForDisplay;
            const totalAmountForDisplay = isFinalizedSnapshot
                ? toNumber(item.totalAmount)
                : item.grossAmount - totalDeductionForDisplay;

            const insuranceTaxLines: DeductionLine[] = [];
            const withholdingTaxLines: DeductionLine[] = [];
            const businessTaxLines: DeductionLine[] = [];
            const otherTaxLines: DeductionLine[] = [];

            let insuranceSectionTaxTotal = 0;
            let withholdingSectionTaxTotal = 0;
            let businessSectionTaxTotal = 0;
            let otherTaxTotal = 0;

            taxLinesForItem.forEach((line) => {
                const amount = toNumber(line.amount);
                if (isInsuranceSectionTaxLabel(line.label)) {
                    insuranceTaxLines.push(line);
                    insuranceSectionTaxTotal += amount;
                    return;
                }
                if (isWithholdingSectionTaxLabel(line.label)) {
                    withholdingTaxLines.push(line);
                    withholdingSectionTaxTotal += amount;
                    return;
                }
                if (isBusinessSectionTaxLabel(line.label)) {
                    businessTaxLines.push(line);
                    businessSectionTaxTotal += amount;
                    return;
                }
                otherTaxLines.push(line);
                otherTaxTotal += amount;
            });

            const insuranceAfterTaxAmount = Math.max(0, Math.floor((item.insuranceAppliedSummary?.appliedAmount ?? 0) - insuranceSectionTaxTotal));
            const withholdingGrossAmount = item.withholdingAppliedSummary
                ? toNumber(item.withholdingAppliedSummary.grossAmount ?? item.withholdingAppliedSummary.appliedAmount)
                : 0;
            const withholdingAfterTaxAmount = Math.max(0, Math.floor(withholdingGrossAmount - withholdingSectionTaxTotal));
            const businessAfterTaxAmount = Math.max(0, Math.floor((item.businessIncomeAppliedSummary?.appliedAmount ?? 0) - businessSectionTaxTotal));

            cache.set(item.id, {
                deductionBreakdownForDisplay,
                advanceLinesForDisplay,
                nonAdvanceDeductionLinesForDisplay,
                advanceTotalForDisplay,
                nonAdvanceDeductionTotalForDisplay,
                hasNonAdvanceDeductionLines: nonAdvanceDeductionLinesForDisplay.length > 0,
                hasAdvanceLines: advanceLinesForDisplay.length > 0,
                taxLinesForItem,
                taxTotalForDisplay,
                totalDeductionForDisplay,
                totalAmountForDisplay,
                insuranceTaxLines,
                withholdingTaxLines,
                businessTaxLines,
                otherTaxLines,
                insuranceSectionTaxTotal,
                withholdingSectionTaxTotal,
                businessSectionTaxTotal,
                otherTaxTotal,
                insuranceAfterTaxAmount,
                withholdingGrossAmount,
                withholdingAfterTaxAmount,
                businessAfterTaxAmount,
                showInsuranceSection: insuranceTaxLines.length > 0,
                hasInsuranceTargetSummary: Boolean(item.insuranceAppliedSummary && item.insuranceAppliedSummary.appliedManDay > 0),
                withholdingDetailText: resolveWithholdingDetailText(item.taxRateSnapshot),
            });
        });

        return cache;
    }, [
        advanceLabelSet,
        basePaymentData,
        dailyFeeApplied,
        finalizedSnapshotByPaymentId,
        filteredPaymentData,
        ledgerInputs,
        paymentData,
        payrollConfig,
        utilityInputByPaymentRowKey,
        utilityInputByWorkerMonthSingle,
        utilitiesApplied,
    ]);

    const normalizeBankKey = useCallback((value: unknown): string => {
        const collapsed = String(value ?? '')
            .trim()
            .replace(/\s+/g, '')
            .replace(/[[\](){}]/g, '')
            .toUpperCase();

        return collapsed
            .replace(/^\d{3}[-_]?/, '')
            .replace(/[-_]?\d{3}$/, '');
    }, []);

    const bankCodeByName = useMemo(() => {
        const map = new Map<string, string>();

        Object.entries(BANK_CODES).forEach(([k, v]) => {
            const key = String(k ?? '').trim();
            const value = String(v ?? '').trim();

            if (/^\d{3}$/.test(key)) {
                // code -> name 형태
                const normalizedName = normalizeBankKey(value);
                if (normalizedName) map.set(normalizedName, key);
                return;
            }

            if (/^\d{3}$/.test(value)) {
                // name -> code 형태
                const normalizedName = normalizeBankKey(key);
                if (normalizedName) map.set(normalizedName, value);
            }
        });

        // 자주 입력되는 별칭 보정
        map.set('국민', '004');
        map.set('국민은행', '004');
        map.set('KB국민', '004');
        map.set('KB국민은행', '004');

        return map;
    }, [normalizeBankKey]);

    const bankNameKeyEntries = useMemo(() => {
        const entries: Array<{ nameKey: string; code: string }> = [];
        Object.entries(BANK_CODES).forEach(([k, v]) => {
            const code = String(k ?? '').trim();
            const name = String(v ?? '').trim();
            if (!/^\d{3}$/.test(code)) return;
            const normalizedName = normalizeBankKey(name);
            if (!normalizedName) return;
            entries.push({ nameKey: normalizedName, code });

            const withoutBank = normalizeBankKey(name.replace(/은행|증권|중앙회|저축은행/g, ''));
            if (withoutBank && withoutBank !== normalizedName) {
                entries.push({ nameKey: withoutBank, code });
            }
        });

        entries.sort((a, b) => b.nameKey.length - a.nameKey.length);
        return entries;
    }, [normalizeBankKey]);

    const resolveBankCode = useCallback((bankName?: string, bankCode?: string): string => {
        const explicitCode = String(bankCode ?? '').trim();
        if (/^\d{3}$/.test(explicitCode)) return explicitCode;

        const rawBankName = String(bankName ?? '').trim();
        if (/^\d{3}$/.test(rawBankName)) return rawBankName;

        const normalizedName = normalizeBankKey(bankName);
        if (!normalizedName) return '';

        const exact = bankCodeByName.get(normalizedName);
        if (exact) return exact;

        const candidateCodes = new Set<string>();
        bankNameKeyEntries.forEach(({ nameKey, code }) => {
            if (!nameKey) return;
            if (normalizedName.includes(nameKey) || nameKey.includes(normalizedName)) {
                candidateCodes.add(code);
            }
        });

        if (candidateCodes.size === 1) {
            return Array.from(candidateCodes)[0];
        }

        if (candidateCodes.size > 1) {
            const ranked = Array.from(candidateCodes)
                .map((code) => {
                    const officialName = String(BANK_CODES[code] ?? '');
                    const officialKey = normalizeBankKey(officialName);

                    let score = 0;
                    if (/은행|뱅크/.test(officialName)) score += 40;
                    if (/저축은행/.test(officialName)) score -= 15;
                    if (/증권|선물/.test(officialName)) score -= 20;

                    if (officialKey === normalizedName) score += 50;
                    else if (officialKey.startsWith(normalizedName)) score += 20;
                    else if (officialKey.includes(normalizedName)) score += 10;

                    return { code, score };
                })
                .sort((a, b) => b.score - a.score);

            if (ranked[0] && (ranked.length === 1 || ranked[0].score > ranked[1].score)) {
                return ranked[0].code;
            }
        }

        return '';
    }, [bankCodeByName, bankNameKeyEntries, normalizeBankKey]);

    const analyzeBankMapping = useCallback((bankName?: string, bankCode?: string): {
        code: string;
        reason: string;
        candidates: string[];
    } => {
        const explicitCode = String(bankCode ?? '').trim();
        if (/^\d{3}$/.test(explicitCode)) {
            return { code: explicitCode, reason: '', candidates: [] };
        }

        const rawBankName = String(bankName ?? '').trim();
        if (/^\d{3}$/.test(rawBankName)) {
            return { code: rawBankName, reason: '', candidates: [] };
        }

        const normalizedName = normalizeBankKey(bankName);
        if (!normalizedName) {
            return {
                code: '',
                reason: '은행명이 비어있거나 형식이 올바르지 않습니다.',
                candidates: []
            };
        }

        const exact = bankCodeByName.get(normalizedName);
        if (exact) {
            return { code: exact, reason: '', candidates: [] };
        }

        const candidateCodes = new Set<string>();
        bankNameKeyEntries.forEach(({ nameKey, code }) => {
            if (!nameKey) return;
            if (normalizedName.includes(nameKey) || nameKey.includes(normalizedName)) {
                candidateCodes.add(code);
            }
        });

        if (candidateCodes.size === 1) {
            return { code: Array.from(candidateCodes)[0], reason: '', candidates: [] };
        }

        if (candidateCodes.size > 1) {
            const ranked = Array.from(candidateCodes)
                .map((code) => {
                    const officialName = String(BANK_CODES[code] ?? '');
                    const officialKey = normalizeBankKey(officialName);

                    let score = 0;
                    if (/은행|뱅크/.test(officialName)) score += 40;
                    if (/저축은행/.test(officialName)) score -= 15;
                    if (/증권|선물/.test(officialName)) score -= 20;

                    if (officialKey === normalizedName) score += 50;
                    else if (officialKey.startsWith(normalizedName)) score += 20;
                    else if (officialKey.includes(normalizedName)) score += 10;

                    return { code, score };
                })
                .sort((a, b) => b.score - a.score);

            if (ranked[0] && (ranked.length === 1 || ranked[0].score > ranked[1].score)) {
                return { code: ranked[0].code, reason: '', candidates: [] };
            }

            return {
                code: '',
                reason: '유사 은행 후보가 여러 개여서 자동 매핑을 보류했습니다.',
                candidates: ranked.slice(0, 4).map((r) => `${r.code}:${BANK_CODES[r.code]}`),
            };
        }

        return {
            code: '',
            reason: '등록된 은행명/별칭과 일치하는 코드가 없습니다.',
            candidates: []
        };
    }, [bankCodeByName, bankNameKeyEntries, normalizeBankKey]);





    const validateItem = useCallback((item: Partial<PaymentData>): { isValid: boolean, errors: PaymentData['errors'] } => {
        const errors: PaymentData['errors'] = {};
        let isValid = true;

        if (!item.bankName) {
            errors.bankName = true;
            isValid = false;
        }
        if (!resolveBankCode(item.bankName, item.bankCode)) {
            if (item.bankName) {
                errors.bankCode = true;
                isValid = false;
            }
        }
        if (!item.accountNumber) {
            errors.accountNumber = true;
            isValid = false;
        }
        if (!item.accountHolder) {
            errors.accountHolder = true;
            isValid = false;
        }

        return { isValid, errors };
    }, [resolveBankCode]);
    void [
        buildUtilityDeductionLines,
        sumInsuranceSectionTax,
        sumWithholdingSectionTax,
        sumBusinessSectionTax,
        buildDeductionBreakdownFromRecords,
        handleResetFilters,
        validateItem,
    ];

    const toggleRow = (itemId: string) => {
        const key = itemId;
        setExpandedRows(prev => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    };

    const handleDisplayContentChange = (itemId: string, value: string) => {
        setPaymentData(prev => prev.map(item => {
            if (item.id !== itemId) return item;
            return { ...item, displayContent: value };
        }));
    };

    const handleBulkDisplayContentApply = () => {
        const visibleKeys = new Set(filteredPaymentData.map(item => item.id));
        setPaymentData(prev => prev.map(item => {
            if (!visibleKeys.has(item.id)) return item;
            return { ...item, displayContent: bulkDisplayContent };
        }));
    };

    const resolveDisplayTotalAmount = (item: PaymentData): number => {
        const rowDisplay = rowDisplayCache.get(item.id);
        return rowDisplay ? rowDisplay.totalAmountForDisplay : toNumber(item.totalAmount);
    };

    const resolveDisplayInvoiceNetAmount = (item: PaymentData): number => {
        const displayTotal = resolveDisplayTotalAmount(item);
        const invoiceNet = toNumber(item.invoiceNetAmount);
        const laborNet = toNumber(item.laborNetAmount);
        const splitBase = invoiceNet + laborNet;
        if (splitBase <= 0) return invoiceNet;
        return Math.round(displayTotal * (invoiceNet / splitBase));
    };

    const resolveDisplayLaborNetAmount = (item: PaymentData): number => {
        const displayTotal = resolveDisplayTotalAmount(item);
        return displayTotal - resolveDisplayInvoiceNetAmount(item);
    };

    // The simplified closing view only summarizes values already calculated by
    // the existing payroll screen. Once a run is confirmed, its saved payment
    // snapshot takes precedence so source-data edits cannot change this view.
    const simplePayrollClosingRows = useMemo<SimplePayrollClosingRow[]>(() => (
        filteredPaymentData.map((item) => {
            const finalized = finalizedSnapshotByPaymentId.get(item.id);
            if (finalized) {
                const { payment, row } = finalized;
                return {
                    id: payment.id,
                    month: String(payment.month ?? row.yearMonth ?? '').trim(),
                    workerName: String(payment.workerName ?? row.workerName ?? '').trim(),
                    teamName: String(payment.teamName ?? row.teamName ?? '').trim(),
                    totalManDay: Math.max(0, toNumber(row.totalManDay ?? payment.totalManDay)),
                    grossAmount: Math.max(0, toNumber(row.grossAmount ?? payment.grossAmount)),
                    personalDeduction: Math.max(0, toNumber(row.personalDeduction)),
                    taxDeduction: Math.max(0, toNumber(row.taxDeduction)),
                    totalDeduction: Math.max(0, toNumber(row.totalDeduction ?? payment.totalDeduction)),
                    netAmount: toNumber(row.netAmount ?? payment.totalAmount),
                    isValid: row.isValid !== false,
                    isSnapshot: true,
                };
            }

            const rowDisplay = rowDisplayCache.get(item.id);
            const personalDeduction = Math.max(
                0,
                toNumber(rowDisplay?.deductionBreakdownForDisplay.total ?? item.deductionBreakdown?.total)
            );
            const taxDeduction = Math.max(0, toNumber(rowDisplay?.taxTotalForDisplay));
            const totalDeduction = rowDisplay
                ? Math.max(0, toNumber(rowDisplay.totalDeductionForDisplay))
                : personalDeduction + taxDeduction;

            return {
                id: item.id,
                month: String(item.month ?? '').trim(),
                workerName: String(item.workerName ?? '').trim(),
                teamName: String(item.teamName ?? '').trim(),
                totalManDay: Math.max(0, toNumber(item.totalManDay)),
                grossAmount: Math.max(0, toNumber(item.grossAmount)),
                personalDeduction,
                taxDeduction,
                totalDeduction,
                netAmount: rowDisplay
                    ? toNumber(rowDisplay.totalAmountForDisplay)
                    : toNumber(item.totalAmount),
                isValid: Boolean(item.isValid),
                isSnapshot: false,
            };
        })
    ), [filteredPaymentData, finalizedSnapshotByPaymentId, rowDisplayCache]);

    const resolveLedgerComputedAmountForPaymentItem = (
        item: PaymentData
    ): MonthlyAdvanceLedgerComputedAmount | undefined => {
        const salaryModel = item.id.endsWith('__일급제')
            ? '일급제'
            : item.id.endsWith('__용역팀')
                ? '용역팀'
                : '월급제';
        const ledgerRow = ledgerRows.find((row) => (
            row.month === item.month
            && row.workerId === item.workerId
            && row.teamId === item.teamId
            && String(row.salaryModel ?? '월급제') === salaryModel
        ));
        const rowKey = String(ledgerRow?.rowKey ?? '').trim();
        return rowKey ? ledgerComputedAmountByRowKey.get(rowKey) : undefined;
    };

    const resolveKBAdvanceAmounts = (item: PaymentData) => {
        const manual = finalizedSnapshotByPaymentId.get(item.id)?.row.manualInput
            ?? resolveUtilityInputForPaymentItem(item);
        const toSafeNumber = (value: unknown): number => (
            typeof value === 'number' && Number.isFinite(value) ? value : 0
        );
        const sumSideAdvances = (side: LedgerManualInput['invoice'] | undefined): number => (
            toSafeNumber(side?.carry)
            + toSafeNumber(side?.carrySecond)
            + toSafeNumber(side?.currentAdvance)
            + toSafeNumber(side?.currentAdvanceSecond)
        );
        const getAdvanceItem = (
            side: LedgerManualInput['invoice'] | undefined,
            field: 'carry' | 'carrySecond' | 'currentAdvance' | 'currentAdvanceSecond'
        ): number => toSafeNumber(side?.[field]);

        return {
            invoiceAdvance: manual ? sumSideAdvances(manual.invoice) : 0,
            laborAdvance: manual ? sumSideAdvances(manual.labor) : 0,
            corporateAdvance1: manual ? getAdvanceItem(manual.invoice, 'carry') : 0,
            corporateAdvance2: manual ? getAdvanceItem(manual.invoice, 'carrySecond') : 0,
            corporateAdvance3: manual ? getAdvanceItem(manual.invoice, 'currentAdvance') : 0,
            corporateAdvance4: manual ? getAdvanceItem(manual.invoice, 'currentAdvanceSecond') : 0,
            laborAdvance1: manual ? getAdvanceItem(manual.labor, 'carry') : 0,
            laborAdvance2: manual ? getAdvanceItem(manual.labor, 'carrySecond') : 0,
            laborAdvance3: manual ? getAdvanceItem(manual.labor, 'currentAdvance') : 0,
            laborAdvance4: manual ? getAdvanceItem(manual.labor, 'currentAdvanceSecond') : 0,
        };
    };

    const buildKBPreviewSourceRows = (): KBPreviewSourceRow[] => {
        return kbSourcePaymentData.map((item) => {
            const finalized = finalizedSnapshotByPaymentId.get(item.id);
            const advances = resolveKBAdvanceAmounts(item);
            const ledgerAmount = resolveLedgerComputedAmountForPaymentItem(item);
            const salaryLabel = item.id.endsWith('__일급제')
                ? '일급제'
                : item.id.endsWith('__용역팀')
                    ? '용역팀'
                    : '월급제';

            return {
                sourceRowId: item.id,
                month: item.month,
                teamName: item.teamName,
                workerName: item.workerName,
                salaryLabel,
                bankCode: item.bankCode,
                bankName: item.bankName,
                accountNumber: item.accountNumber,
                accountHolder: item.accountHolder,
                totalAmount: resolveDisplayTotalAmount(item),
                invoiceNetAmount: finalized
                    ? toNumber(finalized.row.invoiceNetAmount)
                    : ledgerAmount
                    ? (ledgerAmount.allocationMode === 'corporate' ? ledgerAmount.corporateNet : 0)
                    : resolveDisplayInvoiceNetAmount(item),
                laborNetAmount: finalized
                    ? toNumber(finalized.row.laborNetAmount)
                    : ledgerAmount
                    ? (ledgerAmount.allocationMode === 'labor' ? ledgerAmount.personalNet : 0)
                    : resolveDisplayLaborNetAmount(item),
                ...advances,
            };
        });
    };

    const resolveKBSourceAmount = (row: KBPreviewSourceRow, amountType: KBAmountType): number => {
        if (amountType === 'invoiceNet') return row.invoiceNetAmount;
        if (amountType === 'laborNet') return row.laborNetAmount;
        if (amountType === 'invoiceAdvance') return row.invoiceAdvance;
        if (amountType === 'laborAdvance') return row.laborAdvance;
        if (amountType === 'corporateAdvance1') return row.corporateAdvance1;
        if (amountType === 'corporateAdvance2') return row.corporateAdvance2;
        if (amountType === 'corporateAdvance3') return row.corporateAdvance3;
        if (amountType === 'corporateAdvance4') return row.corporateAdvance4;
        if (amountType === 'laborAdvance1') return row.laborAdvance1;
        if (amountType === 'laborAdvance2') return row.laborAdvance2;
        if (amountType === 'laborAdvance3') return row.laborAdvance3;
        if (amountType === 'laborAdvance4') return row.laborAdvance4;
        return row.totalAmount;
    };

    const sanitizeKBExcelText = (value: unknown): string => String(value ?? '').replace(/\r?\n/g, ' ').trim();

    const formatKBGeneratedAt = (iso: string): string => {
        const date = new Date(iso);
        if (Number.isNaN(date.getTime())) return '-';
        return date.toLocaleString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
    };

    const getKBDeductionStatusLabel = (): string => {
        return [
            `4대보험 ${insuranceApplied ? '적용' : '해제'}`,
            `해당팀 ${insuranceTeamSiteOnly ? '적용' : '해제'}`,
            `사업소득 ${businessIncomeApplied ? '적용' : '해제'}`,
            `공과금 ${utilitiesApplied ? '적용' : '해제'}`,
            `수수료 ${dailyFeeApplied ? '적용' : '해제'}`,
        ].join(' / ');
    };

    const getKBTargetLabel = (): string => {
        if (filterMode === 'worker') {
            if (!selectedWorkerId) return '개인전체';
            const worker = workerOptions.find((item) => item.id === selectedWorkerId);
            return worker?.name || '선택 개인';
        }
        return selectedTeamLabel || '팀전체';
    };

    const getKBAmountTypeDisplayLabel = (amountType: KBAmountType): string => {
        const labels = { ...DEFAULT_ADVANCE_ITEM_LABELS, ...(payrollConfig?.advanceItemLabels ?? {}) };
        if (amountType === 'corporateAdvance1') return labels.corporateAdvance1;
        if (amountType === 'corporateAdvance2') return labels.corporateAdvance2;
        if (amountType === 'corporateAdvance3') return labels.corporateAdvance3;
        if (amountType === 'corporateAdvance4') return labels.corporateAdvance4;
        if (amountType === 'laborAdvance1') return labels.laborAdvance1;
        if (amountType === 'laborAdvance2') return labels.laborAdvance2;
        if (amountType === 'laborAdvance3') return labels.laborAdvance3;
        if (amountType === 'laborAdvance4') return labels.laborAdvance4;
        return getKBAmountTypeLabel(amountType);
    };

    const buildKBTransferRowsFromSources = (
        sourceRows: KBPreviewSourceRow[],
        amountType: KBAmountType,
        receiverDisplay: string,
        memoSuffix: string
    ): { rows: KBTransferRow[]; excludedRows: KBExcludedTransferRow[] } => {
        const rows: KBTransferRow[] = [];
        const excludedRows: KBExcludedTransferRow[] = [];

        sourceRows.forEach((sourceRow) => {
            const amount = resolveKBSourceAmount(sourceRow, amountType);
            if (!Number.isFinite(amount) || amount <= 0) {
                excludedRows.push({
                    sourceRowId: sourceRow.sourceRowId,
                    month: sourceRow.month,
                    teamName: sourceRow.teamName,
                    workerName: sourceRow.workerName,
                    salaryLabel: sourceRow.salaryLabel,
                    amount: Number.isFinite(amount) ? amount : 0,
                    reason: '이체금액 0원 이하',
                });
                return;
            }

            const analysis = analyzeBankMapping(sourceRow.bankName, sourceRow.bankCode);
            const rawBankName = String(sourceRow.bankName ?? '').trim();
            const bankCodeDisplay = analysis.code || rawBankName || '(은행명없음)';
            const validationErrors = validateKBTransferRow({
                bankCode: analysis.code,
                accountNumber: sourceRow.accountNumber,
                accountHolder: sourceRow.accountHolder,
                amount,
            }).filter((error) => error !== 'amount');

            rows.push({
                sourceRowId: sourceRow.sourceRowId,
                month: sourceRow.month,
                teamName: sourceRow.teamName,
                workerName: sourceRow.workerName,
                salaryLabel: sourceRow.salaryLabel,
                bankCode: analysis.code,
                bankCodeDisplay,
                bankCodeUnmapped: !analysis.code,
                bankCodeNeedsFix: validationErrors.includes('bankCode'),
                bankCodeReason: analysis.reason,
                bankCodeCandidates: analysis.candidates.join(', '),
                bankName: sourceRow.bankName,
                accountNumber: sourceRow.accountNumber,
                accountHolder: sourceRow.accountHolder,
                amount,
                receiverDisplay,
                senderMemo: formatKBTransferMemo(memoSuffix, sourceRow.workerName),
                validationErrors,
            });
        });

        return { rows, excludedRows };
    };

    const buildKBPreviewSnapshot = (
        sourceRows: KBPreviewSourceRow[],
        amountType: KBAmountType,
        receiverDisplay: string,
        memoSuffix: string,
        createdAtIso = new Date().toISOString()
    ): KBPreviewSnapshot => {
        const { rows, excludedRows } = buildKBTransferRowsFromSources(sourceRows, amountType, receiverDisplay, memoSuffix);
        const summary = summarizeKBTransferRows(rows, excludedRows.length);

        return {
            createdAtIso,
            sourceRows,
            rows,
            excludedRows,
            criteria: {
                generatedAt: formatKBGeneratedAt(createdAtIso),
                rangeLabel: rangeLabel || currentYearMonth,
                teamLabel: selectedTeamLabel || '팀전체',
                targetLabel: getKBTargetLabel(),
                salaryFilterLabel: pageViewMode === 'ledger'
                    ? getKBSalaryModelFilterLabel(ledgerSalaryModelFilter)
                    : '기본목록 전체',
                deductionStatusLabel: getKBDeductionStatusLabel(),
                amountTypeLabel: getKBAmountTypeDisplayLabel(amountType),
                sourceCount: sourceRows.length,
                exportCount: summary.rowCount,
                excludedCount: summary.excludedCount,
                totalAmount: summary.totalAmount,
            },
        };
    };

    const updateKBPreviewSnapshotFromControls = (overrides: Partial<{
        amountType: KBAmountType;
        receiverDisplay: string;
        memoSuffix: string;
    }>) => {
        setKbPreviewSnapshot((prev) => {
            if (!prev) return prev;
            return buildKBPreviewSnapshot(
                prev.sourceRows,
                overrides.amountType ?? kbAmountType,
                overrides.receiverDisplay ?? kbReceiverDisplay,
                overrides.memoSuffix ?? kbMemoSuffix,
                prev.createdAtIso
            );
        });
    };

    const getKBValidationMessages = (row: KBTransferRow): string => (
        row.validationErrors.map(getKBValidationErrorLabel).join(', ')
    );

    // 국민은행용 엑셀 다운로드 (미리보기 스냅샷 기준)
    const handleDownloadKBExcel = () => {
        const snapshot = kbPreviewSnapshot;
        if (!snapshot) {
            alert('먼저 국민은행 미리보기를 열어 출력 내용을 확인해주세요.');
            return;
        }

        const kbTransferRows = snapshot.rows;
        if (kbTransferRows.length === 0) {
            alert("다운로드할 이체금액 데이터가 없습니다.");
            return;
        }

        const invalidRows = kbTransferRows.filter((row) => row.validationErrors.length > 0);
        if (invalidRows.length > 0) {
            alert(`은행코드/계좌/예금주 오류 ${invalidRows.length}건을 먼저 수정해주세요.`);
            return;
        }

        // 셀 스타일 정의 (연두색 배경 - KB은행 양식)
        const greenStyle = {
            fill: { fgColor: { rgb: 'C6EFCE' }, patternType: 'solid' },
            font: { name: '맑은 고딕', sz: 10 },
            alignment: { horizontal: 'left' as const, vertical: 'center' as const },
            border: {
                top: { style: 'thin' as const, color: { rgb: '000000' } },
                bottom: { style: 'thin' as const, color: { rgb: '000000' } },
                left: { style: 'thin' as const, color: { rgb: '000000' } },
                right: { style: 'thin' as const, color: { rgb: '000000' } }
            }
        };

        const greenNumberStyle = {
            fill: { fgColor: { rgb: 'C6EFCE' }, patternType: 'solid' },
            font: { name: '맑은 고딕', sz: 10 },
            alignment: { horizontal: 'right' as const, vertical: 'center' as const },
            border: {
                top: { style: 'thin' as const, color: { rgb: '000000' } },
                bottom: { style: 'thin' as const, color: { rgb: '000000' } },
                left: { style: 'thin' as const, color: { rgb: '000000' } },
                right: { style: 'thin' as const, color: { rgb: '000000' } }
            },
            numFmt: '#,##0'
        };

        const headerRow: (string | number)[] = [
            'A. 은행코드',
            'B. 계좌번호',
            'C. 이체금액',
            'D. 받는분통장표시',
            'E. 내통장메모',
        ];

        const rowData: (string | number)[][] = kbTransferRows.map(row => [
            sanitizeKBExcelText(row.bankCode),
            sanitizeKBExcelText(row.accountNumber),
            row.amount,
            sanitizeKBExcelText(row.receiverDisplay),
            sanitizeKBExcelText(row.senderMemo)
        ]);

        const ws = XLSX.utils.aoa_to_sheet([headerRow, ...rowData]);

        const headerStyle = {
            fill: { fgColor: { rgb: 'FDE68A' }, patternType: 'solid' },
            font: { name: '맑은 고딕', sz: 10, bold: true, color: { rgb: '7C2D12' } },
            alignment: { horizontal: 'center' as const, vertical: 'center' as const },
            border: {
                top: { style: 'thin' as const, color: { rgb: 'B45309' } },
                bottom: { style: 'thin' as const, color: { rgb: 'B45309' } },
                left: { style: 'thin' as const, color: { rgb: 'B45309' } },
                right: { style: 'thin' as const, color: { rgb: 'B45309' } }
            }
        };

        const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
        for (let R = range.s.r; R <= range.e.r; R++) {
            for (let C = range.s.c; C <= range.e.c; C++) {
                const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
                const cell = ws[cellAddress];
                if (!cell) continue;
                if (R === range.s.r) {
                    cell.s = headerStyle;
                    continue;
                }
                if (R > range.s.r && (C === 0 || C === 1 || C === 3 || C === 4)) {
                    cell.v = sanitizeKBExcelText(cell.v);
                    cell.t = 's';
                    cell.z = '@';
                }
                if (C === 2) {
                    cell.s = greenNumberStyle;
                    cell.t = 'n';
                } else {
                    cell.s = greenStyle;
                }
            }
        }

        ws['!cols'] = [
            { wch: 8 },
            { wch: 20 },
            { wch: 15 },
            { wch: 12 },
            { wch: 18 },
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '국민은행용');

        const verificationRows: (string | number)[][] = [
            ['항목', '값'],
            ['생성일시', snapshot.criteria.generatedAt],
            ['기간', snapshot.criteria.rangeLabel],
            ['팀/대상', snapshot.criteria.targetLabel],
            ['구분 필터', snapshot.criteria.salaryFilterLabel],
            ['금액 기준', snapshot.criteria.amountTypeLabel],
            ['공제 적용 상태', snapshot.criteria.deductionStatusLabel],
            ['원본 대상', snapshot.criteria.sourceCount],
            ['다운로드 행', snapshot.criteria.exportCount],
            ['제외 행', snapshot.criteria.excludedCount],
            ['총 이체금액', snapshot.criteria.totalAmount],
            [],
            ['다운로드 행 검증', '상태', '은행명', '은행코드', '계좌번호', '예금주', '이체금액'],
            ...snapshot.rows.map((row) => [
                `${row.month} ${row.teamName} ${row.workerName}`,
                row.validationErrors.length > 0 ? getKBValidationMessages(row) : '정상',
                row.bankName || '-',
                row.bankCode || '-',
                row.accountNumber || '-',
                row.accountHolder || '-',
                row.amount,
            ]),
            [],
            ['다운로드 제외', '사유', '금액'],
            ...snapshot.excludedRows.map((row) => [
                `${row.month} ${row.teamName} ${row.workerName}`,
                row.reason,
                row.amount,
            ]),
        ];
        const verificationSheet = XLSX.utils.aoa_to_sheet(verificationRows);
        verificationSheet['!cols'] = [
            { wch: 28 },
            { wch: 42 },
            { wch: 18 },
            { wch: 12 },
            { wch: 24 },
            { wch: 16 },
            { wch: 14 },
        ];
        XLSX.utils.book_append_sheet(wb, verificationSheet, '검증');

        const fileName = `월급제_국민은행용_${rangeLabel || currentYearMonth}.xlsx`;
        XLSX.writeFile(wb, fileName);
    };

    const getKBPreviewData = () => {
        return kbPreviewSnapshot?.rows ?? [];
    };

    const handleKBPreviewVisibilityChange = useCallback((show: boolean) => {
        if (!show) {
            setShowKBPreview(false);
            setKbPreviewSnapshot(null);
            return;
        }

        if (kbSourcePaymentData.length === 0) {
            alert('현재 조회 조건에 해당하는 국민은행 출력 대상이 없습니다.');
            return;
        }

        const nextAmountType: KBAmountType = 'totalAmount';
        const sourceRows = buildKBPreviewSourceRows();
        setKbAmountType(nextAmountType);
        setKbPreviewSnapshot(buildKBPreviewSnapshot(sourceRows, nextAmountType, kbReceiverDisplay, kbMemoSuffix));

        if (insuranceApplied || businessIncomeApplied || utilitiesApplied || dailyFeeApplied) {
            applyCalculatedDeductions({
                applyInsurance: insuranceApplied,
                applyBusinessIncome: businessIncomeApplied,
                applyUtilities: utilitiesApplied,
                applyDailyFee: dailyFeeApplied,
                applyInsuranceTeamSiteOnly: insuranceTeamSiteOnly,
                immediate: true,
            });
        }

        setShowKBPreview(true);
    }, [
        applyCalculatedDeductions,
        buildKBPreviewSnapshot,
        buildKBPreviewSourceRows,
        businessIncomeApplied,
        dailyFeeApplied,
        insuranceApplied,
        insuranceTeamSiteOnly,
        kbMemoSuffix,
        kbReceiverDisplay,
        kbSourcePaymentData.length,
        utilitiesApplied,
    ]);

    const kbPreviewRows = kbPreviewSnapshot?.rows ?? [];
    const kbPreviewExcludedRows = kbPreviewSnapshot?.excludedRows ?? [];
    const kbPreviewInvalidRows = kbPreviewRows.filter((row) => row.validationErrors.length > 0);
    const canDownloadKBExcel = Boolean(kbPreviewSnapshot && kbPreviewRows.length > 0 && kbPreviewInvalidRows.length === 0);

    const bankMappingDiagnostics = useMemo(() => {
        const grouped = new Map<string, {
            inputNames: Set<string>;
            count: number;
            mappedCount: number;
            codes: Set<string>;
            reasons: Map<string, number>;
            candidates: Set<string>;
        }>();

        filteredPaymentData.forEach((item) => {
            const rawName = String(item.bankName ?? '').trim();
            const normalizedName = normalizeBankKey(rawName) || '(빈값)';
            const analysis = analyzeBankMapping(item.bankName, item.bankCode);

            if (!grouped.has(normalizedName)) {
                grouped.set(normalizedName, {
                    inputNames: new Set<string>(),
                    count: 0,
                    mappedCount: 0,
                    codes: new Set<string>(),
                    reasons: new Map<string, number>(),
                    candidates: new Set<string>(),
                });
            }

            const bucket = grouped.get(normalizedName)!;
            bucket.count += 1;
            bucket.inputNames.add(rawName || '(미입력)');

            if (analysis.code) {
                bucket.mappedCount += 1;
                bucket.codes.add(analysis.code);
            } else {
                const reason = analysis.reason || '미매핑 사유 없음';
                bucket.reasons.set(reason, (bucket.reasons.get(reason) || 0) + 1);
                analysis.candidates.forEach((c) => bucket.candidates.add(c));
            }
        });

        return Array.from(grouped.entries())
            .map(([normalized, bucket]) => {
                const unmappedCount = bucket.count - bucket.mappedCount;
                const topReason = Array.from(bucket.reasons.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
                const suggestedAction = !unmappedCount
                    ? '정상'
                    : topReason.includes('여러 개')
                        ? '은행명을 더 구체적으로 입력하세요. (예: 신한은행, 카카오뱅크)'
                        : topReason.includes('비어')
                            ? '은행명을 입력하세요.'
                            : '공식 은행명으로 수정하거나 3자리 은행코드를 직접 입력하세요.';

                return {
                    normalized,
                    inputNames: Array.from(bucket.inputNames).slice(0, 4).join(', '),
                    count: bucket.count,
                    mappedCount: bucket.mappedCount,
                    unmappedCount,
                    codes: Array.from(bucket.codes).join(', '),
                    reason: topReason,
                    candidates: Array.from(bucket.candidates).join(', '),
                    suggestedAction,
                };
            })
            .sort((a, b) => {
                if (a.unmappedCount !== b.unmappedCount) return b.unmappedCount - a.unmappedCount;
                return a.normalized.localeCompare(b.normalized, 'ko');
            });
    }, [analyzeBankMapping, filteredPaymentData, normalizeBankKey]);

    const bankDiagnosticSummary = useMemo(() => {
        const total = bankMappingDiagnostics.reduce((sum, row) => sum + row.count, 0);
        const unmapped = bankMappingDiagnostics.reduce((sum, row) => sum + row.unmappedCount, 0);
        return { total, unmapped };
    }, [bankMappingDiagnostics]);


    const handleDownloadIndividualPayslip = useCallback(() => {
        if (!resolvedPayslipTarget) return;
        if (!ensurePayslipIssueReady([resolvedPayslipTarget], '개별 명세서 다운로드')) return;

        const { workbook } = buildPayslipWorkbook(
            resolvedPayslipTarget,
            resolvedPayslipContractorName
        );
        XLSX.writeFile(
            workbook,
            getPayslipWorkbookFileName(resolvedPayslipTarget),
            { cellStyles: true }
        );
    }, [ensurePayslipIssueReady, resolvedPayslipContractorName, resolvedPayslipTarget]);

    const handleDownloadBatchIndividualPayslips = useCallback(async () => {
        if (filteredPaymentData.length === 0 || batchExcelDownloading) {
            if (filteredPaymentData.length === 0) alert('다운로드할 명세서가 없습니다.');
            return;
        }
        if (!ensurePayslipIssueReady(filteredPaymentData, '일괄 개별 Excel 다운로드')) return;
        if (
            filteredPaymentData.length > 50
            && !window.confirm(`총 ${filteredPaymentData.length}명의 개별 Excel 명세서를 생성합니다. 계속 진행하시겠습니까?`)
        ) {
            return;
        }

        setBatchExcelDownloading(true);
        try {
            const zip = new JSZip();
            const { fileNames } = appendPayslipWorkbooksToZip(
                zip,
                filteredPaymentData,
                resolvedPayslipContractorName
            );
            if (fileNames.length === 0) throw new Error('생성된 Excel 명세서가 없습니다.');

            const content = await zip.generateAsync({
                type: 'blob',
                compression: 'DEFLATE',
                compressionOptions: { level: 6 },
            });
            const selectedTeamName = selectedTeamId
                ? teams.find((team) => team.id === selectedTeamId)?.name || '선택팀'
                : '전체';
            const safeArchiveName = `노임명세서_일괄개별Excel_${rangeLabel || currentYearMonth}_${selectedTeamName}`
                .replace(/[\\/:*?"<>|]/g, '_');
            saveAs(content, `${safeArchiveName}.zip`);
        } catch (error) {
            console.error('[MonthlyWageDraftPage] batch individual Excel download failed:', error);
            alert('개별 Excel 일괄 다운로드 중 오류가 발생했습니다.');
        } finally {
            setBatchExcelDownloading(false);
        }
    }, [
        batchExcelDownloading,
        currentYearMonth,
        ensurePayslipIssueReady,
        filteredPaymentData,
        rangeLabel,
        resolvedPayslipContractorName,
        selectedTeamId,
        teams,
    ]);

    const [batchDownloading, setBatchDownloading] = useState(false);
    const batchRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

    const handleDownloadImage = async () => {
        if (!printRef.current || !payslipTarget) return;
        if (!ensurePayslipIssueReady([payslipTarget], '파일 저장')) return;

        try {
            const canvas = await (html2canvas as any)(printRef.current, {
                scale: 2, // Higher quality for file download
                backgroundColor: '#ffffff',
                logging: false,
                useCORS: true
            });

            canvas.toBlob((blob: Blob | null) => {
                if (!blob) {
                    alert('이미지 생성에 실패했습니다.');
                    return;
                }
                saveAs(blob, `노임명세서_${payslipTarget.workerName}_${payslipTarget.month}.png`);
            }, 'image/png');
        } catch (error) {
            console.error('Download failed:', error);
            alert('다운로드 중 오류가 발생했습니다.');
        }
    };

    const handleBatchDownload = async () => {
        if (filteredPaymentData.length === 0) {
            alert('다운로드할 데이터가 없습니다.');
            return;
        }

        if (!ensurePayslipIssueReady(filteredPaymentData, '일괄 다운로드')) {
            return;
        }

        if (filteredPaymentData.length > 50 && !window.confirm(`총 ${filteredPaymentData.length}명의 명세서를 생성합니다. 시간이 다소 소요될 수 있습니다. 진행하시겠습니까?`)) {
            return;
        }

        setBatchDownloading(true);

        // batchDownloading=true 설정 후 React가 PayslipTemplate들을 마운트할 때까지 대기
        await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

        const zip = new JSZip();

        try {
            let processedCount = 0;

            // Process sequentially to avoid browser freeze
            for (const item of filteredPaymentData) {
                const elementKey = item.id;
                const element = batchRefs.current[elementKey];
                if (!element) continue;

                const canvas = await (html2canvas as any)(element, {
                    scale: 1.5,
                    backgroundColor: '#ffffff',
                    logging: false,
                    useCORS: true
                });

                const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
                if (blob) {
                    const cleanWorkerName = (item.workerName || '').replace(/[0-9]/g, '');
                    zip.file(`${cleanWorkerName}_${item.month}.png`, blob);
                    processedCount++;
                }
            }

            if (processedCount === 0) {
                alert('이미지 생성에 실패했습니다.');
                setBatchDownloading(false);
                return;
            }

            const content = await zip.generateAsync({ type: 'blob' });
            saveAs(content, `노임명세서_${rangeLabel || currentYearMonth}_${selectedTeamId ? teams.find(t => t.id === selectedTeamId)?.name : '전체'}.zip`);

        } catch (error) {
            console.error('Batch download failed:', error);
            alert('일괄 다운로드 중 오류가 발생했습니다.');
        } finally {
            setBatchDownloading(false);
        }
    };

    const normalizeManualInputForSettlement = (
        input: LedgerManualInput | undefined
    ): MonthlyPayrollSavedManualInput => {
        const emptySide = {
            carry: 0,
            carrySecond: 0,
            currentAdvance: 0,
            currentAdvanceSecond: 0,
            lodging: 0,
            electricity: 0,
            gas: 0,
            water: 0,
            internet: 0,
            management: 0,
            fine: 0,
            other: 0,
        };

        return {
            invoice: { ...emptySide, ...(input?.invoice ?? {}) },
            labor: { ...emptySide, ...(input?.labor ?? {}) },
            personalMemo: String(input?.personalMemo ?? ''),
            assignmentType: input?.assignmentType,
            allocationMode: input?.allocationMode ?? 'split',
            itemAssignments: { ...(input?.itemAssignments ?? {}) },
        };
    };

    const handleSavePayrollSettlement = async () => {
        if (filterMode === 'worker') {
            alert('정산 저장은 팀 모드에서 진행해 주세요. 개인 저장은 팀 전체 저장본을 덮어쓸 수 있어 제한됩니다.');
            return;
        }
        if (filteredPaymentData.length === 0) {
            alert('저장할 정산 데이터가 없습니다. 기간과 팀을 선택한 뒤 조회해 주세요.');
            return;
        }
        if (deductionApplyInProgress) {
            alert('급여 계산이 끝난 뒤 저장해 주세요.');
            return;
        }

        const grouped = new Map<string, {
            year: number;
            yearMonth: string;
            teamId: string;
            teamName: string;
            rows: MonthlyPayrollSettlementSaveInput['rows'];
            hasBusinessIncome: boolean;
            hasLaborTax: boolean;
        }>();

        filteredPaymentData.forEach((item) => {
            const yearMonth = String(item.month ?? '').trim();
            const teamId = String(item.teamId ?? '').trim();
            if (!yearMonth || !teamId || !monthRangeSet.has(yearMonth)) return;

            const salaryModel = item.id.endsWith('__일급제')
                ? '일급제'
                : item.id.endsWith('__용역팀')
                    ? '용역팀'
                    : '월급제';
            const ledgerRow = ledgerRows.find((row) => (
                row.month === yearMonth
                && row.workerId === item.workerId
                && row.teamId === teamId
                && String(row.salaryModel ?? '월급제') === salaryModel
            ));
            const rowKey = ledgerRow?.rowKey || item.id;
            const computedAmount = ledgerComputedAmountByRowKey.get(rowKey);
            const manualInput = normalizeManualInputForSettlement(
                ledgerInputs[rowKey]
                ?? initialLedgerInputs[rowKey]
                ?? ledgerRow?.manual
            );

            const businessIncomeAppliedAmount = Math.max(
                0,
                toNumber(item.businessIncomeAppliedSummary?.appliedAmount)
            );
            const businessIncomeAppliedManDay = Math.max(
                0,
                toNumber(item.businessIncomeAppliedSummary?.appliedManDay)
            );
            const incomeTaxRate = Math.max(
                0,
                toNumber(item.taxRateSnapshot?.businessIncomeTaxRate ?? BUSINESS_INCOME_TAX_RATE)
            );
            const residentTaxRate = Math.max(
                0,
                toNumber(item.taxRateSnapshot?.businessResidentTaxRate ?? BUSINESS_RESIDENT_TAX_RATE)
            );
            const incomeTax = floorWon(businessIncomeAppliedAmount * incomeTaxRate);
            const residentTax = floorWon(businessIncomeAppliedAmount * residentTaxRate);
            const rowDisplay = rowDisplayCache.get(item.id);
            const personalDeduction = Math.max(
                0,
                toNumber(rowDisplay?.deductionBreakdownForDisplay.total ?? item.deductionBreakdown?.total)
            );
            const taxDeduction = Math.max(0, toNumber(rowDisplay?.taxTotalForDisplay));
            const totalDeduction = rowDisplay
                ? Math.max(0, toNumber(rowDisplay.totalDeductionForDisplay))
                : personalDeduction + taxDeduction;
            const netAmount = rowDisplay
                ? toNumber(rowDisplay.totalAmountForDisplay)
                : toNumber(item.totalAmount);
            const paymentSnapshot = {
                ...item,
                totalDeduction,
                totalAmount: netAmount,
                deductionBreakdown: rowDisplay?.deductionBreakdownForDisplay ?? item.deductionBreakdown,
            };
            const groupKey = `${yearMonth}__${teamId}`;
            const group = grouped.get(groupKey) ?? {
                year: Number(yearMonth.slice(0, 4)),
                yearMonth,
                teamId,
                teamName: String(item.teamName ?? '').trim() || '미지정 팀',
                rows: [],
                hasBusinessIncome: false,
                hasLaborTax: false,
            };

            group.rows.push({
                rowKey,
                yearMonth,
                teamId,
                teamName: group.teamName,
                workerId: String(item.workerId ?? '').trim(),
                workerName: String(item.workerName ?? '').trim(),
                salaryModel,
                grossAmount: Math.max(0, toNumber(item.grossAmount)),
                netAmount,
                invoiceGrossAmount: computedAmount?.invoiceGrossAmount
                    ?? Math.max(0, toNumber(item.invoiceGrossAmount)),
                laborGrossAmount: computedAmount?.laborGrossAmount
                    ?? Math.max(0, toNumber(item.laborGrossAmount)),
                invoiceNetAmount: computedAmount?.corporateNet
                    ?? resolveDisplayInvoiceNetAmount(item),
                laborNetAmount: computedAmount?.personalNet
                    ?? resolveDisplayLaborNetAmount(item),
                totalManDay: Math.max(0, toNumber(item.totalManDay)),
                unitPrice: Math.max(0, toNumber(item.unitPrice)),
                personalDeduction,
                taxDeduction,
                totalDeduction,
                isValid: Boolean(item.isValid),
                paymentSnapshot,
                manualInput,
                businessIncome: {
                    appliedAmount: businessIncomeAppliedAmount,
                    appliedManDay: businessIncomeAppliedManDay,
                    incomeTax,
                    residentTax,
                    totalTax: incomeTax + residentTax,
                    incomeTaxRate,
                    residentTaxRate,
                },
            });
            group.hasBusinessIncome = group.hasBusinessIncome || businessIncomeAppliedAmount > 0;
            group.hasLaborTax = group.hasLaborTax
                || toNumber(item.insuranceAppliedSummary?.appliedAmount) > 0
                || toNumber(item.withholdingAppliedSummary?.appliedAmount) > 0;
            grouped.set(groupKey, group);
        });

        const settlements: MonthlyPayrollSettlementSaveInput[] = Array.from(grouped.values()).map((group) => {
            const businessIncomeAppliedAmount = group.rows.reduce(
                (sum, row) => sum + row.businessIncome.appliedAmount,
                0
            );
            const businessIncomeTaxAmount = group.rows.reduce(
                (sum, row) => sum + row.businessIncome.totalTax,
                0
            );
            return {
                year: group.year,
                yearMonth: group.yearMonth,
                teamId: group.teamId,
                teamName: group.teamName,
                reportingType: group.hasBusinessIncome
                    ? (group.hasLaborTax ? 'mixed' : 'business_income')
                    : 'labor',
                calculationOptions: {
                    insuranceApplied,
                    insuranceTeamSiteOnly,
                    businessIncomeApplied,
                    utilitiesApplied,
                    dailyFeeApplied,
                },
                businessIncomeAppliedAmount,
                businessIncomeTaxAmount,
                rows: group.rows,
            };
        });

        if (settlements.length === 0) {
            alert('저장 가능한 팀별 정산 데이터가 없습니다.');
            return;
        }

        setPayrollSettlementSaving(true);
        setPayrollSettlementFeedback('정산을 저장하고 있습니다...');
        try {
            await monthlyPayrollSettlementService.saveSettlements(settlements, {
                uid: currentUser?.uid,
                name: currentUser?.displayName || currentUser?.email,
            });

            const years = Array.from(new Set(settlements.map((settlement) => settlement.year)));
            const refreshed = (await Promise.all(
                years.map((year) => monthlyPayrollSettlementService.getSettlementsByYear(year))
            ))
                .flat()
                .filter((settlement) => monthRangeSet.has(settlement.yearMonth));
            setSavedPayrollSettlements(refreshed);

            const businessTotal = settlements.reduce(
                (sum, settlement) => sum + settlement.businessIncomeAppliedAmount,
                0
            );
            const savedAt = new Intl.DateTimeFormat('ko-KR', {
                hour: '2-digit',
                minute: '2-digit',
            }).format(new Date());
            setPayrollSettlementFeedback(
                `${settlements.length}개 팀 저장 완료 · 사업소득 적용 ${businessTotal.toLocaleString()}원 · ${savedAt}`
            );
        } catch (error) {
            console.error('[MonthlyWageDraftPage] settlement save failed:', error);
            setPayrollSettlementFeedback('정산 저장에 실패했습니다.');
            alert('정산 저장 중 오류가 발생했습니다. 권한과 네트워크 상태를 확인해 주세요.');
        } finally {
            setPayrollSettlementSaving(false);
        }
    };

    const payrollScopeKeys = useMemo(() => new Set(
        filteredPaymentData
            .map((item) => {
                const yearMonth = String(item.month ?? '').trim();
                const teamId = String(item.teamId ?? '').trim();
                return yearMonth && teamId ? `${yearMonth}__${teamId}` : '';
            })
            .filter(Boolean)
    ), [filteredPaymentData]);

    const scopedPayrollSettlements = useMemo(() => (
        savedPayrollSettlements.filter((settlement) => (
            payrollScopeKeys.has(`${settlement.yearMonth}__${settlement.teamId}`)
        ))
    ), [payrollScopeKeys, savedPayrollSettlements]);

    const simplePayrollRunStatus = useMemo(() => {
        if (payrollScopeKeys.size === 0 || scopedPayrollSettlements.length < payrollScopeKeys.size) {
            return 'unsaved' as const;
        }

        const statuses = new Set(scopedPayrollSettlements.map((settlement) => settlement.runStatus));
        if (statuses.size !== 1) return 'mixed' as const;
        return Array.from(statuses)[0] as MonthlyPayrollRunStatus;
    }, [payrollScopeKeys, scopedPayrollSettlements]);

    const reloadPayrollSettlements = useCallback(async () => {
        const years = Array.from(new Set(
            monthRange
                .map((yearMonth) => Number(yearMonth.slice(0, 4)))
                .filter((year) => Number.isFinite(year) && year > 0)
        ));
        if (years.length === 0) {
            setSavedPayrollSettlements([]);
            return;
        }

        const refreshed = (await Promise.all(
            years.map((year) => monthlyPayrollSettlementService.getSettlementsByYear(year))
        ))
            .flat()
            .filter((settlement) => monthRangeSet.has(settlement.yearMonth));
        setSavedPayrollSettlements(refreshed);
    }, [monthRange, monthRangeSet]);

    const handlePayrollRunTransition = async (nextStatus: Exclude<MonthlyPayrollRunStatus, 'draft'>) => {
        if (filterMode === 'worker') {
            alert('급여 상태 변경은 팀 모드에서만 할 수 있습니다.');
            return;
        }
        if (simplePayrollRunStatus === 'mixed') {
            alert('선택 범위에 서로 다른 급여 상태가 있습니다. 월 또는 팀을 나누어 처리해 주세요.');
            return;
        }
        if (scopedPayrollSettlements.length === 0) {
            alert('먼저 급여 초안을 저장해 주세요.');
            return;
        }
        if (nextStatus === 'confirmed') {
            const issues = simplePayrollClosingRows.filter((row) => !row.isValid || row.netAmount < 0);
            if (issues.length > 0) {
                alert(`계좌 정보 또는 실지급액을 확인해야 하는 작업자가 ${issues.length}명 있습니다.`);
                return;
            }
        }

        const actionLabel = nextStatus === 'reviewed'
            ? '검토 완료'
            : nextStatus === 'confirmed'
                ? '급여 확정'
                : '지급 완료';
        const message = nextStatus === 'confirmed'
            ? '급여를 확정하면 저장된 급여 스냅샷을 수정할 수 없습니다. 진행할까요?'
            : nextStatus === 'paid'
                ? '실제 지급이 완료되었습니까? 지급 완료 후에는 과거 급여를 수정할 수 없습니다.'
                : '현재 저장된 급여 초안을 검토 완료로 표시할까요?';
        if (!window.confirm(message)) return;

        setPayrollSettlementSaving(true);
        setPayrollSettlementFeedback(`${actionLabel} 처리 중...`);
        try {
            await monthlyPayrollSettlementService.transitionRunStatus(
                scopedPayrollSettlements.map((settlement) => settlement.id || ''),
                nextStatus,
                {
                    uid: currentUser?.uid,
                    name: currentUser?.displayName || currentUser?.email,
                }
            );
            await reloadPayrollSettlements();
            setPayrollSettlementFeedback(`${actionLabel} 처리 완료`);
        } catch (error) {
            console.error('[MonthlyWageDraftPage] payroll run transition failed:', error);
            const message = error instanceof Error ? error.message : '급여 상태 저장 중 오류가 발생했습니다.';
            setPayrollSettlementFeedback('급여 상태 저장에 실패했습니다.');
            alert(message);
        } finally {
            setPayrollSettlementSaving(false);
        }
    };

    const insuranceConfigView = payrollConfig?.insuranceConfig;
    const insuranceThresholdDays = Math.max(0, Math.floor(toNumber(insuranceConfigView?.thresholdDays ?? 8)));
    const withholdingApplyAllLaborView =
        typeof insuranceConfigView?.withholdingApplyAllLabor === 'boolean' ? insuranceConfigView.withholdingApplyAllLabor : true;
    const employmentApplyBelowThresholdView =
        typeof insuranceConfigView?.employmentApplyBelowThreshold === 'boolean' ? insuranceConfigView.employmentApplyBelowThreshold : true;
    const withholdingBaseDeductionWonView = Math.max(0, Math.floor(toNumber(insuranceConfigView?.withholdingBaseDeduction ?? 150000)));
    const withholdingIncomeRatePercentView = Math.round(
        toNumber(insuranceConfigView?.withholdingIncomeTaxRate ?? payrollConfig?.incomeTaxRate ?? 0.06) * 10000
    ) / 100;
    const withholdingResidentRatePercentView = Math.round(
        toNumber(insuranceConfigView?.withholdingResidentTaxRate ?? payrollConfig?.residentTaxRate ?? 0.1) * 10000
    ) / 100;
    const withholdingTaxCreditPercentView = Math.round(
        toNumber(insuranceConfigView?.withholdingIncomeBaseMultiplier ?? 0.55) * 10000
    ) / 100;
    const dailyWorkerFeePerManDayView = Math.max(0, Math.floor(toNumber(insuranceConfigView?.dailyWorkerFeePerManDay ?? 0)));


    return (
        <div className="relative h-full flex flex-col p-2 w-full overflow-hidden">
            <style>{`
                @media screen {
                    #monthly-payslip-print-root {
                        display: none !important;
                    }
                }

                @media print {
                    @page {
                        size: A4 landscape;
                        margin: 8mm;
                    }

                    html,
                    body {
                        margin: 0 !important;
                        padding: 0 !important;
                        width: 100% !important;
                        min-width: 0 !important;
                        overflow: visible !important;
                        background: #fff !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }

                    body > *:not(#monthly-payslip-print-root) {
                        display: none !important;
                    }

                    #monthly-payslip-print-root {
                        display: block !important;
                        position: static !important;
                        width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        background: #fff !important;
                    }

                    .monthly-payslip-print-page {
                        display: block !important;
                        width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        break-after: page;
                        page-break-after: always;
                    }

                    .monthly-payslip-print-page:last-child {
                        break-after: auto;
                        page-break-after: auto;
                    }

                    .monthly-payslip-print-page .payslip-template-card {
                        width: 100% !important;
                        max-width: none !important;
                        margin: 0 !important;
                        border: 2px solid #e2e8f0 !important;
                        border-radius: 12px !important;
                        box-shadow: none !important;
                        color: #0f172a !important;
                        background: #fff !important;
                        font-family: "Malgun Gothic", "Noto Sans KR", sans-serif !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }

                    .monthly-payslip-print-page .payslip-template-details-grid {
                        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
                    }

                    .monthly-payslip-print-page table,
                    .monthly-payslip-print-page tr,
                    .monthly-payslip-print-page section {
                        break-inside: avoid !important;
                        page-break-inside: avoid !important;
                    }
                }
            `}</style>

            {payslipPrintRows.length > 0 && typeof document !== 'undefined' && createPortal(
                <div id="monthly-payslip-print-root" aria-hidden="true">
                    {payslipPrintRows.map((item, index) => (
                        <div
                            key={`print-${item.id}-${index}`}
                            className="monthly-payslip-print-page"
                            data-worker-name={item.workerName}
                        >
                            <PayslipTemplate
                                data={item}
                                month={item.month}
                                contractorName={resolvedPayslipContractorName}
                                applyUtilities={utilitiesApplied}
                                insuranceTeamSiteOnly={insuranceTeamSiteOnly}
                                isTeamResponsibleSiteEntry={isEntryInWorkerTeamSite}
                            />
                        </div>
                    ))}
                </div>,
                document.body
            )}

            {deductionApplyInProgress && (
                <div className="absolute inset-0 z-[100] pointer-events-none bg-white/50 backdrop-blur-sm flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3 bg-white p-6 rounded-2xl shadow-xl border border-slate-100">
                        <FontAwesomeIcon icon={faSpinner} className="animate-spin text-4xl text-blue-600" />
                        <span className="text-slate-600 font-semibold text-lg">급여 계산을 적용하고 있습니다...</span>
                    </div>
                </div>
            )}


            {!hideHeader && (
                <PayrollToolbar
                    hideHeader={!!hideHeader}
                    rangeLabel={rangeLabel}
                    targetCount={pageViewMode === 'ledger' ? filteredLedgerRows.length : filteredPaymentData.length}
                    monthRangeLength={monthRange.length}
                    totalLoadCount={paymentData.length}
                    monthSelectionMode={monthSelectionMode}
                    handleMonthModeChange={handleMonthModeChange}
                    yearCursor={yearCursor}
                    setYearCursor={setYearCursor}
                    shiftYearMonth={shiftYearMonth}
                    formatYearMonthParts={formatYearMonthParts}
                    handleSelectPrevMonth={handleSelectPrevMonth}
                    handleSelectCurrentMonth={handleSelectCurrentMonth}
                    monthRangeSet={monthRangeSet}
                    startMonth={startMonth}
                    endMonth={endMonth}
                    rangeAnchorMonth={rangeAnchorMonth}
                    handleMonthButtonSelect={handleMonthButtonSelect}
                    teamDropdownRef={teamDropdownRef}
                    teamDropdownOpen={teamDropdownOpen}
                    setTeamDropdownOpen={setTeamDropdownOpen}
                    selectedTeamLabel={selectedTeamLabel}
                    selectedTeamId={selectedTeamId}
                    setSelectedTeamId={setSelectedTeamId}
                    teams={teams}
                    filterMode={filterMode}
                    setFilterMode={setFilterMode}
                    selectedWorkerId={selectedWorkerId}
                    setSelectedWorkerId={setSelectedWorkerId}
                    workerOptions={workerOptions}
                    workerSearchText={workerSearchText}
                    setWorkerSearchText={setWorkerSearchText}
                    pageViewMode={pageViewMode}
                    setPageViewMode={setPageViewMode}
                    ledgerSalaryModelFilter={ledgerSalaryModelFilter}
                    setLedgerSalaryModelFilter={setLedgerSalaryModelFilter}
                    ledgerVisibleSections={ledgerVisibleSections}
                    setLedgerVisibleSections={setLedgerVisibleSections}
                    showAccountColumns={showAccountColumns}
                    setShowAccountColumns={setShowAccountColumns}
                    showCalculationLabor={showCalculationLabor}
                    setShowCalculationLabor={setShowCalculationLabor}
                    insuranceApplied={insuranceApplied}
                    insuranceTeamSiteOnly={insuranceTeamSiteOnly}
                    businessIncomeApplied={businessIncomeApplied}
                    utilitiesApplied={utilitiesApplied}
                    dailyFeeApplied={dailyFeeApplied}
                    applyCalculatedDeductions={applyCalculatedDeductions}
                    insuranceThresholdDays={insuranceThresholdDays}
                    withholdingApplyAllLaborView={withholdingApplyAllLaborView}
                    WITHHOLDING_MAX_MAN_DAY={WITHHOLDING_MAX_MAN_DAY}
                    withholdingBaseDeductionWonView={withholdingBaseDeductionWonView}
                    withholdingIncomeRatePercentView={withholdingIncomeRatePercentView}
                    withholdingTaxCreditPercentView={withholdingTaxCreditPercentView}
                    withholdingResidentRatePercentView={withholdingResidentRatePercentView}
                    employmentApplyBelowThresholdView={employmentApplyBelowThresholdView}
                    dailyWorkerFeePerManDayView={dailyWorkerFeePerManDayView}
                    fetchData={fetchData}
                    toolbarExpanded={toolbarExpanded}
                    setToolbarExpanded={setToolbarExpanded}
                    openInsuranceSettings={openInsuranceSettings}
                    setShowKBPreview={handleKBPreviewVisibilityChange}
                    isPaymentDataEmpty={paymentData.length === 0}
                    openPayslipPreview={openPayslipPreview}
                    handleBatchDownload={handleBatchDownload}
                    batchDownloading={batchDownloading}
                    advanceLedgerRef={advanceLedgerRef}
                    isLedgerRowsDataEmpty={ledgerRowsData.length === 0}
                    currentYearMonth={currentYearMonth}
                    handleSavePayrollSettlement={handleSavePayrollSettlement}
                    payrollSettlementSaving={payrollSettlementSaving}
                    payrollSettlementLoading={payrollSettlementLoading}
                    payrollSettlementFeedback={payrollSettlementFeedback}
                    payrollSettlementDisabled={
                        filterMode === 'worker'
                        || filteredPaymentData.length === 0
                        || deductionApplyInProgress
                        || simplePayrollRunStatus === 'reviewed'
                        || simplePayrollRunStatus === 'confirmed'
                        || simplePayrollRunStatus === 'paid'
                        || simplePayrollRunStatus === 'mixed'
                    }
                />
            )}

            {/* Hidden Batch Rendering Container - 다운로드 시에만 렌더링 (평소 불필요한 재렌더링 방지) */}
            {batchDownloading && (
                <div className="absolute left-[-9999px] top-0 pointer-events-none opacity-0 w-[1120px]">
                    {filteredPaymentData.map(item => (
                        <PayslipTemplate
                            key={`batch-${item.id}`}
                            ref={el => {
                                const elementKey = item.id;
                                batchRefs.current[elementKey] = el;
                            }}
                            data={item}
                            month={item.month}
                            contractorName={resolvedPayslipContractorName}
                            applyUtilities={utilitiesApplied}
                            insuranceTeamSiteOnly={insuranceTeamSiteOnly}
                            isTeamResponsibleSiteEntry={isEntryInWorkerTeamSite}
                        />
                    ))}
                </div>
            )}

            {errorCount > 0 && (
                <div className="flex-shrink-0 mb-2 bg-red-50 border border-red-200 text-red-700 px-2.5 py-2 rounded-lg flex items-center gap-1.5 text-base">
                    <FontAwesomeIcon icon={faExclamationTriangle} className="text-red-500" />
                    <span><strong>{errorCount}건</strong>의 계좌 정보가 누락되었습니다. 작업자 DB를 점검해주세요.</span>
                </div>
            )}

            {pageViewMode === 'standard' && (
                <div className="flex-1 min-h-0 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                <div className="p-2.5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <div className="flex items-center gap-2.5">
                        <h2 className="font-semibold text-lg text-slate-700">지급 대상자 목록</h2>
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={bulkDisplayContent}
                                onChange={(e) => setBulkDisplayContent(e.target.value)}
                                placeholder="표시내용 일괄입력"
                                className="border border-slate-300 rounded px-3 py-2 text-base w-40"
                            />
                            <button
                                onClick={handleBulkDisplayContentApply}
                                className="bg-slate-600 text-white px-3.5 py-2 rounded text-base hover:bg-slate-700"
                            >
                                일괄적용
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowBankCodes(true)}
                                className="bg-blue-600 text-white px-3.5 py-2 rounded text-base hover:bg-blue-700"
                                title="은행 코드 매핑표/미매핑 사유 확인"
                            >
                                은행 매핑 진단
                            </button>
                        </div>
                    </div>
                    <div className="text-base flex items-center gap-2.5">
                        <div>
                            <span className="text-slate-500 mr-2">총공수</span>
                            <span className="font-bold text-slate-800">{filteredPaymentData.reduce((sum, item) => sum + item.totalManDay, 0).toFixed(1)}</span>
                        </div>
                        <div>
                            <span className="text-slate-500 mr-2">지급전</span>
                            <span className="font-bold text-slate-800">{filteredPaymentData.reduce((sum, item) => sum + item.grossAmount, 0).toLocaleString()}원</span>
                        </div>
                        <div>
                            <span className="text-slate-500 mr-2">공제</span>
                            <span className="font-bold text-amber-700">{filteredPaymentData.reduce((sum, item) => sum + item.totalDeduction, 0).toLocaleString()}원</span>
                        </div>
                        <div>
                            <span className="text-slate-500 mr-2">실지급</span>
                            <span className="font-bold text-brand-600 text-lg">{filteredPaymentData.reduce((sum, item) => sum + item.totalAmount, 0).toLocaleString()}원</span>
                        </div>
                        <div className="mx-2 w-px h-8 bg-slate-200 hidden xl:block" />
                        <div className="bg-blue-50 px-2 py-1 rounded-lg border border-blue-100">
                            <span className="text-blue-600 text-base font-semibold mr-2">계산서용 입금</span>
                            <span className="font-bold text-blue-800">{filteredPaymentData.reduce((sum, item) => sum + item.invoiceNetAmount, 0).toLocaleString()}원</span>
                        </div>
                        <div className="bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-100">
                            <span className="text-indigo-600 text-base font-semibold mr-2">노무용 금액</span>
                            <span className="font-bold text-indigo-800">{filteredPaymentData.reduce((sum, item) => sum + item.laborNetAmount, 0).toLocaleString()}원</span>
                        </div>
                    </div>
                </div>

                <div className="flex-1 min-h-0 overflow-auto">
                    <table
                        className="w-full table-fixed text-[13px] text-left border-separate border-spacing-0"
                    >
                        <thead className="text-slate-500 font-medium sticky top-0 z-40">
                            <tr className="border-b border-slate-200">
                                <th className="sticky top-0 left-0 z-50 bg-slate-50 px-2 py-1.5 text-center w-10 border-b border-slate-200 shadow-[inset_-1px_-1px_0_rgba(0,0,0,0.1)]"></th>
                                <th className="sticky top-0 left-[40px] z-50 bg-slate-50 px-2 py-1.5 border-b border-slate-200 w-16 shadow-[inset_0_-1px_0_rgba(0,0,0,0.1)]">월</th>
                                <th className="sticky top-0 left-[104px] z-50 bg-slate-50 px-2 py-1.5 border-b border-slate-200 w-32 shadow-[inset_-1px_-1px_0_rgba(0,0,0,0.1)]">이름</th>
                                <th className="sticky top-0 z-40 bg-slate-50 px-2 py-1.5 border-b border-slate-200 shadow-[inset_0_-1px_0_rgba(0,0,0,0.1)]">팀명</th>
                                <th className="sticky top-0 z-40 bg-slate-50 px-2 py-1.5 border-b border-slate-200 shadow-[inset_0_-1px_0_rgba(0,0,0,0.1)]">주민번호</th>
                                <th className="sticky top-0 z-40 bg-slate-50 px-2 py-1.5 border-b border-slate-200 shadow-[inset_0_-1px_0_rgba(0,0,0,0.1)]">시공사</th>
                                <th className="sticky top-0 z-40 bg-slate-50 px-2 py-1.5 border-b border-slate-200 shadow-[inset_0_-1px_0_rgba(0,0,0,0.1)]">총 공수</th>
                                <th className="sticky top-0 z-40 bg-slate-50 px-2 py-1.5 text-right border-b border-slate-200 shadow-[inset_0_-1px_0_rgba(0,0,0,0.1)]">단가</th>
                                <th className="sticky top-0 z-40 bg-slate-50 px-2 py-1.5 text-right border-b border-slate-200 shadow-[inset_0_-1px_0_rgba(0,0,0,0.1)]">지급전</th>
                                {showCalculationLabor && (
                                    <>
                                        <th className="sticky top-0 z-40 px-2 py-1.5 text-center bg-blue-50 text-blue-700 border-b border-slate-200 shadow-[inset_0_-1px_0_rgba(0,0,0,0.1)]">계산서 공수</th>
                                        <th className="sticky top-0 z-40 px-2 py-1.5 text-right bg-blue-50 text-blue-700 border-b border-slate-200 shadow-[inset_0_-1px_0_rgba(0,0,0,0.1)]">계산서 금액</th>
                                        <th className="sticky top-0 z-40 px-2 py-1.5 text-center bg-indigo-50 text-indigo-700 border-b border-slate-200 shadow-[inset_0_-1px_0_rgba(0,0,0,0.1)]">노무 공수</th>
                                        <th className="sticky top-0 z-40 px-2 py-1.5 text-right bg-indigo-50 text-indigo-700 border-b border-slate-200 shadow-[inset_0_-1px_0_rgba(0,0,0,0.1)]">노무 금액</th>
                                    </>
                                )}
                                <th className="sticky top-0 z-40 bg-slate-50 px-2 py-1.5 text-right border-b border-slate-200 shadow-[inset_0_-1px_0_rgba(0,0,0,0.1)]">공제</th>
                                <th className="sticky top-0 z-40 bg-slate-50 px-2 py-1.5 text-right border-b border-slate-200 shadow-[inset_0_-1px_0_rgba(0,0,0,0.1)]">실지급</th>
                                {showAccountColumns && (
                                    <>
                                        <th className="sticky top-0 z-40 bg-slate-50 px-2 py-1.5 border-b border-slate-200 shadow-[inset_0_-1px_0_rgba(0,0,0,0.1)]">
                                            코드
                                            <button
                                                type="button"
                                                onClick={() => setShowBankCodes(true)}
                                                className="ml-1 text-xs text-blue-600 hover:text-blue-800"
                                            >
                                                📋
                                            </button>
                                        </th>
                                        <th className="sticky top-0 z-40 bg-slate-50 px-2 py-1.5 border-b border-slate-200 shadow-[inset_0_-1px_0_rgba(0,0,0,0.1)]">은행명</th>
                                        <th className="sticky top-0 z-40 bg-slate-50 px-2 py-1.5 border-b border-slate-200 shadow-[inset_0_-1px_0_rgba(0,0,0,0.1)]">계좌번호</th>
                                        <th className="sticky top-0 z-40 bg-slate-50 px-2 py-1.5 border-b border-slate-200 shadow-[inset_0_-1px_0_rgba(0,0,0,0.1)]">예금주</th>
                                    </>
                                )}
                                <th className="sticky top-0 z-40 bg-slate-50 px-2 py-1.5 border-b border-slate-200 shadow-[inset_0_-1px_0_rgba(0,0,0,0.1)]">표시내용</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={tableColSpan} className="px-2 py-8 text-center text-slate-500">
                                        <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />
                                        데이터를 불러오는 중입니다...
                                    </td>
                                </tr>
                            ) : filteredPaymentData.length === 0 ? (
                                <tr>
                                    <td colSpan={tableColSpan} className="px-2 py-8 text-center text-slate-500">
                                        해당 기간에 지급 대상자가 없습니다.
                                    </td>
                                </tr>
                            ) : (
                                filteredPaymentData.map(item => {
                                    const rowKey = item.id;
                                    const isExpanded = expandedRows.has(rowKey);
                                    // ★ 캐시에서 표시 데이터 조회 - O(1), 재계산 없음
                                    const rowDisplay = rowDisplayCache.get(item.id);
                                    if (!rowDisplay) return null;
                                    const {
                                        advanceLinesForDisplay,
                                        nonAdvanceDeductionLinesForDisplay,
                                        advanceTotalForDisplay,
                                        nonAdvanceDeductionTotalForDisplay,
                                        hasNonAdvanceDeductionLines,
                                        hasAdvanceLines,
                                        totalDeductionForDisplay,
                                        totalAmountForDisplay,
                                        insuranceTaxLines,
                                        withholdingTaxLines,
                                        businessTaxLines,
                                        otherTaxLines,
                                        insuranceSectionTaxTotal,
                                        withholdingSectionTaxTotal,
                                        businessSectionTaxTotal,
                                        otherTaxTotal,
                                        insuranceAfterTaxAmount,
                                        withholdingAfterTaxAmount,
                                        businessAfterTaxAmount,
                                        showInsuranceSection,
                                        hasInsuranceTargetSummary,
                                        withholdingDetailText,
                                    } = rowDisplay;

                                    const isMonthly = item.id.endsWith('__월급제');
                                    const isService = item.id.endsWith('__용역팀');
                                    const salaryLabel = isMonthly ? '월급제' : isService ? '용역팀' : '일급제';
                                    
                                    const rowBgClass = isMonthly 
                                        ? 'bg-blue-50/25 hover:bg-blue-50/40' 
                                        : isService 
                                            ? 'bg-orange-50/25 hover:bg-orange-50/40' 
                                            : 'bg-emerald-50/25 hover:bg-emerald-50/40';

                                    const badgeClass = isMonthly 
                                        ? 'bg-blue-100 text-blue-700' 
                                        : isService 
                                            ? 'bg-orange-100 text-orange-700' 
                                            : 'bg-emerald-100 text-emerald-700';

                                    return (
                                        <React.Fragment key={rowKey}>
                                            <tr className={`transition ${rowBgClass} ${!item.isValid ? 'bg-red-50' : ''} ${isExpanded ? 'ring-1 ring-indigo-200' : ''}`}>
                                                <td className="sticky left-0 z-20 bg-inherit px-2 py-1.5 text-center border-b border-slate-100 shadow-[inset_-1px_0_0_rgba(0,0,0,0.1)]">
                                                    <button
                                                        onClick={() => toggleRow(item.id)}
                                                        className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors ${isExpanded ? 'bg-brand-100 text-brand-600' : 'text-slate-400 hover:bg-slate-100'}`}
                                                    >
                                                        <FontAwesomeIcon icon={isExpanded ? faChevronUp : faChevronDown} className="text-xs" />
                                                    </button>
                                                </td>
                                                <td className="sticky left-[40px] z-20 bg-inherit px-2 py-1.5 font-mono text-slate-600 text-[11px] border-b border-slate-100">{item.month}</td>
                                                <td className="sticky left-[104px] z-20 bg-inherit px-2 py-1.5 font-medium text-slate-800 border-b border-slate-100 shadow-[inset_-1px_0_0_rgba(0,0,0,0.1)]">
                                                    <div className="flex items-center gap-1.5">
                                                        <span>{item.workerName}</span>
                                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${badgeClass}`}>
                                                            {salaryLabel}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-2 py-1.5 text-slate-600 border-b border-slate-100">{item.teamName}</td>
                                                <td className="px-2 py-1.5 text-slate-600 font-mono text-[11px] border-b border-slate-100">{item.idNumber || '-'}</td>
                                                <td className="px-2 py-1.5 text-slate-600 border-b border-slate-100">{item.companyName || '-'}</td>
                                                <td className="px-2 py-1.5 text-slate-600 border-b border-slate-100">{Number(item.totalManDay).toFixed(1)}</td>
                                                <td className="px-2 py-1.5 text-right text-slate-600 border-b border-slate-100">{item.unitPrice.toLocaleString()}</td>
                                                <td className="px-2 py-1.5 text-right text-slate-600 border-b border-slate-100">{item.grossAmount.toLocaleString()}</td>
                                                {showCalculationLabor && (
                                                    <>
                                                        <td className="px-2 py-1.5 text-center text-blue-600 border-b border-slate-100 bg-blue-50/20">{item.invoiceManDay.toFixed(1)}</td>
                                                        <td className="px-2 py-1.5 text-right text-blue-600 border-b border-slate-100 bg-blue-50/20">{item.invoiceNetAmount.toLocaleString()}</td>
                                                        <td className="px-2 py-1.5 text-center text-indigo-600 border-b border-slate-100 bg-indigo-50/20">{item.laborManDay.toFixed(1)}</td>
                                                        <td className="px-2 py-1.5 text-right text-indigo-600 border-b border-slate-100 bg-indigo-50/20">{item.laborNetAmount.toLocaleString()}</td>
                                                    </>
                                                )}
                                                <td className="px-2 py-1.5 text-right text-amber-700 font-semibold border-b border-slate-100">{totalDeductionForDisplay.toLocaleString()}</td>
                                                <td className="px-2 py-1.5 text-right font-bold text-brand-600 border-b border-slate-100">{totalAmountForDisplay.toLocaleString()}</td>
                                                {showAccountColumns && (
                                                    <>
                                                        <td className={`px-2 py-1.5 border-b border-slate-100 ${item.errors.bankCode ? 'text-red-600 font-bold' : 'text-slate-600'}`}>
                                                            {resolveBankCode(item.bankName, item.bankCode) || `미매핑(${item.bankName || '은행명없음'})`}
                                                        </td>
                                                        <td className={`px-2 py-1.5 border-b border-slate-100 ${item.errors.bankName ? 'text-red-600 font-bold' : 'text-slate-600'}`}>{item.bankName || '(미입력)'}</td>
                                                        <td className={`px-2 py-1.5 border-b border-slate-100 ${item.errors.accountNumber ? 'text-red-600 font-bold' : 'text-slate-600'}`}>{item.accountNumber || '(미입력)'}</td>
                                                        <td className={`px-2 py-1.5 border-b border-slate-100 ${item.errors.accountHolder ? 'text-red-600 font-bold' : 'text-slate-600'}`}>{item.accountHolder || '(미입력)'}</td>
                                                    </>
                                                )}
                                                <td className="px-2 py-1.5 border-b border-slate-100">
                                                    <input
                                                        type="text"
                                                        value={item.displayContent}
                                                        onChange={(e) => handleDisplayContentChange(item.id, e.target.value)}
                                                        className="border border-slate-300 rounded px-2 py-1 text-xs w-full focus:border-brand-500 outline-none"
                                                    />
                                                </td>
                                            </tr>
                                            {isExpanded && (
                                                <tr>
                                                    <td colSpan={tableColSpan + 1} className="p-0 border-b border-slate-200 bg-slate-50/50">
                                                        <div className="p-4 pl-12">
                                                            <div className="flex flex-col xl:flex-row gap-6">
                                                                {/* 근무 내역 */}
                                                                <div className="flex-1 space-y-2">
                                                                    <div className="flex items-center justify-between">
                                                                        <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                                                            <span className="w-1 h-4 bg-brand-500 rounded-full"></span>
                                                                            근무내역
                                                                        </h4>
                                                                        <span className="text-xs text-slate-500 font-mono bg-white px-2 py-0.5 rounded border border-slate-200">
                                                                            총 {item.workEntries.length}건
                                                                        </span>
                                                                    </div>
                                                                    {item.workEntries.length > 0 ? (
                                                                        <div className="border border-slate-200 rounded-lg bg-white shadow-sm overflow-hidden">
                                                                            <table className="w-full text-xs">
                                                                                <thead className="bg-slate-50 text-slate-500">
                                                                                    <tr>
                                                                                        <th className="px-3 py-2 text-left font-medium border-b border-slate-100 w-24">일자</th>
                                                                                        <th className="px-3 py-2 text-left font-medium border-b border-slate-100 w-16">분류</th>
                                                                            <th className="px-3 py-2 text-left font-medium border-b border-slate-100">현장</th>
                                                                                        <th className="px-3 py-2 text-center font-medium border-b border-slate-100 w-16">구분</th>
                                                                                        <th className="px-3 py-2 text-right font-medium border-b border-slate-100 w-16">공수</th>
                                                                                        <th className="px-3 py-2 text-right font-medium border-b border-slate-100 w-24">단가</th>
                                                                                        <th className="px-3 py-2 text-right font-medium border-b border-slate-100 w-24">금액</th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody className="divide-y divide-slate-100">
                                                                                    {item.workEntries.map((entry: WorkerWorkEntry, idx: number) => (
                                                                                        <tr key={`${entry.date}-${idx}`} className="hover:bg-indigo-50/30">
                                                                                            <td className="px-3 py-2 font-mono text-slate-600">{entry.date}</td>
                                                                                            <td className="px-3 py-2">
                                                                                    {entry.assignmentType === 'corporate' ? (
                                                                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800">
                                                                                            법인
                                                                                        </span>
                                                                                    ) : entry.assignmentType === 'labor' ? (
                                                                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-800">
                                                                                            노무
                                                                                        </span>
                                                                                    ) : (
                                                                                        <span className="text-slate-400 text-center block">-</span>
                                                                                    )}
                                                                                </td>
                                                                                <td className="px-3 py-2 text-slate-700">{entry.siteName}</td>
                                                                                            <td className="px-3 py-2 text-center text-slate-500">{entry.paymentMethod || '-'}</td>
                                                                                            <td className="px-3 py-2 text-right font-medium text-slate-700">{entry.manDay.toFixed(1)}</td>
                                                                                            <td className="px-3 py-2 text-right text-slate-600">{entry.unitPrice.toLocaleString()}</td>
                                                                                            <td className="px-3 py-2 text-right font-medium text-slate-800">{(entry.amount || 0).toLocaleString()}</td>
                                                                                        </tr>
                                                                                    ))}
                                                                                </tbody>
                                                                                <tfoot className="bg-slate-50 font-semibold text-slate-700">
                                                                                    <tr>
                                                                                        <td colSpan={4} className="px-3 py-2 text-right">합계</td>
                                                                                        <td className="px-3 py-2 text-right text-indigo-600">{item.totalManDay.toFixed(1)}</td>
                                                                                        <td className="px-3 py-2"></td>
                                                                                        <td className="px-3 py-2 text-right text-indigo-600">{item.grossAmount.toLocaleString()}</td>
                                                                                    </tr>
                                                                                    {(item.laborGrossAmount > 0 && item.invoiceGrossAmount > 0) && (
                                                                                        <tr className="text-[10px] font-normal text-slate-500 bg-white border-t border-slate-100">
                                                                                            <td colSpan={6} className="px-3 py-1 text-right">
                                                                                                (노무용: {item.laborGrossAmount.toLocaleString()} / 계산서용: {item.invoiceGrossAmount.toLocaleString()})
                                                                                            </td>
                                                                                            <td></td>
                                                                                        </tr>
                                                                                    )}
                                                                                </tfoot>
                                                                            </table>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="p-4 border border-dashed border-slate-300 rounded-lg text-center text-xs text-slate-500 bg-white">
                                                                            근무내역이 없습니다.
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* 공제 내역 */}
                                                                <div className="flex-1 space-y-2">
                                                                    <div className="flex items-center justify-between">
                                                                        <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                                                            <span className="w-1 h-4 bg-amber-500 rounded-full"></span>
                                                                            공제내역
                                                                        </h4>
                                                                        <span className="text-xs text-slate-500 font-mono bg-white px-2 py-0.5 rounded border border-slate-200">
                                                                            총 {nonAdvanceDeductionLinesForDisplay.length}건
                                                                        </span>
                                                                    </div>
                                                                    {hasNonAdvanceDeductionLines ? (
                                                                        <div className="border border-slate-200 rounded-lg bg-white shadow-sm overflow-hidden">
                                                                            <table className="w-full text-xs">
                                                                                <thead className="bg-slate-50 text-slate-500">
                                                                                    <tr>
                                                                                        <th className="px-3 py-2 text-left font-medium border-b border-slate-100">항목</th>
                                                                                        <th className="px-3 py-2 text-right font-medium border-b border-slate-100 w-32">금액</th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody className="divide-y divide-slate-100">
                                                                                    {nonAdvanceDeductionLinesForDisplay.map((line, idx) => (
                                                                                        <tr key={`deduction-${line.label}-${idx}`} className="hover:bg-amber-50/30">
                                                                                            <td className="px-3 py-2 text-slate-700">{line.label}</td>
                                                                                            <td className="px-3 py-2 text-right text-red-600 font-medium">-{line.amount.toLocaleString()}</td>
                                                                                        </tr>
                                                                                    ))}
                                                                                </tbody>
                                                                                <tfoot className="bg-amber-50 font-bold text-amber-800">
                                                                                    <tr>
                                                                                        <td className="px-3 py-2 text-right">공제 합계</td>
                                                                                        <td className="px-3 py-2 text-right">-{nonAdvanceDeductionTotalForDisplay.toLocaleString()}</td>
                                                                                    </tr>
                                                                                </tfoot>
                                                                            </table>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="p-4 border border-dashed border-slate-300 rounded-lg text-center text-xs text-slate-500 bg-white">
                                                                            공제 내역이 없습니다.
                                                                        </div>
                                                                    )}

                                                                    <div className="flex items-center justify-between">
                                                                        <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                                                            <span className="w-1 h-4 bg-yellow-500 rounded-full"></span>
                                                                            가불내역
                                                                        </h4>
                                                                        <span className="text-xs text-slate-500 font-mono bg-white px-2 py-0.5 rounded border border-slate-200">
                                                                            총 {advanceLinesForDisplay.length}건
                                                                        </span>
                                                                    </div>
                                                                    {hasAdvanceLines ? (
                                                                        <div className="border border-yellow-200 rounded-lg bg-white shadow-sm overflow-hidden">
                                                                            <table className="w-full text-xs">
                                                                                <thead className="bg-yellow-50 text-yellow-800">
                                                                                    <tr>
                                                                                        <th className="px-3 py-2 text-left font-medium border-b border-yellow-100">항목</th>
                                                                                        <th className="px-3 py-2 text-right font-medium border-b border-yellow-100 w-32">금액</th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody className="divide-y divide-yellow-100">
                                                                                    {advanceLinesForDisplay.map((line, idx) => (
                                                                                        <tr key={`advance-${line.label}-${idx}`} className="hover:bg-yellow-50/40">
                                                                                            <td className="px-3 py-2 text-slate-700">{line.label}</td>
                                                                                            <td className="px-3 py-2 text-right text-red-600 font-medium">-{line.amount.toLocaleString()}</td>
                                                                                        </tr>
                                                                                    ))}
                                                                                </tbody>
                                                                                <tfoot className="bg-yellow-50 font-bold text-yellow-900">
                                                                                    <tr>
                                                                                        <td className="px-3 py-2 text-right">가불 합계</td>
                                                                                        <td className="px-3 py-2 text-right">-{advanceTotalForDisplay.toLocaleString()}</td>
                                                                                    </tr>
                                                                                </tfoot>
                                                                            </table>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="p-4 border border-dashed border-yellow-300 rounded-lg text-center text-xs text-slate-500 bg-white">
                                                                            가불 내역이 없습니다.
                                                                        </div>
                                                                    )}

                                                                    <div className="mt-4" />

                                                                    <div className="flex items-center justify-between">
                                                                        <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                                                            <span className="w-1 h-4 bg-rose-500 rounded-full"></span>
                                                                            세금내역
                                                                        </h4>
                                                                        <span className="text-xs text-slate-500 font-mono bg-white px-2 py-0.5 rounded border border-slate-200">
                                                                            총 {(item.taxBreakdown.standardLines.length + item.taxBreakdown.additionalLines.length)}건
                                                                        </span>
                                                                    </div>
                                                                    {showInsuranceSection && (
                                                                        <div className="border border-emerald-200 bg-emerald-50 rounded-lg p-3 text-xs">
                                                                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                                                                                <div className="text-emerald-800 font-bold">
                                                                                    {hasInsuranceTargetSummary
                                                                                        ? `4대보험 적용 공수 ${item.insuranceAppliedSummary!.appliedManDay.toFixed(1)} (기준 ${item.insuranceAppliedSummary!.thresholdManDay})`
                                                                                        : '4대보험 공제내역'}
                                                                                </div>
                                                                                <div className="text-emerald-700 font-mono">
                                                                                    {hasInsuranceTargetSummary
                                                                                        ? `대상금액 ${item.insuranceAppliedSummary!.appliedAmount.toLocaleString()}원`
                                                                                        : `공제금액 ${insuranceSectionTaxTotal.toLocaleString()}원`}
                                                                                </div>
                                                                            </div>
                                                                            {hasInsuranceTargetSummary && (
                                                                                <div className="mt-2 border border-emerald-200 rounded bg-white overflow-hidden">
                                                                                    <table className="w-full text-xs">
                                                                                        <thead className="bg-emerald-100 text-emerald-800">
                                                                                            <tr>
                                                                                                <th className="px-2 py-1 text-left font-bold">대상 현장</th>
                                                                                                <th className="px-2 py-1 text-center font-bold w-20">사유</th>
                                                                                                <th className="px-2 py-1 text-right font-bold w-16">공수</th>
                                                                                                <th className="px-2 py-1 text-right font-bold w-24">금액</th>
                                                                                            </tr>
                                                                                        </thead>
                                                                                        <tbody className="divide-y divide-emerald-100">
                                                                                            {(item.insuranceAppliedSummary?.appliedSites ?? []).map((s: InsuranceAppliedSiteSummary) => (
                                                                                                <tr key={`ins-site-${s.siteId}`}>
                                                                                                    <td className="px-2 py-1 text-slate-700">{s.siteName}</td>
                                                                                                    <td className="px-2 py-1 text-center text-emerald-700 font-semibold">
                                                                                                        {s.reason === 'site' ? '노무현장8+' : '발주8+'}
                                                                                                    </td>
                                                                                                    <td className="px-2 py-1 text-right font-mono text-slate-700">{s.manDay.toFixed(1)}</td>
                                                                                                    <td className="px-2 py-1 text-right font-mono text-slate-700">{s.amount.toLocaleString()}</td>
                                                                                                </tr>
                                                                                            ))}
                                                                                        </tbody>
                                                                                    </table>
                                                                                </div>
                                                                            )}
                                                                            <div className="mt-2 border border-emerald-200 rounded bg-white overflow-hidden">
                                                                                <table className="w-full text-xs">
                                                                                    <thead className="bg-emerald-100 text-emerald-800">
                                                                                        <tr>
                                                                                            <th className="px-2 py-1 text-left font-bold">공제내역</th>
                                                                                            <th className="px-2 py-1 text-center font-bold w-20">세액요율</th>
                                                                                            <th className="px-2 py-1 text-right font-bold w-24">금액</th>
                                                                                        </tr>
                                                                                    </thead>
                                                                                    <tbody className="divide-y divide-emerald-100">
                                                                                        {insuranceTaxLines.map((line, idx) => (
                                                                                            <tr key={`ins-tax-${idx}`}>
                                                                                                <td className="px-2 py-1 text-slate-700">{line.label}</td>
                                                                                                <td className="px-2 py-1 text-center font-mono text-slate-600">{resolveTaxLineRateText(line.label, item.taxRateSnapshot)}</td>
                                                                                                <td className="px-2 py-1 text-right font-mono text-slate-700">-{line.amount.toLocaleString()}</td>
                                                                                            </tr>
                                                                                        ))}
                                                                                    </tbody>
                                                                                    <tfoot className="bg-emerald-50 font-bold text-emerald-900">
                                                                                        <tr>
                                                                                            <td className="px-2 py-1 text-right" colSpan={2}>합계</td>
                                                                                            <td className="px-2 py-1 text-right">-{insuranceSectionTaxTotal.toLocaleString()}</td>
                                                                                        </tr>
                                                                                    </tfoot>
                                                                                </table>
                                                                            </div>
                                                                            {hasInsuranceTargetSummary && (
                                                                                <div className="mt-2 border border-emerald-200 rounded bg-white overflow-hidden">
                                                                                    <table className="w-full text-xs">
                                                                                        <tbody>
                                                                                            <tr className="bg-emerald-50">
                                                                                                <td className="px-2 py-1.5 text-center text-emerald-900 font-bold w-1/4">세전 금액</td>
                                                                                                <td className="px-2 py-1.5 text-right font-mono text-slate-800 w-1/4">{item.insuranceAppliedSummary!.appliedAmount.toLocaleString()}</td>
                                                                                                <td className="px-2 py-1.5 text-center text-emerald-900 font-bold w-1/4">세후 금액</td>
                                                                                                <td className="px-2 py-1.5 text-right font-mono text-emerald-700 font-bold w-1/4">{insuranceAfterTaxAmount.toLocaleString()}</td>
                                                                                            </tr>
                                                                                        </tbody>
                                                                                    </table>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                    {item.withholdingAppliedSummary && (item.withholdingAppliedSummary.appliedManDay ?? 0) > 0 && (
                                                                        <div className="border border-amber-200 bg-amber-50 rounded-lg p-3 text-xs mt-2">
                                                                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                                                                                <div className="text-amber-900 font-bold">
                                                                                    갑근세·지방세 적용공수 {(item.withholdingAppliedSummary.appliedManDay ?? 0).toFixed(1)}공수
                                                                                    {(item.withholdingAppliedSummary.thresholdManDay ?? item.withholdingAppliedSummary.thresholdDays ?? 0) > 0
                                                                                        ? ` (기준 ${item.withholdingAppliedSummary.thresholdManDay ?? item.withholdingAppliedSummary.thresholdDays ?? 0}공수 이하)`
                                                                                        : ' (노무 전체 공수 적용)'}
                                                                                </div>
                                                                                <div className="text-amber-800 font-mono">
                                                                                    과세대상금액 {item.withholdingAppliedSummary.appliedAmount.toLocaleString()}원
                                                                                </div>
                                                                            </div>
                                                                            <div className="mt-2 border border-amber-200 rounded bg-white overflow-hidden">
                                                                                <table className="w-full text-xs">
                                                                                    <thead className="bg-amber-100 text-amber-900">
                                                                                        <tr>
                                                                                            <th className="px-2 py-1 text-left font-bold">대상 현장</th>
                                                                                            <th className="px-2 py-1 text-center font-bold w-24">사유</th>
                                                                                            <th className="px-2 py-1 text-right font-bold w-16">공수</th>
                                                                                            <th className="px-2 py-1 text-right font-bold w-24">금액</th>
                                                                                        </tr>
                                                                                    </thead>
                                                                                    <tbody className="divide-y divide-amber-100">
                                                                                        {(item.withholdingAppliedSummary.appliedSites ?? []).map((s: WithholdingAppliedSiteSummary) => (
                                                                                            <tr key={`withholding-site-${s.siteId}`}>
                                                                                                <td className="px-2 py-1 text-slate-700">{s.siteName}</td>
                                                                                                <td className="px-2 py-1 text-center text-amber-700 font-semibold">
                                                                                                    {s.reason === '노무전체' ? '노무전체' : '노무-7'}
                                                                                                </td>
                                                                                                <td className="px-2 py-1 text-right font-mono text-slate-700">{s.manDay.toFixed(1)}</td>
                                                                                                <td className="px-2 py-1 text-right font-mono text-slate-700">{s.amount.toLocaleString()}</td>
                                                                                            </tr>
                                                                                        ))}
                                                                                    </tbody>
                                                                                </table>
                                                                            </div>
                                                                            <div className="mt-2 border border-amber-200 rounded bg-white overflow-hidden">
                                                                                <table className="w-full text-xs">
                                                                                    <thead className="bg-amber-100 text-amber-900">
                                                                                        <tr>
                                                                                            <th className="px-2 py-1 text-left font-bold">공제내역</th>
                                                                                            <th className="px-2 py-1 text-center font-bold w-20">세액요율</th>
                                                                                            <th className="px-2 py-1 text-right font-bold w-24">금액</th>
                                                                                        </tr>
                                                                                    </thead>
                                                                                    <tbody className="divide-y divide-amber-100">
                                                                                        {withholdingTaxLines.map((line, idx) => (
                                                                                            <tr key={`withholding-tax-${idx}`}>
                                                                                                <td className="px-2 py-1 text-slate-700">{line.label}</td>
                                                                                                <td className="px-2 py-1 text-center font-mono text-slate-600">{resolveTaxLineRateText(line.label, item.taxRateSnapshot)}</td>
                                                                                                <td className="px-2 py-1 text-right font-mono text-slate-700">-{line.amount.toLocaleString()}</td>
                                                                                            </tr>
                                                                                        ))}
                                                                                    </tbody>
                                                                                    <tfoot className="bg-amber-50 font-bold text-amber-900">
                                                                                        <tr>
                                                                                            <td className="px-2 py-1 text-right" colSpan={2}>합계</td>
                                                                                            <td className="px-2 py-1 text-right">-{withholdingSectionTaxTotal.toLocaleString()}</td>
                                                                                        </tr>
                                                                                        <tr className="font-normal text-[10px] text-amber-900/90">
                                                                                            <td className="px-2 py-1 text-left" colSpan={3}>{withholdingDetailText}</td>
                                                                                        </tr>
                                                                                    </tfoot>
                                                                                </table>
                                                                            </div>
                                                                            <div className="mt-2 border border-amber-200 rounded bg-white overflow-hidden">
                                                                                <table className="w-full text-xs">
                                                                                    <tbody>
                                                                                        <tr className="bg-amber-50">
                                                                                            <td className="px-2 py-1.5 text-center text-amber-900 font-bold w-1/4">세전 금액</td>
                                                                                            <td className="px-2 py-1.5 text-right font-mono text-slate-800 w-1/4">{toNumber(item.withholdingAppliedSummary.grossAmount ?? item.withholdingAppliedSummary.appliedAmount).toLocaleString()}</td>
                                                                                            <td className="px-2 py-1.5 text-center text-amber-900 font-bold w-1/4">세후 금액</td>
                                                                                            <td className="px-2 py-1.5 text-right font-mono text-amber-700 font-bold w-1/4">{withholdingAfterTaxAmount.toLocaleString()}</td>
                                                                                        </tr>
                                                                                    </tbody>
                                                                                </table>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                    {item.businessIncomeAppliedSummary && (item.businessIncomeAppliedSummary.appliedManDay ?? 0) > 0 && (
                                                                        <div className="border border-sky-200 bg-sky-50 rounded-lg p-3 text-xs mt-2">
                                                                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                                                                                <div className="text-sky-900 font-bold">
                                                                                    사업소득 3.3% 적용 공수 {(item.businessIncomeAppliedSummary.appliedManDay ?? 0).toFixed(1)}
                                                                                </div>
                                                                                <div className="text-sky-800 font-mono">
                                                                                    대상금액 {item.businessIncomeAppliedSummary.appliedAmount.toLocaleString()}원
                                                                                </div>
                                                                            </div>
                                                                            <div className="mt-2 border border-sky-200 rounded bg-white overflow-hidden">
                                                                                <table className="w-full text-xs">
                                                                                    <thead className="bg-sky-100 text-sky-900">
                                                                                        <tr>
                                                                                            <th className="px-2 py-1 text-left font-bold">대상 현장</th>
                                                                                            <th className="px-2 py-1 text-center font-bold w-24">사유</th>
                                                                                            <th className="px-2 py-1 text-right font-bold w-16">공수</th>
                                                                                            <th className="px-2 py-1 text-right font-bold w-24">금액</th>
                                                                                        </tr>
                                                                                    </thead>
                                                                                    <tbody className="divide-y divide-sky-100">
                                                                                        {(item.businessIncomeAppliedSummary.appliedSites ?? []).map((s: BusinessIncomeAppliedSiteSummary) => (
                                                                                            <tr key={`biz-site-${s.siteId}`}>
                                                                                                <td className="px-2 py-1 text-slate-700">{s.siteName}</td>
                                                                                                <td className="px-2 py-1 text-center text-sky-700 font-semibold">4대보험·갑근세 제외</td>
                                                                                                <td className="px-2 py-1 text-right font-mono text-slate-700">{s.manDay.toFixed(1)}</td>
                                                                                                <td className="px-2 py-1 text-right font-mono text-slate-700">{s.amount.toLocaleString()}</td>
                                                                                            </tr>
                                                                                        ))}
                                                                                    </tbody>
                                                                                </table>
                                                                            </div>
                                                                            <div className="mt-2 border border-sky-200 rounded bg-white overflow-hidden">
                                                                                <table className="w-full text-xs">
                                                                                    <thead className="bg-sky-100 text-sky-900">
                                                                                        <tr>
                                                                                            <th className="px-2 py-1 text-left font-bold">공제내역</th>
                                                                                            <th className="px-2 py-1 text-center font-bold w-20">세액요율</th>
                                                                                            <th className="px-2 py-1 text-right font-bold w-24">금액</th>
                                                                                        </tr>
                                                                                    </thead>
                                                                                    <tbody className="divide-y divide-sky-100">
                                                                                        {businessTaxLines.map((line, idx) => (
                                                                                            <tr key={`biz-tax-${idx}`}>
                                                                                                <td className="px-2 py-1 text-slate-700">{line.label}</td>
                                                                                                <td className="px-2 py-1 text-center font-mono text-slate-600">{resolveTaxLineRateText(line.label, item.taxRateSnapshot)}</td>
                                                                                                <td className="px-2 py-1 text-right font-mono text-slate-700">-{line.amount.toLocaleString()}</td>
                                                                                            </tr>
                                                                                        ))}
                                                                                    </tbody>
                                                                                    <tfoot className="bg-sky-50 font-bold text-sky-900">
                                                                                        <tr>
                                                                                            <td className="px-2 py-1 text-right" colSpan={2}>합계</td>
                                                                                            <td className="px-2 py-1 text-right">-{businessSectionTaxTotal.toLocaleString()}</td>
                                                                                        </tr>
                                                                                    </tfoot>
                                                                                </table>
                                                                            </div>
                                                                            <div className="mt-2 border border-sky-200 rounded bg-white overflow-hidden">
                                                                                <table className="w-full text-xs">
                                                                                    <tbody>
                                                                                        <tr className="bg-sky-50">
                                                                                            <td className="px-2 py-1.5 text-center text-sky-900 font-bold w-1/4">세전 금액</td>
                                                                                            <td className="px-2 py-1.5 text-right font-mono text-slate-800 w-1/4">{item.businessIncomeAppliedSummary.appliedAmount.toLocaleString()}</td>
                                                                                            <td className="px-2 py-1.5 text-center text-sky-900 font-bold w-1/4">세후 금액</td>
                                                                                            <td className="px-2 py-1.5 text-right font-mono text-sky-700 font-bold w-1/4">{businessAfterTaxAmount.toLocaleString()}</td>
                                                                                        </tr>
                                                                                    </tbody>
                                                                                </table>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                    {otherTaxLines.length > 0 ? (
                                                                        <div className="border border-slate-200 rounded-lg bg-white shadow-sm overflow-hidden">
                                                                            <table className="w-full text-xs">
                                                                                <thead className="bg-slate-50 text-slate-500">
                                                                                    <tr>
                                                                                        <th className="px-3 py-2 text-left font-medium border-b border-slate-100">항목</th>
                                                                                        <th className="px-3 py-2 text-center font-medium border-b border-slate-100 w-24">세액요율</th>
                                                                                        <th className="px-3 py-2 text-right font-medium border-b border-slate-100 w-32">금액</th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody className="divide-y divide-slate-100">
                                                                                    {otherTaxLines.map((line, idx) => (
                                                                                        <tr key={`tax-${line.label}-${idx}`} className="hover:bg-rose-50/30">
                                                                                            <td className="px-3 py-2 text-slate-700">{line.label}</td>
                                                                                            <td className="px-3 py-2 text-center font-mono text-slate-600">{resolveTaxLineRateText(line.label, item.taxRateSnapshot)}</td>
                                                                                            <td className="px-3 py-2 text-right text-red-600 font-medium">-{line.amount.toLocaleString()}</td>
                                                                                        </tr>
                                                                                    ))}
                                                                                </tbody>
                                                                                <tfoot className="bg-rose-50 font-bold text-rose-800">
                                                                                    <tr>
                                                                                        <td className="px-3 py-2 text-right" colSpan={2}>세금 합계</td>
                                                                                        <td className="px-3 py-2 text-right">-{otherTaxTotal.toLocaleString()}</td>
                                                                                    </tr>
                                                                                </tfoot>
                                                                            </table>
                                                                        </div>
                                                                    ) : null}

                                                                    <div className="mt-2 border-t border-slate-200 pt-2 text-xs text-slate-600 space-y-1">
                                                                        <div className="flex items-center justify-between">
                                                                            <span className="font-bold text-slate-700">세전 금액</span>
                                                                            <span className="font-mono text-slate-800 font-bold">{item.grossAmount.toLocaleString()}</span>
                                                                        </div>
                                                                        <div className="flex items-center justify-between">
                                                                            <span className="font-bold text-slate-700">세후 금액</span>
                                                                            <span className="font-mono text-emerald-700 font-bold">{item.totalAmount.toLocaleString()}</span>
                                                                        </div>
                                                                        <div className="flex items-center justify-between">
                                                                            <span className="font-bold text-slate-700">총 차감액(공제+세금)</span>
                                                                            <span className="font-mono text-red-700 font-bold">-{item.totalDeduction.toLocaleString()}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            )}

            {pageViewMode === 'simple' && (
                <SimplePayrollClosingTable
                    rangeLabel={rangeLabel}
                    rows={simplePayrollClosingRows}
                    onOpenDetailed={() => setPageViewMode('standard')}
                    onOpenLedger={() => setPageViewMode('ledger')}
                    runStatus={simplePayrollRunStatus}
                    statusActionDisabled={filterMode === 'worker' || deductionApplyInProgress || simplePayrollRunStatus === 'mixed'}
                    statusActionLoading={payrollSettlementSaving || payrollSettlementLoading}
                    onSaveDraft={handleSavePayrollSettlement}
                    onMarkReviewed={() => handlePayrollRunTransition('reviewed')}
                    onConfirm={() => handlePayrollRunTransition('confirmed')}
                    onMarkPaid={() => handlePayrollRunTransition('paid')}
                />
            )}

            {pageViewMode === 'ledger' && (
                <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                    <MonthlyAdvanceLedger
                        ref={advanceLedgerRef}
                        rows={ledgerRows}
                        payrollConfig={payrollConfig}
                        advanceItemLabels={payrollConfig?.advanceItemLabels}
                        withholdingThreshold={WITHHOLDING_MAX_MAN_DAY}
                        applyUtilities={utilitiesApplied}
                        applyInsurance={insuranceApplied}
                        applyBusinessIncome={businessIncomeApplied}
                        applyDailyFee={dailyFeeApplied}
                        insuranceTeamSiteOnly={insuranceTeamSiteOnly}
                        isInsuranceEligibleEntry={isLedgerInsuranceEligibleEntry}
                        clientCompanyNameById={companyNameById}
                        onInputsChange={setLedgerInputs}
                        onComputedAmountsChange={setLedgerComputedAmounts}
                        initialInputs={initialLedgerInputs}
                        visibleSections={ledgerVisibleSections}
                    />
                </div>
            )}

            {showKBPreview && (
                <KBPreviewOverlay>
                    <KBPreviewDialog>
                        <KBPreviewHeader>
                            <KBPreviewTitleRow>
                                <KBPreviewTitleBlock>
                                    <KBPreviewEyebrow>KB Transfer Preview</KBPreviewEyebrow>
                                    <KBPreviewTitle>국민은행용 엑셀 미리보기</KBPreviewTitle>
                                    <KBPreviewDescription>현재 조회 조건과 공제 적용 상태를 기준으로 확정된 출력 스냅샷입니다.</KBPreviewDescription>
                                </KBPreviewTitleBlock>
                                <KBPreviewCloseButton onClick={() => handleKBPreviewVisibilityChange(false)}>
                                    ×
                                </KBPreviewCloseButton>
                            </KBPreviewTitleRow>

                            <KBPreviewControlsGrid>
                                <KBPreviewFieldCard>
                                    <KBPreviewFieldLabel htmlFor="kb-receiver-display">받는분통장표시</KBPreviewFieldLabel>
                                    <KBPreviewInput
                                        id="kb-receiver-display"
                                        type="text"
                                        value={kbReceiverDisplay}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            setKbReceiverDisplay(value);
                                            updateKBPreviewSnapshotFromControls({ receiverDisplay: value });
                                        }}
                                        placeholder="㈜다원"
                                    />
                                    <KBPreviewFieldHint>은행 업로드 파일의 D열에 동일하게 들어갑니다.</KBPreviewFieldHint>
                                </KBPreviewFieldCard>

                                <KBPreviewFieldCard>
                                    <KBPreviewFieldLabel htmlFor="kb-memo-suffix">내통장메모 규칙</KBPreviewFieldLabel>
                                    <KBPreviewInput
                                        id="kb-memo-suffix"
                                        type="text"
                                        value={kbMemoSuffix}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            setKbMemoSuffix(value);
                                            updateKBPreviewSnapshotFromControls({ memoSuffix: value });
                                        }}
                                        placeholder="{이름} 가불"
                                    />
                                    <KBPreviewFieldHint>{'{이름}'} 치환자를 쓰면 작업자 이름 뒤에 자동으로 붙습니다.</KBPreviewFieldHint>
                                </KBPreviewFieldCard>

                                <KBPreviewFieldCard>
                                    <KBPreviewFieldLabel htmlFor="kb-amount-type">이체금액 적용 기준</KBPreviewFieldLabel>
                                    <KBPreviewSelect
                                        id="kb-amount-type"
                                        value={kbAmountType}
                                        onChange={(e) => {
                                            const value = e.target.value as KBAmountType;
                                            setKbAmountType(value);
                                            updateKBPreviewSnapshotFromControls({ amountType: value });
                                        }}
                                    >
                                        <option value="totalAmount">현재 화면 실지급액</option>
                                        <option value="invoiceNet">공제후 법인총액</option>
                                        <option value="laborNet">공제후 노무총액</option>
                                        <option value="invoiceAdvance">법인가불 총액</option>
                                        <option value="laborAdvance">노무가불 총액</option>
                                        {(() => {
                                            const al = { ...DEFAULT_ADVANCE_ITEM_LABELS, ...(payrollConfig?.advanceItemLabels ?? {}) };
                                            return (
                                                <>
                                                    <option disabled>── 법인가불 개별 ──</option>
                                                    <option value="corporateAdvance1">{al.corporateAdvance1}</option>
                                                    <option value="corporateAdvance2">{al.corporateAdvance2}</option>
                                                    <option value="corporateAdvance3">{al.corporateAdvance3}</option>
                                                    <option value="corporateAdvance4">{al.corporateAdvance4}</option>
                                                    <option disabled>── 노무가불 개별 ──</option>
                                                    <option value="laborAdvance1">{al.laborAdvance1}</option>
                                                    <option value="laborAdvance2">{al.laborAdvance2}</option>
                                                    <option value="laborAdvance3">{al.laborAdvance3}</option>
                                                    <option value="laborAdvance4">{al.laborAdvance4}</option>
                                                </>
                                            );
                                        })()}
                                    </KBPreviewSelect>
                                    <KBPreviewFieldHint>선택한 기준으로 C열 이체금액이 계산됩니다.</KBPreviewFieldHint>
                                </KBPreviewFieldCard>
                            </KBPreviewControlsGrid>

                            {kbPreviewSnapshot && (
                                <div className="mt-3 space-y-2">
                                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-200 md:grid-cols-4">
                                        <div className="rounded border border-slate-700 bg-slate-900/70 px-3 py-2">
                                            <div className="text-slate-400">기간</div>
                                            <div className="font-bold">{kbPreviewSnapshot.criteria.rangeLabel}</div>
                                        </div>
                                        <div className="rounded border border-slate-700 bg-slate-900/70 px-3 py-2">
                                            <div className="text-slate-400">대상</div>
                                            <div className="font-bold">{kbPreviewSnapshot.criteria.targetLabel}</div>
                                        </div>
                                        <div className="rounded border border-slate-700 bg-slate-900/70 px-3 py-2">
                                            <div className="text-slate-400">구분</div>
                                            <div className="font-bold">{kbPreviewSnapshot.criteria.salaryFilterLabel}</div>
                                        </div>
                                        <div className="rounded border border-slate-700 bg-slate-900/70 px-3 py-2">
                                            <div className="text-slate-400">금액 기준</div>
                                            <div className="font-bold">{kbPreviewSnapshot.criteria.amountTypeLabel}</div>
                                        </div>
                                    </div>
                                    <div className="rounded border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs text-slate-300">
                                        {kbPreviewSnapshot.criteria.deductionStatusLabel}
                                    </div>
                                    {(kbPreviewInvalidRows.length > 0 || kbPreviewExcludedRows.length > 0) && (
                                        <div className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                                            {kbPreviewInvalidRows.length > 0 && (
                                                <div className="font-bold">수정 필요 {kbPreviewInvalidRows.length}건: {kbPreviewInvalidRows.slice(0, 5).map((row) => `${row.workerName}(${getKBValidationMessages(row)})`).join(', ')}</div>
                                            )}
                                            {kbPreviewExcludedRows.length > 0 && (
                                                <div className="mt-1">다운로드 제외 {kbPreviewExcludedRows.length}건: {kbPreviewExcludedRows.slice(0, 5).map((row) => `${row.workerName}(${row.reason})`).join(', ')}</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </KBPreviewHeader>
                        <KBPreviewTableArea>
                            <KBPreviewTable>
                                <thead className="bg-slate-800/95 sticky top-0">
                                    <tr>
                                        <th className="border border-slate-700 px-3 py-2 text-left font-bold text-slate-100">A. 은행코드</th>
                                        <th className="border border-slate-700 px-3 py-2 text-left font-bold text-slate-100">B. 계좌번호</th>
                                        <th className="border border-slate-700 px-3 py-2 text-right font-bold text-slate-100">C. 이체금액</th>
                                        <th className="border border-slate-700 px-3 py-2 text-left font-bold text-slate-100">D. 받는분통장표시</th>
                                        <th className="border border-slate-700 px-3 py-2 text-left font-bold text-slate-100">E. 내통장메모</th>
                                        <th className="border border-slate-700 px-3 py-2 text-left font-bold text-slate-100">검증</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {getKBPreviewData().length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="border border-slate-700 px-3 py-8 text-center text-slate-400">
                                                다운로드할 이체금액 데이터가 없습니다.
                                            </td>
                                        </tr>
                                    ) : getKBPreviewData().map((row, idx) => (
                                        <tr key={row.sourceRowId || idx} className={`hover:bg-slate-800/60 ${row.validationErrors.length > 0 ? 'bg-rose-950/30' : ''}`}>
                                            <td className={`border border-slate-700 px-3 py-2 ${row.bankCodeUnmapped ? 'text-rose-300 font-semibold' : ''}`}>
                                                <div className="flex items-center gap-1.5">
                                                    <span>{row.bankCodeDisplay}</span>
                                                    {row.bankCodeNeedsFix && (
                                                        <span className="inline-flex items-center rounded bg-rose-500/30 px-1.5 py-0.5 text-[10px] font-bold text-rose-100">
                                                            수정요망
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="border border-slate-700 px-3 py-2">{row.accountNumber || <span className="text-rose-300">미입력</span>}</td>
                                            <td className="border border-slate-700 px-3 py-2 text-right font-medium text-amber-300">{row.amount.toLocaleString()}</td>
                                            <td className="border border-slate-700 px-3 py-2">{row.receiverDisplay}</td>
                                            <td className="border border-slate-700 px-3 py-2">{row.senderMemo}</td>
                                            <td className={`border border-slate-700 px-3 py-2 ${row.validationErrors.length > 0 ? 'text-rose-300 font-semibold' : 'text-emerald-300'}`}>
                                                {row.validationErrors.length > 0 ? getKBValidationMessages(row) : '정상'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </KBPreviewTable>
                        </KBPreviewTableArea>
                        <KBPreviewFooter>
                            <KBPreviewSummary>
                                총 {kbPreviewSnapshot?.criteria.exportCount ?? 0}명 · 총 이체금액 {(kbPreviewSnapshot?.criteria.totalAmount ?? 0).toLocaleString()}원 · 제외 {kbPreviewSnapshot?.criteria.excludedCount ?? 0}건
                            </KBPreviewSummary>
                            <ActionCluster>
                                <ActionButton
                                    type="button"
                                    $variant="outline"
                                    onClick={() => handleKBPreviewVisibilityChange(false)}
                                >
                                    닫기
                                </ActionButton>
                                <ActionButton
                                    type="button"
                                    $variant="warning"
                                    onClick={handleDownloadKBExcel}
                                    disabled={!canDownloadKBExcel}
                                    title={!canDownloadKBExcel ? '검증 오류를 먼저 수정하세요.' : '국민은행용 엑셀 다운로드'}
                                >
                                    <FontAwesomeIcon icon={faFileExcel} />
                                    국민은행용 다운로드
                                </ActionButton>
                            </ActionCluster>
                        </KBPreviewFooter>
                    </KBPreviewDialog>
                </KBPreviewOverlay>
            )}

            {showBankCodes && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full mx-4 max-h-[85vh] flex flex-col">
                        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-blue-50">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">📊 은행 매핑 진단표</h3>
                                <p className="text-xs text-slate-600 mt-0.5">
                                    전체 입력 {bankDiagnosticSummary.total}건 · 미매핑 {bankDiagnosticSummary.unmapped}건
                                </p>
                            </div>
                            <button
                                onClick={() => setShowBankCodes(false)}
                                className="text-slate-400 hover:text-slate-600 text-2xl"
                            >
                                ×
                            </button>
                        </div>

                        <div className="flex-1 overflow-auto p-4 space-y-5 text-xs">
                            <div>
                                <h4 className="text-sm font-bold text-slate-700 mb-2 bg-blue-100 px-2 py-1 rounded">🏦 공식 은행코드 매핑표</h4>
                                <p className="text-slate-500 text-xs mb-2">기준 데이터: BANK_CODES 상수</p>
                                <table className="w-full text-xs border-collapse">
                                    <thead className="bg-slate-100 sticky top-0">
                                        <tr>
                                            <th className="border border-slate-300 px-2 py-1 text-left font-bold">코드</th>
                                            <th className="border border-slate-300 px-2 py-1 text-left font-bold">은행명</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Object.entries(BANK_CODES)
                                            .sort(([a], [b]) => Number(a) - Number(b))
                                            .map(([code, name]) => (
                                                <tr key={`${code}-${name}`}>
                                                    <td className="border px-2 py-1 font-mono">{code}</td>
                                                    <td className="border px-2 py-1">{name}</td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>

                            <div>
                                <h4 className="text-sm font-bold text-slate-700 mb-2 bg-amber-100 px-2 py-1 rounded">🛠 입력 은행명 진단 (미매핑 사유)</h4>
                                <table className="w-full text-xs border-collapse">
                                    <thead className="bg-slate-100 sticky top-0">
                                        <tr>
                                            <th className="border border-slate-300 px-2 py-1 text-left font-bold">입력 은행명</th>
                                            <th className="border border-slate-300 px-2 py-1 text-right font-bold">건수</th>
                                            <th className="border border-slate-300 px-2 py-1 text-left font-bold">매핑 코드</th>
                                            <th className="border border-slate-300 px-2 py-1 text-left font-bold">미매핑 사유</th>
                                            <th className="border border-slate-300 px-2 py-1 text-left font-bold">후보</th>
                                            <th className="border border-slate-300 px-2 py-1 text-left font-bold">권장 조치</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {bankMappingDiagnostics.length === 0 && (
                                            <tr>
                                                <td colSpan={6} className="border px-2 py-4 text-center text-slate-500">진단할 데이터가 없습니다.</td>
                                            </tr>
                                        )}
                                        {bankMappingDiagnostics.map((row) => (
                                            <tr key={row.normalized} className={row.unmappedCount > 0 ? 'bg-rose-50/50' : ''}>
                                                <td className="border px-2 py-1">
                                                    <div className="font-medium">{row.inputNames}</div>
                                                    <div className="text-slate-400">정규화키: {row.normalized}</div>
                                                </td>
                                                <td className="border px-2 py-1 text-right tabular-nums">{row.count}</td>
                                                <td className="border px-2 py-1 font-mono">
                                                    {row.codes || '-'}
                                                </td>
                                                <td className={`border px-2 py-1 ${row.unmappedCount > 0 ? 'text-rose-700 font-semibold' : 'text-slate-500'}`}>
                                                    {row.reason || '-'}
                                                </td>
                                                <td className="border px-2 py-1 text-slate-600">{row.candidates || '-'}</td>
                                                <td className="border px-2 py-1 text-slate-700">{row.suggestedAction}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="p-4 border-t border-slate-200 bg-blue-50">
                            <button
                                onClick={() => setShowBankCodes(false)}
                                className="w-full px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold"
                            >
                                닫기
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showPayslipModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[1400px] max-h-[92vh] flex flex-col">
                        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="text-2xl">📄</span>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800">노임명세서 미리보기</h3>
                                    <p className="text-xs text-slate-500">
                                        {rangeLabel || '-'} · 총 {filteredPaymentData.length}명 · 발행가능 {payslipIssueSummary.readyRows}명 · 오류 {payslipIssueSummary.errorCount}건 · 확인 {payslipIssueSummary.warningCount}건
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowPayslipModal(false)}
                                className="text-slate-400 hover:text-slate-600 text-2xl"
                            >
                                ×
                            </button>
                        </div>
                        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                            <aside className="md:w-[170px] lg:w-[190px] xl:w-[210px] border-b md:border-b-0 md:border-r border-slate-200 flex-shrink-0 flex flex-col">
                                <div className="p-3 border-b border-slate-100 text-xs font-semibold text-slate-500">지급 대상자</div>
                                <div className="flex-1 overflow-y-auto">
                                    {filteredPaymentData.map(worker => (
                                        <button
                                            key={worker.id}
                                            onClick={() => setSelectedPayslipRowKey(worker.id)}
                                            className={`w-full text-left px-4 py-3 border-b border-slate-100 text-sm transition flex flex-col ${payslipTarget?.id === worker.id
                                                ? (worker.id.endsWith('__월급제') ? 'bg-blue-50 text-blue-700 font-semibold' : 'bg-emerald-50 text-emerald-700 font-semibold')
                                                : (worker.id.endsWith('__월급제') ? 'hover:bg-blue-50/40' : 'hover:bg-emerald-50/40')}`}
                                        >
                                            <span>{worker.workerName}</span>
                                            <span className="text-xs text-slate-500">{worker.month} · {worker.teamName} · {worker.id.endsWith('__일급제') ? '일급제' : '월급제'}</span>
                                            {payslipOutputIds[worker.id] && (
                                                <span className="mt-1 inline-flex w-fit rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">발행완료</span>
                                            )}
                                        </button>
                                    ))}
                                    {filteredPaymentData.length === 0 && (
                                        <div className="px-4 py-6 text-sm text-slate-500 text-center">표시할 작업자가 없습니다.</div>
                                    )}
                                </div>
                            </aside>
                            <div className="flex-1 overflow-auto p-6 bg-slate-50">
                                <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50/70 p-4 shadow-sm">
                                    <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                                        <div className="min-w-[240px] flex-1">
                                            <label htmlFor="monthly-payslip-contractor" className="mb-1 block text-xs font-bold text-blue-900">
                                                노임명세서 시공사
                                            </label>
                                            <select
                                                id="monthly-payslip-contractor"
                                                aria-label="노임명세서 시공사"
                                                value={payslipContractorOption}
                                                onChange={(event) => setPayslipContractorOption(event.target.value)}
                                                className="h-10 w-full rounded-lg border border-blue-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500"
                                            >
                                                {payslipContractorOptions.map((name) => (
                                                    <option key={name} value={name}>{name}</option>
                                                ))}
                                                <option value={CUSTOM_PAYSLIP_CONTRACTOR_VALUE}>새 사업자 직접 입력</option>
                                            </select>
                                        </div>
                                        {payslipContractorOption === CUSTOM_PAYSLIP_CONTRACTOR_VALUE && (
                                            <div className="min-w-[240px] flex-1">
                                                <label htmlFor="monthly-payslip-custom-contractor" className="mb-1 block text-xs font-bold text-blue-900">
                                                    새 시공사 상호
                                                </label>
                                                <input
                                                    id="monthly-payslip-custom-contractor"
                                                    aria-label="새 시공사 상호"
                                                    type="text"
                                                    value={customPayslipContractorName}
                                                    onChange={(event) => setCustomPayslipContractorName(event.target.value)}
                                                    placeholder="사업자 상호를 입력하세요"
                                                    className="h-10 w-full rounded-lg border border-blue-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500"
                                                />
                                            </div>
                                        )}
                                        <p className="text-xs leading-5 text-blue-700 lg:max-w-[320px]">
                                            선택한 시공사는 미리보기, 이미지, 인쇄, 엑셀 및 발행 기록에 동일하게 반영됩니다.
                                        </p>
                                    </div>
                                </div>
                                <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                        <div>
                                            <div className="text-xs font-bold uppercase tracking-wide text-slate-500">발행 검증</div>
                                            <div className="mt-1 text-sm font-semibold text-slate-800">
                                                {resolvedPayslipTarget?.workerName ?? '-'} · {selectedPayslipOutputId ? '발행완료' : '작성중'}
                                            </div>
                                            {selectedPayslipOutputId && (
                                                <div className="mt-1 text-xs text-emerald-700">문서대장 ID: {selectedPayslipOutputId}</div>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                                            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                                                <div className="font-bold text-emerald-700">{selectedPayslipIssueSummary.readyRows}</div>
                                                <div className="text-emerald-700/80">발행가능</div>
                                            </div>
                                            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
                                                <div className="font-bold text-rose-700">{selectedPayslipIssueSummary.errorCount}</div>
                                                <div className="text-rose-700/80">오류</div>
                                            </div>
                                            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                                                <div className="font-bold text-amber-700">{selectedPayslipIssueSummary.warningCount}</div>
                                                <div className="text-amber-700/80">확인</div>
                                            </div>
                                        </div>
                                    </div>
                                    {selectedPayslipIssueSummary.issues.length > 0 && (
                                        <div className="mt-3 grid gap-1 text-xs">
                                            {selectedPayslipIssueSummary.issues.slice(0, 5).map((issue, idx) => (
                                                <div
                                                    key={`${issue.code}-${idx}`}
                                                    className={issue.severity === 'error' ? 'text-rose-700' : 'text-amber-700'}
                                                >
                                                    {issue.severity === 'error' ? '오류' : '확인'} · {issue.message}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {payslipIssueMessage && (
                                        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                                            {payslipIssueMessage}
                                        </div>
                                    )}
                                </div>

                                {resolvedPayslipTarget ? (
                                    <PayslipTemplate
                                        ref={printRef}
                                        data={resolvedPayslipTarget}
                                        month={resolvedPayslipTarget.month}
                                        contractorName={resolvedPayslipContractorName}
                                        applyUtilities={utilitiesApplied}
                                        insuranceTeamSiteOnly={insuranceTeamSiteOnly}
                                        isTeamResponsibleSiteEntry={isEntryInWorkerTeamSite}
                                    />
                                ) : (
                                    <div className="text-center py-12 text-slate-500">
                                        표시할 명세서가 없습니다.
                                    </div>
                                )}

                                <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                    <p className="text-sm text-slate-600">
                                        <span className="font-semibold text-slate-800">{resolvedPayslipTarget?.workerName ?? '-'}</span>
                                        {' · 실지급 '}
                                        <span className="text-brand-600 font-bold">{resolvedPayslipTarget ? resolvedPayslipTarget.totalAmount.toLocaleString() : 0}원</span>
                                        <span className="ml-2 text-xs text-slate-500">PDF와 엑셀은 미리보기와 같은 카드형 명세서로 출력됩니다.</span>
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            onClick={handleCopyToClipboard}
                                            disabled={!resolvedPayslipTarget || copying}
                                            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold flex items-center gap-2 disabled:opacity-50"
                                        >
                                            {copying ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faCopy} />}
                                            이미지 복사
                                        </button>
                                        <button
                                            onClick={handlePrintPayslip}
                                            disabled={!resolvedPayslipTarget || preparingPayslipPrint}
                                            className="px-4 py-2 text-sm bg-white border border-rose-200 text-rose-700 rounded-lg hover:bg-rose-50 font-bold flex items-center gap-2 disabled:opacity-50"
                                        >
                                            {preparingPayslipPrint ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faFilePdf} />}
                                            개별 PDF
                                        </button>
                                        <button
                                            onClick={handleBatchPrintPayslips}
                                            disabled={filteredPaymentData.length === 0 || preparingPayslipPrint}
                                            className="px-4 py-2 text-sm bg-rose-600 text-white rounded-lg hover:bg-rose-700 font-bold flex items-center gap-2 disabled:opacity-50"
                                        >
                                            {preparingPayslipPrint ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faFilePdf} />}
                                            일괄 PDF ({filteredPaymentData.length}명)
                                        </button>
                                        <button
                                            onClick={handleDownloadIndividualPayslip}
                                            disabled={!resolvedPayslipTarget || batchExcelDownloading}
                                            className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-bold flex items-center gap-2 disabled:opacity-50"
                                        >
                                            <FontAwesomeIcon icon={faFileExcel} />
                                            개별 Excel
                                        </button>
                                        <button
                                            onClick={handleDownloadBatchIndividualPayslips}
                                            disabled={filteredPaymentData.length === 0 || batchExcelDownloading}
                                            className="px-4 py-2 text-sm bg-green-700 text-white rounded-lg hover:bg-green-800 font-bold flex items-center gap-2 disabled:opacity-50"
                                        >
                                            {batchExcelDownloading ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faFileExcel} />}
                                            일괄 개별 Excel ({filteredPaymentData.length}명)
                                        </button>
                                        <button
                                            onClick={handleDownloadImage}
                                            disabled={!payslipTarget}
                                            className="px-4 py-2 text-sm bg-slate-700 text-white rounded-lg hover:bg-slate-800 font-bold flex items-center gap-2 disabled:opacity-50"
                                        >
                                            <FontAwesomeIcon icon={faDownload} />
                                            파일 저장
                                        </button>
                                        <button
                                            onClick={handleIssueCurrentPayslip}
                                            disabled={!resolvedPayslipTarget || issuingPayslip || selectedPayslipIssueSummary.errorCount > 0}
                                            className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-bold flex items-center gap-2 disabled:opacity-50"
                                        >
                                            {issuingPayslip ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faCheckCircle} />}
                                            {selectedPayslipOutputId ? '재발행 기록' : '발행 확정'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showInsuranceSettings && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">4대보험/세율 설정</h3>
                                <p className="text-xs text-slate-500 mt-1">적용 기준(공수), 요율(%), 일급제 수수료 공수당(원)을 저장합니다.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowInsuranceSettings(false)}
                                className="text-slate-400 hover:text-slate-600 text-2xl"
                            >
                                ×
                            </button>
                        </div>

                        <div className="flex-1 overflow-auto p-4 space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <label className="text-sm">
                                    <div className="text-xs font-bold text-slate-600 mb-1">적용 기준 공수</div>
                                    <input
                                        type="number"
                                        value={insuranceThresholdManDayInput}
                                        onChange={(e) => setInsuranceThresholdManDayInput(e.target.value)}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                                        min={1}
                                        step={1}
                                    />
                                </label>
                                <div className="text-xs text-slate-500 flex items-end">
                                    노무현장 공수 합이 기준 이상이면 4대보험 대상으로 판단합니다.
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <label className="text-sm">
                                    <div className="text-xs font-bold text-slate-600 mb-1">국민연금 (%)</div>
                                    <input
                                        type="number"
                                        value={pensionRatePercentInput}
                                        onChange={(e) => setPensionRatePercentInput(e.target.value)}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                                        min={0}
                                        step={0.01}
                                    />
                                </label>
                                <label className="text-sm">
                                    <div className="text-xs font-bold text-slate-600 mb-1">건강보험 (%)</div>
                                    <input
                                        type="number"
                                        value={healthRatePercentInput}
                                        onChange={(e) => setHealthRatePercentInput(e.target.value)}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                                        min={0}
                                        step={0.001}
                                    />
                                </label>
                                <label className="text-sm">
                                    <div className="text-xs font-bold text-slate-600 mb-1">장기요양(건강보험 대비 %) </div>
                                    <input
                                        type="number"
                                        value={careRateOfHealthPercentInput}
                                        onChange={(e) => setCareRateOfHealthPercentInput(e.target.value)}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                                        min={0}
                                        step={0.001}
                                    />
                                </label>
                                <label className="text-sm">
                                    <div className="text-xs font-bold text-slate-600 mb-1">고용보험 (%)</div>
                                    <input
                                        type="number"
                                        value={employmentRatePercentInput}
                                        onChange={(e) => setEmploymentRatePercentInput(e.target.value)}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                                        min={0}
                                        step={0.001}
                                    />
                                </label>
                                <label className="text-sm">
                                    <div className="text-xs font-bold text-slate-600 mb-1">일급제 수수료 공수당 금액 (원)</div>
                                    <input
                                        type="number"
                                        value={dailyWorkerFeePerManDayInput}
                                        onChange={(e) => setDailyWorkerFeePerManDayInput(e.target.value)}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                                        min={0}
                                        step={1000}
                                    />
                                </label>
                                <label className="text-sm">
                                    <div className="text-xs font-bold text-slate-600 mb-1">갑근세 단가 공제기준 (원)</div>
                                    <input
                                        type="number"
                                        value={withholdingBaseDeductionInput}
                                        onChange={(e) => setWithholdingBaseDeductionInput(e.target.value)}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                                        min={0}
                                        step={1000}
                                    />
                                </label>
                                <label className="text-sm">
                                    <div className="text-xs font-bold text-slate-600 mb-1">갑근세 세액공제율 (%)</div>
                                    <input
                                        type="number"
                                        value={withholdingIncomeBaseMultiplierPercentInput}
                                        onChange={(e) => setWithholdingIncomeBaseMultiplierPercentInput(e.target.value)}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                                        min={0}
                                        step={0.01}
                                    />
                                </label>
                                <label className="text-sm">
                                    <div className="text-xs font-bold text-slate-600 mb-1">갑근세 세율 (%)</div>
                                    <input
                                        type="number"
                                        value={incomeTaxRatePercentInput}
                                        onChange={(e) => setIncomeTaxRatePercentInput(e.target.value)}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                                        min={0}
                                        step={0.01}
                                    />
                                </label>
                                <label className="text-sm">
                                    <div className="text-xs font-bold text-slate-600 mb-1">지방세 (갑근세 대비 %)</div>
                                    <input
                                        type="number"
                                        value={residentTaxRatePercentInput}
                                        onChange={(e) => setResidentTaxRatePercentInput(e.target.value)}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                                        min={0}
                                        step={0.01}
                                    />
                                </label>
                            </div>

                            <div className="space-y-2 border-t border-slate-200 pt-3">
                                <label className="flex items-center gap-2 text-xs text-slate-700">
                                    <input
                                        type="checkbox"
                                        checked={withholdingApplyAllLaborInput}
                                        onChange={(e) => setWithholdingApplyAllLaborInput(e.target.checked)}
                                    />
                                    갑근세/지방세를 노무 전체 공수(7공수 미만, 8공수 이상 포함)에 적용
                                </label>
                                <label className="flex items-center gap-2 text-xs text-slate-700">
                                    <input
                                        type="checkbox"
                                        checked={employmentApplyBelowThresholdInput}
                                        onChange={(e) => setEmploymentApplyBelowThresholdInput(e.target.checked)}
                                    />
                                    7공수 미만 노무현장에도 고용보험 공제 적용
                                </label>
                            </div>

                            <div className="text-xs text-slate-500 border-t border-slate-200 pt-3">
                                갑근세 계산식: <span className="font-semibold text-slate-700">(단가 - 공제기준) × 노무공수 × 갑근세율 × (1 - 세액공제율)</span><br />
                                지방세 계산식: <span className="font-semibold text-slate-700">갑근세 × 지방세율</span>
                            </div>
                        </div>

                        <div className="p-4 border-t border-slate-200 flex items-center justify-end gap-2 bg-slate-50">
                            <button
                                type="button"
                                onClick={() => setShowInsuranceSettings(false)}
                                className="px-4 py-2 text-sm text-slate-600 hover:bg-white rounded-lg"
                            >
                                닫기
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveInsuranceSettings}
                                disabled={insuranceConfigSaving}
                                className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold disabled:opacity-50 flex items-center gap-2"
                            >
                                {insuranceConfigSaving ? <FontAwesomeIcon icon={faSpinner} spin /> : null}
                                저장
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MonthlyWagePaymentPage;
