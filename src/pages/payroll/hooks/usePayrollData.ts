import { useState, useEffect, useCallback } from 'react';
import { dailyReportService } from '../../../services/dailyReportService';
import { manpowerService, Worker } from '../../../services/manpowerService';
import { siteService, Site } from '../../../services/siteService';
import { teamService, Team } from '../../../services/teamService';
import {
  payrollConfigService,
  DEFAULT_ADVANCE_ITEM_LABELS,
  AdvanceItemLabelsConfig,
} from '../../../services/payrollConfigService';
import { advancePaymentService, AdvancePayment } from '../../../services/advancePaymentService';
import { PaymentData, MonthlyAdvanceLedgerRow, DeductionBreakdown, WorkerWorkEntry, DeductionLine, LedgerManualInput } from '../types/payroll';
import { BANK_CODES, STANDARD_DEDUCTION_FIELDS } from '../constants/payroll.constants';

// Helper: Convert any value to number safely
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

const ITEM_KEY_LABEL_FALLBACKS: Record<string, string> = {
  management: '관리비',
  maintenance: '관리비',
  other: '기타',
  carrySecond: DEFAULT_ADVANCE_ITEM_LABELS.corporateAdvance2,
  currentAdvance: DEFAULT_ADVANCE_ITEM_LABELS.corporateAdvance3,
  currentAdvanceSecond: DEFAULT_ADVANCE_ITEM_LABELS.corporateAdvance4,
  corporateAdvance1: DEFAULT_ADVANCE_ITEM_LABELS.corporateAdvance1,
  corporateAdvance2: DEFAULT_ADVANCE_ITEM_LABELS.corporateAdvance2,
  corporateAdvance3: DEFAULT_ADVANCE_ITEM_LABELS.corporateAdvance3,
  corporateAdvance4: DEFAULT_ADVANCE_ITEM_LABELS.corporateAdvance4,
  laborAdvance1: DEFAULT_ADVANCE_ITEM_LABELS.laborAdvance1,
  laborAdvance2: DEFAULT_ADVANCE_ITEM_LABELS.laborAdvance2,
  laborAdvance3: DEFAULT_ADVANCE_ITEM_LABELS.laborAdvance3,
  laborAdvance4: DEFAULT_ADVANCE_ITEM_LABELS.laborAdvance4,
};

const buildDeductionLabelMap = (
  config: { deductionItems?: Array<{ id?: string; label?: string }>; advanceItemLabels?: Partial<AdvanceItemLabelsConfig> } | null | undefined
): Record<string, string> => {
  const base = STANDARD_DEDUCTION_FIELDS.reduce<Record<string, string>>((acc, { key, label }) => {
    acc[key] = label;
    return acc;
  }, { ...ITEM_KEY_LABEL_FALLBACKS });

  (config?.deductionItems ?? []).forEach((item) => {
    const safeId = String(item?.id ?? '').trim();
    if (!safeId) return;
    const safeLabel = String(item?.label ?? '').trim();
    base[safeId] = safeLabel || safeId;
  });

  const advanceLabels = {
    ...DEFAULT_ADVANCE_ITEM_LABELS,
    ...(config?.advanceItemLabels ?? {}),
  };

  base.corporateAdvance1 = String(advanceLabels.corporateAdvance1 ?? '').trim() || DEFAULT_ADVANCE_ITEM_LABELS.corporateAdvance1;
  base.corporateAdvance2 = String(advanceLabels.corporateAdvance2 ?? '').trim() || DEFAULT_ADVANCE_ITEM_LABELS.corporateAdvance2;
  base.corporateAdvance3 = String(advanceLabels.corporateAdvance3 ?? '').trim() || DEFAULT_ADVANCE_ITEM_LABELS.corporateAdvance3;
  base.corporateAdvance4 = String(advanceLabels.corporateAdvance4 ?? '').trim() || DEFAULT_ADVANCE_ITEM_LABELS.corporateAdvance4;
  base.laborAdvance1 = String(advanceLabels.laborAdvance1 ?? '').trim() || DEFAULT_ADVANCE_ITEM_LABELS.laborAdvance1;
  base.laborAdvance2 = String(advanceLabels.laborAdvance2 ?? '').trim() || DEFAULT_ADVANCE_ITEM_LABELS.laborAdvance2;
  base.laborAdvance3 = String(advanceLabels.laborAdvance3 ?? '').trim() || DEFAULT_ADVANCE_ITEM_LABELS.laborAdvance3;
  base.laborAdvance4 = String(advanceLabels.laborAdvance4 ?? '').trim() || DEFAULT_ADVANCE_ITEM_LABELS.laborAdvance4;

  return base;
};

const pickPreferredAdvanceRecord = (
  records: AdvancePayment[],
  yearMonth: string,
  options: {
    preferredTeamId?: string;
    preferredTeamName?: string;
  } = {}
): AdvancePayment | undefined => {
  const monthMatched = records.filter((record) => String(record.yearMonth ?? '') === yearMonth);
  if (monthMatched.length === 0) return undefined;

  const preferredTeamId = String(options.preferredTeamId ?? '').trim();
  const preferredTeamNameKey = normalizeTeamName(options.preferredTeamName);

  const exactTeamIdMatched = preferredTeamId
    ? monthMatched.filter((record) => String(record.teamId ?? '').trim() === preferredTeamId)
    : [];

  const teamNameMatched = preferredTeamNameKey
    ? monthMatched.filter((record) => normalizeTeamName(record.teamName) === preferredTeamNameKey)
    : [];

  const getRecordValueScore = (record: AdvancePayment): number => {
    const standardTotal = STANDARD_DEDUCTION_FIELDS.reduce(
      (sum, { key }) => sum + toNumber((record as any)[key]),
      0
    );
    const itemsTotal = Object.values(record.items ?? {}).reduce((sum, value) => sum + toNumber(value), 0);
    return standardTotal + itemsTotal;
  };

  const candidates =
    exactTeamIdMatched.length > 0
      ? exactTeamIdMatched
      : (teamNameMatched.length > 0 ? teamNameMatched : monthMatched);

  const getPreferenceRank = (record: AdvancePayment): number => {
    const recordTeamId = String(record.teamId ?? '').trim();
    const recordTeamNameKey = normalizeTeamName(record.teamName);
    if (preferredTeamId && recordTeamId === preferredTeamId) return 3;
    if (preferredTeamNameKey && recordTeamNameKey === preferredTeamNameKey) return 2;
    return 1;
  };

  return candidates.reduce<AdvancePayment | undefined>((best, current) => {
    if (!best) return current;

    const bestPreferenceRank = getPreferenceRank(best);
    const currentPreferenceRank = getPreferenceRank(current);
    if (currentPreferenceRank !== bestPreferenceRank) {
      return currentPreferenceRank > bestPreferenceRank ? current : best;
    }

    const bestScore = getRecordValueScore(best);
    const currentScore = getRecordValueScore(current);
    const bestHasValue = bestScore > 0;
    const currentHasValue = currentScore > 0;
    if (currentHasValue !== bestHasValue) return currentHasValue ? current : best;
    if (currentScore !== bestScore) return currentScore > bestScore ? current : best;

    const bestTs = best.updatedAt instanceof Date ? best.updatedAt.getTime() : 0;
    const currentTs = current.updatedAt instanceof Date ? current.updatedAt.getTime() : 0;
    if (currentTs !== bestTs) return currentTs > bestTs ? current : best;

    return best;
  }, undefined);
};

const buildManualInputFromAdvanceRecord = (record?: AdvancePayment): LedgerManualInput | undefined => {
  if (!record) return undefined;

  const corporateAdvance1 = record.items?.corporateAdvance1;
  const corporateAdvance2 = record.items?.corporateAdvance2;
  const corporateAdvance3 = record.items?.corporateAdvance3;
  const corporateAdvance4 = record.items?.corporateAdvance4;
  const laborAdvance1 = record.items?.laborAdvance1;
  const laborAdvance2 = record.items?.laborAdvance2;
  const laborAdvance3 = record.items?.laborAdvance3;
  const laborAdvance4 = record.items?.laborAdvance4;
  const normalizedItemAssignments = Object.entries(record.itemAssignments ?? {}).reduce<Record<string, 'corporate' | 'labor'>>((acc, [key, value]) => {
    const normalizedKey =
      key === 'accommodation' ? 'lodging'
        : key === 'maintenance' ? 'management'
          : key === 'fines' ? 'fine'
            : key;
    if (!normalizedKey) return acc;
    acc[normalizedKey] = value;
    return acc;
  }, {});

  return {
    invoice: {
      ...createEmptyLedgerSideInput(),
      carry: toNumber(corporateAdvance1),
      carrySecond: toNumber(corporateAdvance2 ?? record.items?.carrySecond),
      currentAdvance: toNumber(corporateAdvance3 ?? record.items?.currentAdvance),
      currentAdvanceSecond: toNumber(corporateAdvance4 ?? record.items?.currentAdvanceSecond),
      lodging: toNumber(record.accommodation),
      electricity: toNumber(record.electricity),
      gas: toNumber(record.gas),
      water: toNumber(record.water),
    },
    labor: {
      ...createEmptyLedgerSideInput(),
      carry: toNumber(laborAdvance1),
      carrySecond: toNumber(laborAdvance2),
      currentAdvance: toNumber(laborAdvance3),
      currentAdvanceSecond: toNumber(laborAdvance4),
      internet: toNumber(record.internet),
      management: toNumber(record.items?.management ?? record.items?.maintenance),
      fine: toNumber(record.fines),
      other: toNumber(record.items?.other),
    },
    personalMemo: String(record.memo ?? ''),
    assignmentType: (record.assignmentType === 'corporate' ? 'corporate' : 'labor'),
    itemAssignments: normalizedItemAssignments,
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
      const deductionLabelMap = buildDeductionLabelMap(config);

      const workerMap = new Map<string, Worker>();
      const workerCanonicalIdByAnyId = new Map<string, string>();
      allWorkers.forEach((w) => {
        const workerId = String(w.id ?? '').trim();
        const legacyId = String(w.legacyId ?? '').trim();
        const canonicalWorkerId = workerId || legacyId;
        if (!canonicalWorkerId) return;

        workerMap.set(canonicalWorkerId, w);
        if (workerId) {
          workerMap.set(workerId, w);
          workerCanonicalIdByAnyId.set(workerId, canonicalWorkerId);
        }
        if (legacyId) {
          workerMap.set(legacyId, w);
          workerCanonicalIdByAnyId.set(legacyId, canonicalWorkerId);
        }
      });

      const siteMap = new Map<string, Site>();
      allSites.forEach(s => {
        const id = (s.id ?? '').trim();
        if (id) siteMap.set(id, s);
        const legacyId = (s.legacyId ?? '').trim();
        if (legacyId && !siteMap.has(legacyId)) siteMap.set(legacyId, s);
      });

      const teamMap = new Map<string, Team>();
      const teamCanonicalIdByAnyId = new Map<string, string>();
      allTeams.forEach((t) => {
        const teamId = String(t.id ?? '').trim();
        const legacyId = String(t.legacyId ?? '').trim();
        const canonicalTeamId = teamId || legacyId;
        if (!canonicalTeamId) return;

        teamMap.set(canonicalTeamId, t);
        if (teamId) {
          teamMap.set(teamId, t);
          teamCanonicalIdByAnyId.set(teamId, canonicalTeamId);
        }
        if (legacyId) {
          teamMap.set(legacyId, t);
          teamCanonicalIdByAnyId.set(legacyId, canonicalTeamId);
        }
      });

      const resolveWorkerCanonicalId = (rawId: string | undefined | null): string => {
        const safe = String(rawId ?? '').trim();
        if (!safe) return '';
        return workerCanonicalIdByAnyId.get(safe) ?? safe;
      };

      const resolveTeamCanonicalId = (rawId: string | undefined | null): string => {
        const safe = String(rawId ?? '').trim();
        if (!safe) return '';
        return teamCanonicalIdByAnyId.get(safe) ?? safe;
      };

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
      const advanceByWorkerTeamNameKey = new Map<string, AdvancePayment[]>();
      const advanceListByWorkerId = new Map<string, AdvancePayment[]>();
      advances.forEach((item) => {
          const rawWorkerId = String(item.workerId ?? '').trim();

          const workerId = resolveWorkerCanonicalId(item.workerId);
          const teamId = resolveTeamCanonicalId(item.teamId);
          if (!workerId) {
            return;
          }
        const normalizedItem =
          workerId === String(item.workerId ?? '').trim() && teamId === String(item.teamId ?? '').trim()
            ? item
            : { ...item, workerId, teamId };
        if (teamId) {
          const key = `${workerId}__${teamId}`;
          advanceByWorkerTeamKey.set(key, [...(advanceByWorkerTeamKey.get(key) ?? []), normalizedItem]);
        }
        const normalizedTeamNameKey = normalizeTeamName(normalizedItem.teamName || teamMap.get(teamId)?.name);
        if (normalizedTeamNameKey) {
          const nameKey = `${workerId}__${normalizedTeamNameKey}`;
          advanceByWorkerTeamNameKey.set(nameKey, [...(advanceByWorkerTeamNameKey.get(nameKey) ?? []), normalizedItem]);
        }
        advanceListByWorkerId.set(workerId, [...(advanceListByWorkerId.get(workerId) ?? []), normalizedItem]);
      });

      const getAdvanceCandidates = (params: {
        workerId: string;
        teamId?: string;
        teamName?: string;
      }): AdvancePayment[] => {
        const safeWorkerId = String(params.workerId ?? '').trim();
        if (!safeWorkerId) return [];

        const collected: AdvancePayment[] = [];
        const seen = new Set<string>();
        const pushUnique = (items: AdvancePayment[]) => {
          items.forEach((item) => {
            const key = String(item.id ?? `${item.teamId ?? ''}__${item.workerId ?? ''}__${item.yearMonth ?? ''}`).trim();
            if (seen.has(key)) return;
            seen.add(key);
            collected.push(item);
          });
        };

        const safeTeamId = String(params.teamId ?? '').trim();
        if (safeTeamId) {
          pushUnique(advanceByWorkerTeamKey.get(`${safeWorkerId}__${safeTeamId}`) ?? []);
        }

        const normalizedTeamNameKey = normalizeTeamName(params.teamName);
        if (normalizedTeamNameKey) {
          pushUnique(advanceByWorkerTeamNameKey.get(`${safeWorkerId}__${normalizedTeamNameKey}`) ?? []);
        }

        pushUnique(advanceListByWorkerId.get(safeWorkerId) ?? []);
        return collected;
      };

      // 3. 필터링 준비
      const allowedTeamIds = (() => {
        if (!selectedTeamId) return null;
        const canonicalSelectedTeamId = resolveTeamCanonicalId(selectedTeamId);
        const selectedTeam = allTeams.find((t) => resolveTeamCanonicalId(t.id) === canonicalSelectedTeamId);
        const selectedTeamNamePart = normalizeTeamName(selectedTeam?.name);
        const ids = new Set<string>(canonicalSelectedTeamId ? [canonicalSelectedTeamId] : []);
        allTeams.forEach(team => {
          const canonicalTeamId = resolveTeamCanonicalId(team.id);
          const canonicalParentTeamId = resolveTeamCanonicalId(team.parentTeamId);
          if (canonicalTeamId && canonicalParentTeamId === canonicalSelectedTeamId) ids.add(canonicalTeamId);
          if (canonicalTeamId && selectedTeamNamePart && normalizeTeamName(team.parentTeamName) === selectedTeamNamePart) {
            ids.add(canonicalTeamId);
          }
        });
        return ids;
      })();

      // 4. 집계 로직
      type WorkerAggregate = {
        workerId: string;
        companyId: string;
        companyName: string;
        salaryModel: '월급제' | '일급제' | '용역팀';
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

        const reportSite = siteMap.get(String(report.siteId ?? '').trim());
        const reportTeamId = resolveTeamCanonicalId(report.teamId)
          || resolveTeamCanonicalId(allTeams.find(t => normalizeTeamName(t.name) === normalizeTeamName(report.teamName))?.id)
          || '';
        const reportTeamName = report.teamName || teamMap.get(reportTeamId)?.name || '';

        report.workers.forEach(rw => {
          const canonicalWorkerId = resolveWorkerCanonicalId(rw.workerId);
          const w = workerMap.get(canonicalWorkerId) ?? workerMap.get(String(rw.workerId ?? '').trim());
          if (!w) return;
          if (selectedWorkerId && canonicalWorkerId !== resolveWorkerCanonicalId(selectedWorkerId)) return;

          const salaryModel = (rw.salaryModel || rw.payType || w.salaryModel || '').trim();
          const isMonthly = salaryModel === '월급제';
          const isDaily = salaryModel === '일급제';
          const isService = salaryModel === '용역팀';
          if (!isMonthly && !isDaily && !isService) return;

          const workerTeamId = resolveTeamCanonicalId(w.teamId);
          const resolvedTeamId = reportTeamId || workerTeamId || '';
          const resolvedTeamName =
            reportTeamName
            || (teamMap.get(resolvedTeamId)?.name ?? '').trim()
            || (w.teamName ?? '').trim()
            || '';

          if (selectedTeamId && allowedTeamIds) {
            if (!resolvedTeamId || !allowedTeamIds.has(resolvedTeamId)) return;
          }
          const safeTeamKey = resolvedTeamId || (normalizeTeamName(resolvedTeamName) ? `unresolved:${normalizeTeamName(resolvedTeamName)}` : 'no-team');
          const unitPrice = rw.unitPrice ?? w.unitPrice ?? 0;
          const isLabor = reportSite?.paymentMethod === '노무';

          const baseParams = {
            workerId: canonicalWorkerId || String(rw.workerId ?? '').trim(),
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

          const resolvedModel = isDaily ? '일급제' : isService ? '용역팀' : '월급제';
          const paymentKey = `${reportYM}__${baseParams.workerId}__${safeTeamKey}__${resolvedModel}`;
          mergeAggregate(workerAggregates, paymentKey, { ...baseParams, salaryModel: resolvedModel });
          const ledgerKey = `${reportYM}__${baseParams.workerId}__${safeTeamKey}__${resolvedModel}`;
          mergeAggregate(ledgerWorkerAggregates, ledgerKey, { ...baseParams, salaryModel: resolvedModel });
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

        const canonicalTeamId =
          agg.teamId.startsWith('unresolved:') || agg.teamId === 'no-team'
            ? ''
            : resolveTeamCanonicalId(agg.teamId);
        const advanceCandidates = getAdvanceCandidates({
          workerId: agg.workerId,
          teamId: canonicalTeamId,
          teamName: agg.teamName || w?.teamName,
        });
        const selectedAdvanceRecord = pickPreferredAdvanceRecord(
          advanceCandidates,
          agg.month,
          {
            preferredTeamId: canonicalTeamId,
            preferredTeamName: agg.teamName || w?.teamName,
          }
        );

        const deductionBreakdown = selectedAdvanceRecord
          ? buildDeductionBreakdownFromRecords([selectedAdvanceRecord], deductionLabelMap)
          : createEmptyDeductionBreakdown();
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
          taxBreakdown: createEmptyDeductionBreakdown(),
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

        const canonicalTeamId =
          agg.teamId.startsWith('unresolved:') || agg.teamId === 'no-team'
            ? ''
            : resolveTeamCanonicalId(agg.teamId);
        const advanceCandidates = getAdvanceCandidates({
          workerId: agg.workerId,
          teamId: canonicalTeamId,
          teamName: agg.teamName || w?.teamName,
        });
        const selectedAdvanceRecord = pickPreferredAdvanceRecord(
          advanceCandidates,
          agg.month,
          {
            preferredTeamId: canonicalTeamId,
            preferredTeamName: agg.teamName || w?.teamName,
          }
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
          assignmentType: selectedAdvanceRecord?.assignmentType ?? manual?.assignmentType ?? 'labor',
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
