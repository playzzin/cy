import {
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    query,
    serverTimestamp,
    setDoc,
    where,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import {
    SupportClientAllocationSchema,
    SupportClientAllocationZod as SupportClientAllocation,
    SupportClientAllocationLineZod as SupportClientAllocationLine,
} from '../types/zod/supportClientAllocationSchema';
import { createConverter } from '../utils/firestoreConverter';
import { stripUndefinedFields } from '../utils/stripUndefinedFields';
import { officeService } from './officeService';

export type { SupportClientAllocation, SupportClientAllocationLine };

const COLLECTION_NAME = 'support_client_site_allocations';
const allocationConverter = createConverter(SupportClientAllocationSchema);

const toFiniteNumber = (value: unknown): number => {
    const parsed = typeof value === 'number'
        ? value
        : Number(String(value ?? '').replace(/,/g, '').trim());
    return Number.isFinite(parsed) ? parsed : 0;
};

const getMonthEndDate = (yearMonth: string): string => {
    const [yearRaw, monthRaw] = String(yearMonth || '').split('-');
    const year = Number(yearRaw);
    const month = Number(monthRaw);
    if (!Number.isFinite(year) || !Number.isFinite(month)) return new Date().toISOString().slice(0, 10);
    const lastDay = new Date(year, month, 0).getDate();
    return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
};

const getAllocationDocId = (yearMonth: string, siteKey: string): string =>
    `${String(yearMonth || 'unknown-month').replace(/[^0-9-]/g, '')}__${encodeURIComponent(siteKey || 'unknown-site')}`;

const getOfficeTransactionId = (allocationId: string, lineId: string): string =>
    `SUPPORT_SITE_ALLOCATION_${encodeURIComponent(allocationId)}_${encodeURIComponent(lineId)}`;

const shouldSyncOfficeIncome = (line: SupportClientAllocationLine): boolean =>
    line.targetType === 'office_income' &&
    toFiniteNumber(line.amount) > 0 &&
    line.status !== 'draft';

const normalizeAllocation = (allocation: SupportClientAllocation): SupportClientAllocation => {
    const lines = (allocation.lines || []).map((line) => ({
        ...line,
        amount: toFiniteNumber(line.amount),
        targetType: line.targetType || 'other',
        processType: line.processType || (line.targetType === 'office_income' ? 'office_income' : 'payable'),
        status: line.status || 'confirmed',
    }));
    return {
        ...allocation,
        issuedAmount: toFiniteNumber(allocation.issuedAmount),
        settlementAmount: toFiniteNumber(allocation.settlementAmount),
        distributableAmount: toFiniteNumber(allocation.distributableAmount),
        allocatedAmount: lines.reduce((sum, line) => sum + toFiniteNumber(line.amount), 0),
        status: allocation.status || 'draft',
        lines,
    };
};

const syncOfficeIncomeTransactions = async (
    allocation: SupportClientAllocation,
    previous?: SupportClientAllocation | null
): Promise<void> => {
    const allocationId = allocation.id || getAllocationDocId(allocation.yearMonth, allocation.siteKey);
    const previousOfficeIds = new Set(
        (previous?.lines || [])
            .filter(shouldSyncOfficeIncome)
            .map((line) => getOfficeTransactionId(allocationId, line.id))
    );
    const nextOfficeIds = new Set(
        (allocation.lines || [])
            .filter(shouldSyncOfficeIncome)
            .map((line) => getOfficeTransactionId(allocationId, line.id))
    );

    await Promise.all(
        Array.from(previousOfficeIds)
            .filter((id) => !nextOfficeIds.has(id))
            .map((id) => officeService.deleteTransaction(id).catch(() => undefined))
    );

    const now = new Date().toISOString();
    await Promise.all(
        (allocation.lines || [])
            .filter(shouldSyncOfficeIncome)
            .map((line) => officeService.setTransaction({
                id: getOfficeTransactionId(allocationId, line.id),
                date: line.dueDate || getMonthEndDate(allocation.yearMonth),
                type: 'income',
                category: 'SITE_PAYBACK',
                subCategory: '지원정산 차액 배분',
                amount: toFiniteNumber(line.amount),
                description: `${allocation.yearMonth} ${allocation.clientCompanyName || '발주사'} / ${allocation.siteName || '현장'} 차액 배분 - ${line.targetName || '사무실 수입'}`,
                relatedSiteId: allocation.siteId || allocation.siteKey,
                relatedYearMonth: allocation.yearMonth,
                source: 'support_client_site_allocation',
                createdAt: now,
                updatedAt: now,
            }))
    );
};

export const supportClientSiteAllocationService = {
    getDocumentId: getAllocationDocId,

    getCollection() {
        return collection(db, COLLECTION_NAME).withConverter(allocationConverter);
    },

    async getAllocationsByMonth(yearMonth: string): Promise<SupportClientAllocation[]> {
        const q = query(this.getCollection(), where('yearMonth', '==', yearMonth));
        const snap = await getDocs(q);
        return snap.docs
            .map((item) => normalizeAllocation(item.data()))
            .sort((a, b) => String(a.siteName || '').localeCompare(String(b.siteName || ''), 'ko'));
    },

    async getAllocation(yearMonth: string, siteKey: string): Promise<SupportClientAllocation | null> {
        const id = getAllocationDocId(yearMonth, siteKey);
        const snap = await getDoc(doc(db, COLLECTION_NAME, id).withConverter(allocationConverter));
        return snap.exists() ? normalizeAllocation(snap.data()) : null;
    },

    async upsertAllocation(allocation: SupportClientAllocation): Promise<string> {
        const id = allocation.id || getAllocationDocId(allocation.yearMonth, allocation.siteKey);
        const ref = doc(db, COLLECTION_NAME, id).withConverter(allocationConverter);
        const previousSnap = await getDoc(ref);
        const previous = previousSnap.exists() ? normalizeAllocation(previousSnap.data()) : null;
        const normalized = normalizeAllocation({
            ...allocation,
            id,
        });

        await setDoc(ref, {
            ...stripUndefinedFields(normalized as Record<string, unknown>),
            updatedAt: serverTimestamp(),
            ...(previous ? {} : { createdAt: serverTimestamp() }),
        } as any, { merge: true });

        await syncOfficeIncomeTransactions(normalized, previous);
        return id;
    },

    async deleteAllocation(yearMonth: string, siteKey: string): Promise<void> {
        const id = getAllocationDocId(yearMonth, siteKey);
        const current = await this.getAllocation(yearMonth, siteKey);
        if (current) {
            await Promise.all(
                (current.lines || [])
                    .filter(shouldSyncOfficeIncome)
                    .map((line) => officeService.deleteTransaction(getOfficeTransactionId(id, line.id)).catch(() => undefined))
            );
        }
        await deleteDoc(doc(db, COLLECTION_NAME, id));
    },
};
