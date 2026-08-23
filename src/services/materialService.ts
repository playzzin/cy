import { materialFirestoreService } from './materialFirestoreService';
import {
    Material,
    InboundTransaction,
    OutboundTransaction,
    Inventory,
    TransactionFilters,
    MaterialPhotoBatch
} from '../types/materials';
import { Timestamp } from '../types/timestamp';
import {
    MaterialZod,
    MaterialInboundZod,
    MaterialOutboundZod
} from '../types/zod/materialSchema';
import type { MaterialLogAction, MaterialLogEntityType } from '../types/materialLog';
import { EXCEL_MATERIAL_CATALOG } from '../constants/materialCatalog';
import { sortMaterialDisplayRows } from '../utils/materialOrdering';
import { storageService } from './storageService';

// Helper to generate IDs
const generateId = (prefix: string = 'mat'): string => {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

const MATERIAL_SELECTION_CACHE_TTL_MS = 60 * 1000;
let selectableMaterialsCache: { rows: Material[]; expiresAt: number } | null = null;

const clearMaterialSelectionCache = () => {
    selectableMaterialsCache = null;
};

const logMaterialChange = async (
    action: MaterialLogAction,
    entityType: MaterialLogEntityType,
    before: Record<string, unknown> | null,
    after: Record<string, unknown> | null,
    source = 'materialService'
): Promise<void> => {
    try {
        const { materialLogService } = await import('./materialLogService');
        await materialLogService.safeCreateLog({
            action,
            entityType,
            before,
            after,
            source,
        });
    } catch (error) {
        console.warn('[materialService] material log failed:', error);
    }
};

const cleanupMaterialPhotoBatchIfUnreferenced = async (photoBatchId?: string): Promise<void> => {
    if (!photoBatchId) return;

    try {
        const remainingReferences = await materialFirestoreService.countPhotoBatchReferences(photoBatchId);
        if (remainingReferences > 0) return;

        const photoBatch = await materialFirestoreService.getPhotoBatch(photoBatchId) as MaterialPhotoBatch | null;
        if (!photoBatch) return;

        const photoPaths = Array.from(new Set(
            (photoBatch.photos || [])
                .map((photo) => String(photo.path || '').trim())
                .filter(Boolean)
        ));

        await Promise.all(photoPaths.map(async (path) => {
            try {
                await storageService.deleteFile(path);
            } catch (error) {
                console.warn('[materialService] material photo cleanup skipped:', path, error);
            }
        }));

        await materialFirestoreService.deletePhotoBatch(photoBatchId);
    } catch (error) {
        console.warn('[materialService] material photo batch cleanup failed:', error);
    }
};

const trimText = (value: unknown): string => String(value ?? '').trim();

const normalizeSpaces = (value: unknown): string => trimText(value).replace(/\s+/g, ' ');

const normalizeMaterialDescription = (value: unknown): string => {
    const description = trimText(value);
    return description === 'Excel 기본 자재' ? '' : description;
};

const compactKeyPart = (value: unknown): string => normalizeSpaces(value).replace(/\s+/g, '').toLowerCase();

const normalizeMaterialCategory = (value: unknown): string => {
    const text = normalizeSpaces(value);
    if (text.includes('비계')) return '비계';
    if (text.includes('동바리') || text.includes('서포트')) return '동바리';
    return text;
};

const toComparableMillis = (value: unknown): number => {
    if (!value) return 0;
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'number') return value;
    if (typeof value === 'object' && value !== null) {
        const maybeTimestamp = value as {
            toDate?: () => Date;
            seconds?: number;
        };
        if (typeof maybeTimestamp.toDate === 'function') {
            return maybeTimestamp.toDate().getTime();
        }
        if (typeof maybeTimestamp.seconds === 'number') {
            return maybeTimestamp.seconds * 1000;
        }
    }
    return 0;
};

export const buildMaterialBusinessKey = (
    material: Pick<Material, 'category' | 'itemName' | 'spec'>
): string => {
    return [
        compactKeyPart(normalizeMaterialCategory(material.category)),
        compactKeyPart(material.itemName),
        compactKeyPart(material.spec),
    ].join('::');
};

const getMaterialQualityScore = (material: Partial<Material>): number => {
    return [
        trimText(material.category),
        trimText(material.itemName),
        trimText(material.spec),
        trimText(material.unit),
        trimText(material.description),
    ].filter(Boolean).length;
};

const compareMaterialPreference = (candidate: Material, current: Material): number => {
    const qualityDiff = getMaterialQualityScore(candidate) - getMaterialQualityScore(current);
    if (qualityDiff !== 0) return qualityDiff;

    const updatedDiff = toComparableMillis(candidate.updatedAt) - toComparableMillis(current.updatedAt);
    if (updatedDiff !== 0) return updatedDiff;

    const createdDiff = toComparableMillis(candidate.createdAt) - toComparableMillis(current.createdAt);
    if (createdDiff !== 0) return createdDiff;

    return String(candidate.id).localeCompare(String(current.id));
};

const sortMaterialsForSelection = (rows: Material[]): Material[] => {
    return sortMaterialDisplayRows(rows);
};

const createCatalogMaterials = (): Material[] => {
    const rows: Material[] = [];
    EXCEL_MATERIAL_CATALOG.forEach((group) => {
        group.specs.forEach((spec) => {
            const material = {
                id: '',
                category: group.category,
                itemName: group.itemName,
                spec,
                unit: group.unit || 'EA',
                safetyStock: 0,
                description: '',
                isActive: true,
                isCatalogDefault: true,
            } as Material;
            const materialKey = buildMaterialBusinessKey(material);
            rows.push({
                ...material,
                id: getCatalogDocumentId(materialKey),
                materialKey,
            });
        });
    });
    return rows;
};

const getCatalogDocumentId = (materialKey: string): string =>
    `catalog_${encodeURIComponent(materialKey)}`;

const getMaterialKey = (material: Pick<Material, 'category' | 'itemName' | 'spec'> & { materialKey?: string }): string =>
    material.materialKey || buildMaterialBusinessKey(material);

const isCatalogMaterial = (material: Partial<Material>): boolean =>
    material.isCatalogDefault === true || String(material.id || '').startsWith('catalog_');

const normalizeMaterialForSelection = (material: Material): Material => {
    const normalized = {
        ...material,
        category: normalizeMaterialCategory(material.category),
        itemName: normalizeSpaces(material.itemName),
        spec: normalizeSpaces(material.spec),
        unit: normalizeSpaces(material.unit) || 'EA',
        description: normalizeMaterialDescription(material.description),
    };
    return {
        ...normalized,
        materialKey: material.materialKey || buildMaterialBusinessKey(normalized),
    };
};

const mergeMaterialsForSelection = (rows: Material[]): Material[] => {
    const deduped = new Map<string, Material>();

    rows
        .filter((row) => row.hiddenCatalogDefault !== true)
        .map(normalizeMaterialForSelection)
        .forEach((row) => {
            const key = row.materialKey || buildMaterialBusinessKey(row);
            const existing = deduped.get(key);
            if (!existing) {
                deduped.set(key, row);
                return;
            }
            if (existing.isCatalogDefault && !row.isCatalogDefault) {
                deduped.set(key, row);
                return;
            }
            if (existing.isCatalogDefault === row.isCatalogDefault && compareMaterialPreference(row, existing) > 0) {
                deduped.set(key, row);
            }
        });

    return sortMaterialsForSelection(Array.from(deduped.values()));
};

const createPersistedCatalogMaterial = (material: Material, now: Date): Material => {
    const normalized = normalizeMaterialForSelection(material);
    const materialKey = normalized.materialKey || buildMaterialBusinessKey(normalized);
    const id = getCatalogDocumentId(materialKey);

    return {
        ...normalized,
        id,
        materialKey,
        unitPrice: normalized.unitPrice ?? 0,
        safetyStock: normalized.safetyStock ?? 0,
        isActive: true,
        isCatalogDefault: true,
        createdAt: now as any,
        updatedAt: now as any,
    };
};

const ensureCatalogMaterialsPersisted = async (rows: Material[]): Promise<Material[]> => {
    const existingMaterialKeys = new Set(rows.map((row) => row.materialKey || buildMaterialBusinessKey(row)));
    const existingIds = new Set(rows.map((row) => row.id).filter(Boolean));
    const now = new Date();
    const missingCatalogRows = createCatalogMaterials()
        .map((row) => createPersistedCatalogMaterial(row, now))
        .filter((row) => {
            const materialKey = row.materialKey || buildMaterialBusinessKey(row);
            return !existingMaterialKeys.has(materialKey) && !existingIds.has(row.id);
        });

    if (missingCatalogRows.length > 0) {
        await Promise.all(
            missingCatalogRows.map((row) => materialFirestoreService.saveMaterial(row.id, row as any))
        );
    }

    return missingCatalogRows;
};

const getSelectableMaterials = async (): Promise<Material[]> => {
    if (selectableMaterialsCache && selectableMaterialsCache.expiresAt > Date.now()) {
        return selectableMaterialsCache.rows;
    }

    const masterRows = await materialFirestoreService.getAllMaterials({ includeInactive: true }) as any[];
    const persistedCatalogRows = await ensureCatalogMaterialsPersisted(masterRows);
    const rows = [...masterRows, ...persistedCatalogRows].filter((row) => row.isActive !== false && row.hiddenCatalogDefault !== true);

    const selectableRows = mergeMaterialsForSelection(rows);
    selectableMaterialsCache = {
        rows: selectableRows,
        expiresAt: Date.now() + MATERIAL_SELECTION_CACHE_TTL_MS,
    };
    return selectableRows;
};

const normalizeMaterialSnapshot = async () => {
    const masterRows = await materialFirestoreService.getAllMaterials({ includeInactive: true }) as any[];
    const rows = [...masterRows, ...createCatalogMaterials()].map(normalizeMaterialForSelection);
    return new Map(rows.flatMap((m) => {
        const materialKey = getMaterialKey(m);
        return [
            [m.id, m],
            [materialKey, m],
        ] as [string, any][];
    }));
};

const normalizeTransactionWithMaster = <T extends { materialId: string; materialKey?: string; category?: string; itemName?: string; spec?: string; unit?: string }>(
    row: T,
    materialById: Map<string, any>
): T => {
    const rowKey = row.materialKey || buildMaterialBusinessKey(row as any);
    const master = materialById.get(row.materialId) || materialById.get(rowKey);
    const normalized = {
        category: trimText(row.category) || trimText(master?.category),
        itemName: trimText(row.itemName) || trimText(master?.itemName),
        spec: trimText(row.spec) || trimText(master?.spec),
        unit: trimText(row.unit) || trimText(master?.unit) || 'EA',
    };
    return {
        ...row,
        ...normalized,
        materialKey: buildMaterialBusinessKey(normalized),
    };
};

const getMaterialFilterKey = (materialId: string | undefined, materialById: Map<string, any>): string | undefined => {
    if (!materialId) return undefined;
    const material = materialById.get(materialId);
    return material ? (material.materialKey || buildMaterialBusinessKey(material)) : undefined;
};

/**
 * MaterialService (Facade)
 * Delegates all operations to materialFirestoreService.
 * This maintains backward compatibility while using the new normalized Firestore structure.
 */

// --- Material Master ---

export const getAllMaterials = async (): Promise<Material[]> => {
    const rows = await materialFirestoreService.getAllMaterials({ includeInactive: true }) as any[];
    const persistedCatalogRows = await ensureCatalogMaterialsPersisted(rows);
    return [...rows, ...persistedCatalogRows].filter((row) => row.isActive !== false && row.hiddenCatalogDefault !== true) as any[];
};

export const getUniqueMaterialsForSelection = async (): Promise<Material[]> => {
    return getSelectableMaterials();
};

export const getMaterialById = async (id: string): Promise<Material | null> => {
    return await materialFirestoreService.getMaterial(id) as any;
};

export const addMaterial = async (material: Omit<Material, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
    const id = generateId('mat');
    const now = new Date();
    const data: MaterialZod = {
        ...material as any,
        materialKey: buildMaterialBusinessKey(material as any),
        category: normalizeMaterialCategory((material as any).category),
        itemName: normalizeSpaces((material as any).itemName),
        spec: normalizeSpaces((material as any).spec),
        unit: normalizeSpaces((material as any).unit) || 'EA',
        unitPrice: (material as any).unitPrice ?? 0,
        id,
        isActive: true,
        createdAt: now,
        updatedAt: now
    };
    await materialFirestoreService.saveMaterial(id, data);
    clearMaterialSelectionCache();
    await logMaterialChange('created', 'material', null, data as any);
    return id;
};

export const updateMaterial = async (
    id: string,
    updates: Partial<Omit<Material, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> => {
    const current = await materialFirestoreService.getMaterial(id);
    if (!current) {
        throw new Error('수정할 자재를 찾을 수 없습니다.');
    }

    const data: MaterialZod = {
        ...current,
        ...updates as any,
        category: normalizeMaterialCategory((updates as any).category ?? current.category),
        itemName: normalizeSpaces((updates as any).itemName ?? current.itemName),
        spec: normalizeSpaces((updates as any).spec ?? current.spec),
        unit: normalizeSpaces((updates as any).unit ?? current.unit) || 'EA',
        materialKey: buildMaterialBusinessKey({
            category: (updates as any).category ?? current.category,
            itemName: (updates as any).itemName ?? current.itemName,
            spec: (updates as any).spec ?? current.spec,
        }),
        isCatalogDefault: isCatalogMaterial(current as any) ? false : (updates as any).isCatalogDefault ?? (current as any).isCatalogDefault,
        hiddenCatalogDefault: isCatalogMaterial(current as any) ? false : (updates as any).hiddenCatalogDefault ?? (current as any).hiddenCatalogDefault,
        updatedAt: new Date()
    };
    await materialFirestoreService.saveMaterial(id, data);
    clearMaterialSelectionCache();
    await logMaterialChange('updated', 'material', current as any, data as any);
};

export const deleteMaterial = async (materialOrId: string | Material): Promise<void> => {
    const id = typeof materialOrId === 'string' ? materialOrId : materialOrId.id;
    const current = id ? await materialFirestoreService.getMaterial(id) as any : null;
    const target = current || (typeof materialOrId === 'string' ? null : materialOrId);

    if (!target) {
        throw new Error('삭제할 자재를 찾을 수 없습니다.');
    }

    const now = new Date();
    const normalized = normalizeMaterialForSelection(target as Material);
    const materialKey = getMaterialKey(normalized);
    const fallbackId = id || getCatalogDocumentId(materialKey);
    const allRows = await materialFirestoreService.getAllMaterials({ includeInactive: true }) as any[];
    const rowsToHide = allRows.filter((row) => {
        if (row.id === fallbackId) return false;
        if (getMaterialKey(row) !== materialKey) return false;
        return isCatalogMaterial(row);
    });
    const deletedSnapshot = {
        ...normalized,
        id: fallbackId,
        materialKey,
        unitPrice: normalized.unitPrice ?? 0,
        isActive: false,
        hiddenCatalogDefault: isCatalogMaterial(normalized) || normalized.hiddenCatalogDefault === true,
        createdAt: normalized.createdAt ?? now,
        updatedAt: now,
    };

    await Promise.all([
        materialFirestoreService.saveMaterial(fallbackId, deletedSnapshot as any),
        ...rowsToHide.map((row) => materialFirestoreService.saveMaterial(row.id, {
            ...row,
            isActive: false,
            hiddenCatalogDefault: true,
            updatedAt: now,
        } as any)),
    ]);
    clearMaterialSelectionCache();
    await logMaterialChange('deleted', 'material', target as any, deletedSnapshot as any);
};

export const getMaterialsByCategory = async (category: string): Promise<Material[]> => {
    const all = await getAllMaterials();
    return all.filter(m => m.category === category);
};

// --- Inbound Transactions ---

export const addInboundTransaction = async (
    transaction: Omit<InboundTransaction, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
    const id = generateId('in');
    const now = new Date();
    const data: MaterialInboundZod = {
        ...transaction,
        materialKey: buildMaterialBusinessKey(transaction as any),
        id,
        createdAt: now,
        updatedAt: now
    } as any;
    await materialFirestoreService.saveInbound(id, data);
    await logMaterialChange('created', 'inbound', null, data as any);
    return id;
};

export const addInboundTransactionsBatch = async (
    transactions: Array<Omit<InboundTransaction, 'id' | 'createdAt' | 'updatedAt'>>,
    photoBatch?: Omit<MaterialPhotoBatch, 'createdAt' | 'updatedAt'>
): Promise<void> => {
    const now = new Date();
    const data: MaterialInboundZod[] = transactions.map(t => ({
        ...t,
        materialKey: buildMaterialBusinessKey(t as any),
        id: generateId('in'),
        createdAt: now,
        updatedAt: now
    } as any));
    await materialFirestoreService.saveInboundsBatch(
        data,
        photoBatch ? { ...photoBatch, createdAt: now, updatedAt: now } as any : undefined
    );
    data.forEach((row) => {
        void logMaterialChange('created', 'inbound', null, row as any, 'materialInboundBatch');
    });
};

export const getInboundTransactions = async (filters?: TransactionFilters): Promise<InboundTransaction[]> => {
    // Note: Firestore limited complex filtering here. For now, fetch by date and filter remaining in memory if needed.
    const start = filters?.startDate || '1970-01-01';
    const end = filters?.endDate || '9999-12-31';

    const materialById = await normalizeMaterialSnapshot();
    const materialFilterKey = getMaterialFilterKey(filters?.materialId, materialById);

    const rentalCompanyIds = Array.from(new Set((filters?.rentalCompanyIds || [])
        .map((value) => String(value ?? '').trim())
        .filter(Boolean)));
    const siteIds = Array.from(new Set((filters?.siteIds || [])
        .map((value) => String(value ?? '').trim())
        .filter(Boolean)));
    const inboundBatches = rentalCompanyIds.length > 0
        ? await Promise.all(rentalCompanyIds.map((companyId) =>
            materialFirestoreService.getInboundsByRange(start, end, filters?.siteId, companyId)
        ))
        : siteIds.length > 0
            ? await Promise.all(siteIds.map((allowedSiteId) =>
                materialFirestoreService.getInboundsByRange(start, end, allowedSiteId)
            ))
        : [await materialFirestoreService.getInboundsByRange(start, end, filters?.siteId)];
    let rows = Array.from(new Map(inboundBatches.flat().map((row) => [row.id, row])).values());
    let normalizedRows = rows.map((row) => normalizeTransactionWithMaster(row, materialById)) as any[];

    if (filters?.materialId) {
        normalizedRows = normalizedRows.filter(r => r.materialId === filters.materialId || r.materialKey === materialFilterKey);
    }
    if (filters?.category) {
        normalizedRows = normalizedRows.filter(r => r.category === filters.category);
    }
    if (filters?.vehicleNumber) {
        normalizedRows = normalizedRows.filter(r => r.vehicleNumber?.toLowerCase().includes(filters.vehicleNumber!.toLowerCase()));
    }

    return normalizedRows as any[];
};

export const updateInboundTransaction = async (
    id: string,
    updates: Partial<Omit<InboundTransaction, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> => {
    const current = await materialFirestoreService.getInbound(id);
    if (!current) {
        throw new Error('수정할 입고 내역을 찾을 수 없습니다.');
    }

    const next = { ...current, ...updates as any };
    const payload = {
        ...next,
        materialKey: buildMaterialBusinessKey(next as any),
        updatedAt: new Date()
    };
    await materialFirestoreService.saveInbound(id, payload);
    await logMaterialChange('updated', 'inbound', current as any, payload as any);
};

export const deleteInboundTransaction = async (id: string): Promise<void> => {
    const current = await materialFirestoreService.getInbound(id);
    if (!current) {
        throw new Error('삭제할 입고 내역을 찾을 수 없습니다.');
    }
    const photoBatchId = String((current as any).photoBatchId || '').trim() || undefined;
    await materialFirestoreService.deleteInbound(id);
    await logMaterialChange('deleted', 'inbound', current as any, null);
    await cleanupMaterialPhotoBatchIfUnreferenced(photoBatchId);
};

// --- Outbound Transactions ---

export const addOutboundTransaction = async (
    transaction: Omit<OutboundTransaction, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
    const id = generateId('out');
    const now = new Date();
    const data: MaterialOutboundZod = {
        ...transaction,
        materialKey: buildMaterialBusinessKey(transaction as any),
        id,
        createdAt: now,
        updatedAt: now
    } as any;
    await materialFirestoreService.saveOutbound(id, data);
    await logMaterialChange('created', 'outbound', null, data as any);
    return id;
};

export const addOutboundTransactionsBatch = async (
    transactions: Array<Omit<OutboundTransaction, 'id' | 'createdAt' | 'updatedAt'>>,
    photoBatch?: Omit<MaterialPhotoBatch, 'createdAt' | 'updatedAt'>
): Promise<void> => {
    const now = new Date();
    const data: MaterialOutboundZod[] = transactions.map(t => ({
        ...t,
        materialKey: buildMaterialBusinessKey(t as any),
        id: generateId('out'),
        createdAt: now,
        updatedAt: now
    } as any));
    await materialFirestoreService.saveOutboundsBatch(
        data,
        photoBatch ? { ...photoBatch, createdAt: now, updatedAt: now } as any : undefined
    );
    data.forEach((row) => {
        void logMaterialChange('created', 'outbound', null, row as any, 'materialOutboundBatch');
    });
};

export const getOutboundTransactions = async (filters?: TransactionFilters): Promise<OutboundTransaction[]> => {
    const start = filters?.startDate || '1970-01-01';
    const end = filters?.endDate || '9999-12-31';

    const materialById = await normalizeMaterialSnapshot();
    const materialFilterKey = getMaterialFilterKey(filters?.materialId, materialById);

    const rentalCompanyIds = Array.from(new Set((filters?.rentalCompanyIds || [])
        .map((value) => String(value ?? '').trim())
        .filter(Boolean)));
    const siteIds = Array.from(new Set((filters?.siteIds || [])
        .map((value) => String(value ?? '').trim())
        .filter(Boolean)));
    const outboundBatches = rentalCompanyIds.length > 0
        ? await Promise.all(rentalCompanyIds.map((companyId) =>
            materialFirestoreService.getOutboundsByRange(start, end, filters?.siteId, companyId)
        ))
        : siteIds.length > 0
            ? await Promise.all(siteIds.map((allowedSiteId) =>
                materialFirestoreService.getOutboundsByRange(start, end, allowedSiteId)
            ))
        : [await materialFirestoreService.getOutboundsByRange(start, end, filters?.siteId)];
    let rows = Array.from(new Map(outboundBatches.flat().map((row) => [row.id, row])).values());
    let normalizedRows = rows.map((row) => normalizeTransactionWithMaster(row, materialById)) as any[];

    if (filters?.materialId) {
        normalizedRows = normalizedRows.filter(r => r.materialId === filters.materialId || r.materialKey === materialFilterKey);
    }
    if (filters?.category) {
        normalizedRows = normalizedRows.filter(r => r.category === filters.category);
    }
    if (filters?.vehicleNumber) {
        normalizedRows = normalizedRows.filter(r => r.vehicleNumber?.toLowerCase().includes(filters.vehicleNumber!.toLowerCase()));
    }

    return normalizedRows as any[];
};

export const updateOutboundTransaction = async (
    id: string,
    updates: Partial<Omit<OutboundTransaction, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> => {
    const current = await materialFirestoreService.getOutbound(id);
    if (!current) {
        throw new Error('수정할 출고 내역을 찾을 수 없습니다.');
    }

    const next = { ...current, ...updates as any };
    const payload = {
        ...next,
        materialKey: buildMaterialBusinessKey(next as any),
        updatedAt: new Date()
    };
    await materialFirestoreService.saveOutbound(id, payload);
    await logMaterialChange('updated', 'outbound', current as any, payload as any);
};

export const deleteOutboundTransaction = async (id: string): Promise<void> => {
    const current = await materialFirestoreService.getOutbound(id);
    if (!current) {
        throw new Error('삭제할 출고 내역을 찾을 수 없습니다.');
    }
    const photoBatchId = String((current as any).photoBatchId || '').trim() || undefined;
    await materialFirestoreService.deleteOutbound(id);
    await logMaterialChange('deleted', 'outbound', current as any, null);
    await cleanupMaterialPhotoBatchIfUnreferenced(photoBatchId);
};

export const getMaterialPhotoBatch = async (id: string): Promise<MaterialPhotoBatch | null> => {
    return await materialFirestoreService.getPhotoBatch(id) as MaterialPhotoBatch | null;
};

export const getMaterialPhotoDownloadUrls = async (photoBatchId: string): Promise<string[]> => {
    const photoBatch = await getMaterialPhotoBatch(photoBatchId);
    if (!photoBatch) return [];

    const paths = Array.from(new Set(
        (photoBatch.photos || [])
            .map((photo) => String(photo.path || '').trim())
            .filter(Boolean)
    ));

    return Promise.all(paths.map((path) => storageService.getDownloadUrl(path)));
};

// --- Inventory Calculations ---

export const calculateInventory = async (
    materialId?: string,
    siteId?: string,
    startDate?: string,
    endDate?: string
): Promise<Inventory[]> => {
    // Fetch all needed records for the site/material
    // To handle "opening balance", we technically need everything from the beginning.
    // This is the downside of frontend-side inventory calculation.

    const [allInboundsRaw, allOutboundsRaw, materialById] = await Promise.all([
        materialFirestoreService.getInboundsByRange('1900-01-01', endDate || '2100-01-01', siteId),
        materialFirestoreService.getOutboundsByRange('1900-01-01', endDate || '2100-01-01', siteId),
        normalizeMaterialSnapshot(),
    ]);

    const allInbounds = allInboundsRaw.map((row) => normalizeTransactionWithMaster(row, materialById));
    const allOutbounds = allOutboundsRaw.map((row) => normalizeTransactionWithMaster(row, materialById));
    const materialFilterKey = getMaterialFilterKey(materialId, materialById);

    // Apply materialId filter if provided
    let inbounds = materialId ? allInbounds.filter(t => t.materialId === materialId || t.materialKey === materialFilterKey) : allInbounds;
    let outbounds = materialId ? allOutbounds.filter(t => t.materialId === materialId || t.materialKey === materialFilterKey) : allOutbounds;

    // Split into opening (before startDate) and current (within range)
    const openingIn = startDate ? inbounds.filter(t => t.transactionDate < startDate) : [];
    const openingOut = startDate ? outbounds.filter(t => t.transactionDate < startDate) : [];

    const currentIn = startDate ? inbounds.filter(t => t.transactionDate >= startDate) : inbounds;
    const currentOut = startDate ? outbounds.filter(t => t.transactionDate >= startDate) : outbounds;

    const inventoryMap = new Map<string, Inventory>();

    // Helper to initialize or get inventory item
    const getInventoryItem = (t: any) => {
        const materialKey = t.materialKey || buildMaterialBusinessKey(t);
        const key = `${materialKey}-${t.siteId}`;
        const master = materialById.get(materialKey) || materialById.get(t.materialId);
        if (!inventoryMap.has(key)) {
            inventoryMap.set(key, {
                materialId: materialKey,
                materialKey,
                siteId: t.siteId,
                siteName: t.siteName,
                category: t.category || master?.category || '',
                itemName: t.itemName || master?.itemName || '',
                spec: t.spec || master?.spec || '',
                unit: t.unit || master?.unit || '',
                totalInbound: 0,
                totalOutbound: 0,
                currentStock: 0,
                safetyStock: master?.safetyStock,
                status: 'sufficient',
                updatedAt: Timestamp.now() as any
            });
        }
        return inventoryMap.get(key)!;
    };

    // 1. Calculate Opening Balance
    openingIn.forEach(t => {
        const inv = getInventoryItem(t);
        inv.currentStock += t.quantity;
    });
    openingOut.forEach(t => {
        const inv = getInventoryItem(t);
        inv.currentStock -= t.quantity;
    });

    // 2. Aggregate Current Period
    currentIn.forEach(t => {
        const inv = getInventoryItem(t);
        inv.totalInbound += t.quantity;
        inv.currentStock += t.quantity;
        if (!inv.lastInboundDate || t.transactionDate > inv.lastInboundDate) {
            inv.lastInboundDate = t.transactionDate;
        }
    });
    currentOut.forEach(t => {
        const inv = getInventoryItem(t);
        inv.totalOutbound += t.quantity;
        inv.currentStock -= t.quantity;
        if (!inv.lastOutboundDate || t.transactionDate > inv.lastOutboundDate) {
            inv.lastOutboundDate = t.transactionDate;
        }
    });

    const results = Array.from(inventoryMap.values());
    results.forEach(inv => {
        inv.status = inv.currentStock > 0 ? 'sufficient' : 'shortage';
    });

    return results;
};

export const getAllInventory = async (): Promise<Inventory[]> => {
    return await calculateInventory();
};

export const getInventoryBySite = async (siteId: string, startDate?: string, endDate?: string): Promise<Inventory[]> => {
    return await calculateInventory(undefined, siteId, startDate, endDate);
};

export const getInventoryByMaterial = async (materialId: string): Promise<Inventory[]> => {
    return await calculateInventory(materialId);
};

export interface TransactionHistoryItem {
    date: string;
    type: 'inbound' | 'outbound';
    quantity: number;
    balance: number;
    vehicleNumber?: string;
    description?: string;
}

export const getMaterialTransactionHistory = async (
    siteId: string,
    materialId: string,
    startDate?: string,
    endDate?: string
): Promise<{ openingBalance: number; transactions: TransactionHistoryItem[] }> => {
    const [allInRaw, allOutRaw, materialById] = await Promise.all([
        materialFirestoreService.getInboundsByRange('1900-01-01', endDate || '2100-01-01', siteId),
        materialFirestoreService.getOutboundsByRange('1900-01-01', endDate || '2100-01-01', siteId),
        normalizeMaterialSnapshot(),
    ]);
    const allIn = allInRaw.map((row) => normalizeTransactionWithMaster(row, materialById));
    const allOut = allOutRaw.map((row) => normalizeTransactionWithMaster(row, materialById));
    const materialFilterKey = getMaterialFilterKey(materialId, materialById);

    const siteMatIn = allIn.filter(t => t.materialId === materialId || t.materialKey === materialFilterKey);
    const siteMatOut = allOut.filter(t => t.materialId === materialId || t.materialKey === materialFilterKey);

    let openingBalance = 0;
    if (startDate) {
        openingBalance = siteMatIn.filter(t => t.transactionDate < startDate).reduce((sum, t) => sum + t.quantity, 0)
            - siteMatOut.filter(t => t.transactionDate < startDate).reduce((sum, t) => sum + t.quantity, 0);
    }

    const currentIn = (startDate ? siteMatIn.filter(t => t.transactionDate >= startDate) : siteMatIn).map(t => ({
        date: t.transactionDate,
        type: 'inbound' as const,
        quantity: t.quantity,
        vehicleNumber: t.vehicleNumber,
        createdAt: t.createdAt
    }));

    const currentOut = (startDate ? siteMatOut.filter(t => t.transactionDate >= startDate) : siteMatOut).map(t => ({
        date: t.transactionDate,
        type: 'outbound' as const,
        quantity: t.quantity,
        vehicleNumber: t.vehicleNumber,
        createdAt: t.createdAt
    }));

    const sortedTrans = [...currentIn, ...currentOut].sort((a, b) => {
        const d = a.date.localeCompare(b.date);
        if (d !== 0) return d;
        if (a.type !== b.type) return a.type === 'inbound' ? -1 : 1;
        return 0;
    });

    let balance = openingBalance;
    const history: TransactionHistoryItem[] = sortedTrans.map(t => {
        if (t.type === 'inbound') balance += t.quantity;
        else balance -= t.quantity;
        return {
            date: t.date,
            type: t.type,
            quantity: t.quantity,
            balance,
            vehicleNumber: t.vehicleNumber
        };
    });

    return { openingBalance, transactions: history };
};

const materialService = {
    getAllMaterials,
    getUniqueMaterialsForSelection,
    getMaterialById,
    addMaterial,
    updateMaterial,
    deleteMaterial,
    getMaterialsByCategory,
    addInboundTransaction,
    addInboundTransactionsBatch,
    getInboundTransactions,
    updateInboundTransaction,
    deleteInboundTransaction,
    addOutboundTransaction,
    addOutboundTransactionsBatch,
    getOutboundTransactions,
    updateOutboundTransaction,
    deleteOutboundTransaction,
    getMaterialPhotoBatch,
    getMaterialPhotoDownloadUrls,
    calculateInventory,
    getAllInventory,
    getInventoryBySite,
    getInventoryByMaterial,
    getMaterialTransactionHistory
};

export default materialService;
