/**
 * 세금계산서 Firestore 서비스
 * 
 * 세금계산서 발행 기록을 Firestore에 저장하고 관리합니다.
 * 바로빌 API 연동과는 별도로 내부 기록용입니다.
 */

import app from '../config/firebase';
import { getDataConnect } from 'firebase/data-connect';
import {
    connectorConfig,
    listAllTaxInvoices as listAllTaxInvoicesQuery,
    createTaxInvoice,
    updateTaxInvoice,
    deleteTaxInvoice
} from './dataconnectCompat';
import { Timestamp } from '../types/timestamp';

// 세금계산서 타입
export type TaxInvoiceType = 'sales' | 'purchase'; // 매출 / 매입

// 세금계산서 상태
export type TaxInvoiceStatus =
    | 'draft'      // 작성중
    | 'issued'     // 발행완료
    | 'received'   // 수취완료
    | 'cancelled'; // 취소

// 세금계산서 기록 인터페이스
export interface TaxInvoiceRecord {
    id?: string;

    // 기본 정보
    invoiceNum: string;              // 세금계산서 번호
    invoiceDate: string;             // 발행일 (YYYY-MM-DD)
    type: TaxInvoiceType;            // 매출/매입
    status: TaxInvoiceStatus;        // 상태

    // 공급자 정보
    invoicerCorpNum: string;         // 공급자 사업자번호
    invoicerCorpName: string;        // 공급자 상호
    invoicerCeoName?: string;        // 공급자 대표자명
    invoicerAddr?: string;           // 공급자 주소

    // 공급받는자 정보
    invoiceeCorpNum?: string;        // 공급받는자 사업자번호 (수기일 경우 선택)
    invoiceeCorpName: string;        // 공급받는자 상호 (필수)
    invoiceeCeoName?: string;        // 공급받는자 대표자명
    invoiceeAddr?: string;           // 공급받는자 주소
    invoiceeCompanyId?: string;      // Firestore company ID (연결용, 수기일 경우 없음)

    // 금액 정보
    supplyAmount: number;            // 공급가액
    taxAmount: number;               // 세액
    totalAmount: number;             // 합계금액

    // 출처 정보
    source: 'barobill' | 'manual' | 'excel'; // 바로빌API / 수기입력 / 엑셀업로드

    // 품목 요약
    itemName?: string;               // 대표 품목명
    itemCount?: number;              // 품목 수

    // 연결 정보 (Firestore 참조)
    siteId?: string;                 // 현장 ID
    siteName?: string;               // 현장명
    teamId?: string;                 // 팀 ID
    teamName?: string;               // 팀명

    // 바로빌 연동 정보
    barobillSendKey?: string;        // 바로빌 전송키
    barobillStatus?: string;         // 바로빌 상태
    barobillNtsResult?: string;      // 국세청 전송 결과

    // 메타 정보
    memo?: string;                   // 비고
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
    createdBy?: string;              // 작성자
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

const mapTaxInvoiceRowToRecord = (row: any): TaxInvoiceRecord => {
    const invoiceeCompanyId = row?.invoiceeCompany?.id
        ? String(row.invoiceeCompany.id)
        : (row?.invoiceeCompanyLegacyId ? String(row.invoiceeCompanyLegacyId) : undefined);

    const siteId = row?.site?.id ? String(row.site.id) : (row?.siteLegacyId ? String(row.siteLegacyId) : undefined);
    const teamId = row?.team?.id ? String(row.team.id) : (row?.teamLegacyId ? String(row.teamLegacyId) : undefined);

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

const listAllTaxInvoices = async (): Promise<TaxInvoiceRecord[]> => {
    const res = await listAllTaxInvoicesQuery(dc, { limit: 5000, offset: 0 } as any);
    const rows = (res as any)?.data?.taxInvoices ?? [];
    return rows.map(mapTaxInvoiceRowToRecord);
};

export const taxInvoiceFirestoreService = {
    /**
     * 세금계산서 추가
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

        const res = await createTaxInvoice(dc, {
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
     * 세금계산서 수정
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
        await updateTaxInvoice(dc, vars);
    },

    /**
     * 세금계산서 삭제
     */
    deleteTaxInvoice: async (id: string): Promise<void> => {
        await deleteTaxInvoice(dc, { id: String(id) } as any);
    },

    /**
     * 세금계산서 ID로 조회
     */
    getTaxInvoiceById: async (id: string): Promise<TaxInvoiceRecord | null> => {
        try {
            const all = await listAllTaxInvoices();
            return all.find(r => String(r.id) === String(id)) ?? null;
        } catch (e) {
            console.error(e);
            return null;
        }
    },

    /**
     * 전체 세금계산서 조회 (최신순)
     */
    getTaxInvoices: async (limitCount?: number): Promise<TaxInvoiceRecord[]> => {
        const rows = await listAllTaxInvoices();
        rows.sort((a, b) => (b.invoiceDate ?? '').localeCompare(a.invoiceDate ?? '', 'en'));
        return typeof limitCount === 'number' ? rows.slice(0, Math.max(0, limitCount)) : rows;
    },

    /**
     * 타입별 조회 (매출/매입)
     */
    getTaxInvoicesByType: async (type: TaxInvoiceType): Promise<TaxInvoiceRecord[]> => {
        const rows = await listAllTaxInvoices();
        const filtered = rows.filter(r => r.type === type);
        filtered.sort((a, b) => (b.invoiceDate ?? '').localeCompare(a.invoiceDate ?? '', 'en'));
        return filtered;
    },

    /**
     * 거래처별 조회 (공급받는자 기준)
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
     * 거래처명별 조회 (수기 입력 데이터용)
     */
    getTaxInvoicesByCompanyName: async (companyName: string): Promise<TaxInvoiceRecord[]> => {
        const rows = await listAllTaxInvoices();
        const filtered = rows.filter(r => String(r.invoiceeCorpName ?? '') === String(companyName));
        filtered.sort((a, b) => (b.invoiceDate ?? '').localeCompare(a.invoiceDate ?? '', 'en'));
        return filtered;
    },

    /**
     * 현장별 조회
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
     * 기간별 조회
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
     * 거래처별 합계 계산
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
