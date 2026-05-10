import { FieldValue, Timestamp } from 'firebase/firestore';

export interface Material {
    id: string;
    materialKey?: string;
    category: string;
    itemName: string;
    spec: string;
    unit: string;
    unitPrice?: number;
    safetyStock?: number;
    description?: string;
    photoUrl?: string;
    isActive: boolean;
    isCatalogDefault?: boolean;
    hiddenCatalogDefault?: boolean;
    createdAt?: Timestamp | FieldValue | null;
    updatedAt?: Timestamp | FieldValue | null;
}

export interface InboundTransaction {
    id: string;
    transactionDate: string;
    siteId: string;
    siteName: string;
    vehicleNumber?: string;
    materialId: string;
    materialKey?: string;
    category: string;
    itemName: string;
    spec: string;
    quantity: number;
    unit: string;
    supplier?: string;
    invoiceNumber?: string;
    notes?: string;
    photoUrls?: string[];
    registeredBy: string;
    registeredByName: string;
    createdAt?: Timestamp | FieldValue | null;
    updatedAt?: Timestamp | FieldValue | null;
}

export interface OutboundTransaction {
    id: string;
    transactionDate: string;
    siteId: string;
    siteName: string;
    vehicleNumber?: string;
    materialId: string;
    materialKey?: string;
    category: string;
    itemName: string;
    spec: string;
    quantity: number;
    unit: string;
    recipient?: string;
    recipientPhone?: string;
    deliveryStatus: 'pending' | 'in-transit' | 'delivered';
    notes?: string;
    photoUrls?: string[];
    registeredBy: string;
    registeredByName: string;
    createdAt?: Timestamp | FieldValue | null;
    updatedAt?: Timestamp | FieldValue | null;
}

export interface Inventory {
    materialId: string;
    materialKey?: string;
    siteId: string;
    siteName: string;
    category: string;
    itemName: string;
    spec: string;
    unit: string;
    totalInbound: number;
    totalOutbound: number;
    currentStock: number;
    safetyStock?: number;
    status: 'sufficient' | 'warning' | 'shortage';
    lastInboundDate?: string;
    lastOutboundDate?: string;
    updatedAt?: Timestamp | FieldValue | null;
}

export interface TransactionFilters {
    startDate?: string;
    endDate?: string;
    siteId?: string;
    materialId?: string;
    category?: string;
    transactionType?: 'inbound' | 'outbound' | 'all';
    vehicleNumber?: string;
}

export interface InventoryStatistics {
    totalMaterials: number;
    sufficientCount: number;
    warningCount: number;
    shortageCount: number;
    totalInboundToday: number;
    totalOutboundToday: number;
}
