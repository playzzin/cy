import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  BarChart3,
  Building2,
  Calculator,
  ChevronDown,
  ChevronRight,
  FileSpreadsheet,
  Gauge,
  Printer,
  RefreshCw,
  ShieldCheck,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  WalletCards
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart as RechartsPieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import * as XLSX from 'xlsx-js-style';
import { companyService } from '../../services/companyService';
import { payrollService, type PayrollData } from '../../services/payrollService';
import { teamService, type Team } from '../../services/teamService';
import { teamSettlementService } from '../../services/teamSettlementService';
import type {
  TeamSettlementAdditionItem,
  TeamSettlementDeductionItem,
  TeamSettlementDocument,
  TeamSettlementPurchaseItem,
  TeamSettlementSalesItem
} from '../../types/teamSettlement';

export type LoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string };

export type TeamSettlementStatRow = {
  teamId: string;
  teamName: string;
  color?: string | null;
  doc: TeamSettlementDocument;
  salesTotal: number;
  purchasesTotal: number;
  deductionsTotal: number;
  additionsTotal: number;
  incomeTotal: number;
  outgoingTotal: number;
  prevCarryover: number;
  deposit: number;
  grossProfit: number;
  net: number;
  directSalesTotal: number;
  supportSalesTotal: number;
  supportPurchaseTotal: number;
  payrollTotal: number;
  expenseTotal: number;
  officeExpenseTotal: number;
  salesManDay: number;
  directManDay: number;
  supportSalesManDay: number;
  supportPurchaseManDay: number;
  teamWorkerManDay: number;
  teamAverageUnitPrice: number | null;
  siteSkkumiUnitPrice: number | null;
  marginRate: number | null;
  operatingNetRate: number | null;
  netRate: number | null;
};

export type BreakdownRow = {
  key: string;
  group: '매출' | '매입' | '공제' | '추가' | '현장';
  label: string;
  amount: number;
  manDay: number;
  count: number;
  average: number | null;
  share: number | null;
  note?: string;
  sortOrder?: number;
};

export type TeamSettlementSiteStatisticRow = {
  key: string;
  siteName: string;
  teamNames: string[];
  salesTotal: number;
  manDay: number;
  average: number | null;
  share: number | null;
};

export type TeamSettlementWorkerStatisticRow = {
  key: string;
  teamId: string;
  teamName: string;
  workerId: string;
  workerName: string;
  role: string;
  manDay: number;
  grossPay: number;
  netPay: number;
  unitPrice: number;
  average: number | null;
};

export type TeamSettlementWarningRow = {
  key: string;
  severity: 'high' | 'medium';
  target: string;
  label: string;
  value: string;
  action: string;
};

export type ExcelSheetRows = {
  name: string;
  rows: Array<Record<string, string | number | null | undefined>>;
};

export const buildDefaultYearMonth = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

export const MONTH_BUTTON_OPTIONS = Array.from({ length: 12 }, (_, index) => index + 1);

export const parseYearMonthValue = (value: string): { year: number; month: number } => {
  const now = new Date();
  const matched = /^(\d{4})-(\d{2})$/.exec(String(value ?? '').trim());
  if (!matched) return { year: now.getFullYear(), month: now.getMonth() + 1 };

  const year = Number(matched[1]);
  const month = Number(matched[2]);
  return {
    year: Number.isFinite(year) ? year : now.getFullYear(),
    month: Number.isFinite(month) && month >= 1 && month <= 12 ? month : now.getMonth() + 1
  };
};

export const buildYearMonthValue = (year: number, month: number): string =>
  `${year}-${String(month).padStart(2, '0')}`;

export const buildShiftedYearMonth = (value: string, monthOffset: number): string => {
  const { year, month } = parseYearMonthValue(value);
  const date = new Date(year, month - 1 + monthOffset, 1);
  return buildYearMonthValue(date.getFullYear(), date.getMonth() + 1);
};

const safeNumber = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const n = Number(value.replace(/,/g, '').trim());
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

const safeAverage = (amount: number, quantity: number): number | null => {
  if (!Number.isFinite(amount) || !Number.isFinite(quantity) || quantity <= 0) return null;
  return amount / quantity;
};

export const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('ko-KR').format(Math.round(Number.isFinite(value) ? value : 0));

export const formatManDay = (value: number): string =>
  (Math.round((Number.isFinite(value) ? value : 0) * 10) / 10).toFixed(1);

export const formatAverageCurrency = (value: number | null): string =>
  value === null ? '-' : `${formatCurrency(value)}원`;

export const formatPercent = (value: number | null): string =>
  value === null ? '-' : `${(value * 100).toFixed(1)}%`;

export const formatCompactCurrency = (value: number): string => {
  const amount = Number.isFinite(value) ? value : 0;
  if (Math.abs(amount) >= 100000000) return `${(amount / 100000000).toFixed(1)}억`;
  if (Math.abs(amount) >= 10000) return `${Math.round(amount / 10000).toLocaleString('ko-KR')}만`;
  return formatCurrency(amount);
};

const formatSignedMetric = (value: number, kind: 'currency' | 'manday' | 'number'): string => {
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  const abs = Math.abs(value);
  if (kind === 'currency') return `${sign}${formatCurrency(abs)}원`;
  if (kind === 'manday') return `${sign}${formatManDay(abs)}공수`;
  return `${sign}${formatCurrency(abs)}`;
};

const formatDeltaText = (
  currentValue: number | null,
  baselineValue: number | null,
  kind: 'currency' | 'manday' | 'number'
): string => {
  if (currentValue === null || baselineValue === null) return '-';
  const current = Number.isFinite(currentValue) ? currentValue : 0;
  const baseline = Number.isFinite(baselineValue) ? baselineValue : 0;
  const diff = current - baseline;
  const rate = baseline === 0 ? null : diff / Math.abs(baseline);
  return `${formatSignedMetric(diff, kind)}${rate === null ? '' : ` (${formatPercent(rate)})`}`;
};

const formatMetricForExport = (value: number | null, kind: 'currency' | 'manday' | 'average' | 'percent' | 'number'): string | number => {
  if (value === null) return '-';
  if (kind === 'currency') return Math.round(value);
  if (kind === 'manday') return Number(formatManDay(value));
  if (kind === 'average') return Math.round(value);
  if (kind === 'percent') return formatPercent(value);
  return value;
};

const sanitizeSheetName = (name: string): string =>
  String(name || 'Sheet').replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Sheet';

const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

export const exportRowsToExcel = (fileName: string, sheets: ExcelSheetRows[]): void => {
  const workbook = XLSX.utils.book_new();
  sheets.forEach((sheet) => {
    const rows = sheet.rows.length > 0 ? sheet.rows : [{ 안내: '조회된 데이터가 없습니다.' }];
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, sanitizeSheetName(sheet.name));
  });
  XLSX.writeFile(workbook, fileName);
};

export const printStatisticsReport = (params: {
  title: string;
  subtitle: string;
  sections: ExcelSheetRows[];
}): void => {
  if (typeof window === 'undefined') return;
  const opened = window.open('', '_blank', 'width=1200,height=900');
  if (!opened) {
    window.alert('팝업이 차단되어 PDF 출력 창을 열 수 없습니다. 브라우저 팝업 허용 후 다시 시도해주세요.');
    return;
  }

  const sectionsHtml = params.sections.map((section) => {
    const rows = section.rows.length > 0 ? section.rows : [{ 안내: '조회된 데이터가 없습니다.' }];
    const headers = Array.from(rows.reduce<Set<string>>((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set<string>()));
    const head = headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('');
    const body = rows.map((row) => (
      `<tr>${headers.map((header) => `<td>${escapeHtml(row[header])}</td>`).join('')}</tr>`
    )).join('');
    return `
      <section>
        <h2>${escapeHtml(section.name)}</h2>
        <table>
          <thead><tr>${head}</tr></thead>
          <tbody>${body}</tbody>
        </table>
      </section>
    `;
  }).join('');

  opened.document.write(`
    <!doctype html>
    <html lang="ko">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(params.title)}</title>
        <style>
          * { box-sizing: border-box; }
          body { margin: 24px; color: #0f172a; font-family: Arial, 'Noto Sans KR', sans-serif; }
          h1 { margin: 0; font-size: 24px; }
          .subtitle { margin: 6px 0 22px; color: #64748b; font-size: 13px; }
          section { break-inside: avoid; margin: 0 0 24px; }
          h2 { margin: 0 0 8px; font-size: 15px; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th, td { border: 1px solid #cbd5e1; padding: 6px 7px; text-align: right; }
          th:first-child, td:first-child { text-align: left; }
          th { background: #f1f5f9; color: #334155; }
          @media print {
            body { margin: 12mm; }
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(params.title)}</h1>
        <div class="subtitle">${escapeHtml(params.subtitle)}</div>
        ${sectionsHtml}
        <script>
          window.onload = () => {
            setTimeout(() => window.print(), 250);
          };
        </script>
      </body>
    </html>
  `);
  opened.document.close();
};

const extractTotalManDayFromMemo = (memo?: string): number => {
  const matches = Array.from(String(memo ?? '').matchAll(/총\s*공수\s*[:：]?\s*([0-9,.]+)/g));
  return matches.reduce((sum, match) => sum + safeNumber(match[1]), 0);
};

const normalizeColor = (value?: string | null): string | null => {
  const text = String(value ?? '').trim();
  if (/^#[0-9a-fA-F]{6}$/.test(text)) return text;
  return null;
};

const formatSalesOrigin = (origin: TeamSettlementSalesItem['origin']): string => {
  if (origin === 'daily_report') return '출력';
  if (origin === 'support_client_site') return '지원정산';
  if (origin === 'tax_invoice') return '계산서';
  if (origin === 'support_outgoing' || origin === 'support_fee_outgoing') return '지원매출';
  if (origin === '내부지원간곳') return '내부간곳';
  if (origin === '외부지원간곳') return '외부간곳';
  return '수기';
};

const getSalesDetailSortOrder = (item: TeamSettlementSalesItem): number => {
  if (item.kind === '도급') return 10;
  if (item.kind === '직영') return 20;
  if (item.origin === 'support_client_site' || item.origin === 'support_outgoing' || item.origin === 'support_fee_outgoing') return 30;
  if (item.origin === '외부지원간곳') return 40;
  if (item.origin === '내부지원간곳') return 50;
  if (item.kind === '지원') return 30;
  return 90;
};

const compareSalesBreakdownRows = (a: BreakdownRow, b: BreakdownRow): number => {
  const orderSort = safeNumber(a.sortOrder) - safeNumber(b.sortOrder);
  if (orderSort !== 0) return orderSort;
  const amountSort = b.amount - a.amount;
  if (amountSort !== 0) return amountSort;
  const noteSort = String(a.note ?? '').localeCompare(String(b.note ?? ''), 'ko');
  if (noteSort !== 0) return noteSort;
  return a.label.localeCompare(b.label, 'ko');
};

const formatPurchaseOrigin = (origin: TeamSettlementPurchaseItem['origin']): string => {
  if (origin === 'daily_report') return '출력';
  if (origin === 'support_fee_incoming') return '지원매입';
  if (origin === '내부지원온곳') return '내부온곳';
  if (origin === '외부지원온곳') return '외부온곳';
  return '수기';
};

const formatDeductionOrigin = (origin: TeamSettlementDeductionItem['origin']): string => {
  if (origin === 'office_expense') return '사무실비';
  if (origin === 'daily_wage_payroll') return '일급제 급여';
  if (origin === 'monthly_wage_payroll') return '월급제 급여';
  if (origin === 'service_team_payroll') return '용역팀 급여';
  if (origin === 'accommodation_billing') return '숙소';
  if (origin === 'vehicle_billing') return '차량';
  if (origin === 'card_billing') return '카드';
  if (origin === 'team_expense_claim') return '경비';
  return '수기';
};

const formatAdditionOrigin = (origin: TeamSettlementAdditionItem['origin']): string =>
  origin === 'team_expense_claim' ? '경비 환급' : '수기';

const isPayrollDeduction = (origin: TeamSettlementDeductionItem['origin']): boolean =>
  origin === 'daily_wage_payroll' ||
  origin === 'monthly_wage_payroll' ||
  origin === 'service_team_payroll';

const isExpenseDeduction = (origin: TeamSettlementDeductionItem['origin']): boolean =>
  origin === 'accommodation_billing' ||
  origin === 'vehicle_billing' ||
  origin === 'card_billing' ||
  origin === 'team_expense_claim';

const isDirectSalesLine = (line: TeamSettlementSalesItem): boolean =>
  line.kind === '도급' || line.kind === '직영';

export const buildTeamStats = (team: Team, doc: TeamSettlementDocument): TeamSettlementStatRow => {
  const salesTotal = (doc.sales ?? []).reduce((sum, item) => sum + safeNumber(item.amount), 0);
  const purchasesTotal = (doc.purchases ?? []).reduce((sum, item) => sum + safeNumber(item.amount), 0);
  const deductionsTotal = (doc.deductions ?? []).reduce((sum, item) => sum + safeNumber(item.amount), 0);
  const additionsTotal = (doc.additions ?? []).reduce((sum, item) => sum + safeNumber(item.amount), 0);
  const incomeTotal = salesTotal + additionsTotal;
  const outgoingTotal = purchasesTotal + deductionsTotal;
  const prevCarryover = safeNumber(doc.summary?.prevCarryover);
  const deposit = safeNumber(doc.summary?.deposit);
  const grossProfit = incomeTotal - outgoingTotal;
  const net = grossProfit + prevCarryover + deposit;

  const directSales = (doc.sales ?? []).filter(isDirectSalesLine);
  const supportSales = (doc.sales ?? []).filter((item) => item.kind === '지원');
  const supportPurchases = doc.purchases ?? [];
  const directSalesTotal = directSales.reduce((sum, item) => sum + safeNumber(item.amount), 0);
  const supportSalesTotal = supportSales.reduce((sum, item) => sum + safeNumber(item.amount), 0);
  const supportPurchaseTotal = supportPurchases.reduce((sum, item) => sum + safeNumber(item.amount), 0);
  const payrollTotal = (doc.deductions ?? [])
    .filter((item) => isPayrollDeduction(item.origin))
    .reduce((sum, item) => sum + safeNumber(item.amount), 0);
  const expenseTotal = (doc.deductions ?? [])
    .filter((item) => isExpenseDeduction(item.origin))
    .reduce((sum, item) => sum + safeNumber(item.amount), 0);
  const officeExpenseTotal = (doc.deductions ?? [])
    .filter((item) => item.origin === 'office_expense')
    .reduce((sum, item) => sum + safeNumber(item.amount), 0);

  const salesManDay = (doc.sales ?? []).reduce((sum, item) => sum + safeNumber(item.manDay), 0);
  const directManDay = directSales.reduce((sum, item) => sum + safeNumber(item.manDay), 0);
  const supportSalesManDay = supportSales.reduce((sum, item) => sum + safeNumber(item.manDay), 0);
  const supportPurchaseManDay = supportPurchases.reduce((sum, item) => sum + safeNumber(item.manDay), 0);
  const teamWorkerManDay = (doc.deductions ?? [])
    .filter((item) => isPayrollDeduction(item.origin))
    .reduce((sum, item) => sum + extractTotalManDayFromMemo(item.memo), 0);

  return {
    teamId: String(team.id ?? doc.teamId ?? ''),
    teamName: team.name || doc.teamName || '팀 미지정',
    color: team.color,
    doc,
    salesTotal,
    purchasesTotal,
    deductionsTotal,
    additionsTotal,
    incomeTotal,
    outgoingTotal,
    prevCarryover,
    deposit,
    grossProfit,
    net,
    directSalesTotal,
    supportSalesTotal,
    supportPurchaseTotal,
    payrollTotal,
    expenseTotal,
    officeExpenseTotal,
    salesManDay,
    directManDay,
    supportSalesManDay,
    supportPurchaseManDay,
    teamWorkerManDay,
    teamAverageUnitPrice: safeAverage(payrollTotal, teamWorkerManDay),
    siteSkkumiUnitPrice: safeAverage(directSalesTotal, directManDay),
    marginRate: safeAverage(grossProfit, incomeTotal),
    operatingNetRate: safeAverage(grossProfit, incomeTotal),
    netRate: safeAverage(net, incomeTotal)
  };
};

const groupByKey = <T,>(
  rows: T[],
  getKey: (row: T) => string,
  build: (row: T, key: string) => BreakdownRow,
  merge: (prev: BreakdownRow, row: T) => BreakdownRow
): BreakdownRow[] => {
  const grouped = new Map<string, BreakdownRow>();
  rows.forEach((row) => {
    const key = getKey(row);
    const prev = grouped.get(key);
    grouped.set(key, prev ? merge(prev, row) : build(row, key));
  });
  return Array.from(grouped.values()).sort((a, b) => b.amount - a.amount);
};

export const buildDetailBreakdown = (stat: TeamSettlementStatRow) => {
  const doc = stat.doc;

  const salesRows = groupByKey(
    doc.sales ?? [],
    (item) => `${item.kind}:${formatSalesOrigin(item.origin)}:${String(item.siteName ?? '').trim()}`,
    (item, key) => ({
      key,
      group: '매출',
      label: `${item.kind} · ${formatSalesOrigin(item.origin)}`,
      amount: safeNumber(item.amount),
      manDay: safeNumber(item.manDay),
      count: 1,
      average: safeAverage(safeNumber(item.amount), safeNumber(item.manDay)),
      share: safeAverage(safeNumber(item.amount), stat.salesTotal),
      note: String(item.siteName ?? '').trim() || '현장 미지정',
      sortOrder: getSalesDetailSortOrder(item)
    }),
    (prev, item) => {
      const amount = prev.amount + safeNumber(item.amount);
      const manDay = prev.manDay + safeNumber(item.manDay);
      return {
        ...prev,
        amount,
        manDay,
        count: prev.count + 1,
        average: safeAverage(amount, manDay),
        share: safeAverage(amount, stat.salesTotal),
        sortOrder: Math.min(safeNumber(prev.sortOrder), getSalesDetailSortOrder(item))
      };
    }
  ).sort(compareSalesBreakdownRows);

  const purchaseRows = groupByKey(
    doc.purchases ?? [],
    (item) => `${item.kind}:${formatPurchaseOrigin(item.origin)}:${String(item.counterTeamName ?? item.siteName ?? '').trim()}`,
    (item, key) => ({
      key,
      group: '매입',
      label: `${item.kind} · ${formatPurchaseOrigin(item.origin)}`,
      amount: safeNumber(item.amount),
      manDay: safeNumber(item.manDay),
      count: 1,
      average: safeAverage(safeNumber(item.amount), safeNumber(item.manDay)),
      share: safeAverage(safeNumber(item.amount), stat.purchasesTotal),
      note: String(item.counterTeamName ?? item.siteName ?? '').trim() || '-'
    }),
    (prev, item) => {
      const amount = prev.amount + safeNumber(item.amount);
      const manDay = prev.manDay + safeNumber(item.manDay);
      return {
        ...prev,
        amount,
        manDay,
        count: prev.count + 1,
        average: safeAverage(amount, manDay),
        share: safeAverage(amount, stat.purchasesTotal)
      };
    }
  );

  const deductionRows = (doc.deductions ?? [])
    .map((item): BreakdownRow => ({
      key: item.id,
      group: '공제',
      label: `${formatDeductionOrigin(item.origin)} · ${item.category}`,
      amount: safeNumber(item.amount),
      manDay: 0,
      count: 1,
      average: null,
      share: safeAverage(safeNumber(item.amount), stat.deductionsTotal),
      note: item.memo
    }))
    .sort((a, b) => b.amount - a.amount);

  const additionRows = (doc.additions ?? [])
    .map((item): BreakdownRow => ({
      key: item.id,
      group: '추가',
      label: `${formatAdditionOrigin(item.origin)} · ${item.category}`,
      amount: safeNumber(item.amount),
      manDay: 0,
      count: 1,
      average: null,
      share: safeAverage(safeNumber(item.amount), stat.additionsTotal),
      note: item.memo
    }))
    .sort((a, b) => b.amount - a.amount);

  const siteRows = groupByKey(
    (doc.sales ?? []).filter(isDirectSalesLine),
    (item) => String(item.siteName ?? '').trim() || '현장 미지정',
    (item, key) => ({
      key,
      group: '현장',
      label: key,
      amount: safeNumber(item.amount),
      manDay: safeNumber(item.manDay),
      count: 1,
      average: safeAverage(safeNumber(item.amount), safeNumber(item.manDay)),
      share: safeAverage(safeNumber(item.amount), stat.directSalesTotal),
      note: item.kind
    }),
    (prev, item) => {
      const amount = prev.amount + safeNumber(item.amount);
      const manDay = prev.manDay + safeNumber(item.manDay);
      return {
        ...prev,
        amount,
        manDay,
        count: prev.count + 1,
        average: safeAverage(amount, manDay),
        share: safeAverage(amount, stat.directSalesTotal)
      };
    }
  );

  return { salesRows, purchaseRows, deductionRows, additionRows, siteRows };
};

export const buildAggregateTotals = (rows: TeamSettlementStatRow[]) => {
  const sum = (pick: (row: TeamSettlementStatRow) => number): number =>
    rows.reduce((acc, row) => acc + pick(row), 0);
  const salesTotal = sum((row) => row.salesTotal);
  const purchasesTotal = sum((row) => row.purchasesTotal);
  const deductionsTotal = sum((row) => row.deductionsTotal);
  const additionsTotal = sum((row) => row.additionsTotal);
  const incomeTotal = salesTotal + additionsTotal;
  const outgoingTotal = purchasesTotal + deductionsTotal;
  const payrollTotal = sum((row) => row.payrollTotal);
  const expenseTotal = sum((row) => row.expenseTotal);
  const net = sum((row) => row.net);
  const prevCarryover = sum((row) => row.prevCarryover);
  const deposit = sum((row) => row.deposit);
  const salesManDay = sum((row) => row.salesManDay);
  const directManDay = sum((row) => row.directManDay);
  const teamWorkerManDay = sum((row) => row.teamWorkerManDay);
  const directSalesTotal = sum((row) => row.directSalesTotal);

  return {
    salesTotal,
    purchasesTotal,
    deductionsTotal,
    additionsTotal,
    incomeTotal,
    outgoingTotal,
    payrollTotal,
    expenseTotal,
    prevCarryover,
    deposit,
    net,
    grossProfit: incomeTotal - outgoingTotal,
    salesManDay,
    directManDay,
    teamWorkerManDay,
    teamAverageUnitPrice: safeAverage(payrollTotal, teamWorkerManDay),
    siteSkkumiUnitPrice: safeAverage(directSalesTotal, directManDay),
    marginRate: safeAverage(incomeTotal - outgoingTotal, incomeTotal),
    operatingNetRate: safeAverage(incomeTotal - outgoingTotal, incomeTotal),
    outgoingRate: safeAverage(outgoingTotal, incomeTotal),
    netRate: safeAverage(net, incomeTotal)
  };
};

export type TeamSettlementAggregateTotals = ReturnType<typeof buildAggregateTotals>;

export const buildSiteStatisticRows = (rows: TeamSettlementStatRow[]): TeamSettlementSiteStatisticRow[] => {
  const totalDirectSales = rows.reduce((sum, row) => sum + row.directSalesTotal, 0);
  const grouped = new Map<string, {
    siteName: string;
    teamNames: Set<string>;
    salesTotal: number;
    manDay: number;
  }>();

  rows.forEach((stat) => {
    (stat.doc.sales ?? []).filter(isDirectSalesLine).forEach((item) => {
      const siteName = String(item.siteName ?? '').trim() || '현장 미지정';
      const prev = grouped.get(siteName) ?? {
        siteName,
        teamNames: new Set<string>(),
        salesTotal: 0,
        manDay: 0
      };
      prev.teamNames.add(stat.teamName);
      prev.salesTotal += safeNumber(item.amount);
      prev.manDay += safeNumber(item.manDay);
      grouped.set(siteName, prev);
    });
  });

  return Array.from(grouped.values())
    .map((row) => ({
      key: row.siteName,
      siteName: row.siteName,
      teamNames: Array.from(row.teamNames).sort((a, b) => a.localeCompare(b, 'ko')),
      salesTotal: row.salesTotal,
      manDay: row.manDay,
      average: safeAverage(row.salesTotal, row.manDay),
      share: safeAverage(row.salesTotal, totalDirectSales)
    }))
    .sort((a, b) => b.salesTotal - a.salesTotal || a.siteName.localeCompare(b.siteName, 'ko'));
};

const toWorkerStatisticRows = (
  stat: TeamSettlementStatRow,
  payrollRows: PayrollData[]
): TeamSettlementWorkerStatisticRow[] => (
  payrollRows.map((worker) => {
    const manDay = safeNumber(worker.gongsu?.total);
    const grossPay = safeNumber(worker.grossPay);
    const workerId = String(worker.workerId ?? worker.id ?? worker.name ?? '').trim();
    return {
      key: `${stat.teamId}:${workerId || worker.name}`,
      teamId: stat.teamId,
      teamName: stat.teamName,
      workerId,
      workerName: worker.name || '인원 미지정',
      role: worker.role || '-',
      manDay,
      grossPay,
      netPay: safeNumber(worker.netPay),
      unitPrice: safeNumber(worker.unitPrice),
      average: safeAverage(grossPay, manDay)
    };
  })
);

export const mergeWorkerStatisticRows = (
  rows: TeamSettlementWorkerStatisticRow[]
): TeamSettlementWorkerStatisticRow[] => {
  const grouped = new Map<string, TeamSettlementWorkerStatisticRow>();
  rows.forEach((row) => {
    const key = `${row.teamId}:${row.workerId || row.workerName}`;
    const prev = grouped.get(key);
    if (!prev) {
      grouped.set(key, { ...row, key });
      return;
    }
    const manDay = prev.manDay + row.manDay;
    const grossPay = prev.grossPay + row.grossPay;
    grouped.set(key, {
      ...prev,
      manDay,
      grossPay,
      netPay: prev.netPay + row.netPay,
      average: safeAverage(grossPay, manDay)
    });
  });
  return Array.from(grouped.values()).sort((a, b) => b.grossPay - a.grossPay || a.workerName.localeCompare(b.workerName, 'ko'));
};

export const loadWorkerStatisticRowsForStats = async (
  yearMonthValue: string,
  rows: TeamSettlementStatRow[]
): Promise<TeamSettlementWorkerStatisticRow[]> => {
  const { year, month } = parseYearMonthValue(yearMonthValue);
  const results = await Promise.all(
    rows.map(async (stat) => {
      try {
        const payrollRows = await payrollService.getPayrollData(year, month, stat.teamId);
        return toWorkerStatisticRows(stat, payrollRows);
      } catch (error) {
        console.error(error);
        return [] as TeamSettlementWorkerStatisticRow[];
      }
    })
  );
  return mergeWorkerStatisticRows(results.flat());
};

export const buildWarningRows = (rows: TeamSettlementStatRow[]): TeamSettlementWarningRow[] => {
  const warnings: TeamSettlementWarningRow[] = [];
  rows.forEach((row) => {
    if (row.net < 0) {
      warnings.push({
        key: `${row.teamId}:net`,
        severity: 'high',
        target: row.teamName,
        label: '정산잔액 적자',
        value: `${formatCurrency(row.net)}원`,
        action: '총지출에 포함된 매입, 공제, 급여, 경비를 우선 확인'
      });
    }
    if (row.netRate !== null && row.netRate < 0.03) {
      warnings.push({
        key: `${row.teamId}:netRate`,
        severity: row.netRate < 0 ? 'high' : 'medium',
        target: row.teamName,
        label: '정산율 낮음',
        value: formatPercent(row.netRate),
        action: '총수입 대비 총지출률과 현장 단가 재검토'
      });
    }
    if (row.teamAverageUnitPrice !== null && row.siteSkkumiUnitPrice !== null && row.teamAverageUnitPrice > row.siteSkkumiUnitPrice) {
      warnings.push({
        key: `${row.teamId}:unitPrice`,
        severity: 'high',
        target: row.teamName,
        label: '인원단가 초과',
        value: `${formatAverageCurrency(row.teamAverageUnitPrice)} > ${formatAverageCurrency(row.siteSkkumiUnitPrice)}`,
        action: '팀평균단가와 현장쓰꾸미 차이 확인'
      });
    }
    if (row.directManDay > 0 && row.teamWorkerManDay > row.directManDay * 1.15) {
      warnings.push({
        key: `${row.teamId}:manday`,
        severity: 'medium',
        target: row.teamName,
        label: '인원공수 과다',
        value: `현장 ${formatManDay(row.directManDay)} / 인원 ${formatManDay(row.teamWorkerManDay)}`,
        action: '해당팀 현장공수와 인원공수 기준 비교'
      });
    }
    if (row.siteSkkumiUnitPrice !== null && row.siteSkkumiUnitPrice > 0 && row.siteSkkumiUnitPrice < 180000) {
      warnings.push({
        key: `${row.teamId}:skkumi`,
        severity: 'medium',
        target: row.teamName,
        label: '현장쓰꾸미 낮음',
        value: formatAverageCurrency(row.siteSkkumiUnitPrice),
        action: '도급/직영 매출 단가 확인'
      });
    }
  });

  return warnings.sort((a, b) => {
    const severityScore = (value: TeamSettlementWarningRow['severity']) => value === 'high' ? 0 : 1;
    return severityScore(a.severity) - severityScore(b.severity) || a.target.localeCompare(b.target, 'ko');
  });
};

export const buildTeamExportRows = (rows: TeamSettlementStatRow[]) => rows.map((row) => ({
  팀: row.teamName,
  총수입: row.incomeTotal,
  총지출: row.outgoingTotal,
  매출: row.salesTotal,
  추가: row.additionsTotal,
  매입: row.purchasesTotal,
  공제: row.deductionsTotal,
  급여: row.payrollTotal,
  경비: row.expenseTotal,
  정산차익: row.grossProfit,
  정산잔액: row.net,
  현장총공수: Number(formatManDay(row.directManDay)),
  인원총공수: Number(formatManDay(row.teamWorkerManDay)),
  팀평균단가: formatMetricForExport(row.teamAverageUnitPrice, 'average'),
  현장쓰꾸미: formatMetricForExport(row.siteSkkumiUnitPrice, 'average'),
  차익률: formatPercent(row.operatingNetRate),
  정산율: formatPercent(row.netRate),
  상태: row.doc.confirmedAt ? '확정' : '미확정'
}));

export const buildSiteExportRows = (rows: TeamSettlementSiteStatisticRow[]) => rows.map((row) => ({
  현장: row.siteName,
  팀: row.teamNames.join(', '),
  매출: row.salesTotal,
  공수: Number(formatManDay(row.manDay)),
  평균단가: formatMetricForExport(row.average, 'average'),
  비중: formatPercent(row.share)
}));

export const buildWorkerExportRows = (rows: TeamSettlementWorkerStatisticRow[]) => rows.map((row) => ({
  팀: row.teamName,
  인원: row.workerName,
  직무: row.role,
  총공수: Number(formatManDay(row.manDay)),
  급여: row.grossPay,
  실지급: row.netPay,
  단가: row.unitPrice,
  평균단가: formatMetricForExport(row.average, 'average')
}));

export const buildWarningExportRows = (rows: TeamSettlementWarningRow[]) => rows.map((row) => ({
  등급: row.severity === 'high' ? '위험' : '주의',
  대상: row.target,
  항목: row.label,
  값: row.value,
  확인사항: row.action
}));

type TeamSettlementInsightTone = 'good' | 'warning' | 'danger';

export type TeamSettlementExecutiveInsight = {
  key: string;
  tone: TeamSettlementInsightTone;
  title: string;
  value: string;
  description: string;
};

const clampNumber = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0));

const sumTop = <T,>(rows: T[], pick: (row: T) => number, limit: number): number =>
  rows.slice(0, limit).reduce((sum, row) => sum + pick(row), 0);

export const buildSettlementHealthScore = (
  totals: TeamSettlementAggregateTotals,
  rows: TeamSettlementStatRow[],
  warnings: TeamSettlementWarningRow[]
): number => {
  const payrollRatio = safeAverage(totals.payrollTotal, totals.incomeTotal) ?? 0;
  const expenseRatio = safeAverage(totals.expenseTotal, totals.incomeTotal) ?? 0;
  const manDayGapRatio = totals.directManDay > 0
    ? Math.max(0, totals.teamWorkerManDay - totals.directManDay) / totals.directManDay
    : 0;
  const lowUnitPriceShare = safeAverage(
    rows.filter((row) => (row.siteSkkumiUnitPrice ?? Infinity) < 180000).reduce((sum, row) => sum + row.salesTotal, 0),
    totals.incomeTotal
  ) ?? 0;
  const highWarnings = warnings.filter((warning) => warning.severity === 'high').length;
  const mediumWarnings = warnings.length - highWarnings;

  let score = 100;
  if ((totals.netRate ?? 0) < 0) score -= 28;
  else if ((totals.netRate ?? 0) < 0.03) score -= 18;
  else if ((totals.netRate ?? 0) < 0.08) score -= 8;

  if (payrollRatio > 0.7) score -= 16;
  else if (payrollRatio > 0.55) score -= 9;

  if (expenseRatio > 0.12) score -= 10;
  else if (expenseRatio > 0.08) score -= 5;

  if (manDayGapRatio > 0.2) score -= 12;
  else if (manDayGapRatio > 0.1) score -= 7;

  if (lowUnitPriceShare > 0.35) score -= 10;
  else if (lowUnitPriceShare > 0.15) score -= 5;

  score -= Math.min(22, highWarnings * 6 + mediumWarnings * 3);
  return Math.round(clampNumber(score, 0, 100));
};

export const buildExecutiveInsights = (
  totals: TeamSettlementAggregateTotals,
  rows: TeamSettlementStatRow[],
  siteRows: TeamSettlementSiteStatisticRow[],
  workerRows: TeamSettlementWorkerStatisticRow[],
  warnings: TeamSettlementWarningRow[]
): TeamSettlementExecutiveInsight[] => {
  const salesSorted = [...rows].sort((a, b) => b.incomeTotal - a.incomeTotal);
  const topSalesShare = safeAverage(sumTop(salesSorted, (row) => row.incomeTotal, 3), totals.incomeTotal);
  const payrollRatio = safeAverage(totals.payrollTotal, totals.incomeTotal);
  const expenseRatio = safeAverage(totals.expenseTotal, totals.incomeTotal);
  const manDayGap = totals.teamWorkerManDay - totals.directManDay;
  const manDayGapRatio = safeAverage(manDayGap, totals.directManDay);
  const topSite = siteRows[0] ?? null;
  const topWorkerPayShare = safeAverage(
    sumTop([...workerRows].sort((a, b) => b.grossPay - a.grossPay), (row) => row.grossPay, 5),
    totals.payrollTotal
  );
  const unitGap = totals.siteSkkumiUnitPrice !== null && totals.teamAverageUnitPrice !== null
    ? totals.siteSkkumiUnitPrice - totals.teamAverageUnitPrice
    : null;
  const hasHighWarning = warnings.some((warning) => warning.severity === 'high');

  const netTone: TeamSettlementInsightTone = (totals.netRate ?? 0) < 0
    ? 'danger'
    : (totals.netRate ?? 0) < 0.05
      ? 'warning'
      : 'good';
  const costTone: TeamSettlementInsightTone = (payrollRatio ?? 0) > 0.65 || (expenseRatio ?? 0) > 0.12
    ? 'danger'
    : (payrollRatio ?? 0) > 0.52 || (expenseRatio ?? 0) > 0.08
      ? 'warning'
      : 'good';
  const manDayTone: TeamSettlementInsightTone = (manDayGapRatio ?? 0) > 0.15
    ? 'danger'
    : (manDayGapRatio ?? 0) > 0.08
      ? 'warning'
      : 'good';
  const concentrationTone: TeamSettlementInsightTone = (topSalesShare ?? 0) > 0.75
    ? 'danger'
    : (topSalesShare ?? 0) > 0.55
      ? 'warning'
      : 'good';

  return [
    {
      key: 'net',
      tone: netTone,
      title: '정산 체력',
      value: formatPercent(totals.netRate),
      description: `최종 잔액 ${formatCurrency(totals.net)}원, 총수입 대비 남는 비율입니다.`
    },
    {
      key: 'cost',
      tone: costTone,
      title: '비용 압박',
      value: `${formatPercent(payrollRatio)} / ${formatPercent(expenseRatio)}`,
      description: `급여와 경비의 매출 대비 비중입니다. 급여 ${formatCurrency(totals.payrollTotal)}원, 경비 ${formatCurrency(totals.expenseTotal)}원입니다.`
    },
    {
      key: 'manday',
      tone: manDayTone,
      title: '공수 균형',
      value: `${formatManDay(manDayGap)}공수`,
      description: `인원총공수에서 현장총공수를 뺀 값입니다. 차이가 클수록 투입 대비 매출 기준을 확인해야 합니다.`
    },
    {
      key: 'concentration',
      tone: concentrationTone,
      title: '수입 집중도',
      value: formatPercent(topSalesShare),
      description: topSite
        ? `TOP3 총수입 비중과 최대 현장 ${topSite.siteName}의 비중 ${formatPercent(topSite.share)}를 함께 봅니다.`
        : 'TOP3 총수입 비중입니다. 특정 팀 또는 월에 수입이 몰렸는지 확인합니다.'
    },
    {
      key: 'unitGap',
      tone: unitGap === null ? 'warning' : unitGap < 0 ? 'danger' : unitGap < 20000 ? 'warning' : 'good',
      title: '단가 여력',
      value: unitGap === null ? '-' : `${unitGap >= 0 ? '+' : '-'}${formatCurrency(Math.abs(unitGap))}원`,
      description: `현장쓰꾸미에서 팀평균단가를 뺀 값입니다. ${topWorkerPayShare === null ? '' : `상위 인원 급여 비중은 ${formatPercent(topWorkerPayShare)}입니다.`}`
    },
    {
      key: 'warning',
      tone: hasHighWarning ? 'danger' : warnings.length > 0 ? 'warning' : 'good',
      title: '확인 우선순위',
      value: hasHighWarning ? '위험 우선' : warnings.length > 0 ? '주의 확인' : '정상',
      description: warnings[0]
        ? `${warnings[0].target}의 ${warnings[0].label} 항목을 먼저 확인하세요.`
        : '현재 자동 진단 기준에서 즉시 확인할 위험 항목이 없습니다.'
    }
  ];
};

export const buildExecutiveSummaryExportRows = (
  totals: TeamSettlementAggregateTotals,
  rows: TeamSettlementStatRow[],
  siteRows: TeamSettlementSiteStatisticRow[],
  workerRows: TeamSettlementWorkerStatisticRow[],
  warnings: TeamSettlementWarningRow[],
  periodLabel: string
) => {
  const score = buildSettlementHealthScore(totals, rows, warnings);
  const insights = buildExecutiveInsights(totals, rows, siteRows, workerRows, warnings);
  const salesSorted = [...rows].sort((a, b) => b.incomeTotal - a.incomeTotal);
  const lossSalesShare = safeAverage(
    rows.filter((row) => row.net < 0).reduce((sum, row) => sum + row.incomeTotal, 0),
    totals.incomeTotal
  );

  return [
    { 구분: '경영요약', 항목: '기간', 값: periodLabel, 참고: '' },
    { 구분: '경영요약', 항목: '헬스스코어', 값: `${score}점`, 참고: score >= 80 ? '양호' : score >= 60 ? '주의' : '위험' },
    { 구분: '핵심지표', 항목: '총수입', 값: Math.round(totals.incomeTotal), 참고: '매출 + 추가' },
    { 구분: '핵심지표', 항목: '총지출', 값: Math.round(totals.outgoingTotal), 참고: '매입 + 공제(급여/경비 포함)' },
    { 구분: '핵심지표', 항목: '정산차익', 값: Math.round(totals.grossProfit), 참고: `차익률 ${formatPercent(totals.operatingNetRate)}` },
    { 구분: '핵심지표', 항목: '정산잔액', 값: Math.round(totals.net), 참고: `정산율 ${formatPercent(totals.netRate)}` },
    { 구분: '핵심지표', 항목: '현장총공수', 값: Number(formatManDay(totals.directManDay)), 참고: '' },
    { 구분: '핵심지표', 항목: '인원총공수', 값: Number(formatManDay(totals.teamWorkerManDay)), 참고: '' },
    { 구분: '집중도', 항목: 'TOP3 총수입 비중', 값: formatPercent(safeAverage(sumTop(salesSorted, (row) => row.incomeTotal, 3), totals.incomeTotal)), 참고: salesSorted.slice(0, 3).map((row) => row.teamName).join(', ') },
    { 구분: '집중도', 항목: '적자 수입 비중', 값: formatPercent(lossSalesShare), 참고: '' },
    ...insights.map((insight) => ({
      구분: '자동진단',
      항목: insight.title,
      값: insight.value,
      참고: insight.description
    }))
  ];
};

export const buildDetailExportRows = (
  rows: TeamSettlementStatRow[],
  getPeriodLabel?: (row: TeamSettlementStatRow) => string
) => rows.flatMap((row) => {
  const detail = buildDetailBreakdown(row);
  const sections: Array<{ title: string; rows: BreakdownRow[] }> = [
    { title: '매출 상세', rows: detail.salesRows },
    { title: '매입 상세', rows: detail.purchaseRows },
    { title: '공제 상세', rows: detail.deductionRows },
    { title: '추가 상세', rows: detail.additionRows },
    { title: '현장별 쓰꾸미', rows: detail.siteRows }
  ];

  return sections.flatMap((section) => section.rows.map((detailRow) => ({
    ...(getPeriodLabel ? { 기간: getPeriodLabel(row) } : {}),
    팀: row.teamName,
    상세구분: section.title,
    항목: detailRow.label,
    대상: detailRow.note || '-',
    공수: detailRow.manDay > 0 ? Number(formatManDay(detailRow.manDay)) : '-',
    평균단가: formatMetricForExport(detailRow.average, 'average'),
    금액: Math.round(detailRow.amount),
    비중: formatPercent(detailRow.share)
  })));
});

const COMPARISON_METRICS: Array<{
  label: string;
  kind: 'currency' | 'manday' | 'number';
  pick: (totals: TeamSettlementAggregateTotals) => number | null;
}> = [
  { label: '총수입', kind: 'currency', pick: (totals) => totals.incomeTotal },
  { label: '총지출', kind: 'currency', pick: (totals) => totals.outgoingTotal },
  { label: '정산차익', kind: 'currency', pick: (totals) => totals.grossProfit },
  { label: '급여', kind: 'currency', pick: (totals) => totals.payrollTotal },
  { label: '경비', kind: 'currency', pick: (totals) => totals.expenseTotal },
  { label: '잔액', kind: 'currency', pick: (totals) => totals.net },
  { label: '현장총공수', kind: 'manday', pick: (totals) => totals.directManDay },
  { label: '인원총공수', kind: 'manday', pick: (totals) => totals.teamWorkerManDay },
  { label: '팀평균단가', kind: 'currency', pick: (totals) => totals.teamAverageUnitPrice }
];

export const TeamSettlementComparisonPanel: React.FC<{
  title: string;
  current: TeamSettlementAggregateTotals;
  previous?: TeamSettlementAggregateTotals | null;
  previousLabel: string;
  lastYear?: TeamSettlementAggregateTotals | null;
  lastYearLabel?: string;
}> = ({ title, current, previous, previousLabel, lastYear, lastYearLabel }) => {
  const groups = [
    { label: previousLabel, totals: previous },
    ...(lastYearLabel ? [{ label: lastYearLabel, totals: lastYear }] : [])
  ];

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div>
          <div className="text-sm font-extrabold text-slate-900">{title}</div>
          <div className="mt-0.5 text-xs text-slate-500">주요 항목의 증감액과 증감률을 함께 표시합니다.</div>
        </div>
      </div>
      <div className={`grid grid-cols-1 divide-y divide-slate-100 ${groups.length > 1 ? 'md:grid-cols-2 md:divide-x md:divide-y-0' : ''}`}>
        {groups.map((group) => (
          <div key={group.label} className="p-4">
            <div className="text-xs font-extrabold text-slate-500">{group.label}</div>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {COMPARISON_METRICS.map((metric) => {
                const value = group.totals ? formatDeltaText(metric.pick(current), metric.pick(group.totals), metric.kind) : '-';
                const isPositive = value.startsWith('+');
                const isNegative = value.startsWith('-');
                return (
                  <div key={`${group.label}-${metric.label}`} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                    <div className="text-[11px] font-bold text-slate-500">{metric.label}</div>
                    <div className={`mt-1 text-sm font-extrabold ${isPositive ? 'text-emerald-700' : isNegative ? 'text-rose-700' : 'text-slate-700'}`}>
                      {value}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const EXECUTIVE_TONE_STYLES: Record<TeamSettlementInsightTone, {
  shell: string;
  icon: string;
  badge: string;
}> = {
  good: {
    shell: 'border-emerald-100 bg-emerald-50',
    icon: 'text-emerald-700',
    badge: 'bg-emerald-100 text-emerald-700'
  },
  warning: {
    shell: 'border-amber-100 bg-amber-50',
    icon: 'text-amber-700',
    badge: 'bg-amber-100 text-amber-700'
  },
  danger: {
    shell: 'border-rose-100 bg-rose-50',
    icon: 'text-rose-700',
    badge: 'bg-rose-100 text-rose-700'
  }
};

export const TeamSettlementExecutiveSummary: React.FC<{
  title: string;
  subtitle: string;
  periodLabel: string;
  totals: TeamSettlementAggregateTotals;
  rows: TeamSettlementStatRow[];
  siteRows: TeamSettlementSiteStatisticRow[];
  workerRows: TeamSettlementWorkerStatisticRow[];
  warnings: TeamSettlementWarningRow[];
}> = ({ title, subtitle, periodLabel, totals, rows, siteRows, workerRows, warnings }) => {
  const score = buildSettlementHealthScore(totals, rows, warnings);
  const insights = buildExecutiveInsights(totals, rows, siteRows, workerRows, warnings);
  const scoreTone: TeamSettlementInsightTone = score >= 80 ? 'good' : score >= 60 ? 'warning' : 'danger';
  const scoreStyle = EXECUTIVE_TONE_STYLES[scoreTone];
  const payrollRatio = safeAverage(totals.payrollTotal, totals.incomeTotal);
  const costRatio = safeAverage(totals.outgoingTotal, totals.incomeTotal);
  const manDayGap = totals.teamWorkerManDay - totals.directManDay;
  const topSalesRow = [...rows].sort((a, b) => b.incomeTotal - a.incomeTotal)[0] ?? null;

  const keyMetrics = [
    { label: '정산율', value: formatPercent(totals.netRate), note: `${formatCurrency(totals.net)}원` },
    { label: '급여부담률', value: formatPercent(payrollRatio), note: `${formatCurrency(totals.payrollTotal)}원` },
    { label: '총지출률', value: formatPercent(costRatio), note: '매입+공제 기준' },
    { label: '공수차이', value: `${formatManDay(manDayGap)}공수`, note: '인원총공수-현장총공수' }
  ];

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-700">
            <ShieldCheck size={20} />
          </div>
          <div>
            <div className="text-sm font-extrabold text-slate-900">{title}</div>
            <div className="mt-0.5 text-xs text-slate-500">{subtitle}</div>
          </div>
        </div>
        <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-extrabold text-slate-600">
          {periodLabel}
        </div>
      </div>

      <div className="grid grid-cols-1 divide-y divide-slate-100 2xl:grid-cols-[320px_1fr] 2xl:divide-x 2xl:divide-y-0">
        <div className="p-4">
          <div className={`rounded-xl border p-4 ${scoreStyle.shell}`}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-extrabold text-slate-500">경영 헬스스코어</div>
                <div className="mt-2 text-4xl font-black tracking-normal text-slate-950">{score}</div>
                <div className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-extrabold ${scoreStyle.badge}`}>
                  {score >= 80 ? '안정' : score >= 60 ? '주의' : '위험'}
                </div>
              </div>
              <div className="relative h-28 w-28 shrink-0">
                <svg className="-rotate-90" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="46" fill="none" stroke="#e2e8f0" strokeWidth="12" />
                  <circle
                    cx="60"
                    cy="60"
                    r="46"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeWidth="12"
                    pathLength={100}
                    strokeDasharray={`${score} 100`}
                    className={scoreStyle.icon}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-xs font-extrabold text-slate-500">
                  SCORE
                </div>
              </div>
            </div>
            <div className="mt-4 text-xs font-semibold leading-5 text-slate-600">
              수익률, 비용률, 공수 균형, 단가 역전, 경고 우선순위를 합산한 운영 점수입니다.
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {keyMetrics.map((metric) => (
              <div key={metric.label} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                <div className="text-[11px] font-bold text-slate-500">{metric.label}</div>
                <div className="mt-1 text-sm font-extrabold text-slate-900">{metric.value}</div>
                <div className="mt-1 truncate text-[11px] font-semibold text-slate-400">{metric.note}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {insights.map((insight) => {
              const style = EXECUTIVE_TONE_STYLES[insight.tone];
              return (
                <div key={insight.key} className={`rounded-xl border p-4 ${style.shell}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-extrabold text-slate-500">{insight.title}</div>
                      <div className="mt-1 truncate text-lg font-black text-slate-950">{insight.value}</div>
                    </div>
                    <Gauge size={20} className={style.icon} />
                  </div>
                  <div className="mt-3 text-xs font-semibold leading-5 text-slate-600">{insight.description}</div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-extrabold text-slate-500">우선 확인 포인트</div>
                <div className="mt-1 text-sm font-extrabold text-slate-900">
                  {warnings[0] ? `${warnings[0].target} · ${warnings[0].label}` : '자동 진단 기준 정상'}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-extrabold text-slate-500">최대 총수입</div>
                <div className="mt-1 text-sm font-extrabold text-slate-900">
                  {topSalesRow ? `${topSalesRow.teamName} ${formatCompactCurrency(topSalesRow.incomeTotal)}` : '-'}
                </div>
              </div>
            </div>
            <div className="mt-3 text-xs font-semibold leading-5 text-slate-500">
              이 영역은 출력 자료의 경영요약 시트에도 같이 반영됩니다.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const TeamSettlementProfitBridge: React.FC<{ totals: TeamSettlementAggregateTotals }> = ({ totals }) => {
  const carryAndDeposit = totals.prevCarryover + totals.deposit;
  const bridgeRows = [
    { key: 'income', label: '총수입', amount: totals.incomeTotal, description: '매출 + 추가' },
    { key: 'outgoing', label: '총지출', amount: -totals.outgoingTotal, description: '매입 + 공제(급여/경비 포함)' },
    { key: 'profit', label: '정산차익', amount: totals.grossProfit, description: '총수입 - 총지출' },
    { key: 'carry', label: '이월/입금', amount: carryAndDeposit, description: '전월이월 및 입금' },
    { key: 'net', label: '정산잔액', amount: totals.net, description: '최종 결과', isFinal: true }
  ].filter((row) => row.isFinal || row.key === 'income' || row.key === 'outgoing' || row.amount !== 0);
  const maxAbs = Math.max(1, ...bridgeRows.map((row) => Math.abs(row.amount)));

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <Target size={18} className="text-blue-700" />
        <div>
          <div className="text-sm font-extrabold text-slate-900">손익 브릿지</div>
          <div className="mt-0.5 text-xs text-slate-500">총수입과 총지출 기준으로 잔액이 만들어지는 흐름을 봅니다.</div>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {bridgeRows.map((row) => {
          const width = `${Math.max(6, Math.abs(row.amount) / maxAbs * 100)}%`;
          const isPositive = row.amount >= 0;
          const valueText = row.isFinal
            ? `${formatCurrency(row.amount)}원`
            : formatSignedMetric(row.amount, 'currency');
          return (
            <div key={row.key}>
              <div className="mb-1 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-extrabold text-slate-700">{row.label}</div>
                  <div className="text-[11px] font-semibold text-slate-400">{row.description}</div>
                </div>
                <div className={`shrink-0 text-sm font-extrabold ${row.isFinal ? row.amount < 0 ? 'text-rose-700' : 'text-emerald-700' : isPositive ? 'text-blue-700' : 'text-slate-700'}`}>
                  {valueText}
                </div>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${row.isFinal ? row.amount < 0 ? 'bg-rose-500' : 'bg-emerald-500' : isPositive ? 'bg-blue-500' : 'bg-slate-400'}`}
                  style={{ width }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const TeamSettlementPortfolioPanel: React.FC<{
  rows: TeamSettlementStatRow[];
  siteRows: TeamSettlementSiteStatisticRow[];
  workerRows: TeamSettlementWorkerStatisticRow[];
  primaryLabel: string;
  getLabel?: (row: TeamSettlementStatRow) => string;
}> = ({ rows, siteRows, workerRows, primaryLabel, getLabel }) => {
  const totals = buildAggregateTotals(rows);
  const labelOf = (row: TeamSettlementStatRow) => getLabel?.(row) ?? row.teamName;
  const salesSorted = [...rows].sort((a, b) => b.incomeTotal - a.incomeTotal);
  const top3Share = safeAverage(sumTop(salesSorted, (row) => row.incomeTotal, 3), totals.incomeTotal);
  const lossSalesShare = safeAverage(
    rows.filter((row) => row.net < 0).reduce((sum, row) => sum + row.incomeTotal, 0),
    totals.incomeTotal
  );
  const topSite = siteRows[0] ?? null;
  const topWorkerShare = safeAverage(
    sumTop([...workerRows].sort((a, b) => b.grossPay - a.grossPay), (row) => row.grossPay, 5),
    totals.payrollTotal
  );
  const unitGap = totals.siteSkkumiUnitPrice !== null && totals.teamAverageUnitPrice !== null
    ? totals.siteSkkumiUnitPrice - totals.teamAverageUnitPrice
    : null;
  const manDayGapRatio = safeAverage(totals.teamWorkerManDay - totals.directManDay, totals.directManDay);
  const topLabel = salesSorted[0] ? labelOf(salesSorted[0]) : '-';

  const portfolioRows = [
    { label: `TOP3 ${primaryLabel} 총수입`, value: formatPercent(top3Share), note: topLabel, tone: (top3Share ?? 0) > 0.7 ? 'danger' : (top3Share ?? 0) > 0.5 ? 'warning' : 'good' },
    { label: '적자 수입 비중', value: formatPercent(lossSalesShare), note: '적자 구간 총수입 기준', tone: (lossSalesShare ?? 0) > 0.25 ? 'danger' : (lossSalesShare ?? 0) > 0 ? 'warning' : 'good' },
    { label: '최대 현장 비중', value: topSite ? formatPercent(topSite.share) : '-', note: topSite?.siteName ?? '현장 데이터 없음', tone: (topSite?.share ?? 0) > 0.45 ? 'warning' : 'good' },
    { label: '상위 인원 급여', value: formatPercent(topWorkerShare), note: '급여 상위 인원 비중', tone: (topWorkerShare ?? 0) > 0.6 ? 'warning' : 'good' },
    { label: '공수 차이율', value: formatPercent(manDayGapRatio), note: `${formatManDay(totals.teamWorkerManDay - totals.directManDay)}공수`, tone: (manDayGapRatio ?? 0) > 0.15 ? 'danger' : (manDayGapRatio ?? 0) > 0.08 ? 'warning' : 'good' },
    { label: '단가 여력', value: unitGap === null ? '-' : `${unitGap >= 0 ? '+' : '-'}${formatCurrency(Math.abs(unitGap))}원`, note: '현장쓰꾸미-팀평균단가', tone: unitGap === null ? 'warning' : unitGap < 0 ? 'danger' : unitGap < 20000 ? 'warning' : 'good' }
  ] as Array<{ label: string; value: string; note: string; tone: TeamSettlementInsightTone }>;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <BarChart3 size={18} className="text-violet-700" />
        <div>
          <div className="text-sm font-extrabold text-slate-900">운영 집중도</div>
          <div className="mt-0.5 text-xs text-slate-500">총수입, 적자, 현장, 인원, 공수, 단가 쏠림을 한 번에 봅니다.</div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {portfolioRows.map((row) => {
          const style = EXECUTIVE_TONE_STYLES[row.tone];
          return (
            <div key={row.label} className={`rounded-lg border px-3 py-3 ${style.shell}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[11px] font-extrabold text-slate-500">{row.label}</div>
                  <div className="mt-1 truncate text-sm font-black text-slate-950">{row.value}</div>
                </div>
                <div className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${row.tone === 'good' ? 'bg-emerald-500' : row.tone === 'warning' ? 'bg-amber-500' : 'bg-rose-500'}`} />
              </div>
              <div className="mt-2 truncate text-[11px] font-semibold text-slate-500">{row.note}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const TeamSettlementScenarioSimulator: React.FC<{ totals: TeamSettlementAggregateTotals }> = ({ totals }) => {
  const [incomeRate, setIncomeRate] = useState(0);
  const [outgoingRate, setOutgoingRate] = useState(0);

  const simulated = useMemo(() => {
    const income = totals.incomeTotal * (1 + incomeRate / 100);
    const outgoing = totals.outgoingTotal * (1 + outgoingRate / 100);
    const net = income - outgoing + totals.prevCarryover + totals.deposit;
    return {
      income,
      outgoing,
      net,
      profit: income - outgoing,
      netRate: safeAverage(net, income),
      delta: net - totals.net
    };
  }, [incomeRate, outgoingRate, totals]);

  const controls = [
    { label: '총수입', value: incomeRate, setValue: setIncomeRate, min: -30, max: 30, accent: 'accent-blue-600' },
    { label: '총지출', value: outgoingRate, setValue: setOutgoingRate, min: -30, max: 30, accent: 'accent-slate-600' }
  ];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <Calculator size={18} className="text-emerald-700" />
        <div>
          <div className="text-sm font-extrabold text-slate-900">손익 시뮬레이션</div>
          <div className="mt-0.5 text-xs text-slate-500">총수입과 총지출 변동률로 예상 잔액을 계산합니다.</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-3">
          <div className="text-[11px] font-bold text-slate-500">예상 정산잔액</div>
          <div className={`mt-1 text-xl font-black ${simulated.net < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
            {formatCurrency(simulated.net)}원
          </div>
        </div>
        <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-3">
          <div className="text-[11px] font-bold text-slate-500">기준 대비</div>
          <div className={`mt-1 text-xl font-black ${simulated.delta < 0 ? 'text-rose-700' : 'text-blue-700'}`}>
            {formatSignedMetric(simulated.delta, 'currency')}
          </div>
        </div>
        <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-3">
          <div className="text-[11px] font-bold text-slate-500">예상 정산율</div>
          <div className="mt-1 text-lg font-black text-slate-900">{formatPercent(simulated.netRate)}</div>
        </div>
        <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-3">
          <div className="text-[11px] font-bold text-slate-500">예상 총지출</div>
          <div className="mt-1 text-lg font-black text-slate-900">{formatCurrency(simulated.outgoing)}원</div>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {controls.map((control) => (
          <label key={control.label} className="block">
            <div className="mb-1 flex items-center justify-between gap-3">
              <span className="text-xs font-extrabold text-slate-600">{control.label}</span>
              <input
                type="number"
                className="h-7 w-20 rounded-md border border-slate-200 px-2 text-right text-xs font-bold text-slate-800 outline-none focus:border-blue-500"
                value={control.value}
                min={control.min}
                max={control.max}
                onChange={(event) => control.setValue(clampNumber(Number(event.target.value), control.min, control.max))}
              />
            </div>
            <input
              type="range"
              className={`w-full ${control.accent}`}
              min={control.min}
              max={control.max}
              value={control.value}
              onChange={(event) => control.setValue(clampNumber(Number(event.target.value), control.min, control.max))}
            />
          </label>
        ))}
      </div>
    </div>
  );
};

export const TeamSettlementWarningPanel: React.FC<{ warnings: TeamSettlementWarningRow[] }> = ({ warnings }) => (
  <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
      <div className="flex items-center gap-2">
        <AlertTriangle size={18} className="text-amber-600" />
        <div>
          <div className="text-sm font-extrabold text-slate-900">정산율 경고</div>
          <div className="mt-0.5 text-xs text-slate-500">총수입 기준 적자, 낮은 정산율, 단가 역전, 공수 과다 항목을 자동 표시합니다.</div>
        </div>
      </div>
    </div>
    <div className="max-h-[320px] overflow-auto">
      {warnings.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm font-semibold text-emerald-700">현재 기준 경고 항목이 없습니다.</div>
      ) : (
        warnings.slice(0, 12).map((warning) => (
          <div key={warning.key} className="border-t border-slate-100 px-4 py-3 first:border-t-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] font-extrabold ${warning.severity === 'high'
                    ? 'border-rose-200 bg-rose-50 text-rose-700'
                    : 'border-amber-200 bg-amber-50 text-amber-700'
                    }`}>
                    {warning.severity === 'high' ? '위험' : '주의'}
                  </span>
                  <span className="truncate text-sm font-extrabold text-slate-900">{warning.target}</span>
                </div>
                <div className="mt-1 text-xs font-bold text-slate-700">{warning.label} · {warning.value}</div>
              </div>
              <div className="text-xs font-semibold text-slate-500">{warning.action}</div>
            </div>
          </div>
        ))
      )}
    </div>
  </div>
);

export const TeamSettlementRankingPanel: React.FC<{
  rows: TeamSettlementStatRow[];
  title: string;
  primaryLabel: string;
  getLabel?: (row: TeamSettlementStatRow) => string;
}> = ({ rows, title, primaryLabel, getLabel }) => {
  const labelOf = (row: TeamSettlementStatRow) => getLabel?.(row) ?? row.teamName;
  const netTop = [...rows].sort((a, b) => b.net - a.net).slice(0, 5);
  const netRisk = [...rows].sort((a, b) => a.net - b.net).slice(0, 5);
  const lowSkkumi = rows
    .filter((row) => row.siteSkkumiUnitPrice !== null)
    .sort((a, b) => (a.siteSkkumiUnitPrice ?? 0) - (b.siteSkkumiUnitPrice ?? 0))
    .slice(0, 5);
  const manDayGap = [...rows]
    .map((row) => ({ row, gap: row.teamWorkerManDay - row.directManDay }))
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 5);

  const sections = [
    {
      title: '정산잔액 상위',
      rows: netTop.map((row, index) => ({ key: `${row.teamId}:top:${index}`, label: labelOf(row), value: `${formatCurrency(row.net)}원` }))
    },
    {
      title: '정산잔액 하위',
      rows: netRisk.map((row, index) => ({ key: `${row.teamId}:risk:${index}`, label: labelOf(row), value: `${formatCurrency(row.net)}원` }))
    },
    {
      title: '현장쓰꾸미 낮은 순',
      rows: lowSkkumi.map((row, index) => ({ key: `${row.teamId}:skkumi:${index}`, label: labelOf(row), value: formatAverageCurrency(row.siteSkkumiUnitPrice) }))
    },
    {
      title: '공수 차이 큰 순',
      rows: manDayGap.map(({ row, gap }, index) => ({ key: `${row.teamId}:gap:${index}`, label: labelOf(row), value: `${formatManDay(gap)}공수` }))
    }
  ];

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-3">
        <div className="text-sm font-extrabold text-slate-900">{title}</div>
        <div className="mt-0.5 text-xs text-slate-500">{primaryLabel}별 수익, 단가, 공수 리스크를 빠르게 비교합니다.</div>
      </div>
      <div className="grid grid-cols-1 divide-y divide-slate-100 md:grid-cols-2 md:divide-x md:divide-y-0 xl:grid-cols-4">
        {sections.map((section) => (
          <div key={section.title} className="p-4">
            <div className="text-xs font-extrabold text-slate-500">{section.title}</div>
            <div className="mt-3 space-y-2">
              {section.rows.length === 0 ? (
                <div className="rounded-lg bg-slate-50 px-3 py-3 text-xs font-semibold text-slate-400">데이터 없음</div>
              ) : (
                section.rows.map((item, index) => (
                  <div key={item.key} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold text-slate-400">{index + 1}</div>
                      <div className="truncate text-xs font-extrabold text-slate-800">{item.label}</div>
                    </div>
                    <div className="shrink-0 text-xs font-extrabold text-slate-900">{item.value}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const TeamSettlementSiteStatisticTable: React.FC<{ rows: TeamSettlementSiteStatisticRow[] }> = ({ rows }) => (
  <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
    <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
      <Building2 size={18} className="text-blue-700" />
      <div>
        <div className="text-sm font-extrabold text-slate-900">현장별 상세 통계</div>
        <div className="mt-0.5 text-xs text-slate-500">도급/직영 매출 기준으로 현장별 공수, 평균단가, 비중을 집계합니다.</div>
      </div>
    </div>
    <div className="overflow-auto">
      <table className="w-full min-w-[820px] text-sm">
        <thead>
          <tr className="bg-slate-50 text-xs font-bold text-slate-600">
            <th className="px-3 py-3 text-left">현장</th>
            <th className="px-3 py-3 text-left">팀</th>
            <th className="px-3 py-3 text-right">매출</th>
            <th className="px-3 py-3 text-right">공수</th>
            <th className="px-3 py-3 text-right">평균단가</th>
            <th className="px-3 py-3 text-right">비중</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="px-3 py-8 text-center text-slate-400" colSpan={6}>현장 통계가 없습니다.</td>
            </tr>
          ) : (
            rows.slice(0, 15).map((row) => (
              <tr key={row.key} className="border-t border-slate-100">
                <td className="px-3 py-3 font-bold text-slate-900">{row.siteName}</td>
                <td className="px-3 py-3 text-xs text-slate-500">{row.teamNames.join(', ')}</td>
                <td className="px-3 py-3 text-right font-bold">{formatCurrency(row.salesTotal)}원</td>
                <td className="px-3 py-3 text-right">{formatManDay(row.manDay)}</td>
                <td className="px-3 py-3 text-right">{formatAverageCurrency(row.average)}</td>
                <td className="px-3 py-3 text-right">{formatPercent(row.share)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  </div>
);

export const TeamSettlementWorkerStatisticTable: React.FC<{ rows: TeamSettlementWorkerStatisticRow[] }> = ({ rows }) => (
  <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
    <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
      <Users size={18} className="text-emerald-700" />
      <div>
        <div className="text-sm font-extrabold text-slate-900">인원별 상세 통계</div>
        <div className="mt-0.5 text-xs text-slate-500">인원별 총공수, 급여, 실지급, 평균단가를 집계합니다.</div>
      </div>
    </div>
    <div className="overflow-auto">
      <table className="w-full min-w-[860px] text-sm">
        <thead>
          <tr className="bg-slate-50 text-xs font-bold text-slate-600">
            <th className="px-3 py-3 text-left">팀</th>
            <th className="px-3 py-3 text-left">인원</th>
            <th className="px-3 py-3 text-left">직무</th>
            <th className="px-3 py-3 text-right">총공수</th>
            <th className="px-3 py-3 text-right">급여</th>
            <th className="px-3 py-3 text-right">실지급</th>
            <th className="px-3 py-3 text-right">평균단가</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="px-3 py-8 text-center text-slate-400" colSpan={7}>인원 통계가 없습니다.</td>
            </tr>
          ) : (
            rows.slice(0, 20).map((row) => (
              <tr key={row.key} className="border-t border-slate-100">
                <td className="px-3 py-3 font-bold text-slate-900">{row.teamName}</td>
                <td className="px-3 py-3 text-slate-800">{row.workerName}</td>
                <td className="px-3 py-3 text-xs text-slate-500">{row.role}</td>
                <td className="px-3 py-3 text-right">{formatManDay(row.manDay)}</td>
                <td className="px-3 py-3 text-right font-bold">{formatCurrency(row.grossPay)}원</td>
                <td className="px-3 py-3 text-right">{formatCurrency(row.netPay)}원</td>
                <td className="px-3 py-3 text-right">{formatAverageCurrency(row.average)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  </div>
);

const CHART_COLORS = ['#2563eb', '#059669', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2'];

const TeamSettlementMonthlyCharts: React.FC<{
  stats: TeamSettlementStatRow[];
  totals: TeamSettlementAggregateTotals;
}> = ({ stats, totals }) => {
  const teamChartRows = stats.slice(0, 10).map((row) => ({
    name: row.teamName,
    총수입: row.incomeTotal,
    총지출: row.outgoingTotal,
    정산잔액: row.net
  }));
  const costRows = [
    { name: '매입', value: totals.purchasesTotal },
    { name: '급여', value: totals.payrollTotal },
    { name: '경비', value: totals.expenseTotal },
    { name: '기타공제', value: Math.max(0, totals.deductionsTotal - totals.payrollTotal - totals.expenseTotal) }
  ].filter((row) => row.value > 0);

  return (
    <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-sm font-extrabold text-slate-900">팀별 총수입/총지출/잔액 차트</div>
        <div className="mt-4 h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={teamChartRows} margin={{ top: 8, right: 12, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-25} textAnchor="end" interval={0} height={54} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => formatCompactCurrency(Number(value))} />
              <Tooltip formatter={(value: any, name: any) => [`${formatCurrency(Number(value))}원`, name]} />
              <Legend />
              <Bar dataKey="총수입" fill="#2563eb" radius={[4, 4, 0, 0]} />
              <Bar dataKey="총지출" fill="#64748b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="정산잔액" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-sm font-extrabold text-slate-900">비용 비중 차트</div>
        <div className="mt-4 h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <RechartsPieChart>
              <Pie data={costRows} dataKey="value" nameKey="name" innerRadius={64} outerRadius={106} paddingAngle={2}>
                {costRows.map((entry, index) => (
                  <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: any, name: any) => [`${formatCurrency(Number(value))}원`, name]} />
              <Legend />
            </RechartsPieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export type TeamSettlementStatisticsView = 'team' | 'management';

export type TeamSettlementStatisticsPageProps = {
  view?: TeamSettlementStatisticsView;
};

export const TeamSettlementStatisticsPage: React.FC<TeamSettlementStatisticsPageProps> = ({ view = 'team' }) => {
  const [searchParams] = useSearchParams();
  const [yearMonth, setYearMonth] = useState<string>(() => {
    const queryYearMonth = searchParams.get('yearMonth') ?? '';
    return /^\d{4}-\d{2}$/.test(queryYearMonth) ? queryYearMonth : buildDefaultYearMonth();
  });
  const [teams, setTeams] = useState<Team[]>([]);
  const [stats, setStats] = useState<TeamSettlementStatRow[]>([]);
  const [workerStats, setWorkerStats] = useState<TeamSettlementWorkerStatisticRow[]>([]);
  const [comparisonTotals, setComparisonTotals] = useState<{
    previousMonth: TeamSettlementAggregateTotals | null;
    lastYearMonth: TeamSettlementAggregateTotals | null;
  }>({ previousMonth: null, lastYearMonth: null });
  const [loadState, setLoadState] = useState<LoadState>({ status: 'idle' });
  const [expandedTeamIds, setExpandedTeamIds] = useState<Set<string>>(() => new Set());

  const selectedYearMonth = useMemo(() => parseYearMonthValue(yearMonth), [yearMonth]);

  useEffect(() => {
    let cancelled = false;

    const loadTeams = async () => {
      try {
        const [teamList, constructionCompanies] = await Promise.all([
          teamService.getTeams(),
          companyService.getCompaniesByType('시공사')
        ]);
        if (cancelled) return;

        const companyIdSet = new Set(constructionCompanies.map((company) => company.id).filter(Boolean));
        const companyNameSet = new Set(constructionCompanies.map((company) => company.name).filter(Boolean));
        const constructionTeams = teamList.filter((team) => {
          if (team.companyId && companyIdSet.has(team.companyId)) return true;
          if (team.companyName && companyNameSet.has(team.companyName)) return true;
          return false;
        });
        const siteTeams = constructionTeams.filter((team) => {
          const type = String(team.type ?? '').trim();
          return type === '시공팀' || type === '시공사팀';
        });
        setTeams(siteTeams.length > 0 ? siteTeams : constructionTeams);
      } catch (error) {
        console.error(error);
        if (!cancelled) setTeams([]);
      }
    };

    void loadTeams();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadStatRows = useCallback(async (targetYearMonth: string): Promise<TeamSettlementStatRow[]> => {
    const rows = await Promise.all(
      teams
        .filter((team) => String(team.id ?? '').trim())
        .map(async (team) => {
          const teamId = String(team.id ?? '').trim();
          const doc = await teamSettlementService.getTeamSettlement({ yearMonth: targetYearMonth, teamId });
          return buildTeamStats(team, doc);
        })
    );
    rows.sort((a, b) => b.incomeTotal - a.incomeTotal || a.teamName.localeCompare(b.teamName, 'ko'));
    return rows;
  }, [teams]);

  const loadStatistics = useCallback(async () => {
    if (teams.length === 0) {
      setStats([]);
      setWorkerStats([]);
      setComparisonTotals({ previousMonth: null, lastYearMonth: null });
      return;
    }

    setLoadState({ status: 'loading' });
    try {
      const previousMonth = buildShiftedYearMonth(yearMonth, -1);
      const lastYearMonth = buildShiftedYearMonth(yearMonth, -12);
      const [rows, previousRows, lastYearRows] = await Promise.all([
        loadStatRows(yearMonth),
        loadStatRows(previousMonth),
        loadStatRows(lastYearMonth)
      ]);
      setStats(rows);
      setComparisonTotals({
        previousMonth: buildAggregateTotals(previousRows),
        lastYearMonth: buildAggregateTotals(lastYearRows)
      });
      setWorkerStats(await loadWorkerStatisticRowsForStats(yearMonth, rows));
      setLoadState({ status: 'idle' });
    } catch (error) {
      console.error(error);
      setStats([]);
      setWorkerStats([]);
      setComparisonTotals({ previousMonth: null, lastYearMonth: null });
      setLoadState({ status: 'error', message: '팀정산 통계를 불러오지 못했습니다.' });
    }
  }, [loadStatRows, teams.length, yearMonth]);

  useEffect(() => {
    void loadStatistics();
  }, [loadStatistics]);

  const totals = useMemo(() => buildAggregateTotals(stats), [stats]);
  const siteStats = useMemo(() => buildSiteStatisticRows(stats), [stats]);
  const warningRows = useMemo(() => buildWarningRows(stats), [stats]);

  const handleYearChange = useCallback((delta: number) => {
    setYearMonth((prev) => {
      const current = parseYearMonthValue(prev);
      return buildYearMonthValue(current.year + delta, current.month);
    });
  }, []);

  const handleMonthSelect = useCallback((month: number) => {
    setYearMonth((prev) => {
      const current = parseYearMonthValue(prev);
      return buildYearMonthValue(current.year, month);
    });
  }, []);

  const toggleExpanded = useCallback((teamId: string) => {
    setExpandedTeamIds((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      return next;
    });
  }, []);

  const buildExportSheets = useCallback((): ExcelSheetRows[] => [
    {
      name: '경영요약',
      rows: buildExecutiveSummaryExportRows(
        totals,
        stats,
        siteStats,
        workerStats,
        warningRows,
        `${selectedYearMonth.year}년 ${selectedYearMonth.month}월`
      )
    },
    { name: '팀별 통계', rows: buildTeamExportRows(stats) },
    { name: '현장별 통계', rows: buildSiteExportRows(siteStats) },
    { name: '인원별 통계', rows: buildWorkerExportRows(workerStats) },
    { name: '상세내역', rows: buildDetailExportRows(stats) },
    { name: '경고 항목', rows: buildWarningExportRows(warningRows) }
  ], [selectedYearMonth.month, selectedYearMonth.year, siteStats, stats, totals, warningRows, workerStats]);

  const handleDownloadExcel = useCallback(() => {
    exportRowsToExcel(`팀정산_월별통계_${yearMonth}.xlsx`, buildExportSheets());
  }, [buildExportSheets, yearMonth]);

  const handlePrintPdf = useCallback(() => {
    printStatisticsReport({
      title: '팀정산 월별 통계',
      subtitle: `${selectedYearMonth.year}년 ${selectedYearMonth.month}월`,
      sections: buildExportSheets()
    });
  }, [buildExportSheets, selectedYearMonth.month, selectedYearMonth.year]);

  const metricCards = [
    { label: '총수입', value: `${formatCurrency(totals.incomeTotal)}원`, note: `매출 ${formatCurrency(totals.salesTotal)} + 추가 ${formatCurrency(totals.additionsTotal)}`, icon: <TrendingUp size={18} /> },
    { label: '총지출', value: `${formatCurrency(totals.outgoingTotal)}원`, note: `매입 ${formatCurrency(totals.purchasesTotal)} + 공제 ${formatCurrency(totals.deductionsTotal)}`, icon: <TrendingDown size={18} /> },
    { label: '정산차익', value: `${formatCurrency(totals.grossProfit)}원`, note: `차익률 ${formatPercent(totals.operatingNetRate)}`, icon: <WalletCards size={18} /> },
    { label: '최종 잔액', value: `${formatCurrency(totals.net)}원`, note: `정산율 ${formatPercent(totals.netRate)}`, icon: <BarChart3 size={18} /> },
    { label: '현장총공수', value: `${formatManDay(totals.directManDay)}공수`, note: '도급/직영 현장 기준', icon: <BarChart3 size={18} /> },
    { label: '인원총공수', value: `${formatManDay(totals.teamWorkerManDay)}공수`, note: '급여 기준 인원공수', icon: <WalletCards size={18} /> },
    { label: '팀평균단가', value: formatAverageCurrency(totals.teamAverageUnitPrice), note: `인원공수 ${formatManDay(totals.teamWorkerManDay)}`, icon: <BarChart3 size={18} /> },
    { label: '현장쓰꾸미', value: formatAverageCurrency(totals.siteSkkumiUnitPrice), note: `도급/직영 공수 ${formatManDay(totals.directManDay)}`, icon: <TrendingUp size={18} /> }
  ];
  const pageTitle = view === 'management' ? '팀정산 월간 경영' : '팀정산 통계';
  const pageDescription = view === 'management'
    ? '월간 경영 요약부터 인원별 상세 통계까지 별도 페이지에서 조회합니다.'
    : '팀별 월별 정산 현황과 상세 내역을 조회합니다.';
  const tabSearch = `?yearMonth=${encodeURIComponent(yearMonth)}`;
  const navigationTabs: Array<{
    key: TeamSettlementStatisticsView;
    label: string;
    description: string;
    to: string;
    icon: React.ReactNode;
  }> = [
    {
      key: 'team',
      label: '팀별 월별 통계',
      description: '팀별 정산표와 상세 내역',
      to: `/payroll/team-settlement-statistics${tabSearch}`,
      icon: <BarChart3 size={16} />
    },
    {
      key: 'management',
      label: '월간 경영',
      description: '요약, 진단, 현장·인원 통계',
      to: `/payroll/team-settlement-statistics/management${tabSearch}`,
      icon: <Gauge size={16} />
    }
  ];

  return (
    <div className="w-full p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">{pageTitle}</h1>
          <p className="mt-1 text-sm text-slate-500">{pageDescription}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
            onClick={handleDownloadExcel}
            disabled={loadState.status === 'loading'}
          >
            <FileSpreadsheet size={16} />
            엑셀 출력
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            onClick={handlePrintPdf}
            disabled={loadState.status === 'loading'}
          >
            <Printer size={16} />
            PDF 출력
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-50"
            onClick={loadStatistics}
            disabled={loadState.status === 'loading'}
          >
            <RefreshCw size={16} />
            새로고침
          </button>
        </div>
      </div>

      <div className="mt-6 border-b border-slate-200">
        <div className="flex gap-2 overflow-x-auto">
          {navigationTabs.map((tab) => {
            const selected = view === tab.key;
            return (
              <NavLink
                key={tab.key}
                to={tab.to}
                end={tab.key === 'team'}
                className={`mb-[-1px] inline-flex min-w-[180px] items-center gap-3 border-b-2 px-4 py-3 text-left transition ${selected
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
                  }`}
              >
                <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${selected
                  ? 'border-blue-100 bg-blue-50'
                  : 'border-slate-200 bg-white'
                  }`}>
                  {tab.icon}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-extrabold">{tab.label}</span>
                  <span className="block truncate text-xs font-semibold opacity-80">{tab.description}</span>
                </span>
              </NavLink>
            );
          })}
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
        <div className="text-sm font-bold text-slate-800">정산월</div>
        <div className="mt-3 flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="inline-flex w-fit items-center rounded-lg border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-bold text-slate-700 hover:bg-white"
              onClick={() => handleYearChange(-1)}
              aria-label={`${selectedYearMonth.year - 1}년`}
            >
              {'<'}
            </button>
            <div className="min-w-[84px] text-center text-sm font-extrabold text-slate-900">{selectedYearMonth.year}년</div>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-bold text-slate-700 hover:bg-white"
              onClick={() => handleYearChange(1)}
              aria-label={`${selectedYearMonth.year + 1}년`}
            >
              {'>'}
            </button>
          </div>
          <div className="grid flex-1 grid-cols-3 gap-1 sm:grid-cols-6 lg:grid-cols-12">
            {MONTH_BUTTON_OPTIONS.map((month) => {
              const selected = selectedYearMonth.month === month;
              return (
                <button
                  key={month}
                  type="button"
                  className={`h-9 rounded-md border text-sm font-bold transition ${selected
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50'
                    }`}
                  onClick={() => handleMonthSelect(month)}
                  aria-pressed={selected}
                >
                  {month}월
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {loadState.status === 'error' && (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
          {loadState.message}
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
        {metricCards.map((card) => (
          <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-slate-500">{card.label}</div>
                <div className="mt-1 text-xl font-extrabold text-slate-900">{card.value}</div>
              </div>
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700">
                {card.icon}
              </div>
            </div>
            <div className="mt-3 text-xs font-semibold text-slate-500">{card.note}</div>
          </div>
        ))}
      </div>

      {view === 'management' ? (
        <>
          <TeamSettlementExecutiveSummary
            title="월간 경영 요약"
            subtitle="팀 전체 정산 데이터를 수익성, 비용, 공수, 단가 기준으로 자동 진단합니다."
            periodLabel={`${selectedYearMonth.year}년 ${selectedYearMonth.month}월`}
            totals={totals}
            rows={stats}
            siteRows={siteStats}
            workerRows={workerStats}
            warnings={warningRows}
          />

          <div className="mt-4 grid grid-cols-1 gap-4 2xl:grid-cols-3">
            <TeamSettlementProfitBridge totals={totals} />
            <TeamSettlementPortfolioPanel
              rows={stats}
              siteRows={siteStats}
              workerRows={workerStats}
              primaryLabel="팀"
            />
            <TeamSettlementScenarioSimulator totals={totals} />
          </div>

          <TeamSettlementComparisonPanel
            title="전월/전년 동월 대비"
            current={totals}
            previous={comparisonTotals.previousMonth}
            previousLabel="전월 대비"
            lastYear={comparisonTotals.lastYearMonth}
            lastYearLabel="전년 동월 대비"
          />

          <TeamSettlementMonthlyCharts stats={stats} totals={totals} />

          <TeamSettlementRankingPanel rows={stats} title="팀별 순위 요약" primaryLabel="팀" />

          <div className="mt-4 grid grid-cols-1 gap-4 2xl:grid-cols-2">
            <TeamSettlementWarningPanel warnings={warningRows} />
            <TeamSettlementSiteStatisticTable rows={siteStats} />
          </div>

          <div className="mt-4">
            <TeamSettlementWorkerStatisticTable rows={workerStats} />
          </div>
        </>
      ) : (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div>
            <div className="text-sm font-extrabold text-slate-900">팀별 월별 통계</div>
            <div className="mt-0.5 text-xs text-slate-500">행의 상세 버튼을 열면 매출, 매입, 공제, 추가, 현장별 쓰꾸미 상세를 확인할 수 있습니다.</div>
          </div>
          <div className="text-xs font-bold text-slate-500">
            {loadState.status === 'loading' ? '불러오는 중' : `${selectedYearMonth.year}년 ${selectedYearMonth.month}월`}
          </div>
        </div>

        <div className="overflow-auto">
          <table className="w-full min-w-[1420px] text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs font-bold text-slate-600">
                <th className="px-3 py-3 text-left">팀</th>
                <th className="px-3 py-3 text-right">총수입</th>
                <th className="px-3 py-3 text-right">총지출</th>
                <th className="px-3 py-3 text-right">급여</th>
                <th className="px-3 py-3 text-right">경비</th>
                <th className="px-3 py-3 text-right">정산차익</th>
                <th className="px-3 py-3 text-right">정산잔액</th>
                <th className="px-3 py-3 text-right">현장총공수</th>
                <th className="px-3 py-3 text-right">인원총공수</th>
                <th className="px-3 py-3 text-right">팀평균단가</th>
                <th className="px-3 py-3 text-right">현장쓰꾸미</th>
                <th className="px-3 py-3 text-center">상태</th>
                <th className="px-3 py-3 text-center">상세</th>
              </tr>
            </thead>
            <tbody>
              {stats.length === 0 && loadState.status !== 'loading' ? (
                <tr>
                  <td className="px-3 py-10 text-center text-slate-400" colSpan={13}>조회된 팀정산 통계가 없습니다.</td>
                </tr>
              ) : (
                stats.map((row) => {
                  const expanded = expandedTeamIds.has(row.teamId);
                  const color = normalizeColor(row.color);
                  const detail = expanded ? buildDetailBreakdown(row) : null;
                  return (
                    <React.Fragment key={row.teamId}>
                      <tr className="border-t border-slate-100 bg-white text-slate-800 hover:bg-slate-50">
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <span className="h-3 w-3 rounded-full border border-slate-200" style={{ backgroundColor: color ?? '#64748b' }} />
                            <span className="font-bold">{row.teamName}</span>
                          </div>
                          <div className="mt-1 text-xs text-slate-500">매출+추가 / 매입+공제 · 정산율 {formatPercent(row.netRate)}</div>
                        </td>
                        <td className="px-3 py-3 text-right font-bold">{formatCurrency(row.incomeTotal)}</td>
                        <td className="px-3 py-3 text-right">{formatCurrency(row.outgoingTotal)}</td>
                        <td className="px-3 py-3 text-right text-blue-700">{formatCurrency(row.payrollTotal)}</td>
                        <td className="px-3 py-3 text-right text-amber-700">{formatCurrency(row.expenseTotal)}</td>
                        <td className={`px-3 py-3 text-right font-bold ${row.grossProfit < 0 ? 'text-rose-700' : 'text-cyan-700'}`}>{formatCurrency(row.grossProfit)}</td>
                        <td className={`px-3 py-3 text-right font-extrabold ${row.net < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{formatCurrency(row.net)}</td>
                        <td className="px-3 py-3 text-right">{formatManDay(row.directManDay)}</td>
                        <td className="px-3 py-3 text-right">{formatManDay(row.teamWorkerManDay)}</td>
                        <td className="px-3 py-3 text-right">{formatAverageCurrency(row.teamAverageUnitPrice)}</td>
                        <td className="px-3 py-3 text-right">{formatAverageCurrency(row.siteSkkumiUnitPrice)}</td>
                        <td className="px-3 py-3 text-center">
                          <span className={`rounded-full border px-2 py-1 text-xs font-bold ${row.doc.confirmedAt
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-amber-200 bg-amber-50 text-amber-700'
                            }`}>
                            {row.doc.confirmedAt ? '확정' : '미확정'}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                            onClick={() => toggleExpanded(row.teamId)}
                          >
                            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            상세
                          </button>
                        </td>
                      </tr>
                      {expanded && detail && (
                        <tr className="border-t border-slate-100 bg-slate-50">
                          <td className="px-4 py-4" colSpan={13}>
                            <TeamSettlementDetailTables
                              detail={detail}
                              totals={{
                                salesTotal: row.salesTotal,
                                purchasesTotal: row.purchasesTotal,
                                deductionsTotal: row.deductionsTotal,
                                additionsTotal: row.additionsTotal,
                                directSalesTotal: row.directSalesTotal
                              }}
                            />
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
    </div>
  );
};

export const TeamSettlementDetailTables: React.FC<{
  detail: ReturnType<typeof buildDetailBreakdown>;
  totals: {
    salesTotal: number;
    purchasesTotal: number;
    deductionsTotal: number;
    additionsTotal: number;
    directSalesTotal: number;
  };
}> = ({ detail }) => {
  const sections: Array<{ title: string; rows: BreakdownRow[]; empty: string }> = [
    { title: '매출 상세', rows: detail.salesRows, empty: '매출 내역 없음' },
    { title: '매입 상세', rows: detail.purchaseRows, empty: '매입 내역 없음' },
    { title: '공제 상세', rows: detail.deductionRows, empty: '공제 내역 없음' },
    { title: '추가 상세', rows: detail.additionRows, empty: '추가 내역 없음' },
    { title: '현장별 쓰꾸미', rows: detail.siteRows, empty: '현장 내역 없음' }
  ];

  return (
    <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
      {sections.map((section) => (
        <div key={section.title} className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-3 py-2 text-sm font-extrabold text-slate-800">{section.title}</div>
          <div className="overflow-auto">
            <table className="w-full min-w-[600px] text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600">
                  <th className="px-2 py-2 text-left">구분</th>
                  <th className="px-2 py-2 text-left">대상</th>
                  <th className="px-2 py-2 text-right">공수</th>
                  <th className="px-2 py-2 text-right">평균단가</th>
                  <th className="px-2 py-2 text-right">금액</th>
                  <th className="px-2 py-2 text-right">비중</th>
                </tr>
              </thead>
              <tbody>
                {section.rows.length === 0 ? (
                  <tr>
                    <td className="px-2 py-6 text-center text-slate-400" colSpan={6}>{section.empty}</td>
                  </tr>
                ) : (
                  section.rows.map((row) => (
                    <tr key={row.key} className="border-t border-slate-100">
                      <td className="px-2 py-2 font-bold text-slate-800">{row.label}</td>
                      <td className="px-2 py-2 text-slate-600">{row.note || '-'}</td>
                      <td className="px-2 py-2 text-right">{row.manDay > 0 ? formatManDay(row.manDay) : '-'}</td>
                      <td className="px-2 py-2 text-right">{formatAverageCurrency(row.average)}</td>
                      <td className="px-2 py-2 text-right font-bold">{formatCurrency(row.amount)}원</td>
                      <td className="px-2 py-2 text-right">{formatPercent(row.share)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
};

export default TeamSettlementStatisticsPage;
