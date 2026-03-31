import { laborExchangeService, LaborExchangeItem } from './laborExchangeService';
import { teamService, Team } from './teamService';
import { companyService, Company } from './companyService';
import { manpowerService, Worker } from './manpowerService';

const INTERNAL_CONSTRUCTOR_TEAM_NAMES = [
    '이재욱팀',
    '김봉수팀',
    '김세흔팀',
    '김덕기팀',
    '박상국팀',
    '김군회팀',
    '임효재팀',
    '김진민팀',
    '김동혁팀'
] as const;

const INTERNAL_COMPANY_NAME_HINTS = ['청연', '청연건설', '청연eng', '청연엔지니어링'] as const;

const normalize = (value?: string | null): string => (value ?? '').replace(/\s+/g, '').trim();
const normalizeName = (value?: string | null): string =>
    (value ?? '').replace(/\(.*?\)/g, '').replace(/\s+/g, '').trim();

const normalizedInternalTeamNames = INTERNAL_CONSTRUCTOR_TEAM_NAMES.map((value) => normalizeName(value));
const normalizedInternalCompanyHints = INTERNAL_COMPANY_NAME_HINTS.map((value) => normalizeName(value));

type ExternalDirection = 'payable' | 'receivable';
type BankSource = 'company' | 'leader' | 'missing';

interface TeamContext {
    id: string;
    name: string;
    companyId: string;
    companyName: string;
    team?: Team;
    company?: Company;
}

interface WorkerCompanyInference {
    companyId: string;
    companyName: string;
}

export interface SupportSettlementDetailRow {
    key: string;
    date: string;
    siteId: string;
    siteName: string;
    internalTeamId: string;
    internalTeamName: string;
    counterpartyTeamId: string;
    counterpartyTeamName: string;
    workerName: string;
    manDay: number;
    unitPrice: number;
    amount: number;
    direction: 'internal' | ExternalDirection;
}

export interface InternalSupportPairRow {
    key: string;
    providerTeamId: string;
    providerTeamName: string;
    consumerTeamId: string;
    consumerTeamName: string;
    totalManDay: number;
    totalAmount: number;
    entryCount: number;
    siteCount: number;
    siteNames: string[];
    details: SupportSettlementDetailRow[];
}

export interface ExternalSupportRow {
    key: string;
    externalTeamId: string;
    externalTeamName: string;
    externalCompanyId: string;
    externalCompanyName: string;
    bankName: string;
    accountNumber: string;
    accountHolder: string;
    bankSource: BankSource;
    internalTeamNames: string[];
    siteNames: string[];
    siteCount: number;
    payableManDay: number;
    payableAmount: number;
    receivableManDay: number;
    receivableAmount: number;
    netAmount: number;
    details: SupportSettlementDetailRow[];
    warnings: string[];
}

export interface SupportSettlementResult {
    yearMonth: string;
    internalPairs: InternalSupportPairRow[];
    externalRows: ExternalSupportRow[];
    stats: {
        internalPairCount: number;
        internalAmount: number;
        internalManDay: number;
        externalCount: number;
        externalPayableAmount: number;
        externalReceivableAmount: number;
        externalNetAmount: number;
        bankWarningCount: number;
    };
}

const addUniqueLabel = (values: string[], value?: string | null) => {
    const nextValue = (value ?? '').trim();
    if (!nextValue) return values;
    if (values.includes(nextValue)) return values;
    return [...values, nextValue];
};

const countValue = (counter: Map<string, number>, value?: string | null) => {
    const normalizedValue = normalize(value);
    if (!normalizedValue) return;
    counter.set(normalizedValue, (counter.get(normalizedValue) ?? 0) + 1);
};

const pickMostCommonValue = (counter: Map<string, number>): string => {
    const [winner] = Array.from(counter.entries()).sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1];
        return a[0].localeCompare(b[0], 'ko-KR');
    });
    return winner?.[0] ?? '';
};

const matchesInternalCompanyName = (value?: string | null) => {
    const normalized = normalizeName(value);
    if (!normalized) return false;
    if (normalized.includes('청연')) return true;
    return normalizedInternalCompanyHints.some((hint) => normalized === hint || normalized.includes(hint));
};

const buildContextKey = (teamContext: TeamContext, fallback: string): string => {
    return (
        normalize(teamContext.id) ||
        normalizeName(teamContext.name) ||
        normalize(teamContext.companyId) ||
        normalizeName(teamContext.companyName) ||
        fallback
    );
};

const buildWorkerCompanyInferences = (workers: Worker[]) => {
    const byTeamIdCounters = new Map<string, { companyIds: Map<string, number>; companyNames: Map<string, number> }>();
    const byTeamNameCounters = new Map<string, { companyIds: Map<string, number>; companyNames: Map<string, number> }>();

    const ensureBucket = (
        source: Map<string, { companyIds: Map<string, number>; companyNames: Map<string, number> }>,
        key: string
    ) => {
        const existing = source.get(key);
        if (existing) return existing;
        const created = {
            companyIds: new Map<string, number>(),
            companyNames: new Map<string, number>()
        };
        source.set(key, created);
        return created;
    };

    workers.forEach((worker) => {
        const workerTeamId = normalize(worker.teamId);
        const workerTeamName = normalizeName(worker.teamName);
        const workerCompanyId = normalize(worker.companyId);
        const workerCompanyName = normalize(worker.companyName);

        if (!workerTeamId && !workerTeamName) return;
        if (!workerCompanyId && !workerCompanyName) return;

        if (workerTeamId) {
            const bucket = ensureBucket(byTeamIdCounters, workerTeamId);
            countValue(bucket.companyIds, workerCompanyId);
            countValue(bucket.companyNames, workerCompanyName);
        }

        if (workerTeamName) {
            const bucket = ensureBucket(byTeamNameCounters, workerTeamName);
            countValue(bucket.companyIds, workerCompanyId);
            countValue(bucket.companyNames, workerCompanyName);
        }
    });

    const finalize = (
        source: Map<string, { companyIds: Map<string, number>; companyNames: Map<string, number> }>
    ) => {
        const finalized = new Map<string, WorkerCompanyInference>();
        source.forEach((bucket, key) => {
            finalized.set(key, {
                companyId: pickMostCommonValue(bucket.companyIds),
                companyName: pickMostCommonValue(bucket.companyNames)
            });
        });
        return finalized;
    };

    return {
        byTeamId: finalize(byTeamIdCounters),
        byTeamName: finalize(byTeamNameCounters)
    };
};

const resolveTeamContext = (
    teamId: string,
    fallbackTeamName: string,
    teamsById: Map<string, Team>,
    teamsByName: Map<string, Team>,
    companiesById: Map<string, Company>,
    companiesByName: Map<string, Company>,
    workerCompanyInferences: {
        byTeamId: Map<string, WorkerCompanyInference>;
        byTeamName: Map<string, WorkerCompanyInference>;
    }
): TeamContext => {
    const normalizedId = normalize(teamId);
    const normalizedName = normalizeName(fallbackTeamName);
    const team =
        (normalizedId ? teamsById.get(normalizedId) : undefined) ??
        (normalizedName ? teamsByName.get(normalizedName) : undefined);

    const inferredCompany =
        (normalizedId ? workerCompanyInferences.byTeamId.get(normalizedId) : undefined) ??
        (normalizedName ? workerCompanyInferences.byTeamName.get(normalizedName) : undefined);

    const companyId = normalize(team?.companyId) || inferredCompany?.companyId || '';
    const companyName = normalize(team?.companyName) || inferredCompany?.companyName || '';
    const company =
        (companyId ? companiesById.get(companyId) : undefined) ??
        (companyName ? companiesByName.get(normalizeName(companyName)) : undefined);

    return {
        id: normalize(team?.id) || normalizedId,
        name: team?.name || fallbackTeamName || '미확인 팀',
        companyId: normalize(company?.id) || companyId,
        companyName: company?.name || companyName,
        team,
        company
    };
};

const isInternalTeamContext = (teamContext: TeamContext, myCompany: Company | null) => {
    const normalizedTeamName = normalizeName(teamContext.name);
    if (normalizedInternalTeamNames.includes(normalizedTeamName)) {
        return true;
    }

    if (teamContext.company?.isMyCompany) {
        return true;
    }

    const myCompanyId = normalize(myCompany?.id);
    if (myCompanyId && normalize(teamContext.companyId) === myCompanyId) {
        return true;
    }

    const candidateCompanyNames = [
        teamContext.companyName,
        teamContext.company?.name,
        teamContext.team?.companyName,
        myCompany?.name
    ]
        .filter(Boolean);

    return candidateCompanyNames.some((value) => matchesInternalCompanyName(value));
};

const resolveExternalBankInfo = (
    teamContext: TeamContext,
    workersById: Map<string, Worker>,
    workersByName: Map<string, Worker>
) => {
    if (teamContext.company?.bankName || teamContext.company?.accountNumber || teamContext.company?.accountHolder) {
        return {
            bankName: teamContext.company?.bankName ?? '',
            accountNumber: teamContext.company?.accountNumber ?? '',
            accountHolder:
                teamContext.company?.accountHolder ??
                teamContext.company?.ceoName ??
                teamContext.company?.name ??
                '',
            bankSource: 'company' as BankSource
        };
    }

    const leaderId = normalize(teamContext.team?.leaderId);
    const leaderName = normalizeName(teamContext.team?.leaderName);
    const leader =
        (leaderId ? workersById.get(leaderId) : undefined) ??
        (leaderName ? workersByName.get(leaderName) : undefined);

    if (leader?.bankName || leader?.accountNumber || leader?.accountHolder) {
        return {
            bankName: leader.bankName ?? '',
            accountNumber: leader.accountNumber ?? '',
            accountHolder: leader.accountHolder ?? leader.name ?? '',
            bankSource: 'leader' as BankSource
        };
    }

    return {
        bankName: '',
        accountNumber: '',
        accountHolder: '',
        bankSource: 'missing' as BankSource
    };
};

const toRoundedManDay = (value: number) => Number(value.toFixed(2));

const createDetailRow = (
    key: string,
    item: LaborExchangeItem,
    internalTeam: TeamContext,
    counterpartyTeam: TeamContext,
    direction: 'internal' | ExternalDirection
): SupportSettlementDetailRow => {
    const unitPrice =
        Number.isFinite(item.supportRate) && item.supportRate > 0
            ? item.supportRate
            : Number.isFinite(item.unitPrice)
                ? item.unitPrice
                : 0;
    const amount = Math.round(Number.isFinite(item.amount) ? item.amount : item.manDay * unitPrice);

    return {
        key,
        date: item.date,
        siteId: item.siteId,
        siteName: item.siteName || '현장 미지정',
        internalTeamId: internalTeam.id,
        internalTeamName: internalTeam.name,
        counterpartyTeamId: counterpartyTeam.id,
        counterpartyTeamName: counterpartyTeam.name,
        workerName: item.workerName || '미확인 작업자',
        manDay: toRoundedManDay(item.manDay),
        unitPrice: Math.round(unitPrice),
        amount,
        direction
    };
};

export const supportSettlementService = {
    async getMonthlySettlement(yearMonth: string): Promise<SupportSettlementResult> {
        const [yearText, monthText] = yearMonth.split('-');
        const year = Number(yearText);
        const month = Number(monthText);

        if (!Number.isFinite(year) || !Number.isFinite(month)) {
            throw new Error(`Invalid yearMonth: ${yearMonth}`);
        }

        const [exchangeSummaries, teams, companies, workers, myCompany] = await Promise.all([
            laborExchangeService.getExchangeReport(year, month),
            teamService.getTeams(),
            companyService.getCompanies(),
            manpowerService.getWorkers(),
            companyService.getMyCompanyInfo()
        ]);

        const teamsById = new Map<string, Team>();
        const teamsByName = new Map<string, Team>();
        teams.forEach((team) => {
            const teamId = normalize(team.id);
            if (teamId) teamsById.set(teamId, team);
            const teamName = normalizeName(team.name);
            if (teamName && !teamsByName.has(teamName)) {
                teamsByName.set(teamName, team);
            }
        });

        const companiesById = new Map<string, Company>();
        const companiesByName = new Map<string, Company>();
        companies.forEach((company) => {
            const companyId = normalize(company.id);
            if (companyId) companiesById.set(companyId, company);
            const companyName = normalizeName(company.name);
            if (companyName && !companiesByName.has(companyName)) {
                companiesByName.set(companyName, company);
            }
        });

        const workersById = new Map<string, Worker>();
        const workersByName = new Map<string, Worker>();
        workers.forEach((worker) => {
            const workerId = normalize(worker.id);
            if (workerId) workersById.set(workerId, worker);
            const workerName = normalizeName(worker.name);
            if (workerName && !workersByName.has(workerName)) {
                workersByName.set(workerName, worker);
            }
        });
        const workerCompanyInferences = buildWorkerCompanyInferences(workers);

        const exchangeItems = exchangeSummaries.flatMap((summary) => summary.outgoing.items);
        const internalPairMap = new Map<string, InternalSupportPairRow>();
        const externalMap = new Map<string, ExternalSupportRow>();

        exchangeItems.forEach((item) => {
            const managedTeam = resolveTeamContext(
                item.reportTeamId,
                item.reportTeamName,
                teamsById,
                teamsByName,
                companiesById,
                companiesByName,
                workerCompanyInferences
            );
            const sourceTeam = resolveTeamContext(
                item.workerTeamId,
                item.workerTeamName,
                teamsById,
                teamsByName,
                companiesById,
                companiesByName,
                workerCompanyInferences
            );

            const sameTeam =
                buildContextKey(managedTeam, 'managed') === buildContextKey(sourceTeam, 'source') ||
                normalizeName(managedTeam.name) === normalizeName(sourceTeam.name);

            if (sameTeam) {
                return;
            }

            const managedInternal = isInternalTeamContext(managedTeam, myCompany);
            const sourceInternal = isInternalTeamContext(sourceTeam, myCompany);

            if (managedInternal && sourceInternal) {
                const providerKey = buildContextKey(sourceTeam, 'provider');
                const consumerKey = buildContextKey(managedTeam, 'consumer');
                const pairKey = `${providerKey}__${consumerKey}`;
                const detail = createDetailRow(
                    `${pairKey}__${item.date}__${item.workerId || item.workerName}`,
                    item,
                    sourceTeam,
                    managedTeam,
                    'internal'
                );

                const current = internalPairMap.get(pairKey) ?? {
                    key: pairKey,
                    providerTeamId: sourceTeam.id,
                    providerTeamName: sourceTeam.name,
                    consumerTeamId: managedTeam.id,
                    consumerTeamName: managedTeam.name,
                    totalManDay: 0,
                    totalAmount: 0,
                    entryCount: 0,
                    siteCount: 0,
                    siteNames: [],
                    details: []
                };

                current.totalManDay += detail.manDay;
                current.totalAmount += detail.amount;
                current.entryCount += 1;
                current.siteNames = addUniqueLabel(current.siteNames, detail.siteName);
                current.siteCount = current.siteNames.length;
                current.details.push(detail);
                internalPairMap.set(pairKey, current);
                return;
            }

            if (managedInternal === sourceInternal) {
                return;
            }

            const direction: ExternalDirection = managedInternal ? 'payable' : 'receivable';
            const externalTeam = managedInternal ? sourceTeam : managedTeam;
            const internalTeam = managedInternal ? managedTeam : sourceTeam;
            const externalKey = buildContextKey(externalTeam, `external_${item.date}_${item.workerId || item.workerName}`);
            const bankInfo = resolveExternalBankInfo(externalTeam, workersById, workersByName);
            const detail = createDetailRow(
                `${externalKey}__${direction}__${item.date}__${item.workerId || item.workerName}`,
                item,
                internalTeam,
                externalTeam,
                direction
            );

            const current = externalMap.get(externalKey) ?? {
                key: externalKey,
                externalTeamId: externalTeam.id,
                externalTeamName: externalTeam.name,
                externalCompanyId: externalTeam.companyId,
                externalCompanyName:
                    externalTeam.companyName ||
                    externalTeam.company?.name ||
                    externalTeam.team?.companyName ||
                    '',
                bankName: bankInfo.bankName,
                accountNumber: bankInfo.accountNumber,
                accountHolder: bankInfo.accountHolder,
                bankSource: bankInfo.bankSource,
                internalTeamNames: [],
                siteNames: [],
                siteCount: 0,
                payableManDay: 0,
                payableAmount: 0,
                receivableManDay: 0,
                receivableAmount: 0,
                netAmount: 0,
                details: [],
                warnings: []
            };

            current.internalTeamNames = addUniqueLabel(current.internalTeamNames, detail.internalTeamName);
            current.siteNames = addUniqueLabel(current.siteNames, detail.siteName);
            current.siteCount = current.siteNames.length;

            if (!current.bankName) current.warnings = addUniqueLabel(current.warnings, '은행 정보 없음');
            if (!current.accountNumber) current.warnings = addUniqueLabel(current.warnings, '계좌번호 없음');
            if (!current.accountHolder) current.warnings = addUniqueLabel(current.warnings, '예금주 없음');

            if (direction === 'payable') {
                current.payableManDay += detail.manDay;
                current.payableAmount += detail.amount;
            } else {
                current.receivableManDay += detail.manDay;
                current.receivableAmount += detail.amount;
            }

            current.netAmount = current.receivableAmount - current.payableAmount;
            current.details.push(detail);
            externalMap.set(externalKey, current);
        });

        const internalPairs = Array.from(internalPairMap.values())
            .map((row) => ({
                ...row,
                totalManDay: toRoundedManDay(row.totalManDay),
                totalAmount: Math.round(row.totalAmount),
                details: [...row.details].sort((a, b) => {
                    const dateCompare = a.date.localeCompare(b.date, 'ko-KR');
                    if (dateCompare !== 0) return dateCompare;
                    const siteCompare = a.siteName.localeCompare(b.siteName, 'ko-KR');
                    if (siteCompare !== 0) return siteCompare;
                    return a.workerName.localeCompare(b.workerName, 'ko-KR');
                })
            }))
            .sort((a, b) => {
                const providerCompare = a.providerTeamName.localeCompare(b.providerTeamName, 'ko-KR');
                if (providerCompare !== 0) return providerCompare;
                return a.consumerTeamName.localeCompare(b.consumerTeamName, 'ko-KR');
            });

        const externalRows = Array.from(externalMap.values())
            .map((row) => ({
                ...row,
                payableManDay: toRoundedManDay(row.payableManDay),
                payableAmount: Math.round(row.payableAmount),
                receivableManDay: toRoundedManDay(row.receivableManDay),
                receivableAmount: Math.round(row.receivableAmount),
                netAmount: Math.round(row.netAmount),
                details: [...row.details].sort((a, b) => {
                    const dateCompare = a.date.localeCompare(b.date, 'ko-KR');
                    if (dateCompare !== 0) return dateCompare;
                    const directionCompare = a.direction.localeCompare(b.direction, 'ko-KR');
                    if (directionCompare !== 0) return directionCompare;
                    return a.workerName.localeCompare(b.workerName, 'ko-KR');
                })
            }))
            .sort((a, b) => a.externalTeamName.localeCompare(b.externalTeamName, 'ko-KR'));

        return {
            yearMonth,
            internalPairs,
            externalRows,
            stats: {
                internalPairCount: internalPairs.length,
                internalAmount: internalPairs.reduce((sum, row) => sum + row.totalAmount, 0),
                internalManDay: toRoundedManDay(
                    internalPairs.reduce((sum, row) => sum + row.totalManDay, 0)
                ),
                externalCount: externalRows.length,
                externalPayableAmount: externalRows.reduce((sum, row) => sum + row.payableAmount, 0),
                externalReceivableAmount: externalRows.reduce((sum, row) => sum + row.receivableAmount, 0),
                externalNetAmount: externalRows.reduce((sum, row) => sum + row.netAmount, 0),
                bankWarningCount: externalRows.filter((row) => row.warnings.length > 0).length
            }
        };
    }
};
