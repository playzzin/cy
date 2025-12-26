import {
    collection,
    doc,
    getDocs,
    getDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    Timestamp,
    serverTimestamp,
    writeBatch,
    QueryConstraint
} from 'firebase/firestore';
import { db } from '../firebase/config';
import {
    Material,
    InboundTransaction,
    OutboundTransaction,
    Inventory,
    TransactionFilters
} from '../types/materials';

const MATERIALS_COLLECTION = 'materials';
const INBOUND_COLLECTION = 'inboundTransactions';
const OUTBOUND_COLLECTION = 'outboundTransactions';

// ==================== Material Master CRUD ====================

/**
 * 자재 마스터 전체 조회
 */
export const getAllMaterials = async (): Promise<Material[]> => {
    const q = query(
        collection(db, MATERIALS_COLLECTION),
        where('isActive', '==', true),
        orderBy('category', 'asc'),
        orderBy('itemName', 'asc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    } as Material));
};

/**
 * 자재 마스터 ID로 조회
 */
export const getMaterialById = async (id: string): Promise<Material | null> => {
    const docRef = doc(db, MATERIALS_COLLECTION, id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Material;
    }
    return null;
};

/**
 * 자재 마스터 등록
 */
export const addMaterial = async (
    material: Omit<Material, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
    const docRef = await addDoc(collection(db, MATERIALS_COLLECTION), {
        ...material,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
    return docRef.id;
};

/**
 * 자재 마스터 수정
 */
export const updateMaterial = async (
    id: string,
    updates: Partial<Omit<Material, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> => {
    const docRef = doc(db, MATERIALS_COLLECTION, id);
    await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp()
    });
};

/**
 * 자재 마스터 삭제 (소프트 삭제)
 */
export const deleteMaterial = async (id: string): Promise<void> => {
    const docRef = doc(db, MATERIALS_COLLECTION, id);
    await updateDoc(docRef, {
        isActive: false,
        updatedAt: serverTimestamp()
    });
};

/**
 * 자재 마스터 카테고리별 조회
 */
export const getMaterialsByCategory = async (category: string): Promise<Material[]> => {
    const q = query(
        collection(db, MATERIALS_COLLECTION),
        where('isActive', '==', true),
        where('category', '==', category),
        orderBy('itemName', 'asc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    } as Material));
};

// ==================== Inbound Transactions ====================

/**
 * 입고 트랜잭션 등록
 */
export const addInboundTransaction = async (
    transaction: Omit<InboundTransaction, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
    const docRef = await addDoc(collection(db, INBOUND_COLLECTION), {
        ...transaction,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
    return docRef.id;
};

/**
 * 입고 트랜잭션 일괄 등록
 */
export const addInboundTransactionsBatch = async (
    transactions: Array<Omit<InboundTransaction, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> => {
    const batch = writeBatch(db);
    transactions.forEach(transaction => {
        const docRef = doc(collection(db, INBOUND_COLLECTION));
        batch.set(docRef, {
            ...transaction,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
    });
    await batch.commit();
};

/**
 * 입고 트랜잭션 조회 (필터링)
 */
export const getInboundTransactions = async (filters?: TransactionFilters): Promise<InboundTransaction[]> => {
    const constraints: QueryConstraint[] = [];

    if (filters?.startDate) {
        constraints.push(where('transactionDate', '>=', filters.startDate));
    }
    if (filters?.endDate) {
        constraints.push(where('transactionDate', '<=', filters.endDate));
    }
    if (filters?.siteId) {
        constraints.push(where('siteId', '==', filters.siteId));
    }
    if (filters?.materialId) {
        constraints.push(where('materialId', '==', filters.materialId));
    }
    if (filters?.category) {
        constraints.push(where('category', '==', filters.category));
    }

    constraints.push(orderBy('transactionDate', 'desc'));

    const q = query(collection(db, INBOUND_COLLECTION), ...constraints);
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    } as InboundTransaction));
};

/**
 * 입고 트랜잭션 수정
 */
export const updateInboundTransaction = async (
    id: string,
    updates: Partial<Omit<InboundTransaction, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> => {
    const docRef = doc(db, INBOUND_COLLECTION, id);
    await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp()
    });
};

/**
 * 입고 트랜잭션 삭제
 */
export const deleteInboundTransaction = async (id: string): Promise<void> => {
    const docRef = doc(db, INBOUND_COLLECTION, id);
    await deleteDoc(docRef);
};

// ==================== Outbound Transactions ====================

/**
 * 출고 트랜잭션 등록
 */
export const addOutboundTransaction = async (
    transaction: Omit<OutboundTransaction, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
    const docRef = await addDoc(collection(db, OUTBOUND_COLLECTION), {
        ...transaction,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
    return docRef.id;
};

/**
 * 출고 트랜잭션 일괄 등록
 */
export const addOutboundTransactionsBatch = async (
    transactions: Array<Omit<OutboundTransaction, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> => {
    const batch = writeBatch(db);
    transactions.forEach(transaction => {
        const docRef = doc(collection(db, OUTBOUND_COLLECTION));
        batch.set(docRef, {
            ...transaction,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
    });
    await batch.commit();
};

/**
 * 출고 트랜잭션 조회 (필터링)
 */
export const getOutboundTransactions = async (filters?: TransactionFilters): Promise<OutboundTransaction[]> => {
    const constraints: QueryConstraint[] = [];

    if (filters?.startDate) {
        constraints.push(where('transactionDate', '>=', filters.startDate));
    }
    if (filters?.endDate) {
        constraints.push(where('transactionDate', '<=', filters.endDate));
    }
    if (filters?.siteId) {
        constraints.push(where('siteId', '==', filters.siteId));
    }
    if (filters?.materialId) {
        constraints.push(where('materialId', '==', filters.materialId));
    }
    if (filters?.category) {
        constraints.push(where('category', '==', filters.category));
    }

    constraints.push(orderBy('transactionDate', 'desc'));

    const q = query(collection(db, OUTBOUND_COLLECTION), ...constraints);
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    } as OutboundTransaction));
};

/**
 * 출고 트랜잭션 수정
 */
export const updateOutboundTransaction = async (
    id: string,
    updates: Partial<Omit<OutboundTransaction, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> => {
    const docRef = doc(db, OUTBOUND_COLLECTION, id);
    await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp()
    });
};

/**
 * 출고 트랜잭션 삭제
 */
export const deleteOutboundTransaction = async (id: string): Promise<void> => {
    const docRef = doc(db, OUTBOUND_COLLECTION, id);
    await deleteDoc(docRef);
};

// ==================== Inventory Calculations ====================

/**
 * 재고 계산 (자재별, 현장별)
 */
export const calculateInventory = async (
    materialId?: string,
    siteId?: string
): Promise<Inventory[]> => {
    // 입고 데이터 조회
    const inboundConstraints: QueryConstraint[] = [];
    if (materialId) inboundConstraints.push(where('materialId', '==', materialId));
    if (siteId) inboundConstraints.push(where('siteId', '==', siteId));

    const inboundQ = query(collection(db, INBOUND_COLLECTION), ...inboundConstraints);
    const inboundSnapshot = await getDocs(inboundQ);
    const inboundData = inboundSnapshot.docs.map(doc => doc.data() as InboundTransaction);

    // 출고 데이터 조회
    const outboundConstraints: QueryConstraint[] = [];
    if (materialId) outboundConstraints.push(where('materialId', '==', materialId));
    if (siteId) outboundConstraints.push(where('siteId', '==', siteId));

    const outboundQ = query(collection(db, OUTBOUND_COLLECTION), ...outboundConstraints);
    const outboundSnapshot = await getDocs(outboundQ);
    const outboundData = outboundSnapshot.docs.map(doc => doc.data() as OutboundTransaction);

    // 자재별, 현장별로 집계
    const inventoryMap = new Map<string, Inventory>();

    console.log(`[debug] Inbound count: ${inboundData.length}, Outbound count: ${outboundData.length}`);

    // 입고 집계
    inboundData.forEach(transaction => {
        if (!transaction.materialId || !transaction.siteId) {
            console.warn('[debug] Missing ID in inbound:', transaction);
            return;
        }
        const key = `${transaction.materialId}-${transaction.siteId}`;
        if (!inventoryMap.has(key)) {
            inventoryMap.set(key, {
                materialId: transaction.materialId,
                siteId: transaction.siteId,
                siteName: transaction.siteName,
                category: transaction.category,
                itemName: transaction.itemName,
                spec: transaction.spec,
                unit: transaction.unit,
                totalInbound: 0,
                totalOutbound: 0,
                currentStock: 0,
                status: 'sufficient',
                lastInboundDate: transaction.transactionDate,
                updatedAt: Timestamp.now()
            });
        }
        const inventory = inventoryMap.get(key)!;
        inventory.totalInbound += Number(transaction.quantity) || 0; // Ensure number
        if (!inventory.lastInboundDate || transaction.transactionDate > inventory.lastInboundDate) {
            inventory.lastInboundDate = transaction.transactionDate;
        }
    });

    // 출고 집계
    outboundData.forEach(transaction => {
        if (!transaction.materialId || !transaction.siteId) {
            console.warn('[debug] Missing ID in outbound:', transaction);
            return;
        }
        const key = `${transaction.materialId}-${transaction.siteId}`;
        if (!inventoryMap.has(key)) {
            // 출고만 있고 입고가 없는 경우도 처리 (마이너스 재고)
            inventoryMap.set(key, {
                materialId: transaction.materialId,
                siteId: transaction.siteId,
                siteName: transaction.siteName,
                category: transaction.category,
                itemName: transaction.itemName,
                spec: transaction.spec,
                unit: transaction.unit,
                totalInbound: 0,
                totalOutbound: 0,
                currentStock: 0,
                status: 'sufficient',
                lastOutboundDate: transaction.transactionDate,
                updatedAt: Timestamp.now()
            });
        }
        const inventory = inventoryMap.get(key)!;
        inventory.totalOutbound += Number(transaction.quantity) || 0; // Ensure number
        if (!inventory.lastOutboundDate || transaction.transactionDate > inventory.lastOutboundDate) {
            inventory.lastOutboundDate = transaction.transactionDate;
        }
    });

    // 현재고 계산 및 상태 결정
    const inventories = Array.from(inventoryMap.values());
    console.log(`[debug] Calculated inventories: ${inventories.length}`, inventories);

    inventories.forEach(inventory => {
        inventory.currentStock = inventory.totalInbound - inventory.totalOutbound;

        // 재고 상태 결정
        if (inventory.safetyStock) {
            if (inventory.currentStock <= 0) {
                inventory.status = 'shortage';
            } else if (inventory.currentStock < inventory.safetyStock) {
                inventory.status = 'warning';
            } else {
                inventory.status = 'sufficient';
            }
        } else {
            inventory.status = inventory.currentStock > 0 ? 'sufficient' : 'shortage';
        }
    });

    return inventories;
};

/**
 * 전체 재고 조회
 */
export const getAllInventory = async (): Promise<Inventory[]> => {
    return await calculateInventory();
};

/**
 * 현장별 재고 조회
 */
export const getInventoryBySite = async (siteId: string): Promise<Inventory[]> => {
    return await calculateInventory(undefined, siteId);
};

/**
 * 자재별 재고 조회
 */
export const getInventoryByMaterial = async (materialId: string): Promise<Inventory[]> => {
    return await calculateInventory(materialId);
};

const materialService = {
    // Material Master
    getAllMaterials,
    getMaterialById,
    addMaterial,
    updateMaterial,
    deleteMaterial,
    getMaterialsByCategory,

    // Inbound
    addInboundTransaction,
    addInboundTransactionsBatch,
    getInboundTransactions,
    updateInboundTransaction,
    deleteInboundTransaction,

    // Outbound
    addOutboundTransaction,
    addOutboundTransactionsBatch,
    getOutboundTransactions,
    updateOutboundTransaction,
    deleteOutboundTransaction,

    // Inventory
    calculateInventory,
    getAllInventory,
    getInventoryBySite,
    getInventoryByMaterial
};

export default materialService;
