import { EstimateItem } from '../services/estimateService';
import { Material } from '../types/materials';
import { createItem } from './estimateUtils';

export type RentalAmountBasis = 'supply' | 'total';
export type RentalWorkType = 'shoring' | 'scaffold';

export interface RentalMaterialRate {
    materialId: string;
    materialKey?: string;
    category: string;
    itemName: string;
    spec: string;
    unit: string;
    baseFee: number;
    dailyFee: number;
    maxQuantity: number;
    active: boolean;
}

export interface RentalGenerationOptions {
    targetAmount: number;
    amountBasis: RentalAmountBasis;
    usageDays: number;
    rowCount: number;
    vatRate: number;
    includeVat: boolean;
    issueDate: string;
    workType?: RentalWorkType;
}

export interface RentalGenerationResult {
    items: EstimateItem[];
    targetSupply: number;
    subtotal: number;
    tax: number;
    total: number;
    difference: number;
}

const clampNumber = (value: unknown, min: number, max: number, fallback: number): number => {
    const parsed = typeof value === 'number' ? value : Number(String(value ?? '').replace(/,/g, '').trim());
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
};

const sanitizeText = (value: unknown): string => String(value ?? '').trim();

const normalizeWorkTypeText = (value: unknown): string =>
    sanitizeText(value).replace(/\s+/g, '').toLowerCase();

export const isRentalRateInWorkType = (rate: RentalMaterialRate, workType?: RentalWorkType): boolean => {
    if (!workType) return true;

    const text = normalizeWorkTypeText(`${rate.category} ${rate.itemName} ${rate.spec} ${rate.materialKey || ''}`);
    if (workType === 'shoring') {
        return text.includes('시스템동바리') || text.includes('동바리');
    }

    return text.includes('시스템비계') || text.includes('비계');
};

const getDefaultBaseFee = (material: Material): number => {
    const fromMaster = clampNumber(material.unitPrice, 0, 99999999, 0);
    if (fromMaster > 0) return Math.round(fromMaster);

    const name = `${material.category} ${material.itemName} ${material.spec}`.toLowerCase();
    if (name.includes('발판')) return 500;
    if (name.includes('계단') || name.includes('워킹')) return 900;
    if (name.includes('수직') || name.includes('p')) return 400;
    if (name.includes('수평') || name.includes('h')) return 150;
    if (name.includes('쟈키') || name.includes('자키') || name.includes('jack')) return 130;
    return 300;
};

export const createRentalRateFromMaterial = (
    material: Material,
    previous?: Partial<RentalMaterialRate>
): RentalMaterialRate => {
    const baseFee = previous?.baseFee !== undefined
        ? clampNumber(previous.baseFee, 0, 99999999, 0)
        : getDefaultBaseFee(material);

    return {
        materialId: material.id,
        materialKey: material.materialKey,
        category: sanitizeText(material.category) || '기타',
        itemName: sanitizeText(material.itemName) || '자재',
        spec: sanitizeText(material.spec),
        unit: sanitizeText(material.unit) || 'EA',
        baseFee,
        dailyFee: previous?.dailyFee !== undefined
            ? clampNumber(previous.dailyFee, 0, 99999999, 0)
            : Math.max(1, Math.round(baseFee / 45)),
        maxQuantity: previous?.maxQuantity !== undefined
            ? Math.round(clampNumber(previous.maxQuantity, 1, 999999, 5000))
            : 5000,
        active: previous?.active !== undefined ? Boolean(previous.active) : true,
    };
};

export const mergeRentalRatesWithMaterials = (
    materials: Material[],
    previousRates: RentalMaterialRate[]
): RentalMaterialRate[] => {
    const byId = new Map(previousRates.map((rate) => [rate.materialId, rate]));
    return materials.map((material) => createRentalRateFromMaterial(material, byId.get(material.id)));
};

const shuffle = <T,>(rows: T[]): T[] => {
    const next = [...rows];
    for (let i = next.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [next[i], next[j]] = [next[j], next[i]];
    }
    return next;
};

const getLineUnitAmount = (rate: RentalMaterialRate, usageDays: number): number => {
    const base = Math.max(0, Math.round(rate.baseFee || 0));
    const daily = Math.max(0, Math.round(rate.dailyFee || 0));
    return Math.max(1, base + (Math.max(1, Math.round(usageDays)) * daily));
};

const getMaxQuantity = (rate: RentalMaterialRate): number =>
    Math.max(1, Math.round(rate.maxQuantity || 1));

const createRentalItem = (
    rate: RentalMaterialRate,
    quantity: number,
    usageDays: number,
    issueDate: string,
    baseFee = rate.baseFee,
    dailyFee = rate.dailyFee,
    note = ''
): EstimateItem => {
    const label = [rate.itemName, rate.spec].filter(Boolean).join(' ');
    return createItem({
        category: rate.category,
        section: label || rate.itemName,
        label: label || rate.itemName,
        unit: rate.unit || 'EA',
        quantity,
        finalUnitPrice: Math.max(0, Math.round(baseFee)),
        rentalUnitPrice: Math.max(0, Math.round(dailyFee)),
        period: Math.max(1, Math.round(usageDays)),
        itemDate: issueDate,
        note: sanitizeText(note),
    } as Partial<EstimateItem>);
};

const createRentalAdjustmentItem = (
    amount: number,
    issueDate: string
): EstimateItem => createItem({
    category: '금액 조정',
    section: '임대 금액 조정',
    label: '임대 금액 조정',
    unit: '식',
    quantity: 1,
    finalUnitPrice: Math.max(0, Math.round(amount)),
    rentalUnitPrice: 0,
    period: 1,
    itemDate: issueDate,
    note: '목표 공급가 맞춤',
} as Partial<EstimateItem>);

export const calculateRentalTargetSupply = (
    targetAmount: number,
    amountBasis: RentalAmountBasis,
    vatRate: number,
    includeVat: boolean
): number => {
    const normalizedTarget = Math.max(0, Math.round(targetAmount || 0));
    if (amountBasis === 'total' && includeVat) {
        return Math.round(normalizedTarget / (1 + (Math.max(0, vatRate || 0) / 100)));
    }
    return normalizedTarget;
};

export const calculateRentalLineAmount = (item: Partial<EstimateItem>): number => {
    const quantity = Math.max(0, Number(item.quantity || 0));
    const usageDays = Math.max(1, Number(item.period || 1));
    const baseFee = Math.max(0, Number(item.finalUnitPrice || item.unitPrice || 0));
    const dailyFee = Math.max(0, Number(item.rentalUnitPrice || 0));
    return Math.round(quantity * (baseFee + (usageDays * dailyFee)));
};

const getRentalItemUnitAmount = (item: Partial<EstimateItem>): number => {
    const usageDays = Math.max(1, Number(item.period || 1));
    const baseFee = Math.max(0, Number(item.finalUnitPrice || item.unitPrice || 0));
    const dailyFee = Math.max(0, Number(item.rentalUnitPrice || 0));
    return Math.max(1, Math.round(baseFee + (usageDays * dailyFee)));
};

const tuneRentalQuantitiesToTarget = (
    items: EstimateItem[],
    targetSupply: number,
    maxQuantities: Map<string, number>
): void => {
    let difference = targetSupply - items.reduce((sum, item) => sum + calculateRentalLineAmount(item), 0);
    let guard = 0;

    while (difference !== 0 && guard < 100) {
        guard++;
        let best: { item: EstimateItem; quantityDelta: number; nextDifference: number } | null = null;

        for (const item of items) {
            const unitAmount = getRentalItemUnitAmount(item);
            const currentQuantity = Math.max(1, Math.round(Number(item.quantity || 1)));
            const direction = difference > 0 ? 1 : -1;
            const availableSteps = direction > 0
                ? Math.max(0, (maxQuantities.get(item.id) || currentQuantity) - currentQuantity)
                : Math.max(0, currentQuantity - 1);

            if (availableSteps <= 0) continue;

            const baseSteps = Math.max(1, Math.floor(Math.abs(difference) / unitAmount));
            const candidates = Array.from(new Set([
                Math.min(availableSteps, baseSteps),
                Math.min(availableSteps, baseSteps + 1),
            ])).filter((steps) => steps > 0);

            for (const steps of candidates) {
                const quantityDelta = direction * steps;
                const nextDifference = difference - (quantityDelta * unitAmount);
                if (Math.abs(nextDifference) >= Math.abs(difference)) continue;
                // Keep the generated material amount under the target.  Any
                // remaining won-level difference is added as a transparent
                // adjustment row below, so the target can always be exact.
                if ((difference > 0 && nextDifference < 0) || (difference < 0 && nextDifference > 0)) continue;

                if (!best || Math.abs(nextDifference) < Math.abs(best.nextDifference)) {
                    best = { item, quantityDelta, nextDifference };
                }
            }
        }

        if (!best) return;

        best.item.quantity = Math.max(1, Math.round(Number(best.item.quantity || 1)) + best.quantityDelta);
        difference = best.nextDifference;
    }
};

export const generateRentalTransactionItems = (
    rates: RentalMaterialRate[],
    options: RentalGenerationOptions
): RentalGenerationResult => {
    const activeRates = rates
        .filter((rate) => rate.active !== false)
        .filter((rate) => isRentalRateInWorkType(rate, options.workType))
        .filter((rate) => getLineUnitAmount(rate, options.usageDays) > 0);

    const targetSupply = calculateRentalTargetSupply(
        options.targetAmount,
        options.amountBasis,
        options.vatRate,
        options.includeVat
    );

    if (targetSupply <= 0 || activeRates.length === 0) {
        return { items: [], targetSupply, subtotal: 0, tax: 0, total: 0, difference: targetSupply };
    }

    const requestedRows = Math.max(1, Math.min(30, Math.round(options.rowCount || 1)));
    const desiredRows = Math.max(1, Math.min(requestedRows, targetSupply));
    const selectedRates = shuffle(activeRates);
    while (selectedRates.length < desiredRows) {
        selectedRates.push(...shuffle(activeRates));
    }

    const rows = selectedRates.slice(0, desiredRows);
    const items: EstimateItem[] = [];
    const itemMaxQuantities = new Map<string, number>();
    let remaining = targetSupply;

    const pushRentalItem = (rate: RentalMaterialRate, quantity: number): void => {
        const item = createRentalItem(rate, quantity, options.usageDays, options.issueDate);
        itemMaxQuantities.set(item.id, getMaxQuantity(rate));
        items.push(item);
    };

    rows.slice(0, -1).forEach((rate, idx) => {
        if (remaining <= 0) return;

        const unitAmount = getLineUnitAmount(rate, options.usageDays);
        const naturalFutureMinimum = rows
            .slice(idx + 1, -1)
            .reduce((sum, futureRate) => sum + getLineUnitAmount(futureRate, options.usageDays), 0);
        const maxNaturalSpend = Math.max(0, remaining - naturalFutureMinimum);

        if (maxNaturalSpend >= unitAmount) {
            const averageBudget = remaining / (rows.length - idx);
            const randomFactor = 0.65 + (Math.random() * 0.7);
            const targetLineAmount = Math.max(unitAmount, Math.min(maxNaturalSpend, Math.round(averageBudget * randomFactor)));
            const maxQuantity = Math.max(1, Math.floor(maxNaturalSpend / unitAmount));
            const quantity = Math.max(1, Math.min(getMaxQuantity(rate), maxQuantity, Math.round(targetLineAmount / unitAmount)));
            const amount = quantity * unitAmount;

            pushRentalItem(rate, quantity);
            remaining -= amount;
            return;
        }

        // This rate cannot fit without exceeding the target.  Leave the
        // amount for the exact adjustment row instead of creating an overrun.
    });

    if (remaining > 0) {
        const finalRate = rows[rows.length - 1];
        const preferredUnitAmount = getLineUnitAmount(finalRate, options.usageDays);
        const maxQuantity = Math.min(
            getMaxQuantity(finalRate),
            Math.floor(remaining / preferredUnitAmount)
        );
        if (maxQuantity > 0) {
            const quantity = Math.max(1, Math.min(
                maxQuantity,
                Math.round(remaining / preferredUnitAmount)
            ));
            pushRentalItem(finalRate, quantity);
        }
    }

    tuneRentalQuantitiesToTarget(items, targetSupply, itemMaxQuantities);

    let subtotal = items.reduce((sum, item) => sum + calculateRentalLineAmount(item), 0);
    const remainingAdjustment = targetSupply - subtotal;
    if (remainingAdjustment > 0) {
        items.push(createRentalAdjustmentItem(remainingAdjustment, options.issueDate));
        subtotal += remainingAdjustment;
    }
    const tax = options.includeVat ? Math.round(subtotal * (Math.max(0, options.vatRate || 0) / 100)) : 0;
    const total = subtotal + tax;

    return {
        items,
        targetSupply,
        subtotal,
        tax,
        total,
        difference: targetSupply - subtotal,
    };
};
