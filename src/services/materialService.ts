import { materialFirestoreService } from './materialFirestoreService';
import {
    Material,
    InboundTransaction,
    OutboundTransaction,
    Inventory,
    TransactionFilters
} from '../types/materials';
import { Timestamp } from '../types/timestamp';
import {
    MaterialZod,
    MaterialInboundZod,
    MaterialOutboundZod
} from '../types/zod/materialSchema';

// Helper to generate IDs
const generateId = (prefix: string = 'mat'): string => {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

const trimText = (value: unknown): string => String(value ?? '').trim();

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

const buildMaterialSelectionKey = (material: Pick<Material, 'category' | 'itemName' | 'spec' | 'unit'>): string => {
    const category = trimText(material.category).replace(/\s+/g, ' ').toLowerCase();
    const itemName = trimText(material.itemName).replace(/\s+/g, ' ').toLowerCase();
    const spec = trimText(material.spec).replace(/\s+/g, ' ').toLowerCase();
    const unit = trimText(material.unit).replace(/\s+/g, ' ').toLowerCase();
    return `${category}::${itemName}::${spec}::${unit}`;
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
    return [...rows].sort((a, b) => {
        const categoryCompare = trimText(a.category).localeCompare(trimText(b.category), 'ko');
        if (categoryCompare !== 0) return categoryCompare;

        const itemCompare = trimText(a.itemName).localeCompare(trimText(b.itemName), 'ko');
        if (itemCompare !== 0) return itemCompare;

        return trimText(a.spec).localeCompare(trimText(b.spec), 'ko');
    });
};

const normalizeMaterialSnapshot = async () => {
    const rows = await materialFirestoreService.getAllMaterials();
    return new Map(rows.map((m) => [m.id, m]));
};

const normalizeTransactionWithMaster = <T extends { materialId: string; category?: string; itemName?: string; spec?: string; unit?: string }>(
    row: T,
    materialById: Map<string, any>
): T => {
    const master = materialById.get(row.materialId);
    return {
        ...row,
        category: trimText(master?.category) || trimText(row.category),
        itemName: trimText(master?.itemName) || trimText(row.itemName),
        spec: trimText(master?.spec) || trimText(row.spec),
        unit: trimText(master?.unit) || trimText(row.unit),
    };
};

/**
 * MaterialService (Facade)
 * Delegates all operations to materialFirestoreService.
 * This maintains backward compatibility while using the new normalized Firestore structure.
 */

// --- Material Master ---

export const getAllMaterials = async (): Promise<Material[]> => {
    return await materialFirestoreService.getAllMaterials() as any[];
};

export const getUniqueMaterialsForSelection = async (): Promise<Material[]> => {
    const rows = await getAllMaterials();
    const deduped = new Map<string, Material>();

    rows.forEach((row) => {
        const key = buildMaterialSelectionKey(row);
        const existing = deduped.get(key);
        if (!existing || compareMaterialPreference(row, existing) > 0) {
            deduped.set(key, row);
        }
    });

    return sortMaterialsForSelection(Array.from(deduped.values()));
};

export const getMaterialById = async (id: string): Promise<Material | null> => {
    return await materialFirestoreService.getMaterial(id) as any;
};

export const addMaterial = async (material: Omit<Material, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
    const id = generateId('mat');
    const now = new Date();
    const data: MaterialZod = {
        ...material as any,
        unitPrice: (material as any).unitPrice ?? 0,
        id,
        isActive: true,
        createdAt: now,
        updatedAt: now
    };
    await materialFirestoreService.saveMaterial(id, data);
    return id;
};

export const updateMaterial = async (
    id: string,
    updates: Partial<Omit<Material, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> => {
    const current = await materialFirestoreService.getMaterial(id);
    if (!current) return;

    const data: MaterialZod = {
        ...current,
        ...updates as any,
        updatedAt: new Date()
    };
    await materialFirestoreService.saveMaterial(id, data);
};

export const deleteMaterial = async (id: string): Promise<void> => {
    await updateMaterial(id, { isActive: false } as any);
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
        id,
        createdAt: now,
        updatedAt: now
    } as any;
    await materialFirestoreService.saveInbound(id, data);
    return id;
};

export const addInboundTransactionsBatch = async (
    transactions: Array<Omit<InboundTransaction, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> => {
    const now = new Date();
    const data: MaterialInboundZod[] = transactions.map(t => ({
        ...t,
        id: generateId('in'),
        createdAt: now,
        updatedAt: now
    } as any));
    await materialFirestoreService.saveInboundsBatch(data);
};

export const getInboundTransactions = async (filters?: TransactionFilters): Promise<InboundTransaction[]> => {
    // Note: Firestore limited complex filtering here. For now, fetch by date and filter remaining in memory if needed.
    const start = filters?.startDate || '1970-01-01';
    const end = filters?.endDate || '9999-12-31';

    let rows = await materialFirestoreService.getInboundsByRange(start, end, filters?.siteId);

    if (filters?.materialId) {
        rows = rows.filter(r => r.materialId === filters.materialId);
    }
    if (filters?.category) {
        rows = rows.filter(r => r.category === filters.category);
    }
    if (filters?.vehicleNumber) {
        rows = rows.filter(r => r.vehicleNumber?.toLowerCase().includes(filters.vehicleNumber!.toLowerCase()));
    }

    const materialById = await normalizeMaterialSnapshot();
    return rows.map((row) => normalizeTransactionWithMaster(row, materialById)) as any[];
};

export const updateInboundTransaction = async (
    id: string,
    updates: Partial<Omit<InboundTransaction, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> => {
    // Implementation for update if needed. Currently no direct firestore method for specific inbound edit but saveInbound handles merge.
    // Fetch and update
    const snap = await materialFirestoreService.getInboundsByRange('1900-01-01', '2100-01-01'); // Inefficient, but keep for compatibility
    const current = snap.find(t => t.id === id);
    if (!current) return;

    await materialFirestoreService.saveInbound(id, { ...current, ...updates as any, updatedAt: new Date() });
};

export const deleteInboundTransaction = async (id: string): Promise<void> => {
    await materialFirestoreService.deleteInbound(id);
};

// --- Outbound Transactions ---

export const addOutboundTransaction = async (
    transaction: Omit<OutboundTransaction, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
    const id = generateId('out');
    const now = new Date();
    const data: MaterialOutboundZod = {
        ...transaction,
        id,
        createdAt: now,
        updatedAt: now
    } as any;
    await materialFirestoreService.saveOutbound(id, data);
    return id;
};

export const addOutboundTransactionsBatch = async (
    transactions: Array<Omit<OutboundTransaction, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> => {
    const now = new Date();
    const data: MaterialOutboundZod[] = transactions.map(t => ({
        ...t,
        id: generateId('out'),
        createdAt: now,
        updatedAt: now
    } as any));
    await materialFirestoreService.saveOutboundsBatch(data);
};

export const getOutboundTransactions = async (filters?: TransactionFilters): Promise<OutboundTransaction[]> => {
    const start = filters?.startDate || '1970-01-01';
    const end = filters?.endDate || '9999-12-31';

    let rows = await materialFirestoreService.getOutboundsByRange(start, end, filters?.siteId);

    if (filters?.materialId) {
        rows = rows.filter(r => r.materialId === filters.materialId);
    }
    if (filters?.category) {
        rows = rows.filter(r => r.category === filters.category);
    }
    if (filters?.vehicleNumber) {
        rows = rows.filter(r => r.vehicleNumber?.toLowerCase().includes(filters.vehicleNumber!.toLowerCase()));
    }

    const materialById = await normalizeMaterialSnapshot();
    return rows.map((row) => normalizeTransactionWithMaster(row, materialById)) as any[];
};

export const updateOutboundTransaction = async (
    id: string,
    updates: Partial<Omit<OutboundTransaction, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> => {
    const current = await materialFirestoreService.getOutbound(id);
    if (!current) return;

    await materialFirestoreService.saveOutbound(id, {
        ...current,
        ...updates as any,
        updatedAt: new Date()
    });
};

export const deleteOutboundTransaction = async (id: string): Promise<void> => {
    await materialFirestoreService.deleteOutbound(id);
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

    // Apply materialId filter if provided
    let inbounds = materialId ? allInbounds.filter(t => t.materialId === materialId) : allInbounds;
    let outbounds = materialId ? allOutbounds.filter(t => t.materialId === materialId) : allOutbounds;

    // Split into opening (before startDate) and current (within range)
    const openingIn = startDate ? inbounds.filter(t => t.transactionDate < startDate) : [];
    const openingOut = startDate ? outbounds.filter(t => t.transactionDate < startDate) : [];

    const currentIn = startDate ? inbounds.filter(t => t.transactionDate >= startDate) : inbounds;
    const currentOut = startDate ? outbounds.filter(t => t.transactionDate >= startDate) : outbounds;

    const inventoryMap = new Map<string, Inventory>();

    // Helper to initialize or get inventory item
    const getInventoryItem = (t: any) => {
        const key = `${t.materialId}-${t.siteId}`;
        if (!inventoryMap.has(key)) {
            inventoryMap.set(key, {
                materialId: t.materialId,
                siteId: t.siteId,
                siteName: t.siteName,
                category: t.category || '',
                itemName: t.itemName,
                spec: t.spec || '',
                unit: t.unit || '',
                totalInbound: 0,
                totalOutbound: 0,
                currentStock: 0,
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
    const allIn = await materialFirestoreService.getInboundsByRange('1900-01-01', endDate || '2100-01-01', siteId);
    const allOut = await materialFirestoreService.getOutboundsByRange('1900-01-01', endDate || '2100-01-01', siteId);

    const siteMatIn = allIn.filter(t => t.materialId === materialId);
    const siteMatOut = allOut.filter(t => t.materialId === materialId);

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
    calculateInventory,
    getAllInventory,
    getInventoryBySite,
    getInventoryByMaterial,
    getMaterialTransactionHistory
};

export default materialService;



