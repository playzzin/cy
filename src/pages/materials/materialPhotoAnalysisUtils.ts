import {
    AnalyzedMaterialTransaction,
    AnalyzedMaterialTransactionItem,
    MaterialAnalyzeContext,
} from '../../services/geminiService';
import { Site } from '../../services/siteService';
import { Material } from '../../types/materials';

export interface AppliedMaterialAnalysis {
    nextQuantities: Record<string, number>;
    matchedCount: number;
    unmatchedItems: AnalyzedMaterialTransactionItem[];
    matchedItems: Array<{
        item: AnalyzedMaterialTransactionItem;
        material: Material;
        quantity: number;
    }>;
}

const normalizeText = (value: unknown): string => {
    const text = String(value ?? '').trim();
    const normalized = typeof text.normalize === 'function' ? text.normalize('NFKC') : text;
    return normalized
        .toLowerCase()
        .replace(/안전발판/g, '발판')
        .replace(/받침\s*철물/g, '받침철물')
        .replace(/부속\s*철물/g, '부속철물')
        .replace(/[ØøΦφ]/g, 'o')
        .replace(/[\s\-_/.,:;()[\]{}'"`~!@#$%^&*+=<>?|\\]+/g, '')
        .replace(/[^0-9a-z가-힣]/g, '');
};

const getSpecNumber = (value: unknown): string => {
    const match = String(value ?? '').match(/\d+(?:\.\d+)?/);
    if (!match) return '';
    return match[0].replace(/^0+(?=\d)/, '');
};

const normalizeItemName = (value: unknown): string => {
    const normalized = normalizeText(value);
    if (normalized.includes('안전발판')) return '발판';
    if (normalized.includes('발판')) return '발판';
    if (normalized.includes('수직')) return '수직재';
    if (normalized.includes('수평')) return '수평재';
    if (normalized.includes('받침')) return '받침철물';
    if (normalized.includes('잭베이스') || normalized.includes('베이스잭')) return '베이스잭';
    if (normalized.includes('클램프')) return '클램프';
    return normalized;
};

const getQuantity = (value: unknown): number => {
    const numeric = typeof value === 'number'
        ? value
        : Number(String(value ?? '').replace(/,/g, '').trim());
    if (!Number.isFinite(numeric) || numeric <= 0) return 0;
    return Math.round(numeric * 1000) / 1000;
};

const scoreMaterialMatch = (item: AnalyzedMaterialTransactionItem, material: Material): number => {
    const raw = normalizeText([
        item.category,
        item.itemName,
        item.spec,
        item.unit,
        item.rawText,
    ].join(' '));
    const itemName = normalizeItemName(item.itemName || item.rawText);
    const spec = normalizeText(item.spec || '');
    const category = normalizeText(item.category || '');
    const materialCategory = normalizeText(material.category);
    const materialItemName = normalizeItemName(material.itemName);
    const materialSpec = normalizeText(material.spec);
    const itemSpecNumber = getSpecNumber(item.spec || item.rawText);
    const materialSpecNumber = getSpecNumber(material.spec);

    let score = 0;

    if (itemName && materialItemName === itemName) score += 70;
    else if (itemName && (materialItemName.includes(itemName) || itemName.includes(materialItemName))) score += 50;
    else if (materialItemName && raw.includes(materialItemName)) score += 35;

    if (spec && materialSpec === spec) score += 80;
    else if (spec && (materialSpec.includes(spec) || spec.includes(materialSpec))) score += 50;
    else if (materialSpec && raw.includes(materialSpec)) score += 55;
    else if (itemSpecNumber && materialSpecNumber && itemSpecNumber === materialSpecNumber && score >= 50) score += 25;

    if (category && materialCategory === category) score += 15;
    else if (category && materialCategory.includes(category)) score += 8;

    if (item.unit && material.unit && normalizeText(item.unit) === normalizeText(material.unit)) score += 4;

    return score;
};

const findBestMaterialMatch = (
    item: AnalyzedMaterialTransactionItem,
    materials: Material[]
): Material | null => {
    const ranked = materials
        .map((material) => ({ material, score: scoreMaterialMatch(item, material) }))
        .sort((a, b) => b.score - a.score);

    const best = ranked[0];
    if (!best || best.score < 70) return null;

    const secondScore = ranked[1]?.score || 0;
    const hasSpec = Boolean(normalizeText(item.spec || item.rawText));
    const itemName = normalizeItemName(item.itemName || item.rawText);
    const sameItemCandidates = itemName
        ? materials.filter((material) => normalizeItemName(material.itemName) === itemName)
        : [];

    if (best.score >= 95) return best.material;
    if (hasSpec && best.score - secondScore >= 8) return best.material;
    if (!hasSpec && sameItemCandidates.length === 1) return best.material;

    return null;
};

export const applyAnalyzedMaterialItemsToQuantities = (options: {
    analysis: AnalyzedMaterialTransaction;
    materials: Material[];
    currentQuantities: Record<string, number>;
}): AppliedMaterialAnalysis => {
    const { analysis, materials, currentQuantities } = options;
    const nextQuantities = { ...currentQuantities };
    const appliedByMaterialId = new Map<string, number>();
    const unmatchedItems: AnalyzedMaterialTransactionItem[] = [];
    const matchedItems: AppliedMaterialAnalysis['matchedItems'] = [];

    (analysis.items || []).forEach((item) => {
        const quantity = getQuantity(item.quantity);
        if (quantity <= 0) return;

        const material = findBestMaterialMatch(item, materials);
        if (!material) {
            unmatchedItems.push(item);
            return;
        }

        appliedByMaterialId.set(material.id, (appliedByMaterialId.get(material.id) || 0) + quantity);
        matchedItems.push({ item, material, quantity });
    });

    appliedByMaterialId.forEach((quantity, materialId) => {
        nextQuantities[materialId] = quantity;
    });

    return {
        nextQuantities,
        matchedCount: appliedByMaterialId.size,
        unmatchedItems,
        matchedItems,
    };
};

export const findMatchingSite = (sites: Site[], siteName?: string): Site | undefined => {
    const target = normalizeText(siteName);
    if (!target) return undefined;

    return sites.find((site) => normalizeText(site.name) === target)
        || sites.find((site) => {
            const name = normalizeText(site.name);
            return name.includes(target) || target.includes(name);
        });
};

export const findMatchingNamedOption = <T,>(
    rows: T[],
    getName: (row: T) => string | undefined,
    targetName?: string
): T | undefined => {
    const target = normalizeText(targetName);
    if (!target) return undefined;

    return rows.find((row) => normalizeText(getName(row)) === target)
        || rows.find((row) => {
            const name = normalizeText(getName(row));
            return name.includes(target) || target.includes(name);
        });
};

export const normalizeAnalyzedDate = (value?: string, fallbackYear = new Date().getFullYear()): string => {
    const text = String(value || '').trim();
    if (!text) return '';

    const full = text.match(/(20\d{2})[.\-/년\s]+(\d{1,2})[.\-/월\s]+(\d{1,2})/);
    if (full) {
        return `${full[1]}-${full[2].padStart(2, '0')}-${full[3].padStart(2, '0')}`;
    }

    const short = text.match(/(^|\D)(\d{1,2})[.\-/월\s]+(\d{1,2})(\D|$)/);
    if (short) {
        return `${fallbackYear}-${short[2].padStart(2, '0')}-${short[3].padStart(2, '0')}`;
    }

    return '';
};

export const buildMaterialAnalyzeContext = (options: {
    transactionType: 'inbound' | 'outbound';
    sites: Site[];
    materials: Material[];
    rentalCompanies?: string[];
}): MaterialAnalyzeContext => ({
    transactionType: options.transactionType,
    today: new Date().toISOString().slice(0, 10),
    sites: options.sites.map((site) => site.name).filter(Boolean),
    materials: options.materials.map((material) => ({
        category: material.category,
        itemName: material.itemName,
        spec: material.spec,
        unit: material.unit,
    })),
    rentalCompanies: options.rentalCompanies || [],
});

export const describeAnalyzedItem = (item: AnalyzedMaterialTransactionItem): string => {
    const name = [item.itemName, item.spec].map((value) => String(value || '').trim()).filter(Boolean).join(' ');
    const quantity = getQuantity(item.quantity);
    return `${name || item.rawText || '품목 미확인'}${quantity > 0 ? ` ${quantity}` : ''}`;
};
