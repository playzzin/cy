import { serviceReferralSettlementRepository } from '../repositories/serviceReferralSettlementRepository';
import { serviceWorkerReferralRepository } from '../repositories/serviceWorkerReferralRepository';
import { dailyReportService, DailyReportWorkerRow } from './dailyReportService';
import { manpowerService, Worker } from './manpowerService';
import {
  RecruitingDashboardSummary,
  RecruitingMonthlyStatistics,
  ServiceReferralDailyLine,
  ServiceReferralMonthlySettlement,
  ServiceWorkerReferral,
} from '../types/recruiting';
import {
  isActiveRecruitingWorker,
  isServiceTeamWorker,
  resolveRecruitingWorkerId,
  serviceWorkerReferralService,
} from './serviceWorkerReferralService';
import { serviceWorkerHistoryService } from './serviceWorkerHistoryService';
import { serviceReferralPaymentService } from './serviceReferralPaymentService';
import { toast } from '../utils/swal';

const toText = (value: unknown): string => String(value ?? '').trim();
const toNumber = (value: unknown): number => {
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
};

const normalizeDate = (value: unknown): string => {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  const maybeDate = value as { toDate?: () => Date; seconds?: number };
  if (typeof maybeDate.toDate === 'function') return maybeDate.toDate().toISOString().slice(0, 10);
  if (typeof maybeDate.seconds === 'number') return new Date(maybeDate.seconds * 1000).toISOString().slice(0, 10);
  return '';
};

const getTodayString = (): string => new Date().toISOString().slice(0, 10);

const getCurrentYearMonth = (): string => new Date().toISOString().slice(0, 7);

const getMonthRange = (yearMonth: string): { startDate: string; endDate: string } => {
  const [yearRaw, monthRaw] = yearMonth.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    startDate: `${yearMonth}-01`,
    endDate: `${yearMonth}-${String(lastDay).padStart(2, '0')}`,
  };
};

const addMonths = (yearMonth: string, delta: number): string => {
  const [yearRaw, monthRaw] = yearMonth.split('-');
  const next = new Date(Date.UTC(Number(yearRaw), Number(monthRaw) - 1 + delta, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`;
};

const buildDailyLineId = (yearMonth: string, referralId: string, workerId: string, date: string): string =>
  `${yearMonth}__${referralId}__${workerId}__${date}`.replace(/[^\w가-힣.-]+/g, '_');

const buildSettlementId = (yearMonth: string, referrerId: string): string =>
  `${yearMonth}__${referrerId}`.replace(/[^\w가-힣.-]+/g, '_');

const unique = <T,>(values: T[]): T[] => Array.from(new Set(values.filter(Boolean)));

const isPositiveWorkRow = (row: DailyReportWorkerRow): boolean =>
  !row.isEmptyReport && toNumber(row.manDay) > 0 && row.status !== 'absent';

const getWorkerAliasKeys = (worker: Partial<Worker> | null | undefined): string[] =>
  unique([toText(worker?.id), toText(worker?.legacyId), toText(worker?.name)]);

const getReferralAliasKeys = (referral: ServiceWorkerReferral, worker?: Partial<Worker> | null): string[] =>
  unique([referral.workerId, referral.workerName, ...getWorkerAliasKeys(worker)].map(toText));

const getWorkerStopInfo = (worker: Partial<Worker> | null | undefined): { stopDate: string; reason: string } | null => {
  if (!worker) return { stopDate: getTodayString(), reason: '작업자 DB 없음' };
  if (!isActiveRecruitingWorker(worker)) {
    return {
      stopDate: normalizeDate(worker.updatedAt) || getTodayString(),
      reason: `상태 변경: ${toText(worker.status) || '비활성'}`,
    };
  }
  if (!isServiceTeamWorker(worker)) {
    return {
      stopDate: normalizeDate(worker.updatedAt) || getTodayString(),
      reason: '팀/급여구분 변경',
    };
  }
  return null;
};

const getReferralManualStop = (referral: ServiceWorkerReferral): { stopDate: string; reason: string } | null => {
  if (referral.stopDate) {
    return { stopDate: referral.stopDate, reason: referral.stopReason || '수동 중지' };
  }
  if (referral.status === 'paused') return { stopDate: getTodayString(), reason: '정산 일시중지' };
  if (referral.status === 'stopped' || referral.status === 'closed') {
    return { stopDate: referral.stopDate || getTodayString(), reason: referral.stopReason || '정산 중지' };
  }
  return null;
};

type GroupedWorkDate = {
  date: string;
  rows: DailyReportWorkerRow[];
  manDay: number;
  siteNames: string[];
  reportIds: string[];
  reportWorkerIndexes: number[];
  teamId?: string;
  teamName?: string;
};

const groupWorkRowsByDate = (rows: DailyReportWorkerRow[]): GroupedWorkDate[] => {
  const grouped = new Map<string, GroupedWorkDate>();
  rows.filter(isPositiveWorkRow).forEach((row) => {
    const date = toText(row.date);
    if (!date) return;
    const current = grouped.get(date) || {
      date,
      rows: [],
      manDay: 0,
      siteNames: [],
      reportIds: [],
      reportWorkerIndexes: [],
      teamId: row.workerTeamId || row.teamId,
      teamName: row.workerTeamName || row.teamName,
    };
    current.rows.push(row);
    current.manDay += toNumber(row.manDay);
    current.siteNames = unique([...current.siteNames, toText(row.siteName)]);
    current.reportIds = unique([...current.reportIds, toText(row.reportId)]);
    if (typeof row.workerIndex === 'number') current.reportWorkerIndexes.push(row.workerIndex);
    grouped.set(date, current);
  });
  return Array.from(grouped.values()).sort((left, right) => left.date.localeCompare(right.date));
};

const buildSourceSnapshot = (workDate: GroupedWorkDate): Record<string, unknown> => ({
  reportIds: workDate.reportIds,
  siteNames: workDate.siteNames,
  manDay: workDate.manDay,
  rowCount: workDate.rows.length,
});

const isCurrencyHeader = (header: string): boolean =>
  /금액|수입|지급|수수료|순수익|비용|조정|청구|합계|payable|profit|income|payout|commission|amount|cost/i.test(header);

const isDateHeader = (header: string): boolean =>
  /날짜|일자|date|at$/i.test(header);

const shouldTotalHeader = (header: string): boolean =>
  !/상태|사유|메모|비고|률|rate|status|reason|memo/i.test(header);

const exportWorkbook = async (fileName: string, sheets: Array<{ name: string; rows: Record<string, unknown>[] }>) => {
  const XLSX = await import('xlsx-js-style');
  const workbook = XLSX.utils.book_new();
  sheets.forEach((sheet) => {
    const worksheet = XLSX.utils.json_to_sheet(sheet.rows.length ? sheet.rows : [{ 내용: '데이터 없음' }]);
    const range = worksheet['!ref'] ? XLSX.utils.decode_range(worksheet['!ref']) : null;

    if (range) {
      const headers: string[] = [];
      for (let columnIndex = range.s.c; columnIndex <= range.e.c; columnIndex += 1) {
        const headerCell = worksheet[XLSX.utils.encode_cell({ r: range.s.r, c: columnIndex })];
        headers[columnIndex] = String(headerCell?.v ?? '');
      }

      for (let rowIndex = range.s.r + 1; rowIndex <= range.e.r; rowIndex += 1) {
        for (let columnIndex = range.s.c; columnIndex <= range.e.c; columnIndex += 1) {
          const address = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
          const cell = worksheet[address];
          if (!cell) continue;
          const header = headers[columnIndex] || '';
          if (cell.t === 'n') {
            cell.z = isCurrencyHeader(header) ? '#,##0"원"' : '#,##0.##';
          } else if (cell.t === 's' && isDateHeader(header) && /^\d{4}-\d{2}-\d{2}/.test(String(cell.v))) {
            cell.z = 'yyyy-mm-dd';
          }
        }
      }

      if (sheet.rows.length > 0) {
        const totalRowIndex = range.e.r + 1;
        const firstCell = XLSX.utils.encode_cell({ r: totalRowIndex, c: range.s.c });
        worksheet[firstCell] = {
          t: 's',
          v: '합계',
          s: { font: { bold: true }, fill: { fgColor: { rgb: 'EEF2FF' } } },
        };

        for (let columnIndex = range.s.c + 1; columnIndex <= range.e.c; columnIndex += 1) {
          const header = headers[columnIndex] || '';
          if (!shouldTotalHeader(header)) continue;
          const hasNumericValue = sheet.rows.some((row) => typeof row[header] === 'number' && Number.isFinite(row[header] as number));
          if (!hasNumericValue) continue;
          const columnLetter = XLSX.utils.encode_col(columnIndex);
          const address = XLSX.utils.encode_cell({ r: totalRowIndex, c: columnIndex });
          worksheet[address] = {
            t: 'n',
            f: `SUM(${columnLetter}${range.s.r + 2}:${columnLetter}${range.e.r + 1})`,
            z: isCurrencyHeader(header) ? '#,##0"원"' : '#,##0.##',
            s: { font: { bold: true }, fill: { fgColor: { rgb: 'EEF2FF' } } },
          };
        }

        worksheet['!ref'] = XLSX.utils.encode_range({
          s: range.s,
          e: { r: totalRowIndex, c: range.e.c },
        });
      }

      worksheet['!cols'] = headers.map((header) => ({
        wch: Math.min(Math.max(header.length + 6, 12), 28),
      }));
    }

    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name.slice(0, 31));
  });
  XLSX.writeFile(workbook, fileName);
};

export const serviceReferralSettlementService = {
  listServiceWorkerCandidates: serviceWorkerReferralService.listServiceWorkerCandidates.bind(serviceWorkerReferralService),
  createReferral: serviceWorkerReferralService.createReferral.bind(serviceWorkerReferralService),
  updateReferral: serviceWorkerReferralService.updateReferral.bind(serviceWorkerReferralService),
  stopReferral: serviceWorkerReferralService.stopReferral.bind(serviceWorkerReferralService),

  async syncDailyLines(yearMonth: string = getCurrentYearMonth()): Promise<ServiceReferralDailyLine[]> {
    const { startDate: monthStart, endDate: monthEnd } = getMonthRange(yearMonth);
    const [settings, referrals, workers] = await Promise.all([
      serviceWorkerReferralService.getSettings(),
      serviceWorkerReferralRepository.listReferrals(),
      manpowerService.getWorkers(true),
    ]);

    const workerByAlias = new Map<string, Worker>();
    workers.forEach((worker) => {
      getWorkerAliasKeys(worker).forEach((key) => workerByAlias.set(key, worker));
    });

    const eligibleReferrals = referrals.filter((referral) => {
      if (!referral.id) return false;
      if (referral.startDate > monthEnd) return false;
      if (referral.stopDate && referral.stopDate < monthStart) return false;
      if (referral.status === 'closed' && (!referral.stopDate || referral.stopDate < monthStart)) return false;
      return true;
    });

    if (eligibleReferrals.length === 0) return [];

    const minStartDate = eligibleReferrals
      .map((referral) => referral.startDate || monthStart)
      .sort((left, right) => left.localeCompare(right))[0] || monthStart;
    const sourceRows = await dailyReportService.getWorkerRows({ startDate: minStartDate, endDate: monthEnd });

    const rowsByReferralId = new Map<string, DailyReportWorkerRow[]>();
    const referralByAlias = new Map<string, ServiceWorkerReferral>();
    eligibleReferrals.forEach((referral) => {
      const worker = workerByAlias.get(referral.workerId) || workerByAlias.get(referral.workerName);
      getReferralAliasKeys(referral, worker).forEach((key) => referralByAlias.set(key, referral));
    });

    sourceRows.forEach((row) => {
      const referral = referralByAlias.get(toText(row.workerId)) || referralByAlias.get(toText(row.workerName));
      if (!referral?.id) return;
      const list = rowsByReferralId.get(referral.id) || [];
      list.push(row);
      rowsByReferralId.set(referral.id, list);
    });

    const nextLines: ServiceReferralDailyLine[] = [];

    eligibleReferrals.forEach((referral) => {
      const referralId = referral.id;
      if (!referralId) return;
      const worker = workerByAlias.get(referral.workerId) || workerByAlias.get(referral.workerName) || null;
      const workerStop = getWorkerStopInfo(worker);
      const manualStop = getReferralManualStop(referral);
      const stopCandidates = [workerStop, manualStop].filter((item): item is { stopDate: string; reason: string } => Boolean(item?.stopDate));
      const effectiveStop = stopCandidates.sort((left, right) => left.stopDate.localeCompare(right.stopDate))[0] || null;

      const groupedWorkDates = groupWorkRowsByDate(rowsByReferralId.get(referralId) || [])
        .filter((workDate) => workDate.date >= referral.startDate)
        .filter((workDate) => !effectiveStop || workDate.date <= effectiveStop.stopDate);

      const totalRecognizedDays = groupedWorkDates.length;
      const lineStatus = totalRecognizedDays >= settings.confirmAfterWorkDays ? 'confirmed' : 'pending';

      groupedWorkDates
        .filter((workDate) => workDate.date >= monthStart && workDate.date <= monthEnd)
        .forEach((workDate) => {
          const introDayIndex = groupedWorkDates.findIndex((item) => item.date === workDate.date) + 1;
          const isIntroFeeDay = introDayIndex > 0 && introDayIndex <= referral.introFeeMaxDays;
          const workerId = toText(worker?.id) || referral.workerId;
          nextLines.push({
            id: buildDailyLineId(yearMonth, referralId, workerId, workDate.date),
            yearMonth,
            date: workDate.date,
            referralId,
            referrerId: referral.referrerId,
            referrerName: referral.referrerName,
            workerId,
            workerName: toText(worker?.name) || referral.workerName,
            teamId: workDate.teamId || toText(worker?.teamId),
            teamName: workDate.teamName || toText(worker?.teamName) || referral.workerTeamName,
            siteNames: workDate.siteNames,
            reportIds: workDate.reportIds,
            reportWorkerIndexes: workDate.reportWorkerIndexes,
            manDay: workDate.manDay,
            workdayCounted: true,
            introDayIndex,
            introIncomeAmount: isIntroFeeDay ? referral.introFeeIncomePerDay : 0,
            introPayoutAmount: isIntroFeeDay ? referral.introFeePayoutPerDay : 0,
            dailyCommissionAmount: referral.dailyCommissionPerDay,
            status: lineStatus,
            sourceSnapshot: buildSourceSnapshot(workDate),
          });
        });
    });

    const existingLines = await serviceWorkerReferralRepository.listDailyLinesByMonth(yearMonth);
    const existingById = new Map(existingLines.map((line) => [line.id || '', line]));
    const payableLines = nextLines.map((line): ServiceReferralDailyLine => {
      const existing = existingById.get(line.id || '');
      if (existing?.status !== 'overridden') return line;

      return {
        ...line,
        introIncomeAmount: toNumber(existing.introIncomeAmount),
        introPayoutAmount: toNumber(existing.introPayoutAmount),
        dailyCommissionAmount: toNumber(existing.dailyCommissionAmount),
        status: 'overridden',
        overrideReason: existing.overrideReason || '수동 수정',
        createdAt: existing.createdAt,
      };
    });
    const nextIds = new Set(payableLines.map((line) => line.id).filter(Boolean));
    const excludedLines = existingLines
      .filter((line) => line.id && !nextIds.has(line.id) && line.status !== 'overridden')
      .map((line): ServiceReferralDailyLine => ({
        ...line,
        introIncomeAmount: 0,
        introPayoutAmount: 0,
        dailyCommissionAmount: 0,
        workdayCounted: false,
        status: 'excluded',
        excludedReason: '출력일보 또는 정산 조건 변경',
      }));

    await serviceWorkerReferralRepository.saveDailyLines([...payableLines, ...excludedLines]);
    return serviceWorkerReferralRepository.listDailyLinesByMonth(yearMonth);
  },

  async overrideDailyLine(params: {
    lineId: string;
    introIncomeAmount?: number;
    introPayoutAmount?: number;
    dailyCommissionAmount?: number;
    reason: string;
  }): Promise<void> {
    const updates: Partial<ServiceReferralDailyLine> = {
      status: 'overridden',
      overrideReason: params.reason,
    };
    if (params.introIncomeAmount !== undefined) updates.introIncomeAmount = Number(params.introIncomeAmount || 0);
    if (params.introPayoutAmount !== undefined) updates.introPayoutAmount = Number(params.introPayoutAmount || 0);
    if (params.dailyCommissionAmount !== undefined) updates.dailyCommissionAmount = Number(params.dailyCommissionAmount || 0);
    await serviceWorkerReferralRepository.updateDailyLine(params.lineId, updates);
    toast.updated('정산 라인');
  },

  async calculateMonthlySettlement(yearMonth: string = getCurrentYearMonth()): Promise<ServiceReferralMonthlySettlement[]> {
    const lines = await this.syncDailyLines(yearMonth);
    const [existingSettlements, referrals] = await Promise.all([
      serviceReferralSettlementRepository.listByMonth(yearMonth),
      serviceWorkerReferralRepository.listReferrals(),
    ]);
    const existingByReferrer = new Map(existingSettlements.map((settlement) => [settlement.referrerId, settlement]));
    const referralById = new Map(referrals.map((referral) => [referral.id || '', referral]));
    const payableLines = lines.filter((line) => line.status !== 'excluded');
    const financialLines = (referrerLines: ServiceReferralDailyLine[]) =>
      referrerLines.filter((line) => line.status === 'confirmed' || line.status === 'overridden');
    const grouped = new Map<string, ServiceReferralDailyLine[]>();
    payableLines.forEach((line) => {
      const list = grouped.get(line.referrerId) || [];
      list.push(line);
      grouped.set(line.referrerId, list);
    });

    const settlements: ServiceReferralMonthlySettlement[] = Array.from(grouped.entries()).map(([referrerId, referrerLines]) => {
      const firstLine = referrerLines[0];
      const existing = existingByReferrer.get(referrerId);
      const relatedReferral = referralById.get(firstLine.referralId);
      const confirmedLines = financialLines(referrerLines);
      const introIncomeTotal = confirmedLines.reduce((sum, line) => sum + toNumber(line.introIncomeAmount), 0);
      const introPayoutTotal = confirmedLines.reduce((sum, line) => sum + toNumber(line.introPayoutAmount), 0);
      const dailyCommissionTotal = confirmedLines.reduce((sum, line) => sum + toNumber(line.dailyCommissionAmount), 0);
      const adjustmentAmount = toNumber(existing?.adjustmentAmount);
      const status = existing?.status && existing.status !== 'draft' ? existing.status : 'draft';

      return {
        id: buildSettlementId(yearMonth, referrerId),
        yearMonth,
        referrerId,
        referrerName: existing?.referrerName || firstLine.referrerName,
        referrerType: existing?.referrerType || relatedReferral?.referrerType || 'external',
        totalWorkers: unique(referrerLines.map((line) => line.workerId)).length,
        totalWorkDays: unique(referrerLines.map((line) => `${line.workerId}:${line.date}`)).length,
        introIncomeTotal,
        introPayoutTotal,
        dailyCommissionTotal,
        adjustmentAmount,
        payableTotal: introPayoutTotal + dailyCommissionTotal + adjustmentAmount,
        netProfit: introIncomeTotal - introPayoutTotal - dailyCommissionTotal - adjustmentAmount,
        pendingLineCount: referrerLines.filter((line) => line.status === 'pending').length,
        confirmedLineCount: referrerLines.filter((line) => line.status === 'confirmed' || line.status === 'overridden').length,
        paidLineCount: existing?.paidLineCount || 0,
        status,
        memo: existing?.memo || '',
        confirmedAt: existing?.confirmedAt || null,
        paidAt: existing?.paidAt || null,
        createdBy: existing?.createdBy || '',
        updatedBy: existing?.updatedBy || '',
        createdAt: existing?.createdAt,
      };
    });

    await serviceReferralSettlementRepository.saveMany(settlements);
    return serviceReferralSettlementRepository.listByMonth(yearMonth);
  },

  async updateMonthlySettlement(
    settlementId: string,
    updates: Partial<ServiceReferralMonthlySettlement>
  ): Promise<void> {
    await serviceReferralSettlementRepository.update(settlementId, updates);
    toast.updated('월별 정산');
  },

  async getMonthlySettlement(yearMonth: string = getCurrentYearMonth()): Promise<{
    settlements: ServiceReferralMonthlySettlement[];
    lines: ServiceReferralDailyLine[];
  }> {
    const [settlements, lines] = await Promise.all([
      serviceReferralSettlementRepository.listByMonth(yearMonth),
      serviceWorkerReferralRepository.listDailyLinesByMonth(yearMonth),
    ]);
    return { settlements, lines };
  },

  async confirmMonthlySettlement(settlementId: string, userId?: string): Promise<void> {
    const before = await serviceReferralSettlementRepository.get(settlementId);
    await serviceReferralSettlementRepository.update(settlementId, {
      status: 'confirmed',
      confirmedAt: new Date().toISOString(),
      updatedBy: userId || '',
    });
    const settlement = before || await serviceReferralSettlementRepository.get(settlementId);
    if (settlement && before?.status !== 'confirmed' && before?.status !== 'paid') {
      const lines = await serviceWorkerReferralRepository.listDailyLinesByMonthAndReferrer(settlement.yearMonth, settlement.referrerId);
      await Promise.all(lines
        .filter((line) => line.status === 'confirmed' || line.status === 'overridden')
        .map((line) => serviceWorkerHistoryService.logEvent({
          workerId: line.workerId,
          workerName: line.workerName,
          eventType: '정산확정',
          eventDate: getTodayString(),
          referrerId: line.referrerId,
          referrerName: line.referrerName,
          siteName: line.siteNames[0] || '',
          teamName: line.teamName || '',
          newValue: String(settlement.payableTotal),
          createdBy: userId || '',
        })));
      await serviceReferralPaymentService.syncPaymentsFromSettlements(settlement.yearMonth);
    }
    toast.saved('정산 확정', 1);
  },

  async markSettlementPaid(settlementId: string, userId?: string): Promise<void> {
    const before = await serviceReferralSettlementRepository.get(settlementId);
    await serviceReferralSettlementRepository.update(settlementId, {
      status: 'paid',
      paidAt: new Date().toISOString(),
      updatedBy: userId || '',
    });
    if (before && before.status !== 'paid') {
      const lines = await serviceWorkerReferralRepository.listDailyLinesByMonthAndReferrer(before.yearMonth, before.referrerId);
      await Promise.all(lines
        .filter((line) => line.status === 'confirmed' || line.status === 'overridden')
        .map((line) => serviceWorkerHistoryService.logEvent({
          workerId: line.workerId,
          workerName: line.workerName,
          eventType: '지급완료',
          eventDate: getTodayString(),
          referrerId: line.referrerId,
          referrerName: line.referrerName,
          siteName: line.siteNames[0] || '',
          teamName: line.teamName || '',
          newValue: String(before.payableTotal),
          createdBy: userId || '',
        })));
    }
    toast.saved('지급 완료', 1);
  },

  async getDashboardSummary(yearMonth: string = getCurrentYearMonth()): Promise<RecruitingDashboardSummary> {
    const [settlements, lines, referrals, workers] = await Promise.all([
      serviceReferralSettlementRepository.listByMonth(yearMonth),
      serviceWorkerReferralRepository.listDailyLinesByMonth(yearMonth),
      serviceWorkerReferralRepository.listReferrals(),
      manpowerService.getWorkers(true),
    ]);
    const workerByAlias = new Map<string, Worker>();
    workers.forEach((worker) => getWorkerAliasKeys(worker).forEach((key) => workerByAlias.set(key, worker)));
    const stoppedCandidateCount = referrals.filter((referral) => {
      const worker = workerByAlias.get(referral.workerId) || workerByAlias.get(referral.workerName);
      return referral.status === 'stopped' || Boolean(getWorkerStopInfo(worker));
    }).length;

    return {
      yearMonth,
      introIncomeTotal: settlements.reduce((sum, item) => sum + toNumber(item.introIncomeTotal), 0),
      introPayoutTotal: settlements.reduce((sum, item) => sum + toNumber(item.introPayoutTotal), 0),
      dailyCommissionTotal: settlements.reduce((sum, item) => sum + toNumber(item.dailyCommissionTotal), 0),
      netProfit: settlements.reduce((sum, item) => sum + toNumber(item.netProfit), 0),
      pendingWorkerCount: unique(lines.filter((line) => line.status === 'pending').map((line) => line.workerId)).length,
      stoppedCandidateCount,
      payableSettlementCount: settlements.filter((item) => item.status !== 'paid' && item.payableTotal > 0).length,
      paidSettlementCount: settlements.filter((item) => item.status === 'paid').length,
    };
  },

  async getMonthlyStatistics(yearMonth: string = getCurrentYearMonth()): Promise<RecruitingMonthlyStatistics> {
    const [settlements, lines, referrals, allSettlements] = await Promise.all([
      serviceReferralSettlementRepository.listByMonth(yearMonth),
      serviceWorkerReferralRepository.listDailyLinesByMonth(yearMonth),
      serviceWorkerReferralRepository.listReferrals(),
      serviceReferralSettlementRepository.listAll(),
    ]);

    const payableLines = lines.filter((line) => line.status !== 'excluded');
    const linesByReferrer = new Map<string, ServiceReferralDailyLine[]>();
    payableLines.forEach((line) => {
      const list = linesByReferrer.get(line.referrerId) || [];
      list.push(line);
      linesByReferrer.set(line.referrerId, list);
    });

    const referrerRows = settlements.map((settlement) => {
      const referrerLines = linesByReferrer.get(settlement.referrerId) || [];
      const byReferral = new Map<string, ServiceReferralDailyLine[]>();
      referrerLines.forEach((line) => {
        const list = byReferral.get(line.referralId) || [];
        list.push(line);
        byReferral.set(line.referralId, list);
      });
      const achievedCount = Array.from(byReferral.values()).filter((list) => list.some((line) => line.status === 'confirmed' || line.status === 'overridden')).length;
      const stoppedCount = referrals.filter((referral) => referral.referrerId === settlement.referrerId && referral.status === 'stopped').length;
      const workerCount = settlement.totalWorkers || unique(referrerLines.map((line) => line.workerId)).length;
      return {
        referrerId: settlement.referrerId,
        referrerName: settlement.referrerName,
        workerCount,
        workDays: settlement.totalWorkDays,
        achievedCount,
        stoppedCount,
        achievementRate: workerCount ? Math.round((achievedCount / workerCount) * 1000) / 10 : 0,
        stopRate: workerCount ? Math.round((stoppedCount / workerCount) * 1000) / 10 : 0,
        introIncomeTotal: settlement.introIncomeTotal,
        introPayoutTotal: settlement.introPayoutTotal,
        dailyCommissionTotal: settlement.dailyCommissionTotal,
        netProfit: settlement.netProfit,
      };
    });

    const siteMap = new Map<string, { workerIds: Set<string>; workDays: Set<string>; manDay: number }>();
    payableLines.forEach((line) => {
      const siteNames = line.siteNames.length ? line.siteNames : ['현장 미지정'];
      const splitManDay = line.manDay / siteNames.length;
      siteNames.forEach((siteName) => {
        const current = siteMap.get(siteName) || { workerIds: new Set<string>(), workDays: new Set<string>(), manDay: 0 };
        current.workerIds.add(line.workerId);
        current.workDays.add(`${line.workerId}:${line.date}`);
        current.manDay += splitManDay;
        siteMap.set(siteName, current);
      });
    });

    const monthKeys = Array.from({ length: 12 }, (_, index) => addMonths(yearMonth, index - 11));
    const monthlyRows = monthKeys.map((key) => {
      const rows = allSettlements.filter((settlement) => settlement.yearMonth === key);
      return {
        yearMonth: key,
        introIncomeTotal: rows.reduce((sum, item) => sum + toNumber(item.introIncomeTotal), 0),
        introPayoutTotal: rows.reduce((sum, item) => sum + toNumber(item.introPayoutTotal), 0),
        dailyCommissionTotal: rows.reduce((sum, item) => sum + toNumber(item.dailyCommissionTotal), 0),
        netProfit: rows.reduce((sum, item) => sum + toNumber(item.netProfit), 0),
      };
    });

    return {
      yearMonth,
      referrerRows,
      siteRows: Array.from(siteMap.entries())
        .map(([siteName, value]) => ({
          siteName,
          workerCount: value.workerIds.size,
          workDays: value.workDays.size,
          manDay: Math.round(value.manDay * 100) / 100,
        }))
        .sort((left, right) => right.manDay - left.manDay),
      monthlyRows,
    };
  },

  async getSettlementLogs(yearMonth: string = getCurrentYearMonth()): Promise<Array<{
    id: string;
    date: string;
    type: string;
    title: string;
    amount: number;
    status: string;
  }>> {
    const [lines, settlements] = await Promise.all([
      serviceWorkerReferralRepository.listDailyLinesByMonth(yearMonth),
      serviceReferralSettlementRepository.listByMonth(yearMonth),
    ]);
    const lineLogs = lines.map((line) => ({
      id: line.id || `${line.referralId}:${line.date}`,
      date: line.date,
      type: '일별 정산',
      title: `${line.referrerName} · ${line.workerName}`,
      amount: line.introPayoutAmount + line.dailyCommissionAmount,
      status: line.status,
    }));
    const settlementLogs = settlements.map((settlement) => ({
      id: settlement.id || `${settlement.yearMonth}:${settlement.referrerId}`,
      date: settlement.paidAt?.slice(0, 10) || settlement.confirmedAt?.slice(0, 10) || `${settlement.yearMonth}-01`,
      type: '월별 정산',
      title: settlement.referrerName,
      amount: settlement.payableTotal,
      status: settlement.status,
    }));
    return [...lineLogs, ...settlementLogs].sort((left, right) => right.date.localeCompare(left.date));
  },

  async downloadMonthlySettlementExcel(yearMonth: string): Promise<void> {
    const [settlements, lines] = await Promise.all([
      serviceReferralSettlementRepository.listByMonth(yearMonth),
      serviceWorkerReferralRepository.listDailyLinesByMonth(yearMonth),
    ]);
    await exportWorkbook(`소개소_월별정산_${yearMonth}.xlsx`, [
      {
        name: '소개자별정산',
        rows: settlements.map((row) => ({
          소개자: row.referrerName,
          상태: row.status,
          인원수: row.totalWorkers,
          근무일수: row.totalWorkDays,
          소개비수입: row.introIncomeTotal,
          소개비지급: row.introPayoutTotal,
          일일수수료: row.dailyCommissionTotal,
          조정금액: row.adjustmentAmount,
          지급액: row.payableTotal,
          순수익: row.netProfit,
        })),
      },
      {
        name: '작업자상세',
        rows: lines.map((line) => ({
          날짜: line.date,
          소개자: line.referrerName,
          작업자: line.workerName,
          팀: line.teamName,
          현장: line.siteNames.join(', '),
          공수: line.manDay,
          인정일차: line.introDayIndex,
          소개비수입: line.introIncomeAmount,
          소개비지급: line.introPayoutAmount,
          일일수수료: line.dailyCommissionAmount,
          상태: line.status,
          사유: line.overrideReason || line.excludedReason || '',
        })),
      },
    ]);
  },

  async downloadReferrerSettlementExcel(yearMonth: string, referrerId: string): Promise<void> {
    const [settlements, lines] = await Promise.all([
      serviceReferralSettlementRepository.listByMonth(yearMonth),
      serviceWorkerReferralRepository.listDailyLinesByMonthAndReferrer(yearMonth, referrerId),
    ]);
    const settlement = settlements.find((item) => item.referrerId === referrerId);
    const label = settlement?.referrerName || '소개자';
    await exportWorkbook(`소개자별_정산서_${label}_${yearMonth}.xlsx`, [
      {
        name: '정산요약',
        rows: settlement ? [{
          소개자: settlement.referrerName,
          상태: settlement.status,
          인원수: settlement.totalWorkers,
          근무일수: settlement.totalWorkDays,
          소개비수입: settlement.introIncomeTotal,
          소개비지급: settlement.introPayoutTotal,
          일일수수료: settlement.dailyCommissionTotal,
          조정금액: settlement.adjustmentAmount,
          지급액: settlement.payableTotal,
          순수익: settlement.netProfit,
        }] : [],
      },
      {
        name: '근무상세',
        rows: lines.map((line) => ({
          날짜: line.date,
          작업자: line.workerName,
          현장: line.siteNames.join(', '),
          공수: line.manDay,
          인정일차: line.introDayIndex,
          소개비지급: line.introPayoutAmount,
          일일수수료: line.dailyCommissionAmount,
          상태: line.status,
        })),
      },
    ]);
  },

  async downloadMonthlyStatisticsExcel(yearMonth: string): Promise<void> {
    const stats = await this.getMonthlyStatistics(yearMonth);
    await exportWorkbook(`소개소_월별통계_${yearMonth}.xlsx`, [
      {
        name: '소개자별실적',
        rows: stats.referrerRows.map((row) => ({
          소개자: row.referrerName,
          유입인원: row.workerCount,
          근무일수: row.workDays,
          달성인원: row.achievedCount,
          중지인원: row.stoppedCount,
          달성률: row.achievementRate,
          중지율: row.stopRate,
          수입: row.introIncomeTotal,
          비용: row.introPayoutTotal + row.dailyCommissionTotal,
          순수익: row.netProfit,
        })),
      },
      {
        name: '현장별투입',
        rows: stats.siteRows.map((row) => ({
          현장: row.siteName,
          인원수: row.workerCount,
          근무일수: row.workDays,
          공수: row.manDay,
        })),
      },
      {
        name: '월별수익',
        rows: stats.monthlyRows.map((row) => ({
          월: row.yearMonth,
          수입: row.introIncomeTotal,
          소개비지급: row.introPayoutTotal,
          일일수수료: row.dailyCommissionTotal,
          순수익: row.netProfit,
        })),
      },
    ]);
  },
};
