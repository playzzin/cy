import {
    addDoc,
    collection,
    doc,
    getDoc,
    getDocs,
    limit,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { storageService } from './storageService';
import type {
    ProgressAllocation,
    ProgressAttachment,
    ProgressAttachmentScope,
    ProgressClaim,
    ProgressClaimSnapshot,
    ProgressClaimStatus,
    ProgressContract,
    ProgressContractItem,
} from '../types/progressClaim';
import { DEFAULT_PROGRESS_VAT_RATE } from '../types/progressClaim';
import { calculateAllocations, makeProgressId, toProgressNumber } from '../utils/progressClaimCalculations';
import {
    normalizeBuybackAfterTaxRate,
    resolveProgressSettlementTargetId,
} from '../utils/buybackSettlement';
import { officeService } from './officeService';

const CONTRACTS_COLLECTION = 'progress_contracts';
const CLAIMS_COLLECTION = 'progress_claims';

const OFFICE_INCOME_TARGET_TYPE = 'office_income';

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
    if (!value || typeof value !== 'object') return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
};

const stripUndefinedDeep = (value: unknown): unknown => {
    if (value === undefined) return undefined;
    if (Array.isArray(value)) {
        return value.map((child) => {
            const cleaned = stripUndefinedDeep(child);
            return cleaned === undefined ? null : cleaned;
        });
    }
    if (isPlainObject(value)) {
        return Object.fromEntries(
            Object.entries(value)
                .map(([key, child]) => [key, stripUndefinedDeep(child)] as const)
                .filter(([, child]) => child !== undefined)
        );
    }
    return value;
};

const cleanForFirestore = <T extends Record<string, unknown>>(value: T): Record<string, unknown> =>
    stripUndefinedDeep(value) as Record<string, unknown>;

const toText = (value: unknown): string => String(value ?? '').trim();

const normalizeRate = (value: unknown, fallback = 0): number => {
    const rate = value === undefined || value === null ? fallback : toProgressNumber(value);
    if (rate > 1 && rate <= 100) return rate / 100;
    return rate;
};

const normalizeTeamPositionMode = (value: unknown): ProgressClaim['teamPositionMode'] =>
    value === 'manual' ? 'manual' : 'currentAmount';

const toOptionalText = (value: unknown): string | undefined =>
    typeof value === 'string' ? value.trim() || undefined : undefined;

const toOptionalNumber = (value: unknown): number | undefined => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
    if (typeof value !== 'string') return undefined;

    const normalized = value
        .trim()
        .replace(/[,%\s]/g, '')
        .replace(/[−–—]/g, '-');
    if (!normalized || !/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(normalized)) return undefined;

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : undefined;
};

const normalizeSettlementMode = (value: unknown): ProgressAllocation['settlementMode'] =>
    value === 'rate' || value === 'taxInvoice' || value === 'manual' ? value : undefined;

const normalizePaymentStatus = (value: unknown): ProgressAllocation['paymentStatus'] =>
    value === 'pending' ||
    value === 'needs_review' ||
    value === 'calculating' ||
    value === 'retention' ||
    value === 'scheduled' ||
    value === 'in_progress' ||
    value === 'partial' ||
    value === 'paid' ||
    value === 'hold' ||
    value === 'overpaid' ||
    value === 'no_buyback' ||
    value === 'cancelled'
        ? value
        : undefined;

const normalizeEvidenceStatus = (value: unknown): ProgressAllocation['evidenceStatus'] =>
    value === 'not_required' || value === 'pending' || value === 'received' ? value : undefined;

const normalizeDateOnly = (value: unknown): string | undefined => {
    const text = toOptionalText(value);
    if (!text || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return undefined;

    const parsed = new Date(`${text}T00:00:00.000Z`);
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) return undefined;
    return text;
};

const normalizeDateTime = (value: unknown): string | undefined => {
    const text = value instanceof Date ? value.toISOString() : toOptionalText(value);
    if (!text) return undefined;

    const parsed = new Date(text);
    return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : undefined;
};

const normalizeProgressAllocation = (allocation: Partial<ProgressAllocation>): ProgressAllocation => {
    const targetType = toText(allocation.targetType) || undefined;
    const legacyTargetId = toText(allocation.targetId) || undefined;
    const settlementTargetId = resolveProgressSettlementTargetId({
        settlementTargetId: toOptionalText(allocation.settlementTargetId),
        targetId: legacyTargetId,
        targetType,
    });
    const parsedAfterTaxRate = toOptionalNumber(allocation.afterTaxRate);
    const parsedManualAfterTaxAmount = toOptionalNumber(allocation.manualAfterTaxAmount);
    const evidenceRequired = allocation.evidenceRequired === undefined ? undefined : Boolean(allocation.evidenceRequired);
    const normalizedEvidenceStatus = normalizeEvidenceStatus(allocation.evidenceStatus);

    return {
        id: toText(allocation.id) || makeProgressId('alloc'),
        settlementTargetId,
        // Keep the legacy field populated so existing selects and documents remain compatible.
        targetId: legacyTargetId || settlementTargetId,
        targetName: toText(allocation.targetName),
        targetType,
        companyName: toText(allocation.companyName) || undefined,
        method: allocation.method === 'percent' || allocation.method === 'perManDay' || allocation.method === 'manual'
            ? allocation.method
            : 'fixed',
        fixedAmount: toProgressNumber(allocation.fixedAmount),
        percent: toProgressNumber(allocation.percent),
        amountPerManDay: toProgressNumber(allocation.amountPerManDay),
        manualAmount: toProgressNumber(allocation.manualAmount),
        memo: toText(allocation.memo),
        settlementMode: normalizeSettlementMode(allocation.settlementMode),
        afterTaxRate: parsedAfterTaxRate === undefined
            ? undefined
            : normalizeBuybackAfterTaxRate(parsedAfterTaxRate),
        manualAfterTaxAmount: parsedManualAfterTaxAmount === undefined
            ? undefined
            : Math.max(0, Math.round(parsedManualAfterTaxAmount)),
        paymentStatus: normalizePaymentStatus(allocation.paymentStatus),
        paidAmount: allocation.paidAmount === undefined
            ? undefined
            : Math.max(0, Math.round(toOptionalNumber(allocation.paidAmount) ?? 0)),
        paymentDueDate: normalizeDateOnly(allocation.paymentDueDate),
        paidAt: normalizeDateTime(allocation.paidAt),
        evidenceRequired,
        evidenceStatus: evidenceRequired && normalizedEvidenceStatus === 'not_required'
            ? 'pending'
            : normalizedEvidenceStatus,
        paymentMemo: toOptionalText(allocation.paymentMemo),
    };
};

const normalizeClaimSnapshot = (
    raw: ProgressClaimSnapshot | undefined,
    fallbackAllocations: ProgressAllocation[]
): ProgressClaimSnapshot | undefined => {
    if (!raw || typeof raw !== 'object') return undefined;
    const sourceAllocations = Array.isArray(raw.allocations) ? raw.allocations : fallbackAllocations;
    return {
        ...raw,
        allocations: sourceAllocations.map(normalizeProgressAllocation),
    };
};

const normalizeContractItem = (item: Partial<ProgressContractItem>): ProgressContractItem => ({
    id: toText(item.id) || makeProgressId('item'),
    category: toText(item.category),
    workName: toText(item.workName),
    workType: toText(item.workType),
    contractQuantity: toProgressNumber(item.contractQuantity),
    unit: toText(item.unit) || '식',
    unitPrice: toProgressNumber(item.unitPrice),
    remark: toText(item.remark),
    active: item.active !== false,
});

const normalizeContract = (raw: Partial<ProgressContract>): ProgressContract => ({
    id: toText(raw.id) || undefined,
    siteId: toText(raw.siteId),
    siteName: toText(raw.siteName),
    memo: toText(raw.memo),
    items: Array.isArray(raw.items) ? raw.items.map(normalizeContractItem) : [],
    commonAttachments: Array.isArray(raw.commonAttachments) ? raw.commonAttachments : [],
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
});

const normalizeClaim = (raw: Partial<ProgressClaim>): ProgressClaim => {
    const allocations = Array.isArray(raw.allocations)
        ? raw.allocations.map(normalizeProgressAllocation)
        : [];

    return {
        id: toText(raw.id) || undefined,
        siteId: toText(raw.siteId),
        siteName: toText(raw.siteName),
        yearMonth: toText(raw.yearMonth),
        status: raw.status || 'draft',
        siteSnapshot: raw.siteSnapshot,
        progressLines: Array.isArray(raw.progressLines)
            ? raw.progressLines.map((line) => ({
                itemId: toText(line.itemId),
                source: line.source === 'extra' ? 'extra' as const : 'contract' as const,
                category: toText(line.category),
                workName: toText(line.workName),
                workType: toText(line.workType),
                contractQuantity: line.contractQuantity === undefined ? undefined : toProgressNumber(line.contractQuantity),
                unit: toText(line.unit),
                unitPrice: line.unitPrice === undefined ? undefined : toProgressNumber(line.unitPrice),
                currentQuantity: toProgressNumber(line.currentQuantity),
                memo: toText(line.memo),
            })).filter((line) => line.itemId)
            : [],
        allocations,
        claimAttachments: Array.isArray(raw.claimAttachments) ? raw.claimAttachments : [],
        vatMode: raw.vatMode || 'none',
        vatRate: normalizeRate(raw.vatRate, DEFAULT_PROGRESS_VAT_RATE),
        showAllocationsOnInvoice: Boolean(raw.showAllocationsOnInvoice),
        showAttachmentsOnInvoice: raw.showAttachmentsOnInvoice === undefined ? true : Boolean(raw.showAttachmentsOnInvoice),
        distributionBaseAmount: raw.distributionBaseAmount === undefined ? undefined : toProgressNumber(raw.distributionBaseAmount),
        sukumiAdjustmentAmount: raw.sukumiAdjustmentAmount === undefined ? undefined : toProgressNumber(raw.sukumiAdjustmentAmount),
        sukumiMemo: toText(raw.sukumiMemo),
        teamPositionMode: normalizeTeamPositionMode(raw.teamPositionMode),
        teamPositionManualAmount: raw.teamPositionManualAmount === undefined ? undefined : toProgressNumber(raw.teamPositionManualAmount),
        buybackBaseUnit: raw.buybackBaseUnit === undefined ? undefined : toProgressNumber(raw.buybackBaseUnit),
        buybackAfterTaxRate: raw.buybackAfterTaxRate === undefined ? undefined : normalizeRate(raw.buybackAfterTaxRate),
        teamPositionDeduct: raw.teamPositionDeduct === undefined ? undefined : toProgressNumber(raw.teamPositionDeduct),
        buybackMemo: toText(raw.buybackMemo),
        memo: toText(raw.memo),
        confirmedSnapshot: normalizeClaimSnapshot(raw.confirmedSnapshot, allocations),
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
    };
};

const getMonthEndDate = (yearMonth: string): string => {
    const [yearRaw, monthRaw] = String(yearMonth || '').split('-');
    const year = Number(yearRaw);
    const month = Number(monthRaw);
    if (!Number.isFinite(year) || !Number.isFinite(month)) return new Date().toISOString().slice(0, 10);
    const lastDay = new Date(year, month, 0).getDate();
    return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
};

const getProgressOfficeTransactionId = (claimId: string, allocationId: string): string =>
    `PROGRESS_CLAIM_ALLOCATION_${encodeURIComponent(claimId)}_${encodeURIComponent(allocationId)}`;

const getProgressAllocationBaseAmount = (claim: ProgressClaim): number =>
    toProgressNumber(
        claim.distributionBaseAmount ??
        claim.confirmedSnapshot?.allocationBaseAmount ??
        claim.confirmedSnapshot?.buybackPoolAmount ??
        0
    );

const getProgressAllocationManDay = (claim: ProgressClaim): number =>
    toProgressNumber(claim.confirmedSnapshot?.totalManDay ?? 0);

const getProgressOfficeAllocationRows = (claim: ProgressClaim) => {
    const baseAmount = getProgressAllocationBaseAmount(claim);
    const manDay = getProgressAllocationManDay(claim);
    return calculateAllocations(claim.allocations, baseAmount, manDay)
        .filter((row) => row.allocation.targetType === OFFICE_INCOME_TARGET_TYPE && row.amount > 0);
};

const syncProgressOfficeIncomeTransactions = async (
    claim: ProgressClaim,
    previous?: ProgressClaim | null
): Promise<void> => {
    const claimId = toText(claim.id);
    if (!claimId) return;

    const previousOfficeIds = new Set(
        getProgressOfficeAllocationRows(previous ? { ...previous, id: claimId } : { ...claim, id: claimId, allocations: [] })
            .map((row) => getProgressOfficeTransactionId(claimId, row.allocation.id))
    );
    const nextOfficeRows = getProgressOfficeAllocationRows(claim);
    const nextOfficeIds = new Set(
        nextOfficeRows.map((row) => getProgressOfficeTransactionId(claimId, row.allocation.id))
    );

    await Promise.all(
        Array.from(previousOfficeIds)
            .filter((id) => !nextOfficeIds.has(id))
            .map((id) => officeService.deleteTransaction(id).catch(() => undefined))
    );

    const now = new Date().toISOString();
    await Promise.all(
        nextOfficeRows.map((row) => officeService.setTransaction({
            id: getProgressOfficeTransactionId(claimId, row.allocation.id),
            date: getMonthEndDate(claim.yearMonth),
            type: 'income',
            category: 'SITE_PAYBACK',
            subCategory: '기성관리 바이백',
            amount: row.amount,
            description: `${claim.yearMonth} ${claim.siteName || '현장'} 기성 바이백 - ${row.allocation.targetName || '사무실 수입'}`,
            relatedSiteId: claim.siteId,
            relatedYearMonth: claim.yearMonth,
            source: 'progress_claim_allocation',
            createdAt: now,
            updatedAt: now,
        }))
    );
};

const mapDoc = <T extends Record<string, unknown>>(documentId: string, data: T): T & { id: string } => ({
    ...data,
    id: documentId,
});

const buildSavePayload = <T extends object>(
    normalized: T,
    isNewDocument: boolean
): Record<string, unknown> =>
    cleanForFirestore({
        ...normalized,
        updatedAt: serverTimestamp(),
        ...(isNewDocument ? { createdAt: serverTimestamp() } : {}),
    } as Record<string, unknown>);

export const progressClaimService = {
    async getContracts(): Promise<ProgressContract[]> {
        const snap = await getDocs(query(collection(db, CONTRACTS_COLLECTION), orderBy('siteName', 'asc')));
        return snap.docs.map((item) => normalizeContract(mapDoc(item.id, item.data())));
    },

    async getContractBySiteId(siteId: string): Promise<ProgressContract | null> {
        const normalizedSiteId = toText(siteId);
        if (!normalizedSiteId) return null;
        const snap = await getDocs(query(
            collection(db, CONTRACTS_COLLECTION),
            where('siteId', '==', normalizedSiteId),
            limit(1)
        ));
        const first = snap.docs[0];
        return first ? normalizeContract(mapDoc(first.id, first.data())) : null;
    },

    async saveContract(contract: ProgressContract): Promise<string> {
        const normalized = normalizeContract(contract);
        if (!normalized.siteId) throw new Error('기성 계약을 저장하려면 siteId가 필요합니다.');

        if (normalized.id) {
            const payload = buildSavePayload(normalized, false);
            await setDoc(doc(db, CONTRACTS_COLLECTION, normalized.id), payload, { merge: true });
            return normalized.id;
        }

        const existing = await progressClaimService.getContractBySiteId(normalized.siteId);
        if (existing?.id) {
            const payload = buildSavePayload({ ...normalized, id: existing.id }, false);
            await setDoc(doc(db, CONTRACTS_COLLECTION, existing.id), payload, { merge: true });
            return existing.id;
        }

        const payload = buildSavePayload(normalized, true);
        const ref = await addDoc(collection(db, CONTRACTS_COLLECTION), payload);
        return ref.id;
    },

    async getClaims(): Promise<ProgressClaim[]> {
        const snap = await getDocs(query(collection(db, CLAIMS_COLLECTION), orderBy('yearMonth', 'desc')));
        return snap.docs.map((item) => normalizeClaim(mapDoc(item.id, item.data())));
    },

    async getClaimsByMonth(yearMonth: string): Promise<ProgressClaim[]> {
        const snap = await getDocs(query(
            collection(db, CLAIMS_COLLECTION),
            where('yearMonth', '==', yearMonth)
        ));
        return snap.docs.map((item) => normalizeClaim(mapDoc(item.id, item.data())));
    },

    async getClaimsBySite(siteId: string): Promise<ProgressClaim[]> {
        const normalizedSiteId = toText(siteId);
        if (!normalizedSiteId) return [];
        const snap = await getDocs(query(
            collection(db, CLAIMS_COLLECTION),
            where('siteId', '==', normalizedSiteId)
        ));
        return snap.docs
            .map((item) => normalizeClaim(mapDoc(item.id, item.data())))
            .sort((a, b) => String(b.yearMonth).localeCompare(String(a.yearMonth)));
    },

    async getClaimBySiteMonth(siteId: string, yearMonth: string): Promise<ProgressClaim | null> {
        const normalizedSiteId = toText(siteId);
        if (!normalizedSiteId || !yearMonth) return null;
        const snap = await getDocs(query(
            collection(db, CLAIMS_COLLECTION),
            where('siteId', '==', normalizedSiteId),
            where('yearMonth', '==', yearMonth),
            limit(1)
        ));
        const first = snap.docs[0];
        return first ? normalizeClaim(mapDoc(first.id, first.data())) : null;
    },

    async saveClaim(claim: ProgressClaim): Promise<string> {
        const normalized = normalizeClaim(claim);
        if (!normalized.siteId) throw new Error('기성 청구를 저장하려면 siteId가 필요합니다.');
        if (!normalized.yearMonth) throw new Error('기성 청구를 저장하려면 yearMonth가 필요합니다.');

        if (normalized.id) {
            const previousSnap = await getDoc(doc(db, CLAIMS_COLLECTION, normalized.id));
            const previous = previousSnap.exists() ? normalizeClaim(mapDoc(previousSnap.id, previousSnap.data())) : null;
            const payload = buildSavePayload(normalized, false);
            await setDoc(doc(db, CLAIMS_COLLECTION, normalized.id), payload, { merge: true });
            await syncProgressOfficeIncomeTransactions(normalized, previous);
            return normalized.id;
        }

        const existing = await progressClaimService.getClaimBySiteMonth(normalized.siteId, normalized.yearMonth);
        if (existing?.id) {
            const savedClaim = { ...normalized, id: existing.id };
            const payload = buildSavePayload(savedClaim, false);
            await setDoc(doc(db, CLAIMS_COLLECTION, existing.id), payload, { merge: true });
            await syncProgressOfficeIncomeTransactions(savedClaim, existing);
            return existing.id;
        }

        const payload = buildSavePayload(normalized, true);
        const ref = await addDoc(collection(db, CLAIMS_COLLECTION), payload);
        await syncProgressOfficeIncomeTransactions({ ...normalized, id: ref.id }, null);
        return ref.id;
    },

    async updateClaimStatus(id: string, status: ProgressClaimStatus): Promise<void> {
        await updateDoc(doc(db, CLAIMS_COLLECTION, id), {
            status,
            updatedAt: serverTimestamp(),
        });
    },

    async uploadAttachment(params: {
        file: File;
        scope: ProgressAttachmentScope;
        siteId: string;
        yearMonth?: string;
        claimId?: string;
        onProgress?: (progress: number) => void;
    }): Promise<ProgressAttachment> {
        const siteId = toText(params.siteId) || 'unknown-site';
        const basePath = params.scope === 'site'
            ? `progress-claims/sites/${siteId}/common`
            : `progress-claims/sites/${siteId}/claims/${params.yearMonth || 'unknown-month'}`;
        const safeName = params.file.name.replace(/[\\/#?]/g, '_');
        const storageFile = new File([params.file], `${Date.now()}_${safeName}`, { type: params.file.type || undefined });
        const result = await storageService.uploadFileInfo(basePath, storageFile, params.onProgress, {
            includeDownloadUrl: true,
            metadata: params.file.type ? { contentType: params.file.type } : undefined,
        });

        return {
            id: makeProgressId('att'),
            scope: params.scope,
            siteId,
            claimId: toText(params.claimId) || undefined,
            yearMonth: toText(params.yearMonth) || undefined,
            name: params.file.name,
            fullPath: result.fullPath,
            url: result.url,
            size: result.size || params.file.size,
            contentType: result.contentType || params.file.type,
            uploadedAt: new Date().toISOString(),
        };
    },
};

export type { ProgressClaim, ProgressContract, ProgressContractItem };
