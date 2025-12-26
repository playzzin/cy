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
    where,
    orderBy,
    serverTimestamp,
    Timestamp,
    writeBatch
} from 'firebase/firestore';
import {
    Receivable,
    Payment,
    ReceivableFilters,
    ReceivableStatistics,
    CustomerStatistics,
    ReceivableStatus
} from '../types/receivable';

const COLLECTION_NAME = 'receivables';

/**
 * 미수금 서비스
 */
export const receivableService = {
    /**
     * 미수금 생성 (세금계산서 발행 시 자동)
     */
    create: async (data: Omit<Receivable, 'id'>): Promise<string> => {
        try {
            const docRef = await addDoc(collection(db, COLLECTION_NAME), {
                ...data,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            return docRef.id;
        } catch (error) {
            console.error('Error creating receivable:', error);
            throw error;
        }
    },

    /**
     * 전체 미수금 조회 (필터링 가능)
     */
    getAll: async (filters?: ReceivableFilters): Promise<Receivable[]> => {
        try {
            let q = query(collection(db, COLLECTION_NAME), orderBy('issueDate', 'desc'));

            // 필터 적용
            if (filters?.customerName) {
                q = query(q, where('customerName', '==', filters.customerName));
            }
            if (filters?.status) {
                q = query(q, where('status', '==', filters.status));
            }
            if (filters?.year) {
                q = query(q, where('issueYear', '==', filters.year));
            }

            const snapshot = await getDocs(q);
            const receivables = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Receivable));

            // 날짜 범위 필터 (클라이언트 사이드)
            if (filters?.startDate || filters?.endDate) {
                return receivables.filter(r => {
                    if (filters.startDate && r.issueDate < filters.startDate) return false;
                    if (filters.endDate && r.issueDate > filters.endDate) return false;
                    return true;
                });
            }

            return receivables;
        } catch (error) {
            console.error('Error getting receivables:', error);
            return [];
        }
    },

    /**
     * ID로 미수금 조회
     */
    getById: async (id: string): Promise<Receivable | null> => {
        try {
            const docRef = doc(db, COLLECTION_NAME, id);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                return {
                    id: docSnap.id,
                    ...docSnap.data()
                } as Receivable;
            }
            return null;
        } catch (error) {
            console.error('Error getting receivable by ID:', error);
            return null;
        }
    },

    /**
     * 거래처별 미수금 조회
     */
    getByCustomer: async (customerName: string): Promise<Receivable[]> => {
        try {
            const q = query(
                collection(db, COLLECTION_NAME),
                where('customerName', '==', customerName),
                orderBy('issueDate', 'desc')
            );
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Receivable));
        } catch (error) {
            console.error('Error getting receivables by customer:', error);
            return [];
        }
    },

    /**
     * 기간별 미수금 조회
     */
    getByDateRange: async (startDate: string, endDate: string): Promise<Receivable[]> => {
        try {
            const q = query(
                collection(db, COLLECTION_NAME),
                where('issueDate', '>=', startDate),
                where('issueDate', '<=', endDate),
                orderBy('issueDate', 'desc')
            );
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Receivable));
        } catch (error) {
            console.error('Error getting receivables by date range:', error);
            return [];
        }
    },

    /**
     * 입금 등록
     */
    addPayment: async (receivableId: string, payment: Omit<Payment, 'id' | 'receivableId'>): Promise<void> => {
        try {
            const receivable = await receivableService.getById(receivableId);
            if (!receivable) {
                throw new Error('Receivable not found');
            }

            // 새 입금 내역 추가
            const newPayment: Payment = {
                id: `pay_${Date.now()}`,
                receivableId,
                ...payment,
                createdAt: Timestamp.now()
            };

            const updatedPayments = [...(receivable.payments || []), newPayment];

            // 총 입금액 계산
            const totalPaid = updatedPayments.reduce((sum, p) => sum + p.amount, 0);

            // 미수금 계산
            const balance = receivable.totalAmount - totalPaid;

            // 상태 업데이트
            let status: ReceivableStatus;
            if (balance <= 0) {
                status = ReceivableStatus.PAID;
            } else if (totalPaid > 0) {
                status = ReceivableStatus.PARTIAL;
            } else {
                status = ReceivableStatus.UNPAID;
            }

            // 미수금 업데이트
            await updateDoc(doc(db, COLLECTION_NAME, receivableId), {
                payments: updatedPayments,
                totalPaid,
                balance,
                status,
                updatedAt: serverTimestamp()
            });
        } catch (error) {
            console.error('Error adding payment:', error);
            throw error;
        }
    },

    /**
     * 미수금 잔액 재계산 (데이터 정합성 복구용)
     */
    updateBalance: async (receivableId: string): Promise<void> => {
        try {
            const receivable = await receivableService.getById(receivableId);
            if (!receivable) return;

            const totalPaid = (receivable.payments || []).reduce((sum, p) => sum + p.amount, 0);
            const balance = receivable.totalAmount - totalPaid;

            let status: ReceivableStatus;
            if (balance <= 0) {
                status = ReceivableStatus.PAID;
            } else if (totalPaid > 0) {
                status = ReceivableStatus.PARTIAL;
            } else {
                status = ReceivableStatus.UNPAID;
            }

            await updateDoc(doc(db, COLLECTION_NAME, receivableId), {
                totalPaid,
                balance,
                status,
                updatedAt: serverTimestamp()
            });
        } catch (error) {
            console.error('Error updating balance:', error);
            throw error;
        }
    },

    /**
     * 통계 조회
     */
    getStatistics: async (year?: number, month?: number): Promise<ReceivableStatistics> => {
        try {
            let filters: ReceivableFilters = {};
            if (year) filters.year = year;
            if (month) filters.month = month;

            const receivables = await receivableService.getAll(filters);

            const totalIssued = receivables.reduce((sum, r) => sum + r.totalAmount, 0);
            const totalPaid = receivables.reduce((sum, r) => sum + r.totalPaid, 0);
            const totalBalance = receivables.reduce((sum, r) => sum + r.balance, 0);

            // 연체 체크 (30일 초과)
            const today = new Date();
            const overdueReceivables = receivables.filter(r => {
                if (r.status === ReceivableStatus.PAID) return false;
                const issueDate = new Date(r.issueDate);
                const daysDiff = Math.floor((today.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24));
                return daysDiff > 30;
            });

            const overdueCount = overdueReceivables.length;
            const overdueAmount = overdueReceivables.reduce((sum, r) => sum + r.balance, 0);

            return {
                totalIssued,
                totalPaid,
                totalBalance,
                overdueCount,
                overdueAmount
            };
        } catch (error) {
            console.error('Error getting statistics:', error);
            return {
                totalIssued: 0,
                totalPaid: 0,
                totalBalance: 0,
                overdueCount: 0,
                overdueAmount: 0
            };
        }
    },

    /**
     * 거래처별 통계
     */
    getCustomerStatistics: async (customerName: string): Promise<CustomerStatistics> => {
        try {
            const receivables = await receivableService.getByCustomer(customerName);

            const totalIssued = receivables.reduce((sum, r) => sum + r.totalAmount, 0);
            const totalPaid = receivables.reduce((sum, r) => sum + r.totalPaid, 0);
            const totalBalance = receivables.reduce((sum, r) => sum + r.balance, 0);

            // 평균 회수 기간 계산 (완납된 건만)
            const paidReceivables = receivables.filter(r => r.status === ReceivableStatus.PAID);
            let averageCollectionDays = 0;

            if (paidReceivables.length > 0) {
                const totalDays = paidReceivables.reduce((sum, r) => {
                    if (r.payments.length === 0) return sum;
                    const issueDate = new Date(r.issueDate);
                    const lastPaymentDate = new Date(r.payments[r.payments.length - 1].paymentDate);
                    const days = Math.floor((lastPaymentDate.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24));
                    return sum + days;
                }, 0);
                averageCollectionDays = Math.floor(totalDays / paidReceivables.length);
            }

            return {
                customerName,
                totalIssued,
                totalPaid,
                totalBalance,
                averageCollectionDays,
                receivableCount: receivables.length
            };
        } catch (error) {
            console.error('Error getting customer statistics:', error);
            return {
                customerName,
                totalIssued: 0,
                totalPaid: 0,
                totalBalance: 0,
                averageCollectionDays: 0,
                receivableCount: 0
            };
        }
    },

    /**
     * 연체 미수금 조회
     */
    checkOverdue: async (): Promise<Receivable[]> => {
        try {
            const receivables = await receivableService.getAll();
            const today = new Date();

            return receivables.filter(r => {
                if (r.status === ReceivableStatus.PAID) return false;
                const issueDate = new Date(r.issueDate);
                const daysDiff = Math.floor((today.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24));
                return daysDiff > 30; // 30일 초과 연체
            });
        } catch (error) {
            console.error('Error checking overdue:', error);
            return [];
        }
    },

    /**
     * 미수금 삭제
     */
    delete: async (id: string): Promise<void> => {
        try {
            await deleteDoc(doc(db, COLLECTION_NAME, id));
        } catch (error) {
            console.error('Error deleting receivable:', error);
            throw error;
        }
    },

    /**
     * 미수금 수정
     */
    update: async (id: string, data: Partial<Receivable>): Promise<void> => {
        try {
            await updateDoc(doc(db, COLLECTION_NAME, id), {
                ...data,
                updatedAt: serverTimestamp()
            });
        } catch (error) {
            console.error('Error updating receivable:', error);
            throw error;
        }
    }
};
