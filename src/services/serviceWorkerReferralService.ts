import { recruitingReferrerRepository } from '../repositories/recruitingReferrerRepository';
import { serviceWorkerReferralRepository } from '../repositories/serviceWorkerReferralRepository';
import { manpowerService, Worker } from './manpowerService';
import { dailyReportService, DailyReportWorkerRow } from './dailyReportService';
import { settlementTargetService, type SettlementTarget } from './settlementTargetService';
import {
  DEFAULT_SERVICE_REFERRAL_SETTINGS,
  RecruitingReferrer,
  ServiceWorkerHistoryEventType,
  ServiceReferralSettings,
  ServiceWorkerCandidate,
  ServiceWorkerReferral,
} from '../types/recruiting';
import { serviceWorkerHistoryService } from './serviceWorkerHistoryService';
import { toast } from '../utils/swal';

const toText = (value: unknown): string => String(value ?? '').trim();
const normalize = (value: unknown): string => toText(value).toLowerCase();
const ACTIVE_REFERRAL_STATUSES = new Set<ServiceWorkerReferral['status']>(['active', 'paused']);
const REPORT_ONLY_WORKER_PREFIX = 'daily-report-worker:';

export interface CreateServiceWorkerReferralInput {
  workerId: string;
  referrerId?: string;
  settlementTargetId?: string;
  startDate?: string;
  introFeeIncomePerDay?: number;
  introFeePayoutPerDay?: number;
  introFeeMaxDays?: number;
  dailyCommissionPerDay?: number;
  memo?: string;
}

type CandidateAccumulator = ServiceWorkerCandidate & {
  dateSet: Set<string>;
  siteSet: Set<string>;
  reportIdSet: Set<string>;
};

const uniqueTexts = (values: unknown[]): string[] =>
  Array.from(new Set(values.map(toText).filter(Boolean)));

const hasServiceTeamMarker = (value: unknown): boolean => {
  const text = toText(value);
  const normalized = normalize(value);
  return text === '용역팀'
    || text.includes('용역')
    || normalized.includes('service')
    || normalized.includes('outsourc')
    || normalized.includes('manpower');
};

export const isActiveRecruitingWorker = (worker: Partial<Worker> | null | undefined): boolean => {
  const status = toText(worker?.status);
  const normalized = normalize(status);
  if (!status) return false;
  if (status.includes('퇴사') || status.includes('휴직') || status.includes('출입금지')) return false;
  return status === '재직'
    || status.includes('재직')
    || normalized === 'active'
    || normalized === 'working'
    || normalized === 'employed';
};

export const isServiceTeamWorker = (worker: Partial<Worker> | null | undefined): boolean => {
  const values = [worker?.teamType, worker?.payType, worker?.salaryModel].map(toText);
  return values.some(hasServiceTeamMarker);
};

export const resolveRecruitingWorkerId = (worker: Partial<Worker>): string =>
  toText(worker.id) || toText(worker.legacyId) || toText(worker.name);

const getTodayString = (): string => new Date().toISOString().slice(0, 10);

const getReportOnlyWorkerId = (row: DailyReportWorkerRow): string => {
  const workerId = toText(row.workerId);
  if (workerId && !workerId.startsWith('__empty__') && !workerId.startsWith('unknown')) return workerId;
  const workerName = toText(row.workerName || row.name);
  return workerName ? `${REPORT_ONLY_WORKER_PREFIX}${workerName}` : '';
};

const isPositiveDailyReportWorkerRow = (row: DailyReportWorkerRow): boolean =>
  !row.isEmptyReport && Number(row.manDay || 0) > 0 && row.status !== 'absent' && Boolean(toText(row.workerName || row.name));

const isServiceTeamDailyReportRow = (row: DailyReportWorkerRow): boolean => {
  if (!isPositiveDailyReportWorkerRow(row)) return false;
  return [
    row.payType,
    row.salaryModel,
    row.workerTeamName,
    row.teamName,
    row.responsibleTeamName,
  ].some(hasServiceTeamMarker);
};

const getWorkerAliasKeys = (worker: Partial<Worker> | null | undefined): string[] =>
  uniqueTexts([worker?.id, worker?.legacyId, worker?.name]);

const getCandidateAliasKeys = (candidate: ServiceWorkerCandidate): string[] =>
  uniqueTexts([candidate.workerId, candidate.workerName]);

const indexWorkersByAlias = (workers: Worker[]): Map<string, Worker> => {
  const workerByAlias = new Map<string, Worker>();
  workers.forEach((worker) => {
    getWorkerAliasKeys(worker).forEach((key) => workerByAlias.set(key, worker));
  });
  return workerByAlias;
};

const indexReferralsByAlias = (referrals: ServiceWorkerReferral[]): Map<string, ServiceWorkerReferral> => {
  const referralByAlias = new Map<string, ServiceWorkerReferral>();
  referrals.forEach((referral) => {
    uniqueTexts([referral.workerId, referral.workerName]).forEach((key) => {
      if (!referralByAlias.has(key)) referralByAlias.set(key, referral);
    });
  });
  return referralByAlias;
};

const findReferralByAliases = (
  referralByAlias: Map<string, ServiceWorkerReferral>,
  aliases: string[]
): ServiceWorkerReferral | undefined =>
  aliases.map((alias) => referralByAlias.get(alias)).find(Boolean);

const buildWorkerCandidate = (
  worker: Worker,
  referralByAlias: Map<string, ServiceWorkerReferral>
): CandidateAccumulator => {
  const workerId = resolveRecruitingWorkerId(worker);
  return {
    workerId,
    workerName: toText(worker.name),
    source: 'workers',
    teamId: toText(worker.teamId),
    teamName: toText(worker.teamName),
    teamType: toText(worker.teamType),
    payType: toText(worker.payType),
    salaryModel: toText(worker.salaryModel),
    status: toText(worker.status),
    contact: toText(worker.contact),
    siteNames: [],
    reportIds: [],
    workDays: 0,
    isHistorical: false,
    existingReferral: findReferralByAliases(referralByAlias, getWorkerAliasKeys(worker)),
    dateSet: new Set<string>(),
    siteSet: new Set<string>(),
    reportIdSet: new Set<string>(),
  };
};

const resolveCandidateKey = (
  row: DailyReportWorkerRow,
  workerByAlias: Map<string, Worker>
): { key: string; worker: Worker | null } => {
  const worker = workerByAlias.get(toText(row.workerId)) || workerByAlias.get(toText(row.workerName)) || null;
  const key = worker ? resolveRecruitingWorkerId(worker) : getReportOnlyWorkerId(row);
  return { key, worker };
};

const mergeDailyReportRowIntoCandidate = (
  candidate: CandidateAccumulator,
  row: DailyReportWorkerRow,
  worker: Worker | null,
  referralByAlias: Map<string, ServiceWorkerReferral>
): void => {
  const date = toText(row.date);
  if (date) {
    candidate.dateSet.add(date);
    candidate.firstWorkDate = !candidate.firstWorkDate || date < candidate.firstWorkDate ? date : candidate.firstWorkDate;
    candidate.lastWorkDate = !candidate.lastWorkDate || date > candidate.lastWorkDate ? date : candidate.lastWorkDate;
  }
  uniqueTexts([row.siteName]).forEach((siteName) => candidate.siteSet.add(siteName));
  uniqueTexts([row.reportId]).forEach((reportId) => candidate.reportIdSet.add(reportId));

  if (candidate.source === 'workers') candidate.source = 'merged';
  if (!candidate.source) candidate.source = worker ? 'merged' : 'daily_reports';
  candidate.isHistorical = true;
  candidate.teamId = candidate.teamId || toText(row.workerTeamId) || toText(row.teamId) || toText(worker?.teamId);
  candidate.teamName = candidate.teamName || toText(row.workerTeamName) || toText(row.teamName) || toText(worker?.teamName);
  candidate.teamType = candidate.teamType || (hasServiceTeamMarker(row.workerTeamName) ? '용역팀' : toText(worker?.teamType));
  candidate.payType = candidate.payType || toText(row.payType) || toText(worker?.payType);
  candidate.salaryModel = candidate.salaryModel || toText(row.salaryModel) || toText(worker?.salaryModel);
  candidate.status = candidate.status || toText(worker?.status) || '출력일보';
  candidate.contact = candidate.contact || toText(worker?.contact);
  candidate.existingReferral = candidate.existingReferral || findReferralByAliases(referralByAlias, getCandidateAliasKeys(candidate));
};

const finalizeCandidate = (candidate: CandidateAccumulator): ServiceWorkerCandidate => ({
  workerId: candidate.workerId,
  workerName: candidate.workerName,
  source: candidate.source,
  teamId: candidate.teamId,
  teamName: candidate.teamName,
  teamType: candidate.teamType,
  payType: candidate.payType,
  salaryModel: candidate.salaryModel,
  status: candidate.status,
  contact: candidate.contact,
  firstWorkDate: candidate.firstWorkDate,
  lastWorkDate: candidate.lastWorkDate,
  workDays: candidate.dateSet.size,
  siteNames: Array.from(candidate.siteSet).sort(),
  reportIds: Array.from(candidate.reportIdSet).sort(),
  isHistorical: candidate.isHistorical,
  existingReferral: candidate.existingReferral,
});

const normalizeSettings = (settings?: ServiceReferralSettings | null): ServiceReferralSettings => ({
  ...DEFAULT_SERVICE_REFERRAL_SETTINGS,
  ...(settings || {}),
  id: 'default',
});

const mapSettlementTargetToReferrerType = (target: SettlementTarget): RecruitingReferrer['type'] => {
  if (target.targetType === 'office_staff') return 'office_staff';
  if (target.targetType === 'client_company' || target.targetType === 'rental_company') return 'agency';
  return 'external';
};

const findReferrerForSettlementTarget = (
  referrers: RecruitingReferrer[],
  target: SettlementTarget
): RecruitingReferrer | null => {
  const targetId = toText(target.id);
  const targetName = normalize(target.name);
  const targetContact = normalize(target.contact);
  const targetAccount = normalize(target.accountNumber);

  const linked = referrers.find((referrer) => targetId && toText(referrer.linkedEntityId) === targetId);
  if (linked) return linked;

  const exactIdentity = referrers.find((referrer) => {
    if (!targetName || normalize(referrer.name) !== targetName) return false;
    const contactMatches = !targetContact || normalize(referrer.contact) === targetContact;
    const accountMatches = !targetAccount || normalize(referrer.accountNumber) === targetAccount;
    return contactMatches && accountMatches && (targetContact || targetAccount);
  });
  if (exactIdentity) return exactIdentity;

  const sameNameReferrers = referrers.filter((referrer) => targetName && normalize(referrer.name) === targetName);
  return sameNameReferrers.length === 1 ? sameNameReferrers[0] : null;
};

const buildReferrerFromSettlementTarget = (
  target: SettlementTarget,
  settings: ServiceReferralSettings
): Omit<RecruitingReferrer, 'id' | 'createdAt' | 'updatedAt'> => ({
  type: mapSettlementTargetToReferrerType(target),
  linkedEntityId: toText(target.id),
  name: toText(target.name),
  contact: toText(target.contact),
  bankName: toText(target.bankName),
  accountNumber: toText(target.accountNumber),
  accountHolder: toText(target.accountHolder) || toText(target.name),
  defaultIntroFeeIncomePerDay: Number(settings.introFeeIncomePerDay),
  defaultIntroFeePayoutPerDay: Number(settings.introFeePayoutPerDay),
  defaultIntroFeeMaxDays: Number(settings.introFeeMaxDays),
  defaultDailyCommission: Number(settings.dailyCommissionPerDay),
  status: 'active',
  memo: toText(target.memo) || 'settlement_targets',
});

const syncSettlementTargetToReferrer = async (
  target: SettlementTarget,
  settings: ServiceReferralSettings
): Promise<RecruitingReferrer> => {
  if (!toText(target.name)) throw new Error('Settlement target name is required.');
  if (target.status !== 'active') throw new Error('Inactive settlement target cannot be selected as a referrer.');

  const referrers = await recruitingReferrerRepository.list();
  const existing = findReferrerForSettlementTarget(referrers, target);
  const basePayload = buildReferrerFromSettlementTarget(target, settings);

  if (existing?.id) {
    const updates: Partial<RecruitingReferrer> = {
      linkedEntityId: basePayload.linkedEntityId,
      type: existing.type || basePayload.type,
      status: 'active',
    };
    if (!toText(existing.contact) && basePayload.contact) updates.contact = basePayload.contact;
    if (!toText(existing.bankName) && basePayload.bankName) updates.bankName = basePayload.bankName;
    if (!toText(existing.accountNumber) && basePayload.accountNumber) updates.accountNumber = basePayload.accountNumber;
    if (!toText(existing.accountHolder) && basePayload.accountHolder) updates.accountHolder = basePayload.accountHolder;
    await recruitingReferrerRepository.update(existing.id, updates);
    return {
      ...existing,
      ...updates,
      id: existing.id,
      name: existing.name || basePayload.name,
      defaultIntroFeeIncomePerDay: existing.defaultIntroFeeIncomePerDay ?? basePayload.defaultIntroFeeIncomePerDay,
      defaultIntroFeePayoutPerDay: existing.defaultIntroFeePayoutPerDay ?? basePayload.defaultIntroFeePayoutPerDay,
      defaultIntroFeeMaxDays: existing.defaultIntroFeeMaxDays ?? basePayload.defaultIntroFeeMaxDays,
      defaultDailyCommission: existing.defaultDailyCommission ?? basePayload.defaultDailyCommission,
    };
  }

  const referrerId = await recruitingReferrerRepository.create(basePayload);
  return { ...basePayload, id: referrerId };
};

const resolveReferralReferrer = async (
  input: CreateServiceWorkerReferralInput,
  settings: ServiceReferralSettings
): Promise<RecruitingReferrer | null> => {
  const referrerId = toText(input.referrerId);
  if (referrerId) return recruitingReferrerRepository.get(referrerId);

  const settlementTargetId = toText(input.settlementTargetId);
  if (!settlementTargetId) return null;

  const target = await settlementTargetService.getTarget(settlementTargetId);
  if (!target) throw new Error('Settlement target not found.');
  return syncSettlementTargetToReferrer(target, settings);
};

const buildReferralInput = (
  worker: Worker,
  referrer: RecruitingReferrer,
  settings: ServiceReferralSettings,
  input: Partial<ServiceWorkerReferral>
): Omit<ServiceWorkerReferral, 'id' | 'createdAt' | 'updatedAt'> => ({
  workerId: resolveRecruitingWorkerId(worker),
  workerName: toText(worker.name),
  workerTeamName: toText(worker.teamName),
  source: input.source || 'workers',
  firstWorkDate: input.firstWorkDate || input.startDate || '',
  lastWorkDate: input.lastWorkDate || '',
  sourceReportIds: input.sourceReportIds || [],
  sourceSiteNames: input.sourceSiteNames || [],
  sourceSnapshot: input.sourceSnapshot || {
    workerId: resolveRecruitingWorkerId(worker),
    workerName: toText(worker.name),
    teamType: toText(worker.teamType),
    payType: toText(worker.payType),
    salaryModel: toText(worker.salaryModel),
    status: toText(worker.status),
  },
  referrerId: toText(referrer.id),
  referrerType: referrer.type,
  referrerName: referrer.name,
  startDate: input.startDate || getTodayString(),
  stopDate: input.stopDate || '',
  status: input.status || 'active',
  introFeeIncomePerDay: Number(input.introFeeIncomePerDay ?? referrer.defaultIntroFeeIncomePerDay ?? settings.introFeeIncomePerDay),
  introFeePayoutPerDay: Number(input.introFeePayoutPerDay ?? referrer.defaultIntroFeePayoutPerDay ?? settings.introFeePayoutPerDay),
  introFeeMaxDays: Number(input.introFeeMaxDays ?? referrer.defaultIntroFeeMaxDays ?? settings.introFeeMaxDays),
  dailyCommissionPerDay: Number(input.dailyCommissionPerDay ?? referrer.defaultDailyCommission ?? settings.dailyCommissionPerDay),
  stopReason: input.stopReason || '',
  memo: input.memo || '',
});

const buildReferralInputFromCandidate = (
  candidate: ServiceWorkerCandidate,
  referrer: RecruitingReferrer,
  settings: ServiceReferralSettings,
  input: Partial<ServiceWorkerReferral>
): Omit<ServiceWorkerReferral, 'id' | 'createdAt' | 'updatedAt'> => ({
  workerId: candidate.workerId,
  workerName: candidate.workerName,
  workerTeamName: candidate.teamName || '',
  source: candidate.source || 'daily_reports',
  firstWorkDate: candidate.firstWorkDate || input.startDate || '',
  lastWorkDate: candidate.lastWorkDate || '',
  sourceReportIds: candidate.reportIds || [],
  sourceSiteNames: candidate.siteNames || [],
  sourceSnapshot: {
    source: candidate.source || 'daily_reports',
    workerId: candidate.workerId,
    workerName: candidate.workerName,
    teamName: candidate.teamName || '',
    teamType: candidate.teamType || '',
    payType: candidate.payType || '',
    salaryModel: candidate.salaryModel || '',
    status: candidate.status || '',
    firstWorkDate: candidate.firstWorkDate || '',
    lastWorkDate: candidate.lastWorkDate || '',
    workDays: candidate.workDays || 0,
    siteNames: candidate.siteNames || [],
    reportIds: candidate.reportIds || [],
  },
  referrerId: toText(referrer.id),
  referrerType: referrer.type,
  referrerName: referrer.name,
  startDate: input.startDate || candidate.firstWorkDate || getTodayString(),
  stopDate: input.stopDate || '',
  status: input.status || 'active',
  introFeeIncomePerDay: Number(input.introFeeIncomePerDay ?? referrer.defaultIntroFeeIncomePerDay ?? settings.introFeeIncomePerDay),
  introFeePayoutPerDay: Number(input.introFeePayoutPerDay ?? referrer.defaultIntroFeePayoutPerDay ?? settings.introFeePayoutPerDay),
  introFeeMaxDays: Number(input.introFeeMaxDays ?? referrer.defaultIntroFeeMaxDays ?? settings.introFeeMaxDays),
  dailyCommissionPerDay: Number(input.dailyCommissionPerDay ?? referrer.defaultDailyCommission ?? settings.dailyCommissionPerDay),
  stopReason: input.stopReason || '',
  memo: input.memo || '',
});

const resolveStopEventType = (reason: string): ServiceWorkerHistoryEventType => {
  const normalized = normalize(reason);
  if (normalized.includes('출입') || normalized.includes('ban')) return '출입금지';
  if (normalized.includes('팀')) return '팀변경';
  if (normalized.includes('급여') || normalized.includes('pay')) return '급여구분변경';
  if (normalized.includes('휴직') || normalized.includes('pause')) return '휴직';
  return '퇴사';
};

export const serviceWorkerReferralService = {
  async getSettings(): Promise<ServiceReferralSettings> {
    const saved = await serviceWorkerReferralRepository.getSettings();
    if (saved) return normalizeSettings(saved);
    await serviceWorkerReferralRepository.saveSettings(DEFAULT_SERVICE_REFERRAL_SETTINGS);
    return DEFAULT_SERVICE_REFERRAL_SETTINGS;
  },

  async saveSettings(settings: ServiceReferralSettings): Promise<void> {
    await serviceWorkerReferralRepository.saveSettings(normalizeSettings(settings));
    toast.saved('소개소 수익모델', 1);
  },

  async listReferrals(): Promise<ServiceWorkerReferral[]> {
    return serviceWorkerReferralRepository.listReferrals();
  },

  async listServiceWorkerCandidates(): Promise<ServiceWorkerCandidate[]> {
    const [workers, referrals, reportRows] = await Promise.all([
      manpowerService.getWorkers(true),
      serviceWorkerReferralRepository.listReferrals(),
      dailyReportService.getWorkerRows(),
    ]);
    const referralByAlias = indexReferralsByAlias(referrals);
    const workerByAlias = indexWorkersByAlias(workers);
    const candidateByKey = new Map<string, CandidateAccumulator>();

    workers
      .filter((worker) => isActiveRecruitingWorker(worker) && isServiceTeamWorker(worker))
      .forEach((worker) => {
        const candidate = buildWorkerCandidate(worker, referralByAlias);
        candidateByKey.set(candidate.workerId, candidate);
      });

    reportRows
      .filter(isServiceTeamDailyReportRow)
      .forEach((row) => {
        const { key, worker } = resolveCandidateKey(row, workerByAlias);
        if (!key) return;
        const candidate = candidateByKey.get(key) || {
          workerId: key,
          workerName: toText(worker?.name) || toText(row.workerName || row.name),
          source: worker ? 'merged' : 'daily_reports',
          teamId: toText(worker?.teamId) || toText(row.workerTeamId) || toText(row.teamId),
          teamName: toText(worker?.teamName) || toText(row.workerTeamName) || toText(row.teamName),
          teamType: toText(worker?.teamType) || (hasServiceTeamMarker(row.workerTeamName) ? '용역팀' : ''),
          payType: toText(worker?.payType) || toText(row.payType),
          salaryModel: toText(worker?.salaryModel) || toText(row.salaryModel),
          status: toText(worker?.status) || '출력일보',
          contact: toText(worker?.contact),
          siteNames: [],
          reportIds: [],
          workDays: 0,
          isHistorical: true,
          existingReferral: findReferralByAliases(referralByAlias, uniqueTexts([key, row.workerId, row.workerName, row.name])),
          dateSet: new Set<string>(),
          siteSet: new Set<string>(),
          reportIdSet: new Set<string>(),
        };
        mergeDailyReportRowIntoCandidate(candidate, row, worker, referralByAlias);
        candidateByKey.set(key, candidate);
      });

    return Array.from(candidateByKey.values())
      .map(finalizeCandidate)
      .sort((left, right) => {
        const leftRegistered = left.existingReferral && left.existingReferral.status !== 'closed' ? 1 : 0;
        const rightRegistered = right.existingReferral && right.existingReferral.status !== 'closed' ? 1 : 0;
        if (leftRegistered !== rightRegistered) return leftRegistered - rightRegistered;
        const leftSource = left.source === 'daily_reports' ? 0 : left.source === 'merged' ? 1 : 2;
        const rightSource = right.source === 'daily_reports' ? 0 : right.source === 'merged' ? 1 : 2;
        if (leftSource !== rightSource) return leftSource - rightSource;
        return left.workerName.localeCompare(right.workerName, 'ko');
      });
  },

  async createReferral(input: CreateServiceWorkerReferralInput): Promise<string> {
    const settings = await this.getSettings();
    const [workerDirect, referrer, existingReferrals, workers, candidates] = await Promise.all([
      manpowerService.getWorker(input.workerId),
      resolveReferralReferrer(input, settings),
      serviceWorkerReferralRepository.listReferrals(),
      manpowerService.getWorkers(true),
      this.listServiceWorkerCandidates(),
    ]);
    const worker = workerDirect || workers
      .find((item) => resolveRecruitingWorkerId(item) === input.workerId || item.legacyId === input.workerId || item.name === input.workerId) || null;
    const candidate = candidates.find((item) => getCandidateAliasKeys(item).includes(input.workerId));
    if (!referrer) throw new Error('소개자를 찾을 수 없습니다.');
    if (!worker && !candidate) throw new Error('작업자를 찾을 수 없습니다.');
    const hasCurrentServiceWorker = Boolean(worker && isActiveRecruitingWorker(worker) && isServiceTeamWorker(worker));
    const hasDailyReportEvidence = Boolean(candidate?.isHistorical && candidate.workDays && candidate.workDays > 0);
    if (!hasCurrentServiceWorker && !hasDailyReportEvidence) {
      throw new Error('용역팀 작업자 또는 출력일보 용역팀 근무 이력이 있는 작업자만 소개소 정산 대상자로 등록할 수 있습니다.');
    }

    const payload = worker && hasCurrentServiceWorker
      ? buildReferralInput(worker, referrer, settings, {
        ...input,
        firstWorkDate: candidate?.firstWorkDate,
        lastWorkDate: candidate?.lastWorkDate,
        sourceReportIds: candidate?.reportIds,
        sourceSiteNames: candidate?.siteNames,
        sourceSnapshot: candidate ? {
          source: candidate.source || 'merged',
          firstWorkDate: candidate.firstWorkDate || '',
          lastWorkDate: candidate.lastWorkDate || '',
          workDays: candidate.workDays || 0,
          siteNames: candidate.siteNames || [],
          reportIds: candidate.reportIds || [],
        } : undefined,
      })
      : buildReferralInputFromCandidate(candidate as ServiceWorkerCandidate, referrer, settings, input);
    const workerKeys = new Set(
      [payload.workerId, payload.workerName, worker?.id, worker?.legacyId, worker?.name, ...(candidate ? getCandidateAliasKeys(candidate) : [])]
        .map(toText)
        .filter(Boolean)
    );
    const duplicated = existingReferrals.find((referral) => {
      if (!ACTIVE_REFERRAL_STATUSES.has(referral.status)) return false;
      if (referral.stopDate) return false;
      return [referral.workerId, referral.workerName].map(toText).some((key) => workerKeys.has(key));
    });
    if (duplicated) {
      throw new Error(`이미 소개 등록된 작업자입니다. 기존 소개자: ${duplicated.referrerName}`);
    }

    const id = await serviceWorkerReferralRepository.createReferral(payload);
    await serviceWorkerHistoryService.logEvent({
      workerId: payload.workerId,
      workerName: payload.workerName,
      eventType: '등록',
      eventDate: payload.startDate,
      referrerId: payload.referrerId,
      referrerName: payload.referrerName,
      teamName: payload.workerTeamName,
      newValue: payload.referrerName,
    });
    toast.saved('용역 소개 연결', 1);
    return id;
  },

  async updateReferral(id: string, updates: Partial<ServiceWorkerReferral>): Promise<void> {
    const before = await serviceWorkerReferralRepository.getReferral(id);
    await serviceWorkerReferralRepository.updateReferral(id, updates);
    if (before) {
      const after = { ...before, ...updates };
      const eventDate = updates.stopDate || getTodayString();
      const historyTasks: Promise<string>[] = [];
      if ((updates.referrerId && updates.referrerId !== before.referrerId) || (updates.referrerName && updates.referrerName !== before.referrerName)) {
        historyTasks.push(serviceWorkerHistoryService.logEvent({
          workerId: after.workerId,
          workerName: after.workerName,
          eventType: '소개자변경',
          oldValue: before.referrerName,
          newValue: after.referrerName,
          eventDate,
          referrerId: after.referrerId,
          referrerName: after.referrerName,
          teamName: after.workerTeamName,
        }));
      }
      if (updates.workerTeamName && updates.workerTeamName !== before.workerTeamName) {
        historyTasks.push(serviceWorkerHistoryService.logEvent({
          workerId: after.workerId,
          workerName: after.workerName,
          eventType: '팀변경',
          oldValue: before.workerTeamName,
          newValue: after.workerTeamName,
          eventDate,
          referrerId: after.referrerId,
          referrerName: after.referrerName,
          teamName: after.workerTeamName,
        }));
      }
      if (updates.status && updates.status !== before.status) {
        const eventType: ServiceWorkerHistoryEventType = updates.status === 'paused'
          ? '휴직'
          : before.status === 'paused' && updates.status === 'active'
            ? '복직'
            : resolveStopEventType(updates.stopReason || after.stopReason || '');
        historyTasks.push(serviceWorkerHistoryService.logEvent({
          workerId: after.workerId,
          workerName: after.workerName,
          eventType,
          oldValue: before.status,
          newValue: updates.status,
          eventDate,
          referrerId: after.referrerId,
          referrerName: after.referrerName,
          teamName: after.workerTeamName,
        }));
      }
      await Promise.all(historyTasks);
    }
    toast.updated('용역 소개 연결');
  },

  async stopReferral(id: string, stopDate: string, reason: string): Promise<void> {
    const before = await serviceWorkerReferralRepository.getReferral(id);
    await serviceWorkerReferralRepository.updateReferral(id, {
      status: 'stopped',
      stopDate,
      stopReason: reason,
    });
    if (before) {
      await serviceWorkerHistoryService.logEvent({
        workerId: before.workerId,
        workerName: before.workerName,
        eventType: resolveStopEventType(reason),
        oldValue: before.status,
        newValue: reason,
        eventDate: stopDate,
        referrerId: before.referrerId,
        referrerName: before.referrerName,
        teamName: before.workerTeamName,
      });
    }
    toast.updated('정산 중지');
  },
};
