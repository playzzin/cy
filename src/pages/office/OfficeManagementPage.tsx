import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  Eye,
  ExternalLink,
  Plus,
  ReceiptText,
  RefreshCw,
  X
} from 'lucide-react';
import Swal from 'sweetalert2';
import { dailyReportService, type DailyReportWorkerRow } from '../../services/dailyReportService';
import { manpowerService, type Worker as ManpowerWorker } from '../../services/manpowerService';
import { officeService, type OfficeTransaction } from '../../services/officeService';
import { officeStaffService, type OfficeStaff } from '../../services/officeStaffService';
import { teamService, type Team } from '../../services/teamService';
import { teamSettlementService } from '../../services/teamSettlementService';
import {
  getSummaryTotal,
  summarizeVehicleBillingCosts,
  useExpenseLedgerData
} from '../support/hooks/useExpenseLedgerData';
import { toast } from '../../utils/swal';
import { OFFICE_ASSIGNMENT_TEAM_ID } from '../../utils/supportAssignmentTargets';
import type { TeamExpenseClaim } from '../../types/teamExpenseLedger';
import type { TeamSettlementDocument } from '../../types/teamSettlement';

const DAILY_WAGE_DEDUCTION_AMOUNT = 15000;
const OFFICE_STAFF_PAYROLL_STORAGE_KEY = 'cy-office-staff-payroll-v1';

const currencyFormatter = new Intl.NumberFormat('ko-KR');

const formatCurrency = (value: number): string => currencyFormatter.format(Math.round(Number.isFinite(value) ? value : 0));

const formatSignedCurrency = (value: number): string => {
  const abs = formatCurrency(Math.abs(value));
  if (value > 0) return `+${abs}`;
  if (value < 0) return `-${abs}`;
  return abs;
};

const toFiniteNumber = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/,/g, '').trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const normalizeText = (value: unknown): string =>
  String(value ?? '')
    .replace(/\s+/g, '')
    .trim()
    .toLowerCase();

const toText = (value: unknown): string => String(value ?? '').trim();

const getCurrentYearMonth = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const MONTH_BUTTON_OPTIONS = Array.from({ length: 12 }, (_, index) => index + 1);

const parseYearMonthValue = (value: string): { year: number; month: number } => {
  const now = new Date();
  const fallback = { year: now.getFullYear(), month: now.getMonth() + 1 };
  const matched = /^(\d{4})-(\d{2})$/.exec(String(value ?? '').trim());
  if (!matched) return fallback;

  const year = Number(matched[1]);
  const month = Number(matched[2]);
  return {
    year: Number.isFinite(year) ? year : fallback.year,
    month: Number.isFinite(month) && month >= 1 && month <= 12 ? month : fallback.month
  };
};

const buildYearMonthValue = (year: number, month: number): string => {
  const now = new Date();
  const safeYear = Number.isFinite(year) ? year : now.getFullYear();
  const safeMonth = Number.isFinite(month) && month >= 1 && month <= 12 ? month : now.getMonth() + 1;
  return `${safeYear}-${String(safeMonth).padStart(2, '0')}`;
};

const getMonthPeriod = (yearMonth: string) => {
  const [yearRaw, monthRaw] = yearMonth.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const safeYear = Number.isFinite(year) ? year : new Date().getFullYear();
  const safeMonth = Number.isFinite(month) ? month : new Date().getMonth() + 1;
  const lastDay = new Date(safeYear, safeMonth, 0).getDate();
  return {
    startDate: `${safeYear}-${String(safeMonth).padStart(2, '0')}-01`,
    endDate: `${safeYear}-${String(safeMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
    lastDay
  };
};

const formatLocalDate = (date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDefaultTransactionDate = (yearMonth: string): string => {
  const today = formatLocalDate();
  if (today.startsWith(`${yearMonth}-`)) return today;
  return getMonthPeriod(yearMonth).endDate;
};

const buildTransactionId = (prefix: string, parts: Array<string | number | undefined>) => {
  const cleaned = parts
    .map((part) => String(part ?? '').trim().replace(/[^a-zA-Z0-9_-]/g, '_'))
    .filter(Boolean)
    .join('_');
  return `${prefix}_${cleaned}_${Date.now()}`;
};

type InsuranceBurdenMode = 'shared' | 'employer';

interface InsuranceSettings {
  pensionEnabled: boolean;
  healthEnabled: boolean;
  careEnabled: boolean;
  employmentEnabled: boolean;
  industrialAccidentEnabled: boolean;
  pensionEmployeeRate: number;
  pensionEmployerRate: number;
  pensionMinBase: number;
  pensionMaxBase: number;
  healthEmployeeRate: number;
  healthEmployerRate: number;
  careEmployeeRateOfHealth: number;
  careEmployerRateOfHealth: number;
  employmentEmployeeRate: number;
  employmentEmployerRate: number;
  industrialAccidentEmployeeRate: number;
  industrialAccidentEmployerRate: number;
}

interface PayrollInputState {
  baseSalary?: number;
  bonus?: number;
  deduction?: number;
  insuranceApplied?: boolean;
  insuranceBurdenMode?: InsuranceBurdenMode;
  memo?: string;
}

interface ManualPayrollRow extends PayrollInputState {
  id: string;
  name: string;
  department?: string;
  role?: string;
}

interface StoredMonthData {
  rowInputs?: Record<string, PayrollInputState>;
  manualRows?: ManualPayrollRow[];
  settings?: Partial<InsuranceSettings> & { careRateOfHealth?: number };
}

type StoredPayrollData = Record<string, StoredMonthData>;

interface PayrollDisplayRow {
  id: string;
  source: 'staff' | 'manual';
  name: string;
  department: string;
  role: string;
  salaryModel: string;
  status: string;
  baseSalary: number;
  bonus: number;
  deduction: number;
  insuranceApplied: boolean;
  insuranceBurdenMode: InsuranceBurdenMode;
}

interface PayrollCalculation {
  grossPay: number;
  totalDeduction: number;
  netPay: number;
  employerInsurance: number;
  companyCost: number;
}

interface OfficePayrollSummary {
  staffCount: number;
  manualCount: number;
  grossPay: number;
  netPay: number;
  employerInsurance: number;
  companyCost: number;
}

interface DailyWageMarginRow {
  teamKey: string;
  teamName: string;
  workerCount: number;
  manDay: number;
  claimAmount: number;
  actualAmount: number;
  margin: number;
}

interface TeamSettlementRow {
  teamId: string;
  teamName: string;
  doc: TeamSettlementDocument | null;
  confirmedAt: string | null;
  salesTotal: number;
  purchasesTotal: number;
  deductionsTotal: number;
  additionsTotal: number;
  officeFee: number;
  net: number;
  payoutDue: number;
  debtDue: number;
  payoutRecorded: number;
  debtCollected: number;
  payoutOutstanding: number;
  debtOutstanding: number;
  loadError?: string;
}

type IncomeDetailKind = 'teamOfficeFee' | 'dailyWageMargin' | 'siteIncome' | 'manualIncome';

interface IncomeDetailRow {
  id: string;
  date?: string;
  title: string;
  description?: string;
  amount: number;
}

interface OfficeLedgerExpenseRow {
  id: string;
  date: string;
  source: string;
  title: string;
  description?: string;
  amount: number;
}

const DEFAULT_INSURANCE_SETTINGS: InsuranceSettings = {
  pensionEnabled: true,
  healthEnabled: true,
  careEnabled: true,
  employmentEnabled: true,
  industrialAccidentEnabled: true,
  pensionEmployeeRate: 4.75,
  pensionEmployerRate: 4.75,
  pensionMinBase: 400000,
  pensionMaxBase: 6370000,
  healthEmployeeRate: 3.595,
  healthEmployerRate: 3.595,
  careEmployeeRateOfHealth: 13.14,
  careEmployerRateOfHealth: 13.14,
  employmentEmployeeRate: 0.9,
  employmentEmployerRate: 1.15,
  industrialAccidentEmployeeRate: 0,
  industrialAccidentEmployerRate: 0.8
};

const emptyPayrollSummary: OfficePayrollSummary = {
  staffCount: 0,
  manualCount: 0,
  grossPay: 0,
  netPay: 0,
  employerInsurance: 0,
  companyCost: 0
};

const normalizeStoredSettings = (settings?: StoredMonthData['settings']): InsuranceSettings => {
  const legacyCareRate = settings?.careRateOfHealth;
  return {
    ...DEFAULT_INSURANCE_SETTINGS,
    ...(settings || {}),
    careEmployeeRateOfHealth: settings?.careEmployeeRateOfHealth ?? legacyCareRate ?? DEFAULT_INSURANCE_SETTINGS.careEmployeeRateOfHealth,
    careEmployerRateOfHealth: settings?.careEmployerRateOfHealth ?? legacyCareRate ?? DEFAULT_INSURANCE_SETTINGS.careEmployerRateOfHealth,
    industrialAccidentEmployeeRate: settings?.industrialAccidentEmployeeRate ?? DEFAULT_INSURANCE_SETTINGS.industrialAccidentEmployeeRate
  };
};

const readStoredPayrollData = (): StoredPayrollData => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(OFFICE_STAFF_PAYROLL_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const roundWon = (value: number): number => Math.round(Number.isFinite(value) ? value : 0);

const normalizeRate = (rate: number): number => Math.max(0, toFiniteNumber(rate)) / 100;

const clampPensionBase = (grossPay: number, settings: InsuranceSettings): number => {
  if (grossPay <= 0) return 0;
  const minBase = Math.max(0, settings.pensionMinBase);
  const maxBase = Math.max(minBase, settings.pensionMaxBase);
  return Math.min(Math.max(grossPay, minBase), maxBase);
};

const calculatePayroll = (
  row: Pick<PayrollDisplayRow, 'baseSalary' | 'bonus' | 'deduction' | 'insuranceApplied' | 'insuranceBurdenMode'>,
  settings: InsuranceSettings
): PayrollCalculation => {
  const grossPay = Math.max(0, toFiniteNumber(row.baseSalary) + toFiniteNumber(row.bonus));
  const pensionBase = clampPensionBase(grossPay, settings);
  const insuranceApplied = row.insuranceApplied !== false;
  const companyPaysAll = insuranceApplied && row.insuranceBurdenMode === 'employer';

  const employeePensionShare = insuranceApplied && settings.pensionEnabled ? roundWon(pensionBase * normalizeRate(settings.pensionEmployeeRate)) : 0;
  const employerPensionShare = insuranceApplied && settings.pensionEnabled ? roundWon(pensionBase * normalizeRate(settings.pensionEmployerRate)) : 0;
  const employeeHealthShare = insuranceApplied && settings.healthEnabled ? roundWon(grossPay * normalizeRate(settings.healthEmployeeRate)) : 0;
  const employerHealthShare = insuranceApplied && settings.healthEnabled ? roundWon(grossPay * normalizeRate(settings.healthEmployerRate)) : 0;
  const employeeCareShare =
    insuranceApplied && settings.healthEnabled && settings.careEnabled
      ? roundWon(employeeHealthShare * normalizeRate(settings.careEmployeeRateOfHealth))
      : 0;
  const employerCareShare =
    insuranceApplied && settings.healthEnabled && settings.careEnabled
      ? roundWon(employerHealthShare * normalizeRate(settings.careEmployerRateOfHealth))
      : 0;
  const employeeEmploymentShare = insuranceApplied && settings.employmentEnabled ? roundWon(grossPay * normalizeRate(settings.employmentEmployeeRate)) : 0;
  const employerEmploymentShare = insuranceApplied && settings.employmentEnabled ? roundWon(grossPay * normalizeRate(settings.employmentEmployerRate)) : 0;
  const employeeIndustrialAccidentShare =
    insuranceApplied && settings.industrialAccidentEnabled ? roundWon(grossPay * normalizeRate(settings.industrialAccidentEmployeeRate)) : 0;
  const employerIndustrialAccidentShare =
    insuranceApplied && settings.industrialAccidentEnabled ? roundWon(grossPay * normalizeRate(settings.industrialAccidentEmployerRate)) : 0;

  const employeeInsurance = companyPaysAll
    ? 0
    : employeePensionShare + employeeHealthShare + employeeCareShare + employeeEmploymentShare + employeeIndustrialAccidentShare;
  const employerInsurance =
    employerPensionShare +
    employerHealthShare +
    employerCareShare +
    employerEmploymentShare +
    employerIndustrialAccidentShare +
    (companyPaysAll
      ? employeePensionShare + employeeHealthShare + employeeCareShare + employeeEmploymentShare + employeeIndustrialAccidentShare
      : 0);
  const totalDeduction = employeeInsurance + Math.max(0, toFiniteNumber(row.deduction));
  const netPay = grossPay - totalDeduction;

  return {
    grossPay,
    totalDeduction,
    netPay,
    employerInsurance,
    companyCost: grossPay + employerInsurance
  };
};

const getStaffRowId = (staff: OfficeStaff, index: number): string => {
  const key = staff.id || staff.legacyId || `${staff.name}-${index}`;
  return `staff:${key}`;
};

const isActiveOfficeStaff = (staff: OfficeStaff): boolean => {
  const status = toText(staff.status);
  if (staff.isActive === false) return false;
  return !status.includes('퇴사') && !status.toLowerCase().includes('inactive');
};

const isInsuranceExcludedStaff = (staff: OfficeStaff): boolean => {
  const searchable = [
    staff.employmentType,
    staff.salaryModel,
    staff.payType,
    staff.role,
    staff.department,
    staff.memo
  ]
    .map(toText)
    .join(' ')
    .toLowerCase();

  return /프리|프리랜서|freelance|contractor|용역/.test(searchable);
};

const buildStaffDisplayRow = (
  staff: OfficeStaff,
  index: number,
  input: PayrollInputState | undefined
): PayrollDisplayRow => ({
  id: getStaffRowId(staff, index),
  source: 'staff',
  name: toText(staff.name) || '이름 없음',
  department: toText(staff.department) || '사무실',
  role: toText(staff.role) || '-',
  salaryModel: toText(staff.salaryModel || staff.payType) || '월급제',
  status: toText(staff.status) || '재직',
  baseSalary: input?.baseSalary ?? toFiniteNumber(staff.unitPrice),
  bonus: input?.bonus ?? 0,
  deduction: input?.deduction ?? 0,
  insuranceApplied: input?.insuranceApplied ?? !isInsuranceExcludedStaff(staff),
  insuranceBurdenMode: input?.insuranceBurdenMode ?? 'shared'
});

const buildManualDisplayRow = (row: ManualPayrollRow): PayrollDisplayRow => ({
  id: row.id,
  source: 'manual',
  name: row.name || '임시 직원',
  department: row.department || '사무실',
  role: row.role || '-',
  salaryModel: '직접입력',
  status: '수동',
  baseSalary: row.baseSalary ?? 0,
  bonus: row.bonus ?? 0,
  deduction: row.deduction ?? 0,
  insuranceApplied: row.insuranceApplied ?? false,
  insuranceBurdenMode: row.insuranceBurdenMode ?? 'shared'
});

const calculateOfficePayrollSummary = (staffRows: OfficeStaff[], yearMonth: string): OfficePayrollSummary => {
  const monthData = readStoredPayrollData()[yearMonth] || {};
  const settings = normalizeStoredSettings(monthData.settings);
  const staffDisplayRows = staffRows
    .filter(isActiveOfficeStaff)
    .map((staff, index) => buildStaffDisplayRow(staff, index, monthData.rowInputs?.[getStaffRowId(staff, index)]));
  const manualRows = (monthData.manualRows || []).map(buildManualDisplayRow);
  const rows = staffDisplayRows.concat(manualRows);

  return rows.reduce(
    (sum, row) => {
      const calculation = calculatePayroll(row, settings);
      return {
        staffCount: sum.staffCount + (row.source === 'staff' ? 1 : 0),
        manualCount: sum.manualCount + (row.source === 'manual' ? 1 : 0),
        grossPay: sum.grossPay + calculation.grossPay,
        netPay: sum.netPay + calculation.netPay,
        employerInsurance: sum.employerInsurance + calculation.employerInsurance,
        companyCost: sum.companyCost + calculation.companyCost
      };
    },
    { ...emptyPayrollSummary }
  );
};

const getWorkerStableId = (worker?: Partial<ManpowerWorker> | null): string => {
  if (!worker) return '';
  return String(worker.id ?? '').trim() || String(worker.legacyId ?? '').trim() || normalizeText(worker.name);
};

const buildWorkerLookup = (workers: ManpowerWorker[]): Map<string, ManpowerWorker> => {
  const map = new Map<string, ManpowerWorker>();
  workers.forEach((worker) => {
    [worker.id, worker.legacyId, worker.name].forEach((key) => {
      const text = String(key ?? '').trim();
      if (text) map.set(text, worker);
    });
    const normalizedName = normalizeText(worker.name);
    if (normalizedName) map.set(normalizedName, worker);
  });
  return map;
};

const isDailyWageLabel = (value: unknown): boolean => {
  const normalized = normalizeText(value);
  return normalized.includes('일급') || normalized.includes('일당') || normalized.includes('daily');
};

const isServiceTeamLabel = (value: unknown): boolean => {
  const normalized = normalizeText(value);
  return normalized.includes('용역') || normalized.includes('인력') || normalized.includes('소개') || normalized.includes('agency');
};

const getRowSalaryType = (row: DailyReportWorkerRow, worker?: ManpowerWorker | null): string => {
  const values = [row.salaryModel, row.payType, worker?.salaryModel, worker?.payType];
  const matched = values.map(toText).find((value) => isDailyWageLabel(value) || isServiceTeamLabel(value));
  return matched || toText(values.find(Boolean)) || '';
};

const calculateDailyWageMargins = (rows: DailyReportWorkerRow[], workers: ManpowerWorker[]): DailyWageMarginRow[] => {
  const workerLookup = buildWorkerLookup(workers);
  const grouped = new Map<string, DailyWageMarginRow & { workerIds: Set<string> }>();

  rows.forEach((row) => {
    const worker =
      workerLookup.get(String(row.workerId ?? '').trim()) ||
      workerLookup.get(normalizeText(row.workerName || row.name)) ||
      null;
    const salaryType = getRowSalaryType(row, worker);
    if (!isDailyWageLabel(salaryType) || isServiceTeamLabel(salaryType)) return;

    const manDay = toFiniteNumber(row.manDay);
    if (manDay <= 0) return;

    const claimUnitPrice = toFiniteNumber(row.unitPrice || worker?.unitPrice || 0);
    const actualUnitPrice = Math.max(0, claimUnitPrice - DAILY_WAGE_DEDUCTION_AMOUNT);
    const claimAmount = manDay * claimUnitPrice;
    const actualAmount = manDay * actualUnitPrice;
    const margin = Math.max(0, claimAmount - actualAmount);
    if (claimAmount <= 0 && margin <= 0) return;

    const teamName = toText(row.workerTeamName || worker?.teamName || row.teamName) || '미분류';
    const teamKey = toText(row.workerTeamId || worker?.teamId || row.teamId) || `unresolved:${normalizeText(teamName)}`;
    const workerId = toText(row.workerId || getWorkerStableId(worker) || row.workerName || row.name);
    const existing = grouped.get(teamKey) ?? {
      teamKey,
      teamName,
      workerCount: 0,
      manDay: 0,
      claimAmount: 0,
      actualAmount: 0,
      margin: 0,
      workerIds: new Set<string>()
    };

    existing.manDay += manDay;
    existing.claimAmount += claimAmount;
    existing.actualAmount += actualAmount;
    existing.margin += margin;
    if (workerId) existing.workerIds.add(workerId);
    existing.workerCount = existing.workerIds.size;
    grouped.set(teamKey, existing);
  });

  return Array.from(grouped.values())
    .map(({ workerIds, ...row }) => row)
    .sort((left, right) => right.margin - left.margin);
};

const getTeamId = (team: Team): string => String(team.id ?? team.legacyId ?? team.name ?? '').trim();

const getTeamCandidates = (team: Team): string[] =>
  [team.id, (team as any).legacyId, team.name].map((value) => String(value ?? '').trim()).filter(Boolean);

const transactionMatchesTeam = (transaction: OfficeTransaction, team: Team): boolean => {
  const relatedTeamId = String(transaction.relatedTeamId ?? '').trim();
  if (!relatedTeamId) return false;
  return getTeamCandidates(team).includes(relatedTeamId);
};

const sumTransactions = (rows: OfficeTransaction[], predicate: (row: OfficeTransaction) => boolean): number =>
  rows.filter(predicate).reduce((sum, row) => sum + toFiniteNumber(row.amount), 0);

const isSiteSeparateIncomeTransaction = (row: OfficeTransaction): boolean =>
  row.type === 'income' && row.category === 'SITE_PAYBACK';

const getSiteIncomeTitle = (row: OfficeTransaction): string => {
  const description = toText(row.description);
  const withoutMonth = description.replace(/^\d{4}-\d{2}\s+/, '').trim();
  const [sitePart] = withoutMonth.split(' 차액 배분');
  return sitePart || description || '현장별 별도 수입';
};

const buildTeamSettlementRows = (
  teams: Team[],
  docs: Array<TeamSettlementDocument | null>,
  transactions: OfficeTransaction[],
  yearMonth: string,
  errors: Record<string, string>
): TeamSettlementRow[] =>
  teams.map((team, index) => {
    const teamId = getTeamId(team);
    const teamName = toText(team.name) || teamId || '팀 미지정';
    const doc = docs[index];
    const salesTotal = (doc?.sales ?? []).reduce((sum, item) => sum + toFiniteNumber(item.amount), 0);
    const purchasesTotal = (doc?.purchases ?? []).reduce((sum, item) => sum + toFiniteNumber(item.amount), 0);
    const deductionsTotal = (doc?.deductions ?? []).reduce((sum, item) => sum + toFiniteNumber(item.amount), 0);
    const additionsTotal = (doc?.additions ?? []).reduce((sum, item) => sum + toFiniteNumber(item.amount), 0);
    const prevCarryover = toFiniteNumber(doc?.summary?.prevCarryover);
    const deposit = toFiniteNumber(doc?.summary?.deposit);
    const net = salesTotal - purchasesTotal - deductionsTotal + additionsTotal + prevCarryover + deposit;
    const officeFee = (doc?.deductions ?? [])
      .filter((item) => item.origin === 'office_expense')
      .reduce((sum, item) => sum + toFiniteNumber(item.amount), 0);

    const payoutRecorded = sumTransactions(
      transactions,
      (row) =>
        row.category === 'TEAM_SETTLEMENT_PAYOUT' &&
        row.relatedYearMonth === yearMonth &&
        transactionMatchesTeam(row, team)
    );
    const debtCollected = sumTransactions(
      transactions,
      (row) =>
        row.category === 'TEAM_DEBT_COLLECTION' &&
        row.relatedYearMonth === yearMonth &&
        transactionMatchesTeam(row, team)
    );
    const payoutDue = Math.max(0, net);
    const debtDue = Math.max(0, -net);

    return {
      teamId,
      teamName,
      doc,
      confirmedAt: doc?.confirmedAt ?? null,
      salesTotal,
      purchasesTotal,
      deductionsTotal,
      additionsTotal,
      officeFee,
      net,
      payoutDue,
      debtDue,
      payoutRecorded,
      debtCollected,
      payoutOutstanding: Math.max(0, payoutDue - payoutRecorded),
      debtOutstanding: Math.max(0, debtDue - debtCollected),
      loadError: errors[teamId]
    };
  });

const OfficeManagementPage: React.FC = () => {
  const [yearMonth, setYearMonth] = useState(getCurrentYearMonth);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamSettlementDocs, setTeamSettlementDocs] = useState<Array<TeamSettlementDocument | null>>([]);
  const [settlementErrors, setSettlementErrors] = useState<Record<string, string>>({});
  const [transactions, setTransactions] = useState<OfficeTransaction[]>([]);
  const [dailyWageMargins, setDailyWageMargins] = useState<DailyWageMarginRow[]>([]);
  const [officePayroll, setOfficePayroll] = useState<OfficePayrollSummary>(emptyPayrollSummary);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [incomeDetailKind, setIncomeDetailKind] = useState<IncomeDetailKind | null>(null);
  const {
    loading: officeLedgerLoading,
    summaries: officeLedgerSummaries,
    selectedClaims: officeLedgerClaims,
    selectedRawDocs: officeLedgerRawDocs,
    loadData: loadOfficeExpenseLedgerData
  } = useExpenseLedgerData(yearMonth, OFFICE_ASSIGNMENT_TEAM_ID, 'posted');

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const period = getMonthPeriod(yearMonth);
      const [teamRows, transactionRows, staffRows, reportRows, workerRows] = await Promise.all([
        teamService.getTeams(),
        officeService.getTransactionsByMonth(yearMonth),
        officeStaffService.getOfficeStaff(true),
        dailyReportService.getReportWorkerRowsByRange({ startDate: period.startDate, endDate: period.endDate }),
        manpowerService.getWorkers(true)
      ]);

      const sortedTeams = [...teamRows].sort((left, right) => toText(left.name).localeCompare(toText(right.name), 'ko-KR'));
      const settlementResults = await Promise.allSettled(
        sortedTeams.map((team) => {
          const teamId = getTeamId(team);
          if (!teamId) return Promise.resolve(null);
          return teamSettlementService.getTeamSettlement({ yearMonth, teamId });
        })
      );

      const nextErrors: Record<string, string> = {};
      const docs = settlementResults.map((result, index) => {
        if (result.status === 'fulfilled') return result.value;
        const teamId = getTeamId(sortedTeams[index]);
        nextErrors[teamId] = '팀정산 데이터를 불러오지 못했습니다.';
        console.error('[OfficeManagementPage] settlement load failed:', result.reason);
        return null;
      });

      setTeams(sortedTeams);
      setTeamSettlementDocs(docs);
      setSettlementErrors(nextErrors);
      setTransactions([...transactionRows].sort((left, right) => String(right.date).localeCompare(String(left.date), 'ko-KR')));
      setDailyWageMargins(calculateDailyWageMargins(reportRows, workerRows));
      setOfficePayroll(calculateOfficePayrollSummary(staffRows, yearMonth));
    } catch (error) {
      console.error('[OfficeManagementPage] load failed:', error);
      setLoadError('사무실 정산 데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [yearMonth]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const teamRows = useMemo(
    () => buildTeamSettlementRows(teams, teamSettlementDocs, transactions, yearMonth, settlementErrors),
    [settlementErrors, teamSettlementDocs, teams, transactions, yearMonth]
  );

  const manualIncomeTransactions = useMemo(
    () =>
      transactions.filter(
        (row) =>
          row.type === 'income' &&
          ['MANUAL_DEPOSIT', 'OTHER_INCOME', 'SALES_GOODS'].includes(row.category)
      ),
    [transactions]
  );

  const siteSeparateIncomeTransactions = useMemo(
    () => transactions.filter(isSiteSeparateIncomeTransaction),
    [transactions]
  );

  const manualExpenseTransactions = useMemo(
    () =>
      transactions.filter(
        (row) =>
          row.type === 'expense' &&
          (row.source === 'manual' || ['GENERAL_EXPENSE', 'OFFICE_RENT', 'UTILITIES', 'RENTAL_FEE'].includes(row.category))
      ),
    [transactions]
  );

  const officeLedgerSummary = officeLedgerSummaries[0] ?? null;

  const officeLedgerExpenseRows = useMemo<OfficeLedgerExpenseRow[]>(() => {
    const rows: OfficeLedgerExpenseRow[] = [];
    const pushClaimRows = (claims: TeamExpenseClaim[], source: string, multiplier = 1) => {
      claims.forEach((claim) => {
        const amount = toFiniteNumber(claim.amount) * multiplier;
        if (amount === 0) return;
        rows.push({
          id: `${source}-${claim.id}`,
          date: claim.date || claim.yearMonth,
          source,
          title: claim.description || claim.category || source,
          description: toText(claim.memo || claim.cardLabel || claim.siteName || claim.status),
          amount
        });
      });
    };

    officeLedgerRawDocs.accommodationDocs.forEach((doc) => {
      const total = (doc.lineItems ?? []).reduce((sum, item) => sum + toFiniteNumber(item.amount), 0);
      if (total <= 0) return;
      const itemLabels = (doc.lineItems ?? [])
        .map((item) => toText(item.label))
        .filter(Boolean)
        .slice(0, 3)
        .join(', ');
      rows.push({
        id: `accommodation-${doc.id}`,
        date: doc.yearMonth,
        source: '숙소',
        title: doc.memo || doc.issuedToWorkerName || '숙소 비용',
        description: itemLabels || doc.teamName,
        amount: total
      });
    });

    officeLedgerRawDocs.vehicleDocs.forEach((doc) => {
      const breakdown = summarizeVehicleBillingCosts(doc);
      if (breakdown.total <= 0) return;
      const parts = [
        ['렌트', breakdown.rent],
        ['리스', breakdown.lease],
        ['주유', breakdown.fuel],
        ['수리', breakdown.repair],
        ['통행료', breakdown.toll],
        ['과태료', breakdown.fine],
        ['기타', breakdown.other]
      ]
        .filter(([, amount]) => toFiniteNumber(amount) > 0)
        .map(([label, amount]) => `${label} ${formatCurrency(toFiniteNumber(amount))}원`);
      rows.push({
        id: `vehicle-${doc.id}`,
        date: doc.yearMonth,
        source: '차량',
        title: doc.vehiclePlate || '차량 비용',
        description: parts.join(' / ') || doc.memo || doc.status,
        amount: breakdown.total
      });
    });

    officeLedgerRawDocs.cardDocs.forEach((doc) => {
      const lineTotal = (doc.lineItems ?? []).reduce((sum, item) => sum + toFiniteNumber(item.amount), 0);
      const total = lineTotal > 0 ? lineTotal : toFiniteNumber(doc.totalAmount);
      if (total <= 0) return;
      rows.push({
        id: `card-${doc.id}`,
        date: doc.yearMonth,
        source: '카드',
        title: doc.cardLabel || '카드 사용',
        description: doc.memo || `${(doc.lineItems ?? []).length.toLocaleString('ko-KR')}건`,
        amount: total
      });
    });

    pushClaimRows(officeLedgerClaims.office, '사무실경비');
    pushClaimRows(officeLedgerClaims.other, '기타청구');
    pushClaimRows(officeLedgerClaims.payable, '내야 할 후청구');
    pushClaimRows(officeLedgerClaims.receivable, '받을 후청구 차감', -1);

    return rows.sort((left, right) => String(right.date).localeCompare(String(left.date), 'ko-KR'));
  }, [officeLedgerClaims, officeLedgerRawDocs]);

  const officeLedgerExpenseTotal = useMemo(
    () => officeLedgerSummary ? getSummaryTotal(officeLedgerSummary) : officeLedgerExpenseRows.reduce((sum, row) => sum + row.amount, 0),
    [officeLedgerExpenseRows, officeLedgerSummary]
  );

  const officeLedgerDocumentCount = officeLedgerExpenseRows.length;

  const summary = useMemo(() => {
    const teamOfficeFee = teamRows.reduce((sum, row) => sum + row.officeFee, 0);
    const dailyWageMargin = dailyWageMargins.reduce((sum, row) => sum + row.margin, 0);
    const siteSeparateIncome = siteSeparateIncomeTransactions.reduce((sum, row) => sum + toFiniteNumber(row.amount), 0);
    const manualIncome = manualIncomeTransactions.reduce((sum, row) => sum + toFiniteNumber(row.amount), 0);
    const manualExpense = manualExpenseTransactions.reduce((sum, row) => sum + toFiniteNumber(row.amount), 0);
    const officeLedgerExpense = officeLedgerExpenseTotal;
    const staffPayrollExpense = officePayroll.companyCost;
    const incomeTotal = teamOfficeFee + dailyWageMargin + siteSeparateIncome + manualIncome;
    const expenseTotal = officeLedgerExpense + staffPayrollExpense + manualExpense;

    return {
      teamOfficeFee,
      dailyWageMargin,
      siteSeparateIncome,
      manualIncome,
      manualExpense,
      officeLedgerExpense,
      staffPayrollExpense,
      incomeTotal,
      expenseTotal,
      netCash: incomeTotal - expenseTotal
    };
  }, [dailyWageMargins, manualExpenseTransactions, manualIncomeTransactions, officeLedgerExpenseTotal, officePayroll.companyCost, siteSeparateIncomeTransactions, teamRows]);

  const handleManualDeposit = useCallback(async () => {
    const defaultDate = getDefaultTransactionDate(yearMonth);
    const result = await Swal.fire({
      title: '수입 입금 등록',
      html: `
        <div class="space-y-3 text-left">
          <label class="block text-sm font-semibold text-slate-700">입금일</label>
          <input id="office-income-date" type="date" value="${defaultDate}" class="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
          <label class="block text-sm font-semibold text-slate-700">금액</label>
          <input id="office-income-amount" type="text" inputmode="numeric" class="w-full rounded border border-slate-300 px-3 py-2 text-right text-sm" placeholder="0" />
          <label class="block text-sm font-semibold text-slate-700">내용</label>
          <input id="office-income-desc" type="text" class="w-full rounded border border-slate-300 px-3 py-2 text-sm" placeholder="입금 내용" />
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: '등록',
      cancelButtonText: '취소',
      preConfirm: () => {
        const date = (document.getElementById('office-income-date') as HTMLInputElement | null)?.value || defaultDate;
        const amount = toFiniteNumber((document.getElementById('office-income-amount') as HTMLInputElement | null)?.value);
        const description = toText((document.getElementById('office-income-desc') as HTMLInputElement | null)?.value) || '수기 입금';
        if (!date || amount <= 0) {
          Swal.showValidationMessage('입금일과 금액을 확인하세요.');
          return false;
        }
        return { date, amount, description };
      }
    });

    if (!result.isConfirmed || !result.value) return;

    const now = new Date().toISOString();
    await officeService.setTransaction({
      id: buildTransactionId('manual_income', [yearMonth]),
      date: result.value.date,
      type: 'income',
      category: 'MANUAL_DEPOSIT',
      amount: result.value.amount,
      description: result.value.description,
      relatedYearMonth: yearMonth,
      source: 'manual',
      createdAt: now,
      updatedAt: now
    });
    toast.success('수입 입금을 등록했습니다.');
    await loadData();
  }, [loadData, yearMonth]);

  const handleManualExpense = useCallback(async () => {
    const defaultDate = getDefaultTransactionDate(yearMonth);
    const result = await Swal.fire({
      title: '지출 등록',
      html: `
        <div class="space-y-3 text-left">
          <label class="block text-sm font-semibold text-slate-700">지출일</label>
          <input id="office-expense-date" type="date" value="${defaultDate}" class="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
          <label class="block text-sm font-semibold text-slate-700">금액</label>
          <input id="office-expense-amount" type="text" inputmode="numeric" class="w-full rounded border border-slate-300 px-3 py-2 text-right text-sm" placeholder="0" />
          <label class="block text-sm font-semibold text-slate-700">내용</label>
          <input id="office-expense-desc" type="text" class="w-full rounded border border-slate-300 px-3 py-2 text-sm" placeholder="지출 내용" />
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: '등록',
      cancelButtonText: '취소',
      preConfirm: () => {
        const date = (document.getElementById('office-expense-date') as HTMLInputElement | null)?.value || defaultDate;
        const amount = toFiniteNumber((document.getElementById('office-expense-amount') as HTMLInputElement | null)?.value);
        const description = toText((document.getElementById('office-expense-desc') as HTMLInputElement | null)?.value) || '수기 지출';
        if (!date || amount <= 0) {
          Swal.showValidationMessage('지출일과 금액을 확인하세요.');
          return false;
        }
        return { date, amount, description };
      }
    });

    if (!result.isConfirmed || !result.value) return;

    const now = new Date().toISOString();
    await officeService.setTransaction({
      id: buildTransactionId('manual_expense', [yearMonth]),
      date: result.value.date,
      type: 'expense',
      category: 'GENERAL_EXPENSE',
      amount: result.value.amount,
      description: result.value.description,
      relatedYearMonth: yearMonth,
      source: 'manual',
      createdAt: now,
      updatedAt: now
    });
    toast.success('지출을 등록했습니다.');
    await loadData();
  }, [loadData, yearMonth]);

  const handleRefresh = useCallback(async () => {
    await Promise.all([loadData(), loadOfficeExpenseLedgerData()]);
  }, [loadData, loadOfficeExpenseLedgerData]);

  const isRefreshing = loading || officeLedgerLoading;

  const summaryCards = [
    { label: '수입 합계', value: summary.incomeTotal, className: 'text-emerald-700', icon: ArrowUpRight },
    { label: '지출 합계', value: summary.expenseTotal, className: 'text-red-700', icon: ArrowDownRight },
    { label: '현금 기준 순액', value: summary.netCash, className: summary.netCash >= 0 ? 'text-slate-950' : 'text-red-700', icon: Banknote }
  ];

  const selectedYearMonth = useMemo(() => parseYearMonthValue(yearMonth), [yearMonth]);

  const handleSettlementYearChange = useCallback((delta: number) => {
    setYearMonth((prev) => {
      const current = parseYearMonthValue(prev);
      return buildYearMonthValue(current.year + delta, current.month);
    });
  }, []);

  const handleSettlementMonthSelect = useCallback((month: number) => {
    setYearMonth((prev) => {
      const current = parseYearMonthValue(prev);
      return buildYearMonthValue(current.year, month);
    });
  }, []);

  const incomeDetail = useMemo((): { title: string; rows: IncomeDetailRow[]; total: number } | null => {
    if (!incomeDetailKind) return null;

    if (incomeDetailKind === 'teamOfficeFee') {
      const rows = teamRows
        .filter((row) => row.officeFee > 0)
        .map((row) => ({
          id: `team-office-${row.teamId}`,
          date: row.confirmedAt ? row.confirmedAt.slice(0, 10) : undefined,
          title: row.teamName,
          description: row.confirmedAt ? '팀정산 확정 관리비' : '팀정산 관리비',
          amount: row.officeFee
        }));
      return { title: '사무실비 공제 전체 내역', rows, total: rows.reduce((sum, row) => sum + row.amount, 0) };
    }

    if (incomeDetailKind === 'dailyWageMargin') {
      const rows = dailyWageMargins
        .filter((row) => row.margin > 0)
        .map((row) => ({
          id: `daily-wage-${row.teamKey}`,
          title: row.teamName,
          description: `${row.workerCount}명 · ${row.manDay.toFixed(1)}공수 · 청구 ${formatCurrency(row.claimAmount)}원 / 실지급 ${formatCurrency(row.actualAmount)}원`,
          amount: row.margin
        }));
      return { title: '일급제 차액 전체 내역', rows, total: rows.reduce((sum, row) => sum + row.amount, 0) };
    }

    if (incomeDetailKind === 'siteIncome') {
      const rows = siteSeparateIncomeTransactions.map((row) => ({
        id: row.id,
        date: row.date,
        title: getSiteIncomeTitle(row),
        description: row.description,
        amount: toFiniteNumber(row.amount)
      }));
      return { title: '현장별 별도 수입 전체 내역', rows, total: rows.reduce((sum, row) => sum + row.amount, 0) };
    }

    const rows = manualIncomeTransactions.map((row) => ({
      id: row.id,
      date: row.date,
      title: row.description || row.subCategory || '수기 입금',
      description: row.subCategory || row.category,
      amount: toFiniteNumber(row.amount)
    }));
    return { title: '수기 입금 전체 내역', rows, total: rows.reduce((sum, row) => sum + row.amount, 0) };
  }, [dailyWageMargins, incomeDetailKind, manualIncomeTransactions, siteSeparateIncomeTransactions, teamRows]);

  const incomeCompositionRows: Array<{ kind: IncomeDetailKind; label: string; amount: number }> = [
    { kind: 'teamOfficeFee', label: '사무실비 공제', amount: summary.teamOfficeFee },
    { kind: 'dailyWageMargin', label: '일급제 차액', amount: summary.dailyWageMargin },
    { kind: 'siteIncome', label: '현장별 별도 수입', amount: summary.siteSeparateIncome },
    { kind: 'manualIncome', label: '수기 입금', amount: summary.manualIncome }
  ];

  return (
    <div className="min-h-screen bg-slate-100 p-4 xl:p-6">
      <div className="mx-auto max-w-[1900px] space-y-4">
        <header className="flex flex-col gap-3 border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-xl font-black text-slate-950">사무실 정산</h1>
            <p className="mt-1 text-sm font-medium text-slate-500">월별 수입과 지출을 집계합니다.</p>
          </div>
          <div className="flex flex-wrap items-start gap-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
              <div className="text-xs font-black text-slate-500">정산월</div>
              <div className="mt-1.5 flex flex-col gap-1.5 xl:flex-row xl:items-center">
                <div className="inline-flex shrink-0 items-center rounded-lg border border-slate-200 bg-white p-1">
                  <button
                    type="button"
                    className="inline-flex h-6 w-6 items-center justify-center rounded-md text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                    aria-label={`${selectedYearMonth.year - 1}년으로 이동`}
                    onClick={() => handleSettlementYearChange(-1)}
                  >
                    {'<'}
                  </button>
                  <div className="min-w-[58px] px-1 text-center text-sm font-black text-slate-800">{selectedYearMonth.year}년</div>
                  <button
                    type="button"
                    className="inline-flex h-6 w-6 items-center justify-center rounded-md text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                    aria-label={`${selectedYearMonth.year + 1}년으로 이동`}
                    onClick={() => handleSettlementYearChange(1)}
                  >
                    {'>'}
                  </button>
                </div>

                <div className="grid w-full grid-cols-6 gap-0.5 sm:min-w-[450px] sm:grid-cols-12">
                  {MONTH_BUTTON_OPTIONS.map((month) => {
                    const isSelected = selectedYearMonth.month === month;
                    return (
                      <button
                        key={month}
                        type="button"
                        className={`h-6 min-w-0 rounded border px-0 text-sm font-black leading-none transition ${isSelected
                          ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50'
                          }`}
                        aria-pressed={isSelected}
                        onClick={() => handleSettlementMonthSelect(month)}
                      >
                        {month}월
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
              새로고침
            </button>
            <button
              type="button"
              onClick={handleManualDeposit}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-black text-white hover:bg-emerald-700"
            >
              <Plus size={16} />
              수입 입금
            </button>
            <button
              type="button"
              onClick={handleManualExpense}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-black text-white hover:bg-red-700"
            >
              <Plus size={16} />
              지출 등록
            </button>
          </div>
        </header>

        {loadError ? (
          <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{loadError}</div>
        ) : null}

        <section className="grid gap-3 md:grid-cols-3">
          {summaryCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs font-black uppercase tracking-wide text-slate-500">{card.label}</div>
                  <Icon size={18} className="text-slate-400" />
                </div>
                <div className={`mt-2 text-2xl font-black tabular-nums ${card.className}`}>
                  {formatSignedCurrency(card.value)}
                </div>
                <div className="mt-1 text-xs font-semibold text-slate-400">원</div>
              </div>
            );
          })}
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <div className="border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h2 className="flex items-center gap-2 text-base font-black text-slate-950">
                <ArrowUpRight size={18} className="text-emerald-600" />
                수입 구성
              </h2>
            </div>
            <div className="divide-y divide-slate-100">
              {incomeCompositionRows.map((row) => (
                <div key={row.kind} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <span className="font-bold text-slate-600">{row.label}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-black text-emerald-700 tabular-nums">{formatCurrency(row.amount)}원</span>
                    <button
                      type="button"
                      onClick={() => setIncomeDetailKind(row.kind)}
                      className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-xs font-black text-slate-500 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
                    >
                      <Eye size={13} />
                      상세보기
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h2 className="flex items-center gap-2 text-base font-black text-slate-950">
                <ArrowDownRight size={18} className="text-red-600" />
                지출 구성
              </h2>
              <div className="flex items-center gap-3">
                <Link to="/support/expense-ledger" className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-900">
                  경비
                  <ExternalLink size={13} />
                </Link>
                <Link to="/payroll/office-staff-payroll" className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-900">
                  직원급여
                  <ExternalLink size={13} />
                </Link>
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              {[
                ['사무실 경비내역', summary.officeLedgerExpense],
                ['직원급여 회사부담', summary.staffPayrollExpense],
                ['수기 지출', summary.manualExpense]
              ].map(([label, amount]) => (
                <div key={String(label)} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="font-bold text-slate-600">{label}</span>
                  <span className="font-black text-red-700 tabular-nums">{formatCurrency(Number(amount))}원</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <div className="border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h2 className="flex items-center gap-2 text-base font-black text-slate-950">
                <ReceiptText size={18} className="text-slate-600" />
                일급제 차액
              </h2>
              <Link to="/payroll/daily-advance-workbook" className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-900">
                대납출력부
                <ExternalLink size={13} />
              </Link>
            </div>
            <div className="overflow-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead>
                  <tr className="bg-slate-50 text-xs text-slate-600">
                    <th className="px-3 py-2 text-left">팀</th>
                    <th className="px-3 py-2 text-right">인원</th>
                    <th className="px-3 py-2 text-right">공수</th>
                    <th className="px-3 py-2 text-right">청구금액</th>
                    <th className="px-3 py-2 text-right">일당실지급금</th>
                    <th className="px-3 py-2 text-right">차액</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyWageMargins.length > 0 ? (
                    dailyWageMargins.map((row) => (
                      <tr key={row.teamKey} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-bold text-slate-800">{row.teamName}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{row.workerCount}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{row.manDay.toFixed(1)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(row.claimAmount)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(row.actualAmount)}</td>
                        <td className="px-3 py-2 text-right font-black text-emerald-700 tabular-nums">{formatCurrency(row.margin)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm font-bold text-slate-400">
                        일급제 차액 데이터가 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h2 className="flex items-center gap-2 text-base font-black text-slate-950">
                <ReceiptText size={18} className="text-slate-600" />
                사무실 경비와 직원급여
              </h2>
            </div>
            <div className="grid gap-0 divide-y divide-slate-100">
              <div className="grid grid-cols-2 gap-3 px-4 py-3 text-sm">
                <div>
                  <div className="text-xs font-black text-slate-500">경비내역 반영</div>
                  <div className="mt-1 text-xl font-black text-red-700">{formatCurrency(summary.officeLedgerExpense)}원</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-black text-slate-500">문서 수</div>
                  <div className="mt-1 text-xl font-black text-slate-900">{officeLedgerDocumentCount.toLocaleString('ko-KR')}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 px-4 py-3 text-sm">
                <div>
                  <div className="text-xs font-black text-slate-500">직원급여 회사부담</div>
                  <div className="mt-1 text-xl font-black text-red-700">{formatCurrency(officePayroll.companyCost)}원</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-black text-slate-500">실지급 / 보험회사부담</div>
                  <div className="mt-1 font-black text-slate-900">
                    {formatCurrency(officePayroll.netPay)} / {formatCurrency(officePayroll.employerInsurance)}
                  </div>
                  <div className="mt-1 text-xs font-bold text-slate-400">
                    직원 {officePayroll.staffCount}명 / 수동 {officePayroll.manualCount}건
                  </div>
                </div>
              </div>
              <div className="max-h-72 overflow-auto">
                {officeLedgerExpenseRows.length > 0 ? (
                  <table className="w-full text-sm">
                    <tbody>
                      {officeLedgerExpenseRows.slice(0, 8).map((row) => (
                        <tr key={row.id} className="border-t border-slate-100">
                          <td className="px-4 py-2 font-bold text-slate-700">{row.date}</td>
                          <td className="px-4 py-2">
                            <div className="font-black text-slate-800">{row.source}</div>
                            <div className="text-xs font-semibold text-slate-500">{row.title}</div>
                          </td>
                          <td className="px-4 py-2 text-slate-500">{row.description || '-'}</td>
                          <td className={`px-4 py-2 text-right font-black tabular-nums ${row.amount < 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                            {formatCurrency(row.amount)}원
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="px-4 py-8 text-center text-sm font-bold text-slate-400">
                    {officeLedgerLoading ? '사무실 경비내역을 불러오는 중입니다.' : '반영된 사무실 경비가 없습니다.'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

      </div>

      {incomeDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="max-h-[88vh] w-full max-w-5xl overflow-hidden border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-black text-slate-950">{incomeDetail.title}</h2>
                <p className="mt-1 text-xs font-bold text-slate-500">
                  총 {incomeDetail.rows.length.toLocaleString('ko-KR')}건 · {formatCurrency(incomeDetail.total)}원
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIncomeDetailKind(null)}
                className="inline-flex h-9 w-9 items-center justify-center rounded border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                aria-label="상세보기 닫기"
              >
                <X size={18} />
              </button>
            </div>
            <div className="max-h-[68vh] overflow-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="sticky top-0 bg-slate-50 text-xs font-black text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left">일자</th>
                    <th className="px-4 py-3 text-left">내역</th>
                    <th className="px-4 py-3 text-left">비고</th>
                    <th className="px-4 py-3 text-right">금액</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {incomeDetail.rows.length > 0 ? (
                    incomeDetail.rows.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-bold text-slate-600">{row.date || '-'}</td>
                        <td className="px-4 py-3 font-black text-slate-900">{row.title}</td>
                        <td className="px-4 py-3 text-slate-500">{row.description || '-'}</td>
                        <td className="px-4 py-3 text-right font-black text-emerald-700 tabular-nums">{formatCurrency(row.amount)}원</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-sm font-bold text-slate-400">
                        상세 내역이 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export { OfficeManagementPage };
export default OfficeManagementPage;
