import { manpowerService, type Worker } from '../../services/manpowerService';
import { teamService, type Team } from '../../services/teamService';
import { companyService, type Company } from '../../services/companyService';
import { accountDirectoryService, type AccountDirectory } from '../../services/accountDirectoryService';
import { accommodationService } from '../../services/accommodationService';
import { dailyReportService, type DailyReport } from '../../services/dailyReportService';
import { siteService, type Site } from '../../services/siteService';
import { supportRateService, type SupportRate } from '../../services/supportRateService';
import { teamExpenseLedgerService } from '../../services/teamExpenseLedgerService';
import type { Accommodation, UtilityRecord } from '../../types/accommodation';
import type { TeamExpenseClaim } from '../../types/teamExpenseLedger';
import { overlapsAccommodationMonth, getAccommodationContractAmounts } from '../../utils/accommodationMonthSummary';
import { resolvePayrollBankCode } from '../../pages/payroll/utils/payrollBankCode';
import { buildTeamIdsByAffiliation } from '../../utils/cheongyeonTeams';
import type { AccountCategory, SupportTransferDetail, TransferCandidate, TransferLoadResult } from './types';
import { buildWorkerEmployment } from './workerEmployment';

const text = (value: unknown): string => String(value ?? '').trim();
const identity = (value: unknown): string => text(value).replace(/\s+/g, '');
const nameKey = (value: unknown): string => identity(text(value).replace(/\(.*?\)/g, ''));
const validPeriod = (period: string): boolean => /^\d{4}-(0[1-9]|1[0-2])$/.test(period);
const money = (value: unknown): number => {
    const parsed = typeof value === 'string' ? Number(value.replace(/,/g, '')) : Number(value);
    return Number.isFinite(parsed) ? Math.round(parsed) : 0;
};
const positiveRate = (value: unknown): number | undefined => money(value) > 0 ? money(value) : undefined;
const invalidMonth = (): TransferLoadResult => ({ candidates: [], warnings: ['조회 월을 YYYY-MM 형식으로 선택해주세요.'] });

type BankFields = { bankName?: string; accountNumber?: string; accountHolder?: string };
const bankFields = (account: BankFields) => ({
    bankName: text(account.bankName), bankCode: resolvePayrollBankCode(account.bankName),
    accountNumber: text(account.accountNumber), accountHolder: text(account.accountHolder),
});
const accountWarning = (candidate: BankFields): string => {
    const missing = [!resolvePayrollBankCode(candidate.bankName) && '은행', !text(candidate.accountNumber) && '계좌번호', !text(candidate.accountHolder) && '예금주'].filter(Boolean);
    return missing.length ? `${missing.join('·')} 확인 필요` : '';
};
const withWarning = (candidate: TransferCandidate, warnings: string[] = []): TransferCandidate => ({
    ...candidate, warning: [...warnings, accountWarning(candidate)].filter(Boolean).join(' · ') || undefined,
});

/** Read the same four directories used by AccountManagementPage without changing their source records. */
export const loadAccountTransferCandidates = async (): Promise<TransferLoadResult> => {
    const results = await Promise.allSettled([
        manpowerService.getWorkers(true), teamService.getTeams(), companyService.getCompanies(), accountDirectoryService.getEntries(),
    ]);
    const labels = ['작업자 계좌', '팀 계좌', '회사 계좌', '매입/기타 계좌'];
    const warnings = results.flatMap((result, index) => result.status === 'rejected' ? [`${labels[index]}를 불러오지 못했습니다. 다시 조회해주세요.`] : []);
    const workers: Worker[] = results[0].status === 'fulfilled' ? results[0].value : [];
    const teams: Team[] = results[1].status === 'fulfilled' ? results[1].value : [];
    const companies: Company[] = results[2].status === 'fulfilled' ? results[2].value : [];
    const entries: AccountDirectory[] = results[3].status === 'fulfilled' ? results[3].value : [];
    const candidates: TransferCandidate[] = [];
    const teamsById = new Map<string, Team>();
    const companiesById = new Map<string, Company>();
    teams.forEach(team => [team.id, team.legacyId].forEach(id => { if (text(id)) teamsById.set(text(id), team); }));
    companies.forEach(company => [company.id, company.legacyId].forEach(id => { if (text(id)) companiesById.set(text(id), company); }));
    const cheongyeonTeams = buildTeamIdsByAffiliation(teams, companies, 'cheongyeon');
    const externalTeams = buildTeamIdsByAffiliation(teams, companies, 'external');
    const teamCompanyName = (team?: Team) => text(companiesById.get(text(team?.companyId))?.name) || text(team?.companyName);
    const missingAccountCounts: Record<AccountCategory, number> = { worker: 0, team: 0, company: 0, purchase: 0, other: 0 };
    const categoryLabels: Record<AccountCategory, string> = { worker: '작업자', team: '팀', company: '회사', purchase: '매입', other: '기타' };
    const add = (entity: BankFields & { id?: string; name: string }, category: AccountCategory, groupName: string, detail: string,
        filters: Pick<TransferCandidate, 'accountTeamKey' | 'accountTeamLabel' | 'teamAffiliation'> = {}) => {
        if (!text(entity.accountNumber)) { missingAccountCounts[category] += 1; return; }
        if (!text(entity.id)) { warnings.push('원본 ID가 없는 계좌가 있어 제외했습니다. 계좌관리에서 확인해주세요.'); return; }
        candidates.push(withWarning({
            id: `account:${category}:${entity.id}`, source: 'account', sourceId: entity.id!,
            name: entity.name, groupName, category, ...bankFields(entity), amount: 0, period: '', detail, ...filters,
        }));
    };
    workers.forEach(worker => {
        const teamId = text(worker.teamId);
        const namedTeams = !teamId && text(worker.teamName) ? teams.filter(team => identity(team.name) === identity(worker.teamName)) : [];
        const team = teamsById.get(teamId) || (namedTeams.length === 1 ? namedTeams[0] : undefined);
        const resolvedTeamId = text(team?.id) || teamId;
        const teamName = text(team?.name) || text(worker.teamName) || '미배정';
        const companyName = teamCompanyName(team) || text(worker.companyName);
        add(worker, 'worker', teamName, `작업자 · ${companyName || '회사 미지정'}`, {
            accountTeamKey: resolvedTeamId ? `team:${resolvedTeamId}` : text(worker.teamName) ? `name:${identity(worker.teamName)}` : 'unassigned',
            accountTeamLabel: [teamName, companyName].filter(Boolean).join(' · '),
        });
    });
    teams.forEach(team => add(team, 'team', teamCompanyName(team) || '회사 미지정', `팀 · ${team.type || ''} · ${team.status || ''}`, {
        teamAffiliation: cheongyeonTeams.has(text(team.id)) ? 'cheongyeon' : externalTeams.has(text(team.id)) ? 'external' : 'unassigned',
    }));
    companies.forEach(company => add(company, 'company', company.type || '회사', `회사 · ${company.status || ''}`));
    entries.forEach(entry => add(entry, entry.category, entry.category === 'purchase' ? '매입계좌' : '기타계좌', [entry.note, entry.status === 'inactive' ? '비활성 계좌' : ''].filter(Boolean).join(' · ')));
    (Object.keys(missingAccountCounts) as AccountCategory[]).forEach(category => {
        if (missingAccountCounts[category] > 0) warnings.push(`${categoryLabels[category]} ${missingAccountCounts[category]}건은 계좌번호가 등록되지 않아 제외했습니다.`);
    });
    return { candidates, warnings: Array.from(new Set(warnings)), workerEmployment: buildWorkerEmployment(workers) };
};

/** A saved ledger rent may be prorated or zero; never substitute the contract total in that case. */
export const buildRentTransferCandidates = (period: string, rooms: Accommodation[], records: UtilityRecord[]): TransferLoadResult => {
    if (!validPeriod(period)) return invalidMonth();
    // AccommodationManager resolves migrated IDs first. Names are only a fallback
    // for records without an accommodation ID, never for an unmatched nonempty ID.
    const roomsByAnyId = new Map<string, Accommodation>();
    const roomsByName = new Map<string, Accommodation>();
    rooms.forEach(room => {
        const id = text(room.id);
        const legacyId = text((room as Accommodation & { legacyId?: unknown }).legacyId);
        const name = text(room.name);
        if (id) roomsByAnyId.set(id, room);
        if (legacyId) roomsByAnyId.set(legacyId, room);
        if (name && !roomsByName.has(name)) roomsByName.set(name, room);
    });
    const recordsByRoom = new Map<string, UtilityRecord>();
    records.filter(record => record.yearMonth === period).forEach(record => {
        const rawId = text(record.accommodationId);
        const canonicalId = text(roomsByAnyId.get(rawId)?.id ?? rawId);
        if (canonicalId) { recordsByRoom.set(canonicalId, record); return; }
        const namedId = text(roomsByName.get(text(record.accommodationName))?.id);
        if (namedId) recordsByRoom.set(namedId, record);
    });
    const candidates: TransferCandidate[] = [];
    const warnings: string[] = [];
    rooms.forEach(room => {
        if (!text(room.id)) { warnings.push('원본 ID가 없는 숙소가 있어 제외했습니다.'); return; }
        if (!overlapsAccommodationMonth(room.contract || {}, period) || (room.status === 'inactive' && !room.contract?.endDate)) return;
        const record = recordsByRoom.get(text(room.id));
        const hasLedgerRent = record?.costs?.rent !== undefined && record.costs.rent !== null;
        const amount = hasLedgerRent ? money(record.costs.rent) : money(getAccommodationContractAmounts(room).rent);
        const rowWarnings = [
            !hasLedgerRent && '선택 월 대장 월세가 없어 계약 월세 사용·일할 금액 확인',
            record?.paymentStatus === 'paid' && '대장 지급완료 표시·중복 송금 확인',
            room.contract?.isAutoTransfer && '자동이체 설정됨·중복 송금 확인',
        ].filter(Boolean) as string[];
        candidates.push(withWarning({
            id: `rent:${period}:${room.id}`, source: 'rent', sourceId: room.id, category: 'other',
            name: room.name, groupName: room.contract?.landlordName || '임대인 미지정',
            ...bankFields(room.contract || {}), amount, period,
            detail: `${period} 월세 · ${hasLedgerRent ? '월별 대장' : '계약 월세'} · 관리비·공과금 제외`,
            originalAmount: amount,
            rentDetail: { roomName: room.name, address: text(room.address), billingMonth: period, originalAmount: amount,
                basis: hasLedgerRent ? '월별 대장 월세' : '계약 월세 (일할 금액 확인 필요)', paymentStatus: record?.paymentStatus === 'paid' ? '지급완료 표시' : '지급완료 미확인' },
            senderMemo: `${room.name} ${Number(period.slice(5))}월세`,
        }, rowWarnings));
    });
    return { candidates, warnings };
};

export const loadRentTransferCandidates = async (period: string): Promise<TransferLoadResult> => {
    if (!validPeriod(period)) return invalidMonth();
    const results = await Promise.allSettled([accommodationService.getAccommodations(), accommodationService.listAllUtilityRecords(period)]);
    const warnings = results.flatMap((result, index) => result.status === 'rejected' ? [`${index === 0 ? '숙소 계약' : '선택 월 월세 대장'}을 불러오지 못했습니다. 금액 오적용을 막기 위해 월세 목록을 가져오지 않았습니다.`] : []);
    if (results[0].status !== 'fulfilled' || results[1].status !== 'fulfilled') return { candidates: [], warnings };
    return buildRentTransferCandidates(period, results[0].value, results[1].value);
};

type RateOverrides = {
    bulkRate?: unknown;
    aggregateRates?: Record<string, unknown>;
    teamRates?: Record<string, unknown>;
    siteRates?: Record<string, unknown>;
};
type ManualAdjustments = Record<string, { additionalAmount?: unknown; progressStatus?: string }>;
interface SupportSourceData {
    teams: Team[];
    companies: Company[];
    sites: Site[];
    reports: DailyReport[];
    rates: SupportRate[];
    claims: TeamExpenseClaim[];
    overrides?: RateOverrides;
    adjustments?: ManualAdjustments;
}
interface SupportGroup {
    teamId: string;
    teamName: string;
    team?: Team;
    company?: Company;
    aggregateIds: Set<string>;
    viewTeamNames: Set<string>;
    sites: Map<string, string>;
    amount: number;
    manDay: number;
    usesDefaultRate: boolean;
    workEntries: SupportTransferDetail['workEntries'];
}

// Mirrors SupportTeamPaymentPage's explicit business default, not a guessed rate.
const DEFAULT_SUPPORT_UNIT_PRICE = 230000;
const INCOMING = '외부지원온곳';
const isOwnCompanyName = (value: unknown): boolean => {
    const key = nameKey(value);
    return !!key && ['청연이엔지', '청연'].some(own => key.includes(own) || (key.length >= 2 && own.includes(key)));
};
const sameReference = (leftId: unknown, leftName: unknown, rightId: unknown, rightName: unknown): boolean =>
    identity(leftId) && identity(rightId) ? identity(leftId) === identity(rightId) : (!!nameKey(leftName) && nameKey(leftName) === nameKey(rightName));

type NamedReference = { id?: string; legacyId?: string; name: string };
const findReference = <T extends NamedReference>(items: T[], id: unknown, name: unknown): T | undefined => {
    const idKey = identity(id), label = nameKey(name);
    const matches = idKey ? items.filter(item => [item.id, item.legacyId].some(value => identity(value) === idKey))
        : label ? items.filter(item => nameKey(item.name) === label) : [];
    return matches.length === 1 ? matches[0] : undefined;
};
const matchesReference = <T extends NamedReference>(items: T[], leftId: unknown, leftName: unknown, rightId: unknown, rightName: unknown): boolean => {
    const left = findReference(items, leftId, leftName), right = findReference(items, rightId, rightName);
    if (identity(leftId) && identity(rightId)) return identity(left?.id || leftId) === identity(right?.id || rightId);
    // Name-only legacy records are usable only when the directory identifies one entity.
    return !!left && !!right && left === right;
};

/** Mirrors the incoming page's classification, billing-rate precedence, settlement merge, and additions. */
export const buildSupportTransferCandidates = (period: string, data: SupportSourceData): TransferLoadResult => {
    if (!validPeriod(period)) return invalidMonth();
    const { teams, companies, sites, reports, rates, claims, overrides = {}, adjustments = {} } = data;
    const findTeam = (id: unknown, name: unknown) => findReference(teams, id, name);
    const findCompany = (id: unknown, name: unknown) => findReference(companies, id, name);
    const ownCompany = (id: unknown, name: unknown): boolean => {
        const company = findCompany(id, name);
        return !!company?.isMyCompany || isOwnCompanyName(company?.name) || (!identity(id) && isOwnCompanyName(name));
    };
    const ownTeam = (team?: Team): boolean => !!team && ownCompany(team.companyId, team.companyName ?? companies.find(company => company.id === team.companyId)?.name);
    const groups = new Map<string, SupportGroup>();
    const warnings: string[] = [];
    const excludedExpenseReferences = new Set<TeamExpenseClaim>();
    reports.filter(report => report.date.slice(0, 7) === period).forEach(report => {
        const site = findReference(sites, report.siteId, report.siteName);
        const constructorId = site?.constructorCompanyId ?? site?.companyId ?? report.companyId ?? '';
        const constructorName = site?.constructorCompanyName ?? site?.companyName ?? report.companyName ?? '';
        const siteOwn = ownCompany(constructorId, constructorName);
        const targetIdRaw = report.responsibleTeamId ?? site?.responsibleTeamId ?? report.teamId;
        const targetNameRaw = report.responsibleTeamName ?? site?.responsibleTeamName ?? report.teamName;
        const target = findTeam(targetIdRaw, targetNameRaw);
        const targetId = text(target?.id ?? targetIdRaw);
        const targetName = target?.name ?? targetNameRaw ?? '팀 미지정';
        if (!siteOwn || !ownTeam(target)) return;
        const matchingRates = rates.filter(rate => matchesReference(sites, rate.siteId || rate.id, rate.siteName, report.siteId, site?.name || report.siteName));
        const configuredSiteRate = positiveRate(matchingRates.find(rate => identity(rate.siteId || rate.id))?.defaultRate)
            ?? positiveRate(matchingRates.find(rate => !identity(rate.siteId || rate.id))?.defaultRate);
        report.workers.forEach(worker => {
            const fallbackReportTeamId = worker.workerTeamName ? '' : text(report.teamId);
            const source = findTeam(worker.teamId || fallbackReportTeamId, worker.workerTeamName);
            const sourceId = text(source?.id || worker.teamId || nameKey(worker.workerTeamName) || fallbackReportTeamId);
            const sourceName = source?.name ?? worker.workerTeamName ?? report.teamName ?? '팀 미지정';
            const sourceOwn = ownTeam(source);
            // The original page classifies same-company teams as internal before checking support pay models.
            if (sourceOwn && (sameReference(sourceId, sourceName, targetId, targetName) || (sourceId && targetId))) return;
            if (sourceOwn && !text(worker.salaryModel ?? worker.payType).includes('지원') && identity(source?.type) !== '지원팀') return;
            const settlementId = sourceId || text(source?.companyId);
            if (!settlementId) { warnings.push('정산 대상 팀을 식별할 수 없는 지원내역이 있어 제외했습니다. 원본 일보를 확인해주세요.'); return; }
            const company = findCompany(source?.companyId, source?.companyName);
            const mergeKey = `${INCOMING}::${identity(settlementId)}`;
            const aggregateId = `${INCOMING}::${identity(targetId) || nameKey(targetName) || 'unknown-view'}::${identity(settlementId)}`;
            const mergedId = `merged::${mergeKey}`;
            const siteId = report.siteId ?? 'unknown-site';
            const baseRate = configuredSiteRate ?? positiveRate(source?.supportRate) ?? positiveRate(worker.unitPrice);
            // Support-unit overrides only change the support-cost column; bank exports use the billing column.
            const overrideRate = positiveRate(overrides.siteRates?.[`${aggregateId}::${siteId}`])
                ?? positiveRate(overrides.siteRates?.[`${mergedId}::${siteId}`])
                ?? positiveRate(overrides.siteRates?.[`${mergeKey}::${siteId}`])
                ?? positiveRate(overrides.aggregateRates?.[aggregateId])
                ?? positiveRate(overrides.aggregateRates?.[mergedId])
                ?? positiveRate(overrides.teamRates?.[mergeKey])
                ?? positiveRate(overrides.bulkRate);
            const rate = overrideRate ?? baseRate ?? DEFAULT_SUPPORT_UNIT_PRICE;
            const manDay = typeof worker.manDay === 'number' && Number.isFinite(worker.manDay) ? Math.max(0, worker.manDay) : 0;
            const group = groups.get(mergeKey) ?? {
                teamId: settlementId, teamName: sourceName, team: source, company,
                aggregateIds: new Set<string>(), viewTeamNames: new Set<string>(), sites: new Map<string, string>(),
                amount: 0, manDay: 0, usesDefaultRate: false, workEntries: [],
            };
            group.aggregateIds.add(aggregateId);
            group.viewTeamNames.add(targetName);
            group.sites.set(siteId, report.siteName ?? '현장 미지정');
            const lineAmount = Math.round(manDay * rate);
            group.amount += lineAmount;
            group.manDay += manDay;
            group.usesDefaultRate ||= !overrideRate && !baseRate;
            group.workEntries.push({
                date: report.date, siteName: report.siteName ?? '현장 미지정', targetTeamName: targetName,
                workerName: text(worker.name) || '작업자 미지정', manDay, unitPrice: rate, amount: lineAmount,
                rateSource: overrideRate ? '월별 청구단가' : configuredSiteRate ? '현장 설정단가' : positiveRate(source?.supportRate) ? '팀 지원단가' : baseRate ? '일보 단가' : '기본단가',
            });
            groups.set(mergeKey, group);
        });
    });
    const candidates = Array.from(groups.entries()).map(([mergeKey, group]): TransferCandidate => {
        const aggregateId = group.aggregateIds.size === 1 ? Array.from(group.aggregateIds)[0] : `merged::${mergeKey}`;
        const adjustment = adjustments[aggregateId];
        // The existing page normalizes additionalAmount only when it is a finite number.
        const additional = typeof adjustment?.additionalAmount === 'number' && Number.isFinite(adjustment.additionalAmount) ? Math.max(0, money(adjustment.additionalAmount)) : 0;
        const matchedClaims = new Map<string, TeamExpenseClaim>();
        claims.filter(claim => claim.yearMonth === period && claim.claimType === 'teamCharge' && (claim.status === 'charged' || claim.status === 'settled') && money(claim.amount) > 0)
            .forEach(claim => {
                const teamMatches = matchesReference(teams, claim.payerTeamId, claim.payerTeamName, group.teamId, group.teamName);
                const siteMatches = Array.from(group.sites).some(([id, name]) => matchesReference(sites, claim.siteId, claim.siteName, id, name));
                if (!teamMatches || !siteMatches) {
                    if (nameKey(claim.payerTeamName) === nameKey(group.teamName) && Array.from(group.sites.values()).some(name => nameKey(claim.siteName) === nameKey(name))) excludedExpenseReferences.add(claim);
                    return;
                }
                const key = claim.id || [claim.yearMonth, claim.date, claim.payerTeamId, claim.payerTeamName, claim.chargeToTeamId, claim.chargeToTeamName, claim.siteId, claim.siteName, claim.category, claim.description, claim.amount].map(text).join('::');
                matchedClaims.set(key, claim);
            });
        const expense = Array.from(matchedClaims.values()).reduce((sum, claim) => sum + Math.max(0, money(claim.amount)), 0);
        // Keep bank + account together; never combine one team's bank with its company's account number.
        const account = text(group.team?.accountNumber) || text(group.team?.bankName) ? group.team : group.company;
        const rowWarnings = [
            group.usesDefaultRate && '지원비 화면 기본단가 230,000원 적용 내역 포함',
            adjustment?.progressStatus === 'depositComplete' && '지원비 입금완료 표시·중복 송금 확인',
            !group.team && '작업팀 원본 등록정보 확인 필요',
        ].filter(Boolean) as string[];
        return withWarning({
            id: `support:${period}:${group.teamId}`, source: 'support', sourceId: group.teamId,
            category: 'team', name: group.teamName, groupName: Array.from(group.viewTeamNames).join(', '),
            ...bankFields({ ...account, accountHolder: account?.accountHolder || (account === group.team ? group.team?.leaderName : group.company?.ceoName) || group.teamName }),
            amount: group.amount + additional + expense, period,
            detail: `${INCOMING} · ${group.manDay}공수 · 청구금액 ${group.amount.toLocaleString('ko-KR')}원 + 추가 ${additional.toLocaleString('ko-KR')}원 + 후청구 경비 ${expense.toLocaleString('ko-KR')}원 · ${group.sites.size}개 현장`,
            senderMemo: `${group.teamName} ${Number(period.slice(5))}월지원비`,
            supportDetail: {
                capturedAt: new Date().toISOString(), originalAmount: group.amount + additional + expense,
                billingAmount: group.amount, additionalAmount: additional, expenseAmount: expense,
                totalManDay: group.manDay, siteCount: group.sites.size,
                adjustmentScope: group.aggregateIds.size === 1 ? 'team' : 'merged',
                workEntries: group.workEntries.sort((a, b) => a.date.localeCompare(b.date) || a.siteName.localeCompare(b.siteName) || a.workerName.localeCompare(b.workerName)),
                expenseEntries: Array.from(matchedClaims.values()).map(claim => ({
                    date: text(claim.date), siteName: text(claim.siteName) || group.sites.get(text(claim.siteId)) || '현장 미지정',
                    category: text(claim.category), description: text(claim.description), amount: Math.max(0, money(claim.amount)),
                    status: claim.status as 'charged' | 'settled',
                })).sort((a, b) => a.date.localeCompare(b.date) || a.siteName.localeCompare(b.siteName)),
            },
        }, rowWarnings);
    });
    if (excludedExpenseReferences.size) warnings.push(`지원 경비 ${excludedExpenseReferences.size}건은 이름이 같아도 팀·현장 식별정보가 달라 합산하지 않았습니다. 원본 경비를 확인해 주세요.`);
    return { candidates, warnings };
};

const readMonthlySetting = <T extends object>(prefix: string, period: string): T => {
    if (typeof window === 'undefined') return {} as T;
    const raw = window.localStorage.getItem(`${prefix}:${period}`);
    if (!raw) return {} as T;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid monthly setting');
    return parsed as T;
};

export const loadSupportTransferCandidates = async (period: string): Promise<TransferLoadResult> => {
    if (!validPeriod(period)) return invalidMonth();
    const [year, month] = period.split('-').map(Number);
    const end = `${period}-${new Date(year, month, 0).getDate()}`;
    const results = await Promise.allSettled([
        teamService.getTeams(), companyService.getCompanies(), siteService.getSites(),
        dailyReportService.getReportsByRange(`${period}-01`, end), supportRateService.getAllSiteRates(), teamExpenseLedgerService.getClaimsByMonth(period),
    ]);
    const labels = ['팀', '회사', '현장', '작업일보', '지원단가', '후청구 경비'];
    const warnings = results.flatMap((result, index) => result.status === 'rejected' ? [`${labels[index]} 조회에 실패했습니다. 지원비 금액이 불완전해 목록을 가져오지 않았습니다.`] : []);
    const [teams, companies, sites, reports, rates, claims] = results;
    if (teams.status !== 'fulfilled' || companies.status !== 'fulfilled' || sites.status !== 'fulfilled' || reports.status !== 'fulfilled' || rates.status !== 'fulfilled' || claims.status !== 'fulfilled') return { candidates: [], warnings };
    try {
        const overrides = readMonthlySetting<RateOverrides>('support-team-payment-rate-overrides-v1', period);
        const adjustments = readMonthlySetting<ManualAdjustments>('support-team-payment-manual-v1', period);
        return buildSupportTransferCandidates(period, { teams: teams.value, companies: companies.value, sites: sites.value, reports: reports.value, rates: rates.value, claims: claims.value, overrides, adjustments });
    } catch {
        return { candidates: [], warnings: ['저장된 월별 지원단가·추가금액을 읽지 못했습니다. 외부지원온곳 화면에서 해당 월 설정을 확인해주세요.'] };
    }
};
