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

/**
 * MaterialService (Facade)
 * Delegates all operations to materialFirestoreService.
 * This maintains backward compatibility while using the new normalized Firestore structure.
 */

// --- Material Master ---

export const getAllMaterials = async (): Promise<Material[]> => {
    return await materialFirestoreService.getAllMaterials() as any[];
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

    return rows as any[];
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

    return rows as any[];
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

    const allInbounds = await materialFirestoreService.getInboundsByRange('1900-01-01', endDate || '2100-01-01', siteId);
    const allOutbounds = await materialFirestoreService.getOutboundsByRange('1900-01-01', endDate || '2100-01-01', siteId);

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



