import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import styled from 'styled-components';
import { dailyReportService } from '../../services/dailyReportService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { teamService, Team } from '../../services/teamService';
import { companyService, Company } from '../../services/companyService';
import { siteService, Site } from '../../services/siteService';
import { AdvancePayment } from '../../services/advancePaymentService';
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
import { faChevronLeft, faChevronRight, faFileExcel, faSearch, faSpinner, faExclamationTriangle, faCalendarDays, faCopy, faChevronUp, faChevronDown, faDownload, faFileZipper, faSave } from '@fortawesome/free-solid-svg-icons';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { addMonths, subMonths, format } from 'date-fns';
import { PayslipTemplate } from './components/PayslipTemplate';
import MonthlyAdvanceLedger from './components/MonthlyAdvanceLedger';
import type { MonthlyAdvanceLedgerHandle } from './components/MonthlyAdvanceLedger';
import Swal from 'sweetalert2';

import { usePayrollData } from './hooks/usePayrollData';
import { PaymentData, MonthlyAdvanceLedgerRow, LedgerManualInput, DeductionBreakdown, WorkerWorkEntry, DeductionLine, TaxRateSnapshot, LedgerUtilityInputLike, InsuranceAppliedSummary, InsuranceAppliedSiteSummary, InsuranceAppliedReason, WithholdingAppliedSummary, WithholdingAppliedSiteSummary, BusinessIncomeAppliedSummary, BusinessIncomeAppliedSiteSummary } from './types/payroll';
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

// --- Modern Switch Component ---
const SwitchWrapper = styled.label<{ $checked: boolean }>`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    min-width: 132px;
    padding: 8px 10px;
    border-radius: 12px;
    border: 1px solid ${props => (props.$checked ? 'rgba(37, 99, 235, 0.24)' : 'rgba(226, 232, 240, 0.95)')};
    background: ${props => (props.$checked
        ? 'linear-gradient(135deg, rgba(219, 234, 254, 0.96) 0%, rgba(239, 246, 255, 0.94) 100%)'
        : 'rgba(255, 255, 255, 0.96)')};
    box-shadow: ${props => (props.$checked ? '0 18px 34px -28px rgba(37, 99, 235, 0.32)' : 'none')};
    cursor: pointer;
    user-select: none;
    transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s ease;

    &:hover {
        transform: translateY(-1px);
    }
`;

const SwitchTextGroup = styled.span`
    display: flex;
    flex-direction: column;
    gap: 2px;
`;

const SwitchInput = styled.input`
    position: absolute;
    opacity: 0;
    pointer-events: none;
`;

const SwitchLabel = styled.span`
    font-size: 15px;
    font-weight: 800;
    color: #0f172a;
`;

const SwitchState = styled.span<{ $checked: boolean }>`
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: ${props => (props.$checked ? '#2563eb' : '#94a3b8')};
`;

const Slider = styled.span<{ $checked: boolean }>`
    position: relative;
    display: inline-flex;
    align-items: center;
    width: 38px;
    height: 22px;
    flex-shrink: 0;
    border-radius: 999px;
    background: ${props => (props.$checked ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' : '#cbd5e1')};
    transition: background 0.2s ease;

    &::before {
        content: '';
        position: absolute;
        top: 3px;
        left: ${props => (props.$checked ? '19px' : '3px')};
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: white;
        box-shadow: 0 4px 10px rgba(15, 23, 42, 0.18);
        transition: left 0.2s ease;
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

interface ModernSwitchProps {
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    compact?: boolean;
}

const ModernSwitch: React.FC<ModernSwitchProps> = ({ label, checked, onChange, compact = false }) => (
    <div style={compact ? { transform: 'scale(1)', transformOrigin: 'left center' } : undefined}>
        <SwitchWrapper $checked={checked}>
            <SwitchTextGroup>
                <SwitchLabel>{label}</SwitchLabel>
                <SwitchState $checked={checked}>{checked ? '적용' : '해제'}</SwitchState>
            </SwitchTextGroup>
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                <SwitchInput type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
                <Slider $checked={checked} />
            </div>
        </SwitchWrapper>
    </div>
);



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
    const additionalLines = (safe.additionalLines ?? []).filter((line) => {
        const label = (line?.label ?? '').trim();
        if (!label) return false;
        return !(label.startsWith(TEMP_TAX_PREFIX) || label.startsWith(LEGACY_TAX_PREFIX) || label.startsWith(TEMP_BUSINESS_PREFIX) || label.startsWith(TEMP_INSURANCE_PREFIX) || label.startsWith('[3.0%]') || label.startsWith('[0.3%]'));
    });
    return rebuildDeductionBreakdown({ standardLines: [], additionalLines });
};

const floorWon = (value: number): number => Math.floor(toNumber(value));

const toNumber = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

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

const LEDGER_DEFAULT_ASSIGNMENT: 'corporate' | 'labor' = 'corporate';

const APPLIED_UTILITY_LABEL_SET = new Set(APPLIED_UTILITY_FIELDS.map((field) => field.label));

const isAppliedUtilityOrFeeLabel = (labelRaw: string): boolean => {
    const label = String(labelRaw ?? '').trim();
    if (!label) return false;
    return APPLIED_UTILITY_LABEL_SET.has(label) || label.startsWith(TEMP_DAILY_FEE_PREFIX);
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
        .map((entry) => ({
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
        .filter((entry) => toNumber(entry.manDay) > 0 || toNumber(entry.amount) > 0);

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

const MonthlyWagePaymentPage: React.FC<Props> = ({ hideHeader }) => {
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
    const [pageViewMode, setPageViewMode] = useState<'standard' | 'ledger'>('ledger');
    const [toolbarExpanded, setToolbarExpanded] = useState<boolean>(false);
    const [ledgerVisibleSections, setLedgerVisibleSections] = useState({
        utilities: true,
        advances: true,
        taxes: true,
    });

    const [filtersReady, setFiltersReady] = useState<boolean>(false);
    const [deductionLabelMap, setDeductionLabelMap] = useState<Record<string, string>>(buildStandardDeductionLabelMap());
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

    const [insuranceApplied, setInsuranceApplied] = useState<boolean>(false);
    const [insuranceTeamSiteOnly, setInsuranceTeamSiteOnly] = useState<boolean>(false);
    const [businessIncomeApplied, setBusinessIncomeApplied] = useState<boolean>(false);
    const [utilitiesApplied, setUtilitiesApplied] = useState<boolean>(false);
    const [dailyFeeApplied, setDailyFeeApplied] = useState<boolean>(false);
    const [copying, setCopying] = useState(false);
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [ledgerInputs, setLedgerInputs] = useState<Record<string, LedgerManualInput>>({});
    const advanceLedgerRef = useRef<MonthlyAdvanceLedgerHandle>(null);
    const [kbReceiverDisplay, setKbReceiverDisplay] = useState<string>('㈜다원');
    const [kbMemoSuffix, setKbMemoSuffix] = useState<string>('{이름} 가불');
    const [kbAmountType, setKbAmountType] = useState<string>('totalAmount');

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
                setRangeAnchorMonth(safe);
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
    const selectedTeamLabel = useMemo(() => {
        if (!selectedTeamId) return '팀전체';
        const found = teams.find((team) => String(team.id ?? '').trim() === selectedTeamId);
        return (found?.name ?? '팀전체').trim() || '팀전체';
    }, [selectedTeamId, teams]);

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
    const filteredPaymentData = useMemo(() => {
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

        if (!selectedWorkerId) return sortRows(rows);
        return sortRows(rows.filter((item) => item.workerId === selectedWorkerId));
    }, [filterMode, paymentData, selectedWorkerId]);

    const filteredLedgerRows = useMemo<MonthlyAdvanceLedgerRow[]>(() => {
        const rows = ledgerRowsData;
        if (filterMode === 'team') return rows;
        if (!selectedWorkerId) return rows;
        return rows.filter((item) => item.workerId === selectedWorkerId);
    }, [filterMode, ledgerRowsData, selectedWorkerId]);

    const paymentDataByLedgerKey = useMemo(() => {
        const map = new Map<string, PaymentData>();
        paymentData.forEach((item) => {
            const salaryModel = item.id.endsWith('__일급제') ? '일급제' : '월급제';
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
                const rowSalaryModel = (row.salaryModel ?? '').trim() === '일급제' ? '일급제' : '월급제';
                const key = `${row.month}__${row.workerId}__${row.teamId}__${rowSalaryModel}`;
                let statementItem = paymentDataByLedgerKey.get(key);

                if (!statementItem) {
                    const looseKey = `${row.month}__${row.workerId}`;
                    const workerTeam = workerTeamByWorkerId.get(String(row.workerId ?? '').trim());
                    const normalizedRowTeam = normalizeTeamName(workerTeam?.teamName || row.teamName);
                    const targetCanonicalTeamId = resolveCanonicalTeamId(workerTeam?.teamId || row.teamId);
                    const candidates = (paymentDataByWorkerMonthKey.get(looseKey) ?? []).filter((candidate) => {
                        const candidateSalaryModel = candidate.id.endsWith('__일급제') ? '일급제' : '월급제';
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

    const loadedLedgerInputsFromAdvance = useMemo<Record<string, LedgerManualInput>>(() => {
        const next: Record<string, LedgerManualInput> = {};
        ledgerRows.forEach((row) => {
            const key = String(row.rowKey || row.id || '').trim();
            if (!key || !row.manual) return;
            next[key] = row.manual;
        });
        return next;
    }, [ledgerRows]);

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

            const baselineAssignment = resolveAssignmentType(baselineInput?.assignmentType, 'corporate');
            const currentAssignment = resolveAssignmentType(input.assignmentType, baselineAssignment);
            const hasCustomAssignment = currentAssignment !== baselineAssignment;

            return isSideEmpty(input.invoice) && isSideEmpty(input.labor) && memo.length === 0 && !hasAssignment && !hasCustomAssignment;
        },
        [ledgerSideFieldNames]
    );

    useEffect(() => {
        setLedgerInputs((prev) => {
            const next: Record<string, LedgerManualInput> = {};

            activeLedgerRowKeySet.forEach((key) => {
                const prevInput = prev[key];
                const loadedInput = loadedLedgerInputsFromAdvance[key];

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
    }, [activeLedgerRowKeySet, isLedgerManualInputEffectivelyEmpty, loadedLedgerInputsFromAdvance]);

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
            const salaryModel = ledgerRowKey.endsWith('__일급제') ? '일급제' : (ledgerRowKey.endsWith('__월급제') ? '월급제' : '');
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
            const salaryModel = ledgerRowKey.endsWith('__일급제') ? '일급제' : (ledgerRowKey.endsWith('__월급제') ? '월급제' : '');
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

    const resolveUtilityInputForPaymentItem = (item: PaymentData): LedgerUtilityInputLike | undefined => {
        const itemSalaryModel = item.id.endsWith('__일급제') ? '일급제' : '월급제';
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
    };

    const payslipTarget = useMemo(() => {
        if (filteredPaymentData.length === 0) return null;
        const defaultTarget = filteredPaymentData.find((item) => item.id.endsWith('__월급제')) ?? filteredPaymentData[0];
        const targetKey = selectedPayslipRowKey || defaultTarget.id;
        const target = filteredPaymentData.find((item) => item.id === targetKey) ?? defaultTarget;
        return target;
    }, [filteredPaymentData, selectedPayslipRowKey]);

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const [fetchedTeams, fetchedWorkers, fetchedCompanies, fetchedSites] = await Promise.all([
                    teamService.getTeams(),
                    manpowerService.getWorkers(),
                    companyService.getCompanies(),
                    siteService.getSites(),
                ]);

                setAllTeams(fetchedTeams);
                setAllWorkers(fetchedWorkers);
                setCompanies(fetchedCompanies);
                setAllSites(fetchedSites);
            } catch (error) {
                console.error('Failed to load initial data:', error);
                alert('초기 데이터를 불러오는 중 오류가 발생했습니다.');
            } finally {
                setFiltersReady(true);
            }
        };

        void fetchInitialData();
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
    const payrollConfigRef = React.useRef(payrollConfig);
    const normalizeTeamNameRef = React.useRef(normalizeTeamName);
    const buildUtilityDeductionLinesRef = React.useRef(buildUtilityDeductionLines);
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

    React.useEffect(() => {
        basePaymentDataRef.current = basePaymentData;
        paymentDataRef.current = paymentData;
        payrollConfigRef.current = payrollConfig;
        normalizeTeamNameRef.current = normalizeTeamName;
        buildUtilityDeductionLinesRef.current = buildUtilityDeductionLines;
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
    }, [basePaymentData, paymentData, payrollConfig, normalizeTeamName, buildUtilityDeductionLines, mergeDeductionBreakdownWithLines, calculateWorkEntryTaxBreakdown, rebuildDeductionBreakdown, stripTemporaryDeductionLines, stripTemporaryTaxLines, ledgerInputs, ledgerRowsData, utilityInputByPaymentRowKey, utilityInputByWorkerMonthSingle, mergeUtilityInput]);

    const applyCalculatedDeductions = useCallback((params: {
        applyInsurance: boolean;
        applyBusinessIncome: boolean;
        applyUtilities: boolean;
        applyDailyFee: boolean;
        applyInsuranceTeamSiteOnly: boolean;
    }) => {
        // useRef에서 최신값 액세스 - 자체 의존성 없음
        const config = payrollConfigRef.current;
        if ((params.applyInsurance || params.applyBusinessIncome || params.applyDailyFee) && !config) {
            alert('설정(4대보험/세율)을 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
            return;
        }

        setPaymentData((prev) => {
            const basePD = basePaymentDataRef.current.length > 0 ? basePaymentDataRef.current : prev;
            const ledgerInputsMap = ledgerInputsRef.current;
            const ledgerRowsData = ledgerRowsDataRef.current;
            const dailyFeePerManDay = Math.max(0, Math.floor(toNumber(config?.insuranceConfig?.dailyWorkerFeePerManDay ?? 0)));
            
            return basePD.map((item) => {
                const sourceDeductionBreakdown = stripTemporaryDeductionLinesRef.current(item.deductionBreakdown);
                const baseDeductionBreakdown = rebuildDeductionBreakdownRef.current({
                    standardLines: (sourceDeductionBreakdown.standardLines ?? []).filter((line) => !isAppliedUtilityOrFeeLabel(String(line.label ?? '').trim())),
                    additionalLines: (sourceDeductionBreakdown.additionalLines ?? []).filter((line) => !isAppliedUtilityOrFeeLabel(String(line.label ?? '').trim())),
                });
                const baseTaxBreakdown = stripTemporaryTaxLinesRef.current(item.taxBreakdown);

                // utility input 직접 해결 (인라인)
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
                    
                    const monthWorkerEntries = Object.entries(ledgerInputsMap)
                        .filter(([ledgerRowKey]) => ledgerRowKey.endsWith(`__${itemSalaryModel}`))
                        .filter(([ledgerRowKey]) => {
                            const parts = ledgerRowKey.split('__');
                            if (parts.length < 4) return false;
                            const [month, workerId] = parts;
                            return month === item.month && workerId === item.workerId;
                        })
                        .map(([ledgerRowKey, manual]) => {
                            const ledgerRow = ledgerRowsData.find((row) => row.rowKey === ledgerRowKey);
                            return {
                                team: normalizeTeamNameRef.current(ledgerRow?.teamName),
                                input: manual as any,
                            };
                        });
                    
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
                        const paymentRows = (basePaymentDataRef.current.length > 0 ? basePaymentDataRef.current : prev)
                            .filter((row) => row.month === item.month && row.workerId === item.workerId);
                        if (paymentRows.length === 1 && monthWorkerEntries.length > 0) {
                            utilityInput = monthWorkerEntries
                                .map((entry) => entry.input)
                                .reduce((acc, cur) => mergeUtilityInputRef.current(acc, cur));
                        }
                    }
                }

                const utilityLines = params.applyUtilities && utilityInput
                    ? buildUtilityDeductionLinesRef.current(utilityInput)
                    : [];
                const dailyFeeLines = buildDailyFeeDeductionLines({
                    item,
                    applyDailyFee: params.applyDailyFee,
                    dailyFeePerManDay,
                });
                const deductionAppliedLines = [...utilityLines, ...dailyFeeLines];

                const nextDeductionBreakdown = (params.applyUtilities || params.applyDailyFee)
                    ? mergeDeductionBreakdownWithLinesRef.current(baseDeductionBreakdown, deductionAppliedLines)
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
                    const calculatedTax = calculateWorkEntryTaxBreakdownRef.current({
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

                return {
                    ...item,
                    deductionBreakdown: nextDeductionBreakdown,
                    taxBreakdown: nextTaxBreakdown,
                    taxRateSnapshot: taxRateSnapshot,
                    insuranceAppliedSummary,
                    withholdingAppliedSummary,
                    businessIncomeAppliedSummary,
                    totalDeduction: nextTotalDeduction,
                    totalAmount: nextTotalAmount,
                };
            });
        });

        setInsuranceApplied(params.applyInsurance);
        setInsuranceTeamSiteOnly(params.applyInsuranceTeamSiteOnly);
        setBusinessIncomeApplied(params.applyBusinessIncome);
        setUtilitiesApplied(params.applyUtilities);
        setDailyFeeApplied(params.applyDailyFee);
    }, [isEntryInWorkerTeamSite]);

    useEffect(() => {
        // 스위치 상태가 바뀌었을 때만 명세서 금액을 재계산한다.
        const isApplyingAny = insuranceApplied || businessIncomeApplied || utilitiesApplied || dailyFeeApplied;
        if (!isApplyingAny) return;
        applyCalculatedDeductions({
            applyInsurance: insuranceApplied,
            applyBusinessIncome: businessIncomeApplied,
            applyUtilities: utilitiesApplied,
            applyDailyFee: dailyFeeApplied,
            applyInsuranceTeamSiteOnly: insuranceTeamSiteOnly,
        });
    }, [
        applyCalculatedDeductions,
        businessIncomeApplied,
        dailyFeeApplied,
        insuranceApplied,
        insuranceTeamSiteOnly,
        utilitiesApplied,
    ]);

    const openPayslipPreview = useCallback(() => {
        if (filteredPaymentData.length === 0) return;

        // 명세서 모달 오픈 직전 최신 공제/세금 상태를 강제로 반영해 미리보기 표시와 계산값을 동기화한다.
        if (insuranceApplied || businessIncomeApplied || utilitiesApplied || dailyFeeApplied) {
            applyCalculatedDeductions({
                applyInsurance: insuranceApplied,
                applyBusinessIncome: businessIncomeApplied,
                applyUtilities: utilitiesApplied,
                applyDailyFee: dailyFeeApplied,
                applyInsuranceTeamSiteOnly: insuranceTeamSiteOnly,
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

        const utilityLines = utilitiesApplied ? buildUtilityDeductionLines(utilityInput) : [];
        const dailyFeePerManDay = Math.max(0, Math.floor(toNumber(payrollConfig?.insuranceConfig?.dailyWorkerFeePerManDay ?? 0)));
        const dailyFeeLines = buildDailyFeeDeductionLines({
            item: payslipTarget,
            applyDailyFee: dailyFeeApplied,
            dailyFeePerManDay,
        });
        const deductionAppliedLines = [...utilityLines, ...dailyFeeLines];
        const sourceDeductionBreakdown = stripTemporaryDeductionLines(baseItem.deductionBreakdown);
        const baseDeductionBreakdown = rebuildDeductionBreakdown({
            standardLines: (sourceDeductionBreakdown.standardLines ?? []).filter((line) => !isAppliedUtilityOrFeeLabel(String(line.label ?? '').trim())),
            additionalLines: (sourceDeductionBreakdown.additionalLines ?? []).filter((line) => !isAppliedUtilityOrFeeLabel(String(line.label ?? '').trim())),
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
        ledgerInputs,
        dailyFeeApplied,
        normalizeTeamName,
        paymentData,
        payrollConfig,
        payslipTarget,
        resolveUtilityInputForPaymentItem,
        utilitiesApplied,
        utilityInputByPaymentRowKey,
        utilityInputByWorkerMonthSingle,
    ]);

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
        const shouldIncludeDailyWage = pageViewMode === 'ledger';
        const rows = allWorkers
            .filter((w): w is Worker & { id: string } => typeof w.id === 'string' && w.id.trim().length > 0)
            .filter((w) => {
                const model = (w.salaryModel ?? w.payType ?? '').trim();
                if (model === '월급제') return true;
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

    const normalizeBankKey = useCallback((value: unknown): string => {
        const collapsed = String(value ?? '')
            .trim()
            .replace(/\s+/g, '')
            .replace(/[()\[\]{}]/g, '')
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

    const resolveBankCode = useCallback((bankName?: string, bankCode?: string): string => {
        const explicitCode = String(bankCode ?? '').trim();
        if (/^\d{3}$/.test(explicitCode)) return explicitCode;

        const rawBankName = String(bankName ?? '').trim();
        if (/^\d{3}$/.test(rawBankName)) return rawBankName;

        const normalizedName = normalizeBankKey(bankName);
        if (!normalizedName) return '';

        return bankCodeByName.get(normalizedName) ?? '';
    }, [bankCodeByName, normalizeBankKey]);





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

    // 국민은행용 엑셀 다운로드 (연두색 스타일 적용)
    const handleDownloadKBExcel = () => {
        if (filteredPaymentData.length === 0) {
            alert("출력할 데이터가 없습니다.");
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

        const rowData: (string | number)[][] = filteredPaymentData.map(item => [
            resolveBankCode(item.bankName, item.bankCode),
            item.accountNumber,
            item.totalAmount,
            kbReceiverDisplay,
            `${item.workerName}${kbMemoSuffix}`
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
                if (C === 2) {
                    cell.s = greenNumberStyle;
                    cell.t = 'n';
                } else {
                    cell.s = greenStyle;
                }
            }
        }

        // 열 너비 설정
        ws['!cols'] = [
            { wch: 8 },  // A: 은행코드
            { wch: 20 }, // B: 계좌번호
            { wch: 15 }, // C: 이체금액
            { wch: 12 }, // D: 받는분 통장 표시
            { wch: 18 }, // E: 내 통장 메모
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "국민은행용");

        const fileName = `월급제_국민은행용_${rangeLabel || currentYearMonth}.xlsx`;
        XLSX.writeFile(wb, fileName);
    };

    const getKBPreviewData = () => {
        const sumSideAdvances = (side: any) => {
            if (!side) return 0;
            const toNum = (v: any) => typeof v === 'number' && !isNaN(v) ? v : 0;
            return toNum(side.carry) + toNum(side.carrySecond) + toNum(side.currentAdvance) + toNum(side.currentAdvanceSecond);
        };
        const getAdvanceItem = (side: any, field: 'carry' | 'carrySecond' | 'currentAdvance' | 'currentAdvanceSecond'): number => {
            if (!side) return 0;
            const v = side[field];
            return typeof v === 'number' && !isNaN(v) ? v : 0;
        };

        return filteredPaymentData.map((item) => {
            let amount = item.totalAmount;
            if (kbAmountType === 'invoiceNet') {
                amount = item.invoiceNetAmount || 0;
            } else if (kbAmountType === 'laborNet') {
                amount = item.laborNetAmount || 0;
            } else if (kbAmountType === 'invoiceAdvance') {
                const manual = ledgerInputs[item.id];
                amount = manual ? sumSideAdvances(manual.invoice) : 0;
            } else if (kbAmountType === 'laborAdvance') {
                const manual = ledgerInputs[item.id];
                amount = manual ? sumSideAdvances(manual.labor) : 0;
            } else if (kbAmountType === 'corporateAdvance1') {
                const manual = ledgerInputs[item.id];
                amount = manual ? getAdvanceItem(manual.invoice, 'carry') : 0;
            } else if (kbAmountType === 'corporateAdvance2') {
                const manual = ledgerInputs[item.id];
                amount = manual ? getAdvanceItem(manual.invoice, 'carrySecond') : 0;
            } else if (kbAmountType === 'corporateAdvance3') {
                const manual = ledgerInputs[item.id];
                amount = manual ? getAdvanceItem(manual.invoice, 'currentAdvance') : 0;
            } else if (kbAmountType === 'corporateAdvance4') {
                const manual = ledgerInputs[item.id];
                amount = manual ? getAdvanceItem(manual.invoice, 'currentAdvanceSecond') : 0;
            } else if (kbAmountType === 'laborAdvance1') {
                const manual = ledgerInputs[item.id];
                amount = manual ? getAdvanceItem(manual.labor, 'carry') : 0;
            } else if (kbAmountType === 'laborAdvance2') {
                const manual = ledgerInputs[item.id];
                amount = manual ? getAdvanceItem(manual.labor, 'carrySecond') : 0;
            } else if (kbAmountType === 'laborAdvance3') {
                const manual = ledgerInputs[item.id];
                amount = manual ? getAdvanceItem(manual.labor, 'currentAdvance') : 0;
            } else if (kbAmountType === 'laborAdvance4') {
                const manual = ledgerInputs[item.id];
                amount = manual ? getAdvanceItem(manual.labor, 'currentAdvanceSecond') : 0;
            }

            let memo = kbMemoSuffix;
            if (memo.includes('{이름}')) {
                memo = memo.replace('{이름}', item.workerName);
            } else if (memo.startsWith(' ')) { // Legacy prefix
                memo = item.workerName + memo;
            } else if (!memo) {
                memo = item.workerName;
            }

            return {
                은행코드: resolveBankCode(item.bankName, item.bankCode),
                계좌번호: item.accountNumber,
                이체금액: amount,
                받는분통장표시: kbReceiverDisplay,
                내통장메모: memo
            };
        }).filter((row) => Number.isFinite(row.이체금액) && row.이체금액 > 0);
    };


    const handleDownloadIndividualPayslip = useCallback(() => {
        if (!payslipTarget) return;

        const workEntries = payslipTarget.workEntries ?? [];
        const deductionBreakdown = payslipTarget.deductionBreakdown ?? createEmptyDeductionBreakdown();
        const taxBreakdown = payslipTarget.taxBreakdown ?? createEmptyDeductionBreakdown();
        const combinedDeductions = [
            ...deductionBreakdown.standardLines,
            ...deductionBreakdown.additionalLines,
            ...taxBreakdown.standardLines,
            ...taxBreakdown.additionalLines,
        ];

        const rows: (string | number)[][] = [];
        const merges: XLSX.Range[] = [];
        const pushRow = (row: (string | number)[]) => {
            rows.push(row);
            return rows.length - 1;
        };

        const titleRow = pushRow(['월급제 노임명세서', '', '', '', '', '', '', '']);
        merges.push({ s: { r: titleRow, c: 0 }, e: { r: titleRow, c: 7 } });
        pushRow([]);
        pushRow(['성명', payslipTarget.workerName, '팀', payslipTarget.teamName, '지급월', payslipTarget.month]);
        pushRow([
            '주민등록번호',
            payslipTarget.idNumber || '-',
            '시공사',
            payslipTarget.companyName || '-',
            '은행',
            payslipTarget.bankName || '-',
        ]);
        pushRow([
            '총 공수',
            Number(payslipTarget.totalManDay.toFixed(1)),
            '지급전',
            payslipTarget.grossAmount,
            '실지급',
            payslipTarget.totalAmount,
        ]);
        pushRow([]);

        const dualSectionRow = pushRow(['근무내역', '', '', '', '', '차감내역', '']);
        merges.push({ s: { r: dualSectionRow, c: 0 }, e: { r: dualSectionRow, c: 5 } });
        merges.push({ s: { r: dualSectionRow, c: 6 }, e: { r: dualSectionRow, c: 7 } });

        const tableHeaderRow = pushRow(['일자', '현장', '구분', '공수', '단가', '금액', '항목', '금액']);
        const maxRows = Math.max(workEntries.length, combinedDeductions.length, 1);
        for (let i = 0; i < maxRows; i += 1) {
            const workEntry = workEntries[i];
            const deductionEntry = combinedDeductions[i];
            rows.push([
                workEntry ? workEntry.date : '',
                workEntry ? workEntry.siteName : '',
                workEntry ? (workEntry.paymentMethod || '-') : '',
                workEntry ? Number(workEntry.manDay.toFixed(1)) : '',
                workEntry ? workEntry.unitPrice : '',
                workEntry ? (workEntry.amount || 0) : '',
                deductionEntry ? deductionEntry.label : i === 0 && combinedDeductions.length === 0 ? '등록된 공제 항목이 없습니다.' : '',
                deductionEntry ? deductionEntry.amount : '',
            ]);
        }

        const workSummaryRow = pushRow([
            '근무 합계',
            '',
            '',
            '',
            Number(workEntries.reduce((sum, entry) => sum + entry.manDay, 0).toFixed(1)),
            '',
            payslipTarget.grossAmount,
            '총 차감액',
            payslipTarget.totalDeduction,
        ]);
        pushRow([]);
        const netRow = pushRow(['실 지급액', payslipTarget.totalAmount, '', '', '', '', '', '']);

        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!merges'] = merges;
        ws['!cols'] = [
            { wch: 16 },
            { wch: 22 },
            { wch: 10 },
            { wch: 14 },
            { wch: 18 },
            { wch: 18 },
            { wch: 14 },
            { wch: 18 },
        ];

        const applyStyle = (rowIndex: number, colIndex: number, style: XLSX.CellObject['s']) => {
            const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
            if (!ws[cellAddress]) return;
            ws[cellAddress].s = style;
        };

        const titleStyle: XLSX.CellObject['s'] = {
            font: { bold: true, sz: 16, color: { rgb: 'FFFFFF' } },
            alignment: { horizontal: 'center', vertical: 'center' },
            fill: { fgColor: { rgb: '6B21A8' } },
        };
        applyStyle(titleRow, 0, titleStyle);

        const infoKeyStyle: XLSX.CellObject['s'] = {
            font: { bold: true, color: { rgb: '475569' } },
            alignment: { horizontal: 'left', vertical: 'center' },
            fill: { fgColor: { rgb: 'F8FAFC' } },
        };
        const infoValueStyle: XLSX.CellObject['s'] = {
            alignment: { horizontal: 'left', vertical: 'center' },
        };
        const infoRows = [2, 3, 4];
        infoRows.forEach((rowIdx) => {
            [0, 2, 4].forEach((colIdx) => applyStyle(rowIdx, colIdx, infoKeyStyle));
            [1, 3, 5].forEach((colIdx) => applyStyle(rowIdx, colIdx, infoValueStyle));
        });

        const sectionHeaderStyle: XLSX.CellObject['s'] = {
            font: { bold: true, color: { rgb: '4338CA' } },
            alignment: { horizontal: 'left', vertical: 'center' },
            fill: { fgColor: { rgb: 'EEF2FF' } },
        };
        [0, 6].forEach((colIdx) => applyStyle(dualSectionRow, colIdx, sectionHeaderStyle));

        const tableHeaderStyle: XLSX.CellObject['s'] = {
            font: { bold: true, color: { rgb: '475569' } },
            alignment: { horizontal: 'center', vertical: 'center' },
            fill: { fgColor: { rgb: 'E2E8F0' } },
            border: {
                top: { style: 'thin', color: { rgb: 'CBD5F5' } },
                bottom: { style: 'thin', color: { rgb: 'CBD5F5' } },
                left: { style: 'thin', color: { rgb: 'CBD5F5' } },
                right: { style: 'thin', color: { rgb: 'CBD5F5' } },
            },
        };
        [0, 1, 2, 3, 4, 5, 6, 7].forEach((colIdx) => applyStyle(tableHeaderRow, colIdx, tableHeaderStyle));

        const numberStyle: XLSX.CellObject['s'] = {
            alignment: { horizontal: 'right', vertical: 'center' },
            numFmt: '#,##0.0',
        };
        const currencyStyle: XLSX.CellObject['s'] = {
            alignment: { horizontal: 'right', vertical: 'center' },
            numFmt: '#,##0',
        };

        for (let i = 0; i < maxRows; i += 1) {
            const rowIdx = tableHeaderRow + 1 + i;
            applyStyle(rowIdx, 3, numberStyle);
            applyStyle(rowIdx, 4, currencyStyle);
            applyStyle(rowIdx, 5, currencyStyle);
            applyStyle(rowIdx, 7, currencyStyle);
        }
        applyStyle(workSummaryRow, 3, numberStyle);
        applyStyle(workSummaryRow, 4, currencyStyle);
        applyStyle(workSummaryRow, 5, currencyStyle);
        applyStyle(workSummaryRow, 7, currencyStyle);

        const summaryStyle: XLSX.CellObject['s'] = {
            font: { bold: true },
            alignment: { horizontal: 'left', vertical: 'center' },
        };
        applyStyle(workSummaryRow, 0, summaryStyle);
        applyStyle(workSummaryRow, 6, summaryStyle);
        applyStyle(netRow, 0, summaryStyle);
        applyStyle(netRow, 1, currencyStyle);

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '노임명세서');
        const safeName = (payslipTarget.workerName || 'worker').replace(/[\\/:*?"<>|]/g, '_');
        XLSX.writeFile(wb, `노임명세서_${safeName}_${payslipTarget.month}.xlsx`);
    }, [payslipTarget]);

    const [batchDownloading, setBatchDownloading] = useState(false);
    const batchRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

    const handleDownloadImage = async () => {
        if (!printRef.current || !payslipTarget) return;

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

        if (filteredPaymentData.length > 50 && !window.confirm(`총 ${filteredPaymentData.length}명의 명세서를 생성합니다. 시간이 다소 소요될 수 있습니다. 진행하시겠습니까?`)) {
            return;
        }

        setBatchDownloading(true);
        const zip = new JSZip();
        const folder = zip.folder(`노임명세서_${rangeLabel || currentYearMonth}_${selectedTeamId ? teams.find(t => t.id === selectedTeamId)?.name : '전체'}`);

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
                    folder?.file(`${item.workerName}_${item.month}.png`, blob);
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
        <div className="h-full flex flex-col p-2 w-full overflow-hidden">
            {!hideHeader && (
                <div className="flex-shrink-0 bg-white border border-slate-200 rounded-lg shadow-sm px-2 py-1.5 mb-1.5">
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-1.5">
                            <div className="bg-rose-100 text-rose-600 p-1 rounded-md">
                                <FontAwesomeIcon icon={faCalendarDays} className="text-sm" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-slate-800 leading-tight">통합급여관리</h1>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 text-base min-w-0 overflow-visible">
                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-1.5 py-1">
                                <div className="flex flex-wrap items-center gap-1">
                                    <span className="font-semibold text-slate-700 mr-1">정산기간</span>

                                    <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                                        <button
                                            type="button"
                                            onClick={() => handleMonthModeChange('single')}
                                            className={`px-3 h-8 rounded-md text-[14px] font-bold transition-colors ${monthSelectionMode === 'single' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                                        >
                                            해당달
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleMonthModeChange('range')}
                                            className={`px-3 h-8 rounded-md text-[14px] font-bold transition-colors ${monthSelectionMode === 'range' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                                        >
                                            기간
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-1.5 py-1">
                                        <button
                                            type="button"
                                            onClick={() => setYearCursor(shiftYearMonth(yearCursor, -12))}
                                            className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-800"
                                            aria-label="이전 연도"
                                        >
                                            <FontAwesomeIcon icon={faChevronLeft} className="text-[12px]" />
                                        </button>
                                        <span className="min-w-[66px] text-center text-[14px] font-bold text-slate-700">{formatYearMonthParts(yearCursor).year}년</span>
                                        <button
                                            type="button"
                                            onClick={() => setYearCursor(shiftYearMonth(yearCursor, 12))}
                                            className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-800"
                                            aria-label="다음 연도"
                                        >
                                            <FontAwesomeIcon icon={faChevronRight} className="text-[12px]" />
                                        </button>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={handleSelectPrevMonth}
                                        className={`h-8 rounded-md border px-3 text-[14px] font-bold transition-colors ${startMonth === prevYearMonth && endMonth === prevYearMonth ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}
                                    >
                                        전달
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleSelectCurrentMonth}
                                        className={`h-8 rounded-md border px-3 text-[14px] font-bold transition-colors ${startMonth === currentYearMonth && endMonth === currentYearMonth ? 'border-blue-500 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}
                                    >
                                        이달
                                    </button>

                                    <div className="flex flex-wrap items-center gap-1 px-1 border-l border-slate-200">
                                    {Array.from({ length: 12 }, (_, i) => i + 1).map((monthNumber) => {
                                        const year = formatYearMonthParts(yearCursor).year;
                                        const ym = `${year}-${String(monthNumber).padStart(2, '0')}`;
                                        const isInRange = monthRangeSet.has(ym);
                                        const isActive = startMonth === ym || endMonth === ym;
                                        const isAnchor = monthSelectionMode === 'range' && rangeAnchorMonth === ym;

                                        return (
                                            <button
                                                key={`top-month-${monthNumber}`}
                                                type="button"
                                                onClick={() => handleMonthButtonSelect(ym)}
                                                className={`h-7 min-w-[32px] rounded-md border px-2 text-[13px] font-bold transition-colors ${isActive || isAnchor ? 'border-blue-500 bg-blue-600 text-white' : isInRange ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}
                                            >
                                                {monthNumber}
                                            </button>
                                        );
                                    })}
                                    </div>

                                    <span className="ml-1 rounded-md border border-slate-200 bg-white px-3 py-1 text-[14px] font-semibold text-slate-700">
                                        {rangeLabel || '-'}
                                    </span>
                                </div>
                            </div>

                            <span className="ml-1 font-semibold text-slate-700">팀선택</span>
                            <div className="relative shrink-0" ref={teamDropdownRef}>
                                <button
                                    type="button"
                                    onClick={() => setTeamDropdownOpen((prev) => !prev)}
                                    className="h-10 min-w-[152px] rounded-lg border border-slate-300 bg-white px-3 text-base font-semibold text-slate-700 inline-flex items-center justify-between gap-2"
                                    aria-haspopup="listbox"
                                    aria-expanded={teamDropdownOpen}
                                >
                                    <span className="truncate">{selectedTeamLabel}</span>
                                    <FontAwesomeIcon icon={faChevronDown} className={`text-[12px] text-slate-500 transition-transform ${teamDropdownOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {teamDropdownOpen && (
                                    <div className="absolute z-[80] mt-1 w-52 max-h-64 overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg p-1" role="listbox">
                                        <button
                                            type="button"
                                            className={`w-full text-left px-3 py-2.5 rounded text-base font-semibold transition-colors ${selectedTeamId === '' ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'}`}
                                            onClick={() => {
                                                setSelectedTeamId('');
                                                setTeamDropdownOpen(false);
                                            }}
                                        >
                                            팀전체
                                        </button>
                                        {teams
                                            .filter((team): team is Team & { id: string } => typeof team.id === 'string' && team.id.trim().length > 0)
                                            .map((team) => (
                                                <button
                                                    key={team.id}
                                                    type="button"
                                                    className={`w-full text-left px-3 py-2.5 rounded text-base font-semibold transition-colors ${selectedTeamId === team.id ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'}`}
                                                    onClick={() => {
                                                        setSelectedTeamId(team.id);
                                                        setTeamDropdownOpen(false);
                                                    }}
                                                >
                                                    {team.name}
                                                </button>
                                            ))}
                                    </div>
                                )}
                            </div>

                            <span className="ml-1 w-px h-5 bg-slate-200" />

                            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                                <button
                                    type="button"
                                    className={`px-3 h-8 rounded-md text-[14px] font-bold transition-colors ${filterMode === 'team' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                                    onClick={() => setFilterMode('team')}
                                >
                                    팀
                                </button>
                                <button
                                    type="button"
                                    className={`px-3 h-8 rounded-md text-[14px] font-bold transition-colors ${filterMode === 'worker' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                                    onClick={() => setFilterMode('worker')}
                                >
                                    개인
                                </button>
                            </div>

                            {filterMode === 'worker' && (
                                <>
                                    <select
                                        value={selectedWorkerId}
                                        onChange={(e) => setSelectedWorkerId(e.target.value)}
                                        className="h-10 min-w-[132px] rounded-lg border border-slate-300 bg-white px-3 text-base font-semibold text-slate-700"
                                    >
                                        <option value="">개인전체</option>
                                        {workerOptions.map((worker) => (
                                            <option key={worker.id} value={worker.id}>{worker.name}</option>
                                        ))}
                                    </select>
                                    <input
                                        type="text"
                                        value={workerSearchText}
                                        onChange={(e) => setWorkerSearchText(e.target.value)}
                                        placeholder="이름 검색"
                                        className="h-10 w-32 rounded-lg border border-slate-300 bg-white px-3 text-base font-semibold text-slate-700 placeholder-slate-400"
                                    />
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <ToolbarContainer>
                <ToolbarLead>
                    <ToolbarLeadMeta>
                        <ToolbarBadge>{rangeLabel || '-'}</ToolbarBadge>
                        <ToolbarBadge>대상 {filteredPaymentData.length + filteredLedgerRows.filter(r => r.salaryModel === '일급제').length}명</ToolbarBadge>
                        <ActionButton type="button" $variant="secondary" onClick={fetchData}>
                            <FontAwesomeIcon icon={faSearch} />
                            조회
                        </ActionButton>
                        <ActionButton
                            type="button"
                            $variant="outline"
                            onClick={() => setToolbarExpanded((prev) => !prev)}
                        >
                            <FontAwesomeIcon icon={toolbarExpanded ? faChevronUp : faChevronDown} />
                            {toolbarExpanded ? '간편 보기' : '상세 설정'}
                        </ActionButton>
                    </ToolbarLeadMeta>
                </ToolbarLead>

                {toolbarExpanded && (
                    <ToolbarGrid>
                    <ToolbarCard $span={7}>
                        <ToolbarCardHeader>
                            <div>
                                <ToolbarCardTitle>정산 기간 선택</ToolbarCardTitle>
                                <ToolbarCardDescription>연도 이동과 월 범위 선택을 한 카드 안에서 처리합니다.</ToolbarCardDescription>
                            </div>
                            <ToolbarBadge>{monthRange.length}개월</ToolbarBadge>
                        </ToolbarCardHeader>
                        <ToolbarCardBody>
                            <ToolbarInline>
                                <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                                    <button
                                        type="button"
                                        onClick={() => handleMonthModeChange('single')}
                                        className={`px-2.5 h-7 rounded-md text-xs font-bold transition-colors ${monthSelectionMode === 'single' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                                    >
                                        해당달
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleMonthModeChange('range')}
                                        className={`px-2.5 h-7 rounded-md text-xs font-bold transition-colors ${monthSelectionMode === 'range' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                                    >
                                        기간
                                    </button>
                                </div>

                                <ToolbarSectionDivider />

                                <YearNavigator>
                                    <YearButton
                                        type="button"
                                        onClick={() => setYearCursor(shiftYearMonth(yearCursor, -12))}
                                        title="이전 연도"
                                    >
                                        <FontAwesomeIcon icon={faChevronLeft} />
                                    </YearButton>
                                    <YearText>{parseInt(yearCursor.split('-')[0], 10)}년</YearText>
                                    <YearButton
                                        type="button"
                                        onClick={() => setYearCursor(shiftYearMonth(yearCursor, 12))}
                                        title="다음 연도"
                                    >
                                        <FontAwesomeIcon icon={faChevronRight} />
                                    </YearButton>
                                </YearNavigator>

                                <ToolbarSectionDivider />

                                <QuickRangeGroup>
                                    <QuickRangeButton
                                        type="button"
                                        onClick={handleSelectPrevMonth}
                                    >
                                        전달
                                    </QuickRangeButton>
                                    <QuickRangeButton
                                        type="button"
                                        onClick={handleSelectCurrentMonth}
                                    >
                                        이달
                                    </QuickRangeButton>
                                </QuickRangeGroup>
                            </ToolbarInline>

                            <MonthGrid>
                                {Array.from({ length: 12 }, (_, i) => i + 1).map((monthNumber) => {
                                    const year = formatYearMonthParts(yearCursor).year;
                                    const ym = `${year}-${String(monthNumber).padStart(2, '0')}`;
                                    const isInRange = monthRangeSet.has(ym);
                                    const isActive = startMonth === ym || endMonth === ym || (monthSelectionMode === 'range' && rangeAnchorMonth === ym);

                                    return (
                                        <MonthButton
                                            key={monthNumber}
                                            type="button"
                                            $active={isActive}
                                            $inRange={isInRange}
                                            onClick={() => handleMonthButtonSelect(ym)}
                                        >
                                            {monthNumber}월
                                        </MonthButton>
                                    );
                                })}
                            </MonthGrid>

                            <div className="text-[11px] text-slate-500">
                                {monthSelectionMode === 'single'
                                    ? '해당달 모드: 월 버튼을 누르면 시작월/종료월이 같은 달로 설정됩니다.'
                                    : rangeAnchorMonth
                                        ? `기간 모드: 종료월을 선택하세요. (시작월 ${rangeAnchorMonth})`
                                        : '기간 모드: 시작월을 선택한 뒤 종료월을 선택하세요.'}
                            </div>
                        </ToolbarCardBody>
                    </ToolbarCard>

                    <ToolbarCard $span={5}>
                        <ToolbarCardHeader>
                            <div>
                                <ToolbarCardTitle>표시 방식 제어</ToolbarCardTitle>
                                <ToolbarCardDescription>기본 목록과 가불 대장 전환, 세부 섹션 노출을 한 카드로 묶었습니다.</ToolbarCardDescription>
                            </div>
                            <ToolbarBadge>{pageViewMode === 'ledger' ? '가불대장' : '기본목록'}</ToolbarBadge>
                        </ToolbarCardHeader>
                        <ToolbarCardBody>
                            <SegmentedGroup>
                                <SegmentedButton type="button" $active={pageViewMode === 'standard'} onClick={() => setPageViewMode('standard')}>
                                    기본 목록
                                </SegmentedButton>
                                <SegmentedButton type="button" $active={pageViewMode === 'ledger'} onClick={() => setPageViewMode('ledger')}>
                                    가불 대장
                                </SegmentedButton>
                            </SegmentedGroup>

                            {pageViewMode === 'ledger' ? (
                                <FieldCard>
                                    <FieldLabel>가불대장 항목</FieldLabel>
                                    <ToggleChipGroup>
                                        <ToggleChipButton
                                            type="button"
                                            $active={ledgerVisibleSections.utilities}
                                            onClick={() => setLedgerVisibleSections((prev) => ({ ...prev, utilities: !prev.utilities }))}
                                        >
                                            공과금
                                        </ToggleChipButton>
                                        <ToggleChipButton
                                            type="button"
                                            $active={ledgerVisibleSections.advances}
                                            onClick={() => setLedgerVisibleSections((prev) => ({ ...prev, advances: !prev.advances }))}
                                        >
                                            가불
                                        </ToggleChipButton>
                                        <ToggleChipButton
                                            type="button"
                                            $active={ledgerVisibleSections.taxes}
                                            onClick={() => setLedgerVisibleSections((prev) => ({ ...prev, taxes: !prev.taxes }))}
                                        >
                                            세금
                                        </ToggleChipButton>
                                    </ToggleChipGroup>
                                </FieldCard>
                            ) : (
                                <FieldCard>
                                    <FieldLabel>표시 옵션</FieldLabel>
                                    <ActionCluster>
                                        <ModernSwitch compact label="계좌 컬럼 표시" checked={showAccountColumns} onChange={setShowAccountColumns} />
                                        <ModernSwitch compact label="계산노무 표시" checked={showCalculationLabor} onChange={setShowCalculationLabor} />
                                    </ActionCluster>
                                </FieldCard>
                            )}
                        </ToolbarCardBody>
                    </ToolbarCard>

                    <ToolbarCard $span={5}>
                        <ToolbarCardHeader>
                            <div>
                                <ToolbarCardTitle>정산 규칙 토글</ToolbarCardTitle>
                                <ToolbarCardDescription>보험, 사업소득, 공과금, 일급제 수수료 적용 상태를 카드형 스위치로 즉시 제어합니다.</ToolbarCardDescription>
                            </div>
                        </ToolbarCardHeader>
                        <ToolbarCardBody>
                            <ActionCluster>
                                <ModernSwitch
                                    label="4대보험 적용"
                                    checked={insuranceApplied}
                                    compact
                                    onChange={(value) => applyCalculatedDeductions({
                                        applyInsurance: value,
                                        applyBusinessIncome: businessIncomeApplied,
                                        applyUtilities: utilitiesApplied,
                                        applyDailyFee: dailyFeeApplied,
                                        applyInsuranceTeamSiteOnly: insuranceTeamSiteOnly,
                                    })}
                                />
                                <ModernSwitch
                                    label="해당팀 4대보험"
                                    checked={insuranceTeamSiteOnly}
                                    compact
                                    onChange={(value) => applyCalculatedDeductions({
                                        applyInsurance: insuranceApplied,
                                        applyBusinessIncome: businessIncomeApplied,
                                        applyUtilities: utilitiesApplied,
                                        applyDailyFee: dailyFeeApplied,
                                        applyInsuranceTeamSiteOnly: value,
                                    })}
                                />
                                <ModernSwitch
                                    label="사업소득 적용"
                                    checked={businessIncomeApplied}
                                    compact
                                    onChange={(value) => applyCalculatedDeductions({
                                        applyInsurance: insuranceApplied,
                                        applyBusinessIncome: value,
                                        applyUtilities: utilitiesApplied,
                                        applyDailyFee: dailyFeeApplied,
                                        applyInsuranceTeamSiteOnly: insuranceTeamSiteOnly,
                                    })}
                                />
                                <ModernSwitch
                                    label="공과금 적용"
                                    checked={utilitiesApplied}
                                    compact
                                    onChange={(value) => applyCalculatedDeductions({
                                        applyInsurance: insuranceApplied,
                                        applyBusinessIncome: businessIncomeApplied,
                                        applyUtilities: value,
                                        applyDailyFee: dailyFeeApplied,
                                        applyInsuranceTeamSiteOnly: insuranceTeamSiteOnly,
                                    })}
                                />
                                <ModernSwitch
                                    label="수수료 적용"
                                    checked={dailyFeeApplied}
                                    compact
                                    onChange={(value) => applyCalculatedDeductions({
                                        applyInsurance: insuranceApplied,
                                        applyBusinessIncome: businessIncomeApplied,
                                        applyUtilities: utilitiesApplied,
                                        applyDailyFee: value,
                                        applyInsuranceTeamSiteOnly: insuranceTeamSiteOnly,
                                    })}
                                />
                            </ActionCluster>

                            {(insuranceApplied || businessIncomeApplied || utilitiesApplied || dailyFeeApplied) && (
                                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-700 space-y-1.5">
                                    <div className="font-bold text-slate-800">현재 적용되는 로직</div>

                                    {insuranceApplied && (
                                        <div>
                                            <span className="font-semibold text-slate-800">4대보험</span>
                                            {' '}
                                            노무 공수를 현장+발주사 그룹으로 합산해
                                            {' '}
                                            <span className="font-semibold">{insuranceThresholdDays}공수 이상</span>
                                            {' '}
                                            그룹에 국민연금/건강보험/장기요양을 적용합니다.
                                        </div>
                                    )}

                                    {insuranceApplied && (
                                        <div>
                                            <span className="font-semibold text-slate-800">갑근세/지방세</span>
                                            {' '}
                                            {withholdingApplyAllLaborView
                                                ? '노무 전체 공수 대상'
                                                : `노무 ${WITHHOLDING_MAX_MAN_DAY}공수 이하 대상`}
                                            {' '}
                                            · 계산식: ((단가 - {withholdingBaseDeductionWonView.toLocaleString()}원) x 노무공수 x {withholdingIncomeRatePercentView}%) x (1 - {withholdingTaxCreditPercentView}%)
                                            {' '}
                                            / 지방세 {withholdingResidentRatePercentView}%
                                        </div>
                                    )}

                                    {insuranceApplied && (
                                        <div>
                                            <span className="font-semibold text-slate-800">고용보험</span>
                                            {' '}
                                            기준 충족 그룹 + 갑근세 대상 그룹에 적용되며,
                                            {' '}
                                            공수미달 자동적용 설정은
                                            {' '}
                                            <span className="font-semibold">{employmentApplyBelowThresholdView ? 'ON' : 'OFF'}</span>
                                            입니다.
                                        </div>
                                    )}

                                    {insuranceApplied && insuranceTeamSiteOnly && (
                                        <div>
                                            <span className="font-semibold text-slate-800">팀 매칭 제한</span>
                                            {' '}
                                            작업자 팀과 현장 담당팀이 매칭되는 근무내역만 4대보험 판정에 포함합니다.
                                            {' '}
                                            해당 현장에서 4대보험 기준 미달이거나 팀 매칭에서 제외된 나머지 노무현장은
                                            {' '}
                                            {withholdingApplyAllLaborView
                                                ? '갑근세/지방세 노무 전체 공수 대상으로 분류됩니다.'
                                                : `갑근세/지방세 노무 ${WITHHOLDING_MAX_MAN_DAY}공수 이하 대상으로 분류됩니다.`}
                                        </div>
                                    )}

                                    {businessIncomeApplied && (
                                        <div>
                                            <span className="font-semibold text-slate-800">사업소득</span>
                                            {' '}
                                            4대보험/갑근세 대상에서 제외된 금액에 3.0% + 0.3%를 적용합니다.
                                        </div>
                                    )}

                                    {utilitiesApplied && (
                                        <div>
                                            <span className="font-semibold text-slate-800">공과금</span>
                                            {' '}
                                            가불대장 공과금 입력(숙소비/전기료/가스비/수도세/인터넷/관리비/과태료/기타)을 공제내역에 반영합니다.
                                        </div>
                                    )}

                                    {dailyFeeApplied && (
                                        <div>
                                            <span className="font-semibold text-slate-800">일급제 수수료</span>
                                            {' '}
                                            일급제 작업자에게 공수 x {dailyWorkerFeePerManDayView.toLocaleString()}원(공수당) 수수료를 공제합니다.
                                        </div>
                                    )}

                                    {(insuranceApplied && businessIncomeApplied) || (insuranceApplied && utilitiesApplied) || (insuranceApplied && dailyFeeApplied) || (businessIncomeApplied && utilitiesApplied) || (businessIncomeApplied && dailyFeeApplied) || (utilitiesApplied && dailyFeeApplied) ? (
                                        <div className="rounded-md border border-slate-200 bg-white px-2 py-1.5 space-y-1">
                                            <div className="font-semibold text-slate-800">겹침 적용 로직</div>
                                            {insuranceApplied && businessIncomeApplied && (
                                                <div>4대보험/갑근세가 먼저 대상을 확정하고, 사업소득은 그 제외 금액에만 계산됩니다.</div>
                                            )}
                                            {insuranceApplied && utilitiesApplied && (
                                                <div>세금 계산 결과(4대보험/갑근세/지방세)에 공과금 공제가 추가 합산됩니다.</div>
                                            )}
                                            {businessIncomeApplied && utilitiesApplied && (
                                                <div>사업소득 3.3% 세금과 공과금 공제가 함께 총 공제액에 합산됩니다.</div>
                                            )}
                                            {dailyFeeApplied && (
                                                <div>일급제 수수료는 공과금/세금과 함께 총 공제액에 합산됩니다.</div>
                                            )}
                                            {(insuranceApplied || businessIncomeApplied || utilitiesApplied || dailyFeeApplied) && (
                                                <div className="font-medium text-slate-800">최종 실지급 = 세전금액 - (보험/세금 + 사업소득세 + 공과금 + 일급제 수수료)</div>
                                            )}
                                        </div>
                                    ) : null}
                                </div>
                            )}

                            <ActionCluster>
                                <ActionButton type="button" $variant="outline" onClick={openInsuranceSettings}>
                                    <FontAwesomeIcon icon={faSave} />
                                    요율 설정
                                </ActionButton>
                            </ActionCluster>
                        </ToolbarCardBody>
                    </ToolbarCard>

                    <ToolbarCard $span={7}>
                        <ToolbarCardHeader>
                            <div>
                                <ToolbarCardTitle>조회 및 문서 액션</ToolbarCardTitle>
                                <ToolbarCardDescription>조회, 은행용 미리보기, 명세서, 일괄 다운로드를 작업 흐름에 맞게 정렬했습니다.</ToolbarCardDescription>
                            </div>
                            <ToolbarBadge>{paymentData.length + ledgerRowsData.filter(r => r.salaryModel === '일급제').length}건 로드됨</ToolbarBadge>
                        </ToolbarCardHeader>
                        <ToolbarCardBody>
                            <ActionCluster>
                                <ActionButton type="button" $variant="secondary" onClick={fetchData}>
                                    <FontAwesomeIcon icon={faSearch} />
                                    조회
                                </ActionButton>
                                <ActionButton type="button" $variant="warning" onClick={() => setShowKBPreview(true)} disabled={paymentData.length === 0}>
                                    <FontAwesomeIcon icon={faFileExcel} />
                                    국민은행
                                </ActionButton>
                                <ActionButton
                                    type="button"
                                    $variant="accent"
                                    onClick={openPayslipPreview}
                                    disabled={paymentData.length === 0}
                                >
                                    <FontAwesomeIcon icon={faDownload} />
                                    명세서
                                </ActionButton>
                                <ActionButton
                                    type="button"
                                    $variant="success"
                                    onClick={handleBatchDownload}
                                    disabled={paymentData.length === 0 || batchDownloading}
                                >
                                    {batchDownloading ? (
                                        <FontAwesomeIcon icon={faSpinner} spin />
                                    ) : (
                                        <FontAwesomeIcon icon={faFileZipper} />
                                    )}
                                    {batchDownloading ? '처리 중...' : '일괄 다운로드'}
                                </ActionButton>
                                <ActionButton
                                    type="button"
                                    $variant="secondary"
                                    onClick={() => advanceLedgerRef.current?.downloadExcel(rangeLabel || currentYearMonth)}
                                    disabled={ledgerRowsData.length === 0}
                                >
                                    <FontAwesomeIcon icon={faFileExcel} />
                                    가불대장 엑셀
                                </ActionButton>
                            </ActionCluster>
                        </ToolbarCardBody>
                    </ToolbarCard>
                    </ToolbarGrid>
                )}
            </ToolbarContainer>

            {/* Hidden Batch Rendering Container */}
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
                        applyUtilities={utilitiesApplied}
                        insuranceTeamSiteOnly={insuranceTeamSiteOnly}
                        isTeamResponsibleSiteEntry={isEntryInWorkerTeamSite}
                    />
                ))}
            </div>

            {errorCount > 0 && (
                <div className="flex-shrink-0 mb-2 bg-red-50 border border-red-200 text-red-700 px-2.5 py-2 rounded-lg flex items-center gap-1.5 text-base">
                    <FontAwesomeIcon icon={faExclamationTriangle} className="text-red-500" />
                    <span><strong>{errorCount}건</strong>의 계좌 정보가 누락되었습니다. 작업자 DB를 점검해주세요.</span>
                </div>
            )}

            <div className={`${pageViewMode === 'ledger' ? 'hidden ' : ''}flex-1 min-h-0 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col`}>
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

                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
                    <table
                        className="w-full table-fixed text-[13px] text-left border-separate border-spacing-0"
                    >
                        <thead className="bg-slate-50 text-slate-500 font-medium sticky top-0 z-40">
                            <tr className="border-b border-slate-200">
                                <th className="px-2 py-1.5 text-center w-10 border-b border-slate-200"></th>
                                <th className="px-2 py-1.5 border-b border-slate-200">월</th>
                                <th className="px-2 py-1.5 border-b border-slate-200">이름</th>
                                <th className="px-2 py-1.5 border-b border-slate-200">팀명</th>
                                <th className="px-2 py-1.5 border-b border-slate-200">주민번호</th>
                                <th className="px-2 py-1.5 border-b border-slate-200">시공사</th>
                                <th className="px-2 py-1.5">총 공수</th>
                                <th className="px-2 py-1.5 text-right">단가</th>
                                <th className="px-2 py-1.5 text-right">지급전</th>
                                {showCalculationLabor && (
                                    <>
                                        <th className="px-2 py-1.5 text-center bg-blue-50/50 text-blue-700">계산서 공수</th>
                                        <th className="px-2 py-1.5 text-right bg-blue-50/50 text-blue-700">계산서 금액</th>
                                        <th className="px-2 py-1.5 text-center bg-indigo-50/50 text-indigo-700">노무 공수</th>
                                        <th className="px-2 py-1.5 text-right bg-indigo-50/50 text-indigo-700">노무 금액</th>
                                    </>
                                )}
                                <th className="px-2 py-1.5 text-right">공제</th>
                                <th className="px-2 py-1.5 text-right">실지급</th>
                                {showAccountColumns && (
                                    <>
                                        <th className="px-2 py-1.5">
                                            코드
                                            <button
                                                type="button"
                                                onClick={() => setShowBankCodes(true)}
                                                className="ml-1 text-xs text-blue-600 hover:text-blue-800"
                                            >
                                                📋
                                            </button>
                                        </th>
                                        <th className="px-2 py-1.5">은행명</th>
                                        <th className="px-2 py-1.5">계좌번호</th>
                                        <th className="px-2 py-1.5">예금주</th>
                                    </>
                                )}
                                <th className="px-2 py-1.5 border-b border-slate-200">표시내용</th>
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
                                    const baseRowsForDisplay = basePaymentData.length > 0 ? basePaymentData : paymentData;
                                    const baseItemForDisplay = baseRowsForDisplay.find((row) => row.id === item.id) ?? item;
                                    const utilityInputForDisplay = utilitiesApplied ? resolveUtilityInputForPaymentItem(item) : undefined;
                                    const utilityLinesForDisplay = utilitiesApplied ? buildUtilityDeductionLines(utilityInputForDisplay) : [];
                                    const dailyFeePerManDayForDisplay = Math.max(0, Math.floor(toNumber(payrollConfig?.insuranceConfig?.dailyWorkerFeePerManDay ?? 0)));
                                    const dailyFeeLinesForDisplay = buildDailyFeeDeductionLines({
                                        item,
                                        applyDailyFee: dailyFeeApplied,
                                        dailyFeePerManDay: dailyFeePerManDayForDisplay,
                                    });
                                    const deductionAppliedLinesForDisplay = [...utilityLinesForDisplay, ...dailyFeeLinesForDisplay];
                                    const sourceDeductionForDisplay = stripTemporaryDeductionLines(baseItemForDisplay.deductionBreakdown);
                                    const baseDeductionForDisplay = rebuildDeductionBreakdown({
                                        standardLines: (sourceDeductionForDisplay.standardLines ?? []).filter((line) => !isAppliedUtilityOrFeeLabel(String(line.label ?? '').trim())),
                                        additionalLines: (sourceDeductionForDisplay.additionalLines ?? []).filter((line) => !isAppliedUtilityOrFeeLabel(String(line.label ?? '').trim())),
                                    });
                                    const deductionBreakdownForDisplay = (utilitiesApplied || dailyFeeApplied)
                                        ? mergeDeductionBreakdownWithLines(baseDeductionForDisplay, deductionAppliedLinesForDisplay)
                                        : sourceDeductionForDisplay;
                                    const deductionLinesForDisplay = [
                                        ...(deductionBreakdownForDisplay.standardLines ?? []),
                                        ...(deductionBreakdownForDisplay.additionalLines ?? []),
                                    ];
                                    const advanceLinesForDisplay = deductionLinesForDisplay.filter((line) =>
                                        advanceLabelSet.has(normalizeLineLabel(String(line?.label ?? '')))
                                    );
                                    const nonAdvanceDeductionLinesForDisplay = deductionLinesForDisplay.filter((line) =>
                                        !advanceLabelSet.has(normalizeLineLabel(String(line?.label ?? '')))
                                    );
                                    const advanceTotalForDisplay = advanceLinesForDisplay.reduce((sum, line) => sum + toNumber(line.amount), 0);
                                    const nonAdvanceDeductionTotalForDisplay = nonAdvanceDeductionLinesForDisplay.reduce((sum, line) => sum + toNumber(line.amount), 0);
                                    const hasNonAdvanceDeductionLines = nonAdvanceDeductionLinesForDisplay.length > 0;
                                    const hasAdvanceLines = advanceLinesForDisplay.length > 0;
                                    const taxLinesForItem = getTaxLinesForItem(item);
                                    const taxTotalForDisplay = taxLinesForItem.reduce((sum, line) => sum + toNumber(line.amount), 0);
                                    const totalDeductionForDisplay = deductionBreakdownForDisplay.total + taxTotalForDisplay;
                                    const totalAmountForDisplay = item.grossAmount - totalDeductionForDisplay;
                                    const insuranceTaxLines = taxLinesForItem.filter((line) => isInsuranceSectionTaxLabel(line.label));
                                    const withholdingTaxLines = taxLinesForItem.filter((line) => isWithholdingSectionTaxLabel(line.label));
                                    const businessTaxLines = taxLinesForItem.filter((line) => isBusinessSectionTaxLabel(line.label));
                                    const otherTaxLines = taxLinesForItem.filter((line) => (
                                        !isInsuranceSectionTaxLabel(line.label)
                                        && !isWithholdingSectionTaxLabel(line.label)
                                        && !isBusinessSectionTaxLabel(line.label)
                                    ));
                                    const insuranceSectionTaxTotal = sumInsuranceSectionTax(item);
                                    const withholdingSectionTaxTotal = sumWithholdingSectionTax(item);
                                    const businessSectionTaxTotal = sumBusinessSectionTax(item);
                                    const otherTaxTotal = otherTaxLines.reduce((sum, line) => sum + toNumber(line.amount), 0);
                                    const insuranceAfterTaxAmount = Math.max(0, Math.floor((item.insuranceAppliedSummary?.appliedAmount ?? 0) - insuranceSectionTaxTotal));
                                    const withholdingGrossAmount = item.withholdingAppliedSummary
                                        ? toNumber(item.withholdingAppliedSummary.grossAmount ?? item.withholdingAppliedSummary.appliedAmount)
                                        : 0;
                                    const withholdingAfterTaxAmount = Math.max(0, Math.floor(withholdingGrossAmount - withholdingSectionTaxTotal));
                                    const businessAfterTaxAmount = Math.max(0, Math.floor((item.businessIncomeAppliedSummary?.appliedAmount ?? 0) - businessSectionTaxTotal));
                                    const showInsuranceSection = insuranceTaxLines.length > 0;
                                    const hasInsuranceTargetSummary = Boolean(item.insuranceAppliedSummary && item.insuranceAppliedSummary.appliedManDay > 0);
                                    const withholdingDetailText = resolveWithholdingDetailText(item.taxRateSnapshot);

                                    return (
                                        <React.Fragment key={rowKey}>
                                            <tr className={`transition ${item.id.endsWith('__월급제') ? 'bg-blue-50/25 hover:bg-blue-50/40' : 'bg-emerald-50/25 hover:bg-emerald-50/40'} ${!item.isValid ? 'bg-red-50' : ''} ${isExpanded ? 'ring-1 ring-indigo-200' : ''}`}>
                                                <td className="px-2 py-1.5 text-center border-b border-slate-100">
                                                    <button
                                                        onClick={() => toggleRow(item.id)}
                                                        className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors ${isExpanded ? 'bg-brand-100 text-brand-600' : 'text-slate-400 hover:bg-slate-100'}`}
                                                    >
                                                        <FontAwesomeIcon icon={isExpanded ? faChevronUp : faChevronDown} className="text-xs" />
                                                    </button>
                                                </td>
                                                <td className="px-2 py-1.5 font-mono text-slate-600 text-[11px] border-b border-slate-100">{item.month}</td>
                                                <td className="px-2 py-1.5 font-medium text-slate-800 border-b border-slate-100">
                                                    <div className="flex items-center gap-1.5">
                                                        <span>{item.workerName}</span>
                                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${item.id.endsWith('__월급제') ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                            {item.id.endsWith('__월급제') ? '월급제' : '일급제'}
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
                                                        <td className={`px-2 py-1.5 border-b border-slate-100 ${item.errors.bankCode ? 'text-red-600 font-bold' : 'text-slate-600'}`}>{item.bankCode || '-'}</td>
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
                                                                                    {item.workEntries.map((entry, idx) => (
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
                                                                                            {(item.insuranceAppliedSummary?.appliedSites ?? []).map((s) => (
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
                                                                                        {(item.withholdingAppliedSummary.appliedSites ?? []).map((s) => (
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
                                                                                        {(item.businessIncomeAppliedSummary.appliedSites ?? []).map((s) => (
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

            {pageViewMode === 'ledger' && (
                <MonthlyAdvanceLedger
                    ref={advanceLedgerRef}
                    rows={ledgerRows}
                    payrollConfig={payrollConfig}
                    advanceItemLabels={payrollConfig?.advanceItemLabels}
                    withholdingThreshold={WITHHOLDING_MAX_MAN_DAY}
                    applyInsurance={insuranceApplied}
                    applyBusinessIncome={businessIncomeApplied}
                    applyDailyFee={dailyFeeApplied}
                    insuranceTeamSiteOnly={insuranceTeamSiteOnly}
                    isInsuranceEligibleEntry={(entry, ledgerRow) => {
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
                    }}
                    clientCompanyNameById={companyNameById}
                    onInputsChange={setLedgerInputs}
                    initialInputs={ledgerInputs}
                    visibleSections={ledgerVisibleSections}
                />
            )}

            {showKBPreview && (
                <KBPreviewOverlay>
                    <KBPreviewDialog>
                        <KBPreviewHeader>
                            <KBPreviewTitleRow>
                                <KBPreviewTitleBlock>
                                    <KBPreviewEyebrow>KB Transfer Preview</KBPreviewEyebrow>
                                    <KBPreviewTitle>국민은행용 엑셀 미리보기</KBPreviewTitle>
                                    <KBPreviewDescription>송금표시, 메모 규칙, 이체금액 기준을 같은 팔레트의 카드형 입력으로 정리했습니다.</KBPreviewDescription>
                                </KBPreviewTitleBlock>
                                <KBPreviewCloseButton onClick={() => setShowKBPreview(false)}>
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
                                        onChange={(e) => setKbReceiverDisplay(e.target.value)}
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
                                        onChange={(e) => setKbMemoSuffix(e.target.value)}
                                        placeholder="{이름} 가불"
                                    />
                                    <KBPreviewFieldHint>{'{이름}'} 치환자를 쓰면 작업자 이름 뒤에 자동으로 붙습니다.</KBPreviewFieldHint>
                                </KBPreviewFieldCard>

                                <KBPreviewFieldCard>
                                    <KBPreviewFieldLabel htmlFor="kb-amount-type">이체금액 적용 기준</KBPreviewFieldLabel>
                                    <KBPreviewSelect
                                        id="kb-amount-type"
                                        value={kbAmountType}
                                        onChange={(e) => setKbAmountType(e.target.value)}
                                    >
                                        <option value="totalAmount">실지급액 (전체)</option>
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
                                    </tr>
                                </thead>
                                <tbody>
                                    {getKBPreviewData().map((row, idx) => (
                                        <tr key={idx} className="hover:bg-slate-800/60">
                                            <td className="border border-slate-700 px-3 py-2">{row.은행코드}</td>
                                            <td className="border border-slate-700 px-3 py-2">{row.계좌번호}</td>
                                            <td className="border border-slate-700 px-3 py-2 text-right font-medium text-amber-300">{row.이체금액.toLocaleString()}</td>
                                            <td className="border border-slate-700 px-3 py-2">{row.받는분통장표시}</td>
                                            <td className="border border-slate-700 px-3 py-2">{row.내통장메모}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </KBPreviewTable>
                        </KBPreviewTableArea>
                        <KBPreviewFooter>
                            <KBPreviewSummary>
                                총 {getKBPreviewData().length}명 · 총 이체금액 {getKBPreviewData().reduce((sum, row) => sum + row.이체금액, 0).toLocaleString()}원
                            </KBPreviewSummary>
                            <ActionCluster>
                                <ActionButton
                                    type="button"
                                    $variant="outline"
                                    onClick={() => setShowKBPreview(false)}
                                >
                                    닫기
                                </ActionButton>
                                <ActionButton
                                    type="button"
                                    $variant="warning"
                                    onClick={() => { handleDownloadKBExcel(); setShowKBPreview(false); }}
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
                    <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4 max-h-[85vh] flex flex-col">
                        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-blue-50">
                            <h3 className="text-lg font-bold text-slate-800">📊 은행코드표</h3>
                            <button
                                onClick={() => setShowBankCodes(false)}
                                className="text-slate-400 hover:text-slate-600 text-2xl"
                            >
                                ×
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto p-4 space-y-4 text-xs">
                            <div>
                                <h4 className="text-sm font-bold text-slate-700 mb-2 bg-blue-100 px-2 py-1 rounded">🏦 은행</h4>
                                <p className="text-slate-500 text-xs mb-2">대표 은행명 또는 별칭을 입력하면 코드가 자동 매핑됩니다.</p>
                            </div>
                            <table className="w-full text-xs border-collapse">
                                <thead className="bg-slate-100 sticky top-0">
                                    <tr>
                                        <th className="border border-slate-300 px-2 py-1 text-left font-bold">코드</th>
                                        <th className="border border-slate-300 px-2 py-1 text-left font-bold">은행명</th>
                                        <th className="border border-slate-300 px-2 py-1 text-left font-bold">별칭</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.entries(BANK_CODES)
                                        .filter(([name]) => name.length <= 6) // 대표명만 대략 노출
                                        .slice(0, 30)
                                        .map(([name, code]) => (
                                            <tr key={`${code}-${name}`}>
                                                <td className="border px-2 py-1 font-mono">{code}</td>
                                                <td className="border px-2 py-1">{name}</td>
                                                <td className="border px-2 py-1 text-slate-500">자동인식</td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
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
                                    <p className="text-xs text-slate-500">{rangeLabel || '-'} · 총 {filteredPaymentData.length}명</p>
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
                                        </button>
                                    ))}
                                    {filteredPaymentData.length === 0 && (
                                        <div className="px-4 py-6 text-sm text-slate-500 text-center">표시할 작업자가 없습니다.</div>
                                    )}
                                </div>
                            </aside>
                            <div className="flex-1 overflow-auto p-6 bg-slate-50">
                                {resolvedPayslipTarget ? (
                                    <PayslipTemplate
                                        ref={printRef}
                                        data={resolvedPayslipTarget}
                                        month={resolvedPayslipTarget.month}
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
                                    </p>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleCopyToClipboard}
                                            disabled={!resolvedPayslipTarget || copying}
                                            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold flex items-center gap-2 disabled:opacity-50"
                                        >
                                            {copying ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faCopy} />}
                                            이미지 복사
                                        </button>
                                        <button
                                            onClick={handleDownloadIndividualPayslip}
                                            disabled={!resolvedPayslipTarget}
                                            className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-bold flex items-center gap-2 disabled:opacity-50"
                                        >
                                            <FontAwesomeIcon icon={faFileExcel} />
                                            개별 명세서 다운로드
                                        </button>
                                        <button
                                            onClick={handleDownloadImage}
                                            disabled={!payslipTarget}
                                            className="px-4 py-2 text-sm bg-slate-700 text-white rounded-lg hover:bg-slate-800 font-bold flex items-center gap-2 disabled:opacity-50"
                                        >
                                            <FontAwesomeIcon icon={faDownload} />
                                            파일 저장
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