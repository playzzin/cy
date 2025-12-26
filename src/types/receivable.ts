import { Timestamp } from 'firebase/firestore';

/**
 * 미수금 상태
 */
export enum ReceivableStatus {
    UNPAID = 'unpaid',       // 미납
    PARTIAL = 'partial',     // 부분 납부
    PAID = 'paid',          // 완납
    OVERDUE = 'overdue'     // 연체
}

/**
 * 입금 내역
 */
export interface Payment {
    id: string;
    receivableId: string;    // 미수금 ID

    paymentDate: string;     // 입금일 (YYYY-MM-DD)
    amount: number;          // 입금액
    method?: string;         // 입금 방법 (현금, 이체 등)
    note?: string;          // 비고

    createdAt: Timestamp;
    createdBy: string;       // 입금 등록자
}

/**
 * 미수금 기록
 */
export interface Receivable {
    id?: string;
    taxInvoiceId?: string;   // 세금계산서 ID (연결, optional)

    // 발행 정보
    issueYear: number;       // 년도
    issueDate: string;       // 발행일 (YYYY-MM-DD)
    customerName: string;    // 거래처명

    // 금액 정보
    totalAmount: number;     // 발행액 (공급가액 + 세액)
    supplyAmount: number;    // 공급가액
    taxAmount: number;       // 세액

    // 수금 정보
    payments: Payment[];     // 입금 내역 (배열)
    totalPaid: number;       // 총 입금액 (계산)
    balance: number;         // 미수금 (계산)

    // 상태
    status: ReceivableStatus;

    // 기타
    note?: string;           // 비고
    manager?: string;        // 담당자

    createdAt?: Timestamp;
    updatedAt?: Timestamp;
}

/**
 * 미수금 필터
 */
export interface ReceivableFilters {
    customerName?: string;
    status?: ReceivableStatus;
    year?: number;
    month?: number;
    startDate?: string;
    endDate?: string;
}

/**
 * 미수금 통계
 */
export interface ReceivableStatistics {
    totalIssued: number;     // 총 발행액
    totalPaid: number;       // 총 입금액
    totalBalance: number;    // 총 미수금
    overdueCount: number;    // 연체 건수
    overdueAmount: number;   // 연체 금액
}

/**
 * 거래처별 통계
 */
export interface CustomerStatistics {
    customerName: string;
    totalIssued: number;
    totalPaid: number;
    totalBalance: number;
    averageCollectionDays: number; // 평균 회수 기간
    receivableCount: number;
}
