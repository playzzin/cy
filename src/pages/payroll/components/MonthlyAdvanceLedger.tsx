import React, { useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import * as XLSX from 'xlsx-js-style';
import styled from 'styled-components';
import { getDaysInMonth, format, parseISO, getDay } from 'date-fns';
import {
    AdvanceItemLabelsConfig,
    DEFAULT_ADVANCE_ITEM_LABELS
} from '../../../services/payrollConfigService';

export interface MonthlyAdvanceLedgerHandle {
    downloadExcel: (label?: string) => void;
}

type LedgerSide = 'invoice' | 'labor';
type LedgerSideNumberField =
    | 'carry'
    | 'carrySecond'
    | 'currentAdvance'
    | 'currentAdvanceSecond'
    | 'lodging'
    | 'electricity'
    | 'gas'
    | 'water'
    | 'internet'
    | 'management'
    | 'fine'
    | 'other';

interface LedgerSideInput {
    carry: number;
    carrySecond: number;
    currentAdvance: number;
    currentAdvanceSecond: number;
    lodging: number;
    electricity: number;
    gas: number;
    water: number;
    internet: number;
    management: number;
    fine: number;
    other: number;
}

interface LedgerManualInput {
    invoice: LedgerSideInput;
    labor: LedgerSideInput;
    personalMemo: string;
    assignmentType?: 'corporate' | 'labor';
    itemAssignments?: Record<string, 'corporate' | 'labor'>;
}

interface MonthlyAdvanceLedgerWorkEntry {
    date?: string;
    siteId?: string;
    siteName?: string;
    clientCompanyId?: string;
    isLaborSite?: boolean;
    paymentMethod?: string;
    manDay: number;
    unitPrice: number;
    amount?: number;
}

interface MonthlyAdvanceLedgerTaxAmounts {
    pension: number;
    health: number;
    care: number;
    employment: number;
    incomeTax: number;
    residentTax: number;
    businessIncomeTax: number;
    businessResidentTax: number;
    dailyFee?: number;
    isWithholdingTarget: boolean;
}

export interface MonthlyAdvanceLedgerRow {
    rowKey: string;
    month: string;
    teamId: string;
    teamName: string;
    workerId: string;
    workerName: string;
    salaryModel?: string;
    invoiceManDay: number;
    laborManDay: number;
    unitPrice: number;
    invoiceGrossAmount: number;
    laborGrossAmount: number;
    workEntries?: MonthlyAdvanceLedgerWorkEntry[];
    statementTaxAmounts?: MonthlyAdvanceLedgerTaxAmounts;
    assignmentType?: 'corporate' | 'labor';
}

interface ComputedLedgerRow extends MonthlyAdvanceLedgerRow {
    manual: LedgerManualInput;
    invoiceDeductionTotal: number;
    laborDeductionTotal: number;
    utilityTotal: number;
    utilityAppliedToCorporate: number;
    utilityShiftedToPersonal: number;
    invoiceAdvanceTotal: number;
    laborAdvanceTotal: number;
    pension: number;
    health: number;
    care: number;
    employment: number;
    incomeTax: number;
    residentTax: number;
    businessIncomeTax: number;
    businessResidentTax: number;
    dailyFee: number;
    insuranceTotal: number;
    businessTotal: number;
    corporateNet: number;
    personalNet: number;
    isWithholdingTarget: boolean;
    dayManDays: Record<number, number>;
}

interface Props {
    rows: MonthlyAdvanceLedgerRow[];
    payrollConfig: any | null;
    advanceItemLabels?: Partial<AdvanceItemLabelsConfig>;
    withholdingThreshold: number;
    applyInsurance?: boolean;
    applyBusinessIncome?: boolean;
    applyDailyFee?: boolean;
    insuranceTeamSiteOnly?: boolean;
    isInsuranceEligibleEntry?: (entry: MonthlyAdvanceLedgerWorkEntry, row: MonthlyAdvanceLedgerRow) => boolean;
    clientCompanyNameById?: Record<string, string>;
    onInputsChange?: (inputs: Record<string, LedgerManualInput>) => void;
    initialInputs?: Record<string, LedgerManualInput>;
    visibleSections?: {
        utilities?: boolean;
        advances?: boolean;
        taxes?: boolean;
    };
}

const createEmptySideInput = (): LedgerSideInput => ({
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
});

const createEmptyManualInput = (defaultAssignment?: 'corporate' | 'labor'): LedgerManualInput => ({
    invoice: createEmptySideInput(),
    labor: createEmptySideInput(),
    personalMemo: '',
    assignmentType: defaultAssignment ?? 'corporate',
    itemAssignments: {},
});

const resolveAssignmentType = (
    assignmentType: LedgerManualInput['assignmentType'] | undefined,
    fallback: 'corporate' | 'labor' = 'corporate'
): 'corporate' | 'labor' => {
    if (assignmentType === 'labor') return 'labor';
    if (assignmentType === 'corporate') return 'corporate';
    return fallback;
};

const SIDE_NUMBER_FIELDS: LedgerSideNumberField[] = [
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
];

const normalizeManualInput = (
    input: LedgerManualInput | undefined,
    defaultAssignment?: 'corporate' | 'labor'
): LedgerManualInput => ({
    invoice: { ...createEmptySideInput(), ...(input?.invoice ?? {}) },
    labor: { ...createEmptySideInput(), ...(input?.labor ?? {}) },
    personalMemo: input?.personalMemo ?? '',
    assignmentType: input?.assignmentType ?? defaultAssignment ?? 'corporate',
    itemAssignments: input?.itemAssignments ?? {},
});

const isSideInputEmpty = (side: LedgerSideInput | undefined): boolean => {
    const safeSide = { ...createEmptySideInput(), ...(side ?? {}) };
    return SIDE_NUMBER_FIELDS.every((field) => Number(safeSide[field] ?? 0) === 0);
};

const isManualInputEffectivelyEmpty = (
    input: LedgerManualInput | undefined,
    defaultAssignment?: 'corporate' | 'labor'
): boolean => {
    if (!input) return true;
    const memo = String(input.personalMemo ?? '').trim();
    const assignments = input.itemAssignments ?? {};
    const hasAssignment = Object.keys(assignments).some((key) => {
        const value = assignments[key];
        return (value === 'corporate' || value === 'labor') && String(key).trim().length > 0;
    });

    const baselineAssignment = resolveAssignmentType(defaultAssignment, 'corporate');
    const currentAssignment = resolveAssignmentType(input.assignmentType, baselineAssignment);
    const hasCustomAssignment = currentAssignment !== baselineAssignment;

    return (
        isSideInputEmpty(input.invoice)
        && isSideInputEmpty(input.labor)
        && memo.length === 0
        && !hasAssignment
        && !hasCustomAssignment
    );
};

const toSafeAmount = (value: string): number => {
    const normalized = String(value ?? '').replace(/,/g, '').trim();
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) return 0;
    return Math.floor(parsed);
};

const floorWon = (value: number): number => Math.floor(Number.isFinite(value) ? value : 0);
const formatAmount = (value: number): string => {
    if (value === 0) return '-';
    const abs = Math.abs(value);
    const formatted = abs.toLocaleString('ko-KR');
    return value < 0 ? `-${formatted}` : formatted;
};
const formatManDay = (value: number): string => {
    if (value === 0) return '-';
    return value.toLocaleString('ko-KR', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
};

const getSalaryModelLabelClassName = (salaryModel?: string): string => {
    const normalized = (salaryModel ?? '').trim();
    if (normalized === '일급제') return 'bg-sky-100 text-sky-900';
    return 'bg-amber-100 text-amber-900';
};

const LedgerTable = styled.table`
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 13px;
  table-layout: fixed;
  background: white;
`;

const Th = styled.th<{ width?: string; sticky?: boolean; left?: string; borderRight?: boolean }>`
  padding: 10px 4px;
  border-bottom: 2px solid #e2e8f0;
  border-left: 1px solid #e2e8f0;
  ${props => props.borderRight && 'border-right: 2px solid #cbd5e1;'}
  background: #f8fafc;
  color: #475569;
  font-weight: 700;
  text-align: center;
  white-space: nowrap;
  position: ${props => props.sticky ? 'sticky' : 'static'};
  left: ${props => props.left || '0'};
  top: 0;
  z-index: ${props => props.sticky ? '20' : '10'};
  width: ${props => props.width || 'auto'};
  transition: background 0.2s;
  box-shadow: ${props => props.sticky && props.borderRight ? 'inset -2px 0 0 #cbd5e1' : 'none'};
  
  &.sunday { color: #ef4444; background: #fff1f2; }
  &.saturday { color: #3b82f6; background: #eff6ff; }
`;

const Td = styled.td<{ 
    align?: string; 
    sticky?: boolean; 
    left?: string; 
    isNegative?: boolean; 
    borderRight?: boolean;
    isSunday?: boolean;
    isSaturday?: boolean;
}>`
  padding: 8px 4px;
  border-bottom: 1px solid #e2e8f0;
  border-left: 1px solid #e2e8f0;
  ${props => props.borderRight && 'border-right: 2px solid #cbd5e1;'}
  text-align: ${props => props.align || 'center'};
  white-space: nowrap;
  position: ${props => props.sticky ? 'sticky' : 'static'};
  left: ${props => props.left || '0'};
  background: ${props => {
    if (props.sticky) return 'white';
    if (props.isSunday) return '#fff1f2';
    if (props.isSaturday) return '#eff6ff';
    return 'inherit';
  }};
  z-index: ${props => props.sticky ? '5' : 'auto'};
  color: ${props => props.isNegative ? '#ef4444' : 'inherit'};
  font-weight: ${props => props.isNegative ? '700' : 'normal'};
  box-shadow: ${props => props.sticky && props.borderRight ? 'inset -2px 0 0 #cbd5e1' : 'none'};
  
  &.day-cell {
    width: 35px;
    font-size: 11px;
    padding: 8px 2px;
  }
`;

const TotalsRow = styled.tr`
  background: #f1f5f9;
  font-weight: bold;
  
  td {
    border-top: 2px solid #94a3b8;
    color: #0f172a;
    background: #f1f5f9 !important;
  }
`;

export const MonthlyAdvanceLedger = React.forwardRef<MonthlyAdvanceLedgerHandle, Props>((props, ref) => {
    const {
        rows,
        advanceItemLabels,
        onInputsChange,
        initialInputs,
    } = props;

    const [inputsByRowKey, setInputsByRowKey] = useState<Record<string, LedgerManualInput>>(initialInputs || {});
    const touchedRowKeysRef = React.useRef<Set<string>>(new Set());

    useEffect(() => {
        setInputsByRowKey((prev) => {
            const next = { ...prev };
            let changed = false;

            rows.forEach((row) => {
                const prevInput = prev[row.rowKey];
                const initialInput = initialInputs?.[row.rowKey];
                const isTouchedRow = touchedRowKeysRef.current.has(row.rowKey);
                const shouldAdoptInitial = Boolean(initialInput) && !isTouchedRow && isManualInputEffectivelyEmpty(prevInput, row.assignmentType);
                const existing = shouldAdoptInitial ? initialInput : (prevInput ?? initialInput);
                if (!existing) {
                    changed = true;
                    next[row.rowKey] = createEmptyManualInput(row.assignmentType);
                    return;
                }

                const normalized = normalizeManualInput(existing, row.assignmentType);
                const isSame =
                    JSON.stringify(existing.invoice) === JSON.stringify(normalized.invoice)
                    && JSON.stringify(existing.labor) === JSON.stringify(normalized.labor)
                    && (existing.personalMemo ?? '') === normalized.personalMemo
                    && (existing.assignmentType ?? row.assignmentType ?? 'corporate') === normalized.assignmentType
                    && JSON.stringify(existing.itemAssignments ?? {}) === JSON.stringify(normalized.itemAssignments ?? {});

                if (!isSame || shouldAdoptInitial) {
                    changed = true;
                    next[row.rowKey] = normalized;
                    return;
                }
                next[row.rowKey] = existing;
            });

            if (Object.keys(prev).length !== rows.length) changed = true;
            return changed ? next : prev;
        });
    }, [initialInputs, rows]);

    useEffect(() => {
        onInputsChange?.(inputsByRowKey);
    }, [inputsByRowKey, onInputsChange]);

    const updatePersonalMemo = useCallback((rowKey: string, value: string) => {
        touchedRowKeysRef.current.add(rowKey);
        setInputsByRowKey((prev) => ({
            ...prev,
            [rowKey]: { ...(prev[rowKey] ?? createEmptyManualInput()), personalMemo: value }
        }));
    }, []);

    const updateAssignmentType = useCallback((rowKey: string, value: 'corporate' | 'labor') => {
        touchedRowKeysRef.current.add(rowKey);
        setInputsByRowKey((prev) => ({
            ...prev,
            [rowKey]: { ...(prev[rowKey] ?? createEmptyManualInput()), assignmentType: value }
        }));
    }, []);

    const monthInfo = useMemo(() => {
        if (!rows.length) return { monthStr: format(new Date(), 'yyyy-MM'), daysInMonth: 31 };
        const monthStr = rows[0].month;
        const date = parseISO(`${monthStr}-01`);
        return {
            monthStr,
            daysInMonth: getDaysInMonth(date)
        };
    }, [rows]);

    const days = useMemo(() => Array.from({ length: monthInfo.daysInMonth }, (_, i) => i + 1), [monthInfo]);
    const dayLabels = useMemo(() => {
        return days.map(d => {
            const date = parseISO(`${monthInfo.monthStr}-${String(d).padStart(2, '0')}`);
            const dayOfWeek = getDay(date);
            return {
                day: d,
                isSunday: dayOfWeek === 0,
                isSaturday: dayOfWeek === 6
            };
        });
    }, [monthInfo, days]);

    const computedRows = useMemo((): ComputedLedgerRow[] => {
        return rows.map((row) => {
            const manual = inputsByRowKey[row.rowKey] || createEmptyManualInput(row.assignmentType);
            const dayManDays: Record<number, number> = {};
            (row.workEntries || []).forEach(entry => {
                if (entry.date) {
                    const d = parseISO(entry.date).getDate();
                    dayManDays[d] = (dayManDays[d] || 0) + (entry.manDay || 0);
                }
            });

            const invoiceAdvanceTotal = Object.values(manual.invoice).reduce((a, b) => a + b, 0) - manual.invoice.carry - manual.invoice.carrySecond;
            const laborAdvanceTotal = Object.values(manual.labor).reduce((a, b) => a + b, 0) - manual.labor.carry - manual.labor.carrySecond;

            const t = row.statementTaxAmounts;
            const insuranceTotal = (t?.pension ?? 0) + (t?.health ?? 0) + (t?.care ?? 0) + (t?.employment ?? 0);
            const businessTotal = (t?.incomeTax ?? 0) + (t?.residentTax ?? 0) + (t?.businessIncomeTax ?? 0) + (t?.businessResidentTax ?? 0);
            const taxTotal = insuranceTotal + businessTotal + (t?.dailyFee ?? 0);

            const corporateNet = floorWon(row.invoiceGrossAmount - (manual.invoice.carry + manual.invoice.carrySecond + invoiceAdvanceTotal));
            const personalNet = floorWon(row.laborGrossAmount - (manual.labor.carry + manual.labor.carrySecond + laborAdvanceTotal + taxTotal));

            return {
                ...row,
                manual,
                invoiceDeductionTotal: manual.invoice.carry + manual.invoice.carrySecond + invoiceAdvanceTotal,
                laborDeductionTotal: manual.labor.carry + manual.labor.carrySecond + laborAdvanceTotal,
                utilityTotal: 0, 
                utilityAppliedToCorporate: 0,
                utilityShiftedToPersonal: 0,
                invoiceAdvanceTotal,
                laborAdvanceTotal,
                pension: t?.pension ?? 0,
                health: t?.health ?? 0,
                care: t?.care ?? 0,
                employment: t?.employment ?? 0,
                incomeTax: t?.incomeTax ?? 0,
                residentTax: t?.residentTax ?? 0,
                businessIncomeTax: t?.businessIncomeTax ?? 0,
                businessResidentTax: t?.businessResidentTax ?? 0,
                dailyFee: t?.dailyFee ?? 0,
                insuranceTotal,
                businessTotal,
                corporateNet,
                personalNet,
                isWithholdingTarget: t?.isWithholdingTarget ?? false,
                dayManDays
            };
        });
    }, [rows, inputsByRowKey]);

    const totals = useMemo(() => {
        const res = {
            invoiceManDay: 0, laborManDay: 0, invoiceGross: 0, laborGross: 0,
            corporateNet: 0, personalNet: 0, dailyManDays: Array(32).fill(0),
        };
        computedRows.forEach((r) => {
            res.invoiceManDay += r.invoiceManDay; res.laborManDay += r.laborManDay;
            res.invoiceGross += r.invoiceGrossAmount; res.laborGross += r.laborGrossAmount;
            res.corporateNet += r.corporateNet; res.personalNet += r.personalNet;
            days.forEach(d => { res.dailyManDays[d] += (r.dayManDays[d] || 0); });
        });
        return res;
    }, [computedRows, days]);

    const downloadExcel = useCallback((label = '자금정산대장.xlsx') => {
        const wb = XLSX.utils.book_new();
        const sheetData: any[][] = [['No', '이름', '구분', '공제 분류', ...days.map(d => `${d}일`), '공수', '단가', '세전 금액', '법인 받을 금액', '개인 받을 금액', '메모']];
        computedRows.forEach((r, idx) => {
            const rowArr = [idx + 1, r.workerName, r.salaryModel || '-', resolveAssignmentType(r.manual.assignmentType, r.assignmentType) === 'corporate' ? '법인' : '노무'];
            days.forEach(d => rowArr.push(r.dayManDays[d] || 0));
            rowArr.push(r.laborManDay, r.unitPrice, r.laborGrossAmount, r.corporateNet, r.personalNet, r.manual.personalMemo || '');
            sheetData.push(rowArr);
        });
        const totalArr = ['합계', '', '', ''];
        days.forEach(d => totalArr.push(totals.dailyManDays[d]));
        totalArr.push(totals.laborManDay, '', totals.laborGross, totals.corporateNet, totals.personalNet, '');
        sheetData.push(totalArr);
        const ws = XLSX.utils.aoa_to_sheet(sheetData);
        XLSX.utils.book_append_sheet(wb, ws, '대장');
        XLSX.writeFile(wb, label);
    }, [computedRows, totals, days]);

    useImperativeHandle(ref, () => ({ downloadExcel }));

    const tableMinWidth = useMemo(() => 310 + (monthInfo.daysInMonth * 35) + 790, [monthInfo]);

    return (
        <div className="flex flex-col gap-4">
            <div className="overflow-x-auto border border-slate-200 rounded-lg shadow-xl bg-white pb-32">
                <LedgerTable style={{ minWidth: `${tableMinWidth}px` }}>
                    <colgroup>
                        <col width="50" /><col width="100" /><col width="80" /><col width="80" />
                        {days.map(d => <col key={d} width="35" />)}
                        <col width="70" /><col width="120" /><col width="140" /><col width="140" /><col width="140" /><col width="180" />
                    </colgroup>
                    <thead>
                        <tr>
                            <Th sticky left="0" width="50">No</Th>
                            <Th sticky left="50px" width="100">이름</Th>
                            <Th sticky left="150px" width="80" borderRight>구분</Th>
                            <Th width="80">공제 분류</Th>
                            {dayLabels.map(d => (
                                <Th key={d.day} className={`day-cell ${d.isSunday ? 'sunday' : ''} ${d.isSaturday ? 'saturday' : ''}`}>
                                    {d.day}
                                </Th>
                            ))}
                            <Th width="70">공수</Th>
                            <Th width="120">단가</Th>
                            <Th width="140">세전 금액</Th>
                            <Th width="140">법인 받을 금액</Th>
                            <Th width="140">개인 받을 금액</Th>
                            <Th width="180">메모</Th>
                        </tr>
                    </thead>
                    <tbody>
                        {computedRows.map((r, idx) => {
                            const assignment = resolveAssignmentType(r.manual.assignmentType, r.assignmentType);
                            return (
                                <tr key={r.rowKey} className="hover:bg-slate-50 transition-colors">
                                    <Td sticky left="0">{idx + 1}</Td>
                                    <Td sticky left="50px" className="font-medium text-slate-900">{r.workerName}</Td>
                                    <Td sticky left="150px" borderRight>
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${getSalaryModelLabelClassName(r.salaryModel)}`}>
                                            {r.salaryModel || '-'}
                                        </span>
                                    </Td>
                                    <Td>
                                        <button
                                            onClick={() => updateAssignmentType(r.rowKey, assignment === 'corporate' ? 'labor' : 'corporate')}
                                            className={`px-3 py-1 rounded text-[11px] font-bold shadow-sm transition-all ${assignment === 'corporate' ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-rose-600 text-white hover:bg-rose-700'}`}
                                        >
                                            {assignment === 'corporate' ? '법인' : '노무'}
                                        </button>
                                    </Td>
                                    {dayLabels.map(d => (
                                        <Td key={d.day} className="day-cell" isSunday={d.isSunday} isSaturday={d.isSaturday}>
                                            {formatManDay(r.dayManDays[d.day] || 0)}
                                        </Td>
                                    ))}
                                    <Td className="font-bold text-slate-700">{formatManDay(r.laborManDay)}</Td>
                                    <Td align="right" className="font-mono text-slate-600">{formatAmount(r.unitPrice)}</Td>
                                    <Td align="right" className="font-mono font-bold bg-slate-50/50">{formatAmount(r.laborGrossAmount)}</Td>
                                    <Td align="right" className="font-mono" isNegative={r.corporateNet < 0}>
                                        {formatAmount(r.corporateNet)}
                                    </Td>
                                    <Td align="right" className="font-mono" isNegative={r.personalNet < 0}>
                                        {formatAmount(r.personalNet)}
                                    </Td>
                                    <Td className="p-1">
                                        <textarea
                                            value={r.manual.personalMemo}
                                            onChange={(e) => updatePersonalMemo(r.rowKey, e.target.value)}
                                            className="w-full h-8 px-2 py-1 text-[11px] border border-transparent hover:border-slate-300 focus:border-blue-400 focus:bg-white bg-slate-50/30 transition-all rounded outline-none resize-none"
                                            placeholder="..."
                                        />
                                    </Td>
                                </tr>
                            );
                        })}
                        <TotalsRow>
                            <Td sticky left="0" colSpan={3} align="right" className="pr-6 font-bold" borderRight>전체 합계</Td>
                            <Td className="bg-slate-100"></Td>
                            {dayLabels.map(d => (
                                <Td key={d.day} className="day-cell font-bold italic" isSunday={d.isSunday} isSaturday={d.isSaturday}>
                                    {formatManDay(totals.dailyManDays[d.day])}
                                </Td>
                            ))}
                            <Td className="font-bold">{formatManDay(totals.laborManDay)}</Td>
                            <Td></Td>
                            <Td align="right" className="font-mono font-bold">{formatAmount(totals.laborGross)}</Td>
                            <Td align="right" className="font-mono" isNegative={totals.corporateNet < 0}>
                                {formatAmount(totals.corporateNet)}
                            </Td>
                            <Td align="right" className="font-mono" isNegative={totals.personalNet < 0}>
                                {formatAmount(totals.personalNet)}
                            </Td>
                            <Td></Td>
                        </TotalsRow>
                    </tbody>
                </LedgerTable>
            </div>
        </div>
    );
});

export default MonthlyAdvanceLedger;
