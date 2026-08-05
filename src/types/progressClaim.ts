import type { Site } from '../services/siteService';

export type ProgressClaimStatus = 'draft' | 'review' | 'confirmed' | 'billed' | 'paid';
export type ProgressVatMode = 'none' | 'separate' | 'included';
export type ProgressAllocationMethod = 'fixed' | 'percent' | 'perManDay' | 'manual';
export type ProgressSettlementMode = 'rate' | 'taxInvoice' | 'manual';
export type ProgressPaymentStatus =
    | 'pending'
    | 'needs_review'
    | 'calculating'
    | 'retention'
    | 'scheduled'
    | 'in_progress'
    | 'partial'
    | 'paid'
    | 'hold'
    | 'overpaid'
    | 'no_buyback'
    | 'cancelled';
export type ProgressEvidenceStatus = 'not_required' | 'pending' | 'received';
export type ProgressAttachmentScope = 'site' | 'claim';
export type ProgressTeamPositionMode = 'currentAmount' | 'manual';
export type ProgressClaimLineSource = 'contract' | 'extra';

export interface ProgressSiteSnapshot {
    siteId: string;
    siteName: string;
    siteAddress?: string;
    responsibleTeamId?: string;
    responsibleTeamName?: string;
    siteManagerId?: string;
    siteManagerName?: string;
    clientCompanyId?: string;
    clientCompanyName?: string;
    constructorCompanyId?: string;
    constructorCompanyName?: string;
    partnerId?: string;
    partnerName?: string;
    siteType?: string;
    paymentMethod?: string;
}

export interface ProgressContractItem {
    id: string;
    category: string;
    workName: string;
    workType: string;
    contractQuantity: number;
    unit: string;
    unitPrice: number;
    remark?: string;
    active: boolean;
}

export interface ProgressAttachment {
    id: string;
    scope: ProgressAttachmentScope;
    siteId: string;
    claimId?: string;
    yearMonth?: string;
    name: string;
    fullPath: string;
    url?: string;
    size?: number;
    contentType?: string;
    memo?: string;
    uploadedAt: string;
}

export interface ProgressContract {
    id?: string;
    siteId: string;
    siteName: string;
    memo?: string;
    items: ProgressContractItem[];
    commonAttachments: ProgressAttachment[];
    createdAt?: unknown;
    updatedAt?: unknown;
}

export interface ProgressClaimLine {
    itemId: string;
    source?: ProgressClaimLineSource;
    category?: string;
    workName?: string;
    workType?: string;
    contractQuantity?: number;
    unit?: string;
    unitPrice?: number;
    currentQuantity: number;
    memo?: string;
}

export interface ProgressAllocation {
    id: string;
    /** Canonical settlement-target reference. `targetId` remains for legacy UI/data compatibility. */
    settlementTargetId?: string;
    targetId?: string;
    targetName: string;
    targetType?: string;
    companyName?: string;
    method: ProgressAllocationMethod;
    fixedAmount?: number;
    percent?: number;
    amountPerManDay?: number;
    manualAmount?: number;
    memo?: string;
    settlementMode?: ProgressSettlementMode;
    /** Decimal rate in the inclusive 0..1 range. Legacy percentage inputs are normalized by the service. */
    afterTaxRate?: number;
    manualAfterTaxAmount?: number;
    paymentStatus?: ProgressPaymentStatus;
    /** Cumulative amount actually paid for partial/overpayment reconciliation. */
    paidAmount?: number;
    paymentDueDate?: string;
    paidAt?: string;
    /** Evidence policy captured when the financial terms were confirmed. */
    evidenceRequired?: boolean;
    evidenceStatus?: ProgressEvidenceStatus;
    paymentMemo?: string;
}

export interface ProgressClaimSnapshot {
    site: ProgressSiteSnapshot;
    contractItems: ProgressContractItem[];
    progressLines: ProgressClaimLine[];
    /** Optional for backward compatibility with snapshots created before allocation snapshots were introduced. */
    allocations?: ProgressAllocation[];
    totalManDay: number;
    dailyAmount?: number;
    dailyRowCount?: number;
    contractAmount: number;
    previousAmount: number;
    currentAmount: number;
    cumulativeAmount: number;
    remainingAmount: number;
    sukumiUnitPrice: number;
    sukumiAdjustmentAmount?: number;
    teamPositionMode?: ProgressTeamPositionMode;
    teamPositionManualAmount?: number;
    buybackBaseUnit?: number;
    buybackUnit?: number;
    buybackTotalAmount?: number;
    buybackAfterTaxRate?: number;
    buybackAfterTaxAmount?: number;
    teamPositionUnit?: number;
    teamPositionAmount?: number;
    teamPositionDeduct?: number;
    buybackPoolAmount?: number;
    allocationBaseAmount?: number;
    allocationRemainAmount?: number;
    supplyAmount: number;
    vatAmount: number;
    billingAmount: number;
    allocationAmount: number;
    vatMode?: ProgressVatMode;
    vatRate?: number;
    confirmedAt: string;
}

export interface ProgressClaim {
    id?: string;
    siteId: string;
    siteName: string;
    yearMonth: string;
    status: ProgressClaimStatus;
    siteSnapshot?: ProgressSiteSnapshot;
    progressLines: ProgressClaimLine[];
    allocations: ProgressAllocation[];
    claimAttachments: ProgressAttachment[];
    vatMode: ProgressVatMode;
    vatRate: number;
    showAllocationsOnInvoice: boolean;
    showAttachmentsOnInvoice: boolean;
    distributionBaseAmount?: number;
    sukumiAdjustmentAmount?: number;
    sukumiMemo?: string;
    teamPositionMode?: ProgressTeamPositionMode;
    teamPositionManualAmount?: number;
    buybackBaseUnit?: number;
    buybackAfterTaxRate?: number;
    teamPositionDeduct?: number;
    buybackMemo?: string;
    memo?: string;
    confirmedSnapshot?: ProgressClaimSnapshot;
    createdAt?: unknown;
    updatedAt?: unknown;
}

export interface ProgressDailyManDaySummary {
    siteId: string;
    siteName: string;
    siteType: string;
    manDay: number;
    amount: number;
    rowCount: number;
}

export interface ProgressItemCalculatedRow {
    item: ProgressContractItem;
    source: ProgressClaimLineSource;
    line?: ProgressClaimLine;
    contractAmount: number;
    previousQuantity: number;
    currentQuantity: number;
    cumulativeQuantity: number;
    remainingQuantity: number;
    previousAmount: number;
    currentAmount: number;
    cumulativeAmount: number;
    remainingAmount: number;
    progressRate: number;
}

export interface ProgressVatSummary {
    supplyAmount: number;
    vatAmount: number;
    billingAmount: number;
}

export interface ProgressAllocationCalculatedRow {
    allocation: ProgressAllocation;
    amount: number;
}

export interface ProgressClaimSummary extends ProgressVatSummary {
    siteId: string;
    siteName: string;
    contractAmount: number;
    previousAmount: number;
    currentAmount: number;
    cumulativeAmount: number;
    remainingAmount: number;
    totalManDay: number;
    dailyAmount: number;
    dailyRowCount: number;
    sukumiUnitPrice: number;
    teamPositionMode: ProgressTeamPositionMode;
    teamPositionManualAmount: number;
    buybackUnit: number;
    buybackTotalAmount: number;
    teamPositionUnit: number;
    teamPositionAmount: number;
    buybackPoolAmount: number;
    allocationBaseAmount: number;
    allocationAmount: number;
    allocationRemainAmount: number;
}

export const DEFAULT_PROGRESS_VAT_RATE = 0.1;

export const PROGRESS_STATUS_LABELS: Record<ProgressClaimStatus, string> = {
    draft: '작성중',
    review: '검토중',
    confirmed: '확정',
    billed: '청구완료',
    paid: '입금완료',
};

export const PROGRESS_VAT_MODE_LABELS: Record<ProgressVatMode, string> = {
    none: '부가세 표시 안 함',
    separate: '공급가액 + 부가세',
    included: '부가세 포함',
};

export const PROGRESS_ALLOCATION_METHOD_LABELS: Record<ProgressAllocationMethod, string> = {
    fixed: '고정금액',
    percent: '비율',
    perManDay: '공수당',
    manual: '직접입력',
};

export const buildProgressSiteSnapshot = (site: Site | null | undefined, fallback?: Partial<ProgressSiteSnapshot>): ProgressSiteSnapshot => ({
    siteId: String(site?.id ?? fallback?.siteId ?? '').trim(),
    siteName: String(site?.name ?? fallback?.siteName ?? '').trim(),
    siteAddress: String(site?.address ?? fallback?.siteAddress ?? '').trim() || undefined,
    responsibleTeamId: String(site?.responsibleTeamId ?? fallback?.responsibleTeamId ?? '').trim() || undefined,
    responsibleTeamName: String(site?.responsibleTeamName ?? fallback?.responsibleTeamName ?? '').trim() || undefined,
    siteManagerId: String(site?.siteManagerId ?? fallback?.siteManagerId ?? '').trim() || undefined,
    siteManagerName: String(site?.siteManagerName ?? fallback?.siteManagerName ?? '').trim() || undefined,
    clientCompanyId: String(site?.clientCompanyId ?? fallback?.clientCompanyId ?? '').trim() || undefined,
    clientCompanyName: String(site?.clientCompanyName ?? fallback?.clientCompanyName ?? '').trim() || undefined,
    constructorCompanyId: String(site?.companyId ?? site?.constructorCompanyId ?? fallback?.constructorCompanyId ?? '').trim() || undefined,
    constructorCompanyName: String(site?.companyName ?? site?.constructorCompanyName ?? fallback?.constructorCompanyName ?? '').trim() || undefined,
    partnerId: String(site?.partnerId ?? fallback?.partnerId ?? '').trim() || undefined,
    partnerName: String(site?.partnerName ?? fallback?.partnerName ?? '').trim() || undefined,
    siteType: String(site?.siteType ?? fallback?.siteType ?? '').trim() || undefined,
    paymentMethod: String(site?.paymentMethod ?? fallback?.paymentMethod ?? '').trim() || undefined,
});
