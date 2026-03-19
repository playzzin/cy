import { useState, useEffect, useCallback } from 'react';
import { dailyReportService } from '../../../services/dailyReportService';
import { manpowerService, Worker } from '../../../services/manpowerService';
import { siteService, Site } from '../../../services/siteService';
import { teamService, Team } from '../../../services/teamService';
import { payrollConfigService } from '../../../services/payrollConfigService';
import { advancePaymentService, AdvancePayment } from '../../../services/advancePaymentService';
import { PaymentData, MonthlyAdvanceLedgerRow, DeductionBreakdown, WorkerWorkEntry, DeductionLine, LedgerManualInput } from '../types/payroll';
import { BANK_CODES, STANDARD_DEDUCTION_FIELDS } from '../constants/payroll.constants';

// Helper: Convert any value to number safely
const toNumber = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

// Helper: Normalize team name for comparison
const normalizeTeamName = (value: string | undefined): string => {
  return (value ?? '')
    .replace(/\(.*?\)/g, '')
    .replace(/\s+/g, '')
    .trim();
};

// Helper: Build month range [YYYY-MM, ...]
const buildMonthRange = (rangeStart: string, rangeEnd: string): string[] => {
  const safeStart = (rangeStart ?? '').trim();
  const safeEnd = (rangeEnd ?? '').trim();
  if (!safeStart || !safeEnd) return [];

  const compareYearMonth = (a: string, b: string): number => {
    const left = (a ?? '').trim();
    const right = (b ?? '').trim();
    if (left === right) return 0;
    return left < right ? -1 : 1;
  };

  const shiftYearMonth = (yearMonth: string, diffMonths: number): string => {
    const [yStr, mStr] = yearMonth.split('-');
    const y = Number(yStr);
    const m = Number(mStr);
    const safe = new Date(Number.isFinite(y) ? y : new Date().getFullYear(), (Number.isFinite(m) ? m : 1) - 1, 1);
    safe.setMonth(safe.getMonth() + diffMonths);
    const yyyy = String(safe.getFullYear());
    const mm = String(safe.getMonth() + 1).padStart(2, '0');
    return `${yyyy}-${mm}`;
  };

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

// Helper: Deduplicate advance records by team
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

const createEmptyDeductionBreakdown = (): DeductionBreakdown => ({
  standardLines: [],
  additionalLines: [],
  pension: 0,
  health: 0,
  longterm: 0,
  employment: 0,
  incomeTax: 0,
  residentTax: 0,
  businessIncomeTax: 0,
  businessResidentTax: 0,
  total: 0,
  hasData: false,
});

const createEmptyLedgerSideInput = (): LedgerManualInput['invoice'] => ({
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

const pickPreferredAdvanceRecord = (
  records: AdvancePayment[],
  yearMonth: string,
  preferredTeamId?: string
): AdvancePayment | undefined => {
  const monthMatched = records.filter((record) => String(record.yearMonth ?? '') === yearMonth);
  if (monthMatched.length === 0) return undefined;

  const scoped = preferredTeamId
    ? monthMatched.filter((record) => String(record.teamId ?? '').trim() === String(preferredTeamId).trim())
    : monthMatched;

  const candidates = scoped.length > 0 ? scoped : monthMatched;
  return candidates.reduce<AdvancePayment | undefined>((best, current) => {
    if (!best) return current;
    const bestTs = best.updatedAt instanceof Date ? best.updatedAt.getTime() : 0;
    const currentTs = current.updatedAt instanceof Date ? current.updatedAt.getTime() : 0;
    if (currentTs !== bestTs) return currentTs > bestTs ? current : best;

    const bestScore = toNumber(best.totalDeduction);
    const currentScore = toNumber(current.totalDeduction);
    return currentScore >= bestScore ? current : best;
  }, undefined);
};

const buildManualInputFromAdvanceRecord = (record?: AdvancePayment): LedgerManualInput | undefined => {
  if (!record) return undefined;

  return {
    invoice: {
      ...createEmptyLedgerSideInput(),
      carry: toNumber(record.prevMonthCarryover),
      carrySecond: toNumber(record.items?.carrySecond),
      currentAdvance: toNumber(record.items?.currentAdvance),
      currentAdvanceSecond: toNumber(record.items?.currentAdvanceSecond),
      lodging: toNumber(record.accommodation),
      electricity: toNumber(record.electricity),
      gas: toNumber(record.gas),
      water: toNumber(record.water),
      internet: toNumber(record.internet),
      management: toNumber(record.items?.management),
      fine: toNumber(record.fines),
      other: toNumber(record.items?.other),
    },
    labor: createEmptyLedgerSideInput(),
    personalMemo: String(record.memo ?? ''),
    assignmentType: (record.assignmentType === 'labor' ? 'labor' : 'corporate'),
    itemAssignments: record.itemAssignments ?? {},
  };
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

  STANDARD_DEDUCTION_FIELDS.forEach(({ key, label }: { key: string; label: string }) => {
    const sum = deduped.reduce((acc, record) => acc + toNumber((record as any)[key]), 0);
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
    ...createEmptyDeductionBreakdown(),
    standardLines,
    additionalLines,
    total,
    hasData: total > 0,
  };
};

export const usePayrollData = (
  startMonth: string,
  endMonth: string,
  options: {
    selectedTeamId?: string;
    selectedWorkerId?: string;
  } = {}
) => {
  const { selectedTeamId, selectedWorkerId } = options;
  const [loading, setLoading] = useState(false);
  const [paymentData, setPaymentData] = useState<PaymentData[]>([]);
  const [basePaymentData, setBasePaymentData] = useState<PaymentData[]>([]);
  const [ledgerRowsData, setLedgerRowsData] = useState<MonthlyAdvanceLedgerRow[]>([]);
  const [errorCount, setErrorCount] = useState(0);

  const validateItem = useCallback((item: Partial<PaymentData>): { isValid: boolean, errors: Record<string, boolean> } => {
    const errors: Record<string, boolean> = {};
    let isValid = true;

    if (!item.bankName) {
      errors.bankName = true;
      isValid = false;
    }
    if (!item.bankCode && item.bankName) {
      if (!BANK_CODES[item.bankName]) {
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
  }, []);

  const fetchData = useCallback(async () => {
    if (!startMonth || !endMonth) return;

    const months = buildMonthRange(startMonth, endMonth);
    if (months.length === 0) return;

    setLoading(true);
    try {
      // 1. 기초 데이터 페칭
      const [allWorkers, allSites, allTeams, config] = await Promise.all([
        manpowerService.getWorkers(),
        siteService.getSites(),
        teamService.getTeams(),
        payrollConfigService.getConfig()
      ]);

      const workerMap = new Map<string, Worker>();
      allWorkers.forEach(w => { if (w.id) workerMap.set(w.id, w); });

      const siteMap = new Map<string, Site>();
      allSites.forEach(s => {
        const id = (s.id ?? '').trim();
        if (id) siteMap.set(id, s);
        const legacyId = (s.legacyId ?? '').trim();
        if (legacyId && !siteMap.has(legacyId)) siteMap.set(legacyId, s);
      });

      const teamMap = new Map<string, Team>();
      allTeams.forEach(t => { if (t.id) teamMap.set(t.id, t); });

      // 2. 월별 리포트 및 가불금 데이터 페칭
      const [endYear, endMonthNum] = endMonth.split('-');
      const safeStartDate = `${startMonth}-01`;
      const lastDay = new Date(Number(endYear), Number(endMonthNum), 0).getDate();
      const safeEndDate = `${endMonth}-${String(lastDay).padStart(2, '0')}`;

      const [monthlyReports, advances] = await Promise.all([
        dailyReportService.getReportsByRange(safeStartDate, safeEndDate),
        Promise.all(months.map(async (m) => {
          const [y, mm] = m.split('-').map(Number);
          return await advancePaymentService.getAdvancePaymentsByYearMonth(y, mm);
        })).then(results => results.flat())
      ]);

      const advanceByWorkerTeamKey = new Map<string, AdvancePayment[]>();
      const advanceListByWorkerId = new Map<string, AdvancePayment[]>();
      advances.forEach((item) => {
        const workerId = (item.workerId ?? '').trim();
        const teamId = (item.teamId ?? '').trim();
        if (!workerId) return;
        if (teamId) {
          const key = `${workerId}__${teamId}`;
          advanceByWorkerTeamKey.set(key, [...(advanceByWorkerTeamKey.get(key) ?? []), item]);
        }
        advanceListByWorkerId.set(workerId, [...(advanceListByWorkerId.get(workerId) ?? []), item]);
      });

      // 3. 필터링 준비
      const allowedTeamIds = (() => {
        if (!selectedTeamId) return null;
        const selectedTeam = allTeams.find(t => t.id === selectedTeamId);
        const selectedTeamNamePart = normalizeTeamName(selectedTeam?.name);
        const ids = new Set<string>([selectedTeamId]);
        allTeams.forEach(team => {
          if (team.parentTeamId === selectedTeamId) ids.add(team.id!);
          if (selectedTeamNamePart && normalizeTeamName(team.parentTeamName) === selectedTeamNamePart) ids.add(team.id!);
        });
        return ids;
      })();

      // 4. 집계 로직
      type WorkerAggregate = {
        workerId: string;
        companyId: string;
        companyName: string;
        salaryModel: '월급제' | '일급제';
        manDay: number;
        teamId: string;
        teamName: string;
        totalAmount: number;
        laborGrossAmount: number;
        invoiceGrossAmount: number;
        laborManDay: number;
        invoiceManDay: number;
        unitPrices: number[];
        workEntries: WorkerWorkEntry[];
        month: string;
      };

      const workerAggregates: Record<string, WorkerAggregate> = {};
      const ledgerWorkerAggregates: Record<string, WorkerAggregate> = {};

      const mergeAggregate = (bucket: Record<string, WorkerAggregate>, key: string, params: any) => {
        if (!bucket[key]) {
          bucket[key] = {
            workerId: params.workerId,
            companyId: params.companyId,
            companyName: params.companyName,
            salaryModel: params.salaryModel,
            manDay: 0,
            teamId: params.teamId,
            teamName: params.teamName,
            totalAmount: 0,
            laborGrossAmount: 0,
            invoiceGrossAmount: 0,
            laborManDay: 0,
            invoiceManDay: 0,
            unitPrices: [],
            workEntries: [],
            month: params.month,
          };
        }
        const target = bucket[key];
        const entryAmount = params.manDay * params.unitPrice;
        target.manDay += params.manDay;
        target.totalAmount += entryAmount;
        if (params.isLabor) {
          target.laborGrossAmount += entryAmount;
          target.laborManDay += params.manDay;
        } else {
          target.invoiceGrossAmount += entryAmount;
          target.invoiceManDay += params.manDay;
        }
        if (!target.unitPrices.includes(params.unitPrice)) target.unitPrices.push(params.unitPrice);
        target.workEntries.push({
          date: params.reportDate,
          siteId: params.siteId || '',
          siteName: params.siteName,
          clientCompanyId: params.clientCompanyId,
          isLaborSite: params.isLabor,
          manDay: params.manDay,
          unitPrice: params.unitPrice,
          amount: entryAmount,
          paymentMethod: params.paymentMethod
        });
      };

      monthlyReports.forEach(report => {
        const reportYM = (report.date ?? '').slice(0, 7);
        if (!months.includes(reportYM)) return;

        const reportSite = siteMap.get(report.siteId);
        const reportTeamId = report.teamId || allTeams.find(t => normalizeTeamName(t.name) === normalizeTeamName(report.teamName))?.id || '';
        const reportTeamName = report.teamName || teamMap.get(reportTeamId)?.name || '';

        report.workers.forEach(rw => {
          const w = workerMap.get(rw.workerId);
          if (!w) return;
          if (selectedWorkerId && rw.workerId !== selectedWorkerId) return;

          const salaryModel = (rw.salaryModel || rw.payType || w.salaryModel || '').trim();
          const isMonthly = salaryModel === '월급제';
          const isDaily = salaryModel === '일급제';
          if (!isMonthly && !isDaily) return;

          if (selectedTeamId && allowedTeamIds) {
            const wTeamId = (w.teamId ?? '').trim();
            if (!wTeamId || !allowedTeamIds.has(wTeamId)) return;
          }

          const resolvedTeamId = (w.teamId ?? '').trim() || reportTeamId || '';
          const resolvedTeamName = (w.teamName ?? '').trim() || reportTeamName || '';
          const safeTeamKey = resolvedTeamId || (normalizeTeamName(resolvedTeamName) ? `unresolved:${normalizeTeamName(resolvedTeamName)}` : 'no-team');
          const unitPrice = rw.unitPrice ?? w.unitPrice ?? 0;
          const isLabor = reportSite?.paymentMethod === '노무';

          const baseParams = {
            workerId: rw.workerId,
            companyId: w.companyId || teamMap.get(resolvedTeamId)?.companyId || report.companyId || '',
            companyName: w.companyName || teamMap.get(resolvedTeamId)?.companyName || report.companyName || '',
            teamId: safeTeamKey,
            teamName: resolvedTeamName,
            month: reportYM,
            manDay: rw.manDay,
            unitPrice,
            isLabor,
            reportDate: report.date,
            siteName: report.siteName || reportSite?.name || '-',
            siteId: report.siteId,
            clientCompanyId: reportSite?.clientCompanyId || '',
            paymentMethod: reportSite?.paymentMethod || '-'
          };

          const paymentKey = `${reportYM}__${rw.workerId}__${safeTeamKey}__${isDaily ? '일급제' : '월급제'}`;
          mergeAggregate(workerAggregates, paymentKey, { ...baseParams, salaryModel: isDaily ? '일급제' : '월급제' });
          const ledgerKey = `${reportYM}__${rw.workerId}__${safeTeamKey}__${isDaily ? '일급제' : '월급제'}`;
          mergeAggregate(ledgerWorkerAggregates, ledgerKey, { ...baseParams, salaryModel: isDaily ? '일급제' : '월급제' });
        });
      });

      // 5. 최종 가공
      const processedPaymentData: PaymentData[] = [];
      let errs = 0;

      Object.values(workerAggregates).forEach(agg => {
        const w = workerMap.get(agg.workerId);
        if (!w) return;

        const grossAmount = agg.totalAmount;
        const unitPrice = agg.unitPrices.length === 1 ? agg.unitPrices[0] : (agg.manDay > 0 ? Math.round(grossAmount / agg.manDay) : (w.unitPrice || 0));
        
        const bankName = w.bankName || '';
        const bankCode = BANK_CODES[bankName] || '';
        const accountNumber = w.accountNumber || '';
        const accountHolder = w.accountHolder || '';

        const canonicalTeamId = (agg.teamId.startsWith('unresolved:') || agg.teamId === 'no-team') ? (w.teamId ?? '').trim() : agg.teamId;
        const advanceRecords = canonicalTeamId 
          ? (advanceByWorkerTeamKey.get(`${agg.workerId}__${canonicalTeamId}`) || advanceListByWorkerId.get(agg.workerId) || [])
          : (advanceListByWorkerId.get(agg.workerId) || []);

        const deductionBreakdown = buildDeductionBreakdownFromRecords(
          advanceRecords.filter((record) => String(record.yearMonth ?? '') === agg.month)
        );
        const totalDeduction = deductionBreakdown.total;
        const netAmount = grossAmount - totalDeduction;

        const laborProp = grossAmount > 0 ? agg.laborGrossAmount / grossAmount : 0;
        const laborNetAmount = Math.round(netAmount * laborProp);
        const invoiceNetAmount = netAmount - laborNetAmount;

        const validation = validateItem({ bankName, bankCode, accountNumber, accountHolder });
        if (!validation.isValid) errs++;

        processedPaymentData.push({
          id: `${agg.month}__${agg.workerId}__${agg.teamId}__${agg.salaryModel}`,
          workerId: agg.workerId,
          workerName: w.name || '',
          idNumber: w.idNumber || '',
          companyId: agg.companyId,
          companyName: agg.companyName,
          teamId: agg.teamId,
          teamName: agg.teamName,
          month: agg.month,
          totalManDay: agg.manDay,
          unitPrice,
          grossAmount,
          laborGrossAmount: agg.laborGrossAmount,
          invoiceGrossAmount: agg.invoiceGrossAmount,
          laborManDay: agg.laborManDay,
          invoiceManDay: agg.invoiceManDay,
          totalDeduction,
          totalAmount: netAmount,
          laborNetAmount,
          invoiceNetAmount,
          bankName,
          bankCode,
          accountNumber,
          accountHolder,
          displayContent: '월급',
          workEntries: agg.workEntries.sort((a, b) => a.date.localeCompare(b.date)),
          deductionBreakdown,
          taxBreakdown: { standardLines: [], additionalLines: [] },
          taxRateSnapshot: {
            pensionRate: config?.insuranceConfig.pensionRate || 0,
            healthRate: config?.insuranceConfig.healthRate || 0,
            longtermRate: config?.insuranceConfig.careRateOfHealth || 0,
            employmentRate: config?.insuranceConfig.employmentRate || 0,
            incomeTaxRate: config?.insuranceConfig.withholdingIncomeTaxRate || 0,
            residentTaxRate: config?.insuranceConfig.withholdingResidentTaxRate || 0
          },
          isValid: validation.isValid,
          errors: validation.errors
        });
      });

      const processedLedgerRows: MonthlyAdvanceLedgerRow[] = Object.values(ledgerWorkerAggregates).map(agg => {
        const w = workerMap.get(agg.workerId);
        const grossAmount = agg.totalAmount;
        const unitPrice = agg.unitPrices.length === 1 ? agg.unitPrices[0] : (agg.manDay > 0 ? Math.round(grossAmount / agg.manDay) : (w?.unitPrice || 0));

        const canonicalTeamId = (agg.teamId.startsWith('unresolved:') || agg.teamId === 'no-team') ? (w?.teamId ?? '').trim() : agg.teamId;
        const primaryAdvanceRecords = canonicalTeamId
          ? (advanceByWorkerTeamKey.get(`${agg.workerId}__${canonicalTeamId}`) ?? [])
          : [];
        const fallbackAdvanceRecords = advanceListByWorkerId.get(agg.workerId) ?? [];
        const selectedAdvanceRecord = pickPreferredAdvanceRecord(
          primaryAdvanceRecords.length > 0 ? primaryAdvanceRecords : fallbackAdvanceRecords,
          agg.month,
          canonicalTeamId
        );
        const manual = buildManualInputFromAdvanceRecord(selectedAdvanceRecord);

        const rowKey = `${agg.month}__${agg.workerId}__${agg.teamId}__${agg.salaryModel}`;
        return {
          id: rowKey,
          rowKey,
          month: agg.month,
          teamId: agg.teamId,
          teamName: agg.teamName,
          workerId: agg.workerId,
          workerName: w?.name || '',
          salaryModel: agg.salaryModel,
          invoiceManDay: agg.invoiceManDay,
          laborManDay: agg.laborManDay,
          unitPrice,
          invoiceGrossAmount: agg.invoiceGrossAmount,
          laborGrossAmount: agg.laborGrossAmount,
          workEntries: agg.workEntries.sort((a, b) => a.date.localeCompare(b.date)),
          amount: agg.totalAmount,
          date: agg.month,
          type: '월급',
          manual,
        };
      });

      setPaymentData(processedPaymentData);
      setBasePaymentData(processedPaymentData);
      setLedgerRowsData(processedLedgerRows);
      setErrorCount(errs);
      console.log('Data fetched successfully');
    } catch (error) {
      console.error('Error fetching payroll data:', error);
    } finally {
      setLoading(false);
    }
  }, [startMonth, endMonth, selectedTeamId, selectedWorkerId, validateItem]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    loading,
    paymentData,
    basePaymentData,
    setPaymentData,
    ledgerRowsData,
    errorCount,
    refetch: fetchData
  };
};
