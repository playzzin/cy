
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTable,
  faRotateRight,
  faSpinner
} from '@fortawesome/free-solid-svg-icons';
import { Square, CheckSquare } from 'lucide-react';

import { dailyReportService, DailyReport, DailyReportWorker } from '../../services/dailyReportService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { teamService, Team } from '../../services/teamService';
import { siteService, Site } from '../../services/siteService';
import { advancePaymentService, AdvancePayment } from '../../services/advancePaymentService';
import { payrollConfigService, PayrollConfig } from '../../services/payrollConfigService';

// --- Types ---
type SalaryMode = 'daily' | 'monthly' | 'all';
type StatsScope = 'team' | 'worker';

type DailyDeductionInputs = {
  actualDeductionUnitPrice: number;
  billingDeductionUnitPrice: number;
  reportDeductionUnitPrice: number;
};

type MonthlyWorkEntry = {
  date: string;
  siteId: string;
  siteName: string;
  clientCompanyId: string;
  isLabor: boolean;
  manDay: number;
  unitPrice: number;
  amount: number;
};

type DeductionLine = { label: string; amount: number };

type MonthlyRow = {
  id: string; // Unique ID
  month: string;
  workerId: string;
  workerName: string;
  teamId: string;
  teamName: string;
  totalManDay: number;
  grossAmount: number;
  deductionLines: DeductionLine[];
  taxLines: DeductionLine[];
  totalDeduction: number;
  totalAmount: number;
  workEntries: MonthlyWorkEntry[];
};

type DailyLine = {
  id: string; // Unique ID
  date: string;
  teamId: string;
  teamName: string;
  workerId: string;
  workerName: string;
  manDay: number;
  originalUnitPrice: number;
  originalAmount: number;
  actualAmount: number;
  billingAmount: number;
  reportAmount: number;
  actualDeductionAmount: number;
  billingDeductionAmount: number;
  reportDeductionAmount: number;
};

// --- Helpers ---
const toNumber = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

const formatWon = (value: number): string => {
  const safe = Number.isFinite(value) ? value : 0;
  return Math.round(safe).toLocaleString('ko-KR');
};

const normalizeKey = (value: string | undefined): string =>
  (value ?? '').replace(/\(.*?\)/g, '').replace(/\s+/g, '').trim();

const compareYearMonth = (a: string, b: string): number => {
  const left = (a ?? '').trim();
  const right = (b ?? '').trim();
  if (left === right) return 0;
  return left < right ? -1 : 1;
};

const yearMonthFromDate = (date: string): string => (date ?? '').slice(0, 7);

const shiftYearMonth = (yearMonth: string, diffMonths: number): string => {
  const [yStr, mStr] = yearMonth.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const base = new Date(Number.isFinite(y) ? y : new Date().getFullYear(), (Number.isFinite(m) ? m : 1) - 1, 1);
  base.setMonth(base.getMonth() + diffMonths);
  const yyyy = String(base.getFullYear());
  const mm = String(base.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
};

const buildMonthRange = (start: string, end: string): string[] => {
  const safeStart = (start ?? '').trim();
  const safeEnd = (end ?? '').trim();
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
};

const resolveSalaryModel = (rw: DailyReportWorker, worker: Worker | undefined): string => {
  const a = typeof rw.salaryModel === 'string' ? rw.salaryModel.trim() : '';
  if (a) return a;
  const b = typeof rw.payType === 'string' ? rw.payType.trim() : '';
  if (b) return b;
  const c = typeof worker?.salaryModel === 'string' ? worker.salaryModel.trim() : '';
  if (c) return c;
  const d = typeof worker?.payType === 'string' ? worker.payType.trim() : '';
  return d;
};

const getAdvanceValue = (record: AdvancePayment, key: string): number => {
  const raw = (record as unknown as Record<string, unknown>)[key];
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const items = record.items;
  const maybe = items?.[key];
  if (typeof maybe === 'number' && Number.isFinite(maybe)) return maybe;
  return 0;
};

const PayrollStatisticsPage: React.FC = () => {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const defaultStartDate = useMemo(() => {
    const d = new Date(now);
    d.setDate(d.getDate() - 14);
    return d.toISOString().slice(0, 10);
  }, []);

  const currentYearMonth = useMemo(() => {
    const yyyy = String(now.getFullYear());
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    return `${yyyy}-${mm}`;
  }, []);

  // --- State ---
  const [salaryMode, setSalaryMode] = useState<SalaryMode>('daily');

  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState('');

  const [teams, setTeams] = useState<Team[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [sites, setSites] = useState<Site[]>([]);

  // Filter State
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [selectedWorkerId, setSelectedWorkerId] = useState('');

  const [dailyStartDate, setDailyStartDate] = useState(defaultStartDate);
  const [dailyEndDate, setDailyEndDate] = useState(today);

  const [monthlyStartMonth, setMonthlyStartMonth] = useState(currentYearMonth);
  const [monthlyEndMonth, setMonthlyEndMonth] = useState(currentYearMonth);

  const [dailyDeductionInputs, setDailyDeductionInputs] = useState<DailyDeductionInputs>({
    actualDeductionUnitPrice: 0,
    billingDeductionUnitPrice: 0,
    reportDeductionUnitPrice: 0
  });

  const [applyInsurance, setApplyInsurance] = useState(true);
  const [applyBusinessIncome, setApplyBusinessIncome] = useState(true);

  const [payrollConfig, setPayrollConfig] = useState<PayrollConfig | null>(null);

  // Data State
  const [dailyLines, setDailyLines] = useState<DailyLine[]>([]);
  const [monthlyRows, setMonthlyRows] = useState<MonthlyRow[]>([]);

  // Selection State (Set of IDs)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // --- Init Data ---
  useEffect(() => {
    const init = async () => {
      try {
        const [t, w, s] = await Promise.all([teamService.getTeams(), manpowerService.getWorkers(), siteService.getSites()]);
        setTeams(t);
        setWorkers(w);
        setSites(s);
        const config = await payrollConfigService.getConfig();
        setPayrollConfig(config);
      } catch (e) {
        console.error(e);
      }
    };
    init();
  }, []);

  // --- Memos (Maps) ---
  const workerMap = useMemo(() => {
    const map = new Map<string, Worker>();
    workers.forEach((w) => {
      if (w.id) map.set(w.id, w);
    });
    return map;
  }, [workers]);

  const teamMap = useMemo(() => {
    const map = new Map<string, Team>();
    teams.forEach((t) => {
      if (t.id) map.set(t.id, t);
    });
    return map;
  }, [teams]);

  const siteMap = useMemo(() => {
    const map = new Map<string, Site>();
    sites.forEach((s) => {
      if (s.id) map.set(s.id, s);
      if (s.legacyId) map.set(s.legacyId, s);
    });
    return map;
  }, [sites]);

  // --- Selection Logic ---
  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = salaryMode === 'daily'
        ? dailyLines.map(r => r.id)
        : monthlyRows.map(r => r.id);
      setSelectedIds(new Set(allIds));
    } else {
      setSelectedIds(new Set());
    }
  };

  const toggleSelectRow = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const isAllSelected = useMemo(() => {
    const currentList = salaryMode === 'daily' ? dailyLines : monthlyRows;
    if (currentList.length === 0) return false;
    return currentList.every(r => selectedIds.has(r.id));
  }, [salaryMode, dailyLines, monthlyRows, selectedIds]);

  // --- Fetch Logic ---
  const fetchDaily = useCallback(async () => {
    if (!dailyStartDate || !dailyEndDate) return;
    setLoading(true);
    setErrorText('');
    setDailyLines([]);
    setSelectedIds(new Set());

    try {
      const reports = await dailyReportService.getReportsByRange(
        dailyStartDate,
        dailyEndDate,
        selectedTeamId || undefined,
        selectedSiteId || undefined
      );

      const lines: DailyLine[] = [];
      reports.forEach((report) => {
        report.workers.forEach((rw) => {
          if (!rw) return;
          if (selectedWorkerId && rw.workerId !== selectedWorkerId) return;

          const worker = workerMap.get(rw.workerId);
          const model = resolveSalaryModel(rw, worker);
          if (model !== '일급제') return;

          const manDay = toNumber(rw.manDay);
          const originalUnitPrice = toNumber(rw.unitPrice ?? worker?.unitPrice ?? 0);
          const originalAmount = manDay * originalUnitPrice;

          const actualUnitPrice = Math.max(0, originalUnitPrice - dailyDeductionInputs.actualDeductionUnitPrice);
          const billingUnitPrice = Math.max(0, originalUnitPrice - dailyDeductionInputs.billingDeductionUnitPrice);
          const reportUnitPrice = Math.max(0, originalUnitPrice - dailyDeductionInputs.reportDeductionUnitPrice);

          const actualAmount = manDay * actualUnitPrice;
          const billingAmount = manDay * billingUnitPrice;
          const reportAmount = manDay * reportUnitPrice;

          lines.push({
            id: `${report.date}_${rw.workerId}_${report.teamId}_${Math.random()}`,
            date: report.date,
            teamId: report.teamId,
            teamName: report.teamName,
            workerId: rw.workerId,
            workerName: rw.name,
            manDay,
            originalUnitPrice,
            originalAmount,
            actualAmount,
            billingAmount,
            reportAmount,
            actualDeductionAmount: originalAmount - actualAmount,
            billingDeductionAmount: originalAmount - billingAmount,
            reportDeductionAmount: originalAmount - reportAmount
          });
        });
      });

      lines.sort((a, b) => b.date.localeCompare(a.date));
      setDailyLines(lines);
    } catch (e) {
      console.error(e);
      setErrorText('일급제 데이터 로드 실패');
    } finally {
      setLoading(false);
    }
  }, [dailyStartDate, dailyEndDate, selectedTeamId, selectedSiteId, selectedWorkerId, workerMap, dailyDeductionInputs]);

  const buildMonthlyTaxLines = useCallback(
    (config: PayrollConfig, entries: MonthlyWorkEntry[]): DeductionLine[] => {
      const safeThreshold = Math.max(0, Math.floor(toNumber(config.insuranceConfig?.thresholdDays)));
      const insuranceConfig = config.insuranceConfig;

      const laborEntries = entries.filter((e) => e.isLabor);

      const perSite = new Map<string, { manDay: number; amount: number; clientCompanyId: string; siteName: string }>();
      laborEntries.forEach((e) => {
        const prev = perSite.get(e.siteId) ?? { manDay: 0, amount: 0, clientCompanyId: e.clientCompanyId, siteName: e.siteName };
        perSite.set(e.siteId, {
          manDay: prev.manDay + toNumber(e.manDay),
          amount: prev.amount + toNumber(e.amount),
          clientCompanyId: (e.clientCompanyId ?? prev.clientCompanyId).trim(),
          siteName: (e.siteName ?? prev.siteName).trim()
        });
      });

      const perClient = new Map<string, { manDay: number; siteIds: Set<string> }>();
      perSite.forEach((v, siteId) => {
        const clientId = (v.clientCompanyId ?? '').trim();
        if (!clientId) return;
        const prev = perClient.get(clientId) ?? { manDay: 0, siteIds: new Set<string>() };
        prev.siteIds.add(siteId);
        perClient.set(clientId, { manDay: prev.manDay + v.manDay, siteIds: prev.siteIds });
      });

      const insuranceSiteIds = new Set<string>();
      if (applyInsurance && safeThreshold > 0) {
        perSite.forEach((v, siteId) => {
          if (v.manDay >= safeThreshold) insuranceSiteIds.add(siteId);
        });

        perClient.forEach((v, clientId) => {
          if (v.manDay < safeThreshold) return;
          v.siteIds.forEach((siteId) => insuranceSiteIds.add(siteId));
          const direct = Array.from(perSite.entries()).filter(([_, s]) => s.clientCompanyId === clientId);
          direct.forEach(([siteId]) => insuranceSiteIds.add(siteId));
        });
      }

      const insuranceBaseAmount = applyInsurance
        ? Array.from(perSite.entries()).reduce((sum, [siteId, v]) => sum + (insuranceSiteIds.has(siteId) ? v.amount : 0), 0)
        : 0;

      const allAmount = entries.reduce((sum, e) => sum + toNumber(e.amount), 0);
      const businessBaseAmount = applyBusinessIncome ? Math.max(0, allAmount - insuranceBaseAmount) : 0;

      const lines: DeductionLine[] = [];

      if (applyInsurance && insuranceBaseAmount > 0) {
        const pension = Math.floor(insuranceBaseAmount * toNumber(insuranceConfig?.pensionRate));
        const health = Math.floor(insuranceBaseAmount * toNumber(insuranceConfig?.healthRate));
        const care = Math.floor(health * toNumber(insuranceConfig?.careRateOfHealth));
        const employment = Math.floor(insuranceBaseAmount * toNumber(insuranceConfig?.employmentRate));

        if (pension > 0) lines.push({ label: '국민연금', amount: pension });
        if (health > 0) lines.push({ label: '건강보험', amount: health });
        if (care > 0) lines.push({ label: '장기요양', amount: care });
        if (employment > 0) lines.push({ label: '고용보험', amount: employment });

        const incomeTax = Math.floor(insuranceBaseAmount * toNumber(config.incomeTaxRate));
        const residentTax = Math.floor(insuranceBaseAmount * toNumber(config.residentTaxRate));
        if (incomeTax > 0) lines.push({ label: '근로소득세', amount: incomeTax });
        if (residentTax > 0) lines.push({ label: '지방소득세', amount: residentTax });
      }

      if (applyBusinessIncome && businessBaseAmount > 0) {
        const income = Math.floor(businessBaseAmount * 0.03);
        const resident = Math.floor(businessBaseAmount * 0.003);
        if (income > 0) lines.push({ label: '사업소득세', amount: income });
        if (resident > 0) lines.push({ label: '사업지방세', amount: resident });
      }

      return lines;
    },
    [applyBusinessIncome, applyInsurance]
  );

  const fetchMonthly = useCallback(async () => {
    if (!monthlyStartMonth || !monthlyEndMonth) return;
    const monthRange = buildMonthRange(monthlyStartMonth, monthlyEndMonth);
    if (monthRange.length === 0) return;

    setLoading(true);
    setErrorText('');
    setMonthlyRows([]);
    setSelectedIds(new Set());

    try {
      const config = payrollConfig ?? (await payrollConfigService.getConfig());
      if (!payrollConfig) setPayrollConfig(config);

      const safeStart = compareYearMonth(monthlyStartMonth, monthlyEndMonth) <= 0 ? monthlyStartMonth : monthlyEndMonth;
      const safeEnd = compareYearMonth(monthlyStartMonth, monthlyEndMonth) <= 0 ? monthlyEndMonth : monthlyStartMonth;
      const [endYearStr, endMonthStr] = safeEnd.split('-');
      const lastDay = new Date(Number(endYearStr), Number(endMonthStr), 0).getDate();
      const startDate = `${safeStart}-01`;
      const endDate = `${safeEnd}-${String(lastDay).padStart(2, '0')}`;

      const reports = await dailyReportService.getReportsByRange(startDate, endDate, selectedTeamId || undefined, selectedSiteId || undefined);

      const advancesByMonth = new Map<string, AdvancePayment[]>();
      await Promise.all(
        monthRange.map(async (month) => {
          const [y, m] = month.split('-').map(Number);
          if (!Number.isFinite(y)) return;
          const rows = await advancePaymentService.getAdvancePaymentsByYearMonth(y, m);
          advancesByMonth.set(month, rows);
        })
      );

      const advanceIndex = new Map<string, AdvancePayment[]>();
      advancesByMonth.forEach((rows) => {
        rows.forEach((row) => {
          const wid = (row.workerId || '').trim();
          const tid = (row.teamId || '').trim();
          if (wid) {
            const key = `${wid}__${tid || '-'}`;
            const prev = advanceIndex.get(key) ?? [];
            prev.push(row);
            advanceIndex.set(key, prev);
          }
        });
      });

      const agg = new Map<string, {
        month: string, workerId: string, teamId: string, teamName: string,
        totalManDay: number, grossAmount: number, workEntries: MonthlyWorkEntry[]
      }>();

      const resolveTeamName = (teamId: string, fallback: string) => {
        return teamMap.get(teamId)?.name || fallback;
      };

      reports.forEach((report) => {
        const month = yearMonthFromDate(report.date);
        if (!monthRange.includes(month)) return;

        report.workers.forEach((rw) => {
          if (!rw) return;
          if (selectedWorkerId && rw.workerId !== selectedWorkerId) return;
          const worker = workerMap.get(rw.workerId);
          if (resolveSalaryModel(rw, worker) !== '월급제') return;

          const teamId = (worker?.teamId || report.teamId || '').trim();
          const teamName = resolveTeamName(teamId, report.teamName);
          const manDay = toNumber(rw.manDay);
          const amount = manDay * toNumber(rw.unitPrice ?? worker?.unitPrice ?? 0);

          const key = `${month}__${rw.workerId}__${teamId || '-'}`;
          const prev = agg.get(key) ?? {
            month, workerId: rw.workerId, teamId, teamName,
            totalManDay: 0, grossAmount: 0, workEntries: []
          };

          agg.set(key, {
            ...prev,
            totalManDay: prev.totalManDay + manDay,
            grossAmount: prev.grossAmount + amount,
            workEntries: [...prev.workEntries, {
              date: report.date,
              siteId: report.siteId,
              siteName: report.siteName,
              clientCompanyId: (siteMap.get(report.siteId)?.clientCompanyId || '').trim(),
              isLabor: (siteMap.get(report.siteId)?.paymentMethod || '').trim() === '노무',
              manDay,
              unitPrice: toNumber(rw.unitPrice),
              amount
            }]
          });
        });
      });

      const rows: MonthlyRow[] = [];
      agg.forEach((v) => {
        const worker = workerMap.get(v.workerId);
        if (!worker) return;

        const advKey = `${v.workerId}__${v.teamId || '-'}`;
        const records = advanceIndex.get(advKey) ?? advanceIndex.get(`${v.workerId}__-`) ?? [];

        const deductionLines: DeductionLine[] = [];
        (config.deductionItems || []).forEach(item => {
          const sum = records.reduce((acc, r) => acc + getAdvanceValue(r, item.id), 0);
          if (sum > 0) deductionLines.push({ label: item.label, amount: sum });
        });

        const taxLines = buildMonthlyTaxLines(config, v.workEntries);
        const totalDeduction = [...deductionLines, ...taxLines].reduce((acc, l) => acc + l.amount, 0);

        rows.push({
          id: `${v.month}_${v.workerId}`,
          month: v.month,
          workerId: v.workerId,
          workerName: worker.name,
          teamId: v.teamId,
          teamName: v.teamName,
          totalManDay: v.totalManDay,
          grossAmount: v.grossAmount,
          deductionLines,
          taxLines,
          totalDeduction,
          totalAmount: v.grossAmount - totalDeduction,
          workEntries: v.workEntries
        });
      });

      rows.sort((a, b) => b.month.localeCompare(a.month)); // Sort by month desc
      setMonthlyRows(rows);

    } catch (e) {
      console.error(e);
      setErrorText('월급제 데이터 로드 실패');
    } finally {
      setLoading(false);
    }
  }, [monthlyEndMonth, monthlyStartMonth, selectedTeamId, selectedSiteId, selectedWorkerId, payrollConfig, buildMonthlyTaxLines, workerMap, teamMap, siteMap]);

  const handleRefresh = useCallback(() => {
    if (salaryMode === 'daily') void fetchDaily();
    else if (salaryMode === 'monthly') void fetchMonthly();
    else {
      void fetchDaily();
      void fetchMonthly();
    }
  }, [salaryMode, fetchDaily, fetchMonthly]);

  // --- Statistics ---
  const activeDailyData = useMemo(() => {
    if (salaryMode !== 'daily') return [];
    if (selectedIds.size > 0) return dailyLines.filter(r => selectedIds.has(r.id));
    return dailyLines;
  }, [dailyLines, selectedIds, salaryMode]);

  const activeMonthlyData = useMemo(() => {
    if (salaryMode !== 'monthly') return [];
    if (selectedIds.size > 0) return monthlyRows.filter(r => selectedIds.has(r.id));
    return monthlyRows;
  }, [monthlyRows, selectedIds, salaryMode]);

  const stats = useMemo(() => {
    const d = activeDailyData.reduce((acc, c) => ({
      manDay: acc.manDay + c.manDay,
      gross: acc.gross + c.originalAmount,
      deduction: acc.deduction + c.actualDeductionAmount,
      net: acc.net + c.actualAmount
    }), { manDay: 0, gross: 0, deduction: 0, net: 0 });

    const m = activeMonthlyData.reduce((acc, c) => ({
      manDay: acc.manDay + c.totalManDay,
      gross: acc.gross + c.grossAmount,
      deduction: acc.deduction + c.totalDeduction,
      net: acc.net + c.totalAmount
    }), { manDay: 0, gross: 0, deduction: 0, net: 0 });

    if (salaryMode === 'daily') return d;
    if (salaryMode === 'monthly') return m;

    return {
      manDay: d.manDay + m.manDay,
      gross: d.gross + m.gross,
      deduction: d.deduction + m.deduction,
      net: d.net + m.net
    };
  }, [salaryMode, activeDailyData, activeMonthlyData]);

  const selectedCount = selectedIds.size;
  const isSelectionActive = selectedCount > 0;

  return (
    <div className="h-full bg-[#f8fafc] flex flex-col">
      {/* 1. Header & Controls */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <FontAwesomeIcon icon={faTable} className="text-lg" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-800">급여/노임 통계</h1>
              <p className="text-xs text-slate-500 font-bold">
                {salaryMode === 'daily' ? '일급제' : salaryMode === 'monthly' ? '월급제' : '전체내역'} 근로자의 급여 정보를 분석합니다.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-slate-100 p-1 rounded-lg">
              <button
                onClick={() => { setSalaryMode('daily'); setSelectedIds(new Set()); }}
                className={`px-3 py-1.5 text-xs font-extrabold rounded-md transition-all ${salaryMode === 'daily' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}
              >일급제</button>
              <button
                onClick={() => { setSalaryMode('monthly'); setSelectedIds(new Set()); }}
                className={`px-3 py-1.5 text-xs font-extrabold rounded-md transition-all ${salaryMode === 'monthly' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}
              >월급제</button>
              <button
                onClick={() => { setSalaryMode('all'); setSelectedIds(new Set()); }}
                className={`px-3 py-1.5 text-xs font-extrabold rounded-md transition-all ${salaryMode === 'all' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}
              >전체내역</button>
            </div>
            <button
              onClick={handleRefresh}
              className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold flex items-center gap-2 transition-colors shadow-sm shadow-indigo-200"
            >
              <FontAwesomeIcon icon={loading ? faSpinner : faRotateRight} className={loading ? "animate-spin" : ""} />
              {loading ? '로딩...' : '조회'}
            </button>
          </div>
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-500">기간 설정</label>
            {(salaryMode === 'daily' || salaryMode === 'all') ? (
              <div className="flex gap-1 items-center">
                <input type="date" value={dailyStartDate} onChange={e => setDailyStartDate(e.target.value)} className="w-full text-xs font-bold border border-slate-200 rounded p-1.5" />
                <span className="text-slate-400">~</span>
                <input type="date" value={dailyEndDate} onChange={e => setDailyEndDate(e.target.value)} className="w-full text-xs font-bold border border-slate-200 rounded p-1.5" />
              </div>
            ) : (
              <div className="flex gap-1 items-center">
                <input type="month" value={monthlyStartMonth} onChange={e => setMonthlyStartMonth(e.target.value)} className="w-full text-xs font-bold border border-slate-200 rounded p-1.5" />
                <span className="text-slate-400">~</span>
                <input type="month" value={monthlyEndMonth} onChange={e => setMonthlyEndMonth(e.target.value)} className="w-full text-xs font-bold border border-slate-200 rounded p-1.5" />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-500">현장</label>
            <select value={selectedSiteId} onChange={e => setSelectedSiteId(e.target.value)} className="text-xs font-bold border border-slate-200 rounded p-1.5 bg-white">
              <option value="">전체 현장</option>
              {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-500">팀</label>
            <select value={selectedTeamId} onChange={e => setSelectedTeamId(e.target.value)} className="text-xs font-bold border border-slate-200 rounded p-1.5 bg-white">
              <option value="">전체 팀</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-500">작업자</label>
            <select value={selectedWorkerId} onChange={e => setSelectedWorkerId(e.target.value)} className="text-xs font-bold border border-slate-200 rounded p-1.5 bg-white">
              <option value="">전체 작업자</option>
              {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>

          {/* Deduction Inputs for Daily / All */}
          {(salaryMode === 'daily' || salaryMode === 'all') && (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500">단가 일괄차감 (지급)</label>
                <input type="number" value={dailyDeductionInputs.actualDeductionUnitPrice} onChange={e => setDailyDeductionInputs(p => ({ ...p, actualDeductionUnitPrice: Number(e.target.value) }))} className="text-xs font-bold border border-slate-200 rounded p-1.5" placeholder="0" />
              </div>
            </>
          )}
        </div>
      </div>

      {/* 2. Selection Summary Dashboard (Sticky) */}
      <div className="bg-slate-50 border-b border-indigo-100 px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-4 flex-shrink-0">
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500"></div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
            {isSelectionActive ? `선택된 항목 (${selectedCount})` : '전체 합계'}
          </p>
          <p className="text-lg font-extrabold text-slate-800">
            {currentYearMonth} {salaryMode === 'daily' ? '일급' : salaryMode === 'monthly' ? '월급' : '전체'}
          </p>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-slate-400"></div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">총 공수</p>
          <p className="text-xl font-extrabold text-slate-700">{stats.manDay.toFixed(1)} <span className="text-xs font-semibold text-slate-400">공수</span></p>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-rose-400"></div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">총 공제액 (지급차감)</p>
          <p className="text-xl font-extrabold text-rose-600">{formatWon(stats.deduction)} <span className="text-xs font-semibold text-rose-300">원</span></p>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500"></div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">실지급 총액</p>
          <p className="text-2xl font-black text-emerald-600 drop-shadow-sm">{formatWon(stats.net)} <span className="text-xs font-semibold text-emerald-300">원</span></p>
        </div>
      </div>

      {/* 3. Table Area */}
      <div className="flex-1 p-4 w-full h-full min-h-0 overflow-y-auto custom-scrollbar">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr className="divide-x divide-slate-100 border-b border-slate-200">
                <th className="px-3 py-3 w-12 text-center">
                  <button onClick={() => toggleSelectAll(!isAllSelected)} className="text-slate-400 hover:text-indigo-600">
                    {isAllSelected ? <CheckSquare className="w-5 h-5 text-indigo-600" /> : <Square className="w-5 h-5" />}
                  </button>
                </th>
                {salaryMode === 'daily' ? (
                  <>
                    <th className="px-3 py-3 text-left font-extrabold text-slate-500 text-xs uppercase">날짜</th>
                    <th className="px-3 py-3 text-left font-extrabold text-slate-500 text-xs uppercase">팀</th>
                    <th className="px-3 py-3 text-left font-extrabold text-slate-500 text-xs uppercase">작업자</th>
                    <th className="px-3 py-3 text-right font-extrabold text-slate-500 text-xs uppercase">공수</th>
                    <th className="px-3 py-3 text-right font-extrabold text-slate-500 text-xs uppercase">총액</th>
                    <th className="px-3 py-3 text-right font-extrabold text-slate-500 text-xs uppercase">지급차감</th>
                    <th className="px-3 py-3 text-right font-extrabold text-slate-500 text-xs uppercase">실지급액</th>
                  </>
                ) : salaryMode === 'monthly' ? (
                  <>
                    <th className="px-3 py-3 text-left font-extrabold text-slate-500 text-xs uppercase">월</th>
                    <th className="px-3 py-3 text-left font-extrabold text-slate-500 text-xs uppercase">팀</th>
                    <th className="px-3 py-3 text-left font-extrabold text-slate-500 text-xs uppercase">작업자</th>
                    <th className="px-3 py-3 text-right font-extrabold text-slate-500 text-xs uppercase">총 공수</th>
                    <th className="px-3 py-3 text-right font-extrabold text-slate-500 text-xs uppercase">총액</th>
                    <th className="px-3 py-3 text-right font-extrabold text-slate-500 text-xs uppercase">총 공제</th>
                    <th className="px-3 py-3 text-right font-extrabold text-slate-500 text-xs uppercase">실지급액</th>
                  </>
                ) : (
                  <>
                    <th className="px-3 py-3 text-left font-extrabold text-slate-500 text-xs uppercase">구분</th>
                    <th className="px-3 py-3 text-left font-extrabold text-slate-500 text-xs uppercase">날짜/월</th>
                    <th className="px-3 py-3 text-left font-extrabold text-slate-500 text-xs uppercase">팀</th>
                    <th className="px-3 py-3 text-left font-extrabold text-slate-500 text-xs uppercase">작업자</th>
                    <th className="px-3 py-3 text-right font-extrabold text-slate-500 text-xs uppercase">공수</th>
                    <th className="px-3 py-3 text-right font-extrabold text-slate-500 text-xs uppercase">총액</th>
                    <th className="px-3 py-3 text-right font-extrabold text-slate-500 text-xs uppercase">공제액</th>
                    <th className="px-3 py-3 text-right font-extrabold text-slate-500 text-xs uppercase">실지급액</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400 font-bold">
                    로딩 중입니다...
                  </td>
                </tr>
              ) : (
                salaryMode === 'daily' ? (
                  dailyLines.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400 font-bold">조회된 내역이 없습니다.</td></tr>
                  ) : (
                    dailyLines.map((row) => {
                      const isSelected = selectedIds.has(row.id);
                      return (
                        <tr key={row.id} className={`hover:bg-indigo-50/30 transition-colors cursor-pointer ${isSelected ? 'bg-indigo-50/40' : ''}`} onClick={() => toggleSelectRow(row.id)}>
                          <td className="px-3 py-3 text-center">
                            <button className={`${isSelected ? 'text-indigo-600' : 'text-slate-300'}`}>
                              {isSelected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                            </button>
                          </td>
                          <td className="px-3 py-3 font-bold text-slate-600">{row.date}</td>
                          <td className="px-3 py-3 font-medium text-slate-500">{row.teamName}</td>
                          <td className="px-3 py-3 font-bold text-slate-700">{row.workerName}</td>
                          <td className="px-3 py-3 text-right font-bold text-slate-600">{row.manDay.toFixed(1)}</td>
                          <td className="px-3 py-3 text-right font-medium text-slate-400">{formatWon(row.originalAmount)}</td>
                          <td className="px-3 py-3 text-right font-medium text-rose-400">{formatWon(row.actualDeductionAmount)}</td>
                          <td className="px-3 py-3 text-right font-extrabold text-emerald-600">{formatWon(row.actualAmount)}</td>
                        </tr>
                      );
                    })
                  )
                ) : salaryMode === 'monthly' ? (
                  monthlyRows.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400 font-bold">조회된 내역이 없습니다.</td></tr>
                  ) : (
                    monthlyRows.map((row) => {
                      const isSelected = selectedIds.has(row.id);
                      return (
                        <tr key={row.id} className={`hover:bg-indigo-50/30 transition-colors cursor-pointer ${isSelected ? 'bg-indigo-50/40' : ''}`} onClick={() => toggleSelectRow(row.id)}>
                          <td className="px-3 py-3 text-center">
                            <button className={`${isSelected ? 'text-indigo-600' : 'text-slate-300'}`}>
                              {isSelected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                            </button>
                          </td>
                          <td className="px-3 py-3 font-bold text-slate-600">{row.month}</td>
                          <td className="px-3 py-3 font-medium text-slate-500">{row.teamName}</td>
                          <td className="px-3 py-3 font-bold text-slate-700">{row.workerName}</td>
                          <td className="px-3 py-3 text-right font-bold text-slate-600">{row.totalManDay.toFixed(1)}</td>
                          <td className="px-3 py-3 text-right font-medium text-slate-400">{formatWon(row.grossAmount)}</td>
                          <td className="px-3 py-3 text-right font-medium text-rose-400">{formatWon(row.totalDeduction)}</td>
                          <td className="px-3 py-3 text-right font-extrabold text-emerald-600">{formatWon(row.totalAmount)}</td>
                        </tr>
                      );
                    })
                  )
                ) : (
                  // mode: ALL
                  (() => {
                    const unified = [
                      ...dailyLines.map(d => ({ ...d, type: '일급' as const, time: d.date, manDay: d.manDay, gross: d.originalAmount, deduction: d.actualDeductionAmount, net: d.actualAmount })),
                      ...monthlyRows.map(m => ({ ...m, type: '월급' as const, time: m.month, manDay: m.totalManDay, gross: m.grossAmount, deduction: m.totalDeduction, net: m.totalAmount }))
                    ].sort((a, b) => b.time.localeCompare(a.time));

                    if (unified.length === 0) {
                      return <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400 font-bold">조회된 내역이 없습니다.</td></tr>;
                    }

                    return unified.map((row) => {
                      const isSelected = selectedIds.has(row.id);
                      return (
                        <tr key={row.id} className={`hover:bg-indigo-50/30 transition-colors cursor-pointer ${isSelected ? 'bg-indigo-50/40' : ''}`} onClick={() => toggleSelectRow(row.id)}>
                          <td className="px-3 py-3 text-center">
                            <button className={`${isSelected ? 'text-indigo-600' : 'text-slate-300'}`}>
                              {isSelected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                            </button>
                          </td>
                          <td className="px-3 py-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${row.type === '일급' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                              {row.type}
                            </span>
                          </td>
                          <td className="px-3 py-3 font-bold text-slate-600">{row.time}</td>
                          <td className="px-3 py-3 font-medium text-slate-500">{row.teamName}</td>
                          <td className="px-3 py-3 font-bold text-slate-700">{row.workerName}</td>
                          <td className="px-3 py-3 text-right font-bold text-slate-600">{row.manDay.toFixed(1)}</td>
                          <td className="px-3 py-3 text-right font-medium text-slate-400">{formatWon(row.gross)}</td>
                          <td className="px-3 py-3 text-right font-medium text-rose-400">{formatWon(row.deduction)}</td>
                          <td className="px-3 py-3 text-right font-extrabold text-emerald-600">{formatWon(row.net)}</td>
                        </tr>
                      );
                    });
                  })()
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PayrollStatisticsPage;
