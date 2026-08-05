import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '../config/firebase';
import { normalizeWorkbookNumber } from '../utils/workbookLedgerParsing';
import type { WorkbookLedgerTenant } from './workbookLedgerService';

export type QuarterVatPaymentQuarter = 'all' | 'Q1' | 'Q2' | 'Q3' | 'Q4';

export interface QuarterVatPaymentRecord {
    id: string;
    year: number;
    quarter: QuarterVatPaymentQuarter;
    date: string;
    amount: number;
    note: string;
    createdAt: string;
    createdBy: string;
}

interface AddQuarterVatPaymentInput {
    year: number;
    quarter: QuarterVatPaymentQuarter;
    date: string;
    amount: number;
    note?: string;
    createdBy?: string;
}

export interface QuarterVatPaymentService {
    getPayments(year: number, quarter: QuarterVatPaymentQuarter): Promise<QuarterVatPaymentRecord[]>;
    addPayment(input: AddQuarterVatPaymentInput): Promise<QuarterVatPaymentRecord>;
    deletePayment(year: number, quarter: QuarterVatPaymentQuarter, paymentId: string): Promise<void>;
}

const DEFAULT_COLLECTION_NAME = 'quarter_vat_payments';
const TENANT_COLLECTIONS: Record<WorkbookLedgerTenant, string> = {
    cheongyeon: DEFAULT_COLLECTION_NAME,
    dawon: 'quarter_vat_payments_dawon'
};

const VALID_QUARTERS = new Set<QuarterVatPaymentQuarter>(['all', 'Q1', 'Q2', 'Q3', 'Q4']);
const PAYABLE_QUARTERS: QuarterVatPaymentQuarter[] = ['Q1', 'Q2', 'Q3', 'Q4'];

const resolveCollectionName = (tenantKey: WorkbookLedgerTenant | string): string => {
    const mapped = TENANT_COLLECTIONS[tenantKey as WorkbookLedgerTenant];
    if (mapped) return mapped;

    const normalized = tenantKey.trim().toLowerCase();
    return normalized ? `${DEFAULT_COLLECTION_NAME}_${normalized}` : DEFAULT_COLLECTION_NAME;
};

const normalizeYear = (value: unknown): number => {
    const year = Math.trunc(normalizeWorkbookNumber(value, 0));
    if (year < 2000 || year > 2100) throw new Error('납부금액의 연도가 올바르지 않습니다.');
    return year;
};

const normalizeQuarter = (value: unknown): QuarterVatPaymentQuarter => {
    const quarter = String(value ?? '').trim() as QuarterVatPaymentQuarter;
    if (!VALID_QUARTERS.has(quarter)) throw new Error('납부금액의 분기 값이 올바르지 않습니다.');
    return quarter;
};

const normalizeAmount = (value: unknown): number => Math.max(0, normalizeWorkbookNumber(value, 0));
const normalizeText = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const buildPaymentId = (year: number, quarter: QuarterVatPaymentQuarter) => `${year}_${quarter}`;
const normalizeDate = (value: unknown): string => {
    const date = normalizeText(value);
    return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '';
};

const normalizePayment = (id: string, data: Record<string, unknown>): QuarterVatPaymentRecord => ({
    id,
    year: normalizeYear(data.year),
    quarter: normalizeQuarter(data.quarter),
    date: normalizeDate(data.date),
    amount: normalizeAmount(data.amount),
    note: normalizeText(data.note),
    createdAt: normalizeText(data.createdAt),
    createdBy: normalizeText(data.createdBy),
});

const sortPayments = (left: QuarterVatPaymentRecord, right: QuarterVatPaymentRecord) => {
    const dateCompare = right.date.localeCompare(left.date, 'en');
    if (dateCompare !== 0) return dateCompare;
    return right.createdAt.localeCompare(left.createdAt, 'en');
};

export const createQuarterVatPaymentService = (
    tenantKey: WorkbookLedgerTenant | string = 'cheongyeon'
): QuarterVatPaymentService => {
    const collectionName = resolveCollectionName(tenantKey);

    const getPaymentsForQuarter = async (year: number, quarter: QuarterVatPaymentQuarter) => {
        const paymentCollection = collection(db, collectionName, buildPaymentId(year, quarter), 'payments');
        const paymentSnapshot = await getDocs(query(paymentCollection, orderBy('date', 'desc')));

        return paymentSnapshot.docs
            .map((paymentDoc) => normalizePayment(paymentDoc.id, paymentDoc.data() as Record<string, unknown>))
            .filter((payment) => payment.date && payment.amount > 0);
    };

    return {
        async getPayments(year, quarter) {
            const normalizedYear = normalizeYear(year);
            const normalizedQuarter = normalizeQuarter(quarter);
            const quarters = normalizedQuarter === 'all' ? PAYABLE_QUARTERS : [normalizedQuarter];
            const paymentGroups = await Promise.all(
                quarters.map((paymentQuarter) => getPaymentsForQuarter(normalizedYear, paymentQuarter))
            );

            return paymentGroups.flat().sort(sortPayments);
        },

        async addPayment(input) {
            const year = normalizeYear(input.year);
            const quarter = normalizeQuarter(input.quarter);
            if (quarter === 'all') throw new Error('납부 내역은 분기를 선택한 뒤 등록해주세요.');

            const date = normalizeDate(input.date);
            if (!date) throw new Error('납부일을 올바르게 입력해주세요.');

            const amount = normalizeAmount(input.amount);
            if (amount <= 0) throw new Error('납부금액은 0원보다 커야 합니다.');

            const createdAt = new Date().toISOString();
            const payment = {
                year,
                quarter,
                date,
                amount,
                note: normalizeText(input.note),
                createdAt,
                createdBy: normalizeText(input.createdBy)
            };
            const paymentCollection = collection(db, collectionName, buildPaymentId(year, quarter), 'payments');
            const paymentDocument = await addDoc(paymentCollection, payment);

            return { id: paymentDocument.id, ...payment };
        },

        async deletePayment(year, quarter, paymentId) {
            const normalizedYear = normalizeYear(year);
            const normalizedQuarter = normalizeQuarter(quarter);
            if (normalizedQuarter === 'all') throw new Error('전체 조회에서는 납부 내역을 삭제할 수 없습니다.');

            const normalizedPaymentId = normalizeText(paymentId);
            if (!normalizedPaymentId) throw new Error('삭제할 납부 내역이 없습니다.');

            await deleteDoc(
                doc(db, collectionName, buildPaymentId(normalizedYear, normalizedQuarter), 'payments', normalizedPaymentId)
            );
        }
    };
};
