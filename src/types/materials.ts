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

export interface MaterialPhotoFile {
    path: string;
    name: string;
    contentType?: string;
    size?: number;
    originalSize?: number;
    compressedSize?: number;
    compressed?: boolean;
    source?: 'camera' | 'gallery';
}

export interface MaterialPhotoBatch {
    id: string;
    transactionType: 'inbound' | 'outbound';
    transactionDate: string;
    siteId: string;
    rentalCompanyId?: string;
    rentalCompanyName?: string;
    photoCount: number;
    photos: MaterialPhotoFile[];
    createdBy?: string;
    createdByName?: string;
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
    /** 임대사 포털 범위 판정에 사용하는 정규 회사 ID */
    rentalCompanyId?: string;
    rentalCompanyName?: string;
    invoiceNumber?: string;
    notes?: string;
    photoUrls?: string[];
    photoBatchId?: string;
    photoCount?: number;
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
    rentalCompanyId?: string;
    rentalCompanyName?: string;
    deliveryStatus: 'pending' | 'in-transit' | 'delivered';
    notes?: string;
    photoUrls?: string[];
    photoBatchId?: string;
    photoCount?: number;
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
    siteIds?: string[];
    materialId?: string;
    category?: string;
    transactionType?: 'inbound' | 'outbound' | 'all';
    vehicleNumber?: string;
    /** 외부 임대사 계정은 이 ID로 서버 조회부터 제한한다. */
    rentalCompanyIds?: string[];
}

export interface InventoryStatistics {
    totalMaterials: number;
    sufficientCount: number;
    warningCount: number;
    shortageCount: number;
    totalInboundToday: number;
    totalOutboundToday: number;
}
