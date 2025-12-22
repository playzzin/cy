/**
 * 입금/지급 Firestore 서비스
 * 
 * 입금 및 지급 기록을 관리하여 거래처별 잔액을 계산합니다.
 */

import { db } from '../config/firebase';
import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    getDocs,
    getDoc,
    query,
    orderBy,
    where,
    Timestamp
} from 'firebase/firestore';

// 입금/지급 타입
export type PaymentType = 'in' | 'out'; // 입금 / 지급

// 입금/지급 기록 인터페이스
export interface PaymentRecord {
    id?: string;

    // 기본 정보
    date: string;                    // 입금/지급일 (YYYY-MM-DD)
    type: PaymentType;               // 입금/지급 구분
    amount: number;                  // 금액

    // 거래처 정보
    companyId?: string;              // 거래처 ID (Firestore, 선택)
    companyName: string;             // 거래처명 (필수)

    // 연결 정보 (선택)
    siteId?: string;                 // 현장 ID
    siteName?: string;               // 현장명
    teamName?: string;               // 팀명 (추가)
    taxInvoiceId?: string;           // 연결된 세금계산서 ID

    // 추가 정보
    bankName?: string;               // 은행명
    accountNumber?: string;          // 계좌번호
    category?: string;               // 분류 (식대, 자재, 노무비 등)
    memo?: string;                   // 비고

    // 메타 정보
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
    createdBy?: string;
}

const COLLECTION_NAME = 'payments';

export const paymentFirestoreService = {
    /**
     * 입금/지급 추가
     */
    addPayment: async (
        record: Omit<PaymentRecord, 'id' | 'createdAt' | 'updatedAt'>
    ): Promise<string> => {
        const docRef = await addDoc(collection(db, COLLECTION_NAME), {
            ...record,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        });
        return docRef.id;
    },

    /**
     * 입금/지급 수정
     */
    updatePayment: async (id: string, updates: Partial<PaymentRecord>): Promise<void> => {
        const docRef = doc(db, COLLECTION_NAME, id);
        await updateDoc(docRef, {
            ...updates,
            updatedAt: Timestamp.now()
        });
    },

    /**
     * 입금/지급 삭제
     */
    deletePayment: async (id: string): Promise<void> => {
        await deleteDoc(doc(db, COLLECTION_NAME, id));
    },

    /**
     * ID로 조회
     */
    getPaymentById: async (id: string): Promise<PaymentRecord | null> => {
        const docRef = doc(db, COLLECTION_NAME, id);
        const snap = await getDoc(docRef);
        if (!snap.exists()) return null;
        return { id: snap.id, ...snap.data() } as PaymentRecord;
    },

    /**
     * 전체 조회 (최신순)
     */
    getPayments: async (): Promise<PaymentRecord[]> => {
        const q = query(
            collection(db, COLLECTION_NAME),
            orderBy('date', 'desc')
        );
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as PaymentRecord));
    },

    /**
     * 거래처별 조회
     */
    getPaymentsByCompany: async (companyId: string): Promise<PaymentRecord[]> => {
        const q = query(
            collection(db, COLLECTION_NAME),
            where('companyId', '==', companyId),
            orderBy('date', 'desc')
        );
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as PaymentRecord));
    },

    /**
     * 거래처명별 조회 (수기 입력 데이터용)
     */
    getPaymentsByCompanyName: async (companyName: string): Promise<PaymentRecord[]> => {
        const q = query(
            collection(db, COLLECTION_NAME),
            where('companyName', '==', companyName),
            orderBy('date', 'desc')
        );
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as PaymentRecord));
    },

    /**
     * 현장별 조회
     */
    getPaymentsBySite: async (siteId: string): Promise<PaymentRecord[]> => {
        const q = query(
            collection(db, COLLECTION_NAME),
            where('siteId', '==', siteId),
            orderBy('date', 'desc')
        );
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as PaymentRecord));
    },

    /**
     * 기간별 조회
     */
    getPaymentsByDateRange: async (
        startDate: string,
        endDate: string
    ): Promise<PaymentRecord[]> => {
        const q = query(
            collection(db, COLLECTION_NAME),
            where('date', '>=', startDate),
            where('date', '<=', endDate),
            orderBy('date', 'desc')
        );
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as PaymentRecord));
    },

    /**
     * 거래처별 입금/지급 합계
     */
    calculateCompanyPaymentTotals: async (companyId: string): Promise<{
        totalIn: number;
        totalOut: number;
        net: number;
    }> => {
        const records = await paymentFirestoreService.getPaymentsByCompany(companyId);

        let totalIn = 0;
        let totalOut = 0;

        records.forEach(record => {
            if (record.type === 'in') {
                totalIn += record.amount;
            } else {
                totalOut += record.amount;
            }
        });

        return {
            totalIn,
            totalOut,
            net: totalIn - totalOut
        };
    }
};

/**
 * 통합 잔액 계산 서비스
 * 세금계산서 + 입금/지급을 합쳐서 실제 잔액을 계산
 */
export const balanceCalculationService = {
    /**
     * 거래처별 미수금/미지급 잔액 계산
     * 
     * 미수금 = 매출 세금계산서 합계 - 입금 합계
     * 미지급 = 매입 세금계산서 합계 - 지급 합계
     */
    calculateCompanyBalance: async (companyId: string): Promise<{
        salesTotal: number;       // 매출 합계
        purchaseTotal: number;    // 매입 합계
        receivedTotal: number;    // 입금 합계
        paidTotal: number;        // 지급 합계
        receivableBalance: number; // 미수금 (매출 - 입금)
        payableBalance: number;    // 미지급 (매입 - 지급)
    }> => {
        // 세금계산서 데이터 가져오기
        const { taxInvoiceFirestoreService } = await import('./taxInvoiceFirestoreService');
        const invoiceTotals = await taxInvoiceFirestoreService.calculateCompanyTotals(companyId);

        // 입금/지급 데이터 가져오기
        const paymentTotals = await paymentFirestoreService.calculateCompanyPaymentTotals(companyId);

        return {
            salesTotal: invoiceTotals.salesTotal,
            purchaseTotal: invoiceTotals.purchaseTotal,
            receivedTotal: paymentTotals.totalIn,
            paidTotal: paymentTotals.totalOut,
            receivableBalance: invoiceTotals.salesTotal - paymentTotals.totalIn,
            payableBalance: invoiceTotals.purchaseTotal - paymentTotals.totalOut
        };
    },

    /**
     * 거래처별 거래 내역 (시간순 정렬)
     * 세금계산서 + 입금/지급을 합쳐서 잔액 누적 계산
     */
    getCompanyTransactionHistory: async (companyId: string): Promise<Array<{
        date: string;
        description: string;
        saleAmount: number;
        paymentAmount: number;
        balance: number;
        type: 'invoice' | 'payment';
        sourceId: string;
        siteName?: string;
        teamName?: string;
        memo?: string;
    }>> => {
        const { taxInvoiceFirestoreService } = await import('./taxInvoiceFirestoreService');

        // 세금계산서 가져오기
        const invoices = await taxInvoiceFirestoreService.getTaxInvoicesByCompany(companyId);

        // 입금/지급 가져오기
        const payments = await paymentFirestoreService.getPaymentsByCompany(companyId);

        // 거래 내역 통합
        type Transaction = {
            date: string;
            description: string;
            saleAmount: number;
            paymentAmount: number;
            balance: number;
            type: 'invoice' | 'payment';
            sourceId: string;
            siteName?: string;
            teamName?: string;
            memo?: string;
        };

        const transactions: Transaction[] = [];

        // 세금계산서 → 거래 내역
        invoices.forEach(inv => {
            if (inv.status === 'cancelled') return;

            transactions.push({
                date: inv.invoiceDate,
                description: inv.itemName || '세금계산서',
                saleAmount: inv.type === 'sales' ? inv.totalAmount : 0,
                paymentAmount: 0,
                balance: 0, // 나중에 계산
                type: 'invoice',
                sourceId: inv.id || '',
                siteName: inv.siteName,
                teamName: inv.teamName,
                memo: inv.memo
            });
        });

        // 입금/지급 → 거래 내역
        payments.forEach(pay => {
            transactions.push({
                date: pay.date,
                description: pay.type === 'in' ? '입금' : '지급',
                saleAmount: 0,
                paymentAmount: pay.type === 'in' ? pay.amount : 0,
                balance: 0,
                type: 'payment',
                sourceId: pay.id || '',
                siteName: pay.siteName,
                teamName: pay.teamName,
                memo: pay.memo
            });
        });

        // 날짜 순 정렬
        transactions.sort((a, b) => a.date.localeCompare(b.date));

        // 잔액 누적 계산
        let runningBalance = 0;
        transactions.forEach(tx => {
            runningBalance += tx.saleAmount - tx.paymentAmount;
            tx.balance = runningBalance;
        });

        return transactions;
    },

    /**
     * 거래처명별 잔액 계산 (수기 입력 데이터용)
     */
    calculateCompanyBalanceByName: async (companyName: string): Promise<{
        salesTotal: number;
        purchaseTotal: number;
        receivedTotal: number;
        paidTotal: number;
        receivableBalance: number;
        payableBalance: number;
    }> => {
        const { taxInvoiceFirestoreService } = await import('./taxInvoiceFirestoreService');

        // 세금계산서 (이름으로 조회)
        const invoices = await taxInvoiceFirestoreService.getTaxInvoicesByCompanyName(companyName);
        let salesTotal = 0;
        let purchaseTotal = 0;

        invoices.forEach(record => {
            if (record.status === 'cancelled') return;
            if (record.type === 'sales') {
                salesTotal += record.totalAmount;
            } else {
                purchaseTotal += record.totalAmount;
            }
        });

        // 입금/지급 (이름으로 조회)
        const payments = await paymentFirestoreService.getPaymentsByCompanyName(companyName);
        let totalIn = 0;
        let totalOut = 0;

        payments.forEach(record => {
            if (record.type === 'in') {
                totalIn += record.amount;
            } else {
                totalOut += record.amount;
            }
        });

        return {
            salesTotal,
            purchaseTotal,
            receivedTotal: totalIn,
            paidTotal: totalOut,
            receivableBalance: salesTotal - totalIn,
            payableBalance: purchaseTotal - totalOut
        };
    },

    /**
     * 거래처명별 거래 내역 (수기 입력 데이터용)
     */
    getCompanyTransactionHistoryByName: async (companyName: string): Promise<Array<{
        date: string;
        description: string;
        saleAmount: number;
        paymentAmount: number;
        balance: number;
        type: 'invoice' | 'payment';
        sourceId: string;
        siteName?: string;
        teamName?: string;
        memo?: string;
    }>> => {
        const { taxInvoiceFirestoreService } = await import('./taxInvoiceFirestoreService');

        const invoices = await taxInvoiceFirestoreService.getTaxInvoicesByCompanyName(companyName);
        const payments = await paymentFirestoreService.getPaymentsByCompanyName(companyName);

        type Transaction = {
            date: string;
            description: string;
            saleAmount: number;
            paymentAmount: number;
            balance: number;
            type: 'invoice' | 'payment';
            sourceId: string;
            siteName?: string;
            teamName?: string;
            memo?: string;
        };

        const transactions: Transaction[] = [];

        invoices.forEach(inv => {
            if (inv.status === 'cancelled') return;

            transactions.push({
                date: inv.invoiceDate,
                description: inv.itemName || '세금계산서',
                saleAmount: inv.type === 'sales' ? inv.totalAmount : 0,
                paymentAmount: 0,
                balance: 0,
                type: 'invoice',
                sourceId: inv.id || '',
                siteName: inv.siteName,
                teamName: inv.teamName,
                memo: inv.memo,
            });
        });

        payments.forEach(pay => {
            transactions.push({
                date: pay.date,
                description: pay.type === 'in' ? '입금' : '지급',
                saleAmount: 0,
                paymentAmount: pay.type === 'in' ? pay.amount : 0,
                balance: 0,
                type: 'payment',
                sourceId: pay.id || '',
                siteName: pay.siteName,
                teamName: pay.teamName,
                memo: pay.memo
            });
        });

        transactions.sort((a, b) => a.date.localeCompare(b.date));

        let runningBalance = 0;
        transactions.forEach(tx => {
            runningBalance += tx.saleAmount - tx.paymentAmount;
            tx.balance = runningBalance;
        });

        return transactions;
    }
};
