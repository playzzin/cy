import { serviceWorkerHistoryRepository, ServiceWorkerHistoryFilters } from '../repositories/serviceWorkerHistoryRepository';
import { serviceWorkerReferralRepository } from '../repositories/serviceWorkerReferralRepository';
import type {
  ServiceReferralDailyLine,
  ServiceWorkerHistory,
  ServiceWorkerHistoryDetail,
  ServiceWorkerHistoryEventType,
  ServiceWorkerReferral,
} from '../types/recruiting';
import { recruitingExcelService } from './recruitingExcelService';
import { toast } from '../utils/swal';

const toText = (value: unknown): string => String(value ?? '').trim();
const toNumber = (value: unknown): number => {
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
};

const normalize = (value: unknown): string => toText(value).toLowerCase();
const unique = <T,>(values: T[]): T[] => Array.from(new Set(values.filter(Boolean)));
const today = (): string => new Date().toISOString().slice(0, 10);
const sanitizeDocId = (value: string): string => value.replace(/[\\/#?[\]\s:|]+/g, '_');

const buildSyncedRegistrationHistoryId = (workerId: string, eventDate: string): string =>
  sanitizeDocId(`history__등록__${workerId}__${eventDate}`);

const matchesSearch = (row: ServiceWorkerHistory, filters: ServiceWorkerHistoryFilters & {
  workerName?: string;
  referrerName?: string;
  siteName?: string;
  teamName?: string;
}): boolean => {
  if (filters.workerName && !normalize(row.workerName).includes(normalize(filters.workerName))) return false;
  if (filters.referrerName && !normalize(row.referrerName).includes(normalize(filters.referrerName))) return false;
  if (filters.siteName && !normalize(row.siteName).includes(normalize(filters.siteName))) return false;
  if (filters.teamName && !normalize(row.teamName).includes(normalize(filters.teamName))) return false;
  return true;
};

const latestReferralForWorker = (workerId: string, referrals: ServiceWorkerReferral[]): ServiceWorkerReferral | undefined =>
  referrals
    .filter((row) => row.workerId === workerId || row.workerName === workerId)
    .sort((left, right) => String(right.startDate || '').localeCompare(String(left.startDate || '')))[0];

const activeFinancialLines = (lines: ServiceReferralDailyLine[]): ServiceReferralDailyLine[] =>
  lines.filter((line) => line.status === 'confirmed' || line.status === 'overridden');

export const serviceWorkerHistoryService = {
  async listHistory(filters: ServiceWorkerHistoryFilters & {
    workerName?: string;
    referrerName?: string;
    siteName?: string;
    teamName?: string;
  } = {}): Promise<ServiceWorkerHistory[]> {
    const rows = await serviceWorkerHistoryRepository.list({
      workerId: filters.workerId,
      eventType: filters.eventType,
      startDate: filters.startDate,
      endDate: filters.endDate,
    });
    return rows.filter((row) => matchesSearch(row, filters));
  },

  async logEvent(input: {
    workerId: string;
    workerName: string;
    eventType: ServiceWorkerHistoryEventType;
    oldValue?: string;
    newValue?: string;
    eventDate?: string;
    referrerId?: string;
    referrerName?: string;
    siteName?: string;
    teamName?: string;
    createdBy?: string;
  }): Promise<string> {
    return serviceWorkerHistoryRepository.create({
      workerId: input.workerId,
      workerName: input.workerName,
      eventType: input.eventType,
      oldValue: input.oldValue || '',
      newValue: input.newValue || '',
      eventDate: input.eventDate || today(),
      referrerId: input.referrerId || '',
      referrerName: input.referrerName || '',
      siteName: input.siteName || '',
      teamName: input.teamName || '',
      createdBy: input.createdBy || '',
    });
  },

  async syncHistoricalWorkerEvents(createdBy = ''): Promise<number> {
    const { serviceWorkerReferralService } = await import('./serviceWorkerReferralService');
    const [candidates, existingRegistrationEvents] = await Promise.all([
      serviceWorkerReferralService.listServiceWorkerCandidates(),
      serviceWorkerHistoryRepository.list({ eventType: '등록' }),
    ]);

    const existingKeys = new Set(
      existingRegistrationEvents.map((event) => `${event.workerId}|${event.eventDate}`)
    );

    const rows: ServiceWorkerHistory[] = candidates
      .filter((candidate) => candidate.isHistorical && candidate.workerId && candidate.workerName && candidate.firstWorkDate)
      .filter((candidate) => !existingKeys.has(`${candidate.workerId}|${candidate.firstWorkDate}`))
      .map((candidate) => ({
        id: buildSyncedRegistrationHistoryId(candidate.workerId, candidate.firstWorkDate || today()),
        workerId: candidate.workerId,
        workerName: candidate.workerName,
        eventType: '등록',
        oldValue: '',
        newValue: candidate.source === 'daily_reports' ? '출력일보 용역팀 이력 반영' : '통합DB/출력일보 용역팀 이력 반영',
        eventDate: candidate.firstWorkDate || today(),
        referrerId: candidate.existingReferral?.referrerId || '',
        referrerName: candidate.existingReferral?.referrerName || '',
        siteName: (candidate.siteNames || [])[0] || '',
        teamName: candidate.teamName || '',
        createdBy,
      }));

    await serviceWorkerHistoryRepository.saveMany(rows);
    toast.processed(`출력일보 용역팀 이력 ${rows.length}건 동기화`);
    return rows.length;
  },

  async getWorkerHistoryDetail(workerId: string): Promise<ServiceWorkerHistoryDetail | null> {
    const [events, referrals, lines] = await Promise.all([
      serviceWorkerHistoryRepository.listByWorker(workerId),
      serviceWorkerReferralRepository.listReferrals(),
      serviceWorkerReferralRepository.listDailyLinesByWorker(workerId),
    ]);

    const referral = latestReferralForWorker(workerId, referrals);
    const workerName = events[0]?.workerName || referral?.workerName || lines[0]?.workerName || workerId;
    const financialLines = activeFinancialLines(lines);
    const latestLine = lines[0];
    const firstStartDate = referrals
      .filter((row) => row.workerId === workerId || row.workerName === workerName)
      .map((row) => row.startDate)
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right))[0] || '';

    if (!events.length && !referral && !lines.length) return null;

    return {
      workerId,
      workerName,
      currentStatus: referral?.status || 'unknown',
      currentReferrerName: referral?.referrerName || events.find((event) => event.referrerName)?.referrerName || '',
      firstStartDate,
      cumulativeWorkDays: unique(lines.filter((line) => line.workdayCounted && line.status !== 'excluded').map((line) => line.date)).length,
      settlementCount: unique(financialLines.map((line) => `${line.yearMonth}:${line.referrerId}`)).length,
      totalIncome: financialLines.reduce((sum, line) => sum + toNumber(line.introIncomeAmount), 0),
      latestTeamName: latestLine?.teamName || referral?.workerTeamName || events.find((event) => event.teamName)?.teamName || '',
      latestSiteName: latestLine?.siteNames?.[0] || events.find((event) => event.siteName)?.siteName || '',
      events,
    };
  },

  async getWorkerGrowthTrend(): Promise<Array<{ month: string; workers: number }>> {
    const [referrals, registrationEvents] = await Promise.all([
      serviceWorkerReferralRepository.listReferrals(),
      serviceWorkerHistoryRepository.list({ eventType: '등록' }),
    ]);
    const grouped = new Map<string, Set<string>>();
    referrals.forEach((referral) => {
      const month = String(referral.startDate || '').slice(0, 7);
      if (!month) return;
      const set = grouped.get(month) || new Set<string>();
      set.add(referral.workerId);
      grouped.set(month, set);
    });
    registrationEvents.forEach((event) => {
      const month = String(event.eventDate || '').slice(0, 7);
      if (!month) return;
      const set = grouped.get(month) || new Set<string>();
      set.add(event.workerId);
      grouped.set(month, set);
    });
    return Array.from(grouped.entries())
      .map(([month, workers]) => ({ month, workers: workers.size }))
      .sort((left, right) => left.month.localeCompare(right.month));
  },

  async downloadHistoryExcel(filters: ServiceWorkerHistoryFilters & {
    workerName?: string;
    referrerName?: string;
    siteName?: string;
    teamName?: string;
  } = {}): Promise<void> {
    const rows = await this.listHistory(filters);
    await recruitingExcelService.download(`작업자이력_${today()}.xlsx`, [
      {
        name: '작업자 이력',
        rows: rows.map((row) => ({
          작업자ID: row.workerId,
          작업자명: row.workerName,
          소개자: row.referrerName || '',
          현장: row.siteName || '',
          팀: row.teamName || '',
          이벤트: row.eventType,
          이전값: row.oldValue || '',
          변경값: row.newValue || '',
          이벤트일자: row.eventDate,
          등록자: row.createdBy || '',
        })),
      },
    ]);
    toast.processed('작업자 이력 Excel 다운로드');
  },
};
