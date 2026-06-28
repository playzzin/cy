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

type SiteLookupRow = {
    id?: unknown;
    legacyId?: unknown;
    name?: unknown;
    clientCompanyName?: unknown;
    companyName?: unknown;
    constructorCompanyName?: unknown;
    partnerName?: unknown;
};

const buildSiteLookup = (sites: SiteLookupRow[]): Map<string, SiteLookupRow> => {
    const map = new Map<string, SiteLookupRow>();
    sites.forEach((site) => {
        [site.id, site.legacyId, site.name].forEach((value) => {
            const key = normalizeKey(value);
            if (key) map.set(key, site);
        });
    });
    return map;
};

const resolveCurrentSiteCompanyName = (
    site: SiteLookupRow | undefined,
    siteType: string,
    fallback = ''
): string => {
    if (!site) return fallback;
    const candidateNames = siteType === '지원'
        ? [site.partnerName, site.clientCompanyName, site.companyName, site.constructorCompanyName]
        : [site.clientCompanyName, site.companyName, site.constructorCompanyName, site.partnerName];

    return candidateNames.map(normalizeText).find(value => value && !isGenericCompanyLabel(value)) || fallback;
};

const findSiteFromLookup = (siteLookup: Map<string, SiteLookupRow>, siteId?: unknown, siteName?: unknown): SiteLookupRow | undefined => {
    const idKey = normalizeKey(siteId);
    if (idKey && siteLookup.has(idKey)) return siteLookup.get(idKey);
    const nameKey = normalizeKey(siteName);
    return nameKey ? siteLookup.get(nameKey) : undefined;
};

const syncIssueRecipientsWithCurrentSites = async (issues: TaxInvoiceIssue[]): Promise<TaxInvoiceIssue[]> => {
    if (issues.length === 0) return issues;

    const { siteService } = await import('./siteService');
    const sites = await siteService.getSites().catch(() => [] as SiteLookupRow[]);
    const siteLookup = buildSiteLookup(sites);
    if (siteLookup.size === 0) return issues;

    const normalized = issues.map((issue) => {
        const site = findSiteFromLookup(siteLookup, issue.siteId, issue.siteName || issue.note);
        const currentRecipient = resolveCurrentSiteCompanyName(site, normalizeText(issue.siteType), normalizeText(issue.recipient));
        return currentRecipient && currentRecipient !== issue.recipient
            ? { ...issue, recipient: currentRecipient }
            : issue;
    });

    let batch = writeBatch(db);
    let pendingWrites = 0;

    for (const issue of normalized) {
        const original = issues.find((row) => row.id === issue.id);
        if (!issue.id || !original || original.recipient === issue.recipient) continue;

        batch.update(doc(db, COLLECTION_NAME, issue.id), {
            recipient: issue.recipient,
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
        const siteSyncedIssues = await syncIssueRecipientsWithCurrentSites(issues);
        return normalizeIssuesForMonth(siteSyncedIssues, yearMonth);
    },

    async getDeferredIssuesByMonth(yearMonth: string): Promise<TaxInvoiceIssue[]> {
        const issues = await fetchIssuesByMonth(yearMonth);
        return sortIssuesByNo(issues.filter(issue => issue.issueStatus === 'deferred'));
    },

    async renumberIssuesByMonth(yearMonth: string): Promise<TaxInvoiceIssue[]> {
        const issues = await fetchIssuesByMonth(yearMonth);
        return normalizeIssuesForMonth(issues, yearMonth);
    },

    /**
     * 해당 월 출력일보 저장값 기준 공수 합산.
     * 공급받는자는 현재 현장 마스터의 발주사명을 우선 사용합니다.
     */
    async fetchMonthlySiteData(yearMonth: string): Promise<SiteWorkSummary[]> {
        const [year, month] = yearMonth.split('-');
        const startDate = `${year}-${month}-01`;
        const endDate = getMonthEndDate(yearMonth);

        const [{ dailyReportService }, { siteService }] = await Promise.all([
            import('./dailyReportService'),
            import('./siteService'),
        ]);
        const [rows, sites] = await Promise.all([
            dailyReportService.getWorkerRows({ startDate, endDate }),
            siteService.getSites().catch(() => [] as SiteLookupRow[]),
        ]);
        const siteLookup = buildSiteLookup(sites);

        const resolveSavedReportCompanyName = (row: any, siteType: string) => {
            const candidateNames = siteType === '지원'
                ? [row.partnerName, row.companyName, row.constructorCompanyName]
                : [row.companyName, row.constructorCompanyName, row.partnerName];

            return candidateNames.map(normalizeText).find(value => value && !isGenericCompanyLabel(value)) || '';
        };

        const aggregateMap = new Map<string, SiteWorkSummary>();

        rows.forEach(row => {
            const siteName = normalizeText(row.siteName);
            const siteId = normalizeText(row.siteId);
            const siteType = normalizeText(row.siteType);
            const paymentType = normalizeText(row.paymentType);
            const teamName = (
                normalizeText(row.responsibleTeamName) ||
                normalizeText(row.teamName) ||
                normalizeText(row.workerTeamName)
            );

            const savedCompanyName = resolveSavedReportCompanyName(row, siteType);
            const site = findSiteFromLookup(siteLookup, siteId, siteName);
            const companyName = resolveCurrentSiteCompanyName(site, siteType, savedCompanyName);

            const teamKey = normalizeText(row.responsibleTeamId) || normalizeText(row.responsibleTeamName) || normalizeText(row.teamId) || teamName;
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
