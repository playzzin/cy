/**
 * ?멸툑怨꾩궛??Firestore ?쒕퉬??
 * 
 * ?멸툑怨꾩궛??諛쒗뻾 湲곕줉??Firestore????ν븯怨?愿由ы빀?덈떎.
 * 諛붾줈鍮?API ?곕룞怨쇰뒗 蹂꾨룄濡??대? 湲곕줉?⑹엯?덈떎.
 */

import {
    listAllTaxInvoices as listAllTaxInvoicesQuery,
    createTaxInvoice,
    updateTaxInvoice,
    deleteTaxInvoice,
    getTaxInvoice
} from './firestoreCrudCompat';
import { Timestamp } from '../types/timestamp';

// ?멸툑怨꾩궛?????
export type TaxInvoiceType = 'sales' | 'purchase'; // 留ㅼ텧 / 留ㅼ엯

// ?멸툑怨꾩궛???곹깭
export type TaxInvoiceStatus =
    | 'draft'      // ?묒꽦以?
    | 'issued'     // 諛쒗뻾?꾨즺
    | 'received'   // ?섏랬?꾨즺
    | 'cancelled'; // 痍⑥냼

// ?멸툑怨꾩궛??湲곕줉 ?명꽣?섏씠??
export interface TaxInvoiceRecord {
    id?: string;

    // 湲곕낯 ?뺣낫
    invoiceNum: string;              // ?멸툑怨꾩궛??踰덊샇
    invoiceDate: string;             // 諛쒗뻾??(YYYY-MM-DD)
    type: TaxInvoiceType;            // 留ㅼ텧/留ㅼ엯
    status: TaxInvoiceStatus;        // ?곹깭

    // 怨듦툒???뺣낫
    invoicerCorpNum: string;         // 怨듦툒???ъ뾽?먮쾲??
    invoicerCorpName: string;        // 怨듦툒???곹샇
    invoicerCeoName?: string;        // 怨듦툒????쒖옄紐?
    invoicerAddr?: string;           // 怨듦툒??二쇱냼

    // 怨듦툒諛쏅뒗???뺣낫
    invoiceeCorpNum?: string;        // 怨듦툒諛쏅뒗???ъ뾽?먮쾲??(?섍린??寃쎌슦 ?좏깮)
    invoiceeCorpName: string;        // 怨듦툒諛쏅뒗???곹샇 (?꾩닔)
    invoiceeCeoName?: string;        // 怨듦툒諛쏅뒗????쒖옄紐?
    invoiceeAddr?: string;           // 怨듦툒諛쏅뒗??二쇱냼
    invoiceeCompanyId?: string;      // Firestore company ID (?곌껐?? ?섍린??寃쎌슦 ?놁쓬)

    // 湲덉븸 ?뺣낫
    supplyAmount: number;            // 怨듦툒媛??
    taxAmount: number;               // ?몄븸
    totalAmount: number;             // ?⑷퀎湲덉븸

    // 異쒖쿂 ?뺣낫
    source: 'barobill' | 'manual' | 'excel'; // 諛붾줈鍮똀PI / ?섍린?낅젰 / ?묒??낅줈??

    // ?덈ぉ ?붿빟
    itemName?: string;               // ????덈ぉ紐?
    itemCount?: number;              // ?덈ぉ ??

    // ?곌껐 ?뺣낫 (Firestore 李몄“)
    siteId?: string;                 // ?꾩옣 ID
    siteName?: string;               // ?꾩옣紐?
    teamId?: string;                 // ? ID
    teamName?: string;               // ?紐?

    // 諛붾줈鍮??곕룞 ?뺣낫
    barobillSendKey?: string;        // 諛붾줈鍮??꾩넚??
    barobillStatus?: string;         // 諛붾줈鍮??곹깭
    barobillNtsResult?: string;      // 援?꽭泥??꾩넚 寃곌낵

    // 硫뷀? ?뺣낫
    memo?: string;                   // 鍮꾧퀬
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
    createdBy?: string;              // ?묒꽦??
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

const mapTaxInvoiceRowToRecord = (row: any): TaxInvoiceRecord => {
    const invoiceeCompanyId = row?.invoiceeCompany?.id
        ? String(row.invoiceeCompany.id)
        : (row?.invoiceeCompanyId ? String(row.invoiceeCompanyId) : (row?.invoiceeCompanyLegacyId ? String(row.invoiceeCompanyLegacyId) : undefined));

    const siteId = row?.site?.id ? String(row.site.id) : (row?.siteId ? String(row.siteId) : (row?.siteLegacyId ? String(row.siteLegacyId) : undefined));
    const teamId = row?.team?.id ? String(row.team.id) : (row?.teamId ? String(row.teamId) : (row?.teamLegacyId ? String(row.teamLegacyId) : undefined));

    return {
        id: row?.id ? String(row.id) : undefined,
        invoiceNum: String(row?.invoiceNum ?? ''),
        invoiceDate: String(row?.invoiceDate ?? ''),
        type: (row?.type ?? 'sales') as TaxInvoiceType,
        status: (row?.status ?? 'issued') as TaxInvoiceStatus,
        invoicerCorpNum: String(row?.invoicerCorpNum ?? ''),
        invoicerCorpName: String(row?.invoicerCorpName ?? ''),
        invoicerCeoName: row?.invoicerCeoName ?? undefined,
        invoicerAddr: row?.invoicerAddr ?? undefined,
        invoiceeCorpNum: row?.invoiceeCorpNum ?? undefined,
        invoiceeCorpName: String(row?.invoiceeCorpName ?? ''),
        invoiceeCeoName: row?.invoiceeCeoName ?? undefined,
        invoiceeAddr: row?.invoiceeAddr ?? undefined,
        invoiceeCompanyId,
        supplyAmount: typeof row?.supplyAmount === 'number' ? row.supplyAmount : 0,
        taxAmount: typeof row?.taxAmount === 'number' ? row.taxAmount : 0,
        totalAmount: typeof row?.totalAmount === 'number' ? row.totalAmount : 0,
        source: (row?.source ?? 'manual') as any,
        itemName: row?.itemName ?? undefined,
        itemCount: typeof row?.itemCount === 'number' ? row.itemCount : undefined,
        siteId,
        siteName: row?.siteName ?? (row?.site?.name ?? undefined),
        teamId,
        teamName: row?.teamName ?? (row?.team?.name ?? undefined),
        barobillSendKey: row?.barobillSendKey ?? undefined,
        barobillStatus: row?.barobillStatus ?? undefined,
        barobillNtsResult: row?.barobillNtsResult ?? undefined,
        memo: row?.memo ?? undefined,
        createdAt: toTimestamp(row?.createdAt),
        updatedAt: toTimestamp(row?.updatedAt),
        createdBy: row?.createdBy ?? undefined
    } as TaxInvoiceRecord;
};

const listAllTaxInvoices = async (limit: number = 1000): Promise<TaxInvoiceRecord[]> => {
    const res = await listAllTaxInvoicesQuery({ limit, offset: 0 } as any);
    const rows = (res as any)?.data?.taxInvoices ?? [];
    return rows.map(mapTaxInvoiceRowToRecord);
};

export const taxInvoiceFirestoreService = {
    /**
     * ?멸툑怨꾩궛??異붽?
     */
    addTaxInvoice: async (
        record: Omit<TaxInvoiceRecord, 'id' | 'createdAt' | 'updatedAt'>
    ): Promise<string> => {
        const rawCompanyId = record.invoiceeCompanyId ? String(record.invoiceeCompanyId) : null;
        const invoiceeCompanyId = rawCompanyId && isUuidString(rawCompanyId) ? rawCompanyId : null;
        const invoiceeCompanyLegacyId = rawCompanyId && !isUuidString(rawCompanyId) ? rawCompanyId : null;

        const rawSiteId = record.siteId ? String(record.siteId) : null;
        const siteId = rawSiteId && isUuidString(rawSiteId) ? rawSiteId : null;
        const siteLegacyId = rawSiteId && !isUuidString(rawSiteId) ? rawSiteId : null;

        const rawTeamId = record.teamId ? String(record.teamId) : null;
        const teamId = rawTeamId && isUuidString(rawTeamId) ? rawTeamId : null;
        const teamLegacyId = rawTeamId && !isUuidString(rawTeamId) ? rawTeamId : null;

        const res = await createTaxInvoice({
            legacyId: null,
            invoiceNum: record.invoiceNum,
            invoiceDate: record.invoiceDate,
            type: record.type,
            status: record.status,
            invoicerCorpNum: record.invoicerCorpNum,
            invoicerCorpName: record.invoicerCorpName,
            invoicerCeoName: record.invoicerCeoName ?? null,
            invoicerAddr: record.invoicerAddr ?? null,
            invoiceeCorpNum: record.invoiceeCorpNum ?? null,
            invoiceeCorpName: record.invoiceeCorpName,
            invoiceeCeoName: record.invoiceeCeoName ?? null,
            invoiceeAddr: record.invoiceeAddr ?? null,
            invoiceeCompanyId,
            invoiceeCompanyLegacyId,
            supplyAmount: record.supplyAmount,
            taxAmount: record.taxAmount,
            totalAmount: record.totalAmount,
            source: record.source,
            itemName: record.itemName ?? null,
            itemCount: record.itemCount ?? null,
            siteId,
            siteName: record.siteName ?? null,
            siteLegacyId,
            teamId,
            teamName: record.teamName ?? null,
            teamLegacyId,
            barobillSendKey: record.barobillSendKey ?? null,
            barobillStatus: record.barobillStatus ?? null,
            barobillNtsResult: record.barobillNtsResult ?? null,
            memo: record.memo ?? null,
            createdBy: record.createdBy ?? null
        } as any);

        return String((res as any)?.data?.taxInvoice_insert?.id);
    },

    /**
     * ?멸툑怨꾩궛???섏젙
     */
    updateTaxInvoice: async (id: string, updates: Partial<TaxInvoiceRecord>): Promise<void> => {
        const vars: any = { id: String(id) };

        const setIfDefined = (key: string, value: unknown) => {
            if (value !== undefined) vars[key] = value;
        };

        setIfDefined('invoiceNum', updates.invoiceNum);
        setIfDefined('invoiceDate', updates.invoiceDate);
        setIfDefined('type', updates.type);
        setIfDefined('status', updates.status);
        setIfDefined('invoicerCorpNum', updates.invoicerCorpNum);
        setIfDefined('invoicerCorpName', updates.invoicerCorpName);
        setIfDefined('invoicerCeoName', updates.invoicerCeoName ?? null);
        setIfDefined('invoicerAddr', updates.invoicerAddr ?? null);
        setIfDefined('invoiceeCorpNum', updates.invoiceeCorpNum ?? null);
        setIfDefined('invoiceeCorpName', updates.invoiceeCorpName);
        setIfDefined('invoiceeCeoName', updates.invoiceeCeoName ?? null);
        setIfDefined('invoiceeAddr', updates.invoiceeAddr ?? null);
        setIfDefined('supplyAmount', updates.supplyAmount);
        setIfDefined('taxAmount', updates.taxAmount);
        setIfDefined('totalAmount', updates.totalAmount);
        setIfDefined('source', updates.source);
        setIfDefined('itemName', updates.itemName ?? null);
        setIfDefined('itemCount', updates.itemCount ?? null);
        setIfDefined('siteName', updates.siteName ?? null);
        setIfDefined('teamName', updates.teamName ?? null);
        setIfDefined('barobillSendKey', updates.barobillSendKey ?? null);
        setIfDefined('barobillStatus', updates.barobillStatus ?? null);
        setIfDefined('barobillNtsResult', updates.barobillNtsResult ?? null);
        setIfDefined('memo', updates.memo ?? null);
        setIfDefined('createdBy', updates.createdBy ?? null);

        if (updates.invoiceeCompanyId !== undefined) {
            const raw = updates.invoiceeCompanyId ? String(updates.invoiceeCompanyId) : '';
            vars.invoiceeCompanyId = raw && isUuidString(raw) ? raw : null;
            vars.invoiceeCompanyLegacyId = raw && !isUuidString(raw) ? raw : null;
        }
        if (updates.siteId !== undefined) {
            const raw = updates.siteId ? String(updates.siteId) : '';
            vars.siteId = raw && isUuidString(raw) ? raw : null;
            vars.siteLegacyId = raw && !isUuidString(raw) ? raw : null;
        }
        if (updates.teamId !== undefined) {
            const raw = updates.teamId ? String(updates.teamId) : '';
            vars.teamId = raw && isUuidString(raw) ? raw : null;
            vars.teamLegacyId = raw && !isUuidString(raw) ? raw : null;
        }

        vars.updatedAt = new Date().toISOString();
        await updateTaxInvoice(vars);
    },

    /**
     * ?멸툑怨꾩궛????젣
     */
    deleteTaxInvoice: async (id: string): Promise<void> => {
        await deleteTaxInvoice({ id: String(id) } as any);
    },

    /**
     * ?멸툑怨꾩궛??ID濡?議고쉶
     */
    getTaxInvoiceById: async (id: string): Promise<TaxInvoiceRecord | null> => {
        try {
            if (!isUuidString(id)) return null;
            const res = await getTaxInvoice({ id });
            const row = (res as any)?.data?.taxInvoice;
            return row ? mapTaxInvoiceRowToRecord(row) : null;
        } catch (e) {
            console.error(e);
            return null;
        }
    },

    /**
     * ?꾩껜 ?멸툑怨꾩궛??議고쉶 (理쒖떊??
     */
    getTaxInvoices: async (limitCount?: number): Promise<TaxInvoiceRecord[]> => {
        const rows = await listAllTaxInvoices();
        rows.sort((a, b) => (b.invoiceDate ?? '').localeCompare(a.invoiceDate ?? '', 'en'));
        return typeof limitCount === 'number' ? rows.slice(0, Math.max(0, limitCount)) : rows;
    },

    /**
     * ??낅퀎 議고쉶 (留ㅼ텧/留ㅼ엯)
     */
    getTaxInvoicesByType: async (type: TaxInvoiceType): Promise<TaxInvoiceRecord[]> => {
        const rows = await listAllTaxInvoices();
        const filtered = rows.filter(r => r.type === type);
        filtered.sort((a, b) => (b.invoiceDate ?? '').localeCompare(a.invoiceDate ?? '', 'en'));
        return filtered;
    },

    /**
     * 嫄곕옒泥섎퀎 議고쉶 (怨듦툒諛쏅뒗??湲곗?)
     */
    getTaxInvoicesByCompany: async (companyId: string): Promise<TaxInvoiceRecord[]> => {
        const rows = await listAllTaxInvoices();
        const isUuid = isUuidString(String(companyId));
        const filtered = rows.filter(r => {
            const raw = r.invoiceeCompanyId ? String(r.invoiceeCompanyId) : '';
            if (!raw) return false;
            if (isUuid) return raw === String(companyId);
            return raw === String(companyId);
        });
        filtered.sort((a, b) => (b.invoiceDate ?? '').localeCompare(a.invoiceDate ?? '', 'en'));
        return filtered;
    },

    /**
     * 嫄곕옒泥섎챸蹂?議고쉶 (?섍린 ?낅젰 ?곗씠?곗슜)
     */
    getTaxInvoicesByCompanyName: async (companyName: string): Promise<TaxInvoiceRecord[]> => {
        const rows = await listAllTaxInvoices();
        const filtered = rows.filter(r => String(r.invoiceeCorpName ?? '') === String(companyName));
        filtered.sort((a, b) => (b.invoiceDate ?? '').localeCompare(a.invoiceDate ?? '', 'en'));
        return filtered;
    },

    /**
     * ?꾩옣蹂?議고쉶
     */
    getTaxInvoicesBySite: async (siteId: string): Promise<TaxInvoiceRecord[]> => {
        const rows = await listAllTaxInvoices();
        const filtered = rows.filter(r => {
            const raw = r.siteId ? String(r.siteId) : '';
            return raw === String(siteId);
        });
        filtered.sort((a, b) => (b.invoiceDate ?? '').localeCompare(a.invoiceDate ?? '', 'en'));
        return filtered;
    },

    /**
     * 湲곌컙蹂?議고쉶
     */
    getTaxInvoicesByDateRange: async (
        startDate: string,
        endDate: string,
        type?: TaxInvoiceType
    ): Promise<TaxInvoiceRecord[]> => {
        let results = await listAllTaxInvoices();
        results = results.filter(r => r.invoiceDate >= startDate && r.invoiceDate <= endDate);
        if (type) {
            results = results.filter(r => r.type === type);
        }
        results.sort((a, b) => (b.invoiceDate ?? '').localeCompare(a.invoiceDate ?? '', 'en'));
        return results;
    },

    /**
     * 嫄곕옒泥섎퀎 ?⑷퀎 怨꾩궛
     */
    calculateCompanyTotals: async (companyId: string): Promise<{
        salesTotal: number;
        purchaseTotal: number;
        balance: number;
    }> => {
        const records = await taxInvoiceFirestoreService.getTaxInvoicesByCompany(companyId);

        let salesTotal = 0;
        let purchaseTotal = 0;

        records.forEach(record => {
            if (record.status === 'cancelled') return;

            if (record.type === 'sales') {
                salesTotal += record.totalAmount;
            } else {
                purchaseTotal += record.totalAmount;
            }
        });

        return {
            salesTotal,
            purchaseTotal,
            balance: salesTotal - purchaseTotal
        };
    }
};

