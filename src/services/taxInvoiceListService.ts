import {
    collection,
    doc,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { TaxInvoiceIssue, SiteWorkSummary } from '../types/taxInvoiceList';

const COLLECTION_NAME = 'tax_invoice_issues';

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
        const { writeBatch } = await import('firebase/firestore');
        const batch = writeBatch(db);
        ids.forEach(id => {
            batch.delete(doc(db, COLLECTION_NAME, id));
        });
        await batch.commit();
    },

    async getIssuesByMonth(yearMonth: string): Promise<TaxInvoiceIssue[]> {
        // 복합 인덱스 없이도 동작하도록 where만 사용 후 in-memory 정렬
        const q = query(
            collection(db, COLLECTION_NAME),
            where('yearMonth', '==', yearMonth)
        );
        const snap = await getDocs(q);
        const issues = snap.docs.map(d => ({ id: d.id, ...d.data() } as TaxInvoiceIssue));
        return issues.sort((a, b) => (a.no || 0) - (b.no || 0));
    },

    /**
     * 해당 월 현장 데이터 기반 공수 합산
     * dailyReportService.getWorkerRows()를 통해 worker 레벨까지 반영된 정확한 데이터를 가져옵니다.
     * - siteType/paymentType: worker → report → site 3단 fallback
     * - teamName: responsibleTeamName (현장담당팀)
     * - companyName: siteService.getSites()에서 매핑
     */
    async fetchMonthlySiteData(yearMonth: string): Promise<SiteWorkSummary[]> {
        const [year, month] = yearMonth.split('-');
        const startDate = `${year}-${month}-01`;
        const lastDay = new Date(Number(year), Number(month), 0).getDate();
        const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

        const { dailyReportService } = await import('./dailyReportService');
        const { siteService } = await import('./siteService');

        // getWorkerRows: worker 레벨 siteType/paymentType/responsibleTeamName 반영
        const rows = await dailyReportService.getWorkerRows({ startDate, endDate });

        // sites에서 companyName 매핑
        const sites = await siteService.getSites();
        const siteIdMap = new Map<string, any>();
        const siteNameMap = new Map<string, any>();
        sites.forEach(site => {
            if (site.id) siteIdMap.set(String(site.id).trim(), site);
            if ((site as any).legacyId) siteIdMap.set(String((site as any).legacyId).trim(), site);
            if (site.name && !siteNameMap.has(String(site.name).trim())) {
                siteNameMap.set(String(site.name).trim(), site);
            }
        });

        // 현장별 집계 키: siteId|siteType|paymentType
        const aggregateMap = new Map<string, SiteWorkSummary>();

        rows.forEach(row => {
            const siteName = row.siteName || '';
            const siteId = row.siteId || '';
            const siteType = row.siteType || '';
            const paymentType = row.paymentType || '';

            // 현장담당팀 (responsibleTeamName)
            const teamName = row.responsibleTeamName || row.teamName || '';

            // 현장 데이터 조회
            const site = siteId
                ? siteIdMap.get(siteId.trim())
                : siteNameMap.get(siteName.trim());

            // 발주사 또는 협력사 결정: 현장구분이 '지원'인 경우 협력사(partnerName)를 우선 사용
            let companyName: string = '';
            if (siteType === '지원') {
                companyName = (site as any)?.partnerName || (site as any)?.clientCompanyName || (site as any)?.companyName || '';
            } else {
                companyName = (site as any)?.clientCompanyName || (site as any)?.companyName || '';
            }

            const key = `${siteId || siteName}|${siteType}|${paymentType}`;

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
