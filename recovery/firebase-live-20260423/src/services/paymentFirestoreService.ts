/**
 * ?낃툑/吏湲?Firestore ?쒕퉬??
 * 
 * ?낃툑 諛?吏湲?湲곕줉??愿由ы븯??嫄곕옒泥섎퀎 ?붿븸??怨꾩궛?⑸땲??
 */

import {
    listAllPayments as listAllPaymentsQuery,
    createPayment,
    updatePayment,
    deletePayment,
    getPayment
} from './firestoreCrudCompat';
import { Timestamp } from '../types/timestamp';

// ?낃툑/吏湲????
export type PaymentType = 'in' | 'out'; // ?낃툑 / 吏湲?

// ?낃툑/吏湲?湲곕줉 ?명꽣?섏씠??
export interface PaymentRecord {
    id?: string;

    // 湲곕낯 ?뺣낫
    date: string;                    // ?낃툑/吏湲됱씪 (YYYY-MM-DD)
    type: PaymentType;               // ?낃툑/吏湲?援щ텇
    amount: number;                  // 湲덉븸

    // 嫄곕옒泥??뺣낫
    companyId?: string;              // 嫄곕옒泥?ID (Firestore, ?좏깮)
    companyName: string;             // 嫄곕옒泥섎챸 (?꾩닔)

    // ?곌껐 ?뺣낫 (?좏깮)
    siteId?: string;                 // ?꾩옣 ID
    siteName?: string;               // ?꾩옣紐?
    teamName?: string;               // ?紐?(異붽?)
    taxInvoiceId?: string;           // ?곌껐???멸툑怨꾩궛??ID

    // 異붽? ?뺣낫
    bankName?: string;               // ??됰챸
    accountNumber?: string;          // 怨꾩쥖踰덊샇
    category?: string;               // 遺꾨쪟 (?앸?, ?먯옱, ?몃Т鍮???
    memo?: string;                   // 鍮꾧퀬

    // 硫뷀? ?뺣낫
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
    createdBy?: string;
}

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
        : (row?.companyId ? String(row.companyId) : (row?.companyLegacyId ? String(row.companyLegacyId) : undefined));
    const siteId = row?.site?.id
        ? String(row.site.id)
        : (row?.siteId ? String(row.siteId) : (row?.siteLegacyId ? String(row.siteLegacyId) : undefined));
    const taxInvoiceId = row?.taxInvoice?.id
        ? String(row.taxInvoice.id)
        : (row?.taxInvoiceId ? String(row.taxInvoiceId) : (row?.taxInvoiceLegacyId ? String(row.taxInvoiceLegacyId) : undefined));

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

const listAllPayments = async (limit: number = 1000): Promise<PaymentRecord[]> => {
    const res = await listAllPaymentsQuery({ limit, offset: 0 } as any);
    const rows = (res as any)?.data?.payments ?? [];
    return rows.map(mapPaymentRowToRecord);
};

export const paymentFirestoreService = {
    /**
     * ?낃툑/吏湲?異붽?
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

        const response = await createPayment({
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
     * ?낃툑/吏湲??섏젙
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
        await updatePayment(vars);
    },

    /**
     * ?낃툑/吏湲???젣
     */
    deletePayment: async (id: string): Promise<void> => {
        await deletePayment({ id: String(id) } as any);
    },

    /**
     * ID濡?議고쉶
     */
    getPaymentById: async (id: string): Promise<PaymentRecord | null> => {
        try {
            if (!isUuidString(id)) return null;
            const res = await getPayment({ id });
            const row = (res as any)?.data?.payment;
            return row ? mapPaymentRowToRecord(row) : null;
        } catch (e) {
            console.error(e);
            return null;
        }
    },

    /**
     * ?꾩껜 議고쉶 (理쒖떊??
     */
    getPayments: async (): Promise<PaymentRecord[]> => {
        const rows = await listAllPayments();
        rows.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '', 'en'));
        return rows;
    },

    /**
     * 嫄곕옒泥섎퀎 議고쉶
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
     * 嫄곕옒泥섎챸蹂?議고쉶 (?섍린 ?낅젰 ?곗씠?곗슜)
     */
    getPaymentsByCompanyName: async (companyName: string): Promise<PaymentRecord[]> => {
        const rows = await listAllPayments();
        const filtered = rows.filter(r => String(r.companyName ?? '') === String(companyName));
        filtered.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '', 'en'));
        return filtered;
    },

    /**
     * ?꾩옣蹂?議고쉶
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
     * 湲곌컙蹂?議고쉶
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
     * 嫄곕옒泥섎퀎 ?낃툑/吏湲??⑷퀎
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
 * ?듯빀 ?붿븸 怨꾩궛 ?쒕퉬??
 * ?멸툑怨꾩궛??+ ?낃툑/吏湲됱쓣 ?⑹퀜???ㅼ젣 ?붿븸??怨꾩궛
 */
export const balanceCalculationService = {
    /**
     * 嫄곕옒泥섎퀎 誘몄닔湲?誘몄?湲??붿븸 怨꾩궛
     * 
     * 誘몄닔湲?= 留ㅼ텧 ?멸툑怨꾩궛???⑷퀎 - ?낃툑 ?⑷퀎
     * 誘몄?湲?= 留ㅼ엯 ?멸툑怨꾩궛???⑷퀎 - 吏湲??⑷퀎
     */
    calculateCompanyBalance: async (companyId: string): Promise<{
        salesTotal: number;       // 留ㅼ텧 ?⑷퀎
        purchaseTotal: number;    // 留ㅼ엯 ?⑷퀎
        receivedTotal: number;    // ?낃툑 ?⑷퀎
        paidTotal: number;        // 吏湲??⑷퀎
        receivableBalance: number; // 誘몄닔湲?(留ㅼ텧 - ?낃툑)
        payableBalance: number;    // 誘몄?湲?(留ㅼ엯 - 吏湲?
    }> => {
        // ?멸툑怨꾩궛???곗씠??媛?몄삤湲?
        const { taxInvoiceFirestoreService } = await import('./taxInvoiceFirestoreService');
        const invoiceTotals = await taxInvoiceFirestoreService.calculateCompanyTotals(companyId);

        // ?낃툑/吏湲??곗씠??媛?몄삤湲?
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
     * 嫄곕옒泥섎퀎 嫄곕옒 ?댁뿭 (?쒓컙???뺣젹)
     * ?멸툑怨꾩궛??+ ?낃툑/吏湲됱쓣 ?⑹퀜???붿븸 ?꾩쟻 怨꾩궛
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

        // ?멸툑怨꾩궛??媛?몄삤湲?
        const invoices = await taxInvoiceFirestoreService.getTaxInvoicesByCompany(companyId);

        // ?낃툑/吏湲?媛?몄삤湲?
        const payments = await paymentFirestoreService.getPaymentsByCompany(companyId);

        // 嫄곕옒 ?댁뿭 ?듯빀
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

        // ?멸툑怨꾩궛????嫄곕옒 ?댁뿭
        invoices.forEach(inv => {
            if (inv.status === 'cancelled') return;

            transactions.push({
                date: inv.invoiceDate,
                description: inv.itemName || "\uC138\uAE08\uACC4\uC0B0\uC11C",
                saleAmount: inv.type === 'sales' ? inv.totalAmount : 0,
                paymentAmount: 0,
                balance: 0, // ?섏쨷??怨꾩궛
                type: 'invoice',
                sourceId: inv.id || '',
                siteName: inv.siteName,
                teamName: inv.teamName,
                memo: inv.memo
            });
        });

        // ?낃툑/吏湲???嫄곕옒 ?댁뿭
        payments.forEach(pay => {
            transactions.push({
                date: pay.date,
                description: pay.type === 'in' ? "\uC785\uAE08" : "\uC9C0\uAE09",
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

        // ?좎쭨 ???뺣젹
        transactions.sort((a, b) => a.date.localeCompare(b.date));

        // ?붿븸 ?꾩쟻 怨꾩궛
        let runningBalance = 0;
        transactions.forEach(tx => {
            runningBalance += tx.saleAmount - tx.paymentAmount;
            tx.balance = runningBalance;
        });

        return transactions;
    },

    /**
     * 嫄곕옒泥섎챸蹂??붿븸 怨꾩궛 (?섍린 ?낅젰 ?곗씠?곗슜)
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

        // ?멸툑怨꾩궛??(?대쫫?쇰줈 議고쉶)
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

        // ?낃툑/吏湲?(?대쫫?쇰줈 議고쉶)
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
     * 嫄곕옒泥섎챸蹂?嫄곕옒 ?댁뿭 (?섍린 ?낅젰 ?곗씠?곗슜)
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
                description: inv.itemName || "\uC138\uAE08\uACC4\uC0B0\uC11C",
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
                description: pay.type === 'in' ? "\uC785\uAE08" : "\uC9C0\uAE09",
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

