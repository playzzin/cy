import type {
    ProgressAllocation,
    ProgressSettlementMode,
} from '../types/progressClaim';

export const DEFAULT_BUYBACK_AFTER_TAX_RATE = 0.75;

export interface BuybackSettlementInput {
    settlementMode?: ProgressSettlementMode | string | null;
    afterTaxRate?: number | string | null;
    manualAfterTaxAmount?: number | string | null;
}

export interface BuybackSettlementAmounts {
    grossAmount: number;
    afterTaxAmount: number;
    taxAmount: number;
    settlementMode: ProgressSettlementMode;
    /** Effective decimal rate after normalization and amount rounding. */
    afterTaxRate: number;
}

const toFiniteNumber = (value: unknown): number | undefined => {
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
const clamp = (value: number, minimum: number, maximum: number): number =>
    Math.min(maximum, Math.max(minimum, value));

const roundMoney = (value: unknown): number => {
    const parsed = toFiniteNumber(value);
    return Math.round(parsed ?? 0);
};

export const normalizeBuybackSettlementMode = (value: unknown): ProgressSettlementMode => {
    if (value === 'taxInvoice' || value === 'manual') return value;
    return 'rate';
};

/**
 * Accepts decimal rates (0.75) and percentage rates (75 or "75%").
 * Values outside the valid range are safely clamped to 0..1.
 */
export const normalizeBuybackAfterTaxRate = (
    value: unknown,
    fallback = DEFAULT_BUYBACK_AFTER_TAX_RATE
): number => {
    const parsed = toFiniteNumber(value);
    const fallbackParsed = toFiniteNumber(fallback) ?? DEFAULT_BUYBACK_AFTER_TAX_RATE;
    const selected = parsed ?? fallbackParsed;
    const decimal = selected > 1 ? selected / 100 : selected;
    return clamp(decimal, 0, 1);
};

/**
 * Resolves the canonical settlement-target reference without treating the
 * synthetic office-income row as a settlement target. Legacy non-office
 * `targetId` values remain a read-compatible fallback.
 */
export const resolveProgressSettlementTargetId = (
    allocation: Pick<ProgressAllocation, 'settlementTargetId' | 'targetId' | 'targetType'>
): string | undefined => {
    const targetType = String(allocation.targetType ?? '').trim();
    const legacyTargetId = String(allocation.targetId ?? '').trim();
    const isOfficeIncome = targetType === 'office_income' || legacyTargetId === 'office_income';
    if (isOfficeIncome) return undefined;

    const canonicalId = String(allocation.settlementTargetId ?? '').trim();
    return canonicalId || legacyTargetId || undefined;
};

/**
 * Splits a non-negative, won-rounded gross amount into after-tax and tax
 * amounts. The result always satisfies gross = afterTax + tax.
 */
export const calculateBuybackSettlement = (
    grossValue: unknown,
    input: BuybackSettlementInput = {}
): BuybackSettlementAmounts => {
    const grossAmount = Math.max(0, roundMoney(grossValue));
    const settlementMode = normalizeBuybackSettlementMode(input.settlementMode);

    if (settlementMode === 'taxInvoice') {
        return {
            grossAmount,
            afterTaxAmount: 0,
            taxAmount: grossAmount,
            settlementMode,
            afterTaxRate: 0,
        };
    }

    if (settlementMode === 'manual') {
        const manualAmount = Math.max(0, roundMoney(input.manualAfterTaxAmount));
        const afterTaxAmount = clamp(manualAmount, 0, grossAmount);
        return {
            grossAmount,
            afterTaxAmount,
            taxAmount: grossAmount - afterTaxAmount,
            settlementMode,
            afterTaxRate: grossAmount > 0 ? afterTaxAmount / grossAmount : 0,
        };
    }

    const normalizedRate = normalizeBuybackAfterTaxRate(input.afterTaxRate);
    const afterTaxAmount = clamp(roundMoney(grossAmount * normalizedRate), 0, grossAmount);
    return {
        grossAmount,
        afterTaxAmount,
        taxAmount: grossAmount - afterTaxAmount,
        settlementMode,
        afterTaxRate: normalizedRate,
    };
};
