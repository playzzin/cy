/**
 * 입금/지급 Firestore 서비스
 * 
 * 입금 및 지급 기록을 관리하여 거래처별 잔액을 계산합니다.
 */

import app from '../config/firebase';
import { getDataConnect } from 'firebase/data-connect';
import {
    connectorConfig,
    listAllPayments as listAllPaymentsQuery,
    createPayment,
    updatePayment,
    deletePayment
} from './dataconnectCompat';
import { Timestamp } from '../types/timestamp';

// 입금/지급 타입
export type PaymentType = 'in' | 'out'; // 입금 / 지급

// 입금/지급 기록 인터페이스
export interface PaymentRecord {
    id?: string;

    // 기본 정보
    date: string;                    // 입금/지급일 (YYYY-MM-DD)
    type: PaymentType;               // 입금/지급 구분
    amount: number;                  // 금액

    // 거래처 정보
    companyId?: string;              // 거래처 ID (Firestore, 선택)
    companyName: string;             // 거래처명 (필수)

    // 연결 정보 (선택)
    siteId?: string;                 // 현장 ID
    siteName?: string;               // 현장명
    teamName?: string;               // 팀명 (추가)
    taxInvoiceId?: string;           // 연결된 세금계산서 ID

    // 추가 정보
    bankName?: string;               // 은행명
    accountNumber?: string;          // 계좌번호
    category?: string;               // 분류 (식대, 자재, 노무비 등)
    memo?: string;                   // 비고

    // 메타 정보
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
    createdBy?: string;
}

const dc = getDataConnect(app, connectorConfig);

const isUuidString = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const toTimestamp = (value: unknown): Timestamp | undefined => {
    if (!value) return undefined;
    if (value instanceof Timestamp) return value;
    if (typeof value === 'string') {
        const d = new Date(value);
        if (!Number.isNaN(d.getTime())) return Timestamp.fromDate(d);
        return undefined;
    }
    if (typeof value === 'object') {
        const obj = value as any;
        const seconds = obj?._seconds ?? obj?.seconds;
        const nanos = obj?._nanoseconds ?? obj?.nanoseconds ?? 0;
        if (typeof seconds === 'number' && Number.isFinite(seconds)) {
            return Timestamp.fromMillis(seconds * 1000 + Math.floor((typeof nanos === 'number' ? nanos : 0) / 1_000_000));
        }
    }
    return undefined;
};

const mapPaymentRowToRecord = (row: any): PaymentRecord => {
    const companyId = row?.company?.id
        ? String(row.company.id)
        : (row?.companyLegacyId ? String(row.companyLegacyId) : undefined);
    const siteId = row?.site?.id
        ? String(row.site.id)
        : (row?.siteLegacyId ? String(row.siteLegacyId) : undefined);
    const taxInvoiceId = row?.taxInvoice?.id
        ? String(row.taxInvoice.id)
        : (row?.taxInvoiceLegacyId ? String(row.taxInvoiceLegacyId) : undefined);

    return {
        id: row?.id ? String(row.id) : undefined,
        date: String(row?.date ?? ''),
        type: (row?.type ?? 'in') as PaymentType,
        amount: typeof row?.amount === 'number' ? row.amount : 0,
        companyId,
        companyName: String(row?.companyName ?? ''),
        siteId,
        siteName: row?.siteName ?? undefined,
        teamName: row?.teamName ?? undefined,
        taxInvoiceId,
        bankName: row?.bankName ?? undefined,
        accountNumber: row?.accountNumber ?? undefined,
        category: row?.category ?? undefined,
        memo: row?.memo ?? undefined,
        createdBy: row?.createdBy ?? undefined,
        createdAt: toTimestamp(row?.createdAt),
        updatedAt: toTimestamp(row?.updatedAt)
    } as PaymentRecord;
};

const listAllPayments = async (): Promise<PaymentRecord[]> => {
    const res = await listAllPaymentsQuery(dc, { limit: 5000, offset: 0 } as any);
    const rows = (res as any)?.data?.payments ?? [];
    return rows.map(mapPaymentRowToRecord);
};

export const paymentFirestoreService = {
    /**
     * 입금/지급 추가
     */
    addPayment: async (
        record: Omit<PaymentRecord, 'id' | 'createdAt' | 'updatedAt'>
    ): Promise<string> => {
        const legacyCompanyId = record.companyId ? String(record.companyId) : null;
        const companyId = legacyCompanyId && isUuidString(legacyCompanyId) ? legacyCompanyId : null;
        const companyLegacyId = legacyCompanyId && !isUuidString(legacyCompanyId) ? legacyCompanyId : null;

        const legacySiteId = record.siteId ? String(record.siteId) : null;
        const siteId = legacySiteId && isUuidString(legacySiteId) ? legacySiteId : null;
        const siteLegacyId = legacySiteId && !isUuidString(legacySiteId) ? legacySiteId : null;

        const legacyTaxInvoiceId = record.taxInvoiceId ? String(record.taxInvoiceId) : null;
        const taxInvoiceId = legacyTaxInvoiceId && isUuidString(legacyTaxInvoiceId) ? legacyTaxInvoiceId : null;
        const taxInvoiceLegacyId = legacyTaxInvoiceId && !isUuidString(legacyTaxInvoiceId) ? legacyTaxInvoiceId : null;

        const response = await createPayment(dc, {
            date: record.date,
            type: record.type,
            amount: record.amount,
            companyId,
            companyName: record.companyName,
            companyLegacyId,
            siteId,
            siteName: record.siteName ?? null,
            siteLegacyId,
            teamId: null,
            teamName: record.teamName ?? null,
            teamLegacyId: null,
            taxInvoiceId,
            taxInvoiceLegacyId,
            bankName: record.bankName ?? null,
            accountNumber: record.accountNumber ?? null,
            category: record.category ?? null,
            memo: record.memo ?? null,
            createdBy: record.createdBy ?? null
        } as any);

        return String((response as any)?.data?.payment_insert?.id);
    },

    /**
     * 입금/지급 수정
     */
    updatePayment: async (id: string, updates: Partial<PaymentRecord>): Promise<void> => {
        const vars: any = { id: String(id) };

        const setIfDefined = (key: string, value: unknown) => {
            if (value !== undefined) vars[key] = value;
        };

        setIfDefined('date', updates.date);
        setIfDefined('type', updates.type);
        setIfDefined('amount', updates.amount);
        setIfDefined('companyName', updates.companyName);
        setIfDefined('siteName', updates.siteName ?? null);
        setIfDefined('teamName', updates.teamName ?? null);
        setIfDefined('bankName', updates.bankName ?? null);
        setIfDefined('accountNumber', updates.accountNumber ?? null);
        setIfDefined('category', updates.category ?? null);
        setIfDefined('memo', updates.memo ?? null);
        setIfDefined('createdBy', updates.createdBy ?? null);

        if (updates.companyId !== undefined) {
            const raw = updates.companyId ? String(updates.companyId) : '';
            vars.companyId = raw && isUuidString(raw) ? raw : null;
            vars.companyLegacyId = raw && !isUuidString(raw) ? raw : null;
        }
        if (updates.siteId !== undefined) {
            const raw = updates.siteId ? String(updates.siteId) : '';
            vars.siteId = raw && isUuidString(raw) ? raw : null;
            vars.siteLegacyId = raw && !isUuidString(raw) ? raw : null;
        }
        if (updates.taxInvoiceId !== undefined) {
            const raw = updates.taxInvoiceId ? String(updates.taxInvoiceId) : '';
            vars.taxInvoiceId = raw && isUuidString(raw) ? raw : null;
            vars.taxInvoiceLegacyId = raw && !isUuidString(raw) ? raw : null;
        }

        vars.updatedAt = new Date().toISOString();
        await updatePayment(dc, vars);
    },

    /**
     * 입금/지급 삭제
     */
    deletePayment: async (id: string): Promise<void> => {
        await deletePayment(dc, { id: String(id) } as any);
    },

    /**
     * ID로 조회
     */
    getPaymentById: async (id: string): Promise<PaymentRecord | null> => {
        try {
            const all = await listAllPayments();
            const found = all.find(p => String(p.id) === String(id)) ?? null;
            return found;
        } catch (e) {
            console.error(e);
            return null;
        }
    },

    /**
     * 전체 조회 (최신순)
     */
    getPayments: async (): Promise<PaymentRecord[]> => {
        const rows = await listAllPayments();
        rows.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '', 'en'));
        return rows;
    },

    /**
     * 거래처별 조회
     */
    getPaymentsByCompany: async (companyId: string): Promise<PaymentRecord[]> => {
        const rows = await listAllPayments();
        const isUuid = isUuidString(String(companyId));
        const filtered = rows.filter(r => {
            if (isUuid) return r.companyId === companyId;
            return (r as any)?.companyId === companyId;
        });
        filtered.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '', 'en'));
        return filtered;
    },

    /**
     * 거래처명별 조회 (수기 입력 데이터용)
     */
    getPaymentsByCompanyName: async (companyName: string): Promise<PaymentRecord[]> => {
        const rows = await listAllPayments();
        const filtered = rows.filter(r => String(r.companyName ?? '') === String(companyName));
        filtered.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '', 'en'));
        return filtered;
    },

    /**
     * 현장별 조회
     */
    getPaymentsBySite: async (siteId: string): Promise<PaymentRecord[]> => {
        const rows = await listAllPayments();
        const isUuid = isUuidString(String(siteId));
        const filtered = rows.filter(r => {
            if (isUuid) return r.siteId === siteId;
            return (r as any)?.siteId === siteId;
        });
        filtered.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '', 'en'));
        return filtered;
    },

    /**
     * 기간별 조회
     */
    getPaymentsByDateRange: async (
        startDate: string,
        endDate: string
    ): Promise<PaymentRecord[]> => {
        const rows = await listAllPayments();
        const filtered = rows.filter(r => r.date >= startDate && r.date <= endDate);
        filtered.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '', 'en'));
        return filtered;
    },

    /**
     * 거래처별 입금/지급 합계
     */
    calculateCompanyPaymentTotals: async (companyId: string): Promise<{
        totalIn: number;
        totalOut: number;
        net: number;
    }> => {
        const records = await paymentFirestoreService.getPaymentsByCompany(companyId);

        let totalIn = 0;
        let totalOut = 0;

        records.forEach(record => {
            if (record.type === 'in') {
                totalIn += record.amount;
            } else {
                totalOut += record.amount;
            }
        });

        return {
            totalIn,
            totalOut,
            net: totalIn - totalOut
        };
    }
};

/**
 * 통합 잔액 계산 서비스
 * 세금계산서 + 입금/지급을 합쳐서 실제 잔액을 계산
 */
export const balanceCalculationService = {
    /**
     * 거래처별 미수금/미지급 잔액 계산
     * 
     * 미수금 = 매출 세금계산서 합계 - 입금 합계
     * 미지급 = 매입 세금계산서 합계 - 지급 합계
     */
    calculateCompanyBalance: async (companyId: string): Promise<{
        salesTotal: number;       // 매출 합계
        purchaseTotal: number;    // 매입 합계
        receivedTotal: number;    // 입금 합계
        paidTotal: number;        // 지급 합계
        receivableBalance: number; // 미수금 (매출 - 입금)
        payableBalance: number;    // 미지급 (매입 - 지급)
    }> => {
        // 세금계산서 데이터 가져오기
        const { taxInvoiceFirestoreService } = await import('./taxInvoiceFirestoreService');
        const invoiceTotals = await taxInvoiceFirestoreService.calculateCompanyTotals(companyId);

        // 입금/지급 데이터 가져오기
        const paymentTotals = await paymentFirestoreService.calculateCompanyPaymentTotals(companyId);

        return {
            salesTotal: invoiceTotals.salesTotal,
            purchaseTotal: invoiceTotals.purchaseTotal,
            receivedTotal: paymentTotals.totalIn,
            paidTotal: paymentTotals.totalOut,
            receivableBalance: invoiceTotals.salesTotal - paymentTotals.totalIn,
            payableBalance: invoiceTotals.purchaseTotal - paymentTotals.totalOut
        };
    },

    /**
     * 거래처별 거래 내역 (시간순 정렬)
     * 세금계산서 + 입금/지급을 합쳐서 잔액 누적 계산
     */
    getCompanyTransactionHistory: async (companyId: string): Promise<Array<{
        date: string;
        description: string;
        saleAmount: number;
        paymentAmount: number;
        balance: number;
        type: 'invoice' | 'payment';
        sourceId: string;
        siteName?: string;
        teamName?: string;
        memo?: string;
    }>> => {
        const { taxInvoiceFirestoreService } = await import('./taxInvoiceFirestoreService');

        // 세금계산서 가져오기
        const invoices = await taxInvoiceFirestoreService.getTaxInvoicesByCompany(companyId);

        // 입금/지급 가져오기
        const payments = await paymentFirestoreService.getPaymentsByCompany(companyId);

        // 거래 내역 통합
        type Transaction = {
            date: string;
            description: string;
            saleAmount: number;
            paymentAmount: number;
            balance: number;
            type: 'invoice' | 'payment';
            sourceId: string;
            siteName?: string;
            teamName?: string;
            memo?: string;
        };

        const transactions: Transaction[] = [];

        // 세금계산서 → 거래 내역
        invoices.forEach(inv => {
            if (inv.status === 'cancelled') return;

            transactions.push({
                date: inv.invoiceDate,
                description: inv.itemName || '세금계산서',
                saleAmount: inv.type === 'sales' ? inv.totalAmount : 0,
                paymentAmount: 0,
                balance: 0, // 나중에 계산
                type: 'invoice',
                sourceId: inv.id || '',
                siteName: inv.siteName,
                teamName: inv.teamName,
                memo: inv.memo
            });
        });

        // 입금/지급 → 거래 내역
        payments.forEach(pay => {
            transactions.push({
                date: pay.date,
                description: pay.type === 'in' ? '입금' : '지급',
                saleAmount: 0,
                paymentAmount: pay.type === 'in' ? pay.amount : 0,
                balance: 0,
                type: 'payment',
                sourceId: pay.id || '',
                siteName: pay.siteName,
                teamName: pay.teamName,
                memo: pay.memo
            });
        });

        // 날짜 순 정렬
        transactions.sort((a, b) => a.date.localeCompare(b.date));

        // 잔액 누적 계산
        let runningBalance = 0;
        transactions.forEach(tx => {
            runningBalance += tx.saleAmount - tx.paymentAmount;
            tx.balance = runningBalance;
        });

        return transactions;
    },

    /**
     * 거래처명별 잔액 계산 (수기 입력 데이터용)
     */
    calculateCompanyBalanceByName: async (companyName: string): Promise<{
        salesTotal: number;
        purchaseTotal: number;
        receivedTotal: number;
        paidTotal: number;
        receivableBalance: number;
        payableBalance: number;
    }> => {
        const { taxInvoiceFirestoreService } = await import('./taxInvoiceFirestoreService');

        // 세금계산서 (이름으로 조회)
        const invoices = await taxInvoiceFirestoreService.getTaxInvoicesByCompanyName(companyName);
        let salesTotal = 0;
        let purchaseTotal = 0;

        invoices.forEach(record => {
            if (record.status === 'cancelled') return;
            if (record.type === 'sales') {
                salesTotal += record.totalAmount;
            } else {
                purchaseTotal += record.totalAmount;
            }
        });

        // 입금/지급 (이름으로 조회)
        const payments = await paymentFirestoreService.getPaymentsByCompanyName(companyName);
        let totalIn = 0;
        let totalOut = 0;

        payments.forEach(record => {
            if (record.type === 'in') {
                totalIn += record.amount;
            } else {
                totalOut += record.amount;
            }
        });

        return {
            salesTotal,
            purchaseTotal,
            receivedTotal: totalIn,
            paidTotal: totalOut,
            receivableBalance: salesTotal - totalIn,
            payableBalance: purchaseTotal - totalOut
        };
    },

    /**
     * 거래처명별 거래 내역 (수기 입력 데이터용)
     */
    getCompanyTransactionHistoryByName: async (companyName: string): Promise<Array<{
        date: string;
        description: string;
        saleAmount: number;
        paymentAmount: number;
        balance: number;
        type: 'invoice' | 'payment';
        sourceId: string;
        siteName?: string;
        teamName?: string;
        memo?: string;
    }>> => {
        const { taxInvoiceFirestoreService } = await import('./taxInvoiceFirestoreService');

        const invoices = await taxInvoiceFirestoreService.getTaxInvoicesByCompanyName(companyName);
        const payments = await paymentFirestoreService.getPaymentsByCompanyName(companyName);

        type Transaction = {
            date: string;
            description: string;
            saleAmount: number;
            paymentAmount: number;
            balance: number;
            type: 'invoice' | 'payment';
            sourceId: string;
            siteName?: string;
            teamName?: string;
            memo?: string;
        };

        const transactions: Transaction[] = [];

        invoices.forEach(inv => {
            if (inv.status === 'cancelled') return;

            transactions.push({
                date: inv.invoiceDate,
                description: inv.itemName || '세금계산서',
                saleAmount: inv.type === 'sales' ? inv.totalAmount : 0,
                paymentAmount: 0,
                balance: 0,
                type: 'invoice',
                sourceId: inv.id || '',
                siteName: inv.siteName,
                teamName: inv.teamName,
                memo: inv.memo,
            });
        });

        payments.forEach(pay => {
            transactions.push({
                date: pay.date,
                description: pay.type === 'in' ? '입금' : '지급',
                saleAmount: 0,
                paymentAmount: pay.type === 'in' ? pay.amount : 0,
                balance: 0,
                type: 'payment',
                sourceId: pay.id || '',
                siteName: pay.siteName,
                teamName: pay.teamName,
                memo: pay.memo
            });
        });

        transactions.sort((a, b) => a.date.localeCompare(b.date));

        let runningBalance = 0;
        transactions.forEach(tx => {
            runningBalance += tx.saleAmount - tx.paymentAmount;
            tx.balance = runningBalance;
        });

        return transactions;
    }
};
