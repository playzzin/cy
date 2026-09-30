import {
    collection,
    doc,
    getDocs,
    getDocsFromServer,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    writeBatch,
    serverTimestamp,
    runTransaction,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { TaxInvoiceIssue, SiteWorkSummary } from '../types/taxInvoiceList';
import { assertValidIssueDate, assertValidIssueNumbers, getDeleteConflictFields, IssueBatchWriteError, IssueDeleteConflictError, IssueSaveConflict, IssueSaveConflictError, IssueUpdate, sameIssueField } from '../utils/taxInvoiceIssueDraft';

const COLLECTION_NAME = 'tax_invoice_issues';
const BATCH_WRITE_LIMIT = 450;

const normalizeText = (value: unknown): string => String(value ?? '').trim();

const normalizeKey = (value: unknown): string => normalizeText(value).replace(/\s+/g, '').toLowerCase();

const compareKoreanText = (left: unknown, right: unknown): number =>
    normalizeText(left).localeCompare(normalizeText(right), 'ko-KR', {
        numeric: true,
        sensitivity: 'base',
    });

const compareKoreanTextEmptyLast = (left: unknown, right: unknown): number => {
    const leftText = normalizeText(left);
    const rightText = normalizeText(right);
    if (leftText && !rightText) return -1;
    if (!leftText && rightText) return 1;
    return compareKoreanText(leftText, rightText);
};

const compareSiteWorkSummary = (left: SiteWorkSummary, right: SiteWorkSummary): number => {
    const teamDiff = compareKoreanTextEmptyLast(left.teamName, right.teamName);
    if (teamDiff !== 0) return teamDiff;

    const siteDiff = compareKoreanTextEmptyLast(left.siteName, right.siteName);
    if (siteDiff !== 0) return siteDiff;

    const companyDiff = compareKoreanTextEmptyLast(left.companyName, right.companyName);
    if (companyDiff !== 0) return companyDiff;

    const siteTypeDiff = compareKoreanText(left.siteType, right.siteType);
    if (siteTypeDiff !== 0) return siteTypeDiff;

    return compareKoreanText(left.paymentType, right.paymentType);
};

const GENERIC_COMPANY_LABEL_KEYS = new Set(['외부팀', '지원팀', '용역팀', '미지정']);

const isGenericCompanyLabel = (value: unknown): boolean => GENERIC_COMPANY_LABEL_KEYS.has(normalizeKey(value));

type SiteLookupRow = {
    id?: unknown;
    legacyId?: unknown;
    name?: unknown;
    clientCompanyId?: unknown;
    clientCompanyName?: unknown;
    companyId?: unknown;
    companyName?: unknown;
    constructorCompanyId?: unknown;
    constructorCompanyName?: unknown;
    partnerId?: unknown;
    partnerName?: unknown;
};

type CompanyLookupRow = {
    id?: unknown;
    legacyId?: unknown;
    name?: unknown;
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

const buildCompanyLookup = (companies: CompanyLookupRow[]): Map<string, CompanyLookupRow> => {
    const map = new Map<string, CompanyLookupRow>();
    companies.forEach((company) => {
        [company.id, company.legacyId, company.name].forEach((value) => {
            const key = normalizeKey(value);
            if (key) map.set(key, company);
        });
    });
    return map;
};

const resolveCompanyNameById = (
    companyLookup: Map<string, CompanyLookupRow> | undefined,
    companyId?: unknown
): string => {
    const key = normalizeKey(companyId);
    if (!key || !companyLookup) return '';
    return normalizeText(companyLookup.get(key)?.name);
};

const resolveCurrentSiteCompanyName = (
    site: SiteLookupRow | undefined,
    siteType: string,
    fallback = '',
    companyLookup?: Map<string, CompanyLookupRow>
): string => {
    if (!site) return fallback;
    const candidateNames = siteType === '지원'
        ? [
            resolveCompanyNameById(companyLookup, site.partnerId),
            site.partnerName,
            resolveCompanyNameById(companyLookup, site.clientCompanyId),
            site.clientCompanyName,
            resolveCompanyNameById(companyLookup, site.companyId),
            site.companyName,
            resolveCompanyNameById(companyLookup, site.constructorCompanyId),
            site.constructorCompanyName,
        ]
        : [
            resolveCompanyNameById(companyLookup, site.clientCompanyId),
            site.clientCompanyName,
            resolveCompanyNameById(companyLookup, site.companyId),
            site.companyName,
            resolveCompanyNameById(companyLookup, site.constructorCompanyId),
            site.constructorCompanyName,
            resolveCompanyNameById(companyLookup, site.partnerId),
            site.partnerName,
        ];

    return candidateNames.map(normalizeText).find(value => value && !isGenericCompanyLabel(value)) || fallback;
};

const findSiteFromLookup = (siteLookup: Map<string, SiteLookupRow>, siteId?: unknown, siteName?: unknown): SiteLookupRow | undefined => {
    const idKey = normalizeKey(siteId);
    if (idKey && siteLookup.has(idKey)) return siteLookup.get(idKey);
    const nameKey = normalizeKey(siteName);
    return nameKey ? siteLookup.get(nameKey) : undefined;
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

const fetchIssuesByMonth = async (yearMonth: string, fromServer = false): Promise<TaxInvoiceIssue[]> => {
    // Use only where so the query does not require a composite Firestore index.
    const q = query(
        collection(db, COLLECTION_NAME),
        where('yearMonth', '==', yearMonth)
    );
    const snap = await (fromServer ? getDocsFromServer(q) : getDocs(q));
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as TaxInvoiceIssue));
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

const normalizeIssuesForMonth = async (
    issues: TaxInvoiceIssue[]
): Promise<TaxInvoiceIssue[]> => normalizeIssueNos(issues);

export const taxInvoiceListService = {
    async deleteIssuesWithConflictCheck(ids: string[], savedIssues: TaxInvoiceIssue[]): Promise<void> {
        const savedById = new Map(savedIssues.map(issue => [issue.id, issue]));
        const uniqueIds = new Set(ids);
        if (uniqueIds.size !== ids.length || ids.some(id => !id || !savedById.has(id))) {
            throw new Error('삭제 기준 항목을 확인해주세요.');
        }
        const completedIds: string[] = [];
        for (let start = 0; start < ids.length; start += BATCH_WRITE_LIMIT) {
            const chunk = ids.slice(start, start + BATCH_WRITE_LIMIT);
            try {
                await runTransaction(db, async transaction => {
                    const refs = chunk.map(id => doc(db, COLLECTION_NAME, id));
                    const snapshots = await Promise.all(refs.map(ref => transaction.get(ref)));
                    const conflicts: IssueSaveConflict[] = [];
                    snapshots.forEach((snapshot, index) => {
                        // A confirmed absence is already the requested result; do not recreate it.
                        if (!snapshot.exists()) return;
                        const id = chunk[index];
                        const current = { ...snapshot.data(), id: snapshot.id } as TaxInvoiceIssue;
                        const fields = getDeleteConflictFields(current, savedById.get(id)!);
                        if (fields.length) conflicts.push({ id, current, fields, operation: 'delete' });
                    });
                    if (conflicts.length) throw new IssueDeleteConflictError(conflicts);
                    snapshots.forEach((snapshot, index) => { if (snapshot.exists()) transaction.delete(refs[index]); });
                });
                completedIds.push(...chunk);
            } catch (error) {
                throw new IssueBatchWriteError(completedIds, error);
            }
        }
    },

    async saveIssuesWithConflictCheck(updates: IssueUpdate[], savedIssues: TaxInvoiceIssue[]): Promise<void> {
        const savedById = new Map(savedIssues.map(issue => [issue.id, issue]));
        const ids = new Set<string>();
        // Validate everything before the first transaction so invalid late rows cannot partially save.
        updates.forEach(({ id, data }) => {
            assertValidIssueDate(data);
            assertValidIssueNumbers(data);
            if (!id || ids.has(id) || !savedById.has(id)) throw new Error('저장 기준 항목을 확인해주세요.');
            ids.add(id);
        });
        const completedIds: string[] = [];
        for (let start = 0; start < updates.length; start += BATCH_WRITE_LIMIT) {
            const chunk = updates.slice(start, start + BATCH_WRITE_LIMIT);
            try {
                await runTransaction(db, async transaction => {
                    const refs = chunk.map(({ id }) => doc(db, COLLECTION_NAME, id));
                    const snapshots = await Promise.all(refs.map(ref => transaction.get(ref)));
                    const conflicts: IssueSaveConflict[] = [];
                    chunk.forEach(({ id, data }, index) => {
                        const snapshot = snapshots[index];
                        const saved = savedById.get(id)!;
                        const fields = Object.keys(data) as Array<keyof TaxInvoiceIssue>;
                        if (!snapshot.exists()) {
                            conflicts.push({ id, current: null, fields });
                            return;
                        }
                        const current = { ...snapshot.data(), id: snapshot.id } as TaxInvoiceIssue;
                        // Compare only fields being edited; unrelated edits and renumbering can coexist.
                        const changedFields = fields.filter(field => !sameIssueField(field, current[field], saved[field])
                            && !sameIssueField(field, current[field], data[field]));
                        if (current.yearMonth !== saved.yearMonth || changedFields.length) {
                            conflicts.push({ id, current, fields: changedFields.length ? changedFields : fields });
                        }
                    });
                    if (conflicts.length) throw new IssueSaveConflictError(conflicts);
                    chunk.forEach(({ data }, index) => transaction.update(refs[index], { ...data, updatedAt: serverTimestamp() }));
                });
                completedIds.push(...chunk.map(({ id }) => id));
            } catch (error) {
                throw new IssueBatchWriteError(completedIds, error);
            }
        }
    },

    async importDeferredIssue(
        data: Omit<TaxInvoiceIssue, 'id' | 'createdAt' | 'updatedAt'>
    ): Promise<{ issue: TaxInvoiceIssue; created: boolean }> {
        assertValidIssueDate(data);
        assertValidIssueNumbers(data);
        if (!data.carriedFromIssueId || !data.carriedFromYearMonth || !/^\d{4}-\d{2}$/.test(data.yearMonth)) {
            throw new Error('이월 원본과 대상 월을 확인해주세요.');
        }
        // Preserve older imports which used random document IDs, including edited values.
        const existing = (await fetchIssuesByMonth(data.yearMonth, true)).find(issue =>
            issue.carriedFromIssueId === data.carriedFromIssueId
            && issue.carriedFromYearMonth === data.carriedFromYearMonth);
        if (existing) return { issue: existing, created: false };

        const key = JSON.stringify([data.yearMonth, data.carriedFromYearMonth, data.carriedFromIssueId]);
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
        const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
        const ref = doc(db, COLLECTION_NAME, `carryover_${hash}`);
        // Firestore retries competing transactions; never overwrite an existing invoice.
        return runTransaction(db, async transaction => {
            const snapshot = await transaction.get(ref);
            if (snapshot.exists()) return { issue: { ...snapshot.data(), id: snapshot.id } as TaxInvoiceIssue, created: false };
            transaction.set(ref, { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
            return { issue: { ...data, id: ref.id }, created: true };
        });
    },

    async addIssue(
        data: Omit<TaxInvoiceIssue, 'id' | 'createdAt' | 'updatedAt'>
    ): Promise<string> {
        assertValidIssueDate(data);
        assertValidIssueNumbers(data);
        const ref = await addDoc(collection(db, COLLECTION_NAME), {
            ...data,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
        return ref.id;
    },

    async updateIssue(id: string, data: Partial<TaxInvoiceIssue>): Promise<void> {
        assertValidIssueDate(data);
        assertValidIssueNumbers(data);
        const docRef = doc(db, COLLECTION_NAME, id);
        await updateDoc(docRef, {
            ...data,
            updatedAt: serverTimestamp(),
        });
    },

    async updateIssuesBatch(
        updates: Array<{ id: string; data: Partial<TaxInvoiceIssue> }>
    ): Promise<void> {
        // Validate the entire request before any batch is committed.
        updates.forEach(({ data }) => { assertValidIssueDate(data); assertValidIssueNumbers(data); });
        const completedIds: string[] = [];
        for (let start = 0; start < updates.length; start += BATCH_WRITE_LIMIT) {
            const chunk = updates.slice(start, start + BATCH_WRITE_LIMIT);
            try {
                const batch = writeBatch(db);
                chunk.forEach(({ id, data }) => {
                    batch.update(doc(db, COLLECTION_NAME, id), {
                        ...data,
                        updatedAt: serverTimestamp(),
                    });
                });
                await batch.commit();
                completedIds.push(...chunk.map(({ id }) => id));
            } catch (error) {
                throw new IssueBatchWriteError(completedIds, error);
            }
        }
    },

    async deleteIssue(id: string): Promise<void> {
        await deleteDoc(doc(db, COLLECTION_NAME, id));
    },

    async deleteIssuesBatch(ids: string[]): Promise<void> {
        const completedIds: string[] = [];
        for (let start = 0; start < ids.length; start += BATCH_WRITE_LIMIT) {
            const chunk = ids.slice(start, start + BATCH_WRITE_LIMIT);
            try {
                const batch = writeBatch(db);
                chunk.forEach(id => batch.delete(doc(db, COLLECTION_NAME, id)));
                await batch.commit();
                completedIds.push(...chunk);
            } catch (error) {
                throw new IssueBatchWriteError(completedIds, error);
            }
        }
    },

    async getIssuesByMonth(yearMonth: string): Promise<TaxInvoiceIssue[]> {
        const issues = await fetchIssuesByMonth(yearMonth);
        // Reading historical invoices must never change recipients or persist renumbering.
        // Current site data is applied only when the user imports new rows.
        return sortIssuesByNo(issues);
    },

    async getDeferredIssuesByMonth(yearMonth: string): Promise<TaxInvoiceIssue[]> {
        const issues = await fetchIssuesByMonth(yearMonth);
        return sortIssuesByNo(issues.filter(issue => issue.issueStatus === 'deferred'));
    },

    async renumberIssuesByMonth(yearMonth: string): Promise<TaxInvoiceIssue[]> {
        const issues = await fetchIssuesByMonth(yearMonth, true);
        return normalizeIssuesForMonth(issues);
    },

    /**
     * 해당 월 출력일보 저장값 기준 공수 합산.
     * 공급받는자는 현재 현장 마스터의 발주사명을 우선 사용합니다.
     */
    async fetchMonthlySiteData(yearMonth: string): Promise<SiteWorkSummary[]> {
        const [year, month] = yearMonth.split('-');
        const startDate = `${year}-${month}-01`;
        const endDate = getMonthEndDate(yearMonth);

        const [{ dailyReportService }, { siteService }, { companyService }] = await Promise.all([
            import('./dailyReportService'),
            import('./siteService'),
            import('./companyService'),
        ]);
        const [rows, sites, companies] = await Promise.all([
            dailyReportService.getWorkerRows({ startDate, endDate }),
            siteService.getSites().catch(() => [] as SiteLookupRow[]),
            companyService.getCompanies().catch(() => [] as CompanyLookupRow[]),
        ]);
        const siteLookup = buildSiteLookup(sites);
        const companyLookup = buildCompanyLookup(companies);

        const resolveSavedReportCompanyName = (row: any, siteType: string) => {
            const candidateNames = siteType === '지원'
                ? [
                    resolveCompanyNameById(companyLookup, row.partnerId),
                    row.partnerName,
                    resolveCompanyNameById(companyLookup, row.companyId),
                    row.companyName,
                    resolveCompanyNameById(companyLookup, row.constructorCompanyId),
                    row.constructorCompanyName,
                ]
                : [
                    resolveCompanyNameById(companyLookup, row.companyId),
                    row.companyName,
                    resolveCompanyNameById(companyLookup, row.constructorCompanyId),
                    row.constructorCompanyName,
                    resolveCompanyNameById(companyLookup, row.partnerId),
                    row.partnerName,
                ];

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
            const companyName = resolveCurrentSiteCompanyName(site, siteType, savedCompanyName, companyLookup);

            const teamKey = normalizeText(row.responsibleTeamId) || normalizeText(row.responsibleTeamName) || normalizeText(row.teamId) || teamName;
            const key = JSON.stringify([siteId || siteName, siteType, paymentType, teamKey, companyName]);

            if (aggregateMap.has(key)) {
                aggregateMap.get(key)!.manDays += row.manDay;
            } else {
                aggregateMap.set(key, {
                    sourceKey: key,
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
        return results.sort(compareSiteWorkSummary);
    },
};
