import { FieldValue, Timestamp } from 'firebase/firestore';

// 자재 마스터
export interface Material {
    id: string;
    category: '시스템 동바리' | '시스템 비계' | '기타';
    itemName: string; // 품명: 수직재, 수평재, 대각재 등
    spec: string; // 규격: P17, H15 등
    unit: string; // 단위: EA, SET, M 등
    safetyStock?: number; // 안전재고
    description?: string;
    photoUrl?: string; // 자재 사진
    isActive: boolean;
    createdAt?: Timestamp | FieldValue | null;
    updatedAt?: Timestamp | FieldValue | null;
}

// 입고 트랜잭션
export interface InboundTransaction {
    id: string;
    transactionDate: string; // 입고일자 (YYYY-MM-DD)
    siteId: string; // 현장 ID
    siteName: string; // denormalized
    vehicleNumber?: string; // 차량번호
    materialId: string; // 자재 ID
    category: string; // denormalized
    itemName: string; // denormalized
    spec: string; // denormalized
    quantity: number; // 입고수량
    unit: string; // denormalized
    supplier?: string; // 공급업체
    invoiceNumber?: string; // 입고 전표번호
    notes?: string; // 비고
    photoUrls?: string[]; // 입고 사진
    registeredBy: string; // 등록자 UID
    registeredByName: string; // denormalized
    createdAt?: Timestamp | FieldValue | null;
    updatedAt?: Timestamp | FieldValue | null;
}

// 출고 트랜잭션
export interface OutboundTransaction {
    id: string;
    transactionDate: string; // 출고일자 (YYYY-MM-DD)
    siteId: string; // 현장 ID (출고 대상)
    siteName: string; // denormalized
    vehicleNumber?: string; // 차량번호
    materialId: string; // 자재 ID
    category: string; // denormalized
    itemName: string; // denormalized
    spec: string; // denormalized
    quantity: number; // 출고수량
    unit: string; // denormalized
    recipient?: string; // 인수자
    recipientPhone?: string;
    deliveryStatus: 'pending' | 'in-transit' | 'delivered'; // 배송상태
    notes?: string; // 비고
    photoUrls?: string[]; // 출고 사진
    registeredBy: string; // 등록자 UID
    registeredByName: string; // denormalized
    createdAt?: Timestamp | FieldValue | null;
    updatedAt?: Timestamp | FieldValue | null;
}

// 재고 요약 (계산된 뷰)
export interface Inventory {
    materialId: string;
    siteId: string;
    siteName: string;
    category: string;
    itemName: string;
    spec: string;
    unit: string;
    totalInbound: number; // 총 입고량
    totalOutbound: number; // 총 출고량
    currentStock: number; // 현재고 = totalInbound - totalOutbound
    safetyStock?: number;
    status: 'sufficient' | 'warning' | 'shortage'; // 재고 상태
    lastInboundDate?: string;
    lastOutboundDate?: string;
    updatedAt?: Timestamp | FieldValue | null;
}

// 트랜잭션 필터
export interface TransactionFilters {
    startDate?: string;
    endDate?: string;
    siteId?: string;
    materialId?: string;
    category?: string;
    transactionType?: 'inbound' | 'outbound' | 'all';
}

// 재고 통계
export interface InventoryStatistics {
    totalMaterials: number;
    sufficientCount: number;
    warningCount: number;
    shortageCount: number;
    totalInboundToday: number;
    totalOutboundToday: number;
}
