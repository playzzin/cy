import {
    collection,
    doc,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    writeBatch,
    serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { TaxInvoiceIssue, SiteWorkSummary } from '../types/taxInvoiceList';

const COLLECTION_NAME = 'tax_invoice_issues';
const BATCH_WRITE_LIMIT = 450;

const normalizeText = (value: unknown): string => String(value ?? '').trim();

const normalizeKey = (value: unknown): string => normalizeText(value).replace(/\s+/g, '').toLowerCase();

const GENERIC_COMPANY_LABEL_KEYS = new Set(['외부팀', '지원팀', '용역팀', '미지정']);

const isGenericCompanyLabel = (value: unknown): boolean => GENERIC_COMPANY_LABEL_KEYS.has(normalizeKey(value));

const getMonthEndDate = (yearMonth: string): string => {
    const [rawYear, rawMonth] = yearMonth.split('-').map(Number);
    const year = Number.isFinite(rawYear) ? rawYear : new Date().getFullYear();
    const month = Number.isFinite(rawMonth) ? rawMonth : new Date().getMonth() + 1;
    const lastDay = new Date(year, month, 0).getDate();
    return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
};

const getSortableNo = (value: unknown): number => {
    const no = Number(value);
    return Number.isFinite(no) && no > 0 ? no : Number.MAX_SAFE_INTEGER;
};

const getTimestampMillis = (value: unknown): number => {
    if (!value) return 0;
    if (typeof (value as { toMillis?: () => number }).toMillis === 'function') {
        return (value as { toMillis: () => number }).toMillis();
    }
    if (typeof value === 'string' || typeof value === 'number' || value instanceof Date) {
        const millis = new Date(value).getTime();
        return Number.isFinite(millis) ? millis : 0;
    }
    return 0;
};

const sortIssuesByNo = (issues: TaxInvoiceIssue[]): TaxInvoiceIssue[] => {
    return [...issues].sort((a, b) => {
        const noDiff = getSortableNo(a.no) - getSortableNo(b.no);
        if (noDiff !== 0) return noDiff;

        const createdDiff = getTimestampMillis(a.createdAt) - getTimestampMillis(b.createdAt);
        if (createdDiff !== 0) return createdDiff;

        return String(a.id ?? '').localeCompare(String(b.id ?? ''));
    });
};

const fetchIssuesByMonth = async (yearMonth: string): Promise<TaxInvoiceIssue[]> => {
    // Use only where so the query does not require a composite Firestore index.
    const q = query(
        collection(db, COLLECTION_NAME),
        where('yearMonth', '==', yearMonth)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as TaxInvoiceIssue));
};

const normalizeIssueNos = async (issues: TaxInvoiceIssue[]): Promise<TaxInvoiceIssue[]> => {
    const sorted = sortIssuesByNo(issues);
    const normalized = sorted.map((issue, index) => ({ ...issue, no: index + 1 }));

    let batch = writeBatch(db);
    let pendingWrites = 0;

    for (let index = 0; index < sorted.length; index += 1) {
        const issue = sorted[index];
        const expectedNo = index + 1;

        if (!issue.id || Number(issue.no) === expectedNo) continue;

        batch.update(doc(db, COLLECTION_NAME, issue.id), {
            no: expectedNo,
            updatedAt: serverTimestamp(),
        });
        pendingWrites += 1;

        if (pendingWrites >= BATCH_WRITE_LIMIT) {
            await batch.commit();
            batch = writeBatch(db);
            pendingWrites = 0;
        }
    }

    if (pendingWrites > 0) {
        await batch.commit();
    }

    return normalized;
};

const normalizeIssueDatesToMonthEnd = async (
    issues: TaxInvoiceIssue[],
    yearMonth: string
): Promise<TaxInvoiceIssue[]> => {
    const monthEndDate = getMonthEndDate(yearMonth);
    const normalized = issues.map(issue => (
        issue.issueDate === monthEndDate ? issue : { ...issue, issueDate: monthEndDate }
    ));

    let batch = writeBatch(db);
    let pendingWrites = 0;

    for (const issue of issues) {
        if (!issue.id || issue.issueDate === monthEndDate) continue;

        batch.update(doc(db, COLLECTION_NAME, issue.id), {
            issueDate: monthEndDate,
            updatedAt: serverTimestamp(),
        });
        pendingWrites += 1;

        if (pendingWrites >= BATCH_WRITE_LIMIT) {
            await batch.commit();
            batch = writeBatch(db);
            pendingWrites = 0;
        }
    }

    if (pendingWrites > 0) {
        await batch.commit();
    }

    return normalized;
};

const normalizeIssuesForMonth = async (
    issues: TaxInvoiceIssue[],
    yearMonth: string
): Promise<TaxInvoiceIssue[]> => {
    const normalizedNos = await normalizeIssueNos(issues);
    return normalizeIssueDatesToMonthEnd(normalizedNos, yearMonth);
};

export const taxInvoiceListService = {
    async addIssue(
        data: Omit<TaxInvoiceIssue, 'id' | 'createdAt' | 'updatedAt'>
    ): Promise<string> {
        const ref = await addDoc(collection(db, COLLECTION_NAME), {
            ...data,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
        return ref.id;
    },

    async updateIssue(id: string, data: Partial<TaxInvoiceIssue>): Promise<void> {
        const docRef = doc(db, COLLECTION_NAME, id);
        await updateDoc(docRef, {
            ...data,
            updatedAt: serverTimestamp(),
        });
    },

    async deleteIssue(id: string): Promise<void> {
        await deleteDoc(doc(db, COLLECTION_NAME, id));
    },

    async deleteIssuesBatch(ids: string[]): Promise<void> {
        const batch = writeBatch(db);
        ids.forEach(id => {
            batch.delete(doc(db, COLLECTION_NAME, id));
        });
        await batch.commit();
    },

    async getIssuesByMonth(yearMonth: string): Promise<TaxInvoiceIssue[]> {
        const issues = await fetchIssuesByMonth(yearMonth);
        return normalizeIssuesForMonth(issues, yearMonth);
    },

    async renumberIssuesByMonth(yearMonth: string): Promise<TaxInvoiceIssue[]> {
        const issues = await fetchIssuesByMonth(yearMonth);
        return normalizeIssuesForMonth(issues, yearMonth);
    },

    /**
     * 해당 월 현장 데이터 기반 공수 합산
     * dailyReportService.getWorkerRows()를 통해 worker 레벨까지 반영된 정확한 데이터를 가져옵니다.
     * - siteType/paymentType: worker → report → site 3단 fallback
     * - teamName: 실제 투입팀(workerTeamName) 우선
     * - companyName: 회사 DB 상호명 우선
     */
    async fetchMonthlySiteData(yearMonth: string): Promise<SiteWorkSummary[]> {
        const [year, month] = yearMonth.split('-');
        const startDate = `${year}-${month}-01`;
        const endDate = getMonthEndDate(yearMonth);

        const { dailyReportService } = await import('./dailyReportService');
        const { siteService } = await import('./siteService');
        const { teamService } = await import('./teamService');
        const { companyService } = await import('./companyService');

        const [rows, sites, teams, companies] = await Promise.all([
            dailyReportService.getWorkerRows({ startDate, endDate }),
            siteService.getSites(),
            teamService.getTeams(),
            companyService.getCompanies(),
        ]);

        const siteIdMap = new Map<string, any>();
        const siteNameMap = new Map<string, any>();
        sites.forEach(site => {
            if (site.id) siteIdMap.set(normalizeText(site.id), site);
            if ((site as any).legacyId) siteIdMap.set(normalizeText((site as any).legacyId), site);
            if (site.name && !siteNameMap.has(normalizeKey(site.name))) {
                siteNameMap.set(normalizeKey(site.name), site);
            }
        });

        const teamIdMap = new Map<string, any>();
        const teamNameMap = new Map<string, any>();
        teams.forEach(team => {
            if (team.id) teamIdMap.set(normalizeText(team.id), team);
            if ((team as any).legacyId) teamIdMap.set(normalizeText((team as any).legacyId), team);
            if (team.name && !teamNameMap.has(normalizeKey(team.name))) {
                teamNameMap.set(normalizeKey(team.name), team);
            }
        });

        const companyIdMap = new Map<string, any>();
        const companyNameMap = new Map<string, any>();
        companies.forEach(company => {
            if (company.id) companyIdMap.set(normalizeText(company.id), company);
            if ((company as any).legacyId) companyIdMap.set(normalizeText((company as any).legacyId), company);
            if (company.name && !companyNameMap.has(normalizeKey(company.name))) {
                companyNameMap.set(normalizeKey(company.name), company);
            }
        });

        const findTeam = (...candidates: Array<unknown>) => {
            for (const candidate of candidates) {
                const text = normalizeText(candidate);
                if (text && teamIdMap.has(text)) return teamIdMap.get(text);
            }
            for (const candidate of candidates) {
                const key = normalizeKey(candidate);
                if (key && teamNameMap.has(key)) return teamNameMap.get(key);
            }
            return undefined;
        };

        const findCompany = (candidateIds: Array<unknown>, candidateNames: Array<unknown>) => {
            for (const candidate of candidateIds) {
                const text = normalizeText(candidate);
                if (text && companyIdMap.has(text)) return companyIdMap.get(text);
            }
            for (const candidate of candidateNames) {
                const key = normalizeKey(candidate);
                if (key && companyNameMap.has(key)) return companyNameMap.get(key);
            }
            return undefined;
        };

        const resolveCompanyName = (candidateIds: Array<unknown>, candidateNames: Array<unknown>) => {
            const company = findCompany(candidateIds, candidateNames);
            if (company?.name) return normalizeText(company.name);
            return candidateNames.map(normalizeText).find(value => value && !isGenericCompanyLabel(value)) || '';
        };

        const resolveSiteCompanyName = (site: any, siteType: string) => {
            if (!site) return '';

            if (siteType === '지원') {
                return resolveCompanyName(
                    [site.partnerId, site.clientCompanyId, site.companyId],
                    [site.partnerName, site.clientCompanyName, site.companyName]
                );
            }

            return resolveCompanyName(
                [site.clientCompanyId, site.companyId],
                [site.clientCompanyName, site.companyName]
            );
        };

        const aggregateMap = new Map<string, SiteWorkSummary>();

        rows.forEach(row => {
            const siteName = normalizeText(row.siteName);
            const siteId = normalizeText(row.siteId);
            const siteType = normalizeText(row.siteType);
            const paymentType = normalizeText(row.paymentType);

            const workTeam = findTeam(
                row.workerTeamId,
                row.workerTeamName,
                row.teamId,
                row.teamName
            );
            const responsibleTeam = findTeam(
                row.responsibleTeamId,
                row.responsibleTeamName,
                row.teamId,
                row.teamName
            );
            const team = workTeam || responsibleTeam;
            const teamName = normalizeText(team?.name) || normalizeText(row.workerTeamName) || normalizeText(row.teamName) || normalizeText(row.responsibleTeamName);

            const site = (siteId ? siteIdMap.get(siteId) : undefined) ?? siteNameMap.get(normalizeKey(siteName));

            const teamCompanyName = resolveCompanyName(
                [team?.companyId, workTeam?.companyId, responsibleTeam?.companyId],
                [team?.companyName, workTeam?.companyName, responsibleTeam?.companyName]
            );
            const isSupportTeamRow = (
                siteType === '지원' ||
                /지원|용역/.test(`${row.salaryModel || ''} ${row.payType || ''} ${team?.type || ''} ${teamName}`)
            );
            const companyName = isSupportTeamRow
                ? (teamCompanyName || resolveSiteCompanyName(site, siteType))
                : (resolveSiteCompanyName(site, siteType) || teamCompanyName);

            const teamKey = normalizeText(team?.id) || normalizeText(row.workerTeamId) || teamName;
            const key = `${siteId || siteName}|${siteType}|${paymentType}|${teamKey}|${companyName}`;

            if (aggregateMap.has(key)) {
                aggregateMap.get(key)!.manDays += row.manDay;
            } else {
                aggregateMap.set(key, {
                    siteId,
                    siteName,
                    manDays: row.manDay,
                    teamName,
                    companyName,
                    siteType,
                    paymentType,
                    note: '',
                });
            }
        });

        // 공수를 소수점 첫째 자리까지 반올림
        const results = Array.from(aggregateMap.values());
        results.forEach(s => { s.manDays = Math.round(s.manDays * 10) / 10; });
        return results.sort((a, b) => a.siteName.localeCompare(b.siteName, 'ko'));
    },
};
