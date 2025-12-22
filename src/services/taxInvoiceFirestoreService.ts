/**
 * 세금계산서 Firestore 서비스
 * 
 * 세금계산서 발행 기록을 Firestore에 저장하고 관리합니다.
 * 바로빌 API 연동과는 별도로 내부 기록용입니다.
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
    Timestamp,
    limit
} from 'firebase/firestore';

// 세금계산서 타입
export type TaxInvoiceType = 'sales' | 'purchase'; // 매출 / 매입

// 세금계산서 상태
export type TaxInvoiceStatus =
    | 'draft'      // 작성중
    | 'issued'     // 발행완료
    | 'received'   // 수취완료
    | 'cancelled'; // 취소

// 세금계산서 기록 인터페이스
export interface TaxInvoiceRecord {
    id?: string;

    // 기본 정보
    invoiceNum: string;              // 세금계산서 번호
    invoiceDate: string;             // 발행일 (YYYY-MM-DD)
    type: TaxInvoiceType;            // 매출/매입
    status: TaxInvoiceStatus;        // 상태

    // 공급자 정보
    invoicerCorpNum: string;         // 공급자 사업자번호
    invoicerCorpName: string;        // 공급자 상호
    invoicerCeoName?: string;        // 공급자 대표자명
    invoicerAddr?: string;           // 공급자 주소

    // 공급받는자 정보
    invoiceeCorpNum?: string;        // 공급받는자 사업자번호 (수기일 경우 선택)
    invoiceeCorpName: string;        // 공급받는자 상호 (필수)
    invoiceeCeoName?: string;        // 공급받는자 대표자명
    invoiceeAddr?: string;           // 공급받는자 주소
    invoiceeCompanyId?: string;      // Firestore company ID (연결용, 수기일 경우 없음)

    // 금액 정보
    supplyAmount: number;            // 공급가액
    taxAmount: number;               // 세액
    totalAmount: number;             // 합계금액

    // 출처 정보
    source: 'barobill' | 'manual' | 'excel'; // 바로빌API / 수기입력 / 엑셀업로드

    // 품목 요약
    itemName?: string;               // 대표 품목명
    itemCount?: number;              // 품목 수

    // 연결 정보 (Firestore 참조)
    siteId?: string;                 // 현장 ID
    siteName?: string;               // 현장명
    teamId?: string;                 // 팀 ID
    teamName?: string;               // 팀명

    // 바로빌 연동 정보
    barobillSendKey?: string;        // 바로빌 전송키
    barobillStatus?: string;         // 바로빌 상태
    barobillNtsResult?: string;      // 국세청 전송 결과

    // 메타 정보
    memo?: string;                   // 비고
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
    createdBy?: string;              // 작성자
}

const COLLECTION_NAME = 'taxInvoices';

export const taxInvoiceFirestoreService = {
    /**
     * 세금계산서 추가
     */
    addTaxInvoice: async (
        record: Omit<TaxInvoiceRecord, 'id' | 'createdAt' | 'updatedAt'>
    ): Promise<string> => {
        const docRef = await addDoc(collection(db, COLLECTION_NAME), {
            ...record,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        });
        return docRef.id;
    },

    /**
     * 세금계산서 수정
     */
    updateTaxInvoice: async (id: string, updates: Partial<TaxInvoiceRecord>): Promise<void> => {
        const docRef = doc(db, COLLECTION_NAME, id);
        await updateDoc(docRef, {
            ...updates,
            updatedAt: Timestamp.now()
        });
    },

    /**
     * 세금계산서 삭제
     */
    deleteTaxInvoice: async (id: string): Promise<void> => {
        await deleteDoc(doc(db, COLLECTION_NAME, id));
    },

    /**
     * 세금계산서 ID로 조회
     */
    getTaxInvoiceById: async (id: string): Promise<TaxInvoiceRecord | null> => {
        const docRef = doc(db, COLLECTION_NAME, id);
        const snap = await getDoc(docRef);
        if (!snap.exists()) return null;
        return { id: snap.id, ...snap.data() } as TaxInvoiceRecord;
    },

    /**
     * 전체 세금계산서 조회 (최신순)
     */
    getTaxInvoices: async (limitCount?: number): Promise<TaxInvoiceRecord[]> => {
        let q = query(
            collection(db, COLLECTION_NAME),
            orderBy('invoiceDate', 'desc')
        );

        if (limitCount) {
            q = query(q, limit(limitCount));
        }

        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as TaxInvoiceRecord));
    },

    /**
     * 타입별 조회 (매출/매입)
     */
    getTaxInvoicesByType: async (type: TaxInvoiceType): Promise<TaxInvoiceRecord[]> => {
        const q = query(
            collection(db, COLLECTION_NAME),
            where('type', '==', type),
            orderBy('invoiceDate', 'desc')
        );
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as TaxInvoiceRecord));
    },

    /**
     * 거래처별 조회 (공급받는자 기준)
     */
    getTaxInvoicesByCompany: async (companyId: string): Promise<TaxInvoiceRecord[]> => {
        const q = query(
            collection(db, COLLECTION_NAME),
            where('invoiceeCompanyId', '==', companyId),
            orderBy('invoiceDate', 'desc')
        );
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as TaxInvoiceRecord));
    },

    /**
     * 거래처명별 조회 (수기 입력 데이터용)
     */
    getTaxInvoicesByCompanyName: async (companyName: string): Promise<TaxInvoiceRecord[]> => {
        const q = query(
            collection(db, COLLECTION_NAME),
            where('invoiceeCorpName', '==', companyName),
            orderBy('invoiceDate', 'desc')
        );
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as TaxInvoiceRecord));
    },

    /**
     * 현장별 조회
     */
    getTaxInvoicesBySite: async (siteId: string): Promise<TaxInvoiceRecord[]> => {
        const q = query(
            collection(db, COLLECTION_NAME),
            where('siteId', '==', siteId),
            orderBy('invoiceDate', 'desc')
        );
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as TaxInvoiceRecord));
    },

    /**
     * 기간별 조회
     */
    getTaxInvoicesByDateRange: async (
        startDate: string,
        endDate: string,
        type?: TaxInvoiceType
    ): Promise<TaxInvoiceRecord[]> => {
        let q = query(
            collection(db, COLLECTION_NAME),
            where('invoiceDate', '>=', startDate),
            where('invoiceDate', '<=', endDate),
            orderBy('invoiceDate', 'desc')
        );

        const querySnapshot = await getDocs(q);
        let results = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as TaxInvoiceRecord));

        // 타입 필터 (클라이언트 사이드)
        if (type) {
            results = results.filter(r => r.type === type);
        }

        return results;
    },

    /**
     * 거래처별 합계 계산
     */
    calculateCompanyTotals: async (companyId: string): Promise<{
        salesTotal: number;
        purchaseTotal: number;
        balance: number;
    }> => {
        const records = await taxInvoiceFirestoreService.getTaxInvoicesByCompany(companyId);

        let salesTotal = 0;
        let purchaseTotal = 0;

        records.forEach(record => {
            if (record.status === 'cancelled') return;

            if (record.type === 'sales') {
                salesTotal += record.totalAmount;
            } else {
                purchaseTotal += record.totalAmount;
            }
        });

        return {
            salesTotal,
            purchaseTotal,
            balance: salesTotal - purchaseTotal
        };
    }
};
